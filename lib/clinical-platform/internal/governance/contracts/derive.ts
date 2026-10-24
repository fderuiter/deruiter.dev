/**
 * Data products and their contracts, read from what already describes the
 * data: the warehouse schema for every silver and gold table, and the Study
 * Data Pipeline's dataset metadata and Define-XML for its SDTM and ADaM
 * output. Only ownership, service levels and retention come from the
 * product registrations.
 */
import {
  ADAM_PACKAGE_DIR,
  PACKAGE_FIXED_TIMESTAMP,
  SDTM_PACKAGE_DIR,
  buildDefine,
  type Dataset,
  type PipelineRun,
  type VariableMeta,
} from "@/lib/study-data";
import { STUDY_DATA_PRODUCT_ID } from "../../../presets";
import type {
  ContractColumn,
  ContractObject,
  DataClassification,
  DataContract,
  DataProduct,
  DataProductConsumer,
  WarehouseTable,
} from "../../../types";
import { METRIC_REGISTRY } from "../../semantic/registry";
import { formulaSources } from "../../semantic/plan";
import { WAREHOUSE_SCHEMA, qualifiedName } from "../../warehouse/schema";
import { PRODUCT_REGISTRATIONS, type ProductRegistration } from "./registry";

/** Every completeness target: a required value is always present. */
const COMPLETENESS = 1;

/** Classifications from least to most protected. */
export const CLASSIFICATION_ORDER: readonly DataClassification[] = [
  "public",
  "internal",
  "confidential",
  "restricted",
];

function highest(classes: readonly DataClassification[]): DataClassification {
  return classes.reduce<DataClassification>(
    (top, next) =>
      CLASSIFICATION_ORDER.indexOf(next) > CLASSIFICATION_ORDER.indexOf(top)
        ? next
        : top,
    "public"
  );
}

/** Id of the contract that governs a product. */
function contractId(productId: string): string {
  return `clinical-platform/${productId}`;
}

function registration(productId: string): ProductRegistration {
  const found = PRODUCT_REGISTRATIONS[productId];
  if (found === undefined) {
    throw new Error(`data product ${productId} has no registration`);
  }
  return found;
}

function contractOf(
  productId: string,
  objects: readonly ContractObject[]
): DataContract {
  const reg = registration(productId);
  return {
    id: contractId(productId),
    productId,
    version: reg.version,
    objects,
    sla: {
      freshnessHours: reg.freshnessHours,
      completeness: COMPLETENESS,
      availability: reg.availability,
    },
    retention: reg.retention,
  };
}

// --- Warehouse tables ------------------------------------------------------

function tableObject(table: WarehouseTable): ContractObject {
  return {
    name: table.name,
    physicalName: qualifiedName(table),
    description: table.description,
    grain: table.grain,
    primaryKey: table.primaryKey,
    columns: table.columns.map((column): ContractColumn => ({
      name: column.name,
      type: column.type,
      nullable: column.nullable,
      description: column.description,
      classification: column.classification,
      maxLength: column.length,
      precision: column.precision,
      scale: column.scale,
      pattern: null,
    })),
  };
}

/**
 * What a lineage reference is read from: the reference without its last
 * part, the column or field. That is a bronze feed such as
 * `bronze.edc.subjects` or `bronze.etmf`, or a warehouse table such as
 * `silver.site`.
 */
function lineageSource(reference: string): string {
  return reference.slice(0, reference.lastIndexOf("."));
}

function tableUpstream(table: WarehouseTable): string[] {
  const self = qualifiedName(table);
  const sources = new Set(
    table.columns.flatMap((column) => column.lineage.map(lineageSource))
  );
  sources.delete(self);
  return [...sources].sort();
}

// --- Study Data Pipeline output --------------------------------------------

const STUDY_IDENTIFIERS = new Set(["STUDYID", "DOMAIN", "RDOMAIN"]);

/**
 * Variables that reveal a subject's treatment: the arm and planned or actual
 * treatment, and the product and dose given. Like the randomised arm in
 * `silver.irt_randomization`, only unblinded roles may read them.
 */
const TREATMENT =
  /^(?:ARMCD|ARM|ACTARMCD|ACTARM|TRT\d{2}[PA]N?|TRT[PA]N?|EXTRT|EXDOSE)$/;

/** ISO 8601 text, which SDTM allows to be partial (`2026`, `2026-05`). */
const ISO_PATTERNS = {
  date: "^\\d{4}(?:-\\d{2}(?:-\\d{2})?)?$",
  datetime:
    "^\\d{4}(?:-\\d{2}(?:-\\d{2}(?:T\\d{2}(?::\\d{2}(?::\\d{2})?)?)?)?)?$",
  time: "^\\d{2}(?::\\d{2}(?::\\d{2})?)?$",
} as const;

function studyClassification(
  dataset: Dataset,
  name: string
): DataClassification {
  const subjectLevel = dataset.variables.some((v) => v.name === "USUBJID");
  if (!subjectLevel || STUDY_IDENTIFIERS.has(name)) return "internal";
  return TREATMENT.test(name) ? "restricted" : "confidential";
}

function studyColumnType(
  dataset: Dataset,
  variable: VariableMeta
): Pick<ContractColumn, "type" | "pattern"> {
  switch (variable.type) {
    case "text":
      return { type: "string", pattern: null };
    case "integer":
      return { type: "integer", pattern: null };
    case "float":
      return { type: "decimal", pattern: null };
    case "date":
    case "datetime":
    case "time":
      // SDTM keeps ISO 8601 text, partial when the source was; ADaM
      // timing variables hold complete values.
      if (dataset.layer === "sdtm") {
        return { type: "string", pattern: ISO_PATTERNS[variable.type] };
      }
      return {
        type: variable.type === "datetime" ? "timestamp" : variable.type,
        pattern: null,
      };
  }
}

function studyObjects(run: PipelineRun): ContractObject[] {
  const mandatory = new Map<string, boolean>();
  for (const layer of ["sdtm", "adam"] as const) {
    const define = buildDefine(run, {
      layer,
      createdAt: PACKAGE_FIXED_TIMESTAMP,
    });
    for (const group of define.itemGroups) {
      for (const ref of group.itemRefs) {
        mandatory.set(`${group.name}.${ref.name}`, ref.mandatory);
      }
    }
  }
  return run.datasets
    .filter((dataset) => dataset.layer !== "collected")
    .map((dataset) => ({
      name: dataset.name,
      // The Dataset-JSON file in the study data package.
      physicalName: `${dataset.layer === "sdtm" ? SDTM_PACKAGE_DIR : ADAM_PACKAGE_DIR}/${dataset.name.toLowerCase()}.json`,
      description: dataset.label,
      grain: dataset.structure ?? "",
      primaryKey: dataset.keys,
      columns: dataset.variables.map((variable): ContractColumn => ({
        name: variable.name,
        ...studyColumnType(dataset, variable),
        nullable: !(mandatory.get(`${dataset.name}.${variable.name}`) ?? false),
        description: variable.label,
        classification: studyClassification(dataset, variable.name),
        maxLength: variable.type === "text" ? (variable.length ?? null) : null,
        precision: null,
        scale: null,
      })),
    }));
}

// --- Products --------------------------------------------------------------

function withConsumers(
  products: readonly Omit<DataProduct, "consumers">[]
): DataProduct[] {
  const metricsByTable = new Map<string, string[]>();
  for (const metric of METRIC_REGISTRY) {
    const tables = new Set(formulaSources(metric.formula).map((s) => s.table));
    for (const table of tables) {
      metricsByTable.set(table, [
        ...(metricsByTable.get(table) ?? []),
        metric.id,
      ]);
    }
  }
  return products.map((product) => {
    const consumers: DataProductConsumer[] = [
      ...products
        .filter((other) => other.upstream.includes(product.id))
        .map((other) => ({ kind: "product" as const, id: other.id })),
      ...(metricsByTable.get(product.id) ?? []).map((id) => ({
        kind: "metric" as const,
        id,
      })),
    ];
    return { ...product, consumers };
  });
}

/**
 * Every data contract in force: one per silver and gold table, and one for
 * the Study Data Pipeline's SDTM and ADaM output covering each of its
 * datasets. The pipeline's collected layer is its own input stage, read
 * into the bronze feeds, so it is not a published product.
 *
 * @param run - A Study Data Pipeline run, which supplies the dataset
 *   metadata; the metadata does not depend on the seed or subject count.
 * @returns The contracts, warehouse tables in schema order, then the study data.
 */
export function dataContracts(run: PipelineRun): DataContract[] {
  return [
    ...WAREHOUSE_SCHEMA.tables.map((table) =>
      contractOf(qualifiedName(table), [tableObject(table)])
    ),
    contractOf(STUDY_DATA_PRODUCT_ID, studyObjects(run)),
  ];
}

/**
 * Every data product, with its owner, steward, classification, upstream
 * sources and known consumers (downstream products, and the governed
 * metrics whose formulas read it).
 *
 * @param run - A Study Data Pipeline run, as for `dataContracts`.
 * @returns The products, in the same order as `dataContracts`.
 */
export function dataProducts(run: PipelineRun): DataProduct[] {
  const contracts = dataContracts(run);
  const products = contracts.map((contract): Omit<DataProduct, "consumers"> => {
    const reg = registration(contract.productId);
    const columns = contract.objects.flatMap((o) => o.columns);
    const table = WAREHOUSE_SCHEMA.tables.find(
      (t) => qualifiedName(t) === contract.productId
    );
    return {
      id: contract.productId,
      name: reg.name,
      layer: table?.layer ?? "gold",
      domain: reg.domain,
      description:
        table?.description ??
        `The Study Data Pipeline's SDTM and ADaM datasets for ${run.manifest.studyId}, published into the gold layer.`,
      owner: reg.owner,
      steward: reg.steward,
      classification: highest(columns.map((c) => c.classification)),
      personalHealthData: columns.some(
        (c) => c.name === "subject_id" || c.name === "USUBJID"
      ),
      contractId: contract.id,
      upstream:
        table === undefined
          ? [`usdm.${run.manifest.studyId}`]
          : tableUpstream(table),
    };
  });
  return withConsumers(products);
}
