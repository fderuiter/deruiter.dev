"use client";

import React from "react";
import {
  computeMeters,
  exportAuditFindingsCsv,
  exportDecisionLogCsv,
  exportDialogueCsv,
  exportMeetingsCsv,
  exportMeterTrajectoryCsv,
  exportRetrospectiveJson,
  exportSiteVisitsCsv,
  type FinalReport,
} from "@/lib/study-director";
import type { WorldState } from "@/lib/study-director-world";
import { MeetingReplayPanel } from "../study-director-world/MeetingReplayPanel";
import { Card } from "./Panels";
import { HealthRadar } from "./HealthRadar";
import { DecisionTimeline } from "./DecisionTimeline";
import { verdictFor } from "./closeout";
import { DIFFICULTY_TEXT } from "./DifficultyPicker";
import { downloadFile } from "@/lib/download";

const OUTCOME_STYLE = {
  closed: "border-emerald-500/50 text-emerald-400",
  minor: "border-amber-500/50 text-amber-400",
  major: "border-red-500/60 text-red-400",
} as const;

const OUTCOME_LABEL = {
  closed: "Finding closed",
  minor: "Minor observation",
  major: "Major observation",
} as const;

const GRADE_TONE = {
  A: "border-emerald-500 text-emerald-400",
  B: "border-emerald-500/70 text-emerald-400",
  C: "border-amber-500 text-amber-400",
  D: "border-red-500/70 text-red-400",
  F: "border-red-500 text-red-400",
} as const;

const VERDICT_TONE = {
  good: "text-emerald-400",
  mixed: "text-amber-400",
  bad: "text-red-400",
} as const;

const Figure: React.FC<{
  label: string;
  value: string;
  bad?: boolean;
}> = ({ label, value, bad = false }) => (
  <div className="min-w-0">
    <dt className="text-[10px] tracking-wide break-words text-[var(--sd-muted)] uppercase">
      {label}
    </dt>
    <dd
      className={`text-lg font-bold tabular-nums ${bad ? "text-red-400" : "text-[var(--sd-text)]"}`}
    >
      {value}
    </dd>
  </div>
);

/** The closeout: verdict, grade, the study's shape, and the inspection. */
export const ReportView: React.FC<{
  report: FinalReport;
  world?: WorldState;
  onRestart: () => void;
  /** Shown under the verdict: sharing and career news. */
  share?: React.ReactNode;
}> = ({ report, world, onRestart, share }) => {
  const { evaluations: ev, profile, lock, inspection, state } = report;
  const verdict = verdictFor(report);
  const open = inspection.items.filter((i) => i.outcome !== "closed").length;
  const worldCtx = world ?? report.world;
  const meetings = worldCtx?.meetingHistory ?? [];
  const [showMeetingReplay, setShowMeetingReplay] = React.useState(false);

  return (
    <div className="space-y-3" data-testid="study-report">
      {showMeetingReplay ? (
        <MeetingReplayPanel
          meetings={meetings}
          onClose={() => setShowMeetingReplay(false)}
        />
      ) : null}
      <section
        aria-label="Verdict"
        className="sd-enter flex flex-wrap items-center justify-between gap-4 border border-[var(--sd-hairline-strong)] bg-[var(--sd-surface)] p-5"
      >
        <div className="min-w-0 flex-1 basis-72">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase">
            Database lock and closeout · Study {state.setup.id} ·{" "}
            {DIFFICULTY_TEXT[state.difficulty ?? "standard"].label}
          </p>
          <h2
            className={`mt-1 text-2xl font-extrabold tracking-[-0.035em] break-words sm:text-3xl ${VERDICT_TONE[verdict.tone]}`}
          >
            {verdict.headline}
          </h2>
          <p className="mt-1 max-w-prose text-sm text-zinc-300">
            {verdict.line}
          </p>
          <p className="mt-2 text-xs text-[var(--sd-muted)]">
            {lock.openQueriesAtLock === 0
              ? "The database locked clean."
              : `${lock.openQueriesAtLock} queries were still open at lock, which cost ${lock.lockDelayDays} days.`}{" "}
            Data cleanliness {lock.dataCleanPct}%. The study ran{" "}
            {state.setup.durationDays + state.slipDays} days against{" "}
            {state.setup.durationDays} planned.
          </p>
        </div>
        <div
          className={`sd-stamp flex h-28 w-28 shrink-0 flex-col items-center justify-center border-4 border-double ${GRADE_TONE[ev.regulatory.grade]}`}
          role="img"
          aria-label={`Inspection readiness grade ${ev.regulatory.grade}`}
        >
          <span className="text-5xl leading-none font-black">
            {ev.regulatory.grade}
          </span>
          <span className="mt-1 text-[9px] font-bold tracking-[0.14em] uppercase">
            Readiness
          </span>
        </div>
      </section>
      {share}

      <Card title="Export Retrospective & Audit Data" hint="JSON & CSV Formats">
        <div
          className="flex flex-wrap items-center gap-2 pt-1"
          data-testid="export-actions"
        >
          <button
            type="button"
            onClick={() => {
              const json = exportRetrospectiveJson(report, worldCtx);
              downloadFile(json, `study-${state.setup.id}-retrospective.json`, {
                mimeType: "application/json",
              });
            }}
            className="border border-amber-500/80 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20"
          >
            Download Retrospective JSON
          </button>
          <button
            type="button"
            onClick={() => {
              const csv = exportDecisionLogCsv(report);
              downloadFile(csv, `study-${state.setup.id}-decisions.csv`, {
                mimeType: "text/csv",
              });
            }}
            className="border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:border-amber-400 hover:text-amber-300"
          >
            Export Decisions CSV
          </button>
          <button
            type="button"
            onClick={() => {
              const csv = exportMeterTrajectoryCsv(report);
              downloadFile(csv, `study-${state.setup.id}-meters.csv`, {
                mimeType: "text/csv",
              });
            }}
            className="border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:border-amber-400 hover:text-amber-300"
          >
            Export Meter Trajectory CSV
          </button>
          <button
            type="button"
            onClick={() => {
              const csv = exportAuditFindingsCsv(report);
              downloadFile(csv, `study-${state.setup.id}-findings.csv`, {
                mimeType: "text/csv",
              });
            }}
            className="border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:border-amber-400 hover:text-amber-300"
          >
            Export Findings CSV
          </button>
          <button
            type="button"
            onClick={() => {
              const csv = exportMeetingsCsv(report, worldCtx);
              downloadFile(csv, `study-${state.setup.id}-meetings.csv`, {
                mimeType: "text/csv",
              });
            }}
            className="border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:border-amber-400 hover:text-amber-300"
          >
            Export Meetings CSV
          </button>
          <button
            type="button"
            onClick={() => {
              const csv = exportSiteVisitsCsv(report, worldCtx);
              downloadFile(csv, `study-${state.setup.id}-site-visits.csv`, {
                mimeType: "text/csv",
              });
            }}
            className="border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:border-amber-400 hover:text-amber-300"
          >
            Export Site Visits CSV
          </button>
          <button
            type="button"
            onClick={() => {
              const csv = exportDialogueCsv(report, worldCtx);
              downloadFile(csv, `study-${state.setup.id}-dialogue.csv`, {
                mimeType: "text/csv",
              });
            }}
            className="border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:border-amber-400 hover:text-amber-300"
          >
            Export Dialogue CSV
          </button>
          {meetings.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowMeetingReplay(true)}
              className="border border-amber-500/80 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20"
              data-testid="report-meeting-replay-button"
            >
              Replay Meetings ({meetings.length})
            </button>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <Card title="Final study health">
          <HealthRadar meters={computeMeters(state)} />
        </Card>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <Card title="Sponsor">
            <p
              className="text-2xl text-amber-400"
              role="img"
              aria-label={`${ev.sponsor.stars} out of 5 stars`}
            >
              {"★".repeat(ev.sponsor.stars)}
              <span className="text-zinc-700">
                {"★".repeat(5 - ev.sponsor.stars)}
              </span>
            </p>
            <p className="mt-1 text-xs break-words text-zinc-300">
              “{ev.sponsor.quote}”
            </p>
          </Card>
          <Card title="Company">
            <dl className="grid grid-cols-2 gap-2">
              <Figure
                label="Margin"
                value={`${ev.company.marginPct}%`}
                bad={ev.company.marginPct < 0}
              />
              <Figure
                label="Timeline variance"
                value={`${ev.company.timelineVarianceDays > 0 ? "+" : ""}${ev.company.timelineVarianceDays} days`}
                bad={ev.company.timelineVarianceDays > 0}
              />
            </dl>
          </Card>
          <Card title="Science">
            <dl className="grid grid-cols-3 gap-2">
              <Figure
                label="Primary endpoint evaluable"
                value={`${ev.science.evaluablePct}%`}
                bad={ev.science.evaluablePct < 80}
              />
              <Figure
                label="Missing data"
                value={`${ev.science.missingPct}%`}
                bad={ev.science.missingPct > 10}
              />
              <Figure
                label="Major deviations"
                value={`${ev.science.majorDeviations}`}
                bad={ev.science.majorDeviations > 0}
              />
            </dl>
          </Card>
          <Card title="Regulatory">
            <p className="text-xs text-zinc-300">
              Inspection readiness:{" "}
              <span className="text-lg font-bold text-amber-400">
                {ev.regulatory.grade}
              </span>
            </p>
            <p className="text-xs text-[var(--sd-muted)]">
              {ev.regulatory.gaps} documentation gap
              {ev.regulatory.gaps === 1 ? "" : "s"} identified.
            </p>
          </Card>
        </div>
      </div>

      <Card title="Every call you made" hint="Day by day">
        <DecisionTimeline state={state} />
      </Card>

      <Card title="Your Study Director profile">
        <p className="text-lg font-bold text-zinc-100">{profile.title}</p>
        <p className="mt-1 text-xs text-zinc-300">{profile.summary}</p>
        <ul className="mt-2 list-inside list-disc text-[11px] text-[var(--sd-muted)]">
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
            <p className="text-xs text-zinc-300">
              The inspector found nothing to ask about.
            </p>
          ) : (
            <ol className="space-y-2">
              {inspection.items.map((item, i) => (
                <li
                  key={`${item.eventId}-${item.day}`}
                  style={{ animationDelay: `${300 + i * 250}ms` }}
                  className={`sd-enter border-l-2 bg-[var(--sd-bg)] p-2.5 text-xs ${OUTCOME_STYLE[item.outcome]}`}
                >
                  <p className="text-[10px] text-[var(--sd-muted)] uppercase">
                    Question {i + 1} · about day {item.day}
                  </p>
                  <p className="mt-0.5 break-words text-zinc-100">
                    {item.question}
                  </p>
                  <p className="mt-1 break-words text-[var(--sd-muted)]">
                    On file: {item.answer}
                  </p>
                  <p className="mt-1 font-bold">
                    {OUTCOME_LABEL[item.outcome]}
                  </p>
                </li>
              ))}
            </ol>
          )
        ) : (
          <p className="text-xs text-zinc-300">
            The FDA did not come. With {open} open gap{open === 1 ? "" : "s"},
            it could have.
          </p>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="min-h-[44px] border border-[var(--sd-amber)] bg-[var(--sd-amber)]/10 px-4 text-sm font-bold text-amber-300 hover:bg-[var(--sd-amber)]/20 active:scale-[0.98]"
        >
          Start another study
        </button>
        <p className="text-[11px] text-[var(--sd-muted)]">
          Run seed <span className="text-zinc-300">{state.seed}</span>
        </p>
      </div>
    </div>
  );
};
