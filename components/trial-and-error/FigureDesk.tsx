"use client";

import React, { useRef, useState } from "react";
import type {
  CardFace,
  FigureInspectionView,
  KmFinding,
} from "@/lib/trial-and-error";
import { AtRiskStrip } from "@/components/trial-and-error/cards/AtRiskStrip";
import { MiniOutput } from "@/components/trial-and-error/cards/CardFace";

interface FigureDeskProps {
  view: FigureInspectionView;
  /** The figure's face as the card currently prints it. */
  face: CardFace;
  /** The parent Table's face, for drill-down to the source evidence. */
  parentFace: CardFace | null;
  onReconcile: (findingId: string) => void;
  /** Receives the first finding (or the heading) so a dialog can focus it. */
  initialFocusRef?: React.MutableRefObject<HTMLElement | null>;
}

const CHECK_LABELS: Record<KmFinding["check"], string> = {
  TIME_ORIGIN: "Time origin",
  MONOTONIC: "Monotonic curve",
  ESTIMATE: "Survival estimate",
  CENSOR_TICK: "Censoring ticks",
  AT_RISK: "Number at risk",
  PARENT_AT_RISK: "Parent: at risk at t0",
  PARENT_EVENTS: "Parent: events",
};

const BUTTON_BASE =
  "min-h-[48px] px-4 py-3 border font-mono text-xs font-bold uppercase tracking-wider touch-manipulation active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400";

/**
 * The Figure Desk: the Inspect drawer's view of a Kaplan–Meier figure.
 * Inspecting a figure reveals every check at once; each finding is
 * reconciled with C (or its button), and the at-risk strip marks open and
 * reconciled cells. The parent Table's face sits alongside for drill-down.
 * Everything shown is derived by the table reducer.
 */
/* jscpd:ignore-start */
export function FigureDesk({
  view,
  face,
  parentFace,
  onReconcile,
  initialFocusRef,
}: FigureDeskProps) {
  const [cursor, setCursor] = useState(0);
  const itemRefs = useRef(new Map<number, HTMLButtonElement>());
  const { card, km, report, status, expected } = view;
  const resolved = new Set(view.resolvedFindingIds);
  const findings = report.findings;
  const armIndex = (arm: KmFinding["arm"]) =>
    km.displayed.findIndex((d) => d.arm === arm);

  const marks: Record<string, "open" | "reconciled"> = {};
  for (const f of findings) {
    if (f.check !== "AT_RISK" || f.milestone === null) continue;
    const key = `${armIndex(f.arm)}:${km.milestones.indexOf(f.milestone)}`;
    marks[key] = resolved.has(f.id) ? "reconciled" : "open";
  }

  const moveTo = (i: number) => {
    setCursor(i);
    itemRefs.current.get(i)?.focus();
  };

  const onKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    i: number
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveTo(Math.min(findings.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveTo(Math.max(0, i - 1));
    } else if (
      event.key.toLowerCase() === "c" &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      event.preventDefault();
      if (!resolved.has(findings[i].id)) onReconcile(findings[i].id);
    }
  };

  const parentRows = new Set([km.parent.atRiskRow, km.parent.eventsRow]);

  return (
    <section
      aria-labelledby="figure-desk-heading"
      className="w-full min-w-0 bg-[#0d0e11] font-mono text-zinc-200"
      data-testid="figure-desk"
    >
      <header className="border-b border-zinc-800 px-4 py-3">
        <h2
          id="figure-desk-heading"
          tabIndex={-1}
          ref={(el) => {
            if (el && initialFocusRef && findings.length === 0) {
              initialFocusRef.current = el;
            }
          }}
          className="text-sm font-bold uppercase tracking-wider text-zinc-100 break-words outline-none"
        >
          Figure Desk · {card.number}
        </h2>
        <p className="text-xs text-zinc-400 break-words">
          {km.endpoint} ({km.timeUnit}) · {report.snapshotId} · depends on{" "}
          {status.parent}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-px border-b border-zinc-800 bg-zinc-800">
        <div className="min-w-0 bg-[#13151a] px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400">
            Card value (revealed)
          </div>
          <div
            className="mt-1 text-lg font-bold tabular-nums text-zinc-100 break-words"
            data-testid="figure-expected-value"
          >
            {expected.chips.total} × {expected.finalMult} = {expected.score}
          </div>
        </div>
        <div className="min-w-0 bg-[#13151a] px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400">
            ×Mult
          </div>
          <div
            className={`mt-1 text-sm font-bold break-words ${status.active ? "text-[color:var(--te-x-mult)]" : "text-zinc-400"}`}
            data-testid="figure-status"
          >
            {status.active
              ? `×${status.xMult} live`
              : `×${status.xMult} off: ${status.reason}`}
          </div>
        </div>
      </div>

      <div className="grid gap-px bg-zinc-800 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-3 bg-[#0d0e11] p-3">
          <MiniOutput
            face={face}
            size="detail"
            caption={`${card.number}: ${card.title}`}
          />
          {face.kind === "FIGURE" && face.atRisk && (
            <AtRiskStrip atRisk={face.atRisk} marks={marks} />
          )}
          {parentFace && view.parent && (
            <div data-testid="figure-parent">
              <h3 className="text-[10px] uppercase tracking-wider text-zinc-400">
                Source evidence · {view.parent.number}
              </h3>
              {parentFace.kind === "TABLE" ? (
                <table className="mt-1 w-full border-collapse text-xs tabular-nums">
                  <caption className="sr-only">
                    {view.parent.number} rows the figure reconciles against
                  </caption>
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="border border-zinc-800 px-2 py-1 text-left font-normal text-zinc-400"
                      >
                        Row
                      </th>
                      {parentFace.columns.map((c) => (
                        <th
                          key={c}
                          scope="col"
                          className="border border-zinc-800 px-2 py-1 text-right font-normal text-zinc-400"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parentFace.rows.map((row) => (
                      <tr
                        key={row.label}
                        data-reconciles={
                          parentRows.has(row.label) ? "" : undefined
                        }
/* jscpd:ignore-end */
                        className={
                          parentRows.has(row.label)
                            ? "bg-amber-500/5 text-amber-200"
                            : "text-zinc-400"
                        }
                      >
                        <th
                          scope="row"
                          className="border border-zinc-800 px-2 py-1 text-left font-normal"
                        >
                          {row.label}
                        </th>
                        {row.values.map((v, i) => (
                          <td
                            key={i}
                            className="border border-zinc-800 px-2 py-1 text-right"
                          >
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <MiniOutput face={parentFace} size="detail" />
              )}
            </div>
          )}
        </div>

        <aside
          aria-label="Kaplan–Meier checks"
          className="min-w-0 bg-[#13151a] p-3 text-xs"
        >
          <h3 className="text-[10px] uppercase tracking-wider text-zinc-400">
            Kaplan–Meier checks
          </h3>
          {findings.length === 0 ? (
            <p className="mt-1 text-emerald-300">
              Every check passes: origin, curve, ticks, estimates and Number at
              risk reconcile.
            </p>
          ) : (
            <ul
              className="mt-2 space-y-2"
              aria-label="Findings. Arrow keys move between findings; C or Enter reconciles."
              data-testid="km-findings"
            >
              {findings.map((f, i) => {
                const done = resolved.has(f.id);
                return (
                  <li
                    key={f.id}
                    data-testid="km-finding"
                    data-resolved={done ? "" : undefined}
                    className={`border-l-2 bg-[#0d0e11] p-2 ${done ? "border-amber-500/60" : "border-rose-500/60"}`}
                  >
                    <p className="font-bold break-words">
                      {CHECK_LABELS[f.check]} ·{" "}
                      {f.arm === "PLACEBO" ? "Placebo" : "Active"}
                      {f.milestone === null ? "" : ` · t=${f.milestone}`}
                      {done && (
                        <span className="ml-2 text-amber-300">Reconciled</span>
                      )}
                    </p>
                    <p className="mt-1 text-zinc-300 break-words">
                      {f.evidence}
                    </p>
                    <p className="mt-1 tabular-nums">
                      {f.observed} → {f.expected}
                    </p>
                    <button
                      type="button"
                      ref={(el) => {
                        if (el) itemRefs.current.set(i, el);
                        else itemRefs.current.delete(i);
                        if (el && i === cursor && initialFocusRef) {
                          initialFocusRef.current = el;
                        }
                      }}
                      tabIndex={i === cursor ? 0 : -1}
                      aria-disabled={done || undefined}
                      onFocus={() => setCursor(i)}
                      onKeyDown={(e) => onKeyDown(e, i)}
                      onClick={() => {
                        if (!done) onReconcile(f.id);
                      }}
                      aria-label={`${done ? "Reconciled" : "Reconcile"} ${CHECK_LABELS[f.check]}, ${f.arm === "PLACEBO" ? "Placebo" : "Active"}${f.milestone === null ? "" : ` at ${f.milestone}`}: ${f.observed} to ${f.expected}`}
                      className={`${BUTTON_BASE} mt-2 w-full ${done ? "border-zinc-700 text-zinc-400" : "border-amber-500 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"}`}
                    >
                      {done ? "Reconciled" : "Reconcile [C]"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
}
