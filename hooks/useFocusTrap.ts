"use client";

import { useEffect, useRef, useCallback } from "react";
import { env } from "@/lib/env";

export interface UseFocusTrapOptions {
  /**
   * Element or ref to focus immediately when the trap activates.
   */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * Callback triggered when Escape key is pressed.
   */
  onEscape?: () => void;
  /**
   * Whether to restore focus to previously active element upon unmount or deactivation.
   * Defaults to true.
   */
  returnFocus?: boolean;
  /**
   * Fallback element to focus on close when the element that was focused at
   * activation is no longer connected to the document.
   */
  returnFocusTo?: React.RefObject<HTMLElement | null>;
  /**
   * Custom keydown handler to process shortcuts (e.g., Arrow keys, letter hotkeys)
   * while the trap is active before or along with standard trap behavior.
   */
  onKeyDown?: (event: KeyboardEvent) => void;
}

// Module-level count of currently-active focus traps across the whole page
// (a dialog, drawer, or overlay is "active" while its trap is mounted and
// trapping focus). Consulted by other window-level keydown listeners (e.g.
// useFullscreen's Escape-to-exit-pseudo-fullscreen shortcut) that would
// otherwise fire alongside a dialog's own Escape handler on the same
// keypress: native addEventListener does not let stopPropagation cancel
// sibling listeners already registered on the same target, so a shared
// "is any dialog currently open" signal is the only reliable way to give
// the topmost dialog exclusive ownership of Escape.
let activeFocusTrapCount = 0;

// Restore target of the trap that most recently deactivated, kept until the
// next macrotask. A dialog that hands off to another (closing itself and
// opening the next in one handler) unmounts its own focused button, so the
// incoming trap sees <body> as the active element. It inherits this target
// instead, which is the control that opened the outgoing dialog.
let handoffTarget: HTMLElement | null = null;

/** True while at least one useFocusTrap instance is currently active. */
export function isAnyFocusTrapActive(): boolean {
  return activeFocusTrapCount > 0;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  "audio[controls]",
  "video[controls]",
  '[contenteditable]:not([contenteditable="false"])',
].join(", ");

/**
 * Custom hook to trap keyboard focus within a container element for modal dialogs and drawers.
 *
 * Implements WCAG 2.1 Focus Order and Keyboard Navigation compliance.
 *
 * @param active - Whether focus trapping is currently active.
 * @param options - Configuration options for initial focus, escape handler, and focus restoration.
 * @returns A RefObject to attach to the container element.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  active: boolean,
  options: UseFocusTrapOptions = {}
): React.RefObject<T | null> {
  const containerRef = useRef<T | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const {
    initialFocusRef,
    onEscape,
    returnFocus = true,
    returnFocusTo,
    onKeyDown,
  } = options;

  const onEscapeRef = useRef(onEscape);
  const onKeyDownRef = useRef(onKeyDown);
  const returnFocusToRef = useRef(returnFocusTo);

  useEffect(() => {
    onEscapeRef.current = onEscape;
    onKeyDownRef.current = onKeyDown;
    returnFocusToRef.current = returnFocusTo;
  }, [onEscape, onKeyDown, returnFocusTo]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!active || !containerRef.current) return;

      if (event.key === "Escape" && onEscapeRef.current) {
        event.preventDefault();
        // stopPropagation alone only stops the event reaching other DOM
        // nodes; sibling listeners already registered on this same target
        // (window) still fire. stopImmediatePropagation additionally
        // suppresses those, giving this dialog exclusive ownership of the
        // keypress instead of also triggering e.g. a fullscreen-exit
        // shortcut listening on the same target.
        event.stopImmediatePropagation();
        event.stopPropagation();
        onEscapeRef.current();
        return;
      }

      if (onKeyDownRef.current) {
        onKeyDownRef.current(event);
        if (event.defaultPrevented) {
          event.stopPropagation();
          return;
        }
      }

      if (event.key !== "Tab") return;

      const container = containerRef.current;
      const focusableElements = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(
        (el) =>
          !el.hasAttribute("disabled") &&
          el.getAttribute("aria-hidden") !== "true" &&
          (el.offsetParent !== null ||
            typeof env.VITEST !== "undefined" ||
            el.style.display !== "none")
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const currentActive = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        // Shift + Tab: if on first element or outside, move to last
        if (
          currentActive === firstElement ||
          !container.contains(currentActive)
        ) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element or outside, move to first
        if (
          currentActive === lastElement ||
          !container.contains(currentActive)
        ) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    },
    [active]
  );

  useEffect(() => {
    if (!active) return;

    activeFocusTrapCount++;
    const container = containerRef.current;

    if (typeof document !== "undefined") {
      const current = document.activeElement as HTMLElement | null;
      const usable =
        current && current !== document.body && current.isConnected;
      previousActiveElementRef.current =
        usable || !handoffTarget?.isConnected ? current : handoffTarget;
    }

    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      activeFocusTrapCount = Math.max(0, activeFocusTrapCount - 1);
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", handleKeyDown);
      }
      const recorded = previousActiveElementRef.current;
      if (returnFocus && (recorded || returnFocusToRef.current)) {
        if (recorded && recorded !== document.body) {
          handoffTarget = recorded;
          setTimeout(() => {
            if (handoffTarget === recorded) handoffTarget = null;
          }, 0);
        }
        setTimeout(() => {
          // Focus was put somewhere on purpose while the trap closed, by the
          // close handler or by the user, so leave it there. Restoring only
          // rescues focus that was lost with the dialog or left inside it.
          const now = document.activeElement as HTMLElement | null;
          if (
            now &&
            now !== document.body &&
            now.isConnected &&
            !container?.contains(now)
          ) {
            return;
          }
          const target = recorded?.isConnected
            ? recorded
            : (returnFocusToRef.current?.current ?? recorded);
          if (target && typeof target.focus === "function") {
            target.focus();
          }
        }, 0);
      }
    };
  }, [active, handleKeyDown, returnFocus]);

  // Initial focus is its own effect so that a dialog changing which control
  // should take focus (a new step, a decision made) moves focus there without
  // deactivating and re-activating the whole trap. Focus already inside the
  // container is never pulled away: whoever put it there got there first.
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const current = document.activeElement;
      if (current && current !== container && container.contains(current)) {
        return;
      }
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else {
        const firstFocusable =
          container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          container.focus();
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [active, initialFocusRef]);

  return containerRef;
}
