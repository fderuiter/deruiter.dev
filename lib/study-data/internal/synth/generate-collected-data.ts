/** Seeded, schedule-driven synthetic source data for the study-data pipeline. */
import { uniformAt } from "@/lib/utils/prng";
import type {
  CellValue,
  Dataset,
  PipelineOptions,
  StudyDefinition,
  VariableMeta,
} from "../../types";

type Row = Record<string, CellValue>;
type Domain = "DM" | "RAND" | "SV" | "EX" | "VS" | "LB" | "AE" | "DS";

const BASE_DATE = "2030-01-01";
/**
 * A fictional four-term adverse event dictionary. It borrows MedDRA-style
 * names and each term's primary system organ class, but it is not MedDRA
 * and carries no MedDRA codes or version.
 */
const AE_TERMS = [
  { soc: "Nervous system disorders", pt: "Headache" },
  { soc: "Gastrointestinal disorders", pt: "Nausea" },
  { soc: "General disorders", pt: "Fatigue" },
  { soc: "Nervous system disorders", pt: "Dizziness" },
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
  ],
  DS: [
    SRC,
    SUBJ,
    DATE("DSSTDTC", "Disposition event date"),
    TEXT("DSDECOD", "Disposition event"),
    TEXT("DSSCAT", "Disposition category"),
  ],
};

function dataset(domain: Domain, rows: readonly Row[]): Dataset {
  const variables = COLUMNS[domain];
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
    AE: [],
    DS: [],
  };
  const lastDay = Math.max(...design.visits.map((visit) => visit.targetDay));
  const firstDay = Math.min(...design.visits.map((visit) => visit.targetDay));
  const activityById = new Map(
    design.activities.map((activity) => [activity.id, activity])
  );
  const activityIdsByVisit = new Map<string, string[]>();
  for (const cell of design.schedule) {
    const ids = activityIdsByVisit.get(cell.visitId) ?? [];
    ids.push(cell.activityId);
    activityIdsByVisit.set(cell.visitId, ids);
  }

  for (let number = 1; number <= options.nSubjects; number += 1) {
    const subject = `${studyId}-${String(number).padStart(4, "0")}`;
    const pick = (domain: string, key: string) =>
      draw(options.seed, studyId, subject, domain, key);
    const baselineDate = addDays(BASE_DATE, (number - 1) * 2);
    const consentDate = addDays(baselineDate, offset(firstDay) - 3);
    const screenFailure = pick("DM", "screen-failure") < 0.09;
    const randomized = !screenFailure;
    const armIndex = randomized
      ? Math.floor(pick("RAND", "arm") * design.arms.length)
      : -1;
    const arm = randomized ? design.arms[armIndex] : null;
    const discontinued =
      randomized && lastDay > 2 && pick("DS", "early-stop") < 0.11;
    const stopDay = discontinued
      ? clamp(
          15 + Math.floor(pick("DS", "stop-day") * Math.max(1, lastDay - 20)),
          2,
          lastDay - 1
        )
      : lastDay;
    const stopDate = addDays(baselineDate, offset(stopDay));
    const age = 25 + Math.floor(pick("DM", "age") * 51);
    const sex = pick("DM", "sex") < 0.5 ? "F" : "M";
    const site = SITES[Math.floor(pick("DM", "site") * SITES.length)];
    rows.DM.push({
      SRCID: sourceId(studyId, "DM", number, "1"),
      USUBJID: subject,
      SITEID: site.siteId,
      COUNTRY: site.country,
      CONSENTDTC: consentDate,
      AGE: age,
      SEX: sex,
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
        : discontinued
          ? "ADVERSE EVENT"
          : "COMPLETED",
      DSSCAT: "DISPOSITION EVENT",
    });

    const baselineSbp = 142 + (pick("VS", "baseline-sbp") - 0.5) * 12;
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
              LBNRIND: abnormal ? "HIGH" : "NORMAL",
            });
          }
        }
      }
    }

    if (randomized && pick("SV", "unscheduled") < 0.08) {
      const day =
        2 +
        Math.floor(pick("SV", "unscheduled-day") * Math.max(1, lastDay - 2));
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

    if (randomized) {
      const predose = !discontinued && pick("AE", "predose") < 0.07;
      const hasAe = predose || discontinued || pick("AE", "postdose") < 0.32;
      if (hasAe) {
        const term = AE_TERMS[Math.floor(pick("AE", "term") * AE_TERMS.length)];
        const day = predose
          ? -2
          : 2 + Math.floor(pick("AE", "onset-day") * Math.max(1, stopDay - 2));
        const fullStart = addDays(baselineDate, offset(day));
        const partial = !predose && pick("AE", "partial-date") < 0.12;
        rows.AE.push({
          SRCID: sourceId(studyId, "AE", number, "1"),
          USUBJID: subject,
          AEBODSYS: term.soc,
          AEDECOD: term.pt,
          AESTDTC: partial ? fullStart.slice(0, 7) : fullStart,
          AEENDTC: discontinued ? stopDate : addDays(fullStart, 3),
          AESER: pick("AE", "serious") < 0.08 ? "Y" : "N",
          AEREL: predose ? "NOT RELATED" : "RELATED",
          AEACN: discontinued ? "DRUG WITHDRAWN" : "DOSE NOT CHANGED",
        });
      }
    }
  }

  return (["DM", "RAND", "SV", "EX", "VS", "LB", "AE", "DS"] as const).map(
    (domain) => dataset(domain, rows[domain])
  );
}
