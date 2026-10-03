"use client";

import React from "react";
import {
  SITE_CHECKS,
  SITE_CLOSES,
  checkBlocker,
  coordinatorProfile,
  formatClock,
  siteRefusalText,
  type SiteVisitReport,
  type WorldState,
} from "@/lib/study-director-world";

const TONE_TEXT = {
  good: "text-[var(--sd-emerald)]",
  bad: "text-[var(--sd-red)]",
  neutral: "text-zinc-200",
} as const;

const LABEL =
  "text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase";

/**
 * The visit in progress: who the coordinator seems to be, what the player
 * has learned about them, which checks are left and what they cost, and
 * everything seen so far. Checks are done at their stations on the map.
 */
export const SiteVisitPanel: React.FC<{ world: WorldState }> = ({ world }) => {
  const visit = world.visit;
  if (!visit) return null;
  const profile = coordinatorProfile(world, visit.siteId);
  const site = world.study.sites.find((s) => s.id === visit.siteId);
  return (
    <section
      aria-labelledby="sd-site-visit"
      data-testid="site-visit"
      className="min-w-0 border border-[var(--sd-hairline)] bg-[var(--sd-surface)] p-3"
    >
      <h3 id="sd-site-visit" className="text-sm font-bold break-words">
        {site?.name ?? visit.siteId} visit {visit.number}
      </h3>
      <p className="mt-1 text-[11px] text-[var(--sd-muted)]">
        Signed in at {formatClock(visit.arrivedAt)}. The site closes at{" "}
        {formatClock(SITE_CLOSES)}.
      </p>

      {profile ? (
        <div className="mt-3">
          <h4 className={LABEL}>Coordinator</h4>
          <p className="mt-1 text-xs font-semibold break-words text-zinc-100">
            {profile.name}
          </p>
          <ul className="mt-1 space-y-1 text-[11px] text-zinc-300">
            {profile.visible.map((t) => (
              <li key={t.id} className="break-words">
                <span className="font-semibold text-zinc-100">{t.label}.</span>{" "}
                {t.detail}
              </li>
            ))}
            {profile.learned.map((t) => (
              <li key={t.id} className="break-words">
                <span className="font-semibold text-[var(--sd-amber)]">
                  Learned: {t.label}.
                </span>{" "}
                {t.detail}
              </li>
            ))}
          </ul>
          {profile.unknown > 0 ? (
            <p className="mt-1 text-[11px] text-[var(--sd-muted)]">
              {profile.unknown === 1
                ? "There is one thing about them you have not worked out."
                : `There are ${profile.unknown} things about them you have not worked out.`}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3">
        <h4 className={LABEL}>Checks</h4>
        <ul className="mt-1 space-y-1 text-[11px]">
          {Object.values(SITE_CHECKS).map((c) => {
            const done = visit.checks.includes(c.id);
            const blocker = done ? null : checkBlocker(world, c.id);
            return (
              <li
                key={c.id}
                className="flex min-w-0 flex-wrap justify-between gap-x-2"
              >
                <span
                  className={`min-w-0 break-words ${done ? "text-[var(--sd-muted)] line-through" : "text-zinc-200"}`}
                >
                  {c.label}
                  {done ? <span className="sr-only"> (done)</span> : null}
                </span>
                <span className="text-[var(--sd-muted)] tabular-nums">
                  {done
                    ? "done"
                    : blocker
                      ? blocker === "too-unfocused"
                        ? "no focus left"
                        : blocker === "pi-unavailable"
                          ? "PI gone"
                          : blocker === "site-closed"
                            ? "no time"
                            : siteRefusalText(blocker)
                      : `${c.cost.minutes} min, focus ${c.cost.focus}`}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {visit.observations.length > 0 ? (
        <div className="mt-3">
          <h4 className={LABEL}>What you have seen</h4>
          <ul className="mt-1 space-y-1 text-[11px]">
            {visit.observations.map((o) => (
              <li key={o.check} className={`break-words ${TONE_TEXT[o.tone]}`}>
                {o.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
};

/**
 * The write-up of a finished visit: the findings the audit resolved, which
 * ones the dashboard had been hiding, what was left unchecked and what the
 * player learned about the coordinator.
 */
export const SiteVisitReportPanel: React.FC<{
  report: SiteVisitReport;
  onClose: () => void;
}> = ({ report, onClose }) => (
  <section
    aria-labelledby="sd-site-report"
    data-testid="site-report"
    className="min-w-0 border border-[var(--sd-hairline-strong)] p-3"
  >
    <h3 id="sd-site-report" className="text-sm font-bold break-words">
      {report.siteName} visit write-up, day {report.day}
    </h3>
    <p className="mt-1 text-xs break-words text-zinc-200">{report.verdict}</p>
    {report.findings.length > 0 ? (
      <ul className="mt-2 space-y-1 text-[11px]">
        {report.findings.map((f) => (
          <li
            key={f.field}
            className={`break-words ${f.hidden ? TONE_TEXT.bad : "text-zinc-300"}`}
          >
            {f.hidden ? (
              <span className="font-semibold">Hidden by the dashboard: </span>
            ) : null}
            {f.text}
          </li>
        ))}
      </ul>
    ) : null}
    {report.learned.length > 0 ? (
      <ul className="mt-2 space-y-1 text-[11px] text-zinc-300">
        {report.learned.map((t) => (
          <li key={t.id} className="break-words">
            <span className="font-semibold text-[var(--sd-amber)]">
              Learned: {t.label}.
            </span>{" "}
            {t.detail}
          </li>
        ))}
      </ul>
    ) : null}
    {report.audited && report.unchecked.length > 0 ? (
      <p className="mt-2 text-[11px] break-words text-[var(--sd-muted)]">
        Not checked: {report.unchecked.join(", ").toLowerCase()}.
      </p>
    ) : null}
    <button
      type="button"
      onClick={onClose}
      className="mt-3 min-h-[36px] border border-zinc-700 px-3 text-xs text-zinc-300 hover:border-[var(--sd-amber)]"
    >
      File the write-up
    </button>
  </section>
);
