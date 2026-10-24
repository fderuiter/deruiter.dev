/**
 * Descriptive statistics and the display precision rules for the tables.
 *
 * Values are scaled to integers at the data's own precision before they are
 * summed, so the mean and median are each one correctly rounded division of
 * exact integers. A mean that is exactly half way between two display
 * values therefore rounds the same way on every platform.
 */
import type { DescriptiveStatistics } from "../../types";

/** The most decimal places {@link inferDecimalPlaces} reports. */
export const MAX_RAW_DECIMALS = 6;

/**
 * How many decimals each statistic is shown with, relative to the data:
 * counts as integers, minimum and maximum as the data, mean and median one
 * more, SD two more, and percentages to one decimal whatever the data.
 */
export const STATISTIC_PRECISION = Object.freeze({
  n: { relativeTo: "integer", decimals: 0 },
  min: { relativeTo: "data", decimals: 0 },
  max: { relativeTo: "data", decimals: 0 },
  mean: { relativeTo: "data", decimals: 1 },
  median: { relativeTo: "data", decimals: 1 },
  sd: { relativeTo: "data", decimals: 2 },
  percent: { relativeTo: "fixed", decimals: 1 },
} as const);

/** The statistics {@link STATISTIC_PRECISION} has a rule for. */
export type StatisticKind = keyof typeof STATISTIC_PRECISION;

/**
 * The number of decimal places a value is recorded with, read from its
 * shortest round-trip decimal form: `141.1` has one, `146` none. The result
 * is capped at {@link MAX_RAW_DECIMALS}, so floating-point noise such as
 * `0.30000000000000004` cannot ask for seventeen decimals.
 *
 * @param values - The recorded values. Non-finite values are ignored.
 * @returns The largest number of decimals among the values, 0 when empty.
 */
export function inferDecimalPlaces(values: readonly number[]): number {
  let decimals = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    const text = String(Math.abs(value));
    const exponent = /e([+-]\d+)$/.exec(text);
    const mantissa = exponent ? text.slice(0, exponent.index) : text;
    const point = mantissa.indexOf(".");
    const fraction = point === -1 ? 0 : mantissa.length - point - 1;
    const places = fraction - (exponent ? Number(exponent[1]) : 0);
    const capped = places > MAX_RAW_DECIMALS ? MAX_RAW_DECIMALS : places;
    if (capped > decimals) decimals = capped;
  }
  return decimals;
}

/**
 * Rounds half away from zero and prints exactly `decimals` decimals, with no
 * exponent and no negative zero.
 *
 * `toFixed` rounds the binary value, so `(1.005).toFixed(2)` is `"1.00"`.
 * This rounds the shortest decimal form instead, the way the value reads:
 * `formatDecimal(1.005, 2)` is `"1.01"` and `formatDecimal(-2.5, 0)` is
 * `"-3"`. A value that rounds to zero prints without a sign.
 *
 * @param value - A finite number.
 * @param decimals - Decimal places, an integer from 0 to 20.
 * @throws RangeError when the value is not finite or `decimals` is out of range.
 */
export function formatDecimal(value: number, decimals: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Cannot format ${value} as a decimal.`);
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 20) {
    throw new RangeError(
      `decimals must be an integer from 0 to 20, got ${decimals}.`
    );
  }
  const magnitude = Math.abs(value);
  const text = String(magnitude);
  const shifted = text.includes("e")
    ? magnitude * 10 ** decimals
    : Number(`${text}e${decimals}`);
  const rounded = Math.round(shifted);
  if (!Number.isSafeInteger(rounded)) {
    const fixed = magnitude.toFixed(decimals);
    return value < 0 && Number(fixed) !== 0 ? `-${fixed}` : fixed;
  }
  const digits = String(rounded).padStart(decimals + 1, "0");
  const body =
    decimals === 0
      ? digits
      : `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`;
  return value < 0 && rounded !== 0 ? `-${body}` : body;
}

/**
 * The percentage `count / denominator`, to one decimal, rounded half away
 * from zero. The percentage is one division of the two integers, so
 * `formatPercent(1, 8)` is exactly `"12.5"` and `formatPercent(1, 80)` is
 * `"1.3"`.
 *
 * @returns The percentage, or `null` when the denominator is zero.
 * @throws RangeError when either argument is not a non-negative integer.
 */
export function formatPercent(
  count: number,
  denominator: number
): string | null {
  for (const [name, value] of [
    ["count", count],
    ["denominator", denominator],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(
        `${name} must be a non-negative integer, got ${value}.`
      );
    }
  }
  if (denominator === 0) return null;
  return formatDecimal(
    (count * 100) / denominator,
    STATISTIC_PRECISION.percent.decimals
  );
}

/**
 * The display decimals for one statistic when the data has `rawDecimals`,
 * following {@link STATISTIC_PRECISION}.
 */
export function statisticDecimals(
  kind: StatisticKind,
  rawDecimals: number
): number {
  const rule = STATISTIC_PRECISION[kind];
  return rule.relativeTo === "data"
    ? rawDecimals + rule.decimals
    : rule.decimals;
}

/**
 * n, mean, SD, median, minimum and maximum of some values.
 *
 * The SD is the sample SD, with the n - 1 denominator, and is `null` when
 * there are fewer than two values. The median of an even count is the mean
 * of the two middle values. Every statistic except n is `null` when there
 * are no values.
 *
 * @param values - Finite numbers, in any order.
 * @param rawDecimals - Decimals the values are recorded with. Inferred with
 *   {@link inferDecimalPlaces} when omitted. Values are rounded to this
 *   precision before the statistics are computed.
 * @throws RangeError when a value is not finite or `rawDecimals` is not an
 *   integer from 0 to {@link MAX_RAW_DECIMALS}.
 */
export function descriptiveStatistics(
  values: readonly number[],
  rawDecimals: number = inferDecimalPlaces(values)
): DescriptiveStatistics {
  if (
    !Number.isInteger(rawDecimals) ||
    rawDecimals < 0 ||
    rawDecimals > MAX_RAW_DECIMALS
  ) {
    throw new RangeError(
      `rawDecimals must be an integer from 0 to ${MAX_RAW_DECIMALS}, got ${rawDecimals}.`
    );
  }
  const scale = 10 ** rawDecimals;
  const scaled = values.map((value) => {
    if (!Number.isFinite(value)) {
      throw new RangeError(`Statistics need finite values, got ${value}.`);
    }
    return Math.round(value * scale);
  });
  const n = scaled.length;
  if (n === 0) {
    return {
      n,
      rawDecimals,
      mean: null,
      sd: null,
      median: null,
      min: null,
      max: null,
    };
  }
  const sorted = [...scaled].sort((a, b) => a - b);
  let sum = BigInt(0);
  let sumOfSquares = BigInt(0);
  for (const value of scaled) {
    const big = BigInt(value);
    sum += big;
    sumOfSquares += big * big;
  }
  const count = BigInt(n);
  const middle = Math.floor(n / 2);
  const median =
    n % 2 === 1
      ? sorted[middle] / scale
      : (sorted[middle - 1] + sorted[middle]) / (2 * scale);
  const sd =
    n < 2
      ? null
      : Math.sqrt(
          Number(count * sumOfSquares - sum * sum) /
            (n * (n - 1) * scale * scale)
        );
  return {
    n,
    rawDecimals,
    mean: Number(sum) / (n * scale),
    sd,
    median,
    min: sorted[0] / scale,
    max: sorted[n - 1] / scale,
  };
}
