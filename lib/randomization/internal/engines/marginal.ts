/**
 * Marginal (factor-level) enrollment caps for permuted-block designs
 * (ticket #4001, RND-CAPS-007 to RND-CAPS-009).
 *
 * A marginal cap limits how many subjects carry one level of one factor,
 * whatever their other levels. Caps are resolved once here; the block engine
 * asks the ledger whether an intersection still fits every capped level.
 */

import type {
  MarginalSitePolicy,
  RandomizationRequest,
  ValidationFinding,
} from "../../types";

/** Site policies a planned marginal schedule can name. */
export const MARGINAL_SITE_POLICIES: readonly MarginalSitePolicy[] =
  Object.freeze(["round-robin-v1", "site-major-v1"]);

/** One resolved level cap. `siteId` is present only for per-site caps. */
export interface ResolvedLevelCap {
  readonly factorId: string;
  readonly levelId: string;
  readonly siteId?: string;
  readonly cap: number;
}

/** Successful marginal resolution. */
export interface MarginalCapResolution {
  readonly ok: true;
  readonly strategy: "marginal";
  readonly capScope: "study-wide" | "per-site";
  /** Present for BLOCK requests; minimization has no site ordering policy. */
  readonly sitePolicy?: MarginalSitePolicy;
  /** Every finite level cap, expanded per site when the scope is per-site. */
  readonly levelCaps: readonly ResolvedLevelCap[];
  /** Hard total per scope, when one was set. */
  readonly totalEnrollment?: number;
  /**
   * Most rows the schedule can emit: per scope, the smallest of the hard
   * total and each fully capped factor's level-cap sum, then summed.
   */
  readonly terminationBound: number;
  /** Factors with a finite cap on every level, in every scope. */
  readonly boundingFactorIds: readonly string[];
}

/** Structural part of an intersection the ledger needs. */
interface IntersectionLevels {
  readonly levels: Readonly<Record<string, string>>;
}

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

/**
 * Resolves marginal caps for a BLOCK or MINIMIZATION request. Every entry must name a known
 * factor level, carry a non-negative integer cap and be unique for its
 * (factor, level, site). A per-site entry overrides the general entry for
 * that site. The design must be bounded: in every scope at least one factor
 * needs a finite cap on every level, or a hard total must be set
 * (RND-CAPS-008).
 */
export function resolveMarginalCaps(
  request: RandomizationRequest
):
  | MarginalCapResolution
  | { readonly ok: false; readonly findings: readonly ValidationFinding[] } {
  const caps = request.caps;
  if (caps.strategy !== "marginal") {
    return {
      ok: false,
      findings: [capFinding("caps.strategy", "Expected marginal caps.")],
    };
  }
  const findings: ValidationFinding[] = [];
  const perSite = caps.capScope === "per-site";
  const knownSites = new Set(request.sites.map((s) => s.id));
  const factorLevels = new Map(
    request.factors.map((f) => [f.id, new Set(f.levels.map((l) => l.id))])
  );

  if (
    request.method === "BLOCK" &&
    (typeof caps.sitePolicy !== "string" ||
      !MARGINAL_SITE_POLICIES.includes(caps.sitePolicy))
  ) {
    findings.push(
      capFinding(
        "caps.sitePolicy",
        'Marginal block schedules need caps.sitePolicy "round-robin-v1" or "site-major-v1".'
      )
    );
  }
  if (
    caps.totalEnrollment !== undefined &&
    !isNonNegativeSafeInteger(caps.totalEnrollment)
  ) {
    findings.push(
      capFinding(
        "caps.totalEnrollment",
        "The hard total must be a non-negative whole number."
      )
    );
  }

  const general = new Map<string, number>();
  const bySite = new Map<string, number>();
  const seen = new Set<string>();
  (Array.isArray(caps.levelCaps) ? caps.levelCaps : []).forEach(
    (entry, index) => {
      const path = `caps.levelCaps[${index}]`;
      const levels = factorLevels.get(entry.factorId);
      if (!levels || !levels.has(entry.levelId)) {
        findings.push(capFinding(path, "Cap names an unknown factor level."));
        return;
      }
      if (entry.siteId !== undefined) {
        if (!perSite) {
          findings.push({
            code: "INVALID_CAP_SCOPE",
            severity: "error",
            fieldPath: `${path}.siteId`,
            message: "Study-wide caps cannot name a site.",
          });
          return;
        }
        if (!knownSites.has(entry.siteId)) {
          findings.push(
            capFinding(`${path}.siteId`, "Cap names an unknown site.")
          );
          return;
        }
      }
      if (!isNonNegativeSafeInteger(entry.cap)) {
        findings.push(
          capFinding(
            `${path}.cap`,
            "A cap must be a non-negative whole number."
          )
        );
        return;
      }
      const key = JSON.stringify([
        entry.factorId,
        entry.levelId,
        entry.siteId ?? null,
      ]);
      if (seen.has(key)) {
        findings.push(
          capFinding(path, "Only one cap per factor level and site.")
        );
        return;
      }
      seen.add(key);
      const levelKey = JSON.stringify([entry.factorId, entry.levelId]);
      if (entry.siteId === undefined) general.set(levelKey, entry.cap);
      else bySite.set(JSON.stringify([entry.siteId, levelKey]), entry.cap);
    }
  );
  if (findings.length > 0) return { ok: false, findings };

  const scopes: readonly (string | undefined)[] = perSite
    ? request.sites.map((s) => s.id)
    : [undefined];
  const levelCaps: ResolvedLevelCap[] = [];
  let bound = BigInt(0);
  let boundingFactorIds: string[] | null = null;
  for (const siteId of scopes) {
    const candidates: bigint[] = [];
    if (caps.totalEnrollment !== undefined) {
      candidates.push(BigInt(caps.totalEnrollment));
    }
    const boundingHere: string[] = [];
    for (const factor of request.factors) {
      let sum = BigInt(0);
      let complete = factor.levels.length > 0;
      for (const level of factor.levels) {
        const levelKey = JSON.stringify([factor.id, level.id]);
        const cap =
          (siteId !== undefined
            ? bySite.get(JSON.stringify([siteId, levelKey]))
            : undefined) ?? general.get(levelKey);
        if (cap === undefined) {
          complete = false;
          continue;
        }
        sum += BigInt(cap);
        levelCaps.push(
          Object.freeze(
            siteId === undefined
              ? { factorId: factor.id, levelId: level.id, cap }
              : { factorId: factor.id, levelId: level.id, siteId, cap }
          )
        );
      }
      if (complete) {
        candidates.push(sum);
        boundingHere.push(factor.id);
      }
    }
    if (candidates.length === 0) {
      return {
        ok: false,
        findings: [
          capFinding(
            "caps.levelCaps",
            siteId === undefined
              ? "Marginal caps are unbounded: cap every level of at least one factor, or set caps.totalEnrollment."
              : `Marginal caps are unbounded for site ${siteId}: cap every level of at least one factor there, or set caps.totalEnrollment.`
          ),
        ],
      };
    }
    bound += candidates.reduce((a, b) => (b < a ? b : a));
    boundingFactorIds =
      boundingFactorIds === null
        ? boundingHere
        : boundingFactorIds.filter((id) => boundingHere.includes(id));
  }
  if (bound > BigInt(Number.MAX_SAFE_INTEGER)) {
    return {
      ok: false,
      findings: [
        {
          code: "RESOURCE_LIMIT_EXCEEDED",
          severity: "error",
          fieldPath: "caps",
          message: "The marginal termination bound is too large.",
          estimatedValue: bound.toString(),
          limitValue: String(Number.MAX_SAFE_INTEGER),
        },
      ],
    };
  }

  return Object.freeze({
    ok: true as const,
    strategy: "marginal" as const,
    capScope: caps.capScope,
    ...(request.method === "BLOCK" && caps.sitePolicy
      ? { sitePolicy: caps.sitePolicy }
      : {}),
    levelCaps: Object.freeze(levelCaps),
    ...(caps.totalEnrollment !== undefined
      ? { totalEnrollment: caps.totalEnrollment }
      : {}),
    terminationBound: Number(bound),
    boundingFactorIds: Object.freeze(boundingFactorIds ?? []),
  });
}

/**
 * Remaining marginal capacity. An intersection fits while every capped
 * level it carries, and the hard total, still have room. Uncapped levels
 * never limit it. Counters stay study-wide unless the scope is per-site.
 */
export class MarginalLedger {
  private readonly remaining = new Map<string, number>();
  private readonly totals = new Map<string, number>();
  private readonly perSite: boolean;
  private readonly total: number | undefined;

  constructor(resolution: MarginalCapResolution) {
    this.perSite = resolution.capScope === "per-site";
    this.total = resolution.totalEnrollment;
    for (const cap of resolution.levelCaps) {
      this.remaining.set(
        this.key(cap.siteId ?? "", cap.factorId, cap.levelId),
        cap.cap
      );
    }
  }

  private scope(siteId: string): string {
    return this.perSite ? siteId : "";
  }

  private key(siteId: string, factorId: string, levelId: string): string {
    return JSON.stringify([this.scope(siteId), factorId, levelId]);
  }

  /** How many more subjects this intersection can take at this site. */
  left(siteId: string, intersection: IntersectionLevels): number {
    let room =
      this.total === undefined
        ? Number.POSITIVE_INFINITY
        : this.total - (this.totals.get(this.scope(siteId)) ?? 0);
    for (const [factorId, levelId] of Object.entries(intersection.levels)) {
      const left = this.remaining.get(this.key(siteId, factorId, levelId));
      if (left !== undefined && left < room) room = left;
    }
    return room;
  }

  take(siteId: string, intersection: IntersectionLevels, count: number): void {
    const scope = this.scope(siteId);
    this.totals.set(scope, (this.totals.get(scope) ?? 0) + count);
    for (const [factorId, levelId] of Object.entries(intersection.levels)) {
      const key = this.key(siteId, factorId, levelId);
      const left = this.remaining.get(key);
      if (left !== undefined) this.remaining.set(key, left - count);
    }
  }
}
