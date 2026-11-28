"use client";

import { useCallback, useEffect } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { clearCache } from "@chenglou/pretext";
import {
  cssPropertyCache,
  fontConfigCache,
  textPrepareCache,
  textLayoutCache,
} from "@/lib/graphics-engine";

export type FontMode = "default" | "opendyslexic";

export interface FontPreferenceReturn {
  fontMode: FontMode;
  isDyslexic: boolean;
  setFontMode: (mode: FontMode) => void;
  toggleDyslexiaMode: () => void;
}

/**
 * Manages persistent typography mode preference (default Atkinson/Lexend vs OpenDyslexic).
 * Automatically updates data-font-mode attribute on document.documentElement
 * and clears userland Pretext caches to trigger zero-CLS text reflow.
 */
export function useFontPreference(): FontPreferenceReturn {
  const [fontMode, setStoredFontMode] = usePersistentState<FontMode>(
    "portfolio-font-mode",
    "default"
  );

  const isDyslexic = fontMode === "opendyslexic";

  const clearAllFontCaches = useCallback(() => {
    cssPropertyCache.clear();
    fontConfigCache.clear();
    textPrepareCache.clear();
    textLayoutCache.clear();
    clearCache();
  }, []);

  const setFontMode = useCallback(
    (mode: FontMode) => {
      setStoredFontMode(mode);
      if (typeof document !== "undefined") {
        if (mode === "opendyslexic") {
          document.documentElement.setAttribute(
            "data-font-mode",
            "opendyslexic"
          );
        } else {
          document.documentElement.removeAttribute("data-font-mode");
        }
      }
      clearAllFontCaches();
    },
    [setStoredFontMode, clearAllFontCaches]
  );

  const toggleDyslexiaMode = useCallback(() => {
    setFontMode(isDyslexic ? "default" : "opendyslexic");
  }, [isDyslexic, setFontMode]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      if (fontMode === "opendyslexic") {
        document.documentElement.setAttribute("data-font-mode", "opendyslexic");
      } else {
        document.documentElement.removeAttribute("data-font-mode");
      }
    }
    clearAllFontCaches();
  }, [fontMode, clearAllFontCaches]);

  return {
    fontMode,
    isDyslexic,
    setFontMode,
    toggleDyslexiaMode,
  };
}
