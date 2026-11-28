/**
 * Prepares a USDM v4 study from another tool (CRF Studio) for a pipeline run.
 *
 * The pipeline generates synthetic data for a fixed set of domains and a
 * fixed set of modelled tests, and `readStudyDefinition` rejects activities
 * and concepts it cannot tabulate. A handed-off study rarely fits exactly, so
 * this module narrows the document to the part the pipeline can run, fills
 * the design gaps it cannot run without, and reports every activity it
 * skipped and every assumption it made, so the visitor sees both before the
 * run starts. The input document is never mutated.
 */
import {
  USDM_SDTM_CAT_EXTENSION_URL,
  USDM_SDTM_DOMAIN_EXTENSION_URL,
  USDM_SDTM_STRESU_EXTENSION_URL,
  USDM_SDTM_TESTCD_EXTENSION_URL,
  getUsdmV4ExtensionString,
  resolveUsdmStudyDesign,
  type UsdmStudySelection,
  type UsdmV4Activity,
  type UsdmV4BiomedicalConcept,
  type UsdmV4Code,
  type UsdmV4ExtensionAttribute,
  type UsdmV4InterventionalStudyDesign,
  type UsdmV4StudyVersion,
} from "@/lib/clinical-standards";
import { getUsdmV4EncounterSchedule } from "@/lib/clinical-standards";
import { DEMO_301_STUDY, STANDARD_VERSIONS } from "../../presets";
import type { AssessmentDefinition, StudyDefinition } from "../../types";
import { QUESTIONNAIRE_SCORES } from "../synth/questionnaires";
import {
  StudyDefinitionError,
  readStudyDefinition,
} from "./read-study-definition";

/** Domains the synthetic generator produces source data for. */
export const HANDOFF_GENERATED_DOMAINS = Object.freeze([
  "DM",
  "SV",
  "EX",
  "CM",
  "VS",
  "LB",
  "EG",
  "TR",
  "PC",
  "AE",
  "DS",
  "CE",
  "QS",
  "DI",
  "DU",
  "DE",
] as const);

/** Domains whose assessments are generated per test code. */
const TESTED_DOMAINS = new Set(["VS", "LB", "EG", "QS", "TR", "PC", "DU"]);

/**
 * Extension URL CRF Studio uses to carry a field's full concept definition,
 * including its aCRF annotation (`VS.VSSTRESN [VSTESTCD=PULSE]`): its
 * `CRF_STUDIO_USDM_EXTENSION_BASE` plus `biomedical-concept`. Spelled out so
 * the pipeline worker does not import the CRF Studio adapter.
 */
const CRF_STUDIO_CONCEPT_EXTENSION_URL =
  "https://deruiter.dev/usdm/extensions/crf-studio/biomedical-concept";

/** Why an activity or concept was left out of the run. */
export type HandoffSkipReason =
  | "no-domain"
  | "domain-not-generated"
  | "no-modelled-tests"
  | "no-test-code"
  | "test-not-modelled";

/** One concept the run generates values for. */
export interface HandoffTest {
  readonly conceptId: string;
  readonly testCode: string;
  /** The unit the synthetic values are generated in; absent for a score. */
  readonly unit?: string;
  /** The category (`--CAT`), for a questionnaire score. */
  readonly category?: string;
  /** The unit the source study collects, when it names a different one. */
  readonly sourceUnit?: string;
}

/** One concept of a tabulated activity that the run leaves out. */
export interface HandoffSkippedConcept {
  readonly conceptId: string;
  readonly name: string;
  readonly reason: Extract<
    HandoffSkipReason,
    "no-test-code" | "test-not-modelled"
  >;
  readonly testCode?: string;
}

/** What the run does with one activity of the handed-off study. */
export interface HandoffActivity {
  readonly id: string;
  readonly name: string;
  readonly domain: string | null;
  readonly tabulated: boolean;
  /** Why the activity is not tabulated. Absent for tabulated activities. */
  readonly reason?: Extract<
    HandoffSkipReason,
    "no-domain" | "domain-not-generated" | "no-modelled-tests"
  >;
  readonly tests: readonly HandoffTest[];
  readonly skippedConcepts: readonly HandoffSkippedConcept[];
}

/**
 * A design element the run supplies because the study does not define it:
 * `single-arm` adds one Experimental Arm, `epochs-from-study-day` adds
 * Screening and Treatment epochs and places each visit by its planned study
 * day (before Day 1 is Screening), and `elements-per-epoch` adds one element
 * per epoch and the study cells joining them to the arms, so the trial design
 * domains have rows.
 */
export type HandoffAssumption =
  "single-arm" | "epochs-from-study-day" | "elements-per-epoch";

/** The supported-domains report shown before a handed-off run. */
export interface HandoffReport {
  readonly studyId: string;
  readonly title: string;
  readonly activities: readonly HandoffActivity[];
  /** Domains with at least one tabulated activity, in generator order. */
  readonly tabulatedDomains: readonly string[];
  /** Domains named by an activity that the run does not tabulate. */
  readonly notTabulatedDomains: readonly string[];
  readonly assumptions: readonly HandoffAssumption[];
  /**
   * Encounters with no timing that reaches the study anchor (unscheduled
   * visits). The run leaves them out; the generator adds its own unscheduled
   * visits.
   */
  readonly unplannedEncounters: readonly { id: string; name: string }[];
}

/** A handed-off study narrowed to what the pipeline can run. */
export interface StudyHandoff {
  readonly definition: StudyDefinition;
  readonly report: HandoffReport;
}

/** Tests and scores the synthetic generator models across tested SDTM domains. */
export const MODELLED_TESTS: ReadonlyMap<string, AssessmentDefinition> =
  new Map([
    ...DEMO_301_STUDY.design.activities.flatMap((activity) =>
      activity.assessments.map(
        (assessment) =>
          [`${activity.domain}:${assessment.testCode}`, assessment] as const
      )
    ),
    [
      "VS:HEIGHT",
      {
        conceptId: "bc_vs_height",
        nciCode: "",
        testCode: "HEIGHT",
        testName: "Height",
        unit: "cm",
      },
    ],
    [
      "VS:BMI",
      {
        conceptId: "bc_vs_bmi",
        nciCode: "",
        testCode: "BMI",
        testName: "Body Mass Index",
        unit: "kg/m2",
      },
    ],
    [
      "VS:TEMP",
      {
        conceptId: "bc_vs_temp",
        nciCode: "",
        testCode: "TEMP",
        testName: "Temperature",
        unit: "C",
      },
    ],
    [
      "VS:RESP",
      {
        conceptId: "bc_vs_resp",
        nciCode: "",
        testCode: "RESP",
        testName: "Respiratory Rate",
        unit: "breaths/min",
      },
    ],
    [
      "LB:NEUT",
      {
        conceptId: "bc_lb_neut",
        nciCode: "",
        testCode: "NEUT",
        testName: "Neutrophils",
        unit: "10^9/L",
      },
    ],
    [
      "EG:QTc",
      {
        conceptId: "bc_eg_qtc",
        nciCode: "",
        testCode: "QTc",
        testName: "QTc Interval",
        unit: "ms",
      },
    ],
    [
      "EG:QTC",
      {
        conceptId: "bc_eg_qtc_upper",
        nciCode: "",
        testCode: "QTC",
        testName: "QTc Interval",
        unit: "ms",
      },
    ],
    [
      "EG:QTCBAG",
      {
        conceptId: "bc_eg_qtcb",
        nciCode: "",
        testCode: "QTCBAG",
        testName: "QTcB Interval, Aggregate",
        unit: "ms",
      },
    ],
    ...Object.entries(QUESTIONNAIRE_SCORES).map(
      ([testCode, score]) =>
        [
          `QS:${testCode}`,
          {
            conceptId: `bc_qs_${testCode.toLowerCase()}`,
            nciCode: "",
            testCode,
            testName: score.testName,
            category: score.category,
          },
        ] as const
    ),
    [
      "TR:LDIAM",
      {
        conceptId: "bc_tr_ldiam",
        nciCode: "",
        testCode: "LDIAM",
        testName: "Longest Diameter",
        unit: "mm",
      },
    ],
    [
      "TR:SUMDIAM",
      {
        conceptId: "bc_tr_sumdiam",
        nciCode: "",
        testCode: "SUMDIAM",
        testName: "Sum of Diameters",
        unit: "mm",
      },
    ],
    [
      "TR:TUMSTATE",
      {
        conceptId: "bc_tr_tumstate",
        nciCode: "",
        testCode: "TUMSTATE",
        testName: "Tumor State",
      },
    ],
    [
      "PC:DRUGX",
      {
        conceptId: "bc_pc_drugx",
        nciCode: "",
        testCode: "DRUGX",
        testName: "Analyte Plasma Concentration",
        unit: "ng/mL",
      },
    ],
    [
      "DU:PROCDUR",
      {
        conceptId: "bc_du_procdur",
        nciCode: "",
        testCode: "PROCDUR",
        testName: "Procedure Duration",
        unit: "min",
      },
    ],
    [
      "DU:DEPOUT",
      {
        conceptId: "bc_du_depout",
        nciCode: "",
        testCode: "DEPOUT",
        testName: "Acute Deployment Outcome",
      },
    ],
  ]);

const CONCEPT_TEST_CODE_FALLBACKS: Readonly<Record<string, string>> = {
  "QS:QSEVAL1": "PHQ0101",
  "QS:QSEVAL2": "PHQ0102",
  "QS:QSEVAL3": "PHQ0103",
  "QS:QSEVAL4": "PHQ0104",
  "QS:QSSTRESN": "PHQ-9",
  "QS:bc_qs_qseval1": "PHQ0101",
  "QS:bc_qs_qseval2": "PHQ0102",
  "QS:bc_qs_qseval3": "PHQ0103",
  "QS:bc_qs_qseval4": "PHQ0104",
  "QS:bc_qs_qsstresn": "PHQ-9",
  "QS:QS_ORNT": "MMSEORNT",
  "QS:QS_REG": "MMSEREG",
  "QS:QS_ATTN": "MMSEATTN",
  "QS:QS_REC": "MMSEREC",
  "QS:QS_LANG": "MMSELANG",
  "QS:QS_TOTAL": "MMSE",
  "QS:bc_qs_qs_ornt": "MMSEORNT",
  "QS:bc_qs_qs_reg": "MMSEREG",
  "QS:bc_qs_qs_attn": "MMSEATTN",
  "QS:bc_qs_qs_rec": "MMSEREC",
  "QS:bc_qs_qs_lang": "MMSELANG",
  "QS:bc_qs_qs_total": "MMSE",
  "EG:EGHR": "EGHRMN",
  "EG:EGQT": "QTAG",
  "EG:EGRR": "RRAG",
  "EG:EGQTCB": "QTc",
  "EG:bc_eg_eghr": "EGHRMN",
  "EG:bc_eg_egqt": "QTAG",
  "EG:bc_eg_egrr": "RRAG",
  "EG:bc_eg_egqtcb": "QTc",
  "TR:TRL1": "LDIAM",
  "TR:TRL2": "LDIAM",
  "TR:TRSLDBAS": "SUMDIAM",
  "TR:TRSLDCUR": "SUMDIAM",
  "TR:TRRESP": "TUMSTATE",
  "TR:bc_tr_trl1": "LDIAM",
  "TR:bc_tr_trl2": "LDIAM",
  "TR:bc_tr_trsldbas": "SUMDIAM",
  "TR:bc_tr_trsldcur": "SUMDIAM",
  "TR:bc_tr_trresp": "TUMSTATE",
  "PC:PCTIME00": "DRUGX",
  "PC:PCTIME05": "DRUGX",
  "PC:PCTIME_1": "DRUGX",
  "PC:PCTIME_2": "DRUGX",
  "PC:PCTIME_4": "DRUGX",
  "PC:PCTIME_8": "DRUGX",
  "PC:PCTIME24": "DRUGX",
  "PC:bc_pc_pctime00": "DRUGX",
  "PC:bc_pc_pctime05": "DRUGX",
  "PC:bc_pc_pctime_1": "DRUGX",
  "PC:bc_pc_pctime_2": "DRUGX",
  "PC:bc_pc_pctime_4": "DRUGX",
  "PC:bc_pc_pctime_8": "DRUGX",
  "PC:bc_pc_pctime24": "DRUGX",
  "DU:DUDUR": "PROCDUR",
  "DU:DUORRES": "DEPOUT",
  "DU:bc_du_dudur": "PROCDUR",
  "DU:bc_du_duorres": "DEPOUT",
};

const SYNTHETIC_ARM_ID = "handoff_arm_trt";
const SCREENING_EPOCH_ID = "handoff_epoch_screening";
const TREATMENT_EPOCH_ID = "handoff_epoch_treatment";
const CT_SYSTEM = "http://www.cdisc.org";

function ct(id: string, code: string, decode: string): UsdmV4Code {
  return {
    id,
    code,
    codeSystem: CT_SYSTEM,
    codeSystemVersion: STANDARD_VERSIONS["NCI-EVS-CT"],
    decode,
    instanceType: "Code",
  };
}

function ext(id: string, url: string, value: string): UsdmV4ExtensionAttribute {
  return { id, url, valueString: value, instanceType: "ExtensionAttribute" };
}

function list<T>(value: readonly T[] | undefined | null): readonly T[] {
  return Array.isArray(value) ? value : [];
}

function crfConcept(concept: UsdmV4BiomedicalConcept): {
  annotation?: string;
  unit?: string;
  variableName?: string;
} {
  const raw = getUsdmV4ExtensionString(
    concept,
    CRF_STUDIO_CONCEPT_EXTENSION_URL
  );
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as {
      variableName?: unknown;
      unit?: unknown;
      properties?: {
        unit?: unknown;
        cdashMetadata?: { acrfAnnotation?: unknown };
      };
    };
    const annotation = parsed.properties?.cdashMetadata?.acrfAnnotation;
    const unit =
      typeof parsed.properties?.unit === "string"
        ? parsed.properties.unit
        : typeof parsed.unit === "string"
          ? parsed.unit
          : undefined;
    const variableName = parsed.variableName;
    return {
      ...(typeof annotation === "string" ? { annotation } : {}),
      ...(typeof unit === "string" ? { unit } : {}),
      ...(typeof variableName === "string" ? { variableName } : {}),
    };
  } catch {
    return {};
  }
}

/**
 * The SDTM test short name of a concept: the SDTM test code extension when
 * present, otherwise the `--TESTCD` value in CRF Studio's aCRF annotation or
 * known CRF/USDM field mapping.
 */
function testCodeOf(
  concept: UsdmV4BiomedicalConcept,
  domain: string
): string | undefined {
  const explicit = getUsdmV4ExtensionString(
    concept,
    USDM_SDTM_TESTCD_EXTENSION_URL
  );
  if (explicit) return explicit;
  const { annotation, variableName } = crfConcept(concept);
  const match = annotation?.match(
    new RegExp(`\\[${domain}TESTCD=([A-Za-z][A-Za-z0-9-]{0,7})\\]`)
  );
  if (match?.[1]) return match[1];
  if (variableName) {
    const byVar = CONCEPT_TEST_CODE_FALLBACKS[`${domain}:${variableName}`];
    if (byVar) return byVar;
  }
  return CONCEPT_TEST_CODE_FALLBACKS[`${domain}:${concept.id}`];
}

function planActivity(
  activity: UsdmV4Activity,
  conceptsById: ReadonlyMap<string, UsdmV4BiomedicalConcept>
): HandoffActivity {
  const domain =
    getUsdmV4ExtensionString(activity, USDM_SDTM_DOMAIN_EXTENSION_URL) ?? null;
  const base = { id: activity.id, name: activity.name, domain };
  if (!domain) {
    return {
      ...base,
      tabulated: false,
      reason: "no-domain",
      tests: [],
      skippedConcepts: [],
    };
  }
  if (!(HANDOFF_GENERATED_DOMAINS as readonly string[]).includes(domain)) {
    return {
      ...base,
      tabulated: false,
      reason: "domain-not-generated",
      tests: [],
      skippedConcepts: [],
    };
  }
  if (!TESTED_DOMAINS.has(domain)) {
    return { ...base, tabulated: true, tests: [], skippedConcepts: [] };
  }
  const tests: HandoffTest[] = [];
  const skippedConcepts: HandoffSkippedConcept[] = [];
  const seen = new Set<string>();
  for (const conceptId of list(activity.biomedicalConceptIds)) {
    const concept = conceptsById.get(conceptId);
    if (!concept) continue;
    const testCode = testCodeOf(concept, domain);
    if (!testCode) {
      skippedConcepts.push({
        conceptId,
        name: concept.name,
        reason: "no-test-code",
      });
      continue;
    }
    // Questionnaire scores and categorical findings are modelled without a unit.
    const score = domain === "QS" ? QUESTIONNAIRE_SCORES[testCode] : undefined;
    const model = MODELLED_TESTS.get(`${domain}:${testCode}`);
    const modelled =
      domain === "QS"
        ? score !== undefined || model !== undefined
        : model !== undefined;
    if (!modelled || seen.has(testCode)) {
      if (!modelled) {
        skippedConcepts.push({
          conceptId,
          name: concept.name,
          reason: "test-not-modelled",
          testCode,
        });
      }
      continue;
    }
    seen.add(testCode);
    const sourceUnit =
      getUsdmV4ExtensionString(concept, USDM_SDTM_STRESU_EXTENSION_URL) ??
      crfConcept(concept).unit;
    if (score || (domain === "QS" && model)) {
      tests.push({
        conceptId,
        testCode,
        category:
          getUsdmV4ExtensionString(concept, USDM_SDTM_CAT_EXTENSION_URL) ??
          score?.category ??
          model?.category,
      });
      continue;
    }
    const unit = model!.unit;
    tests.push({
      conceptId,
      testCode,
      ...(unit === undefined
        ? {}
        : {
            unit,
            ...(sourceUnit && sourceUnit !== unit ? { sourceUnit } : {}),
          }),
    });
  }
  if (tests.length === 0) {
    return {
      ...base,
      tabulated: false,
      reason: "no-modelled-tests",
      tests,
      skippedConcepts,
    };
  }
  return { ...base, tabulated: true, tests, skippedConcepts };
}

function withExtensions(
  concept: UsdmV4BiomedicalConcept,
  test: HandoffTest
): UsdmV4BiomedicalConcept {
  const kept = list(concept.extensionAttributes).filter(
    (attr) =>
      attr.url !== USDM_SDTM_TESTCD_EXTENSION_URL &&
      attr.url !== USDM_SDTM_STRESU_EXTENSION_URL &&
      attr.url !== USDM_SDTM_CAT_EXTENSION_URL
  );
  return {
    ...concept,
    extensionAttributes: [
      ...kept,
      ext(
        `${concept.id}_handoff_testcd`,
        USDM_SDTM_TESTCD_EXTENSION_URL,
        test.testCode
      ),
      ...(test.unit === undefined
        ? []
        : [
            ext(
              `${concept.id}_handoff_stresu`,
              USDM_SDTM_STRESU_EXTENSION_URL,
              test.unit
            ),
          ]),
      ...(test.category === undefined
        ? []
        : [
            ext(
              `${concept.id}_handoff_cat`,
              USDM_SDTM_CAT_EXTENSION_URL,
              test.category
            ),
          ]),
    ],
  };
}

function narrowDesign(
  design: UsdmV4InterventionalStudyDesign,
  plans: readonly HandoffActivity[],
  assumptions: HandoffAssumption[],
  unplannedEncounterIds: Set<string>
): UsdmV4InterventionalStudyDesign {
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const tabulated = new Set(
    plans.filter((plan) => plan.tabulated).map((plan) => plan.id)
  );
  const activities = list(design.activities)
    .filter((activity) => tabulated.has(activity.id))
    .map((activity) => ({
      ...activity,
      biomedicalConceptIds: (planById.get(activity.id)?.tests ?? []).map(
        (test) => test.conceptId
      ),
    }));

  const needsEpochs = list(design.epochs).length === 0;
  const dayByInstance = new Map(
    getUsdmV4EncounterSchedule(design).map((entry) => [
      entry.scheduledInstanceId,
      entry.targetDay,
    ])
  );
  const scheduleTimelines = list(design.scheduleTimelines).map((timeline) => ({
    ...timeline,
    instances: list(timeline.instances)
      .filter((instance) => {
        const unplanned = dayByInstance.get(instance.id) === null;
        if (unplanned && instance.encounterId) {
          unplannedEncounterIds.add(instance.encounterId);
        }
        return !unplanned;
      })
      .map((instance) => {
        const day = dayByInstance.get(instance.id);
        return {
          ...instance,
          activityIds: list(instance.activityIds).filter((id) =>
            tabulated.has(id)
          ),
          ...(needsEpochs
            ? {
                epochId:
                  day !== undefined && day !== null && day < 1
                    ? SCREENING_EPOCH_ID
                    : TREATMENT_EPOCH_ID,
              }
            : {}),
        };
      }),
  }));

  let epochs = list(design.epochs);
  if (needsEpochs) {
    assumptions.push("epochs-from-study-day");
    epochs = [
      {
        id: SCREENING_EPOCH_ID,
        name: "SCREENING",
        label: "Screening",
        description: null,
        type: ct(`${SCREENING_EPOCH_ID}_type`, "C202487", "Screening"),
        previousId: null,
        nextId: TREATMENT_EPOCH_ID,
        instanceType: "StudyEpoch",
      },
      {
        id: TREATMENT_EPOCH_ID,
        name: "TREATMENT",
        label: "Treatment",
        description: null,
        type: ct(`${TREATMENT_EPOCH_ID}_type`, "C101526", "Treatment"),
        previousId: SCREENING_EPOCH_ID,
        nextId: null,
        instanceType: "StudyEpoch",
      },
    ];
  }

  let arms = list(design.arms);
  if (arms.length === 0) {
    assumptions.push("single-arm");
    arms = [
      {
        id: SYNTHETIC_ARM_ID,
        name: "Study treatment",
        label: "TRT",
        description:
          "Single arm supplied for the run because the study defines none.",
        type: ct(`${SYNTHETIC_ARM_ID}_type`, "C174266", "Experimental Arm"),
        dataOriginDescription: "Synthetic data generated for this run",
        dataOriginType: ct(
          `${SYNTHETIC_ARM_ID}_origin`,
          "C188866",
          "Data Generated Within Study"
        ),
        populationIds: [],
        instanceType: "StudyArm",
      },
    ];
  }

  let elements = list(design.elements);
  let studyCells = list(design.studyCells);
  if (studyCells.length === 0) {
    assumptions.push("elements-per-epoch");
    // One element per epoch, so the trial design domains (TA, TE) have rows.
    const handoffElements = epochs.map((epoch) => ({
      id: `handoff_element_${epoch.id}`,
      name: epoch.label ?? epoch.name,
      label: (epoch.label ?? epoch.name).slice(0, 8).toUpperCase(),
      description: `${epoch.label ?? epoch.name} element supplied for the run.`,
      studyInterventionIds: [],
      instanceType: "StudyElement" as const,
    }));
    elements = [...elements, ...handoffElements];
    studyCells = arms.flatMap((arm) =>
      epochs.map((epoch, idx) => ({
        id: `handoff_cell_${arm.id}_${epoch.id}`,
        armId: arm.id,
        epochId: epoch.id,
        elementIds: [handoffElements[idx].id],
        instanceType: "StudyCell" as const,
      }))
    );
  }

  return {
    ...design,
    activities,
    epochs: [...epochs],
    arms: [...arms],
    elements: [...elements],
    studyCells: [...studyCells],
    scheduleTimelines,
  };
}

/**
 * Narrows a USDM v4 document to the activities and tests the pipeline can
 * generate, supplies a single arm and Screening/Treatment epochs when the
 * design has none, and reads the result into a `StudyDefinition`.
 *
 * Activities whose SDTM domain the generator does not produce are listed as
 * not tabulated rather than failing the read. Within VS and LB, a concept is
 * kept only when its test is one the generator models; values are generated
 * in the modelled unit, and the report names the source unit when it differs.
 *
 * @param usdm - A parsed USDM v4.0 document, for example a CRF Studio export.
 * @param selection - The study version and design to run, by id; needed when
 *   the document holds more than one of either.
 * @returns The runnable definition and the supported-domains report.
 * @throws StudyDefinitionError when the document is not a USDM v4 study or
 *   still fails to read after narrowing.
 */
export function prepareStudyHandoff(
  usdm: unknown,
  selection?: UsdmStudySelection
): StudyHandoff {
  if (!usdm || typeof usdm !== "object") {
    throw new StudyDefinitionError("expected a JSON object");
  }
  const doc = usdm as {
    study?: { versions?: UsdmV4StudyVersion[] } & Record<string, unknown>;
  } & Record<string, unknown>;
  const resolved = resolveUsdmStudyDesign(doc.study, selection);
  if (!resolved.ok) {
    // Let the reader produce its precise error for the malformed document.
    readStudyDefinition(usdm, selection);
    throw new StudyDefinitionError(resolved.message);
  }
  const { version, design, versionIndex, designIndex } = resolved;

  const conceptsById = new Map(
    list(version.biomedicalConcepts).map((concept) => [concept.id, concept])
  );
  const plans = list(design.activities).map((activity) =>
    planActivity(activity, conceptsById)
  );
  const assumptions: HandoffAssumption[] = [];
  const unplannedEncounterIds = new Set<string>();
  const narrowed = narrowDesign(
    design,
    plans,
    assumptions,
    unplannedEncounterIds
  );

  const testsByConcept = new Map(
    plans.flatMap((plan) => plan.tests.map((test) => [test.conceptId, test]))
  );
  const biomedicalConcepts = list(version.biomedicalConcepts)
    .filter((concept) => testsByConcept.has(concept.id))
    .map((concept) =>
      withExtensions(concept, testsByConcept.get(concept.id) as HandoffTest)
    );

  const definition = readStudyDefinition(
    {
      ...doc,
      study: {
        ...doc.study,
        versions: list(doc.study?.versions).map((each, i) =>
          i === versionIndex
            ? {
                ...version,
                biomedicalConcepts,
                studyDesigns: list(version.studyDesigns).map((d, j) =>
                  j === designIndex ? narrowed : d
                ),
              }
            : each
        ),
      },
    },
    selection
  );

  const tabulated = new Set(
    plans.filter((plan) => plan.tabulated).map((plan) => plan.domain as string)
  );
  const notTabulated = [
    ...new Set(
      plans
        .filter((plan) => !plan.tabulated && plan.domain)
        .map((plan) => plan.domain as string)
        .filter((domain) => !tabulated.has(domain))
    ),
  ].sort();

  return {
    definition: { ...definition, usdm },
    report: {
      studyId: definition.studyId,
      title: definition.title,
      activities: plans,
      tabulatedDomains: HANDOFF_GENERATED_DOMAINS.filter((domain) =>
        tabulated.has(domain)
      ),
      notTabulatedDomains: notTabulated,
      assumptions,
      unplannedEncounters: list(design.encounters)
        .filter((encounter) => unplannedEncounterIds.has(encounter.id))
        .map((encounter) => ({ id: encounter.id, name: encounter.name })),
    },
  };
}
