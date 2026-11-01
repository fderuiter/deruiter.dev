/** ADSL and BDS analysis datasets derived only from SDTM and the study design. */
import type { Dataset, StudyDefinition, VariableMeta } from "../../types";
import {
  column,
  date,
  daysBetween,
  number,
  rows,
  sourceLineage,
  string,
  table,
  type AnalysisRow,
} from "./shared";

const COMMON = [
  column(
    "STUDYID",
    "Study Identifier",
    "text",
    "Predecessor",
    undefined,
    "DM.STUDYID"
  ),
  column(
    "USUBJID",
    "Unique Subject Identifier",
    "text",
    "Predecessor",
    undefined,
    "DM.USUBJID"
  ),
] as const;
const SOURCE = [
  column("SRCDOM", "Source Domain", "text", "Assigned"),
  column("SRCVAR", "Source Variable", "text", "Assigned"),
  column("SRCSEQ", "Source Sequence", "integer", "Assigned"),
] as const;
const POPULATIONS = [
  column("SAFFL", "Safety Population Flag", "text", "Derived", "ADSL_POP"),
  column("ITTFL", "ITT Population Flag", "text", "Derived", "ADSL_POP"),
  column("EFFFL", "Efficacy Population Flag", "text", "Derived", "ADSL_POP"),
] as const;

const ADSL_VARIABLES: readonly VariableMeta[] = [
  ...COMMON,
  // Required in ADSL by ADaMIG 1.3, copied from DM (#2807).
  column(
    "SITEID",
    "Study Site Identifier",
    "text",
    "Predecessor",
    undefined,
    "DM.SITEID"
  ),
  column("TRT01P", "Planned Treatment", "text", "Derived", "ADSL_TRT"),
  column(
    "TRT01PN",
    "Planned Treatment Number",
    "integer",
    "Derived",
    "ADSL_TRT"
  ),
  column("TRT01A", "Actual Treatment", "text", "Derived", "ADSL_TRT"),
  column(
    "TRT01AN",
    "Actual Treatment Number",
    "integer",
    "Derived",
    "ADSL_TRT"
  ),
  column("TRTSDT", "Treatment Start Date", "date", "Derived", "ADSL_TRT"),
  column("TRTEDT", "Treatment End Date", "date", "Derived", "ADSL_TRT"),
  ...POPULATIONS,
  column("AGE", "Age", "integer", "Predecessor", undefined, "DM.AGE"),
  column("AGEGR1", "Age Group", "text", "Derived", "ADSL_POP"),
  column("AGEGR1N", "Age Group Number", "integer", "Derived", "ADSL_POP"),
  column("SEX", "Sex", "text", "Predecessor", undefined, "DM.SEX"),
  column("RACE", "Race", "text", "Predecessor", undefined, "DM.RACE"),
  column("COUNTRY", "Country", "text", "Predecessor", undefined, "DM.COUNTRY"),
  column(
    "BSYSBP",
    "Baseline Systolic Blood Pressure",
    "float",
    "Derived",
    "BDS_BASE"
  ),
  column(
    "BDIABP",
    "Baseline Diastolic Blood Pressure",
    "float",
    "Derived",
    "BDS_BASE"
  ),
  column("EOSSTT", "End of Study Status", "text", "Derived", "ADSL_DISP"),
  column("DCSREAS", "Discontinuation Reason", "text", "Derived", "ADSL_DISP"),
  column("DTHDT", "Date of Death", "date", "Derived", "ADSL_DEATH"),
  ...SOURCE,
];

const BDS_VARIABLES: readonly VariableMeta[] = [
  ...COMMON,
  column("ASEQ", "Analysis Sequence Number", "integer", "Assigned"),
  column("PARAMCD", "Parameter Code", "text", "Predecessor"),
  column("PARAM", "Parameter", "text", "Predecessor"),
  column("AVAL", "Analysis Value", "float", "Predecessor"),
  column("AVALU", "Analysis Value Unit", "text", "Predecessor"),
  column("ADT", "Analysis Date", "date", "Predecessor"),
  column("ADY", "Analysis Day", "integer", "Derived", "BDS_WINDOW"),
  column("AVISIT", "Analysis Visit", "text", "Derived", "BDS_WINDOW"),
  column(
    "AVISITN",
    "Analysis Visit Number",
    "integer",
    "Derived",
    "BDS_WINDOW"
  ),
  column("ABLFL", "Baseline Record Flag", "text", "Derived", "BDS_BASE"),
  column("BASE", "Baseline Value", "float", "Derived", "BDS_BASE"),
  column("CHG", "Change from Baseline", "float", "Derived", "BDS_CHANGE"),
  column(
    "PCHG",
    "Percent Change from Baseline",
    "float",
    "Derived",
    "BDS_CHANGE"
  ),
  column("ANL01FL", "Primary Analysis Flag", "text", "Derived", "BDS_ANALYSIS"),
  column("DTYPE", "Derivation Type", "text", "Derived", "BDS_LOCF"),
  column("ANRIND", "Analysis Normal Range Indicator", "text", "Predecessor"),
  column(
    "BNRIND",
    "Baseline Normal Range Indicator",
    "text",
    "Derived",
    "BDS_BASE"
  ),
  column(
    "TRT01P",
    "Planned Treatment",
    "text",
    "Predecessor",
    undefined,
    "ADSL.TRT01P"
  ),
  column(
    "TRT01A",
    "Actual Treatment",
    "text",
    "Predecessor",
    undefined,
    "ADSL.TRT01A"
  ),
  ...POPULATIONS,
  ...SOURCE,
];

/** The SDTM findings domains with a BDS analysis dataset. */
type BdsDomain = "VS" | "LB" | "EG" | "QS";

interface OriginRow {
  row: AnalysisRow;
  lineage: readonly string[];
}

function records(dataset: Dataset | undefined): OriginRow[] {
  return rows(dataset).map((row, index) => ({
    row,
    lineage: sourceLineage(dataset, index),
  }));
}

function groupBySubject(
  records: readonly OriginRow[]
): Map<string, OriginRow[]> {
  const groups = new Map<string, OriginRow[]>();
  for (const record of records) {
    const subject = string(record.row.USUBJID);
    if (!subject) continue;
    groups.set(subject, [...(groups.get(subject) ?? []), record]);
  }
  return groups;
}

function baseline(
  records: readonly OriginRow[],
  firstDose: string | null,
  domain: BdsDomain,
  param: string
): OriginRow | null {
  if (!firstDose) return null;
  const candidates = records.filter(({ row }) => {
    const observed = date(row[`${domain}DTC`]);
    return (
      row[`${domain}TESTCD`] === param &&
      number(row[`${domain}STRESN`]) !== null &&
      observed !== null &&
      (observed < firstDose ||
        (observed === firstDose && row.VISIT === "BASELINE"))
    );
  });
  candidates.sort((a, b) => {
    const byDate = date(b.row[`${domain}DTC`])!.localeCompare(
      date(a.row[`${domain}DTC`])!
    );
    if (byDate !== 0) return byDate;
    const baselineA = a.row.VISIT === "BASELINE" ? 0 : 1;
    const baselineB = b.row.VISIT === "BASELINE" ? 0 : 1;
    return (
      baselineA - baselineB ||
      (number(a.row[`${domain}SEQ`]) ?? Infinity) -
        (number(b.row[`${domain}SEQ`]) ?? Infinity)
    );
  });
  return candidates[0] ?? null;
}

function actualDay(
  firstDose: string | null,
  observed: string | null
): number | null {
  if (!firstDose || !observed) return null;
  const delta = daysBetween(firstDose, observed);
  return delta >= 0 ? delta + 1 : delta;
}

/** Derive one subject-level row for every SDTM DM subject, including screen failures. */
export function deriveAdsl(
  definition: StudyDefinition,
  sdtm: readonly Dataset[]
): Dataset {
  const byName = new Map(sdtm.map((dataset) => [dataset.name, dataset]));
  const dm = records(byName.get("DM"));
  const ex = groupBySubject(records(byName.get("EX")));
  const ds = groupBySubject(records(byName.get("DS")));
  const vs = groupBySubject(records(byName.get("VS")));
  const armNumber = new Map(
    definition.design.arms.map((arm, index) => [arm.armCode, index + 1])
  );
  const treatmentNumber = new Map(
    definition.design.arms.map((arm, index) => [arm.name, index + 1])
  );
  const data: AnalysisRow[] = [];
  const lineage: (readonly string[])[] = [];
  for (const subjectRow of dm) {
    const source = subjectRow.row;
    const subject = string(source.USUBJID)!;
    const exposure = [...(ex.get(subject) ?? [])].sort((a, b) =>
      (date(a.row.EXSTDTC) ?? "").localeCompare(date(b.row.EXSTDTC) ?? "")
    );
    const firstExposure = exposure.find(({ row }) => date(row.EXSTDTC));
    const firstDose = date(firstExposure?.row.EXSTDTC);
    const lastDose =
      exposure
        .map(({ row }) => date(row.EXENDTC))
        .filter((value) => value !== null)
        .sort()
        .at(-1) ?? null;
    const planned = string(source.ARMCD);
    const actual = firstDose ? string(firstExposure?.row.EXTRT) : null;
    const randomized = planned !== null;
    const systolicBaseline = baseline(
      vs.get(subject) ?? [],
      firstDose,
      "VS",
      "SYSBP"
    );
    const diastolicBaseline = baseline(
      vs.get(subject) ?? [],
      firstDose,
      "VS",
      "DIABP"
    );
    const postbaseline = (vs.get(subject) ?? []).some(
      ({ row }) =>
        row.VSTESTCD === "SYSBP" &&
        number(row.VSSTRESN) !== null &&
        date(row.VSDTC) !== null &&
        firstDose !== null &&
        date(row.VSDTC)! > firstDose
    );
    const disposition = (ds.get(subject) ?? []).find(
      ({ row }) => row.DSCAT === "DISPOSITION EVENT"
    );
    const reason = string(disposition?.row.DSDECOD);
    const age = number(source.AGE);
    const ageGroup =
      age === null ? null : age < 40 ? "<40" : age < 65 ? "40-64" : "65+";
    const ageGroupNumber =
      age === null ? null : age < 40 ? 1 : age < 65 ? 2 : 3;
    data.push({
      STUDYID: definition.studyId,
      USUBJID: subject,
      SITEID: source.SITEID,
      TRT01P: randomized ? source.ARM : null,
      TRT01PN: randomized ? (armNumber.get(planned!) ?? null) : null,
      TRT01A: actual,
      TRT01AN: actual ? (treatmentNumber.get(actual) ?? null) : null,
      TRTSDT: firstDose,
      TRTEDT: lastDose,
      SAFFL: firstDose ? "Y" : "N",
      ITTFL: firstDose && randomized ? "Y" : "N",
      EFFFL:
        firstDose && randomized && systolicBaseline && postbaseline ? "Y" : "N",
      AGE: age,
      AGEGR1: ageGroup,
      AGEGR1N: ageGroupNumber,
      SEX: source.SEX,
      RACE: source.RACE,
      COUNTRY: source.COUNTRY,
      BSYSBP: number(systolicBaseline?.row.VSSTRESN),
      BDIABP: number(diastolicBaseline?.row.VSSTRESN),
      EOSSTT:
        reason === "COMPLETED"
          ? "COMPLETED"
          : reason === "SCREEN FAILURE"
            ? "SCREEN FAILURE"
            : reason
              ? "DISCONTINUED"
              : null,
      DCSREAS:
        reason && reason !== "COMPLETED" && reason !== "SCREEN FAILURE"
          ? reason
          : null,
      DTHDT: date(source.DTHDTC),
      SRCDOM: "DM",
      SRCVAR: "USUBJID",
      SRCSEQ: null,
    });
    lineage.push([
      ...new Set([
        ...subjectRow.lineage,
        ...exposure.flatMap((record) => record.lineage),
        ...(disposition?.lineage ?? []),
        ...(systolicBaseline?.lineage ?? []),
        ...(diastolicBaseline?.lineage ?? []),
      ]),
    ]);
  }
  return table(
    "ADSL",
    "Subject-Level Analysis Dataset",
    { class: "ADSL", structure: "One record per subject" },
    ADSL_VARIABLES,
    data,
    lineage,
    ["STUDYID", "USUBJID"]
  );
}

function selectedVisit(
  observedDay: number | null,
  definition: StudyDefinition
) {
  if (observedDay === null) return null;
  return (
    [...definition.design.visits]
      .filter(
        (visit) =>
          observedDay >= visit.targetDay - visit.windowBefore &&
          observedDay <= visit.targetDay + visit.windowAfter
      )
      .sort(
        (a, b) =>
          Math.abs(observedDay - a.targetDay) -
            Math.abs(observedDay - b.targetDay) ||
          a.targetDay - b.targetDay ||
          a.visitNum - b.visitNum
      )[0] ?? null
  );
}

function attachBaseline(row: AnalysisRow, baselineValue: number | null): void {
  const aval = number(row.AVAL);
  row.BASE = baselineValue;
  row.CHG =
    aval !== null && baselineValue !== null ? aval - baselineValue : null;
  row.PCHG =
    typeof row.CHG === "number" && baselineValue !== null && baselineValue !== 0
      ? (row.CHG / baselineValue) * 100
      : null;
}

/** ADEG's QTcF outlier criteria (ICH E14 categorical analysis). */
const QTCF_CRITERIA = {
  CRIT1: { text: "QTcF > 500 ms", exceeds: 500, variable: "AVAL" },
  CRIT2: {
    text: "QTcF increase from baseline > 60 ms",
    exceeds: 60,
    variable: "CHG",
  },
} as const;

/** The QTcF parameter ADEG derives, and the collected ones it comes from. */
const QTCF = {
  code: "QTCFAG",
  name: "QTcF Interval, Aggregate",
  qt: "QTAG",
  rr: "RRAG",
} as const;

/**
 * Fridericia's QTcF for each ECG that has both a QT and an RR result:
 * QT / (RR / 1000)^(1/3), rounded to 0.1 ms. The derived record carries
 * the QT record's identifiers, so its SRCSEQ points at the QT result, and
 * the lineage of both inputs.
 */
function qtcfRecords(records: readonly OriginRow[]): OriginRow[] {
  const ecgs = new Map<string, OriginRow[]>();
  for (const record of records) {
    const key = `${string(record.row.USUBJID)}|${string(record.row.EGDTC)}|${number(record.row.VISITNUM)}`;
    ecgs.set(key, [...(ecgs.get(key) ?? []), record]);
  }
  const derived: OriginRow[] = [];
  for (const ecg of ecgs.values()) {
    const result = (code: string) =>
      ecg.find(
        ({ row }) =>
          row.EGTESTCD === code &&
          number(row.EGSTRESN) !== null &&
          row.EGSTRESU === "ms"
      );
    const qt = result(QTCF.qt);
    const rr = result(QTCF.rr);
    const rrValue = number(rr?.row.EGSTRESN);
    if (!qt || !rr || rrValue === null || rrValue <= 0) continue;
    const value = number(qt.row.EGSTRESN)! / Math.cbrt(rrValue / 1000);
    derived.push({
      row: {
        ...qt.row,
        EGTESTCD: QTCF.code,
        EGTEST: QTCF.name,
        EGSTRESN: Math.round(value * 10) / 10,
      },
      lineage: [...new Set([...qt.lineage, ...rr.lineage])],
    });
  }
  return derived;
}

function deriveBdsDomain(
  domain: BdsDomain,
  definition: StudyDefinition,
  sdtm: readonly Dataset[],
  adsl: Dataset
): Dataset {
  const source = sdtm.find((dataset) => dataset.name === domain);
  const collectedRecords = records(source);
  const derivedRecords = domain === "EG" ? qtcfRecords(collectedRecords) : [];
  const derivedRows = new Set(derivedRecords.map(({ row }) => row));
  const sourceRecords = [...collectedRecords, ...derivedRecords];
  const adslBySubject = new Map(
    rows(adsl).map((row) => [string(row.USUBJID), row])
  );
  const bySubject = groupBySubject(sourceRecords);
  const output: { row: AnalysisRow; lineage: readonly string[] }[] = [];
  for (const [subject, recordsForSubject] of bySubject) {
    const subjectLevel = adslBySubject.get(subject);
    const firstDose = date(subjectLevel?.TRTSDT);
    const parameters = [
      ...new Set(
        recordsForSubject
          .map(({ row }) => string(row[`${domain}TESTCD`]))
          .filter((value) => value !== null)
      ),
    ];
    for (const param of parameters) {
      const parameterRows = recordsForSubject.filter(
        ({ row }) => row[`${domain}TESTCD`] === param
      );
      const baseRecord = baseline(parameterRows, firstDose, domain, param);
      const baseValue = number(baseRecord?.row[`${domain}STRESN`]);
      const baseSeq = number(baseRecord?.row[`${domain}SEQ`]);
      const baseRange =
        domain === "LB" ? string(baseRecord?.row.LBNRIND) : null;
      const observed: { row: AnalysisRow; lineage: readonly string[] }[] = [];
      for (const sourceRecord of parameterRows) {
        const record = sourceRecord.row;
        const observedDate = date(record[`${domain}DTC`]);
        const day = actualDay(firstDose, observedDate);
        const visit = selectedVisit(day, definition);
        const row: AnalysisRow = {
          STUDYID: definition.studyId,
          USUBJID: subject,
          ASEQ: null,
          PARAMCD: param,
          PARAM: record[`${domain}TEST`],
          ...(domain === "EG"
            ? { PARAMTYP: derivedRows.has(record) ? "DERIVED" : null }
            : {}),
          AVAL: number(record[`${domain}STRESN`]),
          // Questionnaire scores have no unit, so ADQS has no AVALU.
          ...(domain === "QS" ? {} : { AVALU: record[`${domain}STRESU`] }),
          ADT: observedDate,
          ADY: day,
          AVISIT: visit?.name ?? "UNSCHEDULED",
          AVISITN: visit?.visitNum ?? 99,
          ABLFL:
            baseSeq !== null && number(record[`${domain}SEQ`]) === baseSeq
              ? "Y"
              : null,
          BASE: null,
          CHG: null,
          PCHG: null,
          ANL01FL: null,
          DTYPE: null,
          ANRIND: domain === "LB" ? record.LBNRIND : null,
          BNRIND: baseRange,
          TRT01P: subjectLevel?.TRT01P ?? null,
          TRT01A: subjectLevel?.TRT01A ?? null,
          SAFFL: subjectLevel?.SAFFL ?? "N",
          ITTFL: subjectLevel?.ITTFL ?? "N",
          EFFFL: subjectLevel?.EFFFL ?? "N",
          SRCDOM: domain,
          SRCVAR: `${domain}STRESN`,
          SRCSEQ: number(record[`${domain}SEQ`]),
        };
        attachBaseline(row, baseValue);
        if (domain === "EG")
          for (const [name, criterion] of Object.entries(QTCF_CRITERIA)) {
            const value = number(row[criterion.variable]);
            const applies = param === QTCF.code;
            row[name] = applies ? criterion.text : null;
            row[`${name}FL`] =
              applies && value !== null
                ? value > criterion.exceeds
                  ? "Y"
                  : "N"
                : null;
          }
        observed.push({ row, lineage: sourceRecord.lineage });
      }
      const candidatesByVisit = new Map<number, typeof observed>();
      for (const item of observed) {
        const visitNumber = number(item.row.AVISITN);
        if (
          visitNumber === null ||
          visitNumber === 99 ||
          item.row.AVAL === null
        )
          continue;
        candidatesByVisit.set(visitNumber, [
          ...(candidatesByVisit.get(visitNumber) ?? []),
          item,
        ]);
      }
      for (const visit of definition.design.visits) {
        const candidates = candidatesByVisit.get(visit.visitNum) ?? [];
        candidates.sort(
          (a, b) =>
            Math.abs(number(a.row.ADY)! - visit.targetDay) -
              Math.abs(number(b.row.ADY)! - visit.targetDay) ||
            string(a.row.ADT)!.localeCompare(string(b.row.ADT)!) ||
            number(a.row.SRCSEQ)! - number(b.row.SRCSEQ)!
        );
        if (candidates[0]) candidates[0].row.ANL01FL = "Y";
      }
      output.push(...observed);
      const plannedVisits = definition.design.visits.filter(
        (visit) =>
          visit.targetDay > 1 &&
          definition.design.schedule.some(
            (cell) =>
              cell.visitId === visit.id &&
              definition.design.activities.some(
                (activity) =>
                  activity.id === cell.activityId &&
                  activity.domain === domain &&
                  activity.assessments.some(
                    (assessment) =>
                      assessment.testCode ===
                      (param === QTCF.code ? QTCF.qt : param)
                  )
              )
          )
      );
      for (const visit of plannedVisits) {
        if (candidatesByVisit.has(visit.visitNum)) continue;
        const earlier = observed
          .filter(
            ({ row }) =>
              number(row.ADY) !== null &&
              number(row.ADY)! > 1 &&
              number(row.ADY)! < visit.targetDay &&
              number(row.AVAL) !== null
          )
          .sort(
            (a, b) =>
              number(b.row.ADY)! - number(a.row.ADY)! ||
              number(b.row.SRCSEQ)! - number(a.row.SRCSEQ)!
          )[0];
        if (!earlier) continue;
        const carried = {
          ...earlier.row,
          ASEQ: null,
          AVISIT: visit.name,
          AVISITN: visit.visitNum,
          ADT: earlier.row.ADT,
          ABLFL: null,
          ANL01FL: null,
          DTYPE: "LOCF",
        };
        output.push({ row: carried, lineage: earlier.lineage });
      }
    }
  }
  output.sort(
    (a, b) =>
      string(a.row.USUBJID)!.localeCompare(string(b.row.USUBJID)!) ||
      string(a.row.PARAMCD)!.localeCompare(string(b.row.PARAMCD)!) ||
      number(a.row.AVISITN)! - number(b.row.AVISITN)! ||
      (a.row.DTYPE === "LOCF" ? 1 : 0) - (b.row.DTYPE === "LOCF" ? 1 : 0) ||
      (number(a.row.SRCSEQ) ?? 0) - (number(b.row.SRCSEQ) ?? 0)
  );
  const sequence = new Map<string, number>();
  for (const item of output) {
    const subject = string(item.row.USUBJID)!;
    const next = (sequence.get(subject) ?? 0) + 1;
    sequence.set(subject, next);
    item.row.ASEQ = next;
  }
  const name = `AD${domain}` as const;
  const variables =
    domain === "EG"
      ? BDS_VARIABLES.flatMap((variable) =>
          variable.name === "PARAM"
            ? [
                variable,
                column("PARAMTYP", "Parameter Type", "text", "Assigned"),
              ]
            : variable.name === "BNRIND"
              ? [
                  variable,
                  ...Object.keys(QTCF_CRITERIA).flatMap((name, index) => [
                    column(
                      name,
                      `Analysis Criterion ${index + 1}`,
                      "text",
                      "Assigned"
                    ),
                    column(
                      `${name}FL`,
                      `Criterion ${index + 1} Evaluation Result Flag`,
                      "text",
                      "Derived",
                      "ADEG_CRIT"
                    ),
                  ]),
                ]
              : [variable]
        )
      : domain === "QS"
        ? BDS_VARIABLES.filter((variable) => variable.name !== "AVALU")
        : BDS_VARIABLES;
  return table(
    name,
    {
      VS: "Vital Signs Analysis",
      LB: "Laboratory Analysis",
      EG: "ECG Analysis",
      QS: "Questionnaire Analysis",
    }[domain],
    {
      class: "BDS",
      structure:
        "One or more records per subject per parameter per analysis visit",
      codelists: {
        PARAMCD: `${name}.PARAMCD`,
        ...(domain === "QS"
          ? {}
          : { AVALU: domain === "VS" ? "VSRESU" : "UNIT" }),
      },
    },
    variables.map((variable) => {
      if (variable.name === "PARAMCD" || variable.name === "PARAM")
        return {
          ...variable,
          source: `${domain}.${domain}TEST${variable.name === "PARAMCD" ? "CD" : ""}`,
        };
      if (variable.name === "AVAL")
        return { ...variable, source: `${domain}.${domain}STRESN` };
      if (variable.name === "AVALU")
        return { ...variable, source: `${domain}.${domain}STRESU` };
      if (variable.name === "ADT")
        return { ...variable, source: `${domain}.${domain}DTC` };
      if (variable.name === "ANRIND")
        return domain === "LB"
          ? { ...variable, source: "LB.LBNRIND" }
          : // VS and EG carry no reference ranges, so ANRIND has no source.
            { ...variable, origin: "Not Available" as const };
      return variable;
    }),
    output.map(({ row }) => row),
    output.map(({ lineage }) => lineage)
  );
}

/**
 * Derive subject-level and findings analysis datasets from existing SDTM
 * rows: ADSL, ADVS, ADLB and ADEG, and ADQS when the study collected QS.
 */
export function deriveAdamCore(
  definition: StudyDefinition,
  sdtm: readonly Dataset[]
): readonly Dataset[] {
  const adsl = deriveAdsl(definition, sdtm);
  return [
    adsl,
    deriveBdsDomain("VS", definition, sdtm, adsl),
    deriveBdsDomain("LB", definition, sdtm, adsl),
    deriveBdsDomain("EG", definition, sdtm, adsl),
    ...(sdtm.some((dataset) => dataset.name === "QS")
      ? [deriveBdsDomain("QS", definition, sdtm, adsl)]
      : []),
  ];
}
