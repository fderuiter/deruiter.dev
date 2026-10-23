/**
 * Study Data Pipeline: pinned standards, stage catalogue and defaults.
 *
 * Changing a version here is a controlled upgrade with an impact report, not
 * an edit (ADR 0065).
 */
import { readStudyDefinition } from "./internal/usdm/read-study-definition";
import { DEMO_301_USDM } from "./presets/demo-301";
import type { PipelineStage, StandardVersions, StudyDefinition } from "./types";
export { ADAM_METHODS } from "./internal/adam/specs";
export type { AdamMethodId } from "./internal/adam/specs";

/**
 * The standard versions every run applies and declares in TS, Define-XML and
 * the run manifest. The CT entry is the date of the NCI EVS CDISC
 * Controlled Terminology package that the local codelist subset is aligned
 * to. The subset is hand-curated and has not been verified against that
 * package, so it is not a claim of conformance to it.
 */
export const STANDARD_VERSIONS: StandardVersions = Object.freeze({
  USDM: "4.0",
  SDTM: "2.0",
  SDTMIG: "3.4",
  ADaM: "2.1",
  ADaMIG: "1.3",
  "Define-XML": "2.1",
  "Dataset-JSON": "1.1",
  ARS: "1.0",
  "NCI-EVS-CT": "2026-09-25",
});

/** Pipeline stages in execution order. */
export const PIPELINE_STAGES: readonly PipelineStage[] = Object.freeze([
  {
    id: "usdm",
    label: "Study definition",
    summary: "Reads the USDM study design: arms, epochs, visits, activities.",
  },
  {
    id: "synth",
    label: "Collected data",
    summary: "Generates seeded synthetic subjects from the USDM schedule.",
  },
  {
    id: "sdtm",
    label: "SDTM",
    summary: "Tabulates trial design and subject domains.",
  },
  {
    id: "conformance",
    label: "Conformance",
    summary: "Checks datasets against controlled terminology and rule ids.",
  },
  {
    id: "adam",
    label: "ADaM",
    summary: "Derives analysis datasets traceable to SDTM records.",
  },
  {
    id: "define",
    label: "Define-XML",
    summary: "Generates dataset metadata from the same specifications.",
  },
  {
    id: "export",
    label: "Package",
    summary: "Serialises Dataset-JSON, CSV and XPT with a hashed manifest.",
  },
  {
    id: "tlf",
    label: "Tables and figures",
    summary: "Produces analysis results linked through ARS.",
  },
  {
    id: "lineage",
    label: "Lineage",
    summary: "Links every result back to the record that produced it.",
  },
] as const satisfies readonly PipelineStage[]);

/** Seed used when the visitor has not chosen one. */
export const DEFAULT_SEED = 301;

/** Subject count used when the visitor has not chosen one. */
export const DEFAULT_SUBJECT_COUNT = 90;

/** Inclusive bounds on the subject count a run accepts. */
export const SUBJECT_COUNT_LIMITS = Object.freeze({ min: 1, max: 5000 });

/** Notice carried by every dataset, table and download. */
export const SYNTHETIC_DATA_NOTICE =
  "Synthetic data for demonstration. Not from any real study.";

/**
 * The fictional DEMO-301 study as a USDM v4.0.0 document: randomised,
 * double-blind, placebo-controlled, three arms, seven visits from screening
 * to end of study.
 */
export { DEMO_301_USDM };

/** DEMO-301 read into the pipeline's study definition. */
export const DEMO_301_STUDY: StudyDefinition =
  readStudyDefinition(DEMO_301_USDM);
