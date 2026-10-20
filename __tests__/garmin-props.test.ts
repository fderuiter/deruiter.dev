// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  BELT_WIDTH,
  PLYO_HELD_VY,
  PLYO_LAUNCH_VY,
  SWITCH_HEIGHT,
  SWITCH_WIDTH,
  appendProps,
  beltOffset,
  generateBonusRoom,
  generateStageProps,
  plyoLaunchVy,
  propFootings,
  pruneProps,
  restDaySwap,
  stationUnderFeet,
  wallAhead,
  type CourseBelt,
  type CourseProps,
} from "@/lib/garmin/props";
import {
  BLOCK_SIZE,
  generateStage,
  isFootingOverGap,
  isOverGap,
  stagePoleX,
  stageStartX,
  type CourseLayout,
} from "@/lib/garmin/course";

const GROUND = 205;
const STAGES = [1, 2, 3, 4, 5];
const SEEDS = [1, 2, 3, 7, 42, 99, 1234, 5000];

const emptyProps = (): CourseProps => ({
  stations: [],
  plyos: [],
  belts: [],
  switches: [],
});

const sliderBelt: CourseBelt = {
  id: 1,
  x: 300,
  y: GROUND - 30,
  width: 30,
  axis: "x",
  range: 100,
  periodMs: 1000,
};

describe("plyoLaunchVy", () => {
  it("launches higher when jump is held than on a tap", () => {
    expect(plyoLaunchVy(true)).toBe(PLYO_HELD_VY);
    expect(plyoLaunchVy(false)).toBe(PLYO_LAUNCH_VY);
    expect(PLYO_HELD_VY).toBeLessThan(PLYO_LAUNCH_VY);
  });
});

describe("beltOffset", () => {
  it("starts at zero, peaks at half period and returns at full period", () => {
    expect(beltOffset(sliderBelt, 0)).toEqual({ dx: 0, dy: 0 });
    expect(beltOffset(sliderBelt, 250)).toEqual({ dx: 50, dy: 0 });
    expect(beltOffset(sliderBelt, 500)).toEqual({ dx: 100, dy: 0 });
    expect(beltOffset(sliderBelt, 1000).dx).toBeCloseTo(0);
  });

  it("moves dy on axis y", () => {
    const vertical: CourseBelt = { ...sliderBelt, axis: "y" };
    expect(beltOffset(vertical, 500)).toEqual({ dx: 0, dy: 100 });
  });

  it("returns zero for a bad period or a non-finite clock", () => {
    expect(beltOffset({ ...sliderBelt, periodMs: 0 }, 400)).toEqual({
      dx: 0,
      dy: 0,
    });
    expect(beltOffset({ ...sliderBelt, periodMs: -5 }, 400)).toEqual({
      dx: 0,
      dy: 0,
    });
    expect(beltOffset({ ...sliderBelt, periodMs: NaN }, 400)).toEqual({
      dx: 0,
      dy: 0,
    });
    expect(beltOffset(sliderBelt, Number.NaN)).toEqual({ dx: 0, dy: 0 });
  });
});

describe("propFootings", () => {
  const props: CourseProps = {
    stations: [
      { id: 10, x: 100, width: 30, height: 20, enterable: false, exitX: 100 },
    ],
    plyos: [{ id: 20, x: 200, width: 22, height: 12 }],
    belts: [sliderBelt],
    switches: [
      { id: 30, x: 400, pressed: false },
      { id: 31, x: 500, pressed: true },
    ],
  };

  it("lists every surface and omits pressed switches", () => {
    const feet = propFootings(props, 0, GROUND);
    expect(feet.map((f) => f.id)).toEqual([10, 20, 1, 30]);
    expect(feet.find((f) => f.id === 31)).toBeUndefined();
  });

  it("places tops from the lane and the switch height", () => {
    const feet = propFootings(props, 0, GROUND);
    expect(feet.find((f) => f.kind === "station")).toMatchObject({
      left: 100,
      right: 130,
      top: GROUND - 20,
    });
    expect(feet.find((f) => f.kind === "switch")).toMatchObject({
      left: 400,
      right: 400 + SWITCH_WIDTH,
      top: GROUND - SWITCH_HEIGHT,
    });
  });

  it("moves belt footings with their offset", () => {
    const belt = propFootings(props, 500, GROUND).find(
      (f) => f.kind === "belt"
    );
    expect(belt).toMatchObject({
      left: 400,
      right: 400 + BELT_WIDTH,
      top: GROUND - 30,
    });
  });
});

describe("wallAhead", () => {
  const props: CourseProps = {
    ...emptyProps(),
    stations: [
      { id: 1, x: 100, width: 30, height: 20, enterable: false, exitX: 100 },
    ],
  };
  // Station top is GROUND - 20 = 185.

  it("blocks a runner whose feet are below the top", () => {
    expect(wallAhead(props, GROUND, 90, 110, 200)).toBe(100);
  });

  it("ignores a runner whose feet are above the top", () => {
    expect(wallAhead(props, GROUND, 90, 110, 180)).toBeNull();
  });

  it("ignores a box the runner has already passed", () => {
    expect(wallAhead(props, GROUND, 140, 150, 200)).toBeNull();
  });
});

describe("stationUnderFeet", () => {
  const station = {
    id: 1,
    x: 100,
    width: 30,
    height: 20,
    enterable: true,
    exitX: 900,
  };
  const props: CourseProps = { ...emptyProps(), stations: [station] };

  it("returns the enterable station the feet stand on", () => {
    expect(stationUnderFeet(props, 110, 120, GROUND - 20, GROUND)).toBe(
      station
    );
  });

  it("returns null when the station cannot be entered or was used", () => {
    const closed: CourseProps = {
      ...emptyProps(),
      stations: [{ ...station, enterable: false }],
    };
    const used: CourseProps = {
      ...emptyProps(),
      stations: [{ ...station, used: true }],
    };
    expect(stationUnderFeet(closed, 110, 120, GROUND - 20, GROUND)).toBeNull();
    expect(stationUnderFeet(used, 110, 120, GROUND - 20, GROUND)).toBeNull();
  });

  it("returns null when the feet are off the top or off to the side", () => {
    expect(stationUnderFeet(props, 110, 120, GROUND - 15, GROUND)).toBeNull();
    expect(stationUnderFeet(props, 140, 150, GROUND - 20, GROUND)).toBeNull();
  });
});

describe("generateStageProps", () => {
  it("is deterministic for the same stage and seed", () => {
    for (const stage of STAGES) {
      const layout = generateStage(stage, 42, GROUND);
      const first = generateStageProps(stage, 42, GROUND, layout);
      const second = generateStageProps(stage, 42, GROUND, layout);
      expect(first).toEqual(second);
    }
  });

  it("puts every station, plyo and switch on clear track", () => {
    for (const stage of STAGES) {
      for (const seed of SEEDS) {
        const layout = generateStage(stage, seed, GROUND);
        const { props, layout: out } = generateStageProps(
          stage,
          seed,
          GROUND,
          layout
        );
        const spots = [
          ...props.stations.map((st) => [st.x, st.x + st.width]),
          ...props.plyos.map((p) => [p.x, p.x + p.width]),
          ...props.switches.map((sw) => [sw.x, sw.x + SWITCH_WIDTH]),
        ];
        for (const [left, right] of spots) {
          expect(isOverGap(out, left)).toBe(false);
          expect(isOverGap(out, right)).toBe(false);
          expect(isFootingOverGap(out, left, right)).toBe(false);
        }
      }
    }
  });

  it("gives every stage an enterable station with an exit ahead on clear track", () => {
    for (const stage of STAGES) {
      for (const seed of SEEDS) {
        const layout = generateStage(stage, seed, GROUND);
        const { props, layout: out } = generateStageProps(
          stage,
          seed,
          GROUND,
          layout
        );
        const enterable = props.stations.filter((st) => st.enterable);
        expect(enterable.length).toBeGreaterThanOrEqual(1);
        for (const st of enterable) {
          const run = st.exitX - st.x;
          expect(run).toBeGreaterThanOrEqual(700);
          expect(run).toBeLessThanOrEqual(1100);
          expect(st.exitX).toBeLessThan(stagePoleX(stage) - 400);
          expect(isFootingOverGap(out, st.exitX, st.exitX + 40)).toBe(false);
        }
      }
    }
  });

  it("keeps the opening flat track and the run to the pole clear", () => {
    for (const stage of STAGES) {
      const layout = generateStage(stage, 7, GROUND);
      const { props } = generateStageProps(stage, 7, GROUND, layout);
      const all = [...props.stations, ...props.plyos];
      for (const item of all) {
        expect(item.x).toBeGreaterThanOrEqual(stageStartX(stage) + 450);
        expect(item.x).toBeLessThanOrEqual(stagePoleX(stage) - 400);
      }
    }
  });

  it("places belts inside gaps and removes the ledge each one replaces", () => {
    let totalBelts = 0;
    for (const stage of STAGES) {
      for (let seed = 1; seed <= 30; seed++) {
        const layout = generateStage(stage, seed, GROUND);
        const { props, layout: out } = generateStageProps(
          stage,
          seed,
          GROUND,
          layout
        );
        expect(props.belts.length).toBeLessThanOrEqual(2);
        expect(layout.ledges.length - out.ledges.length).toBe(
          props.belts.length
        );
        for (const belt of props.belts) {
          totalBelts++;
          const travel = belt.axis === "x" ? belt.range : 0;
          const gap = layout.gaps.find(
            (g) => g.x < belt.x && belt.x + travel + belt.width < g.x + g.width
          );
          expect(gap).toBeDefined();
          if (!gap) continue;
          const ledgeLeft = out.ledges.some(
            (l) => l.x >= gap.x && l.x + l.width <= gap.x + gap.width
          );
          expect(ledgeLeft).toBe(false);
          if (stage <= 2) expect(belt.axis).toBe("x");
        }
      }
    }
    expect(totalBelts).toBeGreaterThan(0);
  });

  it("places one switch on stages 2 and up and none on stage 1", () => {
    for (const seed of SEEDS) {
      const one = generateStage(1, seed, GROUND);
      expect(generateStageProps(1, seed, GROUND, one).props.switches).toEqual(
        []
      );
      for (const stage of [2, 3, 4, 5]) {
        const layout = generateStage(stage, seed, GROUND);
        const { props } = generateStageProps(stage, seed, GROUND, layout);
        expect(props.switches).toHaveLength(1);
        expect(props.switches[0]?.pressed).toBe(false);
      }
    }
  });
});

describe("appendProps and pruneProps", () => {
  it("appends both sets of props in order", () => {
    const a: CourseProps = {
      ...emptyProps(),
      plyos: [{ id: 1, x: 0, width: 22, height: 12 }],
    };
    const b: CourseProps = {
      ...emptyProps(),
      plyos: [{ id: 2, x: 50, width: 22, height: 12 }],
    };
    expect(appendProps(a, b).plyos.map((p) => p.id)).toEqual([1, 2]);
  });

  it("drops props fully behind the camera and keeps the rest", () => {
    const props: CourseProps = {
      ...emptyProps(),
      stations: [
        { id: 1, x: 0, width: 30, height: 20, enterable: false, exitX: 0 },
      ],
      plyos: [{ id: 2, x: 400, width: 22, height: 12 }],
    };
    const pruned = pruneProps(props, 100);
    expect(pruned).not.toBe(props);
    expect(pruned.stations).toEqual([]);
    expect(pruned.plyos.map((p) => p.id)).toEqual([2]);
  });

  it("returns the same object when nothing is dropped", () => {
    const props: CourseProps = {
      ...emptyProps(),
      plyos: [{ id: 2, x: 400, width: 22, height: 12 }],
    };
    expect(pruneProps(props, 100)).toBe(props);
  });

  it("counts a belt's full travel on axis x when pruning", () => {
    const axisX: CourseProps = {
      ...emptyProps(),
      belts: [{ ...sliderBelt, x: 200, range: 100 }],
    };
    const axisY: CourseProps = {
      ...emptyProps(),
      belts: [{ ...sliderBelt, x: 200, range: 100, axis: "y" }],
    };
    // Behind line is 260: the belt's right edge on axis x is 330, on axis y 230.
    expect(pruneProps(axisX, 300).belts).toHaveLength(1);
    expect(pruneProps(axisY, 300).belts).toHaveLength(0);
  });
});

describe("restDaySwap", () => {
  it("round trips back to the original course", () => {
    for (const stage of STAGES) {
      for (const seed of SEEDS) {
        const course = generateStage(stage, seed, GROUND);
        const resting = restDaySwap(course, true);
        expect(restDaySwap(resting, false)).toEqual(course);
      }
    }
  });

  it("swaps bricks and kudos on rest and leaves sync blocks alone", () => {
    const course = generateStage(3, 11, GROUND);
    const resting = restDaySwap(course, true);
    const syncBefore = course.blocks.filter((b) => b.kind === "sync");
    expect(resting.blocks.filter((b) => b.kind === "sync")).toEqual(syncBefore);
    expect(
      resting.blocks.filter((b) => b.kind === "brick" && !b.fromKudos)
    ).toEqual([]);
    expect(resting.kudos.filter((k) => !k.fromBrick)).toEqual([]);
    expect(resting.gaps).toEqual(course.gaps);
    expect(resting.ledges).toEqual(course.ledges);
    expect(resting.poles).toEqual(course.poles);
  });

  it("turns a converted brick back into a kudos on the same spot", () => {
    const course: CourseLayout = {
      gaps: [],
      ledges: [],
      blocks: [],
      kudos: [{ id: 5, x: 100, y: 150 }],
      poles: [],
    };
    const resting = restDaySwap(course, true);
    expect(resting.blocks).toEqual([
      {
        id: 5,
        x: 100 - BLOCK_SIZE / 2,
        y: 150 - BLOCK_SIZE / 2,
        kind: "brick",
        contents: "kudos",
        used: true,
        fromKudos: true,
      },
    ]);
    expect(restDaySwap(resting, false)).toEqual(course);
  });
});

describe("generateBonusRoom", () => {
  it("has a flat floor, no poles and rows of kudos", () => {
    const room = generateBonusRoom(5000, 3, GROUND);
    expect(room.gaps).toEqual([]);
    expect(room.poles).toEqual([]);
    expect(room.kudos).toHaveLength(34);
    for (const k of room.kudos) {
      expect(k.x).toBeGreaterThanOrEqual(5080);
      expect(k.x).toBeLessThanOrEqual(5580);
      expect(k.id).toBeGreaterThanOrEqual(900000);
    }
  });

  it("lays two ledges at the fixed offsets", () => {
    const room = generateBonusRoom(0, 1, GROUND);
    expect(room.ledges).toEqual([
      { x: 200, y: GROUND - 36, width: 60 },
      { x: 420, y: GROUND - 36, width: 60 },
    ]);
  });
});
