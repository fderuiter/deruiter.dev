/**
 * Data contracts as Open Data Contract Standard (ODCS) v3.2.0 documents
 * (Bitol, a project of the LF AI & Data Foundation:
 * https://bitol-io.github.io/open-data-contract-standard/). Each product's
 * contract becomes one ODCS `DataContract`; the tests validate every
 * document against the standard's own JSON schema.
 */
import { SYNTHETIC_DATA_NOTICE } from "../../../presets";
import type {
  ContractColumn,
  ContractObject,
  DataContract,
  DataProduct,
} from "../../../types";
import { yaml, type Yaml, type YamlMap } from "../../yaml";

/** The ODCS version the documents declare. */
export const ODCS_API_VERSION = "v3.2.0";

/** ODCS logical type of each contract column type. */
const LOGICAL_TYPE: Readonly<Record<ContractColumn["type"], string>> = {
  string: "string",
  integer: "integer",
  decimal: "number",
  boolean: "boolean",
  date: "date",
  timestamp: "timestamp",
  time: "time",
};

/** DuckDB type of a column, the dialect the platform's warehouse runs on. */
function physicalType(column: ContractColumn): string {
  switch (column.type) {
    case "string":
      return column.maxLength === null
        ? "VARCHAR"
        : `VARCHAR(${column.maxLength})`;
    case "integer":
      return "INTEGER";
    case "decimal":
      return column.precision === null
        ? "DOUBLE"
        : `DECIMAL(${column.precision}, ${column.scale ?? 0})`;
    case "boolean":
      return "BOOLEAN";
    case "date":
      return "DATE";
    case "timestamp":
      return "TIMESTAMPTZ";
    case "time":
      return "TIME";
  }
}

/** An ODCS stable id: no dots, slashes or other reference characters. */
function stableId(...parts: readonly string[]): string {
  return parts.join("_").replace(/[^A-Za-z0-9_-]/g, "_");
}

function property(object: ContractObject, column: ContractColumn): YamlMap {
  const keyPosition = object.primaryKey.indexOf(column.name) + 1;
  const options: YamlMap = {
    maxLength:
      column.type === "string" ? (column.maxLength ?? undefined) : undefined,
    pattern: column.pattern ?? undefined,
  };
  return {
    name: column.name,
    logicalType: LOGICAL_TYPE[column.type],
    ...(Object.values(options).some((v) => v !== undefined)
      ? { logicalTypeOptions: options }
      : {}),
    physicalType: physicalType(column),
    description: column.description,
    required: !column.nullable,
    ...(keyPosition > 0
      ? { primaryKey: true, primaryKeyPosition: keyPosition }
      : {}),
    classification: column.classification,
  };
}

function schemaObject(object: ContractObject): YamlMap {
  return {
    id: stableId(object.name),
    name: object.name,
    physicalName: object.physicalName,
    physicalType: object.physicalName.endsWith(".json") ? "file" : "table",
    logicalType: "object",
    description: object.description,
    ...(object.grain === ""
      ? {}
      : { dataGranularityDescription: object.grain }),
    properties: object.columns.map((c) => property(object, c)),
    quality: [
      {
        id: stableId(object.name, "primary", "key"),
        type: "library",
        metric: "duplicateValues",
        arguments: { properties: object.primaryKey },
        mustBe: 0,
        dimension: "uniqueness",
        description: `The primary key (${object.primaryKey.join(", ")}) identifies one row.`,
      },
    ],
  };
}

/** A role name as an ODCS team member username, for example `clinical-data-steward`. */
function roleUsername(role: string): string {
  return role
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * One product's contract as an ODCS v3.2.0 document, as plain data that
 * validates against the standard's JSON schema.
 *
 * @param product - The data product.
 * @param contract - Its contract.
 * @returns The document.
 */
export function toOdcs(product: DataProduct, contract: DataContract): YamlMap {
  if (contract.productId !== product.id) {
    throw new Error(`contract ${contract.id} does not govern ${product.id}`);
  }
  const { sla, retention } = contract;
  const custom: [string, Yaml][] = [
    ["dataClassification", product.classification],
    ["personalHealthData", product.personalHealthData],
    ["synthetic", true],
    ["upstream", product.upstream],
    ["consumers", product.consumers.map((c) => `${c.kind}:${c.id}`)],
  ];
  return {
    apiVersion: ODCS_API_VERSION,
    kind: "DataContract",
    id: contract.id,
    name: product.name,
    version: contract.version,
    status: "active",
    domain: product.domain,
    tags: [
      product.layer,
      product.classification,
      ...(product.personalHealthData ? ["personal-health-data"] : []),
      "synthetic",
    ],
    description: {
      purpose: product.description,
      limitations: SYNTHETIC_DATA_NOTICE,
    },
    schema: contract.objects.map(schemaObject),
    team: {
      name: product.domain,
      members: [
        {
          username: roleUsername(product.owner),
          name: product.owner,
          role: "owner",
        },
        {
          username: roleUsername(product.steward),
          name: product.steward,
          role: "data steward",
        },
      ],
    },
    slaProperties: [
      {
        id: "latency",
        property: "latency",
        value: sla.freshnessHours,
        unit: "h",
        driver: "operational",
        description: `The latest load is at most ${sla.freshnessHours} hours old when the data is read.`,
      },
      {
        id: "completeness",
        property: "completeness",
        value: Number((sla.completeness * 100).toFixed(4)),
        unit: "percent",
        driver: "operational",
        description:
          "Share of the values of required properties that are present.",
      },
      {
        id: "availability",
        property: "availability",
        value: Number((sla.availability * 100).toFixed(4)),
        unit: "percent",
        driver: "operational",
        description: "Share of time the product can be read.",
      },
      {
        id: "retention",
        property: "retention",
        value: retention.years,
        unit: "y",
        driver: retention.regulatory ? "regulatory" : "operational",
        description: retention.basis,
      },
    ],
    customProperties: custom.map(([name, value]) => ({
      property: name,
      value,
    })),
  };
}

/**
 * One product's contract as an ODCS v3.2.0 YAML file.
 *
 * @param product - The data product.
 * @param contract - Its contract.
 * @returns The YAML text, ending with a newline.
 */
export function toOdcsYaml(
  product: DataProduct,
  contract: DataContract
): string {
  return [
    `# ODCS ${ODCS_API_VERSION} data contract for ${product.id}. ${SYNTHETIC_DATA_NOTICE}`,
    ...yaml(toOdcs(product, contract)),
    "",
  ].join("\n");
}
