"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Portrait } from "@/components/study-director/Portrait";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { TeamRole } from "@/lib/study-director";
import type { DialogueLine } from "@/lib/study-director-world";
import { DialogueLines } from "./TeamPieces";

/** Characters revealed per tick, and the tick length: about 150 a second. */
const CHARS_PER_TICK = 3;
const TICK_MS = 20;

/**
 * Reveals dialogue a few characters at a time. Lines that are appended to the
 * ones already shown keep typing from where they were; a conversation that
 * starts with a different line starts over. Under reduced motion everything
 * is shown at once.
 */
function useTypewriter(lines: readonly DialogueLine[], reduced: boolean) {
  const total = lines.reduce((n, l) => n + l.text.length, 0);
  const key = lines[0]?.text ?? "";
  const [state, setState] = useState({ key, count: 0 });
  const count = reduced ? total : state.key === key ? state.count : 0;
  const done = count >= total;

  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => {
      setState((s) => ({
        key,
        count: (s.key === key ? s.count : 0) + CHARS_PER_TICK,
      }));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [done, key]);

  const skip = useCallback(() => setState({ key, count: total }), [key, total]);
  return { count: Math.min(count, total), done, skip };
}

/** Who is speaking: a portrait, their name and role, and trust as hearts. */
export interface Speaker {
  name: string;
  role: string;
  /** Set for team members, who get a portrait ringed by their workload. */
  member?: { role: TeamRole; workload: number };
  /** Trust, 0 to 5, when the speaker is someone the player has a standing with. */
  hearts?: number;
}

const NamePlate: React.FC<{ speaker: Speaker }> = ({ speaker }) => (
  <div className="flex min-w-0 items-center gap-3">
    {speaker.member ? (
      <Portrait
        name={speaker.name}
        role={speaker.member.role}
        workload={speaker.member.workload}
        size={44}
      />
    ) : (
      <span
        aria-hidden="true"
        className="grid size-11 shrink-0 place-items-center border border-[var(--sd-hairline-strong)] bg-[var(--sd-surface-2)] text-xs font-bold text-zinc-300"
      >
        {speaker.name
          .split(/\s+/)
          .map((p) => p[0] ?? "")
          .join("")
          .slice(0, 2)
          .toUpperCase()}
      </span>
    )}
    <div className="min-w-0">
      <p className="text-sm font-bold break-words text-zinc-100">
        {speaker.name}
      </p>
      <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--sd-muted)]">
        <span className="break-words">{speaker.role}</span>
        {speaker.hearts !== undefined ? (
          <span data-testid="speaker-hearts">
            <span aria-hidden="true" className="tracking-widest text-amber-300">
              {"♥".repeat(speaker.hearts)}
              <span className="text-zinc-700">
                {"♥".repeat(Math.max(0, 5 - speaker.hearts))}
              </span>
            </span>
            <span className="sr-only">{speaker.hearts} of 5 hearts</span>
          </span>
        ) : null}
      </p>
    </div>
  </div>
);

/**
 * A conversation as a box at the bottom of the stage: the speaker's portrait,
 * name, role and trust, the lines typed out, then whatever the player can do
 * about it. Space or Enter finishes the typing at once. Focus is trapped
 * inside, Escape closes, and focus goes back to where it came from. Under
 * reduced motion the text is simply there.
 */
export const DialogueBox: React.FC<{
  titleId: string;
  /** The box's accessible name; defaults to the speaker's name. */
  title?: string;
  speaker: Speaker;
  /** A short line under the name, such as the subject or what talking costs. */
  subtitle?: string;
  lines: readonly DialogueLine[];
  reducedMotion: boolean;
  testId: string;
  onClose: () => void;
  /** Keys the box does not use itself, such as the number keys for choices. */
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  returnFocusTo?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}> = ({
  titleId,
  title,
  speaker,
  subtitle,
  lines,
  reducedMotion,
  testId,
  onClose,
  onKeyDown,
  initialFocusRef,
  returnFocusTo,
  children,
}) => {
  const trapRef = useFocusTrap<HTMLDivElement>(true, {
    initialFocusRef,
    onEscape: onClose,
    returnFocusTo,
  });
  const { count, done, skip } = useTypewriter(lines, reducedMotion);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 sm:p-4">
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={testId}
        data-typing={done ? "done" : "typing"}
        onKeyDown={(e) => {
          if (!done && (e.key === " " || e.key === "Enter")) {
            e.preventDefault();
            skip();
            return;
          }
          onKeyDown?.(e);
        }}
        className="sd-enter pointer-events-auto max-h-[60dvh] w-full max-w-3xl min-w-0 space-y-3 overflow-y-auto border border-[var(--sd-hairline-strong)] bg-[var(--sd-surface)] p-4 font-mono text-[var(--sd-text)]"
      >
        <h3 id={titleId} className="sr-only">
          {title ?? speaker.name}
        </h3>
        <NamePlate speaker={speaker} />
        {subtitle ? (
          <p className="text-[11px] break-words text-[var(--sd-muted)]">
            {subtitle}
          </p>
        ) : null}
        <DialogueLines lines={lines} reveal={count} />
        {!done ? (
          <p className="text-[10px] text-[var(--sd-muted)]">
            Space or Enter shows the rest.
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
};
