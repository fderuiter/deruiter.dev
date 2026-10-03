// @vitest-environment node
import { describe, expect, it } from "vitest";
import { FULL_GRAPH, type PipelineGraph } from "@/lib/protocol-drift";
import { startEngine, runToWave2 } from "./helpers";

const MISWIRED: PipelineGraph = {
  nodes: FULL_GRAPH.nodes,
  edges: [
    ...FULL_GRAPH.edges,
    {
      id: "stand-into-sit",
      source: "unit-sbp-stand",
      sourceHandle: "std_val",
      target: "pivot",
      targetHandle: "sbp",
    },
  ],
};

describe("position collision", () => {
  it("holds the colliding packet instead of overwriting, and counts it", () => {
    const clean = startEngine();
    runToWave2(clean);
    const engine = startEngine();
    runToWave2(engine, MISWIRED);
    const v = engine.view();
    const current = v.vsLedger.filter((r) => !r.superseded);
    expect(current).toHaveLength(80);
    expect(v.debt.collisionCount).toBe(4);
    const collisions = v.held.filter((h) => /collision/i.test(h.reason));
    expect(collisions.map((h) => h.submissionId).sort()).toEqual([
      "sub-a01-d24",
      "sub-a02-d24",
      "sub-c01-d24",
      "sub-c02-d24",
    ]);
    expect(
      v.issues.filter((i) => i.code === "POSITION_COLLISION")
    ).toHaveLength(4);
    expect(v.auditTrail.some((a) => a.type === "COLLISION_REJECTED")).toBe(
      true
    );
    const sit = (rows: typeof current) =>
      rows.find(
        (r) =>
          r.USUBJID === "PD-101-A01" &&
          r.VISITNUM === 24 &&
          r.VSTESTCD === "SYSBP" &&
          r.VSPOS === "SITTING"
      )?.VSSTRESN;
    const cleanCurrent = clean.view().vsLedger.filter((r) => !r.superseded);
    expect(sit(cleanCurrent)).toBe(120);
    // The first packet to claim the key keeps it; the second is held whole.
    const committed = sit(current);
    const heldA01 = collisions.find((h) => h.submissionId === "sub-a01-d24");
    expect([committed, Number(heldA01?.value)].sort()).toEqual([120, 98]);
    expect(
      current.filter((r) => r.USUBJID === "PD-101-A01" && r.VISITNUM === 24)
    ).toHaveLength(5);
  });

  it("lets the correct standing wiring coexist with sitting rows", () => {
    const engine = startEngine();
    runToWave2(engine);
    const v = engine.view();
    expect(v.debt.collisionCount).toBe(0);
    const a01 = v.vsLedger.filter(
      (r) => !r.superseded && r.USUBJID === "PD-101-A01" && r.VISITNUM === 24
    );
    expect(a01.map((r) => `${r.VSTESTCD}/${r.VSPOS}`).sort()).toEqual([
      "DIABP/SITTING",
      "DIABP/STANDING",
      "PULSE/SITTING",
      "SYSBP/SITTING",
      "SYSBP/STANDING",
    ]);
  });
});
