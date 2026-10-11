"use client";

/**
 * The ceremony playback shown between the last step and the receipt. Motion
 * plays the scripted scenes in about thirty seconds; reduced motion shows the
 * same scenes as a static summary card. Skip, Escape and the last scene all
 * hand over to the receipt once.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { bankText, type GameState } from "@/lib/for-better-or-bulk";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ceremonyScenes } from "./playback";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

interface CeremonyPlaybackProps {
  /** The final state of the level; the scenes are read from it alone. */
  state: GameState;
  /** Hands over to the receipt. Called once, however the playback ends. */
  onDone: () => void;
}

export function CeremonyPlayback({ state, onDone }: CeremonyPlaybackProps) {
  const reduced = useMediaQuery(REDUCED_MOTION_QUERY);
  const scenes = useMemo(() => ceremonyScenes(state), [state]);
  const [index, setIndex] = useState(0);
  const actionRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef(onDone);
  const finishedRef = useRef(false);

  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  /** Ends the playback once; later calls do nothing. */
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    doneRef.current();
  }, []);

  // Motion: move to the next scene when this one's time is up.
  useEffect(() => {
    if (reduced) return;
    const scene = scenes[index];
    if (!scene) {
      finish();
      return;
    }
    const timer = setTimeout(
      () => setIndex((i) => i + 1),
      scene.seconds * 1000
    );
    return () => clearTimeout(timer);
  }, [index, reduced, scenes, finish]);

  // Escape skips from anywhere on the page while the playback is up.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  // The skip or continue button takes focus on open, so Enter or Escape works at once.
  useEffect(() => {
    actionRef.current?.focus({ preventScroll: true });
  }, [reduced]);

  const title = bankText("scene-summary");

  if (reduced) {
    return (
      <section
        aria-labelledby="fbb-playback-title"
        data-testid="fbb-playback"
        data-mode="static"
        className="flex w-full min-w-0 flex-col gap-3 p-4 font-mono text-[var(--fbb-text)] sm:p-6"
      >
        <h2
          id="fbb-playback-title"
          className="break-words text-lg font-extrabold tracking-[-0.035em]"
        >
          {title}
        </h2>
        <ol className="flex min-w-0 flex-col gap-3 text-xs">
          {scenes.map((scene) => (
            <li
              key={scene.id}
              className="min-w-0"
              data-testid="fbb-summary-scene"
            >
              <p className="font-bold uppercase tracking-wide text-[var(--fbb-accent)]">
                {scene.heading}
              </p>
              <p className="break-words">{scene.line}</p>
            </li>
          ))}
        </ol>
        <button
          ref={actionRef}
          type="button"
          onClick={finish}
          className="min-h-11 self-start rounded border border-[var(--fbb-accent)] px-4 font-bold uppercase tracking-wide active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)]"
        >
          Continue to the receipt
        </button>
      </section>
    );
  }

  const scene = scenes[index];
  return (
    <section
      aria-labelledby="fbb-playback-title"
      data-testid="fbb-playback"
      data-mode="motion"
      className="flex min-h-[320px] w-full min-w-0 flex-col justify-between gap-4 p-4 font-mono text-[var(--fbb-text)] sm:p-6"
    >
      <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
        <h2
          id="fbb-playback-title"
          className="min-w-0 break-words font-bold uppercase tracking-wide"
        >
          {title}
        </h2>
        <button
          ref={actionRef}
          type="button"
          onClick={finish}
          className="min-h-11 shrink-0 rounded border border-[var(--fbb-control)] px-4 font-bold uppercase tracking-wide active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)]"
        >
          Skip
        </button>
      </div>
      {scene ? (
        <div
          key={scene.id}
          aria-live="polite"
          data-testid="fbb-scene"
          data-scene={scene.id}
          className="fbb-scene-in flex min-w-0 flex-col gap-2"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--fbb-accent)]">
            {scene.heading}
          </p>
          <p className="break-words text-lg font-bold tracking-[-0.02em]">
            {scene.line}
          </p>
        </div>
      ) : null}
      <div className="flex min-w-0 items-center justify-between gap-3 text-xs text-[var(--fbb-dim)]">
        <ol aria-hidden="true" className="flex gap-1">
          {scenes.map((item, i) => (
            <li
              key={item.id}
              className={`h-1.5 w-6 rounded ${i <= index ? "bg-[var(--fbb-accent)]" : "bg-[var(--fbb-rule)]"}`}
            />
          ))}
        </ol>
        <span>Esc skips</span>
      </div>
    </section>
  );
}
