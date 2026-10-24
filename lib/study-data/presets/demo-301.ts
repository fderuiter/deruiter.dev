/**
 * DEMO-301: the pipeline's study, as a USDM v4.0 document.
 *
 * Fictional and synthetic. "A randomised, double-blind, placebo-controlled
 * study of Demoxacin in adults with mild hypertension": three parallel arms
 * (Placebo, Demoxacin low dose, Demoxacin high dose), a screening epoch, a
 * 12-week treatment epoch and a two-week follow-up. Demoxacin, its sponsor
 * and every value here are invented; nothing comes from a real study.
 *
 * The document is checked against the official USDM v4.0.0 schema in the test
 * suite. Codes are NCI EVS CDISC Controlled Terminology codes where one
 * exists; values with no CT home use the sponsor code system
 * `https://deruiter.dev/study-data`. Checking every code against the CT
 * package is left to CDISC CORE (#2603). Three extension attributes carry the
 * SDTM hints USDM v4 has no property for: an activity's domain, and a
 * biomedical concept's test code and standard unit.
 */
import { CLINICAL_STANDARDS_PROFILE } from "../standards";
import {
  USDM_SDTM_DOMAIN_EXTENSION_URL,
  USDM_SDTM_STRESU_EXTENSION_URL,
  USDM_SDTM_TESTCD_EXTENSION_URL,
  USDM_V4_VERSION,
  type UsdmV4Activity,
  type UsdmV4AliasCode,
  type UsdmV4BiomedicalConcept,
  type UsdmV4Code,
  type UsdmV4Document,
  type UsdmV4Encounter,
  type UsdmV4ExtensionAttribute,
  type UsdmV4ScheduledActivityInstance,
  type UsdmV4Timing,
} from "@/lib/crf/usdm-v4-types";

const CT_SYSTEM = "http://www.cdisc.org";
const CT_VERSION = CLINICAL_STANDARDS_PROFILE.CT.packageDate;
const SPONSOR_SYSTEM = "https://deruiter.dev/study-data";

function ct(id: string, code: string, decode: string): UsdmV4Code {
  return {
    id,
    code,
    codeSystem: CT_SYSTEM,
    codeSystemVersion: CT_VERSION,
    decode,
    instanceType: "Code",
  };
}

function sponsorCode(id: string, code: string, decode: string): UsdmV4Code {
  return {
    id,
    code,
    codeSystem: SPONSOR_SYSTEM,
    codeSystemVersion: "1.0",
    decode,
    instanceType: "Code",
  };
}

function alias(id: string, standardCode: UsdmV4Code): UsdmV4AliasCode {
  return {
    id,
    standardCode,
    standardCodeAliases: [],
    instanceType: "AliasCode",
  };
}

function ext(id: string, url: string, value: string): UsdmV4ExtensionAttribute {
  return { id, url, valueString: value, instanceType: "ExtensionAttribute" };
}

// ---------------------------------------------------------------------------
// Biomedical concepts
// ---------------------------------------------------------------------------

interface ConceptSpec {
  testCode: string;
  name: string;
  nciCode: string;
  unit?: string;
}

const VITAL_SIGNS: ConceptSpec[] = [
  {
    testCode: "SYSBP",
    name: "Systolic Blood Pressure",
    nciCode: "C25298",
    unit: "mmHg",
  },
  {
    testCode: "DIABP",
    name: "Diastolic Blood Pressure",
    nciCode: "C25299",
    unit: "mmHg",
  },
  {
    testCode: "PULSE",
    name: "Pulse Rate",
    nciCode: "C49676",
    unit: "beats/min",
  },
  { testCode: "WEIGHT", name: "Weight", nciCode: "C25208", unit: "kg" },
];

const CHEMISTRY: ConceptSpec[] = [
  {
    testCode: "ALT",
    name: "Alanine Aminotransferase",
    nciCode: "C64433",
    unit: "U/L",
  },
  {
    testCode: "AST",
    name: "Aspartate Aminotransferase",
    nciCode: "C64467",
    unit: "U/L",
  },
  { testCode: "BILI", name: "Bilirubin", nciCode: "C38037", unit: "umol/L" },
  { testCode: "CREAT", name: "Creatinine", nciCode: "C64547", unit: "umol/L" },
  { testCode: "GLUC", name: "Glucose", nciCode: "C105585", unit: "mmol/L" },
];

const HAEMATOLOGY: ConceptSpec[] = [
  { testCode: "HGB", name: "Hemoglobin", nciCode: "C64848", unit: "g/L" },
  { testCode: "WBC", name: "Leukocytes", nciCode: "C51948", unit: "10^9/L" },
  { testCode: "PLAT", name: "Platelets", nciCode: "C51951", unit: "10^9/L" },
];

function conceptId(spec: ConceptSpec): string {
  return `bc_${spec.testCode.toLowerCase()}`;
}

function concept(spec: ConceptSpec): UsdmV4BiomedicalConcept {
  const id = conceptId(spec);
  const extensions = [
    ext(`${id}_testcd`, USDM_SDTM_TESTCD_EXTENSION_URL, spec.testCode),
  ];
  if (spec.unit) {
    extensions.push(
      ext(`${id}_stresu`, USDM_SDTM_STRESU_EXTENSION_URL, spec.unit)
    );
  }
  return {
    id,
    name: spec.name,
    label: spec.name,
    synonyms: [spec.testCode],
    reference: `https://evsexplore.semantics.cancer.gov/evsexplore/concept/ncit/${spec.nciCode}`,
    properties: [],
    code: alias(`${id}_code`, ct(`${id}_code_std`, spec.nciCode, spec.name)),
    extensionAttributes: extensions,
    instanceType: "BiomedicalConcept",
  };
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

function activity(
  id: string,
  name: string,
  domain: string,
  description: string,
  concepts: ConceptSpec[] = []
): UsdmV4Activity {
  return {
    id,
    name,
    label: name,
    description,
    childIds: [],
    definedProcedures: [],
    biomedicalConceptIds: concepts.map(conceptId),
    bcCategoryIds: [],
    bcSurrogateIds: [],
    timelineId: null,
    extensionAttributes: [
      ext(`${id}_domain`, USDM_SDTM_DOMAIN_EXTENSION_URL, domain),
    ],
    instanceType: "Activity",
  };
}

const ACTIVITIES: UsdmV4Activity[] = [
  activity(
    "act_dm",
    "Demographics",
    "DM",
    "Collect age, sex, race and ethnicity."
  ),
  activity(
    "act_vs",
    "Vital signs",
    "VS",
    "Seated blood pressure and pulse after five minutes' rest, and body weight.",
    VITAL_SIGNS
  ),
  activity(
    "act_lb_chem",
    "Clinical chemistry",
    "LB",
    "Serum chemistry panel from a central laboratory.",
    CHEMISTRY
  ),
  activity(
    "act_lb_hem",
    "Haematology",
    "LB",
    "Haematology panel from a central laboratory.",
    HAEMATOLOGY
  ),
  activity(
    "act_ex",
    "Study drug administration",
    "EX",
    "Dispense and reconcile once-daily oral study drug."
  ),
  activity(
    "act_ae",
    "Adverse events",
    "AE",
    "Record adverse events from first dose to the end of study."
  ),
  activity(
    "act_ds",
    "Disposition",
    "DS",
    "Record completion or the reason for discontinuation."
  ),
].map((act, idx, all) => ({
  ...act,
  previousId: idx > 0 ? all[idx - 1].id : null,
  nextId: idx < all.length - 1 ? all[idx + 1].id : null,
}));

// ---------------------------------------------------------------------------
// Visits and schedule of activities
// ---------------------------------------------------------------------------

interface VisitSpec {
  id: string;
  name: string;
  label: string;
  epochId: string;
  /** Calendar days from Baseline (Day 1); negative is before. */
  offset: number;
  windowBefore: number;
  windowAfter: number;
  activityIds: string[];
}

const VISITS: VisitSpec[] = [
  {
    id: "enc_screening",
    name: "SCREENING",
    label: "Screening",
    epochId: "epoch_screening",
    offset: -14,
    windowBefore: 14,
    windowAfter: 13,
    activityIds: ["act_dm", "act_vs", "act_lb_chem", "act_lb_hem"],
  },
  {
    id: "enc_baseline",
    name: "BASELINE",
    label: "Baseline (Day 1)",
    epochId: "epoch_treatment",
    offset: 0,
    windowBefore: 0,
    windowAfter: 0,
    activityIds: ["act_vs", "act_lb_chem", "act_lb_hem", "act_ex", "act_ae"],
  },
  {
    id: "enc_week2",
    name: "WEEK 2",
    label: "Week 2",
    epochId: "epoch_treatment",
    offset: 14,
    windowBefore: 3,
    windowAfter: 3,
    activityIds: ["act_vs", "act_ex", "act_ae"],
  },
  {
    id: "enc_week4",
    name: "WEEK 4",
    label: "Week 4",
    epochId: "epoch_treatment",
    offset: 28,
    windowBefore: 3,
    windowAfter: 3,
    activityIds: ["act_vs", "act_lb_chem", "act_lb_hem", "act_ex", "act_ae"],
  },
  {
    id: "enc_week8",
    name: "WEEK 8",
    label: "Week 8",
    epochId: "epoch_treatment",
    offset: 56,
    windowBefore: 5,
    windowAfter: 5,
    activityIds: ["act_vs", "act_ex", "act_ae"],
  },
  {
    id: "enc_week12",
    name: "WEEK 12",
    label: "Week 12 (end of treatment)",
    epochId: "epoch_treatment",
    offset: 84,
    windowBefore: 5,
    windowAfter: 5,
    activityIds: [
      "act_vs",
      "act_lb_chem",
      "act_lb_hem",
      "act_ex",
      "act_ae",
      "act_ds",
    ],
  },
  {
    id: "enc_eos",
    name: "END OF STUDY",
    label: "End of Study (follow-up)",
    epochId: "epoch_followup",
    offset: 98,
    windowBefore: 3,
    windowAfter: 7,
    activityIds: ["act_vs", "act_ae", "act_ds"],
  },
];

const ANCHOR_VISIT = "enc_baseline";
const TIMELINE_EXIT = "timeline_main_exit";

const ENCOUNTERS: UsdmV4Encounter[] = VISITS.map((v, idx) => ({
  id: v.id,
  name: v.name,
  label: v.label,
  description: null,
  type: ct(`${v.id}_type`, "C25716", "Visit"),
  previousId: idx > 0 ? VISITS[idx - 1].id : null,
  nextId: idx < VISITS.length - 1 ? VISITS[idx + 1].id : null,
  scheduledAtId: `${v.id}_sai`,
  environmentalSettings: [],
  contactModes: [],
  instanceType: "Encounter",
}));

const INSTANCES: UsdmV4ScheduledActivityInstance[] = VISITS.map((v, idx) => ({
  id: `${v.id}_sai`,
  name: `${v.label} activities`,
  label: null,
  description: null,
  epochId: v.epochId,
  timelineId: null,
  timelineExitId: idx === VISITS.length - 1 ? TIMELINE_EXIT : null,
  activityIds: v.activityIds,
  encounterId: v.id,
  instanceType: "ScheduledActivityInstance",
}));

const TIMINGS: UsdmV4Timing[] = VISITS.map((v) => {
  const isAnchor = v.id === ANCHOR_VISIT;
  const type = isAnchor
    ? ct(`${v.id}_timing_type`, "C201358", "Fixed Reference")
    : v.offset < 0
      ? ct(`${v.id}_timing_type`, "C201356", "Before")
      : ct(`${v.id}_timing_type`, "C201357", "After");
  return {
    id: `${v.id}_timing`,
    name: `${v.label} timing`,
    label: null,
    description: null,
    type,
    value: `P${Math.abs(v.offset)}D`,
    valueLabel: isAnchor
      ? "Day 1"
      : `${Math.abs(v.offset)} days ${v.offset < 0 ? "before" : "after"} Day 1`,
    relativeToFrom: ct(`${v.id}_timing_rel`, "C201355", "Start to Start"),
    relativeFromScheduledInstanceId: `${v.id}_sai`,
    relativeToScheduledInstanceId: isAnchor ? null : `${ANCHOR_VISIT}_sai`,
    windowLower: `P${v.windowBefore}D`,
    windowUpper: `P${v.windowAfter}D`,
    windowLabel: `-${v.windowBefore}/+${v.windowAfter} days`,
    instanceType: "Timing",
  };
});

// ---------------------------------------------------------------------------
// Arms, epochs, elements and cells
// ---------------------------------------------------------------------------

const ARMS = [
  {
    id: "arm_placebo",
    code: "PBO",
    name: "Placebo",
    description: "Placebo tablet once daily for 12 weeks.",
    type: ct("arm_placebo_type", "C174268", "Placebo Comparator Arm"),
    element: "el_placebo",
  },
  {
    id: "arm_low",
    code: "DMX10",
    name: "Demoxacin 10 mg",
    description: "Demoxacin 10 mg tablet once daily for 12 weeks.",
    type: ct("arm_low_type", "C174266", "Experimental Arm"),
    element: "el_low",
  },
  {
    id: "arm_high",
    code: "DMX20",
    name: "Demoxacin 20 mg",
    description: "Demoxacin 20 mg tablet once daily for 12 weeks.",
    type: ct("arm_high_type", "C174266", "Experimental Arm"),
    element: "el_high",
  },
];

const EPOCHS = [
  {
    id: "epoch_screening",
    name: "SCREENING",
    label: "Screening",
    type: ct("epoch_screening_type", "C48262", "Screening"),
  },
  {
    id: "epoch_treatment",
    name: "TREATMENT",
    label: "Treatment",
    type: ct("epoch_treatment_type", "C101526", "Treatment"),
  },
  {
    id: "epoch_followup",
    name: "FOLLOW-UP",
    label: "Follow-up",
    type: ct("epoch_followup_type", "C99158", "Follow-Up"),
  },
];

const ELEMENTS = [
  {
    id: "el_screen",
    code: "SCRN",
    name: "Screening",
    description: "From informed consent to randomisation, up to 28 days.",
  },
  {
    id: "el_placebo",
    code: "PBO",
    name: "Placebo",
    description: "Placebo once daily from Day 1 for 12 weeks.",
  },
  {
    id: "el_low",
    code: "DMX10",
    name: "Demoxacin 10 mg",
    description: "Demoxacin 10 mg once daily from Day 1 for 12 weeks.",
  },
  {
    id: "el_high",
    code: "DMX20",
    name: "Demoxacin 20 mg",
    description: "Demoxacin 20 mg once daily from Day 1 for 12 weeks.",
  },
  {
    id: "el_fu",
    code: "FU",
    name: "Follow-up",
    description: "Two weeks off treatment after the last dose.",
  },
];

// ---------------------------------------------------------------------------
// Objectives, endpoints, populations and estimands
// ---------------------------------------------------------------------------

const PRIMARY_ENDPOINT = "endpoint_sysbp_cfb_w12";
const SECONDARY_ENDPOINT = "endpoint_tte_ae_disc";
const SAFETY_ENDPOINT = "endpoint_teae_incidence";

/** The fictional DEMO-301 study as a USDM v4.0.0 document. */
export const DEMO_301_USDM: UsdmV4Document = {
  usdmVersion: USDM_V4_VERSION,
  systemName: "deruiter.dev Study Data Pipeline",
  systemVersion: "1.0.0",
  study: {
    id: "6a3e5d10-301d-4e30-8d01-000000000301",
    name: "DEMO-301",
    label: "Demoxacin in mild hypertension",
    description:
      "Fictional study for the Study Data Pipeline demonstration. Synthetic data only; not a real study.",
    versions: [
      {
        id: "sv_1",
        versionIdentifier: "1.0",
        rationale: "Original protocol.",
        studyIdentifiers: [
          {
            id: "sid_sponsor",
            text: "DEMO-301",
            scopeId: "org_sponsor",
            instanceType: "StudyIdentifier",
          },
        ],
        titles: [
          {
            id: "title_official",
            text: "A Randomised, Double-Blind, Placebo-Controlled Study of Demoxacin in Adults with Mild Hypertension",
            type: ct("title_official_type", "C207616", "Official Study Title"),
            instanceType: "StudyTitle",
          },
          {
            id: "title_brief",
            text: "Demoxacin in mild hypertension",
            type: ct("title_brief_type", "C207615", "Brief Study Title"),
            instanceType: "StudyTitle",
          },
        ],
        organizations: [
          {
            id: "org_sponsor",
            name: "Demo Therapeutics (fictional)",
            label: "Demo Therapeutics",
            type: ct("org_sponsor_type", "C70793", "Clinical Study Sponsor"),
            identifierScheme: "Sponsor",
            identifier: "DEMO",
            instanceType: "Organization",
          },
        ],
        studyInterventions: [
          {
            id: "int_demoxacin",
            name: "Demoxacin",
            label: "Demoxacin",
            description:
              "Fictional oral antihypertensive, 10 mg or 20 mg once daily.",
            role: sponsorCode(
              "int_demoxacin_role",
              "IP",
              "Investigational Product"
            ),
            type: ct("int_demoxacin_type", "C1909", "Pharmacologic Substance"),
            codes: [],
            instanceType: "StudyIntervention",
          },
          {
            id: "int_placebo",
            name: "Placebo",
            label: "Placebo",
            description: "Matching placebo tablet once daily.",
            role: sponsorCode(
              "int_placebo_role",
              "PLACEBO",
              "Placebo Comparator"
            ),
            type: ct("int_placebo_type", "C753", "Placebo"),
            codes: [],
            instanceType: "StudyIntervention",
          },
        ],
        eligibilityCriterionItems: [
          {
            id: "eci_age",
            name: "Age",
            text: "Aged 18 to 75 years at screening.",
            instanceType: "EligibilityCriterionItem",
          },
          {
            id: "eci_bp",
            name: "Mild hypertension",
            text: "Seated systolic blood pressure from 140 to 159 mmHg at screening and baseline.",
            instanceType: "EligibilityCriterionItem",
          },
          {
            id: "eci_renal",
            name: "Renal impairment",
            text: "Estimated glomerular filtration rate below 45 mL/min/1.73 m2.",
            instanceType: "EligibilityCriterionItem",
          },
        ],
        biomedicalConcepts: [...VITAL_SIGNS, ...CHEMISTRY, ...HAEMATOLOGY].map(
          concept
        ),
        studyDesigns: [
          {
            id: "design_main",
            name: "DEMO-301 design",
            label: "Parallel, double-blind, placebo-controlled",
            description: "Three-arm parallel design with 1:1:1 randomisation.",
            studyType: ct(
              "design_study_type",
              "C98388",
              "Interventional Study"
            ),
            studyPhase: alias(
              "design_phase",
              ct("design_phase_std", "C15602", "Phase III Trial")
            ),
            therapeuticAreas: [],
            characteristics: [],
            encounters: ENCOUNTERS,
            activities: ACTIVITIES,
            arms: ARMS.map((a) => ({
              id: a.id,
              name: a.name,
              label: a.code,
              description: a.description,
              type: a.type,
              dataOriginDescription: "Data collected in this study",
              dataOriginType: ct(
                `${a.id}_origin`,
                "C188866",
                "Data Generated Within Study"
              ),
              populationIds: [],
              instanceType: "StudyArm" as const,
            })),
            studyCells: ARMS.flatMap((a) => [
              {
                id: `cell_${a.id}_screening`,
                armId: a.id,
                epochId: "epoch_screening",
                elementIds: ["el_screen"],
                instanceType: "StudyCell" as const,
              },
              {
                id: `cell_${a.id}_treatment`,
                armId: a.id,
                epochId: "epoch_treatment",
                elementIds: [a.element],
                instanceType: "StudyCell" as const,
              },
              {
                id: `cell_${a.id}_followup`,
                armId: a.id,
                epochId: "epoch_followup",
                elementIds: ["el_fu"],
                instanceType: "StudyCell" as const,
              },
            ]),
            rationale:
              "A placebo-controlled parallel design isolates the effect of two Demoxacin doses on blood pressure.",
            epochs: EPOCHS.map((e, idx) => ({
              id: e.id,
              name: e.name,
              label: e.label,
              description: null,
              type: e.type,
              previousId: idx > 0 ? EPOCHS[idx - 1].id : null,
              nextId: idx < EPOCHS.length - 1 ? EPOCHS[idx + 1].id : null,
              instanceType: "StudyEpoch" as const,
            })),
            elements: ELEMENTS.map((el) => ({
              id: el.id,
              name: el.name,
              label: el.code,
              description: el.description,
              studyInterventionIds:
                el.id === "el_low" || el.id === "el_high"
                  ? ["int_demoxacin"]
                  : el.id === "el_placebo"
                    ? ["int_placebo"]
                    : [],
              instanceType: "StudyElement" as const,
            })),
            estimands: [
              {
                id: "estimand_primary",
                name: "Primary estimand",
                label: null,
                description:
                  "Effect of Demoxacin versus placebo on systolic blood pressure at Week 12, regardless of treatment discontinuation.",
                populationSummary:
                  "Difference in mean change from baseline in seated systolic blood pressure at Week 12, each Demoxacin dose versus placebo.",
                analysisPopulationId: "pop_fas",
                interventionIds: ["int_demoxacin", "int_placebo"],
                variableOfInterestId: PRIMARY_ENDPOINT,
                intercurrentEvents: [
                  {
                    id: "ice_disc",
                    name: "Treatment discontinuation",
                    label: null,
                    description: null,
                    text: "Permanent discontinuation of study drug before Week 12.",
                    strategy: "Treatment policy",
                    instanceType: "IntercurrentEvent",
                  },
                  {
                    id: "ice_rescue",
                    name: "Rescue medication",
                    label: null,
                    description: null,
                    text: "Start of rescue antihypertensive medication before Week 12.",
                    strategy: "Hypothetical",
                    instanceType: "IntercurrentEvent",
                  },
                ],
                instanceType: "Estimand",
              },
              {
                id: "estimand_secondary",
                name: "Secondary estimand",
                label: null,
                description:
                  "Hazard of a first treatment-emergent adverse event that leads to discontinuation of study drug.",
                populationSummary:
                  "Hazard ratio, each Demoxacin dose versus placebo.",
                analysisPopulationId: "pop_saf",
                interventionIds: ["int_demoxacin", "int_placebo"],
                variableOfInterestId: SECONDARY_ENDPOINT,
                intercurrentEvents: [
                  {
                    id: "ice_disc_other",
                    name: "Discontinuation for other reasons",
                    label: null,
                    description: null,
                    text: "Discontinuation of study drug for a reason other than an adverse event.",
                    strategy: "While on treatment",
                    instanceType: "IntercurrentEvent",
                  },
                ],
                instanceType: "Estimand",
              },
            ],
            studyInterventionIds: ["int_demoxacin", "int_placebo"],
            objectives: [
              {
                id: "obj_primary",
                name: "Primary objective",
                label: null,
                description: null,
                text: "To evaluate the effect of Demoxacin compared with placebo on seated systolic blood pressure after 12 weeks of treatment.",
                level: ct("obj_primary_level", "C85826", "Primary Objective"),
                endpoints: [
                  {
                    id: PRIMARY_ENDPOINT,
                    name: "SYSBP change at Week 12",
                    label: null,
                    description: null,
                    text: "Change from baseline in seated systolic blood pressure at Week 12.",
                    purpose: "Efficacy",
                    level: ct(
                      `${PRIMARY_ENDPOINT}_level`,
                      "C94496",
                      "Primary Endpoint"
                    ),
                    instanceType: "Endpoint",
                  },
                ],
                instanceType: "Objective",
              },
              {
                id: "obj_safety",
                name: "Safety objective",
                label: null,
                description: null,
                text: "To evaluate the safety and tolerability of Demoxacin compared with placebo.",
                level: ct("obj_safety_level", "C85827", "Secondary Objective"),
                endpoints: [
                  {
                    id: SECONDARY_ENDPOINT,
                    name: "Time to first TEAE leading to discontinuation",
                    label: null,
                    description: null,
                    text: "Time from first dose to the first treatment-emergent adverse event leading to discontinuation of study drug.",
                    purpose: "Safety",
                    level: ct(
                      `${SECONDARY_ENDPOINT}_level`,
                      "C139173",
                      "Secondary Endpoint"
                    ),
                    instanceType: "Endpoint",
                  },
                  {
                    id: SAFETY_ENDPOINT,
                    name: "TEAE incidence",
                    label: null,
                    description: null,
                    text: "Incidence of treatment-emergent adverse events by system organ class and preferred term.",
                    purpose: "Safety",
                    level: ct(
                      `${SAFETY_ENDPOINT}_level`,
                      "C139173",
                      "Secondary Endpoint"
                    ),
                    instanceType: "Endpoint",
                  },
                ],
                instanceType: "Objective",
              },
            ],
            population: {
              id: "population_main",
              name: "Adults with mild hypertension",
              label: null,
              description:
                "Adults aged 18 to 75 with untreated or washed-out mild essential hypertension.",
              includesHealthySubjects: false,
              plannedEnrollmentNumber: {
                id: "population_main_n",
                value: 90,
                unit: null,
                instanceType: "Quantity",
              },
              plannedAge: {
                id: "population_main_age",
                minValue: {
                  id: "population_main_age_min",
                  value: 18,
                  unit: alias(
                    "age_unit_min",
                    ct("age_unit_min_std", "C29848", "Year")
                  ),
                  instanceType: "Quantity",
                },
                maxValue: {
                  id: "population_main_age_max",
                  value: 75,
                  unit: alias(
                    "age_unit_max",
                    ct("age_unit_max_std", "C29848", "Year")
                  ),
                  instanceType: "Quantity",
                },
                isApproximate: false,
                instanceType: "Range",
              },
              criterionIds: ["ec_inc_age", "ec_inc_bp", "ec_exc_renal"],
              cohorts: [],
              instanceType: "StudyDesignPopulation",
            },
            scheduleTimelines: [
              {
                id: "timeline_main",
                name: "Main timeline",
                label: "Schedule of activities",
                description:
                  "Screening, 12 weeks of treatment and two weeks of follow-up.",
                mainTimeline: true,
                entryCondition: "Subject has given written informed consent.",
                entryId: "enc_screening_sai",
                exits: [
                  { id: TIMELINE_EXIT, instanceType: "ScheduleTimelineExit" },
                ],
                timings: TIMINGS,
                instances: INSTANCES,
                instanceType: "ScheduleTimeline",
              },
            ],
            eligibilityCriteria: [
              {
                id: "ec_inc_age",
                name: "INC01",
                label: null,
                description: null,
                category: ct("ec_inc_age_cat", "C25532", "Inclusion Criteria"),
                identifier: "01",
                criterionItemId: "eci_age",
                previousId: null,
                nextId: "ec_inc_bp",
                instanceType: "EligibilityCriterion",
              },
              {
                id: "ec_inc_bp",
                name: "INC02",
                label: null,
                description: null,
                category: ct("ec_inc_bp_cat", "C25532", "Inclusion Criteria"),
                identifier: "02",
                criterionItemId: "eci_bp",
                previousId: "ec_inc_age",
                nextId: "ec_exc_renal",
                instanceType: "EligibilityCriterion",
              },
              {
                id: "ec_exc_renal",
                name: "EXC01",
                label: null,
                description: null,
                category: ct(
                  "ec_exc_renal_cat",
                  "C25370",
                  "Exclusion Criteria"
                ),
                identifier: "01",
                criterionItemId: "eci_renal",
                previousId: "ec_inc_bp",
                nextId: null,
                instanceType: "EligibilityCriterion",
              },
            ],
            analysisPopulations: [
              {
                id: "pop_fas",
                name: "Full Analysis Set",
                label: "FAS",
                description: null,
                text: "All randomised subjects who received at least one dose of study drug, analysed as randomised.",
                subsetOfIds: [],
                instanceType: "AnalysisPopulation",
              },
              {
                id: "pop_saf",
                name: "Safety Set",
                label: "SAF",
                description: null,
                text: "All subjects who received at least one dose of study drug, analysed as treated.",
                subsetOfIds: [],
                instanceType: "AnalysisPopulation",
              },
            ],
            model: ct("design_model", "C82639", "Parallel Study"),
            blindingSchema: alias(
              "design_blinding",
              ct("design_blinding_std", "C15228", "Double Blind Study")
            ),
            instanceType: "InterventionalStudyDesign",
          },
        ],
        instanceType: "StudyVersion",
      },
    ],
    instanceType: "Study",
  },
};
