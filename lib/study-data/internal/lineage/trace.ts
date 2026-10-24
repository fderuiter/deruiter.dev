/**
 * Lineage across the whole pipeline: from a reported number back to the
 * protocol activity that scheduled its source, and forward from an activity
 * to every number it feeds.
 *
 * The collected source id (`SRCID`) is the bridge. Every SDTM and ADaM row
 * carries the ids of the collected records it came from in
 * `Dataset.lineage`, outside its submission columns, so one index of those
 * ids links all three data layers. ADaM rows also name their primary SDTM
 * record in SRCDOM and SRCSEQ, which the trace marks as `primary`. Results
 * reach their ADaM rows through the ARS row sets (`resolveResultRows`), and
 * collected records reach the schedule of activities through their visit
 * number and test code.
 */
import type {
  AdamRowLocation,
  ArsAnalysis,
  ArsOperationResult,
  CellValue,
  DataLayer,
  Dataset,
  PipelineRun,
  StudyDefinition,
  TlfOutputs,
  VisitDefinition,
} from "../../types";
import { adamRowId, indexAdamRows, resolveResultRows } from "../tlf/row-ids";
import type {
  LineageDisplayCell,
  LineageLevel,
  LineageOrigin,
  LineageRecord,
  LineageRelation,
  LineageResult,
  LineageScheduleEntry,
  LineageStep,
  LineageTrace,
  LineageTraceOptions,
  LineageVisit,
} from "./model";

/** Items listed per level when the caller does not say. */
export const DEFAULT_LINEAGE_LIMIT = 40;

/** Traces lineage within one pipeline run. */
export interface LineageIndex {
  /**
   * Walks upstream and downstream from one starting point.
   *
   * @throws RangeError when the start names a result, dataset, row,
   *   activity or visit the run does not have.
   */
  trace(origin: LineageOrigin, options?: LineageTraceOptions): LineageTrace;
  /** Where a result is displayed, when a table or figure shows it. */
  displayOf(resultId: string): LineageDisplayCell | undefined;
}

interface RowRef {
  readonly dataset: Dataset;
  readonly row: number;
  relation: LineageRelation;
}

const RELATION_RANK: Readonly<Record<LineageRelation, number>> = {
  origin: 0,
  primary: 1,
  linked: 2,
};

/** Variables a record summary leaves out: identifiers and lineage pointers. */
const SUMMARY_SKIP = new Set([
  "STUDYID",
  "USUBJID",
  "SRCID",
  "DOMAIN",
  "SRCDOM",
  "SRCVAR",
  "SRCSEQ",
]);
const SUMMARY_LENGTH = 3;

/** Rows keyed by layer, dataset and row, keeping the strongest relation. */
class RowSet {
  private readonly rows = new Map<string, RowRef>();

  add(dataset: Dataset, row: number, relation: LineageRelation): void {
    const key = `${dataset.layer}:${dataset.name}:${row}`;
    const existing = this.rows.get(key);
    if (!existing) {
      this.rows.set(key, { dataset, row, relation });
    } else if (RELATION_RANK[relation] < RELATION_RANK[existing.relation]) {
      existing.relation = relation;
    }
  }

  values(): RowRef[] {
    return [...this.rows.values()];
  }

  get size(): number {
    return this.rows.size;
  }
}

function formatValue(value: CellValue): string {
  return value === null ? "" : String(value);
}

function recordKey(dataset: Dataset, row: number): string {
  if (dataset.keys.includes("SRCID")) {
    return formatValue(dataset.columns.SRCID?.[row] ?? null);
  }
  return dataset.keys
    .filter((key) => key !== "STUDYID")
    .map((key) => formatValue(dataset.columns[key]?.[row] ?? null))
    .filter((value) => value !== "")
    .join(" · ");
}

function recordSummary(dataset: Dataset, row: number): string {
  const ranked = dataset.variables
    .filter(
      (variable) =>
        !SUMMARY_SKIP.has(variable.name) &&
        !dataset.keys.includes(variable.name)
    )
    .map((variable, position) => ({
      variable,
      rank:
        variable.role === "Topic"
          ? 0
          : variable.role === "Result Qualifier"
            ? 1
            : position + 2,
    }))
    .sort((a, b) => a.rank - b.rank);
  const parts: string[] = [];
  for (const { variable } of ranked) {
    const value = dataset.columns[variable.name]?.[row] ?? null;
    if (value === null || value === "") continue;
    parts.push(`${variable.name} ${formatValue(value)}`);
    if (parts.length === SUMMARY_LENGTH) break;
  }
  return parts.join(" · ");
}

function visitOf(visit: VisitDefinition): LineageVisit {
  return {
    id: visit.id,
    name: visit.name,
    visitNum: visit.visitNum,
    targetDay: visit.targetDay,
  };
}

function step<T>(
  items: readonly T[],
  limit: number,
  note?: string
): LineageStep<T> {
  return {
    total: items.length,
    items: items.slice(0, limit),
    ...(note ? { note } : {}),
  };
}

function displayCells(outputs: TlfOutputs): Map<string, LineageDisplayCell> {
  const cells = new Map<string, LineageDisplayCell>();
  const add = (
    outputId: string,
    outputName: string,
    location: string,
    text: string,
    resultIds: readonly string[]
  ) => {
    const cell = { outputId, outputName, location, text, resultIds };
    for (const resultId of resultIds) {
      if (!cells.has(resultId)) cells.set(resultId, cell);
    }
  };
  for (const table of outputs.tables) {
    const name = `Table ${table.number}`;
    for (const column of table.columns) {
      add(table.outputId, name, `N · ${column.label}`, `N=${column.bigN}`, [
        column.bigNResultId,
      ]);
    }
    for (const section of table.sections) {
      section.cells?.forEach((cell, index) =>
        add(
          table.outputId,
          name,
          `${section.label} · ${table.columns[index]?.label ?? ""}`,
          cell.text,
          cell.resultIds
        )
      );
      for (const row of section.rows) {
        row.cells.forEach((cell, index) =>
          add(
            table.outputId,
            name,
            `${section.label} · ${row.label} · ${table.columns[index]?.label ?? ""}`,
            cell.text,
            cell.resultIds
          )
        );
      }
    }
  }
  for (const figure of outputs.figures) {
    const name = `Figure ${figure.number}`;
    for (const curve of figure.curves) {
      add(figure.outputId, name, `N · ${curve.label}`, `N=${curve.bigN}`, [
        curve.bigNResultId,
      ]);
      for (const point of curve.points) {
        add(
          figure.outputId,
          name,
          `${curve.label} · Day ${point.time}`,
          point.survivalText,
          point.resultIds
        );
      }
    }
    for (const row of figure.atRisk) {
      row.cells.forEach((cell, index) =>
        add(
          figure.outputId,
          name,
          `Number at risk · ${row.label} · ${figure.atRiskTimes[index]?.label ?? ""}`,
          cell.text,
          cell.resultIds
        )
      );
    }
    add(
      figure.outputId,
      name,
      "Log-rank test",
      figure.test.text,
      figure.test.resultIds
    );
  }
  return cells;
}

/**
 * Builds the lineage index of one pipeline run and its outputs.
 *
 * Indexes are built when first needed, so building the index is cheap and a
 * trace that never reaches the results does not index them.
 *
 * @param definition - The study the run was made from.
 * @param run - A run from `runPipeline`.
 * @param outputs - The run's outputs from `buildTlfOutputs`.
 * @returns An index that traces any result, record or scheduled activity.
 * @throws RangeError when the run or the outputs are of another study.
 */
export function createLineageIndex(
  definition: StudyDefinition,
  run: PipelineRun,
  outputs: TlfOutputs
): LineageIndex {
  if (
    run.manifest.studyId !== definition.studyId ||
    outputs.reportingEvent.studyId !== definition.studyId
  ) {
    throw new RangeError(
      `The run and its outputs must both be of ${definition.studyId}.`
    );
  }
  const { design } = definition;
  const event = outputs.reportingEvent;
  const datasetOrder = new Map(
    run.datasets.map((dataset, index) => [dataset, index])
  );
  const byLayer = new Map(
    run.datasets.map((dataset) => [`${dataset.layer}:${dataset.name}`, dataset])
  );
  const datasetOf = (layer: DataLayer, name: string): Dataset | undefined =>
    byLayer.get(`${layer}:${name}`);
  const visitsById = new Map(design.visits.map((visit) => [visit.id, visit]));
  const visitsByNum = new Map(
    design.visits.map((visit) => [visit.visitNum, visit])
  );
  const activitiesById = new Map(
    design.activities.map((activity) => [activity.id, activity])
  );
  const plannedVisits = new Map<string, VisitDefinition[]>();
  for (const cell of design.schedule) {
    const visit = visitsById.get(cell.visitId);
    if (!visit) continue;
    const visits = plannedVisits.get(cell.activityId) ?? [];
    visits.push(visit);
    plannedVisits.set(cell.activityId, visits);
  }
  for (const visits of plannedVisits.values()) {
    visits.sort((a, b) => a.visitNum - b.visitNum);
  }

  let sourceIndex:
    | {
        collected: Map<string, RowRef>;
        sdtm: Map<string, RowRef[]>;
        adam: Map<string, RowRef[]>;
      }
    | undefined;
  /** Collected source id to the collected record and the rows built from it. */
  const sources = () => {
    if (sourceIndex) return sourceIndex;
    const collected = new Map<string, RowRef>();
    const sdtm = new Map<string, RowRef[]>();
    const adam = new Map<string, RowRef[]>();
    for (const dataset of run.datasets) {
      if (dataset.layer === "collected") {
        const ids = dataset.columns.SRCID ?? [];
        ids.forEach((id, row) => {
          if (typeof id === "string") {
            collected.set(id, { dataset, row, relation: "linked" });
          }
        });
        continue;
      }
      const target = dataset.layer === "sdtm" ? sdtm : adam;
      dataset.lineage?.forEach((ids, row) => {
        for (const id of ids) {
          const refs = target.get(id) ?? [];
          refs.push({ dataset, row, relation: "linked" });
          target.set(id, refs);
        }
      });
    }
    sourceIndex = { collected, sdtm, adam };
    return sourceIndex;
  };

  const sdtmBySequence = new Map<string, Map<string, number>>();
  /** The SDTM row an ADaM row names in SRCDOM and SRCSEQ, if it resolves. */
  const primarySource = (dataset: Dataset, row: number): RowRef | null => {
    const domain = dataset.columns.SRCDOM?.[row];
    const subject = dataset.columns.USUBJID?.[row];
    if (typeof domain !== "string" || typeof subject !== "string") return null;
    const source = datasetOf("sdtm", domain);
    if (!source) return null;
    const sequence = dataset.columns.SRCSEQ?.[row] ?? null;
    const seqVariable = `${domain}SEQ`;
    let lookup = sdtmBySequence.get(domain);
    if (!lookup) {
      lookup = new Map();
      const subjects = source.columns.USUBJID ?? [];
      const sequences = source.columns[seqVariable];
      const perSubject =
        source.keys.filter((key) => key !== "STUDYID").join() === "USUBJID";
      for (let index = 0; index < source.rowCount; index += 1) {
        const id = subjects[index];
        if (sequences) lookup.set(`${id}|${sequences[index]}`, index);
        if (perSubject) lookup.set(`${id}|`, index);
      }
      sdtmBySequence.set(domain, lookup);
    }
    const index = lookup.get(`${subject}|${sequence ?? ""}`);
    return index === undefined
      ? null
      : { dataset: source, row: index, relation: "primary" };
  };

  let rowIndex: ReadonlyMap<string, AdamRowLocation> | undefined;
  const adamRows = () => (rowIndex ??= indexAdamRows(run.datasets));

  const analysesByResult = new Map<
    string,
    { result: ArsOperationResult; analysis: ArsAnalysis }
  >();
  for (const analysis of event.analyses) {
    for (const result of analysis.results) {
      analysesByResult.set(result.id, { result, analysis });
    }
  }
  const operationNames = new Map(
    event.methods.flatMap((method) =>
      method.operations.map((operation) => [operation.id, operation.name])
    )
  );
  let displays: Map<string, LineageDisplayCell> | undefined;
  const displayOf = (resultId: string) =>
    (displays ??= displayCells(outputs)).get(resultId);

  let resultsByRow: Map<string, string[]> | undefined;
  /** ADaM row id to the results that counted or summarised the row. */
  const analysisResults = () => {
    if (resultsByRow) return resultsByRow;
    const bySet = new Map<string, string[]>();
    for (const { result } of analysesByResult.values()) {
      for (const reference of result.rowReferences) {
        if (reference.role !== "analysis") continue;
        const ids = bySet.get(reference.rowSetId) ?? [];
        ids.push(result.id);
        bySet.set(reference.rowSetId, ids);
      }
    }
    resultsByRow = new Map();
    for (const set of event.rowSets) {
      const resultIds = bySet.get(set.id);
      if (!resultIds) continue;
      for (const rowId of set.rowIds) {
        const ids = resultsByRow.get(rowId) ?? [];
        ids.push(...resultIds);
        resultsByRow.set(rowId, ids);
      }
    }
    return resultsByRow;
  };

  const lineageOf = (ref: RowRef): readonly string[] =>
    ref.dataset.lineage?.[ref.row] ?? [];

  const record = (ref: RowRef): LineageRecord => ({
    layer: ref.dataset.layer,
    dataset: ref.dataset.name,
    row: ref.row,
    key: recordKey(ref.dataset, ref.row),
    summary: recordSummary(ref.dataset, ref.row),
    relation: ref.relation,
  });

  const ordered = (rows: RowSet): RowRef[] =>
    rows
      .values()
      .sort(
        (a, b) =>
          RELATION_RANK[a.relation] - RELATION_RANK[b.relation] ||
          (datasetOrder.get(a.dataset) ?? 0) -
            (datasetOrder.get(b.dataset) ?? 0) ||
          a.row - b.row
      );

  const resultOf = (resultId: string): LineageResult => {
    const entry = analysesByResult.get(resultId);
    if (!entry) {
      throw new RangeError(`The reporting event has no result ${resultId}.`);
    }
    const display = displayOf(resultId);
    return {
      resultId,
      analysisId: entry.analysis.id,
      analysisName: entry.analysis.name,
      operation:
        operationNames.get(entry.result.operationId) ??
        entry.result.operationId,
      formattedValue: entry.result.formattedValue,
      ...(display ? { display } : {}),
    };
  };

  /** Schedule entries for collected records: by visit, else every planned visit. */
  const scheduleOf = (
    collected: readonly RowRef[],
    primaryDomains: ReadonlySet<string>
  ): { entries: LineageScheduleEntry[]; unmatched: number } => {
    const entries = new Map<string, LineageScheduleEntry>();
    const put = (key: string, entry: LineageScheduleEntry) => {
      const existing = entries.get(key);
      if (
        !existing ||
        RELATION_RANK[entry.relation] < RELATION_RANK[existing.relation]
      ) {
        entries.set(key, entry);
      }
    };
    let unmatched = 0;
    for (const { dataset, row } of collected) {
      const relation: LineageRelation = primaryDomains.has(dataset.name)
        ? "primary"
        : "linked";
      const visitNum = dataset.columns.VISITNUM?.[row];
      const visit =
        typeof visitNum === "number" ? visitsByNum.get(visitNum) : undefined;
      if (dataset.name === "SV") {
        if (!visit) {
          unmatched += 1;
          continue;
        }
        put(`visit:${visit.id}`, {
          activityId: null,
          activityName: null,
          domain: "SV",
          visits: [visitOf(visit)],
          basis: "visit",
          relation,
        });
        continue;
      }
      const testCode = dataset.columns[`${dataset.name}TESTCD`]?.[row];
      const activities = design.activities.filter(
        (activity) =>
          activity.domain === dataset.name &&
          (typeof testCode !== "string" ||
            activity.assessments.some(
              (assessment) => assessment.testCode === testCode
            ))
      );
      let matched = false;
      for (const activity of activities) {
        const planned = plannedVisits.get(activity.id) ?? [];
        if (visit) {
          if (!planned.includes(visit)) continue;
          put(`${activity.id}:${visit.id}`, {
            activityId: activity.id,
            activityName: activity.name,
            domain: activity.domain,
            visits: [visitOf(visit)],
            basis: "visit",
            relation,
          });
        } else {
          put(`${activity.id}:*`, {
            activityId: activity.id,
            activityName: activity.name,
            domain: activity.domain,
            visits: planned.map(visitOf),
            basis: "schedule",
            relation,
          });
        }
        matched = true;
      }
      if (!matched) unmatched += 1;
    }
    const sorted = [...entries.values()].sort(
      (a, b) =>
        RELATION_RANK[a.relation] - RELATION_RANK[b.relation] ||
        (a.visits[0]?.visitNum ?? 0) - (b.visits[0]?.visitNum ?? 0) ||
        design.activities.findIndex((act) => act.id === a.activityId) -
          design.activities.findIndex((act) => act.id === b.activityId)
    );
    return { entries: sorted, unmatched };
  };

  const relationOf = (
    dataset: Dataset,
    primaryDomains: ReadonlySet<string>
  ): LineageRelation =>
    primaryDomains.has(dataset.name) ? "primary" : "linked";

  /** True when every source of `inner` is also a source of `outer`. */
  const usesAll = (inner: readonly string[], outer: ReadonlySet<string>) =>
    inner.length > 0 && inner.every((id) => outer.has(id));

  /**
   * The SDTM rows and collected records an ADaM row was built from: the
   * SDTM rows whose every source the ADaM row also uses, and those sources.
   */
  const upstreamOfAdam = (
    adam: readonly RowRef[],
    sdtm: RowSet,
    collected: RowSet,
    primaryDomains: ReadonlySet<string>
  ) => {
    const index = sources();
    for (const ref of adam) {
      const primary = primarySource(ref.dataset, ref.row);
      if (primary) sdtm.add(primary.dataset, primary.row, "primary");
      const ids = lineageOf(ref);
      const used = new Set(ids);
      for (const id of ids) {
        const source = index.collected.get(id);
        if (source) {
          collected.add(
            source.dataset,
            source.row,
            relationOf(source.dataset, primaryDomains)
          );
        }
        for (const candidate of index.sdtm.get(id) ?? []) {
          if (usesAll(lineageOf(candidate), used)) {
            sdtm.add(
              candidate.dataset,
              candidate.row,
              relationOf(candidate.dataset, primaryDomains)
            );
          }
        }
      }
    }
  };

  /** The ADaM rows that use every source of one SDTM row. */
  const downstreamOfSdtm = (ref: RowRef, adam: RowSet) => {
    const index = sources();
    const ids = lineageOf(ref);
    const subject = ref.dataset.columns.USUBJID?.[ref.row] ?? null;
    const sequence = ref.dataset.columns[`${ref.dataset.name}SEQ`]?.[ref.row];
    for (const id of ids) {
      for (const candidate of index.adam.get(id) ?? []) {
        if (!usesAll(ids, new Set(lineageOf(candidate)))) continue;
        const columns = candidate.dataset.columns;
        const named =
          columns.SRCDOM?.[candidate.row] === ref.dataset.name &&
          columns.USUBJID?.[candidate.row] === subject &&
          (columns.SRCSEQ?.[candidate.row] ?? null) === (sequence ?? null);
        adam.add(
          candidate.dataset,
          candidate.row,
          named ? "primary" : "linked"
        );
      }
    }
  };

  /** Every SDTM and ADaM row that uses any of these collected records. */
  const downstreamOfSources = (
    ids: Iterable<string>,
    sdtm: RowSet,
    adam: RowSet,
    primaryDomains: ReadonlySet<string>
  ) => {
    const index = sources();
    for (const id of ids) {
      for (const ref of index.sdtm.get(id) ?? []) {
        sdtm.add(ref.dataset, ref.row, relationOf(ref.dataset, primaryDomains));
      }
      for (const ref of index.adam.get(id) ?? []) {
        const domain = ref.dataset.columns.SRCDOM?.[ref.row];
        adam.add(
          ref.dataset,
          ref.row,
          typeof domain === "string" && primaryDomains.has(domain)
            ? "primary"
            : "linked"
        );
      }
    }
  };

  /** Results whose analysis rows include any of these ADaM rows. */
  const resultsOfAdam = (adam: readonly RowRef[]): string[] => {
    const byRow = analysisResults();
    const ids = new Set<string>();
    for (const ref of adam) {
      for (const id of byRow.get(adamRowId(ref.dataset, ref.row)) ?? []) {
        ids.add(id);
      }
    }
    return [...ids];
  };

  const requireDataset = (layer: DataLayer, name: string, row: number) => {
    const dataset = datasetOf(layer, name);
    if (!dataset) {
      throw new RangeError(`The run has no ${layer} dataset ${name}.`);
    }
    if (!Number.isInteger(row) || row < 0 || row >= dataset.rowCount) {
      throw new RangeError(
        `${name} has no row ${row}; it has ${dataset.rowCount}.`
      );
    }
    return dataset;
  };

  const trace = (
    origin: LineageOrigin,
    options: LineageTraceOptions = {}
  ): LineageTrace => {
    const limit = Math.max(
      1,
      Math.floor(options.limit ?? DEFAULT_LINEAGE_LIMIT)
    );
    const collected = new RowSet();
    const sdtm = new RowSet();
    const adam = new RowSet();
    let schedule: LineageScheduleEntry[] = [];
    let scheduleNote: string | undefined;
    let collectedNote: string | undefined;
    let resultIds: string[] = [];
    let populationRows: number | undefined;
    let originLevel: LineageLevel;
    let title: string;

    const primaryDomains = new Set<string>();
    const fillSchedule = () => {
      const { entries, unmatched } = scheduleOf(
        ordered(collected),
        primaryDomains
      );
      schedule = entries;
      if (unmatched > 0) {
        scheduleNote =
          entries.length === 0
            ? "No activity in the study definition schedules these records."
            : `${unmatched} record${unmatched === 1 ? " is" : "s are"} not scheduled by an activity, such as randomisation or an unscheduled visit.`;
      }
    };

    switch (origin.kind) {
      case "result": {
        originLevel = "result";
        if (origin.resultIds.length === 0) {
          throw new RangeError("A result trace needs at least one result id.");
        }
        resultIds = [...new Set(origin.resultIds)];
        const population = new Set<string>();
        const rows = adamRows();
        for (const resultId of resultIds) {
          const entry = analysesByResult.get(resultId);
          if (!entry) {
            throw new RangeError(
              `The reporting event has no result ${resultId}.`
            );
          }
          const resolved = resolveResultRows(event, rows, entry.result);
          const analysis = resolved.filter((row) => row.role === "analysis");
          const used = analysis.length > 0 ? analysis : resolved;
          for (const location of used) {
            const dataset = datasetOf("adam", location.dataset);
            if (!dataset) continue;
            adam.add(dataset, location.rowIndex, "primary");
            const domain = dataset.columns.SRCDOM?.[location.rowIndex];
            if (typeof domain === "string") primaryDomains.add(domain);
          }
          if (analysis.length > 0) {
            for (const location of resolved) {
              if (location.role === "population") {
                population.add(location.rowId);
              }
            }
          }
        }
        if (population.size > 0) populationRows = population.size;
        upstreamOfAdam(adam.values(), sdtm, collected, primaryDomains);
        fillSchedule();
        const first = resultOf(resultIds[0]);
        title = first.display
          ? `${first.display.outputName} · ${first.display.location}`
          : `${first.analysisName} · ${first.operation}`;
        break;
      }
      case "record": {
        const dataset = requireDataset(
          origin.layer,
          origin.dataset,
          origin.row
        );
        const ref: RowRef = { dataset, row: origin.row, relation: "origin" };
        title = `${dataset.name} · ${recordKey(dataset, origin.row)}`;
        if (origin.layer === "adam") {
          originLevel = "adam";
          adam.add(dataset, origin.row, "origin");
          const domain = dataset.columns.SRCDOM?.[origin.row];
          if (typeof domain === "string") primaryDomains.add(domain);
          upstreamOfAdam([ref], sdtm, collected, primaryDomains);
          fillSchedule();
        } else if (origin.layer === "sdtm") {
          originLevel = "sdtm";
          primaryDomains.add(dataset.name);
          sdtm.add(dataset, origin.row, "origin");
          const ids = lineageOf(ref);
          const index = sources();
          for (const id of ids) {
            const source = index.collected.get(id);
            if (source) {
              collected.add(
                source.dataset,
                source.row,
                relationOf(source.dataset, primaryDomains)
              );
            }
          }
          downstreamOfSdtm(ref, adam);
          if (ids.length === 0) {
            const visitNum = dataset.columns.VISITNUM?.[origin.row];
            const visit =
              dataset.name === "TV" && typeof visitNum === "number"
                ? visitsByNum.get(visitNum)
                : undefined;
            collectedNote =
              "Trial design records are read from the study definition, not collected.";
            if (visit) {
              schedule = [
                {
                  activityId: null,
                  activityName: null,
                  domain: "TV",
                  visits: [visitOf(visit)],
                  basis: "visit",
                  relation: "primary",
                },
              ];
            } else {
              scheduleNote =
                "Read from the study design: arms, epochs, elements, criteria and trial summary parameters.";
            }
          } else {
            fillSchedule();
          }
        } else {
          originLevel = "collected";
          primaryDomains.add(dataset.name);
          collected.add(dataset, origin.row, "origin");
          const id = dataset.columns.SRCID?.[origin.row];
          downstreamOfSources(
            typeof id === "string" ? [id] : [],
            sdtm,
            adam,
            primaryDomains
          );
          fillSchedule();
        }
        break;
      }
      case "activity": {
        originLevel = "schedule";
        const activity = activitiesById.get(origin.activityId);
        if (!activity) {
          throw new RangeError(
            `The study definition has no activity ${origin.activityId}.`
          );
        }
        const planned = plannedVisits.get(activity.id) ?? [];
        let visits = planned;
        if (origin.visitId !== undefined) {
          const visit = visitsById.get(origin.visitId);
          if (!visit) {
            throw new RangeError(
              `The study definition has no visit ${origin.visitId}.`
            );
          }
          if (!planned.includes(visit)) {
            throw new RangeError(
              `${activity.name} is not planned at ${visit.name}.`
            );
          }
          visits = [visit];
        }
        title =
          origin.visitId === undefined
            ? `${activity.name} · every planned visit`
            : `${activity.name} · ${visits[0].name}`;
        primaryDomains.add(activity.domain);
        schedule = [
          {
            activityId: activity.id,
            activityName: activity.name,
            domain: activity.domain,
            visits: visits.map(visitOf),
            basis: origin.visitId === undefined ? "schedule" : "visit",
            relation: "origin",
          },
        ];
        const source = datasetOf("collected", activity.domain);
        if (source) {
          const visitNums = source.columns.VISITNUM;
          const testCodes = source.columns[`${activity.domain}TESTCD`];
          const wanted = new Set(visits.map((visit) => visit.visitNum));
          const tests = new Set(
            activity.assessments.map((assessment) => assessment.testCode)
          );
          for (let row = 0; row < source.rowCount; row += 1) {
            const visitNum = visitNums?.[row];
            if (
              visitNums &&
              (typeof visitNum !== "number" || !wanted.has(visitNum))
            ) {
              continue;
            }
            const testCode = testCodes?.[row];
            if (
              testCodes &&
              tests.size > 0 &&
              (typeof testCode !== "string" || !tests.has(testCode))
            ) {
              continue;
            }
            collected.add(source, row, "primary");
          }
          if (!visitNums && origin.visitId !== undefined) {
            collectedNote = `${activity.name} records are not tied to one visit, so every record is listed.`;
          }
        } else {
          collectedNote = `No collected dataset holds ${activity.domain} records.`;
        }
        const ids = collected
          .values()
          .map((ref) => ref.dataset.columns.SRCID?.[ref.row])
          .filter((id): id is string => typeof id === "string");
        downstreamOfSources(ids, sdtm, adam, primaryDomains);
        break;
      }
    }

    if (origin.kind !== "result") {
      resultIds = resultsOfAdam(adam.values());
    }
    const results = resultIds.map(resultOf);
    const resultNote =
      origin.kind === "result" || adam.size === 0
        ? undefined
        : "Results that use these rows only as a denominator are not listed.";

    return {
      origin,
      originLevel,
      title,
      schedule: step(schedule, limit, scheduleNote),
      collected: step(ordered(collected).map(record), limit, collectedNote),
      sdtm: step(ordered(sdtm).map(record), limit),
      adam: step(ordered(adam).map(record), limit),
      results: step(results, limit, resultNote),
      ...(populationRows === undefined ? {} : { populationRows }),
    };
  };

  return { trace, displayOf };
}
