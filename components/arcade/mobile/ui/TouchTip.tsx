"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { IconInfoCircle, IconX } from "@tabler/icons-react";

/** Props for {@link TouchTip}. */
export interface TouchTipProps {
  /** What the tip is about, e.g. "Morale". Names the button and the popover. */
  label: string;
  /** What a hover `title=` used to hold. Plain text reads best. */
  children: React.ReactNode;
  /**
   * The id of the tip's text, for an element the tip explains to point its
   * own `aria-describedby` at. Generated when not given.
   */
  id?: string;
  /** Extra classes for the wrapper. */
  className?: string;
}

/** The popover's distance from the viewport edge, in px. */
const EDGE_PX = 8;

/**
 * Tap-to-reveal help (#2361), the touch replacement for a hover `title=`.
 *
 * The rule for each game: information that lives only in a `title=` is
 * invisible on touch, so it moves into a TouchTip beside the thing it
 * explains (or into visible text). A `title=` may stay as a desktop extra
 * only when the same words are also on screen or in a TouchTip.
 *
 * The 44px info button opens a small popover with the text and a close
 * button; a tap outside, the close button or Escape closes it, and focus
 * goes back to the button. The button is described by the text even while
 * it is closed, and `id` lets the explained element point at it too.
 *
 * @param props - The label and the tip's text.
 * @returns The button and, while open, its popover.
 */
export function TouchTip({
  label,
  children,
  id,
  className = "",
}: TouchTipProps) {
  const generated = useId();
  const textId = id ?? `${generated}-text`;
  const popoverId = `${generated}-popover`;
  const headingId = `${generated}-heading`;
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setShift(0);
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!open) return;
    // Captured at the window, so the tip's Escape closes only the tip: it
    // never reaches the cabinet's pause or a sheet the tip sits in.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close(true);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        close(false);
      }
    };
    // Keeps the popover inside the viewport, measured after it lays out.
    const frame = requestAnimationFrame(() => {
      const rect = popoverRef.current?.getBoundingClientRect();
      if (!rect) return;
      const over = rect.right - (window.innerWidth - EDGE_PX);
      const under = EDGE_PX - rect.left;
      setShift(over > 0 ? -over : under > 0 ? under : 0);
      closeRef.current?.focus({ preventScroll: true });
    });
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, close]);

  return (
    <span
      ref={wrapperRef}
      className={`relative inline-flex align-middle ${className}`}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-describedby={textId}
        onClick={() => (open ? close(false) : setOpen(true))}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-400 hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
      >
        <IconInfoCircle className="h-5 w-5" aria-hidden="true" />
      </button>
      <span id={textId} hidden>
        {children}
      </span>
      {open && (
        // Spans throughout, so the tip is valid inside a paragraph.
        <span
          ref={popoverRef}
          id={popoverId}
          role="dialog"
          aria-labelledby={headingId}
          data-testid="touch-tip"
          style={{ transform: `translateX(calc(-50% + ${shift}px))` }}
          className="absolute left-1/2 top-full z-30 mt-1 block w-64 max-w-[calc(100vw-1rem)] rounded-xl border border-zinc-700 bg-[#13151a] p-3 text-left font-mono text-sm text-zinc-200 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.9)]"
        >
          <span className="flex items-start justify-between gap-2">
            <span
              id={headingId}
              className="min-w-0 pt-2 text-xs font-bold uppercase tracking-wider text-amber-300"
            >
              {label}
            </span>
            <button
              ref={closeRef}
              type="button"
              aria-label={`Close ${label} tip`}
              onClick={() => close(true)}
              className="-mr-1 -mt-1 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-zinc-300 hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
            >
              <IconX className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
          <span className="block leading-snug text-zinc-200">{children}</span>
        </span>
      )}
    </span>
  );
}
