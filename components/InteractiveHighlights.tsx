"use client";

import React from "react";
import Link from "next/link";
import { IconDeviceGamepad2, IconArrowRight } from "@tabler/icons-react";

export const InteractiveHighlights: React.FC = () => {
  return (
    <div className="@container min-w-0 w-full mb-6 sm:mb-8 p-5 sm:p-7 bg-[#13151a]/90 border border-white/10 rounded-2xl relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300 shadow-xl">
      <div className="absolute inset-y-0 left-0 w-px bg-amber-400/60 pointer-events-none" />

      <div className="flex flex-col @lg:flex-row @lg:items-center justify-between gap-4 relative z-10">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 mb-2.5 rounded text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 uppercase">
            <span>SIDE PROJECTS / PLAYABLE</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white mb-1.5 flex items-center gap-2.5">
            <IconDeviceGamepad2 className="w-5 h-5 text-amber-400 shrink-0" />
            Yes, there are games.
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-xl font-sans">
            A laser loon, a needy puppy, and a smartwatch with very little
            memory. I learn by building things. Sometimes those things have boss
            fights.
          </p>
        </div>
        <Link
          href="/arcade"
          className="w-full sm:w-auto self-start sm:self-center shrink-0 min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 bg-amber-400 text-black font-mono text-xs font-bold rounded-xl hover:bg-amber-300 transition-all duration-200 shadow-md cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#13151a]"
        >
          <span>Visit the Arcade</span>
          <IconArrowRight className="w-3.5 h-3.5 shrink-0" />
        </Link>
      </div>
    </div>
  );
};
