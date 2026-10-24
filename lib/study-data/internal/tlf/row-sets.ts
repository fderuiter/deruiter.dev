/**
 * Deduplicated row sets: results that share the same ADaM rows refer to one
 * set, which keeps the reporting event small when many results share a
 * population.
 */
import type { ArsRowReference, ArsRowSet, Dataset } from "../../types";
import { adamRowId } from "./row-ids";

/** Collects the row sets of one reporting event, numbered in first-use order. */
export class RowSetRegistry {
  private readonly sets: ArsRowSet[] = [];
  private readonly byContent = new Map<string, string>();

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
    if (rowIndexes.length === 0) return null;
    const rowIds = [...new Set(rowIndexes)]
      .sort((a, b) => a - b)
      .map((rowIndex) => adamRowId(dataset, rowIndex));
    const key = `${dataset.name}\n${rowIds.join("\n")}`;
    let id = this.byContent.get(key);
    if (!id) {
      id = `RowSet_${String(this.sets.length + 1).padStart(4, "0")}`;
      this.byContent.set(key, id);
      this.sets.push({ id, dataset: dataset.name, rowIds });
    }
    return { role, rowSetId: id };
  }

  /** Every set, in first-use order. */
  all(): readonly ArsRowSet[] {
    return this.sets;
  }
}
