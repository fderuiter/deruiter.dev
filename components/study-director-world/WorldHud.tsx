"use client";

import React from "react";
import type { HudReadout } from "@/lib/study-director-world";
import { clamp } from "@/lib/game-utils";
import { PHASE_LABEL, dayPhase, meterTone } from "./hud-model";

const money = (dollars: number) =>
  `$${Math.round(dollars / 1000).toLocaleString("en-US")}k`;

const Cell: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="min-w-0 px-3 py-2">
    <dt className="text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase">
      {label}
    </dt>
    <dd className="mt-0.5 min-w-0 text-sm font-bold break-words text-[var(--sd-text)] tabular-nums">
      {children}
    </dd>
  </div>
);

const Bar: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const v = clamp(Math.round(value), 0, 100);
  const level = meterTone(v);
  const tone =
    level === "low"
      ? "bg-[var(--sd-red)]"
      : level === "mid"
        ? "bg-[var(--sd-amber)]"
        : "bg-[var(--sd-emerald)]";
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className={level === "low" ? "text-[var(--sd-red)]" : undefined}>
        {v}
      </span>
      <span
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        className="h-1.5 w-full max-w-20 min-w-8 bg-zinc-800"
      >
        <span className={`block h-full ${tone}`} style={{ width: `${v}%` }} />
      </span>
      {level === "low" ? (
        <span className="text-[10px] font-semibold text-[var(--sd-red)] uppercase">
          Low
        </span>
      ) : null}
    </span>
  );
};

/**
 * The world's HUD: day and weekday, clock, the player's energy and focus,
 * and the three things the world shows directly. There are no Integrity,
 * Compliance or Team meters: the player infers those from the office.
 */
export const WorldHud: React.FC<{
  hud: HudReadout;
  /** Minutes after midnight, for the part of the day. */
  minute: number;
  /** What to do next, shown under the readings. */
  goal?: string | null;
}> = ({ hud, minute, goal }) => {
  const over = hud.budget.spent > hud.budget.total;
  const phase = dayPhase(minute);
  return (
    <div className="border border-[var(--sd-hairline)] bg-[var(--sd-surface)]">
      <dl
        data-testid="world-hud"
        className="grid grid-cols-3 divide-[var(--sd-hairline)] lg:grid-cols-7 lg:divide-x"
      >
        <Cell label="Day">
          {hud.day} · {hud.weekday}
        </Cell>
        <Cell label="Clock">
          <span data-testid="world-clock">{hud.clock}</span>
          <span
            data-testid="world-phase"
            className="ml-2 text-[10px] font-semibold tracking-[0.1em] text-[var(--sd-muted)] uppercase"
          >
            {PHASE_LABEL[phase]}
          </span>
        </Cell>
        <Cell label="Energy">
          <Bar label="Energy" value={hud.energy} />
        </Cell>
        <Cell label="Focus">
          <Bar label="Focus" value={hud.focus} />
        </Cell>
        <Cell label="Budget">
          <span className={over ? "text-[var(--sd-red)]" : undefined}>
            {money(hud.budget.spent)} / {money(hud.budget.total)}
          </span>
        </Cell>
        <Cell label="Timeline">
          Day {hud.timeline.day} / {hud.timeline.total}
          {hud.timeline.slipDays > 0 ? (
            <span className="ml-1 text-xs text-[var(--sd-amber)]">
              +{hud.timeline.slipDays}
            </span>
          ) : null}
        </Cell>
        <Cell label="Enrollment">
          {hud.enrollment.enrolled} / {hud.enrollment.target}
        </Cell>
      </dl>
      {goal ? (
        <p
          data-testid="world-goal"
          className="border-t border-[var(--sd-hairline)] px-3 py-2 text-xs text-zinc-200"
        >
          <span className="font-bold text-[var(--sd-amber)]">Today: </span>
          {goal}
        </p>
      ) : null}
    </div>
  );
};
