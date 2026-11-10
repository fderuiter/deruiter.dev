import type { DataLayer, Finding, TlfTable } from "./types";

/**
 * What changed between two runs of the pipeline (#3160): conformance
 * findings added or removed, dataset row counts that moved, and table values
 * that changed. A pure function of the two runs; the page renders the result
 * and nothing here touches React or the worker.
 */

/** The parts of a run the diff compares. A pipeline run and its outputs fit it. */
export interface RunDiffInput {
  readonly findings: readonly Finding[];
  readonly datasets: readonly {
    readonly layer: DataLayer;
    readonly name: string;
    readonly rowCount: number;
  }[];
  readonly tables: readonly TlfTable[];
}

/** A conformance finding that one run raised and the other did not. */
export interface FindingChange {
  readonly change: "added" | "removed";
  readonly finding: Finding;
}

/** A dataset whose row count differs; null when the dataset is absent from a run. */
export interface RowCountChange {
  readonly layer: DataLayer;
  readonly dataset: string;
  readonly before: number | null;
  readonly after: number | null;
}

/** A table cell whose text differs; null when the cell is absent from a run. */
export interface TlfValueChange {
  /** Table number, for example `14.1.1`. */
  readonly table: string;
  /** Section, row and column, for example `Age (years) · Mean · Placebo`. */
  readonly location: string;
  readonly before: string | null;
  readonly after: string | null;
}

/** The three lists `diffRuns` returns. */
export interface RunDiff {
  readonly findings: readonly FindingChange[];
  readonly rowCounts: readonly RowCountChange[];
  readonly tlfValues: readonly TlfValueChange[];
}

function findingKey(finding: Finding): string {
  return [
    finding.ruleId,
    finding.severity,
    finding.layer,
    finding.dataset ?? "",
    finding.variable ?? "",
    finding.row ?? "",
    finding.message,
  ].join("\u0000");
}

function groupFindings(findings: readonly Finding[]): Map<string, Finding[]> {
  const groups = new Map<string, Finding[]>();
  for (const finding of findings) {
    const key = findingKey(finding);
    const group = groups.get(key);
    if (group) group.push(finding);
    else groups.set(key, [finding]);
  }
  return groups;
}

function diffFindings(
  previous: readonly Finding[],
  next: readonly Finding[]
): FindingChange[] {
  const before = groupFindings(previous);
  const after = groupFindings(next);
  const changes: FindingChange[] = [];
  for (const [key, group] of before) {
    const kept = after.get(key)?.length ?? 0;
    for (const finding of group.slice(kept)) {
      changes.push({ change: "removed", finding });
    }
  }
  for (const [key, group] of after) {
    const kept = before.get(key)?.length ?? 0;
    for (const finding of group.slice(kept)) {
      changes.push({ change: "added", finding });
    }
  }
  return changes;
}

function diffRowCounts(
  previous: RunDiffInput["datasets"],
  next: RunDiffInput["datasets"]
): RowCountChange[] {
  const keyOf = (dataset: { layer: DataLayer; name: string }) =>
    `${dataset.layer}:${dataset.name}`;
  const before = new Map(previous.map((item) => [keyOf(item), item]));
  const after = new Map(next.map((item) => [keyOf(item), item]));
  const changes: RowCountChange[] = [];
  for (const [key, item] of before) {
    const other = after.get(key);
    if (other?.rowCount === item.rowCount) continue;
    changes.push({
      layer: item.layer,
      dataset: item.name,
      before: item.rowCount,
      after: other?.rowCount ?? null,
    });
  }
  for (const [key, item] of after) {
    if (before.has(key)) continue;
    changes.push({
      layer: item.layer,
      dataset: item.name,
      before: null,
      after: item.rowCount,
    });
  }
  return changes;
}

interface CellEntry {
  readonly table: string;
  readonly location: string;
  readonly text: string;
}

function tableCells(tables: readonly TlfTable[]): Map<string, CellEntry> {
  const cells = new Map<string, CellEntry>();
  for (const table of tables) {
    for (const section of table.sections) {
      const rows = [
        ...(section.cells ? [{ id: "", label: "", cells: section.cells }] : []),
        ...section.rows,
      ];
      for (const row of rows) {
        row.cells.forEach((cell, index) => {
          const column = table.columns[index];
          const columnId = column?.id ?? String(index);
          cells.set(
            [table.outputId, section.id, row.id, columnId].join("\u0000"),
            {
              table: table.number,
              location: [section.label, row.label, column?.label ?? ""]
                .filter((part) => part !== "")
                .join(" · "),
              text: cell.text,
            }
          );
        });
      }
    }
  }
  return cells;
}

function diffTlfValues(
  previous: readonly TlfTable[],
  next: readonly TlfTable[]
): TlfValueChange[] {
  const before = tableCells(previous);
  const after = tableCells(next);
  const changes: TlfValueChange[] = [];
  for (const [key, cell] of before) {
    const other = after.get(key);
    if (other?.text === cell.text) continue;
    changes.push({
      table: cell.table,
      location: cell.location,
      before: cell.text,
      after: other?.text ?? null,
    });
  }
  for (const [key, cell] of after) {
    if (before.has(key)) continue;
    changes.push({
      table: cell.table,
      location: cell.location,
      before: null,
      after: cell.text,
    });
  }
  return changes;
}

/**
 * Compares two runs.
 *
 * @returns findings added or removed, row counts changed and table values
 *   changed, each in the order the runs list them; three empty lists when
 *   nothing changed.
 */
export function diffRuns(previous: RunDiffInput, next: RunDiffInput): RunDiff {
  return {
    findings: diffFindings(previous.findings, next.findings),
    rowCounts: diffRowCounts(previous.datasets, next.datasets),
    tlfValues: diffTlfValues(previous.tables, next.tables),
  };
}

/** Whether a diff holds no change at all. */
export function isEmptyRunDiff(diff: RunDiff): boolean {
  return (
    diff.findings.length === 0 &&
    diff.rowCounts.length === 0 &&
    diff.tlfValues.length === 0
  );
}
