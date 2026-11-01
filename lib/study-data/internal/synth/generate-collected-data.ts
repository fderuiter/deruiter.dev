/** Seeded, schedule-driven synthetic source data for the study-data pipeline. */
import { uniformAt } from "@/lib/utils/prng";
import { AE_DICTIONARY, HISTORY_DICTIONARY } from "../sdtm/ae-dictionary";
import { CM_DICTIONARY } from "../sdtm/cm-dictionary";
import { criterionTestCode } from "../sdtm/trial-design";
import { QUESTIONNAIRE_SCORES } from "./questionnaires";
import type {
  CellValue,
  Dataset,
  PipelineOptions,
  RandomisationDefinition,
  StudyDefinition,
  VariableMeta,
} from "../../types";

type Row = Record<string, CellValue>;
type Domain =
  | "DM"
  | "RAND"
  | "SV"
  | "EX"
  | "VS"
  | "LB"
  | "EG"
  | "AE"
  | "CM"
  | "MH"
  | "IE"
  | "DS"
  | "CO"
  | "CE"
  | "QS";

const BASE_DATE = "2030-01-01";

/**
 * Outcomes a clinical events committee adjudicates, drawn only for a study
 * that schedules a CE activity (#3417): the share of randomized subjects
 * with at least one, and the event as the committee records it. The rates
 * are synthetic and the same in every arm.
 */
const DEATH_SHARE = 0.06;
const ADJUDICATED_EVENTS = [
  {
    key: "stroke",
    share: 0.04,
    repeatShare: 0,
    term: "Disabling stroke (modified Rankin Scale 2 or more at 90 days)",
    decod: "DISABLING STROKE",
  },
  {
    key: "rehosp",
    share: 0.12,
    repeatShare: 0.3,
    term: "Rehospitalisation for valve-related symptoms or worsening heart failure",
    decod: "REHOSPITALISATION",
  },
] as const;

/**
 * The seriousness criteria the EDC asks for once an event is reported
 * serious, in SDTMIG 3.4 order, with their CRF labels.
 */
const SERIOUSNESS_CRITERIA = [
  ["AESCONG", "Congenital anomaly or birth defect"],
  ["AESDISAB", "Persistent or significant disability"],
  ["AESDTH", "Results in death"],
  ["AESHOSP", "Requires or prolongs hospitalization"],
  ["AESLIFE", "Life threatening"],
  ["AESMIE", "Other medically important event"],
] as const;

/**
 * The criterion a serious event meets, by cumulative probability:
 * hospitalization is the commonest. Nobody in the generated study dies or
 * is pregnant, so no event is fatal or a birth defect.
 */
const SERIOUSNESS_REASONS = [
  { name: "AESHOSP", upTo: 0.6 },
  { name: "AESMIE", upTo: 0.85 },
  { name: "AESLIFE", upTo: 0.95 },
  { name: "AESDISAB", upTo: 1 },
] as const;

/** A medication as the CRF records it: dose, unit, frequency and route. */
interface Regimen {
  readonly reported: string;
  readonly dose: number;
  readonly frequency: "QD" | "BID" | "PRN";
  readonly indication: string;
}

/** The dictionary's reported name for a medication, checked once here. */
function reportedName(decod: string): string {
  return CM_DICTIONARY.find((entry) => entry.decod === decod)!.reported;
}

/**
 * Long-term medications a subject may take for another condition, with the
 * share of subjects who do. All continue through the study. The shares are
 * round, illustrative figures, not prevalence statistics.
 */
const BACKGROUND_MEDICATIONS: readonly (Regimen & {
  readonly share: number;
})[] = [
  {
    reported: reportedName("ATORVASTATIN"),
    dose: 20,
    frequency: "QD",
    indication: "Hypercholesterolaemia",
    share: 0.25,
  },
  {
    reported: reportedName("METFORMIN"),
    dose: 500,
    frequency: "BID",
    indication: "Type 2 diabetes mellitus",
    share: 0.12,
  },
  {
    reported: reportedName("OMEPRAZOLE"),
    dose: 20,
    frequency: "QD",
    indication: "Gastro-oesophageal reflux disease",
    share: 0.15,
  },
  {
    reported: reportedName("ACETYLSALICYLIC ACID"),
    dose: 75,
    frequency: "QD",
    indication: "Cardiovascular prophylaxis",
    share: 0.1,
  },
];

/** An antihypertensive stopped for the washout before first dose. */
const WASHED_OUT: Regimen = {
  reported: reportedName("RAMIPRIL"),
  dose: 5,
  frequency: "QD",
  indication: "Hypertension",
};

/** The rescue antihypertensive the protocol allows on treatment. */
const RESCUE: Regimen = {
  reported: reportedName("AMLODIPINE"),
  dose: 5,
  frequency: "QD",
  indication: "Hypertension",
};

/** A reported condition, checked once here against the dictionary. */
function condition(reported: string): string {
  return HISTORY_DICTIONARY.find((entry) => entry.reported === reported)!
    .reported;
}

/**
 * Past conditions a subject may report that have resolved, with the share of
 * subjects who do and how far back, in years, they happened. Round,
 * illustrative figures, not prevalence statistics.
 */
const RESOLVED_CONDITIONS = [
  { reported: condition("Appendicitis"), share: 0.06, years: [10, 30] },
  { reported: condition("Pneumonia"), share: 0.08, years: [2, 8] },
] as const;

/**
 * How a screen failure's own screening data shows the DEMO-301 criterion it
 * did not meet, keyed by the USDM criterion id. The age criterion is 18 to 75
 * years, the blood pressure criterion a seated systolic pressure of 140 to
 * 159 mmHg, and the renal exclusion an eGFR below 45 mL/min/1.73 m2. The
 * creatinine range, 200 to 260 umol/L, puts CKD-EPI 2021 eGFR below 45 at
 * every age and either sex the study screens.
 */
const FAILED_CRITERION_EVIDENCE = {
  ec_inc_age: "age",
  ec_inc_bp: "systolic",
  ec_exc_renal: "creatinine",
} as const satisfies Readonly<Record<string, string>>;
type Evidence =
  (typeof FAILED_CRITERION_EVIDENCE)[keyof typeof FAILED_CRITERION_EVIDENCE];

/**
 * Why a site says a subject missed a visit, as free text on the comments
 * form. Illustrative wording, drawn evenly.
 */
const MISSED_VISIT_REASONS = [
  "Subject was unwell and could not attend.",
  "Subject was travelling and could not attend.",
  "Site could not schedule the visit within its window.",
] as const;

/** Medications taken for an adverse event, keyed by its preferred term. */
const AE_TREATMENTS: Readonly<
  Record<string, Omit<Regimen, "indication"> & { readonly share: number }>
> = {
  Headache: {
    reported: reportedName("PARACETAMOL"),
    dose: 1000,
    frequency: "PRN",
    share: 0.6,
  },
  Nausea: {
    reported: reportedName("ONDANSETRON"),
    dose: 4,
    frequency: "PRN",
    share: 0.5,
  },
};

/**
 * The race a subject reports, by cumulative probability, as the EDC
 * collects it with Race As Collected (C128689) submission values. The shares
 * are round, illustrative figures for a North American enrollment, not
 * census or trial statistics.
 */
const RACES = [
  { value: "WHITE", upTo: 0.7 },
  { value: "BLACK OR AFRICAN AMERICAN", upTo: 0.84 },
  { value: "ASIAN", upTo: 0.95 },
  { value: "AMERICAN INDIAN OR ALASKA NATIVE", upTo: 0.98 },
  { value: "NATIVE HAWAIIAN OR PACIFIC ISLANDER", upTo: 1 },
] as const;

/**
 * The fictional sites every synthetic study enrolls at, as the EDC's site
 * list holds them: a site number and the site's country (ISO 3166-1
 * alpha-3). No site names, investigators or addresses are invented. The
 * list matches the eight sites the Clinical Data Platform plans for
 * DEMO-301, numbered from 101 and alternating between the United States and
 * Canada.
 */
const SITES = Array.from({ length: 8 }, (_, index) => ({
  siteId: String(101 + index),
  country: index % 2 === 0 ? "USA" : "CAN",
}));

function draw(
  seed: number,
  studyId: string,
  subject: string,
  domain: string,
  key: string
): number {
  return uniformAt(`${seed}|${studyId}|${subject}|${domain}|${key}`, 0);
}

function offset(day: number): number {
  return day > 0 ? day - 1 : day;
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function round(value: number, places = 1): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function clamp(value: number, lower: number, upper: number): number {
  if (value < lower) return lower;
  if (value > upper) return upper;
  return value;
}

function meta(
  name: string,
  label: string,
  type: VariableMeta["type"] = "text",
  origin: VariableMeta["origin"] = "Collected"
): VariableMeta {
  return {
    name,
    label,
    type,
    origin,
    ...(type === "text" ? { length: 80 } : {}),
  };
}

const SRC = meta("SRCID", "Collected source ID", "text", "Assigned");
const SUBJ = meta("USUBJID", "Unique subject identifier", "text", "Assigned");
const DATE = (name: string, label: string) => meta(name, label, "date");
const NUM = (name: string, label: string) => meta(name, label, "float");
const TEXT = (name: string, label: string) => meta(name, label);

const COLUMNS: Record<Domain, readonly VariableMeta[]> = {
  DM: [
    SRC,
    SUBJ,
    TEXT("SITEID", "Site number"),
    TEXT("COUNTRY", "Site country"),
    DATE("CONSENTDTC", "Informed consent date"),
    NUM("AGE", "Age at consent"),
    TEXT("SEX", "Sex"),
    TEXT("RACE", "Race"),
    TEXT("SCREENFL", "Screening outcome"),
    TEXT("RANDFL", "Randomized flag"),
  ],
  RAND: [
    SRC,
    SUBJ,
    DATE("RANDDTC", "Randomization date"),
    TEXT("ARMCD", "Assigned arm code"),
    TEXT("ARM", "Assigned arm"),
  ],
  SV: [
    SRC,
    SUBJ,
    NUM("VISITNUM", "Protocol visit number"),
    TEXT("VISIT", "Visit name"),
    NUM("PLANDY", "Planned study day"),
    NUM("ACTDY", "Actual study day"),
    DATE("SVDTC", "Visit date"),
    TEXT("STATUS", "Visit status"),
  ],
  EX: [
    SRC,
    SUBJ,
    TEXT("EXTRT", "Study treatment"),
    NUM("EXDOSE", "Daily tablet count"),
    TEXT("EXDOSU", "Dose unit"),
    DATE("EXSTDTC", "Exposure start date"),
    DATE("EXENDTC", "Exposure end date"),
  ],
  VS: [
    SRC,
    SUBJ,
    NUM("VISITNUM", "Protocol visit number"),
    TEXT("VISIT", "Visit name"),
    DATE("VSDTC", "Vital signs date"),
    TEXT("VSTESTCD", "Vital signs test code"),
    NUM("VSORRES", "Original result"),
    TEXT("VSORRESU", "Original result unit"),
  ],
  LB: [
    SRC,
    SUBJ,
    NUM("VISITNUM", "Protocol visit number"),
    TEXT("VISIT", "Visit name"),
    DATE("LBDTC", "Laboratory date"),
    TEXT("LBTESTCD", "Laboratory test code"),
    NUM("LBORRES", "Original result"),
    TEXT("LBORRESU", "Original result unit"),
    TEXT("LBNRIND", "Reference range indicator"),
  ],
  EG: [
    SRC,
    SUBJ,
    NUM("VISITNUM", "Protocol visit number"),
    TEXT("VISIT", "Visit name"),
    DATE("EGDTC", "ECG date"),
    TEXT("EGTESTCD", "ECG test code"),
    NUM("EGORRES", "Original result"),
    TEXT("EGORRESU", "Original result unit"),
  ],
  CM: [
    SRC,
    SUBJ,
    TEXT("CMTRT", "Medication name"),
    TEXT("CMCAT", "Medication category"),
    TEXT("CMINDC", "Indication"),
    NUM("CMDOSE", "Dose"),
    TEXT("CMDOSU", "Dose unit"),
    TEXT("CMDOSFRQ", "Frequency"),
    TEXT("CMROUTE", "Route"),
    DATE("CMSTDTC", "Start date"),
    DATE("CMENDTC", "End date"),
    TEXT("CMONGO", "Ongoing at end of study"),
    TEXT("CMAENO", "Related adverse event number"),
  ],
  MH: [
    SRC,
    SUBJ,
    TEXT("MHTERM", "Medical history term"),
    TEXT("MHCAT", "Medical history category"),
    DATE("MHDTC", "Date collected"),
    DATE("MHSTDTC", "Onset date"),
    DATE("MHENDTC", "End date"),
    TEXT("MHONGO", "Ongoing at screening"),
  ],
  IE: [
    SRC,
    SUBJ,
    NUM("VISITNUM", "Protocol visit number"),
    TEXT("VISIT", "Visit name"),
    DATE("IEDTC", "Eligibility assessment date"),
    TEXT("IETESTCD", "Criterion not met"),
    TEXT("IECAT", "Criterion category"),
  ],
  AE: [
    SRC,
    SUBJ,
    TEXT("AEBODSYS", "Fictional body system"),
    TEXT("AEDECOD", "Fictional preferred term"),
    DATE("AESTDTC", "Adverse event start date"),
    DATE("AEENDTC", "Adverse event end date"),
    TEXT("AESER", "Serious event flag"),
    TEXT("AEREL", "Treatment relationship"),
    TEXT("AEACN", "Action taken with treatment"),
    ...SERIOUSNESS_CRITERIA.map(([name, label]) => TEXT(name, label)),
  ],
  DS: [
    SRC,
    SUBJ,
    DATE("DSSTDTC", "Disposition event date"),
    TEXT("DSDECOD", "Disposition event"),
    TEXT("DSSCAT", "Disposition category"),
  ],
  // The general comments form: free text a site attaches to another
  // record, which RSRCID names by its collected source ID.
  CO: [
    SRC,
    SUBJ,
    TEXT("RSRCID", "Source ID of the commented record"),
    TEXT("COVAL", "Comment"),
  ],
  // The clinical events committee's adjudicated events: the event the
  // committee confirmed and the date it began.
  CE: [
    SRC,
    SUBJ,
    TEXT("CETERM", "Adjudicated event"),
    TEXT("CEDECOD", "Event category"),
    DATE("CESTDTC", "Event start date"),
  ],
  // Questionnaire scores, one per scored test per visit the questionnaire
  // is scheduled at.
  QS: [
    SRC,
    SUBJ,
    NUM("VISITNUM", "Protocol visit number"),
    TEXT("VISIT", "Visit name"),
    DATE("QSDTC", "Questionnaire date"),
    TEXT("QSTESTCD", "Questionnaire test code"),
    TEXT("QSCAT", "Questionnaire"),
    NUM("QSORRES", "Score"),
  ],
};

function dataset(
  domain: Domain,
  rows: readonly Row[],
  extra: readonly VariableMeta[] = []
): Dataset {
  const variables = [...COLUMNS[domain], ...extra];
  const columns: Record<string, CellValue[]> = {};
  for (const variable of variables) {
    columns[variable.name] = rows.map((row) => row[variable.name] ?? null);
  }
  return {
    name: domain,
    label: `Synthetic collected ${domain} source data`,
    layer: "collected",
    class: "Collected",
    keys: ["USUBJID", "SRCID"],
    variables,
    columns,
    rowCount: rows.length,
  };
}

function sourceId(
  studyId: string,
  domain: Domain,
  subjectNumber: number,
  suffix: string
): string {
  return `${studyId}:${domain}:${String(subjectNumber).padStart(4, "0")}:${suffix}`;
}

function measuredValue(
  testCode: string,
  armIndex: number,
  fraction: number,
  baseline: number,
  noise: number
): number {
  switch (testCode) {
    case "SYSBP":
      return round(baseline - [2, 8, 13][armIndex] * fraction + noise * 4);
    case "DIABP":
      return round(88 - [1, 4, 7][armIndex] * fraction + noise * 2);
    case "PULSE":
      return round(72 + noise * 6);
    case "WEIGHT":
      return round(78 - fraction + noise * 1.5);
    case "ALT":
      return round(24 + armIndex * fraction * 2 + noise * 3);
    case "AST":
      return round(23 + armIndex * fraction * 1.5 + noise * 3);
    case "BILI":
      return round(10 + noise * 1.5);
    case "CREAT":
      return round(82 + armIndex * fraction + noise * 4);
    case "GLUC":
      return round(5.2 + noise * 0.4);
    case "HGB":
      return round(142 + noise * 4);
    case "WBC":
      return round(6.5 + noise * 0.9);
    case "PLAT":
      return round(245 + noise * 20);
    default:
      return round(100 + noise * 5);
  }
}

/**
 * The machine-read intervals of one 12-lead ECG, in ms and beats/min. The
 * heart rate is drawn first and the RR interval follows from it, so the two
 * agree. QT is the subject's Fridericia-corrected QT, plus a small arm
 * effect that grows over treatment, uncorrected with that RR interval.
 */
function ecgValues(
  armIndex: number,
  fraction: number,
  qtcBaseline: number,
  draws: (key: string) => number
): Readonly<Record<string, number>> {
  const noise = (key: string) => (draws(key) - 0.5) * 2;
  const heartRate = Math.round(66 + noise("hr") * 8);
  const rr = Math.round(60000 / heartRate);
  const qtc = qtcBaseline + [0, 2, 5][armIndex] * fraction + noise("qt") * 6;
  return {
    EGHRMN: heartRate,
    RRAG: rr,
    PRAG: Math.round(158 + noise("pr") * 14),
    QRSAG: Math.round(92 + noise("qrs") * 7),
    QTAG: Math.round(qtc * Math.cbrt(rr / 1000)),
  };
}

/**
 * Permuted-block allocation within strata, by the declared ratio. Each
 * stratum fills its own blocks in randomisation order; a block holds every
 * arm twice its ratio share, shuffled by a draw keyed to the stratum and the
 * block's number, so an earlier subject's arm never depends on a later one.
 */
function permutedBlocks(
  seed: number,
  studyId: string,
  armIds: readonly string[],
  randomisation: RandomisationDefinition
): (stratum: readonly string[]) => number {
  const template = armIds.flatMap((id, armIndex) =>
    Array.from({ length: 2 * randomisation.ratio[id] }, () => armIndex)
  );
  const filled = new Map<string, number>();
  return (stratum) => {
    const key = stratum.join("|");
    const position = filled.get(key) ?? 0;
    filled.set(key, position + 1);
    const blockNumber = Math.floor(position / template.length);
    const block = [...template];
    for (let i = block.length - 1; i > 0; i -= 1) {
      const j = Math.floor(
        uniformAt(
          `${seed}|${studyId}|RAND|block|${key}|${blockNumber}|${i}`,
          0
        ) *
          (i + 1)
      );
      [block[i], block[j]] = [block[j], block[i]];
    }
    return block[position % template.length];
  };
}

/**
 * Generates CDASH-shaped source datasets. `nSubjects` counts screened people;
 * only randomized people have RAND and EX records. Every stochastic choice is
 * keyed by study, seed, subject, domain and field, so extending a run preserves
 * all previously generated subjects byte for byte.
 */
export function generateCollectedData(
  definition: StudyDefinition,
  options: PipelineOptions
): readonly Dataset[] {
  const { studyId, design } = definition;
  if (design.arms.length === 0 || design.visits.length === 0) {
    throw new RangeError(
      "Synthetic collection needs at least one arm and one planned visit."
    );
  }
  const rows: Record<Domain, Row[]> = {
    DM: [],
    RAND: [],
    SV: [],
    EX: [],
    VS: [],
    LB: [],
    EG: [],
    AE: [],
    CM: [],
    MH: [],
    IE: [],
    DS: [],
    CO: [],
    CE: [],
    QS: [],
  };
  const lastDay = Math.max(...design.visits.map((visit) => visit.targetDay));
  const firstDay = Math.min(...design.visits.map((visit) => visit.targetDay));
  const screeningVisit = design.visits.find(
    (visit) => visit.targetDay === firstDay
  )!;
  const activityById = new Map(
    design.activities.map((activity) => [activity.id, activity])
  );
  // A study whose clinical events committee adjudicates outcomes follows
  // each subject to death and collects the committee's events.
  const adjudicated = design.schedule.some(
    (cell) => activityById.get(cell.activityId)?.domain === "CE"
  );
  // A study that schedules a questionnaire collects its scores.
  const collectsQs = design.schedule.some(
    (cell) => activityById.get(cell.activityId)?.domain === "QS"
  );
  const activityIdsByVisit = new Map<string, string[]>();
  for (const cell of design.schedule) {
    const ids = activityIdsByVisit.get(cell.visitId) ?? [];
    ids.push(cell.activityId);
    activityIdsByVisit.set(cell.visitId, ids);
  }

  // With no declared ratio, each subject's arm is an equal-share draw, which
  // keeps a study without the extension exactly as it was generated.
  const randomisation = design.randomisation;
  const strata = randomisation?.strata ?? [];
  const allocate = randomisation
    ? permutedBlocks(
        options.seed,
        studyId,
        design.arms.map((arm) => arm.id),
        randomisation
      )
    : null;

  for (let number = 1; number <= options.nSubjects; number += 1) {
    const subject = `${studyId}-${String(number).padStart(4, "0")}`;
    const pick = (domain: string, key: string) =>
      draw(options.seed, studyId, subject, domain, key);
    const baselineDate = addDays(BASE_DATE, (number - 1) * 2);
    const consentDate = addDays(baselineDate, offset(firstDay) - 3);
    const screenFailure = pick("DM", "screen-failure") < 0.09;
    const randomized = !screenFailure;
    // A screen failure did not meet one protocol criterion, sometimes two.
    // These draws are keyed to IE, so no other domain's draws move.
    const criteria = design.eligibilityCriteria;
    const failedCriteria = new Set<number>();
    if (screenFailure && criteria.length > 0) {
      const first = Math.floor(pick("IE", "criterion") * criteria.length);
      failedCriteria.add(first);
      if (criteria.length > 1 && pick("IE", "second") < 0.15)
        failedCriteria.add(
          (first +
            1 +
            Math.floor(
              pick("IE", "second-criterion") * (criteria.length - 1)
            )) %
            criteria.length
        );
    }
    const failedEvidence = new Set<Evidence>(
      [...failedCriteria].flatMap((index) => {
        const id = criteria[index].id;
        return id in FAILED_CRITERION_EVIDENCE
          ? [
              FAILED_CRITERION_EVIDENCE[
                id as keyof typeof FAILED_CRITERION_EVIDENCE
              ],
            ]
          : [];
      })
    );
    // The stratum is recorded at randomisation. The protocol gives no
    // prevalence for the levels, so each is equally likely.
    const stratum = randomized
      ? strata.map(
          (factor) =>
            factor.levels[
              Math.floor(
                pick("RAND", `stratum:${factor.adslVariable}`) *
                  factor.levels.length
              )
            ]
        )
      : [];
    const armIndex = !randomized
      ? -1
      : allocate
        ? allocate(stratum)
        : Math.floor(pick("RAND", "arm") * design.arms.length);
    const arm = randomized ? design.arms[armIndex] : null;
    const stopsEarly =
      randomized && lastDay > 2 && pick("DS", "early-stop") < 0.11;
    const plannedStopDay = stopsEarly
      ? clamp(
          15 + Math.floor(pick("DS", "stop-day") * Math.max(1, lastDay - 20)),
          2,
          lastDay - 1
        )
      : lastDay;
    // A death ends follow-up when it comes before the subject would have
    // left the study; one after it is not observed. Its draws are keyed to
    // DS, and drawn only in an adjudicated study, so no other study moves.
    const drawnDeathDay =
      randomized &&
      adjudicated &&
      lastDay > 2 &&
      pick("DS", "death") < DEATH_SHARE
        ? 2 + Math.floor(pick("DS", "death-day") * (lastDay - 2))
        : null;
    const deathDay =
      drawnDeathDay !== null && drawnDeathDay <= plannedStopDay
        ? drawnDeathDay
        : null;
    const discontinued = stopsEarly && deathDay === null;
    const stopDay = deathDay ?? plannedStopDay;
    const stopDate = addDays(baselineDate, offset(stopDay));
    const deathDate = deathDay === null ? null : stopDate;
    const age = failedEvidence.has("age")
      ? 76 + Math.floor(pick("IE", "age") * 7)
      : 25 + Math.floor(pick("DM", "age") * 51);
    const sex = pick("DM", "sex") < 0.5 ? "F" : "M";
    const site = SITES[Math.floor(pick("DM", "site") * SITES.length)];
    const raceDraw = pick("DM", "race");
    const race = RACES.find(({ upTo }) => raceDraw < upTo)!.value;
    rows.DM.push({
      SRCID: sourceId(studyId, "DM", number, "1"),
      USUBJID: subject,
      SITEID: site.siteId,
      COUNTRY: site.country,
      CONSENTDTC: consentDate,
      AGE: age,
      SEX: sex,
      RACE: race,
      SCREENFL: screenFailure ? "FAIL" : "PASS",
      RANDFL: randomized ? "Y" : "N",
    });
    rows.DS.push({
      SRCID: sourceId(studyId, "DS", number, "consent"),
      USUBJID: subject,
      DSSTDTC: consentDate,
      DSDECOD: "INFORMED CONSENT OBTAINED",
      DSSCAT: "PROTOCOL MILESTONE",
    });

    if (arm) {
      rows.RAND.push({
        SRCID: sourceId(studyId, "RAND", number, "1"),
        USUBJID: subject,
        RANDDTC: baselineDate,
        ARMCD: arm.armCode,
        ARM: arm.name,
        ...Object.fromEntries(
          strata.map((factor, idx) => [factor.adslVariable, stratum[idx]])
        ),
      });
      rows.EX.push({
        SRCID: sourceId(studyId, "EX", number, "1"),
        USUBJID: subject,
        EXTRT: arm.name,
        EXDOSE: 1,
        EXDOSU: "TABLET",
        EXSTDTC: baselineDate,
        EXENDTC: stopDate,
      });
      rows.DS.push({
        SRCID: sourceId(studyId, "DS", number, "randomized"),
        USUBJID: subject,
        DSSTDTC: baselineDate,
        DSDECOD: "RANDOMIZED",
        DSSCAT: "PROTOCOL MILESTONE",
      });
    }

    const finalDate = screenFailure
      ? addDays(baselineDate, offset(firstDay))
      : stopDate;
    rows.DS.push({
      SRCID: sourceId(studyId, "DS", number, "final"),
      USUBJID: subject,
      DSSTDTC: finalDate,
      DSDECOD: screenFailure
        ? "SCREEN FAILURE"
        : deathDate !== null
          ? "DEATH"
          : discontinued
            ? "ADVERSE EVENT"
            : "COMPLETED",
      DSSCAT: "DISPOSITION EVENT",
    });

    const baselineSbp = 142 + (pick("VS", "baseline-sbp") - 0.5) * 12;
    const qtcBaseline = 405 + (pick("EG", "baseline-qtc") - 0.5) * 30;
    let screeningDate = addDays(baselineDate, offset(firstDay));
    for (const visit of design.visits) {
      if (screenFailure && visit.targetDay > 0) continue;
      const visitKey = visit.id;
      const missed =
        randomized &&
        visit.targetDay > 1 &&
        visit.targetDay < lastDay &&
        pick("SV", `${visitKey}:missed`) < 0.06;
      const outOfWindow =
        !missed &&
        visit.targetDay > 1 &&
        pick("SV", `${visitKey}:out-of-window`) < 0.07;
      const inWindow =
        Math.floor(
          pick("SV", `${visitKey}:jitter`) *
            (visit.windowBefore + visit.windowAfter + 1)
        ) - visit.windowBefore;
      const shift = outOfWindow ? visit.windowAfter + 2 : inWindow;
      const actualOffset = Math.max(
        offset(firstDay) - 2,
        offset(visit.targetDay) + shift
      );
      const actualDay = actualOffset >= 0 ? actualOffset + 1 : actualOffset;
      const visitDate = missed ? null : addDays(baselineDate, actualOffset);
      // Nothing is collected after a death.
      if (
        deathDate !== null &&
        (visitDate !== null ? visitDate > deathDate : visit.targetDay > stopDay)
      )
        continue;
      if (visit.targetDay === firstDay && visitDate) screeningDate = visitDate;
      rows.SV.push({
        SRCID: sourceId(studyId, "SV", number, visitKey),
        USUBJID: subject,
        VISITNUM: visit.visitNum,
        VISIT: visit.name,
        PLANDY: visit.targetDay,
        ACTDY: missed ? null : actualDay,
        SVDTC: visitDate,
        STATUS: missed ? "MISSED" : outOfWindow ? "OUT OF WINDOW" : "COMPLETED",
      });
      // A missed visit carries the site's reason on the comments form. Its
      // draw is keyed to CO, so no other domain's draws move.
      if (missed)
        rows.CO.push({
          SRCID: sourceId(studyId, "CO", number, `SV:${visitKey}`),
          USUBJID: subject,
          RSRCID: sourceId(studyId, "SV", number, visitKey),
          COVAL:
            MISSED_VISIT_REASONS[
              Math.floor(
                pick("CO", `${visitKey}:reason`) * MISSED_VISIT_REASONS.length
              )
            ],
        });
      if (!visitDate) continue;

      const fraction = clamp(
        offset(visit.targetDay) / Math.max(1, offset(lastDay)),
        0,
        1
      );
      const activities = (activityIdsByVisit.get(visit.id) ?? [])
        .map((id) => activityById.get(id))
        .filter((activity) => activity !== undefined);
      for (const activity of activities) {
        if (activity.domain === "EG") {
          const values = ecgValues(
            Math.max(0, armIndex),
            fraction,
            qtcBaseline,
            (key) => pick("EG", `${visitKey}:${key}`)
          );
          for (const assessment of activity.assessments) {
            const value = values[assessment.testCode];
            if (value === undefined) continue;
            rows.EG.push({
              SRCID: sourceId(
                studyId,
                "EG",
                number,
                `${visitKey}:${assessment.testCode}`
              ),
              USUBJID: subject,
              VISITNUM: visit.visitNum,
              VISIT: visit.name,
              EGDTC: visitDate,
              EGTESTCD: assessment.testCode,
              EGORRES: value,
              EGORRESU: assessment.unit ?? null,
            });
          }
          continue;
        }
        if (activity.domain === "QS") {
          // A score starts from the subject's baseline and improves as they
          // recover from the procedure. Its draws are keyed to QS, so no
          // other domain's draws move.
          for (const assessment of activity.assessments) {
            const score = QUESTIONNAIRE_SCORES[assessment.testCode];
            if (!score) continue;
            const key = `${visitKey}:${assessment.testCode}`;
            const baseline =
              score.baseline +
              (pick("QS", `${assessment.testCode}:baseline`) - 0.5) *
                2 *
                score.spread;
            const recovered =
              visit.targetDay <= 1
                ? 0
                : Math.min(1, (visit.targetDay - 1) / score.recoveryDays);
            const noise = (pick("QS", key) - 0.5) * 2 * score.noise;
            rows.QS.push({
              SRCID: sourceId(studyId, "QS", number, key),
              USUBJID: subject,
              VISITNUM: visit.visitNum,
              VISIT: visit.name,
              QSDTC: visitDate,
              QSTESTCD: assessment.testCode,
              QSCAT: assessment.category ?? score.category,
              QSORRES: clamp(
                Math.round(baseline + score.gain * recovered + noise),
                score.min,
                score.max
              ),
            });
          }
          continue;
        }
        if (activity.domain !== "VS" && activity.domain !== "LB") continue;
        for (const assessment of activity.assessments) {
          const key = `${visitKey}:${assessment.testCode}`;
          const noise = (pick(activity.domain, `${key}:noise`) - 0.5) * 2;
          const abnormal =
            activity.domain === "LB" && pick("LB", `${key}:abnormal`) < 0.025;
          let value = measuredValue(
            assessment.testCode,
            Math.max(0, armIndex),
            fraction,
            baselineSbp,
            noise
          );
          if (abnormal) value = round(value * 1.8);
          const failedHere =
            visit.targetDay === firstDay &&
            ((assessment.testCode === "SYSBP" &&
              failedEvidence.has("systolic")) ||
              (assessment.testCode === "CREAT" &&
                failedEvidence.has("creatinine")));
          if (failedHere && assessment.testCode === "SYSBP")
            value =
              pick("IE", "systolic-side") < 0.5
                ? 130 + Math.floor(pick("IE", "systolic") * 9)
                : 160 + Math.floor(pick("IE", "systolic") * 11);
          if (failedHere && assessment.testCode === "CREAT")
            value = 200 + Math.floor(pick("IE", "creatinine") * 61);
          if (activity.domain === "VS") {
            rows.VS.push({
              SRCID: sourceId(studyId, "VS", number, key),
              USUBJID: subject,
              VISITNUM: visit.visitNum,
              VISIT: visit.name,
              VSDTC: visitDate,
              VSTESTCD: assessment.testCode,
              VSORRES: value,
              VSORRESU: assessment.unit ?? null,
            });
          } else {
            rows.LB.push({
              SRCID: sourceId(studyId, "LB", number, key),
              USUBJID: subject,
              VISITNUM: visit.visitNum,
              VISIT: visit.name,
              LBDTC: visitDate,
              LBTESTCD: assessment.testCode,
              LBORRES: value,
              LBORRESU: assessment.unit ?? null,
              LBNRIND: abnormal || failedHere ? "HIGH" : "NORMAL",
            });
          }
        }
      }
    }

    const unscheduledDay =
      2 + Math.floor(pick("SV", "unscheduled-day") * Math.max(1, lastDay - 2));
    if (
      randomized &&
      pick("SV", "unscheduled") < 0.08 &&
      (deathDay === null || unscheduledDay <= deathDay)
    ) {
      const day = unscheduledDay;
      rows.SV.push({
        SRCID: sourceId(studyId, "SV", number, "unscheduled"),
        USUBJID: subject,
        VISITNUM: 99,
        VISIT: "UNSCHEDULED",
        PLANDY: null,
        ACTDY: day,
        SVDTC: addDays(baselineDate, offset(day)),
        STATUS: "UNSCHEDULED",
      });
    }

    // A long-term medication's start, and the condition it treats, are
    // remembered to the month only.
    const startedYearsAgo = (key: string, domain = "CM") => {
      const years = 1 + Math.floor(pick(domain, `${key}:years`) * 6);
      const month = 1 + Math.floor(pick(domain, `${key}:month`) * 12);
      return `${Number(consentDate.slice(0, 4)) - years}-${String(month).padStart(2, "0")}`;
    };
    // Whether a subject takes each medication is its own draw, so medical
    // history can name the condition behind it even for a screen failure,
    // whose medications are never recorded.
    const washedOut = pick("CM", "washout") < 0.3;
    const takes = (regimen: (typeof BACKGROUND_MEDICATIONS)[number]) =>
      pick("CM", regimen.reported.toLowerCase()) < regimen.share;

    if (randomized) {
      const predose = !discontinued && pick("AE", "predose") < 0.07;
      const hasAe = predose || discontinued || pick("AE", "postdose") < 0.32;
      if (hasAe) {
        const term =
          AE_DICTIONARY[Math.floor(pick("AE", "term") * AE_DICTIONARY.length)];
        const day = predose
          ? -2
          : 2 + Math.floor(pick("AE", "onset-day") * Math.max(1, stopDay - 2));
        const fullStart = addDays(baselineDate, offset(day));
        const partial = !predose && pick("AE", "partial-date") < 0.12;
        const serious = pick("AE", "serious") < 0.08;
        const reason = pick("AE", "seriousness");
        const met = SERIOUSNESS_REASONS.find(({ upTo }) => reason < upTo)!;
        rows.AE.push({
          SRCID: sourceId(studyId, "AE", number, "1"),
          USUBJID: subject,
          AEBODSYS: term.soc,
          AEDECOD: term.pt,
          AESTDTC: partial ? fullStart.slice(0, 7) : fullStart,
          AEENDTC: discontinued
            ? stopDate
            : deathDate !== null && addDays(fullStart, 3) > deathDate
              ? deathDate
              : addDays(fullStart, 3),
          AESER: serious ? "Y" : "N",
          AEREL: predose ? "NOT RELATED" : "RELATED",
          AEACN: discontinued ? "DRUG WITHDRAWN" : "DOSE NOT CHANGED",
          // Asked only after a "Yes" to serious, so left blank otherwise.
          ...Object.fromEntries(
            SERIOUSNESS_CRITERIA.map(([name]) => [
              name,
              serious ? (name === met.name ? "Y" : "N") : null,
            ])
          ),
        });
        // The site explains an early stop on the comments form, against
        // the subject's final disposition record.
        if (discontinued)
          rows.CO.push({
            SRCID: sourceId(studyId, "CO", number, "DS:final"),
            USUBJID: subject,
            RSRCID: sourceId(studyId, "DS", number, "final"),
            COVAL: `Study treatment stopped because of ${term.pt.toLowerCase()}.`,
          });
      }

      // The committee's adjudicated events fall between the procedure and
      // the end of follow-up, the death included. Their draws are keyed to
      // CE, so no other domain's draws move.
      if (adjudicated) {
        const events = ADJUDICATED_EVENTS.flatMap((event) => {
          if (pick("CE", event.key) >= event.share) return [];
          const count =
            pick("CE", `${event.key}:again`) < event.repeatShare ? 2 : 1;
          return Array.from({ length: count }, (_, index) => ({
            event,
            key: `${event.key}:${index + 1}`,
            day:
              2 +
              Math.floor(
                pick("CE", `${event.key}:${index + 1}:day`) *
                  Math.max(1, stopDay - 1)
              ),
          }));
        }).sort((a, b) => a.day - b.day || a.key.localeCompare(b.key));
        for (const { event, key, day } of events)
          rows.CE.push({
            SRCID: sourceId(studyId, "CE", number, key),
            USUBJID: subject,
            CETERM: event.term,
            CEDECOD: event.decod,
            CESTDTC: addDays(baselineDate, offset(day)),
          });
      }

      // Medications are keyed by their own draws, so adding them leaves
      // every other domain as it was generated.
      const medication = (key: string, regimen: Regimen, fields: Row) =>
        rows.CM.push({
          SRCID: sourceId(studyId, "CM", number, key),
          USUBJID: subject,
          CMTRT: regimen.reported,
          CMCAT: "GENERAL MEDICATION",
          CMINDC: regimen.indication,
          CMDOSE: regimen.dose,
          CMDOSU: "mg",
          CMDOSFRQ: regimen.frequency,
          CMROUTE: "ORAL",
          CMENDTC: null,
          CMONGO: null,
          CMAENO: null,
          ...fields,
        });
      if (washedOut)
        medication("washout", WASHED_OUT, {
          CMSTDTC: startedYearsAgo("washout"),
          CMENDTC: addDays(baselineDate, -7),
        });
      for (const background of BACKGROUND_MEDICATIONS) {
        const key = background.reported.toLowerCase();
        if (takes(background))
          medication(key, background, {
            CMSTDTC: startedYearsAgo(key),
            CMONGO: "Y",
          });
      }
      const ae = rows.AE.at(-1);
      const treatment =
        ae?.USUBJID === subject ? AE_TREATMENTS[String(ae.AEDECOD)] : undefined;
      if (ae && treatment && pick("CM", "ae-treatment") < treatment.share)
        medication(
          "ae-1",
          { ...treatment, indication: String(ae.AEDECOD) },
          {
            CMSTDTC: ae.AESTDTC,
            CMENDTC: ae.AEENDTC,
            CMAENO: "1",
          }
        );
      const rescueShare = armIndex === 0 ? 0.15 : 0.06;
      if (!discontinued && stopDay > 22 && pick("CM", "rescue") < rescueShare) {
        const day = 15 + Math.floor(pick("CM", "rescue-day") * (stopDay - 22));
        medication("rescue", RESCUE, {
          CMCAT: "RESCUE MEDICATION",
          CMSTDTC: addDays(baselineDate, offset(day)),
          CMONGO: "Y",
        });
      }
    }

    // Medical history is taken at the screening visit for every subject who
    // consented. Hypertension is the condition the study enrols; a subject
    // who stopped an antihypertensive for the washout was diagnosed when
    // they started it. The conditions behind long-term medications start
    // with them, and are ongoing at screening.
    const history = (key: string, fields: Row) =>
      rows.MH.push({
        SRCID: sourceId(studyId, "MH", number, key),
        USUBJID: subject,
        MHCAT: "GENERAL MEDICAL HISTORY",
        MHDTC: screeningDate,
        MHENDTC: null,
        MHONGO: "Y",
        ...fields,
      });
    history("primary", {
      MHTERM: condition(WASHED_OUT.indication),
      MHCAT: "PRIMARY DIAGNOSIS",
      MHSTDTC: washedOut
        ? startedYearsAgo("washout")
        : startedYearsAgo("hypertension", "MH"),
    });
    for (const background of BACKGROUND_MEDICATIONS) {
      const treats = HISTORY_DICTIONARY.some(
        (entry) => entry.reported === background.indication
      );
      if (!treats || !takes(background)) continue;
      const key = background.reported.toLowerCase();
      history(key, {
        MHTERM: background.indication,
        MHSTDTC: startedYearsAgo(key),
      });
    }
    for (const past of RESOLVED_CONDITIONS) {
      const key = past.reported.toLowerCase();
      if (pick("MH", key) >= past.share) continue;
      const [from, to] = past.years;
      const year =
        Number(consentDate.slice(0, 4)) -
        from -
        Math.floor(pick("MH", `${key}:years`) * (to - from + 1));
      const month = String(
        1 + Math.floor(pick("MH", `${key}:month`) * 12)
      ).padStart(2, "0");
      // An old episode is remembered to the year; a recent one to the month.
      const when = from >= 10 ? String(year) : `${year}-${month}`;
      history(key, {
        MHTERM: past.reported,
        MHSTDTC: when,
        MHENDTC: when,
        MHONGO: "N",
      });
    }

    // The eligibility CRF records only the criteria a subject did not meet,
    // at the screening visit, so an enrolled subject has no IE record.
    for (const index of [...failedCriteria].sort((a, b) => a - b)) {
      const criterion = criteria[index];
      const testCode = criterionTestCode(criterion);
      rows.IE.push({
        SRCID: sourceId(studyId, "IE", number, testCode),
        USUBJID: subject,
        VISITNUM: screeningVisit.visitNum,
        VISIT: screeningVisit.name,
        IEDTC: screeningDate,
        IETESTCD: testCode,
        IECAT: criterion.category,
      });
    }
  }

  return (
    [
      "DM",
      "RAND",
      "SV",
      "EX",
      "VS",
      "LB",
      "EG",
      "AE",
      "CM",
      "DS",
      "MH",
      "IE",
      "CO",
      // Collected only in a study that adjudicates outcomes.
      ...(adjudicated ? (["CE"] as const) : []),
      ...(collectsQs ? (["QS"] as const) : []),
    ] as const
  ).map((domain) =>
    dataset(
      domain,
      rows[domain],
      domain === "RAND"
        ? strata.map((factor) => TEXT(factor.adslVariable, factor.factor))
        : []
    )
  );
}
