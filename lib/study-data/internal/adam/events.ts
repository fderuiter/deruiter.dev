/** Occurrence and time-to-event analysis from SDTM AE, DS and subject contact. */
import type {
  Dataset,
  Finding,
  StudyDefinition,
  VariableMeta,
} from "../../types";
import {
  addDays,
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

interface SourceRecord {
  readonly row: AnalysisRow;
  readonly lineage: readonly string[];
}

interface Contact {
  readonly date: string;
  readonly domain: "SV" | "DS";
  readonly variable: "VISITNUM" | "DSSEQ";
  readonly sourceValue: number | null;
  readonly lineage: readonly string[];
}

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
  column("ASEQ", "Analysis Sequence Number", "integer", "Assigned"),
] as const;
const SOURCE = [
  column("SRCDOM", "Source Domain", "text", "Assigned"),
  column("SRCVAR", "Source Variable", "text", "Assigned"),
  column("SRCSEQ", "Source Sequence Number", "integer", "Assigned"),
  column("SRCVAL", "Source Key Value", "integer", "Assigned"),
] as const;
const TREATMENT = [
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
  column(
    "TRTSDT",
    "Treatment Start Date",
    "date",
    "Predecessor",
    undefined,
    "ADSL.TRTSDT"
  ),
  column(
    "TRTEDT",
    "Treatment End Date",
    "date",
    "Predecessor",
    undefined,
    "ADSL.TRTEDT"
  ),
  column(
    "SAFFL",
    "Safety Population Flag",
    "text",
    "Predecessor",
    undefined,
    "ADSL.SAFFL"
  ),
  column(
    "ITTFL",
    "ITT Population Flag",
    "text",
    "Predecessor",
    undefined,
    "ADSL.ITTFL"
  ),
] as const;

const ADAE_VARIABLES: readonly VariableMeta[] = [
  ...COMMON,
  column(
    "AETERM",
    "Reported Event Term",
    "text",
    "Predecessor",
    undefined,
    "AE.AETERM"
  ),
  column(
    "AEDECOD",
    "Preferred Term",
    "text",
    "Predecessor",
    undefined,
    "AE.AEDECOD"
  ),
  column(
    "AEBODSYS",
    "Body System",
    "text",
    "Predecessor",
    undefined,
    "AE.AEBODSYS"
  ),
  column(
    "AESER",
    "Serious Event",
    "text",
    "Predecessor",
    undefined,
    "AE.AESER"
  ),
  column(
    "AEACN",
    "Action with Treatment",
    "text",
    "Predecessor",
    undefined,
    "AE.AEACN"
  ),
  column("ASTDT", "Analysis Start Date", "date", "Derived", "ADAE_IMPUTE"),
  column(
    "ASTDTF",
    "Start Date Imputation Flag",
    "text",
    "Derived",
    "ADAE_IMPUTE"
  ),
  column("AENDT", "Analysis End Date", "date", "Derived", "ADAE_IMPUTE"),
  column(
    "AENDTF",
    "End Date Imputation Flag",
    "text",
    "Derived",
    "ADAE_IMPUTE"
  ),
  column("TRTEMFL", "Treatment-Emergent Flag", "text", "Derived", "ADAE_TEAE"),
  column("LSTALVDT", "Last Known Contact Date", "date", "Derived", "ADAE_TEAE"),
  column("AOCCFL", "First Event Flag", "text", "Derived", "ADAE_OCC"),
  column(
    "AOCCSFL",
    "First Body System Event Flag",
    "text",
    "Derived",
    "ADAE_OCC"
  ),
  column(
    "AOCCPFL",
    "First Preferred Term Event Flag",
    "text",
    "Derived",
    "ADAE_OCC"
  ),
  ...TREATMENT,
  ...SOURCE,
];

const ADTTE_VARIABLES: readonly VariableMeta[] = [
  ...COMMON,
  column("PARAMCD", "Parameter Code", "text", "Assigned"),
  column("PARAM", "Parameter", "text", "Assigned"),
  column(
    "STARTDT",
    "Risk Start Date",
    "date",
    "Predecessor",
    undefined,
    "ADSL.TRTSDT"
  ),
  column("ADT", "Event or Censor Date", "date", "Derived", "ADTTE_EVENT"),
  column("AVAL", "Time to Event in Days", "integer", "Derived", "ADTTE_CENSOR"),
  column("CNSR", "Censor Flag", "integer", "Derived", "ADTTE_CENSOR"),
  column("EVNTDESC", "Event Description", "text", "Derived", "ADTTE_EVENT"),
  column(
    "CNSDTDSC",
    "Censor Date Description",
    "text",
    "Derived",
    "ADTTE_CENSOR"
  ),
  column(
    "DSSEQ",
    "Corroborating DS Sequence",
    "integer",
    "Derived",
    "ADTTE_EVENT"
  ),
  ...TREATMENT,
  ...SOURCE,
];

function records(dataset: Dataset | undefined): SourceRecord[] {
  return rows(dataset).map((row, index) => ({
    row,
    lineage: sourceLineage(dataset, index),
  }));
}

function bySubject(dataset: Dataset | undefined): Map<string, SourceRecord[]> {
  const grouped = new Map<string, SourceRecord[]>();
  for (const record of records(dataset)) {
    const subject = string(record.row.USUBJID);
    if (!subject) continue;
    grouped.set(subject, [...(grouped.get(subject) ?? []), record]);
  }
  return grouped;
}

function contacts(
  subject: string,
  sv: Map<string, SourceRecord[]>,
  ds: Map<string, SourceRecord[]>
): Contact[] {
  const visits: Contact[] = (sv.get(subject) ?? []).flatMap((record) => {
    const observed = date(record.row.SVSTDTC);
    return observed
      ? [
          {
            date: observed,
            domain: "SV" as const,
            variable: "VISITNUM" as const,
            sourceValue: number(record.row.VISITNUM),
            lineage: record.lineage,
          },
        ]
      : [];
  });
  const disposition: Contact[] = (ds.get(subject) ?? []).flatMap((record) => {
    const observed = date(record.row.DSSTDTC);
    return observed
      ? [
          {
            date: observed,
            domain: "DS" as const,
            variable: "DSSEQ" as const,
            sourceValue: number(record.row.DSSEQ),
            lineage: record.lineage,
          },
        ]
      : [];
  });
  return [...visits, ...disposition].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (a.domain === "DS" ? -1 : 1) - (b.domain === "DS" ? -1 : 1) ||
      (a.sourceValue ?? 0) - (b.sourceValue ?? 0)
  );
}

function impute(
  value: string | null,
  kind: "start" | "end",
  firstDose: string | null,
  lastContact: string | null
): { value: string | null; flag: string | null } {
  const complete = date(value);
  if (complete) return { value: complete, flag: null };
  if (!value || !/^\d{4}-\d{2}$/.test(value) || !date(`${value}-01`))
    return { value: null, flag: null };
  if (kind === "start") {
    return {
      value: firstDose?.startsWith(`${value}-`) ? firstDose : `${value}-01`,
      flag: "D",
    };
  }
  const [year, month] = value.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(year, month, 0))
    .toISOString()
    .slice(0, 10);
  return {
    value: lastContact && monthEnd > lastContact ? lastContact : monthEnd,
    flag: "D",
  };
}

function finding(
  ruleId: string,
  dataset: "ADAE" | "ADTTE",
  row: number,
  message: string
): Finding {
  return {
    ruleId,
    severity: "warning",
    layer: "adam",
    dataset,
    row,
    message,
    citation: "ADR 0069",
  };
}

/** Derive AE occurrence rows with explicit imputation and TEAE boundaries. */
export function deriveAdae(
  sdtm: readonly Dataset[],
  adsl: Dataset
): { readonly dataset: Dataset; readonly findings: readonly Finding[] } {
  const get = (name: string) => sdtm.find((dataset) => dataset.name === name);
  const subjectRows = new Map(
    rows(adsl).map((row) => [string(row.USUBJID), row])
  );
  const sv = bySubject(get("SV"));
  const ds = bySubject(get("DS"));
  const ae = records(get("AE"));
  const output: { row: AnalysisRow; lineage: readonly string[] }[] = [];
  const findings: Finding[] = [];
  for (const [index, source] of ae.entries()) {
    const record = source.row;
    const subject = string(record.USUBJID)!;
    const adslRow = subjectRows.get(subject);
    const firstDose = date(adslRow?.TRTSDT);
    const lastDose = date(adslRow?.TRTEDT);
    const lastContactRecord = contacts(subject, sv, ds)[0];
    const lastContact = lastContactRecord?.date ?? null;
    const start = impute(
      string(record.AESTDTC),
      "start",
      firstDose,
      lastContact
    );
    const end = impute(string(record.AEENDTC), "end", firstDose, lastContact);
    if (start.value && end.value && end.value < start.value) {
      findings.push(
        finding(
          "DEMO301-AE-DATE",
          "ADAE",
          index,
          "Analysis end date precedes analysis start date after imputation."
        )
      );
      end.value = null;
    }
    const treatmentWindowEnd = lastDose ? addDays(lastDose, 14) : null;
    const emergenceEnd =
      treatmentWindowEnd && lastContact && lastContact < treatmentWindowEnd
        ? lastContact
        : treatmentWindowEnd;
    const emergent = Boolean(
      firstDose &&
      start.value &&
      emergenceEnd &&
      start.value >= firstDose &&
      start.value <= emergenceEnd
    );
    output.push({
      row: {
        STUDYID: record.STUDYID,
        USUBJID: subject,
        ASEQ: number(record.AESEQ),
        AETERM: record.AETERM,
        AEDECOD: record.AEDECOD,
        AEBODSYS: record.AEBODSYS,
        AESER: record.AESER,
        AEACN: record.AEACN,
        ASTDT: start.value,
        ASTDTF: start.flag,
        AENDT: end.value,
        AENDTF: end.flag,
        TRTEMFL: emergent ? "Y" : "N",
        LSTALVDT: lastContact,
        AOCCFL: null,
        AOCCSFL: null,
        AOCCPFL: null,
        TRT01P: adslRow?.TRT01P ?? null,
        TRT01A: adslRow?.TRT01A ?? null,
        TRTSDT: firstDose,
        TRTEDT: lastDose,
        SAFFL: adslRow?.SAFFL ?? "N",
        ITTFL: adslRow?.ITTFL ?? "N",
        SRCDOM: "AE",
        SRCVAR: "AESTDTC",
        SRCSEQ: number(record.AESEQ),
        SRCVAL: number(record.AESEQ),
      },
      lineage: [
        ...new Set([...source.lineage, ...(lastContactRecord?.lineage ?? [])]),
      ],
    });
  }
  const first = new Set<string>();
  const firstSoc = new Set<string>();
  const firstPt = new Set<string>();
  for (const item of [...output].sort(
    (a, b) =>
      (string(a.row.ASTDT) ?? "9999").localeCompare(
        string(b.row.ASTDT) ?? "9999"
      ) || number(a.row.SRCSEQ)! - number(b.row.SRCSEQ)!
  )) {
    if (item.row.TRTEMFL !== "Y") continue;
    const subject = string(item.row.USUBJID)!;
    const soc = `${subject}|${string(item.row.AEBODSYS) ?? ""}`;
    const pt = `${subject}|${string(item.row.AEDECOD) ?? ""}`;
    if (!first.has(subject)) item.row.AOCCFL = "Y";
    if (!firstSoc.has(soc)) item.row.AOCCSFL = "Y";
    if (!firstPt.has(pt)) item.row.AOCCPFL = "Y";
    first.add(subject);
    firstSoc.add(soc);
    firstPt.add(pt);
  }
  return {
    dataset: table(
      "ADAE",
      "Adverse Events Analysis",
      {
        class: "OCCDS",
        subClass: "ADVERSE EVENT",
        structure: "One record per adverse event per subject",
      },
      ADAE_VARIABLES,
      output.map(({ row }) => row),
      output.map(({ lineage }) => lineage)
    ),
    findings,
  };
}

/** Derive one event or censoring row for each dosed subject. */
export function deriveAdtte(
  definition: StudyDefinition,
  sdtm: readonly Dataset[],
  adsl: Dataset,
  adae: Dataset
): { readonly dataset: Dataset; readonly findings: readonly Finding[] } {
  const get = (name: string) => sdtm.find((dataset) => dataset.name === name);
  const sv = bySubject(get("SV"));
  const ds = bySubject(get("DS"));
  const adaeRows = bySubject(adae);
  const output: AnalysisRow[] = [];
  const lineage: (readonly string[])[] = [];
  const findings: Finding[] = [];
  for (const subjectRow of rows(adsl)) {
    const subject = string(subjectRow.USUBJID)!;
    const start = date(subjectRow.TRTSDT);
    if (!start) continue;
    const contact = contacts(subject, sv, ds)[0] ?? null;
    const dispositions = (ds.get(subject) ?? []).filter(
      ({ row }) => row.DSCAT === "DISPOSITION EVENT"
    );
    const aeDisposition = dispositions.find(
      ({ row }) => row.DSDECOD === "ADVERSE EVENT" && date(row.DSSTDTC)
    );
    const competing = dispositions
      .filter(
        ({ row }) =>
          !["ADVERSE EVENT", "COMPLETED", "SCREEN FAILURE"].includes(
            string(row.DSDECOD) ?? ""
          )
      )
      .sort((a, b) =>
        (date(a.row.DSSTDTC) ?? "9999").localeCompare(
          date(b.row.DSSTDTC) ?? "9999"
        )
      )[0];
    const eligible = (adaeRows.get(subject) ?? [])
      .filter(
        ({ row }) =>
          row.TRTEMFL === "Y" &&
          row.AEACN === "DRUG WITHDRAWN" &&
          date(row.ASTDT)
      )
      .sort(
        (a, b) =>
          date(a.row.ASTDT)!.localeCompare(date(b.row.ASTDT)!) ||
          number(a.row.SRCSEQ)! - number(b.row.SRCSEQ)!
      );
    const competingDate = date(competing?.row.DSSTDTC);
    const corroborated = aeDisposition
      ? eligible.find(
          ({ row }) => date(row.ASTDT)! <= date(aeDisposition.row.DSSTDTC)!
        )
      : undefined;
    const event =
      corroborated &&
      (!competingDate || date(corroborated.row.ASTDT)! <= competingDate)
        ? corroborated
        : undefined;
    if ((eligible.length > 0 || aeDisposition) && !corroborated) {
      findings.push(
        finding(
          "DEMO301-TTE-LINK",
          "ADTTE",
          output.length,
          "AE drug withdrawal and adverse-event disposition do not corroborate a qualifying event."
        )
      );
    }
    let analysisDate: string | null;
    let censor: number;
    let description: string;
    let censorDescription: string | null;
    let sourceDomain: string;
    let sourceVariable: string;
    let sourceSequence: number | null;
    let sourceValue: number | null;
    let sourceLinks: readonly string[];
    let corroboratingDs: number | null = null;
    if (event && aeDisposition) {
      analysisDate = date(event.row.ASTDT);
      censor = 0;
      description = "First TEAE leading to treatment discontinuation";
      censorDescription = null;
      sourceDomain = "AE";
      sourceVariable = "AESTDTC";
      sourceSequence = number(event.row.SRCSEQ);
      sourceValue = sourceSequence;
      sourceLinks = [...new Set([...event.lineage, ...aeDisposition.lineage])];
      corroboratingDs = number(aeDisposition.row.DSSEQ);
    } else {
      const useCompeting = Boolean(
        competingDate && (!contact || competingDate <= contact.date)
      );
      analysisDate = useCompeting ? competingDate : (contact?.date ?? null);
      censor = 1;
      description = "Censored";
      censorDescription = useCompeting
        ? "Discontinuation for another reason"
        : "Last known study contact";
      sourceDomain = useCompeting ? "DS" : (contact?.domain ?? "DS");
      sourceVariable = useCompeting
        ? "DSSTDTC"
        : (contact?.variable ?? "DSSTDTC");
      sourceSequence = useCompeting
        ? number(competing?.row.DSSEQ)
        : contact?.domain === "DS"
          ? contact.sourceValue
          : null;
      sourceValue = useCompeting
        ? number(competing?.row.DSSEQ)
        : (contact?.sourceValue ?? null);
      sourceLinks = useCompeting
        ? (competing?.lineage ?? [])
        : (contact?.lineage ?? []);
    }
    if (analysisDate && analysisDate < start) analysisDate = start;
    output.push({
      STUDYID: definition.studyId,
      USUBJID: subject,
      ASEQ: 1,
      PARAMCD: "TTADISC",
      PARAM: "Time to First TEAE Leading to Discontinuation",
      STARTDT: start,
      ADT: analysisDate,
      AVAL: analysisDate ? daysBetween(start, analysisDate) + 1 : null,
      CNSR: censor,
      EVNTDESC: description,
      CNSDTDSC: censorDescription,
      DSSEQ: corroboratingDs,
      TRT01P: subjectRow.TRT01P,
      TRT01A: subjectRow.TRT01A,
      TRTSDT: subjectRow.TRTSDT,
      TRTEDT: subjectRow.TRTEDT,
      SAFFL: subjectRow.SAFFL,
      ITTFL: subjectRow.ITTFL,
      SRCDOM: sourceDomain,
      SRCVAR: sourceVariable,
      SRCSEQ: sourceSequence,
      SRCVAL: sourceValue,
    });
    lineage.push(sourceLinks);
  }
  return {
    dataset: table(
      "ADTTE",
      "Time-to-Event Analysis",
      {
        class: "BDS",
        subClass: "TIME-TO-EVENT",
        structure: "One record per subject per parameter",
        codelists: { PARAMCD: "ADTTE.PARAMCD" },
      },
      ADTTE_VARIABLES,
      output,
      lineage
    ),
    findings,
  };
}
