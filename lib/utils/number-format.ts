/**
 * Centralized, locale-pinned number formatting primitives.
 *
 * Every helper defaults to the `"en-US"` locale rather than the runtime
 * default, so server-rendered and client-rendered output are byte-identical
 * and React hydration never sees a mismatched separator.
 */

/** Locale used by every number formatter unless a caller overrides it. */
export const DEFAULT_NUMBER_LOCALE = "en-US";

/** Placeholder rendered for `NaN`, `Infinity`, `null` or `undefined` input. */
export const NUMBER_FALLBACK = "—";

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(
  locale: string,
  options: Intl.NumberFormatOptions
): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    formatterCache.set(key, formatter);
  }
  return formatter;
}

function formatFinite(
  value: number,
  locale: string,
  options: Intl.NumberFormatOptions
): string {
  const formatter = getFormatter(locale, options);
  const formatted = formatter.format(value);
  // A negative value that rounds to zero ("-0.00") renders as plain zero.
  if (value < 0 || Object.is(value, -0)) {
    const zero = formatter.format(0);
    if (formatter.format(Math.abs(value)) === zero) return zero;
  }
  return formatted;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clampDecimals(decimals: number): number {
  if (!Number.isFinite(decimals) || decimals < 0) return 0;
  return Math.min(Math.floor(decimals), 20);
}

/**
 * Formats a number with `Intl.NumberFormat`, pinned to `"en-US"` by default.
 *
 * Passing a number as `options` is shorthand for a fixed number of decimal
 * places without digit grouping, the drop-in replacement for
 * `value.toFixed(decimals)`. It rounds on the decimal representation, so
 * `formatNumber(1.005, 2)` yields `"1.01"` where `toFixed` yields `"1.00"`,
 * and a negative value that rounds to zero renders without a minus sign.
 * Passing an options object uses `Intl.NumberFormat` defaults, including
 * digit grouping (`formatNumber(12345)` yields `"12,345"`).
 *
 * @param value - The number to format.
 * @param options - Fixed decimal places, or `Intl.NumberFormat` options.
 * @param locale - BCP 47 locale tag. Defaults to `"en-US"`.
 * @returns The formatted string, or an em dash for non-finite input.
 */
export function formatNumber(
  value: number | null | undefined,
  options?: number | Intl.NumberFormatOptions,
  locale: string = DEFAULT_NUMBER_LOCALE
): string {
  if (!isFiniteNumber(value)) return NUMBER_FALLBACK;
  const resolved: Intl.NumberFormatOptions =
    typeof options === "number"
      ? {
          minimumFractionDigits: clampDecimals(options),
          maximumFractionDigits: clampDecimals(options),
          useGrouping: false,
        }
      : (options ?? {});
  return formatFinite(value, locale, resolved);
}

/** Options accepted by {@link formatPercent}. */
export interface FormatPercentOptions {
  /** Fixed decimal places. Defaults to `0`. */
  decimals?: number;
  /**
   * Scale of the input: `"fraction"` (default) treats `0.5` as 50%, and
   * `"whole"` treats `50` as 50%.
   */
  scale?: "fraction" | "whole";
  /** BCP 47 locale tag. Defaults to `"en-US"`. */
  locale?: string;
}

/**
 * Formats a ratio as a percentage, e.g. `formatPercent(0.853, { decimals: 1 })`
 * yields `"85.3%"` and `formatPercent(42, { scale: "whole" })` yields `"42%"`.
 *
 * @param value - The ratio (fraction scale) or percentage (whole scale).
 * @param options - Decimal places, input scale and locale.
 * @returns The formatted percentage, or an em dash for non-finite input.
 */
export function formatPercent(
  value: number | null | undefined,
  options: FormatPercentOptions = {}
): string {
  if (!isFiniteNumber(value)) return NUMBER_FALLBACK;
  const {
    decimals = 0,
    scale = "fraction",
    locale = DEFAULT_NUMBER_LOCALE,
  } = options;
  const digits = clampDecimals(decimals);
  const ratio = scale === "whole" ? value / 100 : value;
  return formatFinite(ratio, locale, {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  });
}

/** Binary byte units used by {@link formatBytes}, in ascending order. */
export type ByteUnit = "B" | "KB" | "MB" | "GB" | "TB";

const BYTE_UNITS: readonly ByteUnit[] = ["B", "KB", "MB", "GB", "TB"];

/** Options accepted by {@link formatBytes}. */
export interface FormatBytesOptions {
  /** Maximum decimal places. Defaults to `1`. */
  decimals?: number;
  /** Pin the output to one unit instead of choosing the largest that fits. */
  unit?: ByteUnit;
  /**
   * Drop trailing zeros (`"2 KB"` rather than `"2.0 KB"`). Defaults to `true`.
   */
  trimZeros?: boolean;
  /** BCP 47 locale tag. Defaults to `"en-US"`. */
  locale?: string;
}

/**
 * Formats a byte count with binary (1024-based) units, e.g.
 * `formatBytes(1536)` yields `"1.5 KB"` and
 * `formatBytes(2621440, { unit: "MB", decimals: 2, trimZeros: false })`
 * yields `"2.50 MB"`. Zero, negative and non-finite input yields `"0 B"`.
 *
 * @param bytes - The raw byte count.
 * @param options - Decimal places, pinned unit, zero trimming and locale.
 * @returns The human-readable size.
 */
export function formatBytes(
  bytes: number | null | undefined,
  options: FormatBytesOptions = {}
): string {
  const {
    decimals = 1,
    unit,
    trimZeros = true,
    locale = DEFAULT_NUMBER_LOCALE,
  } = options;
  const digits = clampDecimals(decimals);
  const safeBytes = isFiniteNumber(bytes) && bytes > 0 ? bytes : 0;

  let index = unit ? BYTE_UNITS.indexOf(unit) : 0;
  if (!unit && safeBytes > 0) {
    index = Math.min(
      Math.max(Math.floor(Math.log(safeBytes) / Math.log(1024)), 0),
      BYTE_UNITS.length - 1
    );
  }

  if (safeBytes === 0 && !unit) return "0 B";

  const amount = formatFinite(safeBytes / Math.pow(1024, index), locale, {
    minimumFractionDigits: trimZeros ? 0 : digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  });
  return `${amount} ${BYTE_UNITS[index]}`;
}
