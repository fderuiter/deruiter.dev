/**
 * The pipeline engine. A pure function of the study definition and options:
 * no DOM, no React, no Worker. Stages are added under `internal/` one issue
 * at a time; until then a run validates its inputs and returns an empty,
 * fully determined result.
 */
import { STANDARD_VERSIONS, SUBJECT_COUNT_LIMITS } from "../presets";
import type { PipelineOptions, PipelineRun, StudyDefinition } from "../types";
import { generateCollectedData } from "./synth/generate-collected-data";
import { deriveTrialDesign } from "./sdtm/trial-design";
import { deriveSubjectDomains } from "./sdtm/subject-domains";
import { runConformance } from "./conformance/run-conformance";

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
  const collected = generateCollectedData(definition, options);
  const trialDesign = deriveTrialDesign(definition, STANDARD_VERSIONS);
  const datasets = [
    ...collected,
    ...trialDesign,
    ...deriveSubjectDomains(definition, collected, trialDesign),
  ];
  const conformance = runConformance(datasets);
  return {
    datasets,
    findings: conformance.findings,
    conformance: conformance.report,
    manifest: {
      studyId: definition.studyId,
      seed: options.seed,
      nSubjects: options.nSubjects,
      standards: STANDARD_VERSIONS,
      stages: ["usdm", "synth", "sdtm", "conformance"],
      outputs: [],
    },
  };
}
