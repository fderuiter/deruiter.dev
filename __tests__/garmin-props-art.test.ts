// @vitest-environment node
// Monkey C Mayhem prop art (#1992): the Water Stations, Plyo Boxes, Treadmill
// Belts and Rest Day Switch draw on the lane, a bonus room replaces the sky,
// and the rest-day countdown pill reads its seconds.
import { fromAny } from "@total-typescript/shoehorn";
import { describe, it, expect, vi } from "vitest";
import {
  CANVAS_SIZE,
  GROUND_Y,
  createInitialState,
  startGame,
  type GameEngineState,
} from "@/lib/garmin-engine";
import { EMPTY_COURSE } from "@/lib/garmin-course";
import type { CourseProps } from "@/lib/garmin-props";
import { renderWatchFace } from "@/components/garmin-watch/watch-face-art";

/** A recording 2D context: its fillRect and fillText calls are spies. */
function spyCtx() {
  const state: Record<string, unknown> = {
    font: "10px monospace",
    textAlign: "start",
  };
  const fillRect = vi.fn();
  const fillText = vi.fn();
  const gradient = { addColorStop: vi.fn() };
  const ctx = fromAny<CanvasRenderingContext2D, unknown>(
    new Proxy(state, {
      get(target, key: string) {
        if (key in target) return target[key];
        if (key === "fillRect") return fillRect;
        if (key === "fillText") return fillText;
        if (key === "measureText") {
          return (value: string) => ({ width: value.length * 6 });
        }
        if (key === "createLinearGradient" || key === "createRadialGradient") {
          return () => gradient;
        }
        return () => {};
      },
      set(target, key: string, value) {
        target[key] = value;
        return true;
      },
    })
  );
  return { ctx, fillRect, fillText };
}

const PROPS: CourseProps = {
  stations: [
    { id: 1, x: 30, width: 50, height: 24, enterable: true, exitX: 0 },
    {
      id: 2,
      x: 150,
      width: 50,
      height: 24,
      enterable: true,
      exitX: 0,
      used: true,
    },
  ],
  plyos: [{ id: 3, x: 110, width: 20, height: 14 }],
  belts: [
    {
      id: 4,
      x: 200,
      y: GROUND_Y - 30,
      width: 40,
      axis: "x",
      range: 30,
      periodMs: 2000,
    },
    {
      id: 5,
      x: 20,
      y: GROUND_Y - 60,
      width: 30,
      axis: "y",
      range: 20,
      periodMs: 1500,
    },
  ],
  switches: [
    { id: 6, x: 90, pressed: false },
    { id: 7, x: 230, pressed: true },
  ],
};

function running(over: Partial<GameEngineState> = {}): GameEngineState {
  return {
    ...startGame(createInitialState("fenix", 0), "fenix"),
    obstacles: [],
    distanceMeters: 0,
    props: PROPS,
    propClockMs: 750,
    ...over,
  };
}

describe("garmin prop art", () => {
  it("draws every prop kind without throwing and paints rects", () => {
    const { ctx, fillRect } = spyCtx();
    expect(() => renderWatchFace(ctx, running())).not.toThrow();
    expect(fillRect.mock.calls.length).toBeGreaterThan(20);
    // The unused, enterable station's table top spans its full width.
    const tableTops = fillRect.mock.calls.filter(
      ([x, , w, h]) => x === 30 && w === 50 && h === 3
    );
    expect(tableTops.length).toBe(1);
    // The Plyo Box fills from the lane up to its height.
    const plyo = fillRect.mock.calls.filter(
      ([x, y, w, h]) => x === 110 && w === 20 && y === GROUND_Y - 14 && h === 14
    );
    expect(plyo.length).toBe(1);
  });

  it("skips props that are fully off screen", () => {
    const { ctx, fillRect } = spyCtx();
    const far: CourseProps = {
      stations: [
        { id: 9, x: 900, width: 50, height: 24, enterable: true, exitX: 0 },
      ],
      plyos: [{ id: 10, x: -400, width: 20, height: 14 }],
      belts: [],
      switches: [{ id: 11, x: 600, pressed: false }],
    };
    renderWatchFace(ctx, running({ props: far }));
    const onScreenTable = fillRect.mock.calls.some(
      ([x, , w, h]) => x === 900 && w === 50 && h === 3
    );
    expect(onScreenTable).toBe(false);
  });

  it("keeps belt tread lines inside the slab width", () => {
    const { ctx, fillRect } = spyCtx();
    renderWatchFace(ctx, running());
    const treads = fillRect.mock.calls.filter(
      ([x, , w]) => w === 1.5 && x >= 200 && x <= 240
    );
    expect(treads.length).toBeGreaterThan(0);
    for (const [x] of treads) {
      expect(x).toBeLessThan(240);
    }
  });

  it("draws the rest-day countdown pill while a rest day runs", () => {
    const { ctx, fillText } = spyCtx();
    renderWatchFace(ctx, running({ restDayMs: 3000 }));
    const texts = fillText.mock.calls.map(([value]) => value);
    expect(texts).toContain("REST DAY 3s");
  });

  it("leaves the rest-day pill off when no rest day runs", () => {
    const { ctx, fillText } = spyCtx();
    renderWatchFace(ctx, running({ restDayMs: 0 }));
    const texts = fillText.mock.calls.map(([value]) => value);
    expect(texts.some((value) => String(value).startsWith("REST DAY"))).toBe(
      false
    );
  });

  it("draws the bonus room backdrop in place of the sky", () => {
    const { ctx, fillRect } = spyCtx();
    expect(() =>
      renderWatchFace(
        ctx,
        running({
          bonusRoom: {
            returnCourse: EMPTY_COURSE,
            returnFoes: [],
            returnPickups: [],
            returnProps: { stations: [], plyos: [], belts: [], switches: [] },
            exitX: 0,
            endX: 400,
          },
        })
      )
    ).not.toThrow();
    const wall = fillRect.mock.calls.some(
      ([x, y, w, h]) =>
        x === 0 && y === 0 && w === CANVAS_SIZE && h === GROUND_Y
    );
    expect(wall).toBe(true);
  });

  it("marks brick blocks as PR boards with a plate", () => {
    const { ctx, fillRect } = spyCtx();
    const course = {
      ...EMPTY_COURSE,
      blocks: [
        {
          id: 1,
          x: 100,
          y: 120,
          kind: "brick" as const,
          contents: "kudos" as const,
          used: false,
        },
      ],
    };
    renderWatchFace(ctx, running({ course, props: undefined }));
    const plate = fillRect.mock.calls.some(
      ([x, y, w, h]) => x === 102 && y === 122 && w === 5 && h === 2.5
    );
    expect(plate).toBe(true);
  });

  it("renders with the rest day and bonus room together without throwing", () => {
    const { ctx } = spyCtx();
    expect(() =>
      renderWatchFace(
        ctx,
        running({
          restDayMs: 3000,
          bonusRoom: {
            returnCourse: EMPTY_COURSE,
            returnFoes: [],
            returnPickups: [],
            returnProps: PROPS,
            exitX: 0,
            endX: 400,
          },
        })
      )
    ).not.toThrow();
  });
});
