"use client";

/**
 * The text from Fred's brothers. The clock stops until he answers, and the
 * answer changes the level: staying keeps him on the lawn, a break needs a
 * promise about what he comes back for, and leaving is leaving.
 */

import React, { useRef, useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  BREAK_SECONDS,
  COMMITMENT_CATEGORIES,
  LEAVE_SECONDS,
  clockLabel,
  heldLabel,
  onLevelClock,
  type Commitment,
  type GameState,
  type PresenceDecision,
} from "@/lib/for-better-or-bulk";

const COMMITMENT_LABELS: Readonly<Record<Commitment, string>> = {
  chairs: "The chairs",
  lanterns: "The lanterns",
  buffet: "The buffet",
  flowers: "The flowers",
};

interface BrothersDialogProps {
  state: GameState;
  onDecide: (decision: PresenceDecision) => void;
}

/** What Abbi is doing with her hands, read from the level as it stands. */
function abbiLine(state: GameState): string {
  const held = state.players.abbi.holding;
  return held
    ? `Abbi is carrying ${heldLabel(held)} and looking at him.`
    : "Abbi has her hands free and is looking at him.";
}

/** Fred's mood, read from the level as it stands. */
function fredLine(state: GameState): string {
  return state.players.fred.calm
    ? "Fred has calmed down."
    : "Fred is still at the setup.";
}

/** Promises worth making: ones whose work is actually in this plan. */
function availableCommitments(state: GameState): Commitment[] {
  return (Object.keys(COMMITMENT_CATEGORIES) as Commitment[]).filter(
    (commitment) =>
      state.targets.some(
        (t) =>
          COMMITMENT_CATEGORIES[commitment].includes(t.category) &&
          t.status !== "unplanned"
      )
  );
}

export function BrothersDialog({ state, onDecide }: BrothersDialogProps) {
  const stayRef = useRef<HTMLButtonElement>(null);
  const [promising, setPromising] = useState(false);
  const dialogRef = useFocusTrap<HTMLDivElement>(true, {
    initialFocusRef: stayRef,
  });
  const commitments = availableCommitments(state);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(13,14,17,0.72)] p-3">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fbb-brothers-title"
        aria-describedby="fbb-brothers-body"
        data-testid="fbb-brothers"
        className="w-full max-w-md rounded border border-[var(--fbb-control)] bg-[var(--fbb-panel)] p-4 font-mono text-[var(--fbb-text)] shadow-2xl"
      >
        <h2 id="fbb-brothers-title" className="text-base font-extrabold">
          Text from Fred&apos;s brothers
        </h2>
        <p
          id="fbb-brothers-body"
          className="mt-2 text-xs text-[var(--fbb-dim)]"
        >
          &quot;Breakfast? You look like you need to get out of there for a
          bit.&quot; {fredLine(state)} {abbiLine(state)}
        </p>
        {!promising ? (
          <div className="mt-4 flex flex-col gap-2">
            <button
              ref={stayRef}
              type="button"
              onClick={() => onDecide({ choice: "stay", commitment: null })}
              className="min-h-11 rounded border border-[var(--fbb-accent)] px-3 text-left text-xs font-bold active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)]"
            >
              Stay and help. (He will keep double-checking his shoes.)
            </button>
            <button
              type="button"
              disabled={commitments.length === 0}
              onClick={() => setPromising(true)}
              className="min-h-11 rounded border border-[var(--fbb-control)] px-3 text-left text-xs font-bold active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)] disabled:opacity-40"
            >
              Take a short break and promise to come back for something.
            </button>
            <button
              type="button"
              onClick={() => onDecide({ choice: "leave", commitment: null })}
              className="min-h-11 rounded border border-[var(--fbb-control)] px-3 text-left text-xs font-bold active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)]"
            >
              Go with them. (Back around{" "}
              {clockLabel(
                state.time + onLevelClock(LEAVE_SECONDS, state.duration),
                state.duration
              )}
              . Abbi works alone until Fred is back. The website is up.)
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-xs">
              Back around{" "}
              {clockLabel(
                state.time + onLevelClock(BREAK_SECONDS, state.duration),
                state.duration
              )}
              , calmer. What does Fred promise to come back for?
            </p>
            {commitments.map((commitment) => (
              <button
                key={commitment}
                type="button"
                onClick={() => onDecide({ choice: "break", commitment })}
                className="min-h-11 rounded border border-[var(--fbb-control)] px-3 text-left text-xs font-bold active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)]"
              >
                {COMMITMENT_LABELS[commitment]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPromising(false)}
              className="min-h-11 rounded px-3 text-left text-xs text-[var(--fbb-dim)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)]"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
