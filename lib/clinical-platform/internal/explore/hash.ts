/**
 * An exploration saved in the URL hash (#2634), so it can be shared as a
 * link with nothing stored on a server. The hash is a query string:
 *
 * `metric=open_query_count&by=study&by=site&in.region=Europe&visual=table`
 *
 * `by` repeats once per grouped dimension, in order; `in.<dimension>` keeps
 * the values listed and `out.<dimension>` drops them, one parameter per
 * value. A link is read strictly: anything unknown or not allowed is an
 * error the page shows, never a guess.
 */
import type {
  Exploration,
  ExplorationDecoding,
  MetricDefinition,
  MetricDimensionId,
  MetricFilter,
  ReportVisual,
} from "../../types";
import { METRIC_DIMENSIONS } from "../semantic/dimensions";
import { METRIC_REGISTRY } from "../semantic/registry";
import {
  EXPLORER_VISUALS,
  checkExploration,
  normalizeExploration,
} from "./model";

/** Longest hash the explorer reads. A real exploration is a few hundred characters. */
export const EXPLORATION_HASH_MAX_LENGTH = 4000;

const DIMENSION_IDS = new Set<string>(METRIC_DIMENSIONS.map((d) => d.id));

const OPERATORS: Readonly<Record<string, MetricFilter["operator"]>> = {
  in: "in",
  out: "not-in",
};

/**
 * Writes an exploration as a URL hash, without the leading `#`. The
 * exploration is normalized first, so equal explorations give equal links.
 *
 * @param exploration - The exploration.
 * @returns The hash.
 */
export function encodeExploration(exploration: Exploration): string {
  const normalized = normalizeExploration(exploration);
  const params = new URLSearchParams();
  params.append("metric", normalized.metricId);
  for (const id of normalized.dimensions) params.append("by", id);
  for (const filter of normalized.filters) {
    const key = `${filter.operator === "in" ? "in" : "out"}.${filter.dimension}`;
    for (const value of filter.values) params.append(key, value);
  }
  if (normalized.visual !== null) params.append("visual", normalized.visual);
  return params.toString();
}

/**
 * Reads an exploration from a URL hash, with or without the leading `#`.
 *
 * @param hash - The hash.
 * @param metrics - The registry; defaults to `METRIC_REGISTRY`.
 * @returns The normalized exploration, or why the hash cannot be read.
 */
export function decodeExploration(
  hash: string,
  metrics: readonly MetricDefinition[] = METRIC_REGISTRY
): ExplorationDecoding {
  const text = hash.startsWith("#") ? hash.slice(1) : hash;
  if (text.length > EXPLORATION_HASH_MAX_LENGTH) {
    return {
      ok: false,
      error: `The link is longer than ${EXPLORATION_HASH_MAX_LENGTH} characters, so the explorer did not read it.`,
    };
  }
  const params = new URLSearchParams(text);
  const metricIds = params.getAll("metric");
  if (metricIds.length !== 1 || metricIds[0] === "") {
    return { ok: false, error: "The link must name exactly one metric." };
  }
  const dimensions: MetricDimensionId[] = [];
  const filters = new Map<
    MetricDimensionId,
    { operator: MetricFilter["operator"]; values: string[] }
  >();
  let visual: ReportVisual | null = null;
  for (const [key, value] of params) {
    if (key === "metric") continue;
    if (key === "by") {
      if (!DIMENSION_IDS.has(value)) {
        return {
          ok: false,
          error: `The link groups by ${value}, which is not a dimension.`,
        };
      }
      dimensions.push(value as MetricDimensionId);
      continue;
    }
    if (key === "visual") {
      if (visual !== null) {
        return { ok: false, error: "The link names more than one visual." };
      }
      if (!(EXPLORER_VISUALS as readonly string[]).includes(value)) {
        return {
          ok: false,
          error: `The link asks for a ${value} visual, which the explorer does not draw.`,
        };
      }
      visual = value as ReportVisual;
      continue;
    }
    const [prefix, dimension, ...rest] = key.split(".");
    const operator = OPERATORS[prefix];
    if (operator === undefined || rest.length > 0 || dimension === undefined) {
      return {
        ok: false,
        error: `The link has a part the explorer does not know: ${key}.`,
      };
    }
    if (!DIMENSION_IDS.has(dimension)) {
      return {
        ok: false,
        error: `The link filters by ${dimension}, which is not a dimension.`,
      };
    }
    if (value === "") {
      return {
        ok: false,
        error: `The link's ${dimension} filter has an empty value.`,
      };
    }
    const id = dimension as MetricDimensionId;
    const existing = filters.get(id);
    if (existing !== undefined && existing.operator !== operator) {
      return {
        ok: false,
        error: `The link both keeps and drops values of ${dimension}.`,
      };
    }
    filters.set(id, {
      operator,
      values: [...(existing?.values ?? []), value],
    });
  }
  const exploration = normalizeExploration({
    metricId: metricIds[0],
    dimensions,
    filters: [...filters].map(([dimension, filter]) => ({
      dimension,
      operator: filter.operator,
      values: filter.values,
    })),
    visual,
  });
  const findings = checkExploration(exploration, metrics);
  if (findings.length > 0) {
    return {
      ok: false,
      error: findings.map((finding) => finding.message).join(" "),
    };
  }
  return { ok: true, exploration };
}
