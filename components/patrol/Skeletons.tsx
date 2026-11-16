import React from "react";

export const PatrolShiftSkeleton: React.FC = () => {
  return (
    <div
      className="w-full h-[800px] min-h-[600px] bg-zinc-950 rounded-3xl border border-zinc-800 overflow-hidden flex flex-col p-4 sm:p-6 select-none motion-safe:animate-pulse"
      data-testid="patrol-shift-skeleton"
    >
      {/* Top Bar Skeleton */}
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-zinc-800/80 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 shrink-0" />
          <div className="space-y-1.5">
            <div className="h-5 w-48 bg-zinc-800 rounded-md" />
            <div className="h-3 w-64 bg-zinc-800/60 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-8 bg-zinc-800 rounded-xl" />
          <div className="w-24 h-8 bg-zinc-800 rounded-xl" />
        </div>
      </div>

      {/* Main Grid Skeleton */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 pt-4 overflow-hidden">
        {/* Left Scenario & Status Panel */}
        <div className="lg:col-span-4 bg-zinc-900/50 rounded-2xl border border-zinc-800/60 p-4 space-y-4">
          <div className="h-4 bg-zinc-800 rounded w-1/2" />
          <div className="space-y-2 pt-2">
            <div className="h-12 bg-zinc-800/60 rounded-xl" />
            <div className="h-12 bg-zinc-800/60 rounded-xl" />
            <div className="h-12 bg-zinc-800/60 rounded-xl" />
          </div>
        </div>

        {/* Center Main Field Display */}
        <div className="lg:col-span-8 bg-zinc-900/30 rounded-2xl border border-zinc-800/60 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="h-6 bg-zinc-800 rounded w-1/3" />
            <div className="h-24 bg-zinc-800/60 rounded-2xl" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-16 bg-zinc-800/50 rounded-xl" />
              <div className="h-16 bg-zinc-800/50 rounded-xl" />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pt-4">
            <span>LOADING PATROL SHIFT SIMULATOR...</span>
            <span>INITIALIZING SIMULATION ENGINE</span>
          </div>
        </div>
      </div>
    </div>
  );
};
