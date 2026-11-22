/**
 * Stratum intersections and enrollment capacities for permuted-block
 * schedules (ticket #4000, RND-CAPS-001 to RND-CAPS-011).
 *
 * Capacities are resolved here, once, for the engine, the UI preview and
 * the exported scripts. Manual matrices must name every intersection; a
 * proportional matrix is computed from the total target and per-level
 * percentages with integer largest-remainder rounding, so no float rounding
 * decides who gets the last seat.
 */

import type {
  BlockRandomizationRequest,
  RandomizationRequest,
  ManualIntersectionCap,
  StratificationFactorSpec,
  StructuralStratumKey,
  ValidationFinding,
} from "../../types";
import { serializeStructuralStratumKey } from "../identity/stratum-identity";

/** One stratum intersection in canonical Cartesian order. */
export interface StratumIntersection {
  /** Serialized structural key; owns counters and caps. */
  readonly stratumKey: string;
  readonly entries: StructuralStratumKey;
  /** factorId to levelId, as written on allocation rows. */
  readonly levels: Readonly<Record<string, string>>;
  /** Level labels in factor order, for display and `{STRATUM}` only. */
  readonly labels: readonly string[];
}

/**
 * Expands factors into intersections. The first factor varies slowest and
 * levels keep their declared order; an unstratified design has one empty
 * intersection. Callers must run resource preflight first.
 */
export function enumerateStratumIntersections(
  factors: readonly StratificationFactorSpec[]
): readonly StratumIntersection[] {
  let partial: {
    entries: { factorId: string; levelId: string }[];
    labels: string[];
  }[] = [{ entries: [], labels: [] }];
  for (const factor of factors) {
    const next: typeof partial = [];
    for (const prefix of partial) {
      for (const level of factor.levels) {
        next.push({
          entries: [
            ...prefix.entries,
            { factorId: factor.id, levelId: level.id },
          ],
          labels: [...prefix.labels, level.label],
        });
      }
    }
    partial = next;
  }
  return Object.freeze(
    partial.map((item) =>
      Object.freeze({
        stratumKey: serializeStructuralStratumKey(item.entries),
        entries: Object.freeze(item.entries.map((e) => Object.freeze(e))),
        levels: Object.freeze(
          Object.fromEntries(item.entries.map((e) => [e.factorId, e.levelId]))
        ),
        labels: Object.freeze(item.labels),
      })
    )
  );
}

/** Resolved capacity for one intersection, optionally for one site. */
export interface ResolvedIntersectionCap {
  readonly stratumKey: string;
  /** Present only for per-site caps. */
  readonly siteId?: string;
  readonly cap: number;
}

/** Result of resolving a request's capacities. */
export type CapResolutionResult =
  | {
      readonly ok: true;
      readonly strategy: "manual" | "proportional";
      readonly capScope: "study-wide" | "per-site";
      readonly caps: readonly ResolvedIntersectionCap[];
      /**
       * Fingerprint of the inputs a proportional matrix was computed from.
       * A saved matrix is current only while this still matches.
       */
      readonly sourceFingerprint: string;
    }
  | { readonly ok: false; readonly findings: readonly ValidationFinding[] };

const PERCENT_SCALE = BigInt(10_000); // four decimal places of a percentage
const PERCENT_TOTAL = BigInt(100) * PERCENT_SCALE;

function capFinding(fieldPath: string, message: string): ValidationFinding {
  return {
    code: "INVALID_CAP_STRATEGY",
    severity: "error",
    fieldPath,
    message,
  };
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Converts a percentage with at most four decimals to an exact integer. */
function percentToScaled(value: unknown): bigint | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  const scaled = Math.round(value * Number(PERCENT_SCALE));
  if (Math.abs(scaled - value * Number(PERCENT_SCALE)) > 1e-6) {
    return null;
  }
  return BigInt(scaled);
}

function resolveManualCaps(
  request: RandomizationRequest,
  intersections: readonly StratumIntersection[]
): CapResolutionResult {
  const caps = request.caps;
  if (caps.strategy !== "manual") {
    throw new Error("resolveManualCaps requires a manual cap config");
  }
  const findings: ValidationFinding[] = [];
  const knownKeys = new Set(intersections.map((i) => i.stratumKey));
  const knownSites = new Set(request.sites.map((s) => s.id));
  const general = new Map<string, number>();
  const bySite = new Map<string, number>();

  caps.intersectionCaps.forEach((entry: ManualIntersectionCap, index) => {
    const path = `caps.intersectionCaps[${index}]`;
    if (!knownKeys.has(entry.stratumKey)) {
      findings.push(
        capFinding(
          `${path}.stratumKey`,
          "Cap names an unknown stratum intersection."
        )
      );
      return;
    }
    if (!isNonNegativeSafeInteger(entry.cap)) {
      findings.push(
        capFinding(`${path}.cap`, "Cap must be a non-negative safe integer.")
      );
      return;
    }
    if (entry.siteId !== undefined) {
      if (caps.capScope === "study-wide") {
        findings.push({
          code: "INVALID_CAP_SCOPE",
          severity: "error",
          fieldPath: `${path}.siteId`,
          message: "A study-wide cap cannot name a site.",
        });
        return;
      }
      if (!knownSites.has(entry.siteId)) {
        findings.push(
          capFinding(`${path}.siteId`, "Cap names an unknown site.")
        );
        return;
      }
      const key = `${entry.siteId}\u0000${entry.stratumKey}`;
      if (bySite.has(key)) {
        findings.push(
          capFinding(path, "Duplicate cap for the same site and intersection.")
        );
        return;
      }
      bySite.set(key, entry.cap);
      return;
    }
    if (general.has(entry.stratumKey)) {
      findings.push(
        capFinding(path, "Duplicate cap for the same intersection.")
      );
      return;
    }
    general.set(entry.stratumKey, entry.cap);
  });

  const resolved: ResolvedIntersectionCap[] = [];
  if (caps.capScope === "study-wide") {
    intersections.forEach((intersection, index) => {
      const cap = general.get(intersection.stratumKey);
      if (cap === undefined) {
        findings.push(
          capFinding(
            `caps.intersectionCaps`,
            `Intersection ${index + 1} has no cap. Every intersection needs one; enter 0 to block it.`
          )
        );
        return;
      }
      resolved.push({ stratumKey: intersection.stratumKey, cap });
    });
  } else {
    for (const site of request.sites) {
      intersections.forEach((intersection, index) => {
        const cap =
          bySite.get(`${site.id}\u0000${intersection.stratumKey}`) ??
          general.get(intersection.stratumKey);
        if (cap === undefined) {
          findings.push(
            capFinding(
              `caps.intersectionCaps`,
              `Intersection ${index + 1} has no cap for one site. Every site and intersection needs one; enter 0 to block it.`
            )
          );
          return;
        }
        resolved.push({
          stratumKey: intersection.stratumKey,
          siteId: site.id,
          cap,
        });
      });
    }
  }

  if (findings.length > 0) return { ok: false, findings };
  return {
    ok: true,
    strategy: "manual",
    capScope: caps.capScope,
    caps: Object.freeze(resolved.map((c) => Object.freeze(c))),
    sourceFingerprint: JSON.stringify(["manual", caps.capScope]),
  };
}

/**
 * Computes integer intersection targets from a total and per-level
 * percentages (RND-CAPS-003 to RND-CAPS-005). The joint share of an
 * intersection is the product of its level percentages, which assumes the
 * factors are independent. Each target is floored, then the remaining
 * seats go to the largest remainders, ties broken by Cartesian order.
 */
export function allocateLargestRemainder(
  total: number,
  intersections: readonly StratumIntersection[],
  percentages: Readonly<Record<string, Readonly<Record<string, number>>>>,
  factors: readonly StratificationFactorSpec[]
):
  | { ok: true; counts: readonly number[] }
  | { ok: false; findings: readonly ValidationFinding[] } {
  const findings: ValidationFinding[] = [];
  if (!isNonNegativeSafeInteger(total)) {
    findings.push(
      capFinding(
        "caps.totalEnrollment",
        "Total enrollment must be a non-negative safe integer."
      )
    );
  }

  const scaled = new Map<string, bigint>();
  factors.forEach((factor, factorIndex) => {
    const byLevel = percentages[factor.id];
    if (
      byLevel === undefined ||
      byLevel === null ||
      typeof byLevel !== "object"
    ) {
      findings.push(
        capFinding(
          `caps.factorLevelPercentages`,
          `Factor ${factorIndex + 1} has no percentages.`
        )
      );
      return;
    }
    const knownLevels = new Set(factor.levels.map((l) => l.id));
    for (const levelId of Object.keys(byLevel)) {
      if (!knownLevels.has(levelId)) {
        findings.push(
          capFinding(
            `caps.factorLevelPercentages`,
            `Factor ${factorIndex + 1} has a percentage for an unknown level.`
          )
        );
      }
    }
    let sum = BigInt(0);
    factor.levels.forEach((level, levelIndex) => {
      const value = percentToScaled(byLevel[level.id]);
      if (value === null) {
        findings.push(
          capFinding(
            `caps.factorLevelPercentages`,
            `Factor ${factorIndex + 1}, level ${levelIndex + 1} needs a percentage from 0 to 100 with at most four decimals.`
          )
        );
        return;
      }
      scaled.set(`${factor.id}\u0000${level.id}`, value);
      sum += value;
    });
    if (sum !== PERCENT_TOTAL) {
      findings.push(
        capFinding(
          `caps.factorLevelPercentages`,
          `Factor ${factorIndex + 1} percentages must add up to exactly 100.`
        )
      );
    }
  });
  if (findings.length > 0) return { ok: false, findings };

  let denominator = BigInt(1);
  for (let i = 0; i < factors.length; i += 1) denominator *= PERCENT_TOTAL;
  const n = BigInt(total);
  const floors: bigint[] = [];
  const remainders: bigint[] = [];
  for (const intersection of intersections) {
    let numerator = n;
    for (const entry of intersection.entries) {
      numerator *= scaled.get(`${entry.factorId}\u0000${entry.levelId}`)!;
    }
    floors.push(numerator / denominator);
    remainders.push(numerator % denominator);
  }
  let leftover = n - floors.reduce((a, b) => a + b, BigInt(0));
  const order = intersections
    .map((_, index) => index)
    .sort((a, b) =>
      remainders[b] > remainders[a]
        ? 1
        : remainders[b] < remainders[a]
          ? -1
          : a - b
    );
  for (const index of order) {
    if (leftover <= BigInt(0)) break;
    floors[index] += BigInt(1);
    leftover -= BigInt(1);
  }
  return { ok: true, counts: Object.freeze(floors.map((v) => Number(v))) };
}

function resolveProportionalCaps(
  request: BlockRandomizationRequest,
  intersections: readonly StratumIntersection[]
): CapResolutionResult {
  const caps = request.caps;
  if (caps.strategy !== "proportional") {
    throw new Error(
      "resolveProportionalCaps requires a proportional cap config"
    );
  }
  const allocation = allocateLargestRemainder(
    caps.totalEnrollment,
    intersections,
    caps.factorLevelPercentages,
    request.factors
  );
  if (!allocation.ok) return allocation;

  const resolved: ResolvedIntersectionCap[] = [];
  if (caps.capScope === "study-wide") {
    intersections.forEach((intersection, index) => {
      resolved.push({
        stratumKey: intersection.stratumKey,
        cap: allocation.counts[index],
      });
    });
  } else {
    for (const site of request.sites) {
      intersections.forEach((intersection, index) => {
        resolved.push({
          stratumKey: intersection.stratumKey,
          siteId: site.id,
          cap: allocation.counts[index],
        });
      });
    }
  }
  return {
    ok: true,
    strategy: "proportional",
    capScope: caps.capScope,
    caps: Object.freeze(resolved.map((c) => Object.freeze(c))),
    sourceFingerprint: proportionalFingerprint(request),
  };
}

function proportionalFingerprint(request: BlockRandomizationRequest): string {
  const caps = request.caps;
  if (caps.strategy !== "proportional") return "";
  return JSON.stringify([
    "proportional",
    caps.capScope,
    caps.totalEnrollment,
    request.sites.map((s) => s.id),
    request.factors.map((f) => [
      f.id,
      f.levels.map((l) => [
        l.id,
        caps.factorLevelPercentages[f.id]?.[l.id] ?? null,
      ]),
    ]),
  ]);
}

/**
 * Resolves manual or proportional capacities for a BLOCK request. Marginal
 * caps have no intersection matrix; resolve them with `resolveMarginalCaps`
 * (#4001).
 */
export function resolveBlockCapacities(
  request: BlockRandomizationRequest,
  intersections: readonly StratumIntersection[] = enumerateStratumIntersections(
    request.factors
  )
): CapResolutionResult {
  switch (request.caps.strategy) {
    case "manual":
      return resolveManualCaps(request, intersections);
    case "proportional":
      return resolveProportionalCaps(request, intersections);
    default:
      return {
        ok: false,
        findings: [
          {
            code: "INVALID_CAP_STRATEGY",
            severity: "error",
            fieldPath: "caps.strategy",
            message:
              "Marginal caps have no intersection matrix; resolve them with resolveMarginalCaps.",
          },
        ],
      };
  }
}

/**
 * Resolves a manual intersection matrix for a MINIMIZATION request (#4002).
 * Proportional caps are refused for minimization by plan validation.
 */
export function resolveManualCapacities(
  request: RandomizationRequest,
  intersections: readonly StratumIntersection[] = enumerateStratumIntersections(
    request.factors
  )
): CapResolutionResult {
  if (request.caps.strategy !== "manual") {
    return {
      ok: false,
      findings: [capFinding("caps.strategy", "Expected a manual cap matrix.")],
    };
  }
  return resolveManualCaps(request, intersections);
}

/**
 * Whether a saved proportional matrix still matches its source inputs
 * (RND-CAPS-010, RND-CAPS-011). Changing the total, a percentage, a factor,
 * a level or a site makes it stale, and a stale matrix cannot run.
 */
export function isProportionalMatrixCurrent(
  request: BlockRandomizationRequest,
  savedFingerprint: string
): boolean {
  return (
    request.caps.strategy === "proportional" &&
    proportionalFingerprint(request) === savedFingerprint
  );
}
