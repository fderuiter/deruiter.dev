/**
 * Ratio-normalized minimization for virtual cohorts and actual profiles
 * (ticket #4002, RND-MINIM-001 to RND-MINIM-011).
 *
 * Each assignment scores every arm at the subject's own site: for every
 * factor level the subject carries, take the treatment counts at that site
 * and level, add the subject to the candidate arm, multiply each arm's count
 * by `m[a] = L / q[a]` (L is the lcm of the reduced ratios), and add up the
 * range (max minus min). The arms with the lowest score are preferred. When
 * every arm ties, one is drawn by ratio. Otherwise a biased coin with
 * probability p picks the preferred group, and an arm is drawn by ratio
 * inside the chosen group. There is no global running-balance term and no
 * block: rows carry `blockIndex`, `blockSize` and `positionInBlock` as null.
 *
 * PRNG use is fixed. The allocation stream gives one draw for a full tie and
 * two (coin, then arm) otherwise, even when a group has one arm. A virtual
 * cohort samples its site and profile from a separate cohort stream
 * (seeded from `<seed>-cohort`), so replaying the same profiles through a session gives
 * the same arms.
 */

import {
  RANDOMIZATION_RESOURCE_LIMITS,
  type AllocationRow,
  type MinimizationRandomizationRequest,
  type ParticipantProfile,
  type PrngStream,
  type ProfileAssignmentOutcome,
  type RandomizationRequest,
  type RandomizationResourceLimits,
  type ValidationFinding,
} from "../../types";
import { reduceAllocationRatios } from "../contracts";
import { validateRandomizationPlan } from "../validate-plan";
import { formatStratumHumanCode } from "../identity/stratum-identity";
import { createSubjectIdGenerator } from "../identity/subject-id";
import { createCohortStream, createRandomizationStreams } from "./seed";
import {
  enumerateStratumIntersections,
  resolveManualCapacities,
  type StratumIntersection,
} from "./caps";
import { resolveMarginalCaps } from "./marginal";
import {
  createLedger,
  mapProfileToIntersection,
  type CapacityLedger,
  type ResolvedCapacities,
} from "./capacity";

/** Biased-coin resolution: `floor(U * 10^12) < round(p * 10^12)`. */
const COIN_SCALE = 1_000_000_000_000;

/** Scale for exact percentage weights (four decimals). */
const PERCENT_SCALE = 10_000;

/** One scored minimization decision, for diagnostics and fixtures. */
export interface MinimizationDecision {
  /** Score per arm, in declared arm order. */
  readonly scores: readonly number[];
  /** Arm IDs with the lowest score. */
  readonly preferredArmIds: readonly string[];
  /** "tie" when every arm had the lowest score. */
  readonly group: "tie" | "preferred" | "nonpreferred";
  readonly armId: string;
}

/** Why a virtual cohort stopped. */
export type MinimizationStopReason =
  /** All `virtualCohortSize` rows were generated. */
  | "COHORT_COMPLETE"
  /** No site had an intersection with remaining capacity and positive probability. */
  | "CAPACITY_EXHAUSTED";

/** How a virtual cohort ran (RND-MINIM-001, -004, -008). */
export interface MinimizationScheduleSummary {
  readonly requestedRows: number;
  readonly emittedRows: number;
  readonly shortfall: number;
  readonly stopReason: MinimizationStopReason;
  /**
   * Per factor, how many draws sampled from a renormalized distribution
   * because a capped or zero-probability level had to be left out.
   */
  readonly renormalizedDraws: Readonly<Record<string, number>>;
}

/** Result of generating a minimization virtual cohort. */
export type MinimizationScheduleResult =
  | {
      readonly ok: true;
      readonly reducedRatios: readonly number[];
      readonly capacities: ResolvedCapacities;
      readonly rows: readonly AllocationRow[];
      readonly decisions: readonly MinimizationDecision[];
      readonly summary: MinimizationScheduleSummary;
    }
  | { readonly ok: false; readonly findings: readonly ValidationFinding[] };

/** A session that assigns actual participant profiles by minimization. */
export interface MinimizationAllocationSession {
  assign(profile: ParticipantProfile): ProfileAssignmentOutcome;
  /** The decision behind the latest assignment, if any. */
  lastDecision(): MinimizationDecision | null;
}

/** Result of opening a minimization session. */
export type MinimizationAllocationSessionResult =
  | { readonly ok: true; readonly session: MinimizationAllocationSession }
  | { readonly ok: false; readonly findings: readonly ValidationFinding[] };

interface PreparedMinimizationPlan {
  readonly request: MinimizationRandomizationRequest;
  readonly reducedRatios: readonly number[];
  /** `m[a] = L / q[a]`. */
  readonly multipliers: readonly number[];
  readonly intersections: readonly StratumIntersection[];
  readonly capacities: ResolvedCapacities;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function minimizationFinding(
  fieldPath: string,
  message: string
): ValidationFinding {
  return {
    code: "UNSUPPORTED_METHOD_COMBINATION",
    severity: "error",
    fieldPath,
    message,
  };
}

function prepareMinimizationPlan(
  request: RandomizationRequest,
  limits: RandomizationResourceLimits
):
  | { ok: true; plan: PreparedMinimizationPlan }
  | { ok: false; findings: readonly ValidationFinding[] } {
  const validation = validateRandomizationPlan(request, limits);
  if (!validation.ok) return { ok: false, findings: validation.findings };
  if (request.method !== "MINIMIZATION") {
    return {
      ok: false,
      findings: [
        minimizationFinding(
          "method",
          "Minimization needs a MINIMIZATION request."
        ),
      ],
    };
  }
  const reduced = reduceAllocationRatios(request.arms);
  if (!reduced.ok) return { ok: false, findings: reduced.findings };
  let lcm = 1;
  for (const q of reduced.ratios) {
    lcm = (lcm / gcd(lcm, q)) * q;
    if (!Number.isSafeInteger(lcm)) {
      return {
        ok: false,
        findings: [
          {
            code: "INVALID_ARM_RATIO",
            severity: "error",
            fieldPath: "arms",
            message: "The reduced ratios' least common multiple is too large.",
          },
        ],
      };
    }
  }

  const intersections = enumerateStratumIntersections(request.factors);
  const capacities =
    request.caps.strategy === "marginal"
      ? resolveMarginalCaps(request)
      : resolveManualCapacities(request, intersections);
  if (!capacities.ok) return { ok: false, findings: capacities.findings };

  if (request.minimizationSettings.virtualCohortSize > limits.maxRows) {
    return {
      ok: false,
      findings: [
        {
          code: "RESOURCE_LIMIT_EXCEEDED",
          severity: "error",
          fieldPath: "minimizationSettings.virtualCohortSize",
          message: `virtualCohortSize exceeds the row limit of ${limits.maxRows}.`,
          estimatedValue: String(
            request.minimizationSettings.virtualCohortSize
          ),
          limitValue: String(limits.maxRows),
        },
      ],
    };
  }

  return {
    ok: true,
    plan: {
      request,
      reducedRatios: reduced.ratios,
      multipliers: reduced.ratios.map((q) => lcm / q),
      intersections,
      capacities,
    },
  };
}

function lastPositive(weights: readonly number[]): number {
  for (let i = weights.length - 1; i >= 0; i -= 1) {
    if (weights[i] > 0) return i;
  }
  return 0;
}

/** Draws an index by integer weights in declared order: `floor(U * total)`. */
function drawByWeight(weights: readonly number[], stream: PrngStream): number {
  const total = weights.reduce((a, b) => a + b, 0);
  const target = Math.floor(stream.nextFloat() * total);
  let cumulative = 0;
  for (let i = 0; i < weights.length; i += 1) {
    cumulative += weights[i];
    if (target < cumulative) return i;
  }
  // Unreachable while total > 0 and U < 1.
  return lastPositive(weights);
}

/** Treatment counts per (site, factor, level, arm). */
class MarginalCounts {
  private readonly counts = new Map<string, number[]>();

  constructor(private readonly armCount: number) {}

  private key(siteId: string, factorId: string, levelId: string): string {
    return JSON.stringify([siteId, factorId, levelId]);
  }

  get(siteId: string, factorId: string, levelId: string): readonly number[] {
    return (
      this.counts.get(this.key(siteId, factorId, levelId)) ??
      new Array<number>(this.armCount).fill(0)
    );
  }

  add(siteId: string, intersection: StratumIntersection, arm: number): void {
    for (const [factorId, levelId] of Object.entries(intersection.levels)) {
      const key = this.key(siteId, factorId, levelId);
      const row =
        this.counts.get(key) ?? new Array<number>(this.armCount).fill(0);
      row[arm] += 1;
      this.counts.set(key, row);
    }
  }
}

/**
 * Scores every candidate arm for a subject at a site (RND-MINIM-005, -006).
 * Factors are taken from the request in declared order.
 */
function scoreCandidates(
  plan: PreparedMinimizationPlan,
  counts: MarginalCounts,
  siteId: string,
  intersection: StratumIntersection
): number[] {
  const armCount = plan.reducedRatios.length;
  const scores = new Array<number>(armCount).fill(0);
  for (const factor of plan.request.factors) {
    const current = counts.get(
      siteId,
      factor.id,
      intersection.levels[factor.id]
    );
    for (let k = 0; k < armCount; k += 1) {
      let max = Number.NEGATIVE_INFINITY;
      let min = Number.POSITIVE_INFINITY;
      for (let a = 0; a < armCount; a += 1) {
        const value = (current[a] + (a === k ? 1 : 0)) * plan.multipliers[a];
        if (value > max) max = value;
        if (value < min) min = value;
      }
      scores[k] += max - min;
    }
  }
  return scores;
}

/** Picks an arm (RND-MINIM-007) and returns the decision. */
function decide(
  plan: PreparedMinimizationPlan,
  scores: readonly number[],
  stream: PrngStream
): MinimizationDecision & { readonly armIndex: number } {
  const arms = plan.request.arms;
  const best = Math.min(...scores);
  const preferred = scores.map((s) => s === best);
  const preferredArmIds = arms.filter((_, i) => preferred[i]).map((a) => a.id);
  if (preferred.every(Boolean)) {
    const armIndex = drawByWeight(plan.reducedRatios, stream);
    return {
      scores,
      preferredArmIds,
      group: "tie",
      armId: arms[armIndex].id,
      armIndex,
    };
  }
  const p = plan.request.minimizationSettings.biasedCoinProbability;
  const choosePreferred =
    Math.floor(stream.nextFloat() * COIN_SCALE) < Math.round(p * COIN_SCALE);
  const weights = plan.reducedRatios.map((q, i) =>
    preferred[i] === choosePreferred ? q : 0
  );
  const armIndex = drawByWeight(weights, stream);
  return {
    scores,
    preferredArmIds,
    group: choosePreferred ? "preferred" : "nonpreferred",
    armId: arms[armIndex].id,
    armIndex,
  };
}

/** Integer level weights per factor from the expected distributions. */
function levelWeights(
  request: MinimizationRandomizationRequest
): ReadonlyMap<string, ReadonlyMap<string, number>> {
  const out = new Map<string, Map<string, number>>();
  const distributions =
    request.minimizationSettings.expectedLevelDistributions ?? {};
  for (const factor of request.factors) {
    const declared = distributions[factor.id];
    out.set(
      factor.id,
      new Map(
        factor.levels.map((level) => [
          level.id,
          declared
            ? Math.round((declared[level.id] ?? 0) * PERCENT_SCALE)
            : PERCENT_SCALE,
        ])
      )
    );
  }
  return out;
}

/**
 * Generates a virtual cohort of up to `virtualCohortSize` rows (RND-MINIM-001,
 * -004, -008). For each row a site is drawn by recruitment weight among sites
 * that still have room (a zero-weight site is never drawn), then each factor
 * level is drawn in factor order by its expected percentage, among levels
 * that still lead to an intersection with remaining capacity at that site.
 * The cohort stops early, and says so, when no site has room.
 */
export function generateMinimizationSchedule(
  request: RandomizationRequest,
  limits: RandomizationResourceLimits = RANDOMIZATION_RESOURCE_LIMITS
): MinimizationScheduleResult {
  const prepared = prepareMinimizationPlan(request, limits);
  if (!prepared.ok) return prepared;
  const { plan } = prepared;
  const req = plan.request;
  const streams = createRandomizationStreams(req.seed.value);
  const cohort = createCohortStream(req.seed.value);
  const ledger = createLedger(plan.capacities);
  const counts = new MarginalCounts(req.arms.length);
  const ids = createSubjectIdGenerator(
    req.subjectIdMask.pattern,
    streams.identifier
  );
  const weights = levelWeights(req);
  const renormalized: Record<string, number> = Object.fromEntries(
    req.factors.map((f) => [f.id, 0])
  );
  const positive = (intersection: StratumIntersection) =>
    req.factors.every(
      (f) => (weights.get(f.id)!.get(intersection.levels[f.id]) ?? 0) > 0
    );
  const reachable = plan.intersections.filter(positive);

  const rows: AllocationRow[] = [];
  const decisions: MinimizationDecision[] = [];
  const target = req.minimizationSettings.virtualCohortSize;
  while (rows.length < target) {
    const open = (siteId: string) =>
      reachable.filter((i) => ledger.left(siteId, i) > 0);
    const siteWeights = req.sites.map((s) =>
      s.recruitmentWeight > 0 && open(s.id).length > 0 ? s.recruitmentWeight : 0
    );
    if (siteWeights.every((w) => w === 0)) break;
    const site = req.sites[drawSiteByWeight(siteWeights, cohort)];

    let pool = open(site.id);
    for (const factor of req.factors) {
      const factorWeights = weights.get(factor.id)!;
      const candidates = factor.levels.filter((level) =>
        pool.some((i) => i.levels[factor.id] === level.id)
      );
      const declaredPositive = factor.levels.filter(
        (level) => (factorWeights.get(level.id) ?? 0) > 0
      );
      if (candidates.length < declaredPositive.length) {
        renormalized[factor.id] += 1;
      }
      const picked =
        candidates[
          drawByWeight(
            candidates.map((level) => factorWeights.get(level.id) ?? 0),
            cohort
          )
        ];
      pool = pool.filter((i) => i.levels[factor.id] === picked.id);
    }
    const intersection = pool[0];

    const decision = decide(
      plan,
      scoreCandidates(plan, counts, site.id, intersection),
      streams.allocation
    );
    counts.add(site.id, intersection, decision.armIndex);
    ledger.take(site.id, intersection, 1);
    const arm = req.arms[decision.armIndex];
    rows.push(
      Object.freeze({
        sequence: rows.length + 1,
        subjectId: ids.nextId({
          siteCode: site.code,
          stratumLabel: formatStratumHumanCode(intersection.labels),
        }),
        siteId: site.id,
        stratumKey: intersection.stratumKey,
        stratumLevels: intersection.levels,
        armId: arm.id,
        armCode: arm.code,
        blockIndex: null,
        blockSize: null,
        positionInBlock: null,
      })
    );
    decisions.push(
      Object.freeze({
        scores: Object.freeze([...decision.scores]),
        preferredArmIds: Object.freeze(decision.preferredArmIds),
        group: decision.group,
        armId: decision.armId,
      })
    );
  }

  return {
    ok: true,
    reducedRatios: plan.reducedRatios,
    capacities: plan.capacities,
    rows: Object.freeze(rows),
    decisions: Object.freeze(decisions),
    summary: Object.freeze({
      requestedRows: target,
      emittedRows: rows.length,
      shortfall: target - rows.length,
      stopReason:
        rows.length >= target ? "COHORT_COMPLETE" : "CAPACITY_EXHAUSTED",
      renormalizedDraws: Object.freeze(renormalized),
    }),
  };
}

/**
 * Draws a site by non-negative recruitment weight. The draw is
 * `U * total` against cumulative weights with a strict `<`, so a zero-weight
 * site is never chosen, including when U is 0.
 */
function drawSiteByWeight(
  weights: readonly number[],
  stream: PrngStream
): number {
  const total = weights.reduce((a, b) => a + b, 0);
  const target = stream.nextFloat() * total;
  let cumulative = 0;
  for (let i = 0; i < weights.length; i += 1) {
    if (weights[i] <= 0) continue;
    cumulative += weights[i];
    if (target < cumulative) return i;
  }
  return lastPositive(weights);
}

/**
 * Opens a minimization session for actual eligible profiles. Each profile is
 * scored at its own site with its own levels; nothing is sampled, and the
 * profile's site and levels are never replaced. A full capacity is reported
 * as `cap-exhausted` and changes no counts.
 */
export function createMinimizationSession(
  request: RandomizationRequest,
  limits: RandomizationResourceLimits = RANDOMIZATION_RESOURCE_LIMITS
): MinimizationAllocationSessionResult {
  const prepared = prepareMinimizationPlan(request, limits);
  if (!prepared.ok) return prepared;
  const { plan } = prepared;
  const streams = createRandomizationStreams(plan.request.seed.value);
  const ledger: CapacityLedger = createLedger(plan.capacities);
  const counts = new MarginalCounts(plan.request.arms.length);
  const byKey = new Map(plan.intersections.map((i) => [i.stratumKey, i]));
  let allocations = 0;
  let last: MinimizationDecision | null = null;

  function assign(profile: ParticipantProfile): ProfileAssignmentOutcome {
    const mapped = mapProfileToIntersection(plan.request, byKey, profile);
    if (!mapped.ok) return mapped.outcome;
    const { intersection } = mapped;
    if (ledger.left(profile.siteId, intersection) <= 0) {
      return {
        status: "cap-exhausted",
        subjectId: profile.subjectId,
        siteId: profile.siteId,
        stratumKey: intersection.stratumKey,
        reason:
          plan.capacities.strategy === "marginal"
            ? "MARGINAL_CAPACITY_EXHAUSTED"
            : "CAPACITY_EXHAUSTED",
      };
    }
    const decision = decide(
      plan,
      scoreCandidates(plan, counts, profile.siteId, intersection),
      streams.allocation
    );
    counts.add(profile.siteId, intersection, decision.armIndex);
    ledger.take(profile.siteId, intersection, 1);
    allocations += 1;
    last = Object.freeze({
      scores: Object.freeze([...decision.scores]),
      preferredArmIds: Object.freeze(decision.preferredArmIds),
      group: decision.group,
      armId: decision.armId,
    });
    const arm = plan.request.arms[decision.armIndex];
    return {
      status: "assigned",
      allocationId: `alloc-${allocations}`,
      slotIndex: allocations,
      subjectId: profile.subjectId,
      siteId: profile.siteId,
      stratumKey: intersection.stratumKey,
      armId: arm.id,
      armCode: arm.code,
    };
  }

  return {
    ok: true,
    session: Object.freeze({ assign, lastDecision: () => last }),
  };
}
