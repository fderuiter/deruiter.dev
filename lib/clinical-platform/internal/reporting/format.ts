/**
 * Displays metric values with the format their definition declares, so a
 * report, a tooltip and a table show the same number the same way.
 */
import type { MetricDefinition } from "../../types";

/** Shown in place of a value a metric does not have, such as a zero denominator. */
export const NO_METRIC_VALUE = "No value";

/**
 * Shown in a report cell when the metric has no rows for the group at all,
 * for example a backlog metric that leaves closed studies out.
 */
export const NO_METRIC_ROWS = "No rows";

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(
  style: MetricDefinition["format"]["style"],
  decimals: number
): Intl.NumberFormat {
  const key = `${style}:${decimals}`;
  let found = formatters.get(key);
  if (!found) {
    found = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      ...(style === "currency" ? { style: "currency", currency: "USD" } : {}),
    });
    formatters.set(key, found);
  }
  return found;
}

/**
 * A metric value as displayed: a `percent` fraction times 100 with a
 * percent sign, a `currency` value in US dollars, a `number` as it is, each
 * to the definition's decimal places with US digit grouping.
 *
 * @param metric - The metric the value belongs to.
 * @param value - The value, or `null` when the metric has none.
 * @returns The display text; {@link NO_METRIC_VALUE} for `null` or a value
 *   that is not finite.
 */
export function formatMetricValue(
  metric: Pick<MetricDefinition, "format">,
  value: number | null
): string {
  if (value === null || !Number.isFinite(value)) return NO_METRIC_VALUE;
  const { style, decimals } = metric.format;
  if (style === "percent") {
    return `${formatter("number", decimals).format(value * 100)}%`;
  }
  return formatter(style, decimals).format(value);
}
