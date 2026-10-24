/**
 * Monte Carlo time to complete enrollment (#2632). Each run draws every
 * site's rate from its gamma, then the time at which the sites' combined
 * Poisson process reaches the subjects still to enroll. That time is exact
 * for a piecewise-constant rate: the k-th arrival happens when the
 * integrated rate reaches a Gamma(k, 1) draw, the sum of k unit
 * exponentials, so a run costs one gamma draw per site and one for the
 * arrivals, whatever the target.
 *
 * Each run reads its own seeded stream, so a what-if that adds sites draws
 * the same base rates and arrivals in every run as the baseline does, and
 * can only bring each run's completion earlier.
 */
import { uniformAt } from "@/lib/utils/prng";
import type { EnrollmentSimulationInput, RecruitmentRate } from "../../types";

const MIN_RUNS = 100;
const MAX_RUNS = 20_000;

/** Seeded draws for one run. */
class Draws {
  private index = 0;

  constructor(private readonly key: string) {}

  /** A uniform draw in (0, 1]. */
  uniform(): number {
    const u = uniformAt(this.key, this.index);
    this.index += 1;
    return 1 - u;
  }

  /** A standard normal draw (Box-Muller). */
  normal(): number {
    return (
      Math.sqrt(-2 * Math.log(this.uniform())) *
      Math.cos(2 * Math.PI * this.uniform())
    );
  }

  /**
   * A Gamma(shape, 1) draw by Marsaglia and Tsang's method (ACM TOMS 26,
   * 2000), with the u^(1/α) boost for a shape below 1.
   */
  gamma(shape: number): number {
    if (shape < 1) return this.gamma(shape + 1) * this.uniform() ** (1 / shape);
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      const x = this.normal();
      const v = (1 + c * x) ** 3;
      if (v <= 0) continue;
      const u = this.uniform();
      if (u < 1 - 0.0331 * x ** 4) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  /** A rate from its gamma distribution. */
  rate(r: RecruitmentRate): number {
    return this.gamma(r.shape) / r.rate;
  }
}

function checkRate(r: RecruitmentRate): void {
  if (!(Number.isFinite(r.shape) && r.shape > 0)) {
    throw new RangeError(`shape must be more than 0, got ${r.shape}`);
  }
  if (!(Number.isFinite(r.rate) && r.rate > 0)) {
    throw new RangeError(`rate must be more than 0, got ${r.rate}`);
  }
}

function check(input: EnrollmentSimulationInput): void {
  if (!Number.isInteger(input.remaining) || input.remaining < 1) {
    throw new RangeError(
      `remaining must be a whole number of 1 or more, got ${input.remaining}`
    );
  }
  if (
    !Number.isInteger(input.runs) ||
    input.runs < MIN_RUNS ||
    input.runs > MAX_RUNS
  ) {
    throw new RangeError(
      `runs must be a whole number from ${MIN_RUNS} to ${MAX_RUNS}, got ${input.runs}`
    );
  }
  if (input.sites.length + input.laterSites.length === 0) {
    throw new RangeError("a simulation needs at least one site");
  }
  input.sites.forEach(checkRate);
  for (const site of input.laterSites) {
    checkRate(site);
    if (!(Number.isFinite(site.startDay) && site.startDay >= 0)) {
      throw new RangeError(`startDay must be 0 or more, got ${site.startDay}`);
    }
  }
}

/**
 * Simulates the time to enroll the remaining subjects.
 *
 * @param input - The sites, the later sites, the subjects still to enroll, the runs and the stream key.
 * @returns Each run's completion time in days from the start, sorted ascending.
 * @throws RangeError when the input is outside its domain.
 */
export function simulateEnrollmentCompletion(
  input: EnrollmentSimulationInput
): number[] {
  check(input);
  const later = input.laterSites
    .map((site, order) => ({ site, order }))
    .sort((a, b) => a.site.startDay - b.site.startDay || a.order - b.order);
  const times: number[] = [];
  for (let run = 0; run < input.runs; run += 1) {
    const draws = new Draws(`${input.streamKey}:${run}`);
    // Base rates, then arrivals, then later sites: the baseline and a
    // what-if read the same draws for everything they share.
    let rate = 0;
    for (const site of input.sites) rate += draws.rate(site);
    const target = draws.gamma(input.remaining);
    const starts = later.map(({ site }) => ({
      day: site.startDay,
      rate: draws.rate(site),
    }));
    let day = 0;
    let integrated = 0;
    let done: number | null = null;
    for (const start of starts) {
      if (rate > 0 && integrated + rate * (start.day - day) >= target) {
        done = day + (target - integrated) / rate;
        break;
      }
      integrated += rate * (start.day - day);
      day = start.day;
      rate += start.rate;
    }
    times.push(done ?? day + (target - integrated) / rate);
  }
  return times.sort((a, b) => a - b);
}
