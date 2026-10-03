"use client";

import React, { useId, useMemo, useState } from "react";
import { computeDriftGauge, objectiveFor, type Severity } from "./drift-gauge";
import { useProtocolDriftStore } from "./store";

const SEVERITY_STYLE: Record<Severity, string> = {
  green: "border-emerald-500/60 text-emerald-400",
  amber: "border-amber-500/70 text-amber-400",
  red: "border-amber-500 bg-amber-500/10 text-amber-300",
};

const SEVERITY_WORD: Record<Severity, string> = {
  green: "steady",
  amber: "watch",
  red: "blocking",
};

/** Objective, live epistemic debt counters and the Global Drift Gauge. */
export function ObjectiveStrip() {
  const view = useProtocolDriftStore((s) => s.view);
  const snapshot = useProtocolDriftStore((s) => s.snapshot);
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const gauge = useMemo(() => (view ? computeDriftGauge(view) : null), [view]);
  const debt = view?.debt;

  return (
    <section
      aria-label="Objective and drift"
      className="relative flex min-h-12 flex-wrap items-center gap-x-4 gap-y-1 border-b border-zinc-800 bg-[#0d0e11] px-3 py-1.5 font-mono text-xs"
    >
      <p className="min-w-0 flex-1 basis-60 break-words text-zinc-100">
        {view ? objectiveFor(view) : "Awaiting briefing"}
      </p>
      <ul
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-300"
        aria-label="Epistemic debt"
      >
        <li data-testid="debt-fab">
          FAB{" "}
          <b className="tabular-nums text-zinc-100">
            {(debt?.fabricatedBits ?? 0).toFixed(2)}
          </b>{" "}
          bits
        </li>
        <li data-testid="debt-loss">
          LOSS{" "}
          <b className="tabular-nums text-zinc-100">
            {debt?.semanticLossCount ?? 0}
          </b>
        </li>
        <li data-testid="debt-uncertain">
          UNCERTAIN{" "}
          <b className="tabular-nums text-zinc-100">
            {debt?.uncertainCount ?? 0}
          </b>
        </li>
        <li data-testid="debt-trace">
          TRACE{" "}
          <b className="tabular-nums text-zinc-100">{debt?.traceBreaks ?? 0}</b>
        </li>
        <li className="text-zinc-300">
          VS{" "}
          <b className="tabular-nums text-zinc-100">
            {snapshot?.recordCounts.sdtmVs ?? 0}
          </b>
        </li>
      </ul>
      {gauge ? (
        <div className="relative">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={popoverId}
            onClick={() => setOpen((v) => !v)}
            className={`inline-flex min-h-8 items-center gap-2 border px-2 ${SEVERITY_STYLE[gauge.overall]}`}
          >
            <span>Operational Drift</span>
            {gauge.segments.map((segment) => (
              <span
                key={segment.id}
                title={`${segment.label}: ${segment.detail}`}
                className={`border px-1 text-[10px] ${SEVERITY_STYLE[segment.severity]}`}
              >
                {segment.label} {SEVERITY_WORD[segment.severity]}
              </span>
            ))}
          </button>
          {open ? (
            <div
              id={popoverId}
              role="region"
              aria-label="Operational Drift detail"
              className="absolute right-0 top-full z-30 mt-1 w-80 max-w-[80vw] border border-zinc-700 bg-[#13151a] p-3 text-[11px] text-zinc-200"
            >
              <p className="mb-2 text-zinc-300">
                Overall severity is the worst segment. A low reading does not
                mean the data is true.
              </p>
              <ul className="space-y-1.5">
                {gauge.segments.map((segment) => (
                  <li key={segment.id}>
                    <b className="text-zinc-100">{segment.label}</b> (
                    {SEVERITY_WORD[segment.severity]}): {segment.detail}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
