"use client";

import React, { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  challengeOrigin,
  dailySeed,
  normalizeSeed,
  type Challenge,
  type RunOrigin,
} from "@/lib/trial-and-error";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  freshSeed,
  useUtcToday,
} from "@/components/trial-and-error/useChallenge";

type Choice = "RANDOM" | "SEEDED" | "DAILY";

const BUTTON =
  "min-h-[48px] border px-4 py-3 text-xs font-bold uppercase tracking-wider touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]";

interface NewRunProps {
  /** A challenge link's seed, which pre-fills the dialog. */
  challenge: Challenge | null;
  /** The current run has moves that starting over would discard. */
  discards: boolean;
  onStart: (seed: string, origin: RunOrigin) => void;
  onClose: () => void;
}

/**
 * New Run (#1528): start the campaign on a random seed, a seed typed in or
 * opened from a challenge link, or today's Daily Protocol. A focus-trapped
 * dialog; Escape or Cancel closes it and nothing changes.
 */
export function NewRun({ challenge, discards, onStart, onClose }: NewRunProps) {
  const today = useUtcToday();
  const [choice, setChoice] = useState<Choice>(challenge ? "SEEDED" : "RANDOM");
  const [typed, setTyped] = useState(challenge?.seed ?? "");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const ref = useFocusTrap<HTMLDivElement>(true, {
    onEscape: onClose,
    initialFocusRef: challenge ? inputRef : firstRef,
  });
  const id = useId();
  const errorId = `${id}-error`;

  const start = () => {
    if (choice === "RANDOM") {
      onStart(freshSeed(), { kind: "RANDOM" });
      return;
    }
    if (choice === "DAILY") {
      if (today) onStart(dailySeed(today), { kind: "DAILY", date: today });
      return;
    }
    // A typed seed must be a codec seed, so a typo is caught rather than
    // played as a named seed; a challenge link's own seed always starts.
    const seed =
      challenge && typed.trim() === challenge.seed
        ? challenge.seed
        : normalizeSeed(typed);
    if (!seed) {
      setError(
        "Enter 8 letters or digits, like 7K3M-Q9PX. Hyphens and case don't matter."
      );
      inputRef.current?.focus();
      return;
    }
    // A challenge link's Daily Protocol keeps its date as long as the seed
    // was not changed.
    onStart(
      seed,
      challenge && challenge.seed === seed
        ? challengeOrigin(challenge)
        : { kind: "SEEDED" }
    );
  };

  const option = (value: Choice) => ({
    type: "radio" as const,
    name: `${id}-choice`,
    value,
    checked: choice === value,
    onChange: () => {
      setChoice(value);
      setError(null);
    },
    className: "mt-0.5 h-5 w-5 shrink-0 accent-amber-400",
  });

  return createPortal(
    <div
      data-te-cabinet=""
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-heading`}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto border border-zinc-700 bg-[color:var(--te-surface-0)] p-4 font-mono text-[color:var(--te-text)]"
        data-testid="new-run"
      >
        <h2
          id={`${id}-heading`}
          className="text-sm font-bold uppercase tracking-wider text-zinc-100"
        >
          New run
        </h2>
        {challenge && (
          <p className="mt-2 text-xs text-amber-300 break-words">
            {challenge.daily
              ? `Challenge link: the Daily Protocol for ${challenge.daily} (UTC).`
              : "Challenge link: the same seed and the same moves play the same run."}
          </p>
        )}
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault();
            start();
          }}
        >
          <fieldset className="grid gap-2 text-xs">
            <legend className="sr-only">Seed</legend>
            <label className="flex min-h-[48px] cursor-pointer items-start gap-3 border border-zinc-800 p-3 hover:bg-zinc-900">
              <input ref={firstRef} {...option("RANDOM")} />
              <span className="min-w-0 break-words">
                <span className="font-bold uppercase tracking-wider">
                  Random seed
                </span>
                <span className="block text-zinc-400">A fresh study.</span>
              </span>
            </label>
            <div className="border border-zinc-800 p-3">
              <label className="flex min-h-[24px] cursor-pointer items-start gap-3">
                <input {...option("SEEDED")} />
                <span className="font-bold uppercase tracking-wider">
                  Enter a seed
                </span>
              </label>
              <label
                className="mt-2 block text-zinc-400"
                htmlFor={`${id}-seed`}
              >
                Seed, from a friend or a past run
              </label>
              <input
                ref={inputRef}
                id={`${id}-seed`}
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={40}
                value={typed}
                placeholder="7K3M-Q9PX"
                onFocus={() => setChoice("SEEDED")}
                onChange={(event) => {
                  setTyped(event.target.value);
                  setChoice("SEEDED");
                  setError(null);
                }}
                aria-invalid={error !== null}
                aria-describedby={error ? errorId : undefined}
                className="mt-1 min-h-[44px] w-full min-w-0 border border-zinc-600 bg-[color:var(--te-surface-1)] px-3 font-mono text-sm uppercase tracking-widest text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                data-testid="new-run-seed"
              />
              {error && (
                <p
                  id={errorId}
                  role="alert"
                  className="mt-1 text-rose-300 break-words"
                >
                  {error}
                </p>
              )}
            </div>
            <label
              className={`flex min-h-[48px] items-start gap-3 border border-zinc-800 p-3 ${today ? "cursor-pointer hover:bg-zinc-900" : "opacity-60"}`}
            >
              <input {...option("DAILY")} disabled={!today} />
              <span className="min-w-0 break-words">
                <span className="font-bold uppercase tracking-wider">
                  Daily Protocol
                </span>
                <span className="block text-zinc-400" data-testid="daily-date">
                  {today
                    ? `${today} (UTC): everyone plays the same run today.`
                    : "Checking today's date…"}
                </span>
              </span>
            </label>
          </fieldset>
          {discards && (
            <p className="mt-3 text-xs text-amber-300 break-words">
              Starting a new run ends the current one.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              className={`${BUTTON} border-amber-500 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20`}
            >
              Start run
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`${BUTTON} border-zinc-600 text-zinc-300 hover:bg-zinc-800`}
            >
              Cancel [Esc]
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.fullscreenElement ?? document.body
  );
}
