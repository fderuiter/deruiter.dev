/**
 * The Poisson-gamma recruitment model (Anisimov and Fedorov, Statistics in
 * Medicine 26, 2007): each site enrolls as a Poisson process whose rate is
 * drawn from one gamma distribution for the study. The study's gamma is
 * fitted to its sites by maximum likelihood, and each site's own rate then
 * has a gamma posterior (#2632).
 */
import type { RecruitmentRate } from "../../types";

/** A site's enrollment so far, the data the prior is fitted to. */
export interface SiteExposure {
  /** Subjects enrolled, a whole number of 0 or more. */
  readonly enrolled: number;
  /** Days the site has recruited, more than 0. */
  readonly exposureDays: number;
}

const MIN_SHAPE = 1e-3;
const MAX_SHAPE = 1e5;
const SEARCH_STEPS = 200;

function check(sites: readonly SiteExposure[]): void {
  if (sites.length < 2) {
    throw new RangeError(
      `fitting a prior needs at least 2 sites, got ${sites.length}`
    );
  }
  for (const { enrolled, exposureDays } of sites) {
    if (!Number.isInteger(enrolled) || enrolled < 0) {
      throw new RangeError(
        `enrolled must be a whole number of 0 or more, got ${enrolled}`
      );
    }
    if (!Number.isFinite(exposureDays) || exposureDays <= 0) {
      throw new RangeError(
        `exposureDays must be more than 0, got ${exposureDays}`
      );
    }
  }
  if (sites.every((s) => s.enrolled === 0)) {
    throw new RangeError(
      "no site has enrolled a subject, so no rate can be fitted"
    );
  }
}

/**
 * Log-likelihood of a gamma prior given the sites, less the term that
 * depends on neither parameter. Each site's count is negative binomial:
 * Γ(α + n) / Γ(α) · (β / (β + τ))^α · (τ / (β + τ))^n.
 */
export function recruitmentLogLikelihood(
  sites: readonly SiteExposure[],
  prior: RecruitmentRate
): number {
  const { shape: a, rate: b } = prior;
  let total = 0;
  for (const { enrolled: n, exposureDays: t } of sites) {
    // log Γ(α + n) − log Γ(α), exactly, as a sum over the n factors.
    for (let k = 0; k < n; k += 1) total += Math.log(a + k);
    total += a * Math.log(b / (b + t)) + n * Math.log(t / (b + t));
  }
  return total;
}

/**
 * The rate β that maximizes the likelihood for a fixed shape α: the root of
 * α·m − Σ (α + nᵢ) β / (β + τᵢ), which falls from α·m at β = 0 to −Σ nᵢ as β
 * grows, so it has exactly one root. Found by bisection on log β.
 */
function profileRate(sites: readonly SiteExposure[], shape: number): number {
  const score = (b: number) =>
    sites.reduce(
      (sum, { enrolled: n, exposureDays: t }) =>
        sum + shape - ((shape + n) * b) / (b + t),
      0
    );
  let lo = Math.log(1e-12);
  let hi = Math.log(1e15);
  for (let i = 0; i < SEARCH_STEPS; i += 1) {
    const mid = (lo + hi) / 2;
    if (score(Math.exp(mid)) > 0) lo = mid;
    else hi = mid;
  }
  return Math.exp((lo + hi) / 2);
}

/**
 * Fits the study's gamma prior of site recruitment rates by maximum
 * likelihood: the shape by golden-section search on log α over [10⁻³, 10⁵],
 * with the rate profiled out for each shape. Sites that recruit at one
 * common rate drive the shape to the top of the range, where the gamma is
 * all but a single rate.
 *
 * @param sites - Each site's enrollment and days recruiting; at least 2, and at least one with a subject.
 * @returns The fitted prior, in subjects per site-day.
 * @throws RangeError when the sites cannot identify a prior.
 */
export function fitRecruitmentPrior(
  sites: readonly SiteExposure[]
): RecruitmentRate {
  check(sites);
  const profile = (logShape: number) => {
    const shape = Math.exp(logShape);
    const rate = profileRate(sites, shape);
    return {
      shape,
      rate,
      ll: recruitmentLogLikelihood(sites, { shape, rate }),
    };
  };
  const ratio = (Math.sqrt(5) - 1) / 2;
  let lo = Math.log(MIN_SHAPE);
  let hi = Math.log(MAX_SHAPE);
  let x1 = hi - ratio * (hi - lo);
  let x2 = lo + ratio * (hi - lo);
  let f1 = profile(x1).ll;
  let f2 = profile(x2).ll;
  for (let i = 0; i < SEARCH_STEPS && hi - lo > 1e-9; i += 1) {
    if (f1 < f2) {
      lo = x1;
      x1 = x2;
      f1 = f2;
      x2 = lo + ratio * (hi - lo);
      f2 = profile(x2).ll;
    } else {
      hi = x2;
      x2 = x1;
      f2 = f1;
      x1 = hi - ratio * (hi - lo);
      f1 = profile(x1).ll;
    }
  }
  const { shape, rate } = profile((lo + hi) / 2);
  return { shape, rate };
}

/**
 * A site's rate given the prior and its own enrollment: the gamma posterior
 * Gamma(α + n, β + τ). A site with no days recruiting yet keeps the prior.
 *
 * @param prior - The study's prior.
 * @param site - The site's enrollment and days recruiting, 0 or more.
 * @returns The posterior rate.
 */
export function posteriorRate(
  prior: RecruitmentRate,
  site: SiteExposure
): RecruitmentRate {
  return {
    shape: prior.shape + site.enrolled,
    rate: prior.rate + site.exposureDays,
  };
}
