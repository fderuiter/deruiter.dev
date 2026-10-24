"use client";

import type { TlfCell, TlfKmFigure, TlfTable } from "@/lib/study-data";
import { KmFigure } from "./KmFigure";
import { useRovingGrid } from "./useRovingGrid";
import {
  BUTTON_SECONDARY,
  CELL,
  CELL_FOCUS,
  SELECTED,
  TABLE_SCROLL,
} from "./ui";

interface TlfPanelProps {
  readonly tables: readonly TlfTable[];
  readonly figures: readonly TlfKmFigure[];
  /** The output on show. */
  readonly current: string;
  readonly onCurrent: (outputId: string) => void;
  /** Result ids of the cell the lineage explorer is showing, if any. */
  readonly selected: readonly string[] | null;
  readonly onTrace: (resultIds: readonly string[]) => void;
}

function same(a: readonly string[] | null, b: readonly string[]): boolean {
  return a !== null && a.length === b.length && a.every((id, i) => id === b[i]);
}

/** Grid row of each section heading and of each row under it; the header is row 0. */
function rowIndexes(table: TlfTable) {
  let next = 0;
  return table.sections.map((section) => {
    next += 1;
    const heading = next;
    const rows = section.rows.map(() => {
      next += 1;
      return next;
    });
    return { heading, rows };
  });
}

function outputLabel(output: TlfTable | TlfKmFigure, kind: "Table" | "Figure") {
  return `${kind} ${output.number}`;
}

/** One table as an ARIA grid whose cells trace back to their ADaM rows. */
function ResultTable({
  table,
  selected,
  onTrace,
}: {
  table: TlfTable;
  selected: readonly string[] | null;
  onTrace: (resultIds: readonly string[]) => void;
}) {
  const { onKeyDown, cellProps } = useRovingGrid();
  const captionId = `${table.fileBase}-caption`;
  const notesId = `${table.fileBase}-notes`;
  const indexes = rowIndexes(table);

  const resultCell = (
    cell: TlfCell,
    row: number,
    col: number,
    group = false
  ) => {
    const traceable = cell.resultIds.length > 0;
    const isSelected = same(selected, cell.resultIds);
    return (
      <td
        key={col}
        role="gridcell"
        {...cellProps(row, col)}
        aria-selected={isSelected}
        data-ars-results={traceable ? cell.resultIds.join(" ") : undefined}
        onClick={traceable ? () => onTrace(cell.resultIds) : undefined}
        className={`${CELL} text-center ${group ? "pt-4" : ""} ${traceable ? "cursor-pointer hover:bg-white/[0.04]" : ""} ${isSelected ? SELECTED : "text-slate-100"} ${CELL_FOCUS}`}
      >
        {cell.text}
      </td>
    );
  };

  return (
    <div className="min-w-0">
      <div className={TABLE_SCROLL}>
        <table
          role="grid"
          aria-labelledby={captionId}
          aria-describedby={notesId}
          data-ars-output={table.outputId}
          className="w-full border-collapse"
          onKeyDown={onKeyDown}
        >
          <caption id={captionId} className="px-3 pb-2 pt-3 text-left">
            <span className="block font-mono text-xs uppercase tracking-[0.14em] text-amber-300">
              Table {table.number}
            </span>
            <span className="mt-1 block text-sm font-semibold text-white">
              {table.title}
            </span>
            <span className="block text-xs text-slate-400">
              {table.population}
            </span>
          </caption>
          <thead>
            <tr className="border-y border-white/[0.12]">
              <th
                scope="col"
                {...cellProps(0, 0)}
                className={`${CELL} font-sans font-semibold text-slate-300 ${CELL_FOCUS}`}
              >
                {table.stubHeader}
              </th>
              {table.columns.map((column, index) => {
                const ids = [column.bigNResultId];
                const isSelected = same(selected, ids);
                return (
                  <th
                    key={column.id}
                    scope="col"
                    {...cellProps(0, index + 1)}
                    aria-selected={isSelected}
                    data-ars-results={column.bigNResultId}
                    onClick={() => onTrace(ids)}
                    className={`${CELL} cursor-pointer text-center font-sans font-semibold hover:bg-white/[0.04] ${isSelected ? SELECTED : "text-white"} ${CELL_FOCUS}`}
                  >
                    {column.label}
                    <span className="block font-mono text-[11px] font-normal text-slate-400">
                      N={column.bigN}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          {table.sections.map((section, sectionIndex) => {
            const headingRow = indexes[sectionIndex].heading;
            return (
              <tbody key={section.id}>
                <tr>
                  {section.cells ? (
                    <>
                      <th
                        scope={section.rows.length > 0 ? "rowgroup" : "row"}
                        {...cellProps(headingRow, 0)}
                        className={`${CELL} whitespace-normal pt-4 font-sans font-semibold text-white ${CELL_FOCUS}`}
                      >
                        {section.label}
                      </th>
                      {section.cells.map((cell, index) =>
                        resultCell(cell, headingRow, index + 1, true)
                      )}
                    </>
                  ) : (
                    <th
                      scope="rowgroup"
                      colSpan={table.columns.length + 1}
                      {...cellProps(headingRow, 0)}
                      className={`${CELL} whitespace-normal pt-4 font-sans font-semibold text-white ${CELL_FOCUS}`}
                    >
                      {section.label}
                    </th>
                  )}
                </tr>
                {section.rows.map((row, position) => {
                  const rowIndex = indexes[sectionIndex].rows[position];
                  return (
                    <tr key={row.id}>
                      <th
                        scope="row"
                        {...cellProps(rowIndex, 0)}
                        className={`${CELL} pl-7 font-sans font-normal text-slate-300 ${CELL_FOCUS}`}
                      >
                        {row.label}
                      </th>
                      {row.cells.map((cell, index) =>
                        resultCell(cell, rowIndex, index + 1)
                      )}
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>
      <div
        id={notesId}
        className="mt-3 space-y-1 text-xs leading-relaxed text-slate-400"
      >
        {table.footnotes.map((note) => (
          <p key={note}>{note}</p>
        ))}
        <p className="text-amber-200">{table.notice}</p>
      </div>
    </div>
  );
}

/** The figure, its number-at-risk table as a grid, and its plotted values. */
function FigureView({
  figure,
  selected,
  onTrace,
}: {
  figure: TlfKmFigure;
  selected: readonly string[] | null;
  onTrace: (resultIds: readonly string[]) => void;
}) {
  const { onKeyDown, cellProps } = useRovingGrid();
  const atRiskId = `${figure.fileBase}-at-risk`;
  const testSelected = same(selected, figure.test.resultIds);
  return (
    <div className="min-w-0 space-y-5">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-amber-300">
          Figure {figure.number}
        </p>
        <h3 className="mt-1 text-sm font-semibold text-white">
          {figure.title}
        </h3>
        <p className="text-xs text-slate-400">{figure.population}</p>
      </header>
      <KmFigure figure={figure} />
      <div className={TABLE_SCROLL}>
        <table
          role="grid"
          aria-labelledby={atRiskId}
          className="w-full border-collapse"
          onKeyDown={onKeyDown}
        >
          <caption
            id={atRiskId}
            className="px-3 pb-2 pt-3 text-left text-sm font-semibold text-white"
          >
            Number at risk
          </caption>
          <thead>
            <tr className="border-y border-white/[0.12]">
              <th
                scope="col"
                {...cellProps(0, 0)}
                className={`${CELL} font-sans text-slate-300 ${CELL_FOCUS}`}
              >
                Treatment
              </th>
              {figure.atRiskTimes.map((time, index) => (
                <th
                  key={time.time}
                  scope="col"
                  {...cellProps(0, index + 1)}
                  className={`${CELL} text-center font-sans text-slate-300 ${CELL_FOCUS}`}
                >
                  {time.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {figure.atRisk.map((row, rowIndex) => (
              <tr key={row.curveId}>
                <th
                  scope="row"
                  {...cellProps(rowIndex + 1, 0)}
                  className={`${CELL} font-sans font-normal text-slate-200 ${CELL_FOCUS}`}
                >
                  {row.label}
                </th>
                {row.cells.map((cell, index) => {
                  const isSelected = same(selected, cell.resultIds);
                  return (
                    <td
                      key={figure.atRiskTimes[index]?.time ?? index}
                      role="gridcell"
                      {...cellProps(rowIndex + 1, index + 1)}
                      aria-selected={isSelected}
                      data-ars-results={cell.resultIds.join(" ")}
                      onClick={() => onTrace(cell.resultIds)}
                      className={`${CELL} cursor-pointer text-center hover:bg-white/[0.04] ${isSelected ? SELECTED : "text-slate-100"} ${CELL_FOCUS}`}
                    >
                      {cell.text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        data-ars-results={figure.test.resultIds.join(" ")}
        aria-pressed={testSelected}
        onClick={() => onTrace(figure.test.resultIds)}
        className={`${BUTTON_SECONDARY} min-h-12 w-full justify-start text-left font-mono text-xs ${testSelected ? "border-amber-500/60 text-amber-100" : ""}`}
      >
        {figure.test.text}
      </button>
      <details className="border border-white/[0.08] bg-[#0d0e11]">
        <summary className="flex min-h-12 cursor-pointer items-center px-3 text-sm text-slate-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-400">
          Plotted values
        </summary>
        <div className="space-y-4 overflow-x-auto p-3">
          {figure.curves.map((curve) => (
            <table key={curve.id} className="w-full border-collapse">
              <caption className="pb-2 text-left text-xs font-semibold text-white">
                {curve.label} (N={curve.bigN})
              </caption>
              <thead>
                <tr className="border-y border-white/[0.12] text-slate-300">
                  {[
                    "Day",
                    "At risk",
                    "Events",
                    "Censored",
                    "Estimate",
                    "95% CI",
                  ].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className={`${CELL} font-sans`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-slate-100">
                {curve.points.map((point) => (
                  <tr key={point.time}>
                    <th scope="row" className={`${CELL} font-normal`}>
                      {point.time}
                    </th>
                    <td className={CELL}>{point.atRisk}</td>
                    <td className={CELL}>{point.events}</td>
                    <td className={CELL}>{point.censored}</td>
                    <td className={CELL}>{point.survivalText}</td>
                    <td className={CELL}>{point.limitsText}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </details>
      <div className="space-y-1 text-xs leading-relaxed text-slate-400">
        {figure.footnotes.map((note) => (
          <p key={note}>{note}</p>
        ))}
        <p className="text-amber-200">{figure.notice}</p>
      </div>
    </div>
  );
}

/** The run's tables and figure, one at a time, each cell traceable. */
export function TlfPanel({
  tables,
  figures,
  current,
  onCurrent,
  selected,
  onTrace,
}: TlfPanelProps) {
  const outputs = [
    ...tables.map((table) => ({
      id: table.outputId,
      label: outputLabel(table, "Table"),
      title: table.title,
    })),
    ...figures.map((figure) => ({
      id: figure.outputId,
      label: outputLabel(figure, "Figure"),
      title: figure.title,
    })),
  ];
  const table = tables.find((item) => item.outputId === current);
  const figure = figures.find((item) => item.outputId === current);

  return (
    <div className="min-w-0 space-y-5">
      <p className="max-w-3xl text-sm leading-relaxed text-slate-300">
        Select any number to trace it. Each cell names the analysis results it
        shows, and each result names the ADaM rows it was computed from.
      </p>
      <ul
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Outputs"
      >
        {outputs.map((output) => (
          <li key={output.id} className="min-w-0">
            <button
              type="button"
              aria-pressed={current === output.id}
              onClick={() => onCurrent(output.id)}
              className={`${BUTTON_SECONDARY} min-h-12 h-full w-full flex-col items-start justify-start py-2 text-left ${current === output.id ? "border-amber-500/60 bg-amber-500/10" : ""}`}
            >
              <span className="font-mono text-xs text-amber-300">
                {output.label}
              </span>
              <span className="line-clamp-2 break-words text-xs text-slate-300">
                {output.title}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {table ? (
        <ResultTable
          key={table.outputId}
          table={table}
          selected={selected}
          onTrace={onTrace}
        />
      ) : null}
      {figure ? (
        <FigureView
          key={figure.outputId}
          figure={figure}
          selected={selected}
          onTrace={onTrace}
        />
      ) : null}
    </div>
  );
}
