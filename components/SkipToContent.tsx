"use client";

import { useFontPreference } from "@/hooks/useFontPreference";
import { useAnnouncer } from "@/components/providers/A11yProvider";
import { useScrollToAnchor } from "@/hooks/useScrollToAnchor";

interface SkipToContentProps {
  /**
   * Target DOM element ID to jump to when activated.
   * Defaults to 'main-content'.
   */
  targetId?: string;
  /**
   * Custom label text for the skip link.
   * Defaults to 'Skip to main content'.
   */
  label?: string;
}

/**
 * High-contrast, keyboard-accessible skip links and accessibility toggle.
 *
 * Positioned at the root DOM level to allow screen reader and keyboard-only users
 * to activate dyslexia-optimized typography and bypass navigation menus.
 */
export function SkipToContent({
  targetId = "main-content",
  label = "Skip to main content",
}: SkipToContentProps) {
  const { isDyslexic, toggleDyslexiaMode } = useFontPreference();
  const { announce } = useAnnouncer();

  const scrollToAnchor = useScrollToAnchor();

  const handleToggleDyslexia = () => {
    toggleDyslexiaMode();
    announce(
      isDyslexic
        ? "Dyslexia font mode disabled. Active fonts: Atkinson Hyperlegible and Lexend."
        : "Dyslexia font mode enabled. Active font: OpenDyslexic with expanded line-height and tracking.",
      "polite"
    );
  };

  return (
    <div className="relative z-50">
      <button
        type="button"
        onClick={handleToggleDyslexia}
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-amber-400 focus:text-slate-950 focus:font-semibold focus:text-sm focus:rounded-md focus:shadow-xl focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900 focus:outline-none transition-all duration-150 cursor-pointer"
        aria-pressed={isDyslexic}
      >
        {isDyslexic
          ? "Disable Dyslexia Font (OpenDyslexic active)"
          : "Enable Dyslexia Font (OpenDyslexic)"}
      </button>
      <a
        href={`#${targetId}`}
        onClick={(e) => scrollToAnchor(e, targetId)}
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-56 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-cyan-400 focus:text-slate-950 focus:font-semibold focus:text-sm focus:rounded-md focus:shadow-xl focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900 focus:outline-none transition-all duration-150"
      >
        {label}
      </a>
    </div>
  );
}
