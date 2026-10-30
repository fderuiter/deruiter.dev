import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { fromPartial } from "@total-typescript/shoehorn";
import type React from "react";
import { THEOREMS } from "@/lib/proof";
import { useProofCanvasDrag } from "@/app/proof/useProofCanvasDrag";

const MP = THEOREMS["modus-ponens"];

let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;

function flushFrames() {
  const pending = [...frames.values()];
  frames = new Map();
  act(() => pending.forEach((cb) => cb(0)));
}

function pointer(clientX: number, clientY: number) {
  return fromPartial<React.PointerEvent>({
    clientX,
    clientY,
    pointerId: 7,
    stopPropagation: vi.fn(),
    target: fromPartial<Element>({
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    }),
  });
}

function setup(isSnappingEnabled = false) {
  const props = {
    theorem: MP,
    edges: MP.initialEdges,
    isSnappingEnabled,
    playHover: vi.fn(),
    announce: vi.fn(),
    onConnect: vi.fn(),
    onReject: vi.fn(),
  };
  const hook = renderHook((p: typeof props) => useProofCanvasDrag(p), {
    initialProps: props,
  });
  hook.result.current.canvasWrapperRef.current = fromPartial<HTMLDivElement>({
    getBoundingClientRect: () => fromPartial<DOMRect>({ left: 0, top: 0 }),
  });
  return { ...hook, props };
}

beforeEach(() => {
  frames = new Map();
  nextFrame = 1;
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((cb: FrameRequestCallback) => {
      const id = nextFrame++;
      frames.set(id, cb);
      return id;
    })
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => frames.delete(id))
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useProofCanvasDrag: moving nodes", () => {
  it("moves a node freely when snapping is off, one update per frame", () => {
    const { result } = setup(false);
    act(() => result.current.handleNodePointerDown(pointer(0, 0), "A"));
    act(() => result.current.handleNodePointerMove(pointer(10, 5), "A"));
    act(() => result.current.handleNodePointerMove(pointer(33, 17), "A"));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(result.current.nodeOffsets).toEqual({});
    flushFrames();
    expect(result.current.nodeOffsets).toEqual({ A: { x: 33, y: 17 } });
    expect(result.current.activeGuides).toEqual([]);
  });

  it("snaps to the 20px grid and ticks once for a quick run of snaps", () => {
    vi.spyOn(performance, "now").mockReturnValue(100);
    const { result, props } = setup(true);
    act(() => result.current.handleNodePointerDown(pointer(0, 0), "A"));
    act(() => result.current.handleNodePointerMove(pointer(33, 17), "A"));
    flushFrames();
    const { x, y } = result.current.nodeOffsets.A;
    expect((MP.nodes[0].x + x) % 20).toBe(0);
    expect((MP.nodes[0].y + y) % 20).toBe(0);
    expect(props.playHover).toHaveBeenCalledTimes(1);

    act(() => result.current.handleNodePointerMove(pointer(52, 21), "A"));
    flushFrames();
    expect(props.playHover).toHaveBeenCalledTimes(1);
  });

  it("continues from the node's previous offset", () => {
    const { result } = setup(false);
    act(() => result.current.handleNodePointerDown(pointer(0, 0), "B"));
    act(() => result.current.handleNodePointerUp(pointer(0, 0), "B"));
    act(() => result.current.handleNodePointerDown(pointer(0, 0), "B"));
    act(() => result.current.handleNodePointerMove(pointer(5, 5), "B"));
    act(() => result.current.handleNodePointerUp(pointer(5, 5), "B"));
    act(() => result.current.handleNodePointerDown(pointer(100, 100), "B"));
    act(() => result.current.handleNodePointerMove(pointer(110, 90), "B"));
    flushFrames();
    expect(result.current.nodeOffsets.B).toEqual({ x: 15, y: -5 });
  });

  it("applies a pending move on release without waiting for the frame", () => {
    const { result } = setup(false);
    act(() => result.current.handleNodePointerDown(pointer(0, 0), "C"));
    act(() => result.current.handleNodePointerMove(pointer(40, 40), "C"));
    act(() => result.current.handleNodePointerUp(pointer(40, 40), "C"));
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(result.current.nodeOffsets.C).toEqual({ x: 40, y: 40 });
    // The drag is over, so further moves do nothing.
    act(() => result.current.handleNodePointerMove(pointer(90, 90), "C"));
    flushFrames();
    expect(result.current.nodeOffsets.C).toEqual({ x: 40, y: 40 });
  });

  it("ignores moves and releases for a node that isn't being dragged", () => {
    const { result } = setup(false);
    act(() => result.current.handleNodePointerMove(pointer(10, 10), "A"));
    act(() => result.current.handleNodePointerDown(pointer(0, 0), "A"));
    act(() => result.current.handleNodePointerMove(pointer(10, 10), "B"));
    act(() => result.current.handleNodePointerUp(pointer(10, 10), "B"));
    flushFrames();
    expect(result.current.nodeOffsets).toEqual({});
  });

  it("ignores a drag on a node the theorem doesn't have", () => {
    const { result } = setup(true);
    act(() => result.current.handleNodePointerDown(pointer(0, 0), "Z"));
    act(() => result.current.handleNodePointerMove(pointer(10, 10), "Z"));
    flushFrames();
    expect(result.current.nodeOffsets).toEqual({});
  });

  it("survives elements that refuse pointer capture", () => {
    const { result } = setup(false);
    const e = pointer(0, 0);
    vi.mocked(e.target as Element).setPointerCapture = vi.fn(() => {
      throw new Error("no capture");
    });
    act(() => result.current.handleNodePointerDown(e, "A"));
    act(() => result.current.handleNodePointerUp(e, "A"));
    expect(result.current.nodeOffsets).toEqual({});
  });
});

describe("useProofCanvasDrag: connection cords", () => {
  it("starts a cord at the node's right edge and announces it", () => {
    const { result, props } = setup();
    act(() => result.current.handleHandlePointerDown(pointer(0, 0), "C"));
    expect(result.current.dragConnection).toEqual({
      sourceId: "C",
      sourceX: 520,
      sourceY: 245,
      currentX: 520,
      currentY: 245,
      hoveredTargetId: null,
      isValid: false,
    });
    expect(props.announce).toHaveBeenCalledWith(
      "Started connection drag from Node C. Drag to a compatible target node."
    );
  });

  it("ignores a cord from a node the theorem doesn't have", () => {
    const { result } = setup();
    act(() => result.current.handleHandlePointerDown(pointer(0, 0), "Z"));
    expect(result.current.dragConnection).toBeNull();
  });

  it("connects when dropped on a valid target", () => {
    const { result, props } = setup();
    act(() => result.current.handleHandlePointerDown(pointer(0, 0), "C"));
    act(() => result.current.handleCanvasPointerMove(pointer(610, 300)));
    flushFrames();
    expect(result.current.dragConnection).toMatchObject({
      currentX: 610,
      currentY: 300,
      hoveredTargetId: "E",
      isValid: true,
    });
    const badge = result.current.dragConnection?.ruleBadge;
    expect(badge).toBeTruthy();
    act(() => result.current.handleCanvasPointerUp(pointer(610, 300)));
    expect(props.onConnect).toHaveBeenCalledWith("C", "E", badge);
    expect(props.onReject).not.toHaveBeenCalled();
    expect(result.current.dragConnection).toBeNull();
  });

  it("rejects when dropped on a target that doesn't follow", () => {
    const { result, props } = setup();
    act(() => result.current.handleHandlePointerDown(pointer(0, 0), "D"));
    act(() => result.current.handleCanvasPointerMove(pointer(130, 140)));
    flushFrames();
    expect(result.current.dragConnection).toMatchObject({
      hoveredTargetId: "A",
      isValid: false,
      ruleBadge: "",
    });
    act(() => result.current.handleCanvasPointerUp(pointer(130, 140)));
    expect(props.onReject).toHaveBeenCalledWith("D", "A");
    expect(props.onConnect).not.toHaveBeenCalled();
  });

  it("does nothing when dropped on empty canvas, and never targets its own source", () => {
    const { result, props } = setup();
    act(() => result.current.handleHandlePointerDown(pointer(0, 0), "C"));
    act(() => result.current.handleCanvasPointerMove(pointer(370, 220)));
    flushFrames();
    expect(result.current.dragConnection?.hoveredTargetId).toBeNull();
    act(() => result.current.handleCanvasPointerMove(pointer(5, 5)));
    act(() => result.current.handleCanvasPointerUp(pointer(5, 5)));
    expect(props.onConnect).not.toHaveBeenCalled();
    expect(props.onReject).not.toHaveBeenCalled();
    expect(result.current.dragConnection).toBeNull();
  });

  it("follows dragged nodes when hit-testing targets", () => {
    const { result } = setup(false);
    act(() => result.current.handleNodePointerDown(pointer(0, 0), "E"));
    act(() => result.current.handleNodePointerMove(pointer(-300, 0), "E"));
    act(() => result.current.handleNodePointerUp(pointer(-300, 0), "E"));
    act(() => result.current.handleHandlePointerDown(pointer(0, 0), "C"));
    act(() => result.current.handleCanvasPointerMove(pointer(310, 300)));
    flushFrames();
    expect(result.current.dragConnection?.hoveredTargetId).toBe("E");
  });

  it("ignores canvas moves with no cord and moves without a measured canvas", () => {
    const { result } = setup();
    act(() => result.current.handleCanvasPointerMove(pointer(1, 1)));
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    act(() => result.current.handleCanvasPointerUp(pointer(1, 1)));

    act(() => result.current.handleHandlePointerDown(pointer(0, 0), "C"));
    result.current.canvasWrapperRef.current = null;
    act(() => result.current.handleCanvasPointerMove(pointer(610, 300)));
    flushFrames();
    expect(result.current.dragConnection?.currentX).toBe(520);
  });
});

describe("useProofCanvasDrag: lifecycle", () => {
  it("resetLayout clears positions, guides and cords", () => {
    const { result } = setup(false);
    act(() => result.current.handleNodePointerDown(pointer(0, 0), "A"));
    act(() => result.current.handleNodePointerUp(pointer(0, 0), "A"));
    act(() => result.current.handleNodePointerDown(pointer(0, 0), "A"));
    act(() => result.current.handleNodePointerMove(pointer(9, 9), "A"));
    act(() => result.current.handleNodePointerUp(pointer(9, 9), "A"));
    act(() => result.current.handleHandlePointerDown(pointer(0, 0), "C"));
    act(() => result.current.resetLayout());
    expect(result.current.nodeOffsets).toEqual({});
    expect(result.current.activeGuides).toEqual([]);
    expect(result.current.dragConnection).toBeNull();
  });

  it("cancels pending frames on unmount", () => {
    const { result, unmount } = setup(false);
    act(() => result.current.handleNodePointerDown(pointer(0, 0), "A"));
    act(() => result.current.handleNodePointerMove(pointer(9, 9), "A"));
    act(() => result.current.handleHandlePointerDown(pointer(0, 0), "C"));
    act(() => result.current.handleCanvasPointerMove(pointer(9, 9)));
    expect(frames.size).toBe(2);
    unmount();
    expect(frames.size).toBe(0);
  });
});
