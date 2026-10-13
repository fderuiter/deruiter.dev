"use client";

import React, { useState, useEffect } from "react";
import { IconDeviceMobileRotated, IconX } from "@tabler/icons-react";
import { getMatchMediaMatches } from "@/hooks/useMediaQuery";

export interface TabletOrientationHintProps {
  className?: string;
}

export const TabletOrientationHint: React.FC<TabletOrientationHintProps> = ({
  className = "",
}) => {
  const [isPortraitTouch, setIsPortraitTouch] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window === "undefined") return;
      const isTouch =
        "ontouchstart" in window ||
        (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) ||
        getMatchMediaMatches("(pointer: coarse)");
      const isPortrait = getMatchMediaMatches("(orientation: portrait)");
      const isTabletOrSmall = window.innerWidth <= 1024;

      setIsPortraitTouch(isTouch && isPortrait && isTabletOrSmall);
    };

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  if (!isPortraitTouch || isDismissed) {
    return null;
  }

  return (
    <div
      role="status"
      data-tablet-orientation-hint=""
      className={`relative mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center justify-between gap-3 animate-fadeIn shadow-lg backdrop-blur-md ${className}`}
    >
      <div className="flex items-center gap-2">
        <IconDeviceMobileRotated className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
        <span>
          Rotate to landscape for the best arcade experience & touch controls.
        </span>
      </div>
      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        aria-label="Dismiss orientation recommendation"
        className="p-1 text-amber-400/70 hover:text-amber-300 rounded-lg hover:bg-amber-500/20 transition-colors"
      >
        <IconX className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
