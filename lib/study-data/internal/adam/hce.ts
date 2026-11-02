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
  withMethods,
  type AnalysisRow,
} from "./shared";
import { DEMO_301_HIERARCHY, type HierarchySpec } from "./hierarchy";

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

/**
 * Derive ADHCE from ADSL, ADTTE and the findings datasets the study's
 * hierarchy spec reads: ADVS for DEMO-301, ADQS for the device study.
 */
export function deriveAdhce(
  adsl: Dataset,
  adtte: Dataset,
  findings: readonly Dataset[],
  spec: HierarchySpec = DEMO_301_HIERARCHY
): Dataset {
  const tte = index(adtte, () => true);
  const continuous = new Map(
    (["ADVS", "ADQS"] as const).map((name) => {
      const dataset = findings.find((each) => each.name === name);
      const found = dataset
        ? index(
            dataset,
            (row) =>
              row.ANL01FL === "Y" &&
              row.DTYPE === null &&
              spec.components.some(
                ({ from }) =>
                  from.dataset === name &&
                  row.PARAMCD === from.paramcd &&
                  row.AVISIT === from.visit
              )
          )
        : new Map<string, SourceRow>();
      return [name, found] as const;
    })
  );
  const output: AnalysisRow[] = [];
  const lineage: (readonly string[])[] = [];
  for (const [at, subject] of rows(adsl).entries()) {
    if (subject.ITTFL !== "Y") continue;
    const id = string(subject.USUBJID);
    spec.components.forEach((component, priority) => {
      const source = (
        component.from.dataset === "ADTTE"
          ? tte
          : continuous.get(component.from.dataset)!
      ).get(`${id}|${component.from.paramcd}`);
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
    withMethods(ADHCE_VARIABLES, { ADHCE_COMPONENT: spec.methods.component }),
    output,
    lineage
  );
}
