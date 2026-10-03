// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  AMENDMENT_GRAPH,
  CHIP_SPECS,
  FULL_GRAPH,
  LANE_GEOMETRY,
  TRACER_GRAPH,
  WAVE1_GRAPH,
  clampNodePosition,
  compileGraph,
  isWireCompatible,
  laneBounds,
  validateGraph,
  type PipelineGraph,
} from "@/lib/protocol-drift";
import { publish, runUntil, startEngine, WAVE_END_MINUTES } from "./helpers";

describe("graph validation", () => {
  it("accepts the reference graphs", () => {
    expect(validateGraph(TRACER_GRAPH).valid).toBe(true);
    expect(validateGraph(WAVE1_GRAPH).valid).toBe(true);
    expect(
      validateGraph(AMENDMENT_GRAPH, { amendmentAnnounced: true }).valid
    ).toBe(true);
    expect(validateGraph(FULL_GRAPH, { amendmentAnnounced: true }).valid).toBe(
      true
    );
  });

  it("halts on a disconnected ExtractField.dbp with the exact error", () => {
    const graph: PipelineGraph = {
      nodes: TRACER_GRAPH.nodes,
      edges: TRACER_GRAPH.edges.filter((e) => e.sourceHandle !== "dbp"),
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Unmapped observation handle: dbp");

    const engine = startEngine("tracer");
    const events = engine.dispatch({ type: "VALIDATE_GRAPH", ...graph });
    const vr = events.find((e) => e.type === "VALIDATION_RESULT");
    expect(vr && vr.type === "VALIDATION_RESULT" && vr.errors).toContain(
      "Unmapped observation handle: dbp"
    );
    expect(engine.view().fsmState).toBe("VALIDATE");
  });

  it("rejects invalid wires such as an observation stream into a raw entry input", () => {
    const graph: PipelineGraph = {
      nodes: TRACER_GRAPH.nodes,
      edges: [
        ...TRACER_GRAPH.edges,
        {
          id: "bad",
          source: "pivot",
          sourceHandle: "obs_stream",
          target: "extract",
          targetHandle: "in",
        },
      ],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Invalid wire: pivot.obs_stream -> extract.in"
    );
    expect(
      isWireCompatible("PivotToObservation", "obs_stream", "ExtractField", "in")
    ).toBe(false);
    expect(
      isWireCompatible("ExtractField", "sbp", "PivotToObservation", "sbp")
    ).toBe(true);
    expect(
      isWireCompatible("ExtractField", "nope", "PivotToObservation", "sbp")
    ).toBe(false);
  });

  it("forbids wires that flow upward across the Conservation Wall", () => {
    expect(
      isWireCompatible("PairAndDerive", "adam_rows", "CDISCSink", "obs_in")
    ).toBe(false);
    expect(
      isWireCompatible(
        "CDISCSink",
        "snapshot_out",
        "SnapshotHandoff",
        "snapshot_in"
      )
    ).toBe(true);
  });

  it("reports structural errors", () => {
    const empty = validateGraph({ nodes: [], edges: [] });
    expect(empty.errors).toEqual(
      expect.arrayContaining([
        "Missing SourceIngest",
        "Missing ExtractField",
        "Missing PivotToObservation",
        "Missing CDISCSink",
      ])
    );
    const dup = validateGraph({
      nodes: [
        ...TRACER_GRAPH.nodes,
        { id: "sink", type: "CDISCSink", position: { x: 1, y: 200 } },
        { id: "x", type: "Bogus" as never, position: { x: 0, y: 200 } },
      ],
      edges: [
        ...TRACER_GRAPH.edges,
        {
          id: "e",
          source: "ghost",
          target: "sink",
          sourceHandle: "a",
          targetHandle: "b",
        },
        { id: "h", source: "ingest", target: "extract" },
      ],
    });
    expect(dup.errors).toEqual(
      expect.arrayContaining([
        "Duplicate node id: sink",
        "Multiple CDISCSink nodes",
        "Unknown chip type: Bogus",
        "Edge e references a missing node",
        "Edge h is missing a handle",
      ])
    );
  });

  it("detects cycles, unreachable sinks and an unwired source", () => {
    const cyclic: PipelineGraph = {
      nodes: [
        ...TRACER_GRAPH.nodes,
        { id: "u", type: "UnitStandardizer", position: { x: 1, y: 200 } },
        { id: "u2", type: "UnitStandardizer", position: { x: 1, y: 200 } },
      ],
      edges: [
        ...TRACER_GRAPH.edges,
        {
          id: "c1",
          source: "u",
          sourceHandle: "std_val",
          target: "u2",
          targetHandle: "val_in",
        },
        {
          id: "c2",
          source: "u2",
          sourceHandle: "std_val",
          target: "u",
          targetHandle: "val_in",
        },
      ],
    };
    expect(validateGraph(cyclic).errors).toContain(
      "Cycle detected: Level 1 pipelines must be acyclic"
    );
    expect(compileGraph(cyclic)).toBeNull();
    const noSink: PipelineGraph = {
      nodes: TRACER_GRAPH.nodes,
      edges: TRACER_GRAPH.edges.filter(
        (e) => e.target !== "sink" && e.source !== "ingest"
      ),
    };
    const r = validateGraph(noSink);
    expect(r.errors).toContain("pivot.obs_stream does not reach CDISCSink");
    expect(r.errors).toContain("SourceIngest.raw_entry is not wired");
  });

  it("requires the AmendmentRouter and standing branches once Amendment 01 is announced", () => {
    const r = validateGraph(WAVE1_GRAPH, { amendmentAnnounced: true });
    expect(r.valid).toBe(false);
    expect(r.errors).toEqual(
      expect.arrayContaining([
        "Unmapped observation handle: sbp_stand",
        "Unmapped observation handle: dbp_stand",
        "Amendment 01 active: AmendmentRouter required downstream of SourceIngest",
      ])
    );
    const halfRouter: PipelineGraph = {
      nodes: AMENDMENT_GRAPH.nodes,
      edges: AMENDMENT_GRAPH.edges.filter(
        (e) => !(e.source === "router" && e.sourceHandle === "v2")
      ),
    };
    expect(
      validateGraph(halfRouter, { amendmentAnnounced: true }).errors
    ).toContain("AmendmentRouter router.v2 is not wired");
  });

  it("warns about imputing date normalizers and unwired MH and raw_bp ports", () => {
    const graph: PipelineGraph = {
      nodes: WAVE1_GRAPH.nodes.map((n) =>
        n.id === "date" ? { ...n, data: { partialDates: "impute-day" } } : n
      ),
      edges: WAVE1_GRAPH.edges,
    };
    expect(validateGraph(graph).warnings.join(" ")).toContain(
      "fabricated precision"
    );
    const tracer = validateGraph(TRACER_GRAPH);
    expect(tracer.warnings).toContain(
      "SourceIngest.mh_entry is not wired: MH will be held"
    );
    expect(tracer.warnings.join(" ")).toContain("raw_bp is not wired");
  });
});

describe("Conservation Wall clamping", () => {
  it("clamps tabulation chips above y=416 and analysis chips below it", () => {
    const { conservationWallY, chipHeight } = LANE_GEOMETRY;
    expect(clampNodePosition("ExtractField", { x: 10, y: 600 })).toEqual({
      x: 10,
      y: conservationWallY - chipHeight,
    });
    expect(clampNodePosition("ExtractField", { x: -5, y: 20 })).toEqual({
      x: 0,
      y: 112,
    });
    expect(clampNodePosition("PairAndDerive", { x: 10, y: 200 })).toEqual({
      x: 10,
      y: conservationWallY,
    });
    expect(laneBounds("WALL")).toEqual({
      min: conservationWallY - chipHeight,
      max: conservationWallY,
    });
    const dragged: PipelineGraph = {
      nodes: TRACER_GRAPH.nodes.map((n) =>
        n.id === "pivot" ? { ...n, position: { x: 500, y: 700 } } : n
      ),
      edges: TRACER_GRAPH.edges,
    };
    const r = validateGraph(dragged);
    expect(r.valid).toBe(true);
    expect(r.warnings).toContain("Clamped pivot into the TABULATION lane");
    const pivot = r.clampedNodes.find((n) => n.id === "pivot");
    expect((pivot?.position.y ?? 0) + chipHeight).toBeLessThanOrEqual(
      conservationWallY
    );
  });

  it("documents every chip port", () => {
    expect(Object.keys(CHIP_SPECS)).toHaveLength(10);
    expect(CHIP_SPECS.AmendmentRouter.outputs.map((p) => p.handle)).toEqual([
      "v1",
      "v2",
      "review",
    ]);
    expect(CHIP_SPECS.PairAndDerive.outputs.map((p) => p.handle)).toEqual([
      "adam_rows",
      "unpaired",
    ]);
  });
});

describe("tracer pipeline execution", () => {
  it("produces exactly 18 VS rows with contiguous VSSEQ per USUBJID", () => {
    const engine = startEngine("tracer");
    publish(engine, TRACER_GRAPH, "p1");
    runUntil(engine, WAVE_END_MINUTES[1]);
    const rows = engine.view().vsLedger;
    expect(rows).toHaveLength(18);
    for (const subject of ["PD-101-A01", "PD-101-A02"]) {
      const seqs = rows
        .filter((r) => r.USUBJID === subject)
        .map((r) => r.VSSEQ);
      expect(seqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
    const first = rows[0];
    expect(first).toMatchObject({
      STUDYID: "PD-101",
      DOMAIN: "VS",
      USUBJID: "PD-101-A01",
      VSTESTCD: "SYSBP",
      VSORRES: "118",
      VSSTRESN: 118,
      VSPOS: "SITTING",
      EPOCH: "BASELINE",
      VSDTC: "2025-11-01",
      sourceRevisionId: "rev-a01-d00-r1",
    });
    expect(rows.find((r) => r.VISITNUM === 7)?.EPOCH).toBe("TREATMENT");
  });
});
