"use client";

import React, { useState, useEffect, startTransition } from "react";

interface DeferredHydrationProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

export const DeferredHydration: React.FC<DeferredHydrationProps> = ({
  children,
  fallback,
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [shouldRenderInteractive, setShouldRenderInteractive] = useState(false);

  useEffect(() => {
    let idleId: number | null = null;
    let animId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleMount = () => {
      // Step 1: Schedule interactive tree mount as a non-blocking transition during background idle window
      startTransition(() => {
        setShouldRenderInteractive(true);
      });

      // Step 2: Schedule fade-in / mounted status in next frame via non-blocking transition
      animId = requestAnimationFrame(() => {
        startTransition(() => {
          setIsMounted(true);
        });
      });
    };

    if (typeof window !== "undefined" && window.requestIdleCallback) {
      idleId = window.requestIdleCallback(() => scheduleMount(), {
        timeout: 1000,
      });
    } else {
      timeoutId = setTimeout(() => scheduleMount(), 50);
    }

    return () => {
      if (
        idleId !== null &&
        typeof window !== "undefined" &&
        window.cancelIdleCallback
      ) {
        window.cancelIdleCallback(idleId);
      }
      if (animId !== null && typeof window !== "undefined") {
        cancelAnimationFrame(animId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  // Children are always present in the markup (SSR-visible for crawlers and to
  // avoid CLS) and the fallback is layered on top until the idle-scheduled
  // mount completes. Both server and client render the exact same structure
  // on the first pass -- only the opacity classes change once state updates
  // post-mount -- so hydration never has to reconcile a structural mismatch.
  const revealed = shouldRenderInteractive && isMounted;

  return (
    <div className="w-full relative">
      <div
        className={`w-full transition-opacity duration-500 ease-in-out ${
          revealed ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {children}
      </div>
      <div
        className={`absolute inset-0 z-10 w-full h-full transition-opacity duration-500 ease-in-out ${
          revealed ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        {fallback}
      </div>
    </div>
  );
};

export const SkillsGridSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 w-full max-w-4xl mx-auto select-none animate-pulse">
      {/* 1. Bio Card Skeleton */}
      <div className="md:col-span-2 p-5 sm:p-6 md:p-8 bg-zinc-900/10 border border-zinc-900/50 rounded-3xl min-h-[220px] sm:min-h-[250px] flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3.5 sm:gap-4 mb-4 sm:mb-5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-zinc-800/50 border border-zinc-800/80" />
            <div className="space-y-2">
              <div className="h-4 w-32 bg-zinc-800/60 rounded" />
              <div className="h-3 w-48 bg-zinc-800/40 rounded" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full bg-zinc-800/40 rounded" />
            <div className="h-4 w-[90%] bg-zinc-800/40 rounded" />
            <div className="h-4 w-[95%] bg-zinc-800/40 rounded" />
          </div>
        </div>
      </div>

      {/* 2. Languages Card Skeleton */}
      <div className="p-5 sm:p-6 bg-zinc-900/10 border border-zinc-900/50 rounded-3xl min-h-[220px] sm:min-h-[250px] flex flex-col justify-between">
        <div>
          <div className="h-4 w-36 bg-zinc-800/60 rounded mb-3 sm:mb-4" />
          <div className="h-3 w-full bg-zinc-800/40 rounded mb-4 sm:mb-6" />
          <div className="space-y-3.5 sm:space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <div className="h-3 w-16 bg-zinc-800/50 rounded" />
                  <div className="h-3 w-8 bg-zinc-800/50 rounded" />
                </div>
                <div className="h-1.5 w-full bg-zinc-950 rounded-full">
                  <div
                    className="h-full bg-zinc-800/60 rounded-full"
                    style={{ width: `${80 - i * 15}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Pillars Card Skeleton */}
      <div className="md:col-span-3 p-5 sm:p-6 md:p-8 bg-zinc-900/5 border border-zinc-900/40 rounded-3xl">
        <div className="h-4 w-40 bg-zinc-800/60 rounded mx-auto md:mx-0 mb-5 sm:mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-zinc-800/50 flex items-center justify-center font-mono font-bold text-xs" />
              <div className="h-3.5 w-28 bg-zinc-800/50 rounded" />
              <div className="space-y-1">
                <div className="h-3 w-full bg-zinc-800/40 rounded" />
                <div className="h-3 w-[85%] bg-zinc-800/40 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const TimelineSkeleton: React.FC = () => {
  return (
    <div className="w-full max-w-3xl mx-auto py-6 sm:py-8 relative select-none animate-pulse">
      {/* Perspective Switcher Placeholder */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 mb-12 sm:mb-16 px-4 py-3 bg-surface-1 border border-zinc-900/80 rounded-2xl w-full">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-zinc-800" />
          <div className="h-3.5 w-20 bg-zinc-800/60 rounded" />
        </div>
        <div className="flex p-0.5 bg-zinc-950/90 border border-zinc-800/80 rounded-xl w-full sm:w-auto">
          <div className="h-10 w-28 sm:w-36 bg-zinc-900 rounded-lg border border-zinc-800/50" />
          <div className="h-10 w-28 sm:w-36 bg-zinc-900 rounded-lg border border-zinc-800/50" />
        </div>
      </div>

      {/* Rail Line */}
      <div className="absolute left-3 sm:left-4 md:left-1/2 top-28 bottom-0 w-0.5 bg-gradient-to-b from-zinc-800/30 via-zinc-900/20 to-zinc-950/10 -translate-x-1/2" />

      {/* Timeline Items Skeletons */}
      <div className="space-y-10 sm:space-y-14">
        {[1, 2, 3, 4, 5].map((i) => {
          const isLeft = i % 2 === 1;
          return (
            <div
              key={i}
              className={`relative flex flex-col md:flex-row items-start md:items-center ${
                isLeft ? "md:flex-row-reverse" : ""
              }`}
            >
              {/* Bullet Node */}
              <div className="absolute left-3 sm:left-4 md:left-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-zinc-950 border-2 border-zinc-800 -translate-x-1/2 z-10 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
              </div>

              {/* Card */}
              <div
                className={`w-full md:w-[46%] pl-7 sm:pl-10 md:pl-0 ${isLeft ? "md:pr-10 md:text-right" : "md:pl-10"}`}
              >
                <div className="p-4 sm:p-6 bg-zinc-900/25 border border-zinc-900/60 rounded-2xl">
                  <div
                    className={`flex items-center justify-between gap-2 mb-3 ${isLeft ? "md:flex-row-reverse" : ""}`}
                  >
                    <div className="h-5 w-24 bg-zinc-800/60 rounded-md" />
                    <div className="h-8 w-20 bg-zinc-900/80 border border-zinc-800 rounded-lg" />
                  </div>
                  <div
                    className={`h-5 w-48 bg-zinc-800/60 rounded ${isLeft ? "md:ml-auto" : ""}`}
                  />
                  <div
                    className={`h-3.5 w-32 bg-zinc-800/40 rounded mt-1.5 ${isLeft ? "md:ml-auto" : ""}`}
                  />

                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-full bg-zinc-800/30 rounded" />
                    <div className="h-3 w-[90%] bg-zinc-800/30 rounded" />
                    <div className="h-3 w-[95%] bg-zinc-800/30 rounded" />
                  </div>

                  <div
                    className={`flex flex-wrap gap-1.5 mt-4 ${isLeft ? "md:justify-end" : ""}`}
                  >
                    {[1, 2, 3].map((t) => (
                      <div
                        key={t}
                        className="h-5 w-14 bg-zinc-900/60 border border-zinc-800/80 rounded"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
