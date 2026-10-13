import { fromAny } from "@total-typescript/shoehorn";
// Monkey C Mayhem stage themes (#1993): the pool, open water and basement
// gym art, the Tri Suit and water foes, the swim pose, the LENGTH readout and
// the manual's new rules.
import { describe, it, expect } from "vitest";
import {
  createInitialState,
  startGame,
  type BonusRoom,
  type GameEngineState,
} from "@/lib/garmin-engine";
import {
  EMPTY_COURSE,
  PX_PER_METER,
  stageStartX,
  type CourseCeiling,
  type CourseCurrent,
} from "@/lib/garmin-course";
import { EMPTY_PROPS, type CourseBelt } from "@/lib/garmin-props";
import { FOE_SIZE, type Foe, type FoeKind } from "@/lib/garmin-foes";
import type { Pickup } from "@/lib/garmin-powerups";
import { STAGE_THEMES, themeForStage } from "@/lib/garmin-themes";
import {
  THEME_PALETTE,
  lengthCount,
  renderWatchFace,
  runnerPose,
  swimPose,
  themeOf,
} from "@/components/garmin-watch/watch-face-art";
import { GAME_MANUALS } from "@/lib/game-manuals";

interface Recorded {
  /** Every drawing call by name, in order. */
  calls: string[];
  /** Every fillStyle and strokeStyle assigned, as "key:value". */
  styles: string[];
  /** Every string drawn with fillText. */
  texts: string[];
}

/** A recording 2D context: what was drawn, in what colour and what text. */
function recordingCtx() {
  const rec: Recorded = { calls: [], styles: [], texts: [] };
  const target: Record<string, unknown> = {
    font: "10px monospace",
    textAlign: "start",
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    globalAlpha: 1,
  };
  const gradient = { addColorStop: () => undefined };
  const ctx = fromAny<CanvasRenderingContext2D, unknown>(
    new Proxy(target, {
      get(t, key) {
        if (typeof key !== "string") return undefined;
        if (key in t) return t[key];
        if (key === "fillText") {
          return (value: string) => {
            rec.texts.push(value);
            rec.calls.push(key);
          };
        }
        if (key === "measureText") {
          return (value: string) => ({ width: value.length * 6 });
        }
        if (key === "createLinearGradient" || key === "createRadialGradient") {
          return () => {
            rec.calls.push(key);
            return gradient;
          };
        }
        return () => {
          rec.calls.push(key);
        };
      },
      set(t, key, value) {
        t[key as string] = value;
        if (key === "fillStyle" || key === "strokeStyle") {
          rec.styles.push(`${key}:${String(value)}`);
        }
        return true;
      },
    })
  );
  return { ctx, rec };
}

/** Renders `state` and returns what was drawn. */
function draw(state: GameEngineState): Recorded {
  const { ctx, rec } = recordingCtx();
  renderWatchFace(ctx, state);
  return rec;
}

/** A running state on `stage`, `metresIn` metres past that stage's start. */
function onStage(
  stage: number,
  metresIn = 0,
  over: Partial<GameEngineState> = {}
): GameEngineState {
  const base = startGame(createInitialState("fenix", 0), "fenix");
  return {
    ...base,
    stage,
    distanceMeters: stageStartX(stage) / PX_PER_METER + metresIn,
    obstacles: [],
    ...over,
  };
}

/** World pixel x that lands `screenX` on the canvas for `state`. */
function worldX(state: GameEngineState, screenX: number): number {
  return state.distanceMeters * PX_PER_METER + screenX;
}

function foeOf(kind: FoeKind, x: number, y: number): Foe {
  const size = FOE_SIZE[kind];
  return {
    id: 1,
    kind,
    mode: "drift",
    x,
    y,
    width: size.width,
    height: size.height,
    vx: -0.35,
    vy: 0,
    timerMs: 0,
    hp: 1,
    graceMs: 0,
    phase: 0,
  };
}

const BONUS_ROOM: BonusRoom = {
  returnCourse: EMPTY_COURSE,
  returnProps: EMPTY_PROPS,
  returnFoes: [],
  returnPickups: [],
  exitX: 0,
  endX: 1000,
};

describe("stage themes on the face", () => {
  it("has a palette for every stage theme, with the pool and gym colours", () => {
    for (const theme of STAGE_THEMES) {
      expect(THEME_PALETTE[theme]).toBeDefined();
    }
    expect(THEME_PALETTE.pool.ground).toBe("#0c4a6e");
    expect(THEME_PALETTE.pool.accent).toBe("#67e8f9");
    expect(THEME_PALETTE["open-water"].accent).toBe("#2dd4bf");
    expect(THEME_PALETTE["basement-gym"].accent).toBe("#fb7185");
    expect(THEME_PALETTE.track.accent).toBe("#22d3ee");
  });

  it("uses the bonus room's track art inside a water stage's bonus room", () => {
    expect(themeOf(onStage(2))).toBe("pool");
    expect(themeOf(onStage(4))).toBe("open-water");
    expect(themeOf(onStage(2, 0, { bonusRoom: BONUS_ROOM }))).toBe("track");
    expect(themeOf({ stage: undefined, bonusRoom: null })).toBe("track");
    expect(themeForStage(3)).toBe("basement-gym");
  });

  it("renders every theme, on the run and inside a bonus room, without throwing", () => {
    for (let stage = 1; stage <= 5; stage++) {
      const rec = draw(onStage(stage, 12));
      expect(rec.calls.length).toBeGreaterThan(0);
    }
    expect(
      draw(onStage(2, 4, { bonusRoom: BONUS_ROOM })).calls.length
    ).toBeGreaterThan(0);
  });

  it("draws the pool's lane ropes in the water column", () => {
    const pool = draw(onStage(2));
    expect(pool.styles).toContain("fillStyle:rgba(255, 255, 255, 0.25)");
    expect(pool.styles).toContain("fillStyle:#0c4a6e");
    const track = draw(onStage(1));
    expect(track.styles).not.toContain("fillStyle:rgba(255, 255, 255, 0.25)");
  });

  it("draws the gym's ceiling beams and fluorescent strips, not the moon", () => {
    const gym = draw(onStage(3));
    expect(gym.styles).toContain("fillStyle:rgba(254, 249, 195, 0.5)");
    expect(gym.styles).toContain("fillStyle:#18181b");
    const track = draw(onStage(1));
    expect(track.styles).not.toContain("fillStyle:rgba(254, 249, 195, 0.5)");
  });

  it("draws a squat rack for each ceiling in the gym", () => {
    const state = onStage(3);
    const ceiling: CourseCeiling = {
      id: 1,
      x: worldX(state, 100),
      width: 60,
      bottom: 150,
    };
    const withRack = draw({
      ...state,
      course: { ...EMPTY_COURSE, ceilings: [ceiling] },
    });
    const without = draw(state);
    expect(withRack.calls.length).toBeGreaterThan(without.calls.length);
    expect(withRack.styles).toContain("strokeStyle:#71717a");
  });

  it("draws open water's current chevrons over each zone", () => {
    const state = onStage(4);
    const current: CourseCurrent = {
      id: 1,
      x: worldX(state, 40),
      width: 120,
      flow: 0.09,
    };
    const flowing = draw({
      ...state,
      course: { ...EMPTY_COURSE, currents: [current] },
    });
    expect(flowing.styles).toContain("strokeStyle:rgba(45, 212, 191, 0.3)");
    const still = draw(state);
    expect(still.styles).not.toContain("strokeStyle:rgba(45, 212, 191, 0.3)");
  });

  it("draws a buoy for each buoy belt on open water", () => {
    const state = onStage(4);
    const buoy: CourseBelt & { buoy: boolean } = {
      id: 2,
      x: worldX(state, 100),
      y: 150,
      width: 30,
      axis: "x",
      range: 0,
      periodMs: 0,
      buoy: true,
    };
    const withBuoy = draw({
      ...state,
      props: { ...EMPTY_PROPS, belts: [buoy] },
    });
    expect(withBuoy.styles).toContain("fillStyle:#fb923c");
    expect(withBuoy.styles).toContain("fillStyle:#f4f4f6");
    const without = draw(state);
    expect(without.styles).not.toContain("fillStyle:#fb923c");
  });

  it("keeps an ordinary treadmill belt off the buoy art", () => {
    const state = onStage(1);
    const belt: CourseBelt = {
      id: 3,
      x: worldX(state, 100),
      y: 150,
      width: 30,
      axis: "x",
      range: 0,
      periodMs: 1000,
    };
    const rec = draw({ ...state, props: { ...EMPTY_PROPS, belts: [belt] } });
    expect(rec.styles).not.toContain("fillStyle:#fb923c");
  });
});

describe("water foes and pickups", () => {
  it("draws a jellyfish with its bell and tentacles", () => {
    const state = onStage(2);
    const foe = foeOf("jellyfish", worldX(state, 120), 140);
    const rec = draw({ ...state, foes: [foe] });
    expect(rec.styles).toContain("fillStyle:rgba(224, 242, 254, 0.85)");
    expect(rec.styles).toContain("strokeStyle:rgba(224, 242, 254, 0.6)");
    expect(rec.calls).toContain("quadraticCurveTo");
    expect(draw(state).styles).not.toContain(
      "fillStyle:rgba(224, 242, 254, 0.85)"
    );
  });

  it("draws a pair of goggles with two lenses and a strap", () => {
    const state = onStage(2);
    const foe = foeOf("goggles", worldX(state, 120), 130);
    const rec = draw({ ...state, foes: [foe] });
    expect(rec.styles).toContain("fillStyle:rgba(56, 189, 248, 0.55)");
    const lenses = rec.calls.filter((c) => c === "arc").length;
    expect(lenses).toBeGreaterThanOrEqual(2);
  });

  it("draws the Tri Suit pickup", () => {
    const state = onStage(2);
    const pickup: Pickup = {
      id: 4,
      kind: "suit",
      x: worldX(state, 100),
      y: 150,
      vx: 0,
      vy: 0,
      emergeMs: 0,
    };
    const rec = draw({ ...state, pickups: [pickup] });
    expect(rec.styles).toContain("fillStyle:#0284c7");
    expect(rec.styles).toContain("fillStyle:#f97316");
    expect(draw(state).styles).not.toContain("fillStyle:#0284c7");
  });

  it("draws the trisuit runner in its suit colours", () => {
    const suit = draw(onStage(1, 0, { power: "trisuit" }));
    expect(suit.styles).toContain("fillStyle:#0284c7");
    expect(draw(onStage(1)).styles).not.toContain("fillStyle:#0284c7");
  });

  it("swims with a stroke rather than the run cycle", () => {
    const stroke = swimPose(0.5);
    const later = swimPose(3);
    expect(stroke.frontArm).not.toBeCloseTo(later.frontArm);
    expect(stroke.airborne).toBe(false);
    expect(stroke.frontLeg).toBeLessThan(0);
    expect(swimPose(0.5).frontArm).not.toBeCloseTo(
      runnerPose(0.5, true).frontArm
    );
  });
});

describe("LENGTH readout", () => {
  it("counts lengths from the stage start on water stages only", () => {
    const pool = draw(onStage(2, 30));
    expect(pool.texts).toContain("LENGTH 1/40");
    const open = draw(onStage(4, 0));
    expect(open.texts).toContain("LENGTH 0/40");
    expect(draw(onStage(1, 30)).texts.some((t) => /^LENGTH /.test(t))).toBe(
      false
    );
    expect(draw(onStage(3, 30)).texts.some((t) => /^LENGTH /.test(t))).toBe(
      false
    );
  });

  it("hides the readout inside a bonus room", () => {
    const room = draw(onStage(2, 30, { bonusRoom: BONUS_ROOM }));
    expect(room.texts.some((t) => /^LENGTH /.test(t))).toBe(false);
  });

  it("clamps the count to the stage's forty lengths", () => {
    expect(lengthCount(onStage(2, 0))).toBe(0);
    expect(lengthCount(onStage(2, 999))).toBe(39);
    expect(lengthCount(onStage(2, 5000))).toBe(40);
    expect(lengthCount(onStage(2, -50))).toBe(0);
    expect(lengthCount({ stage: 3, distanceMeters: 0 })).toBe(0);
  });
});

describe("game manual covers the stage themes", () => {
  const manual = GAME_MANUALS["garmin-watch"];
  const text = JSON.stringify(manual);

  it("explains swimming, sinking, currents, buoys and lengths", () => {
    expect(text).toContain("Pool & Open Water");
    expect(text).toMatch(/sink/i);
    expect(text).toMatch(/current/i);
    expect(text).toMatch(/buoy/i);
    expect(text).toMatch(/length/i);
  });

  it("explains the gym racks", () => {
    expect(text).toContain("Basement Gym");
    expect(text).toMatch(/squat rack/i);
    expect(text).toMatch(/Big forms get hurt/);
  });

  it("explains the Tri Suit", () => {
    expect(text).toContain("Tri Suit");
    expect(text).toMatch(/clumsy/i);
  });

  it("explains the jellyfish and the goggles", () => {
    expect(text).toContain("Jellyfish");
    expect(text).toMatch(/cannot be stomped/);
    expect(text).toContain("Lost Goggles");
    expect(text).toMatch(/pairs/);
  });
});
