// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  evaluateLockGate,
  type LockGateInput,
  type ProtocolDriftView,
} from "@/lib/protocol-drift";
import { playFullLevel, startEngine, vsRecord } from "./helpers";

function inputFrom(v: ProtocolDriftView): LockGateInput {
  return structuredClone({
    vsRecords: v.vsLedger,
    mhRecords: v.mhLedger,
    adamRows: v.adamRows,
    unpaired: v.unpaired,
    issues: v.issues,
    queries: v.queries,
    held: v.held,
    unmatched: [],
    traceViolations: v.traceViolations,
    debt: v.debt,
  });
}

describe("dual lock gate", () => {
  const engine = startEngine();
  playFullLevel(engine);
  const base = inputFrom(engine.view());
  const codes = (input: LockGateInput) =>
    evaluateLockGate(input).discrepancies.map((d) => d.code);

  it("passes every SDTM and ADaM check on the careful playthrough", () => {
    const result = evaluateLockGate(base);
    expect(result.canLock).toBe(true);
    expect(result.discrepancies).toEqual([]);
    expect(result.sdtmChecklist.vsRecordCount).toEqual({
      expected: 110,
      actual: 110,
      passed: true,
    });
    expect(result.adamChecklist.derivedRecordsCount).toEqual({
      expected: 20,
      actual: 20,
      passed: true,
    });
    expect(result.adamChecklist.unevaluableHandledCorrectly.passed).toBe(true);
  });

  it("blocks on fabricated precision and names the MH record", () => {
    const input = inputFrom(engine.view());
    const a02 = input.mhRecords.find((r) => r.USUBJID === "PD-101-A02");
    if (a02) a02.fabricatedBits = Math.log2(31);
    input.debt.fabricatedBits = Math.log2(31);
    const result = evaluateLockGate(input);
    expect(result.canLock).toBe(false);
    expect(result.discrepancies[0]).toMatchObject({
      code: "FABRICATED_DEBT_EXCEEDED",
      entityId: a02?.recordId,
    });
    expect(result.discrepancies[0].message).toContain("4.95");
  });

  it("blocks on open queries and stale derivations", () => {
    const input = inputFrom(engine.view());
    input.queries[0].communicationState = "AwaitingResponse";
    input.adamRows[0].stale = true;
    expect(codes(input)).toEqual(
      expect.arrayContaining([
        "OPEN_QUERIES_REMAINING",
        "STALE_DERIVATIONS_EXIST",
      ])
    );
  });

  it("names every other failing check", () => {
    const input = inputFrom(engine.view());
    input.vsRecords = input.vsRecords.slice(1);
    input.mhRecords = input.mhRecords.slice(1);
    input.issues[0].status = "Open";
    input.debt.semanticLossCount = 1;
    input.held.push({
      heldId: "h1",
      submissionId: "s",
      sourceRevisionId: "r",
      nodeId: "n",
      handle: "h",
      reason: "x",
    });
    input.traceViolations.push({
      code: "TRACE",
      USUBJID: "S",
      sittingRecordId: "a",
      standingRecordId: "b",
      message: "m",
    });
    input.unpaired = input.unpaired.slice(1);
    input.adamRows[0].sourceStandingRecordId = "missing";
    input.adamRows.push({
      ...input.adamRows[0],
      rowId: "v1-numeric",
      USUBJID: "PD-101-B01",
      AVISITN: 24,
    });
    const uncertain = vsRecord({
      USUBJID: "U",
      VISITNUM: 1,
      VSTESTCD: "SYSBP",
      VSPOS: "SITTING",
      VSSTRESN: 1,
      epistemicStatus: "UNCERTAIN",
      submissionId: "u",
    });
    input.vsRecords.push(uncertain, {
      ...uncertain,
      recordId: "no-trace",
      epistemicStatus: "CONFIRMED",
      VSTESTCD: "DIABP",
      sourceRevisionId: "",
    });
    expect(new Set(codes(input))).toEqual(
      new Set([
        "VS_COUNT_MISMATCH",
        "MH_COUNT_MISMATCH",
        "UNRESOLVED_ISSUES",
        "SEMANTIC_LOSS_PRESENT",
        "UNCERTAINTY_UNDOCUMENTED",
        "BROKEN_TRACES",
        "HELD_PACKETS_REMAINING",
        "ADAM_COUNT_MISMATCH",
        "UNEVALUABLE_MISHANDLED",
        "CROSS_VISIT_COLLISIONS",
      ])
    );
    expect(
      evaluateLockGate(input).discrepancies.every((d) => d.entityId.length > 0)
    ).toBe(true);
  });
});
