"use client";

import React from "react";
import type { FinalReport } from "@/lib/study-director";
import { Card } from "./Panels";

const OUTCOME_STYLE = {
  closed: "text-emerald-400",
  minor: "text-amber-400",
  major: "text-red-400",
} as const;

const OUTCOME_LABEL = {
  closed: "Finding closed",
  minor: "Minor observation",
  major: "Major observation",
} as const;

export const ReportView: React.FC<{
  report: FinalReport;
  onRestart: () => void;
}> = ({ report, onRestart }) => {
  const { evaluations: ev, profile, lock, inspection } = report;
  return (
    <div className="space-y-3" data-testid="study-report">
      <h2 className="font-mono text-xl font-extrabold tracking-[-0.035em] text-zinc-100">
        Database lock and closeout
      </h2>
      <p className="font-mono text-xs text-zinc-300">
        {lock.openQueriesAtLock === 0
          ? "The database locked clean."
          : `${lock.openQueriesAtLock} queries were still open at lock, which cost ${lock.lockDelayDays} days.`}{" "}
        Data cleanliness: {lock.dataCleanPct}%.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <Card title="Sponsor">
          <p
            className="font-mono text-2xl text-amber-400"
            aria-label={`${ev.sponsor.stars} out of 5 stars`}
          >
            {"★".repeat(ev.sponsor.stars)}
            <span className="text-zinc-700">
              {"★".repeat(5 - ev.sponsor.stars)}
            </span>
          </p>
          <p className="mt-1 font-mono text-xs text-zinc-300">
            “{ev.sponsor.quote}”
          </p>
        </Card>
        <Card title="Company">
          <dl className="grid grid-cols-2 gap-1 font-mono text-xs text-zinc-300">
            <dt>Margin</dt>
            <dd className="tabular-nums">{ev.company.marginPct}%</dd>
            <dt>Timeline variance</dt>
            <dd className="tabular-nums">
              {ev.company.timelineVarianceDays > 0 ? "+" : ""}
              {ev.company.timelineVarianceDays} days
            </dd>
          </dl>
        </Card>
        <Card title="Science">
          <dl className="grid grid-cols-2 gap-1 font-mono text-xs text-zinc-300">
            <dt>Primary endpoint evaluable</dt>
            <dd className="tabular-nums">{ev.science.evaluablePct}%</dd>
            <dt>Missing data</dt>
            <dd className="tabular-nums">{ev.science.missingPct}%</dd>
            <dt>Major deviations</dt>
            <dd className="tabular-nums">{ev.science.majorDeviations}</dd>
          </dl>
        </Card>
        <Card title="Regulatory">
          <p className="font-mono text-xs text-zinc-300">
            Inspection readiness:{" "}
            <span className="text-lg font-bold text-amber-400">
              {ev.regulatory.grade}
            </span>
          </p>
          <p className="font-mono text-xs text-zinc-400">
            {ev.regulatory.gaps} documentation gap
            {ev.regulatory.gaps === 1 ? "" : "s"} identified.
          </p>
        </Card>
      </div>

      <Card title="Your Study Director profile">
        <p className="font-mono text-lg font-bold text-zinc-100">
          {profile.title}
        </p>
        <p className="mt-1 font-mono text-xs text-zinc-300">
          {profile.summary}
        </p>
        <ul className="mt-2 list-inside list-disc font-mono text-[11px] text-zinc-400">
          {profile.evidence.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Card>

      <Card
        title={
          inspection.triggered ? "FDA inspection" : "No inspection this time"
        }
        hint={`Grade ${inspection.grade}`}
      >
        {inspection.triggered ? (
          inspection.items.length === 0 ? (
            <p className="font-mono text-xs text-zinc-300">
              The inspector found nothing to ask about.
            </p>
          ) : (
            <ol className="space-y-2">
              {inspection.items.map((item) => (
                <li
                  key={`${item.eventId}-${item.day}`}
                  className="border border-zinc-800 bg-[#0d0e11] p-2 font-mono text-xs"
                >
                  <p className="break-words text-zinc-100">{item.question}</p>
                  <p className="mt-1 break-words text-zinc-400">
                    Day {item.day}. {item.answer}
                  </p>
                  <p
                    className={`mt-1 font-bold ${OUTCOME_STYLE[item.outcome]}`}
                  >
                    {OUTCOME_LABEL[item.outcome]}
                  </p>
                </li>
              ))}
            </ol>
          )
        ) : (
          <p className="font-mono text-xs text-zinc-300">
            The FDA did not come. With{" "}
            {inspection.items.filter((i) => i.outcome !== "closed").length} open
            gap
            {inspection.items.filter((i) => i.outcome !== "closed").length === 1
              ? ""
              : "s"}
            , it could have.
          </p>
        )}
      </Card>

      <button
        type="button"
        onClick={onRestart}
        className="min-h-[44px] border border-amber-500 bg-amber-500/10 px-4 font-mono text-sm font-bold text-amber-300 hover:bg-amber-500/20"
      >
        Start another study
      </button>
    </div>
  );
};
