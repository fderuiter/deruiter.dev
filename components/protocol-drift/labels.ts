/**
 * Plain-language names for the engine's issue and lock-check codes, so a
 * notice or the lock gate never shows a raw code to the player (#2276).
 */
import type { IssueCode, LockDiscrepancyCode } from "@/lib/protocol-drift";

export const ISSUE_LABELS: Record<IssueCode, string> = {
  OUT_OF_RANGE: "out-of-range value",
  NARRATIVE_REPEAT: "repeated reading in a narrative",
  PARTIAL_DATE: "partial date",
  APPLICABILITY_DISCREPANCY: "form version mismatch",
  POSITION_COLLISION: "position collision",
  UNMAPPED_FIELD: "unmapped field",
  DATE_WINDOW: "date outside the visit window",
  DATE_UNPARSEABLE: "unreadable date",
  UNKNOWN_UNIT: "unknown unit",
};

export const LOCK_LABELS: Record<LockDiscrepancyCode, string> = {
  VS_COUNT_MISMATCH: "Vital-sign records missing",
  MH_COUNT_MISMATCH: "Medical-history records missing",
  OPEN_QUERIES_REMAINING: "Query still open",
  UNRESOLVED_ISSUES: "Issue unresolved",
  FABRICATED_DEBT_EXCEEDED: "Fabricated precision",
  SEMANTIC_LOSS_PRESENT: "Meaning lost in transformation",
  UNCERTAINTY_UNDOCUMENTED: "Uncertainty not documented",
  BROKEN_TRACES: "Broken lineage",
  HELD_PACKETS_REMAINING: "Packets still held",
  ADAM_COUNT_MISMATCH: "Analysis rows missing",
  UNEVALUABLE_MISHANDLED: "Not-evaluable visit mishandled",
  CROSS_VISIT_COLLISIONS: "Cross-visit collision",
  STALE_DERIVATIONS_EXIST: "Stale derivation",
};

/** "NEW_ISSUE_CATEGORY:PARTIAL_DATE" as a player reads it. */
export function pauseReasonText(reason: string): string {
  const code = reason.replace("NEW_ISSUE_CATEGORY:", "") as IssueCode;
  const label = ISSUE_LABELS[code];
  return label ? `new kind of issue, ${label}` : reason.toLowerCase();
}
