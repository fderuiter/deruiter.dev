"use client";

import React from "react";
import { SubGoal } from "@/lib/quasi-perfect/types";
import { IconCheck, IconCircleDot, IconGitBranch } from "@tabler/icons-react";

interface MultiGoalTabsProps {
  subgoals: SubGoal[];
  activeGoalIndex: number;
  onSelectGoal: (index: number) => void;
}

export const MultiGoalTabs: React.FC<MultiGoalTabsProps> = ({
  subgoals,
  activeGoalIndex,
  onSelectGoal,
}) => {
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  if (subgoals.length <= 1) return null;

  const completedCount = subgoals.filter((g) => g.isCompleted).length;

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) => {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % subgoals.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + subgoals.length) % subgoals.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = subgoals.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    onSelectGoal(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  };

  const forked = subgoals.length <= 4;

  return (
    <div className="rounded-xl border border-[color:var(--qp-hairline)] bg-[color:var(--qp-panel)] p-3 font-mono">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-100">
          <IconGitBranch className="w-4 h-4 qp-text-accent" />
          <span>
            Active Proof Branches ({completedCount}/{subgoals.length} closed)
          </span>
        </div>
        <span className="text-[10px] text-zinc-400">
          Discharge all subgoals to complete theorem
        </span>
      </div>

      <div className="relative">
        {/* The split: one goal forking into its branches */}
        {forked && (
          <svg
            aria-hidden="true"
            className="block h-5 w-full"
            viewBox="0 0 100 20"
            preserveAspectRatio="none"
          >
            {subgoals.map((sg, idx) => {
              const x = ((idx + 0.5) / subgoals.length) * 100;
              return (
                <path
                  key={sg.id}
                  className="qp-edge"
                  d={`M 50 0 C 50 10, ${x} 8, ${x} 20`}
                  fill="none"
                  stroke={sg.isCompleted ? "#10b981" : "#94a3b8"}
                  strokeOpacity={sg.isCompleted ? 0.8 : 0.45}
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>
        )}

        <div
          className={forked ? "grid gap-2" : "mt-2 flex flex-wrap gap-2"}
          style={
            forked
              ? {
                  gridTemplateColumns: `repeat(${subgoals.length}, minmax(0, 1fr))`,
                }
              : undefined
          }
          role="tablist"
          aria-label="Active Proof Subgoals"
        >
          {subgoals.map((sg, idx) => {
            const isActive = idx === activeGoalIndex;
            const isDone = sg.isCompleted;

            return (
              <button
                ref={(node) => {
                  tabRefs.current[idx] = node;
                }}
                key={sg.id}
                type="button"
                id={`subgoal-tab-${sg.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`subgoal-panel-${sg.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onSelectGoal(idx)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`qp-branch qp-focus flex min-w-0 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                  isActive
                    ? "border-[color:var(--qp-accent)] bg-[color:var(--qp-accent-soft)] text-zinc-100"
                    : isDone
                      ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-900/40"
                      : "border-[color:var(--qp-hairline)] bg-[color:var(--qp-raised)] text-zinc-300 hover:text-zinc-100"
                }`}
              >
                {isDone ? (
                  <IconCheck className="w-3.5 h-3.5 shrink-0 text-emerald-300" />
                ) : isActive ? (
                  <IconCircleDot className="w-3.5 h-3.5 shrink-0 qp-text-accent-strong" />
                ) : (
                  <span className="w-3.5 h-3.5 shrink-0 rounded-full border border-zinc-500 flex items-center justify-center text-[9px]">
                    {idx + 1}
                  </span>
                )}
                <span className="min-w-0 truncate">{sg.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
