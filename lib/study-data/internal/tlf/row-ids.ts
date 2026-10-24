/**
 * Stable identities for ADaM rows, so every analysis result can name the
 * records that produced it. An id is the dataset name and the values of the
 * dataset's key variables other than `STUDYID`, which is the same on every
 * row: `ADSL:DEMO-301-0001` or `ADVS:DEMO-301-0001:5` (USUBJID, ASEQ).
 */
import type {
  AdamRowLocation,
  ArsOperationResult,
  ArsReportingEvent,
  ArsRowSet,
  Dataset,
  ResultRow,
} from "../../types";

const ID_SEPARATOR = ":";

function keyVariables(dataset: Dataset): readonly string[] {
  const keys = dataset.keys.filter((key) => key !== "STUDYID");
  if (keys.length === 0) {
    throw new RangeError(
      `${dataset.name} has no key variables to identify its rows.`
    );
  }
  return keys;
}

/**
 * The stable id of one ADaM row.
 *
 * @param dataset - An analysis dataset whose `keys` identify its rows.
 * @param rowIndex - Zero-based row index.
 * @returns For example `ADVS:DEMO-301-0001:5`.
 * @throws RangeError when the row is out of range, the dataset has no key
 *   variables besides `STUDYID`, or a key value is missing.
 */
export function adamRowId(dataset: Dataset, rowIndex: number): string {
  if (
    !Number.isInteger(rowIndex) ||
    rowIndex < 0 ||
    rowIndex >= dataset.rowCount
  ) {
    throw new RangeError(
      `${dataset.name} has no row ${rowIndex}; it has ${dataset.rowCount}.`
    );
  }
  const parts = keyVariables(dataset).map((key) => {
    const value = dataset.columns[key]?.[rowIndex] ?? null;
    if (value === null || value === "") {
      throw new RangeError(
        `${dataset.name} row ${rowIndex} has no value for key ${key}.`
      );
    }
    return String(value);
  });
  return [dataset.name, ...parts].join(ID_SEPARATOR);
}

/**
 * Every row of the ADaM datasets, by row id.
 *
 * @param datasets - Datasets of a run; only the `adam` layer is indexed.
 * @throws RangeError when two rows share an id.
 */
export function indexAdamRows(
  datasets: readonly Dataset[]
): ReadonlyMap<string, AdamRowLocation> {
  const index = new Map<string, AdamRowLocation>();
  for (const dataset of datasets) {
    if (dataset.layer !== "adam") continue;
    for (let rowIndex = 0; rowIndex < dataset.rowCount; rowIndex += 1) {
      const rowId = adamRowId(dataset, rowIndex);
      if (index.has(rowId)) {
        throw new RangeError(`Two ADaM rows share the id ${rowId}.`);
      }
      index.set(rowId, { rowId, dataset: dataset.name, rowIndex });
    }
  }
  return index;
}

interface IndexedRowSet {
  readonly set: ArsRowSet;
  readonly position: number;
}

function indexRowSets(
  event: ArsReportingEvent
): ReadonlyMap<string, IndexedRowSet> {
  return new Map(
    event.rowSets.map((set, position) => [set.id, { set, position }])
  );
}

function rowIdsOf(
  sets: ReadonlyMap<string, IndexedRowSet>,
  rowSetId: string
): readonly string[] {
  const root = sets.get(rowSetId);
  if (!root) {
    throw new RangeError(`Row set ${rowSetId} is not in the reporting event.`);
  }
  const rowIds = new Set<string>();
  const visited = new Set([rowSetId]);
  const pending = [root];
  for (let entry = pending.pop(); entry; entry = pending.pop()) {
    for (const rowId of entry.set.rowIds) rowIds.add(rowId);
    for (const includedId of entry.set.includes ?? []) {
      const included = sets.get(includedId);
      if (!included) {
        throw new RangeError(
          `Row set ${entry.set.id} includes ${includedId}, which the reporting event does not hold.`
        );
      }
      if (included.position >= entry.position) {
        throw new RangeError(
          `Row set ${entry.set.id} includes ${includedId}, which is not listed before it.`
        );
      }
      if (included.set.dataset !== root.set.dataset) {
        throw new RangeError(
          `Row set ${entry.set.id} includes ${includedId}, which holds ${included.set.dataset} rows, not ${root.set.dataset}.`
        );
      }
      if (!visited.has(includedId)) {
        visited.add(includedId);
        pending.push(included);
      }
    }
  }
  return [...rowIds];
}

/**
 * Every row id of one row set: its own and those of the sets it includes,
 * each once, the set's own ids first. Because a set only includes sets
 * listed before it, nesting cannot loop. {@link resolveResultRows} gives
 * the same rows in dataset order.
 *
 * @param event - The reporting event that holds the set.
 * @param rowSetId - The set.
 * @throws RangeError when the event does not hold the set, or the set
 *   includes one that is missing, listed after it, or of another dataset.
 */
export function rowSetRowIds(
  event: ArsReportingEvent,
  rowSetId: string
): readonly string[] {
  return rowIdsOf(indexRowSets(event), rowSetId);
}

/**
 * The ADaM rows one result was computed from, with the role each plays.
 * Each row set's rows come back once each, in dataset order.
 *
 * @param event - The reporting event the result belongs to.
 * @param rows - The run's ADaM rows, from {@link indexAdamRows}.
 * @param result - The result.
 * @throws RangeError when the result names a row set the event does not
 *   hold, a row set includes another wrongly (see {@link rowSetRowIds}), or
 *   a row id is not a row of the set's dataset in this run.
 */
export function resolveResultRows(
  event: ArsReportingEvent,
  rows: ReadonlyMap<string, AdamRowLocation>,
  result: ArsOperationResult
): readonly ResultRow[] {
  const sets = indexRowSets(event);
  return result.rowReferences.flatMap((reference) => {
    const entry = sets.get(reference.rowSetId);
    if (!entry) {
      throw new RangeError(
        `Result ${result.id} names row set ${reference.rowSetId}, which the reporting event does not hold.`
      );
    }
    const { set } = entry;
    return rowIdsOf(sets, set.id)
      .map((rowId) => {
        const location = rows.get(rowId);
        if (!location || location.dataset !== set.dataset) {
          throw new RangeError(
            `Row set ${set.id} names ${rowId}, which is not a ${set.dataset} row of this run.`
          );
        }
        return location;
      })
      .sort((a, b) => a.rowIndex - b.rowIndex)
      .map((location) => ({ ...location, role: reference.role }));
  });
}
