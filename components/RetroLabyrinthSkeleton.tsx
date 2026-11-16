"use client";

import React from "react";

export function RetroLabyrinthSkeleton() {
  return (
    <div
      className="relative w-full aspect-[15/9] min-h-[240px] h-[240px] bg-neutral-950/80 border border-neutral-900 rounded-2xl flex flex-col items-center justify-center font-mono select-none overflow-hidden my-6 motion-safe:animate-pulse"
      data-testid="retro-labyrinth-skeleton"
    >
      {/* Skeleton Top Header Bar */}
      <div className="absolute top-3 left-4 right-4 flex justify-between items-center text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
        <span>SYSTEM_LABYRINTH.EXE</span>
        <span className="text-brand-cyan/60 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan motion-safe:animate-ping" />
          INITIALIZING...
        </span>
      </div>

      {/* Center Reticle & ASCII Grid Placeholder */}
      <div className="flex flex-col items-center justify-center gap-2 p-2">
        <div className="w-10 h-10 rounded-full border border-brand-cyan/30 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-brand-cyan/50" />
        </div>
        <p className="text-[10px] sm:text-[11px] leading-4 text-brand-cyan/60 font-mono text-center">
          ┌───────────────────────────┐
          <br />
          │ RESERVING MINIGAME CANVAS │
          <br />
          └───────────────────────────┘
        </p>
      </div>

      {/* Skeleton Bottom Status Line */}
      <div className="absolute bottom-3 left-4 right-4 text-center text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
        [INITIALIZING RETRO LABYRINTH ENGINE...]
      </div>
    </div>
  );
}

export default RetroLabyrinthSkeleton;
