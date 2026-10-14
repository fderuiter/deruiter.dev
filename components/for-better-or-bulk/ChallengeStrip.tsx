"use client";

/**
 * The time challenge strip (#2056): par and the personal best, on the setup
 * screen and under the receipt. It is a game record about play speed, set
 * apart from the receipt, and never a grade on the wedding (ADR 0060).
 */

import React from "react";
import {
  clockLabel,
  minutesUnderPar,
  type BestTimeRecord,
} from "@/lib/for-better-or-bulk";

/** What a finished day adds to the strip on the receipt. */
interface TimeChallengeRun {
  /** Level time everything was set, or null when something was open at 4:00. */
  readonly finishedAt: number | null;
  /** The comparison with the stored best, or null when this day could not set one. */
  readonly record: BestTimeRecord | null;
}

export interface TimeChallenge {
  /** Par in level seconds, or null when this plan and day have no par. */
  readonly par: number | null;
  /** The stored best in level seconds, or null when there is none yet. */
  readonly best: number | null;
  /** The level length the times belong to. */
  readonly duration: number;
  /** Why this plan's days do not set a best, such as the helper being on. */
  readonly noBestReason?: string | null;
  /** Present on the receipt only. */
  readonly run?: TimeChallengeRun;
}

function minutes(count: number): string {
  return `${count} ${count === 1 ? "minute" : "minutes"}`;
}

/** "21 minutes under par", "on par" or "4 minutes over par". */
function versusPar(time: number, par: number, duration: number): string {
  const under = minutesUnderPar(time, par, duration);
  if (under === 0) return "on par";
  return under > 0
    ? `${minutes(under)} under par`
    : `${minutes(-under)} over par`;
}

/** The line about this day's time, for the receipt. */
function runLine(
  run: TimeChallengeRun,
  par: number | null,
  duration: number
): string {
  if (run.finishedAt === null) {
    return "Something was still open at 4:00, so this day has no time.";
  }
  const at = clockLabel(run.finishedAt, duration);
  return par === null
    ? `Everything set at ${at}.`
    : `Everything set at ${at}, ${versusPar(run.finishedAt, par, duration)}.`;
}

/** The line about the best time. */
function bestLine(
  best: number | null,
  duration: number,
  record: BestTimeRecord | null
): string {
  if (record?.isNew) {
    if (record.previous === null) {
      return "New best: the first finish on this plan and clock.";
    }
    const gained = minutesUnderPar(record.time, record.previous, duration);
    const previous = clockLabel(record.previous, duration);
    return gained > 0
      ? `New best, ${minutes(gained)} sooner than ${previous}.`
      : `New best, a few seconds sooner than ${previous}.`;
  }
  return best === null
    ? "No best time yet. Set everything before 4:00 to record one."
    : `Your best: ${clockLabel(best, duration)}.`;
}

export function ChallengeStrip({
  par,
  best,
  duration,
  noBestReason,
  run,
}: TimeChallenge) {
  const record = run?.record ?? null;
  const shownBest = record ? record.best : best;
  return (
    <section
      className="min-w-0 rounded border border-dashed border-[var(--fbb-rule)] p-3 font-mono text-xs tabular-nums text-[var(--fbb-text)]"
      aria-labelledby="fbb-time-challenge"
      data-testid="fbb-time-challenge"
    >
      <h3
        id="fbb-time-challenge"
        className="break-words font-bold uppercase tracking-wide"
      >
        Time challenge. Play speed, not a grade on the wedding.
      </h3>
      <ul className="mt-2 flex min-w-0 flex-col gap-1">
        <li className="break-words" data-testid="fbb-par">
          {par === null
            ? "No par for this plan. Par is set for the standard day with the starting plan: FAQ and admin page, full roses, enough food, lanterns."
            : `Par: everything set by ${clockLabel(par, duration)}.`}
        </li>
        {run ? (
          <li className="break-words" data-testid="fbb-run-time">
            {runLine(run, par, duration)}
          </li>
        ) : null}
        <li
          className={`break-words ${record?.isNew ? "font-bold text-[var(--fbb-ok)]" : ""}`}
          data-testid="fbb-best-time"
        >
          {bestLine(shownBest, duration, record)}
        </li>
        {noBestReason ? (
          <li
            className="break-words text-[var(--fbb-dim)]"
            data-testid="fbb-no-best"
          >
            {noBestReason}
          </li>
        ) : null}
      </ul>
    </section>
  );
}
