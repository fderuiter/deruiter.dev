"use client";

import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  IconArrowLeft,
  IconCheck,
  IconSchool,
  IconX,
} from "@tabler/icons-react";
import { isStepComplete, practiceTarget } from "@/lib/arcade";
import { clamp } from "@/lib/game-utils";
import type { TutorialRun } from "./useTutorialRun";

/** Props for {@link TutorialOverlay}. */
export interface TutorialOverlayProps {
  readonly run: TutorialRun;
  /** The game's short name, for the offer. */
  readonly gameName: string;
  /** True once the cabinet has launched, so the offer can show. */
  readonly launched: boolean;
  /** True on a touch cabinet: steps show their touch control. */
  readonly touch: boolean;
  /** True while Setup or another cabinet sheet covers the stage. */
  readonly covered?: boolean;
}

/** How long a finished practice shows its tick before moving on, in ms. */
export const PRACTICE_DONE_MS = 900;
/** The card's distance from its control and from the stage's edges, in px. */
const GAP_PX = 10;
const EDGE_PX = 8;
/**
 * The docked card's top on a touch cabinet, in px: below the floating
 * toolbar (48px keys in the stage's top right corner).
 */
const TOUCH_DOCK_TOP_PX = 64;
/** The smallest box, in px, that counts as a control on screen. */
const MIN_TARGET_PX = 16;
/** How often a missing or moving target is looked for again, in ms. */
const REMEASURE_MS = 250;

interface Placement {
  readonly ring: {
    top: number;
    left: number;
    width: number;
    height: number;
  } | null;
  readonly top: number;
  readonly left: number;
}

function samePlacement(a: Placement | null, b: Placement | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Where the card goes: above its control when that fits, else below it,
 * else docked at the stage's top right, clear of the game's left side
 * where most games put the player.
 */
function place(
  card: HTMLElement,
  target: HTMLElement | null,
  dockTop: number
): Placement {
  const stage = (card.offsetParent as HTMLElement | null) ?? document.body;
  const box = stage.getBoundingClientRect();
  const width = card.offsetWidth;
  const height = card.offsetHeight;
  const docked = {
    ring: null,
    top: dockTop,
    left: Math.max(EDGE_PX, Math.round(box.width - width - EDGE_PX)),
  };
  if (!target) return docked;
  const rect = target.getBoundingClientRect();
  // A control that is not really on screen (an empty touch dock on a
  // desktop) gets no ring, and the card docks.
  if (rect.width < MIN_TARGET_PX || rect.height < MIN_TARGET_PX) return docked;
  const ring = {
    top: Math.round(rect.top - box.top),
    left: Math.round(rect.left - box.left),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
  const above = ring.top - GAP_PX - height;
  const below = ring.top + ring.height + GAP_PX;
  let top: number;
  if (above >= EDGE_PX) top = above;
  else if (below + height <= box.height - EDGE_PX) top = below;
  else return { ...docked, ring };
  const centred = ring.left + ring.width / 2 - width / 2;
  const maxLeft = Math.max(EDGE_PX, box.width - width - EDGE_PX);
  return {
    ring,
    top: Math.round(top),
    left: Math.round(clamp(centred, EDGE_PX, maxLeft)),
  };
}

function findTarget(from: HTMLElement, name: string): HTMLElement | null {
  const scope = from.closest("[data-arcade-cabinet]") ?? document;
  return (
    Array.from(
      scope.querySelectorAll<HTMLElement>("[data-tutorial-target]")
    ).find((element) => element.dataset.tutorialTarget === name) ?? null
  );
}

function focusGame(from: HTMLElement | null) {
  const scope = from?.closest("[data-arcade-cabinet]");
  scope
    ?.querySelector<HTMLElement>('[data-keyboard-boundary="true"]')
    ?.focus({ preventScroll: true });
}

// A click on a card button must not leave focus on it during practice, or
// the game's keys would press the button instead of reaching the game.
const keepFocus = (event: React.MouseEvent) => event.preventDefault();

const BUTTON =
  "min-h-11 rounded-lg px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98] touch-manipulation";
const PRIMARY = `${BUTTON} bg-amber-500 text-[#0d0e11] hover:bg-amber-400`;
const SECONDARY = `${BUTTON} border border-zinc-700 text-zinc-200 hover:border-zinc-500 hover:text-zinc-100`;

/**
 * The cabinet's guided tutorial (#2972): the first-launch offer, the coach
 * card that walks through the game's script, and the closing card.
 *
 * The coach card sits over the stage, pinned to the control its step is
 * about with an amber ring, or docked at the top right. A read step takes
 * focus on its Next button; a practice step hands focus back to the game so
 * its keys work, ticks off each try, and moves on by itself once done. Every
 * practice can be skipped and the tutorial left at any step. Each step is
 * read out politely.
 *
 * @param props - The run, the game and the cabinet's state.
 * @returns The offer, the card, the closing card, or null.
 */
export function TutorialOverlay({
  run,
  gameName,
  launched,
  touch,
  covered = false,
}: TutorialOverlayProps) {
  const { script, state, offered, dispatch } = run;
  const [offerDismissed, setOfferDismissed] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const finishRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const offerTitleId = useId();

  const running = state.status === "running";
  const step = running ? script.steps[state.index] : undefined;
  const needed = practiceTarget(step);
  const complete = running && isStepComplete(script, state);
  const practising = needed > 0;
  const target = step?.target;
  const showOffer =
    launched && offered && !offerDismissed && state.status === "idle";
  const ended = state.status === "finished";

  // Keep the card on its control while the game moves things around. The
  // first measure runs before paint, so the card never shows unplaced.
  useLayoutEffect(() => {
    if (!running || covered) return;
    const measure = () => {
      const card = cardRef.current;
      if (!card) return;
      const control = target ? findTarget(card, target) : null;
      const next = place(card, control, touch ? TOUCH_DOCK_TOP_PX : EDGE_PX);
      setPlacement((current) =>
        samePlacement(current, next) ? current : next
      );
    };
    measure();
    const timer = setInterval(measure, REMEASURE_MS);
    window.addEventListener("resize", measure);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", measure);
    };
  }, [running, covered, target, touch, state.index]);

  // A read step is read and passed with Next; a practice step belongs to the
  // game's own keys.
  // The card is hidden until it is placed, and a hidden button cannot take
  // focus, so this waits for the placement.
  const placed = placement !== null;
  useEffect(() => {
    if (!running || covered || !placed) return;
    if (practising) focusGame(cardRef.current);
    else nextRef.current?.focus({ preventScroll: true });
  }, [running, covered, placed, practising, state.index]);

  // A finished practice shows its tick briefly, then moves on.
  useEffect(() => {
    if (!running || !practising || !complete) return;
    const timer = setTimeout(
      () => dispatch({ type: "next" }),
      PRACTICE_DONE_MS
    );
    return () => clearTimeout(timer);
  }, [running, practising, complete, dispatch, state.index]);

  // The cabinet hands focus to the game just after launch; the offer takes
  // it back for its first second, so a key press answers the offer rather
  // than starting the game behind it.
  useEffect(() => {
    if (!showOffer || covered) return;
    let attempts = 0;
    const claim = () => {
      const button = startRef.current;
      const offer = button?.closest("[data-testid='tutorial-offer']");
      if (button && !offer?.contains(document.activeElement)) {
        button.focus({ preventScroll: true });
      }
    };
    claim();
    const timer = setInterval(() => {
      attempts += 1;
      claim();
      if (attempts >= 10) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [showOffer, covered]);

  useEffect(() => {
    if (ended && !covered) finishRef.current?.focus({ preventScroll: true });
  }, [ended, covered]);

  if (covered) return null;

  if (showOffer) {
    return (
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby={offerTitleId}
        data-testid="tutorial-offer"
        data-escape-holds="true"
        className="absolute left-1/2 top-1/2 z-30 w-[min(22rem,calc(100%-1rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-amber-500/40 bg-[#13151a] p-4 font-mono text-zinc-200 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)]"
      >
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-amber-300">
          <IconSchool className="h-4 w-4" aria-hidden="true" />
          Tutorial
        </p>
        <h2
          id={offerTitleId}
          className="mt-1 text-lg font-semibold tracking-[-0.035em] text-zinc-100"
        >
          New to {gameName}?
        </h2>
        <p className="mt-1 text-sm leading-snug text-zinc-300">
          Learn it by playing: about {script.minutes} minutes, with nothing to
          lose. You can replay it any time from the Tutorial key.
        </p>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className={SECONDARY}
            onClick={() => {
              setOfferDismissed(true);
              run.decline();
              focusGame(startRef.current);
            }}
          >
            Skip, just play
          </button>
          <button
            ref={startRef}
            type="button"
            className={PRIMARY}
            onClick={() => {
              setOfferDismissed(true);
              run.start();
            }}
          >
            Start the tutorial
          </button>
        </div>
      </div>
    );
  }

  if (ended) {
    return (
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        data-testid="tutorial-finished"
        data-escape-holds="true"
        className="absolute left-1/2 top-1/2 z-30 w-[min(22rem,calc(100%-1rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-emerald-500/40 bg-[#13151a] p-4 font-mono text-zinc-200 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)]"
      >
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-emerald-300">
          <IconCheck className="h-4 w-4" aria-hidden="true" />
          Tutorial complete
        </p>
        <h2
          id={titleId}
          className="mt-1 text-lg font-semibold tracking-[-0.035em] text-zinc-100"
        >
          You are ready
        </h2>
        <p className="mt-1 text-sm leading-snug text-zinc-300">
          {state.skipped.length > 0
            ? `You skipped ${state.skipped.length} practice ${
                state.skipped.length === 1 ? "step" : "steps"
              }; the Tutorial key replays the whole thing. `
            : ""}
          Every rule is in the Field Manual under How to play.
        </p>
        <span role="status" className="sr-only">
          Tutorial complete.
        </span>
        <div className="mt-3 flex justify-end">
          <button
            ref={finishRef}
            type="button"
            className={PRIMARY}
            onClick={() => {
              const from = cardRef.current;
              run.close();
              focusGame(from);
            }}
          >
            Start playing
          </button>
        </div>
      </div>
    );
  }

  if (!running || !step) return null;

  const total = script.steps.length;
  const control = touch ? (step.touch ?? step.keys) : step.keys;
  const last = state.index === total - 1;

  return (
    <>
      {placement?.ring && (
        <div
          aria-hidden="true"
          data-testid="tutorial-ring"
          className="pointer-events-none absolute z-30 rounded-xl ring-2 ring-amber-400 ring-offset-2 ring-offset-[#0d0e11]"
          style={placement.ring}
        />
      )}
      <div
        ref={cardRef}
        role="region"
        aria-labelledby={titleId}
        data-testid="tutorial-card"
        data-tutorial-step={step.id}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            dispatch({ type: "exit" });
            focusGame(cardRef.current);
          }
        }}
        style={
          placement
            ? { top: placement.top, left: placement.left }
            : { top: 0, left: 0, visibility: "hidden" }
        }
        className="absolute z-30 w-[min(20rem,calc(100%-1rem))] rounded-xl border border-amber-500/40 bg-[#13151a]/95 p-3 font-mono text-sm text-zinc-200 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.9)]"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 text-xs uppercase tracking-wider text-amber-300">
            <IconSchool className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {step.chapter} · {state.index + 1} of {total}
            </span>
          </p>
          <button
            type="button"
            aria-label="Leave the tutorial"
            title="Leave the tutorial"
            onMouseDown={keepFocus}
            onClick={() => {
              dispatch({ type: "exit" });
              focusGame(cardRef.current);
            }}
            className="-m-1.5 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <IconX className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div
          aria-hidden="true"
          className="mt-1 h-1 w-full overflow-hidden rounded-full bg-zinc-800"
        >
          <div
            className="h-full bg-amber-400 motion-safe:transition-[width]"
            style={{ width: `${((state.index + 1) / total) * 100}%` }}
          />
        </div>
        <h2
          id={titleId}
          className="mt-2 text-base font-semibold tracking-[-0.035em] text-zinc-100"
        >
          {step.title}
        </h2>
        <p className="mt-1 leading-snug text-zinc-300">{step.body}</p>
        {control && (
          <p className="mt-2 text-xs text-zinc-400">
            {practising ? "Try it: " : "Control: "}
            <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-zinc-100">
              {control}
            </kbd>
          </p>
        )}
        {practising && (
          <p
            data-testid="tutorial-practice"
            className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${
              complete ? "text-emerald-300" : "text-zinc-300"
            }`}
          >
            {complete ? (
              <>
                <IconCheck className="h-4 w-4" aria-hidden="true" />
                Done
              </>
            ) : needed > 1 ? (
              `${state.progress} of ${needed}`
            ) : (
              "Waiting for you…"
            )}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
          {state.index > 0 && (
            <button
              type="button"
              onMouseDown={keepFocus}
              onClick={() => dispatch({ type: "back" })}
              aria-label="Previous step"
              className={`${SECONDARY} inline-flex items-center`}
            >
              <IconArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {practising && !complete && (
            <button
              type="button"
              onMouseDown={keepFocus}
              onClick={() => dispatch({ type: "skip-practice" })}
              className={SECONDARY}
            >
              Skip this step
            </button>
          )}
          {!practising && (
            <button
              ref={nextRef}
              type="button"
              onClick={() => dispatch({ type: "next" })}
              className={PRIMARY}
            >
              {last ? "Finish" : "Next"}
            </button>
          )}
        </div>
        <span role="status" aria-live="polite" className="sr-only">
          {complete && practising
            ? "Done."
            : `Step ${state.index + 1} of ${total}. ${step.title}. ${step.body}${
                control
                  ? ` ${practising ? "Try it" : "Control"}: ${control}.`
                  : ""
              }`}
        </span>
      </div>
    </>
  );
}
