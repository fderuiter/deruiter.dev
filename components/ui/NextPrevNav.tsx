"use client";

import React from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconArrowRight,
  IconGridDots,
} from "@tabler/icons-react";
import { useAudio } from "@/components/providers/AudioProvider";

interface NavItemTarget {
  title: string;
  href: string;
  label?: string;
  tag?: string;
}

interface NextPrevNavProps {
  prev?: NavItemTarget | null;
  next?: NavItemTarget | null;
  backToHub?: { title: string; href: string };
  className?: string;
}

/* jscpd:ignore-start */
export const NextPrevNav: React.FC<NextPrevNavProps> = ({
  prev,
  next,
  backToHub,
  className = "",
}) => {
  const { playHover } = useAudio();

  const handleHover = (e: React.MouseEvent<HTMLElement>) => {
    if (typeof window === "undefined") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pan = ((rect.left + rect.width / 2) / window.innerWidth) * 2 - 1;
    playHover(pan);
  };

  return (
    <div className={`w-full mt-16 pt-10 border-t border-zinc-900 ${className}`}>
      {backToHub && (
        <div className="flex justify-center mb-6">
          <Link
            href={backToHub.href}
            onMouseEnter={handleHover}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs font-mono text-zinc-400 hover:text-brand-cyan hover:border-brand-cyan/40 transition-all duration-200 group"
          >
            <IconGridDots className="w-4 h-4 text-brand-cyan group-hover:rotate-90 transition-transform duration-300" />
            <span>{backToHub.title}</span>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {prev ? (
          <Link
            href={prev.href}
            onMouseEnter={handleHover}
            className="group flex flex-col p-5 rounded-2xl bg-zinc-900/30 border border-zinc-800/80 hover:border-brand-cyan/40 hover:bg-zinc-900/50 transition-all duration-200"
          >
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-zinc-400 group-hover:text-brand-cyan transition-colors mb-1.5">
              <IconArrowLeft className="w-3.5 h-3.5 transform group-hover:-translate-x-1 transition-transform duration-200" />
              <span>{prev.label || "Previous Experience"}</span>
            </span>
            <span className="text-sm sm:text-base font-mono font-bold text-white group-hover:text-brand-cyan transition-colors truncate">
              {prev.title}
            </span>
            {prev.tag && (
              <span className="mt-2 text-[10px] font-mono text-zinc-400">
                {prev.tag}
              </span>
            )}
          </Link>
        ) : (
          <div className="hidden sm:block" />
        )}

        {next ? (
          <Link
            href={next.href}
            onMouseEnter={handleHover}
            className="group flex flex-col items-end text-right p-5 rounded-2xl bg-zinc-900/30 border border-zinc-800/80 hover:border-brand-cyan/40 hover:bg-zinc-900/50 transition-all duration-200 sm:col-start-2"
          >
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-zinc-400 group-hover:text-brand-cyan transition-colors mb-1.5">
              <span>{next.label || "Next Experience"}</span>
              <IconArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-200" />
            </span>
            <span className="text-sm sm:text-base font-mono font-bold text-white group-hover:text-brand-cyan transition-colors truncate w-full text-right">
              {next.title}
            </span>
            {next.tag && (
              <span className="mt-2 text-[10px] font-mono text-zinc-400">
                {next.tag}
              </span>
            )}
          </Link>
        ) : null}
      </div>
    </div>
  );
/* jscpd:ignore-end */
};
