"use client";

import { flushSync } from "react-dom";
import { createContext, useContext, useEffect, type RefObject } from "react";

/**
 * Where the table's dialogs mount while it runs in the immersive touch
 * cabinet (ADR 0061, #2120). The cabinet's capture handler finds a game's
 * open dialog inside the cabinet, so Escape closes it instead of leaving the
 * cabinet, and the cabinet's focus trap keeps Tab inside it. Desktop and the
 * attract screen read null and keep portalling to the body.
 */
export const SheetHostContext = createContext<HTMLElement | null>(null);

/**
 * The element a table dialog portals into: the touch cabinet's sheet host,
 * else the fullscreen element, else the body.
 *
 * @returns The portal target.
 */
export function usePortalTarget(): Element {
  const host = useContext(SheetHostContext);
  return host ?? document.fullscreenElement ?? document.body;
}

/**
 * Moves keyboard focus into a touch sheet the moment it mounts. The shared
 * focus trap moves focus only after 50ms, and until it does the cabinet's own
 * trap holds the keyboard, so an Escape straight after the key that opened
 * the sheet would leave the cabinet instead of closing the sheet.
 *
 * @param el - The dialog container, or null before it mounts.
 */
export function claimFocus(el: HTMLElement | null): void {
  if (!el || el.contains(document.activeElement)) return;
  if (!el.hasAttribute("tabindex")) el.tabIndex = -1;
  el.focus({ preventScroll: true });
}

/**
 * Claims focus for a dialog that portals into the touch sheet host. Only the
 * touch cabinet has a host, so desktop is untouched. Call it after the
 * dialog's `useFocusTrap`: that hook records the opener when its own effect
 * runs, and this effect must run after it so the opener, not the dialog, is
 * where focus returns on close.
 *
 * @param ref - The dialog container the focus trap returned.
 */
export function useClaimFocus(ref: RefObject<HTMLElement | null>): void {
  const host = useContext(SheetHostContext);
  useEffect(() => {
    if (host) claimFocus(ref.current);
  }, [host, ref]);
}

/**
 * Wraps a dialog's Escape handler so its close renders before the keypress
 * ends. The cabinet's own Escape handler checks, a tick later, whether the
 * game's dialog is gone and leaves the cabinet if it is not; a close left to
 * React's scheduler can lose that race (#2120).
 *
 * @param close - The dialog's close handler.
 * @returns A handler that closes synchronously.
 */
export function closeNow(close: () => void): () => void {
  return () => flushSync(close);
}
