/**
 * Clinical Data Platform: silver and gold star schema and DDL types.
 */
import type {
  DataClassification,
  WarehouseColumnType,
  WarehouseTable,
  WarehouseValue,
} from "./platform";

/** The typed description of the silver and gold layers. */
export interface WarehouseSchema {
  /** Semantic version of the schema. */
  readonly version: string;
  /** Tables in creation order: silver, then gold dimensions, then gold facts. */
  readonly tables: readonly WarehouseTable[];
}

/** A broken warehouse invariant, reported by `checkWarehouse`. */
export interface WarehouseFinding {
  /** Invariant that failed. */
  readonly rule:
    | "table"
    | "column"
    | "type"
    | "nullability"
    | "length"
    | "grain"
    | "unique"
    | "foreign-key"
    | "scd2"
    | "sequence";
  /** Qualified table name. */
  readonly table: string;
  /** What is wrong, in one sentence. */
  readonly message: string;
}

/** One version of a slowly changing dimension member. */
export interface Scd2Version {
  /** Version number, from 1. */
  readonly version: number;
  /** ISO 8601 first day in force (inclusive). */
  readonly validFrom: string;
  /** ISO 8601 day the next version takes over (exclusive), or `SCD2_OPEN_END`. */
  readonly validTo: string;
  /** Whether this is the latest version. */
  readonly isCurrent: boolean;
  /** Tracked attribute values in force during the version. */
  readonly attributes: Readonly<Record<string, WarehouseValue>>;
}

/** A dated change to some tracked attributes of a dimension member. */
export interface Scd2Change {
  /** ISO 8601 day the change takes effect. */
  readonly effectiveOn: string;
  /** Attributes that change; the others keep their value. */
  readonly attributes: Readonly<Record<string, WarehouseValue>>;
}

/** One CSV file of a warehouse export. */
export interface WarehouseCsvFile {
  /** Relative path, for example `gold/dim_site.csv`. */
  readonly path: string;
  /** Qualified table name. */
  readonly table: string;
  /** Number of data rows, header excluded. */
  readonly rowCount: number;
  /** CSV text: a header row, RFC 4180 quoting, LF line ends; `null` is an empty unquoted field. */
  readonly text: string;
}

/** Parquet type a manifest column maps to. */
export interface ParquetColumnType {
  /** Parquet physical type. */
  readonly physicalType: "BYTE_ARRAY" | "INT32" | "INT64" | "BOOLEAN";
  /** Parquet logical type annotation, or `null` when there is none. */
  readonly logicalType: string | null;
  /** `REQUIRED` for a non-nullable column, otherwise `OPTIONAL`. */
  readonly repetition: "REQUIRED" | "OPTIONAL";
}

/** One column in an export manifest. */
export interface WarehouseManifestColumn {
  /** Column name. */
  readonly name: string;
  /** Logical type. */
  readonly type: WarehouseColumnType;
  /** Whether the column may hold `null`. */
  readonly nullable: boolean;
  /** Data classification. */
  readonly classification: DataClassification;
  /** Parquet type a writer should use. */
  readonly parquet: ParquetColumnType;
}

/** One table in an export manifest. */
export interface WarehouseManifestTable {
  /** Qualified table name. */
  readonly table: string;
  /** CSV path. */
  readonly path: string;
  /** Number of data rows. */
  readonly rowCount: number;
  /** Primary key columns. */
  readonly primaryKey: readonly string[];
  /** Columns, in file order. */
  readonly columns: readonly WarehouseManifestColumn[];
}

/** The column and type manifest shipped next to the CSV files. */
export interface WarehouseExportManifest {
  /** Synthetic data notice. */
  readonly notice: string;
  /** Warehouse schema version. */
  readonly schemaVersion: string;
  /** Portfolio id. */
  readonly portfolioId: string;
  /** ISO 8601 data cut. */
  readonly asOf: string;
  /** One entry per CSV file, in schema order. */
  readonly tables: readonly WarehouseManifestTable[];
}

/** CSV files and their manifest for one warehouse. */
export interface WarehouseExport {
  /** One CSV file per table, in schema order. */
  readonly files: readonly WarehouseCsvFile[];
  /** Column and type manifest. */
  readonly manifest: WarehouseExportManifest;
}
