"use client";

import React from "react";
import {
  AUDIT_ATTENTION,
  AUDIT_WINDOW_DAYS,
  computeMeters,
  dashboard,
  type Health,
  type MeterId,
  type StudyState,
  METER_IDS,
  AREA_IDS,
} from "@/lib/study-director";
import {
  AREA_LABELS,
  COORDINATOR_LABELS,
  HEALTH_LABELS,
  METER_LABELS,
  ROLE_LABELS,
} from "./labels";

const HEALTH_STYLE: Record<Health, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

const HEALTH_TEXT: Record<Health, string> = {
  green: "text-emerald-400",
  amber: "text-amber-400",
  red: "text-red-400",
};

export const Card: React.FC<{
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, hint, children, className = "" }) => (
  <section
    aria-label={title}
    className={`min-w-0 border border-zinc-800 bg-[#13151a] p-3 ${className}`}
  >
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <h2 className="font-mono text-[11px] font-bold tracking-wider text-zinc-300 uppercase">
        {title}
      </h2>
      {hint ? (
        <span className="font-mono text-[10px] text-zinc-400">{hint}</span>
      ) : null}
    </div>
    {children}
  </section>
);

export const DashboardPanel: React.FC<{ state: StudyState }> = ({ state }) => {
  const board = dashboard(state);
  return (
    <Card title="Dashboard" hint="What everyone reports">
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {AREA_IDS.map((id) => {
          const area = board[id];
          return (
            <li
              key={id}
              className="flex min-w-0 items-start gap-2 border border-zinc-800/80 bg-[#0d0e11] px-2 py-1.5"
            >
              <span
                aria-hidden="true"
                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${HEALTH_STYLE[area.health]}`}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-xs font-semibold text-zinc-100">
                    {AREA_LABELS[id]}
                  </span>
                  <span
                    className={`font-mono text-[10px] uppercase ${HEALTH_TEXT[area.health]}`}
                  >
                    {HEALTH_LABELS[area.health]}
                  </span>
                </div>
                <p className="font-mono text-[11px] break-words text-zinc-400">
                  {area.summary}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
};

function meterTone(value: number): string {
  if (value >= 65) return "bg-emerald-500";
  if (value >= 35) return "bg-amber-500";
  return "bg-red-500";
}

export const MetersPanel: React.FC<{ state: StudyState }> = ({ state }) => {
  const meters = computeMeters(state);
  return (
    <Card title="Study meters" hint="You cannot max all six">
      <ul className="space-y-2">
        {METER_IDS.map((id: MeterId) => (
          <li key={id} className="min-w-0">
            <div className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
              <span className="text-zinc-200">{METER_LABELS[id]}</span>
              <span className="text-zinc-300 tabular-nums">{meters[id]}</span>
            </div>
            <div
              role="meter"
              aria-label={METER_LABELS[id]}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={meters[id]}
              className="mt-0.5 h-1.5 w-full bg-zinc-800"
            >
              <div
                className={`h-full ${meterTone(meters[id])}`}
                style={{ width: `${meters[id]}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export const TeamPanel: React.FC<{ state: StudyState }> = ({ state }) => (
  <Card title="Study team" hint="Workload">
    <ul className="space-y-2">
      {state.team.map((member) => (
        <li key={member.id} className="min-w-0">
          <div className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
            <span className="min-w-0 truncate text-zinc-100">
              {member.name}{" "}
              <span className="text-zinc-400">{ROLE_LABELS[member.role]}</span>
            </span>
            <span
              className={`tabular-nums ${member.workload > 85 ? "text-red-400" : member.workload > 70 ? "text-amber-400" : "text-zinc-300"}`}
            >
              {member.workload}%
            </span>
          </div>
          <div
            role="meter"
            aria-label={`${member.name} workload`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={member.workload}
            className="mt-0.5 h-1 w-full bg-zinc-800"
          >
            <div
              className={`h-full ${member.workload > 85 ? "bg-red-500" : member.workload > 70 ? "bg-amber-500" : "bg-slate-400"}`}
              style={{ width: `${member.workload}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  </Card>
);

export const SitesPanel: React.FC<{
  state: StudyState;
  canAudit: boolean;
  onAudit: (siteId: string) => void;
}> = ({ state, canAudit, onAudit }) => (
  <Card title="Sites" hint={`Audit costs ${AUDIT_ATTENTION} attention`}>
    <ul className="space-y-2">
      {state.sites.map((site) => {
        const audited =
          site.lastAuditedDay !== null &&
          state.day - site.lastAuditedDay <= AUDIT_WINDOW_DAYS;
        return (
          <li
            key={site.id}
            className="min-w-0 border border-zinc-800/80 bg-[#0d0e11] p-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-zinc-100">
                {site.name}{" "}
                <span className="font-normal text-zinc-400">
                  {site.enrolled} enrolled
                </span>
              </span>
              <button
                type="button"
                onClick={() => onAudit(site.id)}
                disabled={!canAudit}
                aria-label={`Audit ${site.name}`}
                className="min-h-[36px] border border-zinc-700 px-2 font-mono text-[11px] text-zinc-200 hover:border-amber-500 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Audit
              </button>
            </div>
            {audited ? (
              <dl className="mt-1.5 grid grid-cols-2 gap-x-3 font-mono text-[11px] text-zinc-300">
                <dt>Open queries</dt>
                <dd className="tabular-nums">{site.openQueries}</dd>
                <dt>Deviations</dt>
                <dd className="tabular-nums">{site.deviations}</dd>
                <dt>Unsigned source</dt>
                <dd className="tabular-nums">{site.unsignedSource}</dd>
                <dt>Eligibility concerns</dt>
                <dd className="tabular-nums">{site.eligibilityConcerns}</dd>
                <dt>Training</dt>
                <dd>{site.trainingCurrent ? "Current" : "Behind"}</dd>
                <dt>Coordinator</dt>
                <dd className="break-words">
                  {COORDINATOR_LABELS[site.coordinator]}
                </dd>
              </dl>
            ) : (
              <p className="mt-1 font-mono text-[11px] text-zinc-400">
                Reports look fine. Audit to see the real numbers.
              </p>
            )}
          </li>
        );
      })}
    </ul>
  </Card>
);
