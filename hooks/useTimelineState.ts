"use client";

import { useState } from "react";
import type { PersonaType } from "@/lib/persona";

/**
 * Timeline reading perspective. Shares its values with the site-wide reading
 * mode: "professional" renders the Professional Summary and
 * "behind-the-scenes" renders the Behind the Scenes Reality.
 */
export type TimelineMode = PersonaType;

/**
 * Local state for a career timeline with a global perspective and per-card overrides.
 *
 * @param initialMode - Perspective shown before the visitor chooses one. Defaults to
 * Behind the Scenes, the hook's original starting perspective. The rendered timeline
 * follows the site-wide reading mode instead, which defaults to Professional.
 */
export function useTimelineState(
  initialMode: TimelineMode = "behind-the-scenes"
) {
  const [globalMode, setGlobalMode] = useState<TimelineMode>(initialMode);
  const [cardOverrides, setCardOverrides] = useState<
    Record<number, TimelineMode>
  >({});

  const handleGlobalToggle = (mode: TimelineMode) => {
    setGlobalMode(mode);
    setCardOverrides({});
  };

  const handleCardToggle = (idx: number) => {
    const currentCardMode = cardOverrides[idx] ?? globalMode;
    const nextMode: TimelineMode =
      currentCardMode === "professional" ? "behind-the-scenes" : "professional";
    setCardOverrides((prev) => ({
      ...prev,
      [idx]: nextMode,
    }));
  };

  const getCardMode = (idx: number): TimelineMode => {
    return cardOverrides[idx] ?? globalMode;
  };

  return {
    globalMode,
    cardOverrides,
    handleGlobalToggle,
    handleCardToggle,
    getCardMode,
  };
}
