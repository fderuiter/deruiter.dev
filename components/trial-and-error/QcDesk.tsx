"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type {
  DeskCellView,
  HandEvaluation,
  InspectionTraceView,
  InspectionView,
  QcFinding,
  SapRulebook,
  StagedTable,
  TlfCard,
} from "@/lib/trial-and-error";

interface QcDeskProps {
  card: TlfCard;
  table: StagedTable;
  rulebook: SapRulebook;
  view: InspectionView;
  /** The card's own value as a High Table, from revealed findings. */
  expected: HandEvaluation;
  unpenalizedMult: number;
  onInspectCell: (row: number, col: number) => void;
  onCorrect: (findingId: string) => void;
  /** Table-to-Listing tracing for this output, when the table offers it. */
  trace?: InspectionTraceView;
  /** Traces a flagged cell to its Listing rows. */
  onTrace?: (row: number, col: number) => void;
  /** Hours a trace takes on an FDA Information Request's clock, or null. */
  traceHours?: number | null;
  /** Suppresses the trace line's fade. */
  reducedMotion?: boolean;
  /** Receives the active grid cell so a dialog can focus it on open. */
  initialFocusRef?: React.MutableRefObject<HTMLElement | null>;
}

const STATUS_STYLES: Record<DeskCellView["status"], string> = {
  UNREVIEWED: "text-zinc-200",
  CLEAN: "text-emerald-300",
  REDLINE: "text-rose-300 line-through decoration-rose-400 decoration-2",
  CORRECTED: "text-amber-300",
};

const STATUS_LABELS: Record<DeskCellView["status"], string> = {
  UNREVIEWED: "not reviewed",
  CLEAN: "clean",
  REDLINE: "redline",
  CORRECTED: "corrected",
};

const SEVERITY_STYLES: Record<QcFinding["severity"], string> = {
  FATAL: "border-rose-500/60 text-rose-300",
  MAJOR: "border-amber-500/60 text-amber-300",
  MINOR: "border-slate-400/60 text-slate-300",
};

const BUTTON_BASE =
  "min-h-[48px] px-4 py-3 border font-mono text-xs font-bold uppercase tracking-wider touch-manipulation active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400";

/**
 * The QC Desk: the spreadsheet-brutalist review grid for one card, shown in
 * the Card Table's Inspect drawer. Review behaviour is unchanged from T&E-01
 * (roving cursor, Enter/Space inspect, C corrects); the card's state lives in
 * the table reducer and every change is dispatched through the callbacks.
 */
export function QcDesk({
  card,
  table,
  rulebook,
  view,
  expected,
  unpenalizedMult,
  onInspectCell,
  onCorrect,
  trace,
  onTrace,
  traceHours = null,
  reducedMotion = false,
  initialFocusRef,
}: QcDeskProps) {
  const [cursor, setCursor] = useState({ row: 0, col: 0 });
  const cellRefs = useRef(new Map<string, HTMLTableCellElement>());
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const sectionRef = useRef<HTMLElement | null>(null);
  // Which traced cell the Listing is showing, and which matched row is current.
  const [focus, setFocus] = useState<{ key: string; index: number } | null>(
    null
  );
  const [line, setLine] = useState<string | null>(null);
  const rows = table.rows.length;
  const cols = table.columns.length;

  const activeCell = view.cells[cursor.row]?.[cursor.col];
  const activeFindings = view.visibleFindings.filter(
    (f) => f.cell.row === cursor.row && f.cell.col === cursor.col
  );
  const activeOpen = view.openFindings.find(
    (f) => f.cell.row === cursor.row && f.cell.col === cursor.col
  );

  const moveTo = (row: number, col: number, options?: FocusOptions) => {
    setCursor({ row, col });
    cellRefs.current.get(`${row}:${col}`)?.focus(options);
  };

  const correct = () => {
    if (activeOpen) onCorrect(activeOpen.id);
  };

  const shown = focus ? trace?.cells[focus.key] : undefined;
  const matched = shown?.matchedSubjectIds ?? [];
  const current =
    focus && matched.length > 0
      ? matched[
          ((focus.index % matched.length) + matched.length) % matched.length
        ]
      : null;
  const currentRow = shown?.rows.find((r) => r.usubjid === current);
  const [focusRow, focusCol] = (focus?.key ?? "0:0").split(":").map(Number);

/* jscpd:ignore-start */
  /**
   * T on a flagged cell: the first press traces it; later presses cycle its
   * matched Listing rows (Shift+T backwards). Review state is untouched.
   */
  const pressTrace = (row: number, col: number, step = 1) => {
    if (!trace || !onTrace) return;
    const key = `${row}:${col}`;
    if (!trace.cells[key]) {
      onTrace(row, col);
      setFocus({ key, index: 0 });
      return;
    }
    setFocus((prev) =>
      prev?.key === key ? { key, index: prev.index + step } : { key, index: 0 }
    );
  };

  // The trace line runs from the traced cell to the current Listing row.
  useLayoutEffect(() => {
    const measure = () => {
      const root = sectionRef.current;
      const cell = focus ? cellRefs.current.get(focus.key) : undefined;
      const row = current ? rowRefs.current.get(current) : undefined;
      if (!root || !cell || !row) {
        setLine(null);
        return;
      }
      const base = root.getBoundingClientRect();
      const a = cell.getBoundingClientRect();
      const b = row.getBoundingClientRect();
      const x1 = a.left + a.width / 2 - base.left;
      const y1 = a.bottom - base.top;
      const x2 = b.left + 8 - base.left;
      const y2 = b.top + b.height / 2 - base.top;
      const bend = (y1 + y2) / 2;
      setLine(`M ${x1} ${y1} C ${x1} ${bend}, ${x2} ${bend}, ${x2} ${y2}`);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [focus, current]);

  const onCellKeyDown = (
    event: React.KeyboardEvent<HTMLTableCellElement>,
    row: number,
    col: number
  ) => {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [Math.max(0, row - 1), col],
      ArrowDown: [Math.min(rows - 1, row + 1), col],
      ArrowLeft: [row, Math.max(0, col - 1)],
      ArrowRight: [row, Math.min(cols - 1, col + 1)],
      Home: [row, 0],
      End: [row, cols - 1],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      moveTo(move[0], move[1]);
      return;
    }
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onInspectCell(row, col);
    } else if (
      event.key.toLowerCase() === "t" &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      event.preventDefault();
      pressTrace(row, col, event.shiftKey ? -1 : 1);
    } else if (
      event.key.toLowerCase() === "c" &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      event.preventDefault();
      correct();
    }
  };

  const slashed = expected.finalMult < unpenalizedMult;

  return (
    <section
      ref={sectionRef}
      aria-labelledby="qc-desk-heading"
      className="relative w-full min-w-0 bg-[#0d0e11] font-mono text-zinc-200"
    >
      {line && (
        <svg
          aria-hidden="true"
          data-testid="trace-line"
          className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
        >
          <motion.path
            key={`${focus?.key}-${current}`}
            d={line}
            fill="none"
            stroke="var(--te-x-mult)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.25 }}
          />
        </svg>
      )}
      <header className="border-b border-zinc-800 px-4 py-3">
        <h2
          id="qc-desk-heading"
          className="text-sm font-bold uppercase tracking-wider text-zinc-100 break-words"
        >
          QC Desk · {card.number}
        </h2>
        <p className="text-xs text-zinc-400 break-words">
          {card.title} · SAP {rulebook.id}: {rulebook.populationSuit}{" "}
          population, {rulebook.percentPrecision} dp,{" "}
          {rulebook.roundingMode.replaceAll("_", " ").toLowerCase()}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-px border-b border-zinc-800 bg-zinc-800">
        <div className="min-w-0 bg-[#13151a] px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400">
            Card value (revealed)
          </div>
          <div
            className="mt-1 text-lg font-bold tabular-nums text-zinc-100 break-words"
            data-testid="expected-value"
          >
            <span
              aria-label={`${expected.chips.total} Chips times ${expected.finalMult} Mult equals ${expected.score}`}
            >
              <span className="text-[color:var(--te-chips)]">
                [{expected.chips.total}]
              </span>{" "}
              × [
              {slashed && (
                <s
                  className="text-zinc-400 decoration-rose-400 decoration-2"
                  data-testid="slashed-mult"
                >
                  {unpenalizedMult}
                </s>
              )}
              {slashed && " "}
              <span
                className={
                  slashed ? "text-rose-300" : "text-[color:var(--te-plus-mult)]"
                }
/* jscpd:ignore-end */
              >
                {expected.finalMult}
              </span>
              ] = {expected.score}
            </span>
          </div>
        </div>
        <div className="min-w-0 bg-[#13151a] px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400">
            Reviewed
          </div>
          <div
            className="mt-1 text-lg font-bold tabular-nums text-zinc-100"
            data-testid="reviewed-count"
          >
            {view.reviewedCells}/{view.totalCells}
          </div>
        </div>
      </div>

      <div className="grid gap-px bg-zinc-800 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 bg-[#0d0e11] p-3">
          <div className="overflow-x-auto">
            <table
              role="grid"
              aria-label={`${card.number} ${table.draftLabel}. Arrow keys move, Enter or Space inspects, C corrects${trace ? ", T traces a flagged cell to its Listing" : ""}.`}
              className="w-full border-collapse text-xs"
            >
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-10 border border-zinc-800 bg-[#13151a] px-2 py-2 text-left font-normal text-zinc-400"
                  >
                    Parameter
                  </th>
                  {table.columns.map((c) => (
                    <th
                      key={c.id}
                      scope="col"
                      className="border border-zinc-800 bg-[#13151a] px-2 py-2 text-right font-normal text-zinc-400"
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, row) => (
                  <tr key={r.id}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 min-w-[7rem] border border-zinc-800 bg-[#0d0e11] px-2 py-2 text-left font-normal text-zinc-300 break-words"
                    >
                      {r.label}
                    </th>
                    {view.cells[row].map((cell) => {
                      const isActive =
                        cell.row === cursor.row && cell.col === cursor.col;
                      return (
                        <td
                          key={cell.col}
                          role="gridcell"
                          tabIndex={isActive ? 0 : -1}
                          ref={(el) => {
                            const key = `${cell.row}:${cell.col}`;
                            if (el) cellRefs.current.set(key, el);
                            else cellRefs.current.delete(key);
                            if (isActive && el && initialFocusRef) {
                              initialFocusRef.current = el;
                            }
                          }}
                          aria-selected={isActive}
                          aria-label={`${r.label}, ${table.columns[cell.col].label}: ${cell.display}, ${STATUS_LABELS[cell.status]}`}
                          data-status={cell.status}
                          data-traced={
                            trace?.cells[`${cell.row}:${cell.col}`]
                              ? ""
                              : undefined
                          }
                          // #956: a pointer press must not focus (and so
                          // scroll) the cell before pointerup, or at narrow
                          // widths the grid shifts under the pointer and the
                          // click never fires. Focus without scrolling on
                          // click instead; keyboard moves still scroll.
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            moveTo(cell.row, cell.col, { preventScroll: true });
                            onInspectCell(cell.row, cell.col);
                          }}
                          onFocus={() => {
                            if (!isActive) {
                              setCursor({ row: cell.row, col: cell.col });
                            }
                          }}
                          onKeyDown={(e) =>
                            onCellKeyDown(e, cell.row, cell.col)
                          }
                          className={`h-12 cursor-pointer whitespace-nowrap border px-2 py-2 text-right tabular-nums outline-none ${
                            isActive
                              ? "border-amber-400 bg-amber-500/10"
                              : "border-zinc-800"
                          } focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 ${STATUS_STYLES[cell.status]} ${
                            trace?.cells[`${cell.row}:${cell.col}`]
                              ? "shadow-[inset_0_-2px_0_var(--te-x-mult)]"
                              : ""
                          }`}
                        >
                          {cell.status === "CORRECTED" ? (
                            <>
                              <s className="mr-1 text-zinc-400">
                                {cell.observed}
                              </s>
                              {cell.display}
                            </>
                          ) : (
                            cell.display
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside
          aria-label="Inspector"
          className="min-w-0 bg-[#13151a] p-3 text-xs"
        >
          <h3 className="text-[10px] uppercase tracking-wider text-zinc-400">
            Inspector
          </h3>
          {activeCell && (
            <p
              className="mt-1 text-zinc-200 break-words"
              data-testid="inspector-cell"
            >
              {table.rows[cursor.row].label} · {table.columns[cursor.col].label}
              : <span className="tabular-nums">{activeCell.display}</span> (
              {STATUS_LABELS[activeCell.status]})
            </p>
          )}
          {activeCell?.status === "UNREVIEWED" && (
            <p className="mt-2 text-zinc-400">
              Press Enter or Space to inspect this cell against the SAP.
            </p>
          )}
          <ul className="mt-2 space-y-2">
            {activeFindings.map((f) => {
              const resolved = !view.openFindings.includes(f);
              return (
                <li
                  key={f.id}
                  className={`border-l-2 bg-[#0d0e11] p-2 ${SEVERITY_STYLES[f.severity]}`}
                  data-testid="finding"
                >
                  <p className="font-bold break-words">
                    {f.ruleId} · {f.category} · {f.severity}
                    {resolved && (
                      <span className="ml-2 text-amber-300">Corrected</span>
                    )}
                  </p>
                  <dl className="mt-1 space-y-1 text-zinc-300">
                    <div>
                      <dt className="inline text-zinc-400">Rule: </dt>
                      <dd className="inline break-words">{f.rule}</dd>
                    </div>
                    <div>
                      <dt className="inline text-zinc-400">Evidence: </dt>
                      <dd className="inline break-words">{f.evidence}</dd>
                    </div>
                    <div>
                      <dt className="inline text-zinc-400">Consequence: </dt>
                      <dd className="inline break-words">{f.consequence}</dd>
                    </div>
                    <div>
                      <dt className="inline text-zinc-400">Fix: </dt>
                      <dd className="inline tabular-nums">
                        {f.observed} → {f.expected}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
          {activeOpen && (
            <button
              type="button"
              onClick={correct}
              className={`${BUTTON_BASE} mt-2 w-full border-amber-500 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20`}
            >
              Flag &amp; Correct [C]
            </button>
          )}
          {trace && activeFindings.length > 0 && (
            <>
              <button
                type="button"
                disabled={trace.blocked !== null}
                onClick={() => pressTrace(cursor.row, cursor.col)}
                className={`${BUTTON_BASE} mt-2 w-full border-rose-400/60 text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Trace to Listing{traceHours !== null && ` · ${traceHours}h`} [T]
              </button>
              {trace.blocked && (
                <p
                  className="mt-1 text-rose-300 break-words"
                  data-testid="trace-blocked"
                >
                  {trace.blocked}
                </p>
              )}
            </>
          )}

          <h3 className="mt-4 text-[10px] uppercase tracking-wider text-zinc-400">
            Redline log
          </h3>
          {view.visibleFindings.length === 0 ? (
            <p className="mt-1 text-zinc-400">No findings revealed yet.</p>
          ) : (
            <ul className="mt-1 space-y-1" data-testid="redline-log">
              {view.visibleFindings.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap justify-between gap-2 tabular-nums"
                >
                  <span
                    className={
                      view.openFindings.includes(f)
                        ? "text-rose-300"
                        : "text-amber-300"
                    }
                  >
                    {f.id}
                  </span>
                  <span className="text-zinc-400">
                    {view.openFindings.includes(f) ? "open" : "corrected"}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {trace && trace.log.length > 0 && (
            <>
              <h3 className="mt-4 text-[10px] uppercase tracking-wider text-zinc-400">
                Trace audit
              </h3>
              <ul className="mt-1 space-y-1" data-testid="trace-audit">
                {trace.log.map((entry) => (
                  <li
                    key={`${entry.listingId}-${entry.cell.row}:${entry.cell.col}`}
                    className="flex flex-wrap justify-between gap-2 tabular-nums"
                  >
                    <span className="min-w-0 break-words">
                      {table.rows[entry.cell.row].label} ·{" "}
                      {table.columns[entry.cell.col].label} ·{" "}
                      {entry.matchedSubjectIds.length}/{entry.subjectIds.length}{" "}
                      rows
                    </span>
                    <span
                      className={
                        entry.resolution === "RESOLVED"
                          ? "text-amber-300"
                          : "text-rose-300"
                      }
                    >
                      {entry.resolution.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
              {trace.synergy && trace.listing && (
                <p
                  className="mt-2 text-[color:var(--te-x-mult)] break-words"
                  data-testid="pair-synergy"
                >
                  Play with {trace.listing.number} for TLF Pair ×2 Mult.
                </p>
              )}
            </>
          )}
        </aside>
      </div>

      {trace?.listing && shown && (
        <div
          className="border-t border-zinc-800 bg-[#13151a] p-3 text-xs"
          data-testid="trace-listing"
        >
          <h3 className="text-[10px] uppercase tracking-wider text-zinc-400 break-words">
            {trace.listing.number} · {trace.listing.title} · filtered on{" "}
            {shown.snapshotId}
          </h3>
          <p className="mt-1 text-zinc-300 break-words">
            {table.rows[focusRow]?.label} · {table.columns[focusCol]?.label}:{" "}
            {matched.length} of {shown.rows.length} subject rows counted.
          </p>
          <p
            role="status"
            aria-live="polite"
            className="mt-1 text-rose-300 break-words"
            data-testid="trace-readout"
          >
            {currentRow
              ? `${currentRow.usubjid}: row ${matched.indexOf(currentRow.usubjid) + 1} of ${matched.length}. ${currentRow.parameter} ${currentRow.value}.`
              : "No subject rows are counted in this cell."}
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse tabular-nums">
              <caption className="sr-only">
                Patient Listing for {table.rows[focusRow]?.label},{" "}
                {table.columns[focusCol]?.label}
              </caption>
              <thead>
                <tr>
                  {["USUBJID", "Arm", "Visit", "Parameter", "Value"].map(
                    (h) => (
                      <th
                        key={h}
                        scope="col"
                        className="border border-zinc-800 px-2 py-1 text-left font-normal text-zinc-400"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {shown.rows.map((r) => {
                  const hit = matched.includes(r.usubjid);
                  const isCurrent = r.usubjid === current;
                  return (
                    <tr
                      key={r.usubjid}
                      ref={(el) => {
                        if (el) rowRefs.current.set(r.usubjid, el);
                        else rowRefs.current.delete(r.usubjid);
                      }}
                      data-matched={hit ? "" : undefined}
                      data-testid={isCurrent ? "trace-current" : undefined}
                      className={
                        isCurrent
                          ? "bg-rose-500/10 text-rose-200 outline outline-1 -outline-offset-1 outline-rose-400"
                          : hit
                            ? "bg-amber-500/5 text-amber-200"
                            : "text-zinc-400"
                      }
                    >
                      <td className="border border-zinc-800 px-2 py-1">
                        {r.usubjid}
                      </td>
                      <td className="border border-zinc-800 px-2 py-1">
                        {r.arm}
                      </td>
                      <td className="border border-zinc-800 px-2 py-1">
                        {r.visit}
                      </td>
                      <td className="border border-zinc-800 px-2 py-1">
                        {r.parameter}
                      </td>
                      <td className="border border-zinc-800 px-2 py-1 break-words">
                        {r.value}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
