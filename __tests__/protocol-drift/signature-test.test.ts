// @vitest-environment node
import { describe, expect, it } from "vitest";
import { startEngine, runToWave2 } from "./helpers";

describe("Site B late backlog signature test", () => {
  const engine = startEngine();
  runToWave2(engine);
  const v = engine.view();

  it("routes the Day 24 visits submitted on Day 27 by assessment date to v1", () => {
    for (const id of ["sub-b01-d24", "sub-b02-d24"]) {
      expect(v.routing.find((r) => r.submissionId === id)).toMatchObject({
        handle: "v1",
        requiredVersion: "v1",
        formVersion: "v1",
        routedBy: "assessedAt",
      });
    }
  });

  it("tabulates exactly three sitting rows for B01 Day 24 with no standing rows", () => {
    const rows = v.vsLedger.filter(
      (r) => !r.superseded && r.USUBJID === "PD-101-B01" && r.VISITNUM === 24
    );
    expect(rows).toHaveLength(3);
    expect(
      rows.every((r) => r.VSPOS === "SITTING" && r.protocolVersion === "v1")
    ).toBe(true);
  });

  it("keeps Site B goodwill at 35 with no applicability issue", () => {
    expect(v.sites["SITE-B"].goodwill).toBe(35);
    expect(v.issues.some((i) => i.code === "APPLICABILITY_DISCREPANCY")).toBe(
      false
    );
  });

  it("marks the B Day 24 visits NOT EVALUABLE in the unpaired ledger", () => {
    const ne = v.unpaired.filter(
      (r) => r.USUBJID.startsWith("PD-101-B0") && r.AVISITN === 24
    );
    expect(ne).toHaveLength(2);
    expect(
      ne.every(
        (r) =>
          r.PARAMCD === "ORTHOST" &&
          r.AVAL === null &&
          r.AVALC === "NOT EVALUABLE"
      )
    ).toBe(true);
  });
});
