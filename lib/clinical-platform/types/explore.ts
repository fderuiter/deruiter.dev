/**
 * Clinical Data Platform: self-service explorer, shareable link and promotion
 * step types.
 */
import type {
  MetricDimensionId,
  MetricFilter,
  ReportData,
  ReportSpec,
  ReportVisual,
} from "./platform";

/**
 * A self-service exploration (#2634): one governed metric, the dimensions it
 * is grouped by, the filters on it and how it is drawn. An exploration is
 * an exploratory report spec in the making; it is saved in the URL, never
 * on a server.
 */
export interface Exploration {
  /** Registry metric id. */
  readonly metricId: string;
  /** Dimensions grouped by, in row order; at most two. */
  readonly dimensions: readonly MetricDimensionId[];
  /**
   * Filters, one per dimension, in dimension order. A filter replaces the
   * metric's default filter on the same dimension.
   */
  readonly filters: readonly MetricFilter[];
  /** The visual chosen; `null` draws the one the explorer suggests. */
  readonly visual: ReportVisual | null;
}

/** What can change in an exploration next without breaking it. */
export interface ExplorationChoices {
  /** Dimensions that can be added to the grouping, in dimension order. */
  readonly addDimensions: readonly MetricDimensionId[];
  /** Grouped dimensions that can be removed; a study grain metric keeps `study`. */
  readonly removeDimensions: readonly MetricDimensionId[];
  /** Dimensions the metric may be filtered by, in dimension order. */
  readonly filterDimensions: readonly MetricDimensionId[];
  /** Visuals that fit the grouping, in `EXPLORER_VISUALS` order. */
  readonly visuals: readonly ReportVisual[];
}

/** A finding that stops an exploration from running, in words a visitor can act on. */
export interface ExplorationFinding {
  /** Which part of the exploration is wrong. */
  readonly field: "metric" | "dimensions" | "filters" | "visual";
  /** What is wrong. */
  readonly message: string;
}

/** An exploration run over one warehouse, ready to render. */
export interface ExplorationResult {
  /** The exploration, normalized: filters in dimension order, values sorted. */
  readonly exploration: Exploration;
  /** The exploratory report spec the exploration builds. */
  readonly spec: ReportSpec;
  /** The visual the explorer suggests for the data's shape. */
  readonly suggestedVisual: ReportVisual;
  /** The report, drawn with the chosen visual or else the suggested one. */
  readonly report: ReportData;
  /** What can change next. */
  readonly choices: ExplorationChoices;
  /** The metric's default filters in force: those the exploration does not replace. */
  readonly defaultFilters: readonly MetricFilter[];
  /** The metric's default filters the exploration's own filters replace. */
  readonly replacedDefaults: readonly MetricFilter[];
  /** Values each filterable dimension takes in the warehouse, sorted. */
  readonly filterValues: Readonly<
    Partial<Record<MetricDimensionId, readonly string[]>>
  >;
}

/** The outcome of reading an exploration from a URL hash. */
export type ExplorationDecoding =
  | { readonly ok: true; readonly exploration: Exploration }
  | { readonly ok: false; readonly error: string };

/** One step of promoting an exploration to a higher report tier. */
export interface PromotionStep {
  /** Stable step id in kebab case. */
  readonly id: string;
  /** Tier the step is needed for. */
  readonly tier: "managed" | "certified";
  /** What the step asks for, in one sentence. */
  readonly label: string;
  /** Why it is met, or what is still to do. */
  readonly detail: string;
  /**
   * `met` when the spec already satisfies it; `to-do` when a person has to
   * act, such as naming an owner or signing off.
   */
  readonly status: "met" | "to-do";
}
