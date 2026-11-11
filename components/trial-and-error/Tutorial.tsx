"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CardTable } from "@/components/trial-and-error/CardTable";
import { useCabinetTutorial } from "@/components/arcade/tutorial";
import {
  GUIDED_BLIND_SCENARIO,
  TRIAL_AND_ERROR_TUTORIAL,
  TUTORIAL_RESULT_SIGNAL,
  TUTORIAL_STEPS,
  tutorialStepDone,
  type TableState,
  type TutorialTarget,
} from "@/lib/trial-and-error";

/** The CSS selector for a step's target, outlined while the step shows. */
function targetSelector(target: TutorialTarget): string | null {
  switch (target.kind) {
    case "NONE":
      return null;
    case "CARD":
      return `[data-card-id="${target.cardId}"]`;
    case "CARDS":
      return target.cardIds.map((id) => `[data-card-id="${id}"]`).join(", ");
    case "CELL":
      return `[data-coach="cell-${target.row}-${target.col}"]`;
    case "CORRECT":
      return `[data-coach="correct"]`;
    case "CLOSE_INSPECT":
      return `[data-coach="close-inspect"]`;
    case "PLAY":
      return `[data-coach="play"]`;
  }
}

/**
 * Moves focus to what a step points at, so its key works at once: the card
 * to inspect or the button to press (#2155).
 */
function focusTarget(selector: string | null) {
  if (!selector) return;
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(selector)?.focus();
  });
}

/**
 * The step inside the Inspect view, which covers the cabinet and so the
 * tutorial's own card. It reads the shared script, so the wording is the
 * same in both places, and is read out politely as it changes.
 */
function InspectCoach({ stepId }: { stepId: string }) {
  const steps = TRIAL_AND_ERROR_TUTORIAL.steps;
  const index = steps.findIndex((step) => step.id === stepId);
  const step = steps[index];
  if (!step) return null;
  return (
    <section
      aria-labelledby="coach-title"
      className="min-w-0 border border-amber-400/60 bg-[color:var(--te-surface-1)] p-3 font-mono text-xs"
      data-testid="coach"
    >
      <p className="text-[10px] uppercase tracking-wider text-zinc-400 tabular-nums">
        Tutorial · step {index + 1} of {steps.length}
      </p>
      <div aria-live="polite">
        <h3
          id="coach-title"
          className="mt-1 font-bold uppercase tracking-wider text-amber-300 break-words"
        >
          {step.title}
        </h3>
        <p className="mt-1 text-zinc-200 break-words" data-testid="coach-text">
          {step.body}
        </p>
      </div>
    </section>
  );
}

/**
 * The Trial & Error table. While the cabinet's tutorial runs (#2972) it
 * deals the guided Blind (#1089) and tells the tutorial when the table shows
 * a step done; otherwise it is the campaign.
 */
export function TrialAndErrorTable() {
  const { active, stepId, signal } = useCabinetTutorial();
  // Restarting the guided Blind remounts its table with a fresh state.
  const [attempt, setAttempt] = useState(0);
  const tableRef = useRef<TableState | null>(null);
  const stepIdRef = useRef(stepId);

  // A table step is done once the table shows its outcome: when the table
  // moves, and when the step starts, since a player may do a step early.
  const signalIfDone = useCallback(
    (table: TableState | null, id: string | null) => {
      const step = TUTORIAL_STEPS.find((candidate) => candidate.id === id);
      if (table && step && tutorialStepDone(step, table.lastEvent, table)) {
        signal(step.id);
      }
    },
    [signal]
  );

  const onTableChange = useCallback(
    (next: TableState) => {
      tableRef.current = next;
      signalIfDone(next, stepIdRef.current);
    },
    [signalIfDone]
  );

  useEffect(() => {
    const previous = TUTORIAL_STEPS.find(
      (candidate) => candidate.id === stepIdRef.current
    );
    stepIdRef.current = stepId;
    signalIfDone(tableRef.current, stepId);
    // After Next, focus what the new step points at. A step the table moved
    // on to leaves focus where the player is already working.
    const step = TUTORIAL_STEPS.find((candidate) => candidate.id === stepId);
    if (previous?.waitsFor === null && step && step.waitsFor !== null) {
      focusTarget(targetSelector(step.target));
    }
  }, [stepId, signalIfDone]);

  useEffect(() => {
    if (!active) tableRef.current = null;
  }, [active]);

  // The result hands over to the tutorial's close, or deals the Blind again.
  const guidedEnd = useCallback(
    (won: boolean) =>
      won
        ? {
            label: "Finish the tutorial",
            onSelect: () => signal(TUTORIAL_RESULT_SIGNAL),
          }
        : {
            label: "Restart guided Blind",
            onSelect: () => setAttempt((n) => n + 1),
          },
    [signal]
  );

  if (!active) return <CardTable key="campaign" persist />;

  const step = TUTORIAL_STEPS.find((candidate) => candidate.id === stepId);
  const selector = step ? targetSelector(step.target) : null;
  return (
    <>
      {selector && (
        <style>{`${selector} { outline: 2px solid #f59e0b; outline-offset: 3px; }`}</style>
      )}
      <CardTable
        key={`guided-${attempt}`}
        scenario={GUIDED_BLIND_SCENARIO}
        seed="guided"
        onTableChange={onTableChange}
        endAction={guidedEnd}
        coach={stepId ? <InspectCoach stepId={stepId} /> : undefined}
      />
    </>
  );
}
