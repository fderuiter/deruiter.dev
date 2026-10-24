/**
 * The lineage model: what a trace from one starting point returns. A trace
 * walks between five levels, from the study definition's schedule to the
 * analysis results, in both directions from wherever it starts.
 */
import type { DataLayer } from "../../types";

/** The levels a trace walks, from the protocol to the reported numbers. */
export type LineageLevel =
  "schedule" | "collected" | "sdtm" | "adam" | "result";

/** Where a trace starts. */
export type LineageOrigin =
  | {
      /** One displayed table or figure cell: the results it shows. */
      readonly kind: "result";
      /** Ids of the ARS results, as a cell's `data-ars-results` lists them. */
      readonly resultIds: readonly string[];
    }
  | {
      /** One record of a dataset in any layer. */
      readonly kind: "record";
      readonly layer: DataLayer;
      readonly dataset: string;
      /** Zero-based row index. */
      readonly row: number;
    }
  | {
      /** One activity of the schedule of activities, at one visit or all. */
      readonly kind: "activity";
      readonly activityId: string;
      /** The USDM encounter; every visit the activity is planned at when absent. */
      readonly visitId?: string;
    };

/** How a record is linked to the start of the trace. */
export type LineageRelation =
  /**
   * Holds the traced value itself: the SDTM record an ADaM row names in
   * SRCDOM and SRCSEQ, or a record of that same domain.
   */
  | "primary"
  /** Contributes to the traced value, for example as a reference date. */
  | "linked"
  /** The record the trace started from. */
  | "origin";

/** One record of a dataset, as a trace lists it. */
export interface LineageRecord {
  readonly layer: DataLayer;
  readonly dataset: string;
  /** Zero-based row index. */
  readonly row: number;
  /** The record's key values other than STUDYID, for example `DEMO-301-0001 · 3`. */
  readonly key: string;
  /** A few of the record's own values, for example `VSTESTCD SYSBP · VSORRES 141.2`. */
  readonly summary: string;
  readonly relation: LineageRelation;
}

/** One visit of the study definition. */
export interface LineageVisit {
  /** USDM encounter id. */
  readonly id: string;
  readonly name: string;
  readonly visitNum: number;
  readonly targetDay: number;
}

/**
 * One entry of the schedule of activities: an activity and the visits it is
 * planned at. `activityId` is `null` for a visit record, which belongs to the
 * encounter itself rather than to an activity.
 */
export interface LineageScheduleEntry {
  readonly activityId: string | null;
  readonly activityName: string | null;
  /** SDTM domain of the activity's data. */
  readonly domain: string | null;
  readonly visits: readonly LineageVisit[];
  /**
   * `visit` when the collected record names its visit, `schedule` when the
   * record is not tied to one visit and every planned visit is listed.
   */
  readonly basis: "visit" | "schedule";
  /**
   * `primary` when the activity collects the traced value itself, `linked`
   * when it collects a record the value only refers to, such as the first
   * dose date a study day counts from.
   */
  readonly relation: LineageRelation;
}

/** Where a result is displayed. */
export interface LineageDisplayCell {
  /** The ARS output, for example `Out_14_1_1`. */
  readonly outputId: string;
  /** For example `Table 14.1.1` or `Figure 14.2.2`. */
  readonly outputName: string;
  /** Section, row and column, for example `Age (years) · Mean · Placebo`. */
  readonly location: string;
  /** The text of the cell. */
  readonly text: string;
  /** Every result the cell shows. */
  readonly resultIds: readonly string[];
}

/** One analysis result. */
export interface LineageResult {
  readonly resultId: string;
  readonly analysisId: string;
  readonly analysisName: string;
  /** The operation, for example `Mean`. */
  readonly operation: string;
  readonly formattedValue: string;
  /** Where the result is displayed, when it is. */
  readonly display?: LineageDisplayCell;
}

/** One level of a trace: everything linked, of which the first few are listed. */
export interface LineageStep<T> {
  /** How many items are linked in all. */
  readonly total: number;
  /** The first `limit` items, in dataset and row order. */
  readonly items: readonly T[];
  /** Why the level is empty or partial, in words. */
  readonly note?: string;
}

/** The result of `LineageIndex.trace`. */
export interface LineageTrace {
  readonly origin: LineageOrigin;
  /** The level the trace starts at. Levels before it are upstream, after it downstream. */
  readonly originLevel: LineageLevel;
  /** What the trace starts from, in words. */
  readonly title: string;
  readonly schedule: LineageStep<LineageScheduleEntry>;
  readonly collected: LineageStep<LineageRecord>;
  readonly sdtm: LineageStep<LineageRecord>;
  readonly adam: LineageStep<LineageRecord>;
  readonly results: LineageStep<LineageResult>;
  /**
   * For a result start: the ADSL rows of the result's population (the
   * denominator), which are counted here rather than listed.
   */
  readonly populationRows?: number;
}

/** Options for `LineageIndex.trace`. */
export interface LineageTraceOptions {
  /** Items listed per level; the totals count everything. Default 40. */
  readonly limit?: number;
}
