"use client";

import React from "react";
import type { Feedback } from "./feedback-model";

const TONE: Record<Feedback["tone"], string> = {
  good: "border-[var(--sd-emerald)]/60 text-emerald-300",
  bad: "border-[var(--sd-red)]/60 text-[var(--sd-red)]",
  neutral: "border-[var(--sd-hairline-strong)] text-zinc-200",
};

const MARK: Record<Feedback["kind"], string> = {
  meter: "",
  heart: "♥ ",
  stamp: "",
};

/**
 * Small, brief feedback over the stage: meters moving, a heart gained, a task
 * stamped done. It is decoration only (`aria-hidden`): the live regions
 * already say what mattered. Nothing loops; each toast appears once and the
 * parent removes it after a few seconds.
 */
export const FeedbackToasts: React.FC<{
  items: readonly Feedback[];
}> = ({ items }) =>
  items.length === 0 ? null : (
    <ul
      aria-hidden="true"
      data-testid="world-feedback"
      className="pointer-events-none absolute right-2 bottom-2 z-10 flex max-w-[60%] min-w-0 flex-col items-end gap-1"
    >
      {items.map((f) => (
        <li
          key={f.id}
          data-kind={f.kind}
          className={`sd-enter max-w-full min-w-0 border bg-[var(--sd-surface)] px-2 py-1 text-[11px] break-words ${TONE[f.tone]} ${
            f.kind === "stamp" ? "font-bold tracking-wide uppercase" : ""
          }`}
        >
          {MARK[f.kind]}
          {f.text}
        </li>
      ))}
    </ul>
  );
