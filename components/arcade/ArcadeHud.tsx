"use client";

import React, { type ReactNode } from "react";
import { clamp } from "@/lib/game-utils";

interface ArcadeHudStat {
  /** Short caption shown before the value, e.g. "Score". */
  label: string;
  value: ReactNode;
  /** Colour the value with the game's accent instead of plain text. */
  accent?: boolean;
}

interface ArcadeHudMeter {
  label: string;
  /** 0 to 100. */
  percent: number;
  /** True when the meter can be spent. */
  ready: boolean;
  onActivate: () => void;
  /** Key that also spends it, shown when ready. */
  hotkey?: string;
}

interface ArcadeHudProps {
  stats: ArcadeHudStat[];
  /** Transient callouts such as a combo or an active power-up. */
  callouts?: ReactNode;
  meter?: ArcadeHudMeter;
  /** Controls at the right end, such as Pause in fullscreen. */
  trailing?: ReactNode;
}

/**
 * One slim status bar above a game's stage, so the play area stays clear.
 *
 * It reads the cabinet's `--game-accent` token, uses tabular figures so
 * numbers don't jitter, and never animates in a loop.
 */
export function ArcadeHud({
  stats,
  callouts,
  meter,
  trailing,
}: ArcadeHudProps) {
  const percent = meter ? clamp(Math.round(meter.percent), 0, 100) : 0;
  return (
    <div
      role="group"
      aria-label="Game status"
      className="arcade-hud relative z-20 flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-white/[0.08] bg-[#0d0e11] px-3 font-mono text-[11px] tabular-nums text-zinc-300"
    >
      {stats.map((stat) => (
        <span
          key={stat.label}
          className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap"
        >
          <span className="uppercase tracking-wider text-zinc-500">
            {stat.label}
          </span>
          <span
            className={`font-bold ${
              stat.accent ? "arcade-accent-text" : "text-zinc-100"
            }`}
          >
            {stat.value}
          </span>
        </span>
      ))}

      {callouts && (
        <span className="inline-flex min-w-0 items-center gap-2">
          {callouts}
        </span>
      )}

      <span className="ml-auto inline-flex items-center gap-2">
        {meter && (
          <button
            type="button"
            onClick={meter.onActivate}
            disabled={!meter.ready}
            aria-label={`${meter.label}: ${percent}%${
              meter.ready && meter.hotkey
                ? `, ready, press ${meter.hotkey}`
                : ""
            }`}
            className={`inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-md px-2 font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-accent)] ${
              meter.ready
                ? "cursor-pointer text-zinc-100 hover:bg-white/[0.06]"
                : "cursor-not-allowed text-zinc-500"
            }`}
          >
            <span>{meter.label}</span>
            <span
              role="progressbar"
              aria-label={`${meter.label} Meter`}
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="block h-1.5 w-20 overflow-hidden rounded-full bg-zinc-800"
            >
              <span
                className="block h-full w-full origin-left bg-[var(--game-accent,#f59e0b)] transition-transform duration-200"
                style={{ transform: `scaleX(${percent / 100})` }}
              />
            </span>
            <span className={meter.ready ? "arcade-accent-text" : undefined}>
              {meter.ready && meter.hotkey
                ? `Ready [${meter.hotkey}]`
                : `${percent}%`}
            </span>
          </button>
        )}
        {trailing}
      </span>
    </div>
  );
}
