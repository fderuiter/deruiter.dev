import { describe, expect, it, vi } from "vitest";
import {
  DESKTOP_FRAME_FLOOR,
  ensureVisible,
  fitZoomFor,
  frameAfterAdd,
  frameLane,
  type FrameFlow,
} from "@/components/protocol-drift/touch-frame";
import {
  CHIP_WIDTH,
  touchZoomFloor,
  type ChipNode,
} from "@/components/protocol-drift/graph-model";
import { LANE_GEOMETRY } from "@/lib/protocol-drift";

function fakeFlow(viewport = { x: 0, y: 0, zoom: 0.8 }) {
  const flow = {
    fitView: vi.fn(),
    setViewport: vi.fn(),
    getViewport: vi.fn(() => viewport),
  };
  return { flow: flow as typeof flow & FrameFlow, viewport };
}

function chip(
  id: string,
  x: number,
  y: number,
  kind: ChipNode["data"]["kind"] = "SourceIngest"
): ChipNode {
  return {
    id,
    type: "chip",
    position: { x, y },
    data: { kind },
  };
}

const SIZE = { width: 1000, height: 600 };

describe("touch framing (#2045)", () => {
  it("pans the least needed to bring an off-screen chip in, at the same zoom", () => {
    const { flow } = fakeFlow({ x: -600, y: 0, zoom: 0.8 });
    ensureVisible(flow, SIZE, { x: 40, y: 150, kind: "SourceIngest" });
    expect(flow.setViewport).toHaveBeenCalledTimes(1);
    const next = flow.setViewport.mock.calls[0][0];
    expect(next.zoom).toBe(0.8);
    // The chip's left edge now sits at the 24px margin, and only x moved.
    expect(next.x).toBeCloseTo(-600 + (24 - (40 * 0.8 - 600)));
    expect(next.y).toBe(0);
  });

  it("does not pan when the chip is already fully on screen", () => {
    const { flow } = fakeFlow({ x: 0, y: 0, zoom: 0.8 });
    ensureVisible(flow, SIZE, { x: 100, y: 150, kind: "SourceIngest" });
    expect(flow.setViewport).not.toHaveBeenCalled();
  });

  it("fits the chips when they all fit at a legible zoom", () => {
    const { flow } = fakeFlow();
    const nodes = [chip("a", 40, 150), chip("b", 240, 150)];
    expect(fitZoomFor(nodes, SIZE)).toBeGreaterThanOrEqual(touchZoomFloor());
    frameAfterAdd(flow, SIZE, nodes, { kind: "SourceIngest", x: 240, y: 150 });
    expect(flow.fitView).toHaveBeenCalledTimes(1);
    expect(flow.setViewport).not.toHaveBeenCalled();
  });

  it("pans to the new chip, keeping the zoom, when the chips do not all fit", () => {
    const { flow } = fakeFlow({ x: 0, y: 0, zoom: 0.8 });
    const far = 40 + CHIP_WIDTH + 1200;
    const nodes = [chip("a", 40, 150), chip("b", far, 150)];
    expect(fitZoomFor(nodes, SIZE)).toBeLessThan(touchZoomFloor());
    frameAfterAdd(flow, SIZE, nodes, { kind: "SourceIngest", x: far, y: 150 });
    expect(flow.fitView).not.toHaveBeenCalled();
    expect(flow.setViewport).toHaveBeenCalledTimes(1);
    expect(flow.setViewport.mock.calls[0][0].zoom).toBe(0.8);
  });

  it("frames the tabulation lane at or above the floor, never a zoom-out of the world", () => {
    const { flow } = fakeFlow();
    frameLane(flow, SIZE);
    expect(flow.setViewport).toHaveBeenCalledTimes(1);
    expect(flow.setViewport.mock.calls[0][0].zoom).toBeGreaterThanOrEqual(
      touchZoomFloor()
    );
    expect(flow.fitView).not.toHaveBeenCalled();
  });

  it("keeps the lane labels on screen when the lane is wider than the canvas", () => {
    const { flow } = fakeFlow();
    frameLane(flow, { width: 720, height: 300 });
    const { x, zoom } = flow.setViewport.mock.calls[0][0];
    // The labels start at world x 8; their left edge must sit inside the canvas.
    expect(x + 8 * zoom).toBeGreaterThanOrEqual(0);
  });

  it("keeps the tabulation lane label on screen when the canvas is short", () => {
    const { flow } = fakeFlow();
    frameLane(flow, { width: 720, height: 200 });
    const { y, zoom } = flow.setViewport.mock.calls[0][0];
    expect(y + LANE_GEOMETRY.tabulationTop * zoom).toBeGreaterThanOrEqual(0);
  });
});

describe("desktop framing (#2274)", () => {
  // The four tracer chips where the toolbox drops them.
  const tracer = [
    chip("source", 40, 142, "SourceIngest"),
    chip("extract", 230, 182, "ExtractField"),
    chip("pivot", 420, 222, "PivotToObservation"),
    chip("sink", 610, 142, "CDISCSink"),
  ];
  // The docked 1024 canvas beside the open toolbox.
  const DOCKED_1024 = { width: 545, height: 330 };

  it("fits all four tracer chips after the fourth add, where touch would pan", () => {
    expect(fitZoomFor(tracer, DOCKED_1024)).toBeLessThan(touchZoomFloor());
    expect(fitZoomFor(tracer, DOCKED_1024, false)).toBeGreaterThanOrEqual(
      DESKTOP_FRAME_FLOOR
    );
    const { flow } = fakeFlow({ x: 0, y: 0, zoom: 1 });
    frameAfterAdd(
      flow,
      DOCKED_1024,
      tracer,
      { kind: "CDISCSink", x: 610, y: 142 },
      false
    );
    expect(flow.setViewport).not.toHaveBeenCalled();
    expect(flow.fitView).toHaveBeenCalledTimes(1);
    expect(flow.fitView.mock.calls[0][0].minZoom).toBe(DESKTOP_FRAME_FLOOR);
  });

  it("still pans to the new chip when even the desktop floor cannot fit them", () => {
    const { flow } = fakeFlow({ x: 0, y: 0, zoom: 0.8 });
    const far = 40 + CHIP_WIDTH + 1200;
    const nodes = [chip("a", 40, 150), chip("b", far, 150)];
    frameAfterAdd(
      flow,
      SIZE,
      nodes,
      { kind: "SourceIngest", x: far, y: 150 },
      false
    );
    expect(flow.fitView).not.toHaveBeenCalled();
    expect(flow.setViewport).toHaveBeenCalledTimes(1);
  });
});
