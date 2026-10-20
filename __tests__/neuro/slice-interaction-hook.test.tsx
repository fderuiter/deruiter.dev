import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { fromPartial } from "@total-typescript/shoehorn";
import { useSliceInteraction } from "@/components/neuro/useSliceInteraction";
import type { ToolMode } from "@/lib/neuro";
import {
  extractSlice,
  generateSyntheticVolume,
} from "@/lib/neuro/volume-generator";

const volume = generateSyntheticVolume("dura_inclusion");
const crosshair = { x: 10, y: 20, z: 30 };

// A 96-pixel canvas drawn at twice its size, offset by (100, 50).
const target = fromPartial<HTMLCanvasElement>({
  width: 96,
  height: 96,
  getBoundingClientRect: () =>
    fromPartial<DOMRect>({ left: 100, top: 50, width: 192, height: 192 }),
});

function setup(toolMode: ToolMode, extra: { withSeed?: boolean } = {}) {
  const callbacks = {
    onCrosshairChange: vi.fn(),
    onAddControlPoint: vi.fn(),
    onApplyVoxelEdits: vi.fn(),
    onSelectROISeed: extra.withSeed === false ? undefined : vi.fn(),
  };
  const hook = renderHook(() =>
    useSliceInteraction({
      volume,
      crosshair,
      toolMode,
      brushRadius: 1,
      controlPointCount: 2,
      ...callbacks,
    })
  );
  return { ...hook, ...callbacks };
}

describe("useSliceInteraction", () => {
  it("moves the crosshair to the pressed voxel", () => {
    const { result, onCrosshairChange } = setup("inspect");
    act(() => result.current.press("axial", target, 110, 70));
    expect(onCrosshairChange).toHaveBeenCalledWith({ x: 5, y: 10, z: 30 });
  });

  it("adds a numbered control point on press in control point mode", () => {
    const { result, onAddControlPoint } = setup("control_point");
    act(() => result.current.press("coronal", target, 110, 50));
    expect(onAddControlPoint).toHaveBeenCalledWith({
      x: 5,
      y: 20,
      z: 95,
      intensity: 110,
      label: "CP-3",
    });
  });

  it("seeds the ROI when it can, and does nothing without the callback", () => {
    const withSeed = setup("roi_select");
    act(() => withSeed.result.current.press("sagittal", target, 110, 50));
    expect(withSeed.onSelectROISeed).toHaveBeenCalledWith({
      x: 10,
      y: 5,
      z: 95,
    });

    const withoutSeed = setup("roi_select", { withSeed: false });
    act(() => withoutSeed.result.current.press("sagittal", target, 110, 50));
    expect(withoutSeed.onCrosshairChange).toHaveBeenCalled();
    expect(withoutSeed.onAddControlPoint).not.toHaveBeenCalled();
    expect(withoutSeed.onApplyVoxelEdits).not.toHaveBeenCalled();
  });

  it("paints and erases a brush of voxels", () => {
    const paint = setup("paint");
    act(() => paint.result.current.press("axial", target, 140, 90));
    const painted = paint.onApplyVoxelEdits.mock.calls[0][0];
    expect(painted).toHaveLength(7);
    expect(painted[0]).toMatchObject({ newValue: 1, originalValue: 0 });

    const erase = setup("erase");
    act(() => erase.result.current.press("axial", target, 140, 90));
    expect(erase.onApplyVoxelEdits.mock.calls[0][0][0]).toMatchObject({
      newValue: 0,
      originalValue: 1,
    });
  });

  it("keeps painting while dragging until released", () => {
    const { result, onApplyVoxelEdits, onCrosshairChange } = setup("paint");

    act(() => result.current.drag("axial", target, 140, 90));
    expect(onApplyVoxelEdits).not.toHaveBeenCalled();

    act(() => result.current.press("axial", target, 140, 90));
    act(() => result.current.drag("axial", target, 150, 90));
    expect(onApplyVoxelEdits).toHaveBeenCalledTimes(2);
    expect(onCrosshairChange).toHaveBeenLastCalledWith({ x: 25, y: 20, z: 30 });

    act(() => result.current.release());
    act(() => result.current.drag("axial", target, 160, 90));
    expect(onApplyVoxelEdits).toHaveBeenCalledTimes(2);
  });

  it("ignores drags for tools that act once per press", () => {
    const { result, onAddControlPoint, onCrosshairChange } =
      setup("control_point");
    act(() => result.current.press("axial", target, 140, 90));
    act(() => result.current.drag("axial", target, 150, 90));
    expect(onAddControlPoint).toHaveBeenCalledTimes(1);
    expect(onCrosshairChange).toHaveBeenCalledTimes(1);
  });

  it("reads the intensity under the cursor on the plane's current slice", () => {
    const { result } = setup("inspect");
    expect(result.current.hoverIntensity).toBeNull();

    act(() => result.current.hover("coronal", target, 196, 146));
    const slice = extractSlice(volume, "coronal", 20);
    expect(result.current.hoverIntensity).toBe(slice.pixels[48 * 96 + 48]);
  });

  it("keeps the last intensity when the cursor is off the slice", () => {
    const { result } = setup("inspect");
    act(() => result.current.hover("axial", target, 196, 146));
    const inside = result.current.hoverIntensity;
    act(() => result.current.hover("axial", target, 90, 40));
    expect(result.current.hoverIntensity).toBe(inside);
    act(() => result.current.hover("axial", target, 300, 300));
    expect(result.current.hoverIntensity).toBe(inside);
  });

  it("steps through slices with the wheel", () => {
    const { result, onCrosshairChange } = setup("inspect");
    act(() => result.current.scroll("sagittal", 120));
    expect(onCrosshairChange).toHaveBeenCalledWith({ x: 9, y: 20, z: 30 });
  });
});
