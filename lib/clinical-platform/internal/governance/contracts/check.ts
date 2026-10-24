/**
 * Contract checks: each generated dataset against the contract of its
 * product (schema conformance, then each service level), and the product
 * registry against the data it registers.
 */
import type { PipelineRun } from "@/lib/study-data";
import { STUDY_DATA_PRODUCT_ID } from "../../../presets";
import type {
  ContractCheckOptions,
  ContractColumn,
  ContractObjectRows,
  DataContract,
  DataContractFinding,
  DataContractResult,
  DataProduct,
  Warehouse,
  WarehouseValue,
} from "../../../types";
import { semver } from "../../semantic/check";
import { validDate } from "../../warehouse/check";
import { WAREHOUSE_SCHEMA, qualifiedName } from "../../warehouse/schema";
import { PRODUCT_REGISTRATIONS } from "./registry";

const TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/;
const TIME = /^([01]\d|2[0-3])(?::[0-5]\d(?::[0-5]\d(?:\.\d+)?)?)?$/;

const HOUR_MS = 3_600_000;

/** A share as a percentage, rounded down so a shortfall never shows as 100%. */
function percentDown(share: number): string {
  return `${Math.floor(share * 10_000) / 100}%`;
}

/** What a value must be to fit a column, for the finding that says it does not. */
const EXPECTED: Readonly<Record<ContractColumn["type"], string>> = {
  string: "text",
  integer: "a whole number",
  decimal: "a number",
  boolean: "true or false",
  date: "a YYYY-MM-DD date",
  timestamp: "an ISO 8601 date and time",
  time: "an ISO 8601 time",
};

/** Why a non-null value breaks its column, or `null` when it fits. */
function misfit(
  column: ContractColumn,
  pattern: RegExp | null,
  value: Exclude<WarehouseValue, null>
): string | null {
  const wrong = `is not ${EXPECTED[column.type]}`;
  switch (column.type) {
    case "string":
      if (typeof value !== "string") return wrong;
      if (column.maxLength !== null && [...value].length > column.maxLength) {
        return `is longer than ${column.maxLength} characters`;
      }
      if (pattern !== null && !pattern.test(value)) {
        return `does not match ${column.pattern}`;
      }
      return null;
    case "integer":
      return typeof value === "number" && Number.isSafeInteger(value)
        ? null
        : wrong;
    case "decimal": {
      if (typeof value !== "number" || !Number.isFinite(value)) return wrong;
      const { precision, scale } = column;
      if (scale !== null) {
        const scaled = value * 10 ** scale;
        if (Math.abs(Math.round(scaled) - scaled) >= 1e-6) {
          return `has more than ${scale} decimal places`;
        }
      }
      if (
        precision !== null &&
        Math.abs(value) >= 10 ** (precision - (scale ?? 0))
      ) {
        return `has more than ${precision} digits`;
      }
      return null;
    }
    case "boolean":
      return typeof value === "boolean" ? null : wrong;
    case "date":
      return typeof value === "string" && validDate(value) ? null : wrong;
    case "timestamp": {
      const match = typeof value === "string" ? TIMESTAMP.exec(value) : null;
      return match !== null && validDate(match[1]) ? null : wrong;
    }
    case "time":
      return typeof value === "string" && TIME.test(value) ? null : wrong;
  }
}

function instant(text: string, name: string): number {
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) {
    throw new RangeError(
      `${name} must be an ISO 8601 date or timestamp, got "${text}"`
    );
  }
  return ms;
}

/** Rows of a table keyed by column name, with the columns seen, in order. */
function rowsOf(
  rows: readonly Readonly<Record<string, WarehouseValue>>[]
): ContractObjectRows {
  const columns = new Set<string>();
  for (const row of rows)
    for (const name of Object.keys(row)) columns.add(name);
  return { columns: [...columns], rows };
}

/**
 * Checks one product's data against its contract. Schema conformance comes
 * first: every contract column is present and no other column is, every
 * non-null value fits its column's type, length and pattern, and the
 * primary key identifies each row. Then each service level: required values
 * present at least at the completeness target, the latest load no older
 * than the freshness target, and every object published.
 *
 * @param contract - The contract in force.
 * @param data - The product's rows, by contract object name.
 * @param options - When the product was loaded and when it is read.
 * @returns The result, with every broken rule.
 * @throws RangeError when a timestamp is not ISO 8601, or the check runs before the load.
 */
export function checkDataContract(
  contract: DataContract,
  data: Readonly<Record<string, ContractObjectRows | undefined>>,
  options: ContractCheckOptions
): DataContractResult {
  const loadedAt = instant(options.loadedAt, "loadedAt");
  const evaluatedAt = instant(
    options.evaluatedAt ?? options.loadedAt,
    "evaluatedAt"
  );
  if (evaluatedAt < loadedAt) {
    throw new RangeError(
      `evaluatedAt ${options.evaluatedAt} is before loadedAt ${options.loadedAt}`
    );
  }
  const findings: DataContractFinding[] = [];
  const report = (
    rule: DataContractFinding["rule"],
    object: string | null,
    message: string
  ) => findings.push({ rule, productId: contract.productId, object, message });
  let required = 0;
  let present = 0;
  let rowCount = 0;
  let available = true;

  for (const object of contract.objects) {
    const rows = data[object.name];
    if (rows === undefined) {
      available = false;
      report("availability", object.name, `${object.name} was not published`);
      continue;
    }
    rowCount += rows.rows.length;
    const seen = new Set(rows.columns);
    const declared = new Set(object.columns.map((c) => c.name));
    if (rows.rows.length > 0) {
      for (const column of object.columns) {
        if (!seen.has(column.name)) {
          report(
            "schema",
            object.name,
            `${object.name} has no column ${column.name}`
          );
        }
      }
      for (const name of rows.columns) {
        if (!declared.has(name)) {
          report(
            "schema",
            object.name,
            `${object.name} has column ${name}, which the contract does not declare`
          );
        }
      }
    }
    for (const column of object.columns) {
      if (!seen.has(column.name)) continue;
      const pattern =
        column.pattern === null ? null : new RegExp(column.pattern);
      let bad = 0;
      let first = "";
      rows.rows.forEach((row, index) => {
        const value = row[column.name] ?? null;
        if (!column.nullable) {
          required += 1;
          if (value !== null) present += 1;
        }
        if (value === null) return;
        const problem = misfit(column, pattern, value);
        if (problem === null) return;
        bad += 1;
        if (bad === 1)
          first = `row ${index + 1}, ${JSON.stringify(value)}, ${problem}`;
      });
      if (bad > 0) {
        report(
          "schema",
          object.name,
          `${object.name}.${column.name}: ${bad} ${bad === 1 ? "value breaks" : "values break"} the contract (first: ${first})`
        );
      }
    }
    if (object.primaryKey.every((name) => seen.has(name))) {
      const keys = new Set<string>();
      let duplicates = 0;
      for (const row of rows.rows) {
        const key = JSON.stringify(
          object.primaryKey.map((name) => row[name] ?? null)
        );
        if (keys.has(key)) duplicates += 1;
        keys.add(key);
      }
      if (duplicates > 0) {
        report(
          "schema",
          object.name,
          `${object.name}: ${duplicates} ${duplicates === 1 ? "row repeats" : "rows repeat"} a primary key (${object.primaryKey.join(", ")})`
        );
      }
    }
  }

  const completeness = required === 0 ? 1 : present / required;
  if (completeness < contract.sla.completeness) {
    const missing = required - present;
    report(
      "completeness",
      null,
      `${missing} of ${required} required values ${missing === 1 ? "is" : "are"} missing: ${percentDown(completeness)} present, below the ${percentDown(contract.sla.completeness)} the contract promises`
    );
  }
  const ageHours = (evaluatedAt - loadedAt) / HOUR_MS;
  if (ageHours > contract.sla.freshnessHours) {
    report(
      "freshness",
      null,
      `the latest load is ${Number(ageHours.toFixed(2))} hours old; the contract promises at most ${contract.sla.freshnessHours}`
    );
  }
  return {
    productId: contract.productId,
    version: contract.version,
    rowCount,
    ageHours,
    completeness,
    available,
    findings,
    passed: findings.length === 0,
  };
}

/**
 * The data each contract covers: every warehouse table, and the SDTM and
 * ADaM datasets of a Study Data Pipeline run.
 *
 * @param warehouse - A built warehouse.
 * @param run - The Study Data Pipeline run whose output the study data product publishes.
 * @returns Rows by product id, then by contract object name.
 */
export function contractData(
  warehouse: Warehouse,
  run: PipelineRun
): Record<string, Record<string, ContractObjectRows>> {
  const data: Record<string, Record<string, ContractObjectRows>> = {};
  for (const table of WAREHOUSE_SCHEMA.tables) {
    const id = qualifiedName(table);
    const rows = warehouse.tables[id];
    data[id] = rows === undefined ? {} : { [table.name]: rowsOf(rows) };
  }
  const study: Record<string, ContractObjectRows> = {};
  for (const dataset of run.datasets) {
    if (dataset.layer === "collected") continue;
    const names = dataset.variables.map((v) => v.name);
    study[dataset.name] = {
      columns: names,
      rows: Array.from({ length: dataset.rowCount }, (_, i) =>
        Object.fromEntries(
          names.map((name) => [name, dataset.columns[name][i]])
        )
      ),
    };
  }
  data[STUDY_DATA_PRODUCT_ID] = study;
  return data;
}

/**
 * Checks every product's data against its contract.
 *
 * @param contracts - Contracts in force, from `dataContracts`.
 * @param data - Rows by product id, from `contractData`.
 * @param options - When the products were loaded and when they are read.
 * @returns One result per contract, in contract order.
 */
export function checkDataContracts(
  contracts: readonly DataContract[],
  data: Readonly<Record<string, Readonly<Record<string, ContractObjectRows>>>>,
  options: ContractCheckOptions
): DataContractResult[] {
  return contracts.map((contract) =>
    checkDataContract(contract, data[contract.productId] ?? {}, options)
  );
}

const ROLE = /\S/;

/**
 * Checks the product registry: every warehouse table and the study data
 * are registered and nothing else is; each product has an owner and a
 * steward; each contract has a semantic version, service levels in range,
 * a retention period with its basis, and objects with unique column names
 * and a primary key made of required, declared columns.
 *
 * @param products - Products, from `dataProducts`.
 * @param contracts - Their contracts, from `dataContracts`.
 * @returns Every broken rule; empty when the registry is sound.
 */
export function checkDataProducts(
  products: readonly DataProduct[],
  contracts: readonly DataContract[]
): DataContractFinding[] {
  const findings: DataContractFinding[] = [];
  const report = (productId: string, object: string | null, message: string) =>
    findings.push({ rule: "registry", productId, object, message });
  const expected = new Set([
    ...WAREHOUSE_SCHEMA.tables.map(qualifiedName),
    STUDY_DATA_PRODUCT_ID,
  ]);
  for (const id of expected) {
    if (!products.some((p) => p.id === id))
      report(id, null, `${id} is not a data product`);
  }
  for (const id of Object.keys(PRODUCT_REGISTRATIONS)) {
    if (!expected.has(id))
      report(id, null, `${id} is registered but names no table or dataset`);
  }
  const ids = new Set<string>();
  for (const product of products) {
    if (ids.has(product.id))
      report(product.id, null, `${product.id} is registered twice`);
    ids.add(product.id);
    if (!ROLE.test(product.owner))
      report(product.id, null, "the product names no owner");
    if (!ROLE.test(product.steward))
      report(product.id, null, "the product names no steward");
    const contract = contracts.find((c) => c.id === product.contractId);
    if (contract === undefined || contract.productId !== product.id) {
      report(
        product.id,
        null,
        `contract ${product.contractId} does not govern ${product.id}`
      );
    }
  }
  for (const contract of contracts) {
    const id = contract.productId;
    if (semver(contract.version) === null) {
      report(id, null, `version ${contract.version} is not x.y.z`);
    }
    const { freshnessHours, completeness, availability } = contract.sla;
    if (!Number.isInteger(freshnessHours) || freshnessHours < 1) {
      report(
        id,
        null,
        "the freshness target must be a whole number of hours, at least 1"
      );
    }
    for (const [name, share] of [
      ["completeness", completeness],
      ["availability", availability],
    ] as const) {
      if (!(share > 0 && share <= 1)) {
        report(
          id,
          null,
          `the ${name} target must be a share above 0 and at most 1`
        );
      }
    }
    if (
      !Number.isInteger(contract.retention.years) ||
      contract.retention.years < 1
    ) {
      report(
        id,
        null,
        "the retention period must be a whole number of years, at least 1"
      );
    }
    if (!ROLE.test(contract.retention.basis)) {
      report(id, null, "the retention period gives no basis");
    }
    if (contract.objects.length === 0)
      report(id, null, "the contract covers no table or dataset");
    for (const object of contract.objects) {
      const names = object.columns.map((c) => c.name);
      if (new Set(names).size !== names.length) {
        report(id, object.name, `${object.name} declares a column twice`);
      }
      if (object.primaryKey.length === 0) {
        report(id, object.name, `${object.name} has no primary key`);
      }
      for (const key of object.primaryKey) {
        const column = object.columns.find((c) => c.name === key);
        if (column === undefined || column.nullable) {
          report(
            id,
            object.name,
            `${object.name}: primary key ${key} must be a required, declared column`
          );
        }
      }
    }
  }
  return findings;
}
