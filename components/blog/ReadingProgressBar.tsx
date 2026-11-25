"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { clamp } from "@/lib/game-utils";

const noopSubscribe = () => () => {};
const supportsScrollTimeline = () =>
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  CSS.supports("animation-timeline: scroll()");

export function ReadingProgressBar() {
  const supportsCssScroll = useSyncExternalStore(
    noopSubscribe,
    supportsScrollTimeline,
    () => false
  );
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (supportsCssScroll || typeof window === "undefined") return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const scrollY = window.scrollY;
      const totalHeight =
        document.documentElement.scrollHeight - window.innerHeight;

      setProgress(totalHeight > 0 ? clamp(scrollY / totalHeight, 0, 1) : 0);
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
  }, [supportsCssScroll]);

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 h-[3px] bg-zinc-900 z-50 pointer-events-none"
    >
      <div
        className={
          supportsCssScroll
            ? "h-full bg-amber-500 origin-left reading-progress-fill"
            : "h-full bg-amber-500 transition-transform duration-75 ease-out origin-left"
        }
        style={
          supportsCssScroll ? undefined : { transform: `scaleX(${progress})` }
        }
      />
    </div>
  );
}
