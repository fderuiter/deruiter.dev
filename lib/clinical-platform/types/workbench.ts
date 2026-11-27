/**
 * Clinical Data Platform: SQL workbench schema browser, saved query and
 * read-only guard types.
 */
import type {
  ContractColumnType,
  DataClassification,
  MetricDimensionId,
  SqlDialect,
  WarehouseTableKind,
} from "./platform";

/** One column in the SQL workbench's schema browser (#2633). */
export interface WorkbenchColumn {
  readonly name: string;
  readonly type: ContractColumnType;
  readonly nullable: boolean;
  /** Business description, from the column's data contract. */
  readonly description: string;
  /** Classification from the column's data contract. */
  readonly classification: DataClassification;
}

/** One table the SQL workbench loads, with the governance its contract records (#2633). */
export interface WorkbenchTable {
  /** Qualified name, as a query writes it, for example `gold.fct_query`. */
  readonly name: string;
  readonly kind: WarehouseTableKind;
  readonly description: string;
  /** What one row stands for. */
  readonly grain: string;
  readonly primaryKey: readonly string[];
  /** Accountable owner and data steward (roles, not people). */
  readonly owner: string;
  readonly steward: string;
  /** Highest classification of any column. */
  readonly classification: DataClassification;
  /** Whether rows describe study subjects. The data is synthetic. */
  readonly personalHealthData: boolean;
  /** Version of the data contract in force. */
  readonly contractVersion: string;
  /** Rows in the seeded warehouse. */
  readonly rowCount: number;
  readonly columns: readonly WorkbenchColumn[];
}

/** A saved query in the SQL workbench's library (#2633). */
export interface WorkbenchQuery {
  /** Stable id, in kebab case. */
  readonly id: string;
  readonly title: string;
  /** A worked example, or the generated SQL behind a governed metric. */
  readonly kind: "example" | "metric";
  /** What the query answers and how. */
  readonly description: string;
  /** SQL techniques the query shows, for example `window functions`. */
  readonly techniques: readonly string[];
  /** Qualified names of the tables the query reads. */
  readonly tables: readonly string[];
  /** The query in DuckDB SQL, which the workbench runs. */
  readonly sql: string;
  /** Id of the governed metric, for a metric query; otherwise `null`. */
  readonly metricId: string | null;
  /** Dimensions a metric query groups by; empty for an example. */
  readonly dimensions: readonly MetricDimensionId[];
  /** A metric query in every dialect the compiler writes; otherwise `null`. */
  readonly dialects: Readonly<Record<SqlDialect, string>> | null;
}

/** Why SQL typed into the workbench will not run (#2633). */
export interface WorkbenchSqlFinding {
  readonly rule:
    | "empty"
    | "unterminated"
    | "multiple-statements"
    | "not-a-query"
    | "forbidden-keyword"
    | "external-read";
  /** What is wrong, in a sentence a visitor can act on. */
  readonly message: string;
}

/** One column of a query's result in the SQL workbench (#2633). */
export interface WorkbenchResultColumn {
  readonly name: string;
  /** The engine's type for the column, for example `Int64` or `Utf8`. */
  readonly type: string;
  /** Whether the column holds numbers, so it aligns right and exports unquoted. */
  readonly numeric: boolean;
}

/** The rows a query returned in the SQL workbench (#2633). */
export interface WorkbenchResult {
  readonly columns: readonly WorkbenchResultColumn[];
  /** Each value as text, `null` for SQL NULL, in column order. */
  readonly rows: readonly (readonly (string | null)[])[];
  /** Rows the query returned, which is more than `rows` holds when truncated. */
  readonly rowCount: number;
  /** Whether rows past the workbench's limit were counted but not kept. */
  readonly truncated: boolean;
  /** Time the engine took, in milliseconds. */
  readonly elapsedMs: number;
}

/** One gold table's rows, ready for the SQL workbench's engine to load (#2633). */
export interface WorkbenchLoadFile {
  /** Qualified table name, for example `gold.fct_query`. */
  readonly table: string;
  /** Name the CSV is registered under in the engine's virtual file system. */
  readonly fileName: string;
  /** The rows as CSV, from `exportWarehouse`. */
  readonly text: string;
  /** The statement that copies the file into its table. */
  readonly copy: string;
}

/** Everything the SQL workbench's engine runs to become the read-only warehouse (#2633). */
export interface WorkbenchLoad {
  /** DuckDB DDL for the gold tables, with their descriptions as comments. */
  readonly ddl: string;
  readonly files: readonly WorkbenchLoadFile[];
  /** Settings applied last, from `WORKBENCH_ENGINE_SETTINGS`. */
  readonly settings: readonly string[];
}

/** File formats a query result in the SQL notebook exports to. */
export type WorkbenchExportFormat = "csv" | "json" | "parquet";

/** Local file formats the SQL notebook's dataset manager ingests. */
export type WorkbenchDatasetFormat = "csv" | "json" | "parquet";

/** DuckDB column types inferred or read for an uploaded local dataset. */
export type WorkbenchDatasetColumnType =
  "BIGINT" | "DOUBLE" | "BOOLEAN" | "DATE" | "TIMESTAMP" | "VARCHAR";

/** One column of an uploaded local dataset in `uploads`. */
export interface WorkbenchDatasetColumn {
  readonly name: string;
  readonly type: WorkbenchDatasetColumnType;
  readonly nullable: boolean;
}

/** A validated local dataset stored in browser IndexedDB and hydrated into `uploads`. */
export interface WorkbenchUploadedDataset {
  /** Stable identifier in the workspace store. */
  readonly id: string;
  /** Unqualified table name under the `uploads` schema, for example `site_roster`. */
  readonly tableName: string;
  /** Qualified name in SQL queries, for example `uploads.site_roster`. */
  readonly qualifiedName: string;
  /** Original uploaded file name. */
  readonly fileName: string;
  readonly format: WorkbenchDatasetFormat;
  readonly rowCount: number;
  readonly byteLength: number;
  readonly uploadedAt: string;
  readonly columns: readonly WorkbenchDatasetColumn[];
  /** Raw uploaded file bytes kept in IndexedDB under the 50 MB workspace cap. */
  readonly bytes: Uint8Array;
}

/** Statements and virtual file buffer that load one uploaded dataset into `uploads`. */
export interface WorkbenchDatasetLoad {
  /** Qualified table name, for example `uploads.site_roster`. */
  readonly table: string;
  /** Name registered in DuckDB's virtual file system during hydration. */
  readonly fileName: string;
  /** Schema and table DDL run before copying rows in. */
  readonly ddl: string;
  /** Canonical UTF-8 CSV buffer registered through `registerFileBuffer`. */
  readonly buffer: Uint8Array;
  /** Statement that copies the registered buffer into `uploads`. */
  readonly copy: string;
}

/** Result of parsing and validating an uploaded local dataset file. */
export type WorkbenchDatasetParseResult =
  | { readonly ok: true; readonly dataset: WorkbenchUploadedDataset }
  | { readonly ok: false; readonly error: string };

/** One open SQL editor tab in the notebook workspace. */
export interface WorkbenchNotebookTab {
  readonly id: string;
  readonly title: string;
  readonly sql: string;
  /** Identifier of the selected preset or saved query, or empty when edited. */
  readonly selectedQueryId: string;
  /** Whether the visitor has unsaved edits in this tab. */
  readonly edited: boolean;
  readonly updatedAt: string;
}

/** A named query saved by the visitor in the browser's query library. */
export interface WorkbenchNamedQuery {
  readonly id: string;
  readonly title: string;
  readonly sql: string;
  readonly savedAt: string;
}

/** Status recorded for one query execution in the notebook's run log. */
export type WorkbenchExecutionStatus =
  "ok" | "error" | "refused" | "timeout" | "cancelled" | "stopped";

/** One timestamped entry in the SQL notebook's execution log. */
export interface WorkbenchExecutionLogEntry {
  readonly id: string;
  readonly ranAt: string;
  readonly tabId: string;
  readonly tabTitle: string;
  readonly mode: "run" | "explain";
  readonly sql: string;
  readonly status: WorkbenchExecutionStatus;
  readonly rowCount: number | null;
  readonly elapsedMs: number;
  readonly message: string | null;
}

/** One tab inside a portable `.sql.json` notebook bundle. */
export interface WorkbenchNotebookBundleTab {
  readonly id: string;
  readonly title: string;
  readonly sql: string;
  readonly selectedQueryId: string;
  readonly updatedAt: string;
}

/** Portable `.sql.json` notebook bundle shared between browsers. */
export interface WorkbenchNotebookBundle {
  readonly format: "deruiter.clinical-sql-notebook";
  readonly version: 1;
  readonly exportedAt: string;
  readonly activeTabId: string;
  readonly tabs: readonly WorkbenchNotebookBundleTab[];
  readonly namedQueries: readonly WorkbenchNamedQuery[];
}

/** Result of serializing a `.sql.json` notebook bundle. */
export type WorkbenchNotebookSerializeResult =
  | {
      readonly ok: true;
      readonly json: string;
      readonly bundle: WorkbenchNotebookBundle;
    }
  | { readonly ok: false; readonly error: string };

/** Result of validating and importing a `.sql.json` notebook bundle. */
export type WorkbenchNotebookParseResult =
  | { readonly ok: true; readonly bundle: WorkbenchNotebookBundle }
  | { readonly ok: false; readonly error: string };

/** Shareable `#sql=...` active-tab permalink payload. */
export interface WorkbenchPermalink {
  readonly sql: string;
  readonly title: string | null;
}

/** Result of encoding or decoding a `#sql=...` URL hash permalink. */
export type WorkbenchPermalinkDecoding =
  | { readonly ok: true; readonly permalink: WorkbenchPermalink }
  | { readonly ok: false; readonly error: string };
