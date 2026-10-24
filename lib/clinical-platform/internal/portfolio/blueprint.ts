/**
 * The fixed shape of the synthetic portfolio: its studies, vendors and
 * countries. The seed varies the operational detail inside this shape, never
 * the shape itself. Every name here is invented.
 *
 * DEMO-301 is not described here. Its protocol (title, arms, planned
 * enrollment and visit schedule) is read from the USDM study definition the
 * Study Data Pipeline runs, through `@/lib/study-data` (ADR 0066).
 *
 * The module has no top-level calls, so a bundle that imports the platform's
 * entry point without calling `generatePortfolio` can drop it.
 */
import { DEMO_301_STUDY, type StudyDefinition } from "@/lib/study-data";
import { STUDY_DATA_PRODUCT_ID } from "../../presets";
import type {
  OperatingModel,
  PlannedVisit,
  ProductType,
  StudyPhase,
  Vendor,
} from "../../types";

/**
 * What a study's monitoring plan sets. These are plan decisions, which
 * monitoring is measured against; they are not a regulatory standard.
 */
export interface MonitoringPlanTerms {
  /** Planned days from one monitoring visit at a site to the next interim visit. */
  readonly interimIntervalDays: number;
  /** Days an interim visit may fall after its planned date and still be on time. */
  readonly visitWindowDays: number;
  /** Days from a visit by which its report must be final. */
  readonly reportDueDays: number;
}

/** Report deadline in the sponsor's monitoring SOP, which its own plans adopt. */
const SPONSOR_REPORT_DUE_DAYS = 20;
/** Report deadline the CROs' plans commit to under their contracts. */
const CRO_REPORT_DUE_DAYS = 15;

/** Visits every eight weeks with two weeks' grace: the default cadence. */
const STANDARD_CADENCE = { interimIntervalDays: 56, visitWindowDays: 14 };
/** Visits every six weeks for higher-risk studies (Phase III, pivotal). */
const CLOSE_CADENCE = { interimIntervalDays: 42, visitWindowDays: 14 };

/** The operational plan for one study, before the seed fills in operations. */
export interface StudyOperationsPlan {
  readonly id: string;
  readonly therapeuticArea: string;
  readonly productType: ProductType;
  readonly phase: StudyPhase;
  readonly operatingModel: OperatingModel;
  readonly croVendorId: string | null;
  /** ISO 8601 protocol finalisation date. */
  readonly startOn: string;
  readonly siteCount: number;
  /** Countries the sites are spread across, in allocation order. */
  readonly countries: readonly string[];
  /** Days from start over which sites activate after the first. */
  readonly activationSpreadDays: number;
  /** Planned enrollment period, in days from first subject in. */
  readonly enrollmentDays: number;
  readonly screenFailRate: number;
  /** Share of enrolled subjects who discontinue before the last visit. */
  readonly dropoutRate: number;
  /** Mean EDC queries per entered visit. */
  readonly queryRate: number;
  readonly cecAdjudication: boolean;
  /** The study's monitoring plan. */
  readonly monitoring: MonitoringPlanTerms;
  /** Annual budget per vendor service, whole US dollars. */
  readonly annualBudgetUsd: Readonly<Record<string, number>>;
}

/** The full plan for one study: operations plus its protocol. */
export interface StudyBlueprint extends StudyOperationsPlan {
  readonly title: string;
  readonly plannedEnrollment: number;
  readonly randomized: boolean;
  readonly arms: readonly string[];
  readonly plannedVisits: readonly PlannedVisit[];
  readonly scheduleSource: "usdm" | "blueprint";
  readonly studyDataProductId: string | null;
  /**
   * The Study Data Pipeline definition whose run supplies the study's
   * subjects and visits, or `null` when the portfolio simulates them.
   */
  readonly studyDefinition: StudyDefinition | null;
}

/** Visit tuple: id, name, planned day, window in days, dispenses product. */
type VisitTuple = readonly [string, string, number, number, boolean?];

/** A blueprint study before its visit tuples are expanded. */
interface BlueprintEntry extends StudyOperationsPlan {
  readonly title: string;
  readonly plannedEnrollment: number;
  readonly randomized: boolean;
  readonly arms: readonly string[];
  readonly visits: readonly VisitTuple[];
}

/** Fictional sponsor of the portfolio. */
export const SPONSOR = "Aldermoor Therapeutics (fictional)";

/** Data cut: the generated world ends on this date. */
export const AS_OF = "2026-09-30";

/** Ids of the fictional vendors. */
export const VENDOR_IDS = {
  croPrimary: "VEN-CRO-01",
  croSecondary: "VEN-CRO-02",
  edc: "VEN-EDC-01",
  irt: "VEN-IRT-01",
  ctms: "VEN-CTMS-01",
  etmf: "VEN-ETMF-01",
  lab: "VEN-LAB-01",
} as const;

/** The fictional vendors. None is the name of a real company. */
export const VENDORS: readonly Vendor[] = [
  {
    synthetic: true,
    id: VENDOR_IDS.croPrimary,
    name: "Quillfeather Clinical Research",
    service: "CRO",
  },
  {
    synthetic: true,
    id: VENDOR_IDS.croSecondary,
    name: "Bramblecote Trial Services",
    service: "CRO",
  },
  {
    synthetic: true,
    id: VENDOR_IDS.edc,
    name: "Ferncastle Data Capture",
    service: "EDC",
  },
  {
    synthetic: true,
    id: VENDOR_IDS.irt,
    name: "Kitewright Randomisation",
    service: "IRT",
  },
  {
    synthetic: true,
    id: VENDOR_IDS.ctms,
    name: "Ledgerlane Trial Management",
    service: "CTMS",
  },
  {
    synthetic: true,
    id: VENDOR_IDS.etmf,
    name: "Paperlark Document Systems",
    service: "eTMF",
  },
  {
    synthetic: true,
    id: VENDOR_IDS.lab,
    name: "Driftmoor Central Laboratory",
    service: "Central lab",
  },
];

/** The CRO whose actual spend runs over budget on purpose. */
export const OVER_BUDGET_VENDOR_ID = VENDOR_IDS.croPrimary;

/** The study planted behind plan. */
export const BEHIND_PLAN_STUDY_ID = "DEMO-302";

/** Studies large enough to carry slow-enrolling sites. */
export const SLOW_SITE_STUDY_IDS: readonly string[] = [
  "DEMO-201",
  "DEMO-302",
  "DEV-402",
];

/** The study that carries the site with a data integrity signal. */
export const DATA_INTEGRITY_STUDY_ID = "DEMO-302";

/** Device schedule after ISO 14155-style follow-up: procedure, discharge, 30 days, 6 and 12 months. */
const DEVICE_VISITS: readonly VisitTuple[] = [
  ["SCR", "Screening", -30, 0],
  ["PROC", "Index procedure", 0, 0],
  ["DISCH", "Discharge", 2, 1],
  ["D30", "30-day follow-up", 30, 7],
  ["M6", "6-month follow-up", 182, 30],
  ["M12", "12-month follow-up", 365, 45],
];

const DRUG_BUDGET = {
  EDC: 140_000,
  IRT: 90_000,
  CTMS: 40_000,
  eTMF: 30_000,
  "Central lab": 260_000,
};

/** Operations of DEMO-301, whose protocol comes from its USDM definition. */
const DEMO_301_OPERATIONS: StudyOperationsPlan = {
  id: "DEMO-301",
  therapeuticArea: "Cardiovascular",
  productType: "drug",
  phase: "Phase III",
  operatingModel: "sponsor",
  croVendorId: null,
  startOn: "2025-06-02",
  siteCount: 8,
  countries: ["US", "CA"],
  activationSpreadDays: 90,
  enrollmentDays: 210,
  screenFailRate: 0.09,
  dropoutRate: 0.11,
  queryRate: 0.4,
  cecAdjudication: false,
  monitoring: { ...CLOSE_CADENCE, reportDueDays: SPONSOR_REPORT_DUE_DAYS },
  annualBudgetUsd: { ...DRUG_BUDGET, Investigator: 700_000 },
};

/** The seven studies the portfolio simulates itself, in portfolio order. */
const BLUEPRINT_STUDIES: readonly BlueprintEntry[] = [
  {
    id: "DEMO-101",
    title: "First-in-human single and multiple ascending dose study of DMX-101",
    therapeuticArea: "Metabolic",
    productType: "drug",
    phase: "Phase I",
    operatingModel: "sponsor",
    croVendorId: null,
    startOn: "2025-01-06",
    plannedEnrollment: 48,
    siteCount: 3,
    countries: ["US"],
    activationSpreadDays: 30,
    enrollmentDays: 150,
    screenFailRate: 0.35,
    dropoutRate: 0.04,
    queryRate: 0.35,
    randomized: true,
    arms: ["Placebo", "DMX-101"],
    visits: [
      ["SCR", "Screening", -28, 0],
      ["D1", "Day 1", 0, 0, true],
      ["D2", "Day 2", 1, 0],
      ["D3", "Day 3", 2, 0],
      ["D8", "Day 8", 7, 1, true],
      ["D15", "Day 15", 14, 1],
      ["D29", "Follow-up", 28, 2],
    ],
    cecAdjudication: false,
    monitoring: {
      // Phase I units are monitored closely during dosing.
      interimIntervalDays: 28,
      visitWindowDays: 7,
      reportDueDays: SPONSOR_REPORT_DUE_DAYS,
    },
    annualBudgetUsd: { ...DRUG_BUDGET, Investigator: 420_000 },
  },
  {
    id: "DEMO-201",
    title: "Dose-ranging study of DMX-201 in moderate plaque psoriasis",
    therapeuticArea: "Immunology",
    productType: "biologic",
    phase: "Phase II",
    operatingModel: "cro",
    croVendorId: VENDOR_IDS.croSecondary,
    startOn: "2024-11-04",
    plannedEnrollment: 180,
    siteCount: 14,
    countries: ["US", "CA", "DE", "PL", "ES"],
    activationSpreadDays: 150,
    enrollmentDays: 420,
    screenFailRate: 0.3,
    dropoutRate: 0.12,
    queryRate: 0.45,
    randomized: true,
    arms: ["Placebo", "DMX-201 low dose", "DMX-201 high dose"],
    visits: [
      ["SCR", "Screening", -28, 0],
      ["BL", "Baseline", 0, 0, true],
      ["W2", "Week 2", 14, 3, true],
      ["W4", "Week 4", 28, 3, true],
      ["W8", "Week 8", 56, 5, true],
      ["W12", "Week 12", 84, 5, true],
      ["W16", "Week 16", 112, 7],
      ["FU", "Follow-up", 140, 7],
    ],
    cecAdjudication: false,
    monitoring: { ...STANDARD_CADENCE, reportDueDays: CRO_REPORT_DUE_DAYS },
    annualBudgetUsd: {
      ...DRUG_BUDGET,
      CRO: 1_900_000,
      Investigator: 1_100_000,
    },
  },
  {
    id: "DEMO-202",
    title:
      "Placebo-controlled study of DMX-202 for episodic migraine prevention",
    therapeuticArea: "Neurology",
    productType: "drug",
    phase: "Phase II",
    operatingModel: "sponsor",
    croVendorId: null,
    startOn: "2024-09-02",
    plannedEnrollment: 160,
    siteCount: 12,
    countries: ["US", "GB", "NL", "FR"],
    activationSpreadDays: 120,
    enrollmentDays: 540,
    screenFailRate: 0.25,
    dropoutRate: 0.1,
    queryRate: 0.4,
    randomized: true,
    arms: ["Placebo", "DMX-202"],
    visits: [
      ["SCR", "Screening", -28, 0],
      ["BL", "Baseline", 0, 0, true],
      ["W4", "Week 4", 28, 3, true],
      ["W8", "Week 8", 56, 5, true],
      ["W12", "Week 12", 84, 5],
      ["FU", "Follow-up", 112, 7],
    ],
    cecAdjudication: false,
    monitoring: { ...STANDARD_CADENCE, reportDueDays: SPONSOR_REPORT_DUE_DAYS },
    annualBudgetUsd: { ...DRUG_BUDGET, Investigator: 950_000 },
  },
  {
    id: "DEMO-203",
    title: "Open-label study of DMX-203 in previously treated solid tumours",
    therapeuticArea: "Oncology",
    productType: "biologic",
    phase: "Phase II",
    operatingModel: "cro",
    croVendorId: VENDOR_IDS.croSecondary,
    startOn: "2025-02-03",
    plannedEnrollment: 90,
    siteCount: 10,
    countries: ["US", "JP", "AU", "IT"],
    activationSpreadDays: 180,
    enrollmentDays: 540,
    screenFailRate: 0.4,
    dropoutRate: 0.22,
    queryRate: 0.6,
    randomized: false,
    arms: ["DMX-203 open label"],
    visits: [
      ["SCR", "Screening", -28, 0],
      ["C1D1", "Cycle 1 Day 1", 0, 0, true],
      ["C2D1", "Cycle 2 Day 1", 21, 3, true],
      ["C3D1", "Cycle 3 Day 1", 42, 3, true],
      ["C4D1", "Cycle 4 Day 1", 63, 3, true],
      ["C6D1", "Cycle 6 Day 1", 105, 3, true],
      ["C8D1", "Cycle 8 Day 1", 147, 3, true],
      ["EOT", "End of treatment", 175, 7],
    ],
    cecAdjudication: false,
    monitoring: { ...STANDARD_CADENCE, reportDueDays: CRO_REPORT_DUE_DAYS },
    annualBudgetUsd: { ...DRUG_BUDGET, CRO: 1_500_000, Investigator: 900_000 },
  },
  {
    id: "DEMO-302",
    title:
      "52-week efficacy and safety study of DMX-302 in moderate to severe asthma",
    therapeuticArea: "Respiratory",
    productType: "drug",
    phase: "Phase III",
    operatingModel: "cro",
    croVendorId: VENDOR_IDS.croPrimary,
    startOn: "2024-09-02",
    plannedEnrollment: 600,
    siteCount: 36,
    countries: ["US", "GB", "DE", "FR", "ES", "IT", "PL", "BR", "JP", "AU"],
    activationSpreadDays: 240,
    enrollmentDays: 540,
    screenFailRate: 0.35,
    dropoutRate: 0.1,
    queryRate: 0.5,
    randomized: true,
    arms: ["Placebo", "DMX-302"],
    visits: [
      ["SCR", "Screening", -28, 0],
      ["RND", "Randomisation", 0, 0, true],
      ["W4", "Week 4", 28, 3],
      ["W12", "Week 12", 84, 7, true],
      ["W24", "Week 24", 168, 7, true],
      ["W36", "Week 36", 252, 7, true],
      ["W52", "Week 52", 364, 14],
      ["FU", "Follow-up", 378, 7],
    ],
    cecAdjudication: false,
    monitoring: { ...CLOSE_CADENCE, reportDueDays: CRO_REPORT_DUE_DAYS },
    annualBudgetUsd: {
      ...DRUG_BUDGET,
      CRO: 4_800_000,
      Investigator: 3_200_000,
    },
  },
  {
    id: "DEV-401",
    title: "Early feasibility study of a transcatheter valve repair system",
    therapeuticArea: "Structural heart",
    productType: "device",
    phase: "Device feasibility",
    operatingModel: "sponsor",
    croVendorId: null,
    startOn: "2024-06-03",
    plannedEnrollment: 40,
    siteCount: 5,
    countries: ["US"],
    activationSpreadDays: 90,
    enrollmentDays: 300,
    screenFailRate: 0.45,
    dropoutRate: 0.05,
    queryRate: 0.55,
    randomized: false,
    arms: ["Investigational device"],
    visits: DEVICE_VISITS,
    cecAdjudication: false,
    monitoring: { ...STANDARD_CADENCE, reportDueDays: SPONSOR_REPORT_DUE_DAYS },
    annualBudgetUsd: {
      EDC: 110_000,
      CTMS: 30_000,
      eTMF: 25_000,
      Investigator: 600_000,
    },
  },
  {
    id: "DEV-402",
    title:
      "Randomised pivotal study of a transcatheter valve repair system against surgical repair",
    therapeuticArea: "Structural heart",
    productType: "device",
    phase: "Device pivotal",
    operatingModel: "sponsor",
    croVendorId: null,
    startOn: "2025-03-03",
    plannedEnrollment: 350,
    siteCount: 32,
    countries: ["US", "CA", "DE", "NL", "GB"],
    activationSpreadDays: 210,
    enrollmentDays: 540,
    screenFailRate: 0.4,
    dropoutRate: 0.06,
    queryRate: 0.5,
    randomized: true,
    arms: ["Investigational device", "Surgical repair"],
    visits: DEVICE_VISITS,
    cecAdjudication: true,
    monitoring: {
      // The pivotal device study allows only a week's slip.
      interimIntervalDays: 42,
      visitWindowDays: 7,
      reportDueDays: SPONSOR_REPORT_DUE_DAYS,
    },
    annualBudgetUsd: {
      EDC: 220_000,
      IRT: 60_000,
      CTMS: 50_000,
      eTMF: 40_000,
      Investigator: 2_400_000,
    },
  },
];

/** Position of DEMO-301 in portfolio order (after DEMO-203). */
const DEMO_301_POSITION = 4;

function expandVisit([
  id,
  name,
  day,
  windowDays,
  dispensesProduct = false,
]: VisitTuple): PlannedVisit {
  return { id, name, day, windowDays, dispensesProduct };
}

/**
 * Converts a USDM study day, which has no Day 0, to the portfolio's day
 * relative to enrollment, which is day 0.
 */
export function studyDayToOffset(studyDay: number): number {
  return studyDay > 0 ? studyDay - 1 : studyDay;
}

/**
 * The planned visits of a USDM study definition: one per encounter, timed
 * relative to enrollment, dispensing product where the schedule of
 * activities plans an exposure (EX) activity.
 */
function visitsFromDefinition(
  definition: StudyDefinition
): readonly PlannedVisit[] {
  const { design } = definition;
  const exposureIds = new Set(
    design.activities
      .filter((activity) => activity.domain === "EX")
      .map((activity) => activity.id)
  );
  const dispensing = new Set(
    design.schedule
      .filter((cell) => exposureIds.has(cell.activityId))
      .map((cell) => cell.visitId)
  );
  return design.visits.map((visit) => ({
    id: visit.id,
    name: visit.name,
    day: studyDayToOffset(visit.targetDay),
    windowDays: Math.max(visit.windowBefore, visit.windowAfter),
    dispensesProduct: dispensing.has(visit.id),
  }));
}

/** A study whose protocol is the USDM definition the pipeline runs. */
function fromStudyDefinition(
  definition: StudyDefinition,
  operations: StudyOperationsPlan
): StudyBlueprint {
  const { design } = definition;
  return {
    ...operations,
    title: definition.title,
    plannedEnrollment: design.plannedEnrollment,
    randomized: design.arms.length > 1,
    arms: design.arms.map((arm) => arm.name),
    plannedVisits: visitsFromDefinition(definition),
    scheduleSource: "usdm",
    studyDataProductId: STUDY_DATA_PRODUCT_ID,
    studyDefinition: definition,
  };
}

/** The eight studies, in portfolio order. */
export function studyBlueprints(): StudyBlueprint[] {
  const simulated = BLUEPRINT_STUDIES.map(
    ({ visits, ...entry }): StudyBlueprint => ({
      ...entry,
      plannedVisits: visits.map(expandVisit),
      scheduleSource: "blueprint",
      studyDataProductId: null,
      studyDefinition: null,
    })
  );
  return [
    ...simulated.slice(0, DEMO_301_POSITION),
    fromStudyDefinition(DEMO_301_STUDY, DEMO_301_OPERATIONS),
    ...simulated.slice(DEMO_301_POSITION),
  ];
}

/** Vendor serving each budget category; `Investigator` is paid to sites. */
export const CATEGORY_VENDOR: Readonly<Record<string, string | null>> = {
  EDC: VENDOR_IDS.edc,
  IRT: VENDOR_IDS.irt,
  CTMS: VENDOR_IDS.ctms,
  eTMF: VENDOR_IDS.etmf,
  "Central lab": VENDOR_IDS.lab,
  Investigator: null,
};

/** Syllables for invented site names; no combination is a real institution. */
export const NAME_STEMS: readonly string[] = [
  "Quil",
  "Vey",
  "Zan",
  "Ostr",
  "Thal",
  "Brev",
  "Kest",
  "Mirr",
  "Sollo",
  "Wrenn",
  "Ilv",
  "Draum",
  "Pell",
  "Corv",
  "Ysel",
  "Tamb",
];

/** Endings for invented site names. */
export const NAME_ENDINGS: readonly string[] = [
  "ara",
  "eth",
  "ovin",
  "umbe",
  "issa",
  "orrin",
  "adel",
  "ewyn",
];

/** Kinds of investigator site. */
export const SITE_KINDS: readonly string[] = [
  "Clinical Research Centre",
  "University Hospital",
  "Research Clinic",
  "Medical Centre",
  "Heart Institute",
];
