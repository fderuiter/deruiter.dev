// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import { drawSlice } from "@/components/neuro/drawSlice";
import { generateSyntheticVolume } from "@/lib/neuro/volume-generator";

const volume = generateSyntheticVolume("dura_inclusion");
// defectRegion: x 70-81, y 40-56, z 44-57

function fakeCanvas() {
  const strokeStyles: string[] = [];
  const ctx = {
    lineWidth: 0,
    set strokeStyle(value: string) {
      strokeStyles.push(value);
    },
    createImageData: vi.fn((w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
    })),
    putImageData: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    setLineDash: vi.fn(),
    strokeRect: vi.fn(),
  };
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => ctx) };
  return { canvas, ctx, strokeStyles };
}

const quiet = {
  crosshair: { x: 10, y: 20, z: 30 },
  showPialContour: false,
  showWmContour: false,
  controlPoints: [],
};

describe("drawSlice", () => {
  it("does nothing without a canvas or a 2D context", () => {
    expect(() => drawSlice(null, volume, "axial", 0, quiet)).not.toThrow();
    const canvas = { width: 0, getContext: () => null };
    drawSlice(fromPartial(canvas), volume, "axial", 0, quiet);
    expect(canvas.width).toBe(0);
  });

  it("sizes the canvas and paints the slice in greyscale", () => {
    const { canvas, ctx } = fakeCanvas();
    drawSlice(fromPartial(canvas), volume, "axial", 48, quiet);
    expect(canvas.width).toBe(96);
    expect(canvas.height).toBe(96);
    const image = ctx.putImageData.mock.calls[0][0] as {
      data: Uint8ClampedArray;
    };
    const centre = (48 * 96 + 48) * 4;
    expect(image.data[centre]).toBe(image.data[centre + 1]);
    expect(image.data[centre]).toBe(image.data[centre + 2]);
    expect(image.data[centre + 3]).toBe(255);
    expect(image.data[centre]).toBeGreaterThan(0);
  });

  it("draws only the crosshair when every overlay is off and no defect is on the slice", () => {
    const { canvas, ctx, strokeStyles } = fakeCanvas();
    drawSlice(fromPartial(canvas), volume, "axial", 10, quiet);
    expect(ctx.rect).not.toHaveBeenCalled();
    expect(ctx.strokeRect).not.toHaveBeenCalled();
    expect(ctx.arc).not.toHaveBeenCalled();
    expect(strokeStyles).toEqual(["rgba(16, 185, 129, 0.65)"]);
    // Horizontal line through the crosshair's row, vertical through its column.
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 20);
    expect(ctx.lineTo).toHaveBeenCalledWith(96, 20);
    expect(ctx.moveTo).toHaveBeenCalledWith(10, 0);
    expect(ctx.lineTo).toHaveBeenCalledWith(10, 96);
  });

  it("traces the pial and white-matter edges when they are shown", () => {
    const { canvas, ctx, strokeStyles } = fakeCanvas();
    drawSlice(fromPartial(canvas), volume, "coronal", 48, {
      ...quiet,
      showPialContour: true,
      showWmContour: true,
    });
    expect(strokeStyles.slice(0, 2)).toEqual([
      "rgba(239, 68, 68, 0.85)",
      "rgba(234, 179, 8, 0.9)",
    ]);
    expect(ctx.rect.mock.calls.length).toBeGreaterThan(0);
    for (const [x, y, w, h] of ctx.rect.mock.calls) {
      expect(x).toBeGreaterThan(0);
      expect(y).toBeGreaterThan(0);
      expect([w, h]).toEqual([1, 1]);
    }
  });

  it("strokes each vector contour that has segments, in its colour or cyan", () => {
    const { canvas, ctx, strokeStyles } = fakeCanvas();
    drawSlice(fromPartial(canvas), volume, "axial", 10, {
      ...quiet,
      vectorContours: [
        fromPartial({
          color: "#ff0000",
          segments: [{ p1: { x: 1, y: 2 }, p2: { x: 3, y: 4 } }],
        }),
        fromPartial({ segments: [{ p1: { x: 5, y: 6 }, p2: { x: 7, y: 8 } }] }),
        fromPartial({ color: "#00ff00", segments: [] }),
        fromPartial({ color: "#0000ff" }),
      ],
    });
    expect(strokeStyles.slice(0, 2)).toEqual(["#ff0000", "#00f5d4"]);
    expect(strokeStyles).not.toContain("#00ff00");
    expect(strokeStyles).not.toContain("#0000ff");
    expect(ctx.moveTo).toHaveBeenCalledWith(1, 2);
    expect(ctx.lineTo).toHaveBeenCalledWith(7, 8);
  });

  it("outlines the defect region dashed on slices that cross it", () => {
    const { canvas, ctx } = fakeCanvas();
    drawSlice(fromPartial(canvas), volume, "sagittal", 75, quiet);
    expect(ctx.strokeRect).toHaveBeenCalledWith(40, 38, 16, 13);
    expect(ctx.setLineDash).toHaveBeenCalledWith([3, 3]);
  });

  it("marks control points near the slice and skips the rest", () => {
    const { canvas, ctx } = fakeCanvas();
    drawSlice(fromPartial(canvas), volume, "coronal", 20, {
      ...quiet,
      controlPoints: [
        fromPartial({ x: 12, y: 21, z: 56 }),
        fromPartial({ x: 50, y: 40, z: 50 }),
      ],
    });
    expect(ctx.arc).toHaveBeenCalledTimes(1);
    expect(ctx.arc).toHaveBeenCalledWith(12, 39, 3.5, 0, Math.PI * 2);
    expect(ctx.moveTo).toHaveBeenCalledWith(7, 39);
    expect(ctx.lineTo).toHaveBeenCalledWith(12, 44);
  });
});
