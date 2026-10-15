// @vitest-environment jsdom
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CabinetTouchContext } from "@/components/arcade/mobile/CabinetTouchContext";
import { installFlowMocks } from "./protocol-drift/ui-helpers";

const flowProps = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));

// React Flow measures the DOM, which jsdom lacks. The canvas only needs its
// props checked, so the library is stubbed to record them.
vi.mock("@xyflow/react", () => ({
  ReactFlow: (props: Record<string, unknown>) => {
    flowProps.current = props;
    return null;
  },
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  ViewportPortal: () => null,
  Controls: () => null,
  Handle: () => null,
  Position: { Left: "left", Right: "right" },
  applyEdgeChanges: (_changes: unknown, edges: unknown) => edges,
  applyNodeChanges: (_changes: unknown, nodes: unknown) => nodes,
  useReactFlow: () => ({
    setViewport: vi.fn(),
    screenToFlowPosition: (p: { x: number; y: number }) => p,
  }),
}));

import { PipelineCanvas } from "@/components/protocol-drift/PipelineCanvas";
import { touchZoomFloor } from "@/components/protocol-drift/graph-model";

function renderCanvas(touch: boolean) {
  return render(
    <CabinetTouchContext.Provider value={touch}>
      <PipelineCanvas />
    </CabinetTouchContext.Provider>
  );
}

describe("Protocol Drift canvas gestures (#2045)", () => {
  beforeAll(() => installFlowMocks());
  afterEach(() => {
    cleanup();
    flowProps.current = null;
  });

  it("a finger pans and pinches the canvas on the touch cabinet", () => {
    renderCanvas(true);
    expect(flowProps.current?.panOnDrag).toBe(true);
    expect(flowProps.current?.zoomOnPinch).toBe(true);
    expect(flowProps.current?.minZoom).toBe(touchZoomFloor());
    // A few pixels of finger movement on a chip is still a tap (#2045).
    expect(flowProps.current?.nodeDragThreshold).toBe(8);
    // Wheel zoom stays off on both, so a page scroll never zooms the world.
    expect(flowProps.current?.zoomOnScroll).toBe(false);
  });

  it("desktop pans by drag and zooms by pinch or buttons, never by the page wheel (#2167)", () => {
    renderCanvas(false);
    expect(flowProps.current?.panOnDrag).toBe(true);
    expect(flowProps.current?.zoomOnPinch).toBe(true);
    expect(flowProps.current?.minZoom).toBe(0.2);
    expect(flowProps.current?.zoomOnScroll).toBe(false);
  });
});
