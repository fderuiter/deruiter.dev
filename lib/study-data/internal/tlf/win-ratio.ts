/**
 * Win statistics for a hierarchical composite endpoint: every treatment
 * subject is paired with every control subject in the same stratum, and
 * the pair is decided on the first component, in priority order, that is
 * not a tie (Pocock et al. 2012; Buyse 2010). From the wins, losses and
 * ties come the win ratio, the net benefit and the win odds.
 *
 * The variances follow Dong et al. (2016, 2018) as the R package WINS
 * implements them: U-statistic (Hoeffding) decompositions of the win and
 * loss counts, centred on their pooled mean, with Mantel-Haenszel-type or
 * equal weights across strata. The Finkelstein-Schoenfeld (1999) test
 * scores every pair in the pooled sample of each stratum and refers the
 * treatment total to its permutation variance.
 *
 * Times to an event are compared with Gehan's rule: a subject wins when
 * the other had the event first and the subject was still under
 * observation, so a pair is only compared over its shared follow-up.
 */
import type {
  FinkelsteinSchoenfeldTest,
  WinRatioComponent,
  WinRatioComponentResult,
  WinRatioOptions,
  WinRatioOutcome,
  WinRatioResult,
  WinRatioStratumResult,
  WinRatioStratumWeighting,
  WinRatioSubject,
  WinRatioSubjectResult,
  WinStatisticEstimate,
} from "../../types";
import { chiSquareSurvival } from "./km";

/** Significance level used when none is given. */
export const WIN_RATIO_DEFAULT_ALPHA = 0.05;

const NOT_ESTIMABLE: WinStatisticEstimate = Object.freeze({
  estimate: null,
  lower: null,
  upper: null,
  standardError: null,
  zStatistic: null,
  pValue: null,
});

/**
 * The standard normal quantile, by Wichura's algorithm AS 241 (PPND16),
 * accurate to about 1 part in 10^16.
 *
 * @param p - A probability strictly between 0 and 1.
 * @throws RangeError when `p` is outside (0, 1).
 */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) {
    throw new RangeError(`A probability must be in (0, 1), got ${p}.`);
  }
  const q = p - 0.5;
  if (Math.abs(q) <= 0.425) {
    const r = 0.180625 - q * q;
    return (
      (q *
        (((((((r * 2509.0809287301226727 + 33430.575583588128105) * r +
          67265.770927008700853) *
          r +
          45921.953931549871457) *
          r +
          13731.693765509461125) *
          r +
          1971.5909503065514427) *
          r +
          133.14166789178437745) *
          r +
          3.387132872796366608)) /
      (((((((r * 5226.495278852545925 + 28729.085735721942674) * r +
        39307.89580009271061) *
        r +
        21213.794301586595867) *
        r +
        5394.1960214247511077) *
        r +
        687.1870074920579083) *
        r +
        42.313330701600911252) *
        r +
        1)
    );
  }
  let r = q < 0 ? p : 1 - p;
  r = Math.sqrt(-Math.log(r));
  let value: number;
  if (r <= 5) {
    r -= 1.6;
    value =
      (((((((r * 7.7454501427834140764e-4 + 0.0227238449892691845833) * r +
        0.24178072517745061177) *
        r +
        1.27045825245236838258) *
        r +
        3.64784832476320460504) *
        r +
        5.7694972214606914055) *
        r +
        4.6303378461565452959) *
        r +
        1.42343711074968357734) /
      (((((((r * 1.05075007164441684324e-9 + 5.475938084995344946e-4) * r +
        0.0151986665636164571966) *
        r +
        0.14810397642748007459) *
        r +
        0.68976733498510000455) *
        r +
        1.6763848301838038494) *
        r +
        2.05319162663775882187) *
        r +
        1);
  } else {
    r -= 5;
    value =
      (((((((r * 2.01033439929228813265e-7 + 2.71155556874348757815e-5) * r +
        0.0012426609473880784386) *
        r +
        0.026532189526576123093) *
        r +
        0.29656057182850489123) *
        r +
        1.7848265399172913358) *
        r +
        5.4637849111641143699) *
        r +
        6.6579046435011037772) /
      (((((((r * 2.04426310338993978564e-15 + 1.4215117583164458887e-7) * r +
        1.8463183175100546818e-5) *
        r +
        7.868691311456132591e-4) *
        r +
        0.0148753612908506148525) *
        r +
        0.13692988092273580531) *
        r +
        0.59983220655588793769) *
        r +
        1);
  }
  return q < 0 ? -value : value;
}

/**
 * The p-value of a standard normal statistic: `2 P(Z ≥ |z|)` two-sided,
 * `P(Z ≥ z)` one-sided (large values favour treatment).
 */
function normalPValue(z: number, sided: "two-sided" | "one-sided"): number {
  const twoSided = chiSquareSurvival(z * z, 1);
  if (sided === "two-sided") return twoSided;
  return z >= 0 ? twoSided / 2 : 1 - twoSided / 2;
}

function checkComponents(components: readonly WinRatioComponent[]): void {
  if (components.length === 0) {
    throw new RangeError("A hierarchy needs at least one component.");
  }
  const ids = new Set<string>();
  for (const component of components) {
    if (ids.has(component.id)) {
      throw new RangeError(`Component ${component.id} appears twice.`);
    }
    ids.add(component.id);
    const margin = component.margin ?? 0;
    if (!Number.isFinite(margin) || margin < 0) {
      throw new RangeError(
        `Component ${component.id} has margin ${margin}; it must be finite and not negative.`
      );
    }
    if (component.horizon !== undefined && !(component.horizon > 0)) {
      throw new RangeError(
        `Component ${component.id} has horizon ${component.horizon}; it must be positive.`
      );
    }
  }
}

function checkSubjects(
  subjects: readonly WinRatioSubject[],
  components: readonly WinRatioComponent[]
): void {
  const ids = new Set<string>();
  for (const subject of subjects) {
    if (ids.has(subject.id)) {
      throw new RangeError(`Subject ${subject.id} appears twice.`);
    }
    ids.add(subject.id);
    if (subject.outcomes.length !== components.length) {
      throw new RangeError(
        `Subject ${subject.id} has ${subject.outcomes.length} outcomes for ${components.length} components.`
      );
    }
    components.forEach((component, index) => {
      const { value, event } = subject.outcomes[index];
      if (value === null) return;
      if (!Number.isFinite(value)) {
        throw new RangeError(
          `Subject ${subject.id} has value ${value} on ${component.id}; it must be finite or null.`
        );
      }
      if (component.kind === "time-to-event") {
        if (value < 0) {
          throw new RangeError(
            `Subject ${subject.id} has time ${value} on ${component.id}; times must not be negative.`
          );
        }
        if (typeof event !== "boolean") {
          throw new RangeError(
            `Subject ${subject.id} has no event flag on ${component.id}.`
          );
        }
      }
      if (component.kind === "binary" && value !== 0 && value !== 1) {
        throw new RangeError(
          `Subject ${subject.id} has value ${value} on binary ${component.id}; it must be 0 or 1.`
        );
      }
    });
  }
}

/** A time-to-event outcome censored at the component's horizon. */
function truncate(
  outcome: WinRatioOutcome,
  horizon: number | undefined
): WinRatioOutcome {
  if (
    horizon === undefined ||
    outcome.value === null ||
    outcome.value <= horizon
  ) {
    return outcome;
  }
  return { value: horizon, event: false };
}

/**
 * Compares two subjects on one component: 1 when `a` is better, -1 when
 * `b` is better, 0 for a tie (including a missing outcome on either side).
 *
 * @param component - The component.
 * @param a - The first subject's outcome, already truncated at the horizon.
 * @param b - The second subject's outcome, already truncated at the horizon.
 */
export function compareOnComponent(
  component: WinRatioComponent,
  a: WinRatioOutcome,
  b: WinRatioOutcome
): -1 | 0 | 1 {
  if (a.value === null || b.value === null) return 0;
  const margin = component.kind === "binary" ? 0 : (component.margin ?? 0);
  if (component.kind === "time-to-event") {
    if (component.better === "higher") {
      if (b.event && a.value > b.value + margin) return 1;
      if (a.event && b.value > a.value + margin) return -1;
      return 0;
    }
    if (a.event && a.value < b.value - margin) return 1;
    if (b.event && b.value < a.value - margin) return -1;
    return 0;
  }
  if (component.better === "higher") {
    if (a.value > b.value + margin) return 1;
    if (b.value > a.value + margin) return -1;
    return 0;
  }
  if (a.value < b.value - margin) return 1;
  if (b.value < a.value - margin) return -1;
  return 0;
}

/**
 * Compares two subjects through the hierarchy.
 *
 * @returns The 0-based index of the deciding component and the result,
 *   or `null` when every component is a tie.
 */
function comparePair(
  components: readonly WinRatioComponent[],
  a: readonly WinRatioOutcome[],
  b: readonly WinRatioOutcome[]
): { readonly level: number; readonly result: -1 | 1 } | null {
  for (let level = 0; level < components.length; level += 1) {
    const result = compareOnComponent(components[level], a[level], b[level]);
    if (result !== 0) return { level, result };
  }
  return null;
}

interface StratumWork {
  readonly label: string;
  readonly treatment: number[];
  readonly control: number[];
}

/**
 * The parts of the U-statistic decomposition for one stratum's win (K) and
 * loss (L) indicators, centred on their pooled mean θ. For the rows (each
 * treatment subject's sums over controls) and the columns (each control
 * subject's sums over treatment subjects) it returns
 * `Σ_i Σ_{j≠j'} (K_ij - θ)(X_ij' - θ)` for X = K and X = L, and the same
 * for L with L, from the row or column sums alone, using that K and L are
 * 0 or 1 and never both 1.
 */
function crossProducts(
  sums: readonly { readonly k: number; readonly l: number }[],
  others: number,
  theta: number
): { readonly kk: number; readonly ll: number; readonly kl: number } {
  let kk = 0;
  let ll = 0;
  let kl = 0;
  const thetaSquared = others * theta * theta;
  for (const { k, l } of sums) {
    const dk = k - others * theta;
    const dl = l - others * theta;
    kk += dk * dk - (k * (1 - 2 * theta) + thetaSquared);
    ll += dl * dl - (l * (1 - 2 * theta) + thetaSquared);
    kl += dk * dl - (-theta * k - theta * l + thetaSquared);
  }
  return { kk, ll, kl };
}

function logScaleEstimate(
  estimate: number,
  variance: number,
  quantile: number,
  sided: "two-sided" | "one-sided"
): WinStatisticEstimate {
  if (!(estimate > 0) || !Number.isFinite(estimate) || !(variance > 0)) {
    return {
      ...NOT_ESTIMABLE,
      estimate: Number.isFinite(estimate) ? estimate : null,
    };
  }
  const se = Math.sqrt(variance);
  const z = Math.log(estimate) / se;
  return {
    estimate,
    lower: Math.exp(Math.log(estimate) - quantile * se),
    upper: Math.exp(Math.log(estimate) + quantile * se),
    standardError: se,
    zStatistic: z,
    pValue: normalPValue(z, sided),
  };
}

/**
 * Win ratio, net benefit and win odds for a hierarchical composite
 * endpoint, with confidence limits and z tests, and the
 * Finkelstein-Schoenfeld test.
 *
 * Pairs are formed only within a stratum. Under `"unstratified"` every
 * subject is in one stratum whatever its label. A subject's missing
 * outcome on a component ties with everyone on that component, so the
 * pair moves on to the next one.
 *
 * Estimates whose denominator is zero (no losses for the win ratio) and
 * variances that cannot be formed (fewer than two subjects in a group of
 * some stratum) are reported as `null`.
 *
 * @param subjects - The analysis subjects, both groups.
 * @param options - The hierarchy and the settings.
 * @throws RangeError when the hierarchy or the subjects are malformed, or
 *   either group is empty.
 */
export function winStatistics(
  subjects: readonly WinRatioSubject[],
  options: WinRatioOptions
): WinRatioResult {
  const { components } = options;
  const weighting: WinRatioStratumWeighting =
    options.weighting ?? "unstratified";
  const alpha = options.alpha ?? WIN_RATIO_DEFAULT_ALPHA;
  const sided = options.sided ?? "two-sided";
  if (!(alpha > 0 && alpha < 1)) {
    throw new RangeError(`alpha must be in (0, 1), got ${alpha}.`);
  }
  checkComponents(components);
  checkSubjects(subjects, components);

  const outcomes = subjects.map((subject) =>
    subject.outcomes.map((outcome, index) =>
      components[index].kind === "time-to-event"
        ? truncate(outcome, components[index].horizon)
        : outcome
    )
  );

  const strata = new Map<string, StratumWork>();
  subjects.forEach((subject, index) => {
    const label = weighting === "unstratified" ? "" : (subject.stratum ?? "");
    const stratum = strata.get(label) ?? { label, treatment: [], control: [] };
    (subject.group === "treatment" ? stratum.treatment : stratum.control).push(
      index
    );
    strata.set(label, stratum);
  });

  const treatmentCount = subjects.filter((s) => s.group === "treatment").length;
  const controlCount = subjects.length - treatmentCount;
  if (treatmentCount === 0 || controlCount === 0) {
    throw new RangeError("Both groups need at least one subject.");
  }

  const subjectWins = subjects.map(() => 0);
  const subjectLosses = subjects.map(() => 0);
  const subjectPairs = subjects.map(() => 0);
  const componentWins = components.map(() => 0);
  const componentLosses = components.map(() => 0);
  const deciding = components.map(() => new Set<number>());

  interface StratumTotals {
    readonly work: StratumWork;
    readonly wins: number;
    readonly losses: number;
    readonly pairs: number;
    readonly variance: number | null;
    readonly fsStatistic: number;
    readonly fsVariance: number;
  }
  const totals: StratumTotals[] = [];

  for (const work of strata.values()) {
    const nt = work.treatment.length;
    const nc = work.control.length;
    const rows = work.treatment.map(() => ({ k: 0, l: 0 }));
    const columns = work.control.map(() => ({ k: 0, l: 0 }));
    let wins = 0;
    let losses = 0;
    work.treatment.forEach((t, i) => {
      work.control.forEach((c, j) => {
        subjectPairs[t] += 1;
        subjectPairs[c] += 1;
        const decided = comparePair(components, outcomes[t], outcomes[c]);
        if (decided === null) return;
        deciding[decided.level].add(t).add(c);
        if (decided.result === 1) {
          wins += 1;
          rows[i].k += 1;
          columns[j].k += 1;
          componentWins[decided.level] += 1;
          subjectWins[t] += 1;
          subjectLosses[c] += 1;
        } else {
          losses += 1;
          rows[i].l += 1;
          columns[j].l += 1;
          componentLosses[decided.level] += 1;
          subjectWins[c] += 1;
          subjectLosses[t] += 1;
        }
      });
    });
    const pairs = nt * nc;

    let variance: number | null = null;
    if (nt > 1 && nc > 1) {
      const theta = (wins + losses) / (2 * pairs);
      const byRow = crossProducts(rows, nc, theta);
      const byColumn = crossProducts(columns, nt, theta);
      const sigmaWin =
        (pairs * byRow.kk) / (nc - 1) / nt +
        (pairs * byColumn.kk) / (nt - 1) / nc;
      const sigmaLoss =
        (pairs * byColumn.ll) / (nt - 1) / nc +
        (pairs * byRow.ll) / (nc - 1) / nt;
      const sigmaCross =
        (pairs * byRow.kl) / (nc - 1) / nt +
        (pairs * byColumn.kl) / (nt - 1) / nc;
      variance = sigmaWin + sigmaLoss - 2 * sigmaCross;
    }

    // Finkelstein-Schoenfeld: score every pair in the pooled stratum.
    const pooled = [...work.treatment, ...work.control];
    const scores = pooled.map(() => 0);
    for (let a = 0; a < pooled.length; a += 1) {
      for (let b = a + 1; b < pooled.length; b += 1) {
        const decided = comparePair(
          components,
          outcomes[pooled[a]],
          outcomes[pooled[b]]
        );
        if (decided === null) continue;
        scores[a] += decided.result;
        scores[b] -= decided.result;
      }
    }
    const n = pooled.length;
    const fsStatistic = scores
      .slice(0, nt)
      .reduce((sum, score) => sum + score, 0);
    const fsVariance =
      n > 1
        ? ((nt * nc) / (n * (n - 1))) *
          scores.reduce((sum, score) => sum + score * score, 0)
        : 0;

    totals.push({
      work,
      wins,
      losses,
      pairs,
      variance,
      fsStatistic,
      fsVariance,
    });
  }

  const sizes = totals.map(
    ({ work }) => work.treatment.length + work.control.length
  );
  const inverseSum = sizes.reduce((sum, size) => sum + 1 / size, 0);
  const weights = totals.map((_, index) => {
    if (weighting === "mantel-haenszel") return 1 / sizes[index] / inverseSum;
    if (weighting === "equal") return 1 / totals.length;
    return 1;
  });

  const weightedPairs = totals.reduce(
    (sum, stratum, index) => sum + weights[index] * stratum.pairs,
    0
  );
  const weightedWins = totals.reduce(
    (sum, stratum, index) => sum + weights[index] * stratum.wins,
    0
  );
  const weightedLosses = totals.reduce(
    (sum, stratum, index) => sum + weights[index] * stratum.losses,
    0
  );
  const pWin = weightedWins / weightedPairs;
  const pLoss = weightedLosses / weightedPairs;
  const pTie = 1 - pWin - pLoss;

  const varianceKnown = totals.every((stratum) => stratum.variance !== null);
  const weightedVariance = varianceKnown
    ? totals.reduce(
        (sum, stratum, index) =>
          sum + weights[index] * weights[index] * (stratum.variance ?? 0),
        0
      )
    : null;
  const weightedTheta = totals.reduce(
    (sum, stratum, index) =>
      sum + (weights[index] * (stratum.wins + stratum.losses)) / 2,
    0
  );
  const weightedGamma = totals.reduce(
    (sum, stratum, index) => sum + (weights[index] * stratum.pairs) / 2,
    0
  );
  const quantile = normalQuantile(1 - alpha / 2);

  const winRatioValue =
    weightedLosses > 0 ? weightedWins / weightedLosses : NaN;
  const winRatio =
    weightedVariance === null || weightedTheta === 0
      ? {
          ...NOT_ESTIMABLE,
          estimate: Number.isFinite(winRatioValue) ? winRatioValue : null,
        }
      : logScaleEstimate(
          winRatioValue,
          weightedVariance / (weightedTheta * weightedTheta),
          quantile,
          sided
        );

  const winOddsValue = (pWin + pTie / 2) / (pLoss + pTie / 2);
  const winOdds =
    weightedVariance === null
      ? { ...NOT_ESTIMABLE, estimate: winOddsValue }
      : logScaleEstimate(
          winOddsValue,
          weightedVariance *
            (0.5 / weightedGamma + 0.5 / (weightedPairs - weightedGamma)) ** 2,
          quantile,
          sided
        );

  const netBenefitValue = pWin - pLoss;
  let netBenefit: WinStatisticEstimate = {
    ...NOT_ESTIMABLE,
    estimate: netBenefitValue,
  };
  if (weightedVariance !== null && weightedVariance > 0) {
    const se = Math.sqrt(weightedVariance) / weightedPairs;
    const z = netBenefitValue / se;
    netBenefit = {
      estimate: netBenefitValue,
      lower: Math.max(-1, netBenefitValue - quantile * se),
      upper: Math.min(1, netBenefitValue + quantile * se),
      standardError: se,
      zStatistic: z,
      pValue: normalPValue(z, sided),
    };
  }

  const fsStatistic = totals.reduce((sum, s) => sum + s.fsStatistic, 0);
  const fsVariance = totals.reduce((sum, s) => sum + s.fsVariance, 0);
  const fsZ = fsVariance > 0 ? fsStatistic / Math.sqrt(fsVariance) : null;
  const finkelsteinSchoenfeld: FinkelsteinSchoenfeldTest = {
    statistic: fsStatistic,
    variance: fsVariance,
    zStatistic: fsZ,
    pValue: fsZ === null ? null : normalPValue(fsZ, sided),
  };

  const pairs = totals.reduce((sum, s) => sum + s.pairs, 0);
  const wins = totals.reduce((sum, s) => sum + s.wins, 0);
  const losses = totals.reduce((sum, s) => sum + s.losses, 0);

  let undecided = pairs;
  const componentResults: WinRatioComponentResult[] = components.map(
    (component, level) => {
      undecided -= componentWins[level] + componentLosses[level];
      return {
        componentId: component.id,
        wins: componentWins[level],
        losses: componentLosses[level],
        tiesAfter: undecided,
        decidingSubjectIds: [...deciding[level]]
          .sort((a, b) => a - b)
          .map((index) => subjects[index].id),
      };
    }
  );

  const strataResults: WinRatioStratumResult[] = totals.map(
    (stratum, index) => ({
      stratum: stratum.work.label,
      treatmentCount: stratum.work.treatment.length,
      controlCount: stratum.work.control.length,
      pairs: stratum.pairs,
      wins: stratum.wins,
      losses: stratum.losses,
      ties: stratum.pairs - stratum.wins - stratum.losses,
      weight: weights[index],
    })
  );

  const subjectResults: WinRatioSubjectResult[] = subjects.map(
    (subject, index) => ({
      id: subject.id,
      group: subject.group,
      wins: subjectWins[index],
      losses: subjectLosses[index],
      ties: subjectPairs[index] - subjectWins[index] - subjectLosses[index],
    })
  );

  return {
    treatmentCount,
    controlCount,
    pairs,
    wins,
    losses,
    ties: pairs - wins - losses,
    components: componentResults,
    strata: strataResults,
    subjects: subjectResults,
    winRatio,
    netBenefit,
    winOdds,
    finkelsteinSchoenfeld,
    settings: { weighting, alpha, sided },
  };
}
