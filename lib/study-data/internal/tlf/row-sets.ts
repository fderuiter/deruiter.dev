/**
 * Deduplicated row sets: results that share the same ADaM rows refer to one
 * set, which keeps the reporting event small when many results share a
 * population. Nested sets go further and include one another, so a row
 * that belongs to many of them is listed once.
 */
import type { ArsRowReference, ArsRowSet, Dataset } from "../../types";
import { adamRowId } from "./row-ids";

/** Collects the row sets of one reporting event, numbered in first-use order. */
export class RowSetRegistry {
  private readonly sets: ArsRowSet[] = [];
  private readonly byContent = new Map<string, string>();
  private readonly datasetOf = new Map<string, string>();

  /**
   * A reference to the set holding these rows, created on first use.
   *
   * @returns `null` when there are no rows.
   */
  reference(
    dataset: Dataset,
    rowIndexes: readonly number[],
    role: ArsRowReference["role"]
  ): ArsRowReference | null {
    return this.union(dataset, rowIndexes, [], role);
  }

  /**
   * A reference to the set holding these rows and every row of the
   * included sets, created on first use. Included sets are already in the
   * registry, so they are listed before the set that includes them.
   *
   * @param included - References to sets of the same dataset; `null`
   *   entries are skipped.
   * @returns `null` when there are no rows and nothing to include, and the
   *   included set itself when it is the only content.
   * @throws RangeError when an included set is not in the registry or
   *   belongs to another dataset.
   */
  union(
    dataset: Dataset,
    rowIndexes: readonly number[],
    included: readonly (ArsRowReference | null)[],
    role: ArsRowReference["role"]
  ): ArsRowReference | null {
    const rowIds = [...new Set(rowIndexes)]
      .sort((a, b) => a - b)
      .map((rowIndex) => adamRowId(dataset, rowIndex));
    const includes = [
      ...new Set(
        included.flatMap((reference) => (reference ? [reference.rowSetId] : []))
      ),
    ];
    for (const includedId of includes) {
      const includedDataset = this.datasetOf.get(includedId);
      if (includedDataset !== dataset.name) {
        throw new RangeError(
          includedDataset === undefined
            ? `Row set ${includedId} is not in this reporting event.`
            : `Row set ${includedId} holds ${includedDataset} rows, not ${dataset.name}.`
        );
      }
    }
    if (rowIds.length === 0 && includes.length <= 1) {
      return includes.length === 0 ? null : { role, rowSetId: includes[0] };
    }
    const key = `${dataset.name}\n${rowIds.join("\n")}\n+${includes.join(" ")}`;
    let id = this.byContent.get(key);
    if (!id) {
      id = `RowSet_${String(this.sets.length + 1).padStart(4, "0")}`;
      this.byContent.set(key, id);
      this.datasetOf.set(id, dataset.name);
      this.sets.push(
        includes.length === 0
          ? { id, dataset: dataset.name, rowIds }
          : { id, dataset: dataset.name, rowIds, includes }
      );
    }
    return { role, rowSetId: id };
  }

  /** Every set, in first-use order. */
  all(): readonly ArsRowSet[] {
    return this.sets;
  }
}
