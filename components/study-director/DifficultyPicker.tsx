"use client";

import React from "react";
import { DIFFICULTIES, type Difficulty } from "@/lib/study-director";

export const DIFFICULTY_TEXT: Record<
  Difficulty,
  { label: string; blurb: string }
> = {
  calm: {
    label: "Calm protocol",
    blurb: "More budget, a warm sponsor and a rested team.",
  },
  standard: {
    label: "Standard",
    blurb: "The study as written. Which is to say, optimistic.",
  },
  rescue: {
    label: "Rescue study",
    blurb: "You inherit it six days late, over-spent and under-documented.",
  },
};

/** Chooses how hard the study starts, on the briefing's cover sheet. */
export const DifficultyPicker: React.FC<{
  value: Difficulty;
  onChange: (value: Difficulty) => void;
}> = ({ value, onChange }) => (
  <fieldset className="min-w-0 basis-full">
    <legend className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase">
      Study conditions
    </legend>
    <div className="grid gap-1.5">
      {DIFFICULTIES.map((id) => {
        const checked = id === value;
        return (
          <label
            key={id}
            className={`flex min-w-0 cursor-pointer gap-2 border p-2 text-xs transition-colors ${checked ? "border-[var(--sd-amber)] bg-[var(--sd-amber)]/10" : "border-zinc-700 hover:border-zinc-500"}`}
          >
            <input
              type="radio"
              name="study-difficulty"
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
                {DIFFICULTY_TEXT[id].blurb}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  </fieldset>
);
