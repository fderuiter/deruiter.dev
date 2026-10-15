"use client";

import React from "react";
import {
  BADGES,
  BADGE_IDS,
  HISTORY_MODE_NAMES,
  HISTORY_SIZE,
  dayLabel,
  daysBetween,
  runResult,
  type BadgeId,
  type BadgeSave,
} from "@/lib/garmin-badges";
import { localDay } from "@/lib/garmin-race";

interface BadgeCasePanelProps {
  /** The badges and history, or null before they have been read from storage. */
  save: BadgeSave | null;
  /** Badges the last run earned, marked as new. */
  fresh: readonly BadgeId[];
}

/**
 * The badge case and the run history in the companion panel (#2021): every
 * badge with how it is earned and the day it was, and the last runs with
 * their mode, result, distance, Training Effect and Kudos.
 */
export function BadgeCasePanel({ save, fresh }: BadgeCasePanelProps) {
  // A streak still counts while its last day is today or yesterday.
  const streakGap =
    save?.streak.lastDay != null
      ? daysBetween(save.streak.lastDay, localDay(new Date()))
      : null;
  const streak =
    save && streakGap !== null && streakGap >= 0 && streakGap <= 1
      ? save.streak.days
      : 0;
  const earnedCount = save
    ? BADGE_IDS.filter((id) => save.badges[id]).length
    : 0;
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-400">
        Badges and run history
      </legend>
      <p
        id="garmin-badge-case-count"
        className="mb-1.5 text-[10px] tabular-nums text-zinc-400"
      >
        Badge case: {earnedCount} of {BADGE_IDS.length} earned
        {streak > 1 ? ` · Streak: ${streak} days` : ""}
      </p>
      <ul
        aria-label="Badge case"
        aria-describedby="garmin-badge-case-count"
        className="grid gap-1"
      >
        {BADGE_IDS.map((id) => {
          const day = save?.badges[id];
          const isNew = fresh.includes(id);
          return (
            <li
              key={id}
              className={`min-w-0 rounded-md border px-2 py-1 ${
                day
                  ? "border-emerald-500/40 bg-emerald-500/[0.08]"
                  : "border-white/[0.06] bg-[#0d0e11]"
              }`}
            >
              <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-[10px]">
                <span
                  className={`min-w-0 break-words font-bold ${day ? "text-emerald-100" : "text-zinc-300"}`}
                >
                  {BADGES[id].name}
                </span>
                <span className="text-zinc-400">
                  {day ? `Earned ${dayLabel(day)}` : "Not yet earned"}
                </span>
                {isNew && (
                  <span className="rounded-sm border border-amber-500/40 px-1 text-[9px] uppercase text-amber-300">
                    New
                  </span>
                )}
              </p>
              <p className="min-w-0 break-words text-[10px] text-zinc-400">
                {BADGES[id].rule}
              </p>
            </li>
          );
        })}
      </ul>
      <details className="mt-2 min-w-0">
        <summary className="min-h-[32px] cursor-pointer py-1.5 text-[10px] text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
          Run history ({save?.runs.length ?? 0} of the last {HISTORY_SIZE})
        </summary>
        {save && save.runs.length > 0 ? (
          <ol aria-label="Run history, newest first" className="grid gap-1">
            {save.runs.map((run, i) => (
              <li
                key={`${run.day}-${i}`}
                className="min-w-0 rounded-md border border-white/[0.06] bg-[#0d0e11] px-2 py-1 text-[10px] tabular-nums"
              >
                <p className="flex min-w-0 flex-wrap justify-between gap-x-2">
                  <span className="text-zinc-300">
                    {dayLabel(run.day)} · {HISTORY_MODE_NAMES[run.mode]}
                  </span>
                  <span
                    className={
                      run.finished ? "text-emerald-300" : "text-rose-300"
                    }
                  >
                    {runResult(run)}
                  </span>
                </p>
                <p className="text-zinc-400">
                  {(run.meters / 1000).toFixed(2)} km · Training Effect{" "}
                  {run.te === null ? "none" : run.te.toFixed(1)} · {run.kudos}{" "}
                  Kudos
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[10px] text-zinc-400">
            No runs yet. Every run you finish or DNF is kept here.
          </p>
        )}
      </details>
    </fieldset>
  );
}
