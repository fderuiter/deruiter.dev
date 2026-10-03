"use client";

import React from "react";
import Link from "next/link";
import { IconLock } from "@tabler/icons-react";
import type { EasterEggAchievement } from "@/lib/meme-data";
import { renderTrophyGlyph } from "./pictograms";

interface TrophyShelfProps {
  achievements: readonly EasterEggAchievement[];
  unlockedIds: readonly string[];
  /** Id of a trophy unlocked while the page is open; it stamps in once. */
  stampId: string | null;
}

/** Hexagonal badge plate, pointy-top, in a 64 by 72 box. */
const PLATE = "M32 2 L61 18.5 L61 53.5 L32 70 L3 53.5 L3 18.5 Z";
const PLATE_INNER = "M32 8 L56 21.8 L56 50.2 L32 64 L8 50.2 L8 21.8 Z";

function Badge({
  achievement,
  unlocked,
}: {
  achievement: EasterEggAchievement;
  unlocked: boolean;
}) {
  return (
    <span className="relative block h-[72px] w-16 shrink-0" aria-hidden="true">
      <svg viewBox="0 0 64 72" className="absolute inset-0 h-full w-full">
        <path
          d={PLATE}
          fill={unlocked ? "#1a1d24" : "#111317"}
          stroke={unlocked ? "rgba(16,185,129,0.55)" : "rgba(255,255,255,0.10)"}
          strokeWidth="1.5"
          strokeDasharray={unlocked ? undefined : "3 3"}
        />
        <path
          d={PLATE_INNER}
          fill={unlocked ? "#13151a" : "#0d0e11"}
          stroke={
            unlocked ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)"
          }
          strokeWidth="1"
        />
      </svg>
      {unlocked ? (
        <>
          {/* Engraving: a one-pixel highlight under the cut, then the cut. */}
          {renderTrophyGlyph(achievement.id, {
            stroke: 1.75,
            className:
              "absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 translate-y-[calc(-50%+1px)] text-white/15",
          })}
          {renderTrophyGlyph(achievement.id, {
            stroke: 1.75,
            className:
              "absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-emerald-400",
          })}
        </>
      ) : (
        <>
          {/* Locked: a filled silhouette with no detail. */}
          {renderTrophyGlyph(achievement.id, {
            stroke: 3.25,
            className:
              "absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-[#24272f]",
          })}
          <IconLock
            stroke={2}
            className="absolute bottom-1 left-1/2 h-3.5 w-3.5 -translate-x-1/2 text-zinc-500"
          />
        </>
      )}
    </span>
  );
}

/**
 * The trophy shelf: one engraved hex badge per easter egg on a hairline
 * ledge. Locked trophies show a dashed silhouette and their hint; a trophy
 * that unlocks while the page is open stamps in once.
 */
export function TrophyShelf({
  achievements,
  unlockedIds,
  stampId,
}: TrophyShelfProps) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {achievements.map((ach) => {
        const unlocked = unlockedIds.includes(ach.id);
        const stamping = unlocked && stampId === ach.id;
        return (
          <li
            key={ach.id}
            data-unlocked={unlocked ? "true" : "false"}
            data-testid={`trophy-${ach.id}`}
            className="meme-trophy relative flex min-w-0 gap-4 rounded-lg border border-white/[0.08] bg-[#13151a] p-4 shadow-[inset_0_-3px_0_#0d0e11]"
          >
            <div className={stamping ? "meme-trophy-stamp" : undefined}>
              <Badge achievement={ach} unlocked={unlocked} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h3
                  className={`min-w-0 break-words text-sm font-semibold ${
                    unlocked ? "text-zinc-100" : "text-zinc-400"
                  }`}
                >
                  {ach.title}
                </h3>
                <span
                  className={`rounded-sm border px-1.5 py-px font-mono text-[10px] font-semibold uppercase tracking-wider ${
                    unlocked
                      ? "border-emerald-500/40 text-emerald-400"
                      : "border-white/[0.08] text-zinc-500"
                  } ${stamping ? "meme-trophy-stamp-label" : ""}`}
                >
                  {unlocked ? "Unlocked" : "Locked"}
                </span>
              </div>
              <p className="mt-1.5 break-words font-sans text-xs leading-relaxed text-zinc-400">
                {ach.description}
              </p>
              {!unlocked && (
                <p className="mt-2 break-words font-sans text-[11px] leading-relaxed text-amber-400/90">
                  Hint: {ach.hint}
                  {ach.hintLink && (
                    <>
                      {" "}
                      <Link
                        href={ach.hintLink.href}
                        className="underline underline-offset-2"
                      >
                        {ach.hintLink.label}
                      </Link>
                    </>
                  )}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
