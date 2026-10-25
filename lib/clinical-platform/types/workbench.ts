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
