"use client";

import React, { useMemo, useId } from "react";
import {
  mapDataToCoordinates,
  generateHermiteSplinePath,
} from "@/lib/graphics-math";
import type { GitHubStatsProvenance } from "@/lib/github";

interface CommitSparklineProps {
  activity: number[];
  className?: string;
  /**
   * Where the plotted series came from. Anything other than `live` is drawn
   * from generated numbers and is labelled as such, so an illustrative curve
   * is never mistaken for measured commit history.
   */
  provenance?: GitHubStatsProvenance;
}

export const CommitSparkline: React.FC<CommitSparklineProps> = ({
  activity,
  className,
  provenance = "live",
}) => {
  const isMeasured = provenance === "live";
  // Ensure we have exactly 52 data points (if less, default to baseline)
  const dataPoints = useMemo(() => {
    if (!activity || activity.length === 0) {
      return Array.from({ length: 52 }, () => 0);
    }
    return activity;
  }, [activity]);

  // Aggregate total commits in this 12-month period
  const totalCommits = useMemo(() => {
    return dataPoints.reduce((a, b) => a + b, 0);
  }, [dataPoints]);

  const maxVal = useMemo(() => Math.max(...dataPoints, 1), [dataPoints]);
  const minVal = useMemo(() => Math.min(...dataPoints, 0), [dataPoints]);

  // Generate SVG path coordinates utilizing the central graphics engine
  const { pathD, areaD } = useMemo(() => {
    const width = 300;
    const height = 60;
    const padding = 8;

    const points = mapDataToCoordinates(
      dataPoints,
      width,
      height,
      padding,
      minVal,
      maxVal
    );
    return generateHermiteSplinePath(points, height);
  }, [dataPoints, minVal, maxVal]);

  const id = useId();
  const uniqueId = useMemo(() => `sparkline-${id.replace(/:/g, "-")}`, [id]);

  return (
    <div className={`w-full relative select-none ${className || ""}`}>
      {/* Sparkline Title Metadata */}
      <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 mb-2">
        <span className="tracking-widest uppercase">
          Commit Activity (12 Months)
        </span>
        {isMeasured ? (
          <span className="text-accent font-bold">{totalCommits} Commits</span>
        ) : (
          <span
            className="text-slate-400 font-bold tracking-widest uppercase"
            title="GitHub commit statistics were unavailable; this timeline is illustrative."
          >
            Sample Data
          </span>
        )}
      </div>

      {/* SVG Canvas Sparkline Graph */}
      <div className="relative bg-zinc-950/40 border border-zinc-900/60 rounded-xl p-2.5 overflow-hidden flex items-center justify-center">
        {/* Glow ambient accent light */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-12 rounded-full bg-accent/5 blur-2xl pointer-events-none" />

        <svg
          viewBox="0 0 300 60"
          className="w-full h-[60px] overflow-visible relative z-10"
          role="img"
          aria-label={
            isMeasured
              ? `GitHub commit activity timeline over the last 12 months. Total commits: ${totalCommits}`
              : "Illustrative commit activity timeline. Live GitHub statistics were unavailable, so this curve is sample data and does not show real commit history."
          }
        >
          <defs>
            {/* Area gradient under the path */}
            <linearGradient id={`${uniqueId}-area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
            </linearGradient>

            {/* Timeline color stroke gradient */}
            <linearGradient
              id={`${uniqueId}-stroke`}
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>

          {/* Shaded Area */}
          <path
            d={areaD}
            fill={`url(#${uniqueId}-area)`}
            className="transition-all duration-300"
          />

          {/* Sparkline Neon Path */}
          <path
            d={pathD}
            fill="none"
            stroke={`url(#${uniqueId}-stroke)`}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="svg-glow-cyan transition-all duration-300"
          />
        </svg>
      </div>
    </div>
  );
};
