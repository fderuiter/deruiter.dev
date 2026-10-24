"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { clamp } from "@/lib/game-utils";
import type { CellValue, DataLayer, VariableMeta } from "@/lib/study-data";
import { ROW_PAGE_SIZE, type DatasetSummary, type RowWindow } from "./protocol";
import { CELL, CELL_FOCUS, FIELD, SELECTED } from "./ui";

const ROW_HEIGHT = 36;
const VIEW_HEIGHT = 432;
const OVERSCAN = 8;
const VISIBLE_ROWS = Math.ceil(VIEW_HEIGHT / ROW_HEIGHT);

const LAYER_NAMES: Readonly<Record<DataLayer, string>> = {
  collected: "Collected",
  sdtm: "SDTM",
  adam: "ADaM",
};

/** A request to show and focus one row, from the lineage explorer. */
export interface RowReveal {
  readonly key: string;
  readonly row: number;
  /** Changes on every request, so the same row can be revealed twice. */
  readonly nonce: number;
}

interface DatasetViewerProps {
  readonly runId: number;
  readonly datasets: readonly DatasetSummary[];
  readonly selectedKey: string;
  readonly onSelectKey: (key: string) => void;
  readonly loadRows: (
    key: string,
    offset: number,
    limit: number
  ) => Promise<RowWindow>;
  readonly onTrace: (layer: DataLayer, dataset: string, row: number) => void;
  /** The row the lineage explorer is showing, if it is in this dataset. */
  readonly tracedRow: number | null;
  readonly reveal: RowReveal | null;
}

interface Position {
  /** Data row from 0, or -1 for the header row. */
  readonly row: number;
  /** Column from 0; column 0 is the row number. */
  readonly col: number;
}

function display(value: CellValue | undefined): string {
  if (value === undefined) return "…";
  return value === null ? "" : String(value);
}

function VariableInspector({ variable }: { variable: VariableMeta | null }) {
  const facts: [string, string | undefined][] = variable
    ? [
        [
          "Type",
          variable.length
            ? `${variable.type} (${variable.length})`
            : variable.type,
        ],
        ["Origin", variable.origin],
        ["Role", variable.role],
        ["Codelist", variable.codelist],
        ["Method", variable.method],
        ["Source", variable.source],
      ]
    : [];
  return (
    <div
      className="min-h-[7.5rem] border border-white/[0.08] bg-[#0d0e11] p-4"
      aria-live="polite"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">
        Variable metadata
      </p>
      {variable ? (
        <>
          <p className="mt-2 break-words text-sm">
            <span className="font-mono font-semibold text-amber-200">
              {variable.name}
            </span>{" "}
            <span className="text-slate-200">{variable.label}</span>
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3 lg:grid-cols-6">
            {facts
              .filter(([, value]) => value !== undefined)
              .map(([term, value]) => (
                <div key={term} className="min-w-0">
                  <dt className="text-slate-400">{term}</dt>
                  <dd className="break-words font-mono text-slate-100">
                    {value}
                  </dd>
                </div>
              ))}
          </dl>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-400">
          Hover over or focus a column to read its metadata.
        </p>
      )}
    </div>
  );
}

/**
 * A virtualised dataset viewer following the ARIA grid pattern: only the
 * rows in view are rendered and fetched from the worker, a page at a time.
 * Arrow keys, Page Up and Page Down, Home and End move between cells; Enter
 * traces the focused row's lineage. Hovering over or focusing any cell shows
 * its variable's metadata.
 */
export function DatasetViewer({
  runId,
  datasets,
  selectedKey,
  onSelectKey,
  loadRows,
  onTrace,
  tracedRow,
  reveal,
}: DatasetViewerProps) {
  const dataset =
    datasets.find((item) => item.key === selectedKey) ?? datasets[0];
  const selectId = useId();
  const helpId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLTableElement>(null);
  /** Pages requested from the worker, keyed by run, dataset and page. */
  const requestedRef = useRef(new Set<string>());
  const focusPending = useRef(false);
  const [pages, setPages] = useState<
    ReadonlyMap<string, readonly (readonly CellValue[])[]>
  >(() => new Map());
  const [scrollTop, setScrollTop] = useState(0);
  const [active, setActive] = useState<Position>({ row: 0, col: 1 });
  const [inspected, setInspected] = useState(0);
  const pageKey = `${runId}:${dataset?.key ?? ""}`;
  const [loadedFor, setLoadedFor] = useState(pageKey);

  // A new run or dataset empties the page cache and returns to the top.
  if (loadedFor !== pageKey) {
    setLoadedFor(pageKey);
    setPages(new Map());
    setScrollTop(0);
    setActive({ row: 0, col: 1 });
    setInspected(0);
  }
  useEffect(() => {
    requestedRef.current = new Set(
      [...requestedRef.current].filter((key) => key.startsWith(`${pageKey}|`))
    );
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [pageKey]);

  const rowCount = dataset?.rowCount ?? 0;
  const variables = dataset?.variables ?? [];
  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(rowCount, first + VISIBLE_ROWS + OVERSCAN * 2);

  useEffect(() => {
    if (!dataset || last <= first) return;
    const key = dataset.key;
    const firstPage = Math.floor(first / ROW_PAGE_SIZE);
    const lastPage = Math.floor((last - 1) / ROW_PAGE_SIZE);
    for (let page = firstPage; page <= lastPage; page += 1) {
      const cacheKey = `${pageKey}|${page}`;
      if (requestedRef.current.has(cacheKey)) continue;
      requestedRef.current.add(cacheKey);
      loadRows(key, page * ROW_PAGE_SIZE, ROW_PAGE_SIZE).then(
        (window) => {
          setPages((previous) =>
            cacheKey.startsWith(`${pageKey}|`)
              ? new Map(previous).set(cacheKey, window.rows)
              : previous
          );
        },
        () => {
          requestedRef.current.delete(cacheKey);
        }
      );
    }
  }, [dataset, first, last, loadRows, pageKey]);

  const cellValue = (row: number, col: number): CellValue | undefined => {
    const page = pages.get(`${pageKey}|${Math.floor(row / ROW_PAGE_SIZE)}`);
    return page?.[row % ROW_PAGE_SIZE]?.[col];
  };

  /** Scrolls so a data row is in view, keeping the sticky header clear. */
  const scrollToRow = useCallback((row: number) => {
    const container = scrollRef.current;
    if (!container || row < 0) return;
    const top = row * ROW_HEIGHT;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight - ROW_HEIGHT * 2;
    let next = viewTop;
    if (top < viewTop) next = top;
    else if (top > viewBottom)
      next = top - container.clientHeight + ROW_HEIGHT * 2;
    if (next !== viewTop) {
      container.scrollTop = next;
      setScrollTop(next);
    }
  }, []);

  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    gridRef.current
      ?.querySelector<HTMLElement>(
        `[data-row="${active.row}"][data-col="${active.col}"]`
      )
      ?.focus();
  }, [active, scrollTop]);

  useEffect(() => {
    if (!reveal || reveal.key !== dataset?.key) return;
    focusPending.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive({ row: reveal.row, col: 1 });
    scrollToRow(reveal.row);
  }, [reveal, dataset?.key, scrollToRow]);

  const moveTo = (row: number, col: number) => {
    const next = {
      row: clamp(row, -1, rowCount - 1),
      col: clamp(col, 0, variables.length),
    };
    focusPending.current = true;
    setActive(next);
    if (next.col > 0) setInspected(next.col - 1);
    scrollToRow(next.row);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const { row, col } = active;
    const page = VISIBLE_ROWS - 2;
    switch (event.key) {
      case "ArrowDown":
        moveTo(row + 1, col);
        break;
      case "ArrowUp":
        moveTo(row - 1, col);
        break;
      case "ArrowRight":
        moveTo(row, col + 1);
        break;
      case "ArrowLeft":
        moveTo(row, col - 1);
        break;
      case "PageDown":
        moveTo(row + page, col);
        break;
      case "PageUp":
        moveTo(Math.max(0, row - page), col);
        break;
      case "Home":
        moveTo(event.ctrlKey ? 0 : row, 0);
        break;
      case "End":
        moveTo(event.ctrlKey ? rowCount - 1 : row, variables.length);
        break;
      case "Enter":
      case " ":
        if (row >= 0 && dataset) onTrace(dataset.layer, dataset.name, row);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const onMouseOver = (event: MouseEvent<HTMLTableElement>) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-col]"
    );
    const col = Number(cell?.dataset.col);
    if (col > 0) setInspected(col - 1);
  };

  if (!dataset) return null;
  const activeRendered =
    active.row === -1 || (active.row >= first && active.row < last);
  const tabStop = (row: number, col: number) =>
    (activeRendered ? active.row === row : row === -1) && active.col === col
      ? 0
      : -1;
  const rows = [];
  for (let row = first; row < last; row += 1) rows.push(row);
  const groups = (["collected", "sdtm", "adam"] as const).map((layer) => ({
    layer,
    items: datasets.filter((item) => item.layer === layer),
  }));

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:items-end">
        <div className="min-w-0">
          <label
            htmlFor={selectId}
            className="mb-1 block font-mono text-xs uppercase tracking-[0.14em] text-slate-300"
          >
            Dataset
          </label>
          <select
            id={selectId}
            value={dataset.key}
            onChange={(event) => onSelectKey(event.target.value)}
            className={FIELD}
          >
            {groups.map((group) => (
              <optgroup key={group.layer} label={LAYER_NAMES[group.layer]}>
                {group.items.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.name} · {item.rowCount.toLocaleString("en-US")} rows
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
          <div className="min-w-0">
            <dt className="text-slate-400">Layer</dt>
            <dd className="text-slate-100">{LAYER_NAMES[dataset.layer]}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-slate-400">Class</dt>
            <dd className="break-words text-slate-100">
              {dataset.datasetClass}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-slate-400">Keys</dt>
            <dd className="break-words font-mono text-slate-100">
              {dataset.keys.join(", ")}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-slate-400">Records</dt>
            <dd className="font-mono tabular-nums text-slate-100">
              {dataset.rowCount.toLocaleString("en-US")}
            </dd>
          </div>
        </dl>
      </div>
      <p className="break-words text-sm text-slate-300">
        <span className="font-semibold text-white">{dataset.label}</span>
        {dataset.structure ? ` · ${dataset.structure}` : ""}
      </p>
      <VariableInspector variable={variables[inspected] ?? null} />
      <p id={helpId} className="text-xs text-slate-400">
        Arrow keys, Page Up, Page Down, Home and End move between cells. Enter
        or a click traces that record&apos;s lineage.
      </p>
      <div
        ref={scrollRef}
        className="min-w-0 max-w-full overflow-auto border border-white/[0.08] bg-[#0d0e11]"
        style={{ height: VIEW_HEIGHT }}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <table
          ref={gridRef}
          role="grid"
          aria-label={`${dataset.name}: ${dataset.label}`}
          aria-describedby={helpId}
          aria-rowcount={rowCount + 1}
          aria-colcount={variables.length + 1}
          className="border-separate border-spacing-0"
          onKeyDown={onKeyDown}
          onMouseOver={onMouseOver}
        >
          <thead>
            <tr aria-rowindex={1}>
              <th
                scope="col"
                aria-colindex={1}
                data-row={-1}
                data-col={0}
                tabIndex={tabStop(-1, 0)}
                onFocus={() => setActive({ row: -1, col: 0 })}
                className={`${CELL} sticky top-0 z-10 border-b border-white/[0.12] bg-[#181b21] text-slate-400 ${CELL_FOCUS}`}
              >
                Row
              </th>
              {variables.map((variable, index) => (
                <th
                  key={variable.name}
                  scope="col"
                  aria-colindex={index + 2}
                  data-row={-1}
                  data-col={index + 1}
                  tabIndex={tabStop(-1, index + 1)}
                  title={variable.label}
                  onFocus={() => {
                    setActive({ row: -1, col: index + 1 });
                    setInspected(index);
                  }}
                  className={`${CELL} sticky top-0 z-10 border-b border-white/[0.12] bg-[#181b21] text-amber-200 ${CELL_FOCUS}`}
                >
                  {variable.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {first > 0 ? (
              <tr aria-hidden="true">
                <td style={{ height: first * ROW_HEIGHT, padding: 0 }} />
              </tr>
            ) : null}
            {rows.map((row) => {
              const traced = tracedRow === row;
              return (
                <tr
                  key={row}
                  aria-rowindex={row + 2}
                  aria-selected={traced}
                  className={traced ? SELECTED : "text-slate-100"}
                  style={{ height: ROW_HEIGHT }}
                >
                  <th
                    scope="row"
                    aria-colindex={1}
                    data-row={row}
                    data-col={0}
                    tabIndex={tabStop(row, 0)}
                    onFocus={() => setActive({ row, col: 0 })}
                    onClick={() => onTrace(dataset.layer, dataset.name, row)}
                    className={`${CELL} cursor-pointer border-b border-white/[0.04] font-normal text-slate-400 ${CELL_FOCUS}`}
                  >
                    {row + 1}
                  </th>
                  {variables.map((variable, index) => (
                    <td
                      key={variable.name}
                      role="gridcell"
                      aria-colindex={index + 2}
                      data-row={row}
                      data-col={index + 1}
                      tabIndex={tabStop(row, index + 1)}
                      onFocus={() => {
                        setActive({ row, col: index + 1 });
                        setInspected(index);
                      }}
                      onClick={() => onTrace(dataset.layer, dataset.name, row)}
                      className={`${CELL} max-w-[18rem] cursor-pointer truncate border-b border-white/[0.04] hover:bg-white/[0.04] ${CELL_FOCUS}`}
                    >
                      {display(cellValue(row, index))}
                    </td>
                  ))}
                </tr>
              );
            })}
            {last < rowCount ? (
              <tr aria-hidden="true">
                <td
                  style={{ height: (rowCount - last) * ROW_HEIGHT, padding: 0 }}
                />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
