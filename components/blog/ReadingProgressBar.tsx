"use client";

import React, { useState, useEffect } from "react";
import { clamp } from "@/lib/game-utils";

export function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const scrollY = window.scrollY;
      const totalHeight =
        document.documentElement.scrollHeight - window.innerHeight;

      setProgress(
        totalHeight > 0 ? clamp(scrollY / totalHeight, 0, 1) : 0
      );
    };
    const handleScroll = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(measure);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const percentage = Math.round(progress * 100);

  return (
    <div
      role="progressbar"
      aria-label="Reading progress"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      className="fixed top-0 left-0 right-0 h-[3px] bg-zinc-900 z-50 pointer-events-none"
    >
      <div
        className="h-full bg-amber-500 transition-transform duration-75 ease-out origin-left"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
