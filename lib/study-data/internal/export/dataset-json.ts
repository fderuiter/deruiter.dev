/**
 * Dataset-JSON 1.1 writer, structured like the CDISC Dataset-JSON 1.1
 * specification and checked in tests against its published JSON schema.
 */
import { STANDARD_VERSIONS, SYNTHETIC_DATA_NOTICE } from "../../presets";
import type { CellValue, Dataset } from "../../types";
import { exportColumns, type ExportColumn } from "./columns";
import { itemGroupOid, itemOid, metaDataVersionOid, studyOid } from "./oids";

/** Physical data types Dataset-JSON 1.1 allows for a column. */
export type DatasetJsonDataType =
  | "string"
  | "integer"
  | "decimal"
  | "float"
  | "double"
  | "boolean"
  | "datetime"
  | "date"
  | "time"
  | "URI";

/** One column of a Dataset-JSON 1.1 file. */
export interface DatasetJsonColumn {
  readonly itemOID: string;
  readonly name: string;
  readonly label: string;
  readonly dataType: DatasetJsonDataType;
  readonly targetDataType?: "integer" | "decimal";
  readonly length?: number;
  readonly displayFormat?: string;
  readonly keySequence?: number;
}

/** A Dataset-JSON 1.1 file, in the property order it is written. */
export interface DatasetJson {
  readonly datasetJSONCreationDateTime: string;
  readonly datasetJSONVersion: string;
  readonly fileOID: string;
  readonly originator: string;
  readonly sourceSystem: { readonly name: string; readonly version: string };
  readonly studyOID: string;
  readonly metaDataVersionOID: string;
  readonly itemGroupOID: string;
  readonly records: number;
  readonly name: string;
  readonly label: string;
  readonly columns: readonly DatasetJsonColumn[];
  readonly rows: readonly (readonly CellValue[])[];
}

/** Inputs to the Dataset-JSON writer that are not in the dataset itself. */
export interface DatasetJsonOptions {
  /** Study identifier, for the study and metadata version OIDs. */
  readonly studyId: string;
  /**
   * `datasetJSONCreationDateTime`. The package passes its fixed
   * reproducibility timestamp so the file bytes depend only on the run.
   */
  readonly createdAt: string;
}

/** Name and version written to `sourceSystem`. */
export const EXPORT_SOURCE_SYSTEM = Object.freeze({
  name: "deruiter.dev Study Data Pipeline",
  version: "1.0",
});

/**
 * The `originator` value. The Dataset-JSON 1.1 schema allows no properties
 * of its own (`additionalProperties: false`), so the synthetic-data notice is
 * carried in this free-text provenance field.
 */
export const DATASET_JSON_ORIGINATOR = `deruiter.dev. ${SYNTHETIC_DATA_NOTICE}`;

const DISPLAY_FORMATS = {
  "sas-date": "DATE9.",
  "sas-datetime": "DATETIME20.",
  "sas-time": "TIME8.",
} as const;

function toColumn(dataset: Dataset, column: ExportColumn): DatasetJsonColumn {
  const { variable, storage } = column;
  const keyIndex = dataset.keys.indexOf(variable.name);
  const keySequence = keyIndex >= 0 ? { keySequence: keyIndex + 1 } : {};
  const base = {
    itemOID: itemOid(dataset.name, variable.name),
    name: variable.name,
    label: variable.label,
  };
  if (storage === "number") {
    return {
      ...base,
      dataType: variable.type === "integer" ? "integer" : "double",
      ...keySequence,
    };
  }
  if (storage === "text") {
    const dataType: DatasetJsonDataType =
      variable.type === "date" ||
      variable.type === "datetime" ||
      variable.type === "time"
        ? variable.type
        : "string";
    return { ...base, dataType, length: column.textLength, ...keySequence };
  }
  return {
    ...base,
    dataType:
      storage === "sas-date"
        ? "date"
        : storage === "sas-datetime"
          ? "datetime"
          : "time",
    targetDataType: "integer",
    displayFormat: DISPLAY_FORMATS[storage],
    ...keySequence,
  };
}

/**
 * Builds the Dataset-JSON 1.1 document for one SDTM or ADaM dataset.
 *
 * Text columns carry their longest UTF-8 byte length. ADaM dates, datetimes
 * and times keep their ISO 8601 text with `targetDataType: "integer"`, the
 * Dataset-JSON 1.1 way of saying the value is a SAS numeric date. Missing
 * values are `null`.
 *
 * @param dataset - An SDTM or ADaM dataset.
 * @param options - Study id and creation timestamp.
 * @returns The document, ready for `JSON.stringify`.
 * @throws TypeError or RangeError when a value does not match its column.
 */
export function toDatasetJson(
  dataset: Dataset,
  options: DatasetJsonOptions
): DatasetJson {
  if (dataset.layer === "collected") {
    throw new RangeError(
      `${dataset.name} is collected data; only SDTM and ADaM are exported.`
    );
  }
  const columns = exportColumns(dataset);
  const rows = Array.from({ length: dataset.rowCount }, (_, row) =>
    columns.map((column) => column.values[row])
  );
  return {
    datasetJSONCreationDateTime: options.createdAt,
    datasetJSONVersion: `${STANDARD_VERSIONS["Dataset-JSON"]}.0`,
    fileOID: `${studyOid(options.studyId)}.${itemGroupOid(dataset.name)}`,
    originator: DATASET_JSON_ORIGINATOR,
    sourceSystem: EXPORT_SOURCE_SYSTEM,
    studyOID: studyOid(options.studyId),
    metaDataVersionOID: metaDataVersionOid(options.studyId, dataset.layer),
    itemGroupOID: itemGroupOid(dataset.name),
    records: dataset.rowCount,
    name: dataset.name,
    label: dataset.label,
    columns: columns.map((column) => toColumn(dataset, column)),
    rows,
  };
}

/**
 * Serialises one dataset as Dataset-JSON 1.1 text: compact JSON with a
 * trailing newline. Number formatting is ECMAScript's shortest round-trip
 * form, so the bytes do not depend on the platform or locale.
 */
export function writeDatasetJson(
  dataset: Dataset,
  options: DatasetJsonOptions
): string {
  return `${JSON.stringify(toDatasetJson(dataset, options))}\n`;
}
