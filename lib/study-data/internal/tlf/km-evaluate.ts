/**
 * Evaluates the time-to-event analyses of a reporting plan: the
 * Kaplan-Meier estimate by treatment group and the log-rank test across
 * groups. Like the rest of the engine, every result names the ADaM rows it
 * was computed from:
 *
 * - n at risk at t: the ADTTE records whose AVAL is t or later. Each
 *   risk set is written as the events and censorings at t plus the risk
 *   set at the next time, so a record is listed once however many risk
 *   sets it belongs to (#2729);
 * - n events and n censored at t: the records with that outcome at t;
 * - the estimate, its standard error and limits: every analysable record
 *   of the group, which is what the product-limit estimate at t is
 *   computed from (each record is either still at risk or has left the
 *   risk set by then);
 * - the log-rank results: every analysable record of every group.
 *
 * Each result also names the ADSL rows of its population.
 */
import type {
  ArsGroupingFactor,
  ArsOperationResult,
  ArsResultGroup,
  ArsRowReference,
  CellValue,
  Dataset,
  KaplanMeierStep,
  SurvivalObservation,
} from "../../types";
import { kaplanMeierEstimate, logRankTest } from "./km";
import { IDS, KM_DECIMALS, KM_OPERATIONS, type AnalysisSpec } from "./plan";
import type { RowSetRegistry } from "./row-sets";
import { formatDecimal } from "./stats";
import { matchesWhereClause, recordValue, type RecordContext } from "./where";

/** Variable whose value 0 marks an event and 1 a censored time. */
const CENSOR_VARIABLE = "CNSR";

const NOT_ESTIMABLE = "NE";

/** Whether the time-to-event evaluator, not the table engine, runs a method. */
export function isTimeToEventMethod(methodId: string): boolean {
  return methodId === IDS.km || methodId === IDS.logRank;
}

/**
 * A p-value to four decimals, or `<0.0001` when it would print as zero.
 *
 * @throws RangeError when the value is not a probability.
 */
export function formatPValue(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`A p-value must be from 0 to 1, got ${value}.`);
  }
  return value < 0.00005 ? "<0.0001" : formatDecimal(value, 4);
}

/** What the time-to-event evaluator needs from the engine for one analysis. */
export interface TimeToEventInput {
  readonly spec: AnalysisSpec;
  /** Every grouping of the analysis, in order, whether or not it has results by group. */
  readonly factors: readonly ArsGroupingFactor[];
  /** ADSL records of the analysis set. */
  readonly population: readonly RecordContext[];
  /** Analysis records of the analysis set and data subset. */
  readonly records: readonly RecordContext[];
  readonly adsl: Dataset;
  readonly data: Dataset;
  readonly registry: RowSetRegistry;
}

interface Analysable {
  readonly record: RecordContext;
  readonly observation: SurvivalObservation;
}

function observationOf(
  record: RecordContext,
  dataset: string,
  variable: string
): SurvivalObservation | null {
  const time: CellValue = recordValue(record, dataset, variable);
  const censor: CellValue = recordValue(record, dataset, CENSOR_VARIABLE);
  if (typeof time !== "number" || !Number.isFinite(time) || time < 0) {
    return null;
  }
  if (censor !== 0 && censor !== 1) return null;
  return { time, event: censor === 0 };
}

interface ArmData {
  readonly groups: readonly ArsResultGroup[];
  readonly population: readonly RecordContext[];
  readonly analysable: readonly Analysable[];
}

function arms(input: TimeToEventInput): {
  readonly factor: ArsGroupingFactor;
  readonly arms: readonly ArmData[];
} {
  const [factor] = input.factors;
  if (!factor || factor.dataDriven) {
    throw new RangeError(
      `${input.spec.id} needs a pre-specified treatment grouping first.`
    );
  }
  const analysable: Analysable[] = input.records.flatMap((record) => {
    const observation = observationOf(
      record,
      input.spec.dataset,
      input.spec.variable
    );
    return observation ? [{ record, observation }] : [];
  });
  return {
    factor,
    arms: factor.groups.map((group) => ({
      groups: [{ groupingId: factor.id, groupId: group.id }],
      population: input.population.filter((record) =>
        matchesWhereClause(record, group)
      ),
      analysable: analysable.filter((item) =>
        matchesWhereClause(item.record, group)
      ),
    })),
  };
}

function withPopulation(
  input: TimeToEventInput,
  population: readonly RecordContext[],
  analysis: ArsRowReference | null
): readonly ArsRowReference[] {
  return [
    input.registry.reference(
      input.adsl,
      population.map((record) => record.rowIndex),
      "population"
    ),
    analysis,
  ].filter((reference) => reference !== null);
}

/** The Kaplan-Meier risk sets of some records, as row sets. */
interface RiskSets {
  /** Every record: the risk set at the first observed time. */
  readonly all: ArsRowReference | null;
  /** The records with this outcome at exactly this time. */
  at(time: number, event: boolean): ArsRowReference | null;
  /** The records whose time is this time or later. */
  from(time: number): ArsRowReference | null;
}

/**
 * Registers the risk sets of some records. The risk set at an observed
 * time t is written as the events at t, the censorings at t and the risk
 * set at the next observed time, so a record is listed once however many
 * risk sets hold it (#2729). A risk set depends only on the records at or
 * after its time, so any two calls that share those records share the set.
 */
function riskSets(
  registry: RowSetRegistry,
  data: Dataset,
  analysable: readonly Analysable[]
): RiskSets {
  const rowsByTime = new Map<
    number,
    { readonly events: number[]; readonly censored: number[] }
  >();
  for (const { record, observation } of analysable) {
    let rows = rowsByTime.get(observation.time);
    if (!rows) {
      rows = { events: [], censored: [] };
      rowsByTime.set(observation.time, rows);
    }
    (observation.event ? rows.events : rows.censored).push(record.rowIndex);
  }
  const times = [...rowsByTime.keys()].sort((a, b) => a - b);
  const sets = new Map<
    number,
    {
      readonly events: ArsRowReference | null;
      readonly censored: ArsRowReference | null;
      readonly from: ArsRowReference | null;
    }
  >();
  // Building from the last time back lets each risk set include the next.
  let next: ArsRowReference | null = null;
  for (const time of [...times].reverse()) {
    const rows = rowsByTime.get(time)!;
    const events = registry.reference(data, rows.events, "analysis");
    const censored = registry.reference(data, rows.censored, "analysis");
    next = registry.union(data, [], [events, censored, next], "analysis");
    sets.set(time, { events, censored, from: next });
  }
  return {
    all: next,
    at(time, event) {
      const set = sets.get(time);
      return set ? (event ? set.events : set.censored) : null;
    },
    from(time) {
      // The first observed time on or after `time`.
      let low = 0;
      let high = times.length;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (times[middle] < time) low = middle + 1;
        else high = middle;
      }
      return low < times.length ? sets.get(times[low])!.from : null;
    },
  };
}

/**
 * The analysis rows of a number-at-risk count: the Kaplan-Meier risk set
 * of its records, so the count and the Kaplan-Meier results at the same
 * time share one row set (#2729). When a record has no valid time or
 * censoring flag it cannot be placed in a risk set, and the rows are
 * listed instead.
 *
 * @param timeVariable - The time variable of `data`, such as AVAL.
 * @returns `null` when there are no records.
 */
export function atRiskReference(
  registry: RowSetRegistry,
  data: Dataset,
  records: readonly RecordContext[],
  timeVariable: string
): ArsRowReference | null {
  const analysable = records.flatMap((record) => {
    const observation = observationOf(record, data.name, timeVariable);
    return observation ? [{ record, observation }] : [];
  });
  return analysable.length === records.length
    ? riskSets(registry, data, analysable).all
    : registry.reference(
        data,
        records.map((record) => record.rowIndex),
        "analysis"
      );
}

function estimateText(value: number | null): {
  readonly rawValue?: string;
  readonly formattedValue: string;
} {
  return value === null
    ? { formattedValue: NOT_ESTIMABLE }
    : {
        rawValue: String(value),
        formattedValue: formatDecimal(value, KM_DECIMALS),
      };
}

function countText(value: number): {
  readonly rawValue: string;
  readonly formattedValue: string;
} {
  return { rawValue: String(value), formattedValue: String(value) };
}

/** The origin of a curve: everyone at risk, no events, survival 1. */
function originStep(n: number): KaplanMeierStep {
  return {
    time: 0,
    atRisk: n,
    events: 0,
    censored: 0,
    survival: 1,
    standardError: 0,
    lower: null,
    upper: null,
  };
}

function kaplanMeierResults(input: TimeToEventInput): ArsOperationResult[] {
  const timeFactor = input.factors[1];
  if (!timeFactor?.dataDriven) {
    throw new RangeError(
      `${input.spec.id} needs a data-driven time grouping second.`
    );
  }
  const results: ArsOperationResult[] = [];
  for (const arm of arms(input).arms) {
    if (arm.analysable.length === 0) continue;
    const estimate = kaplanMeierEstimate(
      arm.analysable.map((item) => item.observation)
    );
    const sets = riskSets(input.registry, input.data, arm.analysable);
    const everything = withPopulation(input, arm.population, sets.all);
    for (const step of [originStep(estimate.n), ...estimate.steps]) {
      const rowsFor = {
        atRisk: withPopulation(input, arm.population, sets.from(step.time)),
        events: withPopulation(input, arm.population, sets.at(step.time, true)),
        censored: withPopulation(
          input,
          arm.population,
          sets.at(step.time, false)
        ),
      };
      const resultGroups: readonly ArsResultGroup[] = [
        ...arm.groups,
        { groupingId: timeFactor.id, groupValue: String(step.time) },
      ];
      for (const operation of KM_OPERATIONS) {
        const kind = operation.kind;
        const value =
          kind === "atRisk" || kind === "events" || kind === "censored"
            ? countText(step[kind])
            : estimateText(step[kind]);
        results.push({
          id: `${input.spec.id}.${String(results.length + 1).padStart(3, "0")}`,
          operationId: operation.id,
          resultGroups,
          ...value,
          rowReferences:
            kind === "atRisk" || kind === "events" || kind === "censored"
              ? rowsFor[kind]
              : everything,
        });
      }
    }
  }
  return results;
}

function logRankResults(input: TimeToEventInput): ArsOperationResult[] {
  const groups = arms(input).arms;
  const test = logRankTest(
    groups.map((arm) => arm.analysable.map((item) => item.observation))
  );
  // Every analysable record of every group: the union of each group's
  // risk sets, and of each group's population.
  const rowReferences = [
    input.registry.union(
      input.adsl,
      [],
      groups.map((arm) =>
        input.registry.reference(
          input.adsl,
          arm.population.map((record) => record.rowIndex),
          "population"
        )
      ),
      "population"
    ),
    input.registry.union(
      input.data,
      [],
      groups.map(
        (arm) => riskSets(input.registry, input.data, arm.analysable).all
      ),
      "analysis"
    ),
  ].filter((reference) => reference !== null);
  const values: readonly {
    readonly operationId: string;
    readonly rawValue?: string;
    readonly formattedValue: string;
  }[] = [
    {
      operationId: IDS.logRankChiSq,
      ...(test.chiSquare === null
        ? { formattedValue: NOT_ESTIMABLE }
        : {
            rawValue: String(test.chiSquare),
            formattedValue: formatDecimal(test.chiSquare, 2),
          }),
    },
    { operationId: IDS.logRankDf, ...countText(test.degreesOfFreedom) },
    {
      operationId: IDS.logRankP,
      ...(test.pValue === null
        ? { formattedValue: NOT_ESTIMABLE }
        : {
            rawValue: String(test.pValue),
            formattedValue: formatPValue(test.pValue),
          }),
    },
  ];
  return values.map((value, index) => ({
    id: `${input.spec.id}.${String(index + 1).padStart(3, "0")}`,
    ...value,
    resultGroups: [],
    rowReferences,
  }));
}

/**
 * The results of one time-to-event analysis.
 *
 * @throws RangeError when the method is not a time-to-event method or the
 *   analysis does not group by a pre-specified treatment factor (and, for
 *   the estimate, a data-driven time factor after it).
 */
export function evaluateTimeToEvent(
  input: TimeToEventInput
): ArsOperationResult[] {
  if (input.spec.methodId === IDS.km) return kaplanMeierResults(input);
  if (input.spec.methodId === IDS.logRank) return logRankResults(input);
  throw new RangeError(`${input.spec.methodId} is not a time-to-event method.`);
}
