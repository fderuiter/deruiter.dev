/**
 * Evaluates the win-ratio analyses of a reporting plan: the pairs decided
 * on each component of the hierarchical composite, and the win ratio, net
 * benefit, win odds and Finkelstein-Schoenfeld test of one arm against the
 * comparator. The statistics come from `winStatistics`; this module turns
 * ADHCE records into its subjects and names the rows behind each result:
 *
 * - wins and losses on a component: the ADHCE records, up to and including
 *   that component, of the subjects with a pair decided on it, since a
 *   pair reaches a component only by tying on every one before it;
 * - ties after a component: the records of every subject up to and
 *   including that component;
 * - the overall counts and statistics: every ADHCE record of both groups.
 *
 * Each result also names the ADSL rows of both groups.
 */
import type {
  ArsGroup,
  ArsGroupingFactor,
  ArsOperationResult,
  ArsResultGroup,
  ArsRowReference,
  CellValue,
  Dataset,
  WinRatioComponent,
  WinRatioResult,
  WinRatioSubject,
  WinStatisticEstimate,
} from "../../types";
import { formatPValue } from "./km-evaluate";
import {
  IDS,
  NET_BENEFIT_DECIMALS,
  WIN_RATIO_DECIMALS,
  stratumLabel,
  type AnalysisSpec,
  type HceComparison,
} from "./plan";
import type { RowSetRegistry } from "./row-sets";
import { formatDecimal } from "./stats";
import { matchesWhereClause, recordValue, type RecordContext } from "./where";
import { winStatistics } from "./win-ratio";

const NOT_ESTIMABLE = "NE";

/** Whether the win-ratio evaluator, not the table engine, runs a method. */
export function isWinRatioMethod(methodId: string): boolean {
  return (
    methodId === IDS.winComp ||
    methodId === IDS.winStat ||
    methodId === IDS.winStrata
  );
}

/** What the win-ratio evaluator needs from the engine for one analysis. */
export interface WinRatioInput {
  readonly spec: AnalysisSpec;
  /** Every grouping of the analysis, in order. */
  readonly factors: readonly ArsGroupingFactor[];
  /** ADSL records of the analysis set. */
  readonly population: readonly RecordContext[];
  /** ADHCE records of the analysis set and data subset. */
  readonly records: readonly RecordContext[];
  readonly adsl: Dataset;
  readonly data: Dataset;
  readonly registry: RowSetRegistry;
}

/** The components the engine compares on, from the analysis's hierarchy. */
function componentsOf(hierarchy: HceComparison): WinRatioComponent[] {
  return hierarchy.components.map((component) => ({
    id: component.paramcd,
    label: component.label,
    kind: component.kind,
    better: component.better,
    ...(component.margin === undefined ? {} : { margin: component.margin }),
  }));
}

interface Side {
  readonly population: readonly RecordContext[];
  readonly records: readonly RecordContext[];
}

function groupOf(factor: ArsGroupingFactor, id: string): ArsGroup {
  const found = factor.groups.find((group) => group.id === id);
  if (!found) throw new RangeError(`${factor.id} has no group ${id}.`);
  return found;
}

function subjectOf(record: RecordContext): string {
  return String(record.dataset.columns.USUBJID?.[record.rowIndex] ?? "");
}

function numeric(value: CellValue): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** One engine subject per ADSL subject, outcomes in hierarchy order. */
function subjectsOf(
  side: Side,
  group: WinRatioSubject["group"],
  dataset: string,
  variable: string,
  hierarchy: HceComparison,
  components: readonly WinRatioComponent[]
): WinRatioSubject[] {
  const bySubject = new Map<string, RecordContext[]>();
  for (const record of side.records) {
    const id = subjectOf(record);
    bySubject.set(id, [...(bySubject.get(id) ?? []), record]);
  }
  return side.population.map((subject) => {
    const id = subjectOf(subject);
    const records = bySubject.get(id) ?? [];
    return {
      id,
      group,
      ...(hierarchy.strata.length === 0
        ? {}
        : { stratum: stratumOf(subject, hierarchy) }),
      outcomes: components.map((component) => {
        const record = records.find(
          (item) => recordValue(item, dataset, "PARAMCD") === component.id
        );
        const value = record
          ? numeric(recordValue(record, dataset, variable))
          : null;
        if (component.kind !== "time-to-event" || value === null) {
          return { value };
        }
        const censor = recordValue(record!, dataset, "CNSR");
        // A time with no valid censoring flag cannot be compared.
        return censor === 0 || censor === 1
          ? { value, event: censor === 0 }
          : { value: null };
      }),
    };
  });
}

/** The label of the stratum an ADSL record's subject was randomised in. */
function stratumOf(subject: RecordContext, hierarchy: HceComparison): string {
  return stratumLabel(
    hierarchy.strata.map((factor) => {
      const value = recordValue(subject, "ADSL", factor.adslVariable);
      return value === null ? null : String(value);
    })
  );
}

function count(value: number): {
  readonly rawValue: string;
  readonly formattedValue: string;
} {
  return { rawValue: String(value), formattedValue: String(value) };
}

function decimal(
  value: number | null,
  decimals: number
): { readonly rawValue?: string; readonly formattedValue: string } {
  // An unbounded limit (a win ratio with no losses) is not estimable.
  return value === null || !Number.isFinite(value)
    ? { formattedValue: NOT_ESTIMABLE }
    : {
        rawValue: String(value),
        formattedValue: formatDecimal(value, decimals),
      };
}

function pValue(value: number | null): {
  readonly rawValue?: string;
  readonly formattedValue: string;
} {
  return value === null
    ? { formattedValue: NOT_ESTIMABLE }
    : { rawValue: String(value), formattedValue: formatPValue(value) };
}

interface OperationValue {
  readonly operationId: string;
  readonly rawValue?: string;
  readonly formattedValue: string;
}

function estimateValues(
  estimate: WinStatisticEstimate,
  ids: readonly [string, string, string],
  decimals: number
): OperationValue[] {
  return [
    { operationId: ids[0], ...decimal(estimate.estimate, decimals) },
    { operationId: ids[1], ...decimal(estimate.lower, decimals) },
    { operationId: ids[2], ...decimal(estimate.upper, decimals) },
  ];
}

/**
 * The results of one win-ratio analysis.
 *
 * @throws RangeError when the analysis has no comparison, the comparison
 *   names a group its treatment grouping lacks, or the method is not a
 *   win-ratio method.
 */
export function evaluateWinRatio(input: WinRatioInput): ArsOperationResult[] {
  const { spec, registry, adsl, data } = input;
  const comparison = spec.comparison;
  if (!comparison) {
    throw new RangeError(`${spec.id} does not say which groups it compares.`);
  }
  if (!isWinRatioMethod(spec.methodId)) {
    throw new RangeError(`${spec.methodId} is not a win-ratio method.`);
  }
  const hierarchy = spec.hierarchy;
  if (!hierarchy) {
    throw new RangeError(
      `${spec.id} does not say which hierarchy it compares.`
    );
  }
  const components = componentsOf(hierarchy);
  const factor = input.factors.find(
    (item) => item.id === comparison.groupingId
  );
  if (!factor) {
    throw new RangeError(
      `${spec.id} compares groups of ${comparison.groupingId}, which it does not group by.`
    );
  }
  const side = (groupId: string): Side => {
    const group = groupOf(factor, groupId);
    return {
      population: input.population.filter((record) =>
        matchesWhereClause(record, group)
      ),
      records: input.records.filter((record) =>
        matchesWhereClause(record, group)
      ),
    };
  };
  const treatment = side(comparison.treatmentGroupId);
  const control = side(comparison.controlGroupId);
  const both = [...treatment.records, ...control.records];
  const population = registry.reference(
    adsl,
    [...treatment.population, ...control.population].map(
      (record) => record.rowIndex
    ),
    "population"
  );
  const rows = (
    records: readonly RecordContext[]
  ): readonly ArsRowReference[] =>
    [
      population,
      registry.reference(
        data,
        records.map((record) => record.rowIndex),
        "analysis"
      ),
    ].filter((reference) => reference !== null);

  const subjects = [
    ...subjectsOf(
      treatment,
      "treatment",
      spec.dataset,
      spec.variable,
      hierarchy,
      components
    ),
    ...subjectsOf(
      control,
      "control",
      spec.dataset,
      spec.variable,
      hierarchy,
      components
    ),
  ];
  const result: WinRatioResult | null =
    treatment.population.length > 0 && control.population.length > 0
      ? winStatistics(subjects, {
          components,
          weighting: hierarchy.weighting,
        })
      : null;

  const results: ArsOperationResult[] = [];
  const push = (
    groups: readonly ArsResultGroup[],
    rowReferences: readonly ArsRowReference[],
    value: OperationValue
  ) =>
    results.push({
      id: `${spec.id}.${String(results.length + 1).padStart(3, "0")}`,
      operationId: value.operationId,
      resultGroups: groups,
      ...(value.rawValue === undefined ? {} : { rawValue: value.rawValue }),
      formattedValue: value.formattedValue,
      rowReferences,
    });

  if (spec.methodId === IDS.winComp) {
    const componentFactor = input.factors.find(
      (item) => item.groupingDataset === spec.dataset
    );
    if (!componentFactor) {
      throw new RangeError(`${spec.id} needs a grouping by component.`);
    }
    components.forEach((component, position) => {
      const group = componentFactor.groups.find(
        (item) =>
          // The group whose clause selects this component's records.
          "condition" in item && item.condition.value.includes(component.id)
      );
      if (!group) {
        throw new RangeError(
          `${componentFactor.id} has no group for ${component.id}.`
        );
      }
      const upTo = new Set(
        components.slice(0, position + 1).map((item) => item.id)
      );
      const recordsUpTo = (subjectIds: ReadonlySet<string> | null) =>
        both.filter(
          (record) =>
            upTo.has(String(recordValue(record, spec.dataset, "PARAMCD"))) &&
            (subjectIds === null || subjectIds.has(subjectOf(record)))
        );
      const decided = result?.components[position];
      const decidedRows = rows(
        recordsUpTo(new Set(decided?.decidingSubjectIds ?? []))
      );
      const groups = [{ groupingId: componentFactor.id, groupId: group.id }];
      push(groups, decidedRows, {
        operationId: IDS.winCompWins,
        ...count(decided?.wins ?? 0),
      });
      push(groups, decidedRows, {
        operationId: IDS.winCompLosses,
        ...count(decided?.losses ?? 0),
      });
      push(groups, rows(recordsUpTo(null)), {
        operationId: IDS.winCompTies,
        ...count(decided?.tiesAfter ?? 0),
      });
    });
    return results;
  }

  if (spec.methodId === IDS.winStrata) {
    const stratumFactor = input.factors.find(
      (item) => item.id === IDS.hceStratum
    );
    if (!stratumFactor) {
      throw new RangeError(`${spec.id} needs a grouping by stratum.`);
    }
    for (const group of stratumFactor.groups) {
      const inStratum = both.filter((record) =>
        matchesWhereClause(record, group)
      );
      const stratumPopulation = [
        ...treatment.population,
        ...control.population,
      ].filter((record) => matchesWhereClause(record, group));
      const counted = result?.strata.find(
        (stratum) => stratum.stratum === group.name
      );
      const groups = [{ groupingId: stratumFactor.id, groupId: group.id }];
      const stratumRows = [
        registry.reference(
          adsl,
          stratumPopulation.map((record) => record.rowIndex),
          "population"
        ),
        registry.reference(
          data,
          inStratum.map((record) => record.rowIndex),
          "analysis"
        ),
      ].filter((reference) => reference !== null);
      push(groups, stratumRows, {
        operationId: IDS.winStrataPairs,
        ...count(counted?.pairs ?? 0),
      });
      push(groups, stratumRows, {
        operationId: IDS.winStrataWins,
        ...count(counted?.wins ?? 0),
      });
      push(groups, stratumRows, {
        operationId: IDS.winStrataLosses,
        ...count(counted?.losses ?? 0),
      });
      push(groups, stratumRows, {
        operationId: IDS.winStrataTies,
        ...count(counted?.ties ?? 0),
      });
    }
    return results;
  }

  const everything = rows(both);
  const values: OperationValue[] = [
    { operationId: IDS.winPairs, ...count(result?.pairs ?? 0) },
    { operationId: IDS.winWins, ...count(result?.wins ?? 0) },
    { operationId: IDS.winLosses, ...count(result?.losses ?? 0) },
    { operationId: IDS.winTies, ...count(result?.ties ?? 0) },
  ];
  const none: WinStatisticEstimate = {
    estimate: null,
    lower: null,
    upper: null,
    standardError: null,
    zStatistic: null,
    pValue: null,
  };
  const winRatio = result?.winRatio ?? none;
  values.push(
    ...estimateValues(
      winRatio,
      [IDS.winRatio, IDS.winRatioLcl, IDS.winRatioUcl],
      WIN_RATIO_DECIMALS
    ),
    { operationId: IDS.winRatioP, ...pValue(winRatio.pValue) },
    ...estimateValues(
      result?.netBenefit ?? none,
      [IDS.netBenefit, IDS.netBenefitLcl, IDS.netBenefitUcl],
      NET_BENEFIT_DECIMALS
    ),
    ...estimateValues(
      result?.winOdds ?? none,
      [IDS.winOdds, IDS.winOddsLcl, IDS.winOddsUcl],
      WIN_RATIO_DECIMALS
    ),
    {
      operationId: IDS.fsZ,
      ...decimal(result?.finkelsteinSchoenfeld.zStatistic ?? null, 2),
    },
    {
      operationId: IDS.fsP,
      ...pValue(result?.finkelsteinSchoenfeld.pValue ?? null),
    }
  );
  for (const value of values) push([], everything, value);
  return results;
}
