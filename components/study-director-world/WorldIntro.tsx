"use client";

import React, { useRef } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { DIFFICULTIES, type Difficulty } from "@/lib/study-director";
import { DIFFICULTY_TEXT } from "@/components/study-director/DifficultyPicker";

const CONTROLS: Array<{ keys: string; action: string }> = [
  { keys: "W A S D or arrow keys", action: "Walk around the floor" },
  { keys: "E", action: "Use what you face, or talk to whoever is there" },
  { keys: "F", action: "Ask yourself how it is going" },
  { keys: "Office directory", action: "Walk to a place without steering" },
];

/**
 * What each difficulty changes in an office run, in plain terms. These are
 * the domain's own numbers (`applyDifficulty`, `WILDCARDS_PER_RUN`): the
 * office's clock, energy and focus are the same on every difficulty.
 */
const WHAT_CHANGES: Record<Difficulty, string> = {
  calm: "15% more budget, a warmer sponsor, a less loaded team and two surprise events.",
  standard:
    "The study as written: the planned budget and timeline, and three surprise events.",
  rescue:
    "Six days behind, 8% of the budget already spent, more paperwork owed, a cooler sponsor, a busier team and sites, and four surprise events.",
};

/**
 * Chooses how hard a new office run starts, one honest line per option. It
 * shows only while the run is untouched, since a difficulty is set before
 * the study begins.
 */
export const ConditionsPicker: React.FC<{
  value: Difficulty;
  onChange: (value: Difficulty) => void;
  /** Radio group name, unique on the page. */
  name: string;
}> = ({ value, onChange, name }) => (
  <fieldset className="min-w-0" data-testid={`${name}-picker`}>
    <legend className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase">
      Study conditions
    </legend>
    <div className="grid gap-1.5">
      {DIFFICULTIES.map((id) => {
        const checked = id === value;
        return (
          <label
            key={id}
            className={`flex min-w-0 cursor-pointer gap-2 border p-2 text-xs transition-colors active:scale-[0.98] ${checked ? "border-[var(--sd-amber)] bg-[var(--sd-amber)]/10" : "border-zinc-700 hover:border-zinc-500"}`}
          >
            <input
              type="radio"
              name={name}
              value={id}
              checked={checked}
              onChange={() => onChange(id)}
              className="mt-0.5 accent-amber-500"
            />
            <span className="min-w-0">
              <span className="block font-bold text-[var(--sd-text)]">
                {DIFFICULTY_TEXT[id].label}
              </span>
              <span className="block break-words text-[var(--sd-muted)]">
                {WHAT_CHANGES[id]}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  </fieldset>
);

/**
 * First-run help for the walkable office: how to move, how to act, and
 * what a day is. It is a dialog, so focus stays inside it and Escape or
 * the button closes it; the Controls button on the stage opens it again.
 */
export const WorldIntro: React.FC<{
  onClose: () => void;
  /** A new, untouched run offers its difficulty here (#2058). */
  difficulty?: Difficulty;
  onDifficultyChange?: (value: Difficulty) => void;
}> = ({ onClose, difficulty, onDifficultyChange }) => {
  const startRef = useRef<HTMLButtonElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(true, {
    initialFocusRef: startRef,
    onEscape: onClose,
  });
  return (
    <div
      key="world-intro"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sd-world-intro-title"
        data-testid="world-intro"
        className="max-h-full w-full max-w-lg overflow-y-auto border border-[var(--sd-hairline-strong)] bg-[var(--sd-surface)] p-5 font-mono text-[var(--sd-text)]"
      >
        <h2 id="sd-world-intro-title" className="text-base font-bold">
          Welcome to the CRO floor
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-300">
          You run one clinical study. Each day starts at 8:00 and every action
          costs minutes and energy. Walk the floor, talk to your team, answer
          the phone, and go home when you run out of day. Everything is fine.
        </p>
        <dl className="mt-4 space-y-2 text-xs">
          {CONTROLS.map((row) => (
            <div
              key={row.keys}
              className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3"
            >
              <dt className="font-bold break-words text-[var(--sd-amber)]">
                {row.keys}
              </dt>
              <dd className="break-words text-zinc-200">{row.action}</dd>
            </div>
          ))}
        </dl>
        {difficulty && onDifficultyChange ? (
          <div className="mt-4">
            <ConditionsPicker
              name="sd-intro-difficulty"
              value={difficulty}
              onChange={onDifficultyChange}
            />
          </div>
        ) : null}
        <button
          ref={startRef}
          type="button"
          onClick={onClose}
          className="mt-5 min-h-12 w-full border border-[var(--sd-amber)] bg-[var(--sd-amber)]/10 px-4 text-sm font-bold text-amber-300 hover:bg-[var(--sd-amber)]/20 active:scale-[0.98]"
        >
          Start the day
        </button>
      </div>
    </div>
  );
};
