import { CsrStageSchema, type CsrStage } from "../types";

/**
 * CSR package reconciliation (T&E-11, #922). Pure: the Card Table gathers
 * each selected output's evidence, and this module decides, slot by slot,
 * whether the package can lock. It reads no state of its own.
 */

/** The CSR Straight's slots, left to right: `CsrStageSchema` in order. */
export const CSR_ORDER: readonly CsrStage[] = CsrStageSchema.options;

/** Each slot's label, as the sequence slots print it. */
export const CSR_STAGE_LABELS: Readonly<Record<CsrStage, string>> =
  Object.freeze({
    DISPOSITION: "Disposition",
    BASELINE: "Baseline",
    EFFICACY: "Efficacy",
    SAFETY_AE: "Safety AE",
    PATIENT_LISTING: "Listing",
  });

/** How one slot of the package stands, in the order the checks run. */
export type SlotStatus =
  | "OK"
  | "MISSING"
  | "NO_STAGE"
  | "OUT_OF_ORDER"
  | "STALE"
  | "UNVALIDATED"
  | "RULEBOOK"
  | "OPEN_FINDING";

/** One open finding on an output, as the reconciliation reports it. */
export interface PackageFinding {
  /** The validator's category; PRECISION marks a rulebook mismatch. */
  category: string;
  evidence: string;
}

/**
 * What the Card Table knows about one output in the package. `validation`
 * is null for an output with nothing to review (a face-only Table, a
 * Listing), or why it is not validated yet.
 */
export interface PackageEvidence {
  cardId: string;
  /** The output's short name, e.g. "Table 14.3.1". */
  name: string;
  csrStage?: CsrStage;
  stale: boolean;
  validation: string | null;
  /** Findings still open once every cell has been reviewed. */
  openFindings: PackageFinding[];
}

/** One slot of the CSR Straight and the output filling it. */
export interface PackageSlot {
  stage: CsrStage;
  label: string;
  cardId: string | null;
  status: SlotStatus;
  /** Why the slot breaks the Straight, pinpointing the evidence; null when OK. */
  reason: string | null;
}

/** The package, slot by slot, and the first slot that breaks it. */
export interface PackageReport {
  slots: PackageSlot[];
  /** The first broken slot, left to right, or null when it reconciles. */
  firstBreak: PackageSlot | null;
  reconciled: boolean;
}

const article = (label: string) => (/^[AEIOU]/.test(label) ? "an" : "a");

function slotFor(
  stage: CsrStage,
  evidence: PackageEvidence | undefined
): PackageSlot {
  const label = CSR_STAGE_LABELS[stage];
  const slot = (
    status: SlotStatus,
    reason: string | null = null
  ): PackageSlot => ({
    stage,
    label,
    cardId: evidence?.cardId ?? null,
    status,
    reason: reason && `${label} slot: ${reason}`,
  });
  if (!evidence) return slot("MISSING", "no output fills it.");
  const { name } = evidence;
  if (!evidence.csrStage) {
    return slot("NO_STAGE", `${name} is not a CSR output.`);
  }
  if (evidence.csrStage !== stage) {
    const held = CSR_STAGE_LABELS[evidence.csrStage];
    return slot(
      "OUT_OF_ORDER",
      `${name} is ${article(held)} ${held} output, out of order.`
    );
  }
  if (evidence.stale) {
    return slot(
      "STALE",
      `${name} was compiled against an obsolete population snapshot.`
    );
  }
  if (evidence.validation) {
    return slot(
      "UNVALIDATED",
      `${name} is unvalidated: ${evidence.validation}`
    );
  }
  const mismatch = evidence.openFindings.find(
    (f) => f.category === "PRECISION"
  );
  if (mismatch) {
    return slot(
      "RULEBOOK",
      `${name} does not follow the active SAP: ${mismatch.evidence}`
    );
  }
  const [open] = evidence.openFindings;
  if (open) {
    const n = evidence.openFindings.length;
    return slot(
      "OPEN_FINDING",
      `${name} has ${n} open finding${n === 1 ? "" : "s"}: ${open.evidence}`
    );
  }
  return slot("OK");
}

/**
 * Reconciles a CSR package: the outputs in slot order, left to right. Each
 * slot takes the output at its position and checks, in order, that one is
 * there, that it carries the slot's CSR stage, that it is current, that it
 * is validated, that it follows the active SAP and that no finding is open.
 * The first broken slot names its evidence. Pure.
 */
export function reconcilePackage(
  outputs: readonly PackageEvidence[]
): PackageReport {
  const slots = CSR_ORDER.map((stage, i) => slotFor(stage, outputs[i]));
  const firstBreak = slots.find((s) => s.status !== "OK") ?? null;
  return { slots, firstBreak, reconciled: firstBreak === null };
}

/** A milestone Boss the run resolved: how the campaign score is weighted. */
export type MilestoneKind = "DMC_DEFENSE" | "FDA_IR";

/**
 * What each resolved milestone adds to the final campaign score, in percent.
 * A defended DMC and an answered FDA Information Request each show the
 * program survived an independent review before the CSR.
 */
export const MILESTONE_WEIGHTS: Readonly<Record<MilestoneKind, number>> =
  Object.freeze({ DMC_DEFENSE: 25, FDA_IR: 25 });

/** One cleared Blind in the campaign, carried from Blind to Blind. */
export interface CampaignRecord {
  scenarioId: string;
  /** The Blind's name, e.g. "Small Blind: Blinded Data Review". */
  blindName: string;
  score: number;
  /** The milestone this Blind resolved, if it was one. */
  milestone: MilestoneKind | null;
  /** Hours to spare on an answered FDA Information Request, else null. */
  hoursToSpare: number | null;
}

/** The final campaign score and how it was weighted. */
export interface CampaignScore {
  /** Every Blind's score, the locking Blind's included. */
  total: number;
  /** The milestone weighting, in percent. */
  bonusPercent: number;
  /** `total` with the weighting, rounded down. */
  score: number;
}

/**
 * The final campaign score: every cleared Blind's score, weighted up by the
 * milestones the run resolved on the way (#922). Pure.
 */
export function campaignScore(
  records: readonly CampaignRecord[]
): CampaignScore {
  const total = records.reduce((sum, r) => sum + r.score, 0);
  const bonusPercent = records.reduce(
    (sum, r) => sum + (r.milestone ? MILESTONE_WEIGHTS[r.milestone] : 0),
    0
  );
  return {
    total,
    bonusPercent,
    score: Math.floor((total * (100 + bonusPercent)) / 100),
  };
}
