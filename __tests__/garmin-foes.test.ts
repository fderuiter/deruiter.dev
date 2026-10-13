import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CANVAS_SIZE,
  createInitialState,
  spinCape,
  startGame,
  updateGameSimulation,
  GROUND_Y,
  PLAYER_X,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  FLASH_STORAGE_KEY,
  type GameEngineState,
  type Obstacle,
} from "@/lib/garmin-engine";
import {
  BLOCK_SIZE,
  EMPTY_COURSE,
  STAGE_COUNT,
  generateStage,
  isOverGap,
  stagePoleX,
  stageStartX,
  type CourseLayout,
} from "@/lib/garmin-course";
import { BUFF_HEIGHT, START_LIVES } from "@/lib/garmin-powerups";
import {
  REPMAX_GRACE_MS,
  REPMAX_HP,
  REPMAX_SCORE,
  REPMAX_STAGES,
  REPMAX_THROW_MS,
  ALERT_WAVE,
  FOE_DEFEAT_SCORE,
  FOE_SIZE,
  FOE_STOMP_SCORE,
  HOP_MS,
  HOP_VY,
  KICK_GRACE_MS,
  SHELL_HEIGHT,
  SHELL_SPEED,
  STAGE_FOE_TABLE,
  LAP_MS,
  WALK_SPEED,
  damageFoe,
  foeBox,
  generateFoes,
  isAwake,
  isHarmful,
  kickShell,
  makeFoe,
  runnerContact,
  STOMP_WINDOW,
  shellSweep,
  stepFoes,
  stompFoe,
  type Foe,
  type FoeShot,
} from "@/lib/garmin-foes";
import { GAME_MANUALS } from "@/lib/game-manuals";

// The course enemy roster in Monkey C Mayhem (#1991).

const FRAME = 1000 / 60;
let clock = 0;

beforeEach(() => {
  if (typeof window.localStorage?.removeItem === "function") {
    window.localStorage.removeItem(FLASH_STORAGE_KEY);
  }
  clock = 5_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** A running Fēnix session with no spawns, no allocations, no placed foes and `course`. */
function run(
  course: CourseLayout = EMPTY_COURSE,
  overrides: Partial<GameEngineState> = {}
): GameEngineState {
  return {
    ...startGame(createInitialState("fenix", 0, []), "fenix"),
    course,
    obstacles: [],
    foes: [],
    foeShots: [],
    lastObstacleTime: clock + 1e9,
    lastAllocTime: clock + 1e9,
    ...overrides,
  };
}

function step(state: GameEngineState, frames = 1): GameEngineState {
  let s = state;
  for (let i = 0; i < frames; i++) s = updateGameSimulation(s, FRAME);
  return s;
}

/** Steps foes on an otherwise empty course with the camera at 0. */
function stepAt(
  foes: Foe[],
  shots: FoeShot[] = [],
  course: CourseLayout = EMPTY_COURSE,
  runnerX = 62,
  cameraX = 0,
  deltaMs = FRAME
) {
  return stepFoes(
    foes,
    shots,
    course,
    GROUND_Y,
    cameraX,
    CANVAS_SIZE,
    deltaMs,
    runnerX,
    1
  );
}

/** The runner's world box one frame into a run from the start. */
const CAMERA_AFTER_ONE = 2.5;
const RUNNER_LEFT = CAMERA_AFTER_ONE + PLAYER_X;

describe("foe kinds", () => {
  it("each kind starts in its own mode", () => {
    expect(makeFoe(1, "kettlebell", 100, GROUND_Y)).toMatchObject({
      mode: "walk",
      vx: -WALK_SPEED,
      hp: 1,
      y: GROUND_Y - FOE_SIZE.kettlebell.height,
    });
    const alert = makeFoe(2, "alert", 100, GROUND_Y);
    expect(alert.mode).toBe("fly");
    expect(alert.baseY).toBeLessThan(GROUND_Y - 40);
    expect(makeFoe(3, "box", 100, GROUND_Y).timerMs).toBe(HOP_MS);
    expect(makeFoe(4, "lap", 100, GROUND_Y).mode).toBe("idle");
    expect(makeFoe(5, "repmax", 100, GROUND_Y).hp).toBe(REPMAX_HP);
  });
});

describe("stage foe layout", () => {
  it("is the same for the same seed and stage", () => {
    const course = generateStage(2, 42, GROUND_Y);
    expect(generateFoes(2, 42, course, GROUND_Y)).toEqual(
      generateFoes(2, 42, course, GROUND_Y)
    );
  });

  it("places three plus the stage number, from the stage's table, inside the stage", () => {
    for (let seed = 0; seed < 25; seed++) {
      for (let stage = 1; stage <= STAGE_COUNT; stage++) {
        const course = generateStage(stage, seed, GROUND_Y);
        const foes = generateFoes(stage, seed, course, GROUND_Y);
        const regular = foes.filter((f) => f.kind !== "repmax");
        expect(regular.length).toBeLessThanOrEqual(3 + stage);
        expect(regular.length).toBeGreaterThan(0);
        for (const f of regular) {
          expect(STAGE_FOE_TABLE[stage]).toContain(f.kind);
          expect(f.x).toBeGreaterThan(stageStartX(stage) + 450);
          expect(f.x).toBeLessThan(stagePoleX(stage));
        }
        // Ground foes stand on track, not over a gap.
        for (const f of foes.filter(
          (f) => f.mode !== "fly" && f.y + f.height === GROUND_Y
        )) {
          expect(isOverGap(course, f.x + f.width / 2)).toBe(false);
        }
        const repMax = foes.filter((f) => f.kind === "repmax");
        expect(repMax.length).toBe(REPMAX_STAGES.includes(stage) ? 1 : 0);
      }
    }
  });

  it("puts an Auto Lap on a block top when one is near", () => {
    let onBlock = 0;
    for (let seed = 0; seed < 25; seed++) {
      const course = generateStage(5, seed, GROUND_Y);
      for (const f of generateFoes(5, seed, course, GROUND_Y)) {
        if (f.kind !== "lap") continue;
        const block = course.blocks.find(
          (b) => f.x >= b.x && f.x + f.width <= b.x + BLOCK_SIZE
        );
        if (block) {
          onBlock++;
          expect(f.y + f.height).toBe(block.y);
        }
      }
    }
    expect(onBlock).toBeGreaterThan(0);
  });
});

describe("foe movement", () => {
  it("a walker walks toward the runner on the track", () => {
    const [f] = stepAt([makeFoe(1, "kettlebell", 120, GROUND_Y)]).foes;
    expect(f.x).toBeCloseTo(120 - WALK_SPEED, 3);
    expect(f.y + f.height).toBe(GROUND_Y);
  });

  it("a walker falls into a gap and is gone below the face", () => {
    const gap: CourseLayout = {
      ...EMPTY_COURSE,
      gaps: [{ x: 100, width: 60 }],
    };
    let foes = [makeFoe(1, "kettlebell", 110, GROUND_Y)];
    for (let i = 0; i < 60 && foes.length > 0; i++) {
      foes = stepAt(foes, [], gap).foes;
    }
    expect(foes).toHaveLength(0);
  });

  it("waits while still off the right of the face", () => {
    const far = makeFoe(1, "kettlebell", 900, GROUND_Y);
    expect(isAwake(far, 0, CANVAS_SIZE)).toBe(false);
    expect(stepAt([far]).foes[0]).toBe(far);
  });

  it("is dropped once well behind the camera", () => {
    expect(
      stepAt(
        [makeFoe(1, "kettlebell", 10, GROUND_Y)],
        [],
        EMPTY_COURSE,
        62,
        400
      ).foes
    ).toEqual([]);
  });

  it("a Move Alert flies a wave along its line", () => {
    let foes = [makeFoe(1, "alert", 200, GROUND_Y)];
    const base = foes[0].baseY!;
    const ys: number[] = [];
    for (let i = 0; i < 120; i++) {
      foes = stepAt(foes).foes;
      ys.push(foes[0].y);
    }
    expect(Math.max(...ys)).toBeLessThanOrEqual(base + ALERT_WAVE + 1e-9);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(base - ALERT_WAVE - 1e-9);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(ALERT_WAVE);
    expect(foes[0].x).toBeLessThan(200);
  });

  it("a Box Jumper hops toward the runner on its timer", () => {
    const jumper = makeFoe(1, "box", 200, GROUND_Y);
    const almost = stepAt([{ ...jumper, timerMs: FRAME * 2 }]).foes[0];
    expect(almost.vy).toBe(0);
    const hop = stepAt([almost]).foes[0];
    expect(hop.vy).toBe(HOP_VY);
    expect(hop.vx).toBeLessThan(0);
    expect(hop.timerMs).toBe(HOP_MS);
    const behind = stepAt([{ ...jumper, timerMs: 1 }], [], EMPTY_COURSE, 260)
      .foes[0];
    expect(behind.vx).toBeGreaterThan(0);
  });

  it("an Auto Lap fires only while on the face, every LAP_MS", () => {
    const lapTimer = { ...makeFoe(1, "lap", 200, GROUND_Y), timerMs: 1 };
    const fired = stepAt([lapTimer]);
    expect(fired.shots).toHaveLength(1);
    expect(fired.shots[0]).toMatchObject({ kind: "ping" });
    expect(fired.shots[0].vx).toBeLessThan(0);
    expect(fired.foes[0].timerMs).toBe(LAP_MS);
    expect(fired.nextShotId).toBe(2);
    // Not yet on the face: no shot, and the timer waits.
    const offFace = { ...lapTimer, x: CANVAS_SIZE + 5 };
    const waited = stepAt([offFace]);
    expect(waited.shots).toHaveLength(0);
    expect(waited.foes[0].timerMs).toBe(1);
  });

  it("a lap ping flies level and is gone off the face", () => {
    const shot: FoeShot = {
      id: 1,
      kind: "ping",
      x: 100,
      y: 150,
      vx: -2,
      vy: 0,
    };
    const [moved] = stepAt([], [shot]).shots;
    expect(moved.x).toBeCloseTo(98, 3);
    expect(moved.y).toBe(150);
    expect(stepAt([], [{ ...shot, x: -30 }]).shots).toEqual([]);
  });

  it("the Rep Max lobs arcing dumbbells while on the face", () => {
    const repMax = { ...makeFoe(1, "repmax", 200, GROUND_Y), throwMs: 1 };
    const out = stepAt([repMax]);
    expect(out.shots).toHaveLength(1);
    const dumbbell = out.shots[0];
    expect(dumbbell.kind).toBe("dumbbell");
    expect(dumbbell.vy).toBeLessThan(0);
    expect(out.foes[0].throwMs).toBe(REPMAX_THROW_MS);
    const later = stepAt([], [dumbbell]).shots[0];
    expect(later.vy).toBeGreaterThan(dumbbell.vy);
  });

  it("a sliding shell turns back off the side of a block", () => {
    const wall: CourseLayout = {
      ...EMPTY_COURSE,
      blocks: [
        {
          id: 1,
          x: 140,
          y: GROUND_Y - BLOCK_SIZE,
          kind: "brick",
          contents: "kudos",
          used: false,
        },
      ],
    };
    const shell = kickShell(
      stompFoe(makeFoe(1, "kettlebell", 120, GROUND_Y), 0).foe!,
      0
    );
    expect(shell.vx).toBe(SHELL_SPEED);
    let foes = [shell];
    for (let i = 0; i < 6; i++) foes = stepAt(foes, [], wall).foes;
    expect(foes[0].vx).toBe(-SHELL_SPEED);
    expect(foes[0].x + foes[0].width).toBeLessThanOrEqual(140);
  });
});

describe("contact rules", () => {
  const runner = (top: number) => ({
    left: 100,
    right: 116,
    top,
    bottom: top + 22,
  });

  it("landing on a foe from above is a stomp", () => {
    const f = makeFoe(1, "kettlebell", 100, GROUND_Y);
    expect(runnerContact(f, runner(f.y - 18), f.y - 2, 3)).toBe("stomp");
  });

  it("a landing up to the stomp window deep still stomps; deeper hurts", () => {
    const f = makeFoe(1, "kettlebell", 100, GROUND_Y);
    const box = runner(f.y - 6);
    expect(runnerContact(f, box, f.y + STOMP_WINDOW, 3)).toBe("stomp");
    expect(runnerContact(f, box, f.y + STOMP_WINDOW + 1, 3)).toBe("hurt");
  });

  it("walking into a resting shell kicks it; into a walker hurts", () => {
    const walker = makeFoe(1, "kettlebell", 100, GROUND_Y);
    const shell = stompFoe(walker, 0).foe!;
    const level = runner(GROUND_Y - 24);
    expect(runnerContact(shell, level, GROUND_Y, 0)).toBe("kick");
    expect(runnerContact(walker, level, GROUND_Y, 0)).toBe("hurt");
    expect(runnerContact(walker, runner(20), 40, 0)).toBe("none");
  });

  it("a freshly kicked shell can't hurt, a returning one can", () => {
    const kicked = kickShell(
      stompFoe(makeFoe(1, "kettlebell", 100, GROUND_Y), 0).foe!,
      0
    );
    expect(kicked.graceMs).toBe(KICK_GRACE_MS);
    expect(isHarmful(kicked)).toBe(false);
    expect(isHarmful({ ...kicked, graceMs: 0 })).toBe(true);
    expect(runnerContact(kicked, runner(GROUND_Y - 24), GROUND_Y, 0)).toBe(
      "none"
    );
  });
});

describe("stomps and hits", () => {
  it("a stomp locks a Kettlebell into a shell with its feet in place", () => {
    const walker = makeFoe(1, "kettlebell", 100, GROUND_Y);
    const { foe, score } = stompFoe(walker, 50);
    expect(foe?.mode).toBe("shell");
    expect(foe?.height).toBe(SHELL_HEIGHT);
    expect(foe!.y + foe!.height).toBe(GROUND_Y);
    expect(score).toBe(FOE_STOMP_SCORE);
  });

  it("stomping a shell kicks it away from the runner; stomping a slider stops it", () => {
    const shell = stompFoe(makeFoe(1, "kettlebell", 100, GROUND_Y), 50).foe!;
    expect(stompFoe(shell, 50).foe?.vx).toBe(SHELL_SPEED);
    expect(stompFoe(shell, 200).foe?.vx).toBe(-SHELL_SPEED);
    const slider = kickShell(shell, 50);
    expect(stompFoe(slider, 50).foe?.mode).toBe("shell");
  });

  it("a stomp clips a move alert's wings and flattens a box jumper or auto lap", () => {
    const alert = stompFoe(makeFoe(1, "alert", 100, GROUND_Y), 50).foe;
    expect(alert?.mode).toBe("walk");
    expect(stompFoe(alert!, 50).foe).toBeNull();
    expect(stompFoe(makeFoe(2, "box", 100, GROUND_Y), 50).foe).toBeNull();
    expect(stompFoe(makeFoe(3, "lap", 100, GROUND_Y), 50).foe).toBeNull();
  });

  it("the Rep Max takes three stomps or six hits, with a grace between", () => {
    let repMax: Foe | null = makeFoe(1, "repmax", 100, GROUND_Y);
    const stomped = stompFoe(repMax, 50);
    expect(stomped.foe?.hp).toBe(REPMAX_HP - 2);
    expect(stomped.foe?.graceMs).toBe(REPMAX_GRACE_MS);
    // During the grace another hit doesn't count.
    expect(damageFoe(stomped.foe!, 1)).toEqual({ foe: stomped.foe, score: 0 });
    let hits = 0;
    let last = 0;
    while (repMax) {
      const hit = damageFoe({ ...repMax, graceMs: 0 }, 1);
      repMax = hit.foe;
      last = hit.score;
      hits++;
    }
    expect(hits).toBe(REPMAX_HP);
    expect(last).toBe(REPMAX_SCORE);
  });

  it("any other hit defeats an ordinary foe", () => {
    expect(damageFoe(makeFoe(1, "alert", 100, GROUND_Y), 1)).toEqual({
      foe: null,
      score: FOE_DEFEAT_SCORE,
    });
  });

  it("a sliding shell flattens the foes it touches", () => {
    const shell = kickShell(
      stompFoe(makeFoe(1, "kettlebell", 100, GROUND_Y), 0).foe!,
      0
    );
    const jumper = makeFoe(2, "box", 104, GROUND_Y);
    const repMax = makeFoe(3, "repmax", 98, GROUND_Y);
    const far = makeFoe(4, "kettlebell", 300, GROUND_Y);
    const sweep = shellSweep([shell, jumper, repMax, far]);
    expect(sweep.foes.map((f) => f.id)).toEqual([1, 3, 4]);
    expect(sweep.foes.find((f) => f.id === 3)?.hp).toBe(REPMAX_HP - 2);
    expect(sweep.hits.map((h) => h.foe.id)).toEqual([2, 3]);
    expect(shellSweep([jumper]).hits).toEqual([]);
  });
});

describe("foes in a run", () => {
  /** A Kettlebell standing on the lane with its left edge at world `x`. */
  const kettlebellAt = (x: number) => makeFoe(9, "kettlebell", x, GROUND_Y);

  it("a run starts with stage 1's foes", () => {
    const s = startGame(createInitialState("fenix", 0, []), "fenix");
    // Stage 1's foes, less any that would start inside a course prop (#1992).
    const placed = generateFoes(1, s.courseSeed!, s.course!, GROUND_Y);
    expect(s.foes!.length).toBeGreaterThan(0);
    for (const f of s.foes!) expect(placed).toContainEqual(f);
    expect(s.foeShots).toEqual([]);
  });

  it("stomping a Kettlebell tips it over and bounces the runner", () => {
    const before = run(EMPTY_COURSE, {
      foes: [kettlebellAt(RUNNER_LEFT + 2)],
      playerY: GROUND_Y - 16 - PLAYER_HEIGHT - 2,
      playerVy: 8,
      isGrounded: false,
    });
    const s = step(before);
    expect(s.foes?.[0].mode).toBe("shell");
    expect(s.playerVy).toBeLessThan(0);
    expect(s.score).toBeGreaterThanOrEqual(before.score + FOE_STOMP_SCORE);
    expect(s.lives).toBe(START_LIVES);
  });

  it("landing on two foes at once stomps both and costs no life", () => {
    const s = step(
      run(EMPTY_COURSE, {
        foes: [
          kettlebellAt(RUNNER_LEFT - 4),
          { ...makeFoe(8, "box", RUNNER_LEFT + 10, GROUND_Y), timerMs: 1e6 },
        ],
        playerY: GROUND_Y - 16 - PLAYER_HEIGHT - 2,
        playerVy: 8,
        isGrounded: false,
        lives: 1,
      })
    );
    expect(s.gameState).toBe("playing");
    expect(s.lives).toBe(1);
    expect(s.foes?.map((f) => f.kind)).toEqual(["kettlebell"]);
    expect(s.foes?.[0].mode).toBe("shell");
    expect(s.stompChain).toBe(2);
  });

  it("a stomp the Rep Max shrugs off in its grace doesn't build the chain", () => {
    const boss = {
      ...makeFoe(8, "repmax", RUNNER_LEFT - 2, GROUND_Y),
      graceMs: 500,
      timerMs: 1e6,
      throwMs: 1e6,
    };
    const s = step(
      run(EMPTY_COURSE, {
        foes: [boss],
        playerY: GROUND_Y - boss.height - PLAYER_HEIGHT - 2,
        playerVy: 8,
        isGrounded: false,
        stompChain: 1,
      })
    );
    expect(s.stompChain).toBe(1);
    expect(s.foes?.[0].hp).toBe(REPMAX_HP);
  });

  it("running into a resting shell kicks it ahead", () => {
    const shell = stompFoe(kettlebellAt(RUNNER_LEFT + 14), 0).foe!;
    const s = step(run(EMPTY_COURSE, { foes: [shell] }));
    expect(s.foes?.[0].mode).toBe("kicked");
    expect(s.foes?.[0].vx).toBe(SHELL_SPEED);
    expect(s.gameState).toBe("playing");
  });

  it("a walking Kettlebell on the last life is a Dropped Kettlebell", () => {
    const s = step(
      run(EMPTY_COURSE, { lives: 1, foes: [kettlebellAt(RUNNER_LEFT + 6)] })
    );
    expect(s.gameState).toBe("crashed");
    expect(s.crashReport?.errorType).toBe("Dropped Kettlebell");
  });

  it("a Buff runner drops to Base instead", () => {
    const s = step(
      run(EMPTY_COURSE, {
        power: "buff",
        playerY: GROUND_Y - BUFF_HEIGHT,
        foes: [kettlebellAt(RUNNER_LEFT + 6)],
      })
    );
    expect(s.gameState).toBe("playing");
    expect(s.power).toBe("base");
    expect(s.lives).toBe(START_LIVES);
  });

  it("a lap ping that reaches the runner is a Gym Injury", () => {
    const s = step(
      run(EMPTY_COURSE, {
        lives: 1,
        foeShots: [
          {
            id: 1,
            kind: "ping",
            x: RUNNER_LEFT + 6,
            y: GROUND_Y - 14,
            vx: 0,
            vy: 0,
          },
        ],
      })
    );
    expect(s.crashReport?.errorType).toBe("Gym Injury");
  });

  it("a lost life brings back the stage's foes", () => {
    const seed = 77;
    const s = step(
      run(EMPTY_COURSE, {
        courseSeed: seed,
        foes: [kettlebellAt(RUNNER_LEFT + 6)],
      })
    );
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.foes).toEqual(
      generateFoes(1, seed, generateStage(1, seed, GROUND_Y), GROUND_Y)
    );
    expect(s.foeShots).toEqual([]);
  });

  it("a Runner's High flattens foes and burns off shots", () => {
    const before = run(EMPTY_COURSE, {
      starMs: 5000,
      foes: [kettlebellAt(RUNNER_LEFT + 6)],
      foeShots: [
        {
          id: 1,
          kind: "ping",
          x: RUNNER_LEFT + 6,
          y: GROUND_Y - 14,
          vx: 0,
          vy: 0,
        },
      ],
    });
    const s = step(before);
    expect(s.foes).toEqual([]);
    expect(s.foeShots).toEqual([]);
    expect(s.score).toBeGreaterThanOrEqual(before.score + FOE_DEFEAT_SCORE);
  });

  it("a heat bolt defeats a foe and is spent", () => {
    const s = step(
      run(EMPTY_COURSE, {
        power: "heatmap",
        playerY: GROUND_Y - BUFF_HEIGHT,
        foes: [makeFoe(9, "box", 160, GROUND_Y)],
        bolts: [{ id: 1, x: 155, y: GROUND_Y - 10, vx: 7, vy: 0 }],
      })
    );
    expect(s.foes).toEqual([]);
    expect(s.bolts).toEqual([]);
  });

  it("a cape spin defeats a foe beside the runner", () => {
    const s = step(
      spinCape(
        run(EMPTY_COURSE, {
          power: "cape",
          playerY: GROUND_Y - BUFF_HEIGHT,
          foes: [makeFoe(9, "box", RUNNER_LEFT + PLAYER_WIDTH + 4, GROUND_Y)],
        })
      )
    );
    expect(s.foes).toEqual([]);
  });

  it("a sliding shell flattens a drifting bug", () => {
    const shell = {
      ...kickShell(stompFoe(kettlebellAt(150), 0).foe!, 0),
      graceMs: 0,
    };
    const bug: Obstacle = {
      id: 1,
      x: 152,
      y: GROUND_Y - 20,
      width: 16,
      height: 20,
      type: "null_pointer",
      label: "NULL",
      speed: 0,
    };
    const before = run(EMPTY_COURSE, { foes: [shell], obstacles: [bug] });
    const s = step(before);
    expect(s.obstacles).toEqual([]);
    expect(s.score).toBeGreaterThanOrEqual(before.score + FOE_DEFEAT_SCORE);
  });

  it("clearing a stage brings on the next stage's foes", () => {
    const seed = 5;
    const course: CourseLayout = {
      ...EMPTY_COURSE,
      poles: [{ x: PLAYER_X + 18, stage: 1 }],
    };
    const s = step(
      run(course, {
        courseSeed: seed,
        foeShots: [{ id: 1, kind: "ping", x: 200, y: 100, vx: 0, vy: 0 }],
      })
    );
    expect(s.stage).toBe(2);
    expect(s.foes).toEqual(
      generateFoes(2, seed, generateStage(2, seed, GROUND_Y), GROUND_Y)
    );
    expect(s.foeShots).toEqual([]);
  });

  it("an old snapshot without foes still steps", () => {
    const s = run();
    delete s.foes;
    delete s.foeShots;
    delete s.foeShotsFired;
    expect(step(s).gameState).toBe("playing");
  });

  it("foe boxes are inset like the runner's", () => {
    const f = makeFoe(1, "kettlebell", 100, GROUND_Y);
    expect(foeBox(f)).toEqual({
      left: 102,
      right: 100 + f.width - 2,
      top: f.y + 2,
      bottom: f.y + f.height - 2,
    });
  });

  it("the manual lists each foe", () => {
    const rules = GAME_MANUALS["garmin-watch"].rules
      .map((r) => r.detail)
      .join(" ");
    for (const name of [
      "Kettlebell",
      "Move Alert",
      "Box Jumper",
      "Auto Lap",
      "Rep Max",
    ]) {
      expect(rules).toContain(name);
    }
  });
});
