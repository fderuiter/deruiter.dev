/** Evaluates ARS where clauses against ADaM records. */
import type {
  ArsCondition,
  ArsWhereClause,
  CellValue,
  Dataset,
} from "../../types";

/**
 * One record being tested: a row of an analysis dataset and, when that is
 * not ADSL itself, the subject's ADSL row, so a clause on ADSL can be
 * applied to any record.
 */
export interface RecordContext {
  readonly dataset: Dataset;
  readonly rowIndex: number;
  readonly adsl: Dataset;
  readonly adslIndex: number | null;
}

/**
 * The value of `dataset.variable` for a record: read from the record itself,
 * or from the subject's ADSL row when `dataset` is ADSL.
 *
 * @throws RangeError when `dataset` is neither the record's dataset nor ADSL.
 */
export function recordValue(
  context: RecordContext,
  dataset: string,
  variable: string
): CellValue {
  if (dataset === context.dataset.name) {
    return context.dataset.columns[variable]?.[context.rowIndex] ?? null;
  }
  if (dataset === context.adsl.name) {
    return context.adslIndex === null
      ? null
      : (context.adsl.columns[variable]?.[context.adslIndex] ?? null);
  }
  throw new RangeError(
    `A condition on ${dataset} cannot be applied to ${context.dataset.name} records.`
  );
}

function cell(context: RecordContext, condition: ArsCondition): CellValue {
  return recordValue(context, condition.dataset, condition.variable);
}

function compare(value: CellValue, target: string): number {
  if (typeof value === "number") {
    const number = Number(target);
    if (target.trim() === "" || !Number.isFinite(number)) {
      throw new RangeError(`Cannot compare a numeric value with "${target}".`);
    }
    return value - number;
  }
  const text = value ?? "";
  return text < target ? -1 : text > target ? 1 : 0;
}

function test(context: RecordContext, condition: ArsCondition): boolean {
  const value = cell(context, condition);
  const { comparator } = condition;
  if (value === null) return comparator === "NE" || comparator === "NOTIN";
  const [first] = condition.value;
  if (comparator === "IN" || comparator === "NOTIN") {
    const found = condition.value.some(
      (target) => compare(value, target) === 0
    );
    return comparator === "IN" ? found : !found;
  }
  if (condition.value.length !== 1 || first === undefined) {
    throw new RangeError(
      `${comparator} takes exactly one value, got ${condition.value.length}.`
    );
  }
  const order = compare(value, first);
  switch (comparator) {
    case "EQ":
      return order === 0;
    case "NE":
      return order !== 0;
    case "GT":
      return order > 0;
    case "GE":
      return order >= 0;
    case "LT":
      return order < 0;
    case "LE":
      return order <= 0;
  }
}

/** Whether a record satisfies a where clause. */
export function matchesWhereClause(
  context: RecordContext,
  clause: ArsWhereClause
): boolean {
  if ("condition" in clause) return test(context, clause.condition);
  const { logicalOperator, whereClauses } = clause.compoundExpression;
  if (logicalOperator === "NOT") {
    if (whereClauses.length !== 1) {
      throw new RangeError(
        `NOT takes exactly one where clause, got ${whereClauses.length}.`
      );
    }
    return !matchesWhereClause(context, whereClauses[0]);
  }
  return logicalOperator === "AND"
    ? whereClauses.every((inner) => matchesWhereClause(context, inner))
    : whereClauses.some((inner) => matchesWhereClause(context, inner));
}

/**
 * The rows of one ADaM dataset that satisfy an ARS where clause, such as an
 * analysis set, a group or a data subset. A condition on ADSL is applied to
 * each record through the subject's ADSL row.
 *
 * @param datasets - Datasets of a run; ADSL must be among them.
 * @param datasetName - The ADaM dataset to select from, for example `ADAE`.
 * @param clause - The where clause.
 * @returns Zero-based row indexes, in dataset order.
 * @throws RangeError when a dataset is missing, a condition names a dataset
 *   other than ADSL and `datasetName`, or a comparator has the wrong number
 *   of values.
 */
export function selectAdamRows(
  datasets: readonly Dataset[],
  datasetName: string,
  clause: ArsWhereClause
): readonly number[] {
  const find = (name: string) => {
    const found = datasets.find(
      (dataset) => dataset.layer === "adam" && dataset.name === name
    );
    if (!found) throw new RangeError(`The run has no ADaM dataset ${name}.`);
    return found;
  };
  const adsl = find("ADSL");
  const dataset = find(datasetName);
  const subjects = new Map<CellValue, number>();
  adsl.columns.USUBJID?.forEach((subject, index) =>
    subjects.set(subject, index)
  );
  const selected: number[] = [];
  for (let rowIndex = 0; rowIndex < dataset.rowCount; rowIndex += 1) {
    const context: RecordContext = {
      dataset,
      rowIndex,
      adsl,
      adslIndex:
        subjects.get(dataset.columns.USUBJID?.[rowIndex] ?? null) ?? null,
    };
    if (matchesWhereClause(context, clause)) selected.push(rowIndex);
  }
  return selected;
}
