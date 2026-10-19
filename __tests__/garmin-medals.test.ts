import { describe, it, expect } from "vitest";
import { GROUND_Y, PLAYER_WIDTH } from "@/lib/garmin/engine";
import {
  BLOCK_SIZE,
  MEDAL_SIZE,
  STAGE_COUNT,
  generateStage,
  stagePoleX,
  stageStartX,
  type CourseLayout,
  type CourseMedal,
} from "@/lib/garmin/course";
import {
  generateStageProps,
  propFootings,
  type CourseProps,
} from "@/lib/garmin/props";
import {
  MEDALS_PER_STAGE,
  hideFoundMedals,
  medalHit,
  medalId,
  medalStage,
  placeStageExtras,
  stageMedalCount,
  stageMedalSlots,
} from "@/lib/garmin/medals";
import { SWIM_SURFACE_Y } from "@/lib/garmin/swim";
import { isWaterTheme, themeForStage } from "@/lib/garmin/themes";

// The pure placement of Finisher Medals, the Aid Station and secret exits
// (#2025): every stage gets three medals, each reachable, a checkpoint on clear
// lane, and secret exits only where the rules allow.

/** Seeds spread over the seed range a run draws from. */
const SEEDS = Array.from({ length: 40 }, (_, i) => 1000 + i * 7919);
const STAGES = Array.from({ length: STAGE_COUNT }, (_, i) => i + 1);

/** A stage laid out the way the engine lays it out, medals and all. */
function laid(stage: number, seed: number) {
  const theme = themeForStage(stage);
  const placed = generateStageProps(
    stage,
    seed,
    GROUND_Y,
    generateStage(stage, seed, GROUND_Y, theme),
    theme
  );
  return {
    theme,
    ...placeStageExtras(
      placed.layout,
      placed.props,
      stage,
      seed,
      GROUND_Y,
      theme,
      PLAYER_WIDTH
    ),
  };
}

/**
 * Every medal id a stage's layout hides: PR Boards, Second Wind blocks (#2026),
 * rooms and free medals. The four sources share the stage's three medals.
 */
function hiddenIds(course: CourseLayout, props: CourseProps): number[] {
  return [
    ...course.blocks.flatMap((b) =>
      b.medalId === undefined ? [] : [b.medalId]
    ),
    ...props.stations.flatMap((s) =>
      s.medalId === undefined ? [] : [s.medalId]
    ),
    ...(course.medals ?? []).map((m) => m.id),
  ];
}

/**
 * Whether the runner can stand under a free medal and jump up to it: a footing
 * (the lane clear of gaps, a ledge, a block or a prop top) lies under the
 * medal's x-range, and its top is below the medal's top by no more than a
 * ground jump rises (about 90 px with JUMP_FORCE and GRAVITY).
 */
function reachable(
  course: CourseLayout,
  props: CourseProps,
  medal: CourseMedal
): boolean {
  const left = medal.x;
  const right = medal.x + MEDAL_SIZE;
  const overGap = course.gaps.some((g) => right > g.x && left < g.x + g.width);
  const tops: number[] = overGap ? [] : [GROUND_Y];
  for (const l of course.ledges) {
    if (l.x <= left && right <= l.x + l.width) tops.push(l.y);
  }
  for (const b of course.blocks) {
    if (b.x <= left && right <= b.x + BLOCK_SIZE) tops.push(b.y);
  }
  for (const f of propFootings(props, 0, GROUND_Y)) {
    if (f.left <= left && right <= f.right) tops.push(f.top);
  }
  return tops.some((top) => top > medal.y && top - medal.y <= 90);
}

describe("medal ids", () => {
  it("a medal id is its stage times ten plus its slot, and reads back its stage", () => {
    expect(medalId(3, 2)).toBe(32);
    expect(medalStage(32)).toBe(3);
    expect(medalStage(medalId(5, 3))).toBe(5);
  });

  it("counts and slots only the found medals of the asked stage", () => {
    const found = [11, 13, 22];
    expect(stageMedalCount(found, 1)).toBe(2);
    expect(stageMedalCount(found, 2)).toBe(1);
    expect(stageMedalCount(found, 3)).toBe(0);
    expect(stageMedalCount(undefined, 1)).toBe(0);
    expect(stageMedalSlots(found, 1)).toEqual([true, false, true]);
    expect(stageMedalSlots(found, 2)).toEqual([false, true, false]);
    expect(stageMedalSlots(undefined, 4)).toEqual([false, false, false]);
    expect(MEDALS_PER_STAGE).toBe(3);
  });

  it("medalHit overlaps only when the boxes share area", () => {
    const medal = { x: 100, y: 50 };
    expect(medalHit(medal, 95, 45, 101, 55)).toBe(true);
    // Touching an edge is not overlapping.
    expect(medalHit(medal, 110, 50, 120, 60)).toBe(false);
    expect(medalHit(medal, 95, 30, 105, 50)).toBe(false);
  });
});

describe("placeStageExtras", () => {
  it.each(STAGES)(
    "stage %i hides exactly three distinct medals of its own",
    (stage) => {
      for (const seed of SEEDS) {
        const { course, props } = laid(stage, seed);
        const ids = hiddenIds(course, props).sort((a, b) => a - b);
        expect(ids).toEqual([1, 2, 3].map((slot) => medalId(stage, slot)));
      }
    }
  );

  it.each(STAGES)(
    "stage %i: every free medal can be reached by a jump",
    (stage) => {
      for (const seed of SEEDS) {
        const { course, props } = laid(stage, seed);
        for (const medal of course.medals ?? []) {
          expect(reachable(course, props, medal)).toBe(true);
        }
      }
    }
  );

  it.each(STAGES)(
    "stage %i: free medals stay clear of racks and props",
    (stage) => {
      for (const seed of SEEDS) {
        const { course, props } = laid(stage, seed);
        for (const medal of course.medals ?? []) {
          const right = medal.x + MEDAL_SIZE;
          for (const c of course.ceilings ?? []) {
            expect(right > c.x && medal.x < c.x + c.width).toBe(false);
          }
          for (const f of propFootings(props, 0, GROUND_Y)) {
            expect(right > f.left && medal.x < f.right).toBe(false);
          }
        }
      }
    }
  );

  it.each(STAGES)(
    "stage %i: a PR Board medal is a plain brick on land",
    (stage) => {
      for (const seed of SEEDS) {
        const { theme, course } = laid(stage, seed);
        const boards = course.blocks.filter((b) => b.contents === "medal");
        expect(boards.length).toBeLessThanOrEqual(1);
        for (const b of boards) {
          expect(isWaterTheme(theme)).toBe(false);
          expect(b.kind).toBe("brick");
          expect(b.contents).toBe("medal");
          expect(b.fromKudos).toBeFalsy();
        }
      }
    }
  );

  it.each(STAGES)(
    "stage %i: a bonus room medal sits behind an enterable station",
    (stage) => {
      for (const seed of SEEDS) {
        const { props } = laid(stage, seed);
        for (const st of props.stations) {
          if (st.medalId === undefined) continue;
          expect(st.enterable).toBe(true);
          expect(medalStage(st.medalId)).toBe(stage);
        }
      }
    }
  );

  it.each(STAGES)(
    "stage %i: a water stage floats no free medal above the surface",
    (stage) => {
      if (!isWaterTheme(themeForStage(stage))) return;
      for (const seed of SEEDS) {
        const { course } = laid(stage, seed);
        for (const medal of course.medals ?? []) {
          expect(medal.y).toBeGreaterThanOrEqual(SWIM_SURFACE_Y);
        }
      }
    }
  );

  it.each(STAGES)(
    "stage %i: one Aid Station checkpoint on clear lane in the second half",
    (stage) => {
      for (const seed of SEEDS) {
        const { course, props } = laid(stage, seed);
        const cps = course.checkpoints ?? [];
        expect(cps).toHaveLength(1);
        const [cp] = cps;
        expect(cp.stage).toBe(stage);
        const pole = stagePoleX(stage);
        expect(cp.x).toBeGreaterThanOrEqual((stageStartX(stage) + pole) / 2);
        expect(cp.x).toBeLessThan(pole);
        // The runner stands there with no gap or prop within reach.
        const reach = { left: cp.x - 30, right: cp.x + PLAYER_WIDTH + 30 };
        expect(
          course.gaps.some(
            (g) => reach.right > g.x && reach.left < g.x + g.width
          )
        ).toBe(false);
        for (const f of propFootings(props, 0, GROUND_Y)) {
          expect(cp.x + PLAYER_WIDTH + 8 > f.left && cp.x - 8 < f.right).toBe(
            false
          );
        }
      }
    }
  );

  it("secret exits never sit on the last stage, and only behind enterable stations", () => {
    for (const seed of SEEDS) {
      const { props } = laid(STAGE_COUNT, seed);
      expect(props.stations.some((s) => s.secretExit)).toBe(false);
    }
    for (const stage of STAGES.slice(0, STAGE_COUNT - 1)) {
      for (const seed of SEEDS) {
        const { props } = laid(stage, seed);
        for (const st of props.stations) {
          if (st.secretExit) expect(st.enterable).toBe(true);
        }
      }
    }
  });

  it("some stages before the last mark a secret exit", () => {
    const marked = STAGES.slice(0, STAGE_COUNT - 1).filter((stage) =>
      SEEDS.some((seed) =>
        laid(stage, seed).props.stations.some((s) => s.secretExit)
      )
    );
    expect(marked.length).toBeGreaterThan(0);
  });

  it("keeps the Aid Station and every course medal out of the stretch a bonus room skips", () => {
    for (const stage of STAGES) {
      for (const seed of SEEDS) {
        const { course, props } = laid(stage, seed);
        const xs = [
          ...(course.medals ?? []).map((m) => m.x),
          ...course.blocks.filter((b) => b.medalId).map((b) => b.x),
        ];
        const room = props.stations.find((st) => st.medalId !== undefined);
        for (const st of props.stations.filter((s) => s.enterable)) {
          for (const cp of course.checkpoints ?? []) {
            const inSkip = cp.x + PLAYER_WIDTH > st.x && cp.x < st.exitX;
            expect(inSkip, `stage ${stage} seed ${seed}`).toBe(false);
          }
        }
        const secret = props.stations.find((st) => st.secretExit);
        for (const x of xs) {
          if (room) {
            const inSkip = x + MEDAL_SIZE > room.x && x < room.exitX;
            expect(inSkip, `stage ${stage} seed ${seed}`).toBe(false);
          }
          // A secret exit's room never comes back, so the medals come first.
          if (secret) expect(x + MEDAL_SIZE).toBeLessThanOrEqual(secret.x);
        }
        // The shortcut starts past the Aid Station, so it skips under half.
        const cp = (course.checkpoints ?? [])[0];
        if (secret) expect(secret.x).toBeGreaterThan(cp.x);
      }
    }
  });

  it.each(STAGES)(
    "stage %i: a Second Wind block is a Sync Block with a kind, on land only",
    (stage) => {
      for (const seed of SEEDS) {
        const { theme, course } = laid(stage, seed);
        const winds = course.blocks.filter((b) => b.contents === "wind");
        if (isWaterTheme(theme)) expect(winds).toHaveLength(0);
        expect(winds.length).toBeLessThanOrEqual(1);
        for (const b of winds) {
          expect(b.kind).toBe("sync");
          expect(b.fromKudos).toBeFalsy();
          expect(b.windKind).toBeDefined();
          expect(medalStage(b.medalId ?? -1)).toBe(stage);
        }
      }
    }
  );

  it("a Second Wind block takes one of the stage's three medal slots, and no free medal copies it", () => {
    for (const stage of STAGES) {
      for (const seed of SEEDS) {
        const { course, props } = laid(stage, seed);
        const winds = course.blocks.filter((b) => b.contents === "wind");
        for (const b of winds) {
          const ids = hiddenIds(course, props);
          expect(ids.filter((id) => id === b.medalId)).toHaveLength(1);
        }
      }
    }
  });

  it("hides a Second Wind on about half of the land stages", () => {
    const landStages = STAGES.filter(
      (stage) => !isWaterTheme(themeForStage(stage))
    );
    const landDraws = landStages.flatMap((stage) =>
      SEEDS.map((seed) => laid(stage, seed))
    );
    const withWind = landDraws.filter(({ course }) =>
      course.blocks.some((b) => b.contents === "wind")
    ).length;
    const share = withWind / landDraws.length;
    expect(share).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.7);
  });

  it.each(STAGES)(
    "stage %i: a Second Wind block sits before a secret exit and out of a bonus room's skipped stretch",
    (stage) => {
      for (const seed of SEEDS) {
        const { course, props } = laid(stage, seed);
        const room = props.stations.find((st) => st.medalId !== undefined);
        const secret = props.stations.find((st) => st.secretExit);
        for (const b of course.blocks.filter((x) => x.contents === "wind")) {
          if (room) {
            const inSkip = b.x + MEDAL_SIZE > room.x && b.x < room.exitX;
            expect(inSkip, `stage ${stage} seed ${seed}`).toBe(false);
          }
          if (secret) {
            expect(
              b.x + MEDAL_SIZE,
              `stage ${stage} seed ${seed}`
            ).toBeLessThanOrEqual(secret.x - 8);
          }
        }
      }
    }
  );

  it("hides a PR Board medal only after a Protein Shake block, so any runner can break it", () => {
    for (const stage of STAGES) {
      for (const seed of SEEDS) {
        const { course } = laid(stage, seed);
        for (const b of course.blocks.filter((x) => x.contents === "medal")) {
          expect(
            course.blocks.some(
              (p) => p.kind === "sync" && p.contents === "power" && p.x < b.x
            ),
            `stage ${stage} seed ${seed}`
          ).toBe(true);
        }
      }
    }
  });

  it("lays the same stage the same way for the same seed", () => {
    expect(laid(2, SEEDS[3])).toEqual(laid(2, SEEDS[3]));
  });
});

describe("hideFoundMedals", () => {
  it("takes found free medals out and keeps the rest", () => {
    const found = SEEDS.map((seed) => laid(1, seed)).find(
      ({ course }) => (course.medals ?? []).length > 0
    );
    expect(found).toBeDefined();
    const { course, props } = found!;
    const [first] = course.medals ?? [];
    expect(first).toBeDefined();
    const hidden = hideFoundMedals(course, props, [first.id]);
    expect(hidden.course.medals ?? []).toEqual(
      (course.medals ?? []).filter((m) => m.id !== first.id)
    );
  });

  it("turns a found PR Board medal into a plain brick, still a brick", () => {
    const found = SEEDS.map((seed) => laid(1, seed)).find(({ course }) =>
      course.blocks.some((b) => b.contents === "medal")
    );
    expect(found).toBeDefined();
    const { course, props } = found!;
    const board = course.blocks.find((b) => b.contents === "medal")!;
    const hidden = hideFoundMedals(course, props, [board.medalId!]);
    const plain = hidden.course.blocks.find((b) => b.id === board.id);
    expect(plain?.kind).toBe("brick");
    expect(plain?.contents).toBe("kudos");
    expect(plain?.medalId).toBeUndefined();
  });

  it("turns a found Second Wind block into a plain Kudos sync block", () => {
    const found =
      SEEDS.map((seed) => laid(1, seed)).find(({ course }) =>
        course.blocks.some((b) => b.contents === "wind")
      ) ??
      SEEDS.map((seed) => laid(3, seed)).find(({ course }) =>
        course.blocks.some((b) => b.contents === "wind")
      );
    expect(found).toBeDefined();
    const { course, props } = found!;
    const wind = course.blocks.find((b) => b.contents === "wind")!;
    const hidden = hideFoundMedals(course, props, [wind.medalId!]);
    const plain = hidden.course.blocks.find((b) => b.id === wind.id);
    expect(plain?.kind).toBe("sync");
    expect(plain?.contents).toBe("kudos");
    expect(plain?.medalId).toBeUndefined();
    expect(plain?.windKind).toBeUndefined();
  });

  it("clears a found station's medal from its bonus room", () => {
    const found = SEEDS.map((seed) => laid(2, seed)).find(({ props }) =>
      props.stations.some((s) => s.medalId !== undefined)
    );
    expect(found).toBeDefined();
    const { course, props } = found!;
    const station = props.stations.find((s) => s.medalId !== undefined)!;
    const hidden = hideFoundMedals(course, props, [station.medalId!]);
    const next = hidden.props.stations.find((s) => s.id === station.id);
    expect(next?.medalId).toBeUndefined();
    expect(next?.enterable).toBe(station.enterable);
  });

  it("returns the same course and props when nothing is found, and never mutates", () => {
    const { course, props } = laid(3, SEEDS[1]);
    const before = JSON.stringify([course, props]);
    const none = hideFoundMedals(course, props, []);
    expect(none.course).toBe(course);
    expect(none.props).toBe(props);
    expect(hideFoundMedals(course, props, undefined).course).toBe(course);
    const first = (course.medals ?? [])[0];
    if (first) hideFoundMedals(course, props, [first.id]);
    expect(JSON.stringify([course, props])).toBe(before);
  });
});
