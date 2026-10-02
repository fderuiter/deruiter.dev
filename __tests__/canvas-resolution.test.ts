// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  applyCanvasScale,
  computeCanvasResolution,
  MAX_CANVAS_DPR,
} from "@/lib/arcade";

describe("computeCanvasResolution", () => {
  it("matches the displayed device pixels on a 2x screen", () => {
    // Laser Loon shown at 766 CSS px on a Retina laptop.
    const r = computeCanvasResolution(768, 420, 766, 2);
    expect(r.width).toBe(1532);
    expect(r.scale).toBeCloseTo(1532 / 768);
    expect(r.height).toBe(Math.round(420 * r.scale));
  });

  it("caps the device pixel ratio", () => {
    const r = computeCanvasResolution(280, 280, 276, 3);
    expect(r.width).toBe(276 * MAX_CANVAS_DPR);
    expect(r.height).toBe(r.width);
  });

  it("never drops below the logical size", () => {
    expect(computeCanvasResolution(800, 500, 400, 1)).toEqual({
      scale: 1,
      width: 800,
      height: 500,
    });
  });

  it("falls back to the logical size for unmeasured or invalid input", () => {
    expect(computeCanvasResolution(760, 150, 0, 2)).toEqual({
      scale: 1,
      width: 760,
      height: 150,
    });
    expect(computeCanvasResolution(760, 150, 918, Number.NaN).width).toBe(918);
    expect(computeCanvasResolution(0, -5, 100, 2)).toEqual({
      scale: 200,
      width: 200,
      height: 200,
    });
  });
});

describe("applyCanvasScale", () => {
  it("sets a uniform scale and ignores contexts without setTransform", () => {
    const setTransform = vi.fn();
    applyCanvasScale(
      fromPartial<CanvasRenderingContext2D>({ setTransform }),
      2
    );
    expect(setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    applyCanvasScale(
      fromPartial<CanvasRenderingContext2D>({ setTransform }),
      Number.NaN
    );
    expect(setTransform).toHaveBeenLastCalledWith(1, 0, 0, 1, 0, 0);
    expect(() =>
      applyCanvasScale(fromPartial<CanvasRenderingContext2D>({}), 2)
    ).not.toThrow();
  });
});
