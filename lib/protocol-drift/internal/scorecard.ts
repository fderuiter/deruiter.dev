/**
 * The systems efficiency scorecard and preventative badges.
 */
import { clamp } from "@/lib/game-utils";
import {
  EFFICIENCY_METRIC_IDS,
  EFFICIENCY_PARS,
  EFFICIENCY_POINTS_AT_PAR,
  EFFICIENCY_POINTS_CAP,
  SITE_IDS,
} from "../presets";
import type {
  BadgeAward,
  EfficiencyBests,
  EfficiencyMetric,
  EfficiencyMetricId,
  Scorecard,
  ScorecardInput,
} from "../types";
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
  const { narrative, transposition } = input.beatLabels ?? {
    narrative: "Site A Day 7",
    transposition: "B01 Day 14",
  };
  return [
    {
      id: "PREVENTATIVE_ARCHITECT",
      title: "Preventative Architect",
      earned: input.regexSplitBeforeNarrative,
      reason: input.regexSplitBeforeNarrative
        ? `RegexSplit was deployed before the ${narrative} narrative entered ingestion.`
        : `The ${narrative} narrative reached a pipeline without RegexSplit.`,
    },
    {
      id: "FORENSIC_SLEUTH",
      title: "Forensic Sleuth",
      earned: input.sleuthResolvedWithEvidence,
      reason: input.sleuthResolvedWithEvidence
        ? `The ${transposition} transposition was resolved through an evidence-linked query.`
        : `The ${transposition} transposition was not resolved with source evidence.`,
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

/** Base points every lock earns before badges, goodwill and efficiency. */
export const LOCK_BASE_POINTS = 100;
/** Points each earned preventative badge adds. */
export const BADGE_POINTS = 100;

/**
 * Points one efficiency measure earns: 100 at par, plus or minus its points
 * per unit for each unit under or over par, rounded and kept within 0 to 150.
 */
export function efficiencyPoints(
  id: EfficiencyMetricId,
  actual: number
): number {
  const { par, pointsPerUnit } = EFFICIENCY_PARS[id];
  const raw = EFFICIENCY_POINTS_AT_PAR + pointsPerUnit * (par - actual);
  return Math.round(clamp(raw, 0, EFFICIENCY_POINTS_CAP));
}

/** The measures a loaded reference pipeline answers for the player (#2168). */
const DESIGN_METRICS: ReadonlySet<EfficiencyMetricId> = new Set([
  "chips",
  "wires",
]);

/**
 * Measures one run against every par, in the scorecard's order. In an
 * assisted run, one that loaded a reference pipeline, the chip and wire
 * measures are waived: no medal, no points, no best (#2168).
 */
export function evaluateEfficiency(
  actuals: Record<EfficiencyMetricId, number>,
  assisted = false
): EfficiencyMetric[] {
  return EFFICIENCY_METRIC_IDS.map((id) => {
    const { label, par } = EFFICIENCY_PARS[id];
    const actual = actuals[id];
    if (assisted && DESIGN_METRICS.has(id)) {
      return { id, label, actual, par, medal: false, points: 0, waived: true };
    }
    return {
      id,
      label,
      actual,
      par,
      medal: actual <= par,
      points: efficiencyPoints(id, actual),
    };
  });
}

/**
 * The arcade score for a locked run: 100 for the lock, 100 per earned badge,
 * the rounded mean goodwill, and the efficiency points.
 */
export function protocolDriftScore(
  earnedBadges: number,
  meanGoodwill: number,
  efficiencyScore: number
): number {
  return (
    LOCK_BASE_POINTS +
    BADGE_POINTS * earnedBadges +
    Math.round(meanGoodwill) +
    efficiencyScore
  );
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
  const trialDurationDays = trialDayOf(input.lockedAtMinute);
  const meanGoodwill = total / SITE_IDS.length;
  const badges = evaluateBadges(input);
  const efficiency = evaluateEfficiency({
    chips: input.chipCount,
    wires: input.wireCount,
    lockDay: trialDurationDays,
    rejectedCommands: input.rejectedCommands,
    fabricatedBits: input.fabricatedBits,
  }, input.assisted === true);
  const efficiencyScore = efficiency.reduce((sum, m) => sum + m.points, 0);
  return {
    trialDurationDays,
    queryRestraintRatio: ratio,
    queryRestraintLabel: queryRestraintLabel(ratio),
    queriesSent: sent.length,
    evidenceLinkedQueries: evidence,
    goodwill,
    meanGoodwill,
    badges,
    integrityPassed: input.integrityPassed,
    chipCount: input.chipCount,
    wireCount: input.wireCount,
    rejectedCommands: input.rejectedCommands,
    fabricatedBits: input.fabricatedBits,
    assisted: input.assisted === true,
    efficiency,
    efficiencyScore,
    medals: efficiency.filter((m) => m.medal).length,
    score: protocolDriftScore(
      badges.filter((b) => b.earned).length,
      meanGoodwill,
      efficiencyScore
    ),
  };
}

/**
 * Reads stored bests defensively: anything that is not JSON, not an object,
 * or not a finite non-negative number for a known measure is dropped.
 */
export function parseEfficiencyBests(raw: string | null): EfficiencyBests {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return {};
  }
  const record = data as Record<string, unknown>;
  const bests: EfficiencyBests = {};
  for (const id of EFFICIENCY_METRIC_IDS) {
    const value = record[id];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      bests[id] = value;
    }
  }
  return bests;
}

/** Serializes bests for storage. */
export function serializeEfficiencyBests(bests: EfficiencyBests): string {
  return JSON.stringify(bests);
}

/**
 * Folds a locked run into the bests. Lower is better for every measure;
 * waived measures are skipped.
 * Returns the merged bests (the same object when nothing improved) and the
 * measures this run improved, including first-time entries.
 */
export function recordEfficiencyBests(
  bests: EfficiencyBests,
  scorecard: Pick<Scorecard, "efficiency">
): { bests: EfficiencyBests; improved: EfficiencyMetricId[] } {
  const improved: EfficiencyMetricId[] = [];
  const next: EfficiencyBests = { ...bests };
  for (const metric of scorecard.efficiency) {
    // A waived measure was not the player's own design (#2168).
    if (metric.waived) continue;
    const prior = bests[metric.id];
    if (prior === undefined || metric.actual < prior) {
      next[metric.id] = metric.actual;
      improved.push(metric.id);
    }
  }
  return { bests: improved.length > 0 ? next : bests, improved };
}
