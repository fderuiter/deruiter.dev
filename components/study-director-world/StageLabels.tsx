"use client";

import React from "react";
import type { View } from "./camera";
import type { InteractionPrompt, Nameplate, WorldTask } from "./stage-model";

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

/** Where a tile's top centre falls on the canvas, or null when it is off screen. */
function anchor(view: View, tile: { x: number; y: number }) {
  const cx = tile.x + 0.5 - view.x;
  const cy = tile.y - view.y;
  if (cx < 0 || cx > view.w || cy < -0.01 || cy > view.h) return null;
  return { left: pct(cx / view.w), top: pct(cy / view.h) };
}

/**
 * Names and the "Press E" prompt, drawn as DOM over the canvas so the type
 * stays sharp at any zoom. They are for sighted players: the canvas already
 * carries a text description of what is in front of you.
 */
export const StageLabels: React.FC<{
  view: View;
  plates: readonly Nameplate[];
  prompt: InteractionPrompt | null;
}> = ({ view, plates, prompt }) => (
  <div
    aria-hidden="true"
    data-testid="world-labels"
    className="pointer-events-none absolute inset-0 overflow-hidden font-mono"
  >
    {plates.map((n) => {
      // The prompt takes the place of the name of whatever it is about.
      if (prompt && prompt.x === n.x && prompt.y === n.y) return null;
      const at = anchor(view, n);
      if (!at) return null;
      return (
        <span
          key={n.id}
          data-testid="world-nameplate"
          style={{ left: at.left, top: at.top }}
          className={`absolute -translate-x-1/2 -translate-y-full border px-1 py-px text-[10px] leading-tight font-semibold whitespace-nowrap ${
            n.kind === "person"
              ? "border-[var(--sd-hairline-strong)] bg-[var(--sd-bg)]/90 text-zinc-100"
              : "border-[var(--sd-hairline)] bg-[var(--sd-bg)]/90 text-[var(--sd-steel)]"
          }`}
        >
          {n.label}
        </span>
      );
    })}
    {prompt
      ? (() => {
          const at = anchor(view, prompt);
          if (!at) return null;
          return (
            <span
              data-testid="world-prompt"
              style={{ left: at.left, top: at.top }}
              className="absolute z-10 flex max-w-[16rem] -translate-x-1/2 -translate-y-full flex-col gap-0.5 border border-[var(--sd-amber)] bg-[var(--sd-bg)] px-1.5 py-1 text-[11px] leading-tight text-zinc-100"
            >
              <span className="flex items-center gap-1.5 font-bold whitespace-nowrap">
                <span className="grid size-4 place-items-center border border-[var(--sd-amber)] text-[10px] text-[var(--sd-amber)]">
                  E
                </span>
                {prompt.text.replace(/^Press E to /, "")}
              </span>
              {prompt.detail ? (
                <span className="hidden text-[10px] font-normal text-[var(--sd-muted)] @min-[40rem]:block">
                  {prompt.detail}
                </span>
              ) : null}
            </span>
          );
        })()
      : null}
  </div>
);

/** Today's open items, most urgent first. */
export const TasksPanel: React.FC<{
  tasks: readonly WorldTask[];
  /** The promise made this morning, if one was. */
  priority?: string | null;
}> = ({ tasks, priority }) => (
  <section
    aria-labelledby="sd-world-tasks"
    data-testid="world-tasks"
    className="border border-[var(--sd-hairline)] bg-[var(--sd-surface)] p-3"
  >
    <h3
      id="sd-world-tasks"
      className="text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase"
    >
      Today
    </h3>
    {priority ? (
      <p
        data-testid="world-priority-line"
        className="mt-1 text-xs text-zinc-300"
      >
        <span className="text-[var(--sd-muted)]">Priority:</span> {priority}
      </p>
    ) : null}
    {tasks.length === 0 ? (
      <p className="mt-1 text-xs text-zinc-300">
        Nothing is waiting on you. Walk the floor.
      </p>
    ) : (
      <ul className="mt-1 space-y-1.5 text-xs">
        {tasks.map((t) => (
          <li key={t.id} className="min-w-0">
            <p
              className={`break-words ${t.urgent ? "font-bold text-amber-300" : "text-zinc-200"}`}
            >
              {t.urgent ? (
                <span className="mr-1 border border-current px-1 text-[9px] font-semibold tracking-wide uppercase">
                  Now
                </span>
              ) : null}
              {t.text}
            </p>
            <p className="text-[11px] break-words text-[var(--sd-muted)]">
              {t.where}
            </p>
          </li>
        ))}
      </ul>
    )}
  </section>
);
