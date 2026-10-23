"use client";

import React, { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  IconCalendarEvent,
  IconFlame,
  IconPlayerPlay,
} from "@tabler/icons-react";
import {
  ARCADE_DAILY_GAMES,
  arcadeDailyBest,
  arcadeDailyDate,
  arcadeDailyHref,
  arcadeDailyStreak,
} from "@/lib/arcade/daily";
import { arcadeDailySlice, useProgress } from "@/lib/arcade";

// Same query as DesktopOnlyGate (PHONE_QUERY, ADR 0061): phones only.
const SHOW_ON_TOUCH_COMPACT_INLINE =
  "hidden [@media(pointer:coarse)_and_((max-width:743px)_or_(max-height:500px))]:inline-block";

// The date only changes at midnight UTC; a minute's resolution is plenty.
function subscribeClock(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
}
const readToday = () => arcadeDailyDate(Date.now());
const noDate = () => null;

function days(n: number): string {
  return `${n} day${n === 1 ? "" : "s"}`;
}

/**
 * The hub's Arcade Daily panel (#2113): today's seeded run in every game
 * that takes a seed, each game's best daily result today, and the streak of
 * days with a daily played. The date is read in the browser only, so the
 * server never renders a date that could disagree at midnight UTC.
 */
export function ArcadeDailyPanel() {
  const today = useSyncExternalStore(subscribeClock, readToday, noDate);
  // The arcade.daily slice, kept in step across tabs (#2548).
  const progress = useProgress(arcadeDailySlice);
  const streak = today ? arcadeDailyStreak(progress, today) : null;

  return (
    <section
      aria-labelledby="arcade-daily-heading"
      data-testid="arcade-daily-panel"
      className="mb-12 border border-zinc-800 bg-[#13151a] p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2
            id="arcade-daily-heading"
            className="flex items-center gap-2 font-mono text-xl font-bold tracking-[-0.035em] text-zinc-100"
          >
            <IconCalendarEvent
              className="h-5 w-5 text-amber-400"
              aria-hidden="true"
            />
            Arcade Daily
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-300">
            One seed a day for every game that takes one. Everyone gets the same
            run, and a new one starts at midnight UTC.
            {today ? (
              <>
                {" "}
                Today is{" "}
                <span className="font-mono tabular-nums text-zinc-100">
                  {today}
                </span>
                .
              </>
            ) : null}
          </p>
        </div>
        {streak ? (
          <p
            data-testid="arcade-daily-streak"
            className="flex items-center gap-2 border border-zinc-800 bg-[#0d0e11] px-3 py-2 font-mono text-xs text-zinc-300"
          >
            <IconFlame className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <span>
              Streak{" "}
              <strong className="tabular-nums text-amber-300">
                {days(streak.current)}
              </strong>
              <span className="text-zinc-400"> · </span>
              Longest{" "}
              <strong className="tabular-nums text-zinc-100">
                {days(streak.longest)}
              </strong>
            </span>
          </p>
        ) : null}
      </div>

      {today ? (
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ARCADE_DAILY_GAMES.map((game) => {
            const best = arcadeDailyBest(progress, game.id, today);
            return (
              <li
                key={game.id}
                data-testid={`arcade-daily-${game.id}`}
                className="flex min-w-0 flex-col justify-between gap-3 border border-zinc-800 bg-[#0d0e11] p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-mono text-sm font-bold break-words text-zinc-100">
                      {game.title}
                    </h3>
                    {game.desktopOnly ? (
                      <span
                        className={`${SHOW_ON_TOUCH_COMPACT_INLINE} border border-zinc-700 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-zinc-300 uppercase`}
                      >
                        Desktop only
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-mono text-xs text-zinc-300">
                    {best ? (
                      <>
                        Today&apos;s best:{" "}
                        <span className="tabular-nums text-emerald-400">
                          {best.label ??
                            `${best.score.toLocaleString("en-US")} ${game.scoreLabel}`}
                        </span>
                      </>
                    ) : (
                      "Not played today"
                    )}
                  </p>
                </div>
                <Link
                  href={arcadeDailyHref(game.id, today)}
                  aria-label={`Play daily: today's ${game.title}`}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 self-start border border-amber-500/60 px-4 font-mono text-xs font-bold text-amber-300 uppercase transition-colors hover:bg-amber-500/10 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none active:scale-[0.98]"
                >
                  <IconPlayerPlay className="h-3.5 w-3.5" aria-hidden="true" />
                  Play daily
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-5 font-mono text-xs text-zinc-400">
          Loading today&apos;s seeds…
        </p>
      )}
    </section>
  );
}
