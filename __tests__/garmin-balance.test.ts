import { describe, it, expect } from "vitest";
import {
  createInitialState,
  pressJump,
  setRunInput,
  startGame,
  updateGameSimulation,
  GROUND_Y,
  PLAYER_WIDTH,
  PLAYER_X,
  RACK_CLEAR,
  type GameEngineState,
} from "@/lib/garmin/engine";
import {
  EMPTY_COURSE,
  PX_PER_METER,
  STAGE_COUNT,
  generateStage,
  stageStartX,
  type CourseLayout,
} from "@/lib/garmin/course";
import { EMPTY_PROPS, PLYO_HEIGHT, PLYO_WIDTH } from "@/lib/garmin/props";
import {
  FOE_GAP_CLEAR,
  REPMAX_THROW_MS,
  generateFoes,
} from "@/lib/garmin/foes";
import { themeForStage } from "@/lib/garmin/themes";
import { BONK_OVER_TEXT, REST_DAY_OVER_TEXT } from "@/lib/garmin/culture";
import { MOVE_TOASTS } from "@/lib/garmin/moves";
import { COACH_SATURDAY_MS, type RaceSetup } from "@/lib/garmin/race";

// The balance pass and finish (#2022). A lookahead bot played every stage
// in Race Mode, the Training Plan and Race Day, and found four rules that
// broke fairness. Each has a regression test here; the tuning itself only
// moved constants.

const FRAME = 1000 / 60;
const RACE: RaceSetup = { course: "daily", category: "any", seed: 2022 };

/** A seeded fitness race with nothing on the lane, overridden by `overrides`. */
function race(overrides: Partial<GameEngineState> = {}): GameEngineState {
  const started = startGame(
    createInitialState("fenix", 0, []),
    "fenix",
    undefined,
    RACE
  );
  return {
    ...started,
    gpsMs: 0,
    banner: null,
    course: EMPTY_COURSE,
    props: EMPTY_PROPS,
    foes: [],
    obstacles: [],
    ...overrides,
  };
}

function step(state: GameEngineState, frames = 1): GameEngineState {
  let s = state;
  for (let i = 0; i < frames; i++) s = updateGameSimulation(s, FRAME);
  return s;
}

describe("a pool's deep end has a far wall (#2022)", () => {
  // The bot found swimmers who sank into a gap on the pool floor carrying on
  // under the lane, drawn inside the ground, until a Plyo Box stopped them.
  const pit: CourseLayout = {
    ...EMPTY_COURSE,
    gaps: [{ x: stageStartX(2) + 600, width: 60 }],
  };
  const inPit = (overrides: Partial<GameEngineState> = {}) =>
    race({
      stage: 2,
      course: pit,
      // The swimmer's feet sit over the gap, below the lane.
      distanceMeters: (stageStartX(2) + 600 + 10 - PLAYER_X) / PX_PER_METER,
      playerY: GROUND_Y + 20,
      playerVy: 0,
      isGrounded: false,
      ...overrides,
    });

  it("stops a swimmer below the lane at the gap's far edge", () => {
    const wallX = stageStartX(2) + 660;
    let s = inPit();
    for (let i = 0; i < 120; i++) {
      // A light stroke now and then keeps the swimmer deep in the pit.
      if (i % 24 === 0 && s.playerY > GROUND_Y + 35) s = pressJump(s);
      s = step(s);
    }
    const feetRight =
      s.distanceMeters * PX_PER_METER + PLAYER_X + PLAYER_WIDTH - 5;
    expect(s.lives).toBe(inPit().lives);
    expect(s.playerY).toBeGreaterThan(GROUND_Y);
    expect(feetRight).toBeLessThanOrEqual(wallX + 0.01);
  });

  it("lets the swimmer go on once it strokes up over the edge", () => {
    // Above the lane, the far wall no longer holds the swimmer back.
    const wallStop =
      (stageStartX(2) + 660 - PLAYER_X - PLAYER_WIDTH + 5) / PX_PER_METER;
    const after = step(inPit({ playerY: GROUND_Y - 100 }), 60);
    expect(after.distanceMeters).toBeGreaterThan(wallStop + 1);
  });
});

describe("no bug meets the runner under a gym rack (#2022)", () => {
  // Under a rack there is no room to jump, so on main a bug that reached the
  // runner there was an unavoidable hit: 10 of the 13 lives a steady-pace bot
  // lost were on the Basement Gym.
  const gym = (rackAt: number | null): GameEngineState => {
    const cameraX = stageStartX(3) + 2000;
    return race({
      stage: 3,
      distanceMeters: cameraX / PX_PER_METER,
      course: {
        ...EMPTY_COURSE,
        ceilings:
          rackAt === null
            ? []
            : [{ id: 1, x: cameraX + rackAt, width: 120, bottom: 178 }],
      },
      simMs: 60_000,
      lastObstacleTime: 0,
    });
  };

  it("spawns a bug on open lane", () => {
    expect(step(gym(null)).obstacles.length).toBe(1);
  });

  it("holds the bug while a rack lies between the runner and the spawn", () => {
    expect(step(gym(150)).obstacles.length).toBe(0);
  });

  it("holds it while the runner is under a rack", () => {
    expect(step(gym(0)).obstacles.length).toBe(0);
  });

  it("holds it for a rack just past the spawn point", () => {
    expect(step(gym(290 + RACK_CLEAR - 20)).obstacles.length).toBe(0);
  });
});

describe("bugs come by distance, not time (#2022)", () => {
  // Timed spawns gave a slower runner more bugs per kilometre: a jog met 2.5
  // times the bugs a sprint did over the same stretch.
  function spawnsOver(metres: number, input: -1 | 0 | 1): number {
    let s = setRunInput(
      race({ stage: 5, distanceMeters: stageStartX(5) / PX_PER_METER }),
      input
    );
    const end = s.distanceMeters + metres;
    let spawns = 0;
    for (let i = 0; i < 60 * 600 && s.distanceMeters < end; i++) {
      const before = s.lastObstacleTime;
      // Invincible, so the bugs never end the run.
      s = step({
        ...s,
        starMs: 60_000,
        bodyBattery: { value: 100, bonked: false },
      });
      if (s.lastObstacleTime !== before) spawns++;
    }
    return spawns;
  }

  it("meets about as many bugs at a jog as at a sprint", () => {
    const jog = spawnsOver(400, -1);
    const sprint = spawnsOver(400, 1);
    expect(sprint).toBeGreaterThan(5);
    expect(Math.abs(jog - sprint)).toBeLessThanOrEqual(Math.ceil(sprint * 0.3));
  });
});

describe("foes keep clear of gaps (#2022)", () => {
  // A Box Jumper 20 px from a gap's take-off left no line through at a
  // sprint: the bot found no jump sequence that survived it.
  it("leaves a run-up between every course foe and every gap", () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (let stage = 1; stage <= STAGE_COUNT; stage++) {
        const theme = themeForStage(stage);
        const course = generateStage(stage, seed, GROUND_Y, theme);
        for (const foe of generateFoes(stage, seed, course, GROUND_Y, theme)) {
          if (foe.kind === "lap") continue; // An Auto Lap sits on a block.
          for (const g of course.gaps) {
            const clear =
              foe.x >= g.x + g.width + FOE_GAP_CLEAR ||
              foe.x + foe.width <= g.x - FOE_GAP_CLEAR;
            expect(clear, `seed ${seed} stage ${stage} foe ${foe.id}`).toBe(
              true
            );
          }
        }
      }
    }
  });
});

describe("tuned constants (#2022)", () => {
  it("gives the Rep Max more time between dumbbells", () => {
    expect(REPMAX_THROW_MS).toBe(2200);
  });

  it("publishes the coach's Saturday 5K time", () => {
    expect(COACH_SATURDAY_MS).toBe(317_430);
  });
});

describe("every mechanic is named on the face (#2022)", () => {
  it("calls the end of a bonk", () => {
    const s = race({ bodyBattery: { value: 24.9, bonked: true } });
    const after = step(setRunInput(s, -1), 30);
    expect(after.bodyBattery?.bonked).toBe(false);
    expect(after.banner?.text).toBe(BONK_OVER_TEXT);
  });

  it("calls the end of a Rest Day", () => {
    const after = step(race({ restDayMs: 10 }));
    expect(after.restDayMs).toBe(0);
    expect(after.banner?.text).toBe(REST_DAY_OVER_TEXT);
  });

  it("names the first Plyo Box of a run once", () => {
    const cameraX = stageStartX(1) + 1000;
    const box = cameraX + PLAYER_X;
    const s = race({
      distanceMeters: cameraX / PX_PER_METER,
      props: {
        ...EMPTY_PROPS,
        plyos: [
          { id: 1, x: box, width: PLYO_WIDTH, height: PLYO_HEIGHT },
          { id: 2, x: box + 400, width: PLYO_WIDTH, height: PLYO_HEIGHT },
        ],
      },
      playerY: GROUND_Y - PLYO_HEIGHT - 30,
      playerVy: 2,
      isGrounded: false,
    });
    let after = s;
    let named = 0;
    for (let i = 0; i < 240; i++) {
      const before = after.banner?.text;
      after = step(after);
      if (
        after.banner?.text === MOVE_TOASTS.plyo &&
        before !== MOVE_TOASTS.plyo
      )
        named++;
    }
    expect(named).toBe(1);
    expect(after.movesUsed).toContain("plyo");
  });

  it("waits for a clear face before naming a piece", () => {
    const cameraX = stageStartX(1) + 1000;
    const s = race({
      distanceMeters: cameraX / PX_PER_METER,
      props: {
        ...EMPTY_PROPS,
        plyos: [
          {
            id: 1,
            x: cameraX + PLAYER_X,
            width: PLYO_WIDTH,
            height: PLYO_HEIGHT,
          },
        ],
      },
      playerY: GROUND_Y - PLYO_HEIGHT - 30,
      playerVy: 2,
      isGrounded: false,
      banner: { text: "LAP 1", ttlMs: 5000, tone: "info" },
    });
    const after = step(s, 20);
    expect(after.banner?.text).toBe("LAP 1");
    expect(after.movesUsed ?? []).not.toContain("plyo");
  });
});
