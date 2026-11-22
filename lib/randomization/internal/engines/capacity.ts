/**
 * Capacity ledgers and actual-profile mapping shared by the permuted-block
 * engine (#4000, #4001) and the minimization engine (#4002).
 */

import type {
  ParticipantProfile,
  ProfileAssignmentOutcome,
  RandomizationRequest,
} from "../../types";
import { serializeStructuralStratumKey } from "../identity/stratum-identity";
import type { CapResolutionResult, StratumIntersection } from "./caps";
import { MarginalLedger, type MarginalCapResolution } from "./marginal";

/** A resolved manual or proportional intersection matrix. */
export type IntersectionCapResolution = Extract<
  CapResolutionResult,
  { ok: true }
>;

/** Resolved capacities of either kind: an intersection matrix or level caps. */
export type ResolvedCapacities =
  IntersectionCapResolution | MarginalCapResolution;

/** Remaining capacity, asked per site and intersection. */
export interface CapacityLedger {
  left(siteId: string, intersection: StratumIntersection): number;
  take(siteId: string, intersection: StratumIntersection, count: number): void;
}

/** Per-intersection caps from a manual or proportional matrix. */
class IntersectionLedger implements CapacityLedger {
  private readonly remaining = new Map<string, number>();
  private readonly perSite: boolean;

  constructor(capacities: IntersectionCapResolution) {
    this.perSite = capacities.capScope === "per-site";
    for (const cap of capacities.caps) {
      this.remaining.set(this.key(cap.siteId ?? "", cap.stratumKey), cap.cap);
    }
  }

  private key(siteId: string, stratumKey: string): string {
    return JSON.stringify([this.perSite ? siteId : "", stratumKey]);
  }

  left(siteId: string, intersection: StratumIntersection): number {
    return this.remaining.get(this.key(siteId, intersection.stratumKey)) ?? 0;
  }

  take(siteId: string, intersection: StratumIntersection, count: number): void {
    const key = this.key(siteId, intersection.stratumKey);
    this.remaining.set(key, (this.remaining.get(key) ?? 0) - count);
  }
}

/** Opens the ledger that matches the resolved capacity kind. */
export function createLedger(capacities: ResolvedCapacities): CapacityLedger {
  return capacities.strategy === "marginal"
    ? new MarginalLedger(capacities)
    : new IntersectionLedger(capacities);
}

/**
 * Maps an actual profile to its own site and intersection, never to another
 * one. Returns the unmapped outcome when the site or a factor level is not
 * part of the design.
 */
export function mapProfileToIntersection(
  request: RandomizationRequest,
  intersectionsByKey: ReadonlyMap<string, StratumIntersection>,
  profile: ParticipantProfile
):
  | { readonly ok: true; readonly intersection: StratumIntersection }
  | { readonly ok: false; readonly outcome: ProfileAssignmentOutcome } {
  if (!request.sites.some((s) => s.id === profile.siteId)) {
    return {
      ok: false,
      outcome: {
        status: "unmapped-site",
        subjectId: profile.subjectId,
        siteId: profile.siteId,
      },
    };
  }
  const missing: string[] = [];
  const entries = request.factors.map((factor) => {
    const levelId = profile.stratumLevels[factor.id];
    if (
      typeof levelId !== "string" ||
      !factor.levels.some((l) => l.id === levelId)
    ) {
      missing.push(factor.id);
    }
    return { factorId: factor.id, levelId };
  });
  const intersection =
    missing.length === 0
      ? intersectionsByKey.get(serializeStructuralStratumKey(entries))
      : undefined;
  if (!intersection) {
    return {
      ok: false,
      outcome: {
        status: "unmapped-stratum",
        subjectId: profile.subjectId,
        siteId: profile.siteId,
        missingFactorIds: Object.freeze(missing),
      },
    };
  }
  return { ok: true, intersection };
}
