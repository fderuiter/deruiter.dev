// @vitest-environment node
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  BIN_HOLD_SECONDS,
  BREAK_SECONDS,
  CHAIRS_PER_CARRY,
  CHAIR_COUNT,
  BROTHERS_EARLIEST_AT,
  BROTHERS_LATEST_AT,
  BURN_SECONDS,
  COOK_SECONDS,
  DEFAULT_SETUP,
  FLOOR_CAP,
  FLOOR_HOLD_TICKS,
  THROW_OUT_PROMPT,
  interactKeyName,
  workKeyName,
  IDLE_FRAME,
  IDLE_INPUT,
  LEFT_LINE,
  LEAVE_SECONDS,
  LINE_BANK,
  PHONE_SECONDS,
  RELAXED_LEVEL_SECONDS,
  PLAYER_RADIUS,
  ROSE_BUNCHES,
  TICK_SECONDS,
  VENUE_MAP,
  WALKABLE_TILES,
  ReplayError,
  bankText,
  cartTotal,
  categoryProgress,
  clockLabel,
  computeReceipt,
  createLevel,
  dollars,
  floorDropTile,
  frontTile,
  getCoachStep,
  getHint,
  getPrompt,
  interactTile,
  nextSpotTile,
  onLevelClock,
  readinessLines,
  replayLevel,
  shownPrompts,
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

/**
 * Holds E down for a floor drop: the press tick, then the rest of the hold
 * (ADR 0060 amendment). Returns the state after the full hold.
 */
function holdFloor(state: GameState, id: PlayerId): GameState {
  let current = stepGame(
    state,
    frameFor(id, { interact: true, interactHeld: true })
  ).state;
  for (let i = 1; i < FLOOR_HOLD_TICKS; i++) {
    current = stepGame(current, frameFor(id, { interactHeld: true })).state;
  }
  return current;
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
    if (!check.ok) expect(check.reason).toContain("$3,460");
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

  /** Puts Abbi at an exact position, not the middle of a tile. */
  function standAt(state: GameState, x: number, y: number): GameState {
    return {
      ...state,
      players: {
        ...state.players,
        abbi: { ...state.players.abbi, x, y },
      },
    };
  }

  it("slides a body off a table corner into a one-tile lane (corner assist)", () => {
    // Abbi grazes the corner of the table at (5, 8) while the lane runs west.
    const start = standAt(createLevel(DEFAULT_SETUP), 5.28, 8.07);
    const { state } = run(start, frameFor("abbi", { moveX: -1 }), ticks(0.5));
    expect(state.players.abbi.x).toBeLessThan(4.5);
    expect(state.players.abbi.y).toBeGreaterThan(8.07);
  });

  it("slides the mirrored corner the other way as well", () => {
    const start = standAt(createLevel(DEFAULT_SETUP), 6.72, 8.07);
    const { state } = run(start, frameFor("abbi", { moveX: 1 }), ticks(0.5));
    expect(state.players.abbi.x).toBeGreaterThan(7.5);
  });

  it("slides across a corner when pressing down a lane", () => {
    const start = standAt(createLevel(DEFAULT_SETUP), 5.28, 8.5);
    const { state } = run(start, frameFor("abbi", { moveY: 1 }), ticks(1));
    expect(state.players.abbi.y).toBeGreaterThan(10);
  });

  it("does not slide a body pressed into a solid wall with no lane", () => {
    // Row 2 is open, but the tile ahead on the west side is the venue wall.
    const start = standAt(createLevel(DEFAULT_SETUP), 1.5, 2.5);
    const { state } = run(start, frameFor("abbi", { moveX: -1 }), ticks(1));
    expect(state.players.abbi.y).toBe(2.5);
    expect(state.players.abbi.x).toBeGreaterThan(1.2);
    expect(state.players.abbi.x).toBeLessThan(1.4);
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
    const dropped = holdFloor(start, "fred");
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
    expect(events).toContainEqual({
      type: "level-finished",
      allSet: true,
      early: true,
    });
    expect(computeReceipt(state).finishedAt).toBe(
      "Everything was ready at 9:00."
    );
  });

  it("says early only when the finish meets the 3:00 challenge (round 15)", () => {
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
    const readyAt = (time: number) =>
      place(
        {
          ...nearlyDone,
          time,
          // The brothers have already called, so the press finishes the level.
          brothersAt: 1,
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
    const threeOClock = (level.duration * 6) / 7;
    const late = press(readyAt(threeOClock + 10), "fred");
    expect(late.state.phase).toBe("done");
    expect(late.events).toContainEqual({
      type: "level-finished",
      allSet: true,
      early: false,
    });
    const challenge = computeReceipt(late.state).challenges.find(
      (c) => c.id === "set-by-three"
    );
    expect(challenge?.met).toBe(false);
    const onTime = press(readyAt(threeOClock - 10), "fred");
    expect(onTime.events).toContainEqual({
      type: "level-finished",
      allSet: true,
      early: true,
    });
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
    ).toMatch(/^Only \d+ of \d+ done at 4:00\.$/);
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
      explanation: `Missed. ${LEFT_LINE}`,
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
    expect(line?.conditions.map((c) => c.detail)).toContain(
      "Abbi carried 4 items"
    );
    expect(tally(["abbi", "fred", "abbi"])).toBe("Abbi: 2, Fred: 1");
    expect(tally([])).toBe("nobody");
  });

  it("counts the items a person carried, apart from the targets they filled (#1931)", () => {
    const line = readinessLines(
      allFilled(createLevel(DEFAULT_SETUP), "fred")
    ).find((l) => l.category === "bouquets");
    const placed = line?.conditions.find((c) => c.label.startsWith("Placed"));
    expect(placed?.label).toBe(
      `Placed ${line?.placed} of ${line?.planned} items`
    );
    expect(placed?.detail).toMatch(/^Fred carried \d+ items?$/);
    expect(line?.explanation).toMatch(
      /Placed \d+ of \d+ items: Fred carried \d+ items?/
    );
  });

  it("counts a half-filled basket as one of its two items, never as none", () => {
    const level = onlyOpen(
      createLevel(DEFAULT_SETUP),
      (t) => t.kind === "basket"
    );
    const basket = level.targets.find((t) => t.kind === "basket");
    const state: GameState = {
      ...level,
      targets: level.targets.map((t) =>
        t === basket
          ? {
              ...t,
              filled: [{ kind: "arrangement", madeBy: "fred" }],
              filledBy: ["fred"],
              filledByHelper: [false],
            }
          : t
      ),
    };
    expect(categoryProgress(state, "bouquets")).toEqual({
      placed: 1,
      planned: 2,
      multi: true,
    });
    const line = readinessLines(state).find((l) => l.category === "bouquets");
    expect(line?.status).toBe("unfinished");
    expect(line?.placed).toBe(1);
    expect(line?.planned).toBe(2);
    expect(line?.explanation).toBe(
      "Only 1 of 2 items placed at 4:00. Fred carried 1 item."
    );
    expect(line?.conditions.map((c) => c.label)).toContain(
      "Placed 1 of 2 items"
    );
  });

  it("credits each person's placements on an unfinished line (round 14, S2)", () => {
    const level = createLevel(DEFAULT_SETUP);
    const slots = level.targets.filter((t) => t.kind === "buffet");
    const [first, second] = slots;
    const state: GameState = {
      ...level,
      targets: level.targets.map((t) =>
        t === first || t === second
          ? {
              ...t,
              status: "filled",
              filled: [{ kind: t.wants, madeBy: null }],
              filledBy: [t === first ? "abbi" : "fred"],
              filledByHelper: [false],
            }
          : t
      ),
    };
    const line = readinessLines(state).find((l) => l.category === "buffet");
    expect(line?.status).toBe("unfinished");
    expect(line?.explanation).toBe(
      `Only 2 of ${slots.length} done at 4:00. Abbi carried 1 item, Fred carried 1 item.`
    );
  });

  it("finishes the basket only when its second arrangement is in", () => {
    const level = onlyOpen(
      createLevel(DEFAULT_SETUP),
      (t) => t.kind === "basket"
    );
    const both = allFilled(level, "abbi");
    expect(categoryProgress(both, "bouquets")).toEqual({
      placed: 2,
      planned: 2,
      multi: true,
    });
    expect(
      readinessLines(both).find((l) => l.category === "bouquets")?.status
    ).toBe("ready");
  });

  it("counts every slot of every category with capacity above one", () => {
    const level = createLevel(DEFAULT_SETUP);
    for (const category of [
      "bouquets",
      "centerpieces",
      "petals",
      "chairs",
      "lanterns",
      "buffet",
    ] as const) {
      const slots = level.targets
        .filter((t) => t.category === category && t.status !== "unplanned")
        .reduce((n, t) => n + t.capacity, 0);
      expect(categoryProgress(level, category)?.planned ?? 0, category).toBe(
        slots
      );
    }
  });

  it("credits a placement the helper made as helper work, apart from the player's own", () => {
    const level = createLevel(DEFAULT_SETUP);
    const table = level.targets.find((t) => t.kind === "table");
    if (!table) throw new Error("the plan has a table");
    const state: GameState = {
      ...level,
      targets: level.targets.map((t) =>
        t === table
          ? {
              ...t,
              status: "filled",
              filled: [{ kind: t.wants, madeBy: null }],
              filledBy: ["abbi"],
              filledByHelper: [true],
            }
          : t
      ),
    };
    const details = readinessLines(state).flatMap((l) =>
      l.conditions.map((c) => c.detail)
    );
    expect(details).toContain("Abbi (helper) carried 1 item");
    expect(details.some((d) => /(^|, )Abbi carried/.test(d))).toBe(false);
  });

  it("formats money with a thousands comma, in the setup total and the budget refusal", () => {
    expect(dollars(3400)).toBe("$3,400");
    expect(dollars(2960)).toBe("$2,960");
    const over = validateSetup({
      ...DEFAULT_SETUP,
      cart: { roses: "yes", food: "lots", lanterns: true },
    });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.reason).toMatch(/\$\d{1,3}(,\d{3})+ budget\.$/);
  });

  it("writes source and made clauses with a colon and no stacked parentheses (#1931)", () => {
    const readiness = readinessLines(
      allFilled(createLevel(DEFAULT_SETUP), "abbi")
    );
    const bouquets = readiness.find((l) => l.category === "bouquets");
    const buffet = readiness.find((l) => l.category === "buffet");
    expect(bouquets?.explanation).toMatch(
      /Roses bought: (Modest|Full|"Yes"), \d+ bunches/
    );
    expect(buffet?.explanation).toMatch(
      /Food bought: (Enough|Lots|Feed Rochester), drinks and sheet cake included/
    );
    for (const line of readiness) {
      expect(line.explanation).not.toMatch(/\) \(/);
    }
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
      "FAQ: no calls came in."
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
      "Take the roses from the ROSE crate"
    );
    const atTable = place(createLevel(DEFAULT_SETUP), "abbi", 7, 8, [0, -1]);
    expect(getPrompt(atTable, "abbi").work).toBe(
      "leave this table bare (it stays out of the plan)"
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
    interactHeld: fc.boolean(),
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

  it("refuses roses at the bin, so planned stock is never thrown out (round 15)", () => {
    const roses = place(createLevel(DEFAULT_SETUP), "fred", 6, 4, [0, -1], {
      kind: "roses",
      madeBy: null,
    });
    const held = run(roses, frameFor("fred", { work: true }), ticks(2));
    expect(held.state.players.fred.holding?.kind).toBe("roses");
    expect(held.state.players.fred.binHold).toBe(0);
    expect(held.events.some((e) => e.type === "thrown-out")).toBe(false);
    expect(getPrompt(held.state, "fred").work).toBeNull();
    expect(getPrompt(held.state, "fred").interact).toBe(
      "The BIN only takes burnt food."
    );
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
      hint: "Carry the roses to the ARRANGE table.",
    },
    {
      name: "roses on the table: hold F to arrange them",
      state: () =>
        withStation(createLevel(DEFAULT_SETUP), 8, 3, {
          kind: "roses",
          madeBy: null,
        }),
      id: "fred",
      hint: "Stand at the ARRANGE table and hold F or Shift to arrange the roses.",
    },
    {
      name: "arrangement ready: take it from the table",
      state: () =>
        withStation(createLevel(DEFAULT_SETUP), 8, 3, {
          kind: "arrangement",
          madeBy: "abbi",
        }),
      id: "fred",
      hint: "Take the arrangement from the ARRANGE table.",
    },
    {
      name: "holding an arrangement: carry it to a centerpiece",
      state: () =>
        place(createLevel(DEFAULT_SETUP), "fred", 2, 2, [0, 1], {
          kind: "arrangement",
          madeBy: "fred",
        }),
      id: "fred",
      hint: "Place the arrangement at a centerpiece table.",
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
      hint: "Carry the roses to the PETALS bucket.",
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
      hint: "Carry the roses to the PETALS bucket.",
    },
    {
      name: "roses, every arrangement filled, aisle unplanned: no roses to carry: put them down out of the way",
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
      hint: "Put the roses down somewhere out of the way.",
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
      hint: "Place the bucket of petals at an aisle spot.",
    },
    {
      name: "raw hot dogs and a free grill: carry them to the grill",
      state: () =>
        place(createLevel(DEFAULT_SETUP), "fred", 2, 2, [0, 1], {
          kind: "hotdogs-raw",
          madeBy: null,
        }),
      id: "fred",
      hint: "Carry the raw hot dogs to the GRILL.",
    },
    {
      name: "hot dogs cooked on the grill: take them off",
      state: () =>
        withStation(createLevel(DEFAULT_SETUP), 4, 3, {
          kind: "hotdogs",
          madeBy: "fred",
        }),
      id: "abbi",
      hint: "Take the hot dogs off the GRILL.",
    },
    {
      name: "holding cooked hot dogs: carry them to the buffet",
      state: () =>
        place(createLevel(DEFAULT_SETUP), "abbi", 2, 2, [0, 1], {
          kind: "hotdogs",
          madeBy: "fred",
        }),
      id: "abbi",
      hint: "Place the hot dogs at the buffet.",
    },
    {
      name: "holding mac and cheese: carry it to the buffet",
      state: () =>
        place(createLevel(DEFAULT_SETUP), "fred", 2, 2, [0, 1], {
          kind: "mac",
          madeBy: null,
        }),
      id: "fred",
      hint: "Place the mac and cheese at the buffet.",
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
      hint: "Place the lantern at a lantern hook.",
    },
    {
      name: "only the chair spots left: grab a stack of 2 chairs",
      state: () =>
        onlyOpen(createLevel(DEFAULT_SETUP), (t) => t.kind === "chair-spot"),
      id: "fred",
      hint: "Grab a stack of 2 chairs from the CHAIR crate on the left.",
    },
    {
      name: "holding a stack of 2 chairs: carry it to a chair spot",
      state: () =>
        place(createLevel(DEFAULT_SETUP), "abbi", 2, 2, [0, 1], {
          kind: "chairs",
          madeBy: null,
          count: 2,
        }),
      id: "abbi",
      hint: "Place a stack of 2 chairs at a chair spot.",
    },
    {
      name: "holding something burnt: take it to the bin, with the key named",
      state: () =>
        place(createLevel(DEFAULT_SETUP), "fred", 2, 2, [0, 1], {
          kind: "burnt",
          madeBy: null,
        }),
      id: "fred",
      hint: "Carry the burnt food to the BIN and hold F or Shift there to throw it out.",
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

  it("names the hold in the bin prompt, not a bare action", () => {
    expect(THROW_OUT_PROMPT).toBe("Hold to throw it out");
  });

  it("offers to put an item back in its crate", () => {
    const at = place(createLevel(DEFAULT_SETUP), "fred", 2, 3, [-1, 0], {
      kind: "roses",
      madeBy: null,
    });
    expect(getPrompt(at, "fred").interact).toBe(
      "Put the roses back in the ROSE crate"
    );
  });

  it("says why, not a blank prompt, once the floor is full", () => {
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
    expect(getPrompt(full, "fred").interact).toBe(
      "The floor here is full. Find a station or the bin."
    );
  });
});

const STAY_DECISION: PresenceDecision = { choice: "stay", commitment: null };

describe("the receipt's copy", () => {
  it("says what a missed leave cost in one clear sentence, with no stray duplicate", () => {
    const left = finishIdle(DEFAULT_SETUP, {
      choice: "leave",
      commitment: null,
    });
    const receipt = computeReceipt(left);
    expect(receipt.followThrough.explanation).toBe(`Missed. ${LEFT_LINE}`);
    expect(LEFT_LINE).not.toContain("requested separately");
  });

  it("names the tux shop on the receipt and says the name is not the real shop's", () => {
    const receipt = computeReceipt(finishIdle(DEFAULT_SETUP, STAY_DECISION));
    expect(receipt.suit).toContain("The Suit Wherehouse");
    expect(receipt.suit).toContain(
      "The Suit Wherehouse (not the real shop's name)"
    );
  });

  it("says 'Fred stayed for the setup.' on one line of the receipt only", () => {
    const receipt = computeReceipt(finishIdle(DEFAULT_SETUP, STAY_DECISION));
    const copy = JSON.stringify(receipt);
    expect(copy.split("Fred stayed for the setup.").length - 1).toBe(1);
  });

  it("takes its subtitle from the fiction bank, never from an unsourced venue claim", () => {
    const bare = computeReceipt(createLevel(DEFAULT_SETUP));
    expect(bare.signatureMoment).not.toMatch(/Tudor|mansion/);
    const banked = LINE_BANK.find((line) => line.id === "signature-neutral");
    expect(banked?.tag).toBe("Fiction");
    expect(banked?.fact).toBeNull();
    expect(bare.signatureMoment).toBe(banked?.text);
  });

  it("never claims tables set or food on time for an idle run", () => {
    const idle = computeReceipt(finishIdle(DEFAULT_SETUP, STAY_DECISION));
    const chairs = idle.readiness.find((l) => l.category === "chairs");
    const buffet = idle.readiness.find((l) => l.category === "buffet");
    expect(chairs?.status).toBe("unfinished");
    expect(buffet?.status).toBe("unfinished");
    expect(idle.signatureMoment).not.toContain("Every table set");
    expect(idle.signatureMoment).toBe(bankText("signature-neutral"));
  });

  it("claims tables set and food on time only when both are finished", () => {
    const base = finishIdle(DEFAULT_SETUP, STAY_DECISION);
    const onlyTablesAndFood = {
      ...base,
      targets: base.targets.map((t) =>
        t.category === "chairs" || t.category === "buffet"
          ? { ...t, status: "filled" as const, filled: [], filledBy: [] }
          : t
      ),
    };
    const receipt = computeReceipt(onlyTablesAndFood);
    expect(receipt.readiness.find((l) => l.category === "buffet")?.status).toBe(
      "ready"
    );
    expect(receipt.signatureMoment).toBe(bankText("signature-tables-food"));
  });
});

describe("the coach's co-op starts (#1931)", () => {
  it("gives Fred the roses first and Abbi the raw food first in co-op", () => {
    const state = createLevel(DEFAULT_SETUP);
    const fred = getHint(state, "fred", { coop: true });
    const abbi = getHint(state, "abbi", { coop: true });
    expect(fred).toMatch(/^Grab roses from the ROSE crate/);
    expect(abbi).toMatch(/^Grab raw (hot dogs|wings) from the /);
    expect(fred).not.toBe(abbi);
  });

  it("leaves solo hints unchanged, so the helper and the single player agree with the same plan", () => {
    const state = createLevel(DEFAULT_SETUP);
    expect(getHint(state, "abbi")).toBe(getHint(state, "abbi", {}));
    expect(getHint(state, "abbi")).toMatch(/^Grab roses from the ROSE crate/);
  });
});

describe("interaction targets", () => {
  const roses: Item = { kind: "roses", madeBy: null };
  const arrangement: Item = { kind: "arrangement", madeBy: "fred" };

  it("puts roses on the arrange table beside a person, not on the floor they face", () => {
    const at = place(createLevel(DEFAULT_SETUP), "fred", 7, 3, [0, -1], roses);
    expect(interactTile(at, "fred")).toEqual({ x: 8, y: 3 });
    expect(getPrompt(at, "fred").interact).toBe(
      "Put the roses on the ARRANGE table"
    );
    const after = stepGame(at, frameFor("fred", { interact: true })).state;
    expect(after.stations.find((s) => s.x === 8 && s.y === 3)?.item?.kind).toBe(
      "roses"
    );
    expect(after.players.fred.holding).toBeNull();
    expect(after.floor).toEqual([]);
  });

  it("puts raw food on the grill beside a person, ahead of a crate they face", () => {
    const raw: Item = { kind: "hotdogs-raw", madeBy: null };
    const at = place(createLevel(DEFAULT_SETUP), "abbi", 4, 2, [0, -1], raw);
    expect(interactTile(at, "abbi")).toEqual({ x: 4, y: 3 });
    expect(getPrompt(at, "abbi").interact).toBe(
      "Put the raw hot dogs on the GRILL"
    );
    const after = stepGame(at, frameFor("abbi", { interact: true })).state;
    expect(after.stations.find((s) => s.x === 4 && s.y === 3)?.item?.kind).toBe(
      "hotdogs-raw"
    );
  });

  it("gives the bouquet basket the arrangement a person faces", () => {
    const base = onlyOpen(
      createLevel(DEFAULT_SETUP),
      (t) => t.kind === "basket"
    );
    const at = place(base, "fred", 16, 10, [1, 0], arrangement);
    expect(interactTile(at, "fred")).toEqual({ x: 17, y: 10 });
    expect(getPrompt(at, "fred").interact).toBe(
      "Place a rose arrangement at the bouquet basket"
    );
    const after = stepGame(at, frameFor("fred", { interact: true })).state;
    expect(after.targets.find((t) => t.kind === "basket")?.filled).toHaveLength(
      1
    );
  });

  it("gives a centerpiece table the arrangement a person faces", () => {
    const base = onlyOpen(
      createLevel(DEFAULT_SETUP),
      (t) => t.kind === "table"
    );
    const at = place(base, "abbi", 4, 6, [0, 1], arrangement);
    expect(interactTile(at, "abbi")).toEqual({ x: 4, y: 7 });
    expect(getPrompt(at, "abbi").interact).toBe(
      "Place a rose arrangement at a centerpiece table"
    );
  });

  it("drops on the floor only when no station is in reach, and only after a hold", () => {
    const at = place(createLevel(DEFAULT_SETUP), "fred", 10, 4, [0, -1], roses);
    expect(interactTile(at, "fred")).toEqual({ x: 10, y: 3 });
    expect(getPrompt(at, "fred").interact).toBeNull();
    expect(getPrompt(at, "fred").floorDrop).toEqual({
      note: null,
      action: "set the roses down on the floor here",
    });
    const tapped = press(at, "fred").state;
    expect(tapped.floor).toEqual([]);
    expect(tapped.players.fred.holding).toEqual(roses);
    const after = holdFloor(at, "fred");
    expect(after.floor).toEqual([{ x: 10, y: 3, item: roses }]);
  });

  it("uses a station behind the person that takes the item, ahead of the floor they face", () => {
    const at = place(createLevel(DEFAULT_SETUP), "fred", 8, 4, [0, 1], roses);
    expect(interactTile(at, "fred")).toEqual({ x: 8, y: 3 });
  });

  it("skips a station behind the person that does not take the item, so the hold lands on the floor they face", () => {
    const at = place(createLevel(DEFAULT_SETUP), "fred", 6, 2, [0, -1], roses);
    expect(interactTile(at, "fred")).toEqual({ x: 6, y: 1 });
    const after = holdFloor(at, "fred");
    expect(after.floor).toEqual([{ x: 6, y: 1, item: roses }]);
  });

  it("a tap facing floor does nothing, and a hold drops the item once FLOOR_HOLD_TICKS have passed", () => {
    const at = place(createLevel(DEFAULT_SETUP), "fred", 10, 4, [0, -1], roses);
    let current = stepGame(
      at,
      frameFor("fred", { interact: true, interactHeld: true })
    ).state;
    for (let i = 1; i < FLOOR_HOLD_TICKS - 1; i++) {
      current = stepGame(
        current,
        frameFor("fred", { interactHeld: true })
      ).state;
    }
    expect(current.floor).toEqual([]);
    expect(current.players.fred.holding).toEqual(roses);
    current = stepGame(current, frameFor("fred", { interactHeld: true })).state;
    expect(current.floor).toEqual([{ x: 10, y: 3, item: roses }]);
    expect(current.players.fred.holding).toBeNull();
    expect(current.players.fred.floorHold).toBeNull();
  });

  it("letting go of E before the hold ends sets nothing down", () => {
    const at = place(createLevel(DEFAULT_SETUP), "fred", 10, 4, [0, -1], roses);
    const partial = run(
      at,
      frameFor("fred", { interact: true, interactHeld: true }),
      5
    ).state;
    const released = run(partial, IDLE_FRAME, FLOOR_HOLD_TICKS).state;
    expect(released.floor).toEqual([]);
    expect(released.players.fred.floorHold).toBeNull();
  });

  it("a hold started facing floor does not carry into a station press after a turn", () => {
    const arrange = createLevel(DEFAULT_SETUP).stations.find(
      (s) => s.kind === "arrange"
    );
    if (!arrange) throw new Error("the venue has an ARRANGE table");
    const at = place(createLevel(DEFAULT_SETUP), "fred", 10, 4, [0, -1], ROSES);
    const held = run(
      at,
      frameFor("fred", { interact: true, interactHeld: true }),
      4
    ).state;
    expect(held.players.fred.floorHold).not.toBeNull();
    // The body turns to the ARRANGE table, which is a new tile and facing.
    const turned = place(
      held,
      "fred",
      arrange.x,
      arrange.y + 1,
      [0, -1],
      ROSES
    );
    const pressed = press(turned, "fred").state;
    expect(pressed.players.fred.holding).toBeNull();
    expect(pressed.stations.find((s) => s.kind === "arrange")?.item).toEqual(
      ROSES
    );
    expect(pressed.floor).toEqual([]);
  });

  it("moving to another tile mid-hold resets it, and E must be pressed again", () => {
    const at = place(createLevel(DEFAULT_SETUP), "fred", 10, 4, [0, -1], roses);
    const held = run(
      at,
      frameFor("fred", { interact: true, interactHeld: true }),
      4
    ).state;
    expect(held.players.fred.floorHold).not.toBeNull();
    // Walk left until the body leaves tile (10, 4).
    let current = held;
    for (let i = 0; i < 60 && Math.floor(current.players.fred.x) === 10; i++) {
      current = stepGame(
        current,
        frameFor("fred", { moveX: -1, interactHeld: true })
      ).state;
    }
    expect(Math.floor(current.players.fred.x)).toBe(9);
    expect(current.players.fred.floorHold).toBeNull();
    // Holding E on, without a new press, does not start a hold again.
    current = run(
      current,
      frameFor("fred", { interactHeld: true }),
      FLOOR_HOLD_TICKS * 2
    ).state;
    expect(current.floor.some((f) => f.item === roses)).toBe(false);
    expect(current.players.fred.holding).toEqual(roses);
  });

  it("turning mid-hold resets it, even without leaving the tile", () => {
    const at = place(createLevel(DEFAULT_SETUP), "fred", 10, 4, [0, -1], roses);
    const held = run(
      at,
      frameFor("fred", { interact: true, interactHeld: true }),
      4
    ).state;
    // A sideways press turns the body to face the tile on its right.
    const turned = stepGame(
      held,
      frameFor("fred", { moveX: 1, interactHeld: true })
    ).state;
    expect(turned.players.fred.facingX).toBe(1);
    expect(turned.players.fred.floorHold).toBeNull();
    const after = run(
      turned,
      frameFor("fred", { interactHeld: true }),
      FLOOR_HOLD_TICKS * 2
    ).state;
    expect(after.floor).toEqual([]);
  });
});

describe("the coach names one stage at a time", () => {
  const charAt = (tile: { x: number; y: number } | null) =>
    tile ? VENUE_MAP[tile.y]?.[tile.x] : undefined;

  it("holding nothing: grabs from the crate and points at it", () => {
    const step = getCoachStep(createLevel(DEFAULT_SETUP), "fred");
    expect(step?.text).toBe("Grab roses from the ROSE crate on the left.");
    expect(charAt(step?.tile ?? null)).toBe("R");
  });

  it("holding a raw item: takes it to its station, at a free one", () => {
    const roses: Item = { kind: "roses", madeBy: null };
    const state = place(
      createLevel(DEFAULT_SETUP),
      "abbi",
      2,
      2,
      [0, 1],
      roses
    );
    const step = getCoachStep(state, "abbi");
    expect(step?.text).toBe("Carry the roses to the ARRANGE table.");
    expect(
      state.stations.some(
        (s) =>
          s.kind === "arrange" &&
          s.item === null &&
          s.x === step?.tile?.x &&
          s.y === step?.tile?.y
      )
    ).toBe(true);
  });

  it("holding a made item: places it at the target that wants it", () => {
    const arrangement: Item = { kind: "arrangement", madeBy: "fred" };
    const state = place(
      createLevel(DEFAULT_SETUP),
      "fred",
      2,
      2,
      [0, 1],
      arrangement
    );
    const step = getCoachStep(state, "fred");
    expect(step?.text).toBe("Place the arrangement at a centerpiece table.");
    expect(
      state.targets.some(
        (t) =>
          t.kind === "table" && t.x === step?.tile?.x && t.y === step?.tile?.y
      )
    ).toBe(true);
  });

  it("a batch cooking on the grill: collects it when ready", () => {
    const base = onlyOpen(
      createLevel(DEFAULT_SETUP),
      (t) => t.wants === "hotdogs"
    );
    const state = withStock(
      withStation(base, 4, 3, { kind: "hotdogs-raw", madeBy: null }),
      "hotdogs-raw",
      0
    );
    const step = getCoachStep(state, "fred");
    expect(step?.text).toBe(
      "Collect the hot dogs from the GRILL when they are ready."
    );
    expect(step?.tile).toEqual({ x: 4, y: 3 });
    expect(step?.waiting).toBe(true);
  });

  it("holding an item no open place wants: says to put it down out of the way, with no tile", () => {
    const base = onlyOpen(
      createLevel(DEFAULT_SETUP),
      (t) => t.wants !== "petals"
    );
    const state = place(base, "fred", 2, 2, [0, 1], {
      kind: "petals",
      madeBy: null,
    });
    const step = getCoachStep(state, "fred");
    expect(step?.text).toBe(
      "Put the bucket of petals down somewhere out of the way."
    );
    expect(step?.tile).toBeNull();
  });

  it("a busy station is a wait step, while a free one is not", () => {
    const roses: Item = { kind: "roses", madeBy: null };
    const base = onlyOpen(
      createLevel(DEFAULT_SETUP),
      (t) => t.wants === "arrangement"
    );
    const busy = {
      ...base,
      stations: base.stations.map((s) =>
        s.kind === "arrange" ? { ...s, item: roses } : s
      ),
    };
    const carrying = place(busy, "fred", 2, 2, [0, 1], roses);
    expect(getCoachStep(carrying, "fred")).toMatchObject({
      text: "Wait for the ARRANGE table to clear.",
      waiting: true,
    });
    const free = place(base, "fred", 2, 2, [0, 1], roses);
    expect(getCoachStep(free, "fred")?.waiting).toBeFalsy();
  });
});

describe("burnt batch recovery (#1948)", () => {
  /** Cooks one raw hot dog batch on the grill until it burns, with the crate empty. */
  function burntHotdogs(): GameState {
    const start = {
      ...place(createLevel(DEFAULT_SETUP), "fred", 4, 4, [0, -1], {
        kind: "hotdogs-raw",
        madeBy: null,
      }),
      stock: { ...createLevel(DEFAULT_SETUP).stock, "hotdogs-raw": 0 },
    };
    let state = press(start, "fred").state;
    // Cooking takes COOK_SECONDS and the pickup window the rest of BURN_SECONDS.
    state = run(state, IDLE_FRAME, ticks(BURN_SECONDS + 1)).state;
    return state;
  }

  it("binning a burnt batch restocks one batch of its crate", () => {
    let state = burntHotdogs();
    const grill = state.stations.find((s) => s.x === 4 && s.y === 3);
    expect(grill?.item).toEqual({
      kind: "burnt",
      madeBy: "fred",
      source: "hotdogs-raw",
    });
    expect(state.stock["hotdogs-raw"]).toBe(0);

    state = press(state, "fred").state;
    state = place(state, "fred", 6, 4, [0, -1], state.players.fred.holding);
    const binned = run(
      state,
      frameFor("fred", { work: true }),
      ticks(BIN_HOLD_SECONDS)
    );
    expect(binned.events).toContainEqual({
      type: "restocked",
      player: "fred",
      supply: "hotdogs-raw",
    });
    expect(binned.state.stock["hotdogs-raw"]).toBe(1);
    expect(binned.state.burntRestocks).toBe(1);
  });

  it("a restocked batch lets the buffet be filled after the burnt one", () => {
    let state = burntHotdogs();
    state = press(state, "fred").state;
    state = place(state, "fred", 6, 4, [0, -1], state.players.fred.holding);
    state = run(
      state,
      frameFor("fred", { work: true }),
      ticks(BIN_HOLD_SECONDS)
    ).state;
    expect(state.stock["hotdogs-raw"]).toBe(1);

    // Fred takes the restocked batch from the crate, cooks it, and serves it.
    state = place(state, "fred", 4, 4, [0, -1], {
      kind: "hotdogs-raw",
      madeBy: null,
    });
    state = press(state, "fred").state;
    state = run(state, IDLE_FRAME, ticks(COOK_SECONDS + 1)).state;
    state = place(state, "fred", 4, 4, [0, -1], null);
    state = press(state, "fred").state;
    expect(state.players.fred.holding).toMatchObject({ kind: "hotdogs" });
    state = place(state, "fred", 7, 2, [0, -1], state.players.fred.holding);
    state = press(state, "fred").state;
    expect(state.targets.find((t) => t.x === 7 && t.y === 1)?.status).toBe(
      "filled"
    );
  });

  it("the receipt's kitchen line says what was restocked", () => {
    const level = createLevel(DEFAULT_SETUP);
    expect(
      computeReceipt({ ...level, burntBatches: 1, burntRestocks: 1 }).kitchen
    ).toBe(
      "Extra smoky: 1 batch burnt on the grill. Restocked 1 burnt batch from the crate."
    );
  });
});

describe("chair stacks (#1948)", () => {
  /** Fred stands on the chair crate's right, facing it. */
  const atChairCrate = (holding: Item | null = null) =>
    place(createLevel(DEFAULT_SETUP), "fred", 2, 7, [-1, 0], holding);

  it("one take picks up a stack of two and takes two off the crate", () => {
    const { state, events } = press(atChairCrate(), "fred");
    expect(state.players.fred.holding).toEqual({
      kind: "chairs",
      madeBy: null,
      count: CHAIRS_PER_CARRY,
    });
    expect(state.stock.chairs).toBe(CHAIR_COUNT - CHAIRS_PER_CARRY);
    expect(events).toContainEqual({
      type: "picked-up",
      player: "fred",
      item: "chairs",
    });
  });

  it("takes the last chair alone when only one is left", () => {
    const start = {
      ...atChairCrate(),
      stock: { ...createLevel(DEFAULT_SETUP).stock, chairs: 1 },
    };
    const { state, events } = press(start, "fred");
    expect(state.players.fred.holding).toEqual({
      kind: "chairs",
      madeBy: null,
      count: 1,
    });
    expect(state.stock.chairs).toBe(0);
    expect(events).toContainEqual({ type: "supply-empty", supply: "chairs" });
  });

  it("a chair spot takes one chair and the second stays in hand", () => {
    const start = place(createLevel(DEFAULT_SETUP), "fred", 14, 6, [0, -1], {
      kind: "chairs",
      madeBy: null,
      count: 2,
    });
    const once = press(start, "fred").state;
    const spot = once.targets.find((t) => t.x === 14 && t.y === 5);
    expect(spot?.filled).toHaveLength(1);
    expect(spot?.status).toBe("filled");
    expect(once.players.fred.holding).toEqual({
      kind: "chairs",
      madeBy: null,
      count: 1,
    });

    const placed = press(
      place(once, "fred", 15, 6, [0, -1], once.players.fred.holding),
      "fred"
    ).state;
    expect(placed.targets.find((t) => t.x === 15 && t.y === 5)?.status).toBe(
      "filled"
    );
    expect(placed.players.fred.holding).toBeNull();
  });

  it("putting a stack back in its crate returns both chairs", () => {
    const start = {
      ...atChairCrate({ kind: "chairs", madeBy: null, count: 2 }),
      stock: { ...createLevel(DEFAULT_SETUP).stock, chairs: 6 },
    };
    const { state } = press(start, "fred");
    expect(state.stock.chairs).toBe(8);
    expect(state.players.fred.holding).toBeNull();
  });

  it("names a stack of 2 chairs and a single chair in the prompts", () => {
    expect(getPrompt(atChairCrate(), "fred").interact).toBe(
      "Take a stack of 2 chairs from the CHAIR crate"
    );
    const last = {
      ...atChairCrate(),
      stock: { ...createLevel(DEFAULT_SETUP).stock, chairs: 1 },
    };
    expect(getPrompt(last, "fred").interact).toBe(
      "Take a chair from the CHAIR crate"
    );
  });

  it("binning a stack returns both chairs to the crate instead of throwing them out", () => {
    const level = createLevel(DEFAULT_SETUP);
    const start = {
      ...place(level, "fred", 6, 4, [0, -1], {
        kind: "chairs",
        madeBy: null,
        count: 2,
      }),
      stock: { ...level.stock, chairs: CHAIR_COUNT - 2 },
    };
    expect(getPrompt(start, "fred").work).toBe(
      "Put a stack of 2 chairs back in the CHAIR crate"
    );
    const binned = run(
      start,
      frameFor("fred", { work: true }),
      ticks(BIN_HOLD_SECONDS)
    );
    expect(binned.state.stock.chairs).toBe(CHAIR_COUNT);
    expect(binned.state.players.fred.holding).toBeNull();
    expect(binned.events).toContainEqual({
      type: "restocked",
      player: "fred",
      supply: "chairs",
    });
    expect(binned.events.some((e) => e.type === "thrown-out")).toBe(false);
  });
});

describe("take prompts name the tile (#1948)", () => {
  it("names the cooked food on the grill", () => {
    const start = place(createLevel(DEFAULT_SETUP), "fred", 4, 4, [0, -1]);
    const cooked = {
      ...start,
      stations: start.stations.map((s) =>
        s.kind === "grill"
          ? { ...s, item: { kind: "wings" as const, madeBy: null } }
          : s
      ),
    };
    expect(getPrompt(cooked, "fred").interact).toBe(
      "Take the cooked wings off the GRILL"
    );
  });
});

/** Like `place`, but at an exact position in tiles, so a body can straddle a boundary. */
function placeExact(
  state: GameState,
  id: PlayerId,
  x: number,
  y: number,
  facing: [number, number],
  holding: Item | null = null
): GameState {
  return {
    ...state,
    players: {
      ...state.players,
      [id]: {
        ...state.players[id],
        x,
        y,
        facingX: facing[0],
        facingY: facing[1],
        holding,
      },
    },
  };
}

/** Puts one station's item on the venue for a test, by tile. */
function withStationItem(
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

describe("a press on a spot that takes something else (round 8, S2)", () => {
  it("names the dish the buffet spot takes when a cooked food is carried to the wrong slot", () => {
    const base = createLevel(DEFAULT_SETUP);
    const slot = base.targets.find((t) => t.kind === "buffet" && t.x === 8);
    expect(slot?.wants).toBe("wings");
    const hotdogs: Item = { kind: "hotdogs", madeBy: null };
    const at = place(base, "fred", 8, 2, [0, -1], hotdogs);
    expect(interactTile(at, "fred")).toBeNull();
    expect(getPrompt(at, "fred").interact).toBe(
      "This is the wings spot. The hot dogs go on their own spot."
    );
    const after = stepGame(at, frameFor("fred", { interact: true })).state;
    expect(after.players.fred.holding).toEqual(hotdogs);
    expect(after.floor).toEqual([]);
  });

  it("keeps the normal place prompt on the slot that takes the carried food", () => {
    const base = createLevel(DEFAULT_SETUP);
    const hotdogs: Item = { kind: "hotdogs", madeBy: null };
    const at = place(base, "fred", 7, 2, [0, -1], hotdogs);
    expect(getPrompt(at, "fred").interact).toBe(
      "Place a tray of hot dogs at the buffet"
    );
  });
});

describe("a press that would drop an item because a station is blocked (round 8, S7)", () => {
  it("names the full grill when the press would put raw wings on the floor", () => {
    const raw: Item = { kind: "wings-raw", madeBy: null };
    const base = withStationItem(createLevel(DEFAULT_SETUP), 4, 3, {
      kind: "hotdogs-raw",
      madeBy: null,
    });
    const at = placeExact(base, "fred", 3.5, 3.5, [-1, 0], raw);
    expect(interactTile(at, "fred")).toEqual({ x: 2, y: 3 });
    expect(getPrompt(at, "fred").floorDrop).toEqual({
      note: "The GRILL is full.",
      action: "set the raw wings down on the floor here",
    });
  });

  it("names no blocker when the grill in reach is empty", () => {
    const raw: Item = { kind: "wings-raw", madeBy: null };
    const at = place(createLevel(DEFAULT_SETUP), "fred", 4, 2, [0, -1], raw);
    expect(getPrompt(at, "fred").interact).toBe(
      "Put the raw wings on the GRILL"
    );
  });
});

describe("a body that straddles two tiles (round 8, S3)", () => {
  const raw: Item = { kind: "wings-raw", madeBy: null };

  it("uses the tile in front of the other overlapped tile when the nearest one takes nothing", () => {
    // Standing at x 5.0 facing down: the centre sits on the boundary with
    // column 4, so the body straddles into (4,3). The tile in front of its
    // own tile (5,2) is the occupied grill at (5,3), which takes nothing.
    const base = withStationItem(createLevel(DEFAULT_SETUP), 5, 3, {
      kind: "hotdogs-raw",
      madeBy: null,
    });
    const at = placeExact(base, "fred", 5.0, 2.5, [0, 1], raw);
    expect(interactTile(at, "fred")).toEqual({ x: 4, y: 3 });
    expect(getPrompt(at, "fred").interact).toBe(
      "Put the raw wings on the GRILL"
    );
    const after = stepGame(at, frameFor("fred", { interact: true })).state;
    expect(after.stations.find((s) => s.x === 4 && s.y === 3)?.item?.kind).toBe(
      "wings-raw"
    );
    expect(after.players.fred.holding).toBeNull();
  });

  it("keeps the nearest tile when it takes the item", () => {
    const at = placeExact(
      createLevel(DEFAULT_SETUP),
      "fred",
      4.9,
      2.5,
      [0, 1],
      raw
    );
    expect(interactTile(at, "fred")).toEqual({ x: 4, y: 3 });
  });

  it("falls back to the tile in front of the overlapped tile with empty hands", () => {
    const base = withStationItem(createLevel(DEFAULT_SETUP), 4, 3, {
      kind: "hotdogs",
      madeBy: null,
    });
    const at = placeExact(base, "abbi", 5.0, 2.5, [0, 1]);
    expect(interactTile(at, "abbi")).toEqual({ x: 4, y: 3 });
    expect(getPrompt(at, "abbi").interact).toBe(
      "Take the cooked hot dogs off the GRILL"
    );
  });

  it("does not reach a neighbour that the body overlaps only by a sliver", () => {
    // The centre at x 5.29 is 0.29 from the boundary, more than PLAYER_RADIUS / 2
    // away, so the grill at (4,3) is not in reach even though the body overlaps it.
    const base = withStationItem(createLevel(DEFAULT_SETUP), 4, 3, {
      kind: "hotdogs",
      madeBy: null,
    });
    const sliver = placeExact(base, "abbi", 5.29, 2.5, [0, 1]);
    expect(interactTile(sliver, "abbi")).toBeNull();
    const inBand = placeExact(base, "abbi", 5.12, 2.5, [0, 1]);
    expect(interactTile(inBand, "abbi")).toEqual({ x: 4, y: 3 });
  });

  it("leaves a body that does not straddle on the tile it faces", () => {
    const grillBusy = withStationItem(createLevel(DEFAULT_SETUP), 5, 3, {
      kind: "hotdogs-raw",
      madeBy: null,
    });
    const off = placeExact(grillBusy, "abbi", 5.5, 2.5, [0, 1], raw);
    expect(interactTile(off, "abbi")).toBeNull();
    const at = placeExact(grillBusy, "abbi", 4.5, 2.5, [0, 1], raw);
    expect(interactTile(at, "abbi")).toEqual({ x: 4, y: 3 });
  });
});

describe("a promise for work that is already done (round 8, S6)", () => {
  /** The lanterns are all placed, so a promise about them would be kept for free. */
  function lanternsDone(state: GameState): GameState {
    return {
      ...state,
      targets: state.targets.map((t) =>
        t.category === "lanterns"
          ? {
              ...t,
              status: "filled" as const,
              filled: Array.from({ length: t.capacity }, () => ({
                kind: "lantern" as const,
                madeBy: null,
              })),
            }
          : t
      ),
    };
  }

  it("refuses a break that promises a complete category, and applies no break", () => {
    const paused = lanternsDone(untilBrothers(createLevel(DEFAULT_SETUP)));
    expect(
      validateDecision(paused, { choice: "break", commitment: "lanterns" })
    ).toEqual({
      ok: false,
      reason: "That work is already done or not in this plan.",
    });
    const after = decide(paused, { choice: "break", commitment: "lanterns" });
    expect(after.phase).toBe("brothers");
    expect(after.players.fred.presence).toBe("here");
    expect(after.returnsAt).toBeNull();
  });

  it("still accepts a break that promises a category with work left", () => {
    const paused = lanternsDone(untilBrothers(createLevel(DEFAULT_SETUP)));
    expect(
      validateDecision(paused, { choice: "break", commitment: "chairs" }).ok
    ).toBe(true);
    const away = decide(paused, { choice: "break", commitment: "chairs" });
    expect(away.players.fred.presence).toBe("away");
  });
});

describe("a full floor says why a press does nothing (round 8, S8)", () => {
  const raw: Item = { kind: "wings-raw", madeBy: null };
  const mac: Item = { kind: "mac", madeBy: null };
  const fullFloor = (state: GameState): GameState => ({
    ...state,
    floor: Array.from({ length: FLOOR_CAP }, (_, i) => ({
      x: 10 + i,
      y: 8,
      item: mac,
    })),
  });

  it("names the full floor, and does nothing, when open ground is faced", () => {
    // (2,4) has no station beside it, so the only tile in reach is the floor.
    const at = fullFloor(
      place(createLevel(DEFAULT_SETUP), "fred", 2, 4, [0, 1], raw)
    );
    expect(interactTile(at, "fred")).toBeNull();
    expect(getPrompt(at, "fred").interact).toBe(
      "The floor here is full. Find a station or a spot for it."
    );
    const after = stepGame(at, frameFor("fred", { interact: true })).state;
    expect(after.players.fred.holding).toEqual(raw);
    expect(after.floor.length).toBe(FLOOR_CAP);
  });

  it("keeps the blocked-station line in front of the full-floor reason", () => {
    const base = withStationItem(createLevel(DEFAULT_SETUP), 4, 3, {
      kind: "hotdogs-raw",
      madeBy: null,
    });
    const at = fullFloor(place(base, "fred", 4, 4, [0, 1], raw));
    expect(getPrompt(at, "fred").interact).toBe(
      "The GRILL is full. The floor here is full. Find a station or a spot for it."
    );
  });

  it("still offers the floor while there is room on it", () => {
    const at = place(createLevel(DEFAULT_SETUP), "fred", 2, 4, [0, 1], raw);
    expect(getPrompt(at, "fred").floorDrop).toEqual({
      note: null,
      action: "set the raw wings down on the floor here",
    });
  });
});

describe("the prompt during a phone call (round 8, S4)", () => {
  it("says who is on the phone and about how long is left, in wall-clock minutes", () => {
    const base = createLevel(DEFAULT_SETUP);
    const called = {
      ...base,
      players: {
        ...base.players,
        abbi: {
          ...base.players.abbi,
          busyFor: PHONE_SECONDS,
          busyReason: "What should we get you?",
        },
      },
    };
    expect(getPrompt(called, "abbi").status).toBe(
      "Abbi is on the phone (about 7 min left): What should we get you?"
    );
    const later = {
      ...called,
      players: {
        ...called.players,
        abbi: { ...called.players.abbi, busyFor: 1.5 },
      },
    };
    expect(getPrompt(later, "abbi").status).toBe(
      "Abbi is on the phone (about 4 min left): What should we get you?"
    );
  });

  it("counts the phone minutes on every tick at the clock's rate, never showing less than is left (round 12, task 3)", () => {
    for (const setup of [DEFAULT_SETUP, { ...DEFAULT_SETUP, relaxed: true }]) {
      const base = createLevel(setup);
      // The clock shows 7 wall-clock hours over the level's duration.
      const minutesPerSecond = (7 * 60) / base.duration;
      let state: GameState = {
        ...base,
        players: {
          ...base.players,
          abbi: {
            ...base.players.abbi,
            busyFor: PHONE_SECONDS,
            busyReason: "What should we get you?",
          },
        },
      };
      let ticks = 0;
      while (state.players.abbi.busyFor > 0) {
        const left = state.players.abbi.busyFor * minutesPerSecond;
        const match = /about (\d+) min left/.exec(
          getPrompt(state, "abbi").status
        );
        expect(match).not.toBeNull();
        const shown = Number(match?.[1]);
        // The contract: never less than is left, and never a whole minute over.
        expect(shown).toBeGreaterThanOrEqual(left - 1e-9);
        expect(shown - left).toBeLessThan(1);
        state = stepGame(state, IDLE_FRAME).state;
        ticks++;
      }
      expect(ticks).toBeGreaterThan(0);
    }
  });

  it("says about one minute while under a minute is left on the phone", () => {
    const base = createLevel(DEFAULT_SETUP);
    const almostDone = {
      ...base,
      players: {
        ...base.players,
        abbi: {
          ...base.players.abbi,
          busyFor: 0.1,
          busyReason: "What should we get you?",
        },
      },
    };
    expect(getPrompt(almostDone, "abbi").status).toBe(
      "Abbi is on the phone (about 1 min left): What should we get you?"
    );
  });

  it("keeps the shoe retie line as it is", () => {
    const base = createLevel(DEFAULT_SETUP);
    const retying = {
      ...base,
      players: {
        ...base.players,
        fred: {
          ...base.players.fred,
          busyFor: 0.6,
          busyReason: "Retying a shoelace.",
        },
      },
    };
    expect(getPrompt(retying, "fred").status).toBe("Fred: Retying a shoelace.");
  });
});

describe("the receipt's website lines (round 8, copy)", () => {
  it("says a blocked feature got calls through in plain words, not as a negation", () => {
    const receipt = computeReceipt(finishIdle(DEFAULT_SETUP, STAY_DECISION));
    const copy = JSON.stringify(receipt);
    expect(copy).toContain(
      "Registry scraper: not built, so 1 call got through."
    );
    expect(copy).not.toContain("No Registry");
    expect(copy).not.toContain("no promise to break");
  });
});

/** Sets the status of every target of each named kind, leaving the rest as they are. */
function withStatuses(
  state: GameState,
  statuses: Partial<Record<Target["kind"], Target["status"]>>
): GameState {
  return {
    ...state,
    targets: state.targets.map((t) => {
      const status = statuses[t.kind];
      return status ? { ...t, status } : t;
    }),
  };
}

/** The first station of a kind, with its tile. */
function stationOfKind(
  state: GameState,
  kind: GameState["stations"][number]["kind"]
): { x: number; y: number } {
  const station = state.stations.find((s) => s.kind === kind);
  if (!station) throw new Error(`no ${kind} in the venue`);
  return { x: station.x, y: station.y };
}

/** The open or filled state of one target, set by its tile for a test. */
function withTargetAt(
  state: GameState,
  x: number,
  y: number,
  patch: Partial<Target>
): GameState {
  return {
    ...state,
    targets: state.targets.map((t) =>
      t.x === x && t.y === y ? { ...t, ...patch } : t
    ),
  };
}

const ARRANGEMENT: Item = { kind: "arrangement", madeBy: null };
const ROSES: Item = { kind: "roses", madeBy: null };
const BURNT: Item = { kind: "burnt", madeBy: null };
const MAC: Item = { kind: "mac", madeBy: null };
const WINGS_RAW: Item = { kind: "wings-raw", madeBy: null };

describe("a refused press says why (round 9, task 1)", () => {
  const base = createLevel(DEFAULT_SETUP);

  it("names a filled chair spot when a stack is faced", () => {
    const filled = withTargetAt(base, 14, 5, {
      status: "filled",
      filled: [{ kind: "chairs", madeBy: null, count: 1 }],
    });
    const at = place(filled, "fred", 14, 4, [0, 1], {
      kind: "chairs",
      madeBy: null,
      count: 2,
    });
    expect(interactTile(at, "fred")).toBeNull();
    expect(getPrompt(at, "fred").interact).toBe(
      "This chair spot is already set."
    );
  });

  it("names a finished centerpiece table", () => {
    const done = withTargetAt(base, 4, 9, { status: "filled" });
    const at = place(done, "abbi", 4, 8, [0, 1], ARRANGEMENT);
    expect(getPrompt(at, "abbi").interact).toBe(
      "This table already has its centerpiece."
    );
  });

  it("says a simplified table was left bare on purpose, not that it is finished", () => {
    const bare = withTargetAt(base, 4, 9, { status: "simplified" });
    const at = place(bare, "abbi", 4, 8, [0, 1], ARRANGEMENT);
    expect(getPrompt(at, "abbi").interact).toBe(
      "This table was left bare on purpose."
    );
  });

  it("gives the bin's neighbour a turn when the bin has no line, so a faced grill speaks", () => {
    // Fred's body straddles the bin at (6,3) and the grill at (5,3).
    const at = placeExact(base, "fred", 6.1, 4.5, [0, -1], BURNT);
    expect(interactTile(at, "fred")).toBeNull();
    expect(getPrompt(at, "fred").interact).toBe(
      "The GRILL takes raw hot dogs or wings."
    );
  });

  it("names the held item when it faces a wall with room on the floor", () => {
    // (5,0) is the outer wall, so a press at (5,1) facing up lands nowhere.
    const at = place(base, "fred", 5, 1, [0, -1], ROSES);
    expect(interactTile(at, "fred")).toBeNull();
    expect(getPrompt(at, "fred").interact).toBe(
      "Nothing here takes the roses."
    );
  });

  it("gives no interact line for burnt food at the bin, since the hold prompt names it", () => {
    const at = place(base, "fred", 6, 2, [0, 1], BURNT);
    expect(interactTile(at, "fred")).toBeNull();
    expect(getPrompt(at, "fred").interact).toBeNull();
    expect(getPrompt(at, "fred").work).toBe(THROW_OUT_PROMPT);
  });

  it("names the arrangement an open table needs when roses are in hand", () => {
    const open = withTargetAt(base, 4, 7, { status: "open" });
    const at = place(open, "abbi", 4, 8, [0, -1], ROSES);
    expect(getPrompt(at, "abbi").interact).toBe(
      "This table needs a rose arrangement."
    );
  });

  it("names the same need with free hands, so the player knows what to bring", () => {
    const open = withTargetAt(base, 4, 7, { status: "open" });
    const at = place(open, "abbi", 4, 8, [0, -1]);
    expect(getPrompt(at, "abbi").interact).toBe(
      "This table needs a rose arrangement."
    );
  });

  it("names a spot the plan leaves out", () => {
    const left = withTargetAt(base, 7, 7, { status: "unplanned" });
    const at = place(left, "abbi", 7, 8, [0, -1], ARRANGEMENT);
    expect(getPrompt(at, "abbi").interact).toBe(
      "This spot is not in this plan."
    );
  });

  it("names a full station that is faced", () => {
    const busy = withStationItem(base, 4, 3, {
      kind: "hotdogs-raw",
      madeBy: null,
    });
    const at = place(busy, "fred", 4, 2, [0, 1], WINGS_RAW);
    expect(getPrompt(at, "fred").interact).toBe("The GRILL is full.");
  });

  it("says nothing here takes a carried item the station does not use", () => {
    const at = place(base, "fred", 8, 2, [0, 1], MAC);
    expect(getPrompt(at, "fred").interact).toBe(
      "Nothing here takes the mac and cheese."
    );
  });

  it("says nothing here takes a chair stack at the PETALS bucket too", () => {
    const petals = stationOfKind(base, "petals");
    const at = place(base, "fred", petals.x, petals.y - 1, [0, 1], {
      kind: "chairs",
      madeBy: null,
      count: 2,
    });
    expect(interactTile(at, "fred")).toBeNull();
    expect(getPrompt(at, "fred").interact).toBe(
      "Nothing here takes a stack of 2 chairs."
    );
  });

  it("gives a finished arrangement at the PETALS bucket the same table-or-basket line", () => {
    const petals = stationOfKind(base, "petals");
    const open = withStatuses(base, { table: "open", basket: "open" });
    const at = place(open, "fred", petals.x, petals.y - 1, [0, 1], ARRANGEMENT);
    expect(interactTile(at, "fred")).toBeNull();
    expect(getPrompt(at, "fred").interact).toBe(
      "Arrangements go on a centerpiece table or in the bouquet basket."
    );
  });

  it("says where an arrangement goes when both the table and the basket are open (round 12, task 2)", () => {
    const both = withStatuses(base, { table: "open", basket: "open" });
    const at = place(both, "fred", 8, 2, [0, 1], ARRANGEMENT);
    expect(interactTile(at, "fred")).toBeNull();
    expect(getPrompt(at, "fred").interact).toBe(
      "Arrangements go on a centerpiece table or in the bouquet basket."
    );
  });

  it("names only the table when just a centerpiece table is open", () => {
    const table = withStatuses(base, { table: "open", basket: "filled" });
    const at = place(table, "fred", 8, 2, [0, 1], ARRANGEMENT);
    expect(getPrompt(at, "fred").interact).toBe(
      "Arrangements go on a centerpiece table."
    );
  });

  it("names only the basket when just the bouquet basket is open", () => {
    const basket = withStatuses(base, { table: "filled", basket: "open" });
    const at = place(basket, "fred", 8, 2, [0, 1], ARRANGEMENT);
    expect(getPrompt(at, "fred").interact).toBe(
      "Arrangements go in the bouquet basket."
    );
  });

  it("gives a true line, with no target named, when neither is open", () => {
    const none = withStatuses(base, { table: "filled", basket: "filled" });
    const at = place(none, "fred", 8, 2, [0, 1], ARRANGEMENT);
    expect(getPrompt(at, "fred").interact).toBe(
      "No centerpiece table or bouquet basket needs an arrangement now."
    );
  });

  it("names an empty station when free hands face it", () => {
    const at = place(base, "fred", 8, 2, [0, 1]);
    expect(getPrompt(at, "fred").interact).toBe(
      "Nothing on the ARRANGE table to take."
    );
  });

  it("says what the bin takes when free hands face it, and leaves burnt food to the hold prompt", () => {
    const empty = place(base, "fred", 6, 2, [0, 1]);
    expect(getPrompt(empty, "fred").interact).toBe("The BIN takes burnt food.");
    const held = place(base, "fred", 6, 2, [0, 1], {
      kind: "burnt",
      madeBy: null,
    });
    expect(getPrompt(held, "fred").interact).toBeNull();
    expect(getPrompt(held, "fred").work).toBe(THROW_OUT_PROMPT);
    const roses = place(base, "fred", 6, 2, [0, 1], ROSES);
    expect(getPrompt(roses, "fred").interact).toBe(
      "The BIN only takes burnt food."
    );
    expect(getPrompt(roses, "fred").work).toBeNull();
  });

  it("names an empty crate when free hands face it", () => {
    const none = { ...base, stock: { ...base.stock, quinoa: 0 } };
    const at = place(none, "fred", 4, 2, [0, -1]);
    expect(getPrompt(at, "fred").interact).toBe("The QUIN crate is empty.");
  });

  it("names the item a crate hands out when another item is faced", () => {
    const at = place(base, "fred", 4, 2, [0, -1], ROSES);
    expect(getPrompt(at, "fred").interact).toBe(
      "The QUIN crate only takes the quinoa salad."
    );
  });

  it("names a loose item on the floor that blocks a drop", () => {
    const loose = {
      ...base,
      floor: [{ x: 2, y: 4, item: MAC }],
    };
    const at = place(loose, "fred", 2, 3, [0, 1], ROSES);
    expect(getPrompt(at, "fred").interact).toBe(
      "Something is already on the floor here."
    );
  });

  it("names the spot a buffet slot takes when roses are faced", () => {
    // (10,2) has no station beside it, so the press lands on the slot at (10,1).
    const at = place(base, "fred", 10, 2, [0, -1], ROSES);
    expect(getPrompt(at, "fred").interact).toBe(
      "This is the quinoa salad spot."
    );
  });

  it("says nothing for a plain tile with free hands, since nothing is refused", () => {
    const at = place(base, "fred", 2, 4, [0, 1]);
    expect(getPrompt(at, "fred").interact).toBeNull();
  });

  it("gives a reason for every press that does nothing across all faced tiles, and a prompt for every press that lands", () => {
    const cells: { x: number; y: number }[] = [];
    VENUE_MAP.forEach((row, y) =>
      [...row].forEach((char, x) => {
        if (WALKABLE_TILES.includes(char)) cells.push({ x, y });
      })
    );
    const held: (Item | null)[] = [
      null,
      ROSES,
      ARRANGEMENT,
      MAC,
      WINGS_RAW,
      { kind: "lantern", madeBy: null },
      { kind: "chairs", madeBy: null, count: 2 },
      { kind: "burnt", madeBy: null },
    ];
    const facings: [number, number][] = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];
    // The tiles a body faces, mirroring the engine's rule: the tile in front,
    // plus a side tile when the body's centre is within half a radius of a
    // boundary across its facing (a straddle).
    const facedTiles = (p: {
      x: number;
      y: number;
      facingX: number;
      facingY: number;
    }) => {
      const cx = Math.floor(p.x);
      const cy = Math.floor(p.y);
      const reach = PLAYER_RADIUS / 2;
      const tiles = [frontTile(p)];
      if (p.facingY !== 0) {
        if (p.x - cx < reach) tiles.push({ x: cx - 1, y: cy + p.facingY });
        if (cx + 1 - p.x < reach) tiles.push({ x: cx + 1, y: cy + p.facingY });
      } else {
        if (p.y - cy < reach) tiles.push({ x: cx + p.facingX, y: cy - 1 });
        if (cy + 1 - p.y < reach) tiles.push({ x: cx + p.facingX, y: cy + 1 });
      }
      return tiles;
    };
    fc.assert(
      fc.property(
        fc.constantFrom(...cells),
        fc.constantFrom(...facings),
        fc.constantFrom(...held),
        fc.double({ min: 0, max: 0.999, noNaN: true }),
        fc.double({ min: 0, max: 0.999, noNaN: true }),
        (cell, facing, item, dx, dy) => {
          // A body at the centre of its cell, or pushed toward a neighbour so
          // it straddles a boundary (dx and dy stay inside the cell).
          const at = placeExact(
            base,
            "fred",
            cell.x + dx,
            cell.y + dy,
            facing,
            item
          );
          const person = at.players.fred;
          const prompt = getPrompt(at, "fred").interact;
          const floorDrop = getPrompt(at, "fred").floorDrop;
          const onTile = (tile: { x: number; y: number }) =>
            [...at.supplies, ...at.stations, ...at.targets, ...at.floor].some(
              (entry) => entry.x === tile.x && entry.y === tile.y
            );
          const isBin = (tile: { x: number; y: number }) =>
            at.stations.some(
              (s) => s.kind === "bin" && s.x === tile.x && s.y === tile.y
            );
          // A floor drop is a hold, so its line is floorDrop, not interact.
          if (interactTile(at, "fred") !== null)
            return prompt !== null || floorDrop !== null;
          const faced = facedTiles(person);
          const held = person.holding;
          // A held item at the bin is the one exception: the hold prompt names it.
          const mustSpeak =
            faced.some((tile) => onTile(tile) && !(held && isBin(tile))) ||
            (held !== null && !faced.some(isBin));
          return mustSpeak ? prompt !== null : prompt === null;
        }
      ),
      { numRuns: 400 }
    );
  });

  it("lets the grill speak when burnt food straddles the grill and the bin", () => {
    // The property's shrunk counterexample: a body exactly on the boundary at
    // (6, 4) facing north faces the bin (6, 3) and the grill (5, 3).
    const at = placeExact(base, "fred", 6, 4, [0, -1], {
      kind: "burnt",
      madeBy: null,
    });
    expect(getPrompt(at, "fred").interact).not.toBeNull();
  });
});

describe("the prompt panel's people in solo (round 9, task 4)", () => {
  const base = createLevel(DEFAULT_SETUP);
  const called = {
    ...base,
    players: {
      ...base.players,
      abbi: {
        ...base.players.abbi,
        busyFor: PHONE_SECONDS,
        busyReason: "What should we get you?",
      },
    },
  };

  it("shows Abbi's frozen line to Fred when he is at the keys", () => {
    expect(shownPrompts(called, "fred")).toEqual(["fred", "abbi"]);
    expect(getPrompt(called, "abbi").status).toBe(
      "Abbi is on the phone (about 7 min left): What should we get you?"
    );
  });

  it("shows Abbi's frozen line to Abbi when she is at the keys", () => {
    expect(shownPrompts(called, "abbi")).toEqual(["abbi", "fred"]);
    expect(getPrompt(called, "abbi").status).toBe(
      "Abbi is on the phone (about 7 min left): What should we get you?"
    );
  });

  it("lists the idle partner too in solo, so the swap key is named (round 12, task 1)", () => {
    expect(shownPrompts(base, "fred")).toEqual(["fred", "abbi"]);
    expect(shownPrompts(base, "abbi")).toEqual(["abbi", "fred"]);
  });

  it("gives the idle partner a swap line with no buttons, named for him or her", () => {
    const fredWaiting = getPrompt(base, "fred", { waiting: true });
    expect(fredWaiting.status).toBe("Fred is waiting. Tab to switch to him.");
    expect(fredWaiting.interact).toBeNull();
    expect(fredWaiting.floorDrop).toBeNull();
    expect(fredWaiting.work).toBeNull();
    expect(getPrompt(base, "abbi", { waiting: true }).status).toBe(
      "Abbi is waiting. Tab to switch to her."
    );
  });

  it("says what an idle partner is carrying, so the swap is informed", () => {
    const withRoses = place(base, "fred", 2, 4, [0, 1], {
      kind: "roses",
      madeBy: null,
    });
    expect(getPrompt(withRoses, "fred", { waiting: true }).status).toBe(
      "Fred is waiting with the roses. Tab to switch to him."
    );
    const withChairs = place(base, "abbi", 2, 4, [0, 1], {
      kind: "chairs",
      madeBy: null,
      count: 2,
    });
    expect(getPrompt(withChairs, "abbi", { waiting: true }).status).toBe(
      "Abbi is waiting with a stack of 2 chairs. Tab to switch to her."
    );
  });

  it("keeps the active person's line and the away and phone lines for the partner", () => {
    expect(getPrompt(base, "abbi").status).toBe("Abbi has free hands.");
    expect(getPrompt(called, "abbi", { waiting: true }).status).toBe(
      "Abbi is on the phone (about 7 min left): What should we get you?"
    );
  });

  it("leaves a helper day's partner unlisted while idle, as before", () => {
    const helped = { ...base, setup: { ...base.setup, assist: true } };
    expect(shownPrompts(helped, "fred")).toEqual(["fred"]);
    expect(shownPrompts(helped, "abbi")).toEqual(["abbi"]);
    expect(getPrompt(helped, "abbi", { waiting: true }).status).toBe(
      "Abbi has free hands."
    );
  });

  it("keeps the helper's partner listed while he is out, on a helper day", () => {
    const away = {
      ...base,
      setup: { ...base.setup, assist: true },
      players: {
        ...base.players,
        fred: { ...base.players.fred, presence: "away" as const },
      },
    };
    expect(shownPrompts(away, "abbi")).toEqual(["abbi", "fred"]);
  });

  it("shows Fred as out to Abbi while he is away", () => {
    const away = {
      ...base,
      players: {
        ...base.players,
        fred: { ...base.players.fred, presence: "away" as const },
      },
    };
    expect(shownPrompts(away, "abbi")).toEqual(["abbi", "fred"]);
  });
});

describe("the venue's copy and the next-spot and floor-drop views (#1963)", () => {
  const roses: Item = { kind: "roses", madeBy: null };
  const hotdogs: Item = { kind: "hotdogs", madeBy: "abbi" };
  const chairs: Item = { kind: "chairs", madeBy: null, count: 2 };
  const lantern: Item = { kind: "lantern", madeBy: null };

  function stationOf(
    state: GameState,
    kind: "grill" | "arrange"
  ): { x: number; y: number } {
    const station = state.stations.find((s) => s.kind === kind);
    if (!station) throw new Error(`no ${kind} in the venue`);
    return station;
  }

  it("says cooked food goes on the buffet when it faces the empty grill", () => {
    const base = createLevel(DEFAULT_SETUP);
    const grill = stationOf(base, "grill");
    const at = place(base, "abbi", grill.x, grill.y + 1, [0, -1], hotdogs);
    expect(interactTile(at, "abbi")).toBeNull();
    expect(getPrompt(at, "abbi").interact).toBe(
      "Cooked food goes on the buffet, not back on the grill."
    );
  });

  it("keeps the raw-food reason for anything else the grill refuses", () => {
    const base = createLevel(DEFAULT_SETUP);
    const grill = stationOf(base, "grill");
    const at = place(base, "fred", grill.x, grill.y + 1, [0, -1], roses);
    expect(getPrompt(at, "fred").interact).toBe(
      "The GRILL takes raw hot dogs or wings."
    );
  });

  it("names a finished table as having its centerpiece", () => {
    const base = createLevel(DEFAULT_SETUP);
    const table = base.targets.find((t) => t.kind === "table");
    if (!table) throw new Error("no table in the venue");
    const done = {
      ...base,
      targets: base.targets.map((t) =>
        t === table ? { ...t, status: "filled" as const } : t
      ),
    };
    const at = place(done, "abbi", table.x, table.y + 1, [0, -1]);
    expect(getPrompt(at, "abbi").interact).toBe(
      "This table already has its centerpiece."
    );
  });

  it("points at the open chair spot nearest the person while carrying chairs", () => {
    const base = createLevel(DEFAULT_SETUP);
    const spots = base.targets.filter(
      (t) => t.kind === "chair-spot" && t.status === "open"
    );
    expect(spots.length).toBeGreaterThan(1);
    const spot = spots[1];
    const at = place(base, "fred", spot.x, spot.y, [0, 1], chairs);
    expect(nextSpotTile(at, "fred")).toEqual({ x: spot.x, y: spot.y });
    expect(nextSpotTile(at, "abbi")).toBeNull();
  });

  it("points at an open lantern hook while carrying a lantern, and at nothing otherwise", () => {
    const base = createLevel(DEFAULT_SETUP);
    const hook = base.targets.find(
      (t) => t.kind === "hook" && t.status === "open"
    );
    if (!hook) throw new Error("no open hook in the venue");
    const carrying = place(base, "abbi", hook.x, hook.y, [0, 1], lantern);
    expect(nextSpotTile(carrying, "abbi")).toEqual({ x: hook.x, y: hook.y });
    const empty = place(base, "abbi", hook.x, hook.y, [0, 1]);
    expect(nextSpotTile(empty, "abbi")).toBeNull();
    const roseHands = place(base, "abbi", hook.x, hook.y, [0, 1], roses);
    expect(nextSpotTile(roseHands, "abbi")).toBeNull();
  });

  it("names the plain floor a carried item would drop on, and nothing else", () => {
    const base = createLevel(DEFAULT_SETUP);
    const onFloor = place(base, "fred", 10, 4, [0, -1], roses);
    expect(floorDropTile(onFloor, "fred")).toEqual({ x: 10, y: 3 });
    expect(
      floorDropTile(place(base, "fred", 10, 4, [0, -1]), "fred")
    ).toBeNull();
    const arrange = stationOf(base, "arrange");
    const atArrange = place(
      base,
      "fred",
      arrange.x,
      arrange.y + 1,
      [0, -1],
      roses
    );
    expect(interactTile(atArrange, "fred")).toEqual({
      x: arrange.x,
      y: arrange.y,
    });
    expect(floorDropTile(atArrange, "fred")).toBeNull();
  });
});

describe("review fixes for the round 10 views and receipt (#1963)", () => {
  const chairs: Item = { kind: "chairs", madeBy: null, count: 2 };
  const hotdogs: Item = { kind: "hotdogs", madeBy: "abbi" };

  it("says cooked food goes on the buffet only while an open buffet spot wants it", () => {
    const base = createLevel(DEFAULT_SETUP);
    const grill = base.stations.find((s) => s.kind === "grill");
    if (!grill) throw new Error("no grill in the venue");
    const open = place(base, "abbi", grill.x, grill.y + 1, [0, -1], hotdogs);
    expect(getPrompt(open, "abbi").interact).toBe(
      "Cooked food goes on the buffet, not back on the grill."
    );
    const full = {
      ...base,
      targets: base.targets.map((t) =>
        t.kind === "buffet" && t.wants === "hotdogs"
          ? { ...t, status: "filled" as const }
          : t
      ),
    };
    const shut = place(full, "abbi", grill.x, grill.y + 1, [0, -1], hotdogs);
    expect(getPrompt(shut, "abbi").interact).toBe("These are cooked already.");
  });

  it("words the website calls: plural, singular and none, without a zero count", () => {
    const setup: Setup = {
      ...DEFAULT_SETUP,
      capabilities: ["faq", "registry"],
    };
    const done = finishIdle(setup, STAY_DECISION);
    const admin = (id: "parking-note" | "ceremony-time") => ({
      id,
      at: 10,
      player: "fred" as const,
      blockedBy: "admin" as const,
    });
    const two = computeReceipt({
      ...done,
      interruptions: [admin("parking-note"), admin("ceremony-time")],
    });
    expect(JSON.stringify(two)).toContain(
      "Admin page for Abbi: not built, so 2 calls got through."
    );
    const none = computeReceipt({ ...done, interruptions: [] });
    expect(JSON.stringify(none)).toContain(
      "Admin page for Abbi: no calls came in."
    );
    expect(JSON.stringify(none)).not.toContain("0 call");
  });

  describe("nextSpotTile", () => {
    /** Manhattan distance, the rule nextSpotTile uses. */
    const distance = (
      a: { x: number; y: number },
      b: { x: number; y: number }
    ) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

    it("skips a filled chair spot and a spot left bare, and takes the nearest open one", () => {
      const base = createLevel(DEFAULT_SETUP);
      const spots = base.targets.filter(
        (t) => t.kind === "chair-spot" && t.status === "open"
      );
      expect(spots.length).toBeGreaterThan(3);
      // The person stands on the nearest spot, which is then filled; the spot
      // beside it is left bare. The nearest open spot is among the rest.
      const [here, bare, ...rest] = spots;
      const state = {
        ...base,
        targets: base.targets.map((t) => {
          if (t === here) return { ...t, status: "filled" as const };
          if (t === bare) return { ...t, status: "simplified" as const };
          return t;
        }),
      };
      const at = place(state, "fred", here.x, here.y, [0, 1], chairs);
      const expected = rest.reduce((best, t) =>
        distance(t, here) < distance(best, here) ? t : best
      );
      expect(nextSpotTile(at, "fred")).toEqual({
        x: expected.x,
        y: expected.y,
      });
    });

    it("breaks a tie in favour of the spot listed first", () => {
      const base = createLevel(DEFAULT_SETUP);
      const spots = base.targets.filter(
        (t) => t.kind === "chair-spot" && t.status === "open"
      );
      const [first, second] = spots;
      const tied = {
        ...base,
        targets: base.targets.map((t) => {
          if (t === first) return { ...t, x: 5, y: 5 };
          if (t === second) return { ...t, x: 7, y: 5 };
          return t;
        }),
      };
      const at = {
        ...tied,
        players: {
          ...tied.players,
          fred: { ...tied.players.fred, x: 6.5, y: 5.5, holding: chairs },
        },
      };
      expect(nextSpotTile(at, "fred")).toEqual({ x: 5, y: 5 });
    });
  });
});

describe("prompts and refusals for the round 11 playtest (ADR 0060 amendment)", () => {
  it("a stack of two chairs says one press places one chair", () => {
    const spot = createLevel(DEFAULT_SETUP).targets.find(
      (t) => t.kind === "chair-spot" && t.status === "open"
    );
    expect(spot).toBeDefined();
    if (!spot) return;
    const stack: Item = { kind: "chairs", madeBy: null, count: 2 };
    const at = place(
      createLevel(DEFAULT_SETUP),
      "abbi",
      spot.x,
      spot.y + 1,
      [0, -1],
      stack
    );
    expect(getPrompt(at, "abbi").interact).toBe(
      "Place a chair (1 more in the stack)"
    );
    const placed = press(at, "abbi").state;
    expect(placed.players.abbi.holding).toEqual({
      kind: "chairs",
      madeBy: null,
      count: 1,
    });
  });

  it("burnt food refused anywhere but the bin names the bin", () => {
    const burnt: Item = { kind: "burnt", madeBy: null };
    const base = createLevel(DEFAULT_SETUP);
    const at = place(base, "fred", 10, 4, [0, -1], burnt);
    const blocked = {
      ...at,
      floor: [{ x: 10, y: 3, item: ROSES }],
    };
    expect(getPrompt(blocked, "fred").interact).toBe(
      "Burnt food goes in the BIN."
    );
  });

  it("burnt food facing the bin gets the hold line, not a refusal", () => {
    const bin = createLevel(DEFAULT_SETUP).stations.find(
      (s) => s.kind === "bin"
    );
    expect(bin).toBeDefined();
    if (!bin) return;
    const at = place(
      createLevel(DEFAULT_SETUP),
      "fred",
      bin.x,
      bin.y + 1,
      [0, -1],
      {
        kind: "burnt",
        madeBy: null,
      }
    );
    const prompt = getPrompt(at, "fred");
    expect(prompt.interact).toBeNull();
    expect(prompt.work).toBe(THROW_OUT_PROMPT);
  });

  it("names the keys: E or Enter by person in co-op, either set solo", () => {
    expect(interactKeyName("fred", true)).toBe("E");
    expect(interactKeyName("abbi", true)).toBe("Enter");
    expect(interactKeyName("fred", false)).toBe("E or Enter");
    expect(interactKeyName("abbi", false)).toBe("E or Enter");
    expect(workKeyName("fred", true)).toBe("F");
    expect(workKeyName("abbi", true)).toBe("Shift");
    expect(workKeyName("fred", false)).toBe("F or Shift");
    expect(workKeyName("abbi", false)).toBe("F or Shift");
  });

  it("a hold in progress when the brothers text opens does not drop after the dialog closes", () => {
    const brothersAt = untilBrothers(createLevel(DEFAULT_SETUP)).brothersAt;
    if (brothersAt === null) throw new Error("the brothers text comes");
    let state = createLevel(DEFAULT_SETUP);
    // Start the hold six ticks before the text, so it is still running when it opens.
    while (state.time + 6 * TICK_SECONDS < brothersAt)
      state = stepGame(state, IDLE_FRAME).state;
    state = place(state, "abbi", 10, 4, [0, -1], ROSES);
    let sawHold = false;
    for (let i = 0; i < 20 && state.phase === "playing"; i++) {
      const frame = frameFor("abbi", {
        interact: i === 0,
        interactHeld: true,
      });
      state = stepGame(state, frame).state;
      if (state.players.abbi.floorHold !== null) sawHold = true;
    }
    expect(sawHold).toBe(true);
    expect(state.phase).toBe("brothers");
    expect(state.players.abbi.floorHold).toBeNull();
    state = decide(state, { choice: "stay", commitment: null });
    state = run(state, IDLE_FRAME, FLOOR_HOLD_TICKS).state;
    expect(state.floor).toEqual([]);
    expect(state.players.abbi.holding).toEqual(ROSES);
  });

  it("the coach names the work key for each person and mode", () => {
    const withTable = withStation(createLevel(DEFAULT_SETUP), 8, 3, {
      kind: "roses",
      madeBy: null,
    });
    expect(getHint(withTable, "fred", { coop: true })).toBe(
      "Stand at the ARRANGE table and hold F to arrange the roses."
    );
    expect(getHint(withTable, "fred")).toBe(
      "Stand at the ARRANGE table and hold F or Shift to arrange the roses."
    );
    const burnt = place(createLevel(DEFAULT_SETUP), "abbi", 2, 2, [0, 1], {
      kind: "burnt",
      madeBy: null,
    });
    expect(getHint(burnt, "abbi", { coop: true })).toBe(
      "Carry the burnt food to the BIN and hold Shift there to throw it out."
    );
  });
});

describe("solid chair spots (ADR 0060 amendment, 2026-10-12)", () => {
  /**
   * Fred stands on the floor just right of the chair spot at (17, 5), facing
   * left. A second of walking left would carry him well past the tile edge.
   */
  const beside = (holding: Item | null = null) =>
    place(createLevel(DEFAULT_SETUP), "fred", 18, 5, [-1, 0], holding);
  const spotAt = (state: GameState) =>
    state.targets.find((t) => t.x === 17 && t.y === 5);

  it("a person walking left into an empty chair spot stays on the floor and faces it", () => {
    const { state } = run(beside(), frameFor("fred", { moveX: -1 }), ticks(30));
    expect(state.players.fred.x).toBeGreaterThanOrEqual(
      18 + PLAYER_RADIUS - 1e-6
    );
    expect(state.players.fred.y).toBeCloseTo(5.5, 5);
    expect(state.players.fred.facingX).toBe(-1);
    expect(frontTile(state.players.fred)).toEqual({ x: 17, y: 5 });
    expect(spotAt(state)?.kind).toBe("chair-spot");
    expect(spotAt(state)?.status).toBe("open");
  });

  it("a chair can then be placed on the spot the person faces", () => {
    const held: Item = { kind: "chairs", madeBy: null, count: 2 };
    const walked = run(
      beside(held),
      frameFor("fred", { moveX: -1 }),
      ticks(30)
    ).state;
    const placed = press(walked, "fred").state;
    expect(spotAt(placed)?.status).toBe("filled");
    expect(placed.players.fred.holding).toEqual({
      kind: "chairs",
      madeBy: null,
      count: 1,
    });
  });
});
