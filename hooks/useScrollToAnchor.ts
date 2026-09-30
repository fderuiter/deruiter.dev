"use client";

import { useCallback } from "react";
import type React from "react";
import {
  isModifiedClick,
  scrollToElement,
  type ScrollToElementOptions,
} from "@/lib/scroll";

export type { ScrollHashMode, ScrollToElementOptions } from "@/lib/scroll";

/** Options accepted by {@link useScrollToAnchor}. */
export interface UseScrollToAnchorOptions extends ScrollToElementOptions {
  /**
   * Runs when a click is handled in page, before scrolling, for side effects
   * such as audio feedback or closing a menu. Receives the target id.
   */
  onNavigate?: (id: string) => void;
}

/** Click handler returned by {@link useScrollToAnchor}. */
export type ScrollToAnchorHandler = (
  event: React.MouseEvent<HTMLElement>,
  id: string
) => void;

/**
 * Click handler for in-page anchor links.
 *
 * A plain click is handled in page: the default jump is prevented, the target
 * scrolls into view (instantly under reduced motion) and receives focus. A
 * click with a modifier key or a non-primary button is left to the browser, so
 * opening the section in a new tab still works.
 *
 * @param options - Scroll settings plus an optional `onNavigate` callback.
 * @returns A handler to call from an anchor's `onClick` with the target id.
 */
export function useScrollToAnchor(
  options: UseScrollToAnchorOptions = {}
): ScrollToAnchorHandler {
  const { onNavigate, behavior, block, focus, updateHash } = options;

  return useCallback<ScrollToAnchorHandler>(
    (event, id) => {
      if (isModifiedClick(event)) return;
      event.preventDefault();
      onNavigate?.(id);
      scrollToElement(id, { behavior, block, focus, updateHash });
    },
    [onNavigate, behavior, block, focus, updateHash]
  );
}
