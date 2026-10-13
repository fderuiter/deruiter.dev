import { describe, it, expect } from "vitest";
import {
  BLOCK_SIZE,
  EMPTY_COURSE,
  KUDOS_RADIUS,
  appendCourse,
  generateStage,
  pruneCourse,
  stagePoleX,
  stageStartX,
  type CourseLayout,
} from "@/lib/garmin-course";
import {
  BUOY_PERIOD_MS,
  BUOY_RANGE,
  BUOY_WIDTH,
  generateBonusRoom,
  generateStageProps,
  restDaySwap,
  type CourseProps,
} from "@/lib/garmin-props";
import { BASE_HEIGHT } from "@/lib/garmin-powerups";
import { BUOY_Y } from "@/lib/garmin-swim";
import {
  STAGE_THEMES,
  isWaterTheme,
  themeForStage,
  type StageTheme,
} from "@/lib/garmin-themes";

/** Lane top used by the engine (GROUND_Y in lib/garmin-engine.ts). */
const GROUND_Y = 205;
const STAGES = [1, 2, 3, 4, 5];
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

/** FNV-1a 32-bit over the JSON text, as a stable checksum. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Checksums of the track output (layout, props and the belt-trimmed layout)
 * captured before the theme work landed, for seeds 1, 7 and 20 on stages 1-5.
 */
const TRACK_CHECKSUMS: Record<string, string> = {
  "1:1": "392095fa",
  "2:1": "7b03c080",
  "3:1": "6c91e0db",
  "4:1": "3300b87f",
  "5:1": "dd07eb77",
  "1:7": "7600292a",
  "2:7": "0e6a26cb",
  "3:7": "663404e9",
  "4:7": "3222445d",
  "5:7": "15b24e03",
  "1:20": "497455b6",
  "2:20": "d1054cae",
  "3:20": "118d992f",
  "4:20": "0929e677",
  "5:20": "9cd86761",
};

/** The layout and props for one stage, seed and theme, as the engine lays them out. */
/**
 * A layout without the land-stage extras of #2024 (the buddy block and the
 * medicine balls), which come from their own random stream: what is left
 * must match the pre-theme output byte for byte.
 */
function withoutExtras(layout: CourseLayout): CourseLayout {
  const { medBalls: _medBalls, ...rest } = layout;
  return {
    ...rest,
    blocks: rest.blocks.map((b) =>
      b.contents === "buddy" ? { ...b, contents: "kudos" as const } : b
    ),
  };
}

function build(stage: number, seed: number, theme: StageTheme) {
  const layout = withoutExtras(generateStage(stage, seed, GROUND_Y, theme));
  const { props, layout: trimmed } = generateStageProps(
    stage,
    seed,
    GROUND_Y,
    layout,
    theme
  );
  return { layout, props, trimmed };
}

/** Horizontal overlap test between a feature span and a candidate [x, x+w], with the 40 px margin. */
function nearby(left: number, right: number, x: number, width: number) {
  return left < x + width + 40 && right > x - 40;
}

describe("themeForStage and isWaterTheme", () => {
  it("maps stages 1 to 5 to their themes", () => {
    expect([1, 2, 3, 4, 5].map(themeForStage)).toEqual([
      "track",
      "pool",
      "basement-gym",
      "open-water",
      "track",
    ]);
    expect(STAGE_THEMES).toHaveLength(5);
  });

  it("falls back to track for 0, 6, negative and NaN stages", () => {
    expect(themeForStage(0)).toBe("track");
    expect(themeForStage(6)).toBe("track");
    expect(themeForStage(-1)).toBe("track");
    expect(themeForStage(Number.NaN)).toBe("track");
    expect(themeForStage(Number.POSITIVE_INFINITY)).toBe("track");
  });

  it("reads fractional stages by their whole part", () => {
    expect(themeForStage(2.7)).toBe("pool");
  });

  it("marks only pool and open-water as water", () => {
    expect(isWaterTheme("pool")).toBe(true);
    expect(isWaterTheme("open-water")).toBe(true);
    expect(isWaterTheme("track")).toBe(false);
    expect(isWaterTheme("basement-gym")).toBe(false);
  });
});

describe("track output", () => {
  it("matches the pre-theme checksums byte for byte", () => {
    for (const [key, expected] of Object.entries(TRACK_CHECKSUMS)) {
      const [stage, seed] = key.split(":").map(Number);
      const { layout, props, trimmed } = build(stage, seed, "track");
      const text = JSON.stringify({ layout, props, layoutAfter: trimmed });
      expect(fnv1a(text), key).toBe(expected);
    }
  });

  it("is the same whether the theme is passed or defaulted", () => {
    for (const stage of STAGES) {
      for (const seed of [1, 7, 20]) {
        expect(generateStage(stage, seed, GROUND_Y, "track")).toEqual(
          generateStage(stage, seed, GROUND_Y)
        );
      }
    }
  });

  it("carries no ceilings or currents keys", () => {
    for (const stage of STAGES) {
      const layout = generateStage(stage, 3, GROUND_Y);
      expect(layout).not.toHaveProperty("ceilings");
      expect(layout).not.toHaveProperty("currents");
    }
  });
});

describe("basement gym ceilings", () => {
  const counts: number[] = [];

  it("places between zero and three racks per stage", () => {
    for (const stage of STAGES) {
      for (const seed of SEEDS) {
        const layout = generateStage(stage, seed, GROUND_Y, "basement-gym");
        const n = layout.ceilings?.length ?? 0;
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(3);
        counts.push(n);
      }
    }
    expect(Math.max(...counts)).toBe(3);
  });

  it("sets each rack's bottom to the runner's top minus 3 px", () => {
    expect(GROUND_Y - BASE_HEIGHT - 3).toBe(178);
    for (const seed of SEEDS) {
      const layout = generateStage(3, seed, GROUND_Y, "basement-gym");
      for (const c of layout.ceilings ?? []) {
        expect(c.bottom).toBe(GROUND_Y - BASE_HEIGHT - 3);
      }
    }
  });

  it("keeps racks 96 to 140 px wide inside the stage span", () => {
    for (const stage of STAGES) {
      for (const seed of SEEDS) {
        const layout = generateStage(stage, seed, GROUND_Y, "basement-gym");
        const lo = stageStartX(stage) + 450;
        const hi = stagePoleX(stage) - 400;
        for (const c of layout.ceilings ?? []) {
          expect(c.width).toBeGreaterThanOrEqual(96);
          expect(c.width).toBeLessThanOrEqual(140);
          expect(c.x).toBeGreaterThanOrEqual(lo);
          expect(c.x + c.width).toBeLessThanOrEqual(hi);
        }
      }
    }
  });

  it("clears every gap, ledge, block, Kudos and the pole by 40 px", () => {
    for (const stage of STAGES) {
      for (const seed of SEEDS) {
        const layout = generateStage(stage, seed, GROUND_Y, "basement-gym");
        for (const c of layout.ceilings ?? []) {
          const spans = [
            ...layout.gaps.map((g) => [g.x, g.x + g.width]),
            ...layout.ledges.map((l) => [l.x, l.x + l.width]),
            ...layout.blocks.map((b) => [b.x, b.x + BLOCK_SIZE]),
            ...layout.kudos.map((k) => [
              k.x - KUDOS_RADIUS,
              k.x + KUDOS_RADIUS,
            ]),
            ...layout.poles.map((p) => [p.x, p.x + 20]),
          ];
          for (const [left, right] of spans) {
            expect(nearby(left, right, c.x, c.width)).toBe(false);
          }
        }
      }
    }
  });

  it("keeps the racks apart from one another", () => {
    for (const seed of SEEDS) {
      const ceilings =
        generateStage(4, seed, GROUND_Y, "basement-gym").ceilings ?? [];
      for (let i = 0; i < ceilings.length; i++) {
        for (let j = i + 1; j < ceilings.length; j++) {
          const a = ceilings[i];
          const b = ceilings[j];
          expect(nearby(a.x, a.x + a.width, b.x, b.width)).toBe(false);
        }
      }
    }
  });

  it("is deterministic and leaves the rest of the gym stage as track", () => {
    for (const stage of STAGES) {
      for (const seed of SEEDS) {
        const gym = generateStage(stage, seed, GROUND_Y, "basement-gym");
        expect(generateStage(stage, seed, GROUND_Y, "basement-gym")).toEqual(
          gym
        );
        const { ceilings, ...rest } = withoutExtras(gym);
        expect(ceilings).toBeDefined();
        // The medicine balls also keep clear of the racks, so they are
        // compared apart from the track layout.
        expect(rest).toEqual(
          withoutExtras(generateStage(stage, seed, GROUND_Y))
        );
      }
    }
  });

  it("keeps plyo boxes, stations and switches out from under racks", () => {
    for (const stage of STAGES) {
      for (const seed of SEEDS) {
        const { props, trimmed } = build(stage, seed, "basement-gym");
        const boxes = [
          ...props.stations.map((p) => ({ x: p.x, w: p.width })),
          ...props.plyos.map((p) => ({ x: p.x, w: p.width })),
          ...props.switches.map((s) => ({ x: s.x, w: 16 })),
        ];
        for (const c of trimmed.ceilings ?? []) {
          for (const box of boxes) {
            expect(nearby(box.x, box.x + box.w, c.x, c.width)).toBe(false);
          }
        }
      }
    }
  });
});

describe("open water currents", () => {
  it("places two or three zones, alternating with the first positive", () => {
    for (const stage of STAGES) {
      for (const seed of SEEDS) {
        const currents =
          generateStage(stage, seed, GROUND_Y, "open-water").currents ?? [];
        expect(currents.length).toBeGreaterThanOrEqual(2);
        expect(currents.length).toBeLessThanOrEqual(3);
        currents.forEach((c, i) => {
          expect(c.flow).toBeCloseTo(i % 2 === 0 ? 0.09 : -0.09, 12);
        });
      }
    }
  });

  it("keeps each zone 160 to 260 px wide, 40 px apart and clear of the pole", () => {
    for (const stage of STAGES) {
      for (const seed of SEEDS) {
        const currents =
          generateStage(stage, seed, GROUND_Y, "open-water").currents ?? [];
        for (const c of currents) {
          expect(c.width).toBeGreaterThanOrEqual(160);
          expect(c.width).toBeLessThanOrEqual(260);
          expect(c.x + c.width).toBeLessThanOrEqual(stagePoleX(stage) - 400);
        }
        for (let i = 0; i < currents.length; i++) {
          for (let j = i + 1; j < currents.length; j++) {
            const a = currents[i];
            const b = currents[j];
            expect(nearby(a.x, a.x + a.width, b.x, b.width)).toBe(false);
          }
        }
      }
    }
  });

  it("is present only on open water", () => {
    for (const theme of ["track", "pool", "basement-gym"] as const) {
      expect(generateStage(4, 5, GROUND_Y, theme)).not.toHaveProperty(
        "currents"
      );
    }
  });
});

describe("open water buoys", () => {
  it("places two to four buoys as y-axis belts with the buoy flag", () => {
    expect(BUOY_Y).toBe(96 + BASE_HEIGHT);
    for (const stage of STAGES) {
      for (const seed of SEEDS) {
        const { props } = build(stage, seed, "open-water");
        const buoys = props.belts.filter((b) => b.buoy === true);
        expect(buoys.length).toBeGreaterThanOrEqual(2);
        expect(buoys.length).toBeLessThanOrEqual(4);
        expect(buoys).toHaveLength(props.belts.length);
        for (const b of buoys) {
          expect(b.axis).toBe("y");
          expect(b.range).toBe(BUOY_RANGE);
          expect(b.range).toBe(8);
          expect(b.periodMs).toBe(BUOY_PERIOD_MS);
          expect(b.periodMs).toBe(2400);
          expect(b.width).toBe(BUOY_WIDTH);
          expect(b.width).toBe(30);
          expect(b.y).toBe(BUOY_Y);
        }
      }
    }
  });

  it("never appears on other themes", () => {
    for (const theme of ["track", "pool", "basement-gym"] as const) {
      for (const seed of SEEDS) {
        const { props } = build(4, seed, theme);
        expect(props.belts.some((b) => b.buoy === true)).toBe(false);
      }
    }
  });

  it("replaces no gap with a belt on water stages", () => {
    for (const seed of SEEDS) {
      const pool = build(2, seed, "pool");
      expect(pool.props.belts).toHaveLength(0);
      expect(pool.trimmed.ledges).toEqual(pool.layout.ledges);
      const water = build(4, seed, "open-water");
      expect(water.props.belts.every((b) => b.buoy === true)).toBe(true);
    }
  });
});

describe("suit blocks", () => {
  const contentsOf = (
    stage: number,
    seed: number,
    theme: StageTheme
  ): string[] =>
    generateStage(stage, seed, GROUND_Y, theme).blocks.map((b) => b.contents);

  it("gives water stages a suit where track stages give a cape", () => {
    let suits = 0;
    for (const theme of ["pool", "open-water"] as const) {
      for (const stage of [2, 4]) {
        for (const seed of SEEDS) {
          const got = contentsOf(stage, seed, theme);
          expect(got).not.toContain("cape");
          suits += got.filter((c) => c === "suit").length;
        }
      }
    }
    expect(suits).toBeGreaterThan(0);
  });

  it("never gives track or gym stages a suit", () => {
    for (const theme of ["track", "basement-gym"] as const) {
      for (const seed of SEEDS) {
        expect(contentsOf(2, seed, theme)).not.toContain("suit");
      }
    }
  });

  it("draws the same power blocks on water as on track, changing only the string", () => {
    for (const seed of SEEDS) {
      const track = generateStage(2, seed, GROUND_Y);
      const pool = generateStage(2, seed, GROUND_Y, "pool");
      expect(pool.blocks.map((b) => ({ ...b, contents: "x" }))).toEqual(
        track.blocks.map((b) => ({ ...b, contents: "x" }))
      );
      expect(pool.gaps).toEqual(track.gaps);
      expect(pool.kudos).toEqual(track.kudos);
    }
  });
});

describe("course helpers keep ceilings and currents", () => {
  const gym: CourseLayout = generateStage(3, 4, GROUND_Y, "basement-gym");
  const open: CourseLayout = generateStage(4, 4, GROUND_Y, "open-water");

  it("appendCourse joins ceilings and currents, and omits them when neither side has them", () => {
    expect(appendCourse(gym, EMPTY_COURSE).ceilings).toEqual(gym.ceilings);
    expect(appendCourse(EMPTY_COURSE, gym).ceilings).toEqual(gym.ceilings);
    expect(appendCourse(gym, gym).ceilings).toHaveLength(
      (gym.ceilings?.length ?? 0) * 2
    );
    expect(appendCourse(open, EMPTY_COURSE).currents).toEqual(open.currents);
    const plain = appendCourse(EMPTY_COURSE, EMPTY_COURSE);
    expect(plain).not.toHaveProperty("ceilings");
    expect(plain).not.toHaveProperty("currents");
    expect(plain).toEqual(EMPTY_COURSE);
  });

  it("pruneCourse drops racks and zones fully behind the camera", () => {
    expect(pruneCourse(gym, 0)).toBe(gym);
    const last = gym.ceilings?.[gym.ceilings.length - 1];
    const cameraX = last ? last.x + last.width + 100 : 0;
    const pruned = pruneCourse(gym, cameraX);
    expect(pruned.ceilings ?? []).toEqual(
      (gym.ceilings ?? []).filter((c) => c.x + c.width > cameraX - 40)
    );
    expect(pruneCourse(open, 0)).toBe(open);
    const cut = pruneCourse(open, stagePoleX(4));
    expect(cut.currents).toEqual(
      (open.currents ?? []).filter((c) => c.x + c.width > stagePoleX(4) - 40)
    );
    expect(pruneCourse(EMPTY_COURSE, 5000)).toBe(EMPTY_COURSE);
  });

  it("restDaySwap keeps racks and zones in both directions", () => {
    expect(restDaySwap(gym, true).ceilings).toEqual(gym.ceilings);
    expect(restDaySwap(gym, false).ceilings).toEqual(gym.ceilings);
    expect(restDaySwap(open, true).currents).toEqual(open.currents);
    expect(restDaySwap(open, false).currents).toEqual(open.currents);
    expect(restDaySwap(EMPTY_COURSE, true)).not.toHaveProperty("ceilings");
  });

  it("bonus rooms carry neither racks nor zones", () => {
    const room = generateBonusRoom(1000, 3, GROUND_Y);
    expect(room).not.toHaveProperty("ceilings");
    expect(room).not.toHaveProperty("currents");
  });
});

describe("generateStageProps theme parameter", () => {
  it("defaults to track output", () => {
    const layout = generateStage(2, 9, GROUND_Y);
    const withDefault = generateStageProps(2, 9, GROUND_Y, layout);
    const explicit = generateStageProps(2, 9, GROUND_Y, layout, "track");
    expect(explicit).toEqual(withDefault);
  });

  it("keeps stations on every theme", () => {
    for (const theme of STAGE_THEMES) {
      const layout = generateStage(2, 2, GROUND_Y, theme);
      const { props }: { props: CourseProps } = generateStageProps(
        2,
        2,
        GROUND_Y,
        layout,
        theme
      );
      expect(props.stations.length).toBeGreaterThan(0);
    }
  });
});
