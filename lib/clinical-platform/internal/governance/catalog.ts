/**
 * The data catalog (#2638): every data product and every governed metric,
 * each with its owner, steward and stewardship domain. A product shows its
 * contract, classification, whether it met the contract at the last check,
 * its data quality score, where it sits in the lineage graph and who reads
 * it; a metric shows its status, glossary term, sources and the reports
 * that show it.
 *
 * Contract results, the data quality assessment, the lineage graph and the
 * reports are inputs rather than computed here, so a page builds each once
 * and the catalog stays a pure view over them.
 */
import { CANONICAL_GLOSSARY } from "@/lib/term-glossary";
import { MEDALLION_LAYERS, STUDY_DATA_PRODUCT_ID } from "../../presets";
import type {
  CatalogFacetCount,
  CatalogSlaStatus,
  DataCatalogEntry,
  DataCatalogFacets,
  DataCatalogMetric,
  DataCatalogProduct,
  DataCatalogQuery,
  DataContract,
  DataContractResult,
  DataProduct,
  DqAssessment,
  GovernanceDomain,
  LineageStage,
  MetricDefinition,
  MetricStatus,
  PlatformLineage,
  ReportSpec,
} from "../../types";
import { METRICS_DATASET } from "../lineage/graph";
import { METRIC_REGISTRY } from "../semantic/registry";
import { CLASSIFICATION_ORDER } from "./contracts/derive";
import { searchWords } from "./glossary";
import { GOVERNANCE_DOMAINS, stewardshipDomainOf } from "./stewardship";

/** The lineage stages of the Study Data Pipeline's published datasets. */
const STUDY_DATA_STAGES: readonly LineageStage[] = ["sdtm", "adam"];

const SLA_STATUSES: readonly CatalogSlaStatus[] = [
  "met",
  "missed",
  "unchecked",
];
const METRIC_STATUSES: readonly MetricStatus[] = [
  "draft",
  "certified",
  "deprecated",
];

/** What the data catalog is built from. */
export interface DataCatalogInput {
  /** Products, from `dataProducts`. */
  readonly products: readonly DataProduct[];
  /** Their contracts, from `dataContracts`. */
  readonly contracts: readonly DataContract[];
  /** The registry; defaults to `METRIC_REGISTRY`. */
  readonly metrics?: readonly MetricDefinition[];
  /** Results of `checkDataContracts`; without them every product is `unchecked`. */
  readonly contractResults?: readonly DataContractResult[];
  /** A data quality assessment; without one no product has a score. */
  readonly quality?: DqAssessment;
  /** The lineage graph; without one no entry links into it. */
  readonly lineage?: PlatformLineage;
  /** Reports whose metrics to record; without them no metric lists a report. */
  readonly reports?: readonly ReportSpec[];
  /** Stewardship domains; defaults to `GOVERNANCE_DOMAINS`. */
  readonly domains?: readonly GovernanceDomain[];
}

function lineageDatasets(
  productId: string,
  lineage: PlatformLineage | undefined
): string[] {
  if (lineage === undefined) return [];
  const datasets = new Set<string>();
  for (const node of lineage.nodes) {
    if (
      node.dataset === productId ||
      (productId === STUDY_DATA_PRODUCT_ID &&
        STUDY_DATA_STAGES.includes(node.stage))
    ) {
      datasets.add(node.dataset);
    }
  }
  return [...datasets].sort();
}

function slaStatus(result: DataContractResult | undefined): CatalogSlaStatus {
  if (result === undefined) return "unchecked";
  return result.passed ? "met" : "missed";
}

/**
 * The data catalog: every data product in the order given, then every
 * metric in registry order.
 *
 * @param input - Products, contracts and what the catalog shows of them.
 * @returns One entry per product and per metric.
 * @throws Error when a product has no contract, or an owner or steward is
 *   in no stewardship domain.
 */
export function dataCatalog(input: DataCatalogInput): DataCatalogEntry[] {
  const metrics = input.metrics ?? METRIC_REGISTRY;
  const domains = input.domains ?? GOVERNANCE_DOMAINS;
  const contracts = new Map(input.contracts.map((c) => [c.id, c]));
  const results = new Map(
    (input.contractResults ?? []).map((r) => [r.productId, r])
  );
  const scores = new Map(
    (input.quality?.byProduct ?? []).map((s) => [s.key, s])
  );
  const terms = new Map(CANONICAL_GLOSSARY.map((t) => [t.key, t]));
  const nodes = new Set((input.lineage?.nodes ?? []).map((n) => n.id));

  const products = input.products.map((product): DataCatalogProduct => {
    const contract = contracts.get(product.contractId);
    if (contract === undefined) {
      throw new Error(
        `data product ${product.id} has no contract ${product.contractId}`
      );
    }
    const result = results.get(product.id);
    const score = scores.get(product.id);
    const status = slaStatus(result);
    return {
      kind: "product",
      id: product.id,
      name: product.name,
      description: product.description,
      owner: product.owner,
      steward: product.steward,
      stewardshipDomain: stewardshipDomainOf(product.owner, domains),
      layer: product.layer,
      sourceDomain: product.domain,
      classification: product.classification,
      personalHealthData: product.personalHealthData,
      contractId: contract.id,
      contractVersion: contract.version,
      sla: contract.sla,
      retention: contract.retention,
      slaStatus: status,
      slaFindings:
        status === "missed" && result !== undefined
          ? result.findings.map((f) => f.message)
          : [],
      dqScore: score?.score ?? null,
      dqRules: score?.rules ?? 0,
      lineageDatasets: lineageDatasets(product.id, input.lineage),
      upstream: product.upstream,
      consumers: product.consumers,
    };
  });

  const metricEntries = metrics.map((metric): DataCatalogMetric => {
    const term =
      metric.glossaryTerm === null ? undefined : terms.get(metric.glossaryTerm);
    const node = `${METRICS_DATASET}.${metric.id}`;
    return {
      kind: "metric",
      id: metric.id,
      name: metric.name,
      description: metric.description,
      owner: metric.owner,
      steward: metric.steward,
      stewardshipDomain: stewardshipDomainOf(metric.owner, domains),
      status: metric.status,
      version: metric.version,
      unit: metric.unit,
      glossaryTerm:
        term === undefined ? null : { key: term.key, term: term.canonical },
      sources: input.products
        .filter((p) =>
          p.consumers.some((c) => c.kind === "metric" && c.id === metric.id)
        )
        .map((p) => p.id),
      reports: (input.reports ?? [])
        .filter((spec) => spec.metrics.includes(metric.id))
        .map((spec) => spec.id),
      lineageNode: nodes.has(node) ? node : null,
    };
  });

  return [...products, ...metricEntries];
}

function entryText(
  entry: DataCatalogEntry,
  domains: readonly GovernanceDomain[]
): string {
  const domain = domains.find((d) => d.id === entry.stewardshipDomain);
  const common = [
    entry.id,
    entry.name,
    entry.description,
    entry.owner,
    entry.steward,
    domain?.name ?? entry.stewardshipDomain,
  ];
  const specific =
    entry.kind === "product"
      ? [entry.sourceDomain, entry.layer, entry.classification]
      : [entry.unit, entry.glossaryTerm?.term ?? ""];
  return [...common, ...specific].join(" ").toLowerCase();
}

function allows<T>(wanted: readonly T[] | undefined, value: T | null): boolean {
  if (wanted === undefined || wanted.length === 0) return true;
  return value !== null && wanted.includes(value);
}

/**
 * Searches the data catalog. Every word of `text` must appear in the
 * entry's id, name, description, owner, steward or stewardship domain, or,
 * for a product, its source domain, layer or classification, or, for a
 * metric, its unit or glossary term, ignoring case. Each facet that is set
 * must include the entry's value; a facet that applies only to products
 * leaves metrics out, and the metric status facet leaves products out.
 *
 * @param entries - Entries from `dataCatalog`.
 * @param query - The search.
 * @param domains - Stewardship domains, for their names; defaults to `GOVERNANCE_DOMAINS`.
 * @returns The matching entries, in their catalog order.
 */
export function searchDataCatalog(
  entries: readonly DataCatalogEntry[],
  query: DataCatalogQuery,
  domains: readonly GovernanceDomain[] = GOVERNANCE_DOMAINS
): DataCatalogEntry[] {
  const wanted = searchWords(query.text ?? "");
  return entries.filter((entry) => {
    const product = entry.kind === "product" ? entry : null;
    const metric = entry.kind === "metric" ? entry : null;
    if (!allows(query.kinds, entry.kind)) return false;
    if (!allows(query.stewardshipDomains, entry.stewardshipDomain)) {
      return false;
    }
    if (!allows(query.layers, product?.layer ?? null)) return false;
    if (!allows(query.classifications, product?.classification ?? null)) {
      return false;
    }
    if (!allows(query.slaStatuses, product?.slaStatus ?? null)) return false;
    if (!allows(query.metricStatuses, metric?.status ?? null)) return false;
    const text = entryText(entry, domains);
    return wanted.every((word) => text.includes(word));
  });
}

function countBy<T extends string>(
  order: readonly T[],
  values: readonly T[]
): CatalogFacetCount<T>[] {
  return order.map((value) => ({
    value,
    count: values.filter((v) => v === value).length,
  }));
}

/**
 * Counts catalog entries by each facet. Every value of a facet is listed in
 * its defined order, including values no entry takes, so a page can show a
 * stable set of filters.
 *
 * @param entries - Entries, for example the results of a search.
 * @param domains - Stewardship domains, for their order; defaults to `GOVERNANCE_DOMAINS`.
 * @returns The counts.
 */
export function dataCatalogFacets(
  entries: readonly DataCatalogEntry[],
  domains: readonly GovernanceDomain[] = GOVERNANCE_DOMAINS
): DataCatalogFacets {
  const products = entries.filter((e) => e.kind === "product");
  const metrics = entries.filter((e) => e.kind === "metric");
  return {
    kinds: countBy(
      ["product", "metric"],
      entries.map((e) => e.kind)
    ),
    stewardshipDomains: countBy(
      domains.map((d) => d.id),
      entries.map((e) => e.stewardshipDomain)
    ),
    layers: countBy(
      MEDALLION_LAYERS.map((l) => l.id),
      products.map((p) => p.layer)
    ),
    classifications: countBy(
      CLASSIFICATION_ORDER,
      products.map((p) => p.classification)
    ),
    slaStatuses: countBy(
      SLA_STATUSES,
      products.map((p) => p.slaStatus)
    ),
    metricStatuses: countBy(
      METRIC_STATUSES,
      metrics.map((m) => m.status)
    ),
  };
}
