/**
 * Time-to-event statistics for the Kaplan-Meier figure: the product-limit
 * estimator with Greenwood standard errors and log-log confidence limits,
 * the unstratified log-rank test for two or more groups, and the chi-square
 * tail probability it is referred to.
 *
 * These are this pipeline's own routines. They share nothing with the
 * arcade game's curve code, which serves a different purpose.
 */
import type {
  KaplanMeierEstimate,
  KaplanMeierStep,
  LogRankTest,
  SurvivalObservation,
} from "../../types";

/** Confidence level of the pointwise limits {@link kaplanMeierEstimate} reports. */
export const KM_CONFIDENCE_LEVEL = 0.95;

/**
 * The standard normal quantile for a two-sided 95% interval,
 * the 0.975 quantile, to double precision.
 */
export const NORMAL_QUANTILE_975 = 1.959963984540054;

/** Relative size below which a pivot of the log-rank covariance counts as zero. */
const RANK_TOLERANCE = 1e-10;

function checkObservations(observations: readonly SurvivalObservation[]): void {
  for (const [index, observation] of observations.entries()) {
    if (!Number.isFinite(observation.time) || observation.time < 0) {
      throw new RangeError(
        `Observation ${index} has time ${observation.time}; times must be finite and not negative.`
      );
    }
    if (typeof observation.event !== "boolean") {
      throw new RangeError(
        `Observation ${index} has no event flag; it must be true or false.`
      );
    }
  }
}

interface TimeCount {
  readonly time: number;
  events: number;
  censored: number;
}

function countByTime(
  observations: readonly SurvivalObservation[]
): TimeCount[] {
  const byTime = new Map<number, TimeCount>();
  for (const { time, event } of observations) {
    const count = byTime.get(time) ?? { time, events: 0, censored: 0 };
    if (event) count.events += 1;
    else count.censored += 1;
    byTime.set(time, count);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/**
 * Log-log (complementary log-log) limits for a survival estimate:
 * `exp(-exp(log(-log S) ± z σ))` with `σ = sqrt(greenwoodSum) / |log S|`.
 * Not estimable when S is 0 or 1, where `log(-log S)` is undefined.
 */
function logLogLimits(
  survival: number,
  greenwoodSum: number
): { readonly lower: number | null; readonly upper: number | null } {
  if (survival <= 0 || survival >= 1 || !Number.isFinite(greenwoodSum)) {
    return { lower: null, upper: null };
  }
  const logSurvival = Math.log(survival);
  const centre = Math.log(-logSurvival);
  const spread =
    (NORMAL_QUANTILE_975 * Math.sqrt(greenwoodSum)) / Math.abs(logSurvival);
  return {
    lower: Math.exp(-Math.exp(centre + spread)),
    upper: Math.exp(-Math.exp(centre - spread)),
  };
}

/**
 * The Kaplan-Meier (product-limit) estimate of the survival function.
 *
 * There is one step for every distinct time at which an event or a
 * censoring was observed, in ascending order. Ties follow the standard
 * product-limit convention: every subject whose time is t, event or
 * censored, is at risk at t; the d events at t make one factor of
 * `1 - d / n`; censorings at t leave the risk set after that factor.
 *
 * The standard error is Greenwood's, `S(t) * sqrt(Σ d / (n (n - d)))` over
 * event times up to t. When the estimate reaches 0 the sum is undefined and
 * the standard error is reported as 0, as Minitab and SAS print it. The
 * 95% limits use the log-log transform and are `null` (not estimable) where
 * S is 1 or 0.
 *
 * @param observations - One time and event flag per subject. Times are in
 *   any unit, finite and not negative.
 * @returns The estimate. With no observations it has no steps.
 * @throws RangeError when a time is negative or not finite, or an event
 *   flag is missing.
 */
export function kaplanMeierEstimate(
  observations: readonly SurvivalObservation[]
): KaplanMeierEstimate {
  checkObservations(observations);
  let atRisk = observations.length;
  let survival = 1;
  let greenwoodSum = 0;
  const steps: KaplanMeierStep[] = [];
  for (const { time, events, censored } of countByTime(observations)) {
    if (events > 0) {
      survival *= 1 - events / atRisk;
      greenwoodSum =
        events === atRisk
          ? Number.POSITIVE_INFINITY
          : greenwoodSum + events / (atRisk * (atRisk - events));
    }
    const standardError =
      survival === 0 ? 0 : survival * Math.sqrt(greenwoodSum);
    steps.push({
      time,
      atRisk,
      events,
      censored,
      survival,
      standardError,
      ...logLogLimits(survival, greenwoodSum),
    });
    atRisk -= events + censored;
  }
  const events = observations.filter((item) => item.event).length;
  return {
    n: observations.length,
    events,
    censored: observations.length - events,
    confidenceLevel: KM_CONFIDENCE_LEVEL,
    confidenceTransform: "log-log",
    steps,
  };
}

function logGamma(value: number): number {
  // Lanczos approximation, g = 7, n = 9.
  const coefficients = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (value < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * value)) - logGamma(1 - value);
  }
  const shifted = value - 1;
  let sum = coefficients[0];
  for (let index = 1; index < coefficients.length; index += 1) {
    sum += coefficients[index] / (shifted + index);
  }
  const base = shifted + 7.5;
  return (
    0.5 * Math.log(2 * Math.PI) +
    (shifted + 0.5) * Math.log(base) -
    base +
    Math.log(sum)
  );
}

/** Regularized upper incomplete gamma function Q(a, x), for a > 0 and x ≥ 0. */
function upperGammaRatio(a: number, x: number): number {
  if (x === 0) return 1;
  const prefix = Math.exp(-x + a * Math.log(x) - logGamma(a));
  if (x < a + 1) {
    // Series for the lower ratio P(a, x).
    let term = 1 / a;
    let sum = term;
    for (let n = 1; n < 1000; n += 1) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-16) break;
    }
    return Math.max(0, 1 - sum * prefix);
  }
  // Continued fraction for Q(a, x), modified Lentz.
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let fraction = d;
  for (let n = 1; n < 1000; n += 1) {
    const an = -n * (n - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    fraction *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.min(1, prefix * fraction);
}

/**
 * The upper tail probability of a chi-square distribution, `P(X ≥ x)`.
 *
 * @param x - The statistic, finite and not negative.
 * @param degreesOfFreedom - A positive integer.
 * @throws RangeError when either argument is out of range.
 */
export function chiSquareSurvival(x: number, degreesOfFreedom: number): number {
  if (!Number.isFinite(x) || x < 0) {
    throw new RangeError(
      `A chi-square statistic must be finite and not negative, got ${x}.`
    );
  }
  if (!Number.isInteger(degreesOfFreedom) || degreesOfFreedom < 1) {
    throw new RangeError(
      `Degrees of freedom must be a positive integer, got ${degreesOfFreedom}.`
    );
  }
  return upperGammaRatio(degreesOfFreedom / 2, x / 2);
}

/**
 * U'V⁻U for a symmetric positive semi-definite V, through pivoted
 * elimination: pivots below the tolerance are dropped, so a group with no
 * information (no subjects, or none at risk at any event time) does not
 * make the system singular. Returns the quadratic form and the rank.
 */
function quadraticForm(
  u: readonly number[],
  v: readonly (readonly number[])[]
): { readonly value: number; readonly rank: number } {
  const size = u.length;
  const matrix = v.map((row) => [...row]);
  const vector = [...u];
  const scale = Math.max(0, ...matrix.map((row, index) => row[index]));
  const used = new Set<number>();
  let value = 0;
  if (scale === 0) return { value: 0, rank: 0 };
  for (;;) {
    let pivot = -1;
    let largest = RANK_TOLERANCE * scale;
    for (let index = 0; index < size; index += 1) {
      if (!used.has(index) && matrix[index][index] > largest) {
        largest = matrix[index][index];
        pivot = index;
      }
    }
    if (pivot === -1) break;
    used.add(pivot);
    const diagonal = matrix[pivot][pivot];
    value += (vector[pivot] * vector[pivot]) / diagonal;
    for (let row = 0; row < size; row += 1) {
      if (used.has(row)) continue;
      const factor = matrix[row][pivot] / diagonal;
      vector[row] -= factor * vector[pivot];
      for (let column = 0; column < size; column += 1) {
        matrix[row][column] -= factor * matrix[pivot][column];
      }
    }
  }
  return { value, rank: used.size };
}

/**
 * The unstratified log-rank test that two or more survival distributions
 * are equal.
 *
 * At each distinct event time, pooled over groups, each group contributes
 * its observed events and its expected events `n_j d / n`; the covariance
 * of observed minus expected uses the hypergeometric variance
 * `d (n - d) / (n - 1) * n_j / n * (δ_jl - n_l / n)`. The statistic is
 * `U'V⁻U` with U the observed minus expected totals and V⁻ a generalised
 * inverse of their covariance. Its degrees of freedom are the rank of V,
 * which is the number of groups less one when every group has information.
 *
 * @param groups - Observations for each group, in display order. A group
 *   may be empty.
 * @returns Per-group totals and the test. `chiSquare` and `pValue` are
 *   `null` (not estimable) when there are no events or fewer than two
 *   groups with information.
 * @throws RangeError when a time is negative or not finite, or an event
 *   flag is missing.
 */
export function logRankTest(
  groups: readonly (readonly SurvivalObservation[])[]
): LogRankTest {
  groups.forEach(checkObservations);
  const k = groups.length;
  const counts = groups.map((group) => countByTime(group));
  const times = [
    ...new Set(counts.flatMap((group) => group.map((item) => item.time))),
  ].sort((a, b) => a - b);
  const atRisk = groups.map((group) => group.length);
  const cursor = groups.map(() => 0);
  const observed = groups.map(() => 0);
  const expected = groups.map(() => 0);
  const covariance = groups.map(() => groups.map(() => 0));
  for (const time of times) {
    const here = counts.map((group, index) => {
      const item = group[cursor[index]];
      if (item && item.time === time) {
        cursor[index] += 1;
        return item;
      }
      return { time, events: 0, censored: 0 };
    });
    const n = atRisk.reduce((sum, value) => sum + value, 0);
    const d = here.reduce((sum, item) => sum + item.events, 0);
    if (d > 0) {
      for (let j = 0; j < k; j += 1) {
        observed[j] += here[j].events;
        expected[j] += (atRisk[j] * d) / n;
      }
      if (n > 1) {
        const spread = (d * (n - d)) / (n - 1);
        for (let j = 0; j < k; j += 1) {
          for (let l = 0; l < k; l += 1) {
            covariance[j][l] +=
              ((spread * atRisk[j]) / n) * ((j === l ? 1 : 0) - atRisk[l] / n);
          }
        }
      }
    }
    for (let j = 0; j < k; j += 1) {
      atRisk[j] -= here[j].events + here[j].censored;
    }
  }
  const difference = observed.map((value, index) => value - expected[index]);
  const { value, rank } = quadraticForm(difference, covariance);
  return {
    observed,
    expected,
    covariance,
    degreesOfFreedom: rank,
    chiSquare: rank === 0 ? null : value,
    pValue: rank === 0 ? null : chiSquareSurvival(value, rank),
  };
}
