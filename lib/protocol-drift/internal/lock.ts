/**
 * The dual database lock gate. Every check reads inspectable state passed in
 * by the caller, and every failure names an entity the inspector can open:
 * there is no hidden oracle.
 */
import {
  EXPECTED_ADVS_ROWS,
  EXPECTED_MH_RECORDS,
  EXPECTED_VS_RECORDS,
} from "../presets";
import type { LockAuditResult, LockDiscrepancy, LockGateInput } from "../types";
import { visitKey } from "./analysis";
import { isIssueOpen, isQueryOpen } from "./queries";

const EPSILON = 1e-9;

/** Evaluates the SDTM lock checklist and the ADaM readiness checklist. */
export function evaluateLockGate(input: LockGateInput): LockAuditResult {
  const discrepancies: LockDiscrepancy[] = [];
  const vs = input.vsRecords.filter((r) => !r.superseded);
  const mh = input.mhRecords.filter((r) => !r.superseded);

  const vsPassed = vs.length === EXPECTED_VS_RECORDS;
  if (!vsPassed) {
    discrepancies.push({
      code: "VS_COUNT_MISMATCH",
      message: `${vs.length} of ${EXPECTED_VS_RECORDS} current VS records present`,
      entityId: "VS",
    });
  }
  const mhPassed = mh.length === EXPECTED_MH_RECORDS;
  if (!mhPassed) {
    discrepancies.push({
      code: "MH_COUNT_MISMATCH",
      message: `${mh.length} of ${EXPECTED_MH_RECORDS} current MH records present`,
      entityId: "MH",
    });
  }

  const openQueries = input.queries.filter((q) =>
    isQueryOpen(q.communicationState)
  );
  for (const q of openQueries) {
    discrepancies.push({
      code: "OPEN_QUERIES_REMAINING",
      message: `Query ${q.queryId} is ${q.communicationState}`,
      entityId: q.queryId,
    });
  }

  const openIssues = input.issues.filter((i) => isIssueOpen(i.status));
  for (const i of openIssues) {
    discrepancies.push({
      code: "UNRESOLVED_ISSUES",
      message: `${i.code} on ${i.subjectId} Day ${i.visitDay} is ${i.status}`,
      entityId: i.issueId,
    });
  }

  const fabPassed = input.debt.fabricatedBits < EPSILON;
  if (!fabPassed) {
    const fab = mh.find((r) => r.fabricatedBits > 0);
    discrepancies.push({
      code: "FABRICATED_DEBT_EXCEEDED",
      message: `Fabricated precision ${input.debt.fabricatedBits.toFixed(2)} bits (threshold 0.00)`,
      entityId: fab?.recordId ?? "DEBT",
    });
  }

  const lossPassed = input.debt.semanticLossCount === 0;
  if (!lossPassed) {
    const lossRecord = vs.find((r) => r.epistemicStatus === "LOSS");
    discrepancies.push({
      code: "SEMANTIC_LOSS_PRESENT",
      message: `${input.debt.semanticLossCount} semantic loss item(s) not dispositioned`,
      entityId:
        lossRecord?.recordId ?? input.unmatched[0]?.unmatchedId ?? "LOSS",
    });
  }

  const accepted = new Set(
    input.issues
      .filter((i) => i.status === "AcceptedUncertainty")
      .map((i) => i.submissionId)
  );
  const uncertain = [
    ...vs.filter((r) => r.epistemicStatus === "UNCERTAIN"),
    ...mh.filter((r) => r.epistemicStatus === "UNCERTAIN"),
  ];
  const undocumented = uncertain.filter((r) => !accepted.has(r.submissionId));
  for (const r of undocumented) {
    discrepancies.push({
      code: "UNCERTAINTY_UNDOCUMENTED",
      message: `Honest uncertainty on ${r.USUBJID} lacks a documented disposition`,
      entityId: r.recordId,
    });
  }

  const currentIds = new Set(vs.map((r) => r.recordId));
  const broken = [
    ...vs.filter((r) => r.sourceRevisionId === "").map((r) => r.recordId),
    ...input.adamRows
      .filter(
        (r) =>
          !r.stale &&
          ((r.sourceSittingRecordId !== null &&
            !currentIds.has(r.sourceSittingRecordId)) ||
            (r.sourceStandingRecordId !== null &&
              !currentIds.has(r.sourceStandingRecordId)))
      )
      .map((r) => r.rowId),
  ];
  for (const id of broken) {
    discrepancies.push({
      code: "BROKEN_TRACES",
      message: `Broken lineage on ${id}`,
      entityId: id,
    });
  }

  for (const h of input.held) {
    discrepancies.push({
      code: "HELD_PACKETS_REMAINING",
      message: `Held packet: ${h.reason}`,
      entityId: h.heldId,
    });
  }

  const evaluable = input.adamRows.filter((r) => r.AVAL !== null);
  const adamPassed = evaluable.length === EXPECTED_ADVS_ROWS;
  if (!adamPassed) {
    discrepancies.push({
      code: "ADAM_COUNT_MISMATCH",
      message: `${evaluable.length} of ${EXPECTED_ADVS_ROWS} derived ADVS rows present`,
      entityId: "ADVS",
    });
  }

  const v1Visits = new Set(
    vs
      .filter((r) => r.protocolVersion === "v1")
      .map((r) => visitKey(r.USUBJID, r.VISITNUM))
  );
  const orthost = new Set(
    input.unpaired
      .filter(
        (r) =>
          r.PARAMCD === "ORTHOST" &&
          r.AVAL === null &&
          r.AVALC === "NOT EVALUABLE"
      )
      .map((r) => visitKey(r.USUBJID, r.AVISITN))
  );
  const numericOnV1 = evaluable.filter((r) =>
    v1Visits.has(visitKey(r.USUBJID, r.AVISITN))
  );
  const missingNe = Array.from(v1Visits).filter((k) => !orthost.has(k));
  const unevaluablePassed = missingNe.length === 0 && numericOnV1.length === 0;
  for (const k of missingNe) {
    discrepancies.push({
      code: "UNEVALUABLE_MISHANDLED",
      message: `v1 visit ${k} has no NOT EVALUABLE designation`,
      entityId: k,
    });
  }
  for (const r of numericOnV1) {
    discrepancies.push({
      code: "UNEVALUABLE_MISHANDLED",
      message: `v1 visit carries a numeric derivation ${r.rowId}`,
      entityId: r.rowId,
    });
  }

  for (const t of input.traceViolations) {
    discrepancies.push({
      code: "CROSS_VISIT_COLLISIONS",
      message: t.message,
      entityId: t.sittingRecordId,
    });
  }

  const stale = [...input.adamRows, ...input.unpaired].filter((r) => r.stale);
  for (const r of stale) {
    discrepancies.push({
      code: "STALE_DERIVATIONS_EXIST",
      message: `${r.rowId} is stale: its source changed after derivation`,
      entityId: r.rowId,
    });
  }

  const result: LockAuditResult = {
    canLock: false,
    sdtmChecklist: {
      vsRecordCount: {
        expected: EXPECTED_VS_RECORDS,
        actual: vs.length,
        passed: vsPassed,
      },
      mhRecordCount: {
        expected: EXPECTED_MH_RECORDS,
        actual: mh.length,
        passed: mhPassed,
      },
      openQueries: {
        actual: openQueries.length,
        passed: openQueries.length === 0,
      },
      unresolvedIssues: {
        actual: openIssues.length,
        passed: openIssues.length === 0,
      },
      fabricatedDebtBits: {
        actual: input.debt.fabricatedBits,
        passed: fabPassed,
      },
      semanticLoss: {
        actual: input.debt.semanticLossCount,
        passed: lossPassed,
      },
      honestUncertaintyDocumented: {
        count: uncertain.length,
        passed: undocumented.length === 0,
      },
      brokenTraces: { actual: broken.length, passed: broken.length === 0 },
      heldPackets: {
        actual: input.held.length,
        passed: input.held.length === 0,
      },
    },
    adamChecklist: {
      derivedRecordsCount: {
        expected: EXPECTED_ADVS_ROWS,
        actual: evaluable.length,
        passed: adamPassed,
      },
      unevaluableHandledCorrectly: {
        count: orthost.size,
        passed: unevaluablePassed,
      },
      crossVisitCollisions: {
        actual: input.traceViolations.length,
        passed: input.traceViolations.length === 0,
      },
      staleDerivations: { actual: stale.length, passed: stale.length === 0 },
    },
    discrepancies,
  };
  const checks = [
    ...Object.values(result.sdtmChecklist),
    ...Object.values(result.adamChecklist),
  ];
  result.canLock = checks.every((c) => c.passed);
  return result;
}
