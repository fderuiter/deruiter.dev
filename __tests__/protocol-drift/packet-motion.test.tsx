import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PacketEdgeView } from "@/components/protocol-drift/PacketEdgeView";
import {
  MAX_TOKENS,
  useProtocolDriftStore,
} from "@/components/protocol-drift/store";
import { TRACER_GRAPH, minuteAt } from "@/lib/protocol-drift";
import {
  toFlowEdges,
  toFlowNodes,
} from "@/components/protocol-drift/graph-model";

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});
vi.mock("@/lib/audio", () => ({
  getSoundEngine: () => ({ isSoundAllowed: () => false, playTone: vi.fn() }),
}));

function mockMotion(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduced && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

const edgeProps = {
  id: "a.out->b.in",
  source: "a",
  target: "b",
  sourceX: 0,
  sourceY: 0,
  targetX: 200,
  targetY: 100,
  sourcePosition: "right",
  targetPosition: "left",
  selected: false,
} as unknown as React.ComponentProps<typeof PacketEdgeView>;

function renderEdge() {
  return render(
    <svg>
      <PacketEdgeView {...edgeProps} />
    </svg>
  );
}

describe("packet motion", () => {
  const animate = vi.fn(() => ({ cancel: vi.fn() }));
  beforeEach(() => {
    useProtocolDriftStore.setState({
      tokens: [
        { key: "t1", source: "a", target: "b" },
        { key: "t2", source: "a", target: "b" },
        { key: "t3", source: "x", target: "y" },
      ],
      edgeCounts: { "a>b": 7 },
    });
    Object.defineProperty(SVGElement.prototype, "animate", {
      configurable: true,
      value: animate,
    });
    const pathProto = Object.getPrototypeOf(
      document.createElementNS("http://www.w3.org/2000/svg", "path")
    ) as object;
    Object.defineProperty(pathProto, "getTotalLength", {
      configurable: true,
      value: () => 100,
    });
    Object.defineProperty(pathProto, "getPointAtLength", {
      configurable: true,
      value: (at: number) => ({ x: at, y: at / 2 }),
    });
  });
  afterEach(() => {
    cleanup();
    animate.mockClear();
    vi.unstubAllGlobals();
    useProtocolDriftStore.setState({ tokens: [], edgeCounts: {} });
  });

  it("glides tokens on this wire using only transform and opacity", () => {
    mockMotion(false);
    const { container } = renderEdge();
    expect(container.querySelectorAll("circle")).toHaveLength(2);
    expect(container.querySelector("[data-testid='wire-counter']")).toBeNull();
    expect(animate).toHaveBeenCalledTimes(2);
    const frames = (animate.mock.calls[0] as unknown as [Keyframe[]])[0];
    for (const frame of frames) {
      expect(Object.keys(frame).sort()).toEqual([
        "offset",
        "opacity",
        "transform",
      ]);
    }
  });

  it("replaces moving tokens with a stationary counter under reduced motion", () => {
    mockMotion(true);
    const { container, getByTestId } = renderEdge();
    expect(container.querySelectorAll("circle")).toHaveLength(0);
    expect(animate).not.toHaveBeenCalled();
    expect(getByTestId("wire-counter").textContent).toBe("7");
  });

  it("caps simultaneous tokens at 30 however many packets arrive", async () => {
    const { loadTemplate, init } = useProtocolDriftStore.getState();
    await act(async () => {
      await init("tracer");
      await useProtocolDriftStore.getState().command({ type: "ACCEPT_BRIEF" });
      await loadTemplate({
        nodes: toFlowNodes(TRACER_GRAPH.nodes),
        edges: toFlowEdges(TRACER_GRAPH.edges),
      });
      const s = useProtocolDriftStore.getState();
      await s.validate();
      await s.publish();
      await s.command({ type: "ADVANCE_TO", minute: minuteAt(14, 23, 59) });
    });
    const state = useProtocolDriftStore.getState();
    expect(state.packets.length).toBeGreaterThan(MAX_TOKENS);
    expect(state.tokens.length).toBeLessThanOrEqual(MAX_TOKENS);
    expect(
      Object.values(state.edgeCounts).reduce((a, b) => a + b, 0)
    ).toBeGreaterThan(MAX_TOKENS);
  });
});
