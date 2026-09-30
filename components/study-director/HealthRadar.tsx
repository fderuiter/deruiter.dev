"use client";

import React from "react";
import { METER_IDS, type MeterId, type Meters } from "@/lib/study-director";
import { METER_LABELS } from "./labels";
import { radarPoints } from "./geometry";

const SHORT: Record<MeterId, string> = {
  integrity: "Integrity",
  compliance: "Compliance",
  timeline: "Timeline",
  budget: "Budget",
  client: "Client",
  team: "Team",
};

const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS = 76;
/** Side room for the axis labels. */
const PAD = 46;

const toPath = (points: Array<[number, number]>): string =>
  points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/**
 * The six study meters as a hexagon. The dashed outline is where the
 * meters stood at the start of today, so a decision's pull is visible.
 */
export const HealthRadar: React.FC<{
  meters: Meters;
  baseline?: Meters | null;
}> = ({ meters, baseline }) => {
  const values = METER_IDS.map((id) => meters[id]);
  const rings = [35, 65, 100];
  const axes = radarPoints(
    METER_IDS.map(() => 100),
    CENTER,
    RADIUS
  );
  const labels = radarPoints(
    METER_IDS.map(() => 100),
    CENTER,
    RADIUS + 18
  );
  const weakest = METER_IDS.reduce((low, id) =>
    meters[id] < meters[low] ? id : low
  );
  const summary = METER_IDS.map((id) => `${METER_LABELS[id]} ${meters[id]}`)
    .join(", ")
    .concat(`. Weakest: ${METER_LABELS[weakest]}.`);

  return (
    <svg
      viewBox={`${-PAD} 0 ${SIZE + PAD * 2} ${SIZE}`}
      role="img"
      aria-label={`Study health. ${summary}`}
      className="mx-auto block h-auto w-full max-w-[300px]"
      data-testid="study-health-radar"
    >
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={toPath(
            radarPoints(
              METER_IDS.map(() => ring),
              CENTER,
              RADIUS
            )
          )}
          fill={ring === 35 ? "rgba(248,113,113,0.07)" : "none"}
          stroke="rgba(255,255,255,0.09)"
          strokeWidth={1}
        />
      ))}
      {axes.map(([x, y], i) => (
        <line
          key={METER_IDS[i]}
          x1={CENTER}
          y1={CENTER}
          x2={x}
          y2={y}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={1}
        />
      ))}
      {baseline ? (
        <polygon
          points={toPath(
            radarPoints(
              METER_IDS.map((id) => baseline[id]),
              CENTER,
              RADIUS
            )
          )}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={1}
          strokeDasharray="3 3"
          data-testid="study-health-baseline"
        />
      ) : null}
      <polygon
        points={toPath(radarPoints(values, CENTER, RADIUS))}
        fill="rgba(245,158,11,0.16)"
        stroke="#f59e0b"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {radarPoints(values, CENTER, RADIUS).map(([x, y], i) => (
        <circle
          key={METER_IDS[i]}
          cx={x}
          cy={y}
          r={2.5}
          fill={values[i] < 35 ? "#f87171" : "#f59e0b"}
        />
      ))}
      {labels.map(([x, y], i) => (
        <text
          key={METER_IDS[i]}
          x={x}
          y={y}
          textAnchor={
            Math.abs(x - CENTER) < 4 ? "middle" : x > CENTER ? "start" : "end"
          }
          dominantBaseline="middle"
          fontSize={11.5}
          fontFamily="var(--font-geist-mono), monospace"
          fill={values[i] < 35 ? "#f87171" : "#a1a1aa"}
        >
          {SHORT[METER_IDS[i]]}
        </text>
      ))}
    </svg>
  );
};
