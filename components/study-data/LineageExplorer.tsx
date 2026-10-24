"use client";

import { Fragment, type ReactNode, type RefObject } from "react";
import type {
  LineageLevel,
  LineageRecord,
  LineageRelation,
  LineageResult,
  LineageScheduleEntry,
  LineageStep,
  LineageTrace,
} from "@/lib/study-data";
import { BUTTON_SECONDARY, EYEBROW, HEADING, PANEL } from "./ui";

interface LineageExplorerProps {
  readonly trace: LineageTrace | null;
  readonly busy: boolean;
  readonly error: string | null;
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
  readonly onTraceRecord: (record: LineageRecord) => void;
  readonly onViewRecord: (record: LineageRecord) => void;
  readonly onTraceResult: (resultIds: readonly string[]) => void;
  readonly onShowResult: (result: LineageResult) => void;
  readonly onTraceActivity: (activityId: string, visitId?: string) => void;
  /** Starts an example trace when nothing has been traced yet. */
  readonly onExample: (() => void) | null;
}

const LEVELS: readonly { id: LineageLevel; name: string; detail: string }[] = [
  {
    id: "schedule",
    name: "Study definition",
    detail: "USDM activity and visit",
  },
  { id: "collected", name: "Collected", detail: "Source records" },
  { id: "sdtm", name: "SDTM", detail: "Tabulation records" },
  { id: "adam", name: "ADaM", detail: "Analysis rows" },
  { id: "result", name: "Results", detail: "Table and figure cells" },
];

const RELATION_TEXT: Readonly<Record<LineageRelation, string>> = {
  origin: "Start",
  primary: "Direct",
  linked: "Supporting",
};

const RELATION_STYLE: Readonly<Record<LineageRelation, string>> = {
  origin: "border-amber-500/60 text-amber-200",
  primary: "border-emerald-500/50 text-emerald-300",
  linked: "border-slate-500/50 text-slate-300",
};

const ITEM_BUTTON =
  "min-h-12 w-full min-w-0 border border-white/[0.08] bg-[#0d0e11] px-3 py-2 text-left transition-colors hover:border-amber-500/50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

function Relation({ relation }: { relation: LineageRelation }) {
  return (
    <span
      className={`shrink-0 border px-1.5 py-0.5 font-mono text-[10px] uppercase ${RELATION_STYLE[relation]}`}
    >
      {RELATION_TEXT[relation]}
    </span>
  );
}

/**
 * Renders an identifier such as `DEMO-301:VS:0004:enc_week12:SYSBP` with
 * break opportunities after its separators, so a narrow column wraps it
 * between parts rather than mid-token.
 */
function Breakable({ text }: { text: string }) {
  const parts = text.split(/(?<=[:_·])/);
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? <wbr /> : null}
          {part}
        </Fragment>
      ))}
    </>
  );
}

function direction(level: LineageLevel, origin: LineageLevel): string {
  const order = LEVELS.map((item) => item.id);
  const delta = order.indexOf(level) - order.indexOf(origin);
  if (delta === 0) return "Start";
  return delta < 0 ? "Upstream" : "Downstream";
}

function StepList<T>({
  step,
  render,
}: {
  step: LineageStep<T>;
  render: (item: T, index: number) => ReactNode;
}) {
  return (
    <>
      {step.items.length > 0 ? (
        <ul className="space-y-2">{step.items.map(render)}</ul>
      ) : null}
      {step.total > step.items.length ? (
        <p className="mt-2 text-xs text-slate-400">
          {(step.total - step.items.length).toLocaleString("en-US")} more not
          listed.
        </p>
      ) : null}
      {step.note ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          {step.note}
        </p>
      ) : null}
      {step.total === 0 && !step.note ? (
        <p className="text-xs text-slate-400">Nothing linked at this level.</p>
      ) : null}
    </>
  );
}

function ScheduleItem({
  entry,
  onTrace,
}: {
  entry: LineageScheduleEntry;
  onTrace: (activityId: string, visitId?: string) => void;
}) {
  const visits = entry.visits.map((visit) => visit.name).join(", ");
  const label = entry.activityName ?? `Encounter ${visits}`;
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-amber-200">
          {entry.domain ?? "Visit"}
        </span>
        <Relation relation={entry.relation} />
      </span>
      <span className="mt-1 block break-words text-sm font-semibold text-white">
        {label}
      </span>
      <span className="mt-1 block break-words font-mono text-[11px] text-slate-300">
        {entry.basis === "visit" ? "At " : "Planned at "}
        {visits}
      </span>
    </>
  );
  const { activityId } = entry;
  if (activityId === null) {
    return <li className="border border-white/[0.08] px-3 py-2">{body}</li>;
  }
  const visitId =
    entry.basis === "visit" && entry.visits.length === 1
      ? entry.visits[0].id
      : undefined;
  return (
    <li>
      <button
        type="button"
        className={ITEM_BUTTON}
        onClick={() => onTrace(activityId, visitId)}
      >
        <span className="sr-only">Trace forward: </span>
        {body}
      </button>
    </li>
  );
}

function RecordItem({
  record,
  onTrace,
  onView,
}: {
  record: LineageRecord;
  onTrace: (record: LineageRecord) => void;
  onView: (record: LineageRecord) => void;
}) {
  return (
    <li className="flex min-w-0 gap-1">
      <button
        type="button"
        className={ITEM_BUTTON}
        onClick={() => onTrace(record)}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-amber-200">
            <span className="sr-only">Trace </span>
            {record.dataset}
            <span className="sr-only"> · </span>
          </span>
          <Relation relation={record.relation} />
        </span>
        <span className="mt-1 block break-words font-mono text-xs text-slate-100">
          <Breakable text={record.key} />
        </span>
        <span className="mt-1 block break-words font-mono text-[11px] text-slate-300">
          {record.summary}
        </span>
      </button>
      <button
        type="button"
        className="min-h-12 min-w-12 shrink-0 border border-white/[0.08] bg-[#0d0e11] px-2 font-mono text-[10px] uppercase text-slate-300 hover:border-amber-500/50 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
        aria-label={`View ${record.dataset} row ${record.row + 1} in the dataset viewer`}
        onClick={() => onView(record)}
      >
        View
      </button>
    </li>
  );
}

function ResultItem({
  result,
  onTrace,
  onShow,
}: {
  result: LineageResult;
  onTrace: (resultIds: readonly string[]) => void;
  onShow: (result: LineageResult) => void;
}) {
  const where = result.display
    ? `${result.display.outputName} · ${result.display.location}`
    : `${result.analysisName} · ${result.operation}`;
  return (
    <li className="flex min-w-0 gap-1">
      <button
        type="button"
        className={ITEM_BUTTON}
        onClick={() => onTrace([result.resultId])}
      >
        <span className="sr-only">Trace </span>
        <span className="block font-mono text-base tabular-nums text-amber-200">
          {result.formattedValue}
          <span className="sr-only">: </span>
        </span>
        <span className="mt-1 block break-words text-xs text-slate-100">
          {where}
        </span>
        <span className="mt-1 block break-words font-mono text-[11px] text-slate-400">
          <Breakable text={result.resultId} />
        </span>
      </button>
      {result.display ? (
        <button
          type="button"
          className="min-h-12 min-w-12 shrink-0 border border-white/[0.08] bg-[#0d0e11] px-2 font-mono text-[10px] uppercase text-slate-300 hover:border-amber-500/50 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          aria-label={`View ${where} in its table or figure`}
          onClick={() => onShow(result)}
        >
          View
        </button>
      ) : null}
    </li>
  );
}

/**
 * The lineage explorer: five levels from the protocol's schedule to the
 * reported numbers, filled upstream and downstream of whatever was traced.
 * Every listed item can be traced in turn.
 */
export function LineageExplorer({
  trace,
  busy,
  error,
  headingRef,
  onTraceRecord,
  onViewRecord,
  onTraceResult,
  onShowResult,
  onTraceActivity,
  onExample,
}: LineageExplorerProps) {
  const steps: Record<LineageLevel, ReactNode> | null = trace
    ? {
        schedule: (
          <StepList
            step={trace.schedule}
            render={(entry) => (
              <ScheduleItem
                key={`${entry.activityId}-${entry.visits.map((v) => v.id).join()}`}
                entry={entry}
                onTrace={onTraceActivity}
              />
            )}
          />
        ),
        collected: (
          <StepList
            step={trace.collected}
            render={(record) => (
              <RecordItem
                key={`${record.dataset}-${record.row}`}
                record={record}
                onTrace={onTraceRecord}
                onView={onViewRecord}
              />
            )}
          />
        ),
        sdtm: (
          <StepList
            step={trace.sdtm}
            render={(record) => (
              <RecordItem
                key={`${record.dataset}-${record.row}`}
                record={record}
                onTrace={onTraceRecord}
                onView={onViewRecord}
              />
            )}
          />
        ),
        adam: (
          <StepList
            step={trace.adam}
            render={(record) => (
              <RecordItem
                key={`${record.dataset}-${record.row}`}
                record={record}
                onTrace={onTraceRecord}
                onView={onViewRecord}
              />
            )}
          />
        ),
        result: (
          <StepList
            step={trace.results}
            render={(result) => (
              <ResultItem
                key={result.resultId}
                result={result}
                onTrace={onTraceResult}
                onShow={onShowResult}
              />
            )}
          />
        ),
      }
    : null;
  const totals: Record<LineageLevel, number> | null = trace
    ? {
        schedule: trace.schedule.total,
        collected: trace.collected.total,
        sdtm: trace.sdtm.total,
        adam: trace.adam.total,
        result: trace.results.total,
      }
    : null;

  return (
    <section
      aria-labelledby="lineage-title"
      aria-busy={busy}
      className="border-t border-white/[0.08] py-12 sm:py-16"
    >
      <p className={EYEBROW}>Lineage / 04</p>
      <h2
        id="lineage-title"
        ref={headingRef}
        tabIndex={-1}
        className={`mt-2 scroll-mt-32 ${HEADING} focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400`}
      >
        Lineage explorer
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
        Select a table cell, a dataset value, a finding or a scheduled activity.
        The explorer walks back to the protocol activity that scheduled the
        source and forward to every number it feeds.{" "}
        <span className="text-slate-400">
          Direct records hold the traced value; supporting records contribute to
          it, such as the first-dose date a study day counts from.
        </span>
      </p>
      <div role="status" className="mt-4 min-h-6 text-sm text-slate-200">
        {error ? (
          <span className="text-rose-300">{error}</span>
        ) : busy ? (
          "Tracing…"
        ) : trace ? (
          <>
            Tracing{" "}
            <span className="font-semibold text-white">{trace.title}</span>
            {trace.populationRows !== undefined
              ? ` · computed over a population of ${trace.populationRows.toLocaleString("en-US")} subjects (ADSL rows)`
              : ""}
          </>
        ) : (
          "Nothing traced yet."
        )}
      </div>
      {!trace && onExample ? (
        <button
          type="button"
          onClick={onExample}
          className={`${BUTTON_SECONDARY} mt-4 min-h-12`}
        >
          Trace an example: the Week 12 mean, Placebo
        </button>
      ) : null}
      {trace && steps && totals ? (
        <ol className="mt-6 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {LEVELS.map((level) => (
            <li
              key={level.id}
              className={`${PANEL} p-4 ${trace.originLevel === level.id ? "border-amber-500/40" : ""}`}
            >
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">
                  {level.name}
                  <span className="block font-mono text-[11px] font-normal text-slate-400">
                    {level.detail}
                  </span>
                </h3>
                <span className="text-right font-mono text-[11px] uppercase tracking-[0.12em] text-slate-400">
                  {direction(level.id, trace.originLevel)}
                  <span className="block text-sm tabular-nums text-slate-100">
                    {totals[level.id].toLocaleString("en-US")}
                  </span>
                </span>
              </div>
              {steps[level.id]}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
