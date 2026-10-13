import { describe, it, expect } from "vitest";
import {
  EMPTY_COURSE,
  MEDBALL_SIZE,
  appendCourse,
  generateStage,
  isFootingOverGap,
  pruneCourse,
  type CourseLayout,
  type CourseMedBall,
} from "@/lib/garmin-course";
import {
  SWITCH_WIDTH,
  generateStageProps,
  restDaySwap,
} from "@/lib/garmin-props";
import { themeForStage, isWaterTheme } from "@/lib/garmin-themes";
import {
  MEDBALL_GRAVITY,
  MEDBALL_REACH,
  MEDBALL_THROW_VX,
  MEDBALL_THROW_VY,
  ballHits,
  ballInReach,
  stepThrownBall,
  throwBall,
  type ThrownBall,
} from "@/lib/garmin-medball";

/** Lane top used by the engine (GROUND_Y in lib/garmin-engine.ts). */
const GROUND_Y = 205;
const STAGES = [1, 2, 3, 4, 5];
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const CANVAS = 240;
const FRAME_MS = 16.666;

const ball = (over: Partial<ThrownBall> = {}): ThrownBall => ({
  id: 1,
  x: 100,
  y: 150,
  vx: 0,
  vy: 0,
  ...over,
});

const restingBall = (
  x: number,
  y = GROUND_Y - MEDBALL_SIZE
): CourseMedBall => ({
  id: 1,
  x,
  y,
});

describe("ballInReach", () => {
  const left = 200;
  const right = 224;
  const feet = GROUND_Y;
  const onLane = GROUND_Y - MEDBALL_SIZE;

  it("finds a resting ball just past the runner's front", () => {
    const b = restingBall(right + 4);
    expect(ballInReach([b], left, right, feet)).toBe(b);
  });

  it("finds a resting ball just behind the runner's back", () => {
    const b = restingBall(left - MEDBALL_SIZE - 4);
    expect(ballInReach([b], left, right, feet)).toBe(b);
  });

  it("finds a ball overlapping the runner's body", () => {
    const b = restingBall(left + 5);
    expect(ballInReach([b], left, right, feet)).toBe(b);
  });

  it("ignores a ball beyond the reach on the front side", () => {
    expect(
      ballInReach([restingBall(right + MEDBALL_REACH + 1)], left, right, feet)
    ).toBeNull();
  });

  it("ignores a ball beyond the reach on the back side", () => {
    expect(
      ballInReach(
        [restingBall(left - MEDBALL_SIZE - MEDBALL_REACH - 1)],
        left,
        right,
        feet
      )
    ).toBeNull();
  });

  it("ignores a ball on a different footing height", () => {
    expect(
      ballInReach([restingBall(right + 2, onLane - 20)], left, right, feet)
    ).toBeNull();
  });

  it("accepts a ball within 2 px of the feet's footing", () => {
    const b = restingBall(right + 2, onLane + 1.5);
    expect(ballInReach([b], left, right, feet)).toBe(b);
  });

  it("returns null for an undefined or empty list", () => {
    expect(ballInReach(undefined, left, right, feet)).toBeNull();
    expect(ballInReach([], left, right, feet)).toBeNull();
  });

  it("returns the first ball in reach", () => {
    const near = restingBall(right + 2);
    const also = restingBall(left - 12);
    expect(ballInReach([near, also], left, right, feet)).toBe(near);
  });
});

describe("throwBall", () => {
  it("starts at the runner's front, held at hand height, moving forward and up", () => {
    const t = throwBall(7, 100, 150);
    expect(t).toEqual({
      id: 7,
      x: 100,
      y: 150 - MEDBALL_SIZE / 2,
      vx: MEDBALL_THROW_VX,
      vy: MEDBALL_THROW_VY,
    });
    expect(t.vx).toBeGreaterThan(0);
    expect(t.vy).toBeLessThan(0);
  });
});

describe("ballHits", () => {
  const box = { left: 50, top: 50, right: 80, bottom: 80 };
  const hit = (b: ThrownBall) =>
    ballHits(b, box.left, box.top, box.right, box.bottom);

  it("hits a ball overlapping the box", () => {
    expect(hit(ball({ x: 60, y: 60 }))).toBe(true);
  });

  it("hits a ball partly over the box edge", () => {
    expect(hit(ball({ x: 45, y: 60 }))).toBe(true);
    expect(hit(ball({ x: 75, y: 75 }))).toBe(true);
  });

  it("does not hit a ball that only touches the left or top edge", () => {
    expect(hit(ball({ x: 40, y: 60 }))).toBe(false);
    expect(hit(ball({ x: 60, y: 40 }))).toBe(false);
  });

  it("does not hit a ball that only touches the right or bottom edge", () => {
    expect(hit(ball({ x: 80, y: 60 }))).toBe(false);
    expect(hit(ball({ x: 60, y: 80 }))).toBe(false);
  });

  it("does not hit a ball clear of the box", () => {
    expect(hit(ball({ x: 200, y: 200 }))).toBe(false);
  });
});

describe("stepThrownBall", () => {
  const flat: CourseLayout = { ...EMPTY_COURSE };

  it("arcs up and then comes down, moving forward all the while", () => {
    let b: ThrownBall | null = throwBall(1, 100, GROUND_Y - 40);
    const ys: number[] = [b.y];
    const xs: number[] = [b.x];
    for (let i = 0; i < 12 && b; i++) {
      const step = stepThrownBall(b, flat, GROUND_Y, 0, 10000, FRAME_MS);
      expect(step.landed).toBeNull();
      b = step.ball;
      if (b) {
        ys.push(b.y);
        xs.push(b.x);
      }
    }
    expect(b).not.toBeNull();
    const peak = Math.min(...ys);
    expect(peak).toBeLessThan(ys[0]);
    expect(ys.indexOf(peak)).toBeGreaterThan(0);
    expect(ys[ys.length - 1]).toBeGreaterThan(peak);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
  });

  it("applies gravity to the vertical speed each frame", () => {
    const step = stepThrownBall(
      ball({ vy: -2.5 }),
      flat,
      GROUND_Y,
      0,
      10000,
      FRAME_MS
    );
    expect(step.ball?.vy).toBeCloseTo(-2.5 + MEDBALL_GRAVITY);
  });

  it("comes to rest on the lane and reports where it landed", () => {
    const start = ball({ x: 100, y: GROUND_Y - MEDBALL_SIZE - 5, vy: 6 });
    const step = stepThrownBall(start, flat, GROUND_Y, 0, 10000, FRAME_MS);
    expect(step.ball).toBeNull();
    expect(step.landed).toEqual({
      id: 1,
      x: expect.any(Number),
      y: GROUND_Y - MEDBALL_SIZE,
    });
  });

  it("lands on a ledge above the lane", () => {
    const ledgeY = GROUND_Y - 40;
    const course: CourseLayout = {
      ...EMPTY_COURSE,
      ledges: [{ x: 90, y: ledgeY, width: 40 }],
    };
    const start = ball({ x: 100, y: ledgeY - MEDBALL_SIZE - 5, vy: 6 });
    const step = stepThrownBall(start, course, GROUND_Y, 0, 10000, FRAME_MS);
    expect(step.ball).toBeNull();
    expect(step.landed?.y).toBe(ledgeY - MEDBALL_SIZE);
  });

  it("falls through a gap and is gone", () => {
    const course: CourseLayout = {
      ...EMPTY_COURSE,
      gaps: [{ x: 60, width: 120 }],
    };
    let b: ThrownBall | null = ball({ x: 100, y: 150, vy: 0, vx: 0 });
    let landed = null;
    for (let i = 0; i < 300 && b; i++) {
      const step = stepThrownBall(b, course, GROUND_Y, 0, CANVAS, FRAME_MS);
      landed = step.landed ?? landed;
      b = step.ball;
    }
    expect(landed).toBeNull();
    expect(b).toBeNull();
  });

  it("is gone once it leaves the view ahead of the camera", () => {
    const step = stepThrownBall(
      ball({ x: 299, y: 20, vx: 5, vy: 0 }),
      flat,
      GROUND_Y,
      0,
      CANVAS,
      FRAME_MS
    );
    expect(step.ball).toBeNull();
    expect(step.landed).toBeNull();
  });

  it("stays put with a zero delta", () => {
    const b = ball({ x: 100, y: 150, vx: 5, vy: -2.5 });
    const step = stepThrownBall(b, flat, GROUND_Y, 0, 10000, 0);
    expect(step.landed).toBeNull();
    expect(step.ball).toEqual(b);
  });

  it("stays put with a NaN delta", () => {
    const b = ball({ x: 100, y: 150, vx: 5, vy: -2.5 });
    const step = stepThrownBall(b, flat, GROUND_Y, 0, 10000, Number.NaN);
    expect(step.landed).toBeNull();
    expect(step.ball).toEqual(b);
  });
});

describe("generateStage medicine balls", () => {
  const landStages = STAGES.filter((s) => !isWaterTheme(themeForStage(s)));
  const waterStages = STAGES.filter((s) => isWaterTheme(themeForStage(s)));

  it("water stages carry no medicine balls and no buddy block", () => {
    for (const s of waterStages) {
      for (const seed of SEEDS) {
        const layout = generateStage(s, seed, GROUND_Y, themeForStage(s));
        expect(layout.medBalls).toBeUndefined();
        expect(layout.blocks.some((b) => b.contents === "buddy")).toBe(false);
      }
    }
  });

  it("land stages carry one or two medicine balls on the lane", () => {
    for (const s of landStages) {
      for (const seed of SEEDS) {
        const layout = generateStage(s, seed, GROUND_Y, themeForStage(s));
        const balls = layout.medBalls ?? [];
        expect(balls.length).toBeGreaterThanOrEqual(1);
        expect(balls.length).toBeLessThanOrEqual(2);
        for (const b of balls) {
          expect(b.y).toBe(GROUND_Y - MEDBALL_SIZE);
        }
      }
    }
  });

  it("medicine balls sit on open lane, clear of gaps", () => {
    for (const s of landStages) {
      for (const seed of SEEDS) {
        const layout = generateStage(s, seed, GROUND_Y, themeForStage(s));
        for (const b of layout.medBalls ?? []) {
          expect(isFootingOverGap(layout, b.x, b.x + MEDBALL_SIZE)).toBe(false);
          for (const g of layout.gaps) {
            const overlapsNear =
              b.x + MEDBALL_SIZE + 8 > g.x && b.x - 8 < g.x + g.width;
            expect(overlapsNear).toBe(false);
          }
        }
      }
    }
  });

  it("medicine balls are at least 120 px apart", () => {
    for (const s of landStages) {
      for (const seed of SEEDS) {
        const xs = (
          generateStage(s, seed, GROUND_Y, themeForStage(s)).medBalls ?? []
        )
          .map((b) => b.x)
          .sort((a, b) => a - b);
        for (let i = 1; i < xs.length; i++) {
          expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(120);
        }
      }
    }
  });

  it("is deterministic for the same seed", () => {
    for (const s of STAGES) {
      const theme = themeForStage(s);
      const a = generateStage(s, 42, GROUND_Y, theme);
      const b = generateStage(s, 42, GROUND_Y, theme);
      expect(a).toEqual(b);
    }
  });
});

describe("generateStage Running Buddy block", () => {
  const landStages = STAGES.filter((s) => !isWaterTheme(themeForStage(s)));

  it("has at most one buddy block per stage, and it is a Sync Block", () => {
    for (const s of landStages) {
      for (const seed of SEEDS) {
        const blocks = generateStage(
          s,
          seed,
          GROUND_Y,
          themeForStage(s)
        ).blocks;
        const buddies = blocks.filter((b) => b.contents === "buddy");
        expect(buddies.length).toBeLessThanOrEqual(1);
        for (const b of buddies) expect(b.kind).toBe("sync");
      }
    }
  });

  it("gives some land stages a buddy block and leaves others without", () => {
    for (const s of landStages) {
      const counts = SEEDS.map(
        (seed) =>
          generateStage(s, seed, GROUND_Y, themeForStage(s)).blocks.filter(
            (b) => b.contents === "buddy"
          ).length
      );
      expect(counts.some((c) => c === 1)).toBe(true);
      expect(counts.some((c) => c === 0)).toBe(true);
    }
  });
});

describe("pruneCourse and appendCourse with medicine balls", () => {
  it("drops medicine balls that have scrolled behind the camera", () => {
    const cameraX = 1000;
    const course: CourseLayout = {
      ...EMPTY_COURSE,
      medBalls: [
        restingBall(cameraX - 100),
        restingBall(cameraX - 60),
        restingBall(cameraX - 45),
        restingBall(cameraX + 50),
      ],
    };
    const pruned = pruneCourse(course, cameraX);
    expect(pruned.medBalls?.map((b) => b.x)).toEqual([
      cameraX - 45,
      cameraX + 50,
    ]);
  });

  it("keeps the same course object when no medicine ball is dropped", () => {
    const course: CourseLayout = {
      ...EMPTY_COURSE,
      medBalls: [restingBall(500)],
    };
    expect(pruneCourse(course, 100)).toBe(course);
  });

  it("does not add a medBalls key to a course without one", () => {
    const pruned = pruneCourse({ ...EMPTY_COURSE }, 0);
    expect(pruned.medBalls).toBeUndefined();
    expect("medBalls" in pruned).toBe(false);
  });

  it("joins medicine balls from both sides", () => {
    const a: CourseLayout = { ...EMPTY_COURSE, medBalls: [restingBall(100)] };
    const b: CourseLayout = { ...EMPTY_COURSE, medBalls: [restingBall(900)] };
    const joined = appendCourse(a, b);
    expect(joined.medBalls?.map((x) => x.x)).toEqual([100, 900]);
  });

  it("carries medicine balls when only one side has them", () => {
    const a: CourseLayout = { ...EMPTY_COURSE };
    const b: CourseLayout = { ...EMPTY_COURSE, medBalls: [restingBall(900)] };
    expect(appendCourse(a, b).medBalls?.map((x) => x.x)).toEqual([900]);
    expect(appendCourse(b, a).medBalls?.map((x) => x.x)).toEqual([900]);
  });

  it("leaves the key off when neither side has medicine balls", () => {
    expect("medBalls" in appendCourse(EMPTY_COURSE, EMPTY_COURSE)).toBe(false);
  });
});

describe("restDaySwap keeps medicine balls", () => {
  it("round trips the balls through a rest day and back", () => {
    const course = generateStage(1, 3, GROUND_Y, "track");
    expect(course.medBalls?.length ?? 0).toBeGreaterThan(0);
    const rested = restDaySwap(course, true);
    expect(rested.medBalls).toEqual(course.medBalls);
    const back = restDaySwap(rested, false);
    expect(back.medBalls).toEqual(course.medBalls);
  });
});

describe("medicine balls and the course props", () => {
  it("no ball is left under a station, plyo box or switch, or a gym rack", () => {
    let checked = 0;
    for (let seed = 1; seed <= 120; seed++) {
      for (const stage of [1, 3, 5]) {
        const theme = themeForStage(stage);
        const raw = generateStage(stage, seed, GROUND_Y, theme);
        const { props, layout } = generateStageProps(
          stage,
          seed,
          GROUND_Y,
          raw,
          theme
        );
        const spans = [
          ...props.stations.map((p) => [p.x, p.x + p.width]),
          ...props.plyos.map((p) => [p.x, p.x + p.width]),
          ...props.switches.map((p) => [p.x, p.x + SWITCH_WIDTH]),
          ...(layout.ceilings ?? []).map((c) => [c.x, c.x + c.width]),
        ];
        for (const ball of layout.medBalls ?? []) {
          checked++;
          const covered = spans.some(
            ([a, b]) => ball.x < b && ball.x + MEDBALL_SIZE > a
          );
          expect(covered, `stage ${stage} seed ${seed} ball ${ball.id}`).toBe(
            false
          );
        }
      }
    }
    expect(checked).toBeGreaterThan(300);
  });
});
