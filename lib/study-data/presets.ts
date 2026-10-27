/**
 * Study Data Pipeline: pinned standards, stage catalogue and defaults.
 *
 * Changing a version here is a controlled upgrade with an impact report, not
 * an edit (ADR 0065).
 */
import { readStudyDefinition } from "./internal/usdm/read-study-definition";
import { DEMO_301_USDM } from "./presets/demo-301";
import { CLINICAL_STANDARDS_PROFILE } from "@/lib/clinical-standards";
import type { PipelineStage, StandardVersions, StudyDefinition } from "./types";
export { ADAM_METHODS } from "./internal/adam/specs";
export type { AdamMethodId } from "./internal/adam/specs";
export {
  CLINICAL_STANDARDS_PROFILE,
  controlledTerminologyCitation,
  standardCitation,
} from "@/lib/clinical-standards";
export type {
  ClinicalStandardsProfile,
  ControlledTerminologyClaim,
  ProfileStandard,
} from "@/lib/clinical-standards";
export { SDTM_METHODS } from "./internal/sdtm/methods";
export type { SdtmMethodId } from "./internal/sdtm/methods";
export {
  CONTROLLED_TERMINOLOGY,
  DECODE_VARIABLES,
} from "@/lib/clinical-standards";
export type {
  CodelistId,
  TerminologyCodelist,
  TerminologyTerm,
} from "@/lib/clinical-standards";
export { VALUE_LEVEL } from "./internal/define/value-level";
export type { ValueLevelSpec } from "./internal/define/value-level";

/**
 * The standard versions every run applies and declares in TS, Define-XML and
 * the run manifest. The CT entry is the date of the NCI EVS CDISC
 * Controlled Terminology package that the local codelist subset is aligned
 * to. The subset is hand-curated; every NCI code, codelist and term in it
 * is checked against that release by `__tests__/cdisc-ct-release.test.ts`. It
 * covers only what the pipeline uses, so it is not a claim of conformance to
 * the whole package. Every value comes from {@link CLINICAL_STANDARDS_PROFILE}.
 */
export const STANDARD_VERSIONS: StandardVersions = Object.freeze({
  USDM: CLINICAL_STANDARDS_PROFILE.USDM,
  SDTM: CLINICAL_STANDARDS_PROFILE.SDTM,
  SDTMIG: CLINICAL_STANDARDS_PROFILE.SDTMIG,
  ADaM: CLINICAL_STANDARDS_PROFILE.ADaM,
  ADaMIG: CLINICAL_STANDARDS_PROFILE.ADaMIG,
  OCCDS: CLINICAL_STANDARDS_PROFILE.OCCDS,
  "ADaM-CR": CLINICAL_STANDARDS_PROFILE["ADaM-CR"],
  "Define-XML": CLINICAL_STANDARDS_PROFILE["Define-XML"],
  "Dataset-JSON": CLINICAL_STANDARDS_PROFILE["Dataset-JSON"],
  ARS: CLINICAL_STANDARDS_PROFILE.ARS,
  "NCI-EVS-CT": CLINICAL_STANDARDS_PROFILE.CT.packageDate,
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
