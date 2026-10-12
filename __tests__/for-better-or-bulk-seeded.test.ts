// @vitest-environment node
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  BURN_SECONDS,
  CAPABILITIES,
  COOK_SECONDS,
  DEFAULT_SETUP,
  IDLE_FRAME,
  IDLE_INPUT,
  INTERRUPTIONS,
  LINE_BANK,
  MAX_SEED,
  PATIO_ROWS,
  RECEIPT_COPY,
  RUSH_BURN_FACTOR,
  RUSH_STARTS,
  SHOWER_STARTS,
  SHOWER_WALK_FACTOR,
  VENUE_MAP,
  bankText,
  computeReceipt,
  createLevel,
  createPrng,
  dailySeed,
  parseSeed,
  replayLevel,
  seededEvents,
  stepGame,
  validateDecision,
  validateSetup,
  type Frame,
  type GameEvent,
  type GameState,
  type ItemKind,
  type PresenceDecision,
  type Setup,
  type Station,
} from "@/lib/for-better-or-bulk";
import { REAL_FACTS_FROM_DESIGN_DOC } from "./fixtures/for-better-or-bulk-real-facts";
import {
  describeEvent,
  activeEventLines,
  seedHeader,
} from "@/components/for-better-or-bulk/messages";
import { countsForBoard } from "@/components/for-better-or-bulk/board";
import { drawVenue } from "@/components/for-better-or-bulk/venue-canvas";

const STAY: PresenceDecision = { choice: "stay", commitment: null };

/** The standard day with a seed. */
function seeded(seed: number): Setup {
  return { ...DEFAULT_SETUP, seed };
}

/** Plays a level to its end with nobody working, answering the text with Stay. */
function runFrom(start: GameState): { events: GameEvent[]; state: GameState } {
  let state = start;
  const events: GameEvent[] = [];
  for (let i = 0; i < 20000 && state.phase !== "done"; i++) {
    const frame: Frame =
      state.phase === "brothers"
        ? { ...IDLE_FRAME, decision: STAY }
        : IDLE_FRAME;
    const result = stepGame(state, frame);
    events.push(...result.events);
    state = result.state;
  }
  return { events, state };
}

function runToEnd(setup: Setup): { events: GameEvent[]; state: GameState } {
  return runFrom(createLevel(setup));
}

/** Every .ts and .tsx file under a directory. */
function listSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listSources(full) : [full];
  });
}

/** The engine and the game's components, for the hard-rule scans. */
function shippedSources(): string[] {
  return [
    ...listSources(path.resolve(process.cwd(), "lib", "for-better-or-bulk")),
    ...listSources(
      path.resolve(process.cwd(), "components", "for-better-or-bulk")
    ),
  ];
}

/** The seeded event with this id, from a level that has one. */
function eventOf(
  state: GameState,
  id: "shower" | "guest-rush"
): { at: number; until: number } {
  const event = state.seeded.find((e) => e.id === id);
  if (!event) throw new Error(`${id} should be scheduled`);
  return event;
}

/** The grill of a level. */
function grillOf(state: GameState): Station {
  const grill = state.stations.find((s) => s.kind === "grill");
  if (!grill) throw new Error("the venue has a grill");
  return grill;
}

/** The same level with one item on the grill at a time, the brothers' text out of the way. */
function withGrillItem(
  base: GameState,
  time: number,
  kind: ItemKind,
  progress: number
): GameState {
  const grill = grillOf(base);
  return {
    ...base,
    time,
    brothersAt: 0,
    stations: base.stations.map((s) =>
      s.id === grill.id
        ? { ...grill, item: { kind, madeBy: null }, progress }
        : s
    ),
  };
}

/** Steps with no input until the item burns, and reports when it cooked and burnt. */
function grillTimes(
  start: GameState,
  maxTicks = 2000
): { cooked?: number; burnt?: number } {
  const times: { cooked?: number; burnt?: number } = {};
  let state = start;
  for (let i = 0; i < maxTicks && times.burnt === undefined; i++) {
    const result = stepGame(state, IDLE_FRAME);
    for (const event of result.events) {
      if (event.type === "cooked" && times.cooked === undefined) {
        times.cooked = result.state.time;
      }
      if (event.type === "burnt" && times.burnt === undefined) {
        times.burnt = result.state.time;
      }
    }
    state = result.state;
  }
  return times;
}

/** Whether one tick from this state burns the grill's item. */
function burnsOnNextTick(state: GameState): boolean {
  return stepGame(state, IDLE_FRAME).events.some((e) => e.type === "burnt");
}

describe("the seeded generator", () => {
  it("gives the same sequence for the same seed", () => {
    const first = createPrng(42);
    const second = createPrng(42);
    const a = Array.from({ length: 50 }, () => first.next());
    const b = Array.from({ length: 50 }, () => second.next());
    expect(a).toEqual(b);
  });

  it("keeps every number in [0, 1) and every integer in its inclusive range", () => {
    const draw = createPrng(7);
    for (let i = 0; i < 500; i++) {
      const value = draw.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      const whole = draw.int(3, 9);
      expect(Number.isInteger(whole)).toBe(true);
      expect(whole).toBeGreaterThanOrEqual(3);
      expect(whole).toBeLessThanOrEqual(9);
    }
  });

  it("gives different sequences for different seeds", () => {
    expect(createPrng(1).next()).not.toBe(createPrng(2).next());
  });
});

describe("the daily seed", () => {
  it("is the same for every time on the same UTC date", () => {
    expect(dailySeed(new Date("2026-10-11T00:00:00Z"))).toBe(
      dailySeed(new Date("2026-10-11T23:59:59Z"))
    );
  });

  it("differs from one date to the next", () => {
    const days = Array.from({ length: 60 }, (_, i) =>
      dailySeed(new Date(Date.UTC(2026, 9, 1 + i)))
    );
    expect(new Set(days).size).toBe(60);
  });

  it("is always a whole number from 1 to MAX_SEED, never the standard day", () => {
    for (let i = 0; i < 60; i++) {
      const seed = dailySeed(new Date(Date.UTC(2026, 0, 1 + i)));
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(1);
      expect(seed).toBeLessThanOrEqual(MAX_SEED);
    }
  });
});

describe("the seed in a link and in setup", () => {
  it("reads a whole number and ignores junk, out-of-range values and blanks", () => {
    expect(parseSeed("17")).toBe(17);
    expect(parseSeed(" 42 ")).toBe(42);
    expect(parseSeed(String(MAX_SEED))).toBe(MAX_SEED);
    for (const junk of [
      null,
      undefined,
      "",
      "abc",
      "12.5",
      "-3",
      "1e3",
      "99999999999",
      String(MAX_SEED + 1),
    ]) {
      expect(parseSeed(junk)).toBe(0);
    }
  });

  it("refuses a seed that is not a whole number in range", () => {
    for (const seed of [-1, 1.5, MAX_SEED + 1, Number.NaN]) {
      expect(validateSetup(seeded(seed)).ok).toBe(false);
    }
    expect(validateSetup(seeded(MAX_SEED)).ok).toBe(true);
  });
});

describe("seeded events", () => {
  it("schedules no shower and no guest rush on seed 0", () => {
    expect(createLevel(DEFAULT_SETUP).seeded).toEqual([]);
    const { events } = runToEnd(DEFAULT_SETUP);
    expect(events.filter((e) => e.type === "seeded-start")).toEqual([]);
  });

  it("treats a setup with no seed as the standard day, so old runs replay", () => {
    const legacy: Setup = {
      capabilities: DEFAULT_SETUP.capabilities,
      cart: DEFAULT_SETUP.cart,
      relaxed: false,
    };
    expect(createLevel(legacy).seeded).toEqual([]);
    const old = replayLevel(legacy, []).state;
    const standard = replayLevel(DEFAULT_SETUP, []).state;
    expect(old.players).toEqual(standard.players);
    expect(old.stations).toEqual(standard.stations);
    expect(old.targets).toEqual(standard.targets);
    expect(old.seeded).toEqual(standard.seeded);
  });

  it("schedules a shower and a guest rush deterministically from a nonzero seed", () => {
    const first = createLevel(seeded(7)).seeded;
    expect(createLevel(seeded(7)).seeded).toEqual(first);
    expect(first.map((e) => e.id)).toEqual(["shower", "guest-rush"]);
    const [shower, rush] = first;
    expect(shower.at).toBeGreaterThanOrEqual(SHOWER_STARTS.earliest);
    expect(shower.at).toBeLessThanOrEqual(SHOWER_STARTS.latest);
    expect(rush.at).toBeGreaterThanOrEqual(RUSH_STARTS.earliest);
    expect(rush.at).toBeLessThanOrEqual(RUSH_STARTS.latest);
    expect(seededEvents(0, 200)).toEqual([]);
  });

  it("spreads the shower times across seeds rather than fixing one", () => {
    const starts = new Set(
      Array.from({ length: 30 }, (_, i) => seededEvents(i + 1, 200)[0].at)
    );
    expect(starts.size).toBeGreaterThan(1);
  });

  it("starts each seeded event once in a full run", () => {
    const { events } = runToEnd(seeded(7));
    const starts = events
      .filter((e) => e.type === "seeded-start")
      .map((e) => (e.type === "seeded-start" ? e.id : ""))
      .sort();
    expect(starts).toEqual(["guest-rush", "shower"]);
  });

  it("slows walkers on the lawn during the shower, and only there", () => {
    const base = createLevel(seeded(7));
    const shower = eventOf(base, "shower");
    const dry = createLevel(DEFAULT_SETUP);
    /** Walking right for one tick from a spot, with the brothers' text out of the way. */
    const strideAt = (state: GameState, x: number, y: number): number => {
      const placed: GameState = {
        ...state,
        brothersAt: 0,
        players: {
          ...state.players,
          fred: { ...state.players.fred, x, y },
        },
      };
      const next = stepGame(placed, {
        inputs: { fred: { ...IDLE_INPUT, moveX: 1 }, abbi: IDLE_INPUT },
      }).state;
      return next.players.fred.x - placed.players.fred.x;
    };
    const during = { ...base, time: shower.at + 0.5 };
    const duringDry = { ...dry, time: shower.at + 0.5 };
    const after = { ...base, time: shower.until + 0.5 };
    const afterDry = { ...dry, time: shower.until + 0.5 };
    // Lawn tiles on the left and on the right are both slowed.
    for (const [x, y] of [
      [2.5, PATIO_ROWS + 1.5],
      [13.5, 6.5],
    ]) {
      expect(strideAt(during, x, y)).toBeGreaterThan(0);
      expect(strideAt(during, x, y) / strideAt(duringDry, x, y)).toBeCloseTo(
        SHOWER_WALK_FACTOR,
        5
      );
      expect(strideAt(after, x, y)).toBeCloseTo(strideAt(afterDry, x, y), 10);
    }
    // The paving rows above the lawn are not wet.
    for (const [x, y] of [
      [2.5, PATIO_ROWS - 0.5],
      [15.5, 3.5],
    ]) {
      expect(strideAt(during, x, y)).toBeGreaterThan(0);
      expect(strideAt(during, x, y)).toBeCloseTo(strideAt(duringDry, x, y), 10);
    }
  });

  it("draws rain on every lawn tile during the shower and on no other", () => {
    const base = createLevel(seeded(7));
    const shower = eventOf(base, "shower");
    const lawnTiles = VENUE_MAP.flatMap((row, y) =>
      y > PATIO_ROWS ? [...row].filter((char) => char !== "#") : []
    ).length;
    const strokes = (state: GameState): number => {
      const calls: string[] = [];
      drawVenue(recordingContext(calls), state, null);
      return calls.filter((name) => name === "stroke").length;
    };
    const during = strokes({ ...base, time: shower.at + 0.5 });
    const after = strokes({ ...base, time: shower.until + 0.5 });
    expect(during - after).toBe(lawnTiles);
  });

  it("names the shower's effect in the status line only while it is on", () => {
    const base = createLevel(seeded(7));
    const shower = eventOf(base, "shower");
    expect(activeEventLines({ ...base, time: shower.at + 0.5 })).toEqual([
      "Shower: the lawn is slow",
    ]);
    expect(activeEventLines({ ...base, time: shower.until + 0.5 })).toEqual([]);
  });

  it("burns the grill sooner during the guest rush", () => {
    const base = createLevel(seeded(7));
    const rush = eventOf(base, "guest-rush");
    // Cooked, with a little under one tick of the window left: a normal tick
    // does not finish it, a rush tick (at double speed) does.
    const pickup = BURN_SECONDS - COOK_SECONDS;
    const almostBurnt = (time: number) =>
      withGrillItem(base, time, "hotdogs", pickup - 0.05);
    expect(burnsOnNextTick(almostBurnt(rush.at + 0.5))).toBe(true);
    expect(burnsOnNextTick(almostBurnt(rush.until + 0.5))).toBe(false);
  });

  it("does not burn food cooked before the rush on the rush's first tick", () => {
    const base = createLevel(seeded(7));
    const rush = eventOf(base, "guest-rush");
    // Cooked 9 s before the rush: 9 s of its 10 s window have gone by when it starts.
    const cookedEarly = withGrillItem(base, rush.at, "hotdogs", 9);
    expect(burnsOnNextTick(cookedEarly)).toBe(false);
    const times = grillTimes(cookedEarly);
    expect(times.burnt).toBeDefined();
    // The 1 s left is halved by the rush: it burns about half a second in.
    expect((times.burnt ?? 0) - rush.at).toBeGreaterThanOrEqual(0.4);
    expect((times.burnt ?? 0) - rush.at).toBeLessThanOrEqual(0.6);
  });

  it("shortens a pickup window cooked in the rush, and keeps it on a standard day", () => {
    const base = createLevel(seeded(7));
    const rush = eventOf(base, "guest-rush");
    const plainStart = withGrillItem(
      createLevel(DEFAULT_SETUP),
      0,
      "hotdogs-raw",
      0
    );
    const plain = grillTimes(plainStart);
    const rushed = grillTimes(withGrillItem(base, rush.at, "hotdogs-raw", 0));
    if (
      plain.cooked === undefined ||
      plain.burnt === undefined ||
      rushed.cooked === undefined ||
      rushed.burnt === undefined
    ) {
      throw new Error("both grills should cook and burn");
    }
    const plainWindow = plain.burnt - plain.cooked;
    const rushedWindow = rushed.burnt - rushed.cooked;
    expect(plainWindow).toBeCloseTo(BURN_SECONDS - COOK_SECONDS, 1);
    expect(rushedWindow).toBeLessThan(plainWindow * 0.6);
    expect(rushedWindow).toBeGreaterThan(plainWindow * 0.4);
    expect(rushedWindow).toBeCloseTo(
      (BURN_SECONDS - COOK_SECONDS) * RUSH_BURN_FACTOR,
      1
    );
  });

  it("keeps the same final state for the same seed and frames", () => {
    const inputArb = fc.record({
      moveX: fc.constantFrom(-1, 0, 1),
      moveY: fc.constantFrom(-1, 0, 1),
      interact: fc.boolean(),
      interactHeld: fc.boolean(),
      work: fc.boolean(),
    });
    const frameArb: fc.Arbitrary<Frame> = fc
      .record({
        inputs: fc.record({ fred: inputArb, abbi: inputArb }),
        decide: fc.boolean(),
      })
      .map(({ inputs, decide }) =>
        decide ? { inputs, decision: STAY } : { inputs }
      );
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999 }),
        fc.array(frameArb, { minLength: 1300, maxLength: 3000 }),
        (seed, planned) => {
          // The live run sends each frame it can, and records what it sent.
          let state = createLevel(seeded(seed));
          const recorded: Frame[] = [];
          for (const plan of planned) {
            const frame: Frame =
              plan.decision && !validateDecision(state, plan.decision).ok
                ? { inputs: plan.inputs }
                : plan;
            recorded.push(frame);
            state = stepGame(state, frame).state;
          }
          // A strict replay of the recorded frames must rebuild the same state.
          const replayed = replayLevel(seeded(seed), recorded);
          expect(replayed.dropped).toEqual([]);
          expect(replayed.state).toEqual(state);
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);
});

describe("the seed header's order (#1931)", () => {
  it("lists a seeded day's events in clock order, whatever order the engine seeded them in", () => {
    const state = createLevel(seeded(12345));
    // The engine seeds the shower first, but the rush comes first on the clock.
    expect(state.seeded[0]?.id).toBe("shower");
    const header = seedHeader(state, 0);
    expect(header.indexOf("rush at")).toBeGreaterThanOrEqual(0);
    expect(header.indexOf("rush at")).toBeLessThan(header.indexOf("shower at"));
  });
});

describe("the receipt's weather", () => {
  it("shows the real weather line from the bank and no game weather on a standard day", () => {
    const receipt = computeReceipt(runToEnd(DEFAULT_SETUP).state);
    expect(receipt.weather).toBe(bankText("weather"));
    expect(receipt.weather).toBe(
      "The weather was perfect. Fred took the credit."
    );
    expect(receipt.gameWeather).toBeNull();
  });

  it("labels a shower as game weather, apart from the real line", () => {
    const receipt = computeReceipt(runToEnd(seeded(7)).state);
    expect(receipt.weather).toBe(
      "The game had a shower. The real weather is in the notes at the bottom."
    );
    expect(receipt.weather).not.toMatch(/perfect/i);
    expect(receipt.gameWeather).toMatch(
      /^Game weather, not the real day: a shower from .* slowed walking on the lawn\.$/
    );
  });

  it("keeps the weather line in step with the game weather on seed 12345 when the work ends before the shower (#1931)", () => {
    const base = createLevel(seeded(12345));
    const shower = eventOf(base, "shower");
    const early: GameState = {
      ...base,
      phase: "done",
      time: shower.at - 5,
      finishedAt: shower.at - 5,
    };
    const receipt = computeReceipt(early);
    expect(receipt.weather).not.toContain("had a shower");
    expect(receipt.weather).toContain("shower was due after the work was done");
    expect(receipt.gameWeather).toContain("was due at 12:27");
    expect(receipt.weather).not.toMatch(/perfect/i);
  });

  it("says a shower the work finished before was never due", () => {
    const base = createLevel(seeded(7));
    const shower = eventOf(base, "shower");
    const early: GameState = {
      ...base,
      phase: "done",
      time: shower.at - 5,
      finishedAt: shower.at - 5,
    };
    expect(computeReceipt(early).gameWeather).toContain("was due at");
  });
});

describe("the line bank", () => {
  it("tags every line Real or Fiction, with unique ids", () => {
    for (const line of LINE_BANK) {
      expect(["Real", "Fiction"]).toContain(line.tag);
    }
    const ids = LINE_BANK.map((line) => line.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("quotes each real line word for word from the design doc's fact list", () => {
    const reals = LINE_BANK.filter((line) => line.tag === "Real");
    for (const line of reals) {
      expect(line.fact).not.toBeNull();
      // The fixture is a copy of section 1 of the design doc, not the game's own text.
      const source = REAL_FACTS_FROM_DESIGN_DOC.find((fact) =>
        fact.text.includes(line.text)
      );
      expect(source?.id, `${line.id} quotes a fact from the doc`).toBe(
        line.fact
      );
    }
  });

  it("uses every fact in the design doc exactly once", () => {
    const quoted = LINE_BANK.flatMap((line) =>
      line.tag === "Real" && line.fact !== null ? [line.fact] : []
    );
    expect([...quoted].sort()).toEqual(
      REAL_FACTS_FROM_DESIGN_DOC.map((fact) => fact.id).sort()
    );
  });

  it("attaches no fact to a fiction line", () => {
    for (const line of LINE_BANK.filter((l) => l.tag === "Fiction")) {
      expect(line.fact).toBeNull();
    }
  });

  it("shows the seeded toasts from the bank, in words that match the effect", () => {
    expect(describeEvent({ type: "seeded-start", id: "shower" })).toBe(
      bankText("shower-start")
    );
    expect(describeEvent({ type: "seeded-start", id: "guest-rush" })).toBe(
      bankText("rush-start")
    );
    expect(bankText("shower-start")).toContain("slows walking on the lawn");
    expect(bankText("rush-start")).toContain("Food on the grill burns faster");
    expect(describeEvent({ type: "seeded-end", id: "shower" })).toBe(
      bankText("shower-end")
    );
    expect(describeEvent({ type: "seeded-end", id: "guest-rush" })).toBe(
      bankText("rush-end")
    );
    expect(bankText("shower-end")).toContain("moves off across the lawn");
  });
});

describe("the seeded toasts over a whole day", () => {
  it("announces each seeded event once at its start and once at its end", () => {
    const { events } = runToEnd(seeded(12345));
    const lines = events
      .map((event) => describeEvent(event))
      .filter((line): line is string => line !== null);
    for (const id of ["shower", "rush"] as const) {
      const start = id === "shower" ? "shower-start" : "rush-start";
      const end = id === "shower" ? "shower-end" : "rush-end";
      expect(
        lines.filter((line) => line === bankText(start)),
        start
      ).toHaveLength(1);
      expect(
        lines.filter((line) => line === bankText(end)),
        end
      ).toHaveLength(1);
    }
  });
});

describe("the seeded toasts when a level ends early", () => {
  it("announces the shower's end once when every target is filled while the shower is on (seed 12345)", () => {
    const start = createLevel(seeded(12345));
    const shower = start.seeded.find((event) => event.id === "shower");
    expect(shower).toBeDefined();
    const mid: GameState = {
      ...start,
      brothersAt: 0,
      time: (shower?.at ?? 0) + 2,
      targets: start.targets.map((t) =>
        t.status === "open" ? { ...t, status: "filled" as const } : t
      ),
    };
    const { events, state } = runFrom(mid);
    expect(state.phase).toBe("done");
    expect(
      events.filter((e) => e.type === "level-finished" && e.early)
    ).toHaveLength(1);
    expect(
      events.filter((e) => e.type === "seeded-end" && e.id === "shower")
    ).toHaveLength(1);
    const lines = events
      .map((event) => describeEvent(event))
      .filter((line): line is string => line !== null);
    expect(
      lines.filter((line) => line === bankText("shower-end"))
    ).toHaveLength(1);
  });
});

describe("the standard board", () => {
  it("counts only a standard day at normal speed", () => {
    const standard = createLevel(DEFAULT_SETUP);
    expect(countsForBoard(standard, 1)).toBe(true);
    expect(countsForBoard(standard, 2)).toBe(false);
    expect(countsForBoard(createLevel(seeded(7)), 1)).toBe(false);
    const legacy: Setup = {
      capabilities: DEFAULT_SETUP.capabilities,
      cart: DEFAULT_SETUP.cart,
      relaxed: false,
    };
    expect(countsForBoard(createLevel(legacy), 1)).toBe(true);
  });

  it("never counts a helper day, even a standard one at normal speed", () => {
    const helperDay = createLevel({ ...DEFAULT_SETUP, assist: true });
    expect(countsForBoard(helperDay, 1)).toBe(false);
  });
});

describe("hard rules for the story", () => {
  /** Every string the game ships, plus a receipt from a seeded run. */
  function shippedText(): string {
    const receipt = computeReceipt(runToEnd(seeded(7)).state);
    return JSON.stringify({
      bank: LINE_BANK,
      receipt,
      copy: RECEIPT_COPY,
      capabilities: CAPABILITIES,
    });
  }

  it("never mentions a makeup story or a speech story", () => {
    expect(shippedText()).not.toMatch(/makeup|speech|caleb/i);
    for (const file of shippedSources()) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(
        /makeup|speech|caleb/i
      );
    }
  });

  it("names the tux shop The Suit Wherehouse", () => {
    const receipt = computeReceipt(runToEnd(DEFAULT_SETUP).state);
    expect(receipt.suit).toContain("The Suit Wherehouse");
  });

  it("uses Kirkland only in product text", () => {
    const bare = shippedText().match(/Kirkland(?! (roses|sheet cake))/g);
    expect(bare).toBeNull();
    const hits = shippedSources().flatMap(
      (file) =>
        readFileSync(file, "utf8").match(/Kirkland(?! (roses|sheet cake))/g) ??
        []
    );
    expect(hits).toEqual([]);
  });
});

describe("no randomness in the engine", () => {
  it("keeps Math.random out of the engine and the game's components", () => {
    const hits = shippedSources().filter((file) =>
      readFileSync(file, "utf8").includes("Math.random")
    );
    expect(hits).toEqual([]);
  });
});

describe("scheduled boundaries", () => {
  it("fires each interruption exactly once over a full day", () => {
    for (const setup of [DEFAULT_SETUP, { ...DEFAULT_SETUP, relaxed: true }]) {
      const { events } = runToEnd(setup);
      const ids = events.flatMap((e) =>
        e.type === "interruption" ? [e.id] : []
      );
      expect(ids.length).toBe(new Set(ids).size);
    }
  });

  it("still fires the registry call when the brothers' text lands on its tick", () => {
    const call = INTERRUPTIONS.find((c) => c.at === 95);
    if (!call) throw new Error("a call is due at 95");
    // The text lands on the tick that crosses 95 s, for times just under it.
    for (const due of [94.97, 94.98, 94.99, 95]) {
      const start: GameState = {
        ...createLevel(DEFAULT_SETUP),
        firstFilledAt: due,
      };
      const { events } = runFrom(start);
      const fired = events.flatMap((e) =>
        e.type === "interruption" && e.id === call.id ? [e.id] : []
      );
      expect(fired, `text due at ${due}`).toEqual([call.id]);
    }
  });
});

/**
 * A canvas context that records each call by name, for counting strokes. Any
 * method returns the same recorder, so chained calls keep working.
 */
function recordingContext(calls: string[]): CanvasRenderingContext2D {
  const values = new Map<PropertyKey, unknown>();
  const recorder: unknown = new Proxy(() => undefined, {
    get(_target, key) {
      if (values.has(key)) return values.get(key);
      if (typeof key !== "string") return undefined;
      return () => {
        calls.push(key);
        return recorder;
      };
    },
    set(_target, key, value: unknown) {
      values.set(key, value);
      return true;
    },
    apply() {
      return recorder;
    },
  });
  return recorder as CanvasRenderingContext2D;
}
