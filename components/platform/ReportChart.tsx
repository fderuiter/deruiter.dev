"use client";

import {
  useCallback,
  useId,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useResizeObserver } from "@/hooks/useResizeObserver";
import { clamp } from "@/lib/game-utils";
import type { ReportData, ReportScale } from "@/lib/clinical-platform";

/**
 * Series colours, in fixed order, and dash patterns for lines. The colours
 * are the categorical palette `KmFigure` uses, which passes the palette
 * checks (lightness, chroma, colour-vision separation, 3:1 contrast) on the
 * site's dark surface; dashes and labels keep series apart without colour.
 */
const SERIES = [
  { colour: "#3987e5", dash: "" },
  { colour: "#d95926", dash: "8 4" },
  { colour: "#199e70", dash: "2 4" },
  { colour: "#c98500", dash: "12 4 2 4" },
] as const;

/** Width drawn before the chart's container has been measured. */
const DEFAULT_WIDTH = 720;
const MIN_WIDTH = 280;
const MAX_WIDTH = 896;

function series(index: number) {
  return SERIES[index % SERIES.length];
}

function fraction(scale: ReportScale, value: number): number {
  return scale.max === scale.min
    ? 0
    : (value - scale.min) / (scale.max - scale.min);
}

/** Moves the active point with the arrow, Home and End keys. */
function nextIndex(key: string, current: number | null, count: number) {
  const at = current ?? -1;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return Math.min(count - 1, at + 1);
    case "ArrowLeft":
    case "ArrowUp":
      return Math.max(0, at < 0 ? 0 : at - 1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

function Legend({ report, line }: { report: ReportData; line: boolean }) {
  if (report.columns.length < 2) return null;
  return (
    <ul
      className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-200"
      aria-label="Legend"
    >
      {report.columns.map((column, index) => (
        <li key={column.metricId} className="flex items-center gap-2">
          <svg width="20" height="10" aria-hidden="true" focusable="false">
            {line ? (
              <path
                d="M0 5 H20"
                stroke={series(index).colour}
                strokeWidth="2"
                strokeDasharray={series(index).dash || undefined}
              />
            ) : (
              <rect width="20" height="10" rx="2" fill={series(index).colour} />
            )}
          </svg>
          {column.name}
        </li>
      ))}
    </ul>
  );
}

/** The readout of one group: its label, then every series' value. */
function Readout({ report, index }: { report: ReportData; index: number }) {
  const row = report.rows[index];
  return (
    <>
      <p className="font-mono text-[11px] text-slate-400">
        {row.labels.join(" · ")}
      </p>
      <ul className="mt-1 space-y-0.5">
        {row.cells.map((cell, column) => (
          <li
            key={report.columns[column].metricId}
            className="flex items-center gap-2"
          >
            <svg width="12" height="4" aria-hidden="true" focusable="false">
              <path
                d="M0 2 H12"
                stroke={series(column).colour}
                strokeWidth="2"
              />
            </svg>
            <strong className="font-semibold tabular-nums text-[#f4f4f6]">
              {cell.text}
            </strong>
            <span className="text-slate-400">
              {report.columns[column].name}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function readoutText(report: ReportData, index: number): string {
  const row = report.rows[index];
  return `${row.labels.join(", ")}: ${row.cells
    .map((cell, column) => `${report.columns[column].name} ${cell.text}`)
    .join("; ")}.`;
}

/**
 * Keyboard and pointer state shared by the bar and line charts: one
 * active group, moved by hovering or by the arrow keys, with keyboard moves
 * announced through a polite live region.
 */
function useActiveGroup(report: ReportData) {
  const [active, setActive] = useState<number | null>(null);
  const [announced, setAnnounced] = useState("");
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "Escape") {
        setActive(null);
        return;
      }
      const next = nextIndex(event.key, active, report.rows.length);
      if (next === null) return;
      event.preventDefault();
      setActive(next);
      setAnnounced(readoutText(report, next));
    },
    [active, report]
  );
  return { active, setActive, announced, onKeyDown };
}

const KEYS_HINT = "Use the arrow keys to read each value.";

function BarChart({ report, label }: { report: ReportData; label: string }) {
  const scale = report.scale!;
  const zero = fraction(scale, 0);
  const { active, setActive, announced, onKeyDown } = useActiveGroup(report);
  return (
    <div
      role="group"
      tabIndex={0}
      aria-label={`${label}. ${KEYS_HINT}`}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
      className="min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
    >
      <div aria-hidden="true">
        <div className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] gap-x-3">
          <span />
          <div className="relative h-5 border-b border-white/[0.08]">
            {scale.ticks.map((tick) => (
              <span
                key={tick.value}
                className="absolute bottom-1 -translate-x-1/2 font-mono text-[10px] tabular-nums text-slate-400 first:translate-x-0 last:-translate-x-full"
                style={{ left: `${fraction(scale, tick.value) * 100}%` }}
              >
                {tick.text}
              </span>
            ))}
          </div>
        </div>
        <ul className="mt-1">
          {report.rows.map((row, index) => (
            <li
              key={row.key}
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() => setActive(null)}
              className={`relative grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] items-center gap-x-3 py-1.5 ${
                active === index ? "bg-white/[0.04]" : ""
              }`}
            >
              <span className="truncate font-mono text-xs text-slate-300">
                {row.labels.join(" · ")}
              </span>
              <div className="relative min-w-0 space-y-0.5">
                {scale.ticks.map((tick) => (
                  <span
                    key={tick.value}
                    className="absolute inset-y-0 w-px bg-white/[0.06]"
                    style={{ left: `${fraction(scale, tick.value) * 100}%` }}
                  />
                ))}
                {row.cells.map((cell, column) => {
                  const end =
                    cell.value === null ? zero : fraction(scale, cell.value);
                  const left = Math.min(zero, end);
                  return (
                    <div
                      key={report.columns[column].metricId}
                      className="relative flex h-3 items-center"
                    >
                      <span
                        className="absolute h-3 rounded-r-[4px]"
                        style={{
                          left: `${left * 100}%`,
                          width: `${Math.abs(end - zero) * 100}%`,
                          backgroundColor: series(column).colour,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              {active === index && (
                <div className="pointer-events-none absolute right-0 top-full z-10 mt-1 border border-white/[0.12] bg-[#13151a] px-3 py-2 text-xs shadow-lg">
                  <Readout report={report} index={index} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p className="sr-only" aria-live="polite">
        {announced}
      </p>
    </div>
  );
}

const LEFT = 56;
const TOP = 12;
const RIGHT_PAD = 16;

function LineChart({ report, label }: { report: ReportData; label: string }) {
  const scale = report.scale!;
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const onResize = useCallback((entry: ResizeObserverEntry) => {
    setWidth(clamp(Math.floor(entry.contentRect.width), MIN_WIDTH, MAX_WIDTH));
  }, []);
  const containerRef = useResizeObserver<HTMLDivElement>(onResize);
  const { active, setActive, announced, onKeyDown } = useActiveGroup(report);
  const height = Math.round(clamp(width * 0.42, 220, 320));
  const right = width - RIGHT_PAD;
  const bottom = height - 28;
  const count = report.rows.length;
  const x = (index: number) =>
    count === 1
      ? (LEFT + right) / 2
      : LEFT + (index / (count - 1)) * (right - LEFT);
  const y = (value: number) => bottom - fraction(scale, value) * (bottom - TOP);
  // One x label per group, or every nth where labels would touch.
  const labelEvery = Math.max(1, Math.ceil((count * 56) / (right - LEFT)));
  const paths = report.columns.map((_, column) => {
    let path = "";
    let pen = false;
    report.rows.forEach((row, index) => {
      const value = row.cells[column].value;
      if (value === null) {
        pen = false;
        return;
      }
      path += `${pen ? "L" : "M"}${x(index).toFixed(1)} ${y(value).toFixed(1)} `;
      pen = true;
    });
    return path.trim();
  });
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0) return;
    const at = ((event.clientX - box.left) / box.width) * width;
    const index =
      count === 1
        ? 0
        : Math.round(((at - LEFT) / (right - LEFT)) * (count - 1));
    setActive(clamp(index, 0, count - 1));
  };
  return (
    <div
      role="group"
      tabIndex={0}
      aria-label={`${label}. ${KEYS_HINT}`}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
      className="relative min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
    >
      <div
        ref={containerRef}
        className="w-full min-w-0 max-w-4xl"
        aria-hidden="true"
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full touch-pan-y"
          focusable="false"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
        >
          {scale.ticks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={LEFT}
                x2={right}
                y1={y(tick.value)}
                y2={y(tick.value)}
                stroke="rgba(255,255,255,0.08)"
              />
              <text
                x={LEFT - 8}
                y={y(tick.value) + 4}
                textAnchor="end"
                fontSize="11"
                fill="#94a3b8"
                className="tabular-nums"
              >
                {tick.text}
              </text>
            </g>
          ))}
          {report.rows.map((row, index) =>
            index % labelEvery === 0 ? (
              <text
                key={row.key}
                x={x(index)}
                y={bottom + 18}
                textAnchor="middle"
                fontSize="11"
                fill="#94a3b8"
                className="tabular-nums"
              >
                {row.labels.join(" · ")}
              </text>
            ) : null
          )}
          <line x1={LEFT} x2={right} y1={bottom} y2={bottom} stroke="#64748b" />
          {active !== null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={TOP}
              y2={bottom}
              stroke="#94a3b8"
              strokeWidth="1"
            />
          )}
          {paths.map((path, column) => (
            <path
              key={report.columns[column].metricId}
              d={path}
              fill="none"
              stroke={series(column).colour}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeDasharray={series(column).dash || undefined}
            />
          ))}
          {active !== null &&
            report.rows[active].cells.map((cell, column) =>
              cell.value === null ? null : (
                <circle
                  key={report.columns[column].metricId}
                  cx={x(active)}
                  cy={y(cell.value)}
                  r="4"
                  fill={series(column).colour}
                  stroke="#13151a"
                  strokeWidth="2"
                />
              )
            )}
        </svg>
      </div>
      {active !== null && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 z-10 border border-white/[0.12] bg-[#13151a] px-3 py-2 text-xs shadow-lg"
          style={
            x(active) > width / 2
              ? { right: `${((width - x(active)) / width) * 100 + 2}%` }
              : { left: `${(x(active) / width) * 100 + 2}%` }
          }
        >
          <Readout report={report} index={active} />
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {announced}
      </p>
    </div>
  );
}

function StatTiles({ report }: { report: ReportData }) {
  const row = report.rows[0];
  return (
    <dl className="grid gap-3 @sm:grid-cols-2 @3xl:grid-cols-4">
      {report.columns.map((column, index) => (
        <div
          key={column.metricId}
          className="border border-white/[0.08] bg-[#13151a] p-4"
        >
          <dt className="text-xs text-slate-400">{column.name}</dt>
          <dd className="mt-2 font-mono text-3xl tabular-nums text-[#f4f4f6]">
            {row ? row.cells[index].text : "No rows"}
          </dd>
          <dd className="mt-1 text-xs text-slate-400">{column.unit}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The chart of a report: grouped bars, lines over months or stat tiles,
 * from the report's render model. Bars and lines take keyboard focus and
 * read each group's values aloud with the arrow keys; every value is also
 * in the report's table.
 */
export function ReportChart({ report }: { report: ReportData }) {
  const titleId = useId();
  const visual = report.spec.visual;
  if (visual === "table") return null;
  if (visual === "stat") return <StatTiles report={report} />;
  if (report.rows.length === 0 || report.scale === null) {
    return <p className="text-sm text-slate-400">No rows to chart.</p>;
  }
  const label = `${visual === "bar" ? "Bar" : "Line"} chart of ${report.columns
    .map((column) => column.name)
    .join(
      " and "
    )} by ${report.dimensionLabels.join(" and ").toLowerCase()}, in ${report.columns[0].unit}`;
  return (
    <figure className="min-w-0" aria-labelledby={titleId}>
      <figcaption id={titleId} className="sr-only">
        {label}
      </figcaption>
      <Legend report={report} line={visual === "line"} />
      {visual === "bar" ? (
        <BarChart report={report} label={label} />
      ) : (
        <LineChart report={report} label={label} />
      )}
    </figure>
  );
}
