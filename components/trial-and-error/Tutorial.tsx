"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { CardTable } from "@/components/trial-and-error/CardTable";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import {
  GUIDED_BLIND_SCENARIO,
  TUTORIAL_STEPS,
  nextTutorialStep,
  tutorialStepAfter,
  type TableState,
  type TutorialTarget,
} from "@/lib/trial-and-error";

/** Set once the guided Blind is finished or skipped (#1089). */
export const TUTORIAL_SEEN_KEY = "te:tutorial-seen";
const SEEN_EVENT = "te:tutorial-seen-change";

const BUTTON =
  "min-h-[44px] border px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider touch-manipulation active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400";
const PRIMARY = `${BUTTON} border-amber-500 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20`;
const QUIET = `${BUTTON} border-zinc-600 text-zinc-200 hover:bg-zinc-800`;

function readSeen(): boolean {
  try {
    if (typeof window.localStorage?.getItem !== "function") return false;
    return window.localStorage.getItem(TUTORIAL_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSeen() {
  try {
    if (typeof window.localStorage?.setItem === "function") {
      window.localStorage.setItem(TUTORIAL_SEEN_KEY, "1");
    }
  } catch {
    // Storage is unavailable: the offer simply returns next visit.
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

function subscribeSeen(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SEEN_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SEEN_EVENT, onChange);
  };
}

/**
 * Whether this browser has finished or skipped the guided Blind. Without
 * storage it reads as unseen, so the offer returns and can still be skipped.
 */
function useTutorialSeen(): boolean {
  return useSyncExternalStore(subscribeSeen, readSeen, () => true);
}

/** The CSS selector for a step's target, marked while the step shows. */
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

interface CoachProps {
  step: number;
  table: TableState | null;
  onNext: () => void;
  onSkip: () => void;
  onRestart: () => void;
}

/**
 * The coach mark: the step's text beside the table, with the step's target
 * outlined in amber. It never takes focus from the target, so the player
 * acts on the real control; Skip is always there.
 */
function Coach({ step, table, onNext, onSkip, onRestart }: CoachProps) {
  const current = TUTORIAL_STEPS[step];
  const done = step >= TUTORIAL_STEPS.length;
  const selector = current ? targetSelector(current.target) : null;
  const status = table?.status;
  const quota = GUIDED_BLIND_SCENARIO.blind.quota;

  let title: string;
  let text: string;
  if (!done) {
    title = current.title;
    text = current.text;
  } else if (status === "CLEARED") {
    title = "Blind cleared";
    text =
      "That is the loop: inspect, correct, pair, play. The campaign runs three studies, each with its own SAP and a Boss at the end. Start it below the table.";
  } else if (status === "FAILED") {
    title = "Out of hands";
    text = `The Blind needed ${quota} points. Try the guided Blind again, or go straight to the campaign.`;
  } else {
    title = "Keep going";
    text = `${table?.roundScore ?? 0} of ${quota} so far. An uncorrected finding costs Mult: restart to try the steps again.`;
  }

  return (
    <section
      aria-labelledby="coach-title"
      className="min-w-0 border border-amber-400/60 bg-[color:var(--te-surface-1)] p-3 font-mono text-xs"
      data-testid="coach"
    >
      {selector && (
        <style>{`${selector} { outline: 2px solid #f59e0b; outline-offset: 3px; }`}</style>
      )}
      <p className="text-[10px] uppercase tracking-wider text-zinc-400 tabular-nums">
        Guided Blind ·{" "}
        {done ? "done" : `step ${step + 1} of ${TUTORIAL_STEPS.length}`}
      </p>
      <h3
        id="coach-title"
        tabIndex={-1}
        className="mt-1 font-bold uppercase tracking-wider text-amber-300 break-words focus:outline-none"
      >
        {title}
      </h3>
      <p className="mt-1 text-zinc-200 break-words" data-testid="coach-text">
        {text}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!done && current.waitsFor === null && (
          <button type="button" onClick={onNext} className={PRIMARY}>
            Next
          </button>
        )}
        {done && status === "REVIEWING" && (
          <button type="button" onClick={onRestart} className={PRIMARY}>
            Restart guided Blind
          </button>
        )}
        {!(done && status === "CLEARED") && (
          <button type="button" onClick={onSkip} className={QUIET}>
            {done ? "Go to the campaign" : "Skip tutorial"}
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * The offer shown to a first-time player (#1089). It never blocks the
 * table: the campaign is playable underneath until the player chooses.
 */
function TutorialOffer({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <section
      aria-labelledby="tutorial-offer-title"
      className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-3 border border-amber-400/60 bg-[color:var(--te-surface-1)] p-3 font-mono text-xs"
      data-testid="tutorial-offer"
    >
      <div className="min-w-0">
        <h3
          id="tutorial-offer-title"
          className="font-bold uppercase tracking-wider text-amber-300 break-words"
        >
          First time at the table?
        </h3>
        <p className="mt-1 text-zinc-300 break-words">
          Play a guided Blind: one hand, seven short steps, with a coach
          pointing at each control.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onStart} className={PRIMARY}>
          Start guided Blind
        </button>
        <button type="button" onClick={onSkip} className={QUIET}>
          No thanks
        </button>
      </div>
    </section>
  );
}

/** Focuses the hand's current card, where play starts. */
function focusHand() {
  requestAnimationFrame(() => {
    document
      .querySelector<HTMLElement>('[data-testid="hand"] [tabindex="0"]')
      ?.focus();
  });
}

/**
 * The Trial & Error table with its first-run guided Blind (#1089). A
 * first-time player is offered the guided Blind before the campaign; it can
 * be skipped at any step, and once finished or skipped it is not offered
 * again. The Field Manual can replay it.
 */
export function TrialAndErrorTable() {
  const seen = useTutorialSeen();
  const [mode, setMode] = useState<"CAMPAIGN" | "GUIDED">("CAMPAIGN");
  // Restarting the guided Blind remounts its table with a fresh state.
  const [attempt, setAttempt] = useState(0);
  const [step, setStep] = useState(0);
  const [table, setTable] = useState<TableState | null>(null);
  const { announce } = useAnnouncer();
  const announced = useRef<string | null>(null);

  const onTableChange = useCallback((next: TableState) => {
    setTable(next);
    setStep((current) =>
      tutorialStepAfter(TUTORIAL_STEPS, current, next.lastEvent, next)
    );
  }, []);

  const startGuided = useCallback(() => {
    setAttempt((n) => n + 1);
    setStep(0);
    setTable(null);
    setMode("GUIDED");
    requestAnimationFrame(() => {
      document.getElementById("coach-title")?.focus();
    });
  }, []);

  const toCampaign = useCallback(() => {
    writeSeen();
    setMode("CAMPAIGN");
    focusHand();
  }, []);

  // The table's end button hands over to the campaign, or retries.
  const guidedEnd = useCallback(
    (won: boolean) =>
      won
        ? { label: "Start the campaign", onSelect: toCampaign }
        : { label: "Restart guided Blind", onSelect: startGuided },
    [toCampaign, startGuided]
  );

  const next = useCallback(() => {
    if (table)
      setStep((current) => nextTutorialStep(TUTORIAL_STEPS, current, table));
  }, [table]);

  // Each step's text is announced politely, once, as the step starts.
  useEffect(() => {
    if (mode !== "GUIDED") {
      announced.current = null;
      return;
    }
    const current = TUTORIAL_STEPS[step];
    const key = `${attempt}:${step}:${table?.status ?? ""}`;
    if (announced.current === key) return;
    announced.current = key;
    if (current) announce(`${current.title}. ${current.text}`);
    else if (table?.status === "CLEARED") announce("Guided Blind cleared.");
  }, [mode, step, attempt, table?.status, announce]);

  if (mode === "GUIDED") {
    return (
      <CardTable
        key={`guided-${attempt}`}
        scenario={GUIDED_BLIND_SCENARIO}
        seed="guided"
        onTableChange={onTableChange}
        endAction={guidedEnd}
        coach={
          <Coach
            step={step}
            table={table}
            onNext={next}
            onSkip={toCampaign}
            onRestart={startGuided}
          />
        }
      />
    );
  }

  return (
    <>
      {!seen && (
        <TutorialOffer
          onStart={startGuided}
          onSkip={() => {
            writeSeen();
            focusHand();
          }}
        />
      )}
      <CardTable key="campaign" persist onReplayTutorial={startGuided} />
    </>
  );
}
