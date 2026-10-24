/**
 * Clinical Data Platform: layers, stage catalogue and policy wording.
 *
 * The constants a page or a later stage reads to stay consistent with
 * ADR 0066.
 */
import type {
  DqDimension,
  LayerDefinition,
  MedallionLayer,
  PlatformStage,
} from "./types";

/** The medallion layers, in the direction data flows. */
export const MEDALLION_LAYERS: readonly LayerDefinition[] = Object.freeze([
  {
    id: "bronze",
    label: "Bronze",
    summary:
      "Raw source feeds (EDC, CTMS, IRT, eTMF, finance, a legacy export), kept as received.",
  },
  {
    id: "silver",
    label: "Silver",
    summary:
      "Conformed, quality-checked data products, each under a versioned contract.",
  },
  {
    id: "gold",
    label: "Gold",
    summary:
      "Star-schema marts for operations, portfolio and RBQM, plus SDTM and ADaM from the Study Data Pipeline.",
  },
] as const satisfies readonly LayerDefinition[]);

/** Position of each layer in the flow; data may only move to an equal or higher rank. */
export const LAYER_RANK: Readonly<Record<MedallionLayer, number>> =
  Object.freeze({ bronze: 0, silver: 1, gold: 2 });

/** The private stage folders under `internal/`, in dependency order. */
export const PLATFORM_STAGES: readonly PlatformStage[] = Object.freeze([
  {
    id: "portfolio",
    label: "Portfolio",
    summary: "Seeded synthetic portfolio and its bronze operational feeds.",
  },
  {
    id: "warehouse",
    label: "Warehouse",
    summary:
      "Silver and gold star schemas, with DDL for DuckDB, PostgreSQL and T-SQL.",
  },
  {
    id: "semantic",
    label: "Semantic layer",
    summary:
      "The governed metric registry and its compilers to SQL, MetricFlow and TMDL.",
  },
  {
    id: "quality",
    label: "Data quality",
    summary: "Rules by DAMA dimension, results and scorecards.",
  },
  {
    id: "governance",
    label: "Governance",
    summary: "Catalog, glossary, stewardship and data contracts.",
  },
  {
    id: "lineage",
    label: "Lineage",
    summary: "Column-level lineage as OpenLineage, with impact analysis.",
  },
  {
    id: "rbqm",
    label: "RBQM",
    summary:
      "Key risk indicators, quality tolerance limits and central monitoring.",
  },
  {
    id: "migration",
    label: "Migration",
    summary: "Legacy extract mapping, reconciliation and cutover planning.",
  },
  {
    id: "interop",
    label: "Interoperability",
    summary: "Adapters for FHIR R4, HL7 v2, ODM and Dataset-JSON.",
  },
  {
    id: "strategy",
    label: "Strategy",
    summary: "Vendor scoring, build-or-buy and total cost of ownership models.",
  },
] as const satisfies readonly PlatformStage[]);

/** Data quality dimensions, after DAMA-DMBOK. */
export const DQ_DIMENSIONS: readonly DqDimension[] = Object.freeze([
  "completeness",
  "validity",
  "uniqueness",
  "consistency",
  "timeliness",
  "accuracy",
] as const satisfies readonly DqDimension[]);

/**
 * Id of the data product the Study Data Pipeline (ADR 0065) publishes into
 * the gold layer.
 */
export const STUDY_DATA_PRODUCT_ID = "study-data-pipeline";

/** Notice carried by every platform page, table and download. */
export const SYNTHETIC_DATA_NOTICE =
  "Synthetic data for demonstration. Every study, site, subject and vendor is fictional.";

/**
 * Wording every regulatory page uses in place of a compliance or validation
 * claim (ADR 0066).
 */
export const REGULATORY_WORDING =
  "Designed to these controls. Not a validated system and not a compliance claim.";

/**
 * Seed of the default portfolio every platform page and golden file uses.
 * It equals the Study Data Pipeline's default seed, so the default
 * portfolio's DEMO-301 is the pipeline's default run. Any other integer seed
 * gives a different portfolio of the same shape.
 */
export const DEFAULT_PORTFOLIO_SEED = 301;

/**
 * `valid_to` of the version of a slowly changing dimension member that is
 * still in force. A far-future date rather than `null`, so a join on
 * `date >= valid_from AND date < valid_to` needs no null test.
 */
export const SCD2_OPEN_END = "9999-12-31";
