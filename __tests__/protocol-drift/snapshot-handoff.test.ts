// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import { deepFreeze, snapshotHandoff } from "@/lib/protocol-drift";
import { vsRecord } from "./helpers";

describe("SnapshotHandoff", () => {
  const ledger = [
    vsRecord({
      USUBJID: "PD-101-A01",
      VISITNUM: 24,
      VSTESTCD: "SYSBP",
      VSPOS: "SITTING",
      VSSTRESN: 120,
    }),
    vsRecord({
      USUBJID: "PD-101-A01",
      VISITNUM: 24,
      VSTESTCD: "SYSBP",
      VSPOS: "STANDING",
      VSSTRESN: 98,
    }),
    vsRecord({
      USUBJID: "PD-101-A01",
      VISITNUM: 24,
      VSTESTCD: "DIABP",
      VSPOS: "SITTING",
      VSSTRESN: 80,
      superseded: true,
    }),
  ];

  it("copies only current rows and deep-freezes the copy", () => {
    const snap = snapshotHandoff(ledger);
    expect(snap).toHaveLength(2);
    expect(Object.isFrozen(snap)).toBe(true);
    expect(snap.every((r) => Object.isFrozen(r))).toBe(true);
    expect(snap[0]).not.toBe(ledger[0]);
  });

  it("throws on mutation and leaves the ledger unchanged", () => {
    const snap = snapshotHandoff(ledger);
    expect(() => {
      (snap[0] as { VSSTRESN: number }).VSSTRESN = 999;
    }).toThrow(TypeError);
    expect(() => fromAny<unknown[], unknown>(snap).push(1)).toThrow(TypeError);
    expect(ledger[0].VSSTRESN).toBe(120);
    expect(Object.isFrozen(ledger[0])).toBe(false);
  });

  it("deepFreeze leaves primitives and already-frozen objects alone", () => {
    expect(deepFreeze(5)).toBe(5);
    expect(deepFreeze(null)).toBeNull();
    const nested = { a: { b: [1, 2] } };
    deepFreeze(nested);
    expect(Object.isFrozen(nested.a.b)).toBe(true);
  });
});
