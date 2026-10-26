/**
 * Distribution functions and multiple-testing control for central
 * statistical monitoring (#2631). Pure numerics with no dependency: the log
 * gamma function by the Lanczos approximation, the regularized incomplete
 * gamma and beta functions by series and continued fractions (Press et al.,
 * Numerical Recipes, 3rd ed., sections 6.1, 6.2 and 6.4), and the
 * Benjamini-Hochberg step-up procedure (J. R. Stat. Soc. B 57, 1995).
 *
 * Every function defends its domain: an argument outside it throws rather
 * than returning `NaN`, so a bad input is found where it enters.
 */

const MAX_ITERATIONS = 500;
const EPSILON = 1e-14;
const TINY = 1e-300;

/** Lanczos coefficients for g = 7, n = 9. */
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

function requireFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number, got ${value}`);
  }
}

function requirePositive(name: string, value: number): void {
  requireFinite(name, value);
  if (value <= 0)
    throw new RangeError(`${name} must be positive, got ${value}`);
}

/**
 * Natural logarithm of the gamma function.
 *
 * @param x - A positive number.
 * @returns ln Γ(x).
 * @throws RangeError when `x` is not a positive finite number.
 */
export function logGamma(x: number): number {
  requirePositive("x", x);
  if (x < 0.5) {
    // Reflection: Γ(x) Γ(1 − x) = π / sin(πx).
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const z = x - 1;
  let sum = LANCZOS[0];
  for (let i = 1; i < LANCZOS.length; i += 1) sum += LANCZOS[i] / (z + i);
  const t = z + 7.5;
  return (
    0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum)
  );
}

/**
 * Regularized lower incomplete gamma function P(a, x).
 *
 * @param a - Shape, positive.
 * @param x - Upper limit of integration, zero or more.
 * @returns P(a, x), between 0 and 1.
 * @throws RangeError when an argument is outside its domain.
 */
export function regularizedGammaP(a: number, x: number): number {
  requirePositive("a", a);
  requireFinite("x", x);
  if (x < 0) throw new RangeError(`x must be zero or more, got ${x}`);
  if (x === 0) return 0;
  const front = Math.exp(-x + a * Math.log(x) - logGamma(a));
  if (x < a + 1) {
    // Series: P(a, x) = e^−x x^a / Γ(a) · Σ x^n / (a (a+1) … (a+n)).
    let term = 1 / a;
    let sum = term;
    for (let n = 1; n < MAX_ITERATIONS; n += 1) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * EPSILON) break;
    }
    return Math.min(1, sum * front);
  }
  // Continued fraction for Q(a, x) by the modified Lentz method.
  let b = x + 1 - a;
  let c = 1 / TINY;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < MAX_ITERATIONS; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < EPSILON) break;
  }
  return Math.max(0, 1 - front * h);
}

/** Continued fraction for the incomplete beta function (modified Lentz). */
function betaFraction(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m < MAX_ITERATIONS; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < EPSILON) break;
  }
  return h;
}

/**
 * Regularized incomplete beta function I_x(a, b).
 *
 * @param x - Between 0 and 1.
 * @param a - Positive.
 * @param b - Positive.
 * @returns I_x(a, b), between 0 and 1.
 * @throws RangeError when an argument is outside its domain.
 */
export function regularizedBeta(x: number, a: number, b: number): number {
  requirePositive("a", a);
  requirePositive("b", b);
  requireFinite("x", x);
  if (x < 0 || x > 1) throw new RangeError(`x must be in [0, 1], got ${x}`);
  if (x === 0 || x === 1) return x;
  const front = Math.exp(
    logGamma(a + b) -
      logGamma(a) -
      logGamma(b) +
      a * Math.log(x) +
      b * Math.log(1 - x)
  );
  // The fraction converges fast for x below (a + 1) / (a + b + 2); use the
  // symmetry I_x(a, b) = 1 − I_(1−x)(b, a) above it.
  if (x < (a + 1) / (a + b + 2)) return (front * betaFraction(a, b, x)) / a;
  return 1 - (front * betaFraction(b, a, 1 - x)) / b;
}

/**
 * Cumulative distribution function of the Poisson distribution.
 *
 * @param k - Count; a negative count has probability 0.
 * @param mean - Mean, zero or more.
 * @returns P(X ≤ k).
 */
export function poissonCdf(k: number, mean: number): number {
  requireFinite("mean", mean);
  requireFinite("k", k);
  if (mean < 0) throw new RangeError(`mean must be zero or more, got ${mean}`);
  if (k < 0) return 0;
  if (mean === 0) return 1;
  // P(X ≤ k) = Q(k + 1, mean).
  return 1 - regularizedGammaP(Math.floor(k) + 1, mean);
}

/**
 * Cumulative distribution function of the chi-square distribution.
 *
 * @param x - Value, zero or more.
 * @param df - Degrees of freedom, positive.
 * @returns P(X ≤ x).
 */
export function chiSquareCdf(x: number, df: number): number {
  requirePositive("df", df);
  requireFinite("x", x);
  if (x <= 0) return 0;
  // A chi-square with df degrees of freedom is a gamma(df / 2, 2).
  return regularizedGammaP(df / 2, x / 2);
}

/**
 * Cumulative distribution function of the F distribution.
 *
 * @param x - Value, zero or more.
 * @param df1 - Numerator degrees of freedom, positive.
 * @param df2 - Denominator degrees of freedom, positive.
 * @returns P(X ≤ x).
 */
export function fCdf(x: number, df1: number, df2: number): number {
  requirePositive("df1", df1);
  requirePositive("df2", df2);
  requireFinite("x", x);
  if (x <= 0) return 0;
  return regularizedBeta((df1 * x) / (df1 * x + df2), df1 / 2, df2 / 2);
}

/**
 * Benjamini-Hochberg adjusted p-values (q-values). A hypothesis is rejected
 * at false discovery rate `q` exactly when its adjusted value is at most `q`.
 *
 * @param pValues - p-values, each between 0 and 1.
 * @returns Adjusted values in the input order, each between 0 and 1.
 * @throws RangeError when a p-value is outside [0, 1].
 */
export function benjaminiHochberg(pValues: readonly number[]): number[] {
  for (const p of pValues) {
    requireFinite("p", p);
    if (p < 0 || p > 1) throw new RangeError(`p must be in [0, 1], got ${p}`);
  }
  const m = pValues.length;
  const order = pValues
    .map((p, index) => ({ p, index }))
    .sort((a, b) => a.p - b.p || a.index - b.index);
  const adjusted = new Array<number>(m);
  let running = 1;
  for (let rank = m; rank >= 1; rank -= 1) {
    const { p, index } = order[rank - 1];
    running = Math.min(running, (p * m) / rank);
    adjusted[index] = running;
  }
  return adjusted;
}

/**
 * Inverse of a small symmetric positive-definite matrix by Gauss-Jordan
 * elimination with partial pivoting.
 *
 * @param matrix - Square matrix, as rows.
 * @returns The inverse, or `null` when the matrix is singular to working precision.
 */
export function invertMatrix(
  matrix: readonly (readonly number[])[]
): number[][] | null {
  const n = matrix.length;
  const work = matrix.map((row, i) => {
    if (row.length !== n) throw new RangeError("the matrix must be square");
    return [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))];
  });
  const scale = Math.max(1, ...matrix.flat().map(Math.abs));
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(work[row][col]) > Math.abs(work[pivot][col])) pivot = row;
    }
    if (Math.abs(work[pivot][col]) < 1e-12 * scale) return null;
    [work[col], work[pivot]] = [work[pivot], work[col]];
    const lead = work[col][col];
    for (let j = 0; j < 2 * n; j += 1) work[col][j] /= lead;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = work[row][col];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j += 1) work[row][j] -= factor * work[col][j];
    }
  }
  return work.map((row) => row.slice(n));
}

/** Arithmetic mean; `null` for no values. */
export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
