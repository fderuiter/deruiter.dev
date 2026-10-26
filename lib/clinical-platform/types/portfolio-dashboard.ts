/**
 * Clinical Data Platform: the /platform/portfolio dashboard types (#2632).
 */
import type { MilestoneKind, ReportData } from "./platform";
import type { OperationsMilestone } from "./reporting";

/**
 * Where a milestone stands against its plan at the data cut (#2911):
 *
 * - `on-time`: reached on or before its planned date;
 * - `late`: reached after its planned date;
 * - `overdue`: not reached, and its planned date is before the data cut;
 * - `upcoming`: not reached, and its planned date is on or after the data cut.
 *
 * A late or overdue milestone has slipped.
 */
export type PortfolioMilestoneStatus =
  "on-time" | "late" | "overdue" | "upcoming";

/** One milestone of a study's lane, planned against actual (#2911). */
export interface PortfolioMilestone extends OperationsMilestone {
  readonly kind: MilestoneKind;
  readonly status: PortfolioMilestoneStatus;
  /** Days from the planned date to the data cut for an overdue milestone; `null` otherwise. */
  readonly overdueDays: number | null;
}

/** One study's lane of the milestone swimlane (#2911). */
export interface PortfolioLane {
  readonly studyId: string;
  readonly title: string;
  /** Study status at the data cut, for example `enrolling`. */
  readonly status: string;
  /** `drug`, `biologic` or `device`. */
  readonly productType: string;
  /** `sponsor` or `cro`. */
  readonly operatingModel: string;
  /** The study's milestones, in milestone order. */
  readonly milestones: readonly PortfolioMilestone[];
  /** How many of its milestones are late or overdue. */
  readonly slipped: number;
}

/** The milestone swimlane: one lane per study on one time axis (#2911). */
export interface PortfolioSwimlane {
  /** ISO 8601 first day of the axis: the earliest planned or actual milestone, at the start of its month. */
  readonly from: string;
  /** ISO 8601 last day of the axis: the first day of the month after the latest milestone. */
  readonly to: string;
  /** First day of each year on the axis, for gridlines. */
  readonly years: readonly string[];
  /** The milestone kinds in lifecycle order, with their conformed names from `gold.dim_milestone`. */
  readonly kinds: readonly {
    readonly kind: MilestoneKind;
    readonly name: string;
  }[];
  /** One lane per study, in study id order. */
  readonly lanes: readonly PortfolioLane[];
}

/** A study furthest from the portfolio median of a cycle time (#2911). */
export interface PortfolioOutlier {
  readonly studyId: string;
  readonly value: number;
  /** The value with the metric's format. */
  readonly text: string;
  /** Value minus the median; positive is slower than the median. */
  readonly fromMedian: number;
  /** How far from the median, as a positive number with one decimal. */
  readonly fromMedianText: string;
  /**
   * Whether the value lies beyond Tukey's fences, more than 1.5 times the
   * interquartile range below the lower quartile or above the upper one.
   */
  readonly beyondFence: boolean;
}

/** A cycle time compared across the portfolio's studies (#2911). */
export interface PortfolioBenchmark {
  /** The metric by study, from the registry. */
  readonly report: ReportData;
  /** Studies with a value; the others have not reached both milestones. */
  readonly studies: number;
  /** Median, lower and upper quartile of the studies' values, or `null` with no values. */
  readonly median: number | null;
  readonly lowerQuartile: number | null;
  readonly upperQuartile: number | null;
  /** The median and quartiles with the metric's format at one decimal. */
  readonly medianText: string;
  readonly lowerQuartileText: string;
  readonly upperQuartileText: string;
  /** The study furthest from the median, or `null` with fewer than three values. */
  readonly outlier: PortfolioOutlier | null;
  /**
   * Studies beyond Tukey's fences, in study id order; empty with fewer than
   * three values. The fences sit at different distances from a skewed
   * median, so a study can lie beyond one while nearer the median than the
   * study furthest from it.
   */
  readonly beyondFences: readonly string[];
}

/** The /platform/portfolio dashboard over one warehouse (#2911). */
export interface PortfolioDashboard {
  /** ISO 8601 data cut of the warehouse. */
  readonly dataCut: string;
  readonly swimlane: PortfolioSwimlane;
  /** Start-up, enrollment and close-out cycle times, in study order. */
  readonly benchmarks: readonly PortfolioBenchmark[];
}
