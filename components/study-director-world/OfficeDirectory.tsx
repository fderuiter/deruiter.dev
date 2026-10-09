"use client";

import React, { useId, useState } from "react";
import type { DirectoryEntry } from "@/lib/study-director-world";

const GROUPS: Array<{ kind: DirectoryEntry["target"]["kind"]; title: string }> =
  [
    { kind: "station", title: "Stations" },
    { kind: "person", title: "People" },
    { kind: "room", title: "Rooms" },
  ];

/** The clock cost of a walk, in words: shown before the player commits. */
function walkCostText(minutes: number): string {
  if (minutes < 1) return "under a minute";
  const whole = Math.round(minutes);
  return `about ${whole} ${whole === 1 ? "minute" : "minutes"}`;
}

/**
 * The office directory: every station, person and room as an ordinary
 * button. Choosing one walks the player there, so the floor can be played
 * from the keyboard or a screen reader without steering. It starts
 * collapsed so the stage has the room: walking is the main way to move.
 */
export const OfficeDirectory: React.FC<{
  /** Heading and landmark name; site maps pass "Site directory". */
  title?: string;
  entries: DirectoryEntry[];
  walkingTo: string | null;
  disabled: boolean;
  onWalk: (entry: DirectoryEntry) => void;
  /** Clock minutes the walk to an entry would take, or null when it cannot be reached. */
  minutesTo?: (entry: DirectoryEntry) => number | null;
}> = ({
  title = "Office directory",
  entries,
  walkingTo,
  disabled,
  onWalk,
  minutesTo,
}) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <nav
      aria-label={title}
      className="min-w-0 border border-[var(--sd-hairline)] bg-[var(--sd-surface)] p-3"
    >
      <h3 className="text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-12 w-full min-w-0 items-center justify-between gap-2 text-left uppercase hover:text-[var(--sd-amber)] focus-visible:text-[var(--sd-amber)]"
        >
          <span className="min-w-0 break-words">{title}</span>
          <span aria-hidden="true">{open ? "Hide" : "Show"}</span>
        </button>
      </h3>
      {open ? (
        <div id={panelId}>
          <p className="mt-1 text-[11px] text-[var(--sd-muted)]">
            Choose a place to walk there. Walking costs clock time: four tiles a
            minute.
          </p>
          <div className="mt-3 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)]">
            {GROUPS.map((group) => {
              const items = entries.filter((e) => e.target.kind === group.kind);
              if (items.length === 0) return null;
              return (
                <section key={group.kind} className="min-w-0">
                  <h4 className="text-[11px] font-semibold text-[var(--sd-text)]">
                    {group.title}
                  </h4>
                  <ul
                    className={`mt-1 grid gap-1 ${group.kind === "room" ? "grid-cols-2" : ""}`}
                  >
                    {items.map((entry) => {
                      const minutes = minutesTo?.(entry) ?? null;
                      const costId = `${panelId}-cost-${entry.id}`;
                      return (
                        <li key={entry.id} className="min-w-0">
                          <button
                            type="button"
                            disabled={disabled}
                            aria-label={`Walk to ${entry.label}, ${entry.detail}`}
                            aria-describedby={
                              minutes === null ? undefined : costId
                            }
                            aria-pressed={walkingTo === entry.id}
                            onClick={() => onWalk(entry)}
                            className="flex min-h-12 w-full min-w-0 flex-col items-start justify-center gap-0.5 border border-[var(--sd-hairline)] px-2 py-1 text-left text-xs text-zinc-200 hover:border-[var(--sd-amber)] focus-visible:border-[var(--sd-amber)] active:scale-[0.98] disabled:opacity-50 aria-pressed:border-[var(--sd-amber)]"
                          >
                            <span className="max-w-full min-w-0 break-words">
                              {entry.label}
                            </span>
                            {entry.target.kind === "room" ? null : (
                              <span className="max-w-full min-w-0 text-[10px] break-words text-[var(--sd-muted)]">
                                {entry.detail}
                              </span>
                            )}
                            {minutes === null ? null : (
                              <span
                                id={costId}
                                data-testid="walk-cost"
                                className="text-[10px] text-[var(--sd-steel)] tabular-nums"
                              >
                                {walkCostText(minutes)}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}
    </nav>
  );
};
