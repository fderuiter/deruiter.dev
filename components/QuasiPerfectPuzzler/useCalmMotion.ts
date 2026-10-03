"use client";

import { useSyncExternalStore } from "react";

const CALM_QUERY = "(prefers-reduced-motion: reduce), (max-width: 767px)";

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return () => {};
  const query = window.matchMedia(CALM_QUERY);
  query.addEventListener?.("change", callback);
  return () => query.removeEventListener?.("change", callback);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return true;
  return window.matchMedia(CALM_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return true;
}

/**
 * True when board motion should be skipped: the visitor prefers reduced
 * motion, or the viewport is narrower than 768px (AGENTS.md §16, §20).
 * Split, settle and card-lift animations read this and jump straight to
 * their end state instead.
 */
export function useCalmMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
