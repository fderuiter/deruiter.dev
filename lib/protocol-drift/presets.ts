/**
 * Protocol Drift: Study PD-101 fixtures and constants.
 *
 * All study details are fictional game content, not clinical guidance. The
 * sub-issue fixtures (#1091 to #1097) are authoritative; timestamps the
 * sub-issues leave open follow the epic's v0.1 conventions.
 */
import type {
  ADaMVitalSignRecord,
  CanvasEdge,
  CanvasNode,
  ChipKind,
  EntryFieldSpec,
  PipelineGraph,
  SiteId,
  SiteProfile,
  SubmissionFixture,
  WaveIndex,
} from "./types";

/** Study identifier. */
export const STUDY_ID = "PD-101";
/** Default scenario seed shown in the footer. */
export const DEFAULT_SEED = 48291;
/** Save-file format tag. */
export const SAVE_FORMAT = "pd-101-save-v1";
/** kPa to mmHg conversion factor; results are kept unrounded internally. */
export const KPA_TO_MMHG = 7.50062;

/** Lock-gate targets. */
export const EXPECTED_VS_RECORDS = 110;
/** Lock-gate target for MH rows. */
export const EXPECTED_MH_RECORDS = 6;
/** Lock-gate target for evaluable ADVS rows. */
export const EXPECTED_ADVS_ROWS = 20;
/** Cumulative current VS rows at the end of each wave of the full level. */
export const WAVE_VS_TOTALS: Readonly<Record<WaveIndex, number>> = {
  1: 54,
  2: 80,
  3: 110,
};
/** Current VS rows the Site A tracer bullet produces. */
export const TRACER_VS_RECORDS = 18;

/** Canvas geometry: the Tabulation Lane, the wall, and the Analysis Lane. */
export const LANE_GEOMETRY = {
  tabulationTop: 112,
  conservationWallY: 416,
  analysisBottom: 720,
  chipHeight: 72,
  chipWidth: 160,
} as const;

/** Soft range limits that raise an OUT_OF_RANGE issue (never a hard stop). */
export const RANGE_LIMITS = {
  SYSBP: { low: 60, high: 200 },
  DIABP: { low: 30, high: 130 },
  PULSE: { low: 30, high: 180 },
} as const;

/** Orthostatic teaching-flag thresholds; not a clinical threshold. */
export const ORTHOSTATIC_THRESHOLDS = { sbpDrop: 20, dbpDrop: 10 } as const;

/** Trial day and hour at which the Amendment 01 memo auto-pauses play. */
export const AMENDMENT_NOTICE = { day: 20, hour: 8 } as const;

/** The three investigator sites. Amendment activation days per #1094. */
export const SITE_PROFILES: Readonly<Record<SiteId, SiteProfile>> = {
  "SITE-A": {
    siteId: "SITE-A",
    name: "Site A (Academic Medical Center)",
    country: "USA",
    locale: "en-US",
    dateFormat: "MM/DD/YYYY",
    defaultPressureUnit: "mmHg",
    baseLatencyHours: 4,
    initialGoodwill: 85,
    amendmentActivationDay: 22,
  },
  "SITE-B": {
    siteId: "SITE-B",
    name: "Site B (Commercial Trial Network)",
    country: "USA",
    locale: "en-US",
    dateFormat: "MM/DD/YYYY",
    defaultPressureUnit: "mmHg",
    baseLatencyHours: 8,
    initialGoodwill: 35,
    amendmentActivationDay: 26,
  },
  "SITE-C": {
    siteId: "SITE-C",
    name: "Site C (International Cohort - EU)",
    country: "DEU",
    locale: "en-GB",
    dateFormat: "DD/MM/YYYY",
    defaultPressureUnit: "kPa",
    baseLatencyHours: 4,
    initialGoodwill: 70,
    amendmentActivationDay: 23,
  },
};

/** Site order used whenever sites are listed. */
export const SITE_IDS: readonly SiteId[] = ["SITE-A", "SITE-B", "SITE-C"];

/**
 * eCRF field pricing for the attention model, keyed by payload key. Keys not
 * listed (such as the sponsor-coded MHDECOD) are not keyed by the site and
 * cost nothing.
 */
export const ENTRY_FIELD_SPECS: Readonly<Record<string, EntryFieldSpec>> = {
  visit_date: { key: "visit_date", type: "date", nesting: 1 },
  pos: { key: "pos", type: "dropdown", options: 9, nesting: 1 },
  bp_unit: { key: "bp_unit", type: "dropdown", options: 3, nesting: 1 },
  raw_bp: { key: "raw_bp", type: "freetext", nesting: 1 },
  sbp: { key: "sbp", type: "numeric", nesting: 1 },
  dbp: { key: "dbp", type: "numeric", nesting: 1 },
  pulse: { key: "pulse", type: "numeric", nesting: 1 },
  sbp_sit: { key: "sbp_sit", type: "numeric", nesting: 1 },
  dbp_sit: { key: "dbp_sit", type: "numeric", nesting: 1 },
  sbp_stand: { key: "sbp_stand", type: "numeric", nesting: 1 },
  dbp_stand: { key: "dbp_stand", type: "numeric", nesting: 1 },
  MHTERM: { key: "MHTERM", type: "freetext", nesting: 1 },
  MHSTDTC: { key: "MHSTDTC", type: "date", nesting: 1 },
  MHCAT: { key: "MHCAT", type: "dropdown", options: 9, nesting: 1 },
  MHENRTPT: { key: "MHENRTPT", type: "dropdown", options: 2, nesting: 1 },
};

/**
 * Designated numeric fixtures that have a fatigue corruption alternative.
 * The Wave 1 B01 Day 14 systolic is the authored transposition (120 keyed as
 * 210) and fires whenever the coordinator's attention is below 40.
 */
export const SCRIPTED_TRANSPOSITIONS: ReadonlyArray<{
  submissionId: string;
  payloadKey: string;
  scripted: boolean;
}> = [{ submissionId: "sub-b01-d14", payloadKey: "sbp", scripted: true }];

/** Site answers to clarification queries that need no new source revision. */
export const SITE_CLARIFICATIONS: Readonly<Record<string, string>> = {
  "sub-a01-d07":
    "The scheduled assessment is the first reading, 120/80 sitting. The repeat after rest (118/78) was an unscheduled check and is retained as a note.",
};

/** Paper source worksheet facsimile shown in the Form View. */
export const SOURCE_WORKSHEETS: Readonly<
  Record<string, { hospital: string; clinician: string; text: string }>
> = {
  "sub-b01-d14": {
    hospital: "Mercy General",
    clinician: "J. Kelly RN",
    text: "Blood Pressure: 120/80 mmHg, Pulse: 75 bpm",
  },
};

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function iso(day: number, hh: number, mm: number): string {
  const ms = Date.UTC(2025, 10, 1 + day, hh, mm, 0);
  return `${new Date(ms).toISOString().slice(0, 19)}Z`;
}

function siteOf(subject: string): SiteId {
  return `SITE-${subject[0]}` as SiteId;
}

function code(subject: string): string {
  return subject.toLowerCase();
}

function vs(
  subject: string,
  day: number,
  assessed: [number, number],
  submitted: [number, number, number],
  payload: Record<string, unknown>,
  waveIndex: WaveIndex,
  formVersion: "v1" | "v2" = "v1",
  sessionId?: string
): SubmissionFixture {
  const submissionId = `sub-${code(subject)}-d${day.toString().padStart(2, "0")}`;
  return {
    submissionId,
    siteId: siteOf(subject),
    subjectId: `PD-101-${subject}`,
    kind: "VS",
    visitDay: day,
    assessedAt: iso(day, assessed[0], assessed[1]),
    submittedAt: iso(submitted[0], submitted[1], submitted[2]),
    formVersion,
    payload,
    waveIndex,
    sessionId: sessionId ?? submissionId,
  };
}

function mh(
  subject: string,
  submitted: [number, number, number],
  payload: Record<string, unknown>,
  sessionId?: string
): SubmissionFixture {
  const submissionId = `sub-${code(subject)}-mh`;
  return {
    submissionId,
    siteId: siteOf(subject),
    subjectId: `PD-101-${subject}`,
    kind: "MH",
    visitDay: 0,
    assessedAt: iso(0, 8, 30),
    submittedAt: iso(submitted[0], submitted[1], submitted[2]),
    formVersion: "v1",
    payload,
    waveIndex: 1,
    sessionId: sessionId ?? submissionId,
  };
}

/** The #1091 tracer bullet: Site A, six clean visits, 18 VS rows. */
export const TRACER_SUBMISSIONS: readonly SubmissionFixture[] = [
  vs(
    "A01",
    0,
    [9, 0],
    [0, 9, 15],
    { sbp: 118, dbp: 76, pulse: 68, pos: "SITTING" },
    1
  ),
  vs(
    "A02",
    0,
    [10, 15],
    [0, 10, 30],
    { sbp: 122, dbp: 80, pulse: 74, pos: "SITTING" },
    1
  ),
  vs(
    "A01",
    7,
    [9, 30],
    [7, 9, 45],
    { sbp: 120, dbp: 80, pulse: 72, pos: "SITTING" },
    1
  ),
  vs(
    "A02",
    7,
    [10, 0],
    [7, 10, 20],
    { sbp: 124, dbp: 82, pulse: 70, pos: "SITTING" },
    1
  ),
  vs(
    "A01",
    14,
    [9, 15],
    [14, 9, 30],
    { sbp: 116, dbp: 74, pulse: 66, pos: "SITTING" },
    1
  ),
  vs(
    "A02",
    14,
    [10, 45],
    [14, 11, 0],
    { sbp: 120, dbp: 78, pulse: 72, pos: "SITTING" },
    1
  ),
];

const MH_PAYLOADS: Record<string, Record<string, unknown>> = {
  A01: {
    MHTERM: "Essential Hypertension",
    MHSTDTC: "2020-04-12",
    MHCAT: "PRIMARY CONDITION",
    MHENRTPT: "ONGOING",
    MHDECOD: "Hypertension",
  },
  A02: {
    MHTERM: "Hypercholesterolemia",
    MHSTDTC: "2025-10",
    MHCAT: "BASELINE ABNORMALITY",
    MHENRTPT: "ONGOING",
    MHDECOD: "Hypercholesterolaemia",
  },
  B01: {
    MHTERM: "Seasonal Allergic Rhinitis",
    MHSTDTC: "2018-05-01",
    MHCAT: "BASELINE ABNORMALITY",
    MHENRTPT: "ONGOING",
    MHDECOD: "Rhinitis allergic",
  },
  B02: {
    MHTERM: "Gastroesophageal Reflux Disease",
    MHSTDTC: "2021-11-15",
    MHCAT: "BASELINE ABNORMALITY",
    MHENRTPT: "ONGOING",
    MHDECOD: "Gastrooesophageal reflux disease",
  },
  C01: {
    MHTERM: "Mild Intermittent Asthma",
    MHSTDTC: "2019-08-20",
    MHCAT: "BASELINE ABNORMALITY",
    MHENRTPT: "ONGOING",
    MHDECOD: "Asthma",
  },
  C02: {
    MHTERM: "Tension-Type Headache",
    MHSTDTC: "2022-02-10",
    MHCAT: "BASELINE ABNORMALITY",
    MHENRTPT: "ONGOING",
    MHDECOD: "Tension headache",
  },
};

const B_SESSION_W1 = "sess-b-wave1-backlog";
const B_SESSION_D24 = "sess-b-day27-backlog";
const B_SESSION_D28 = "sess-b-day28";

function bv1(sbp: number, dbp: number, pulse: number, day: number) {
  const date = new Date(Date.UTC(2025, 10, 1 + day));
  const mmdd = `${(date.getUTCMonth() + 1).toString().padStart(2, "0")}/${date
    .getUTCDate()
    .toString()
    .padStart(2, "0")}/${date.getUTCFullYear()}`;
  return { visit_date: mmdd, pos: "SITTING", sbp, dbp, pulse };
}

/**
 * The full level: Wave 1 (Days 0, 7, 14; 54 VS + 6 MH), Wave 2 (Day 24;
 * +26 VS) and Wave 3 (Day 28; +30 VS). Payloads hold the paper source
 * values; what the coordinator keys is modelled by the attention engine.
 * Site B keys its whole Wave 1 backlog in one Day 14 evening session.
 */
export const FULL_SUBMISSIONS: readonly SubmissionFixture[] = [
  // Wave 1, Site A
  mh("A01", [0, 9, 15], MH_PAYLOADS.A01),
  vs("A01", 0, [9, 0], [0, 9, 15], { sbp: 118, dbp: 76, pulse: 68 }, 1),
  mh("A02", [0, 10, 30], MH_PAYLOADS.A02),
  vs("A02", 0, [10, 15], [0, 10, 30], { sbp: 122, dbp: 80, pulse: 74 }, 1),
  vs(
    "A01",
    7,
    [9, 30],
    [7, 9, 45],
    { raw_bp: "120/80 sitting, repeat after rest 118/78", pulse: 72 },
    1
  ),
  vs("A02", 7, [10, 0], [7, 10, 20], { sbp: 124, dbp: 82, pulse: 70 }, 1),
  vs("A01", 14, [9, 15], [14, 9, 30], { sbp: 116, dbp: 74, pulse: 66 }, 1),
  vs("A02", 14, [10, 45], [14, 11, 0], { sbp: 120, dbp: 78, pulse: 72 }, 1),
  // Wave 1, Site C
  mh("C01", [0, 10, 0], MH_PAYLOADS.C01),
  vs(
    "C01",
    0,
    [9, 30],
    [0, 10, 0],
    {
      visit_date: "01/11/2025",
      sbp: "15.7",
      dbp: "10.4",
      bp_unit: "kPa",
      pulse: 66,
    },
    1
  ),
  mh("C02", [0, 11, 30], MH_PAYLOADS.C02),
  vs(
    "C02",
    0,
    [11, 0],
    [0, 11, 30],
    {
      visit_date: "01/11/2025",
      sbp: "16.3",
      dbp: "10.8",
      bp_unit: "kPa",
      pulse: 72,
    },
    1
  ),
  vs(
    "C01",
    7,
    [9, 30],
    [7, 10, 0],
    {
      visit_date: "08/11/2025",
      sbp: "16.0",
      dbp: "10.7",
      bp_unit: "kPa",
      pulse: 68,
    },
    1
  ),
  vs(
    "C02",
    7,
    [11, 0],
    [7, 11, 30],
    {
      visit_date: "08/11/2025",
      sbp: "16.1",
      dbp: "10.7",
      bp_unit: "kPa",
      pulse: 70,
    },
    1
  ),
  vs(
    "C01",
    14,
    [9, 30],
    [14, 10, 0],
    {
      visit_date: "15/11/2025",
      sbp: "15.9",
      dbp: "10.5",
      bp_unit: "kPa",
      pulse: 70,
    },
    1
  ),
  vs(
    "C02",
    14,
    [11, 0],
    [14, 11, 30],
    {
      visit_date: "15/11/2025",
      sbp: "16.0",
      dbp: "10.5",
      bp_unit: "kPa",
      pulse: 68,
    },
    1
  ),
  // Wave 1, Site B: one fatigued backlog session on Day 14 at 16:00
  mh("B01", [14, 16, 0], MH_PAYLOADS.B01, B_SESSION_W1),
  mh("B02", [14, 16, 0], MH_PAYLOADS.B02, B_SESSION_W1),
  vs(
    "B01",
    0,
    [9, 15],
    [14, 16, 0],
    bv1(122, 78, 70, 0),
    1,
    "v1",
    B_SESSION_W1
  ),
  vs(
    "B02",
    0,
    [10, 30],
    [14, 16, 0],
    bv1(126, 84, 76, 0),
    1,
    "v1",
    B_SESSION_W1
  ),
  vs(
    "B01",
    7,
    [9, 15],
    [14, 16, 0],
    bv1(120, 80, 72, 7),
    1,
    "v1",
    B_SESSION_W1
  ),
  vs(
    "B02",
    7,
    [10, 30],
    [14, 16, 0],
    bv1(122, 80, 72, 7),
    1,
    "v1",
    B_SESSION_W1
  ),
  vs(
    "B01",
    14,
    [9, 15],
    [14, 16, 0],
    bv1(120, 80, 75, 14),
    1,
    "v1",
    B_SESSION_W1
  ),
  vs(
    "B02",
    14,
    [10, 30],
    [14, 16, 0],
    bv1(124, 82, 74, 14),
    1,
    "v1",
    B_SESSION_W1
  ),
  // Wave 2 (Day 24)
  vs(
    "A01",
    24,
    [9, 0],
    [24, 9, 30],
    { sbp_sit: 120, dbp_sit: 80, pulse: 72, sbp_stand: 98, dbp_stand: 68 },
    2,
    "v2"
  ),
  vs(
    "A02",
    24,
    [10, 15],
    [24, 10, 45],
    { sbp_sit: 122, dbp_sit: 78, pulse: 70, sbp_stand: 104, dbp_stand: 72 },
    2,
    "v2"
  ),
  vs(
    "C01",
    24,
    [9, 30],
    [24, 10, 0],
    {
      visit_date: "25/11/2025",
      sbp_sit: "16.0",
      dbp_sit: "10.7",
      pulse: 68,
      sbp_stand: "13.6",
      dbp_stand: "9.3",
      bp_unit: "kPa",
    },
    2,
    "v2"
  ),
  vs(
    "C02",
    24,
    [11, 0],
    [24, 11, 30],
    {
      visit_date: "25/11/2025",
      sbp_sit: "16.3",
      dbp_sit: "10.7",
      pulse: 70,
      sbp_stand: "14.0",
      dbp_stand: "9.5",
      bp_unit: "kPa",
    },
    2,
    "v2"
  ),
  vs(
    "B01",
    24,
    [14, 0],
    [27, 16, 0],
    { sbp: 118, dbp: 76, pulse: 74, pos: "SITTING" },
    2,
    "v1",
    B_SESSION_D24
  ),
  vs(
    "B02",
    24,
    [15, 30],
    [27, 16, 30],
    { sbp: 124, dbp: 82, pulse: 76, pos: "SITTING" },
    2,
    "v1",
    B_SESSION_D24
  ),
  // Wave 3 (Day 28)
  vs(
    "A01",
    28,
    [9, 0],
    [28, 9, 30],
    { sbp_sit: 118, dbp_sit: 76, pulse: 68, sbp_stand: 96, dbp_stand: 66 },
    3,
    "v2"
  ),
  vs(
    "A02",
    28,
    [10, 15],
    [28, 10, 45],
    { sbp_sit: 120, dbp_sit: 78, pulse: 70, sbp_stand: 108, dbp_stand: 72 },
    3,
    "v2"
  ),
  vs(
    "C01",
    28,
    [9, 30],
    [28, 10, 0],
    {
      visit_date: "29/11/2025",
      sbp_sit: "16.0",
      dbp_sit: "10.7",
      pulse: 66,
      sbp_stand: "13.3",
      dbp_stand: "9.1",
      bp_unit: "kPa",
    },
    3,
    "v2"
  ),
  vs(
    "C02",
    28,
    [11, 0],
    [28, 11, 30],
    {
      visit_date: "29/11/2025",
      sbp_sit: "16.0",
      dbp_sit: "10.5",
      pulse: 70,
      sbp_stand: "13.9",
      dbp_stand: "9.4",
      bp_unit: "kPa",
    },
    3,
    "v2"
  ),
  vs(
    "B01",
    28,
    [14, 0],
    [28, 16, 0],
    { sbp_sit: 120, dbp_sit: 80, pulse: 72, sbp_stand: 102, dbp_stand: 70 },
    3,
    "v2",
    B_SESSION_D28
  ),
  vs(
    "B02",
    28,
    [15, 30],
    [28, 16, 0],
    { sbp_sit: 122, dbp_sit: 82, pulse: 74, sbp_stand: 106, dbp_stand: 74 },
    3,
    "v2",
    B_SESSION_D28
  ),
];

/** Wave boundaries: the clock halts at each end minute's day and time. */
export const WAVE_ENDS: Readonly<
  Record<WaveIndex, { day: number; hour: number; minute: number }>
> = {
  1: { day: 14, hour: 23, minute: 59 },
  2: { day: 27, hour: 23, minute: 59 },
  3: { day: 28, hour: 23, minute: 59 },
};

// ---------------------------------------------------------------------------
// Reference pipelines
// ---------------------------------------------------------------------------

function node(
  id: string,
  type: ChipKind,
  x: number,
  y: number,
  data?: CanvasNode["data"]
): CanvasNode {
  return data
    ? { id, type, position: { x, y }, data }
    : { id, type, position: { x, y } };
}

function edge(
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string
): CanvasEdge {
  return {
    id: `${source}.${sourceHandle}->${target}.${targetHandle}`,
    source,
    sourceHandle,
    target,
    targetHandle,
  };
}

/** The #1091 four-chip tracer pipeline at the issue's coordinates. */
export const TRACER_GRAPH: PipelineGraph = {
  nodes: [
    node("ingest", "SourceIngest", 40, 180),
    node("extract", "ExtractField", 260, 180),
    node("pivot", "PivotToObservation", 500, 180),
    node("sink", "CDISCSink", 760, 180),
  ],
  edges: [
    edge("ingest", "raw_entry", "extract", "in"),
    edge("extract", "sbp", "pivot", "sbp"),
    edge("extract", "dbp", "pivot", "dbp"),
    edge("extract", "pulse", "pivot", "pulse"),
    edge("pivot", "obs_stream", "sink", "obs_in"),
  ],
};

const WAVE1_NODES: CanvasNode[] = [
  node("ingest", "SourceIngest", 40, 180),
  node("extract", "ExtractField", 220, 180),
  node("regex", "RegexSplit", 400, 120),
  node("date", "DateLocaleNormalizer", 400, 270),
  node("unit-sbp", "UnitStandardizer", 580, 120),
  node("unit-dbp", "UnitStandardizer", 580, 200),
  node("pivot", "PivotToObservation", 760, 180),
  node("sink", "CDISCSink", 940, 180),
];

const WAVE1_EDGES: CanvasEdge[] = [
  edge("extract", "raw_bp", "regex", "text_in"),
  edge("extract", "visit_date", "date", "date_in"),
  edge("extract", "sbp", "unit-sbp", "val_in"),
  edge("regex", "sbp", "unit-sbp", "val_in"),
  edge("extract", "dbp", "unit-dbp", "val_in"),
  edge("regex", "dbp", "unit-dbp", "val_in"),
  edge("unit-sbp", "std_val", "pivot", "sbp"),
  edge("unit-dbp", "std_val", "pivot", "dbp"),
  edge("extract", "pulse", "pivot", "pulse"),
  edge("date", "iso_date", "pivot", "date"),
  edge("pivot", "obs_stream", "sink", "obs_in"),
  edge("ingest", "mh_entry", "sink", "mh_in"),
];

/** Wave 1 pipeline for all three sites: regex split, locale dates, kPa. */
export const WAVE1_GRAPH: PipelineGraph = {
  nodes: WAVE1_NODES,
  edges: [edge("ingest", "raw_entry", "extract", "in"), ...WAVE1_EDGES],
};

const AMENDMENT_NODES: CanvasNode[] = [
  ...WAVE1_NODES,
  node("router", "AmendmentRouter", 130, 300, { routeBy: "assessedAt" }),
  node("unit-sbp-stand", "UnitStandardizer", 580, 280),
  node("unit-dbp-stand", "UnitStandardizer", 580, 340),
];

const AMENDMENT_EDGES: CanvasEdge[] = [
  edge("ingest", "raw_entry", "router", "in"),
  edge("router", "v1", "extract", "in"),
  edge("router", "v2", "extract", "in"),
  ...WAVE1_EDGES,
  edge("extract", "sbp_stand", "unit-sbp-stand", "val_in"),
  edge("extract", "dbp_stand", "unit-dbp-stand", "val_in"),
  edge("unit-sbp-stand", "std_val", "pivot", "sbp_stand"),
  edge("unit-dbp-stand", "std_val", "pivot", "dbp_stand"),
];

/** Amendment 01 pipeline: AmendmentRouter plus standing-pressure branch. */
export const AMENDMENT_GRAPH: PipelineGraph = {
  nodes: AMENDMENT_NODES,
  edges: AMENDMENT_EDGES,
};

/** Full pipeline: amendment routing plus the ADaM analysis lane. */
export const FULL_GRAPH: PipelineGraph = {
  nodes: [
    ...AMENDMENT_NODES,
    node("handoff", "SnapshotHandoff", 1120, 380),
    node("pair", "PairAndDerive", 1120, 500, { joinKey: "visit" }),
  ],
  edges: [
    ...AMENDMENT_EDGES,
    edge("sink", "snapshot_out", "handoff", "snapshot_in"),
    edge("handoff", "clean_records", "pair", "records_in"),
  ],
};

// ---------------------------------------------------------------------------
// Golden ADVS table (#1095)
// ---------------------------------------------------------------------------

/** One row of the #1095 golden ADVS table. */
export type GoldenAdvsRow = Pick<
  ADaMVitalSignRecord,
  "USUBJID" | "AVISITN" | "PARAMCD" | "CRIT1FL"
> & { sitting: number; standing: number; aval: number };

function g(
  subject: string,
  day: number,
  param: "OSBPDRP" | "ODBPDRP",
  sitting: number,
  standing: number,
  aval: number,
  flag: "Y" | "N"
): GoldenAdvsRow {
  return {
    USUBJID: `PD-101-${subject}`,
    AVISITN: day,
    PARAMCD: param,
    sitting,
    standing,
    aval,
    CRIT1FL: flag,
  };
}

/**
 * The 20 evaluable ADVS rows exactly as #1095 tabulates them (values at
 * display precision). Rows for C01 and C02 Day 28 systolic were rounded
 * before subtraction in the issue (20.2 and 15.7); the engine derives from
 * unrounded values (decision 10), which display as 20.3 and 15.8, so the
 * golden check allows one display step (0.1).
 */
export const GOLDEN_ADVS: readonly GoldenAdvsRow[] = [
  g("A01", 24, "OSBPDRP", 120, 98, 22, "Y"),
  g("A01", 24, "ODBPDRP", 80, 68, 12, "Y"),
  g("A02", 24, "OSBPDRP", 122, 104, 18, "N"),
  g("A02", 24, "ODBPDRP", 78, 72, 6, "N"),
  g("C01", 24, "OSBPDRP", 120.0, 102.0, 18.0, "N"),
  g("C01", 24, "ODBPDRP", 80.3, 69.8, 10.5, "Y"),
  g("C02", 24, "OSBPDRP", 122.3, 105.0, 17.3, "N"),
  g("C02", 24, "ODBPDRP", 80.3, 71.3, 9.0, "N"),
  g("A01", 28, "OSBPDRP", 118, 96, 22, "Y"),
  g("A01", 28, "ODBPDRP", 76, 66, 10, "Y"),
  g("A02", 28, "OSBPDRP", 120, 108, 12, "N"),
  g("A02", 28, "ODBPDRP", 78, 72, 6, "N"),
  g("B01", 28, "OSBPDRP", 120, 102, 18, "N"),
  g("B01", 28, "ODBPDRP", 80, 70, 10, "Y"),
  g("B02", 28, "OSBPDRP", 122, 106, 16, "N"),
  g("B02", 28, "ODBPDRP", 82, 74, 8, "N"),
  g("C01", 28, "OSBPDRP", 120.0, 99.8, 20.2, "Y"),
  g("C01", 28, "ODBPDRP", 80.3, 68.3, 12.0, "Y"),
  g("C02", 28, "OSBPDRP", 120.0, 104.3, 15.7, "N"),
  g("C02", 28, "ODBPDRP", 78.8, 70.5, 8.3, "N"),
];

/** CSV headers for each export, in column order. */
export const CSV_HEADERS = {
  VS: [
    "STUDYID",
    "DOMAIN",
    "USUBJID",
    "VSSEQ",
    "VSTESTCD",
    "VSTEST",
    "VSORRES",
    "VSORRESU",
    "VSSTRESC",
    "VSSTRESN",
    "VSSTRESU",
    "VSPOS",
    "VISIT",
    "VISITNUM",
    "VSDTC",
    "EPOCH",
  ],
  MH: [
    "STUDYID",
    "DOMAIN",
    "USUBJID",
    "MHSEQ",
    "MHTERM",
    "MHDECOD",
    "MHCAT",
    "MHSTDTC",
    "MHENRTPT",
  ],
  ADVS: [
    "STUDYID",
    "USUBJID",
    "PARAMCD",
    "PARAM",
    "AVISIT",
    "AVISITN",
    "AVAL",
    "AVALC",
    "BASE",
    "CHG",
    "CRIT1",
    "CRIT1FL",
    "ANL01FL",
  ],
} as const;
