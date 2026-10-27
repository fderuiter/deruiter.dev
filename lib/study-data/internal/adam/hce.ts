/**
 * ADHCE: the hierarchical composite endpoint analysis dataset. One record
 * per ITT subject per component, in priority order, each carrying the value
 * the win-ratio comparison reads and a source link to the ADaM record it
 * came from. Pairs are never stored; the analysis forms them.
 */
import type { Dataset, VariableMeta } from "../../types";
import {
  column,
  number,
  rows,
  sourceLineage,
  string,
  table,
  type AnalysisRow,
} from "./shared";

/** One component of the DEMO-301 hierarchy and where its value comes from. */
interface HierarchyComponentSource {
  readonly paramcd: string;
  readonly param: string;
  readonly unit: string;
  readonly from:
    | { readonly dataset: "ADTTE"; readonly paramcd: string }
    | {
        readonly dataset: "ADVS";
        readonly paramcd: string;
        readonly visit: string;
      };
}

/** The DEMO-301 hierarchy, most important component first. */
const COMPONENTS: readonly HierarchyComponentSource[] = [
  {
    paramcd: "HCEDTH",
    param: "Death from Any Cause (days)",
    unit: "DAYS",
    from: { dataset: "ADTTE", paramcd: "TTDTH" },
  },
  {
    paramcd: "HCESAE",
    param: "First Serious TEAE (days)",
    unit: "DAYS",
    from: { dataset: "ADTTE", paramcd: "TTSAE" },
  },
  {
    paramcd: "HCERESC",
    param: "First Rescue Medication (days)",
    unit: "DAYS",
    from: { dataset: "ADTTE", paramcd: "TTRESC" },
  },
  {
    paramcd: "HCESBP",
    param: "SBP Change from Baseline at Week 12 (mmHg)",
    unit: "mmHg",
    from: { dataset: "ADVS", paramcd: "SYSBP", visit: "WEEK 12" },
  },
];

const ADHCE_VARIABLES: readonly VariableMeta[] = [
  column(
    "STUDYID",
    "Study Identifier",
    "text",
    "Predecessor",
    undefined,
    "ADSL.STUDYID"
  ),
  column(
    "USUBJID",
    "Unique Subject Identifier",
    "text",
    "Predecessor",
    undefined,
    "ADSL.USUBJID"
  ),
  column("ASEQ", "Analysis Sequence Number", "integer", "Assigned"),
  column("PARAMCD", "Parameter Code", "text", "Assigned"),
  column("PARAM", "Parameter", "text", "Assigned"),
  column("PARAMN", "Parameter (N)", "integer", "Assigned"),
  column("ADT", "Analysis Date", "date", "Derived", "ADHCE_COMPONENT"),
  column("AVAL", "Analysis Value", "float", "Derived", "ADHCE_COMPONENT"),
  column("AVALU", "Analysis Value Unit", "text", "Assigned"),
  column("CNSR", "Censor Flag", "integer", "Derived", "ADHCE_TTE"),
  column("ANL01FL", "Analysis Flag 01", "text", "Derived", "ADHCE_ANL"),
  column(
    "TRT01P",
    "Planned Treatment",
    "text",
    "Predecessor",
    undefined,
    "ADSL.TRT01P"
  ),
  column(
    "TRT01PN",
    "Planned Treatment Number",
    "integer",
    "Predecessor",
    undefined,
    "ADSL.TRT01PN"
  ),
  column(
    "ITTFL",
    "ITT Population Flag",
    "text",
    "Predecessor",
    undefined,
    "ADSL.ITTFL"
  ),
  column("SRCDOM", "Source Domain", "text", "Assigned"),
  column("SRCVAR", "Source Variable", "text", "Assigned"),
  column("SRCSEQ", "Source Sequence Number", "integer", "Assigned"),
];

interface SourceRow {
  readonly row: AnalysisRow;
  readonly lineage: readonly string[];
}

function index(
  dataset: Dataset,
  include: (row: AnalysisRow) => boolean
): Map<string, SourceRow> {
  const found = new Map<string, SourceRow>();
  rows(dataset).forEach((row, at) => {
    if (!include(row)) return;
    const key = `${string(row.USUBJID)}|${string(row.PARAMCD)}`;
    if (!found.has(key))
      found.set(key, { row, lineage: sourceLineage(dataset, at) });
  });
  return found;
}

/** Rounds to one decimal place, away from floating-point residue. */
function tenths(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

/** Derive ADHCE from ADSL, ADTTE and ADVS. */
export function deriveAdhce(
  adsl: Dataset,
  adtte: Dataset,
  advs: Dataset
): Dataset {
  const tte = index(adtte, () => true);
  const vs = index(
    advs,
    (row) =>
      row.ANL01FL === "Y" &&
      row.DTYPE === null &&
      COMPONENTS.some(
        ({ from }) =>
          from.dataset === "ADVS" &&
          row.PARAMCD === from.paramcd &&
          row.AVISIT === from.visit
      )
  );
  const output: AnalysisRow[] = [];
  const lineage: (readonly string[])[] = [];
  for (const [at, subject] of rows(adsl).entries()) {
    if (subject.ITTFL !== "Y") continue;
    const id = string(subject.USUBJID);
    COMPONENTS.forEach((component, priority) => {
      const source = (component.from.dataset === "ADTTE" ? tte : vs).get(
        `${id}|${component.from.paramcd}`
      );
      const value =
        component.from.dataset === "ADTTE"
          ? number(source?.row.AVAL)
          : tenths(number(source?.row.CHG));
      output.push({
        STUDYID: subject.STUDYID,
        USUBJID: id,
        ASEQ: priority + 1,
        PARAMCD: component.paramcd,
        PARAM: component.param,
        PARAMN: priority + 1,
        ADT: source?.row.ADT ?? null,
        AVAL: value,
        AVALU: component.unit,
        CNSR:
          component.from.dataset === "ADTTE" ? number(source?.row.CNSR) : null,
        ANL01FL: value === null ? null : "Y",
        TRT01P: subject.TRT01P,
        TRT01PN: subject.TRT01PN,
        ITTFL: subject.ITTFL,
        SRCDOM: source?.row.SRCDOM ?? null,
        SRCVAR: source?.row.SRCVAR ?? null,
        SRCSEQ: source?.row.SRCSEQ ?? null,
      });
      // A missing value still traces to the subject's own records.
      lineage.push(source?.lineage ?? sourceLineage(adsl, at));
    });
  }
  return table(
    "ADHCE",
    "Hierarchical Composite",
    {
      class: "BDS",
      structure: "One record per subject per hierarchy component",
      codelists: { PARAMCD: "ADHCE.PARAMCD" },
    },
    ADHCE_VARIABLES,
    output,
    lineage
  );
}
