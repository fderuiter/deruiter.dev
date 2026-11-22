import {
  CLINICAL_STANDARDS_PROFILE,
  type UsdmV4Document,
} from "@/lib/clinical-standards";
import type { BlankStudyPlaceholder, BlankStudyWorkspace } from "../types";
import { importUsdmStudy } from "./import";

/** The USDM version a blank study is written in. */
const BLANK_USDM_VERSION = "4.0.0";

/** Fixed ids, so two blank studies are byte-identical. */
const VERSION_ID = "StudyVersion_1";
const DESIGN_ID = "InterventionalStudyDesign_1";
const POPULATION_ID = "StudyDesignPopulation_1";
const MODEL_ID = "Code_1";

/**
 * The CDISC Intervention Model term the USDM v4 schema requires on every
 * interventional design: C82639 "Parallel Study" in codelist C99076
 * (INTMODEL), the same term the reference studies use. It is shown to the
 * person as a placeholder, not offered as a decision made for them.
 */
const PARALLEL_STUDY_CODE = "C82639";
const PARALLEL_STUDY_DECODE = "Parallel Study";

/** Options for `createBlankStudyWorkspace`. */
export interface CreateBlankStudyOptions {
  /** The study name; "Untitled study" when not given. */
  readonly name?: string;
}

/**
 * The blank USDM v4 document: one study version holding one interventional
 * design with no arms, epochs, cells or criteria. It holds only what the
 * USDM v4.0.0 Wrapper schema requires.
 */
function blankDocument(name: string): UsdmV4Document {
  return {
    usdmVersion: BLANK_USDM_VERSION,
    systemName: null,
    systemVersion: null,
    study: {
      id: null,
      name,
      instanceType: "Study",
      versions: [
        {
          id: VERSION_ID,
          versionIdentifier: "1",
          rationale: "",
          studyIdentifiers: [],
          titles: [],
          instanceType: "StudyVersion",
          studyDesigns: [
            {
              id: DESIGN_ID,
              name: "Design 1",
              rationale: "",
              arms: [],
              epochs: [],
              studyCells: [],
              eligibilityCriteria: [],
              population: {
                id: POPULATION_ID,
                name: "Study population",
                includesHealthySubjects: false,
                instanceType: "StudyDesignPopulation",
              },
              model: {
                id: MODEL_ID,
                code: PARALLEL_STUDY_CODE,
                codeSystem: "http://www.cdisc.org",
                codeSystemVersion: CLINICAL_STANDARDS_PROFILE.CT.packageDate,
                decode: PARALLEL_STUDY_DECODE,
                instanceType: "Code",
              },
              instanceType: "InterventionalStudyDesign",
            },
          ],
        },
      ],
    },
  } as unknown as UsdmV4Document;
}

const DESIGN_PATH = "study.versions.0.studyDesigns.0";

/** What the blank study fills in only because the schema requires it. */
function placeholders(): readonly BlankStudyPlaceholder[] {
  return [
    {
      path: "study.versions.0.versionIdentifier",
      label: "Study version",
      value: "1",
    },
    { path: `${DESIGN_PATH}.name`, label: "Design name", value: "Design 1" },
    {
      path: `${DESIGN_PATH}.population.name`,
      label: "Population",
      value: "Study population",
    },
    {
      path: `${DESIGN_PATH}.population.includesHealthySubjects`,
      label: "Includes healthy subjects",
      value: "No",
    },
    {
      path: `${DESIGN_PATH}.model`,
      label: "Intervention model",
      value: `${PARALLEL_STUDY_DECODE} (${PARALLEL_STUDY_CODE})`,
    },
  ];
}

/**
 * Starts a workspace from a blank study, for when there is no study to
 * import. The document holds only what the USDM v4 schema requires, and
 * every value filled in only to satisfy the schema is listed in
 * `placeholders` so the studio can show it. Two calls with the same name
 * give byte-identical workspaces.
 */
export async function createBlankStudyWorkspace(
  options: CreateBlankStudyOptions = {}
): Promise<BlankStudyWorkspace> {
  const name = options.name?.trim() || "Untitled study";
  const result = await importUsdmStudy(
    { document: blankDocument(name) },
    {
      selection: { studyVersionId: VERSION_ID, studyDesignId: DESIGN_ID },
    }
  );
  if (result.status !== "ok") {
    // The blank document is fixed, so this is a bug in this module.
    throw new Error(`The blank study did not import: ${result.status}.`);
  }
  const { workspace } = result;
  return {
    workspace: {
      ...workspace,
      revision: { ...workspace.revision, note: "Started from a blank study." },
    },
    schemaIssues: result.report.schemaIssues,
    placeholders: placeholders(),
  };
}
