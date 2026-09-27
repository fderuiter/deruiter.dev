"use client";

import { useCallback, useState } from "react";

/**
 * A row's content width in rem, measured whenever the row is attached. It is
 * a callback ref rather than an effect on mount, because the hand row is not
 * in the DOM while the Resume prompt shows: a mount-time observer never saw
 * a resumed run's hand, so it never fitted (#1087). Only width is tracked, so
 * a mobile address bar collapsing never refits the row (AGENTS.md §16).
 */
export function useRowWidthRem() {
  const [widthRem, setWidthRem] = useState(0);
  const ref = useCallback((element: HTMLElement | null) => {
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const rem =
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setWidthRem(Math.floor(entry.contentRect.width) / rem);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [widthRem, ref] as const;
}
