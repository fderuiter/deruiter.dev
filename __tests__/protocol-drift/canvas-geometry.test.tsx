import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ProtocolDriftGame } from "@/components/protocol-drift/ProtocolDriftGame";
import {
  chipHeight,
  clampChip,
  toPipelineGraph,
} from "@/components/protocol-drift/graph-model";
import { useProtocolDriftStore } from "@/components/protocol-drift/store";
import {
  LANE_GEOMETRY,
  TRACER_GRAPH,
  validateGraph,
} from "@/lib/protocol-drift";
import { installFlowMocks } from "./ui-helpers";

vi.mock("@/lib/audio", () => ({
  getSoundEngine: () => ({ isSoundAllowed: () => false, playTone: vi.fn() }),
}));

async function startDraft() {
  render(<ProtocolDriftGame />);
  await screen.findByRole("dialog", { name: /Trial Briefing/ });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /accept assignment/i }));
  });
}

describe("lane geometry", () => {
  it("clamps Tabulation chips so their whole body stays above y416", () => {
    for (const kind of ["SourceIngest", "ExtractField", "CDISCSink"] as const) {
      const clamped = clampChip(kind, { x: 10, y: 900 });
      expect(clamped.y + chipHeight(kind)).toBeLessThanOrEqual(
        LANE_GEOMETRY.conservationWallY
      );
      expect(clampChip(kind, { x: -20, y: 5 })).toEqual({
        x: 0,
        y: LANE_GEOMETRY.tabulationTop,
      });
    }
  });

  it("keeps ADaM chips below the wall", () => {
    const clamped = clampChip("PairAndDerive", { x: 40, y: 100 });
    expect(clamped.y).toBeGreaterThanOrEqual(LANE_GEOMETRY.conservationWallY);
  });

  it("grows chips to fit one pin row per port", () => {
    expect(chipHeight("SourceIngest")).toBeGreaterThanOrEqual(
      LANE_GEOMETRY.chipHeight
    );
    expect(chipHeight("ExtractField")).toBeGreaterThan(chipHeight("CDISCSink"));
  });
});

describe("pipeline canvas", () => {
  beforeAll(() => installFlowMocks());
  afterEach(() => cleanup());

  it("places toolbox chips by click inside the Tabulation Lane", async () => {
    await startDraft();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Add CDISCSink chip" })
      );
    });
    const nodes = useProtocolDriftStore.getState().nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].position.y).toBeGreaterThanOrEqual(
      LANE_GEOMETRY.tabulationTop
    );
    expect(nodes[0].position.y + chipHeight("CDISCSink")).toBeLessThanOrEqual(
      LANE_GEOMETRY.conservationWallY
    );
    expect(document.querySelector("[data-chip-kind='CDISCSink']")).toBeTruthy();
  });

  it("clamps a chip dropped below the wall back into its lane and syncs the engine", async () => {
    await startDraft();
    await act(async () => {
      await useProtocolDriftStore
        .getState()
        .addChip("SourceIngest", { x: 40, y: 600 });
    });
    const node = useProtocolDriftStore.getState().nodes[0];
    expect(node.position.y + chipHeight("SourceIngest")).toBeLessThanOrEqual(
      416
    );
    const engineNode =
      useProtocolDriftStore.getState().view!.draftGraph.nodes[0];
    expect(engineNode.position).toEqual(node.position);
  });

  it("rebuilds the tracer pipeline from the engine contract", async () => {
    await startDraft();
    const { loadTemplate } = useProtocolDriftStore.getState();
    const { toFlowEdges, toFlowNodes } =
      await import("@/components/protocol-drift/graph-model");
    await act(async () => {
      await loadTemplate({
        nodes: toFlowNodes(TRACER_GRAPH.nodes),
        edges: toFlowEdges(TRACER_GRAPH.edges),
      });
    });
    const { nodes, edges } = useProtocolDriftStore.getState();
    const graph = toPipelineGraph(nodes, edges);
    expect(graph).toEqual(TRACER_GRAPH);
    expect(validateGraph(graph).valid).toBe(true);
  });

  it("offers the pipeline as text with keyboard wiring that rejects unsafe pairs", async () => {
    await startDraft();
    await act(async () => {
      await useProtocolDriftStore
        .getState()
        .addChip("SourceIngest", { x: 40, y: 180 });
      await useProtocolDriftStore
        .getState()
        .addChip("ExtractField", { x: 260, y: 180 });
    });
    await act(async () => {
      fireEvent.click(screen.getByText(/Pipeline as text/));
    });
    expect(
      screen.getByText(/source-ingest-1: SourceIngest, tabulation lane/)
    ).toBeTruthy();
    await act(async () => {
      fireEvent.change(screen.getByLabelText("From output"), {
        target: { value: "source-ingest-1::raw_entry" },
      });
      fireEvent.change(screen.getByLabelText("To input"), {
        target: { value: "extract-field-1::in" },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    });
    expect(useProtocolDriftStore.getState().edges).toHaveLength(1);
    expect(
      screen.getByText(/source-ingest-1\.raw_entry to extract-field-1\.in/)
    ).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Remove wire/ }));
    });
    expect(useProtocolDriftStore.getState().edges).toHaveLength(0);
  });

  it("locks editing while the clock runs", async () => {
    await startDraft();
    const { toFlowEdges, toFlowNodes } =
      await import("@/components/protocol-drift/graph-model");
    await act(async () => {
      await useProtocolDriftStore.getState().loadTemplate({
        nodes: toFlowNodes(TRACER_GRAPH.nodes),
        edges: toFlowEdges(TRACER_GRAPH.edges),
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run Local Test" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Publish Revision" }));
    });
    await act(async () => {
      await useProtocolDriftStore.getState().togglePause();
    });
    expect(useProtocolDriftStore.getState().snapshot?.fsmState).toBe("RUNNING");
    await act(async () => {
      await useProtocolDriftStore
        .getState()
        .addChip("PairAndDerive", { x: 10, y: 500 });
    });
    expect(useProtocolDriftStore.getState().nodes).toHaveLength(4);
    expect(useProtocolDriftStore.getState().notice?.text).toMatch(
      /Pause the clock/
    );
  });
});
