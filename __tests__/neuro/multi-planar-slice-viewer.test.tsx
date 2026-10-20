import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MultiPlanarSliceViewer } from "@/components/neuro/MultiPlanarSliceViewer";
import { generateSyntheticVolume } from "@/lib/neuro/volume-generator";
import type { ToolMode } from "@/lib/neuro";

const volume = generateSyntheticVolume("dura_inclusion");

function setup(toolMode: ToolMode = "inspect") {
  const props = {
    onCrosshairChange: vi.fn(),
    onAddControlPoint: vi.fn(),
    onApplyVoxelEdits: vi.fn(),
    onSelectROISeed: vi.fn(),
  };
  const view = render(
    <MultiPlanarSliceViewer
      volume={volume}
      crosshair={{ x: 10, y: 20, z: 30 }}
      toolMode={toolMode}
      brushRadius={1}
      showPialContour
      showWmContour
      controlPoints={[]}
      {...props}
    />
  );
  return { ...view, ...props };
}

const canvas = (name: RegExp) => screen.getByRole("img", { name });

beforeEach(() => {
  // Draw each 96-pixel slice at twice its size, at the page origin.
  vi.spyOn(
    HTMLCanvasElement.prototype,
    "getBoundingClientRect"
  ).mockReturnValue(DOMRect.fromRect({ x: 0, y: 0, width: 192, height: 192 }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MultiPlanarSliceViewer", () => {
  it("shows all three planes with their slice, compass and slider", () => {
    setup();
    expect(screen.getByText("CORONAL (Y=20)")).toBeTruthy();
    expect(screen.getByText("AXIAL (Z=30)")).toBeTruthy();
    expect(screen.getByText("SAGITTAL (X=10)")).toBeTruthy();
    expect(
      canvas(/^2D Coronal MRI Slice View at Y=20\./).getAttribute("tabindex")
    ).toBe("0");
    expect(canvas(/^2D Axial MRI Slice View at Z=30\./)).toBeTruthy();
    expect(canvas(/^2D Sagittal MRI Slice View at X=10\./)).toBeTruthy();
    expect(
      screen
        .getByRole("slider", { name: "Axial slice" })
        .getAttribute("aria-valuetext")
    ).toBe("Axial slice Z = 30");
    expect(screen.getByText("ANT / POST")).toBeTruthy();
    expect(screen.getAllByText("S")).toHaveLength(2);
    expect(screen.getAllByText("A")).toHaveLength(2);
  });

  it("draws every slice when it mounts", () => {
    setup();
    for (const name of [/^2D Coronal/, /^2D Axial/, /^2D Sagittal/]) {
      expect((canvas(name) as HTMLCanvasElement).width).toBe(96);
    }
  });

  it("moves the crosshair along a plane's axis from its slider", () => {
    const { onCrosshairChange } = setup();
    fireEvent.change(screen.getByRole("slider", { name: "Coronal slice" }), {
      target: { value: "42" },
    });
    expect(onCrosshairChange).toHaveBeenCalledWith({ x: 10, y: 42, z: 30 });
    fireEvent.change(screen.getByRole("slider", { name: "Sagittal slice" }), {
      target: { value: "7" },
    });
    expect(onCrosshairChange).toHaveBeenCalledWith({ x: 7, y: 20, z: 30 });
  });

  it("shows the intensity under the cursor", () => {
    setup();
    expect(screen.getByText("—")).toBeTruthy();
    fireEvent.mouseMove(canvas(/^2D Axial/), { clientX: 96, clientY: 96 });
    expect(screen.queryByText("—")).toBeNull();
  });

  it("paints on a press and keeps painting until the mouse is released", () => {
    const { container, onApplyVoxelEdits, onCrosshairChange } = setup("paint");
    const axial = canvas(/^2D Axial/);

    fireEvent.mouseDown(axial, { clientX: 20, clientY: 40 });
    expect(onCrosshairChange).toHaveBeenLastCalledWith({ x: 10, y: 20, z: 30 });
    fireEvent.mouseMove(axial, { clientX: 30, clientY: 40 });
    expect(onApplyVoxelEdits).toHaveBeenCalledTimes(2);

    fireEvent.mouseUp(container.firstElementChild!);
    fireEvent.mouseMove(axial, { clientX: 40, clientY: 40 });
    expect(onApplyVoxelEdits).toHaveBeenCalledTimes(2);

    fireEvent.mouseDown(axial, { clientX: 20, clientY: 40 });
    fireEvent.mouseLeave(container.firstElementChild!);
    fireEvent.mouseMove(axial, { clientX: 40, clientY: 40 });
    expect(onApplyVoxelEdits).toHaveBeenCalledTimes(3);
  });

  it("paints with touch, falling back to the lifted touch", () => {
    const { onApplyVoxelEdits, onCrosshairChange } = setup("erase");
    const coronal = canvas(/^2D Coronal/);

    fireEvent.touchStart(coronal, {
      touches: [{ clientX: 20, clientY: 0 }],
    });
    expect(onCrosshairChange).toHaveBeenLastCalledWith({ x: 10, y: 20, z: 95 });
    fireEvent.touchMove(coronal, {
      touches: [],
      changedTouches: [{ clientX: 40, clientY: 0 }],
    });
    expect(onCrosshairChange).toHaveBeenLastCalledWith({ x: 20, y: 20, z: 95 });
    expect(onApplyVoxelEdits).toHaveBeenCalledTimes(2);

    fireEvent.touchEnd(coronal);
    fireEvent.touchMove(coronal, { touches: [{ clientX: 60, clientY: 0 }] });
    expect(onApplyVoxelEdits).toHaveBeenCalledTimes(2);
  });

  it("adds a control point where the sagittal slice is clicked", () => {
    const { onAddControlPoint } = setup("control_point");
    fireEvent.mouseDown(canvas(/^2D Sagittal/), { clientX: 20, clientY: 190 });
    expect(onAddControlPoint).toHaveBeenCalledWith({
      x: 10,
      y: 10,
      z: 0,
      intensity: 110,
      label: "CP-1",
    });
  });

  it("steps through slices with the wheel", () => {
    const { onCrosshairChange } = setup();
    fireEvent.wheel(canvas(/^2D Axial/), { deltaY: 100 });
    expect(onCrosshairChange).toHaveBeenCalledWith({ x: 10, y: 20, z: 29 });
    fireEvent.wheel(canvas(/^2D Coronal/), { deltaY: -100 });
    expect(onCrosshairChange).toHaveBeenCalledWith({ x: 10, y: 21, z: 30 });
  });

  it("shows one plane at a time in the focused layout", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Focused" }));

    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(canvas(/^Focused 2D Coronal MRI Slice View at Y=20\./)).toBeTruthy();
    expect(screen.getByText("SLICE: Y = 20")).toBeTruthy();
    expect(screen.queryByRole("slider")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "axial" }));
    expect(canvas(/^Focused 2D Axial MRI Slice View at Z=30\./)).toBeTruthy();
    expect(screen.getByText("SLICE: Z = 30")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "sagittal" }));
    expect(screen.getByText("SLICE: X = 10")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "3-Planar" }));
    expect(screen.getAllByRole("img")).toHaveLength(3);
  });

  // The focused canvas used to stay blank until the crosshair moved (#2602).
  it("draws the plane it switches to in the focused layout", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Focused" }));
    expect((canvas(/^Focused 2D Coronal/) as HTMLCanvasElement).width).toBe(96);
    fireEvent.click(screen.getByRole("button", { name: "axial" }));
    expect((canvas(/^Focused 2D Axial/) as HTMLCanvasElement).width).toBe(96);
  });

  it("works in the focused layout like in the three-plane one", () => {
    const { onCrosshairChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Focused" }));
    fireEvent.click(screen.getByRole("button", { name: "sagittal" }));
    fireEvent.wheel(canvas(/^Focused 2D Sagittal/), { deltaY: 1 });
    expect(onCrosshairChange).toHaveBeenCalledWith({ x: 9, y: 20, z: 30 });
  });

  it("keeps a lost context and redraws when it is restored", () => {
    setup();
    const axial = canvas(/^2D Axial/) as HTMLCanvasElement;

    const lost = new Event("contextlost", { cancelable: true });
    axial.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);

    axial.width = 1;
    axial.dispatchEvent(new Event("contextrestored"));
    expect(axial.width).toBe(96);
  });

  it("stops listening for context events once unmounted", () => {
    const { unmount } = setup();
    const axial = canvas(/^2D Axial/) as HTMLCanvasElement;
    unmount();
    axial.width = 1;
    axial.dispatchEvent(new Event("contextrestored"));
    expect(axial.width).toBe(1);
  });
});
