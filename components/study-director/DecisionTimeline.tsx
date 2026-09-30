"use client";

import React from "react";
import type { StudyState } from "@/lib/study-director";
import { phaseSpans } from "./geometry";
import { decisionMarks, markCounts, type MarkKind } from "./closeout";

const WIDTH = 720;
const HEIGHT = 96;
const PAD_X = 12;
const BAND_Y = 14;
const BAND_H = 64;

const LANES: Record<MarkKind, number> = {
  documented: 26,
  undocumented: 42,
  audit: 58,
  lapsed: 72,
};

const COLOR: Record<MarkKind, string> = {
  documented: "#10b981",
  undocumented: "#f59e0b",
  audit: "#94a3b8",
  lapsed: "#f87171",
};

const LEGEND: Record<MarkKind, string> = {
  documented: "Documented",
  undocumented: "Not documented",
  audit: "Audit",
  lapsed: "Lapsed",
};

/**
 * The whole study on one strip: phases as bands, and one mark per call,
 * laned by whether it was documented, skipped, an audit, or left to lapse.
 */
export const DecisionTimeline: React.FC<{ state: StudyState }> = ({
  state,
}) => {
  const total = Math.max(state.day, state.setup.durationDays);
  const x = (day: number) =>
    PAD_X + ((day - 0.5) / total) * (WIDTH - PAD_X * 2);
  const marks = decisionMarks(state);
  const counts = markCounts(marks);
  const spans = phaseSpans(state.setup.durationDays);

  return (
    <figure className="min-w-0" data-testid="study-decision-timeline">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Decision timeline over ${total} days: ${counts.documented} documented, ${counts.undocumented} not documented, ${counts.audit} audits, ${counts.lapsed} left to lapse.`}
        className="block h-auto w-full"
      >
        {spans.map((span, i) => (
          <rect
            key={span.phase}
            x={x(span.start) - (WIDTH - PAD_X * 2) / total / 2}
            y={BAND_Y}
            width={((span.end - span.start + 1) / total) * (WIDTH - PAD_X * 2)}
            height={BAND_H}
            fill={i % 2 === 0 ? "rgba(255,255,255,0.025)" : "transparent"}
          />
        ))}
        {state.day > state.setup.durationDays ? (
          <rect
            x={
              x(state.setup.durationDays + 1) - (WIDTH - PAD_X * 2) / total / 2
            }
            y={BAND_Y}
            width={
              ((state.day - state.setup.durationDays) / total) *
              (WIDTH - PAD_X * 2)
            }
            height={BAND_H}
            fill="rgba(248,113,113,0.06)"
          />
        ) : null}
        {(Object.keys(LANES) as MarkKind[]).map((kind) => (
          <line
            key={kind}
            x1={PAD_X}
            x2={WIDTH - PAD_X}
            y1={LANES[kind]}
            y2={LANES[kind]}
            stroke="rgba(255,255,255,0.05)"
          />
        ))}
        {marks.map((mark, i) =>
          mark.kind === "lapsed" ? (
            <g key={`${mark.day}-${i}`} stroke={COLOR.lapsed} strokeWidth={1.5}>
              <line
                x1={x(mark.day) - 3}
                y1={LANES.lapsed - 3}
                x2={x(mark.day) + 3}
                y2={LANES.lapsed + 3}
              />
              <line
                x1={x(mark.day) - 3}
                y1={LANES.lapsed + 3}
                x2={x(mark.day) + 3}
                y2={LANES.lapsed - 3}
              />
            </g>
          ) : mark.kind === "audit" ? (
            <rect
              key={`${mark.day}-${i}`}
              x={x(mark.day) - 3}
              y={LANES.audit - 3}
              width={6}
              height={6}
              transform={`rotate(45 ${x(mark.day)} ${LANES.audit})`}
              fill={COLOR.audit}
            />
          ) : (
            <circle
              key={`${mark.day}-${i}`}
              cx={x(mark.day)}
              cy={LANES[mark.kind]}
              r={3.5}
              fill={mark.kind === "documented" ? COLOR.documented : "none"}
              stroke={COLOR[mark.kind]}
              strokeWidth={1.5}
            />
          )
        )}
        <text
          x={PAD_X}
          y={HEIGHT - 4}
          fontSize={10}
          fill="#a1a1aa"
          fontFamily="var(--font-geist-mono), monospace"
        >
          Day 1
        </text>
        <text
          x={WIDTH - PAD_X}
          y={HEIGHT - 4}
          fontSize={10}
          textAnchor="end"
          fill="#a1a1aa"
          fontFamily="var(--font-geist-mono), monospace"
        >
          Day {total}
        </text>
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-[var(--sd-muted)]">
        {(Object.keys(LEGEND) as MarkKind[]).map((kind) => (
          <span key={kind} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background:
                  kind === "undocumented" ? "transparent" : COLOR[kind],
                border: `1.5px solid ${COLOR[kind]}`,
              }}
            />
            {LEGEND[kind]} {counts[kind]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
};
