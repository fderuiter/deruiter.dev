// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  brushEdits,
  canvasPixel,
  defectRect,
  isNearSlice,
  pixelToVoxel,
  scrollCrosshair,
  sliceIndex,
  voxelToPixel,
} from "@/components/neuro/slice-geometry";

const crosshair = { x: 10, y: 20, z: 30 };

describe("sliceIndex", () => {
  it("reads the crosshair along each plane's axis", () => {
    expect(sliceIndex("axial", crosshair)).toBe(30);
    expect(sliceIndex("coronal", crosshair)).toBe(20);
    expect(sliceIndex("sagittal", crosshair)).toBe(10);
  });
});

describe("canvasPixel", () => {
  it("scales CSS pixels to the canvas bitmap and floors them", () => {
    const canvas = { width: 96, height: 96 };
    const rect = { left: 100, top: 50, width: 192, height: 384 };
    expect(canvasPixel(canvas, rect, 100, 50)).toEqual({ x: 0, y: 0 });
    expect(canvasPixel(canvas, rect, 111, 91)).toEqual({ x: 5, y: 10 });
    expect(canvasPixel(canvas, rect, 90, 40)).toEqual({ x: -5, y: -3 });
  });
});

describe("pixelToVoxel", () => {
  it("keeps the axial slice and maps pixels straight to x and y", () => {
    expect(pixelToVoxel("axial", { x: 5, y: 7 }, crosshair)).toEqual({
      x: 5,
      y: 7,
      z: 30,
    });
  });

  it("flips rows into height on the coronal and sagittal planes", () => {
    expect(pixelToVoxel("coronal", { x: 5, y: 0 }, crosshair)).toEqual({
      x: 5,
      y: 20,
      z: 95,
    });
    expect(pixelToVoxel("sagittal", { x: 5, y: 95 }, crosshair)).toEqual({
      x: 10,
      y: 5,
      z: 0,
    });
  });

  it("clamps pixels outside the volume to its edge", () => {
    expect(pixelToVoxel("axial", { x: -4, y: 400 }, crosshair)).toEqual({
      x: 0,
      y: 95,
      z: 30,
    });
    expect(pixelToVoxel("coronal", { x: 200, y: -1 }, crosshair)).toEqual({
      x: 95,
      y: 20,
      z: 95,
    });
  });
});

describe("voxelToPixel", () => {
  it("is the inverse of pixelToVoxel on each plane", () => {
    const point = { x: 12, y: 34, z: 56 };
    expect(voxelToPixel("axial", point, 96)).toEqual({ x: 12, y: 34 });
    expect(voxelToPixel("coronal", point, 96)).toEqual({ x: 12, y: 39 });
    expect(voxelToPixel("sagittal", point, 96)).toEqual({ x: 34, y: 39 });
    for (const plane of ["axial", "coronal", "sagittal"] as const) {
      const pixel = voxelToPixel(plane, point, 96);
      const through = { ...point };
      expect(pixelToVoxel(plane, pixel, through)).toEqual(point);
    }
  });
});

describe("scrollCrosshair", () => {
  it("steps back a slice on a downward wheel and forward on an upward one", () => {
    expect(scrollCrosshair(crosshair, "axial", 100)).toEqual({
      ...crosshair,
      z: 29,
    });
    expect(scrollCrosshair(crosshair, "coronal", -100)).toEqual({
      ...crosshair,
      y: 21,
    });
    expect(scrollCrosshair(crosshair, "sagittal", 0)).toEqual({
      ...crosshair,
      x: 11,
    });
  });

  it("stops at the first and last slice", () => {
    expect(scrollCrosshair({ x: 0, y: 0, z: 0 }, "axial", 1).z).toBe(0);
    expect(scrollCrosshair({ x: 95, y: 0, z: 0 }, "sagittal", -1).x).toBe(95);
  });
});

describe("brushEdits", () => {
  it("paints a single voxel at radius zero", () => {
    expect(brushEdits({ x: 5, y: 5, z: 5 }, 0, "paint")).toEqual([
      { x: 5, y: 5, z: 5, originalValue: 0, newValue: 1, layer: "brainmask" },
    ]);
  });

  it("fills a sphere, not a cube", () => {
    const edits = brushEdits({ x: 20, y: 20, z: 20 }, 1, "erase");
    // The centre and its six face neighbours; corners lie outside radius 1.
    expect(edits).toHaveLength(7);
    expect(edits.every((e) => e.originalValue === 1 && e.newValue === 0)).toBe(
      true
    );
    expect(edits).not.toContainEqual(
      expect.objectContaining({ x: 21, y: 21, z: 21 })
    );
  });

  it("drops voxels outside the volume", () => {
    const edits = brushEdits({ x: 0, y: 0, z: 0 }, 1, "paint");
    expect(edits).toHaveLength(4);
    expect(edits.every((e) => e.x >= 0 && e.y >= 0 && e.z >= 0)).toBe(true);
    expect(brushEdits({ x: 95, y: 95, z: 95 }, 1, "paint")).toHaveLength(4);
  });
});

describe("defectRect", () => {
  const region = { min: { x: 70, y: 40, z: 44 }, max: { x: 81, y: 56, z: 57 } };

  it("outlines the region on slices that cross it", () => {
    expect(defectRect(region, "axial", 44, 96)).toEqual({
      x: 70,
      y: 40,
      width: 11,
      height: 16,
    });
    expect(defectRect(region, "coronal", 56, 96)).toEqual({
      x: 70,
      y: 38,
      width: 11,
      height: 13,
    });
    expect(defectRect(region, "sagittal", 75, 96)).toEqual({
      x: 40,
      y: 38,
      width: 16,
      height: 13,
    });
  });

  it("returns null for slices that miss it", () => {
    expect(defectRect(region, "axial", 43, 96)).toBeNull();
    expect(defectRect(region, "coronal", 57, 96)).toBeNull();
    expect(defectRect(region, "sagittal", 69, 96)).toBeNull();
  });

  it("returns null for a region with no area on the slice", () => {
    const flat = { min: { x: 5, y: 5, z: 5 }, max: { x: 5, y: 9, z: 9 } };
    expect(defectRect(flat, "axial", 7, 96)).toBeNull();
    expect(defectRect(flat, "sagittal", 5, 96)).toEqual({
      x: 5,
      y: 86,
      width: 4,
      height: 4,
    });
  });
});

describe("isNearSlice", () => {
  it("accepts points within a slice and a half", () => {
    const point = { x: 10, y: 20, z: 30 };
    expect(isNearSlice(point, "axial", 31)).toBe(true);
    expect(isNearSlice(point, "axial", 32)).toBe(false);
    expect(isNearSlice(point, "coronal", 19)).toBe(true);
    expect(isNearSlice(point, "coronal", 22)).toBe(false);
    expect(isNearSlice(point, "sagittal", 10)).toBe(true);
    expect(isNearSlice(point, "sagittal", 8)).toBe(false);
  });
});
