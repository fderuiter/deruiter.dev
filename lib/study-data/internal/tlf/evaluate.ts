/**
 * The analysis engine: runs every analysis of a reporting plan against the
 * ADaM datasets of a run and records, for every result, the ADaM rows it was
 * computed from. Time-to-event methods are handed to `km-evaluate.ts`, and
 * win-ratio methods to `win-evaluate.ts`, with the same populations,
 * records and row sets.
 *
 * Populations come from ADSL through the analysis set and the subject-level
 * groupings, so every result links to the ADSL rows of its denominator
 * (`population`) as well as to the records it counted or summarised
 * (`analysis`). Rows are linked through deduplicated row sets, which keeps
 * the JSON small when many results share a population.
 */
import type {
  ArsAnalysis,
  ArsAnalysisMethod,
  ArsGroup,
  ArsGroupingFactor,
  ArsOperationResult,
  ArsResultGroup,
  ArsRowSet,
  CellValue,
  Dataset,
} from "../../types";
import {
  atRiskReference,
  evaluateTimeToEvent,
  isTimeToEventMethod,
} from "./km-evaluate";
import type { AnalysisSpec, ReportingPlan } from "./plan";
import { IDS, SUMMARY_OPERATIONS } from "./plan";
import { RowSetRegistry } from "./row-sets";
import {
  descriptiveStatistics,
  formatDecimal,
  formatPercent,
  inferDecimalPlaces,
  statisticDecimals,
} from "./stats";
import { matchesWhereClause, recordValue, type RecordContext } from "./where";
import { evaluateWinRatio, isWinRatioMethod } from "./win-evaluate";

/** Analyses with results, and the row sets they refer to. */
export interface Evaluation {
  readonly analyses: readonly ArsAnalysis[];
  readonly rowSets: readonly ArsRowSet[];
}

interface OperationValue {
  readonly operationId: string;
  readonly rawValue?: string;
  readonly formattedValue: string;
}

/** One cell of the cross-classification an analysis is evaluated over. */
interface Combination {
  readonly groups: readonly ArsResultGroup[];
  readonly prespecified: readonly (readonly [ArsGroupingFactor, ArsGroup])[];
  readonly observed: readonly (readonly [ArsGroupingFactor, string])[];
}

const NOT_ESTIMABLE = "NE";

function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function byId<T extends { readonly id: string }>(
  items: readonly T[],
  kind: string
): (id: string) => T {
  const map = new Map(items.map((item) => [item.id, item]));
  return (id) => {
    const item = map.get(id);
    if (!item) throw new RangeError(`The plan has no ${kind} ${id}.`);
    return item;
  };
}

function text(value: CellValue): string | null {
  if (value === null) return null;
  return typeof value === "number" ? String(value) : value || null;
}

function groupKey(groups: readonly ArsResultGroup[]): string {
  return groups
    .map(
      (group) =>
        `${group.groupingId}=${group.groupId ?? `value:${group.groupValue ?? ""}`}`
    )
    .join("&");
}

function combinations(
  factors: readonly ArsGroupingFactor[],
  records: readonly RecordContext[]
): Combination[] {
  const prespecified = factors.filter((factor) => !factor.dataDriven);
  const observed = factors.filter((factor) => factor.dataDriven);
  const firstObserved = factors.findIndex((factor) => factor.dataDriven);
  if (
    firstObserved !== -1 &&
    factors.slice(firstObserved).some((factor) => !factor.dataDriven)
  ) {
    throw new RangeError(
      "Data-driven groupings must follow the pre-specified ones."
    );
  }
  const tuples = new Map<string, readonly string[]>();
  if (observed.length > 0) {
    for (const record of records) {
      const values = observed.map((factor) =>
        text(
          recordValue(record, factor.groupingDataset, factor.groupingVariable)
        )
      );
      if (values.some((value) => value === null)) continue;
      const tuple = values as string[];
      tuples.set(tuple.join("\u0000"), tuple);
    }
  }
  const observedTuples =
    observed.length === 0
      ? [[]]
      : [...tuples.values()].sort((a, b) => {
          for (let index = 0; index < a.length; index += 1) {
            const order = compareCodePoints(a[index], b[index]);
            if (order !== 0) return order;
          }
          return 0;
        });
  let partial: (readonly (readonly [ArsGroupingFactor, ArsGroup])[])[] = [[]];
  for (const factor of prespecified) {
    partial = partial.flatMap((prefix) =>
      factor.groups.map((group) => [...prefix, [factor, group] as const])
    );
  }
  return partial.flatMap((pairs) =>
    observedTuples.map((tuple) => {
      const values = observed.map(
        (factor, index) => [factor, tuple[index]] as const
      );
      return {
        prespecified: pairs,
        observed: values,
        groups: [
          ...pairs.map(([factor, group]) => ({
            groupingId: factor.id,
            groupId: group.id,
          })),
          ...values.map(([factor, value]) => ({
            groupingId: factor.id,
            groupValue: value,
          })),
        ],
      };
    })
  );
}

function inCombination(
  record: RecordContext,
  combination: Combination
): boolean {
  return (
    combination.prespecified.every(([, group]) =>
      matchesWhereClause(record, group)
    ) &&
    combination.observed.every(
      ([factor, value]) =>
        text(
          recordValue(record, factor.groupingDataset, factor.groupingVariable)
        ) === value
    )
  );
}

function distinctSubjects(records: readonly RecordContext[]): number {
  return new Set(
    records.map((record) => record.dataset.columns.USUBJID?.[record.rowIndex])
  ).size;
}

/** An analysis spec without the fields that extend the ARS class. */
function arsShape(
  spec: AnalysisSpec
): Omit<AnalysisSpec, "precisionVariable" | "comparison" | "hierarchy"> {
  const {
    precisionVariable: _precisionVariable,
    comparison: _comparison,
    hierarchy: _hierarchy,
    ...shape
  } = spec;
  return shape;
}

function numeric(value: CellValue): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Runs every analysis in the plan, in order. An analysis whose percentages
 * use another analysis's counts must come after it.
 *
 * @throws RangeError when the plan names something it does not define, a
 *   dataset is missing, or a denominator cannot be found.
 */
export function evaluateAnalyses(
  datasets: readonly Dataset[],
  plan: ReportingPlan
): Evaluation {
  const adamByName = new Map(
    datasets
      .filter((dataset) => dataset.layer === "adam")
      .map((dataset) => [dataset.name, dataset])
  );
  const dataset = (name: string): Dataset => {
    const found = adamByName.get(name);
    if (!found) throw new RangeError(`The run has no ADaM dataset ${name}.`);
    return found;
  };
  const adsl = dataset("ADSL");
  const adslBySubject = new Map<CellValue, number>();
  adsl.columns.USUBJID?.forEach((subject, index) =>
    adslBySubject.set(subject, index)
  );
  const analysisSet = byId(plan.analysisSets, "analysis set");
  const grouping = byId(plan.analysisGroupings, "grouping factor");
  const dataSubset = byId(plan.dataSubsets, "data subset");
  const method = byId(plan.methods, "method");
  const registry = new RowSetRegistry();
  const done = new Map<string, ArsAnalysis>();
  const resultsByKey = new Map<string, ArsOperationResult>();

  for (const spec of plan.analyses) {
    const analysisMethod: ArsAnalysisMethod = method(spec.methodId);
    const set = analysisSet(spec.analysisSetId);
    const data = dataset(spec.dataset);
    const population: RecordContext[] = [];
    for (let index = 0; index < adsl.rowCount; index += 1) {
      const context = {
        dataset: adsl,
        rowIndex: index,
        adsl,
        adslIndex: index,
      };
      if (matchesWhereClause(context, set)) population.push(context);
    }
    const subjects = new Set(
      population.map((record) => adsl.columns.USUBJID?.[record.rowIndex])
    );
    const subset = spec.dataSubsetId ? dataSubset(spec.dataSubsetId) : null;
    const records: RecordContext[] = [];
    for (let index = 0; index < data.rowCount; index += 1) {
      const subject = data.columns.USUBJID?.[index] ?? null;
      if (!subjects.has(subject)) continue;
      const context: RecordContext = {
        dataset: data,
        rowIndex: index,
        adsl,
        adslIndex: adslBySubject.get(subject) ?? null,
      };
      if (subset && !matchesWhereClause(context, subset)) continue;
      records.push(context);
    }
    const factors = spec.orderedGroupings
      .filter((ordered) => ordered.resultsByGroup)
      .sort((a, b) => a.order - b.order)
      .map((ordered) => grouping(ordered.groupingId));
    if (isTimeToEventMethod(spec.methodId) || isWinRatioMethod(spec.methodId)) {
      const input = {
        spec,
        factors: [...spec.orderedGroupings]
          .sort((a, b) => a.order - b.order)
          .map((ordered) => grouping(ordered.groupingId)),
        population,
        records,
        adsl,
        data,
        registry,
      };
      done.set(spec.id, {
        ...arsShape(spec),
        results: isWinRatioMethod(spec.methodId)
          ? evaluateWinRatio(input)
          : evaluateTimeToEvent(input),
      });
      continue;
    }
    const rawDecimals =
      spec.methodId === IDS.summ
        ? inferDecimalPlaces(
            records.flatMap((record) => {
              const value = numeric(
                recordValue(
                  record,
                  spec.dataset,
                  spec.precisionVariable ?? spec.variable
                )
              );
              return value === null ? [] : [value];
            })
          )
        : undefined;

    // The population of a result is its denominator: the analysis set within
    // the groups of the denominator analysis when there is one (a count of
    // women is a share of the treatment group, not of the women), otherwise
    // within every subject-level group.
    const denominatorSource = spec.referencedAnalysisOperations?.find(
      (item) => item.referencedOperationRelationshipId === IDS.countPctDen
    );
    const denominatorGroupings = denominatorSource
      ? new Set(
          done
            .get(denominatorSource.analysisId)
            ?.orderedGroupings.map((ordered) => ordered.groupingId) ?? []
        )
      : null;
    const results: ArsOperationResult[] = [];
    for (const combination of combinations(factors, records)) {
      const populationRows = population.filter((record) =>
        combination.prespecified.every(
          ([factor, group]) =>
            factor.groupingDataset !== adsl.name ||
            (denominatorGroupings !== null &&
              !denominatorGroupings.has(factor.id)) ||
            matchesWhereClause(record, group)
        )
      );
      const cellRecords = records.filter((record) =>
        inCombination(record, combination)
      );
      let analysed = cellRecords;
      let values: OperationValue[];
      if (spec.methodId === IDS.count) {
        values = [
          {
            operationId: IDS.countN,
            rawValue: String(distinctSubjects(cellRecords)),
            formattedValue: String(distinctSubjects(cellRecords)),
          },
        ];
      } else if (spec.methodId === IDS.countPct) {
        const denominator = denominatorFor(spec, combination.groups);
        const n = distinctSubjects(cellRecords);
        const percent = formatPercent(n, denominator);
        values = [
          {
            operationId: IDS.countPctN,
            rawValue: String(n),
            formattedValue: String(n),
          },
          {
            operationId: IDS.countPctPct,
            ...(percent === null
              ? {}
              : { rawValue: String((n * 100) / denominator) }),
            formattedValue: percent ?? NOT_ESTIMABLE,
          },
        ];
      } else if (spec.methodId === IDS.summ) {
        analysed = cellRecords.filter(
          (record) =>
            numeric(recordValue(record, spec.dataset, spec.variable)) !== null
        );
        const stats = descriptiveStatistics(
          analysed.map((record) =>
            numeric(recordValue(record, spec.dataset, spec.variable))!
          ),
          rawDecimals
        );
        values = SUMMARY_OPERATIONS.map((operation) => {
          const value = stats[operation.kind];
          return value === null
            ? { operationId: operation.id, formattedValue: NOT_ESTIMABLE }
            : {
                operationId: operation.id,
                rawValue: String(value),
                formattedValue: formatDecimal(
                  value,
                  statisticDecimals(operation.kind, stats.rawDecimals)
                ),
              };
        });
      } else {
        throw new RangeError(
          `The engine has no evaluator for method ${analysisMethod.id}.`
        );
      }
      // A number-at-risk count is a Kaplan-Meier risk set, and names its
      // rows the way the Kaplan-Meier results do (#2729).
      const atRiskDay = combination.prespecified.find(
        ([factor]) => factor.id === IDS.atRiskDay
      )?.[0];
      const rowReferences = [
        registry.reference(
          adsl,
          populationRows.map((record) => record.rowIndex),
          "population"
        ),
        atRiskDay
          ? atRiskReference(
              registry,
              data,
              analysed,
              atRiskDay.groupingVariable
            )
          : registry.reference(
              data,
              analysed.map((record) => record.rowIndex),
              "analysis"
            ),
      ].filter((reference) => reference !== null);
      for (const value of values) {
        const result: ArsOperationResult = {
          id: `${spec.id}.${String(results.length + 1).padStart(3, "0")}`,
          operationId: value.operationId,
          resultGroups: combination.groups,
          ...(value.rawValue === undefined ? {} : { rawValue: value.rawValue }),
          formattedValue: value.formattedValue,
          rowReferences,
        };
        results.push(result);
        resultsByKey.set(
          `${spec.id}|${value.operationId}|${groupKey(combination.groups)}`,
          result
        );
      }
    }
    const analysis: ArsAnalysis = {
      ...arsShape(spec),
      ...(rawDecimals === undefined ? {} : { rawDecimals }),
      results,
    };
    done.set(spec.id, analysis);
  }

  function denominatorFor(
    spec: AnalysisSpec,
    groups: readonly ArsResultGroup[]
  ): number {
    const reference = spec.referencedAnalysisOperations?.find(
      (item) => item.referencedOperationRelationshipId === IDS.countPctDen
    );
    const source = reference ? done.get(reference.analysisId) : undefined;
    if (!reference || !source) {
      throw new RangeError(
        `${spec.id} needs its denominator analysis to run before it.`
      );
    }
    const sourceGroupings = new Set(
      source.orderedGroupings.map((ordered) => ordered.groupingId)
    );
    const key = groupKey(
      groups.filter((group) => sourceGroupings.has(group.groupingId))
    );
    const result = resultsByKey.get(`${source.id}|${IDS.countN}|${key}`);
    if (!result?.rawValue) {
      throw new RangeError(
        `${spec.id} has no denominator in ${source.id} for ${key}.`
      );
    }
    return Number(result.rawValue);
  }

  return { analyses: [...done.values()], rowSets: registry.all() };
}

/** Finds results by analysis, operation and groups. */
export class ResultIndex {
  private readonly byKey = new Map<string, ArsOperationResult>();

  constructor(analyses: readonly ArsAnalysis[]) {
    for (const analysis of analyses) {
      for (const result of analysis.results) {
        this.byKey.set(
          `${analysis.id}|${result.operationId}|${groupKey(result.resultGroups)}`,
          result
        );
      }
    }
  }

  /**
   * The result of one operation for one combination of groups.
   *
   * @throws RangeError when there is no such result.
   */
  get(
    analysisId: string,
    operationId: string,
    groups: readonly ArsResultGroup[]
  ): ArsOperationResult {
    const key = `${analysisId}|${operationId}|${groupKey(groups)}`;
    const result = this.byKey.get(key);
    if (!result) throw new RangeError(`No result ${key}.`);
    return result;
  }
}
