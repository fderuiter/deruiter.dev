"use client";

import { useCallback, useId, useState } from "react";
import { useResizeObserver } from "@/hooks/useResizeObserver";
import { clamp } from "@/lib/game-utils";
import type { TlfKmCurve, TlfKmFigure } from "@/lib/study-data";

/**
 * Line colours and dash patterns per treatment group. Colours are the
 * dark-surface steps of the categorical palette `writeKmFigureSvg` uses, so
 * the page and the downloaded figure match; dashes keep groups apart without
 * colour.
 */
const SERIES = [
  { colour: "#3987e5", dash: "" },
  { colour: "#d95926", dash: "8 4" },
  { colour: "#199e70", dash: "2 4" },
  { colour: "#c98500", dash: "12 4 2 4" },
] as const;

/** Width drawn before the figure's container has been measured. */
const DEFAULT_WIDTH = 720;
const MIN_WIDTH = 280;
const MAX_WIDTH = 896;
const LEFT = 56;
const TOP = 16;

function series(index: number) {
  return SERIES[index % SERIES.length];
}

function stepPath(
  curve: TlfKmCurve,
  x: (time: number) => number,
  y: (survival: number) => number
): string {
  if (curve.points.length === 0) return "";
  const parts = [`M${x(0).toFixed(1)} ${y(1).toFixed(1)}`];
  for (const point of curve.points) {
    if (point.time === 0 || point.events === 0) continue;
    parts.push(
      `H${x(point.time).toFixed(1)}`,
      `V${y(point.survival).toFixed(1)}`
    );
  }
  const last = curve.points[curve.points.length - 1];
  parts.push(`H${x(last.time).toFixed(1)}`);
  return parts.join(" ");
}

function bandPath(
  curve: TlfKmCurve,
  x: (time: number) => number,
  y: (survival: number) => number
): string {
  return curve.points
    .map((point, index) => {
      const next = curve.points[index + 1];
      if (point.lower === null || point.upper === null || !next) return "";
      return `M${x(point.time).toFixed(1)} ${y(point.upper).toFixed(1)} H${x(next.time).toFixed(1)} V${y(point.lower).toFixed(1)} H${x(point.time).toFixed(1)} Z`;
    })
    .join(" ");
}

/**
 * The Kaplan-Meier figure drawn from its render model: step curves with
 * Greenwood log-log 95% bands, censoring ticks and a legend. It is an image
 * with a text alternative; the number-at-risk table and the plotted values
 * beside it carry the same numbers as data.
 *
 * The drawing is laid out for the width of its container rather than scaled
 * down from a fixed one, so axis labels stay at their set size on a phone.
 */
export function KmFigure({ figure }: { figure: TlfKmFigure }) {
  const titleId = useId();
  const descId = useId();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const onResize = useCallback((entry: ResizeObserverEntry) => {
    setWidth(clamp(Math.floor(entry.contentRect.width), MIN_WIDTH, MAX_WIDTH));
  }, []);
  const containerRef = useResizeObserver<HTMLDivElement>(onResize);
  const WIDTH = width;
  // At least tall enough for the rotated y-axis label to fit the plot.
  const HEIGHT = Math.round(clamp(width * 0.52, 330, 400));
  const RIGHT = WIDTH - 16;
  const BOTTOM = HEIGHT - 44;
  const lastTime = Math.max(
    7,
    ...figure.curves.flatMap((curve) => curve.points.map((p) => p.time)),
    ...figure.atRiskTimes.map((day) => day.time)
  );
  const xMax = Math.ceil(lastTime / 14) * 14;
  const x = (time: number) => LEFT + (time / xMax) * (RIGHT - LEFT);
  const y = (survival: number) => BOTTOM - survival * (BOTTOM - TOP);
  // One label per two weeks, or per four where two-week labels would touch.
  const tickStep = (RIGHT - LEFT) / (xMax / 14) < 36 ? 28 : 14;
  const xTicks = Array.from(
    { length: Math.floor(xMax / tickStep) + 1 },
    (_, index) => index * tickStep
  );
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <figure className="min-w-0">
      <ul
        className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-200"
        aria-label="Legend"
      >
        {figure.curves.map((curve, index) => (
          <li key={curve.id} className="flex items-center gap-2">
            <svg width="28" height="8" aria-hidden="true" focusable="false">
              <path
                d="M0 4 H28"
                stroke={series(index).colour}
                strokeWidth="2"
                strokeDasharray={series(index).dash || undefined}
              />
            </svg>
            {curve.label} (N={curve.bigN})
          </li>
        ))}
      </ul>
      <div ref={containerRef} className="w-full min-w-0 max-w-4xl">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full"
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
        >
          <title id={titleId}>
            {`Figure ${figure.number}: ${figure.title} (${figure.population})`}
          </title>
          <desc id={descId}>{figure.summary}</desc>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={LEFT}
                x2={RIGHT}
                y1={y(tick)}
                y2={y(tick)}
                stroke="rgba(255,255,255,0.08)"
              />
              <text
                x={LEFT - 8}
                y={y(tick) + 4}
                textAnchor="end"
                fontSize="11"
                fill="#94a3b8"
                className="tabular-nums"
              >
                {tick.toFixed(2)}
              </text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <text
              key={tick}
              x={x(tick)}
              y={BOTTOM + 16}
              textAnchor="middle"
              fontSize="11"
              fill="#94a3b8"
              className="tabular-nums"
            >
              {tick}
            </text>
          ))}
          <line x1={LEFT} x2={RIGHT} y1={BOTTOM} y2={BOTTOM} stroke="#64748b" />
          <line x1={LEFT} x2={LEFT} y1={TOP} y2={BOTTOM} stroke="#64748b" />
          <text
            x={(LEFT + RIGHT) / 2}
            y={HEIGHT - 6}
            textAnchor="middle"
            fontSize="12"
            fill="#cbd5e1"
          >
            {figure.xLabel}
          </text>
          <text
            x={14}
            y={(TOP + BOTTOM) / 2}
            textAnchor="middle"
            fontSize="11"
            fill="#cbd5e1"
            transform={`rotate(-90 14 ${(TOP + BOTTOM) / 2})`}
          >
            {figure.yLabel}
          </text>
          {figure.curves.map((curve, index) => (
            <path
              key={`${curve.id}-band`}
              d={bandPath(curve, x, y)}
              fill={series(index).colour}
              fillOpacity="0.12"
            />
          ))}
          {figure.curves.map((curve, index) => (
            <g key={curve.id}>
              <path
                d={stepPath(curve, x, y)}
                fill="none"
                stroke={series(index).colour}
                strokeWidth="2"
                strokeDasharray={series(index).dash || undefined}
              />
              {curve.points
                .filter((point) => point.censored > 0)
                .map((point) => (
                  <path
                    key={point.time}
                    d={`M${x(point.time).toFixed(1)} ${(y(point.survival) - 4).toFixed(1)} v8`}
                    stroke={series(index).colour}
                    strokeWidth="1.5"
                  />
                ))}
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="mt-2 text-xs leading-relaxed text-slate-400">
        Shaded bands are 95% confidence limits; ticks mark censored subjects.
      </figcaption>
    </figure>
  );
}
