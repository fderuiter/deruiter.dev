"use client";

import React, { useRef } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  DIFFICULTIES,
  RESCUE_SLIP_DAYS,
  STUDY_LENGTHS,
  scaleDays,
  studyPreset,
  type Difficulty,
  type StudyLength,
} from "@/lib/study-director";
import { DIFFICULTY_TEXT } from "@/components/study-director/DifficultyPicker";

const TOUCH_CONTROLS: Array<{ keys: string; action: string }> = [
  { keys: "Tap the floor", action: "Walk to a person, a station or a spot" },
  {
    keys: "Arrow buttons",
    action: "Walk one tile at a time; hold to keep going",
  },
  {
    keys: "E button",
    action: "Use what you face, or talk to whoever is there",
  },
  { keys: "F button", action: "Ask yourself how it is going" },
  { keys: "Office directory", action: "Walk to a place without steering" },
];

const CONTROLS: Array<{ keys: string; action: string }> = [
  { keys: "W A S D or arrow keys", action: "Walk around the floor" },
  { keys: "E", action: "Use what you face, or talk to whoever is there" },
  { keys: "F", action: "Ask yourself how it is going" },
  { keys: "Office directory", action: "Walk to a place without steering" },
];

/**
 * What each difficulty changes in an office run, in plain terms. These are
 * the domain's own numbers (`applyDifficulty`, `WILDCARDS_PER_RUN`): the
 * office's clock, energy and focus are the same on every difficulty. A
 * rescue starts proportionally fewer days behind on the short study.
 */
function whatChanges(id: Difficulty, length: StudyLength): string {
  if (id === "calm")
    return "15% more budget, a warmer sponsor, a less loaded team and two surprise events.";
  if (id === "standard")
    return "The study as written: the planned budget and timeline, and three surprise events.";
  const behind = scaleDays(RESCUE_SLIP_DAYS, studyPreset(length).setup);
  const days = behind === 6 ? "Six" : behind === 3 ? "Three" : `${behind}`;
  return `${days} days behind, 8% of the budget already spent, more paperwork owed, a cooler sponsor, a busier team and sites, and four surprise events.`;
}

const LENGTH_TEXT: Record<StudyLength, { label: string; detail: string }> = {
  short: {
    label: "Short study",
    detail: `${studyPreset("short").setup.durationDays} days, ${studyPreset("short").setup.subjects} subjects at ${studyPreset("short").sites.length} sites. Fits in one sitting, sooner if you delegate some days.`,
  },
  full: {
    label: "Full study",
    detail: `${studyPreset("full").setup.durationDays} days, ${studyPreset("full").setup.subjects} subjects at ${studyPreset("full").sites.length} sites. The whole story, over several sessions.`,
  },
};

/** One radio card: a label and a line on what it means, 44px or taller. */
function Choice({
  name,
  value,
  checked,
  label,
  detail,
  onChange,
}: {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  detail: string;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex min-h-11 min-w-0 cursor-pointer gap-2 border p-2 text-xs transition-colors active:scale-[0.98] ${checked ? "border-[var(--sd-amber)] bg-[var(--sd-amber)]/10" : "border-zinc-700 hover:border-zinc-500"}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 accent-amber-500"
      />
      <span className="min-w-0">
        <span className="block font-bold text-[var(--sd-text)]">{label}</span>
        <span className="block break-words text-[var(--sd-muted)]">
          {detail}
        </span>
      </span>
    </label>
  );
}

/**
 * Chooses how long a new office run is (#2092), short or full, beside the
 * difficulty. Like the difficulty it is set before the study begins.
 */
export const LengthPicker: React.FC<{
  value: StudyLength;
  onChange: (value: StudyLength) => void;
  /** Radio group name, unique on the page. */
  name: string;
}> = ({ value, onChange, name }) => (
  <fieldset className="min-w-0" data-testid={`${name}-picker`}>
    <legend className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase">
      Study length
    </legend>
    <div className="grid gap-1.5">
      {STUDY_LENGTHS.map((id) => (
        <Choice
          key={id}
          name={name}
          value={id}
          checked={id === value}
          label={LENGTH_TEXT[id].label}
          detail={LENGTH_TEXT[id].detail}
          onChange={() => onChange(id)}
        />
      ))}
    </div>
  </fieldset>
);

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
  /** The study length the run will have, which sets a rescue's head start. */
  length?: StudyLength;
}> = ({ value, onChange, name, length = "full" }) => (
  <fieldset className="min-w-0" data-testid={`${name}-picker`}>
    <legend className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase">
      Study conditions
    </legend>
    <div className="grid gap-1.5">
      {DIFFICULTIES.map((id) => (
        <Choice
          key={id}
          name={name}
          value={id}
          checked={id === value}
          label={DIFFICULTY_TEXT[id].label}
          detail={whatChanges(id, length)}
          onChange={() => onChange(id)}
        />
      ))}
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
  /** True on the touch cabinet, which lists the on-screen controls. */
  touch?: boolean;
  /** A new, untouched run offers its difficulty here (#2058). */
  difficulty?: Difficulty;
  onDifficultyChange?: (value: Difficulty) => void;
  /** And its length (#2092). */
  length?: StudyLength;
  onLengthChange?: (value: StudyLength) => void;
}> = ({
  onClose,
  touch = false,
  difficulty,
  onDifficultyChange,
  length,
  onLengthChange,
}) => {
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
        // A tap on its text focuses the box, so Escape stays with it (#2076).
        tabIndex={-1}
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
          {(touch ? TOUCH_CONTROLS : CONTROLS).map((row) => (
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
        {length && onLengthChange ? (
          <div className="mt-4">
            <LengthPicker
              name="sd-intro-length"
              value={length}
              onChange={onLengthChange}
            />
          </div>
        ) : null}
        {difficulty && onDifficultyChange ? (
          <div className="mt-4">
            <ConditionsPicker
              name="sd-intro-difficulty"
              value={difficulty}
              onChange={onDifficultyChange}
              length={length}
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
