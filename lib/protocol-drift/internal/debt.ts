/**
 * Epistemic debt accounting: fabricated precision in bits, semantic loss
 * and honest uncertainty.
 */
import type { EpistemicStatus } from "../types";

/** Thrown when a precision claim contradicts its evidence set. */
export class EpistemicContradictionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EpistemicContradictionError";
  }
}

/**
 * Fabricated precision D_fab = log2(|S| / |S_P|) for a claim narrowing a
 * finite candidate set S to S_P without evidence. Zero when nothing is
 * narrowed; throws when the claim is empty or larger than the evidence set.
 */
export function fabricatedBits(candidates: number, claimed: number): number {
  if (!Number.isInteger(candidates) || candidates < 1) {
    throw new EpistemicContradictionError(
      `Evidence set must be non-empty, got ${candidates}`
    );
  }
  if (!Number.isInteger(claimed) || claimed < 1 || claimed > candidates) {
    throw new EpistemicContradictionError(
      `Claim of ${claimed} is not a non-empty subset of ${candidates} candidates`
    );
  }
  return Math.log2(candidates / claimed);
}

/** Days in a calendar month (month is 1-12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Result of preserving or imputing a partial ISO date. */
export interface PartialDateOutcome {
  value: string;
  status: EpistemicStatus;
  fabricatedBits: number;
}

/**
 * Resolves an ISO date or partial date. "YYYY-MM" kept as is is honest
 * uncertainty; imputing day 01 fabricates log2(days in month) bits.
 */
export function resolvePartialDate(
  value: string,
  policy: "preserve" | "impute-day"
): PartialDateOutcome {
  const month = /^(\d{4})-(\d{2})$/.exec(value);
  if (month) {
    if (policy === "preserve") {
      return { value, status: "UNCERTAIN", fabricatedBits: 0 };
    }
    const days = daysInMonth(Number(month[1]), Number(month[2]));
    return {
      value: `${value}-01`,
      status: "FABRICATED",
      fabricatedBits: fabricatedBits(days, 1),
    };
  }
  const year = /^(\d{4})$/.exec(value);
  if (year) {
    if (policy === "preserve") {
      return { value, status: "UNCERTAIN", fabricatedBits: 0 };
    }
    const leap = daysInMonth(Number(year[1]), 2) === 29;
    return {
      value: `${value}-01-01`,
      status: "FABRICATED",
      fabricatedBits: fabricatedBits(leap ? 366 : 365, 1),
    };
  }
  return { value, status: "CONFIRMED", fabricatedBits: 0 };
}

/** Status precedence when several badges apply to one token. */
export function worstStatus(statuses: EpistemicStatus[]): EpistemicStatus {
  const rank: Record<EpistemicStatus, number> = {
    CONFIRMED: 0,
    UNCERTAIN: 1,
    LOSS: 2,
    FABRICATED: 3,
  };
  let worst: EpistemicStatus = "CONFIRMED";
  for (const s of statuses) if (rank[s] > rank[worst]) worst = s;
  return worst;
}
