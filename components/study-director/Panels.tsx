"use client";

import React from "react";
import {
  AUDIT_ATTENTION,
  AUDIT_WINDOW_DAYS,
  computeMeters,
  dashboard,
  type Health,
  type MeterId,
  type Meters,
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
import { HealthRadar } from "./HealthRadar";
import { Portrait, strain } from "./Portrait";

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
    className={`min-w-0 border border-[var(--sd-hairline)] bg-[var(--sd-surface)] p-3 ${className}`}
  >
    <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 border-b border-[var(--sd-hairline)] pb-2">
      <h2 className="font-mono text-[11px] font-bold tracking-[0.14em] whitespace-nowrap text-zinc-200 uppercase">
        {title}
      </h2>
      {hint ? (
        <span className="min-w-0 font-mono text-[10px] text-[var(--sd-muted)]">
          {hint}
        </span>
      ) : null}
    </div>
    {children}
  </section>
);

export const DashboardPanel: React.FC<{ state: StudyState }> = ({ state }) => {
  const board = dashboard(state);
  return (
    <Card title="Dashboard" hint="What everyone reports">
      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
        {AREA_IDS.map((id) => {
          const area = board[id];
          return (
            <li
              key={id}
              className="flex min-w-0 items-start gap-2 border border-zinc-800/80 bg-[var(--sd-bg)] px-2 py-1.5"
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

export const MetersPanel: React.FC<{
  state: StudyState;
  /** Meters at the start of today, drawn as a dashed outline. */
  baseline?: Meters | null;
}> = ({ state, baseline }) => {
  const meters = computeMeters(state);
  return (
    <div data-sd-coach="meters">
      <Card title="Study health" hint="You cannot max all six">
        <HealthRadar meters={meters} baseline={baseline} />
        {baseline ? (
          <p className="mt-1 flex items-center justify-center gap-3 text-[10px] text-[var(--sd-muted)]">
            <span className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-3 border border-[var(--sd-amber)] bg-[var(--sd-amber)]/20"
              />
              Now
            </span>
            <span className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-3 border border-dashed border-[var(--sd-steel)]"
              />
              Start of today
            </span>
          </p>
        ) : null}
        <ul className="mt-2 space-y-1.5">
          {METER_IDS.map((id: MeterId) => {
            const delta = baseline ? meters[id] - baseline[id] : 0;
            return (
              <li key={id} className="min-w-0">
                <div className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
                  <span className="min-w-0 truncate text-zinc-200">
                    {METER_LABELS[id]}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
                    {delta !== 0 ? (
                      <span
                        className={`text-[10px] font-bold ${delta > 0 ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {delta > 0 ? "+" : "\u2212"}
                        {Math.abs(delta)}
                      </span>
                    ) : null}
                    <span className="text-zinc-300">{meters[id]}</span>
                  </span>
                </div>
                <div
                  role="meter"
                  aria-label={METER_LABELS[id]}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={meters[id]}
                  className="relative mt-0.5 h-1 w-full bg-zinc-800"
                >
                  <div
                    className={`h-full ${meterTone(meters[id])}`}
                    style={{ width: `${meters[id]}%` }}
                  />
                  {baseline && delta !== 0 ? (
                    <div
                      aria-hidden="true"
                      className="absolute -top-0.5 h-2 w-px bg-[var(--sd-steel)]"
                      style={{ left: `${baseline[id]}%` }}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
};

const STRAIN_TEXT = {
  ok: "text-zinc-300",
  stretched: "text-amber-400",
  overloaded: "text-red-400",
} as const;

const STRAIN_LABEL = {
  ok: "",
  stretched: "Stretched",
  overloaded: "Overloaded",
} as const;

export const TeamPanel: React.FC<{ state: StudyState }> = ({ state }) => (
  <Card title="Study team" hint="Workload">
    <ul className="space-y-2">
      {state.team.map((member) => {
        const level = strain(member.workload);
        return (
          <li
            key={member.id}
            className="flex min-w-0 items-center gap-2.5"
            data-strain={level}
          >
            <Portrait
              name={member.name}
              role={member.role}
              workload={member.workload}
            />
            <div className="min-w-0 flex-1 font-mono text-[11px]">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate font-semibold text-zinc-100">
                  {member.name}
                </span>
                <span
                  role="meter"
                  aria-label={`${member.name} workload`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={member.workload}
                  className={`shrink-0 tabular-nums ${STRAIN_TEXT[level]}`}
                >
                  {member.workload}%
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[var(--sd-muted)]">
                  {ROLE_LABELS[member.role]}
                </span>
                {level !== "ok" ? (
                  <span
                    className={`shrink-0 text-[10px] font-bold uppercase ${STRAIN_TEXT[level]}`}
                  >
                    {STRAIN_LABEL[level]}
                  </span>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  </Card>
);

const Tally: React.FC<{
  label: string;
  value: number | string;
  bad: boolean;
}> = ({ label, value, bad }) => (
  <div className="min-w-0 border border-[var(--sd-hairline)] bg-[var(--sd-surface)] px-2 py-1">
    <dt className="truncate text-[10px] text-[var(--sd-muted)]">{label}</dt>
    <dd
      className={`text-sm font-bold tabular-nums ${bad ? "text-red-400" : "text-emerald-400"}`}
    >
      {value}
    </dd>
  </div>
);

export const SitesPanel: React.FC<{
  state: StudyState;
  canAudit: boolean;
  onAudit: (siteId: string) => void;
}> = ({ state, canAudit, onAudit }) => {
  const target = Math.round(state.setup.subjects / state.sites.length);
  return (
    <div data-sd-coach="sites">
      <Card title="Sites" hint={`Audit costs ${AUDIT_ATTENTION} attention`}>
        <ul className="grid gap-2 lg:grid-cols-3">
          {state.sites.map((site) => {
            const audited =
              site.lastAuditedDay !== null &&
              state.day - site.lastAuditedDay <= AUDIT_WINDOW_DAYS;
            const fresh =
              site.lastAuditedDay === null
                ? 0
                : AUDIT_WINDOW_DAYS - (state.day - site.lastAuditedDay);
            const enrolled = Math.min(site.enrolled, target);
            return (
              <li
                key={site.id}
                data-audited={audited}
                className="relative min-w-0 overflow-hidden border border-[var(--sd-hairline)] bg-[var(--sd-bg)] p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-zinc-100">
                      {site.name}
                    </p>
                    <p className="font-mono text-[10px] text-[var(--sd-muted)]">
                      {COORDINATOR_LABELS[site.coordinator]}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAudit(site.id)}
                    disabled={!canAudit}
                    aria-label={`Audit ${site.name}`}
                    className="min-h-[36px] shrink-0 border border-zinc-700 px-2 font-mono text-[11px] text-zinc-200 hover:border-amber-500 hover:text-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {audited ? "Re-audit" : "Audit"}
                  </button>
                </div>
                <div className="mt-2 font-mono text-[11px]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-zinc-300">Enrolled</span>
                    <span className="text-zinc-100 tabular-nums">
                      {site.enrolled} / {target}
                    </span>
                  </div>
                  <div
                    role="meter"
                    aria-label={`${site.name} enrollment`}
                    aria-valuemin={0}
                    aria-valuemax={target}
                    aria-valuenow={enrolled}
                    className="mt-0.5 h-1.5 w-full bg-zinc-800"
                  >
                    <div
                      className="h-full bg-[var(--sd-steel)]"
                      style={{
                        width: `${(enrolled / Math.max(1, target)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                {audited ? (
                  <>
                    <p className="mt-2 font-mono text-[10px] font-bold tracking-wide text-emerald-400 uppercase">
                      Audited day {site.lastAuditedDay}
                      <span className="font-normal text-[var(--sd-muted)] normal-case">
                        {" "}
                        · fresh {fresh} more day{fresh === 1 ? "" : "s"}
                      </span>
                    </p>
                    <dl className="mt-1.5 grid grid-cols-2 gap-1 font-mono">
                      <Tally
                        label="Open queries"
                        value={site.openQueries}
                        bad={site.openQueries > 0}
                      />
                      <Tally
                        label="Deviations"
                        value={site.deviations}
                        bad={site.deviations > 0}
                      />
                      <Tally
                        label="Unsigned source"
                        value={site.unsignedSource}
                        bad={site.unsignedSource > 0}
                      />
                      <Tally
                        label="Eligibility concerns"
                        value={site.eligibilityConcerns}
                        bad={site.eligibilityConcerns > 0}
                      />
                      <Tally
                        label="Training"
                        value={site.trainingCurrent ? "Current" : "Behind"}
                        bad={!site.trainingCurrent}
                      />
                    </dl>
                  </>
                ) : (
                  <div className="mt-2 border border-dashed border-zinc-700 bg-[repeating-linear-gradient(135deg,rgba(148,163,184,0.06)_0_6px,transparent_6px_12px)] px-2 py-2">
                    <p className="font-mono text-[10px] font-bold tracking-wide text-[var(--sd-steel)] uppercase">
                      Unverified
                    </p>
                    <p className="font-mono text-[11px] text-[var(--sd-muted)]">
                      Reports look fine. Audit to see the real numbers.
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
};
