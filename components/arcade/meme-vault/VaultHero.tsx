"use client";

import React from "react";
import { PAD_COUNT, ringDash } from "./vault-geometry";

const RING_RADIUS = 42;

interface VaultHeroProps {
  unlocked: number;
  total: number;
}

/**
 * Graphite hero for the vault: title, one line of copy and a completion
 * ring for the easter-egg trophies. The ring's arc is emerald; nothing here
 * animates at rest.
 */
export function VaultHero({ unlocked, total }: VaultHeroProps) {
  const { circumference, dashOffset, progress } = ringDash(
    unlocked,
    total,
    RING_RADIUS
  );
  const percent = Math.round(progress * 100);

  return (
    <header className="relative mb-10 overflow-hidden rounded-xl border border-white/[0.08] bg-[#13151a] p-5 sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 max-w-2xl">
          <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-zinc-500">
            <span className="text-emerald-400">Arcade · Soundboard</span>
            <span aria-hidden="true">/</span>
            <span>
              {PAD_COUNT} pads · {total} trophies
            </span>
          </p>
          <h1 className="mb-3 text-3xl font-semibold tracking-[-0.035em] text-[#f4f4f6] sm:text-4xl lg:text-5xl">
            Developer Soundboard &amp; Meme Vault
          </h1>
          <p className="font-sans text-sm leading-relaxed text-zinc-400 sm:text-base">
            A soundboard, hidden trophies, and jokes for people who have spent
            too long looking at error messages.
          </p>
        </div>

        <div
          className="flex shrink-0 items-center gap-4"
          role="img"
          aria-label={`Easter egg completion: ${unlocked} of ${total} trophies (${percent}%)`}
          data-testid="meme-completion-ring"
        >
          <svg
            viewBox="0 0 100 100"
            className="h-24 w-24 -rotate-90 sm:h-28 sm:w-28"
            aria-hidden="true"
          >
            <circle
              cx="50"
              cy="50"
              r={RING_RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="6"
            />
            <circle
              cx="50"
              cy="50"
              r={RING_RADIUS}
              fill="none"
              stroke="#10b981"
              strokeWidth="6"
              strokeLinecap={progress > 0 ? "round" : "butt"}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="font-mono tabular-nums">
            <div className="text-2xl font-semibold text-[#f4f4f6]">
              {unlocked}
              <span className="text-zinc-500">/{total}</span>
            </div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">
              Easter Egg Completion
            </div>
            <div className="text-[11px] text-zinc-400">{percent}%</div>
          </div>
        </div>
      </div>
    </header>
  );
}
