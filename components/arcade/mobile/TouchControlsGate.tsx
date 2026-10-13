"use client";

import React, { useLayoutEffect, useRef } from "react";
import { useInputModality } from "@/components/arcade/mobile/input-modality";

export interface TouchControlsGateProps {
  children: React.ReactNode;
}

/** Controls that take focus or a Tab stop. */
const FOCUSABLE = "button, a[href], input, select, textarea, [tabindex]";
/** Remembers a control's own tabindex (or "none") while the gate hides it. */
const SAVED_TABINDEX = "data-gate-tabindex";
const NONE = "none";

/**
 * Keeps on-screen controls mounted and hit-testable while a keyboard or a
 * trackpad is in use, and hides them visually and from assistive tech. The
 * next touch shows them again (ADR 0061).
 *
 * The controls are not unmounted, so the first tap after a key press lands on
 * the control rather than on the stage behind it. Hiding uses opacity, which
 * keeps the pointer target live; `inert` would block that, so the controls
 * drop out of the Tab order with tabindex instead.
 *
 * @param props - The on-screen controls.
 * @returns The controls, hidden while the keyboard or a mouse is in use.
 */
export function TouchControlsGate({ children }: TouchControlsGateProps) {
  const modality = useInputModality();
  const active = modality === "touch" || modality === "pen";
  const rootRef = useRef<HTMLDivElement>(null);

  // Runs after every render so controls added while hidden are caught too.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>(FOCUSABLE).forEach((el) => {
      if (!active) {
        if (!el.hasAttribute(SAVED_TABINDEX)) {
          el.setAttribute(SAVED_TABINDEX, el.getAttribute("tabindex") ?? NONE);
        }
        el.setAttribute("tabindex", "-1");
      } else if (el.hasAttribute(SAVED_TABINDEX)) {
        const saved = el.getAttribute(SAVED_TABINDEX);
        if (saved === NONE) el.removeAttribute("tabindex");
        else if (saved !== null) el.setAttribute("tabindex", saved);
        el.removeAttribute(SAVED_TABINDEX);
      }
    });
    if (!active && root.contains(document.activeElement)) {
      (document.activeElement as HTMLElement).blur();
    }
  });

  return (
    <div
      ref={rootRef}
      data-touch-controls={active ? "shown" : "hidden"}
      aria-hidden={active ? undefined : true}
      className={active ? undefined : "opacity-0"}
    >
      {children}
    </div>
  );
}
