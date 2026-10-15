import { describe, expect, it, vi } from "vitest";
import {
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

function fakeFlow(viewport = { x: 0, y: 0, zoom: 0.8 }) {
  const flow = {
    fitView: vi.fn(),
    setViewport: vi.fn(),
    getViewport: vi.fn(() => viewport),
  };
  return { flow: flow as typeof flow & FrameFlow, viewport };
}

function chip(id: string, x: number, y: number): ChipNode {
  return {
    id,
    type: "chip",
    position: { x, y },
    data: { kind: "SourceIngest" },
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
});
