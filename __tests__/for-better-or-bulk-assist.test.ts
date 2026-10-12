// @vitest-environment node
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  ASSIST_LINE,
  DEFAULT_SETUP,
  FLOOR_CAP,
  FLOOR_HOLD_TICKS,
  VENUE_MAP,
  WALKABLE_TILES,
  validateSetup,
  LEAVE_SECONDS,
  MOVE_SPEED,
  TICK_SECONDS,
  assistInput,
  assistJob,
  assistRests,
  computeReceipt,
  createLevel,
  frontTile,
  getHint,
  IDLE_INPUT,
  interactTile,
  replayLevel,
  stepGame,
  type CapabilityId,
  type Frame,
  type GameState,
  type ItemKind,
  type PlayerId,
  type PlayerInput,
  type Item,
  type PresenceDecision,
  type Setup,
  type StationKind,
} from "@/lib/for-better-or-bulk";
import { buildFrame } from "@/components/for-better-or-bulk/input";

const NO_INPUT: PlayerInput = {
  moveX: 0,
  moveY: 0,
  interact: false,
  interactHeld: false,
  work: false,
};

const ASSIST_SETUP: Setup = { ...DEFAULT_SETUP, assist: true };
const STAY: PresenceDecision = { choice: "stay", commitment: null };

/** Puts a person on the centre of a tile, facing a way, with the given hands. */
function place(
  state: GameState,
  id: PlayerId,
  x: number,
  y: number,
  facing: readonly [number, number],
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

/** Puts a person at an exact position in tiles, so a body can stand off a tile centre. */
function placeAt(
  state: GameState,
  id: PlayerId,
  x: number,
  y: number,
  facing: readonly [number, number],
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

/** A level where the only stock left is lanterns, so the fetch order is clear. */
function onlyLanterns(setup: Setup): GameState {
  const state = createLevel(setup);
  return {
    ...state,
    stock: {
      roses: 0,
      "hotdogs-raw": 0,
      "wings-raw": 0,
      mac: 0,
      quinoa: 0,
      lantern: 4,
      chairs: 0,
    },
  };
}

function tickOf(state: GameState, tick: number): GameState {
  return { ...state, tick };
}

/**
 * Records one placement by `id` on the first target. The helper reads who
 * placed what from `filledBy` alone, so this opens its gate for the other
 * person without changing what the target holds.
 */
function withPlacedBy(state: GameState, id: PlayerId): GameState {
  const [first, ...rest] = state.targets;
  return {
    ...state,
    targets: [{ ...first, filledBy: [...first.filledBy, id] }, ...rest],
  };
}

/** Marks the targets wanting each listed item open, and every other target filled. */
function setOpen(state: GameState, open: readonly ItemKind[]): GameState {
  return {
    ...state,
    targets: state.targets.map((t) =>
      open.includes(t.wants)
        ? { ...t, status: "open" as const, filled: [], filledBy: [] }
        : { ...t, status: "filled" as const }
    ),
  };
}

/** Every tile that already holds a station, crate, target or dropped item. */
function occupiedTiles(state: GameState): Set<string> {
  const taken = new Set<string>();
  for (const tile of [
    ...state.stations,
    ...state.targets,
    ...state.supplies,
    ...state.floor,
  ]) {
    taken.add(`${tile.x},${tile.y}`);
  }
  return taken;
}

/** Stands a person on a free walkable tile beside a tile, facing it. */
function facingTile(
  state: GameState,
  id: PlayerId,
  target: { readonly x: number; readonly y: number },
  holding: Item | null
): GameState {
  const taken = occupiedTiles(state);
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const x = target.x - dx;
    const y = target.y - dy;
    const ground = VENUE_MAP[y]?.[x] ?? "#";
    if (!WALKABLE_TILES.includes(ground) || taken.has(`${x},${y}`)) continue;
    return place(state, id, x, y, [dx, dy], holding);
  }
  throw new Error(`no free tile beside ${target.x},${target.y}`);
}

/** The first plain floor tile with nothing on it, and one free tile beside it. */
function freeFloorTiles(
  state: GameState,
  count: number
): { x: number; y: number }[] {
  const taken = occupiedTiles(state);
  const found: { x: number; y: number }[] = [];
  for (let y = 0; y < VENUE_MAP.length && found.length < count; y++) {
    for (
      let x = 0;
      x < (VENUE_MAP[y]?.length ?? 0) && found.length < count;
      x++
    ) {
      if (VENUE_MAP[y][x] !== "." || taken.has(`${x},${y}`)) continue;
      if (found.some((f) => f.x === x && f.y === y)) continue;
      found.push({ x, y });
    }
  }
  return found;
}

function stationOf(state: GameState, kind: StationKind) {
  const station = state.stations.find((s) => s.kind === kind);
  if (!station) throw new Error(`no ${kind} station`);
  return station;
}

const ROSES: Item = { kind: "roses", madeBy: null };
const FACINGS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

describe("assistInput on fixed states", () => {
  it("takes the roses from the crate it faces", () => {
    const state = place(createLevel(ASSIST_SETUP), "abbi", 2, 4, [-1, 0]);
    expect(assistInput(state, "abbi")).toEqual({
      moveX: 0,
      moveY: 0,
      interact: true,
      interactHeld: true,
      work: false,
    });
  });

  it("turns toward a crate it is not facing, without walking into it", () => {
    const state = place(createLevel(ASSIST_SETUP), "abbi", 2, 4, [0, -1]);
    expect(assistInput(state, "abbi")).toEqual({
      ...NO_INPUT,
      moveX: -1,
    });
  });

  it("lines up on the tile centre before walking across it", () => {
    // Abbi stands 0.2 above the centre of tile (4, 6), with a lantern crate
    // two tiles to the left, so the first step is left and she centres first.
    const base = onlyLanterns(ASSIST_SETUP);
    const state = {
      ...place(base, "abbi", 4, 6, [0, -1]),
      players: {
        ...base.players,
        abbi: { ...base.players.abbi, x: 4.5, y: 6.3, facingX: 0, facingY: -1 },
      },
    };
    expect(assistInput(state, "abbi")).toEqual({
      ...NO_INPUT,
      moveY: 1,
    });
  });

  it("puts the roses down on a free ARRANGE table it faces", () => {
    const state = place(createLevel(ASSIST_SETUP), "abbi", 9, 4, [0, -1], {
      kind: "roses",
      madeBy: null,
    });
    expect(assistInput(state, "abbi")).toEqual({
      ...NO_INPUT,
      interact: true,
      interactHeld: true,
    });
  });

  it("holds work at a table that has roses on it", () => {
    const base = createLevel(ASSIST_SETUP);
    const state = {
      ...place(base, "abbi", 9, 4, [0, -1]),
      stations: base.stations.map((s) =>
        s.kind === "arrange"
          ? { ...s, item: { kind: "roses" as ItemKind, madeBy: null } }
          : s
      ),
    };
    expect(assistInput(state, "abbi")).toEqual({ ...NO_INPUT, work: true });
  });

  it("keeps holding work on its off ticks, so a bin or table is not reset", () => {
    const base = createLevel(ASSIST_SETUP);
    const state = tickOf(
      {
        ...place(base, "abbi", 9, 4, [0, -1]),
        stations: base.stations.map((s) =>
          s.kind === "arrange"
            ? { ...s, item: { kind: "roses" as ItemKind, madeBy: null } }
            : s
        ),
      },
      3
    );
    expect(assistInput(state, "abbi")).toEqual({ ...NO_INPUT, work: true });
  });

  it("waits on the off ticks of its pace before it moves or presses", () => {
    const state = tickOf(
      place(createLevel(ASSIST_SETUP), "abbi", 2, 4, [-1, 0]),
      3
    );
    expect(assistInput(state, "abbi")).toEqual(NO_INPUT);
  });

  it("is deterministic: the same state gives the same input", () => {
    const state = place(createLevel(ASSIST_SETUP), "abbi", 10, 5, [0, -1]);
    expect(assistInput(state, "abbi")).toEqual(assistInput(state, "abbi"));
  });

  it("never answers the brothers or returns anything but four controls", () => {
    const state = place(createLevel(ASSIST_SETUP), "abbi", 10, 5, [0, -1]);
    expect(Object.keys(assistInput(state, "abbi")).sort()).toEqual([
      "interact",
      "interactHeld",
      "moveX",
      "moveY",
      "work",
    ]);
  });

  it("does nothing for Fred while he is out", () => {
    const base = createLevel(ASSIST_SETUP);
    const state = {
      ...place(base, "fred", 2, 4, [-1, 0]),
      players: {
        ...base.players,
        fred: {
          ...place(base, "fred", 2, 4, [-1, 0]).players.fred,
          presence: "away" as const,
        },
      },
    };
    expect(assistInput(state, "fred")).toEqual(NO_INPUT);
  });

  it("does nothing for someone on a phone call or re-tying shoes", () => {
    const base = place(createLevel(ASSIST_SETUP), "abbi", 2, 4, [-1, 0]);
    const busy = {
      ...base,
      players: {
        ...base.players,
        abbi: { ...base.players.abbi, busyFor: 2, busyReason: "On a call." },
      },
    };
    expect(assistInput(busy, "abbi")).toEqual(NO_INPUT);
  });
});

/** Runs a frame list through stepGame, starting from a fresh level. */
function playFrames(setup: Setup, frames: readonly Frame[]): GameState {
  return playFramesFrom(createLevel(setup), frames);
}

/** Runs a frame list through stepGame from the given state. */
function playFramesFrom(start: GameState, frames: readonly Frame[]): GameState {
  return frames.reduce((state, frame) => stepGame(state, frame).state, start);
}

const idleFrame = (assisted?: PlayerId): Frame => ({
  inputs: { fred: NO_INPUT, abbi: NO_INPUT },
  ...(assisted ? { assisted } : {}),
});

describe("the assist in stepGame", () => {
  it("does nothing when the setup leaves the assist off, even if the frame names a partner", () => {
    const start = createLevel(DEFAULT_SETUP);
    const end = playFrames(DEFAULT_SETUP, Array(60).fill(idleFrame("abbi")));
    expect(end.players.abbi.x).toBe(start.players.abbi.x);
    expect(end.players.abbi.y).toBe(start.players.abbi.y);
  });

  it("moves the idle partner once the player has placed something", () => {
    const start = withPlacedBy(createLevel(ASSIST_SETUP), "fred");
    const end = playFramesFrom(start, Array(60).fill(idleFrame("abbi")));
    const moved =
      end.players.abbi.x !== start.players.abbi.x ||
      end.players.abbi.y !== start.players.abbi.y;
    expect(moved).toBe(true);
  });

  it("keeps the helper still while the player has placed nothing", () => {
    const start = createLevel(ASSIST_SETUP);
    const end = playFramesFrom(start, Array(300).fill(idleFrame("abbi")));
    expect(end.players.abbi.x).toBe(start.players.abbi.x);
    expect(end.players.abbi.y).toBe(start.players.abbi.y);
    expect(end.assistTicks).toBe(0);
  });

  it("does not act when the frame does not name the partner", () => {
    const start = createLevel(ASSIST_SETUP);
    const end = playFrames(ASSIST_SETUP, Array(60).fill(idleFrame()));
    expect(end.players.abbi.x).toBe(start.players.abbi.x);
    expect(end.players.abbi.y).toBe(start.players.abbi.y);
  });

  it("lets a person's own keys win over the assist", () => {
    const frame: Frame = {
      inputs: { fred: NO_INPUT, abbi: { ...NO_INPUT, moveX: 1 } },
      assisted: "abbi",
    };
    const start = createLevel(ASSIST_SETUP);
    const next = stepGame(start, frame).state;
    expect(next.players.abbi.x - start.players.abbi.x).toBeCloseTo(
      MOVE_SPEED * TICK_SECONDS,
      10
    );
  });

  it("never answers the brothers' text: the clock stands still until a decision", () => {
    let state = createLevel(ASSIST_SETUP);
    let guard = 0;
    while (state.phase === "playing" && guard++ < 10000)
      state = stepGame(state, idleFrame("abbi")).state;
    expect(state.phase).toBe("brothers");
    const time = state.time;
    for (let i = 0; i < 90; i++)
      state = stepGame(state, idleFrame("abbi")).state;
    expect(state.phase).toBe("brothers");
    expect(state.time).toBe(time);
    expect(state.presence).toBeNull();
  });

  it("never moves Fred while he is away, whatever the frames name", () => {
    let state = createLevel(ASSIST_SETUP);
    let guard = 0;
    while (state.phase === "playing" && guard++ < 10000)
      state = stepGame(state, idleFrame("fred")).state;
    state = stepGame(state, {
      ...idleFrame("fred"),
      decision: { choice: "leave", commitment: null },
    }).state;
    expect(state.players.fred.presence).toBe("away");
    const { x, y, holding } = state.players.fred;
    let observed = 0;
    for (let i = 0; i < Math.round(LEAVE_SECONDS / TICK_SECONDS); i++) {
      if (state.players.fred.presence !== "away") break;
      state = stepGame(state, idleFrame("fred")).state;
      const fred = state.players.fred;
      if (fred.presence !== "away") break;
      observed++;
      expect(fred.x).toBe(x);
      expect(fred.y).toBe(y);
      expect(fred.holding).toEqual(holding);
    }
    expect(observed).toBeGreaterThan(0);
  });

  it("never moves Fred on a break either", () => {
    let state = createLevel(ASSIST_SETUP);
    let guard = 0;
    while (state.phase === "playing" && guard++ < 10000)
      state = stepGame(state, idleFrame("fred")).state;
    state = stepGame(state, {
      ...idleFrame("fred"),
      decision: { choice: "break", commitment: "chairs" },
    }).state;
    const { x, y } = state.players.fred;
    for (let i = 0; i < 300 && state.players.fred.presence === "away"; i++) {
      state = stepGame(state, idleFrame("fred")).state;
      if (state.players.fred.presence === "away") {
        expect(state.players.fred.x).toBe(x);
        expect(state.players.fred.y).toBe(y);
      }
    }
  });

  it("shows the receipt line only when the helper actually acted", () => {
    expect(computeReceipt(createLevel(ASSIST_SETUP)).assist).toBeNull();
    expect(computeReceipt(playOut(ASSIST_SETUP)).assist).toBeNull();
    expect(computeReceipt(playOut(ASSIST_SETUP, "abbi")).assist).toBeNull();
    const helped = playOut(
      ASSIST_SETUP,
      "abbi",
      NO_INPUT,
      withPlacedBy(createLevel(ASSIST_SETUP), "fred")
    );
    expect(helped.assistTicks).toBeGreaterThan(0);
    expect(computeReceipt(helped).assist).toBe(ASSIST_LINE);
    // A fact, not a verdict, since a helper day can end unfinished (round 16).
    expect(ASSIST_LINE).toBe("A helper kept the other lane going.");
  });
});

/**
 * Plays a level to its end with Fred idle or on the given input, Abbi idle
 * unless the assist is named, and the brothers answered with a stay.
 */
function playOut(
  setup: Setup,
  assisted?: PlayerId,
  fred: PlayerInput = NO_INPUT,
  start: GameState = createLevel(setup)
): GameState {
  let state = start;
  let guard = 0;
  while (state.phase !== "done" && guard++ < 40000) {
    const frame: Frame = {
      inputs: { fred, abbi: NO_INPUT },
      ...(assisted ? { assisted } : {}),
      ...(state.phase === "brothers" ? { decision: STAY } : {}),
    };
    state = stepGame(state, frame).state;
  }
  return state;
}

/**
 * Plays a solo level with Fred on the assist's own pace, 40% of ticks (2 in 7
 * on relaxed), and Abbi as the helper. Fred places items at that pace, so the
 * helper acts on the ticks Fred leaves open.
 */
function pacedSolo(setup: Setup): GameState {
  let state = createLevel(setup);
  let guard = 0;
  while (state.phase !== "done" && guard++ < 40000) {
    const frame: Frame = {
      inputs: { fred: assistInput(state, "fred"), abbi: NO_INPUT },
      assisted: "abbi",
      ...(state.phase === "brothers" ? { decision: STAY } : {}),
    };
    state = stepGame(state, frame).state;
  }
  return state;
}

/** Items placed on targets by the end of a run where Fred stays idle. */
function idleSoloPlaced(assist: boolean): number {
  let state = createLevel({ ...DEFAULT_SETUP, assist });
  let guard = 0;
  while (state.phase !== "done" && guard++ < 20000) {
    const frame: Frame = {
      ...idleFrame("abbi"),
      ...(state.phase === "brothers" ? { decision: STAY } : {}),
    };
    state = stepGame(state, frame).state;
  }
  return state.targets.reduce((sum, t) => sum + t.filled.length, 0);
}

describe("the balance of an idle solo run", () => {
  it("places nothing with the helper on, because an idle player has placed nothing", () => {
    expect(idleSoloPlaced(false)).toBe(0);
    expect(idleSoloPlaced(true)).toBe(0);
  });
});

const CAPABILITY_PAIRS: readonly (readonly [CapabilityId, CapabilityId])[] = [
  ["faq", "admin"],
  ["faq", "registry"],
  ["admin", "intro3d"],
  ["registry", "intro3d"],
];

const setupArb: fc.Arbitrary<Setup> = fc
  .record({
    pair: fc.constantFrom(...CAPABILITY_PAIRS),
    roses: fc.constantFrom("modest" as const, "full" as const, "yes" as const),
    lanterns: fc.boolean(),
  })
  .map(({ pair, roses, lanterns }) => ({
    capabilities: [...pair],
    cart: { roses, food: "enough" as const, lanterns },
    relaxed: false,
    assist: true,
  }));

const decisionArb: fc.Arbitrary<PresenceDecision | undefined> = fc.option(
  fc.record({
    choice: fc.constantFrom("stay", "break", "leave"),
    commitment: fc.constantFrom(
      null,
      "chairs" as const,
      "lanterns" as const,
      "buffet" as const,
      "flowers" as const
    ),
  }) as fc.Arbitrary<PresenceDecision>,
  { nil: undefined }
);

const inputArb: fc.Arbitrary<PlayerInput> = fc.record({
  moveX: fc.constantFrom(-1, 0, 1),
  moveY: fc.constantFrom(-1, 0, 1),
  interact: fc.boolean(),
  interactHeld: fc.boolean(),
  work: fc.boolean(),
});

/** One step per record: the active person presses, the partner is assisted. */
const frameArb: fc.Arbitrary<Frame> = fc
  .record({
    active: fc.constantFrom("fred" as const, "abbi" as const),
    input: inputArb,
    decision: decisionArb,
  })
  .map(({ active, input, decision }) => {
    const other: PlayerId = active === "fred" ? "abbi" : "fred";
    return {
      inputs: { [active]: input, [other]: NO_INPUT } as Record<
        PlayerId,
        PlayerInput
      >,
      assisted: other,
      ...(decision ? { decision } : {}),
    };
  });

describe("assisted runs replay exactly (property)", () => {
  it("two replays of the same assisted run give the same receipt", () => {
    fc.assert(
      fc.property(
        setupArb,
        fc.array(frameArb, { maxLength: 900 }),
        (setup, frames) => {
          const first = replayLevel(setup, frames, { mode: "lenient" });
          const second = replayLevel(setup, frames, { mode: "lenient" });
          const receipt = computeReceipt(first.state);
          expect(computeReceipt(second.state)).toEqual(receipt);
          expect(receipt.assist).toBe(
            first.state.assistTicks > 0 ? ASSIST_LINE : null
          );
        }
      ),
      { numRuns: 30 }
    );
  });

  it("a lenient run with the dropped decisions removed replays strictly to the same receipt", () => {
    fc.assert(
      fc.property(
        setupArb,
        fc.array(frameArb, { maxLength: 900 }),
        (setup, frames) => {
          const lenient = replayLevel(setup, frames, { mode: "lenient" });
          const dropped = new Set(lenient.dropped.map((d) => d.frame));
          const cleaned: Frame[] = frames.map((frame, index) =>
            dropped.has(index)
              ? { inputs: frame.inputs, assisted: frame.assisted }
              : frame
          );
          const strict = replayLevel(setup, cleaned);
          expect(computeReceipt(strict.state)).toEqual(
            computeReceipt(lenient.state)
          );
        }
      ),
      { numRuns: 20 }
    );
  });
});

describe("the cabinet marks the assisted person", () => {
  it("names the person not at the keyboard in solo play", () => {
    const none = new Set<string>();
    expect(buildFrame(none, none, none, "solo", "fred").assisted).toBe("abbi");
    expect(buildFrame(none, none, none, "solo", "abbi").assisted).toBe("fred");
  });

  it("never names an assisted person in co-op play", () => {
    const none = new Set<string>();
    expect(buildFrame(none, none, none, "coop", "fred")).not.toHaveProperty(
      "assisted"
    );
  });
});

describe("assist setting validation", () => {
  it("accepts a setup saved before the helper existed", () => {
    const { assist: _assist, ...legacy } = DEFAULT_SETUP;
    void _assist;
    expect(validateSetup(legacy).ok).toBe(true);
  });
});

describe("the rose gate, shared with getHint", () => {
  it("with only PETALS open and ARRANGE free, the helper does not put roses on ARRANGE", () => {
    const base = setOpen(createLevel(ASSIST_SETUP), ["petals"]);
    const state = facingTile(base, "abbi", stationOf(base, "arrange"), ROSES);
    expect(getHint(state, "abbi")).toBe(
      "Carry the roses to the PETALS bucket."
    );
    const input = assistInput(state, "abbi");
    expect(input.interact).toBe(false);
    expect(input.moveX !== 0 || input.moveY !== 0).toBe(true);
  });

  it("with only PETALS open and a free bucket in front, the helper puts the roses down there", () => {
    const base = setOpen(createLevel(ASSIST_SETUP), ["petals"]);
    const state = facingTile(base, "abbi", stationOf(base, "petals"), ROSES);
    expect(assistInput(state, "abbi")).toEqual({
      ...NO_INPUT,
      interact: true,
      interactHeld: true,
    });
  });

  it("with no rose target open, the helper does not put held roses on a free ARRANGE table", () => {
    const base = setOpen(createLevel(ASSIST_SETUP), ["lantern"]);
    const state = facingTile(base, "abbi", stationOf(base, "arrange"), ROSES);
    expect(getHint(state, "abbi")).toBe(
      "Put the roses down somewhere out of the way."
    );
    expect(assistInput(state, "abbi").interact).toBe(false);
  });

  it("with PETALS open but both rose stations busy, the helper holds its roses", () => {
    const base = setOpen(createLevel(ASSIST_SETUP), ["petals"]);
    const busy = {
      ...base,
      stations: base.stations.map((s) =>
        s.kind === "arrange" || s.kind === "petals"
          ? { ...s, item: { kind: "roses" as const, madeBy: null } }
          : s
      ),
    };
    const state = facingTile(busy, "abbi", stationOf(busy, "arrange"), ROSES);
    expect(getHint(state, "abbi")).toBe("Wait for the PETALS bucket to clear.");
    expect(assistInput(state, "abbi")).toEqual(NO_INPUT);
  });

  it("with no rose target open, the helper leaves the rose crate alone", () => {
    const base = setOpen(createLevel(ASSIST_SETUP), ["lantern"]);
    const crate = base.supplies.find((s) => s.kind === "roses");
    if (!crate) throw new Error("no rose crate");
    const facing = facingTile(base, "abbi", crate, null);
    expect(assistInput(facing, "abbi").interact).toBe(false);
  });

  it("a solo run with only PETALS open never puts roses on ARRANGE", () => {
    let state = withPlacedBy(
      setOpen(createLevel(ASSIST_SETUP), ["petals"]),
      "fred"
    );
    state = {
      ...state,
      players: {
        ...state.players,
        abbi: { ...state.players.abbi, holding: ROSES },
      },
    };
    const arrangeEverHeld = new Set<string>();
    const petalsEverHeld = new Set<string>();
    for (let i = 0; i < 400 && state.phase !== "done"; i++) {
      state = stepGame(state, {
        inputs: { fred: NO_INPUT, abbi: NO_INPUT },
        assisted: "abbi",
      }).state;
      for (const s of state.stations) {
        if (s.item === null) continue;
        if (s.kind === "arrange") arrangeEverHeld.add(s.id);
        if (s.kind === "petals") petalsEverHeld.add(s.id);
      }
    }
    expect(arrangeEverHeld.size).toBe(0);
    expect(petalsEverHeld.size).toBeGreaterThan(0);
  });
});

describe("what the helper fetches and what it puts down", () => {
  it("leaves cooked food on the grill when no open target wants it", () => {
    const base = setOpen(createLevel(ASSIST_SETUP), ["lantern"]);
    const grill = base.stations.find((s) => s.kind === "grill");
    if (!grill) throw new Error("no grill");
    let state: GameState = {
      ...base,
      stations: base.stations.map((s) =>
        s.id === grill.id
          ? { ...s, item: { kind: "hotdogs" as const, madeBy: null } }
          : s
      ),
    };
    const held = new Set<string>();
    for (let i = 0; i < 300; i++) {
      state = stepGame(state, {
        inputs: { fred: NO_INPUT, abbi: NO_INPUT },
        assisted: "abbi",
      }).state;
      if (state.players.abbi.holding) held.add(state.players.abbi.holding.kind);
    }
    expect(held.has("hotdogs")).toBe(false);
  });

  it("puts down an unwanted item on the floor instead of holding it for good", () => {
    const base = withPlacedBy(
      setOpen(createLevel(ASSIST_SETUP), ["lantern"]),
      "fred"
    );
    let state: GameState = {
      ...base,
      players: {
        ...base.players,
        abbi: {
          ...base.players.abbi,
          holding: { kind: "hotdogs", madeBy: null },
        },
      },
    };
    let maxFloor = 0;
    for (let i = 0; i < 600; i++) {
      state = stepGame(state, {
        inputs: { fred: NO_INPUT, abbi: NO_INPUT },
        assisted: "abbi",
      }).state;
      maxFloor = Math.max(maxFloor, state.floor.length);
    }
    // The hot dogs are down on the floor; the free hands go on to a lantern
    // that an open target does want.
    expect(state.players.abbi.holding?.kind).not.toBe("hotdogs");
    expect(state.floor.map((f) => f.item.kind)).toEqual(["hotdogs"]);
    expect(maxFloor).toBeLessThanOrEqual(FLOOR_CAP);
  });

  it("does not pick up floor roses that no open place can take", () => {
    const base = setOpen(createLevel(ASSIST_SETUP), ["lantern"]);
    const [spot] = freeFloorTiles(base, 1);
    const state0: GameState = {
      ...base,
      floor: [{ x: spot.x, y: spot.y, item: ROSES }],
    };
    let state = state0;
    const everHeld = new Set<string>();
    for (let i = 0; i < 600; i++) {
      state = stepGame(state, {
        inputs: { fred: NO_INPUT, abbi: NO_INPUT },
        assisted: "abbi",
      }).state;
      if (state.players.abbi.holding)
        everHeld.add(state.players.abbi.holding.kind);
    }
    expect(everHeld.has("roses")).toBe(false);
    expect(state.floor.length).toBeLessThanOrEqual(FLOOR_CAP);
  });

  it("with the floor full, an unwanted item goes back in its own crate", () => {
    const base = withPlacedBy(
      setOpen(createLevel(ASSIST_SETUP), ["lantern"]),
      "fred"
    );
    const spots = freeFloorTiles(base, FLOOR_CAP);
    const full: GameState = {
      ...base,
      floor: spots.map((s) => ({
        x: s.x,
        y: s.y,
        item: { kind: "mac" as const, madeBy: null },
      })),
      players: {
        ...base.players,
        abbi: { ...base.players.abbi, holding: ROSES },
      },
    };
    const stockBefore = full.stock.roses;
    let state = full;
    for (let i = 0; i < 600 && state.players.abbi.holding; i++) {
      state = stepGame(state, {
        inputs: { fred: NO_INPUT, abbi: NO_INPUT },
        assisted: "abbi",
      }).state;
    }
    expect(state.players.abbi.holding).toBeNull();
    expect(state.stock.roses).toBe(stockBefore + 1);
    expect(state.floor.length).toBe(FLOOR_CAP);
  });

  it("picks up a floor item that an open target wants when it faces it", () => {
    const base = setOpen(createLevel(ASSIST_SETUP), ["lantern"]);
    const [spot] = freeFloorTiles(base, 1);
    const withItem: GameState = {
      ...base,
      floor: [
        { x: spot.x, y: spot.y, item: { kind: "lantern", madeBy: null } },
      ],
    };
    const state = facingTile(withItem, "abbi", spot, null);
    expect(assistInput(state, "abbi")).toEqual({
      ...NO_INPUT,
      interact: true,
      interactHeld: true,
    });
  });
});

describe("the assist's pace", () => {
  it("walks only on its active ticks, so a walk toward a crate waits on the rest", () => {
    const base = onlyLanterns(ASSIST_SETUP);
    const state = {
      ...place(base, "abbi", 4, 6, [0, -1]),
      players: {
        ...base.players,
        abbi: { ...base.players.abbi, x: 4.5, y: 6.5, facingX: 0, facingY: -1 },
      },
    };
    expect(assistInput(tickOf(state, 0), "abbi")).toEqual({
      ...NO_INPUT,
      moveX: -1,
    });
    expect(assistInput(tickOf(state, 3), "abbi")).toEqual(NO_INPUT);
  });

  it("crafts arrangements at about 40% of the full pace", () => {
    const ticksToCraft = (assisted: boolean): number => {
      const base = withPlacedBy(createLevel(ASSIST_SETUP), "fred");
      const table = stationOf(base, "arrange");
      const loaded: GameState = {
        ...base,
        stations: base.stations.map((s) =>
          s.id === table.id ? { ...s, item: ROSES } : s
        ),
      };
      let state = facingTile(loaded, "abbi", table, null);
      let ticks = 0;
      while (
        stationOf(state, "arrange").item?.kind !== "arrangement" &&
        ticks++ < 2000
      ) {
        const frame: Frame = {
          inputs: {
            fred: NO_INPUT,
            abbi: assisted ? NO_INPUT : { ...NO_INPUT, work: true },
          },
          ...(assisted ? { assisted: "abbi" as const } : {}),
        };
        state = stepGame(state, frame).state;
      }
      return ticks;
    };
    const full = ticksToCraft(false);
    const paced = ticksToCraft(true);
    // Two active ticks in every five: the same work takes 5 / 2 = 2.5 times as long.
    expect(paced / full).toBeGreaterThan(2.3);
    expect(paced / full).toBeLessThan(2.7);
  });
});

describe("the assisted receipt and replay, in full", () => {
  it("a strict replay of a helper day, with the player placing items, reproduces the final state (#1931)", () => {
    let state = createLevel(ASSIST_SETUP);
    const frames: Frame[] = [];
    let guard = 0;
    while (state.phase !== "done" && guard++ < 40000) {
      const frame: Frame = {
        inputs: { fred: assistInput(state, "fred"), abbi: NO_INPUT },
        assisted: "abbi",
        ...(state.phase === "brothers" ? { decision: STAY } : {}),
      };
      frames.push(frame);
      state = stepGame(state, frame).state;
    }
    const placedBy = (who: PlayerId) =>
      state.targets.reduce(
        (n, t) => n + t.filledBy.filter((w) => w === who).length,
        0
      );
    expect(placedBy("fred")).toBeGreaterThan(0);
    expect(placedBy("abbi")).toBeGreaterThan(0);
    expect(state.assistTicks).toBeGreaterThan(0);
    const replay = replayLevel(ASSIST_SETUP, frames, { mode: "strict" });
    expect(replay.dropped).toEqual([]);
    expect(replay.state).toEqual(state);
  });

  it("credits the helper's placements as helper work and the player's as theirs (#1933)", () => {
    let state = createLevel(ASSIST_SETUP);
    const frames: Frame[] = [];
    let guard = 0;
    while (state.phase !== "done" && guard++ < 40000) {
      const frame: Frame = {
        inputs: { fred: assistInput(state, "fred"), abbi: NO_INPUT },
        assisted: "abbi",
        ...(state.phase === "brothers" ? { decision: STAY } : {}),
      };
      frames.push(frame);
      state = stepGame(state, frame).state;
    }
    const placements = state.targets.flatMap((t) =>
      t.filledBy.map((by, i) => ({ by, helper: t.filledByHelper[i] === true }))
    );
    const helped = placements.filter((p) => p.helper);
    expect(helped.length).toBeGreaterThan(0);
    expect(helped.every((p) => p.by === "abbi")).toBe(true);
    expect(placements.some((p) => !p.helper && p.by === "fred")).toBe(true);
    const detail = computeReceipt(state)
      .readiness.flatMap((l) => l.conditions.map((c) => c.detail))
      .join(" | ");
    expect(detail).toContain("Abbi (helper) carried");
    expect(detail).toContain("Fred carried");
    expect(detail).not.toContain("Fred (helper)");
    // The provenance is part of the state, so a strict replay reproduces it.
    const replay = replayLevel(ASSIST_SETUP, frames, { mode: "strict" });
    expect(replay.state.targets.map((t) => t.filledByHelper)).toEqual(
      state.targets.map((t) => t.filledByHelper)
    );
  });

  it("a lenient replay keeps the assisted partner on the frame with a stray decision", () => {
    let state = createLevel(ASSIST_SETUP);
    const frames: Frame[] = [];
    let guard = 0;
    while (state.phase !== "done" && guard++ < 40000) {
      const stray = frames.length === 0;
      const frame: Frame = {
        inputs: { fred: NO_INPUT, abbi: NO_INPUT },
        assisted: "abbi",
        ...(stray || state.phase === "brothers" ? { decision: STAY } : {}),
      };
      frames.push(frame);
      state = stepGame(state, frame).state;
    }
    const replay = replayLevel(ASSIST_SETUP, frames, { mode: "lenient" });
    expect(replay.dropped.map((d) => d.frame)).toEqual([0]);
    expect(state.assistTicks).toBe(0);
    expect(replay.state).toEqual(state);
  });
});

describe("the solo balance, scripted", () => {
  /** Fred as a steady full-pace player: the helper's goal policy with the pace removed, pressing interact on each new press. */
  function scriptedFred(
    state: GameState,
    last: { value: boolean }
  ): PlayerInput {
    const input = assistInput({ ...state, tick: 0 }, "fred");
    const interact = input.interact && !last.value;
    last.value = input.interact;
    return { ...input, interact };
  }

  /** Plays a solo level with the scripted Fred, and Abbi either idle or assisted. */
  function scriptedSolo(setup: Setup, assisted: boolean) {
    let state = createLevel(setup);
    const last = { value: false };
    let guard = 0;
    while (state.phase !== "done" && guard++ < 40000) {
      const frame: Frame = {
        inputs: { fred: scriptedFred(state, last), abbi: NO_INPUT },
        ...(assisted ? { assisted: "abbi" as const } : {}),
        ...(state.phase === "brothers" ? { decision: STAY } : {}),
      };
      state = stepGame(state, frame).state;
    }
    const placedBy = (who: PlayerId) =>
      state.targets.reduce(
        (n, t) => n + t.filledBy.filter((w) => w === who).length,
        0
      );
    const fred = placedBy("fred");
    const abbi = placedBy("abbi");
    return {
      placed: fred + abbi,
      fred,
      abbi,
      finish: state.finishedAt ?? state.time,
    };
  }

  it("with a working player the helper places fewer items than they do, and finishes the day sooner", () => {
    for (const seed of [0, 4242, 12345]) {
      for (const relaxed of [false, true]) {
        const setup: Setup = { ...DEFAULT_SETUP, seed, relaxed };
        const solo = scriptedSolo(setup, false);
        const helped = scriptedSolo({ ...setup, assist: true }, true);
        const label = `seed ${seed}, relaxed ${relaxed}`;
        // Measured after #1948 (chairs two to a carry), for seeds 0, 4242 and
        // 12345: the helper saves 33.9 to 41.6 s on the standard clock and
        // 7.6 s on the relaxed clock. Each margin is about half the smallest
        // saving, rounded down: 16 s standard, 3 s relaxed.
        const margin = relaxed ? 3 : 16;
        expect(helped.abbi, label).toBeGreaterThan(0);
        expect(helped.abbi, label).toBeLessThanOrEqual(helped.fred);
        expect(helped.finish + margin, label).toBeLessThan(solo.finish);
      }
    }
  }, 120000);

  it("an idle player with the helper on leaves most targets open, on both difficulties", () => {
    for (const seed of [0, 4242, 12345]) {
      for (const relaxed of [false, true]) {
        for (const helped of ["abbi", "fred"] as const) {
          const label = `seed ${seed}, relaxed ${relaxed}, helper for ${helped}`;
          const state = playOut({ ...ASSIST_SETUP, relaxed, seed }, helped);
          const helperPlaced = state.targets.reduce(
            (n, t) => n + t.filledBy.filter((w) => w === helped).length,
            0
          );
          const open = state.targets.filter((t) => t.status === "open").length;
          expect(helperPlaced, label).toBe(0);
          expect(open, label).toBeGreaterThan(state.targets.length / 2);
        }
      }
    }
  }, 120000);

  it("an assisted solo run finishes well before an unassisted one", () => {
    const off = scriptedSolo(DEFAULT_SETUP, false);
    const on = scriptedSolo(ASSIST_SETUP, true);
    expect(on.placed).toBeGreaterThanOrEqual(off.placed);
    expect(on.finish + 20).toBeLessThan(off.finish);
  }, 60000);
});

describe("the helper's own grill batch", () => {
  it("never leaves its batch to burn on relaxed at 40% pace (#1931)", () => {
    for (const seed of [0, 12345, 4242]) {
      const state = pacedSolo({ ...ASSIST_SETUP, relaxed: true, seed });
      const label = `seed ${seed}`;
      expect(state.burntBatches, label).toBe(0);
      expect(state.finishedAt, label).not.toBeNull();
    }
  }, 60000);

  it("says when it starts at zero, and that it has caught up later (rounds 16 and 17)", () => {
    const base = createLevel(ASSIST_SETUP);
    expect(assistJob(base, "abbi")).toBe(
      "Abbi starts helping after Fred places the first item."
    );
    const [first, second] = base.targets;
    const even: GameState = {
      ...base,
      targets: base.targets.map((t) =>
        t.id === first.id
          ? { ...t, filledBy: ["fred"] }
          : t.id === second.id
            ? { ...t, filledBy: ["abbi"] }
            : t
      ),
    };
    expect(assistJob(even, "abbi")).toBe(
      "Abbi has placed as many items as Fred, and helps again after Fred's next one."
    );
  });

  it("waits on the other person, not idly, while they still carry something (round 19, D-3)", () => {
    const base = createLevel(ASSIST_SETUP);
    const stock = Object.fromEntries(
      Object.keys(base.stock).map((kind) => [kind, 0])
    ) as GameState["stock"];
    const done: GameState = {
      ...base,
      stock,
      targets: base.targets.map((t) => ({
        ...t,
        status: "filled" as const,
        filledBy: ["fred"],
      })),
    };
    expect(assistJob(done, "abbi")).toBe(
      "Abbi has nothing useful to do right now."
    );
    const carrying: GameState = {
      ...done,
      players: {
        ...done.players,
        fred: {
          ...done.players.fred,
          holding: { kind: "chairs", madeBy: null, count: 1 },
        },
      },
    };
    expect(assistJob(carrying, "abbi")).toBe(
      "Abbi is waiting for Fred to set down what's in hand."
    );
  });

  it("says it is waiting for its own raw batch to cook, and does not wander off", () => {
    const base = createLevel(ASSIST_SETUP);
    const grill = base.stations.find((s) => s.kind === "grill");
    expect(grill).toBeDefined();
    const state: GameState = {
      ...base,
      stations: base.stations.map((s) =>
        s.id === grill?.id
          ? { ...s, item: { kind: "hotdogs-raw", madeBy: "abbi" }, progress: 0 }
          : s
      ),
    };
    expect(assistJob(state, "abbi")).toMatch(
      /^Abbi is waiting for .+ to cook\.$/
    );
    expect(assistInput(state, "abbi").interact).toBe(false);
  });
});

describe("the helper keeps out of its partner's way", () => {
  const ARRANGEMENT: Item = { kind: "arrangement", madeBy: "abbi" };

  it("skips a place its partner faces when another place is open", () => {
    const base = setOpen(createLevel(ASSIST_SETUP), ["arrangement"]);
    const open = base.targets.filter((t) => t.status === "open");
    const [first] = open;
    expect(open.length).toBeGreaterThanOrEqual(2);
    const solo = facingTile(base, "abbi", first, ARRANGEMENT);
    expect(assistInput(solo, "abbi").interact).toBe(true);
    const shared = facingTile(solo, "fred", first, null);
    expect(
      assistInput(
        { ...shared, players: { ...shared.players, abbi: solo.players.abbi } },
        "abbi"
      ).interact
    ).toBe(false);
  });

  it("still places into a shared place when nothing else is open, so it never stalls", () => {
    const base = setOpen(createLevel(ASSIST_SETUP), ["arrangement"]);
    const [only] = base.targets.filter((t) => t.status === "open");
    const others = base.targets.map((t) =>
      t.id === only.id || t.status !== "open"
        ? t
        : { ...t, status: "filled" as const }
    );
    const alone = { ...base, targets: others };
    const solo = facingTile(alone, "abbi", only, ARRANGEMENT);
    const shared = facingTile(solo, "fred", only, null);
    expect(
      assistInput(
        { ...shared, players: { ...shared.players, abbi: solo.players.abbi } },
        "abbi"
      ).interact
    ).toBe(true);
  });

  it("names its goal in the status line", () => {
    const base = withPlacedBy(
      setOpen(createLevel(ASSIST_SETUP), ["arrangement"]),
      "fred"
    );
    const state = facingTile(base, "abbi", base.targets[0], ARRANGEMENT);
    expect(assistJob(state, "abbi")).toMatch(/^Abbi is carrying /);
    expect(assistJob(state, "abbi")).toMatch(/\.$/);
    const away = {
      ...state,
      players: {
        ...state.players,
        abbi: { ...state.players.abbi, presence: "away" as const },
      },
    };
    expect(assistJob(away, "abbi")).toBe("Abbi is away for now.");
  });
});

describe("the helper's claimed tiles follow the rules the sim uses (round 8, S3)", () => {
  it("does not plan a press on a grill that a straddling partner presses on", () => {
    // Abbi stands at x 3.9 facing down with empty hands: her own tile (3,3) is
    // empty floor, but the body reaches the cooked batch on the grill at (4,3),
    // so her press takes from there. Fred stands in front of that same grill
    // with empty hands and would take the batch too, unless he keeps out of it.
    const base = createLevel(ASSIST_SETUP);
    const withBatch = {
      ...base,
      stations: base.stations.map((s) =>
        s.x === 4 && s.y === 3
          ? { ...s, item: { kind: "hotdogs" as const, madeBy: null } }
          : s
      ),
    };
    const state = placeAt(
      place(withBatch, "fred", 4, 2, [0, 1]),
      "abbi",
      3.9,
      2.5,
      [0, 1]
    );
    expect(interactTile(state, "abbi")).toEqual({ x: 4, y: 3 });
    expect(interactTile(state, "fred")).toEqual({ x: 4, y: 3 });
    expect(assistInput(state, "fred").interact).toBe(false);
  });
});

describe("the helper's presses land where the engine resolves them", () => {
  const HELD: (Item | null)[] = [
    null,
    { kind: "roses", madeBy: null },
    { kind: "hotdogs-raw", madeBy: null },
    { kind: "wings-raw", madeBy: null },
    { kind: "arrangement", madeBy: "fred" },
    { kind: "burnt", madeBy: null },
    { kind: "mac", madeBy: null },
    { kind: "petals", madeBy: null },
  ];
  const base = createLevel(ASSIST_SETUP);
  const worlds: [string, GameState][] = [
    ["the base venue", base],
    [
      "every hot-dog buffet target filled",
      {
        ...base,
        targets: base.targets.map((t) =>
          t.wants === "hotdogs" ? { ...t, status: "filled" as const } : t
        ),
      },
    ],
    [
      "every rose target filled",
      {
        ...base,
        targets: base.targets.map((t) =>
          t.wants === "arrangement" || t.wants === "petals"
            ? { ...t, status: "filled" as const }
            : t
        ),
      },
    ],
    [
      "the grill busy with someone else's batch",
      {
        ...base,
        stations: base.stations.map((s) =>
          s.kind === "grill"
            ? { ...s, item: { kind: "hotdogs-raw", madeBy: "abbi" } }
            : s
        ),
      },
    ],
  ];

  it("over a grid of positions, facings and held items, the tile a planned press acts on is the tile the engine resolves", () => {
    let presses = 0;
    for (const [name, world] of worlds) {
      for (let y = 0; y < VENUE_MAP.length; y++) {
        for (let x = 0; x < VENUE_MAP[y].length; x++) {
          if (!WALKABLE_TILES.includes(VENUE_MAP[y][x])) continue;
          for (const facing of FACINGS) {
            for (const item of HELD) {
              const state = place(world, "fred", x, y, facing, item);
              if (!assistInput(state, "fred").interact) continue;
              presses++;
              const label = `${name}: at ${x},${y} facing ${facing.join(",")} holding ${item?.kind ?? "nothing"}`;
              expect(interactTile(state, "fred"), label).toEqual(
                frontTile(state.players.fred)
              );
            }
          }
        }
      }
    }
    expect(presses).toBeGreaterThan(100);
  });

  it("lines up on the tile centre before it presses, from a spot 0.3 off centre", () => {
    // Standing 0.3 off the centre across the facing, the body is not where the
    // planner assumed. The helper walks to the centre first, and then presses.
    const state = placeAt(
      createLevel(ASSIST_SETUP),
      "fred",
      5.8,
      4.5,
      [0, -1],
      { kind: "wings-raw", madeBy: null }
    );
    const input = assistInput(state, "fred");
    expect(input.interact).toBe(false);
    expect(input.moveX).toBe(-1);
  });

  it("presses only from a tile centre, so the press lands where the planner says from any spot in the tile", () => {
    const OFFSETS = [0.1, 0.25, 0.3, 0.4, 0.6, 0.75, 0.9];
    const base = createLevel(ASSIST_SETUP);
    const worlds: GameState[] = [
      base,
      {
        ...base,
        stations: base.stations.map((s) =>
          s.kind === "grill"
            ? { ...s, item: { kind: "hotdogs-raw", madeBy: "abbi" } }
            : s
        ),
      },
    ];
    let presses = 0;
    for (const world of worlds) {
      for (let y = 0; y < VENUE_MAP.length; y++) {
        for (let x = 0; x < VENUE_MAP[y].length; x++) {
          if (!WALKABLE_TILES.includes(VENUE_MAP[y][x])) continue;
          for (const facing of FACINGS) {
            for (const item of [
              null,
              ROSES,
              { kind: "wings-raw" as const, madeBy: null },
            ]) {
              const centred = place(world, "fred", x, y, facing, item);
              if (!assistInput(centred, "fred").interact) continue;
              presses++;
              const predicted = frontTile(centred.players.fred);
              for (const offset of OFFSETS) {
                const moved = placeAt(
                  world,
                  "fred",
                  facing[0] === 0 ? x + offset : x + 0.5,
                  facing[0] === 0 ? y + 0.5 : y + offset,
                  facing,
                  item
                );
                const input = assistInput(moved, "fred");
                const label = `at ${x},${y} +${offset} facing ${facing.join(",")} holding ${item?.kind ?? "nothing"}`;
                if (input.interact) {
                  expect(interactTile(moved, "fred"), label).toEqual(predicted);
                }
                if (Math.abs(offset - 0.5) > 0.08) {
                  expect(input.interact, label).toBe(false);
                }
              }
            }
          }
        }
      }
    }
    expect(presses).toBeGreaterThan(10);
  });
});

describe("the helper's floor drop is a hold (ADR 0060 amendment)", () => {
  it("presses E, keeps it down through the hold, and drops after exactly FLOOR_HOLD_TICKS active ticks", () => {
    const base = createLevel(ASSIST_SETUP);
    // Every target is out of the plan, so the only place for the roses is the
    // floor. One filled spot makes it Fred's turn ahead, so the helper may act.
    const [first, ...rest] = base.targets;
    if (!first) throw new Error("the venue has targets");
    const crowded: GameState = {
      ...base,
      targets: [
        { ...first, filledBy: ["fred"] },
        ...rest.map((t) => ({ ...t, status: "unplanned" as const })),
      ],
    };
    let state = place(crowded, "abbi", 10, 4, [0, -1], {
      kind: "roses",
      madeBy: null,
    });
    // The hold's ticks are the press and every later tick until the drop. The
    // helper paces them: a resting tick keeps E down but does not count.
    let activeHoldTicks = 0;
    let dropped = false;
    for (let tick = 0; tick < 900 && !dropped; tick++) {
      const active = !assistRests(state.tick + 1, state.setup.relaxed);
      const next = stepGame(state, {
        inputs: { fred: IDLE_INPUT, abbi: IDLE_INPUT },
        assisted: "abbi",
      }).state;
      const inHold =
        state.players.abbi.floorHold !== null ||
        next.players.abbi.floorHold !== null;
      if (inHold && active) activeHoldTicks++;
      dropped = next.players.abbi.holding === null;
      state = next;
    }
    expect(dropped).toBe(true);
    expect(state.floor.some((f) => f.item.kind === "roses")).toBe(true);
    expect(activeHoldTicks).toBe(FLOOR_HOLD_TICKS);
  });
});
