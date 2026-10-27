/**
 * Messages between the /study-data page and the pipeline worker.
 *
 * The worker keeps every heavy structure of a run (the datasets, the ARS
 * reporting event and its row sets, the lineage index) and answers small
 * requests: a run summary, a window of rows, one lineage trace, or a zipped
 * download. The full ARS JSON never crosses to the page; at 5,000 subjects it
 * is about 12 MB (#2729).
 */
import type {
  CellValue,
  ConformanceReport,
  CoreView,
  DataLayer,
  DefineDocument,
  Finding,
  HandoffReport,
  LineageOrigin,
  LineageTrace,
  MessyDataScenario,
  ScenarioId,
  TlfKmFigure,
  TlfTable,
  VariableMeta,
} from "@/lib/study-data";
import type { ScheduleDesign } from "./ScheduleViewer";
import type { DefinitionCounts } from "./StageRail";

/** A dataset of the run, without its values. */
export interface DatasetSummary {
  /** `layer:name`, unique across the run. */
  readonly key: string;
  readonly name: string;
  readonly label: string;
  readonly layer: DataLayer;
  readonly datasetClass: string;
  readonly structure?: string;
  readonly keys: readonly string[];
  readonly rowCount: number;
  readonly variables: readonly VariableMeta[];
}

/** Counts shown on the stage rail. */
export interface StageCounts {
  readonly collected: {
    readonly records: number;
    readonly datasets: number;
    readonly subjects: number;
  };
  readonly sdtm: { readonly records: number; readonly datasets: number };
  readonly conformance: {
    readonly checks: number;
    readonly pass: number;
    readonly warning: number;
    readonly error: number;
    readonly findings: number;
  };
  readonly adam: { readonly records: number; readonly datasets: number };
  readonly define: {
    readonly datasets: number;
    readonly variables: number;
    readonly codelists: number;
    readonly methods: number;
  };
  readonly tlf: {
    readonly tables: number;
    readonly figures: number;
    readonly results: number;
  };
}

/** Findings of a run: the first few, and how many there are. */
export interface FindingSample {
  readonly total: number;
  readonly items: readonly Finding[];
}

/**
 * A messy-data scenario injected into a run, and where the gate caught it:
 * the findings the run raised on the changed subject for the rules the
 * scenario declares.
 */
export interface InjectedIssue {
  readonly scenario: MessyDataScenario;
  /** The changed subject, or null when no subject was eligible. */
  readonly subject: string | null;
  /** Findings on the changed subject from the declared rules, in run order. */
  readonly caught: readonly Finding[];
  /** Declared rules that raised nothing on the changed subject. */
  readonly missed: readonly string[];
}

/** Everything the page shows about a run, small enough to post. */
export interface RunSummary {
  readonly runId: number;
  readonly seed: number;
  readonly nSubjects: number;
  /** Milliseconds the run took in the worker. */
  readonly elapsedMs: number;
  readonly counts: StageCounts;
  readonly datasets: readonly DatasetSummary[];
  readonly conformance: ConformanceReport;
  readonly findings: FindingSample;
  /** The injected scenario, present only when the run asked for one. */
  readonly injected?: InjectedIssue;
  /**
   * The CDISC CORE view whose recorded findings describe this run's output,
   * or null when CORE never saw it (another study, seed or subject count).
   */
  readonly coreView: CoreView | null;
  readonly define: {
    readonly sdtm: DefineDocument;
    readonly adam: DefineDocument;
  };
  readonly tables: readonly TlfTable[];
  readonly figures: readonly TlfKmFigure[];
  /**
   * The run's reviewer guides as HTML articles, the same markup the package
   * ships in `csdrg.html` and `adrg.html`.
   */
  readonly guides: {
    readonly csdrg: string;
    readonly adrg: string;
  };
}

/**
 * A handed-off study checked and narrowed for a run, or why it cannot run.
 * `schema` means the document failed the USDM v4.0.0 schema; `definition`
 * means it passed but is not a study the pipeline can read.
 */
export type PreparedStudy =
  | {
      readonly ok: true;
      readonly report: HandoffReport;
      readonly design: ScheduleDesign;
      readonly counts: DefinitionCounts;
    }
  | {
      readonly ok: false;
      readonly problem: "schema" | "definition";
      /** The first few issues, as `path: message` or a reader error. */
      readonly issues: readonly string[];
      /** How many issues there are in all. */
      readonly total: number;
    };

/** A window of a dataset's rows, one array of cells per row. */
export interface RowWindow {
  readonly key: string;
  readonly offset: number;
  readonly rows: readonly (readonly CellValue[])[];
}

/** Which download to build. */
export type PackageKind = "submission" | "outputs";

/** A built download. */
export interface PackageFileResult {
  readonly fileName: string;
  readonly bytes: Uint8Array;
  /** Files inside the archive. */
  readonly fileCount: number;
}

/** A request to the worker. */
export type StudyDataRequest =
  | {
      readonly id: number;
      readonly type: "prepare";
      /** A parsed USDM v4 document handed over from CRF Studio. */
      readonly study: unknown;
    }
  | {
      readonly id: number;
      readonly type: "run";
      readonly seed: number;
      readonly nSubjects: number;
      /** A handed-over USDM document to run; DEMO-301 when absent. */
      readonly study?: unknown;
      /** A messy-data scenario to inject (#2605); none when absent. */
      readonly scenario?: ScenarioId;
    }
  | {
      readonly id: number;
      readonly type: "rows";
      readonly runId: number;
      readonly key: string;
      readonly offset: number;
      readonly limit: number;
    }
  | {
      readonly id: number;
      readonly type: "trace";
      readonly runId: number;
      readonly origin: LineageOrigin;
      readonly limit: number;
    }
  | {
      readonly id: number;
      readonly type: "package";
      readonly runId: number;
      readonly kind: PackageKind;
    };

/** What each request type resolves to. */
export interface StudyDataResults {
  readonly prepare: PreparedStudy;
  readonly run: RunSummary;
  readonly rows: RowWindow;
  readonly trace: LineageTrace;
  readonly package: PackageFileResult;
}

/** The worker's answer to one request. */
export type StudyDataResponse =
  | { readonly id: number; readonly ok: true; readonly result: unknown }
  | { readonly id: number; readonly ok: false; readonly error: string };

/** Rows the page asks for at a time. */
export const ROW_PAGE_SIZE = 200;

/** Lineage items listed per level. */
export const TRACE_LIMIT = 40;

/** Schema issues posted when a handed-off study is invalid. */
export const SCHEMA_ISSUE_SAMPLE_SIZE = 8;

/** Findings posted with a run summary; the rest are counted. */
export const FINDING_SAMPLE_SIZE = 200;
