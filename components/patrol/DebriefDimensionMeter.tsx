"use client";

import React from "react";
import type { DebriefDimension, DimensionScore } from "@/lib/patrol";
import { clamp } from "@/lib/game-utils";

/**
 * Props for the DebriefDimensionMeter component.
 */
interface DebriefDimensionMeterProps {
  /** The dimension key this meter represents, used only for the test id. */
  dimension: DebriefDimension;
  /** The scored dimension result to render. */
  dimensionScore: DimensionScore;
}

/**
 * Rating-to-style lookup. Color is always paired with the numeric score and
 * a text rating label so status is never conveyed by color alone (AGENTS.md
 * Section 10 / WCAG 2.1 AA).
 */
const RATING_STYLES: Record<
  DimensionScore["rating"],
  { bar: string; text: string; badgeLabel: string }
> = {
  exemplary: {
    bar: "bg-emerald-500",
    text: "text-emerald-400",
    badgeLabel: "Exemplary",
  },
  proficient: {
    bar: "bg-brand-cyan",
    text: "text-brand-cyan",
    badgeLabel: "Proficient",
  },
  developing: {
    bar: "bg-amber-500",
    text: "text-amber-400",
    badgeLabel: "Developing",
  },
  "needs-attention": {
    bar: "bg-red-500",
    text: "text-red-400",
    badgeLabel: "Needs Attention",
  },
};

/**
 * Single accessible segmented meter for one debrief dimension: a labeled
 * progress bar paired with a numeric score and text rating (never color
 * alone), plus the dimension's one-line feedback.
 */
export const DebriefDimensionMeter: React.FC<DebriefDimensionMeterProps> = ({
  dimension,
  dimensionScore,
}) => {
  const styles = RATING_STYLES[dimensionScore.rating];
  const percent = clamp(Math.round((dimensionScore.score / 10) * 100), 0, 100);

  return (
    <div
      className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2"
      data-testid={`dimension-meter-${dimension}`}
    >
      <div className="flex items-center justify-between text-xs font-mono gap-2">
        <span className="text-zinc-300 font-bold truncate min-w-0">
          {dimensionScore.label}
        </span>
        <span className={`font-bold shrink-0 ${styles.text}`}>
          {dimensionScore.score}/10 &bull; {styles.badgeLabel}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={dimensionScore.score}
        aria-valuemin={0}
        aria-valuemax={10}
        aria-label={`${dimensionScore.label} score: ${dimensionScore.score} out of 10, ${styles.badgeLabel}`}
        className="w-full bg-zinc-900 rounded-full h-2.5 overflow-hidden border border-zinc-800"
      >
        <div
          className={`h-full ${styles.bar} transition-all`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-[11px] font-sans text-zinc-400 leading-relaxed">
        {dimensionScore.feedback}
      </p>
    </div>
  );
};
