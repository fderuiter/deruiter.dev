import type { CellValue, Dataset, VariableMeta } from "../../types";
import type { CodelistId } from "@/lib/clinical-standards";
import type { AdamMethodId } from "./specs";

export type AnalysisRow = Record<string, CellValue>;

export function rows(dataset: Dataset | undefined): AnalysisRow[] {
  if (!dataset) return [];
  return Array.from({ length: dataset.rowCount }, (_, index) =>
    Object.fromEntries(
      dataset.variables.map(({ name }) => [
        name,
        dataset.columns[name]?.[index] ?? null,
      ])
    )
  );
}

export function string(value: CellValue | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function number(value: CellValue | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function date(value: CellValue | undefined): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
    ? null
    : value;
}

export function addDays(value: string, count: number): string {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + count);
  return parsed.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string): number {
  return (
    (Date.parse(`${end}T00:00:00.000Z`) -
      Date.parse(`${start}T00:00:00.000Z`)) /
    86_400_000
  );
}

export function column(
  name: string,
  label: string,
  type: VariableMeta["type"] = "text",
  origin: VariableMeta["origin"] = "Derived",
  method?: AdamMethodId,
  source?: string
): VariableMeta {
  return {
    name,
    label,
    type,
    origin,
    ...(type === "text" ? { length: 80 } : {}),
    ...(method ? { method } : {}),
    ...(source ? { source } : {}),
  };
}

/**
 * Variables with some methods replaced, for a study whose derivation a
 * different method describes. Variables citing no replaced method are
 * returned as they are.
 */
export function withMethods(
  variables: readonly VariableMeta[],
  replacements: Readonly<Partial<Record<AdamMethodId, AdamMethodId>>>
): readonly VariableMeta[] {
  return variables.map((variable) => {
    const method = variable.method as AdamMethodId | undefined;
    const replacement = method ? replacements[method] : undefined;
    return replacement && replacement !== method
      ? { ...variable, method: replacement }
      : variable;
  });
}

/** Codelists of ADaM variables that every dataset shares. */
const ADAM_CODELISTS: Readonly<Record<string, CodelistId>> = {
  SAFFL: "NY",
  ITTFL: "NY",
  EFFFL: "NY",
  ABLFL: "NY",
  ANL01FL: "NY",
  TRTEMFL: "NY",
  AOCCFL: "NY",
  AOCCSFL: "NY",
  AOCCPFL: "NY",
  AESER: "NY",
  AEACN: "ACN",
  SEX: "SEX",
  RACE: "RACEC",
  AGEGR1: "AGEGR1",
  EOSSTT: "SBJTSTAT",
  DTYPE: "DTYPE",
  ANRIND: "NRIND",
  BNRIND: "NRIND",
  ASTDTF: "DATEFL",
  AENDTF: "DATEFL",
};

/** How an ADaM dataset is classified and what one record represents. */
export interface AdamLayout {
  /** ADaM class, for example `BDS`. */
  readonly class: string;
  /** ADaM subclass, for example `TIME-TO-EVENT`. */
  readonly subClass?: string;
  /** What one record represents. */
  readonly structure: string;
  /** Codelists of this dataset's own variables, over the shared ones. */
  readonly codelists?: Readonly<Record<string, CodelistId>>;
}

export function table(
  name: string,
  label: string,
  layout: AdamLayout,
  variables: readonly VariableMeta[],
  data: readonly AnalysisRow[],
  lineage: readonly (readonly string[])[],
  keys: readonly string[] = ["STUDYID", "USUBJID", "ASEQ"]
): Dataset {
  const columns: Record<string, CellValue[]> = {};
  for (const variable of variables) {
    columns[variable.name] = data.map((row) => row[variable.name] ?? null);
  }
  const codelists = { ...ADAM_CODELISTS, ...layout.codelists };
  return {
    name,
    label,
    layer: "adam",
    class: layout.class,
    ...(layout.subClass ? { subClass: layout.subClass } : {}),
    structure: layout.structure,
    keys,
    variables: variables.map((variable) => {
      const codelist = codelists[variable.name];
      return codelist ? { ...variable, codelist } : variable;
    }),
    columns,
    rowCount: data.length,
    lineage,
  };
}

export function sourceLineage(
  dataset: Dataset | undefined,
  index: number
): readonly string[] {
  return dataset?.lineage?.[index] ?? [];
}
