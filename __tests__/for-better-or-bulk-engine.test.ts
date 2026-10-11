// @vitest-environment node
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  BIN_HOLD_SECONDS,
  BREAK_SECONDS,
  BROTHERS_EARLIEST_AT,
  BROTHERS_LATEST_AT,
  BURN_SECONDS,
  COOK_SECONDS,
  DEFAULT_SETUP,
  FLOOR_CAP,
  THROW_OUT_PROMPT,
  IDLE_FRAME,
  IDLE_INPUT,
  LEFT_LINE,
  LEAVE_SECONDS,
  PHONE_SECONDS,
  RELAXED_LEVEL_SECONDS,
  ROSE_BUNCHES,
  TICK_SECONDS,
  VENUE_MAP,
  WALKABLE_TILES,
  ReplayError,
  cartTotal,
  clockLabel,
  computeReceipt,
  createLevel,
  frontTile,
  getHint,
  getPrompt,
  onLevelClock,
  readinessLines,
  replayLevel,
  stepGame,
  tally,
  validateDecision,
  validateSetup,
  type Frame,
  type GameEvent,
  type GameState,
  type Item,
  type PlayerId,
  type PlayerInput,
  type PresenceDecision,
  type Setup,
  type Target,
} from "@/lib/for-better-or-bulk";

const ticks = (seconds: number) => Math.round(seconds / TICK_SECONDS);

function frameFor(id: PlayerId, input: Partial<PlayerInput>): Frame {
  return {
    inputs: { ...IDLE_FRAME.inputs, [id]: { ...IDLE_INPUT, ...input } },
  };
}

function run(
  state: GameState,
  frame: Frame,
  n: number
): { state: GameState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    const result = stepGame(current, frame);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

/** Stands someone in the middle of a tile facing a direction, holding something. */
function place(
  state: GameState,
  id: PlayerId,
  x: number,
  y: number,
  facing: [number, number],
  holding: Item | null = null
): GameState {
  const player = state.players[id];
  return {
    ...state,
    players: {
      ...state.players,
      [id]: {
        ...player,
        x: x + 0.5,
        y: y + 0.5,
        facingX: facing[0],
        facingY: facing[1],
        holding,
      },
    },
  };
}

function press(state: GameState, id: PlayerId) {
  return stepGame(state, frameFor(id, { interact: true }));
}

function untilBrothers(state: GameState): GameState {
  let current = state;
  while (current.phase === "playing")
    current = stepGame(current, IDLE_FRAME).state;
  return current;
}

function decide(state: GameState, decision: PresenceDecision): GameState {
  return stepGame(state, { ...IDLE_FRAME, decision }).state;
}

function finishIdle(setup: Setup, decision: PresenceDecision): GameState {
  let state = decide(untilBrothers(createLevel(setup)), decision);
  while (state.phase !== "done") state = stepGame(state, IDLE_FRAME).state;
  return state;
}

/** Marks every planned target filled, credited to one person. */
function allFilled(state: GameState, by: PlayerId): GameState {
  return {
    ...state,
    targets: state.targets.map((t) =>
      t.status === "open"
        ? {
            ...t,
            status: "filled" as const,
            filled: Array.from({ length: t.capacity }, () => ({
              kind: t.wants,
              madeBy: by,
            })),
            filledBy: Array.from({ length: t.capacity }, () => by),
          }
        : t
    ),
  };
}

/** Marks every target except the ones `keep` accepts as unplanned. */
function onlyOpen(state: GameState, keep: (t: Target) => boolean): GameState {
  return {
    ...state,
    targets: state.targets.map((t) =>
      keep(t) ? t : { ...t, status: "unplanned" as const }
    ),
  };
}

/** Marks the open targets that want `kind` as filled, as if already served. */
function filledFor(state: GameState, kind: Item["kind"]): GameState {
  return {
    ...state,
    targets: state.targets.map((t) =>
      t.status === "open" && t.wants === kind
        ? {
            ...t,
            status: "filled" as const,
            filled: Array.from({ length: t.capacity }, () => ({
              kind,
              madeBy: "abbi" as const,
            })),
            filledBy: Array.from({ length: t.capacity }, () => "abbi" as const),
          }
        : t
    ),
  };
}

/** Sets how many of one crate kind are left in stock. */
function withStock(
  state: GameState,
  kind: Item["kind"],
  count: number
): GameState {
  return { ...state, stock: { ...state.stock, [kind]: count } };
}

/** Puts an item on a station tile, bypassing the hands. */
function withStation(
  state: GameState,
  x: number,
  y: number,
  item: Item | null
): GameState {
  return {
    ...state,
    stations: state.stations.map((s) =>
      s.x === x && s.y === y ? { ...s, item } : s
    ),
  };
}

const YES_SETUP: Setup = {
  capabilities: ["faq", "admin"],
  cart: { roses: "yes", food: "enough", lanterns: true },
  relaxed: false,
  assist: false,
};

describe("setup and budget", () => {
  it("accepts the default setup and prices it", () => {
    expect(validateSetup(DEFAULT_SETUP)).toEqual({ ok: true });
    expect(cartTotal(DEFAULT_SETUP.cart)).toBe(1600 + 350 + 950 + 60);
  });

  it("refuses a cart over budget", () => {
    const check = validateSetup({
      ...DEFAULT_SETUP,
      cart: { roses: "yes", food: "lots", lanterns: true },
    });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toContain("$3460");
    expect(validateSetup(YES_SETUP).ok).toBe(true);
  });

  it("needs exactly two different website features", () => {
    expect(validateSetup({ ...DEFAULT_SETUP, capabilities: ["faq"] }).ok).toBe(
      false
    );
    expect(
      validateSetup({ ...DEFAULT_SETUP, capabilities: ["faq", "faq"] }).ok
    ).toBe(false);
    expect(
      validateSetup({
        ...DEFAULT_SETUP,
        capabilities: ["faq", "nope" as "faq"],
      }).ok
    ).toBe(false);
  });

  it("throws on an invalid setup instead of playing a different game", () => {
    expect(() => createLevel({ ...DEFAULT_SETUP, capabilities: [] })).toThrow(
      RangeError
    );
  });

  it("plans targets from the cart", () => {
    const modest = createLevel({
      ...DEFAULT_SETUP,
      cart: { roses: "modest", food: "enough", lanterns: false },
    });
    const planned = (s: GameState, category: string) =>
      s.targets.filter(
        (t) => t.category === category && t.status !== "unplanned"
      ).length;
    expect(planned(modest, "centerpieces")).toBe(0);
    expect(planned(modest, "lanterns")).toBe(0);
    expect(planned(modest, "bouquets")).toBe(1);
    const yes = createLevel(YES_SETUP);
    expect(planned(yes, "petals")).toBe(5);
    expect(planned(yes, "centerpieces")).toBe(4);
    expect(yes.stock.roses).toBe(ROSE_BUNCHES.yes);
    expect(planned(yes, "chairs")).toBe(8);
    expect(planned(yes, "buffet")).toBe(4);
  });

  it("buys exactly the roses each plan needs", () => {
    for (const roses of ["modest", "full", "yes"] as const) {
      const state = createLevel({
        ...DEFAULT_SETUP,
        cart: { roses, food: "enough", lanterns: false },
      });
      const needed = state.targets
        .filter(
          (t) =>
            t.status === "open" &&
            (t.wants === "arrangement" || t.wants === "petals")
        )
        .reduce((sum, t) => sum + t.capacity, 0);
      expect(state.stock.roses).toBe(needed);
    }
  });
});

describe("movement", () => {
  it("walks at a fixed speed", () => {
    const start = createLevel(DEFAULT_SETUP);
    const { state } = run(start, frameFor("fred", { moveX: 1 }), ticks(1));
    expect(state.players.fred.x - start.players.fred.x).toBeCloseTo(4.2, 1);
    expect(state.players.fred.facingX).toBe(1);
  });

  it("stops at the grill instead of walking through it", () => {
    const { state } = run(
      createLevel(DEFAULT_SETUP),
      frameFor("fred", { moveY: -1 }),
      ticks(2)
    );
    expect(state.players.fred.y).toBeGreaterThanOrEqual(4.3 - 1e-6);
    expect(frontTile(state.players.fred)).toEqual({ x: 5, y: 3 });
  });

  it("moves no faster on a diagonal", () => {
    const start = place(createLevel(DEFAULT_SETUP), "fred", 5, 7, [0, 1]);
    const { state } = run(start, frameFor("fred", { moveX: 1, moveY: 1 }), 10);
    const moved = Math.hypot(
      state.players.fred.x - 5.5,
      state.players.fred.y - 7.5
    );
    expect(moved).toBeCloseTo(4.2 * 10 * TICK_SECONDS, 5);
  });
});

describe("crates, stations and targets", () => {
  it("hands out roses from the shared stock", () => {
    const start = place(createLevel(DEFAULT_SETUP), "fred", 2, 3, [-1, 0]);
    const { state, events } = press(start, "fred");
    expect(state.players.fred.holding).toEqual({ kind: "roses", madeBy: null });
    expect(state.stock.roses).toBe(ROSE_BUNCHES.full - 1);
    expect(events).toContainEqual({
      type: "picked-up",
      player: "fred",
      item: "roses",
    });
  });

  it("announces an empty crate and then hands out nothing", () => {
    let state = createLevel({
      ...DEFAULT_SETUP,
      cart: { roses: "modest", food: "enough", lanterns: false },
    });
    state = place(state, "abbi", 2, 3, [-1, 0]);
    let events: GameEvent[] = [];
    for (let i = 0; i < 2; i++) {
      const picked = press(state, "abbi");
      events = [...events, ...picked.events];
      state = {
        ...picked.state,
        players: {
          ...picked.state.players,
          abbi: { ...picked.state.players.abbi, holding: null },
        },
      };
    }
    expect(events).toContainEqual({ type: "supply-empty", supply: "roses" });
    expect(press(state, "abbi").state.players.abbi.holding).toBeNull();
  });

  it("arranges roses with held work and credits whoever did it", () => {
    let state = place(createLevel(DEFAULT_SETUP), "abbi", 8, 4, [0, -1], {
      kind: "roses",
      madeBy: null,
    });
    state = press(state, "abbi").state;
    expect(state.stations.find((s) => s.x === 8 && s.y === 3)?.item?.kind).toBe(
      "roses"
    );
    const worked = run(state, frameFor("abbi", { work: true }), ticks(1.5));
    expect(worked.events).toContainEqual({
      type: "crafted",
      player: "abbi",
      item: "arrangement",
    });
    state = press(worked.state, "abbi").state;
    expect(state.players.abbi.holding).toEqual({
      kind: "arrangement",
      madeBy: "abbi",
    });
  });

  it("does nothing at the rose table without held work", () => {
    let state = place(createLevel(DEFAULT_SETUP), "abbi", 8, 4, [0, -1], {
      kind: "roses",
      madeBy: null,
    });
    state = run(press(state, "abbi").state, IDLE_FRAME, ticks(5)).state;
    expect(state.stations.find((s) => s.x === 8 && s.y === 3)?.item?.kind).toBe(
      "roses"
    );
  });

  it("fills a table with an arrangement and records who placed it", () => {
    const start = place(createLevel(DEFAULT_SETUP), "fred", 4, 8, [0, -1], {
      kind: "arrangement",
      madeBy: "abbi",
    });
    const { state, events } = press(start, "fred");
    const table = state.targets.find((t) => t.x === 4 && t.y === 7);
    expect(table?.status).toBe("filled");
    expect(table?.filledBy).toEqual(["fred"]);
    expect(events).toContainEqual({
      type: "target-filled",
      player: "fred",
      target: table?.id,
      category: "centerpieces",
    });
  });

  it("refuses the wrong item at a target", () => {
    const start = place(createLevel(DEFAULT_SETUP), "fred", 4, 8, [0, -1], {
      kind: "chairs",
      madeBy: null,
    });
    const { state } = press(start, "fred");
    expect(state.players.fred.holding?.kind).toBe("chairs");
  });

  it("takes two arrangements to fill the bouquet basket", () => {
    let state = place(createLevel(DEFAULT_SETUP), "abbi", 17, 9, [0, 1], {
      kind: "arrangement",
      madeBy: "abbi",
    });
    state = press(state, "abbi").state;
    expect(state.targets.find((t) => t.kind === "basket")?.status).toBe("open");
    state = place(state, "abbi", 17, 9, [0, 1], {
      kind: "arrangement",
      madeBy: "fred",
    });
    state = press(state, "abbi").state;
    expect(state.targets.find((t) => t.kind === "basket")?.status).toBe(
      "filled"
    );
  });

  it("simplifies an empty centerpiece on purpose", () => {
    const start = place(createLevel(DEFAULT_SETUP), "abbi", 7, 8, [0, -1]);
    const { state, events } = run(
      start,
      frameFor("abbi", { work: true }),
      ticks(1)
    );
    expect(state.targets.find((t) => t.x === 7 && t.y === 7)?.status).toBe(
      "simplified"
    );
    expect(events.some((e) => e.type === "simplified")).toBe(true);
  });

  it("will not simplify chairs", () => {
    const start = place(createLevel(DEFAULT_SETUP), "abbi", 14, 6, [0, -1]);
    const { state } = run(start, frameFor("abbi", { work: true }), ticks(2));
    expect(state.targets.find((t) => t.x === 14 && t.y === 5)?.status).toBe(
      "open"
    );
  });

  it("puts things down on the ground and picks them back up", () => {
    const start = place(createLevel(DEFAULT_SETUP), "fred", 5, 7, [0, 1], {
      kind: "chairs",
      madeBy: null,
    });
    const dropped = press(start, "fred").state;
    expect(dropped.floor).toEqual([
      { x: 5, y: 8, item: { kind: "chairs", madeBy: null } },
    ]);
    const picked = press(dropped, "fred").state;
    expect(picked.floor).toEqual([]);
    expect(picked.players.fred.holding?.kind).toBe("chairs");
  });
});

describe("the grill", () => {
  it("cooks, then burns, and the bin takes the evidence", () => {
    let state = place(createLevel(DEFAULT_SETUP), "fred", 4, 4, [0, -1], {
      kind: "hotdogs-raw",
      madeBy: null,
    });
    state = press(state, "fred").state;
    const cooked = run(state, IDLE_FRAME, ticks(6));
    expect(cooked.events.some((e) => e.type === "cooked")).toBe(true);
    const grill = cooked.state.stations.find((s) => s.x === 4 && s.y === 3);
    expect(grill?.item).toEqual({ kind: "hotdogs", madeBy: "fred" });

    const burnt = run(
      cooked.state,
      IDLE_FRAME,
      ticks(BURN_SECONDS - COOK_SECONDS + 1)
    );
    expect(burnt.events.some((e) => e.type === "burnt")).toBe(true);
    expect(burnt.state.burntBatches).toBe(1);

    state = press(burnt.state, "fred").state;
    expect(state.players.fred.holding?.kind).toBe("burnt");
    state = place(state, "fred", 6, 4, [0, -1], state.players.fred.holding);
    state = press(state, "fred").state;
    expect(state.players.fred.holding?.kind).toBe("burnt");
    state = run(
      state,
      frameFor("fred", { work: true }),
      ticks(BIN_HOLD_SECONDS)
    ).state;
    expect(state.players.fred.holding).toBeNull();
    expect(state.stations.find((s) => s.kind === "bin")?.item).toBeNull();
  });

  it("only takes raw meat", () => {
    const start = place(createLevel(DEFAULT_SETUP), "fred", 4, 4, [0, -1], {
      kind: "mac",
      madeBy: null,
    });
    expect(press(start, "fred").state.players.fred.holding?.kind).toBe("mac");
  });

  it("serves cooked hot dogs at the buffet", () => {
    const start = place(createLevel(DEFAULT_SETUP), "abbi", 7, 2, [0, -1], {
      kind: "hotdogs",
      madeBy: "fred",
    });
    const { state } = press(start, "abbi");
    expect(state.targets.find((t) => t.x === 7 && t.y === 1)?.status).toBe(
      "filled"
    );
  });
});

describe("phone calls", () => {
  it("lets the FAQ answer the garden-formal question", () => {
    const { state, events } = run(
      createLevel(DEFAULT_SETUP),
      IDLE_FRAME,
      ticks(31)
    );
    expect(state.interruptions[0]).toMatchObject({
      id: "garden-formal",
      blockedBy: "faq",
    });
    expect(state.players.fred.busyFor).toBe(0);
    expect(events).toContainEqual({
      type: "interruption",
      id: "garden-formal",
      player: "fred",
      blockedBy: "faq",
    });
  });

  it("freezes Fred on the phone without the FAQ", () => {
    const setup: Setup = {
      ...DEFAULT_SETUP,
      capabilities: ["registry", "intro3d"],
    };
    const atCall = run(createLevel(setup), IDLE_FRAME, ticks(30)).state;
    expect(atCall.players.fred.busyFor).toBeGreaterThan(PHONE_SECONDS - 0.1);
    const walking = run(atCall, frameFor("fred", { moveX: 1 }), ticks(1)).state;
    expect(walking.players.fred.x).toBe(atCall.players.fred.x);
  });
});

describe("the brothers' text", () => {
  it("pauses the clock until Fred answers", () => {
    const paused = untilBrothers(createLevel(DEFAULT_SETUP));
    expect(paused.phase).toBe("brothers");
    expect(paused.time).toBeCloseTo(BROTHERS_LATEST_AT, 5);
    const still = run(paused, frameFor("abbi", { moveX: 1 }), 30).state;
    expect(still.time).toBe(paused.time);
    expect(still.players.abbi.x).toBe(paused.players.abbi.x);
  });

  it("checks decisions", () => {
    const paused = untilBrothers(createLevel(DEFAULT_SETUP));
    expect(
      validateDecision(paused, { choice: "break", commitment: null }).ok
    ).toBe(false);
    expect(
      validateDecision(paused, { choice: "stay", commitment: "chairs" }).ok
    ).toBe(false);
    expect(
      validateDecision(paused, { choice: "break", commitment: "chairs" }).ok
    ).toBe(true);
    expect(
      validateDecision(createLevel(DEFAULT_SETUP), {
        choice: "stay",
        commitment: null,
      }).ok
    ).toBe(false);
    expect(decide(paused, { choice: "break", commitment: null }).phase).toBe(
      "brothers"
    );
  });

  it("sends Fred out on a break and brings him back calm", () => {
    const away = decide(untilBrothers(createLevel(DEFAULT_SETUP)), {
      choice: "break",
      commitment: "chairs",
    });
    expect(away.players.fred.presence).toBe("away");
    expect(away.returnsAt).toBeCloseTo(BROTHERS_LATEST_AT + BREAK_SECONDS, 5);
    const back = run(away, IDLE_FRAME, ticks(BREAK_SECONDS) + 1);
    expect(back.events).toContainEqual({ type: "fred-returned" });
    expect(back.state.players.fred).toMatchObject({
      presence: "here",
      calm: true,
    });
  });

  it("keeps Fred out much longer if he leaves", () => {
    const away = decide(untilBrothers(createLevel(DEFAULT_SETUP)), {
      choice: "leave",
      commitment: null,
    });
    expect(away.returnsAt).toBeCloseTo(BROTHERS_LATEST_AT + LEAVE_SECONDS, 5);
    const later = run(away, frameFor("fred", { moveX: 1 }), ticks(30)).state;
    expect(later.players.fred.presence).toBe("away");
    expect(later.players.fred.x).toBe(away.players.fred.x);
  });

  it("returns a leaving Fred between 160 and 180 seconds, with time to help", () => {
    const early = decide(
      untilBrothers({ ...createLevel(DEFAULT_SETUP), firstFilledAt: 0 }),
      { choice: "leave", commitment: null }
    );
    const late = decide(untilBrothers(createLevel(DEFAULT_SETUP)), {
      choice: "leave",
      commitment: null,
    });
    expect(early.brothersAt).toBeCloseTo(BROTHERS_EARLIEST_AT, 5);
    expect(early.returnsAt).toBeCloseTo(160, 5);
    expect(late.returnsAt).toBeCloseTo(180, 5);
    expect(late.returnsAt).toBeLessThan(late.duration);
  });

  it("scales the brothers' window and Fred's time away on the relaxed clock", () => {
    const relaxed: Setup = { ...DEFAULT_SETUP, relaxed: true };
    const paused = untilBrothers(createLevel(relaxed));
    const window = onLevelClock(BROTHERS_LATEST_AT, RELAXED_LEVEL_SECONDS);
    expect(paused.duration).toBe(RELAXED_LEVEL_SECONDS);
    expect(paused.brothersAt).toBeCloseTo(181.5, 5);
    expect(window).toBeCloseTo(181.5, 5);
    const left = decide(paused, { choice: "leave", commitment: null });
    expect(left.returnsAt).toBeCloseTo(181.5 + 115.5, 5);
    expect(left.returnsAt).toBeLessThan(RELAXED_LEVEL_SECONDS);
    const broke = decide(paused, { choice: "break", commitment: "chairs" });
    expect(broke.returnsAt).toBeCloseTo(181.5 + 66, 5);
  });

  it("has a nervous Fred who stays re-tie his shoes", () => {
    const staying = decide(untilBrothers(createLevel(DEFAULT_SETUP)), {
      choice: "stay",
      commitment: null,
    });
    const { events } = run(staying, IDLE_FRAME, ticks(21));
    expect(events).toContainEqual({ type: "shoes-retied" });
  });
});

describe("ending and receipt", () => {
  it("finishes early when every planned target is done", () => {
    const level = createLevel(DEFAULT_SETUP);
    const lastTable = level.targets.find((t) => t.x === 4 && t.y === 7);
    const nearlyDone = allFilled(
      {
        ...level,
        targets: level.targets.map((t) =>
          t === lastTable ? { ...t, status: "unplanned" as const } : t
        ),
      },
      "abbi"
    );
    const ready = place(
      {
        ...nearlyDone,
        targets: nearlyDone.targets.map((t) =>
          t.id === lastTable?.id ? { ...t, status: "open" as const } : t
        ),
      },
      "fred",
      4,
      8,
      [0, -1],
      { kind: "arrangement", madeBy: "fred" }
    );
    const { state, events } = press(ready, "fred");
    expect(state.phase).toBe("done");
    expect(state.finishedAt).toBeCloseTo(TICK_SECONDS, 5);
    expect(events).toContainEqual({ type: "level-finished", early: true });
    expect(computeReceipt(state).finishedAt).toBe(
      "Everything was ready at 9:00."
    );
  });

  it("ends at 4:00 with unfinished work as Married Anyway", () => {
    const state = finishIdle(DEFAULT_SETUP, {
      choice: "stay",
      commitment: null,
    });
    expect(state.time).toBeGreaterThanOrEqual(state.duration - 1e-6);
    const receipt = computeReceipt(state);
    expect(receipt.title).toBe("Married Anyway");
    expect(receipt.followThrough.status).toBe("kept");
    expect(receipt.readiness.find((l) => l.category === "chairs")?.status).toBe(
      "unfinished"
    );
    expect(
      receipt.readiness.find((l) => l.category === "chairs")?.explanation
    ).toContain("Unfinished at 4:00");
  });

  it("titles a 3D-intro run Is It Loading?", () => {
    const state = finishIdle(
      { ...DEFAULT_SETUP, capabilities: ["faq", "intro3d"] },
      { choice: "stay", commitment: null }
    );
    expect(computeReceipt(state).title).toBe("Is It Loading?");
  });

  it("always counts leaving as a missed promise, even when the work got done", () => {
    const left = decide(untilBrothers(createLevel(DEFAULT_SETUP)), {
      choice: "leave",
      commitment: null,
    });
    const receipt = computeReceipt(allFilled(left, "abbi"));
    expect(receipt.followThrough).toEqual({
      status: "missed",
      explanation: `Missed: ${LEFT_LINE}`,
    });
    expect(receipt.title).toBe("Operational, Not Present");
  });

  it("keeps a break's promise only if that work is done", () => {
    const onBreak = decide(untilBrothers(createLevel(DEFAULT_SETUP)), {
      choice: "break",
      commitment: "chairs",
    });
    expect(computeReceipt(onBreak).followThrough.status).toBe("missed");
    const done = allFilled(onBreak, "fred");
    expect(computeReceipt(done).followThrough.status).toBe("kept");
    expect(computeReceipt(done).title).toBe("Operationally Married");
  });

  it("titles a finished all-roses run Bulk Romantic", () => {
    const stayed = decide(untilBrothers(createLevel(YES_SETUP)), {
      choice: "stay",
      commitment: null,
    });
    const receipt = computeReceipt(allFilled(stayed, "abbi"));
    expect(receipt.title).toBe("Bulk Romantic");
    expect(receipt.signatureMoment).toBe("Rose petals down the aisle");
  });

  it("titles a finished admin-and-registry run 171 Commits", () => {
    const setup: Setup = {
      ...DEFAULT_SETUP,
      capabilities: ["admin", "registry"],
    };
    const stayed = decide(untilBrothers(createLevel(setup)), {
      choice: "stay",
      commitment: null,
    });
    expect(computeReceipt(allFilled(stayed, "fred")).title).toBe(
      "171 Commits and a Ceremony"
    );
  });

  it("titles a modest finished run The Gardens Did the Decorating", () => {
    const setup: Setup = {
      ...DEFAULT_SETUP,
      cart: { roses: "modest", food: "enough", lanterns: false },
    };
    const stayed = decide(untilBrothers(createLevel(setup)), {
      choice: "stay",
      commitment: null,
    });
    const receipt = computeReceipt(allFilled(stayed, "abbi"));
    expect(receipt.title).toBe("The Gardens Did the Decorating");
    expect(
      receipt.readiness.find((l) => l.category === "centerpieces")?.status
    ).toBe("unplanned");
  });

  it("shows simplified work as simplified, not unfinished", () => {
    const level = createLevel(DEFAULT_SETUP);
    const table = level.targets.find((t) => t.x === 7 && t.y === 7);
    const state = allFilled(
      {
        ...level,
        targets: level.targets.map((t) =>
          t === table ? { ...t, status: "simplified" as const } : t
        ),
      },
      "abbi"
    );
    const line = readinessLines(state).find(
      (l) => l.category === "centerpieces"
    );
    expect(line?.status).toBe("simplified");
    expect(line?.explanation).toContain("1 simplified by choice");
  });

  it("explains who made and placed things", () => {
    const line = readinessLines(
      allFilled(createLevel(DEFAULT_SETUP), "abbi")
    ).find((l) => l.category === "centerpieces");
    expect(line?.conditions.map((c) => c.detail)).toContain("Abbi 4");
    expect(tally(["abbi", "fred", "abbi"])).toBe("Abbi 2, Fred 1");
    expect(tally([])).toBe("nobody");
  });

  it("prices the receipt the same as the cart and keeps the fixed lines", () => {
    const receipt = computeReceipt(createLevel(YES_SETUP));
    expect(receipt.spending.total).toBe(cartTotal(YES_SETUP.cart));
    expect(receipt.spending.lines.map((l) => l.id)).toEqual([
      "venue",
      "tux",
      "dress",
      "roses",
      "food",
      "lanterns",
    ]);
    expect(receipt.suit).toContain("The Suit Wherehouse");
    expect(receipt.website.find((w) => w.capability === "faq")?.text).toBe(
      "FAQ: blocked 0 calls."
    );
  });

  it("reports burnt batches in the kitchen line", () => {
    expect(
      computeReceipt({ ...createLevel(DEFAULT_SETUP), burntBatches: 2 }).kitchen
    ).toContain("2 batches");
  });
});

describe("views", () => {
  it("labels the clock from 9:00 to 4:00", () => {
    expect(clockLabel(0, 240)).toBe("9:00");
    expect(clockLabel(120, 240)).toBe("12:30");
    expect(clockLabel(240, 240)).toBe("4:00");
    expect(clockLabel(999, 240)).toBe("4:00");
  });

  it("prompts for what the buttons would do", () => {
    const atRoses = place(createLevel(DEFAULT_SETUP), "fred", 2, 3, [-1, 0]);
    expect(getPrompt(atRoses, "fred").interact).toBe(
      "Take a bunch of Kirkland roses"
    );
    const atTable = place(createLevel(DEFAULT_SETUP), "abbi", 7, 8, [0, -1]);
    expect(getPrompt(atTable, "abbi").work).toBe(
      "Simplify: leave this one bare"
    );
    const away = decide(untilBrothers(createLevel(DEFAULT_SETUP)), {
      choice: "leave",
      commitment: null,
    });
    expect(getPrompt(away, "fred")).toMatchObject({
      interact: null,
      work: null,
    });
  });
});

describe("replay", () => {
  const inputArb = fc.record({
    moveX: fc.constantFrom(-1, 0, 1),
    moveY: fc.constantFrom(-1, 0, 1),
    interact: fc.boolean(),
    work: fc.boolean(),
  });
  const decisionArb = fc.constantFrom<PresenceDecision>(
    { choice: "stay", commitment: null },
    { choice: "break", commitment: "flowers" },
    { choice: "leave", commitment: null }
  );
  const frameArb: fc.Arbitrary<Frame> = fc
    .tuple(inputArb, inputArb, fc.integer({ min: 1, max: 40 }))
    .map(([fred, abbi]) => ({ inputs: { fred, abbi } }));

  /** Random input held for random stretches, with a decision when the text lands. */
  function expand(
    chunks: readonly [Frame, number][],
    decision: PresenceDecision
  ): Frame[] {
    const frames: Frame[] = [];
    let state = createLevel(DEFAULT_SETUP);
    for (const [frame, length] of chunks) {
      for (let i = 0; i < length; i++) {
        const next =
          state.phase === "brothers" ? { ...frame, decision } : frame;
        frames.push(next);
        state = stepGame(state, next).state;
      }
    }
    return frames;
  }

  it("rebuilds the same level from the same frames, with nobody in a wall", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(frameArb, fc.integer({ min: 1, max: 60 })), {
          minLength: 1,
          maxLength: 60,
        }),
        decisionArb,
        (chunks, decision) => {
          const frames = expand(chunks, decision);
          const first = replayLevel(DEFAULT_SETUP, frames).state;
          const second = replayLevel(DEFAULT_SETUP, frames).state;
          expect(second).toEqual(first);
          for (const player of Object.values(first.players)) {
            expect(WALKABLE_TILES).toContain(
              VENUE_MAP[Math.floor(player.y)][Math.floor(player.x)]
            );
          }
          for (const left of Object.values(first.stock))
            expect(left).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 40 }
    );
  });

  it("throws in strict mode on a decision that does not fit, and drops it in lenient mode", () => {
    const frames: Frame[] = [
      { ...IDLE_FRAME, decision: { choice: "stay", commitment: null } },
    ];
    expect(() => replayLevel(DEFAULT_SETUP, frames)).toThrow(ReplayError);
    const lenient = replayLevel(DEFAULT_SETUP, frames, { mode: "lenient" });
    expect(lenient.dropped).toEqual([
      { frame: 0, reason: "Nobody is texting Fred right now." },
    ]);
    expect(lenient.state.tick).toBe(1);
  });
});

describe("the bin, returns and the floor", () => {
  const burntAtBin = (id: PlayerId = "fred") =>
    place(createLevel(DEFAULT_SETUP), id, 6, 4, [0, -1], {
      kind: "burnt",
      madeBy: null,
    });

  it("ignores a single press at the bin", () => {
    const { state, events } = press(burntAtBin(), "fred");
    expect(state.players.fred.holding?.kind).toBe("burnt");
    expect(events.some((e) => e.type === "thrown-out")).toBe(false);
  });

  it("throws the item out only after a half-second hold", () => {
    const held = run(
      burntAtBin(),
      frameFor("fred", { work: true }),
      ticks(BIN_HOLD_SECONDS - 0.1)
    );
    expect(held.state.players.fred.holding?.kind).toBe("burnt");
    const thrown = run(
      held.state,
      frameFor("fred", { work: true }),
      ticks(0.2)
    );
    expect(thrown.state.players.fred.holding).toBeNull();
    expect(thrown.events).toContainEqual({
      type: "thrown-out",
      player: "fred",
      item: "burnt",
    });
  });

  it("starts a bin hold over when the work key is let go", () => {
    const first = run(
      burntAtBin(),
      frameFor("fred", { work: true }),
      ticks(BIN_HOLD_SECONDS - 0.1)
    );
    const released = run(first.state, IDLE_FRAME, 1).state;
    const second = run(
      released,
      frameFor("fred", { work: true }),
      ticks(BIN_HOLD_SECONDS - 0.1)
    ).state;
    expect(second.players.fred.holding?.kind).toBe("burnt");
  });

  it("breaks a bin hold when a phone call lands, so the item is not thrown out after it", () => {
    // Registry and 3D intro leave the 30 second call unblocked, so Fred is busy.
    const setup: Setup = {
      ...DEFAULT_SETUP,
      capabilities: ["registry", "intro3d"],
    };
    const start = place(createLevel(setup), "fred", 6, 4, [0, -1], {
      kind: "burnt",
      madeBy: null,
    });
    const beforeCall = run(start, IDLE_FRAME, ticks(29.6)).state;
    // A hold of about a third of a second, ending just before the call.
    const partial = run(
      beforeCall,
      frameFor("fred", { work: true }),
      ticks(0.35)
    ).state;
    expect(partial.players.fred.binHold).toBeGreaterThan(0.3);
    const call = run(
      partial,
      frameFor("fred", { work: true }),
      ticks(PHONE_SECONDS + 0.2)
    );
    expect(call.events).toContainEqual({
      type: "interruption",
      id: "garden-formal",
      player: "fred",
      blockedBy: null,
    });
    expect(call.events.some((e) => e.type === "thrown-out")).toBe(false);
    expect(call.state.players.fred.holding?.kind).toBe("burnt");
    expect(call.state.players.fred.binHold).toBeLessThan(BIN_HOLD_SECONDS);
  });

  it("starts a bin hold over when Fred leaves on a break", () => {
    const paused = untilBrothers(createLevel(DEFAULT_SETUP));
    const holding: GameState = {
      ...paused,
      players: {
        ...paused.players,
        fred: { ...paused.players.fred, binHold: 0.4 },
      },
    };
    const away = decide(holding, { choice: "break", commitment: "chairs" });
    expect(away.players.fred.presence).toBe("away");
    expect(away.players.fred.binHold).toBe(0);
  });

  it("returns an item to the crate it came from", () => {
    const start = place(createLevel(DEFAULT_SETUP), "fred", 2, 3, [-1, 0]);
    const taken = press(start, "fred").state;
    expect(taken.stock.roses).toBe(ROSE_BUNCHES.full - 1);
    const back = press(taken, "fred");
    expect(back.state.players.fred.holding).toBeNull();
    expect(back.state.stock.roses).toBe(ROSE_BUNCHES.full);
  });

  it("refuses to put an item back in a crate for another kind", () => {
    const start = place(createLevel(DEFAULT_SETUP), "fred", 2, 3, [-1, 0], {
      kind: "chairs",
      madeBy: null,
    });
    const { state } = press(start, "fred");
    expect(state.players.fred.holding?.kind).toBe("chairs");
    expect(state.stock.roses).toBe(ROSE_BUNCHES.full);
  });

  it("refuses a fourth item on the floor, with a reason", () => {
    const level = createLevel(DEFAULT_SETUP);
    const full: GameState = {
      ...place(level, "fred", 5, 7, [0, 1], {
        kind: "chairs",
        madeBy: null,
      }),
      floor: [
        { x: 10, y: 8, item: { kind: "mac", madeBy: null } },
        { x: 11, y: 8, item: { kind: "mac", madeBy: null } },
        { x: 12, y: 8, item: { kind: "mac", madeBy: null } },
      ],
    };
    expect(full.floor.length).toBe(FLOOR_CAP);
    const { state, events } = press(full, "fred");
    expect(state.players.fred.holding?.kind).toBe("chairs");
    expect(state.floor.length).toBe(FLOOR_CAP);
    expect(events).toContainEqual({ type: "floor-full", player: "fred" });
  });

  it("drops what Fred carries on his tile when he leaves, past the floor cap", () => {
    const full = Array.from({ length: FLOOR_CAP }, (_, i) => ({
      x: 10 + i,
      y: 8,
      item: { kind: "mac" as const, madeBy: null },
    }));
    const carrying = place(
      { ...createLevel(DEFAULT_SETUP), floor: full },
      "fred",
      5,
      7,
      [0, 1],
      { kind: "chairs", madeBy: null }
    );
    const away = decide(untilBrothers(carrying), {
      choice: "leave",
      commitment: null,
    });
    expect(away.players.fred.holding).toBeNull();
    expect(away.floor).toHaveLength(FLOOR_CAP + 1);
    expect(away.floor).toContainEqual({
      x: 5,
      y: 7,
      item: { kind: "chairs", madeBy: null },
    });
  });

  it("drops Fred's carried item on the nearest free tile when his own is taken", () => {
    const blocked = place(
      {
        ...createLevel(DEFAULT_SETUP),
        floor: [{ x: 5, y: 7, item: { kind: "mac", madeBy: null } }],
      },
      "fred",
      5,
      7,
      [0, 1],
      { kind: "chairs", madeBy: null }
    );
    const away = decide(untilBrothers(blocked), {
      choice: "break",
      commitment: "chairs",
    });
    expect(away.floor).toContainEqual({
      x: 4,
      y: 6,
      item: { kind: "chairs", madeBy: null },
    });
  });

  it("keeps a carried item when Fred stays", () => {
    const carrying = place(createLevel(DEFAULT_SETUP), "fred", 5, 7, [0, 1], {
      kind: "chairs",
      madeBy: null,
    });
    const staying = decide(untilBrothers(carrying), {
      choice: "stay",
      commitment: null,
    });
    expect(staying.players.fred.holding?.kind).toBe("chairs");
    expect(staying.floor).toEqual([]);
  });
});

describe("the brothers' timing", () => {
  it("lands at 90 seconds when a target fills early", () => {
    let state = place(createLevel(DEFAULT_SETUP), "abbi", 4, 8, [0, -1], {
      kind: "arrangement",
      madeBy: "abbi",
    });
    state = press(state, "abbi").state;
    expect(state.firstFilledAt).toBeCloseTo(TICK_SECONDS, 5);
    const paused = untilBrothers(state);
    expect(paused.brothersAt).toBeCloseTo(BROTHERS_EARLIEST_AT, 5);
  });

  it("waits for a late first fill, up to the cap", () => {
    const late = { ...createLevel(DEFAULT_SETUP), firstFilledAt: 100 };
    expect(untilBrothers(late).brothersAt).toBeCloseTo(100, 5);
  });

  it("never waits past 110 seconds", () => {
    const later = { ...createLevel(DEFAULT_SETUP), firstFilledAt: 150 };
    expect(untilBrothers(later).brothersAt).toBeCloseTo(BROTHERS_LATEST_AT, 5);
    expect(untilBrothers(createLevel(DEFAULT_SETUP)).brothersAt).toBeCloseTo(
      BROTHERS_LATEST_AT,
      5
    );
  });
});

describe("the coach hints", () => {
  const cases: readonly {
    name: string;
    state: () => GameState;
    id: PlayerId;
    hint: string | null;
  }[] = [
    {
      name: "free hands, roses wanted: grab roses from the crate",
      state: () => createLevel(DEFAULT_SETUP),
      id: "fred",
      hint: "Grab roses from the ROSE crate on the left.",
    },
    {
      name: "holding roses: carry them to the ARRANGE table",
      state: () =>
        place(createLevel(DEFAULT_SETUP), "abbi", 2, 2, [0, 1], {
          kind: "roses",
          madeBy: null,
        }),
      id: "abbi",
      hint: "Carry the roses to the ARRANGE table (A).",
    },
    {
      name: "roses on the table: hold work to arrange them",
      state: () =>
        withStation(createLevel(DEFAULT_SETUP), 8, 3, {
          kind: "roses",
          madeBy: null,
        }),
      id: "fred",
      hint: "Stand at the ARRANGE table (A) and hold work to arrange the roses.",
    },
    {
      name: "arrangement ready: take it from the table",
      state: () =>
        withStation(createLevel(DEFAULT_SETUP), 8, 3, {
          kind: "arrangement",
          madeBy: "abbi",
        }),
      id: "fred",
      hint: "Take the arrangement from the ARRANGE table (A).",
    },
    {
      name: "holding an arrangement: carry it to a centerpiece",
      state: () =>
        place(createLevel(DEFAULT_SETUP), "fred", 2, 2, [0, 1], {
          kind: "arrangement",
          madeBy: "fred",
        }),
      id: "fred",
      hint: "Carry the arrangement to a centerpiece table (T).",
    },
    {
      name: "roses with the table busy, petals planned: carry to the PETALS bucket",
      state: () =>
        place(
          withStation(
            withStation(createLevel(YES_SETUP), 8, 3, {
              kind: "roses",
              madeBy: null,
            }),
            9,
            3,
            { kind: "roses", madeBy: null }
          ),
          "abbi",
          2,
          2,
          [0, 1],
          { kind: "roses", madeBy: null }
        ),
      id: "abbi",
      hint: "Carry the roses to the PETALS bucket (P).",
    },
    {
      name: "roses, arrangements filled, aisle open: carry the roses to the PETALS bucket",
      state: () =>
        place(
          filledFor(createLevel(YES_SETUP), "arrangement"),
          "abbi",
          2,
          2,
          [0, 1],
          { kind: "roses", madeBy: null }
        ),
      id: "abbi",
      hint: "Carry the roses to the PETALS bucket (P).",
    },
    {
      name: "roses, every arrangement filled, aisle unplanned: no roses to carry",
      state: () =>
        place(
          filledFor(createLevel(DEFAULT_SETUP), "arrangement"),
          "abbi",
          2,
          2,
          [0, 1],
          { kind: "roses", madeBy: null }
        ),
      id: "abbi",
      hint: null,
    },
    {
      name: "aisle open and roses in stock: grab roses for the PETALS bucket",
      state: () => onlyOpen(createLevel(YES_SETUP), (t) => t.kind === "aisle"),
      id: "fred",
      hint: "Grab roses from the ROSE crate on the left.",
    },
    {
      name: "nothing open, roses on the ARRANGE table: no hint to arrange",
      state: () =>
        withStation(
          onlyOpen(createLevel(DEFAULT_SETUP), () => false),
          8,
          3,
          { kind: "roses", madeBy: null }
        ),
      id: "fred",
      hint: null,
    },
    {
      name: "roses on the PETALS bucket with the aisle unplanned: grab roses instead of plucking",
      state: () =>
        withStation(createLevel(DEFAULT_SETUP), 12, 3, {
          kind: "roses",
          madeBy: null,
        }),
      id: "fred",
      hint: "Grab roses from the ROSE crate on the left.",
    },
    {
      name: "no roses left in stock: no grab hint",
      state: () =>
        withStock(
          onlyOpen(
            createLevel(DEFAULT_SETUP),
            (t) => t.wants === "arrangement"
          ),
          "roses",
          0
        ),
      id: "fred",
      hint: null,
    },
    {
      name: "no raw hot dogs left: no grab hint",
      state: () =>
        withStock(
          onlyOpen(createLevel(DEFAULT_SETUP), (t) => t.wants === "hotdogs"),
          "hotdogs-raw",
          0
        ),
      id: "fred",
      hint: null,
    },
    {
      name: "no lanterns left: no grab hint",
      state: () =>
        withStock(
          onlyOpen(createLevel(DEFAULT_SETUP), (t) => t.kind === "hook"),
          "lantern",
          0
        ),
      id: "fred",
      hint: null,
    },
    {
      name: "holding petals: carry them to an aisle spot",
      state: () =>
        place(createLevel(YES_SETUP), "fred", 2, 2, [0, 1], {
          kind: "petals",
          madeBy: "fred",
        }),
      id: "fred",
      hint: "Carry the bucket of petals to an aisle spot (S).",
    },
    {
      name: "raw hot dogs and a free grill: carry them to the grill",
      state: () =>
        place(createLevel(DEFAULT_SETUP), "fred", 2, 2, [0, 1], {
          kind: "hotdogs-raw",
          madeBy: null,
        }),
      id: "fred",
      hint: "Carry the raw hot dogs to the GRILL (G).",
    },
    {
      name: "hot dogs cooked on the grill: take them off",
      state: () =>
        withStation(createLevel(DEFAULT_SETUP), 4, 3, {
          kind: "hotdogs",
          madeBy: "fred",
        }),
      id: "abbi",
      hint: "Take the hot dogs off the GRILL (G).",
    },
    {
      name: "holding cooked hot dogs: carry them to the buffet",
      state: () =>
        place(createLevel(DEFAULT_SETUP), "abbi", 2, 2, [0, 1], {
          kind: "hotdogs",
          madeBy: "fred",
        }),
      id: "abbi",
      hint: "Carry the hot dogs to the buffet (B).",
    },
    {
      name: "holding mac and cheese: carry it to the buffet",
      state: () =>
        place(createLevel(DEFAULT_SETUP), "fred", 2, 2, [0, 1], {
          kind: "mac",
          madeBy: null,
        }),
      id: "fred",
      hint: "Carry the mac and cheese to the buffet (B).",
    },
    {
      name: "only the mac slot left: grab mac and cheese",
      state: () =>
        onlyOpen(createLevel(DEFAULT_SETUP), (t) => t.wants === "mac"),
      id: "fred",
      hint: "Grab mac and cheese from the MAC crate on the top row.",
    },
    {
      name: "only the lantern hook left: grab a lantern",
      state: () =>
        onlyOpen(createLevel(DEFAULT_SETUP), (t) => t.kind === "hook"),
      id: "fred",
      hint: "Grab a lantern from the LAMP crate on the left.",
    },
    {
      name: "holding a lantern: carry it to a hook",
      state: () =>
        place(createLevel(DEFAULT_SETUP), "fred", 2, 2, [0, 1], {
          kind: "lantern",
          madeBy: null,
        }),
      id: "fred",
      hint: "Carry the lantern to a lantern hook (N).",
    },
    {
      name: "only the chair spots left: grab a stack of chairs",
      state: () =>
        onlyOpen(createLevel(DEFAULT_SETUP), (t) => t.kind === "chair-spot"),
      id: "fred",
      hint: "Grab a stack of chairs from the CHAIR crate on the left.",
    },
    {
      name: "holding a stack of chairs: carry it to a chair spot",
      state: () =>
        place(createLevel(DEFAULT_SETUP), "abbi", 2, 2, [0, 1], {
          kind: "chairs",
          madeBy: null,
        }),
      id: "abbi",
      hint: "Carry the stack of chairs to a chair spot (O).",
    },
    {
      name: "holding something burnt: take it to the bin",
      state: () =>
        place(createLevel(DEFAULT_SETUP), "fred", 2, 2, [0, 1], {
          kind: "burnt",
          madeBy: null,
        }),
      id: "fred",
      hint: "Carry the burnt food to the BIN (X) and hold work there to throw it out.",
    },
    {
      name: "nothing useful left: no hint",
      state: () => onlyOpen(createLevel(DEFAULT_SETUP), () => false),
      id: "fred",
      hint: null,
    },
    {
      name: "the level is over: no hint",
      state: () => ({ ...createLevel(DEFAULT_SETUP), phase: "done" as const }),
      id: "fred",
      hint: null,
    },
    {
      name: "away with his brothers: no hint",
      state: () =>
        decide(untilBrothers(createLevel(DEFAULT_SETUP)), {
          choice: "leave",
          commitment: null,
        }),
      id: "fred",
      hint: null,
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      expect(getHint(testCase.state(), testCase.id)).toBe(testCase.hint);
    });
  }
});

describe("the new prompts", () => {
  it("prompts a hold, not a press, at the bin", () => {
    const at = place(createLevel(DEFAULT_SETUP), "fred", 6, 4, [0, -1], {
      kind: "burnt",
      madeBy: null,
    });
    expect(getPrompt(at, "fred")).toMatchObject({
      interact: null,
      work: THROW_OUT_PROMPT,
    });
  });

  it("offers to put an item back in its crate", () => {
    const at = place(createLevel(DEFAULT_SETUP), "fred", 2, 3, [-1, 0], {
      kind: "roses",
      madeBy: null,
    });
    expect(getPrompt(at, "fred").interact).toBe("Put it back in the crate");
  });

  it("stops offering to put things down once the floor is full", () => {
    const full = {
      ...place(createLevel(DEFAULT_SETUP), "fred", 5, 7, [0, 1], {
        kind: "chairs",
        madeBy: null,
      }),
      floor: Array.from({ length: FLOOR_CAP }, (_, i) => ({
        x: 10 + i,
        y: 8,
        item: { kind: "mac" as const, madeBy: null },
      })),
    };
    expect(getPrompt(full, "fred").interact).toBeNull();
  });
});
