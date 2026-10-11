// @vitest-environment node
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  BURN_SECONDS,
  CAPABILITIES,
  DEFAULT_SETUP,
  DESIGN_REAL_FACTS,
  IDLE_FRAME,
  IDLE_INPUT,
  LINE_BANK,
  MAX_SEED,
  RECEIPT_COPY,
  RUSH_BURN_FACTOR,
  RUSH_STARTS,
  SHOWER_STARTS,
  SHOWER_WALK_FACTOR,
  bankText,
  computeReceipt,
  createLevel,
  createPrng,
  dailySeed,
  parseSeed,
  replayLevel,
  seededEvents,
  stepGame,
  validateSetup,
  type Frame,
  type GameEvent,
  type GameState,
  type PresenceDecision,
  type RealFactId,
  type Setup,
} from "@/lib/for-better-or-bulk";
import { describeEvent } from "@/components/for-better-or-bulk/messages";

const STAY: PresenceDecision = { choice: "stay", commitment: null };

/** The standard day with a seed. */
function seeded(seed: number): Setup {
  return { ...DEFAULT_SETUP, seed };
}

/** Plays a level to its end with nobody working, answering the text with Stay. */
function runToEnd(setup: Setup): { events: GameEvent[]; state: GameState } {
  let state = createLevel(setup);
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

/** Every .ts and .tsx file under a directory. */
function listSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listSources(full) : [full];
  });
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
    const shower = base.seeded.find((e) => e.id === "shower");
    if (!shower) throw new Error("the shower should be scheduled");
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
    const after = { ...base, time: shower.until + 0.5 };
    const duringDry = { ...dry, time: shower.at + 0.5 };
    const lawnStride = strideAt(during, 13.5, 6.5);
    expect(lawnStride / strideAt(duringDry, 13.5, 6.5)).toBeCloseTo(
      SHOWER_WALK_FACTOR,
      5
    );
    expect(strideAt(during, 2.5, 5.5)).toBeCloseTo(
      strideAt(duringDry, 2.5, 5.5),
      10
    );
    expect(strideAt(after, 13.5, 6.5)).toBeCloseTo(
      strideAt({ ...dry, time: shower.until + 0.5 }, 13.5, 6.5),
      10
    );
  });

  it("burns the grill sooner during the guest rush", () => {
    const base = createLevel(seeded(7));
    const rush = base.seeded.find((e) => e.id === "guest-rush");
    if (!rush) throw new Error("the guest rush should be scheduled");
    const grill = base.stations.find((s) => s.kind === "grill");
    if (!grill) throw new Error("the venue has a grill");
    const nearlyBurnt = {
      ...grill,
      item: { kind: "hotdogs" as const, madeBy: null },
      progress: BURN_SECONDS * RUSH_BURN_FACTOR - 0.01,
    };
    const withGrill = (time: number): GameState => ({
      ...base,
      time,
      brothersAt: 0,
      stations: base.stations.map((s) => (s.id === grill.id ? nearlyBurnt : s)),
    });
    const burnt = (state: GameState) =>
      stepGame(state, IDLE_FRAME).events.some((e) => e.type === "burnt");
    expect(burnt(withGrill(rush.at + 0.5))).toBe(true);
    expect(burnt(withGrill(rush.until + 0.5))).toBe(false);
  });

  it("keeps the same final state for the same seed and frames", () => {
    const inputArb = fc.record({
      moveX: fc.constantFrom(-1, 0, 1),
      moveY: fc.constantFrom(-1, 0, 1),
      interact: fc.boolean(),
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
        (seed, frames) => {
          const first = replayLevel(seeded(seed), frames, { mode: "lenient" });
          const second = replayLevel(seeded(seed), frames, { mode: "lenient" });
          expect(second).toEqual(first);
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);
});

describe("the receipt's weather", () => {
  it("keeps the real perfect-weather line and shows no game weather on a standard day", () => {
    const receipt = computeReceipt(runToEnd(DEFAULT_SETUP).state);
    expect(receipt.weather).toMatch(/perfect weather/i);
    expect(receipt.weather).toBe(RECEIPT_COPY.weather);
    expect(receipt.gameWeather).toBeNull();
  });

  it("labels a shower as game weather, apart from the real line", () => {
    const receipt = computeReceipt(runToEnd(seeded(7)).state);
    expect(receipt.weather).toMatch(/perfect weather/i);
    expect(receipt.weather).not.toMatch(/shower|game/i);
    expect(receipt.gameWeather).toMatch(
      /^Game weather, not the real day: a shower from /
    );
  });

  it("says a shower the work finished before was never due", () => {
    const base = createLevel(seeded(7));
    const shower = base.seeded.find((e) => e.id === "shower");
    if (!shower) throw new Error("the shower should be scheduled");
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
    expect(reals.length).toBeGreaterThan(0);
    for (const line of reals) {
      expect(line.fact).not.toBeNull();
      expect(line.text).toBe(DESIGN_REAL_FACTS[line.fact as RealFactId]);
    }
    const quoted = new Set(reals.map((line) => line.fact));
    expect(quoted.size).toBe(Object.keys(DESIGN_REAL_FACTS).length);
  });

  it("attaches no fact to a fiction line", () => {
    for (const line of LINE_BANK.filter((l) => l.tag === "Fiction")) {
      expect(line.fact).toBeNull();
    }
  });

  it("shows the seeded toasts from the bank", () => {
    expect(describeEvent({ type: "seeded-start", id: "shower" })).toBe(
      bankText("shower-start")
    );
    expect(describeEvent({ type: "seeded-start", id: "guest-rush" })).toBe(
      bankText("rush-start")
    );
    expect(describeEvent({ type: "seeded-end", id: "shower" })).toBeNull();
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
      facts: DESIGN_REAL_FACTS,
      capabilities: CAPABILITIES,
    });
  }

  it("never mentions a makeup story or a speech story", () => {
    expect(shippedText()).not.toMatch(/makeup|speech|caleb/i);
  });

  it("names the tux shop The Suit Wherehouse", () => {
    const receipt = computeReceipt(runToEnd(DEFAULT_SETUP).state);
    expect(receipt.suit).toContain("The Suit Wherehouse");
  });

  it("uses Kirkland only in product text", () => {
    const bare = shippedText().match(/Kirkland(?! (roses|sheet cake))/g);
    expect(bare).toBeNull();
    const dir = path.resolve(process.cwd(), "lib", "for-better-or-bulk");
    const hits = listSources(dir).flatMap(
      (file) =>
        readFileSync(file, "utf8").match(/Kirkland(?! (roses|sheet cake))/g) ??
        []
    );
    expect(hits).toEqual([]);
  });
});

describe("no randomness in the engine", () => {
  it("keeps Math.random out of lib/for-better-or-bulk", () => {
    const dir = path.resolve(process.cwd(), "lib", "for-better-or-bulk");
    const hits = listSources(dir).filter((file) =>
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
});
