// @vitest-environment node
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  ASSIST_LINE,
  DEFAULT_SETUP,
  validateSetup,
  LEAVE_SECONDS,
  MOVE_SPEED,
  TICK_SECONDS,
  assistInput,
  computeReceipt,
  createLevel,
  replayLevel,
  stepGame,
  type CapabilityId,
  type Frame,
  type GameState,
  type Item,
  type ItemKind,
  type PlayerId,
  type PlayerInput,
  type PresenceDecision,
  type Setup,
} from "@/lib/for-better-or-bulk";
import { buildFrame } from "@/components/for-better-or-bulk/input";

const NO_INPUT: PlayerInput = {
  moveX: 0,
  moveY: 0,
  interact: false,
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

describe("assistInput on fixed states", () => {
  it("takes the roses from the crate it faces", () => {
    const state = place(createLevel(ASSIST_SETUP), "abbi", 2, 4, [-1, 0]);
    expect(assistInput(state, "abbi")).toEqual({
      moveX: 0,
      moveY: 0,
      interact: true,
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
  return frames.reduce(
    (state, frame) => stepGame(state, frame).state,
    createLevel(setup)
  );
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

  it("moves the idle partner when the setup and the frame both ask for it", () => {
    const start = createLevel(ASSIST_SETUP);
    const end = playFrames(ASSIST_SETUP, Array(60).fill(idleFrame("abbi")));
    const moved =
      end.players.abbi.x !== start.players.abbi.x ||
      end.players.abbi.y !== start.players.abbi.y;
    expect(moved).toBe(true);
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

  it("adds the honest receipt line only when the helper was on", () => {
    expect(computeReceipt(createLevel(ASSIST_SETUP)).assist).toBe(ASSIST_LINE);
    expect(computeReceipt(createLevel(DEFAULT_SETUP)).assist).toBeNull();
  });
});

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
  it("places more items with the assist on than with it off", () => {
    const off = idleSoloPlaced(false);
    const on = idleSoloPlaced(true);
    expect(off).toBe(0);
    expect(on).toBeGreaterThan(off);
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
          expect(receipt.assist).toBe(ASSIST_LINE);
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
