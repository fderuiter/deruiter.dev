"use client";

import React, { useMemo } from "react";
import type {
  GameProgressState,
  PuzzlerLevelDef,
} from "@/lib/quasi-perfect/types";
import {
  areVariantsUnlocked,
  getLevelPar,
  getLevelVariants,
  isLevelGolfed,
  isVariantCleared,
} from "@/lib/quasi-perfect";
import { IconGolf, IconLock } from "@tabler/icons-react";
import { layoutLevelMap, levelMapBadge } from "./boardArt";

interface LevelMapProps {
  levels: PuzzlerLevelDef[];
  currentLevelIndex: number;
  progress: GameProgressState;
  onSelectLevel: (index: number) => void;
  /** Receives the current level's button, so the drawer can focus it. */
  currentButtonRef?: React.Ref<HTMLButtonElement>;
  /** Whether a level is locked (Act 2 before the capstone, #2091). */
  isLevelLocked?: (level: PuzzlerLevelDef) => boolean;
  /** Why locked levels are locked, shown once above the map. */
  lockedMessage?: string;
  /** Called instead of `onSelectLevel` when a locked level is pressed. */
  onLockedSelect?: (level: PuzzlerLevelDef) => void;
}

const CHAPTER_LABELS: Record<number, string> = {
  1: "Ch 1: Equational",
  2: "Ch 2: Logic",
  3: "Ch 3: Quasiperfect",
  4: "Ch 4: Quantifiers",
  5: "Ch 5: Induction",
  6: "Ch 6: Chains",
  7: "Ch 7: Almost Perfect",
};

/**
 * The campaign as one trail: each chapter is a row of level stops, the rows
 * joined end to end, with the stars earned under each stop and a flag for a
 * level golfed at or under its step par (#2059), and a "V cleared/total"
 * count of challenge variants once they unlock (#2090). Replaces the L1–L18 button
 * strip (#1519).
 */
export const LevelMap: React.FC<LevelMapProps> = ({
  levels,
  currentLevelIndex,
  progress,
  onSelectLevel,
  currentButtonRef,
  isLevelLocked,
  lockedMessage,
  onLockedSelect,
}) => {
  const anyLocked = !!isLevelLocked && levels.some((lvl) => isLevelLocked(lvl));
  const chapters = useMemo(() => {
    const order: number[] = [];
    const sizes = new Map<number, number>();
    for (const lvl of levels) {
      if (!sizes.has(lvl.chapter)) order.push(lvl.chapter);
      sizes.set(lvl.chapter, (sizes.get(lvl.chapter) ?? 0) + 1);
    }
    return order.map((chapter) => ({
      chapter,
      size: sizes.get(chapter) ?? 0,
      title: levels.find((l) => l.chapter === chapter)?.chapterTitle ?? "",
    }));
  }, [levels]);

  const layout = useMemo(
    () => layoutLevelMap(chapters.map((c) => c.size)),
    [chapters]
  );

  let firstLevelInRow = 0;
  const rowRanges = chapters.map((c) => {
    const start = firstLevelInRow;
    firstLevelInRow += c.size;
    return { start, end: firstLevelInRow - 1 };
  });

  return (
    <>
      {anyLocked && lockedMessage && (
        <p
          data-testid="level-map-locked-note"
          className="mb-2 flex items-center gap-1.5 text-[11px] text-zinc-400 break-words"
        >
          <IconLock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span>{lockedMessage}</span>
        </p>
      )}
      <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-x-3">
        {/* Chapter captions, one per row */}
        <div className="relative" style={{ height: layout.height }}>
          {chapters.map((c, row) => (
            <div
              key={c.chapter}
              data-testid={`level-map-chapter-${c.chapter}`}
              className="absolute inset-x-0 -translate-y-1/2 min-w-0"
              style={{ top: layout.rowY[row] }}
            >
              <p className="qp-text-accent-strong text-[11px] font-bold">
                {CHAPTER_LABELS[c.chapter] ?? `Ch ${c.chapter}`}
              </p>
              <p className="text-[10px] text-zinc-400 break-words">
                {c.title}{" "}
                <span className="tabular-nums">
                  · L{rowRanges[row].start + 1}–{rowRanges[row].end + 1}
                </span>
              </p>
            </div>
          ))}
        </div>

        {/* The trail */}
        <div className="relative min-w-0" style={{ height: layout.height }}>
          <svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 1000 ${layout.height}`}
            preserveAspectRatio="none"
          >
            <path
              d={layout.path}
              fill="none"
              stroke="#94a3b8"
              strokeOpacity={0.35}
              strokeWidth={2}
              strokeDasharray="6 6"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <ol className="m-0 list-none p-0">
            {layout.nodes.map((pos) => {
              const lvl = levels[pos.index];
              if (!lvl) return null;
              const isCurrent = pos.index === currentLevelIndex;
              const saved = progress.completedLevels?.[lvl.id];
              const badge = levelMapBadge(saved);
              const golfed = isLevelGolfed(saved);
              const par = getLevelPar(lvl);
              const badgeId = `quasi-level-badge-${lvl.id}`;
              const locked = isLevelLocked?.(lvl) === true;
              // Cleared challenge variants (#2090), shown once they unlock.
              const variants = areVariantsUnlocked(progress, lvl.id)
                ? getLevelVariants(lvl)
                : [];
              const variantsCleared = variants.filter((v) =>
                isVariantCleared(progress, lvl.id, v.kind)
              ).length;
              return (
                <li
                  key={lvl.id}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                  style={{ left: `${pos.x * 100}%`, top: pos.y }}
                >
                  <button
                    ref={isCurrent ? currentButtonRef : undefined}
                    type="button"
                    onClick={() =>
                      locked ? onLockedSelect?.(lvl) : onSelectLevel(pos.index)
                    }
                    aria-current={isCurrent ? "step" : undefined}
                    aria-describedby={badgeId}
                    aria-disabled={locked ? "true" : undefined}
                    title={
                      locked
                        ? `${lvl.title} · locked`
                        : par !== null
                          ? `${lvl.title} · par ${par}`
                          : lvl.title
                    }
                    data-state={locked ? "locked" : badge.state}
                    data-current={isCurrent ? "true" : undefined}
                    className="qp-map-node qp-focus min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums transition-colors hover:border-[color:var(--qp-accent)] active:scale-[0.98]"
                  >
                    L{lvl.id}
                  </button>
                  <span
                    id={badgeId}
                    data-golfed={golfed ? "true" : undefined}
                    className={`mt-1 flex items-center gap-0.5 text-xs leading-none tracking-[0.08em] ${
                      badge.state === "admitted"
                        ? "text-rose-300"
                        : badge.state === "solved"
                          ? "text-amber-300"
                          : "text-zinc-400"
                    }`}
                  >
                    <span aria-hidden="true">
                      {locked ? (
                        <IconLock className="h-3 w-3" />
                      ) : badge.state === "admitted" ? (
                        "⚠"
                      ) : badge.state === "solved" ? (
                        "★".repeat(badge.stars) + "☆".repeat(3 - badge.stars)
                      ) : (
                        "☆☆☆"
                      )}
                    </span>
                    {golfed && (
                      <IconGolf
                        aria-hidden="true"
                        data-testid={`quasi-level-golfed-${lvl.id}`}
                        className="h-3 w-3 text-emerald-300"
                      />
                    )}
                    {variants.length > 0 && (
                      <span
                        aria-hidden="true"
                        data-testid={`quasi-level-variants-${lvl.id}`}
                        className={`ml-0.5 text-[10px] leading-none tabular-nums ${
                          variantsCleared === variants.length
                            ? "text-emerald-300"
                            : "text-zinc-400"
                        }`}
                      >
                        V{variantsCleared}/{variants.length}
                      </span>
                    )}
                    <span className="sr-only">
                      {locked
                        ? "Locked until the Act 1 capstone is proved"
                        : badge.description}
                      {golfed ? ", Golfed at or under par" : ""}
                      {variants.length > 0
                        ? `, ${variantsCleared} of ${variants.length} challenge variants cleared`
                        : ""}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </>
  );
};
