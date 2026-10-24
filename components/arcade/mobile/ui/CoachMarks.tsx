"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { IconBulb } from "@tabler/icons-react";
import {
  arcadeCoachMarksSlice,
  setCoachMarksSeen,
  useProgress,
} from "@/lib/arcade";
import { clamp } from "@/lib/game-utils";

/** One coach mark: a short tip pinned to a real control. */
export interface CoachMarkStep {
  /** Stable key. */
  id: string;
  /**
   * The control the tip points at: a ref, or a CSS selector looked up inside
   * the cabinet (the whole document outside one).
   */
  target: string | React.RefObject<HTMLElement | null>;
  /** A few words, e.g. "Steer". */
  title: string;
  /** One sentence on what the control does. */
  body: string;
}

/** Props for {@link CoachMarks}. */
export interface CoachMarksProps {
  /** The game's registry slug; the tips are remembered per game. */
  gameId: string;
  /** Three steps at most; extra steps are dropped. */
  steps: readonly CoachMarkStep[];
  /**
   * Whether play is running, so the tips show over real controls. The tips
   * wait while it is false (a title screen, a pause).
   */
  active?: boolean;
  /** Called once when the player finishes or skips the tips. */
  onFinish?: (skipped: boolean) => void;
}

/** The most steps a first-run sequence may have (#2361). */
export const COACH_MARKS_MAX_STEPS = 3;

/** How far the tip sits from its control, in px. */
const GAP_PX = 10;
/** The tip's distance from the edges of its container, in px. */
const EDGE_PX = 8;
/** How often a missing or moving target is looked for again, in ms. */
const REMEASURE_MS = 250;

interface Placement {
  /** The target's box, relative to the tip's container. */
  ring: { top: number; left: number; width: number; height: number };
  top: number;
  left: number;
}

function resolveTarget(
  target: CoachMarkStep["target"],
  from: HTMLElement
): HTMLElement | null {
  if (typeof target !== "string") return target.current;
  const scope = from.closest("[data-arcade-cabinet]") ?? document;
  return scope.querySelector<HTMLElement>(target);
}

function samePlacement(a: Placement | null, b: Placement | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.top === b.top &&
    a.left === b.left &&
    a.ring.top === b.ring.top &&
    a.ring.left === b.ring.left &&
    a.ring.width === b.ring.width &&
    a.ring.height === b.ring.height
  );
}

/** Where the tip goes: above its control when it fits, else below. */
function place(tip: HTMLElement, target: HTMLElement): Placement | null {
  const container = (tip.offsetParent as HTMLElement | null) ?? document.body;
  const box = container.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  const ring = {
    top: Math.round(rect.top - box.top),
    left: Math.round(rect.left - box.left),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
  const tipWidth = tip.offsetWidth;
  const tipHeight = tip.offsetHeight;
  const above = ring.top - GAP_PX - tipHeight;
  const top = above >= EDGE_PX ? above : ring.top + ring.height + GAP_PX;
  const centred = ring.left + ring.width / 2 - tipWidth / 2;
  const maxLeft = Math.max(EDGE_PX, box.width - tipWidth - EDGE_PX);
  const left = Math.round(clamp(centred, EDGE_PX, maxLeft));
  return { ring, top: Math.round(top), left };
}

/**
 * A game's first-run coach marks (#2361): up to three short tips, one at a
 * time, each pinned to the real control it explains while play runs. The
 * player steps through them with Next or ends them with Skip; either way they
 * are remembered for the game on this device (`arcade.coach-marks`), and
 * Setup's "Show tips again" brings them back.
 *
 * The tips never take focus or pause play. Each tip is read out politely when
 * it appears, and its control gets the tip as its `aria-describedby` while it
 * shows. A tip whose control is not on screen (a hidden touch dock) waits
 * for it.
 *
 * Render it inside the stage, after the controls, in a positioned container.
 *
 * @param props - The game, its steps and whether play is running.
 * @returns The current tip, or null.
 */
export function CoachMarks({
  gameId,
  steps,
  active = true,
  onFinish,
}: CoachMarksProps) {
  const seen = useProgress(arcadeCoachMarksSlice).seen.includes(gameId);
  const sequence = steps.slice(0, COACH_MARKS_MAX_STEPS);
  const [index, setIndex] = useState(0);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const bodyId = useId();
  const titleId = useId();
  const step = sequence[index] as CoachMarkStep | undefined;
  const showing = !seen && active && step !== undefined;
  const target = step?.target;

  useEffect(() => {
    if (!showing || target === undefined) return;
    let frame = 0;
    let described: HTMLElement | null = null;
    let restore: string | null = null;
    const measure = () => {
      const tip = tipRef.current;
      if (!tip) return;
      const control = resolveTarget(target, tip);
      if (control !== described) {
        if (described) {
          if (restore === null) described.removeAttribute("aria-describedby");
          else described.setAttribute("aria-describedby", restore);
        }
        described = control;
        restore = control?.getAttribute("aria-describedby") ?? null;
        control?.setAttribute(
          "aria-describedby",
          restore ? `${restore} ${bodyId}` : bodyId
        );
      }
      const next = control ? place(tip, control) : null;
      setPlacement((current) =>
        samePlacement(current, next) ? current : next
      );
    };
    frame = requestAnimationFrame(measure);
    const timer = setInterval(measure, REMEASURE_MS);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
      window.removeEventListener("resize", measure);
      if (described) {
        if (restore === null) described.removeAttribute("aria-describedby");
        else described.setAttribute("aria-describedby", restore);
      }
    };
  }, [showing, target, bodyId]);

  if (!showing || !step) return null;

  const last = index === sequence.length - 1;
  const finish = (skipped: boolean) => {
    setCoachMarksSeen(gameId);
    onFinish?.(skipped);
  };
  const next = () => {
    if (last) finish(false);
    else {
      setPlacement(null);
      setIndex(index + 1);
    }
  };

  return (
    <>
      {placement && (
        <div
          aria-hidden="true"
          data-testid="coach-mark-ring"
          className="pointer-events-none absolute z-30 rounded-xl ring-2 ring-amber-400 ring-offset-2 ring-offset-[#0d0e11]"
          style={placement.ring}
        />
      )}
      <div
        ref={tipRef}
        role="note"
        aria-labelledby={titleId}
        data-testid="coach-mark"
        data-coach-step={step.id}
        style={
          placement
            ? { top: placement.top, left: placement.left }
            : { top: 0, left: 0, visibility: "hidden" }
        }
        className="absolute z-30 w-[min(18rem,calc(100%-1rem))] rounded-xl border border-amber-500/40 bg-[#13151a] p-3 font-mono text-sm text-zinc-200 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.9)]"
      >
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-amber-300">
          <IconBulb className="h-4 w-4" aria-hidden="true" />
          Tip {index + 1} of {sequence.length}
        </p>
        <p
          id={titleId}
          className="mt-1 text-base font-semibold tracking-[-0.035em] text-zinc-100"
        >
          {step.title}
        </p>
        <p id={bodyId} className="mt-1 leading-snug text-zinc-300">
          {step.body}
        </p>
        <div className="mt-2 flex items-center justify-end gap-2">
          {!last && (
            <button
              type="button"
              onClick={() => finish(true)}
              className="min-h-11 rounded-lg px-3 text-sm text-zinc-300 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
            >
              Skip tips
            </button>
          )}
          <button
            type="button"
            onClick={next}
            className="min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-bold text-[#0d0e11] hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 active:scale-[0.98]"
          >
            {last ? "Got it" : "Next tip"}
          </button>
        </div>
        <span role="status" aria-live="polite" className="sr-only">
          {placement
            ? `Tip ${index + 1} of ${sequence.length}. ${step.title}. ${step.body}`
            : ""}
        </span>
      </div>
    </>
  );
}

/** Props for {@link ShowTipsAgain}. */
export interface ShowTipsAgainProps {
  /** The game's registry slug. */
  gameId: string;
  /** Extra classes for the button. */
  className?: string;
}

/**
 * Setup's "Show tips again" (#2361): clears the game's coach-mark record so
 * the tips run again next time play starts. It renders only once the game's
 * tips have been seen on this device, so games without tips never show it.
 *
 * @param props - The game.
 * @returns The button, or null.
 */
export function ShowTipsAgain({ gameId, className = "" }: ShowTipsAgainProps) {
  const seen = useProgress(arcadeCoachMarksSlice).seen.includes(gameId);
  // Kept after the click, so the button stays put and keeps focus.
  const [cleared, setCleared] = useState(false);
  if (!seen && !cleared) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-disabled={cleared}
        onClick={() => {
          if (cleared) return;
          setCoachMarksSeen(gameId, false);
          setCleared(true);
        }}
        className={`min-h-11 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 text-left text-xs font-bold text-zinc-200 hover:border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98] aria-disabled:cursor-default aria-disabled:text-zinc-400 ${className}`}
      >
        Show tips again
      </button>
      <span role="status" className="text-xs text-zinc-300">
        {cleared ? "The tips will show when play starts." : ""}
      </span>
    </div>
  );
}
