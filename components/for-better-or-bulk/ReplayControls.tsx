"use client";

/**
 * The controls for a replay of a finished run: play or pause, restart, a
 * speed of 1x, 2x or 4x, and exit. Every control is a labelled button and
 * takes focus when a replay opens. The status line is a live region that the
 * parent fills when a control is used, never on every tick.
 */

import React, { useEffect, useRef } from "react";

/** The speeds a replay can run at. */
export const REPLAY_SPEEDS = [1, 2, 4] as const;

export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

interface ReplayControlsProps {
  /** The clock time the replay is showing, such as "9:40". */
  clock: string;
  playing: boolean;
  finished: boolean;
  speed: ReplaySpeed;
  /** What the status line says, set by the parent when a control is used. */
  announcement: string;
  onTogglePlay: () => void;
  onRestart: () => void;
  onSpeedChange: (speed: ReplaySpeed) => void;
  onExit: () => void;
}

const BUTTON_CLASS =
  "min-h-11 rounded border border-[var(--fbb-control)] px-3 font-bold uppercase tracking-wide active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)]";

export function ReplayControls({
  clock,
  playing,
  finished,
  speed,
  announcement,
  onTogglePlay,
  onRestart,
  onSpeedChange,
  onExit,
}: ReplayControlsProps) {
  const playRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    playRef.current?.focus({ preventScroll: true });
  }, []);

  let playLabel = "Play replay";
  if (playing) playLabel = "Pause replay";
  else if (finished) playLabel = "Watch again";

  return (
    <section
      aria-labelledby="fbb-replay-title"
      data-testid="fbb-replay"
      className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-xs"
    >
      <h2
        id="fbb-replay-title"
        className="min-w-0 font-bold uppercase tracking-wide"
      >
        Replay
      </h2>
      <span
        className="min-w-0 tabular-nums text-[var(--fbb-dim)]"
        data-testid="fbb-replay-clock"
      >
        {clock}
      </span>
      <button
        ref={playRef}
        type="button"
        onClick={onTogglePlay}
        className={BUTTON_CLASS}
      >
        {playLabel}
      </button>
      <button type="button" onClick={onRestart} className={BUTTON_CLASS}>
        Restart replay
      </button>
      <div role="group" aria-label="Replay speed" className="flex gap-1">
        {REPLAY_SPEEDS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={speed === option}
            aria-label={`Replay at ${option}x speed`}
            onClick={() => onSpeedChange(option)}
            className={`${BUTTON_CLASS} ${speed === option ? "border-[var(--fbb-accent)] text-[var(--fbb-accent)]" : ""}`}
          >
            {option}x
          </button>
        ))}
      </div>
      <button type="button" onClick={onExit} className={BUTTON_CLASS}>
        Exit replay
      </button>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
