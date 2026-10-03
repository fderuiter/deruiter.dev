// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  pairAndDerive,
  pairMeasurements,
  type TraceViolation,
} from "@/lib/protocol-drift";
import { vsRecord } from "./helpers";

const v1Visit = [
  vsRecord({
    USUBJID: "PD-101-B01",
    VISITNUM: 24,
    VSTESTCD: "SYSBP",
    VSPOS: "SITTING",
    VSSTRESN: 118,
    protocolVersion: "v1",
  }),
  vsRecord({
    USUBJID: "PD-101-B01",
    VISITNUM: 24,
    VSTESTCD: "DIABP",
    VSPOS: "SITTING",
    VSSTRESN: 76,
    protocolVersion: "v1",
  }),
];
const v2Visit = [
  vsRecord({
    USUBJID: "PD-101-B01",
    VISITNUM: 28,
    VSTESTCD: "SYSBP",
    VSPOS: "SITTING",
    VSSTRESN: 120,
  }),
  vsRecord({
    USUBJID: "PD-101-B01",
    VISITNUM: 28,
    VSTESTCD: "SYSBP",
    VSPOS: "STANDING",
    VSSTRESN: 102,
  }),
  vsRecord({
    USUBJID: "PD-101-B01",
    VISITNUM: 28,
    VSTESTCD: "DIABP",
    VSPOS: "SITTING",
    VSSTRESN: 80,
  }),
  vsRecord({
    USUBJID: "PD-101-B01",
    VISITNUM: 28,
    VSTESTCD: "DIABP",
    VSPOS: "STANDING",
    VSSTRESN: 70,
  }),
];

describe("pairing guards", () => {
  it("marks a v1 visit NOT EVALUABLE with AVAL null and never imputes", () => {
    const out = pairAndDerive(v1Visit);
    expect(out.adamRows).toHaveLength(0);
    expect(out.unpaired).toHaveLength(1);
    expect(out.unpaired[0]).toMatchObject({
      PARAMCD: "ORTHOST",
      AVAL: null,
      AVALC: "NOT EVALUABLE",
      BASE: null,
      CHG: null,
      ANL01FL: "N",
    });
    expect(out.unpaired[0].reason).toMatch(/protocol v1/);
  });

  it("explains a v2 visit missing its standing measurements", () => {
    const out = pairAndDerive([{ ...v1Visit[0], protocolVersion: "v2" }]);
    expect(out.unpaired[0].reason).toMatch(/No standing measurement/);
  });

  it("marks a parameter NOT EVALUABLE when its pair is incomplete or ambiguous", () => {
    const extra = { ...v2Visit[1], recordId: "dup", VSSTRESN: 100 };
    const out = pairAndDerive([
      ...v2Visit.slice(0, 2),
      extra,
      ...v2Visit.slice(2),
    ]);
    expect(out.adamRows.map((r) => r.PARAMCD)).toEqual(["ODBPDRP"]);
    expect(out.unpaired[0]).toMatchObject({ PARAMCD: "OSBPDRP", AVAL: null });
    expect(out.unpaired[0].reason).toMatch(/found 1 and 2/);
    const missing = pairAndDerive(v2Visit.slice(0, 3));
    expect(missing.unpaired.map((r) => r.PARAMCD)).toEqual(["ODBPDRP"]);
  });

  it("rejects a cross-visit pair as a TRACE violation", () => {
    const t = pairMeasurements(v1Visit[0], v2Visit[1]) as TraceViolation;
    expect(t.code).toBe("TRACE");
    expect(t.message).toMatch(/Cross-visit/);
    expect(
      (pairMeasurements(v2Visit[0], v2Visit[0]) as TraceViolation).code
    ).toBe("TRACE");
  });

  it("produces TRACE violations and no cross-visit rows when joined by subject", () => {
    const out = pairAndDerive([...v1Visit, ...v2Visit], { joinKey: "subject" });
    expect(out.traceViolations.length).toBeGreaterThan(0);
    expect(out.traceViolations.every((t) => t.code === "TRACE")).toBe(true);
    expect(out.adamRows.every((r) => r.AVISITN === 28)).toBe(true);
    expect(
      pairAndDerive([...v1Visit, ...v2Visit]).traceViolations
    ).toHaveLength(0);
  });
});
