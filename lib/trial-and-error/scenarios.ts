/**
 * Scenario presets for Trial & Error: Biostat Ops.
 *
 * Act I is a Phase I safety study played as three Blinds: Internal QC, the
 * sponsor's safety review, then the Dose Escalation Committee (ADR 0046).
 * The study opens on one population snapshot; a scripted data change during
 * the sponsor review moves it to a second version. The Boss is drawn from
 * the act's Boss pool, and every Blind after the first opens on a card from
 * the crisis deck (T&E-05). Act II, the Phase II proof of concept, plays
 * internal QC and the DMC's open session under a new SAP, then draws its
 * Boss from a pool of two (#1084). Act III, the Phase III blinded pivotal
 * study, deals the first efficacy outputs and ends on CSR Lock (#1085).
 * All subjects, events, values and
 * rules are fictional teaching material. They supply game context only and
 * are not clinical or regulatory advice.
 */
import type {
  Act,
  CrisisCard,
  DmcDefense,
  FdaIr,
  AdverseEvent,
  FootnoteSeal,
  Relic,
  RowStatistic,
  SapRulebook,
  Scenario,
  ShopCatalog,
  ShopEntry,
  StagedTable,
  Subject,
  TableShellSpec,
  TlfCard,
} from "./types";
import { GUIDANCE_CARDS } from "./internal/guidance";
import { roundRatio } from "./internal/rounding";

const snapshotId = "SNAP-P1-v1";

const ALL = ["SCREENED", "ITT", "SAFETY", "FAS", "PER_PROTOCOL"] as const;
const NO_PP = ["SCREENED", "ITT", "SAFETY", "FAS"] as const;
// S-008 had no post-baseline assessment: randomized (ITT) but outside the FAS.
const ITT_ONLY = ["SCREENED", "ITT", "SAFETY"] as const;

const CARDIAC = "Cardiac disorders";
const GI = "Gastrointestinal disorders";
const GENERAL = "General disorders and administration site conditions";
const INFECTIONS = "Infections and infestations";
const NERVOUS = "Nervous system disorders";
const SKIN = "Skin and subcutaneous tissue disorders";

const ae = (
  soc: string,
  term: string,
  grade: number,
  flags: { serious?: true; ledToDiscontinuation?: true } = {}
): AdverseEvent => ({
  soc,
  term,
  grade,
  serious: flags.serious ?? false,
  ledToDiscontinuation: flags.ledToDiscontinuation ?? false,
});

const subject = (
  id: string,
  arm: Subject["arm"],
  age: number,
  sex: Subject["sex"],
  populations: Subject["populations"],
  adverseEvents?: AdverseEvent[]
): Subject => ({
  id,
  arm,
  age,
  sex,
  populations,
  ...(adverseEvents ? { adverseEvents } : {}),
});

/**
 * The study's opening snapshot. Safety = ITT = 12 (6/6); FAS 11 (6/5);
 * Per-Protocol 9 (5/4). Eight subjects report 13 treatment-emergent events,
 * so counting events instead of subjects is always a visible mistake.
 */
const POPULATION_SNAPSHOT: Scenario["populationSnapshot"] = {
  id: snapshotId,
  version: 1,
  capturedAt: "2026-01-15T09:00:00Z",
  subjects: [
    subject("S-001", "PLACEBO", 34, "F", [...ALL]),
    subject("S-002", "PLACEBO", 41, "M", [...ALL]),
    subject("S-003", "PLACEBO", 47, "F", [...ALL], [ae(GENERAL, "Fatigue", 1)]),
    subject("S-004", "PLACEBO", 52, "M", [...NO_PP]),
    subject(
      "S-005",
      "PLACEBO",
      58,
      "F",
      [...ALL],
      [ae(INFECTIONS, "Pneumonia", 3, { serious: true }), ae(GI, "Nausea", 1)]
    ),
    subject(
      "S-006",
      "PLACEBO",
      67,
      "M",
      [...ALL],
      [ae(NERVOUS, "Headache", 1)]
    ),
    subject(
      "S-007",
      "ACTIVE",
      22,
      "F",
      [...ALL],
      [ae(NERVOUS, "Headache", 1), ae(GI, "Nausea", 1), ae(GI, "Vomiting", 1)]
    ),
    subject(
      "S-008",
      "ACTIVE",
      66,
      "M",
      [...ITT_ONLY],
      [
        ae(CARDIAC, "Atrial fibrillation", 3, {
          serious: true,
          ledToDiscontinuation: true,
        }),
      ]
    ),
    subject("S-009", "ACTIVE", 25, "F", [...ALL], [ae(SKIN, "Rash", 1)]),
    subject(
      "S-010",
      "ACTIVE",
      70,
      "F",
      [...ALL],
      [
        ae(NERVOUS, "Syncope", 3, { serious: true }),
        ae(NERVOUS, "Dizziness", 2),
      ]
    ),
    subject(
      "S-011",
      "ACTIVE",
      29,
      "F",
      [...ALL],
      [ae(GENERAL, "Fatigue", 1), ae(GENERAL, "Injection site reaction", 1)]
    ),
    subject("S-012", "ACTIVE", 32, "M", [...NO_PP]),
  ],
};

const columns: StagedTable["columns"] = [
  { id: "placebo", label: "Placebo", arm: "PLACEBO" },
  { id: "active", label: "Active", arm: "ACTIVE" },
  { id: "total", label: "Total", arm: "TOTAL" },
];

type Row = StagedTable["rows"][number];
const row = (id: string, label: string, statistic: RowStatistic): Row => ({
  id,
  label,
  statistic,
});
const N_ROW = row("n", "Subjects, N", { kind: "POPULATION_N" });

const draftOf =
  (shellId: string, rows: Row[], cols: StagedTable["columns"] = columns) =>
  (id: string, draftLabel: string, cells: string[][]): StagedTable => ({
    id,
    shellId,
    draftLabel,
    populationSnapshotId: snapshotId,
    columns: cols,
    rows,
    cells,
  });

const card = (c: TlfCard): TlfCard => c;

/** A draft card: its face is compiled from the staged draft it points at. */
const draftCard = (
  draft: StagedTable,
  shell: TableShellSpec,
  fields: Pick<TlfCard, "title" | "topic" | "csrStage" | "soc">
): TlfCard => ({
  id: `C-${draft.id.replace(/^T-/, "T")}`,
  cardType: "TABLE",
  number: shell.tableNumber,
  population: shell.targetPopulation,
  chips: shell.chips,
  mult: shell.mult,
  draftId: draft.id,
  ...fields,
});

// Supporting listings and face-only tables, shared across Act I. Face data is
// fictional and consistent with the snapshot.

const DM_LISTING = card({
  id: "C-L16.2.4",
  cardType: "LISTING",
  number: "Listing 16.2.4",
  title: "Demographic Data by Subject",
  population: "ITT",
  chips: 20,
  mult: 0,
  topic: "DM",
  csrStage: "PATIENT_LISTING",
  face: {
    kind: "LISTING",
    columns: ["Subject", "Arm", "Age", "Sex"],
    rows: [
      ["S-001", "PBO", "34", "F"],
      ["S-002", "PBO", "41", "M"],
      ["S-007", "ACT", "22", "F"],
      ["S-008", "ACT", "66", "M"],
    ],
  },
});

const DISPOSITION = card({
  id: "C-T14.1.2",
  cardType: "TABLE",
  number: "Table 14.1.2",
  title: "Subject Disposition",
  population: "ITT",
  chips: 25,
  mult: 1,
  topic: "DS",
  csrStage: "DISPOSITION",
  face: {
    kind: "TABLE",
    columns: ["Placebo", "Active", "Total"],
    rows: [
      { label: "Randomized", values: ["6", "6", "12"] },
      { label: "Completed", values: ["5 (83.3)", "4 (66.7)", "9 (75.0)"] },
      { label: "Discontinued", values: ["1 (16.7)", "2 (33.3)", "3 (25.0)"] },
      { label: "Adverse event", values: ["0 (0.0)", "1 (16.7)", "1 (8.3)"] },
    ],
  },
});

const AE_LISTING = card({
  id: "C-L16.2.7",
  cardType: "LISTING",
  number: "Listing 16.2.7",
  title: "Adverse Events by Subject",
  population: "SAFETY",
  chips: 20,
  mult: 0,
  topic: "AE",
  csrStage: "PATIENT_LISTING",
  face: {
    kind: "LISTING",
    columns: ["Subject", "Preferred term", "Grade"],
    rows: [
      ["S-003", "Fatigue", "1"],
      ["S-007", "Headache", "1"],
      ["S-008", "Atrial fibrillation", "3"],
      ["S-010", "Syncope", "3"],
    ],
  },
});

const DISCONTINUED_LISTING = card({
  id: "C-L16.1.1",
  cardType: "LISTING",
  number: "Listing 16.1.1",
  title: "Discontinued Subjects",
  population: "ITT",
  chips: 15,
  mult: 0,
  topic: "DS",
  csrStage: "PATIENT_LISTING",
  face: {
    kind: "LISTING",
    columns: ["Subject", "Arm", "Reason"],
    rows: [
      ["S-004", "PBO", "Withdrew consent"],
      ["S-008", "ACT", "Adverse event"],
      ["S-012", "ACT", "Lost to follow-up"],
    ],
  },
});

const SAE_LISTING = card({
  id: "C-L16.2.8",
  cardType: "LISTING",
  number: "Listing 16.2.8",
  title: "Serious Adverse Events",
  population: "SAFETY",
  chips: 20,
  mult: 0,
  topic: "SAE",
  csrStage: "PATIENT_LISTING",
  face: {
    kind: "LISTING",
    columns: ["Subject", "Serious event", "Outcome"],
    rows: [
      ["S-005", "Pneumonia", "Recovered"],
      ["S-008", "Atrial fibrillation", "Recovered"],
      ["S-010", "Syncope", "Recovered"],
    ],
  },
});

// ---------------------------------------------------------------------------
// Small Blind: Internal QC. Demographics (Table 14.1.1) under SAP-DM-001.
// ---------------------------------------------------------------------------

const demographicsRows: Row[] = [
  N_ROW,
  row("age", "Age (years), mean", { kind: "MEAN_AGE" }),
  row("female", "Female, n (%)", { kind: "SEX_COUNT_PCT", sex: "F" }),
  row("male", "Male, n (%)", { kind: "SEX_COUNT_PCT", sex: "M" }),
  row("age65", "Age ≥ 65, n (%)", {
    kind: "AGE_AT_LEAST_COUNT_PCT",
    minAge: 65,
  }),
];
const demographicsDraft = draftOf("T-14.1.1", demographicsRows);

const DEMOGRAPHICS_CLEAN = [
  ["6", "6", "12"],
  ["49.8", "40.7", "45.2"],
  ["3 (50.0)", "4 (66.7)", "7 (58.3)"],
  ["3 (50.0)", "2 (33.3)", "5 (41.7)"],
  ["1 (16.7)", "2 (33.3)", "3 (25.0)"],
];

const demographicsCard = (id: "A" | "B" | "C"): TlfCard =>
  card({
    id: `C-T14.1.1-${id}`,
    cardType: "TABLE",
    number: "Table 14.1.1",
    title: `Demographics (Draft ${id})`,
    population: "ITT",
    chips: 30,
    mult: 1,
    topic: "DM",
    csrStage: "BASELINE",
    draftId: `T-14.1.1-${id}`,
  });

/**
 * Table 14.1.3, a blank demographics shell. The SAP allows it on the ITT or
 * the Safety population, so the player chooses its suit when allocating.
 */
const demographicsShell = (rulebookId: string): TableShellSpec => ({
  id: "T-14.1.3",
  tableNumber: "Table 14.1.3",
  title: "Demographics and Baseline Characteristics (blank shell)",
  cardType: "TABLE",
  targetPopulation: "ITT",
  compatiblePopulations: ["ITT", "SAFETY"],
  chips: 30,
  mult: 1,
  requiredRulebookId: rulebookId,
  allowedFootnoteSlots: 1,
  layout: { columns, rows: demographicsRows },
});

const DEMOGRAPHICS_BLANK = card({
  id: "C-T14.1.3",
  cardType: "TABLE",
  number: "Table 14.1.3",
  title: "Demographics",
  population: "ITT",
  chips: 30,
  mult: 1,
  topic: "DM",
  csrStage: "BASELINE",
  shellId: "T-14.1.3",
});

// Footnote seals: real table footnotes that legitimise a presentation choice.

const SPONSOR_ROUNDING: FootnoteSeal = {
  id: "FN-ROUND-SPONSOR",
  name: "Sponsor rounding standard",
  footnote:
    "Percentages and means are rounded half away from zero, per the sponsor's reporting standard (SAP §9.1, note 2).",
  effect: { kind: "WAIVE" },
  eligible: { cardTypes: ["TABLE"] },
  sellValue: 1,
};

const ADJUDICATED: FootnoteSeal = {
  id: "FN-ADJUDICATED",
  name: "Adjudicated Endpoint",
  footnote:
    "Serious events were adjudicated by an independent committee blinded to treatment.",
  effect: { kind: "PLUS_MULT", value: 3 },
  eligible: { cardTypes: ["TABLE"], populations: ["SAFETY"] },
  sellValue: 2,
};

const AE_NOT_EXCLUSIVE: FootnoteSeal = {
  id: "FN-AE-OVERLAP",
  name: "AE Not Mutually Exclusive",
  footnote:
    "A subject with more than one event is counted once in each row that applies, so rows are not mutually exclusive.",
  effect: { kind: "PLUS_CHIPS", value: 20 },
  eligible: { cardTypes: ["TABLE"], populations: ["SAFETY"], topics: ["AE"] },
  sellValue: 1,
};

/**
 * The Small Blind deck, dealt in this order. The three Table 14.1.1 drafts
 * carry reviewable cells, and the blank Table 14.1.3 shell compiles its cells
 * when an analysis set is allocated to it; the safety tables here are
 * face-only previews of what the next two Blinds put under review.
 */
const DEMOGRAPHICS_DECK: TlfCard[] = [
  demographicsCard("A"),
  DM_LISTING,
  DISPOSITION,
  card({
    id: "C-T14.3.1",
    cardType: "TABLE",
    number: "Table 14.3.1",
    title: "Overview of Adverse Events",
    population: "SAFETY",
    chips: 35,
    mult: 1,
    topic: "AE",
    csrStage: "SAFETY_AE",
    face: {
      kind: "TABLE",
      columns: ["Placebo", "Active", "Total"],
      rows: [
        { label: "Any TEAE", values: ["3 (50.0)", "5 (83.3)", "8 (66.7)"] },
        { label: "Serious AE", values: ["1 (16.7)", "2 (33.3)", "3 (25.0)"] },
        { label: "AE to discont.", values: ["0 (0.0)", "1 (16.7)", "1 (8.3)"] },
        { label: "Deaths", values: ["0 (0.0)", "0 (0.0)", "0 (0.0)"] },
      ],
    },
  }),
  AE_LISTING,
  DISCONTINUED_LISTING,
  demographicsCard("B"),
  demographicsCard("C"),
  DEMOGRAPHICS_BLANK,
  card({
    id: "C-T14.3.2",
    cardType: "TABLE",
    number: "Table 14.3.2.1",
    title: "AEs by SOC: Cardiac Disorders",
    population: "SAFETY",
    chips: 25,
    mult: 1,
    topic: "AE",
    csrStage: "SAFETY_AE",
    soc: CARDIAC,
    face: {
      kind: "TABLE",
      columns: ["Placebo", "Active", "Total"],
      rows: [
        { label: "Cardiac (SOC)", values: ["0 (0.0)", "1 (16.7)", "1 (8.3)"] },
        {
          label: "Atrial fibrillation",
          values: ["0 (0.0)", "1 (16.7)", "1 (8.3)"],
        },
        { label: "Palpitations", values: ["0 (0.0)", "0 (0.0)", "0 (0.0)"] },
      ],
    },
  }),
  SAE_LISTING,
];

/**
 * Small Blind. The SAP population is ITT (N=12). FAS (N=11) is a distinct
 * population here: the SAP declares no alias, so a percentage divided by the
 * FAS N is a fatal denominator error. Rounding is half-to-even at one decimal
 * place, and the Total mean age is exactly 45.25, so the convention decides
 * between 45.2 and 45.3.
 */
export const DEMOGRAPHICS_SCENARIO: Scenario = {
  id: "demographics-small-blind",
  title: "Demographics QC Desk",
  summary:
    "Internal QC review of Table 14.1.1 (Demographics, ITT) before the first data review.",
  intro:
    "Phase I, first data review. Your own QC team checks the demographics table before anyone outside sees it. Inspect a draft, correct what the SAP forbids, and play it with its supporting listing.",
  blind: {
    tier: "SMALL_BLIND",
    name: "Small Blind: Internal QC",
    quota: 450,
  },
  handType: "HIGH_TABLE",
  startingCpu: 6,
  table: { startingCpu: 10, handSize: 8, maxSelection: 5 },
  deck: DEMOGRAPHICS_DECK,
  rulebook: {
    id: "SAP-DM-001",
    title: "SAP §9.1 Demographics and Baseline Characteristics",
    populationSuit: "ITT",
    populationAliases: [],
    percentPrecision: 1,
    meanPrecision: 1,
    roundingMode: "HALF_EVEN",
    rules: [
      {
        id: "SAP-DM-01",
        category: "DENOMINATOR",
        severity: "FATAL",
        statement:
          "Header N and every percentage use the ITT population from the locked snapshot. FAS is a separate population and is not interchangeable with ITT.",
        consequence:
          "A wrong denominator misstates every percentage in the column. While it stands, the hand's final Mult is 0.",
        correctionMultBonus: 1,
        redlineMultPenalty: 0,
      },
      {
        id: "SAP-DM-02",
        category: "PRECISION",
        severity: "MINOR",
        statement: "Percentages and means are reported to 1 decimal place.",
        consequence:
          "Inconsistent precision implies accuracy the data does not have. Redline: −1 Mult; correcting it earns +2 Mult.",
        correctionMultBonus: 2,
        redlineMultPenalty: 1,
      },
      {
        id: "SAP-DM-03",
        category: "ROUNDING",
        severity: "MINOR",
        statement:
          "Ties round half-to-even (banker's rounding): 45.25 becomes 45.2, unless the output footnotes the sponsor's half-away-from-zero standard.",
        consequence:
          "A different convention silently shifts ties and breaks double programming. Redline: −1 Mult; correcting it earns +1 Mult. The sponsor rounding footnote waives the redline.",
        correctionMultBonus: 1,
        redlineMultPenalty: 1,
        waivableBy: [SPONSOR_ROUNDING.id],
      },
      {
        id: "SAP-DM-04",
        category: "VALUE",
        severity: "MAJOR",
        statement:
          "Every count and statistic must reproduce from the population snapshot.",
        consequence:
          "An unreproducible number cannot be defended at review. Redline: −2 Mult; correcting it earns +1 Mult.",
        correctionMultBonus: 1,
        redlineMultPenalty: 2,
      },
    ],
  },
  populationSnapshot: POPULATION_SNAPSHOT,
  consumables: [SPONSOR_ROUNDING, ADJUDICATED],
  shells: [
    demographicsShell("SAP-DM-001"),
    {
      id: "T-14.1.1",
      tableNumber: "Table 14.1.1",
      title: "Demographics and Baseline Characteristics (ITT)",
      cardType: "TABLE",
      targetPopulation: "ITT",
      chips: 30,
      mult: 1,
      requiredRulebookId: "SAP-DM-001",
      allowedFootnoteSlots: 1,
    },
  ],
  drawPile: [
    // Draft A: Total column divided by the FAS N, 2-dp precision slip,
    // half-away rounding of an exact tie.
    demographicsDraft("T-14.1.1-A", "Draft A (v0.1)", [
      ["6", "6", "12"],
      ["49.8", "40.7", "45.3"],
      ["3 (50.0)", "4 (66.67)", "7 (63.6)"],
      ["3 (50.0)", "2 (33.3)", "5 (45.5)"],
      ["1 (16.7)", "2 (33.3)", "3 (27.3)"],
    ]),
    // Draft B: one integer percentage.
    demographicsDraft("T-14.1.1-B", "Draft B (v0.2)", [
      ["6", "6", "12"],
      ["49.8", "40.7", "45.2"],
      ["3 (50)", "4 (66.7)", "7 (58.3)"],
      ["3 (50.0)", "2 (33.3)", "5 (41.7)"],
      ["1 (16.7)", "2 (33.3)", "3 (25.0)"],
    ]),
    // Draft C: clean.
    demographicsDraft("T-14.1.1-C", "Draft C (v0.3)", DEMOGRAPHICS_CLEAN),
  ],
};

// ---------------------------------------------------------------------------
// Safety outputs shared by the Big and Boss Blinds.
// ---------------------------------------------------------------------------

/**
 * A safety rulebook: Safety population, half-to-even, and incidence
 * percentages to `percentPrecision` decimal places (1 unless a SAP says
 * otherwise).
 */
const safetyRulebook = (
  id: string,
  title: string,
  rulePrefix: string,
  precisionBonus: number,
  percentPrecision = 1
): SapRulebook => ({
  id,
  title,
  populationSuit: "SAFETY",
  populationAliases: [],
  percentPrecision,
  meanPrecision: 1,
  roundingMode: "HALF_EVEN",
  rules: [
    {
      id: `${rulePrefix}-01`,
      category: "DENOMINATOR",
      severity: "FATAL",
      statement:
        "Header N and every incidence use the Safety population: every subject who took study drug. FAS and Per-Protocol drop subjects who had events, so they cannot stand in for it.",
      consequence:
        "A wrong denominator hides the very subjects a safety review exists to count. While it stands, the hand's final Mult is 0.",
      correctionMultBonus: 1,
      redlineMultPenalty: 0,
    },
    {
      id: `${rulePrefix}-02`,
      category: "PRECISION",
      severity: "MINOR",
      statement:
        percentPrecision === 0
          ? "Incidence percentages are reported as whole numbers, with no decimal places."
          : `Incidence percentages are reported to ${percentPrecision} decimal place${percentPrecision === 1 ? "" : "s"}.`,
      consequence: `Inconsistent precision implies accuracy the data does not have. Redline: −1 Mult; correcting it earns +${precisionBonus} Mult.`,
      correctionMultBonus: precisionBonus,
      redlineMultPenalty: 1,
    },
    {
      id: `${rulePrefix}-03`,
      category: "ROUNDING",
      severity: "MINOR",
      statement: "Ties round half-to-even (banker's rounding).",
      consequence:
        "A different convention silently shifts ties and breaks double programming. Redline: −1 Mult; correcting it earns +1 Mult.",
      correctionMultBonus: 1,
      redlineMultPenalty: 1,
    },
    {
      id: `${rulePrefix}-04`,
      category: "VALUE",
      severity: "MAJOR",
      statement:
        "Incidence counts subjects, not events: a subject with several events in a System Organ Class or preferred term is counted once. Every n must reproduce from the snapshot.",
      consequence:
        "Counting events inflates incidence and double-counts the same subject. Redline: −2 Mult; correcting it earns +2 Mult.",
      correctionMultBonus: 2,
      redlineMultPenalty: 2,
    },
  ],
});

const shellOf = (
  rulebookId: string,
  id: string,
  title: string,
  chips: number,
  tableNumber = `Table ${id.slice(2)}`
): TableShellSpec => ({
  id,
  tableNumber,
  title,
  cardType: "TABLE",
  targetPopulation: "SAFETY",
  chips,
  mult: 1,
  requiredRulebookId: rulebookId,
  allowedFootnoteSlots: 1,
});

const overviewRows: Row[] = [
  N_ROW,
  row("any", "Any TEAE", { kind: "AE_SUBJECT_COUNT_PCT" }),
  row("serious", "Serious AE", { kind: "AE_SUBJECT_COUNT_PCT", serious: true }),
  row("grade3", "Grade ≥ 3 AE", { kind: "AE_SUBJECT_COUNT_PCT", minGrade: 3 }),
  row("discont", "AE to discont.", {
    kind: "AE_SUBJECT_COUNT_PCT",
    ledToDiscontinuation: true,
  }),
];

const saeRows: Row[] = [
  N_ROW,
  row("any", "Any SAE", { kind: "AE_SUBJECT_COUNT_PCT", serious: true }),
  ...["Pneumonia", "Atrial fibrillation", "Syncope"].map((term) =>
    row(term.toLowerCase().replace(/ /g, "-"), term, {
      kind: "AE_SUBJECT_COUNT_PCT",
      serious: true,
      term,
    })
  ),
];

/** A System Organ Class table: N, the SOC row, then its preferred terms. */
const socRows = (soc: string, label: string, terms: string[]): Row[] => [
  N_ROW,
  row("soc", label, { kind: "AE_SUBJECT_COUNT_PCT", soc }),
  ...terms.map((term) =>
    row(term.toLowerCase().replace(/ /g, "-"), term, {
      kind: "AE_SUBJECT_COUNT_PCT",
      soc,
      term,
    })
  ),
];

const N = ["6", "6", "12"];
const NONE = ["0 (0.0)", "0 (0.0)", "0 (0.0)"];
const ACTIVE_ONE = ["0 (0.0)", "1 (16.7)", "1 (8.3)"];
const PLACEBO_ONE = ["1 (16.7)", "0 (0.0)", "1 (8.3)"];
const EACH_ONE = ["1 (16.7)", "1 (16.7)", "2 (16.7)"];

/** Clean cells, reproduced from the snapshot by the validator's rules. */
const CLEAN = {
  overview: [
    N,
    ["3 (50.0)", "5 (83.3)", "8 (66.7)"],
    ["1 (16.7)", "2 (33.3)", "3 (25.0)"],
    ["1 (16.7)", "2 (33.3)", "3 (25.0)"],
    ACTIVE_ONE,
  ],
  sae: [
    N,
    ["1 (16.7)", "2 (33.3)", "3 (25.0)"],
    PLACEBO_ONE,
    ACTIVE_ONE,
    ACTIVE_ONE,
  ],
  cardiac: [N, ACTIVE_ONE, ACTIVE_ONE, NONE],
  gi: [N, EACH_ONE, EACH_ONE, ACTIVE_ONE],
  general: [N, EACH_ONE, EACH_ONE, ACTIVE_ONE],
  infections: [N, PLACEBO_ONE, PLACEBO_ONE],
  nervous: [
    N,
    ["1 (16.7)", "2 (33.3)", "3 (25.0)"],
    EACH_ONE,
    ACTIVE_ONE,
    ACTIVE_ONE,
  ],
  skin: [N, ACTIVE_ONE, ACTIVE_ONE],
};

/**
 * Reprints clean 1-dp cells at another percent precision, from each
 * column's N (row 0 of every safety output).
 */
const atPrecision = (clean: string[][], precision: number): string[][] =>
  precision === 1
    ? clean
    : clean.map((cells, r) =>
        r === 0
          ? cells
          : cells.map((cell, c) => {
              const n = Number(/^(\d+) \(/.exec(cell)?.[1]);
              return `${n} (${roundRatio(n * 100, Number(clean[0][c]), precision, "HALF_EVEN")})`;
            })
      );

/** Copies clean cells and overwrites the given `row:col` cells. */
const withDefects = (
  clean: string[][],
  defects: Record<string, string>
): string[][] =>
  clean.map((cells, r) => cells.map((cell, c) => defects[`${r}:${c}`] ?? cell));

/** The shells, rows and card fields of each safety output. */
const SAFETY_OUTPUTS = {
  overview: {
    id: "T-14.3.1",
    title: "Overview of Treatment-Emergent Adverse Events (Safety)",
    chips: 35,
    rows: overviewRows,
    card: { title: "Overview of AEs", topic: "AE", csrStage: "SAFETY_AE" },
  },
  cardiac: {
    id: "T-14.3.2.1",
    title: "AEs by SOC and PT: Cardiac Disorders (Safety)",
    chips: 25,
    rows: socRows(CARDIAC, "Cardiac (SOC)", [
      "Atrial fibrillation",
      "Palpitations",
    ]),
    card: {
      title: "AEs by SOC: Cardiac",
      topic: "AE",
      csrStage: "SAFETY_AE",
      soc: CARDIAC,
    },
  },
  gi: {
    id: "T-14.3.2.2",
    title: "AEs by SOC and PT: Gastrointestinal Disorders (Safety)",
    chips: 25,
    rows: socRows(GI, "Gastrointestinal (SOC)", ["Nausea", "Vomiting"]),
    card: {
      title: "AEs by SOC: Gastrointestinal",
      topic: "AE",
      csrStage: "SAFETY_AE",
      soc: GI,
    },
  },
  general: {
    id: "T-14.3.2.3",
    title: "AEs by SOC and PT: General Disorders (Safety)",
    chips: 25,
    rows: socRows(GENERAL, "General (SOC)", [
      "Fatigue",
      "Injection site reaction",
    ]),
    card: {
      title: "AEs by SOC: General",
      topic: "AE",
      csrStage: "SAFETY_AE",
      soc: GENERAL,
    },
  },
  infections: {
    id: "T-14.3.2.4",
    title: "AEs by SOC and PT: Infections and Infestations (Safety)",
    chips: 25,
    rows: socRows(INFECTIONS, "Infections (SOC)", ["Pneumonia"]),
    card: {
      title: "AEs by SOC: Infections",
      topic: "AE",
      csrStage: "SAFETY_AE",
      soc: INFECTIONS,
    },
  },
  nervous: {
    id: "T-14.3.2.5",
    title: "AEs by SOC and PT: Nervous System Disorders (Safety)",
    chips: 25,
    rows: socRows(NERVOUS, "Nervous system (SOC)", [
      "Headache",
      "Syncope",
      "Dizziness",
    ]),
    card: {
      title: "AEs by SOC: Nervous System",
      topic: "AE",
      csrStage: "SAFETY_AE",
      soc: NERVOUS,
    },
  },
  skin: {
    id: "T-14.3.2.6",
    title: "AEs by SOC and PT: Skin and Subcutaneous Tissue (Safety)",
    chips: 25,
    rows: socRows(SKIN, "Skin (SOC)", ["Rash"]),
    card: {
      title: "AEs by SOC: Skin",
      topic: "AE",
      csrStage: "SAFETY_AE",
      soc: SKIN,
    },
  },
  sae: {
    id: "T-14.3.3",
    title: "Serious Adverse Events by Preferred Term (Safety)",
    chips: 30,
    rows: saeRows,
    card: {
      title: "Serious Adverse Events",
      topic: "SAE",
      csrStage: "SAFETY_AE",
    },
  },
} satisfies Record<
  string,
  {
    id: string;
    title: string;
    chips: number;
    rows: Row[];
    card: Pick<TlfCard, "title" | "topic" | "csrStage" | "soc">;
  }
>;
type SafetyOutput = keyof typeof SAFETY_OUTPUTS;

/** Only the Total column: a pooled output shows no treatment arm. */
const POOLED_COLUMNS = columns.filter((c) => c.arm === "TOTAL");

/**
 * Builds a safety Blind's shells, staged drafts and draft cards from a list
 * of drafts: which output, which version letter, and the defective cells.
 * `percentPrecision` reprints the clean cells for a rulebook that is not
 * 1 dp. `pooled` keeps only the Total column, on its own shells; a defect's
 * column is then 0. `blinded` makes the shells closed-session outputs.
 */
function safetyDrafts(
  rulebookId: string,
  drafts: {
    output: SafetyOutput;
    version: string;
    label: string;
    defects?: Record<string, string>;
  }[],
  options: {
    percentPrecision?: number;
    pooled?: boolean;
    blinded?: boolean;
  } = {}
) {
  const { percentPrecision = 1, pooled = false, blinded = false } = options;
  const shells = new Map<SafetyOutput, TableShellSpec>();
  const drawPile: StagedTable[] = [];
  const cards = new Map<string, TlfCard>();
  for (const { output, version, label, defects } of drafts) {
    const spec = SAFETY_OUTPUTS[output];
    const shellId = pooled ? `${spec.id}-POOLED` : spec.id;
    const shell = shells.get(output) ?? {
      ...shellOf(
        rulebookId,
        shellId,
        pooled ? `${spec.title}, pooled` : spec.title,
        spec.chips,
        `Table ${spec.id.slice(2)}${pooled ? " (Pooled)" : ""}`
      ),
      ...(blinded ? { isBlinded: true } : {}),
    };
    shells.set(output, shell);
    const clean = atPrecision(CLEAN[output], percentPrecision);
    const staged = draftOf(
      shellId,
      spec.rows,
      pooled ? POOLED_COLUMNS : columns
    )(
      `${shellId}-${version}`,
      label,
      withDefects(
        pooled ? clean.map((cells) => cells.slice(-1)) : clean,
        defects ?? {}
      )
    );
    drawPile.push(staged);
    cards.set(
      `${output}-${version}`,
      draftCard(staged, shell, {
        ...spec.card,
        title: `${spec.card.title}${pooled ? ", pooled" : ""} (Draft ${version})`,
      })
    );
  }
  return { shells: [...shells.values()], drawPile, cards };
}

const pick = (cards: Map<string, TlfCard>, key: string) =>
  cards.get(key) as TlfCard;

// ---------------------------------------------------------------------------
// Big Blind: Sponsor Safety Review.
// ---------------------------------------------------------------------------

const SPONSOR_RULEBOOK = safetyRulebook(
  "SAP-AE-001",
  "SAP §10.2 Adverse Events",
  "SAP-AE",
  3
);

const SPONSOR = safetyDrafts(SPONSOR_RULEBOOK.id, [
  // Active column divided by the FAS N: S-008's atrial fibrillation vanishes.
  {
    output: "overview",
    version: "A",
    label: "Draft A (v0.1)",
    defects: {
      "0:1": "5",
      "1:1": "5 (100.0)",
      "2:1": "2 (40.0)",
      "3:1": "2 (40.0)",
      "4:1": "1 (20.0)",
    },
  },
  // A 2-dp slip, and a Total that counts 13 events instead of 8 subjects.
  {
    output: "overview",
    version: "B",
    label: "Draft B (v0.2)",
    defects: { "1:1": "5 (83.33)", "1:2": "13 (108.3)" },
  },
  // One SAE too many in Active, and a 2-dp slip in Total.
  {
    output: "sae",
    version: "A",
    label: "Draft A (v0.1)",
    defects: { "1:1": "3 (50.0)", "3:2": "1 (8.33)" },
  },
  { output: "sae", version: "B", label: "Draft B (v0.2)" },
  // S-010's syncope and dizziness counted as two subjects.
  {
    output: "nervous",
    version: "A",
    label: "Draft A (v0.1)",
    defects: { "1:1": "3 (50.0)", "1:2": "4 (33.3)" },
  },
  { output: "cardiac", version: "A", label: "Draft A (v0.1)" },
  // S-007's nausea and vomiting counted as two subjects.
  {
    output: "gi",
    version: "A",
    label: "Draft A (v0.1)",
    defects: { "1:1": "2 (33.3)" },
  },
  // Reruns at the bottom of the deck. After S-004 leaves the Safety set,
  // they are what sending stale drafts back to programming brings in.
  { output: "sae", version: "C", label: "Draft C (v0.3)" },
  {
    output: "overview",
    version: "C",
    label: "Draft C (v0.3)",
    defects: { "2:2": "3 (25.00)" },
  },
  { output: "skin", version: "B", label: "Draft B (v0.2)" },
]);

/**
 * Big Blind. The sponsor's safety physician reviews the AE overview, the SAE
 * table and SOC tables under SAP-AE-001. The traps are the FAS denominator,
 * which silently drops S-008, and counting events instead of subjects.
 *
 * After the first hand, S-004 is found never to have been dosed and leaves
 * the Safety population (SNAP-P1-v2). The Safety drafts still in hand go
 * stale; ITT outputs stay valid; the Dose Escalation Committee inherits v2.
 */
export const SPONSOR_SAFETY_SCENARIO: Scenario = {
  id: "sponsor-safety-big-blind",
  title: "Sponsor Safety Review",
  summary:
    "The sponsor's safety physician reviews the adverse event tables (Safety population) before the committee meets.",
  intro:
    "The sponsor's safety physician wants the adverse event tables. Incidence counts subjects, not events, and every percentage divides by the Safety population. A table built on FAS quietly loses S-008's atrial fibrillation.",
  blind: {
    tier: "BIG_BLIND",
    name: "Big Blind: Sponsor Safety Review",
    quota: 7500,
  },
  handType: "HIGH_TABLE",
  startingCpu: 6,
  table: { startingCpu: 10, handSize: 8, maxSelection: 5 },
  deck: [
    pick(SPONSOR.cards, "overview-A"),
    AE_LISTING,
    pick(SPONSOR.cards, "sae-A"),
    SAE_LISTING,
    pick(SPONSOR.cards, "nervous-A"),
    DISPOSITION,
    DISCONTINUED_LISTING,
    pick(SPONSOR.cards, "overview-B"),
    pick(SPONSOR.cards, "cardiac-A"),
    pick(SPONSOR.cards, "sae-B"),
    DM_LISTING,
    pick(SPONSOR.cards, "gi-A"),
    pick(SPONSOR.cards, "sae-C"),
    pick(SPONSOR.cards, "overview-C"),
    pick(SPONSOR.cards, "skin-B"),
  ],
  rulebook: SPONSOR_RULEBOOK,
  populationSnapshot: POPULATION_SNAPSHOT,
  consumables: [AE_NOT_EXCLUSIVE],
  guidance: [GUIDANCE_CARDS.MEDDRA_FIVE_OF_A_KIND],
  shells: SPONSOR.shells,
  drawPile: SPONSOR.drawPile,
  events: [
    {
      afterHands: 1,
      transition: {
        id: "EV-P1-S004-UNDOSED",
        subjectId: "S-004",
        reason: "DROPOUT",
        change: "LEAVE",
        populations: ["SAFETY"],
        effectiveAt: "2026-02-02T09:00:00Z",
        description:
          "Site query resolved: S-004 withdrew consent before the first dose and was never dosed. S-004 stays randomized (ITT) but leaves the Safety population.",
      },
    },
  ],
};

/** The signed-off demographics table, as a face-only card. */
const DEMOGRAPHICS_FINAL = card({
  id: "C-T14.1.1",
  cardType: "TABLE",
  number: "Table 14.1.1",
  title: "Demographics (Final)",
  population: "ITT",
  chips: 30,
  mult: 1,
  topic: "DM",
  csrStage: "BASELINE",
  face: {
    kind: "TABLE",
    columns: ["Placebo", "Active", "Total"],
    rows: demographicsRows.map((r, i) => ({
      label: r.label,
      values: DEMOGRAPHICS_CLEAN[i],
    })),
  },
});

// ---------------------------------------------------------------------------
// Boss Blind: Dose Escalation Committee.
// ---------------------------------------------------------------------------

const COMMITTEE_RULEBOOK = safetyRulebook(
  "SAP-SAF-001",
  "DEC Charter §4 Safety Data for Dose Escalation",
  "SAP-SAF",
  4
);

const COMMITTEE = safetyDrafts(COMMITTEE_RULEBOOK.id, [
  {
    output: "nervous",
    version: "B",
    label: "Draft B (v0.2)",
    defects: { "2:2": "2 (16.67)" },
  },
  { output: "cardiac", version: "B", label: "Draft B (v0.2)" },
  // Total column divided by the Per-Protocol N.
  {
    output: "gi",
    version: "B",
    label: "Draft B (v0.2)",
    defects: {
      "0:2": "9",
      "1:2": "2 (22.2)",
      "2:2": "2 (22.2)",
      "3:2": "1 (11.1)",
    },
  },
  // S-011's two events counted as two subjects.
  {
    output: "general",
    version: "A",
    label: "Draft A (v0.1)",
    defects: { "1:1": "2 (33.3)", "1:2": "3 (25.0)" },
  },
  { output: "infections", version: "A", label: "Draft A (v0.1)" },
  {
    output: "skin",
    version: "A",
    label: "Draft A (v0.1)",
    defects: { "1:2": "1 (8.33)" },
  },
  { output: "overview", version: "C", label: "Draft C (v0.3)" },
]);

/**
 * Boss Blind. The Dose Escalation Committee decides whether the next cohort
 * doses. It reads the Safety population only: every output built on another
 * population scores 0 Chips (DEC-SAFETY-ONLY).
 */
export const DOSE_ESCALATION_SCENARIO: Scenario = {
  id: "dose-escalation-boss-blind",
  title: "Dose Escalation Committee",
  summary:
    "The Dose Escalation Committee reviews the safety tables to decide whether the next cohort doses.",
  intro:
    "The committee decides whether the next cohort doses, and it reads only the Safety population. Anything built on ITT scores no Chips here, however clean. Five SOC tables together make a MedDRA Five of a Kind.",
  blind: {
    tier: "BOSS_BLIND",
    name: "Boss Blind: Dose Escalation Committee",
    quota: 8500,
  },
  boss: {
    id: "DEC-SAFETY-ONLY",
    name: "Safety Set Only",
    description:
      "The committee reviews the Safety population only. Outputs built on any other population score 0 Chips.",
    debuffType: "DISABLE_POPULATION",
    disabledPopulations: ["SCREENED", "ITT", "PER_PROTOCOL", "FAS"],
  },
  handType: "HIGH_TABLE",
  startingCpu: 6,
  table: { startingCpu: 10, handSize: 8, maxSelection: 5 },
  deck: [
    pick(COMMITTEE.cards, "nervous-B"),
    DISPOSITION,
    pick(COMMITTEE.cards, "cardiac-B"),
    AE_LISTING,
    pick(COMMITTEE.cards, "gi-B"),
    DEMOGRAPHICS_FINAL,
    pick(COMMITTEE.cards, "general-A"),
    SAE_LISTING,
    DEMOGRAPHICS_BLANK,
    pick(COMMITTEE.cards, "infections-A"),
    pick(COMMITTEE.cards, "overview-C"),
    pick(COMMITTEE.cards, "skin-A"),
    DISCONTINUED_LISTING,
  ],
  rulebook: COMMITTEE_RULEBOOK,
  populationSnapshot: POPULATION_SNAPSHOT,
  shells: [...COMMITTEE.shells, demographicsShell(COMMITTEE_RULEBOOK.id)],
  drawPile: COMMITTEE.drawPile,
};

// ---------------------------------------------------------------------------
// Crisis cards: things that happen to a study. One is drawn, by the run's
// seeded event draw, as each Blind after the first starts.
// ---------------------------------------------------------------------------

const DATA_CUTOFF: FootnoteSeal = {
  id: "FN-DATA-CUTOFF",
  name: "Data cutoff",
  footnote:
    "Data as of the database freeze on 2026-02-01; records entered after the freeze are not included.",
  effect: { kind: "PLUS_CHIPS", value: 10 },
  eligible: { cardTypes: ["TABLE"] },
  sellValue: 1,
};

/** Act I's crisis deck. Every card has one choice that costs nothing. */
export const ACT_I_CRISES: CrisisCard[] = [
  {
    id: "CR-SITE-AUDIT",
    name: "Site Audit",
    description:
      "The sponsor's QA team is auditing the Phase I unit this week, and every rerun needs a signed request.",
    choices: [
      {
        id: "host",
        label: "Host the auditors",
        consequence: "Discard costs +1 CPU for this Blind.",
        effect: {
          modifier: {
            id: "CR-AUDIT-DISCARD",
            name: "Site Audit",
            description: "Every discard needs a signed request: +1 CPU.",
            debuffType: "DISCARD_PENALTY",
            discardCpuPenalty: 1,
          },
        },
      },
      {
        id: "remote",
        label: "Pay for a remote audit",
        consequence: "Costs $2k of study budget.",
        effect: { budget: -2 },
      },
      {
        id: "footnote",
        label: "Document it in a footnote",
        consequence: "Spends the first footnote seal in your tray.",
        effect: { spendSeal: true },
      },
    ],
  },
  {
    id: "CR-AMENDMENT-2",
    name: "Protocol Amendment 2",
    description:
      "Amendment 2 tightens dosing compliance for the Per-Protocol set. S-011 missed the Day 3 dose.",
    choices: [
      {
        id: "adopt",
        label: "Adopt it now",
        consequence:
          "S-011 leaves the Per-Protocol set, so Per-Protocol outputs in hand go stale.",
        effect: {
          transition: {
            id: "CR-P1-S011-AMENDMENT",
            subjectId: "S-011",
            reason: "PROTOCOL_AMENDMENT",
            change: "LEAVE",
            populations: ["PER_PROTOCOL"],
            effectiveAt: "2026-01-29T09:00:00Z",
            description:
              "Protocol Amendment 2: S-011 missed the Day 3 dose and leaves the Per-Protocol set.",
          },
        },
      },
      {
        id: "defer",
        label: "Defer it to the next study",
        consequence: "The medical monitor wants a memo: −1 CPU.",
        effect: { cpu: -1 },
      },
    ],
  },
  {
    id: "CR-DB-MIGRATION",
    name: "Database Migration",
    description:
      "The EDC vendor moves the study to a new database version mid-milestone.",
    choices: [
      {
        id: "migrate",
        label: "Migrate now",
        consequence: "Rerun the extracts on the new build: −2 CPU.",
        effect: { cpu: -2 },
      },
      {
        id: "freeze",
        label: "Freeze and footnote the cutoff",
        consequence:
          "Gain a Data cutoff seal, but this Blind allows only 3 hands.",
        effect: {
          grantSeal: DATA_CUTOFF,
          modifier: {
            id: "CR-FREEZE-HANDS",
            name: "Database Freeze",
            description: "The frozen data can support only 3 submissions.",
            debuffType: "HAND_LIMIT",
            maxHandsAllowed: 3,
          },
        },
      },
    ],
  },
  {
    id: "CR-EMERGENCY-REVIEW",
    name: "Emergency Review",
    description:
      "The sponsor's safety physician wants the package early, ahead of a regulator call.",
    choices: [
      {
        id: "accept",
        label: "Accept the early deadline",
        consequence:
          "Earn $2k of study budget, but this Blind allows only 2 hands.",
        effect: {
          budget: 2,
          modifier: {
            id: "CR-EMERGENCY-HANDS",
            name: "Emergency Review",
            description: "The package is due early: 2 submissions only.",
            debuffType: "HAND_LIMIT",
            maxHandsAllowed: 2,
          },
        },
      },
      {
        id: "decline",
        label: "Keep the agreed date",
        consequence: "Negotiating the date costs −1 CPU.",
        effect: { cpu: -1 },
      },
    ],
  },
];

/**
 * Act I: the Phase I safety study. The Small and Big Blinds are fixed; the
 * Boss comes from the act's pool, which holds only the Dose Escalation
 * Committee until Act II adds a second, so it is fixed and not drawn.
 */
// ---------------------------------------------------------------------------
// Procurement Shop (#948). Relics are people and tools; documents are
// Guidance cards. A consumable's price is twice its sell value plus one, so
// selling it back returns half its price, rounded down.
// ---------------------------------------------------------------------------

const shopRelic = (
  id: string,
  name: string,
  description: string,
  price: number,
  bonus: { chips?: number; plusMult?: number; xMult?: number }
): ShopEntry => ({
  kind: "RELIC",
  price,
  relic: {
    id,
    name,
    description,
    modifier: {
      sourceId: id,
      label: name,
      chips: bonus.chips ?? 0,
      plusMult: bonus.plusMult ?? 0,
      xMult: bonus.xMult ?? 1,
    },
  },
});

const shopSeal = (seal: FootnoteSeal): ShopEntry => ({
  kind: "SEAL",
  price: seal.sellValue * 2 + 1,
  seal,
});

/** Act I's Procurement Shop: its stock, its booster packs and its sites. */
export const ACT_I_SHOP: ShopCatalog = {
  entries: [
    shopRelic(
      "REL-SENIOR-PROGRAMMER",
      "Senior Programmer",
      "Twenty years of PROC REPORT muscle memory: +30 Chips on every hand.",
      4,
      { chips: 30 }
    ),
    shopRelic(
      "REL-SECOND-REVIEWER",
      "Second Reviewer",
      "Reads every footnote twice, out loud: +3 Mult on every hand.",
      6,
      { plusMult: 3 }
    ),
    shopRelic(
      "REL-MACRO-LIBRARY",
      "Validated Macro Library",
      "Qualified once, reused forever: +20 Chips and +1 Mult on every hand.",
      6,
      { chips: 20, plusMult: 1 }
    ),
    shopRelic(
      "REL-CONFORMANCE-CHECKER",
      "Conformance Checker",
      "Flags the define.xml before the reviewer does: +40 Chips on every hand.",
      7,
      { chips: 40 }
    ),
    shopRelic(
      "REL-BIOSTAT-LEAD",
      "Biostatistics Lead",
      "Signs the SAP and means it: ×1.25 Mult on every hand.",
      8,
      { xMult: 1.25 }
    ),
    ...Object.values(GUIDANCE_CARDS).map((guidance): ShopEntry => ({
      kind: "GUIDANCE",
      price: guidance.sellValue * 2 + 1,
      guidance,
    })),
    shopSeal(ADJUDICATED),
    shopSeal(AE_NOT_EXCLUSIVE),
    shopSeal(DATA_CUTOFF),
    shopSeal(SPONSOR_ROUNDING),
  ],
  packs: [
    {
      id: "PACK-SITE-ACTIVATION",
      kind: "SITE_ACTIVATION",
      name: "Site Activation Pack",
      description:
        "New sites, new subjects, more Chips. Their enrollment reopens the snapshot.",
      price: 4,
      size: 3,
      choose: 1,
    },
    {
      id: "PACK-GUIDANCE",
      kind: "GUIDANCE",
      name: "Guidance Pack",
      description: "Freshly harmonised guidance, still warm from the printer.",
      price: 3,
      size: 3,
      choose: 1,
    },
    {
      id: "PACK-RELIC",
      kind: "RELIC",
      name: "Relic Pack",
      description: "Headhunted talent and validated tooling.",
      price: 6,
      size: 2,
      choose: 1,
    },
  ],
  sites: [
    {
      id: "SITE-104",
      name: "Site 104, Rotterdam",
      description:
        "A fast-enrolling site with an eager coordinator: +20 Chips on every hand.",
      modifier: {
        sourceId: "SITE-104",
        label: "Site 104",
        chips: 20,
        plusMult: 0,
        xMult: 1,
      },
      subjects: [
        subject("S-013", "PLACEBO", 44, "M", [...ALL]),
        subject("S-014", "ACTIVE", 51, "F", [...ALL], [ae(GI, "Nausea", 1)]),
      ],
    },
    {
      id: "SITE-211",
      name: "Site 211, Lyon",
      description: "Small, careful and slow to query: +15 Chips on every hand.",
      modifier: {
        sourceId: "SITE-211",
        label: "Site 211",
        chips: 15,
        plusMult: 0,
        xMult: 1,
      },
      subjects: [subject("S-015", "ACTIVE", 38, "M", [...NO_PP])],
    },
    {
      id: "SITE-305",
      name: "Site 305, Austin",
      description:
        "A research-naive site that enrolls anyone breathing: +30 Chips on every hand.",
      modifier: {
        sourceId: "SITE-305",
        label: "Site 305",
        chips: 30,
        plusMult: 0,
        xMult: 1,
      },
      subjects: [
        subject("S-016", "PLACEBO", 63, "F", [...ALL]),
        subject(
          "S-017",
          "ACTIVE",
          57,
          "M",
          [...ITT_ONLY],
          [ae(NERVOUS, "Headache", 2)]
        ),
      ],
    },
    {
      id: "SITE-412",
      name: "Site 412, Osaka",
      description:
        "Immaculate source data and a translator on retainer: +1 Mult on every hand.",
      modifier: {
        sourceId: "SITE-412",
        label: "Site 412",
        chips: 0,
        plusMult: 1,
        xMult: 1,
      },
      subjects: [subject("S-018", "PLACEBO", 29, "F", [...ALL])],
    },
  ],
};

export const ACT_I: Act = {
  id: "act-1-phase-1",
  title: "Act I: Phase I Safety",
  blinds: [DEMOGRAPHICS_SCENARIO, SPONSOR_SAFETY_SCENARIO],
  bossPool: [DOSE_ESCALATION_SCENARIO],
  crisisDeck: ACT_I_CRISES,
  shop: ACT_I_SHOP,
};

// ---------------------------------------------------------------------------
// Boss Blind: DMC milestone defense (T&E-09).
// ---------------------------------------------------------------------------

const DMC_RULEBOOK = safetyRulebook(
  "DMC-SAF-001",
  "DMC Charter §7 Closed-Session Safety Tables",
  "DMC-SAF",
  3
);

// The closed package: by-arm safety tables the open session must never see.
const DMC = safetyDrafts(DMC_RULEBOOK.id, [
  { output: "overview", version: "D", label: "DMC closed (v1.0)" },
  // One SAE too many in Active: a closed-session redline to reconcile.
  {
    output: "sae",
    version: "D",
    label: "DMC closed (v1.0)",
    defects: { "4:1": "2 (33.3)" },
  },
  { output: "nervous", version: "D", label: "DMC closed (v1.0)" },
]);

const DMC_SHELLS = DMC.shells.map((shell) => ({ ...shell, isBlinded: true }));

/**
 * Time-to-event records: `events` maps a subject to its event week, and
 * `censored` to an early censoring week; everyone else is censored at
 * `censoredAt`.
 */
const kmRecords = (
  events: Record<string, number>,
  censoredAt: number,
  censored: Record<string, number> = {}
) =>
  POPULATION_SNAPSHOT.subjects.map((s) => ({
    subjectId: s.id,
    time: events[s.id] ?? censored[s.id] ?? censoredAt,
    event: s.id in events,
  }));

/**
 * Time to first serious AE, drawn from an SAE table (`parentId`): S-005
 * (week 6, Placebo), S-008 (week 2) and S-010 (week 5, both Active). The
 * draft's Placebo at-risk row keeps S-005 at week 8 after the event.
 */
const kmSae = (parentId: string): TlfCard => ({
  id: "C-F14.3.3",
  cardType: "FIGURE",
  number: "Figure 14.3.3",
  title: "Time to First Serious AE (KM)",
  population: "SAFETY",
  chips: 30,
  mult: 1,
  topic: "SAE",
  csrStage: "SAFETY_AE",
  km: {
    endpoint: "Time to first serious adverse event",
    timeUnit: "weeks",
    populationSnapshotId: snapshotId,
    parent: {
      cardId: parentId,
      atRiskRow: "Subjects, N",
      eventsRow: "Any SAE",
    },
    timeOrigin: 0,
    milestones: [0, 4, 8, 12],
    records: kmRecords({ "S-005": 6, "S-008": 2, "S-010": 5 }, 12),
    displayed: [
      {
        arm: "PLACEBO",
        curve: [
          [0, 1],
          [6, 0.833],
          [12, 0.833],
        ],
        censorTicks: [12],
        atRisk: [6, 6, 6, 5],
      },
      {
        arm: "ACTIVE",
        curve: [
          [0, 1],
          [2, 0.833],
          [5, 0.667],
          [12, 0.667],
        ],
        censorTicks: [12],
        atRisk: [6, 5, 4, 4],
      },
    ],
  },
});

/**
 * Time to an AE leading to discontinuation, drawn from an AE overview
 * (`parentId`): S-008 (week 2, Active). The draft marks the event with a
 * censoring tick as well as a step.
 */
const kmDiscontinuation = (parentId: string): TlfCard => ({
  id: "C-F14.3.1",
  cardType: "FIGURE",
  number: "Figure 14.3.1",
  title: "Time to AE Discontinuation (KM)",
  population: "SAFETY",
  chips: 30,
  mult: 1,
  topic: "AE",
  csrStage: "SAFETY_AE",
  km: {
    endpoint: "Time to an adverse event leading to discontinuation",
    timeUnit: "weeks",
    populationSnapshotId: snapshotId,
    parent: {
      cardId: parentId,
      atRiskRow: "Subjects, N",
      eventsRow: "AE to discont.",
    },
    timeOrigin: 0,
    milestones: [0, 4, 8, 12],
    records: kmRecords({ "S-008": 2 }, 12),
    displayed: [
      {
        arm: "PLACEBO",
        curve: [
          [0, 1],
          [12, 1],
        ],
        censorTicks: [12],
        atRisk: [6, 6, 6, 6],
      },
      {
        arm: "ACTIVE",
        curve: [
          [0, 1],
          [2, 0.833],
          [12, 0.833],
        ],
        censorTicks: [2, 12],
        atRisk: [6, 5, 5, 5],
      },
    ],
  },
});

/** The SOP relics a defended DMC milestone offers. The player keeps one. */
export const DMC_RELICS: Relic[] = [
  {
    id: "SOP-DMC-07",
    name: "SOP-DMC-07 Firewall Charter",
    description: "A charter that keeps the seats apart: +4 Mult on every hand.",
    modifier: {
      sourceId: "SOP-DMC-07",
      label: "Firewall Charter",
      chips: 0,
      plusMult: 4,
      xMult: 1,
    },
  },
  {
    id: "SOP-QC-12",
    name: "SOP-QC-12 Independent Double Programming",
    description:
      "Every output is programmed twice, independently: +50 Chips on every hand.",
    modifier: {
      sourceId: "SOP-QC-12",
      label: "Double Programming",
      chips: 50,
      plusMult: 0,
      xMult: 1,
    },
  },
  {
    id: "SOP-STAT-03",
    name: "SOP-STAT-03 Pre-specified Analysis",
    description:
      "Nothing is decided after unblinding: ×1.5 Mult on every hand.",
    modifier: {
      sourceId: "SOP-STAT-03",
      label: "Pre-specified Analysis",
      chips: 0,
      plusMult: 0,
      xMult: 1.5,
    },
  },
];

/**
 * Boss Blind: the Data Monitoring Committee's milestone review, a staged
 * encounter under the DMC firewall. Stage 1 is the blinded study team's open
 * report: pooled tables and listings, played while treatment-arm values stay
 * face down. Stage 2 is the independent statistician's closed report: once
 * Stage 1 is defended the closed session convenes, the by-arm tables and
 * their Kaplan–Meier figures turn face up, and only an Efficacy Full House
 * defends it. Its quota is set so that only a closed report whose figures
 * reconcile clears it. Peeking early zeroes a hand. It is one of the two
 * Bosses Act II's pool draws from. It reads Act I's fictional study data.
 */
export const DMC_MILESTONE_SCENARIO: Scenario & { encounter: DmcDefense } = {
  id: "dmc-milestone-boss-blind",
  title: "DMC Milestone Review",
  summary:
    "The Data Monitoring Committee reviews the study at its milestone: an open-session report, then a closed, unblinded one.",
  intro:
    "The DMC meets in two sessions. First the open report, pooled, from the study team's seat. Then, behind the firewall, the closed report by arm. Convene the closed session only once the open report is defended; a peek before then zeroes a hand.",
  blind: {
    tier: "BOSS_BLIND",
    name: "Boss Blind: DMC Milestone Review",
    quota: 25400,
  },
  boss: {
    id: "DMC-FIREWALL-BOSS",
    name: "Blinding Firewall",
    description:
      "Treatment-arm values are face down in the open session, and no output can be inspected until the closed session convenes.",
    debuffType: "BLIND_FIREWALL",
  },
  handType: "HIGH_TABLE",
  startingCpu: 6,
  table: { startingCpu: 16, handSize: 8, maxSelection: 5 },
  deck: [
    DEMOGRAPHICS_FINAL,
    DM_LISTING,
    pick(DMC.cards, "overview-D"),
    DISPOSITION,
    pick(DMC.cards, "sae-D"),
    kmSae("C-T14.3.3-D"),
    AE_LISTING,
    pick(DMC.cards, "nervous-D"),
    kmDiscontinuation("C-T14.3.1-D"),
    DISCONTINUED_LISTING,
    SAE_LISTING,
  ],
  rulebook: DMC_RULEBOOK,
  populationSnapshot: POPULATION_SNAPSHOT,
  shells: DMC_SHELLS,
  drawPile: DMC.drawPile,
  dmc: { charter: "DMC Charter §7 (closed-session procedures)" },
  encounter: {
    kind: "DMC_DEFENSE",
    stages: [
      {
        name: "Stage 1: Open report",
        session: "OPEN",
        quota: 400,
        hands: ["HIGH_TABLE", "TLF_PAIR", "POPULATION_FLUSH"],
      },
      {
        name: "Stage 2: Closed report",
        session: "CLOSED",
        quota: 25000,
        hands: ["EFFICACY_FULL_HOUSE"],
      },
    ],
    rewards: DMC_RELICS,
  },
};

// ---------------------------------------------------------------------------
// Boss Blind: End-of-Phase-2 FDA Information Request (T&E-10).
// ---------------------------------------------------------------------------

const FDA_IR_RULEBOOK = safetyRulebook(
  "FDA-IR-001",
  "End-of-Phase-2 Information Request: Safety Responses",
  "FDA-IR",
  3
);

// The response package: reruns of the safety tables the FDA asked about.
const FDA_IR = safetyDrafts(FDA_IR_RULEBOOK.id, [
  // A 2-dp slip in the Active column.
  {
    output: "overview",
    version: "E",
    label: "IR response (v1.1)",
    defects: { "1:1": "5 (83.33)" },
  },
  { output: "sae", version: "E", label: "IR response (v1.1)" },
  // S-010's syncope and dizziness counted as two subjects.
  {
    output: "nervous",
    version: "E",
    label: "IR response (v1.1)",
    defects: { "1:1": "3 (50.0)", "1:2": "4 (33.3)" },
  },
  { output: "cardiac", version: "E", label: "IR response (v1.1)" },
  { output: "gi", version: "E", label: "IR response (v1.1)" },
]);

const FDA_IR_KM_DISCONTINUATION = kmDiscontinuation("C-T14.3.1-E");
const FDA_IR_SAE = pick(FDA_IR.cards, "sae-E");

/**
 * Boss Blind: the FDA's End-of-Phase-2 Information Request, the questions
 * that gate the move to Phase III and the only place the game has a clock.
 * The response is due in 48 hours and must go in at most 2 hands; every move
 * takes hours, and the clock running out first is a Clinical Hold, which
 * ends the run. Each targeted question names the output that answers it. It
 * is one of the two Bosses Act II's pool draws from. It reads Act I's
 * fictional study data.
 */
export const FDA_IR_SCENARIO: Scenario & { encounter: FdaIr } = {
  id: "fda-information-request-boss-blind",
  title: "FDA Information Request",
  summary:
    "The FDA's End-of-Phase-2 questions: answer each with the output it asks for, in two hands, before the 48-hour deadline.",
  intro:
    "The FDA has questions before Phase III. The response is due in 48 hours and goes in at most two hands. Every move takes time: a hand 12 hours, a discard 4, an Inspect 2, a trace 1. Run out of time and the program goes on Clinical Hold.",
  blind: {
    tier: "BOSS_BLIND",
    name: "Boss Blind: FDA Information Request",
    quota: 10000,
  },
  boss: {
    id: "FDA-IR-HAND-LIMIT",
    name: "Two-Hand Response",
    description:
      "Answer in at most 2 hands within 48 hours. A hand takes 12 hours, a discard 4, an Inspect 2 and a trace 1; the clock running out is a Clinical Hold.",
    debuffType: "HAND_LIMIT",
    maxHandsAllowed: 2,
  },
  handType: "HIGH_TABLE",
  startingCpu: 6,
  table: { startingCpu: 10, handSize: 8, maxSelection: 5 },
  deck: [
    pick(FDA_IR.cards, "overview-E"),
    SAE_LISTING,
    FDA_IR_KM_DISCONTINUATION,
    pick(FDA_IR.cards, "nervous-E"),
    DISCONTINUED_LISTING,
    FDA_IR_SAE,
    AE_LISTING,
    pick(FDA_IR.cards, "cardiac-E"),
    kmSae("C-T14.3.3-E"),
    DISPOSITION,
    pick(FDA_IR.cards, "gi-E"),
    DM_LISTING,
  ],
  rulebook: FDA_IR_RULEBOOK,
  populationSnapshot: POPULATION_SNAPSHOT,
  shells: FDA_IR.shells,
  drawPile: FDA_IR.drawPile,
  encounter: {
    kind: "FDA_IR",
    clockHours: 48,
    hours: { PLAY_HAND: 12, DISCARD: 4, INSPECT: 2, TRACE: 1 },
    hands: ["TLF_PAIR", "POPULATION_FLUSH", "EFFICACY_FULL_HOUSE"],
    questions: [
      {
        id: "IR-Q1",
        question: "Serious adverse events by preferred term and arm",
        cardId: FDA_IR_SAE.id,
        quota: 3000,
      },
      {
        id: "IR-Q2",
        question:
          "Time to an adverse event leading to discontinuation, by arm (Kaplan-Meier)",
        cardId: FDA_IR_KM_DISCONTINUATION.id,
        quota: 7000,
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Act II: Phase II Proof of Concept (#1084).
// ---------------------------------------------------------------------------

/**
 * Act II's SAP. The Phase II SAP reports incidence percentages as whole
 * numbers, so an output carried over from Phase I, printed to 1 dp, is a
 * precision redline until it is recompiled against this version.
 */
const PHASE_II_RULEBOOK = safetyRulebook(
  "SAP-P2-001",
  "Phase II SAP §9 Safety Outputs",
  "SAP-P2",
  3,
  0
);

const P2 = { percentPrecision: 0 };

const INTERNAL_QC = safetyDrafts(
  PHASE_II_RULEBOOK.id,
  [
    // Carried over from Phase I: every percentage still printed to 1 dp.
    {
      output: "overview",
      version: "A",
      label: "Phase I carry-over (v0.9)",
      defects: {
        "1:0": "3 (50.0)",
        "1:1": "5 (83.3)",
        "1:2": "8 (66.7)",
        "2:1": "2 (33.3)",
        "4:1": "1 (16.7)",
      },
    },
    { output: "sae", version: "A", label: "Draft A (v0.1)" },
    // S-010's syncope and dizziness counted as two subjects.
    {
      output: "nervous",
      version: "A",
      label: "Draft A (v0.1)",
      defects: { "1:1": "3 (50)", "1:2": "4 (33)" },
    },
    { output: "overview", version: "B", label: "Draft B (v0.2)" },
    { output: "cardiac", version: "A", label: "Draft A (v0.1)" },
    { output: "gi", version: "A", label: "Draft A (v0.1)" },
    // Reruns at the bottom of the deck.
    { output: "sae", version: "B", label: "Draft B (v0.2)" },
    // Total column divided by the Per-Protocol N.
    {
      output: "general",
      version: "A",
      label: "Draft A (v0.1)",
      defects: {
        "0:2": "9",
        "1:2": "2 (22)",
        "2:2": "2 (22)",
        "3:2": "1 (11)",
      },
    },
  ],
  P2
);

/**
 * Small Blind. The study team's own QC of the first Phase II outputs, under
 * the new SAP. The Kaplan-Meier figures now arrive in ordinary play, each
 * drawn from a Table in the deck, so reconciling a figure against its
 * parent pays here. Draft A of the AE overview is a Phase I carry-over,
 * still printed to 1 dp.
 */
export const PHASE_II_QC_SCENARIO: Scenario = {
  id: "phase-two-internal-qc-small-blind",
  title: "Phase II Internal QC",
  summary:
    "The study team QCs the first Phase II safety outputs and their Kaplan-Meier figures under the new SAP.",
  intro:
    "Phase II has a new SAP: incidence percentages are whole numbers now. Anything carried over from Phase I still prints 1 dp. The Kaplan-Meier figures arrive with their parent Tables; a figure that disagrees with its Table loses Mult.",
  blind: {
    tier: "SMALL_BLIND",
    name: "Small Blind: Phase II Internal QC",
    quota: 16000,
  },
  handType: "HIGH_TABLE",
  startingCpu: 6,
  table: { startingCpu: 10, handSize: 8, maxSelection: 5 },
  deck: [
    pick(INTERNAL_QC.cards, "overview-A"),
    AE_LISTING,
    pick(INTERNAL_QC.cards, "sae-A"),
    kmSae("C-T14.3.3-A"),
    SAE_LISTING,
    pick(INTERNAL_QC.cards, "nervous-A"),
    DISPOSITION,
    pick(INTERNAL_QC.cards, "overview-B"),
    kmDiscontinuation("C-T14.3.1-B"),
    DISCONTINUED_LISTING,
    pick(INTERNAL_QC.cards, "cardiac-A"),
    DM_LISTING,
    pick(INTERNAL_QC.cards, "gi-A"),
    pick(INTERNAL_QC.cards, "sae-B"),
    pick(INTERNAL_QC.cards, "general-A"),
  ],
  rulebook: PHASE_II_RULEBOOK,
  populationSnapshot: POPULATION_SNAPSHOT,
  shells: INTERNAL_QC.shells,
  drawPile: INTERNAL_QC.drawPile,
};

// The open report: pooled outputs, Total column only.
const OPEN_REPORT = safetyDrafts(
  PHASE_II_RULEBOOK.id,
  [
    { output: "overview", version: "A", label: "Open report (v1.0)" },
    // S-007's nausea and vomiting counted as two subjects.
    {
      output: "gi",
      version: "A",
      label: "Open report (v1.0)",
      defects: { "1:0": "3 (25)" },
    },
    { output: "nervous", version: "A", label: "Open report (v1.0)" },
    // One SAE too many.
    {
      output: "sae",
      version: "A",
      label: "Open report (v1.0)",
      defects: { "1:0": "4 (33)" },
    },
    { output: "general", version: "A", label: "Open report (v1.0)" },
  ],
  { ...P2, pooled: true }
);

// The closed report: by-arm outputs, face down in the open session.
const CLOSED_REPORT = safetyDrafts(
  PHASE_II_RULEBOOK.id,
  [
    { output: "overview", version: "C", label: "Closed report (v1.0)" },
    // A 1-dp slip in the Active column.
    {
      output: "sae",
      version: "C",
      label: "Closed report (v1.0)",
      defects: { "1:1": "2 (33.3)" },
    },
  ],
  { ...P2, blinded: true }
);

/**
 * Big Blind. The Data Monitoring Committee's open session: pooled outputs
 * only, face up. The by-arm closed report is dealt face down, and so are the
 * Kaplan-Meier figures drawn from it. Structural QC reads a face-down
 * output's shape without its values; once every one in hand has had it, the
 * DMC can convene the closed session and turn them face up. A peek before
 * then zeroes the next hand.
 */
export const DMC_OPEN_SESSION_SCENARIO: Scenario = {
  id: "dmc-open-session-big-blind",
  title: "DMC Open Session",
  summary:
    "The Data Monitoring Committee's open session: pooled Phase II outputs face up, the by-arm closed report face down.",
  intro:
    "The DMC's open session sees pooled outputs only. The by-arm closed report and its Kaplan-Meier figures are dealt face down: run structural QC on them, then convene the closed session to turn them up. A peek before then zeroes a hand.",
  blind: {
    tier: "BIG_BLIND",
    name: "Big Blind: DMC Open Session",
    quota: 11000,
  },
  handType: "HIGH_TABLE",
  startingCpu: 6,
  table: { startingCpu: 12, handSize: 8, maxSelection: 5 },
  deck: [
    pick(OPEN_REPORT.cards, "overview-A"),
    AE_LISTING,
    pick(CLOSED_REPORT.cards, "sae-C"),
    pick(OPEN_REPORT.cards, "gi-A"),
    kmSae("C-T14.3.3-C"),
    SAE_LISTING,
    pick(OPEN_REPORT.cards, "sae-A"),
    DISPOSITION,
    pick(CLOSED_REPORT.cards, "overview-C"),
    kmDiscontinuation("C-T14.3.1-C"),
    pick(OPEN_REPORT.cards, "nervous-A"),
    DISCONTINUED_LISTING,
    pick(OPEN_REPORT.cards, "general-A"),
    DM_LISTING,
  ],
  rulebook: PHASE_II_RULEBOOK,
  populationSnapshot: POPULATION_SNAPSHOT,
  shells: [...OPEN_REPORT.shells, ...CLOSED_REPORT.shells],
  drawPile: [...OPEN_REPORT.drawPile, ...CLOSED_REPORT.drawPile],
  dmc: { charter: "DMC Charter §5 (open and closed sessions)" },
};

/** Act II's crisis deck. Every card has one choice that costs nothing. */
export const ACT_II_CRISES: CrisisCard[] = [
  {
    id: "CR-P2-FUTILITY-LOOK",
    name: "Futility Look",
    description:
      "The DMC asks for an unplanned futility look before the interim. The sponsor will pay for the extra work.",
    choices: [
      {
        id: "accept",
        label: "Run the futility look",
        consequence:
          "Earn $2k of study budget, but this Blind allows only 3 hands.",
        effect: {
          budget: 2,
          modifier: {
            id: "CR-P2-FUTILITY-HANDS",
            name: "Futility Look",
            description: "The look takes the slot of one submission: 3 only.",
            debuffType: "HAND_LIMIT",
            maxHandsAllowed: 3,
          },
        },
      },
      {
        id: "decline",
        label: "Hold to the charter",
        consequence: "Writing the DMC chair a rationale costs −1 CPU.",
        effect: { cpu: -1 },
      },
    ],
  },
  {
    id: "CR-P2-CRO-HANDOVER",
    name: "CRO Handover",
    description:
      "Statistical programming moves to a new CRO mid-study. Their team reruns every program from a fresh checkout.",
    choices: [
      {
        id: "handover",
        label: "Hand over now",
        consequence: "Discard costs +1 CPU for this Blind.",
        effect: {
          modifier: {
            id: "CR-P2-HANDOVER-DISCARD",
            name: "CRO Handover",
            description: "Every rerun goes through the new team: +1 CPU.",
            debuffType: "DISCARD_PENALTY",
            discardCpuPenalty: 1,
          },
        },
      },
      {
        id: "parallel",
        label: "Run both teams in parallel",
        consequence: "Costs $3k of study budget.",
        effect: { budget: -3 },
      },
      {
        id: "footnote",
        label: "Document it in a footnote",
        consequence: "Spends the first footnote seal in your tray.",
        effect: { spendSeal: true },
      },
    ],
  },
  {
    id: "CR-P2-PHARMACIST",
    name: "Unblinded Pharmacist",
    description:
      "A site pharmacist copied the study team on a kit reassignment. The DMC wants the firewall breach reviewed before it meets.",
    choices: [
      {
        id: "report",
        label: "Report it to the DMC",
        consequence:
          "The DMC reviews the breach in session: this Blind allows only 3 hands.",
        effect: {
          modifier: {
            id: "CR-P2-PHARMACIST-HANDS",
            name: "Firewall Review",
            description: "Session time goes to the breach: 3 submissions only.",
            debuffType: "HAND_LIMIT",
            maxHandsAllowed: 3,
          },
        },
      },
      {
        id: "retrain",
        label: "Retrain the site",
        consequence: "An unscheduled monitoring visit: −2 CPU.",
        effect: { cpu: -2 },
      },
    ],
  },
  {
    id: "CR-P2-SUPPLY-DELAY",
    name: "Drug Supply Delay",
    description:
      "The next shipment of study kits is held at customs, and the sponsor wants the package early to argue for a rush release.",
    choices: [
      {
        id: "rush",
        label: "Send the package early",
        consequence:
          "Earn $2k of study budget, but discard costs +1 CPU for this Blind.",
        effect: {
          budget: 2,
          modifier: {
            id: "CR-P2-SUPPLY-DISCARD",
            name: "Early Package",
            description: "No time to rerun: every discard costs +1 CPU.",
            debuffType: "DISCARD_PENALTY",
            discardCpuPenalty: 1,
          },
        },
      },
      {
        id: "hold",
        label: "Keep the agreed date",
        consequence: "Negotiating the date costs −1 CPU.",
        effect: { cpu: -1 },
      },
    ],
  },
];

/**
 * Act II: the Phase II proof-of-concept study. Internal QC under the new
 * SAP, then the DMC's open session; the Boss is drawn by the run's seed
 * from a pool of two: the DMC milestone review or the FDA's End-of-Phase-2
 * Information Request. It reads the same fictional study data as Act I and
 * shares its Procurement Shop. Until the campaign links the acts (#924) it
 * is played on its own.
 */
export const ACT_II: Act = {
  id: "act-2-phase-2",
  title: "Act II: Phase II Proof of Concept",
  blinds: [PHASE_II_QC_SCENARIO, DMC_OPEN_SESSION_SCENARIO],
  bossPool: [DMC_MILESTONE_SCENARIO, FDA_IR_SCENARIO],
  crisisDeck: ACT_II_CRISES,
  shop: ACT_I_SHOP,
};

// ---------------------------------------------------------------------------
// Act III: Phase III Blinded Pivotal (#1085).
// ---------------------------------------------------------------------------

/**
 * Act III's SAP: the pivotal study's own version. Incidence percentages stay
 * whole numbers, as in Phase II.
 */
const PHASE_III_RULEBOOK = safetyRulebook(
  "SAP-P3-001",
  "Phase III SAP §11 Safety Outputs",
  "SAP-P3",
  3,
  0
);

const P3 = { percentPrecision: 0 };

/**
 * The primary efficacy table: time to symptom resolution (ITT). Two Placebo
 * subjects resolve (S-002 at week 10, S-005 at week 11); five Active
 * subjects do (weeks 3 to 8), and S-008 is censored at week 2 when it
 * discontinued.
 */
const efficacyPrimary = (id: string, title: string): TlfCard =>
  card({
    id,
    cardType: "TABLE",
    number: "Table 14.2.1",
    title,
    population: "ITT",
    chips: 40,
    mult: 1,
    topic: "EFF-PRIMARY",
    csrStage: "EFFICACY",
    face: {
      kind: "TABLE",
      columns: ["Placebo", "Active"],
      rows: [
        { label: "Subjects, N", values: ["6", "6"] },
        { label: "Resolved", values: ["2 (33)", "5 (83)"] },
        { label: "Median, weeks", values: ["NE", "5"] },
      ],
    },
  });

/** The week-12 responder table, a secondary endpoint (ITT). */
const efficacyResponders = (id: string, title: string): TlfCard =>
  card({
    id,
    cardType: "TABLE",
    number: "Table 14.2.2",
    title,
    population: "ITT",
    chips: 35,
    mult: 1,
    topic: "EFF-SECONDARY",
    csrStage: "EFFICACY",
    face: {
      kind: "TABLE",
      columns: ["Placebo", "Active"],
      rows: [
        { label: "Subjects, N", values: ["6", "6"] },
        { label: "Responders", values: ["2 (33)", "5 (83)"] },
        { label: "Difference, %", values: ["Ref", "50"] },
      ],
    },
  });

/** Change from baseline in symptom score at week 12 (ITT). */
const efficacyChange = (id: string, title: string): TlfCard =>
  card({
    id,
    cardType: "TABLE",
    number: "Table 14.2.3",
    title,
    population: "ITT",
    chips: 35,
    mult: 1,
    topic: "EFF-SECONDARY",
    csrStage: "EFFICACY",
    face: {
      kind: "TABLE",
      columns: ["Placebo", "Active"],
      rows: [
        { label: "Subjects, N", values: ["6", "6"] },
        { label: "Mean change", values: ["-1.2", "-4.6"] },
        { label: "LS mean diff.", values: ["Ref", "-3.4"] },
      ],
    },
  });

/**
 * Time to symptom resolution (KM), drawn from the primary efficacy table
 * (`parentId`). With `draft`, the Active at-risk row still counts S-008 at
 * week 4, after it was censored at week 2.
 */
const kmResolution = (parentId: string, draft: boolean): TlfCard => ({
  id: "C-F14.2.1",
  cardType: "FIGURE",
  number: "Figure 14.2.1",
  title: "Time to Symptom Resolution (KM)",
  population: "ITT",
  chips: 30,
  mult: 1,
  topic: "EFF-PRIMARY",
  csrStage: "EFFICACY",
  km: {
    endpoint: "Time to symptom resolution",
    timeUnit: "weeks",
    populationSnapshotId: snapshotId,
    parent: {
      cardId: parentId,
      atRiskRow: "Subjects, N",
      eventsRow: "Resolved",
    },
    timeOrigin: 0,
    milestones: [0, 4, 8, 12],
    records: kmRecords(
      {
        "S-002": 10,
        "S-005": 11,
        "S-007": 4,
        "S-009": 3,
        "S-010": 8,
        "S-011": 6,
        "S-012": 5,
      },
      12,
      { "S-008": 2 }
    ),
    displayed: [
      {
        arm: "PLACEBO",
        curve: [
          [0, 1],
          [10, 0.833],
          [11, 0.667],
          [12, 0.667],
        ],
        censorTicks: [12],
        atRisk: [6, 6, 6, 4],
      },
      {
        arm: "ACTIVE",
        curve: [
          [0, 1],
          [3, 0.8],
          [4, 0.6],
          [5, 0.4],
          [6, 0.2],
          [8, 0],
          [12, 0],
        ],
        censorTicks: [2],
        atRisk: draft ? [6, 5, 1, 0] : [6, 4, 1, 0],
      },
    ],
  },
});

/** The primary endpoint's treatment difference by subgroup (forest plot). */
const FOREST_PRIMARY = card({
  id: "C-F14.2.4",
  cardType: "FIGURE",
  number: "Figure 14.2.4",
  title: "Primary Endpoint by Subgroup (Forest)",
  population: "ITT",
  chips: 30,
  mult: 1,
  topic: "EFF-PRIMARY",
  csrStage: "EFFICACY",
  face: {
    kind: "FIGURE",
    plot: {
      type: "FOREST",
      reference: 0,
      intervals: [
        { label: "Overall", estimate: 50, lower: 4, upper: 96 },
        { label: "Age < 65", estimate: 60, lower: 8, upper: 100 },
        { label: "Age ≥ 65", estimate: 33, lower: -41, upper: 100 },
        { label: "Female", estimate: 58, lower: 2, upper: 100 },
        { label: "Male", estimate: 33, lower: -50, upper: 100 },
      ],
    },
    source: "Table 14.2.1",
  },
});

// Blinded data review: pooled safety outputs, Total column only.
const BLINDED_REVIEW = safetyDrafts(
  PHASE_III_RULEBOOK.id,
  [
    { output: "overview", version: "F", label: "Blinded review (v0.5)" },
    // One SAE too many.
    {
      output: "sae",
      version: "F",
      label: "Blinded review (v0.5)",
      defects: { "1:0": "4 (33)" },
    },
    // S-010's syncope and dizziness counted as two subjects.
    {
      output: "nervous",
      version: "F",
      label: "Blinded review (v0.5)",
      defects: { "1:0": "4 (33)" },
    },
    { output: "gi", version: "F", label: "Blinded review (v0.5)" },
  ],
  { ...P3, pooled: true }
);

/**
 * Small Blind. Before database lock the study team reviews the data blind:
 * safety outputs pooled across arms, and the efficacy programs run as a dry
 * run so the tables, the KM figure and the forest plot are validated before
 * the real treatment codes arrive. This is the first place the game deals
 * efficacy outputs.
 */
export const BLINDED_DATA_REVIEW_SCENARIO: Scenario = {
  id: "blinded-data-review-small-blind",
  title: "Blinded Data Review",
  summary:
    "Before database lock, the study team reviews pooled safety outputs and dry-runs the efficacy tables and figures.",
  intro:
    "The pivotal study's data are still blind. Safety outputs are pooled; the efficacy programs are dry-run so the tables and figures are ready for unblinding. Three Tables and two Figures drawn from them make an Efficacy Full House.",
  blind: {
    tier: "SMALL_BLIND",
    name: "Small Blind: Blinded Data Review",
    quota: 15000,
  },
  handType: "HIGH_TABLE",
  startingCpu: 6,
  table: { startingCpu: 10, handSize: 8, maxSelection: 5 },
  deck: [
    pick(BLINDED_REVIEW.cards, "overview-F"),
    AE_LISTING,
    efficacyPrimary("C-T14.2.1-DRY", "Time to Symptom Resolution (dry run)"),
    kmResolution("C-T14.2.1-DRY", true),
    DISPOSITION,
    FOREST_PRIMARY,
    pick(BLINDED_REVIEW.cards, "sae-F"),
    SAE_LISTING,
    efficacyResponders("C-T14.2.2-DRY", "Responders at Week 12 (dry run)"),
    DM_LISTING,
    pick(BLINDED_REVIEW.cards, "nervous-F"),
    DEMOGRAPHICS_FINAL,
    DISCONTINUED_LISTING,
    pick(BLINDED_REVIEW.cards, "gi-F"),
  ],
  rulebook: PHASE_III_RULEBOOK,
  populationSnapshot: POPULATION_SNAPSHOT,
  shells: BLINDED_REVIEW.shells,
  drawPile: BLINDED_REVIEW.drawPile,
};

// Topline: the unblinded, by-arm safety outputs.
const TOPLINE = safetyDrafts(
  PHASE_III_RULEBOOK.id,
  [
    // A 1-dp slip in the Active column.
    {
      output: "overview",
      version: "G",
      label: "Topline (v1.0)",
      defects: { "1:1": "5 (83.3)" },
    },
    { output: "sae", version: "G", label: "Topline (v1.0)" },
    // S-007's nausea and vomiting counted as two subjects.
    {
      output: "gi",
      version: "G",
      label: "Topline (v1.0)",
      defects: { "1:1": "2 (33)", "1:2": "3 (25)" },
    },
    { output: "cardiac", version: "G", label: "Topline (v1.0)" },
  ],
  P3
);

/**
 * Big Blind. After database lock and unblinding, the sponsor reads the
 * topline results: the efficacy tables by arm, their figures, and the key
 * safety tables. Act III's Big Blind is the sponsor topline review rather
 * than a DMC open session, which Act II already plays.
 */
export const SPONSOR_TOPLINE_SCENARIO: Scenario = {
  id: "sponsor-topline-big-blind",
  title: "Sponsor Topline Review",
  summary:
    "After unblinding, the sponsor reads the topline: efficacy by arm, its figures, and the key safety tables.",
  intro:
    "The database is locked and the codes are broken. The sponsor wants the topline by arm: the primary endpoint, its KM figure and forest plot, the secondary endpoints, and the safety tables. Every number here goes into the press release, so check the figures against their tables.",
  blind: {
    tier: "BIG_BLIND",
    name: "Big Blind: Sponsor Topline Review",
    quota: 17000,
  },
  handType: "HIGH_TABLE",
  startingCpu: 6,
  table: { startingCpu: 12, handSize: 8, maxSelection: 5 },
  deck: [
    efficacyPrimary("C-T14.2.1", "Time to Symptom Resolution"),
    pick(TOPLINE.cards, "overview-G"),
    AE_LISTING,
    kmResolution("C-T14.2.1", false),
    efficacyResponders("C-T14.2.2", "Responders at Week 12"),
    FOREST_PRIMARY,
    DISPOSITION,
    pick(TOPLINE.cards, "sae-G"),
    SAE_LISTING,
    efficacyChange("C-T14.2.3", "Change in Symptom Score"),
    DEMOGRAPHICS_FINAL,
    DM_LISTING,
    pick(TOPLINE.cards, "gi-G"),
    pick(TOPLINE.cards, "cardiac-G"),
    DISCONTINUED_LISTING,
  ],
  rulebook: PHASE_III_RULEBOOK,
  populationSnapshot: POPULATION_SNAPSHOT,
  shells: TOPLINE.shells,
  drawPile: TOPLINE.drawPile,
};

// The locked package's safety outputs.
const LOCK_PACKAGE = safetyDrafts(
  PHASE_III_RULEBOOK.id,
  [
    { output: "overview", version: "H", label: "CSR final (v2.0)" },
    { output: "sae", version: "H", label: "CSR final (v2.0)" },
    {
      output: "nervous",
      version: "H",
      label: "CSR final (v2.0)",
      defects: { "1:2": "4 (33)" },
    },
  ],
  P3
);

/**
 * PLACEHOLDER Boss (#922 replaces it). Act III's Boss is always CSR Lock.
 * Until #922 delivers the lock and its reconciliation, this stand-in deals
 * the final CSR package, one card for every CSR stage, under a three-hand
 * limit, so the act can be played through.
 */
export const CSR_LOCK_PLACEHOLDER_SCENARIO: Scenario = {
  id: "csr-lock-placeholder-boss-blind",
  title: "CSR Lock (placeholder)",
  summary:
    "The final Clinical Study Report package. A stand-in for the CSR Lock boss until it is built.",
  intro:
    "The Clinical Study Report is ready to lock: disposition, baseline, efficacy, safety and the patient listings. Five outputs, one from each stage, make a CSR Straight. The lock itself arrives in a later build.",
  blind: {
    tier: "BOSS_BLIND",
    name: "Boss Blind: CSR Lock (placeholder)",
    quota: 15000,
  },
  boss: {
    id: "CSR-LOCK-PLACEHOLDER",
    name: "Lock Deadline",
    description:
      "The CSR package locks after 3 submissions. A placeholder until the CSR Lock boss is built.",
    debuffType: "HAND_LIMIT",
    maxHandsAllowed: 3,
  },
  handType: "HIGH_TABLE",
  startingCpu: 6,
  table: { startingCpu: 12, handSize: 8, maxSelection: 5 },
  deck: [
    DISPOSITION,
    DEMOGRAPHICS_FINAL,
    efficacyPrimary("C-T14.2.1", "Time to Symptom Resolution"),
    pick(LOCK_PACKAGE.cards, "overview-H"),
    AE_LISTING,
    kmResolution("C-T14.2.1", false),
    FOREST_PRIMARY,
    efficacyResponders("C-T14.2.2", "Responders at Week 12"),
    pick(LOCK_PACKAGE.cards, "sae-H"),
    SAE_LISTING,
    DM_LISTING,
    efficacyChange("C-T14.2.3", "Change in Symptom Score"),
    pick(LOCK_PACKAGE.cards, "nervous-H"),
    DISCONTINUED_LISTING,
  ],
  rulebook: PHASE_III_RULEBOOK,
  populationSnapshot: POPULATION_SNAPSHOT,
  shells: LOCK_PACKAGE.shells,
  drawPile: LOCK_PACKAGE.drawPile,
};

/** Act III's crisis deck. Every card has one choice that costs nothing. */
export const ACT_III_CRISES: CrisisCard[] = [
  {
    id: "CR-P3-LOCK-SLIP",
    name: "Database Lock Slip",
    description:
      "Three sites still have open queries on the primary endpoint. Lock can wait, or the queries can be closed as they stand.",
    choices: [
      {
        id: "wait",
        label: "Wait for the sites",
        consequence: "Discard costs +1 CPU for this Blind.",
        effect: {
          modifier: {
            id: "CR-P3-LOCK-DISCARD",
            name: "Lock Slip",
            description: "Every rerun waits on a query: +1 CPU.",
            debuffType: "DISCARD_PENALTY",
            discardCpuPenalty: 1,
          },
        },
      },
      {
        id: "close",
        label: "Close the queries as they stand",
        consequence: "The medical monitor wants a memo: −1 CPU.",
        effect: { cpu: -1 },
      },
    ],
  },
  {
    id: "CR-P3-SAE-RECON",
    name: "Late SAE Reconciliation",
    description:
      "The safety database and the clinical database disagree on one SAE's onset date, a week before lock.",
    choices: [
      {
        id: "reconcile",
        label: "Reconcile it now",
        consequence: "A pharmacovigilance review: −2 CPU.",
        effect: { cpu: -2 },
      },
      {
        id: "footnote",
        label: "Footnote the discrepancy",
        consequence:
          "Gain an AE Not Mutually Exclusive seal, but this Blind allows only 3 hands.",
        effect: {
          grantSeal: AE_NOT_EXCLUSIVE,
          modifier: {
            id: "CR-P3-SAE-HANDS",
            name: "SAE Reconciliation",
            description: "Review time goes to the SAE: 3 submissions only.",
            debuffType: "HAND_LIMIT",
            maxHandsAllowed: 3,
          },
        },
      },
    ],
  },
  {
    id: "CR-P3-EMERGENCY-UNBLINDING",
    name: "Emergency Unblinding",
    description:
      "An investigator requests one subject's treatment code for an emergency. The unblinding must be documented before lock.",
    choices: [
      {
        id: "document",
        label: "Document it in the TMF",
        consequence: "Earn $1k of study budget for the audit trail.",
        effect: { budget: 1 },
      },
      {
        id: "footnote",
        label: "Document it in a footnote",
        consequence: "Spends the first footnote seal in your tray.",
        effect: { spendSeal: true },
      },
    ],
  },
  {
    id: "CR-P3-PRE-NDA",
    name: "Pre-NDA Meeting",
    description:
      "The agency grants a pre-NDA meeting and wants the key tables in its briefing book. The sponsor will fund the rush.",
    choices: [
      {
        id: "brief",
        label: "Write the briefing book",
        consequence: "Earn $2k of study budget, but −1 CPU.",
        effect: { budget: 2, cpu: -1 },
      },
      {
        id: "decline",
        label: "Ask for a later date",
        consequence: "Nothing changes this Blind.",
        effect: {},
      },
    ],
  },
];

/**
 * Act III: the Phase III blinded pivotal study. A blinded data review, then
 * the sponsor's topline review after unblinding; the Boss is always CSR
 * Lock, played as a placeholder until #922 builds it. It reads the same
 * fictional study data as Acts I and II and shares their Procurement Shop.
 * Until the campaign links the acts (#924) it is played on its own.
 */
export const ACT_III: Act = {
  id: "act-3-phase-3",
  title: "Act III: Phase III Blinded Pivotal",
  blinds: [BLINDED_DATA_REVIEW_SCENARIO, SPONSOR_TOPLINE_SCENARIO],
  bossPool: [CSR_LOCK_PLACEHOLDER_SCENARIO],
  crisisDeck: ACT_III_CRISES,
  shop: ACT_I_SHOP,
};

/** Every playable scenario, keyed by id. */
export const SCENARIOS: Readonly<Record<string, Scenario>> = Object.freeze(
  Object.fromEntries(
    [
      ...ACT_I.blinds,
      ...(ACT_I.bossPool ?? []),
      ...ACT_II.blinds,
      ...(ACT_II.bossPool ?? []),
      ...ACT_III.blinds,
      ...(ACT_III.bossPool ?? []),
    ].map((scenario) => [scenario.id, scenario])
  )
);
