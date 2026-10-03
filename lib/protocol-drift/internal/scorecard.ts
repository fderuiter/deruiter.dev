/**
 * The systems efficiency scorecard and preventative badges.
 */
import { SITE_IDS } from "../presets";
import type { BadgeAward, Scorecard, ScorecardInput } from "../types";
import { trialDayOf } from "./clock";

/** Evidence-linked queries divided by queries sent; null when none sent. */
export function queryRestraintRatio(
  sent: number,
  evidenceLinked: number
): number | null {
  if (sent <= 0) return null;
  return evidenceLinked / sent;
}

/** The label for a restraint ratio. */
export function queryRestraintLabel(
  ratio: number | null
): Scorecard["queryRestraintLabel"] {
  if (ratio === null) return "No Queries Sent";
  if (ratio >= 1) return "Gold Standard Auditor";
  if (ratio < 0.5) return "Query Spammer";
  return "Balanced Inquirer";
}

/** Awards the three preventative badges from what happened in the run. */
export function evaluateBadges(input: ScorecardInput): BadgeAward[] {
  return [
    {
      id: "PREVENTATIVE_ARCHITECT",
      title: "Preventative Architect",
      earned: input.regexSplitBeforeNarrative,
      reason: input.regexSplitBeforeNarrative
        ? "RegexSplit was deployed before the Site A Day 7 narrative entered ingestion."
        : "The Site A Day 7 narrative reached a pipeline without RegexSplit.",
    },
    {
      id: "FORENSIC_SLEUTH",
      title: "Forensic Sleuth",
      earned: input.sleuthResolvedWithEvidence,
      reason: input.sleuthResolvedWithEvidence
        ? "The B01 Day 14 transposition was resolved through an evidence-linked query."
        : "The B01 Day 14 transposition was not resolved with source evidence.",
    },
    {
      id: "AMENDMENT_NAVIGATOR",
      title: "Amendment Navigator",
      earned: input.lateBacklogRoutedV1 && input.applicabilityErrors === 0,
      reason:
        input.lateBacklogRoutedV1 && input.applicabilityErrors === 0
          ? "Site B's late Day 24 backlog was routed by assessment date with zero applicability errors."
          : "The late backlog was misrouted or applicability errors occurred.",
    },
  ];
}

/** Builds the scorecard shown after Database Lock. */
export function buildScorecard(input: ScorecardInput): Scorecard {
  const sent = input.queries.filter((q) => q.sentAtMinute >= 0);
  const evidence = sent.filter((q) => q.isEvidenceLinked).length;
  const ratio = queryRestraintRatio(sent.length, evidence);
  const goodwill = {} as Scorecard["goodwill"];
  let total = 0;
  for (const id of SITE_IDS) {
    goodwill[id] = input.sites[id].goodwill;
    total += input.sites[id].goodwill;
  }
  return {
    trialDurationDays: trialDayOf(input.lockedAtMinute),
    queryRestraintRatio: ratio,
    queryRestraintLabel: queryRestraintLabel(ratio),
    queriesSent: sent.length,
    evidenceLinkedQueries: evidence,
    goodwill,
    meanGoodwill: total / SITE_IDS.length,
    badges: evaluateBadges(input),
    integrityPassed: input.integrityPassed,
  };
}
