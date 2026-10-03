// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  EpistemicContradictionError,
  WAVE1_GRAPH,
  daysInMonth,
  fabricatedBits,
  resolvePartialDate,
  worstStatus,
  type PipelineGraph,
} from "@/lib/protocol-drift";
import {
  ok,
  publish,
  runUntil,
  startEngine,
  WAVE_END_MINUTES,
} from "./helpers";

describe("fabricated precision", () => {
  it("keeps 2025-10 as honest uncertainty with zero debt", () => {
    expect(resolvePartialDate("2025-10", "preserve")).toEqual({
      value: "2025-10",
      status: "UNCERTAIN",
      fabricatedBits: 0,
    });
    expect(resolvePartialDate("2020-04-12", "impute-day")).toEqual({
      value: "2020-04-12",
      status: "CONFIRMED",
      fabricatedBits: 0,
    });
  });

  it("imputing 2025-10-01 accrues log2(31) = 4.954 bits and FABRICATED status", () => {
    const r = resolvePartialDate("2025-10", "impute-day");
    expect(r.value).toBe("2025-10-01");
    expect(r.status).toBe("FABRICATED");
    expect(r.fabricatedBits).toBeCloseTo(Math.log2(31), 10);
    expect(r.fabricatedBits).toBeCloseTo(4.954, 3);
    expect(resolvePartialDate("2024", "impute-day").fabricatedBits).toBeCloseTo(
      Math.log2(366),
      10
    );
    expect(resolvePartialDate("2025", "impute-day").fabricatedBits).toBeCloseTo(
      Math.log2(365),
      10
    );
    expect(resolvePartialDate("2025", "preserve").status).toBe("UNCERTAIN");
  });

  it("guards the D_fab ratio", () => {
    expect(fabricatedBits(31, 31)).toBe(0);
    expect(() => fabricatedBits(0, 1)).toThrow(EpistemicContradictionError);
    expect(() => fabricatedBits(31, 0)).toThrow(EpistemicContradictionError);
    expect(() => fabricatedBits(31, 32)).toThrow(EpistemicContradictionError);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(worstStatus(["CONFIRMED", "UNCERTAIN", "LOSS"])).toBe("LOSS");
    expect(worstStatus(["LOSS", "FABRICATED"])).toBe("FABRICATED");
    expect(worstStatus([])).toBe("CONFIRMED");
  });
});

describe("engine-level debt", () => {
  it("accrues 4.95 bits when a pipeline chip auto-imputes the A02 onset day", () => {
    const graph: PipelineGraph = {
      nodes: [
        ...WAVE1_GRAPH.nodes,
        {
          id: "mhdate",
          type: "DateLocaleNormalizer",
          position: { x: 760, y: 320 },
          data: { partialDates: "impute-day" },
        },
      ],
      edges: [
        ...WAVE1_GRAPH.edges.filter((e) => e.sourceHandle !== "mh_entry"),
        {
          id: "m1",
          source: "ingest",
          sourceHandle: "mh_entry",
          target: "mhdate",
          targetHandle: "mh_in",
        },
        {
          id: "m2",
          source: "mhdate",
          sourceHandle: "mh_out",
          target: "sink",
          targetHandle: "mh_in",
        },
      ],
    };
    const engine = startEngine();
    publish(engine, graph, "p1");
    runUntil(engine, WAVE_END_MINUTES[1]);
    const v = engine.view();
    const a02 = v.mhLedger.find((r) => r.USUBJID === "PD-101-A02");
    expect(a02?.MHSTDTC).toBe("2025-10-01");
    expect(a02?.epistemicStatus).toBe("FABRICATED");
    expect(v.debt.fabricatedBits).toBeCloseTo(4.954, 3);
    expect(v.issues.some((i) => i.code === "PARTIAL_DATE")).toBe(false);
  });

  it("flags LOSS when kPa is dropped without VSORRESU preservation", () => {
    const graph: PipelineGraph = {
      nodes: WAVE1_GRAPH.nodes.filter((n) => !n.id.startsWith("unit-")),
      edges: [
        ...WAVE1_GRAPH.edges.filter(
          (e) => !e.source.startsWith("unit-") && !e.target.startsWith("unit-")
        ),
        {
          id: "s",
          source: "extract",
          sourceHandle: "sbp",
          target: "pivot",
          targetHandle: "sbp",
        },
        {
          id: "d",
          source: "extract",
          sourceHandle: "dbp",
          target: "pivot",
          targetHandle: "dbp",
        },
        {
          id: "rs",
          source: "regex",
          sourceHandle: "sbp",
          target: "pivot",
          targetHandle: "sbp",
        },
        {
          id: "rd",
          source: "regex",
          sourceHandle: "dbp",
          target: "pivot",
          targetHandle: "dbp",
        },
      ],
    };
    const engine = startEngine();
    publish(engine, graph, "p1");
    runUntil(engine, WAVE_END_MINUTES[1]);
    const v = engine.view();
    const c01 = v.vsLedger.find(
      (r) =>
        r.USUBJID === "PD-101-C01" && r.VISITNUM === 7 && r.VSTESTCD === "SYSBP"
    );
    expect(c01?.VSSTRESN).toBe(16);
    expect(c01?.VSORRESU).toBe("mmHg");
    expect(c01?.epistemicStatus).toBe("LOSS");
    expect(c01?.lossNote).toContain("kPa");
    expect(v.debt.semanticLossCount).toBeGreaterThanOrEqual(12);
    expect(
      v.issues.some(
        (i) => i.code === "OUT_OF_RANGE" && i.submissionId === "sub-c01-d07"
      )
    ).toBe(true);
    ok(engine, { type: "SET_PAUSED", isPaused: true });
  });
});
