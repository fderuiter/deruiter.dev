// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  pairAndDerive,
  pairMeasurements,
  type ADaMVitalSignRecord,
} from "@/lib/protocol-drift";
import { startEngine, runToWave2, vsRecord } from "./helpers";

describe("PairAndDerive", () => {
  it("derives A01 Day 24 drops of 22 and 12 with CRIT1FL Y in the engine", () => {
    const engine = startEngine();
    runToWave2(engine);
    const rows = engine
      .view()
      .adamRows.filter((r) => r.USUBJID === "PD-101-A01" && r.AVISITN === 24);
    expect(rows.map((r) => [r.PARAMCD, r.AVAL, r.CRIT1FL])).toEqual([
      ["OSBPDRP", 22, "Y"],
      ["ODBPDRP", 12, "Y"],
    ]);
    expect(rows[0]).toMatchObject({
      BASE: 120,
      CHG: -22,
      AVALC: "22",
      ANL01FL: "Y",
      derivationRule: "ORTHO_DELTA_V1",
    });
    const vs = engine.view().vsLedger;
    expect(
      vs.some(
        (r) =>
          r.recordId === rows[0].sourceSittingRecordId && r.VSPOS === "SITTING"
      )
    ).toBe(true);
    expect(
      vs.some(
        (r) =>
          r.recordId === rows[0].sourceStandingRecordId &&
          r.VSPOS === "STANDING"
      )
    ).toBe(true);
  });

  it("flags at the thresholds of 20 and 10 inclusive", () => {
    const sit = vsRecord({
      USUBJID: "S",
      VISITNUM: 24,
      VSTESTCD: "SYSBP",
      VSPOS: "SITTING",
      VSSTRESN: 120,
    });
    const at = pairMeasurements(sit, {
      ...sit,
      recordId: "x",
      VSPOS: "STANDING",
      VSSTRESN: 100,
    }) as ADaMVitalSignRecord;
    const below = pairMeasurements(sit, {
      ...sit,
      recordId: "y",
      VSPOS: "STANDING",
      VSSTRESN: 101,
    }) as ADaMVitalSignRecord;
    expect(at.CRIT1FL).toBe("Y");
    expect(below.CRIT1FL).toBe("N");
    const dsit = vsRecord({
      USUBJID: "S",
      VISITNUM: 24,
      VSTESTCD: "DIABP",
      VSPOS: "SITTING",
      VSSTRESN: 80,
    });
    const dia = pairMeasurements(dsit, {
      ...dsit,
      recordId: "z",
      VSPOS: "STANDING",
      VSSTRESN: 70,
    }) as ADaMVitalSignRecord;
    expect(dia).toMatchObject({ PARAMCD: "ODBPDRP", AVAL: 10, CRIT1FL: "Y" });
  });

  it("derives kPa sites from unrounded values and displays at 0.1", () => {
    const sit = vsRecord({
      USUBJID: "C",
      VISITNUM: 28,
      VSTESTCD: "SYSBP",
      VSPOS: "SITTING",
      VSSTRESN: 120.00992,
      precision: 1,
    });
    const stand = vsRecord({
      USUBJID: "C",
      VISITNUM: 28,
      VSTESTCD: "SYSBP",
      VSPOS: "STANDING",
      VSSTRESN: 99.758246,
      precision: 1,
    });
    const row = pairMeasurements(sit, stand) as ADaMVitalSignRecord;
    expect(row.AVAL).toBeCloseTo(20.251674, 6);
    expect(row.AVALC).toBe("20.3");
    expect(row.CRIT1FL).toBe("Y");
  });

  it("emits one row per parameter for a complete visit", () => {
    const recs = [
      vsRecord({
        USUBJID: "S",
        VISITNUM: 24,
        VSTESTCD: "SYSBP",
        VSPOS: "SITTING",
        VSSTRESN: 120,
      }),
      vsRecord({
        USUBJID: "S",
        VISITNUM: 24,
        VSTESTCD: "SYSBP",
        VSPOS: "STANDING",
        VSSTRESN: 110,
      }),
      vsRecord({
        USUBJID: "S",
        VISITNUM: 24,
        VSTESTCD: "DIABP",
        VSPOS: "SITTING",
        VSSTRESN: 80,
      }),
      vsRecord({
        USUBJID: "S",
        VISITNUM: 24,
        VSTESTCD: "DIABP",
        VSPOS: "STANDING",
        VSSTRESN: 75,
      }),
      vsRecord({
        USUBJID: "S",
        VISITNUM: 24,
        VSTESTCD: "PULSE",
        VSPOS: "SITTING",
        VSSTRESN: 70,
      }),
    ];
    const out = pairAndDerive(recs);
    expect(out.adamRows.map((r) => [r.PARAMCD, r.AVAL, r.CRIT1FL])).toEqual([
      ["OSBPDRP", 10, "N"],
      ["ODBPDRP", 5, "N"],
    ]);
    expect(out.unpaired).toHaveLength(0);
    expect(out.traceViolations).toHaveLength(0);
  });
});
