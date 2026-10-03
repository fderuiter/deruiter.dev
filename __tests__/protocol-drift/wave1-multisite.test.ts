// @vitest-environment node
import { describe, expect, it } from "vitest";
import { KPA_TO_MMHG, WAVE1_GRAPH, WAVE_VS_TOTALS } from "@/lib/protocol-drift";
import { publish, runUntil, startEngine, WAVE_END_MINUTES } from "./helpers";

describe("Wave 1 multi-site ingestion", () => {
  const engine = startEngine();
  publish(engine, WAVE1_GRAPH, "p1");
  runUntil(engine, WAVE_END_MINUTES[1]);
  const v = engine.view();
  const current = v.vsLedger.filter((r) => !r.superseded);

  it("yields 54 current VS records and 6 MH records", () => {
    expect(current).toHaveLength(WAVE_VS_TOTALS[1]);
    expect(current).toHaveLength(54);
    expect(v.mhLedger).toHaveLength(6);
    expect(v.fsmState).toBe("WAVE_REVIEW");
  });

  it("flags B01 Day 14 SBP 210 as a pending out-of-range discrepancy with worksheet evidence", () => {
    const sbp = current.find(
      (r) =>
        r.USUBJID === "PD-101-B01" &&
        r.VISITNUM === 14 &&
        r.VSTESTCD === "SYSBP"
    );
    expect(sbp?.VSSTRESN).toBe(210);
    const issue = v.issues.find(
      (i) => i.submissionId === "sub-b01-d14" && i.code === "OUT_OF_RANGE"
    );
    expect(issue?.status).toBe("Open");
    expect(issue?.evidence).toContain("120");
    expect(issue?.scriptedStampOnGeneric).toBe(true);
  });

  it("standardizes Site C kPa to mmHg and keeps the original value and unit", () => {
    const c = current.filter(
      (r) => r.siteId === "SITE-C" && r.VSTESTCD !== "PULSE"
    );
    expect(c).toHaveLength(12);
    for (const r of c) {
      expect(r.VSORRESU).toBe("kPa");
      expect(r.VSSTRESU).toBe("mmHg");
      expect(r.VSSTRESN).toBeCloseTo(Number(r.VSORRES) * KPA_TO_MMHG, 10);
    }
    const c01d7 = c.find(
      (r) =>
        r.USUBJID === "PD-101-C01" && r.VISITNUM === 7 && r.VSTESTCD === "SYSBP"
    );
    expect(c01d7).toMatchObject({
      VSORRES: "16.0",
      VSSTRESC: "120.0",
      VSDTC: "2025-11-08",
    });
  });

  it("splits the A01 Day 7 narrative and keeps the repeat reading as a visible LOSS issue", () => {
    const a01d7 = current.filter(
      (r) => r.USUBJID === "PD-101-A01" && r.VISITNUM === 7
    );
    expect(a01d7.map((r) => r.VSSTRESN)).toEqual([120, 80, 72]);
    expect(v.unmatched).toHaveLength(1);
    expect(v.unmatched[0].text).toContain("118/78");
    const issue = v.issues.find((i) => i.code === "NARRATIVE_REPEAT");
    expect(issue?.status).toBe("Open");
    expect(v.debt.semanticLossCount).toBe(1);
  });

  it("keeps the A02 partial onset as honest uncertainty awaiting disposition", () => {
    const a02 = v.mhLedger.find((r) => r.USUBJID === "PD-101-A02");
    expect(a02).toMatchObject({
      MHSTDTC: "2025-10",
      epistemicStatus: "UNCERTAIN",
      fabricatedBits: 0,
    });
    expect(v.issues.find((i) => i.code === "PARTIAL_DATE")?.status).toBe(
      "ReadyForReview"
    );
    expect(v.debt.uncertainCount).toBe(1);
    expect(v.debt.fabricatedBits).toBe(0);
  });
});
