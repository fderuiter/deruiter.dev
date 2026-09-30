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

interface ArcadeHudGauge {
  /** Short caption shown before the bar, e.g. "Work". */
  label: string;
  /** Accessible name of the progressbar, when it differs from the caption. */
  ariaLabel?: string;
  value: number;
  /** Defaults to 0. */
  min?: number;
  /** Defaults to 100. */
  max?: number;
  /** Readout after the bar, e.g. "42%". */
  display: ReactNode;
  /** Colour of the fill and readout. Defaults to the game's accent. */
  tone?: "accent" | "warn" | "danger" | "good";
  /** Draw a mark at the middle of the bar, for scales that run negative. */
  centerTick?: boolean;
}

interface ArcadeHudProps {
  stats?: ArcadeHudStat[];
  /** Labelled bars such as a pet's needs, shown after the stats. */
  gauges?: ArcadeHudGauge[];
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
const GAUGE_FILL: Record<NonNullable<ArcadeHudGauge["tone"]>, string> = {
  accent: "bg-[var(--game-accent,#f59e0b)]",
  warn: "bg-amber-400",
  danger: "bg-rose-400",
  good: "bg-emerald-400",
};

const GAUGE_TEXT: Record<NonNullable<ArcadeHudGauge["tone"]>, string> = {
  accent: "arcade-accent-text",
  warn: "text-amber-300",
  danger: "text-rose-300",
  good: "text-emerald-300",
};

export function ArcadeHud({
  stats = [],
  gauges = [],
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
          <span className="uppercase tracking-wider text-zinc-400">
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

      {gauges.map((gauge) => {
        const min = gauge.min ?? 0;
        const max = gauge.max ?? 100;
        const value = clamp(Math.round(gauge.value), min, max);
        const fraction = max > min ? (value - min) / (max - min) : 0;
        const tone = gauge.tone ?? "accent";
        return (
          <span
            key={gauge.label}
            className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap"
          >
            <span className="uppercase tracking-wider text-zinc-400">
              {gauge.label}
            </span>
            <span
              role="progressbar"
              aria-label={gauge.ariaLabel ?? gauge.label}
              aria-valuenow={value}
              aria-valuemin={min}
              aria-valuemax={max}
              className="relative block h-1.5 w-12 overflow-hidden rounded-full bg-zinc-800"
            >
              <span
                className={`block h-full w-full origin-left transition-transform duration-200 ${GAUGE_FILL[tone]}`}
                style={{ transform: `scaleX(${fraction})` }}
              />
              {gauge.centerTick && (
                <span className="absolute inset-y-0 left-1/2 w-px bg-zinc-300/70" />
              )}
            </span>
            <span className={`font-bold ${GAUGE_TEXT[tone]}`}>
              {gauge.display}
            </span>
          </span>
        );
      })}

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
