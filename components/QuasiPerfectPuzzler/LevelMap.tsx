"use client";

import React, { useMemo } from "react";
import type {
  GameProgressState,
  PuzzlerLevelDef,
} from "@/lib/quasi-perfect/types";
import { layoutLevelMap, levelMapBadge } from "./boardArt";

interface LevelMapProps {
  levels: PuzzlerLevelDef[];
  currentLevelIndex: number;
  progress: GameProgressState;
  onSelectLevel: (index: number) => void;
  /** Receives the current level's button, so the drawer can focus it. */
  currentButtonRef?: React.Ref<HTMLButtonElement>;
}

const CHAPTER_LABELS: Record<number, string> = {
  1: "Ch 1: Equational",
  2: "Ch 2: Logic",
  3: "Ch 3: Quasiperfect",
};

/**
 * The campaign as one trail: each chapter is a row of level stops, the rows
 * joined end to end, with the stars earned under each stop. Replaces the
 * L1–L18 button strip (#1519).
 */
export const LevelMap: React.FC<LevelMapProps> = ({
  levels,
  currentLevelIndex,
  progress,
  onSelectLevel,
  currentButtonRef,
}) => {
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
            const badge = levelMapBadge(progress.completedLevels?.[lvl.id]);
            const badgeId = `quasi-level-badge-${lvl.id}`;
            return (
              <li
                key={lvl.id}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                style={{ left: `${pos.x * 100}%`, top: pos.y }}
              >
                <button
                  ref={isCurrent ? currentButtonRef : undefined}
                  type="button"
                  onClick={() => onSelectLevel(pos.index)}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-describedby={badgeId}
                  title={lvl.title}
                  data-state={badge.state}
                  data-current={isCurrent ? "true" : undefined}
                  className="qp-map-node qp-focus min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums transition-colors hover:border-[color:var(--qp-accent)] active:scale-[0.98]"
                >
                  L{lvl.id}
                </button>
                <span
                  id={badgeId}
                  className={`mt-1 text-xs leading-none tracking-[0.08em] ${
                    badge.state === "admitted"
                      ? "text-rose-300"
                      : badge.state === "solved"
                        ? "text-amber-300"
                        : "text-zinc-400"
                  }`}
                >
                  <span aria-hidden="true">
                    {badge.state === "admitted"
                      ? "⚠"
                      : badge.state === "solved"
                        ? "★".repeat(badge.stars) + "☆".repeat(3 - badge.stars)
                        : "☆☆☆"}
                  </span>
                  <span className="sr-only">{badge.description}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};
