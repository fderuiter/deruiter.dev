/**
 * The pipeline engine. A pure function of the study definition and options:
 * no DOM, no React, no Worker. Stages are added under `internal/` one issue
 * at a time; until then a run validates its inputs and returns an empty,
 * fully determined result.
 */
import { STANDARD_VERSIONS, SUBJECT_COUNT_LIMITS } from "../presets";
import type {
  Dataset,
  PipelineOptions,
  PipelineRun,
  StudyDefinition,
} from "../types";
import { generateCollectedData } from "./synth/generate-collected-data";
import { applyScenarios } from "./synth/scenarios";
import { deriveTrialDesign } from "./sdtm/trial-design";
import {
  deriveSubjectDomains,
  deriveSupplementalAe,
} from "./sdtm/subject-domains";
import { runConformance } from "./conformance/run-conformance";
import { deriveAdamDatasets } from "./adam/derive-adam";

const MAX_SEED = 0xffffffff;

function assertValidInputs(
  definition: StudyDefinition,
  options: PipelineOptions
): void {
  if (definition.studyId.trim() === "") {
    throw new RangeError("Study definition needs a non-empty studyId.");
  }
  if (
    !Number.isInteger(options.seed) ||
    options.seed < 0 ||
    options.seed > MAX_SEED
  ) {
    throw new RangeError(
      `Seed must be an integer from 0 to ${MAX_SEED}, got ${options.seed}.`
    );
  }
  const { min, max } = SUBJECT_COUNT_LIMITS;
  if (
    !Number.isInteger(options.nSubjects) ||
    options.nSubjects < min ||
    options.nSubjects > max
  ) {
    throw new RangeError(
      `nSubjects must be an integer from ${min} to ${max}, got ${options.nSubjects}.`
    );
  }
}

/**
 * The earliest informed consent date in the collected DM, which Trial Summary
 * records as the study start (SSTDTC, #3864). FDA's Study Data Technical
 * Conformance Guide defines the study start date as the earliest consent
 * date, and CORE-002115 compares SSTDTC with the earliest DM.RFICDTC, which is
 * this date. Partial or invalid dates are ignored, so the result is always a
 * full ISO 8601 date or null.
 */
function firstConsentDate(collected: readonly Dataset[]): string | null {
  const dm = collected.find((dataset) => dataset.name === "DM");
  const dates = (dm?.columns.CONSENTDTC ?? []).filter(
    (value): value is string =>
      typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  );
  return dates.length > 0
    ? dates.reduce((first, next) => (next < first ? next : first))
    : null;
}

/**
 * Runs the study data pipeline for one study definition.
 *
 * The same definition, seed and subject count always give the same result.
 *
 * @param definition - The study to run.
 * @param options - Seed and subject count.
 * @returns Datasets, findings and the reproducibility manifest.
 * @throws RangeError when the study id is empty or an option is out of range.
 */
export function runPipeline(
  definition: StudyDefinition,
  options: PipelineOptions
): PipelineRun {
  assertValidInputs(definition, options);
  const generated = generateCollectedData(definition, options);
  const scenarios = options.scenarios ?? [];
  const messy =
    scenarios.length > 0 ? applyScenarios(generated, scenarios) : null;
  const collected = messy?.datasets ?? generated;
  const trialDesign = deriveTrialDesign(
    definition,
    STANDARD_VERSIONS,
    firstConsentDate(collected)
  );
  const sdtmDatasets = [
    ...collected,
    ...trialDesign,
    ...deriveSubjectDomains(definition, collected, trialDesign),
  ];
  const analysis = deriveAdamDatasets(
    definition,
    sdtmDatasets.filter((dataset) => dataset.layer === "sdtm")
  );
  // SUPPAE carries the ADaM treatment-emergent flag, so it follows ADaM.
  const supplementalAe = deriveSupplementalAe(
    definition.studyId,
    sdtmDatasets.find(
      (dataset) => dataset.name === "AE" && dataset.layer === "sdtm"
    ),
    analysis.datasets.find((dataset) => dataset.name === "ADAE")
  );
  const datasets = [...sdtmDatasets, supplementalAe, ...analysis.datasets];
  const conformance = runConformance(datasets);
  return {
    datasets,
    findings: [...conformance.findings, ...analysis.findings],
    conformance: conformance.report,
    manifest: {
      studyId: definition.studyId,
      seed: options.seed,
      nSubjects: options.nSubjects,
      standards: STANDARD_VERSIONS,
      stages: ["usdm", "synth", "sdtm", "conformance", "adam"],
      outputs: [],
      ...(messy ? { scenarios: messy.applied } : {}),
    },
  };
}
