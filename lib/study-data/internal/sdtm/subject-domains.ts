/** SDTMIG 3.4 subject tabulations from the separate synthetic collection layer. */
import type {
  CellValue,
  Dataset,
  StudyDefinition,
  VariableMeta,
  VariableOrigin,
  VariableRole,
} from "../../types";
import { sdtmCodelist } from "./codelists";
import type { SdtmMethodId } from "./methods";
import { toStandardUnit } from "./units";

type Row = Record<string, CellValue>;
type SubjectDomain = "DM" | "SV" | "EX" | "AE" | "VS" | "LB" | "DS" | "SUPPDM";
interface ColumnSpec {
  readonly name: string;
  readonly label: string;
  readonly role: VariableRole;
  readonly type?: VariableMeta["type"];
  readonly origin: VariableOrigin;
  readonly method?: SdtmMethodId;
  readonly source?: string;
}
interface DomainSpec {
  readonly label: string;
  readonly class: string;
  readonly structure: string;
  readonly keys: readonly string[];
  readonly columns: readonly ColumnSpec[];
}
const assigned = (
  name: string,
  label: string,
  role: VariableRole = "Identifier"
): ColumnSpec => ({ name, label, role, origin: "Assigned" });
const collected = (
  name: string,
  label: string,
  source: string,
  role: VariableRole = "Topic",
  type?: VariableMeta["type"]
): ColumnSpec => ({ name, label, role, type, origin: "Collected", source });
const derived = (
  name: string,
  label: string,
  method: SdtmMethodId,
  role: VariableRole = "Timing",
  type?: VariableMeta["type"]
): ColumnSpec => ({ name, label, role, type, origin: "Derived", method });
const COMMON = [
  assigned("STUDYID", "Study Identifier"),
  assigned("DOMAIN", "Domain Abbreviation"),
  assigned("USUBJID", "Unique Subject Identifier"),
] as const;
const SEQ = (domain: string) =>
  derived(
    `${domain}SEQ`,
    "Sequence Number",
    "SOURCE_ORDER",
    "Identifier",
    "integer"
  );
const EPOCH = derived("EPOCH", "Epoch", "ACTUAL_ELEMENT_FROM_TA_TE", "Timing");
const VISITNUM = collected(
  "VISITNUM",
  "Visit Number",
  "SV.VISITNUM",
  "Timing",
  "float"
);
const VISIT = collected("VISIT", "Visit Name", "SV.VISIT", "Timing");
/** The seriousness criteria AE carries, in SDTMIG 3.4 order and labels. */
const AE_SERIOUSNESS_CRITERIA = [
  ["AESCONG", "Congenital Anomaly or Birth Defect"],
  ["AESDISAB", "Persist or Signif Disability/Incapacity"],
  ["AESDTH", "Results in Death"],
  ["AESHOSP", "Requires or Prolongs Hospitalization"],
  ["AESLIFE", "Is Life Threatening"],
  ["AESMIE", "Other Medically Important Serious Event"],
] as const;
const SPECS: Record<SubjectDomain, DomainSpec> = {
  DM: {
    label: "Demographics",
    class: "Special Purpose",
    structure: "One record per subject",
    keys: ["STUDYID", "USUBJID"],
    columns: [
      ...COMMON,
      collected("SUBJID", "Subject Identifier", "DM.USUBJID", "Identifier"),
      collected(
        "RFICDTC",
        "Informed Consent Date",
        "DM.CONSENTDTC",
        "Timing",
        "date"
      ),
      derived(
        "RFSTDTC",
        "Subject Reference Start Date",
        "FIRST_EXPOSURE",
        "Timing",
        "date"
      ),
      derived(
        "RFENDTC",
        "Subject Reference End Date",
        "LAST_EXPOSURE",
        "Timing",
        "date"
      ),
      derived(
        "RFXSTDTC",
        "Date of First Study Treatment",
        "FIRST_EXPOSURE",
        "Timing",
        "date"
      ),
      derived(
        "RFXENDTC",
        "Date of Last Study Treatment",
        "LAST_EXPOSURE",
        "Timing",
        "date"
      ),
      derived(
        "DTHDTC",
        "Date/Time of Death",
        "DEATH_DATE",
        "Record Qualifier",
        "date"
      ),
      derived("DTHFL", "Subject Death Flag", "DEATH_FLAG", "Record Qualifier"),
      collected(
        "SITEID",
        "Study Site Identifier",
        "DM.SITEID",
        "Record Qualifier"
      ),
      collected("AGE", "Age", "DM.AGE", "Record Qualifier", "integer"),
      assigned("AGEU", "Age Units", "Record Qualifier"),
      collected("SEX", "Sex", "DM.SEX", "Record Qualifier"),
      derived(
        "ARMCD",
        "Planned Arm Code",
        "RANDOMIZATION",
        "Grouping Qualifier"
      ),
      derived(
        "ARM",
        "Description of Planned Arm",
        "RANDOMIZATION",
        "Grouping Qualifier"
      ),
      derived(
        "ACTARMCD",
        "Actual Arm Code",
        "EXPOSURE_ARM",
        "Grouping Qualifier"
      ),
      derived(
        "ACTARM",
        "Description of Actual Arm",
        "EXPOSURE_ARM",
        "Grouping Qualifier"
      ),
      derived(
        "ARMNRS",
        "Reason Arm and/or Actual Arm is Null",
        "ARM_NULL_REASON",
        "Record Qualifier"
      ),
      derived(
        "ACTARMUD",
        "Description of Unplanned Actual Arm",
        "UNPLANNED_ARM",
        "Record Qualifier"
      ),
      collected("COUNTRY", "Country", "DM.COUNTRY", "Record Qualifier"),
    ],
  },
  SV: {
    label: "Subject Visits",
    class: "Special Purpose",
    structure: "One record per actual visit per subject",
    keys: ["STUDYID", "USUBJID", "VISITNUM"],
    columns: [
      ...COMMON,
      VISITNUM,
      VISIT,
      collected("SVSTDTC", "Start Date of Visit", "SV.SVDTC", "Timing", "date"),
      collected("SVENDTC", "End Date of Visit", "SV.SVDTC", "Timing", "date"),
      derived(
        "SVSTDY",
        "Study Day of Start of Visit",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
      EPOCH,
    ],
  },
  EX: {
    label: "Exposure",
    class: "Interventions",
    structure: "One record per constant-dosing interval per subject",
    keys: ["STUDYID", "USUBJID", "EXSEQ"],
    columns: [
      ...COMMON,
      SEQ("EX"),
      collected("EXTRT", "Name of Treatment", "EX.EXTRT"),
      collected("EXDOSE", "Dose", "EX.EXDOSE", "Record Qualifier", "float"),
      derived("EXDOSU", "Dose Units", "CT_UNIT_MAPPING", "Variable Qualifier"),
      collected(
        "EXSTDTC",
        "Start Date of Treatment",
        "EX.EXSTDTC",
        "Timing",
        "date"
      ),
      collected(
        "EXENDTC",
        "End Date of Treatment",
        "EX.EXENDTC",
        "Timing",
        "date"
      ),
      derived(
        "EXSTDY",
        "Study Day of Start of Treatment",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
      EPOCH,
    ],
  },
  AE: {
    label: "Adverse Events",
    class: "Events",
    structure: "One record per adverse event per subject",
    keys: ["STUDYID", "USUBJID", "AESEQ"],
    columns: [
      ...COMMON,
      SEQ("AE"),
      collected("AETERM", "Reported Term for the Adverse Event", "AE.AEDECOD"),
      collected(
        "AEDECOD",
        "Dictionary Derived Term",
        "AE.AEDECOD",
        "Synonym Qualifier"
      ),
      collected(
        "AEBODSYS",
        "Body System or Organ Class",
        "AE.AEBODSYS",
        "Record Qualifier"
      ),
      collected("AESER", "Serious Event", "AE.AESER", "Record Qualifier"),
      derived(
        "AEREL",
        "Causality",
        "CT_RELATIONSHIP_MAPPING",
        "Record Qualifier"
      ),
      collected(
        "AEACN",
        "Action Taken with Study Treatment",
        "AE.AEACN",
        "Record Qualifier"
      ),
      ...AE_SERIOUSNESS_CRITERIA.map(([name, label]) =>
        collected(name, label, `AE.${name}`, "Record Qualifier")
      ),
      collected(
        "AESTDTC",
        "Start Date of Adverse Event",
        "AE.AESTDTC",
        "Timing",
        "date"
      ),
      collected(
        "AEENDTC",
        "End Date of Adverse Event",
        "AE.AEENDTC",
        "Timing",
        "date"
      ),
      derived(
        "AESTDY",
        "Study Day of Start of Adverse Event",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
      EPOCH,
    ],
  },
  VS: {
    label: "Vital Signs",
    class: "Findings",
    structure: "One record per vital sign measurement per visit per subject",
    keys: ["STUDYID", "USUBJID", "VSSEQ"],
    columns: [
      ...COMMON,
      SEQ("VS"),
      collected("VSTESTCD", "Vital Signs Test Short Name", "VS.VSTESTCD"),
      derived(
        "VSTEST",
        "Vital Signs Test Name",
        "USDM_ASSESSMENT",
        "Synonym Qualifier"
      ),
      derived(
        "VSORRES",
        "Result or Finding in Original Units",
        "TEXT_RESULT",
        "Result Qualifier"
      ),
      collected(
        "VSORRESU",
        "Original Units",
        "VS.VSORRESU",
        "Variable Qualifier"
      ),
      derived(
        "VSSTRESC",
        "Character Result in Standard Units",
        "STANDARD_RESULT",
        "Result Qualifier"
      ),
      derived(
        "VSSTRESN",
        "Numeric Result in Standard Units",
        "STANDARD_RESULT",
        "Result Qualifier",
        "float"
      ),
      derived(
        "VSSTRESU",
        "Standard Units",
        "USDM_ASSESSMENT",
        "Variable Qualifier"
      ),
      VISITNUM,
      VISIT,
      collected("VSDTC", "Date of Vital Signs", "VS.VSDTC", "Timing", "date"),
      derived(
        "VSDY",
        "Study Day of Vital Signs",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
      derived(
        "VSLOBXFL",
        "Last Observation Before Exposure Flag",
        "LAST_PRE_DOSE",
        "Record Qualifier"
      ),
      EPOCH,
    ],
  },
  LB: {
    label: "Laboratory Test Results",
    class: "Findings",
    structure: "One record per lab test per visit per subject",
    keys: ["STUDYID", "USUBJID", "LBSEQ"],
    columns: [
      ...COMMON,
      SEQ("LB"),
      collected("LBTESTCD", "Lab Test Short Name", "LB.LBTESTCD"),
      derived(
        "LBTEST",
        "Lab Test Name",
        "USDM_ASSESSMENT",
        "Synonym Qualifier"
      ),
      derived(
        "LBORRES",
        "Result or Finding in Original Units",
        "TEXT_RESULT",
        "Result Qualifier"
      ),
      collected(
        "LBORRESU",
        "Original Units",
        "LB.LBORRESU",
        "Variable Qualifier"
      ),
      derived(
        "LBSTRESC",
        "Character Result in Standard Units",
        "STANDARD_RESULT",
        "Result Qualifier"
      ),
      derived(
        "LBSTRESN",
        "Numeric Result in Standard Units",
        "STANDARD_RESULT",
        "Result Qualifier",
        "float"
      ),
      derived(
        "LBSTRESU",
        "Standard Units",
        "USDM_ASSESSMENT",
        "Variable Qualifier"
      ),
      collected(
        "LBNRIND",
        "Reference Range Indicator",
        "LB.LBNRIND",
        "Record Qualifier"
      ),
      VISITNUM,
      VISIT,
      collected("LBDTC", "Date of Lab Test", "LB.LBDTC", "Timing", "date"),
      derived(
        "LBDY",
        "Study Day of Lab Test",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
      derived(
        "LBLOBXFL",
        "Last Observation Before Exposure Flag",
        "LAST_PRE_DOSE",
        "Record Qualifier"
      ),
      EPOCH,
    ],
  },
  DS: {
    label: "Disposition",
    class: "Events",
    structure:
      "One record per disposition status or protocol milestone per subject",
    keys: ["STUDYID", "USUBJID", "DSSEQ"],
    columns: [
      ...COMMON,
      SEQ("DS"),
      collected("DSTERM", "Reported Term for Disposition", "DS.DSDECOD"),
      collected(
        "DSDECOD",
        "Standardized Disposition Term",
        "DS.DSDECOD",
        "Synonym Qualifier"
      ),
      collected(
        "DSCAT",
        "Category for Disposition",
        "DS.DSSCAT",
        "Record Qualifier"
      ),
      collected(
        "DSSTDTC",
        "Start Date of Disposition Event",
        "DS.DSSTDTC",
        "Timing",
        "date"
      ),
      derived(
        "DSSTDY",
        "Study Day of Disposition Event",
        "STUDY_DAY",
        "Timing",
        "integer"
      ),
      EPOCH,
    ],
  },
  SUPPDM: {
    label: "Supplemental Qualifiers for DM",
    class: "Relationships",
    structure: "One record per supplemental qualifier per subject",
    keys: ["STUDYID", "RDOMAIN", "USUBJID", "QNAM"],
    columns: [
      assigned("STUDYID", "Study Identifier"),
      assigned("RDOMAIN", "Related Domain Abbreviation"),
      assigned("USUBJID", "Unique Subject Identifier"),
      assigned("IDVAR", "Identifying Variable", "Record Qualifier"),
      assigned("IDVARVAL", "Identifying Variable Value", "Record Qualifier"),
      assigned("QNAM", "Qualifier Variable Name", "Topic"),
      assigned("QLABEL", "Qualifier Variable Label", "Synonym Qualifier"),
      collected(
        "QVAL",
        "Data Value",
        "DM.SCREENFL or DM.RANDFL",
        "Result Qualifier"
      ),
      assigned("QORIG", "Origin", "Record Qualifier"),
      assigned("QEVAL", "Evaluator", "Record Qualifier"),
    ],
  },
};

function rows(dataset: Dataset): Row[] {
  return Array.from({ length: dataset.rowCount }, (_, index) =>
    Object.fromEntries(
      dataset.variables.map(({ name }) => [
        name,
        dataset.columns[name]?.[index] ?? null,
      ])
    )
  );
}
function text(value: CellValue): string | null {
  return typeof value === "string" ? value : null;
}
function num(value: CellValue): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
/**
 * A complete calendar date, or null. The round trip rejects dates that do
 * not exist, such as 30 February, which `Date` would otherwise roll over
 * into March and turn into a wrong study day (#2605).
 */
function isoDate(value: CellValue): string | null {
  const valueText = text(value);
  if (!valueText || !/^\d{4}-\d{2}-\d{2}$/.test(valueText)) return null;
  const parsed = new Date(`${valueText}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === valueText
    ? valueText
    : null;
}
function day(date: CellValue, reference: CellValue): number | null {
  const d = isoDate(date);
  const r = isoDate(reference);
  if (!d || !r) return null;
  const diff = Math.round(
    (Date.parse(`${d}T00:00:00Z`) - Date.parse(`${r}T00:00:00Z`)) / 86400000
  );
  return diff >= 0 ? diff + 1 : diff;
}
function table(
  name: SubjectDomain,
  entries: readonly { row: Row; sourceIds: readonly string[] }[]
): Dataset {
  const spec = SPECS[name];
  return {
    name,
    label: spec.label,
    layer: "sdtm",
    class: spec.class,
    structure: spec.structure,
    keys: spec.keys,
    variables: spec.columns.map((column) => ({
      name: column.name,
      label: column.label,
      role: column.role,
      type: column.type ?? "text",
      ...(column.type ? {} : { length: 200 }),
      origin: column.origin,
      ...sdtmCodelist(column.name),
      ...(column.method ? { method: column.method } : {}),
      ...(column.source ? { source: column.source } : {}),
    })),
    columns: Object.fromEntries(
      spec.columns.map(({ name: variable }) => [
        variable,
        entries.map(({ row }) => row[variable] ?? null),
      ])
    ),
    rowCount: entries.length,
    lineage: entries.map(({ sourceIds }) => sourceIds),
  };
}
function numbered(
  name: SubjectDomain,
  entries: readonly { row: Row; sourceIds: readonly string[] }[]
): Dataset {
  const counters = new Map<string, number>();
  return table(
    name,
    entries.map(({ row, sourceIds }) => {
      const subject = text(row.USUBJID) ?? "";
      const next = (counters.get(subject) ?? 0) + 1;
      counters.set(subject, next);
      return { row: { ...row, [`${name}SEQ`]: next }, sourceIds };
    })
  );
}

/** Derive DM, SV, EX, AE, VS, LB, DS and SUPPDM from collected records. */
export function deriveSubjectDomains(
  definition: StudyDefinition,
  collectedDatasets: readonly Dataset[],
  trialDesign: readonly Dataset[]
): readonly Dataset[] {
  const source = new Map(
    collectedDatasets.map((dataset) => [dataset.name, rows(dataset)])
  );
  const get = (name: string) => source.get(name) ?? [];
  const bySubject = (name: string) =>
    new Map(get(name).map((row) => [text(row.USUBJID), row]));
  const randBySubject = bySubject("RAND");
  const exBySubject = bySubject("EX");
  const deathBySubject = new Map(
    get("DS")
      .filter((row) => row.DSDECOD === "DEATH")
      .map((row) => [text(row.USUBJID), row])
  );
  const tv = trialDesign.find((dataset) => dataset.name === "TV");
  const plannedVisits = new Map(
    (tv ? rows(tv) : []).map((row) => [num(row.VISITNUM), row])
  );
  const ta = trialDesign.find((dataset) => dataset.name === "TA");
  const epochs = new Set(
    (ta ? rows(ta) : [])
      .map((row) => text(row.EPOCH))
      .filter((value) => value !== null)
  );
  const sortedEpochs = [...definition.design.epochs]
    .sort((a, b) => a.order - b.order)
    .map((epoch) => epoch.name);
  const epochAt = (
    date: CellValue,
    exposure: Row | undefined
  ): string | null => {
    if (!exposure) return sortedEpochs[0] ?? null;
    const value = isoDate(date);
    if (!value) return null;
    const first = isoDate(exposure.EXSTDTC);
    const last = isoDate(exposure.EXENDTC);
    const candidate =
      !first || value < first
        ? sortedEpochs[0]
        : last && value <= last
          ? sortedEpochs[1]
          : sortedEpochs[2];
    return candidate && epochs.has(candidate) ? candidate : null;
  };
  const visit = (row: Row): Pick<Row, "VISITNUM" | "VISIT"> => {
    const planned = plannedVisits.get(num(row.VISITNUM));
    return {
      VISITNUM: row.VISITNUM ?? null,
      VISIT: planned?.VISIT ?? row.VISIT ?? null,
    };
  };
  const sourceIds = (...records: (Row | undefined)[]): string[] =>
    records.flatMap((record) =>
      text(record?.SRCID ?? null) ? [text(record?.SRCID ?? null)!] : []
    );
  const item = (row: Row, ...records: (Row | undefined)[]) => ({
    row,
    sourceIds: sourceIds(...records),
  });
  const common = (subject: CellValue, domain: string): Row => ({
    STUDYID: definition.studyId,
    DOMAIN: domain,
    USUBJID: subject,
  });
  const dm = get("DM").map((record) => {
    const subject = text(record.USUBJID);
    const rand = randBySubject.get(subject);
    const ex = exBySubject.get(subject);
    const death = deathBySubject.get(subject);
    return item(
      {
        ...common(record.USUBJID, "DM"),
        SUBJID: subject?.split("-").at(-1) ?? null,
        RFICDTC: record.CONSENTDTC,
        RFSTDTC: ex?.EXSTDTC ?? null,
        RFENDTC: ex?.EXENDTC ?? null,
        RFXSTDTC: ex?.EXSTDTC ?? null,
        RFXENDTC: ex?.EXENDTC ?? null,
        DTHDTC: death?.DSSTDTC ?? null,
        DTHFL: death ? "Y" : null,
        SITEID: record.SITEID,
        AGE: record.AGE,
        AGEU: "YEARS",
        SEX: record.SEX,
        // A subject is left unrandomized only when screening fails, so an
        // arm is missing only for a screen failure (#2802).
        ARMCD: rand?.ARMCD ?? null,
        ARM: rand?.ARM ?? null,
        ACTARMCD: rand?.ARMCD ?? null,
        ACTARM: rand?.ARM ?? null,
        ARMNRS: rand ? null : "SCREEN FAILURE",
        ACTARMUD: null,
        COUNTRY: record.COUNTRY,
      },
      record,
      rand,
      ex,
      death
    );
  });
  const sv = get("SV").map((record) => {
    const ex = exBySubject.get(text(record.USUBJID));
    return item(
      {
        ...common(record.USUBJID, "SV"),
        ...visit(record),
        SVSTDTC: record.SVDTC,
        SVENDTC: record.SVDTC,
        SVSTDY: day(record.SVDTC, ex?.EXSTDTC ?? null),
        EPOCH: epochAt(record.SVDTC, ex),
      },
      record,
      ex
    );
  });
  const ex = get("EX").map((record) =>
    item(
      {
        ...common(record.USUBJID, "EX"),
        EXTRT: record.EXTRT,
        EXDOSE: record.EXDOSE,
        EXDOSU: record.EXDOSU,
        EXSTDTC: record.EXSTDTC,
        EXENDTC: record.EXENDTC,
        EXSTDY: 1,
        EPOCH: epochAt(record.EXSTDTC, record),
      },
      record
    )
  );
  const ae = get("AE").map((record) => {
    const exposure = exBySubject.get(text(record.USUBJID));
    return item(
      {
        ...common(record.USUBJID, "AE"),
        AETERM: record.AEDECOD,
        AEDECOD: record.AEDECOD,
        AEBODSYS: record.AEBODSYS,
        AESER: record.AESER,
        AEREL: record.AEREL === "RELATED" ? "POSSIBLY RELATED" : record.AEREL,
        AEACN: record.AEACN,
        ...Object.fromEntries(
          AE_SERIOUSNESS_CRITERIA.map(([name]) => [name, record[name] ?? null])
        ),
        AESTDTC: record.AESTDTC,
        AEENDTC: record.AEENDTC,
        AESTDY: day(record.AESTDTC, exposure?.EXSTDTC ?? null),
        EPOCH: epochAt(record.AESTDTC, exposure),
      },
      record,
      exposure
    );
  });
  const assessmentByCode = new Map(
    definition.design.activities.flatMap((activity) =>
      activity.assessments.map(
        (assessment) => [assessment.testCode, assessment] as const
      )
    )
  );
  const findings = (name: "VS" | "LB") => {
    const dates =
      name === "VS"
        ? {
            date: "VSDTC",
            code: "VSTESTCD",
            result: "VSORRES",
            unit: "VSORRESU",
          }
        : {
            date: "LBDTC",
            code: "LBTESTCD",
            result: "LBORRES",
            unit: "LBORRESU",
          };
    const records = get(name);
    const baseline = new Map<string, { date: string; source: string }>();
    for (const record of records) {
      const exposure = exBySubject.get(text(record.USUBJID));
      const observed = isoDate(record[dates.date]);
      const firstDose = isoDate(exposure?.EXSTDTC ?? null);
      if (!observed || !firstDose || observed > firstDose) continue;
      const key = `${record.USUBJID}|${record[dates.code]}`;
      const prior = baseline.get(key);
      if (!prior || observed >= prior.date)
        baseline.set(key, { date: observed, source: text(record.SRCID)! });
    }
    return records.map((record) => {
      const exposure = exBySubject.get(text(record.USUBJID));
      const assessment = assessmentByCode.get(text(record[dates.code]) ?? "");
      const result = num(record[dates.result]);
      const standardUnit = assessment?.unit ?? text(record[dates.unit]);
      const standard =
        result === null
          ? null
          : toStandardUnit(
              text(record[dates.code]) ?? "",
              result,
              text(record[dates.unit]),
              standardUnit
            );
      const source = text(record.SRCID);
      const key = `${record.USUBJID}|${record[dates.code]}`;
      const baselineFlag = baseline.get(key)?.source === source ? "Y" : null;
      const row: Row = {
        ...common(record.USUBJID, name),
        [`${name}TESTCD`]: record[dates.code],
        [`${name}TEST`]: assessment?.testName ?? null,
        [`${name}ORRES`]: result === null ? null : String(result),
        [`${name}ORRESU`]: record[dates.unit],
        [`${name}STRESC`]: standard === null ? null : String(standard),
        [`${name}STRESN`]: standard,
        [`${name}STRESU`]: standardUnit,
        ...visit(record),
        [dates.date]: record[dates.date],
        [`${name}DY`]: day(record[dates.date], exposure?.EXSTDTC ?? null),
        [`${name}LOBXFL`]: baselineFlag,
        EPOCH: epochAt(record[dates.date], exposure),
      };
      if (name === "LB") row.LBNRIND = record.LBNRIND;
      return item(row, record, exposure);
    });
  };
  const ds = get("DS").map((record) => {
    const exposure = exBySubject.get(text(record.USUBJID));
    return item(
      {
        ...common(record.USUBJID, "DS"),
        DSTERM: record.DSDECOD,
        DSDECOD: record.DSDECOD,
        DSCAT: record.DSSCAT,
        DSSTDTC: record.DSSTDTC,
        DSSTDY: day(record.DSSTDTC, exposure?.EXSTDTC ?? null),
        EPOCH: epochAt(record.DSSTDTC, exposure),
      },
      record,
      exposure
    );
  });
  const suppdm = get("DM").flatMap((record) =>
    (
      [
        ["SCREENFL", "Screening Outcome", record.SCREENFL],
        ["RANDFL", "Randomized Flag", record.RANDFL],
      ] as const
    ).map(([name, label, value]) =>
      item(
        {
          STUDYID: definition.studyId,
          RDOMAIN: "DM",
          USUBJID: record.USUBJID,
          IDVAR: null,
          IDVARVAL: null,
          QNAM: name,
          QLABEL: label,
          QVAL: value,
          QORIG: "Collected",
          QEVAL: null,
        },
        record
      )
    )
  );
  return [
    table("DM", dm),
    table("SV", sv),
    numbered("EX", ex),
    numbered("AE", ae),
    numbered("VS", findings("VS")),
    numbered("LB", findings("LB")),
    numbered("DS", ds),
    table("SUPPDM", suppdm),
  ];
}
