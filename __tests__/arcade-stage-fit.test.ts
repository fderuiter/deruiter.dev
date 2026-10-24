// @vitest-environment node
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  MAX_CANVAS_DPR,
  capStageDpr,
  computeStageFit,
  mapClientToStage,
  mapStageToClient,
  screenToGameCoords,
  stageSnapStep,
  stageViewportMetrics,
  type StageAspect,
  type StageFitOptions,
} from "@/lib/arcade";

// Retro Labyrinth's logical canvas: 15x9 tiles of 16 art pixels.
const MAZE: StageAspect = { width: 240, height: 144 };
const integer = (extra: Partial<StageFitOptions> = {}): StageFitOptions => ({
  aspect: MAZE,
  scale: "integer",
  maxDpr: Number.POSITIVE_INFINITY,
  ...extra,
});
const fractional = (extra: Partial<StageFitOptions> = {}): StageFitOptions => ({
  aspect: MAZE,
  scale: "fractional",
  maxDpr: Number.POSITIVE_INFINITY,
  ...extra,
});

describe("computeStageFit: integer scale", () => {
  it("picks the largest whole scale that fits", () => {
    const fit = computeStageFit({ width: 773, height: 464 }, 1, integer());
    expect(fit.scale).toBe(3);
    expect(fit.backingWidth).toBe(720);
    expect(fit.backingHeight).toBe(432);
    expect(fit.cssWidth).toBe(720);
    expect(fit.cssHeight).toBe(432);
    expect(fit.step).toBe(0);
  });

  it("counts device pixels, so a 2x screen doubles the scale", () => {
    const fit = computeStageFit({ width: 773, height: 464 }, 2, integer());
    expect(fit.scale).toBe(6);
    expect(fit.cssWidth * 2).toBe(fit.backingWidth);
    const oneAndHalf = computeStageFit(
      { width: 773, height: 464 },
      1.5,
      integer()
    );
    expect(Number.isInteger(oneAndHalf.scale)).toBe(true);
    expect(oneAndHalf.cssWidth * 1.5).toBeCloseTo(oneAndHalf.backingWidth);
  });

  it("is limited by the shorter side, and keeps an exact multiple", () => {
    expect(
      computeStageFit({ width: 2000, height: 300 }, 1, integer()).scale
    ).toBe(2);
    expect(
      computeStageFit({ width: 480, height: 288 }, 1, integer()).scale
    ).toBe(2);
  });

  it("keeps 1x detail in a slot too small for it, shrunk into the slot", () => {
    const fit = computeStageFit({ width: 200, height: 100 }, 1, integer());
    expect(fit.scale).toBe(1);
    expect(fit.backingWidth).toBe(240);
    expect(fit.cssHeight).toBeLessThanOrEqual(100);
    expect(fit.cssWidth).toBeCloseTo((100 * 240) / 144);
  });

  it("raises the floor to minScale, rounded up", () => {
    const fit = computeStageFit(
      { width: 500, height: 300 },
      1,
      integer({ minScale: 2.2 })
    );
    expect(fit.scale).toBe(3);
    expect(fit.cssWidth).toBeLessThanOrEqual(500);
  });

  it("caps the device pixel ratio at the default of 2", () => {
    const fit = computeStageFit({ width: 800, height: 480 }, 3, {
      aspect: MAZE,
      scale: "integer",
    });
    expect(fit.dpr).toBe(MAX_CANVAS_DPR);
    expect(fit.backingWidth / fit.cssWidth).toBe(2);
  });
});

describe("computeStageFit: fractional scale", () => {
  it("fills a box that is short of width at the game's shape", () => {
    const fit = computeStageFit({ width: 500, height: 320 }, 2, fractional());
    expect(fit.cssWidth).toBe(500);
    expect(fit.cssHeight).toBe(300);
    expect(fit.backingWidth).toBe(1000);
    expect(fit.backingHeight).toBe(600);
    expect(fit.step).toBe(5);
  });

  it("snaps the width to the 5px step of a 5:3 game", () => {
    const fit = computeStageFit({ width: 316, height: 264 }, 2, fractional());
    expect(fit.cssWidth).toBe(315);
    expect(fit.cssHeight).toBeCloseTo(189, 6);
  });

  it("follows the device past 2x when the cap is lifted", () => {
    const fit = computeStageFit({ width: 600, height: 290 }, 3, fractional());
    expect(fit.cssWidth).toBe(480);
    expect(fit.backingWidth).toBe(1440);
    const capped = computeStageFit({ width: 600, height: 290 }, 3, {
      aspect: MAZE,
      scale: "fractional",
    });
    expect(capped.backingWidth).toBe(960);
  });

  it("returns an empty box for a zero slot and tolerates bad input", () => {
    expect(
      computeStageFit({ width: 0, height: 100 }, 2, fractional()).cssWidth
    ).toBe(0);
    const bad = computeStageFit(
      { width: Number.NaN, height: 100 },
      Number.NaN,
      fractional()
    );
    expect(bad.cssWidth).toBe(0);
    expect(bad.dpr).toBe(1);
  });

  it("keeps backing-store detail at minScale in a small slot", () => {
    const fit = computeStageFit(
      { width: 100, height: 100 },
      1,
      fractional({ minScale: 1 })
    );
    expect(fit.cssWidth).toBe(100);
    expect(fit.backingWidth).toBe(240);
    expect(fit.backingHeight).toBe(144);
    expect(fit.scale).toBe(1);
  });
});

describe("stageSnapStep and capStageDpr", () => {
  it("finds the smallest whole width with a whole height", () => {
    expect(stageSnapStep(MAZE)).toBe(5);
    expect(stageSnapStep({ width: 16, height: 9 })).toBe(16);
    expect(stageSnapStep({ width: 1, height: 1 })).toBe(1);
  });

  it("falls back to 1px for wide steps and fractional aspects", () => {
    expect(stageSnapStep({ width: 1366, height: 768 })).toBe(1);
    expect(stageSnapStep({ width: 4.5, height: 3 })).toBe(1);
    expect(stageSnapStep({ width: Number.NaN, height: 0 })).toBe(1);
  });

  it("caps the ratio, defaults bad input, and keeps a ratio below 1", () => {
    expect(capStageDpr(3)).toBe(2);
    expect(capStageDpr(3, 2.5)).toBe(2.5);
    expect(capStageDpr(3, Number.POSITIVE_INFINITY)).toBe(3);
    expect(capStageDpr(Number.NaN)).toBe(1);
    expect(capStageDpr(0)).toBe(1);
    expect(capStageDpr(2, Number.NaN)).toBe(2);
    expect(capStageDpr(0.5)).toBe(0.5);
  });
});

describe("pointer mapping", () => {
  const rect = { left: 10, top: 20, width: 480, height: 288 };

  it("maps client pixels to game units", () => {
    expect(mapClientToStage(10, 20, rect, MAZE)).toEqual({
      x: 0,
      y: 0,
      inside: true,
    });
    expect(mapClientToStage(250, 164, rect, MAZE)).toEqual({
      x: 120,
      y: 72,
      inside: true,
    });
  });

  it("flags points off the game", () => {
    expect(mapClientToStage(5, 20, rect, MAZE)?.inside).toBe(false);
    expect(mapClientToStage(490, 20, rect, MAZE)?.inside).toBe(false);
  });

  it("returns null for an empty rect and never NaN", () => {
    expect(mapClientToStage(1, 1, { ...rect, width: 0 }, MAZE)).toBeNull();
    expect(
      mapStageToClient(1, 1, { ...rect, height: Number.NaN }, MAZE)
    ).toBeNull();
    const point = mapClientToStage(Number.NaN, Number.NaN, rect, MAZE);
    expect(Number.isFinite(point?.x)).toBe(true);
    expect(Number.isFinite(point?.y)).toBe(true);
  });

  it("agrees with screenToGameCoords on the same metrics", () => {
    const metrics = stageViewportMetrics(rect, MAZE, 2);
    expect(metrics.scale).toBe(2);
    expect(metrics.internalWidth).toBe(960);
    const direct = screenToGameCoords(130, 80, rect, metrics);
    const mapped = mapClientToStage(130, 80, rect, MAZE);
    expect(mapped?.x).toBe(direct.x);
    expect(mapped?.y).toBe(direct.y);
  });

  it("round-trips game points through client pixels", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 240, noNaN: true }),
        fc.double({ min: 0, max: 144, noNaN: true }),
        fc.double({ min: 1, max: 4000, noNaN: true }),
        (x, y, width) => {
          const box = { left: 3, top: 7, width, height: (width * 144) / 240 };
          const client = mapStageToClient(x, y, box, MAZE);
          const back =
            client && mapClientToStage(client.x, client.y, box, MAZE);
          expect(back?.x).toBeCloseTo(x, 6);
          expect(back?.y).toBeCloseTo(y, 6);
        }
      )
    );
  });
});

describe("computeStageFit properties", () => {
  const slotSide = fc.oneof(
    fc.double({ min: 0, max: 5000, noNaN: true }),
    fc.constantFrom(0, 0.25, 1, Number.NaN, -10, Number.POSITIVE_INFINITY)
  );
  const dprValue = fc.oneof(
    fc.double({ min: 0.25, max: 5, noNaN: true }),
    fc.constantFrom(0, -1, Number.NaN, 1, 2, 3)
  );
  const aspect = fc.record({
    width: fc.integer({ min: 1, max: 2000 }),
    height: fc.integer({ min: 1, max: 2000 }),
  });
  const options = fc.record({
    aspect,
    scale: fc.constantFrom<"integer" | "fractional">("integer", "fractional"),
    maxDpr: fc.constantFrom(1, 1.5, 2, 3, Number.POSITIVE_INFINITY),
    minScale: fc.option(fc.double({ min: 0, max: 4, noNaN: true }), {
      nil: undefined,
    }),
  });

  it("never exceeds the slot and never returns NaN", () => {
    fc.assert(
      fc.property(slotSide, slotSide, dprValue, options, (w, h, dpr, opts) => {
        const fit = computeStageFit({ width: w, height: h }, dpr, opts);
        for (const value of Object.values(fit)) {
          expect(Number.isFinite(value)).toBe(true);
        }
        const slotW = Number.isFinite(w) ? Math.max(0, w) : 0;
        const slotH = Number.isFinite(h) ? Math.max(0, h) : 0;
        expect(fit.cssWidth).toBeGreaterThanOrEqual(0);
        expect(fit.cssHeight).toBeGreaterThanOrEqual(0);
        expect(fit.cssWidth).toBeLessThanOrEqual(slotW + 1e-9);
        expect(fit.cssHeight).toBeLessThanOrEqual(slotH + 1e-9);
      })
    );
  });

  it("keeps the aspect within rounding", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 50, max: 5000, noNaN: true }),
        fc.double({ min: 50, max: 5000, noNaN: true }),
        dprValue,
        options,
        (w, h, dpr, opts) => {
          const fit = computeStageFit({ width: w, height: h }, dpr, opts);
          if (fit.cssWidth < 1 || fit.cssHeight < 1) return;
          const ratio = opts.aspect.width / opts.aspect.height;
          // A box clamped to the slot by a hair can lose at most a fraction
          // of a pixel on one side.
          expect(
            Math.abs(fit.cssWidth / ratio - fit.cssHeight)
          ).toBeLessThanOrEqual(
            1e-6 * Math.max(fit.cssWidth, fit.cssHeight) + 1e-6
          );
          // The backing store rounds each side to whole pixels.
          expect(
            Math.abs(fit.backingWidth / ratio - fit.backingHeight)
          ).toBeLessThanOrEqual(1 / Math.min(1, ratio) + 0.5);
        }
      )
    );
  });

  it("snaps the integer scale to a whole multiple of the game", () => {
    fc.assert(
      fc.property(slotSide, slotSide, dprValue, options, (w, h, dpr, opts) => {
        const fit = computeStageFit({ width: w, height: h }, dpr, {
          ...opts,
          scale: "integer",
        });
        expect(Number.isInteger(fit.scale)).toBe(true);
        expect(fit.scale).toBeGreaterThanOrEqual(1);
        expect(fit.backingWidth).toBe(opts.aspect.width * fit.scale);
        expect(fit.backingHeight).toBe(opts.aspect.height * fit.scale);
      })
    );
  });

  it("snaps the fractional width to its step", () => {
    fc.assert(
      fc.property(slotSide, slotSide, dprValue, options, (w, h, dpr, opts) => {
        const fit = computeStageFit({ width: w, height: h }, dpr, {
          ...opts,
          scale: "fractional",
        });
        expect(fit.step).toBe(stageSnapStep(opts.aspect));
        expect(fit.cssWidth % fit.step).toBe(0);
      })
    );
  });

  it("never sizes the backing store past the capped ratio", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 50, max: 5000, noNaN: true }),
        fc.double({ min: 50, max: 5000, noNaN: true }),
        dprValue,
        options,
        (w, h, dpr, opts) => {
          const fit = computeStageFit({ width: w, height: h }, dpr, {
            ...opts,
            minScale: 0,
          });
          const cap = opts.maxDpr;
          expect(fit.dpr).toBeLessThanOrEqual(cap);
          if (fit.cssWidth < 1) return;
          // A slot too small for 1x keeps the 1x store (integer mode only).
          const floor = opts.scale === "integer" ? opts.aspect.width : 0;
          expect(fit.backingWidth).toBeLessThanOrEqual(
            Math.max(floor, Math.ceil(fit.cssWidth * fit.dpr) + 1)
          );
        }
      )
    );
  });
});
