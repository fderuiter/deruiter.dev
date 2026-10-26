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
import type {
  PortfolioMilestone,
  PortfolioMilestoneStatus,
  PortfolioSwimlane,
} from "@/lib/clinical-platform";

/**
 * Status marks. The colours are the site's semantic status tokens, kept
 * for status alone; each status also has its own shape, so a lane reads
 * without colour.
 */
const MILESTONE_STATUS: Readonly<
  Record<
    PortfolioMilestoneStatus,
    { readonly label: string; readonly colour: string }
  >
> = {
  "on-time": { label: "On time or early", colour: "#10b981" },
  late: { label: "Reached late", colour: "#f59e0b" },
  overdue: { label: "Overdue", colour: "#f87171" },
  upcoming: { label: "Planned", colour: "#94a3b8" },
};

const STATUS_ORDER: readonly PortfolioMilestoneStatus[] = [
  "on-time",
  "late",
  "overdue",
  "upcoming",
];

const DEFAULT_WIDTH = 896;
const MIN_WIDTH = 220;
const MAX_WIDTH = 1152;
/** Width from which study labels sit beside their lane rather than above it. */
const SIDE_LABELS_FROM = 640;
const LABEL_WIDTH = 128;
/** Room above the lanes: the data cut label on one line, the years on the next. */
const AXIS_HEIGHT = 36;
const RIGHT_PAD = 10;
/** Room a year label takes to the right of its gridline. */
const YEAR_LABEL_WIDTH = 32;

const DAY_MS = 86_400_000;

function dayOf(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`) / DAY_MS;
}

/** A count with its noun, for example `1 day` or `8 studies`. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** How a milestone stands, in words, for the table, the readout and screen readers. */
export function milestoneStatusText(milestone: PortfolioMilestone): string {
  switch (milestone.status) {
    case "on-time": {
      const early = -(milestone.varianceDays ?? 0);
      return early > 0 ? `${plural(early, "day")} early` : "On plan";
    }
    case "late":
      return `${plural(milestone.varianceDays ?? 0, "day")} late`;
    case "overdue":
      return `${plural(milestone.overdueDays ?? 0, "day")} overdue`;
    case "upcoming":
      return "Planned";
  }
}

/** The date a milestone sits at: its actual date once reached, its plan before. */
function markDate(milestone: PortfolioMilestone): string {
  return milestone.actual ?? milestone.planned;
}

function readoutText(studyId: string, milestone: PortfolioMilestone): string {
  const when =
    milestone.actual === null
      ? `planned ${milestone.planned}`
      : `reached ${milestone.actual}, planned ${milestone.planned}`;
  return `${studyId}, ${milestone.label}: ${when}. ${milestoneStatusText(milestone)}.`;
}

/** A milestone's mark, by status: a filled circle, a filled diamond, a hollow square or a hollow circle. */
export function MilestoneMark({
  status,
  x,
  y,
  active = false,
}: {
  status: PortfolioMilestoneStatus;
  x: number;
  y: number;
  active?: boolean;
}) {
  const { colour } = MILESTONE_STATUS[status];
  const r = active ? 7 : 5;
  const ring = { stroke: "#0d0e11", strokeWidth: 2 };
  switch (status) {
    case "on-time":
      return <circle cx={x} cy={y} r={r} fill={colour} {...ring} />;
    case "late":
      return (
        <path
          d={`M${x} ${y - r - 1} L${x + r + 1} ${y} L${x} ${y + r + 1} L${x - r - 1} ${y} Z`}
          fill={colour}
          {...ring}
        />
      );
    case "overdue":
      return (
        <rect
          x={x - r + 1}
          y={y - r + 1}
          width={(r - 1) * 2}
          height={(r - 1) * 2}
          fill="#0d0e11"
          stroke={colour}
          strokeWidth="2"
        />
      );
    case "upcoming":
      return (
        <circle
          cx={x}
          cy={y}
          r={r - 1}
          fill="#0d0e11"
          stroke={colour}
          strokeWidth="2"
        />
      );
  }
}

function Legend() {
  return (
    <ul
      className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-200"
      aria-label="Legend"
    >
      {STATUS_ORDER.map((status) => (
        <li key={status} className="flex items-center gap-2">
          <svg width="16" height="16" aria-hidden="true" focusable="false">
            <MilestoneMark status={status} x={8} y={8} />
          </svg>
          {MILESTONE_STATUS[status].label}
        </li>
      ))}
      <li className="flex items-center gap-2">
        <svg width="20" height="16" aria-hidden="true" focusable="false">
          <path d="M2 8 H18" stroke="#f59e0b" strokeWidth="2" />
        </svg>
        Slip from the planned date
      </li>
      <li className="flex items-center gap-2">
        <svg width="20" height="16" aria-hidden="true" focusable="false">
          <path
            d="M10 1 V15"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
        </svg>
        Data cut
      </li>
    </ul>
  );
}

/**
 * The milestone swimlane: one lane per study on one time axis, each
 * milestone at its actual date once reached and at its plan before, with
 * the slip from plan drawn as a line. The chart takes keyboard focus: the
 * up and down arrows move between studies, left and right between a
 * study's milestones, and each is read aloud. Every date is also in the
 * table that follows the chart.
 */
export function MilestoneSwimlane({
  swimlane,
  dataCut,
}: {
  swimlane: PortfolioSwimlane;
  dataCut: string;
}) {
  const titleId = useId();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const onResize = useCallback((entry: ResizeObserverEntry) => {
    setWidth(clamp(Math.floor(entry.contentRect.width), MIN_WIDTH, MAX_WIDTH));
  }, []);
  const containerRef = useResizeObserver<HTMLDivElement>(onResize);
  const [active, setActive] = useState<{
    lane: number;
    milestone: number;
  } | null>(null);
  const [announced, setAnnounced] = useState("");

  const sideLabels = width >= SIDE_LABELS_FROM;
  const left = sideLabels ? LABEL_WIDTH : 4;
  const right = width - RIGHT_PAD;
  const laneHeight = sideLabels ? 40 : 56;
  // Where the track runs within a lane: centred, or below the label.
  const trackOffset = sideLabels ? laneHeight / 2 : 38;
  const height = AXIS_HEIGHT + swimlane.lanes.length * laneHeight + 4;
  const from = dayOf(swimlane.from);
  const span = dayOf(swimlane.to) - from;
  const x = (iso: string) =>
    left + ((dayOf(iso) - from) / span) * (right - left);
  const laneY = (index: number) => AXIS_HEIGHT + index * laneHeight;

  const move = useCallback(
    (lane: number, milestone: number) => {
      const next = {
        lane: clamp(lane, 0, swimlane.lanes.length - 1),
        milestone: 0,
      };
      const count = swimlane.lanes[next.lane].milestones.length;
      next.milestone = clamp(milestone, 0, count - 1);
      setActive(next);
      const target = swimlane.lanes[next.lane];
      setAnnounced(
        readoutText(target.studyId, target.milestones[next.milestone])
      );
    },
    [swimlane]
  );

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const at = active ?? { lane: 0, milestone: -1 };
    const last = swimlane.lanes[at.lane].milestones.length - 1;
    switch (event.key) {
      case "ArrowRight":
        move(at.lane, at.milestone + 1);
        break;
      case "ArrowLeft":
        move(at.lane, Math.max(0, at.milestone - 1));
        break;
      case "ArrowDown":
        move(active === null ? 0 : at.lane + 1, Math.max(0, at.milestone));
        break;
      case "ArrowUp":
        move(at.lane - 1, Math.max(0, at.milestone));
        break;
      case "Home":
        move(at.lane, 0);
        break;
      case "End":
        move(at.lane, last);
        break;
      case "Escape":
        setActive(null);
        return;
      default:
        return;
    }
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const px = ((event.clientX - box.left) / box.width) * width;
    const py = ((event.clientY - box.top) / box.height) * height;
    const lane = Math.floor((py - AXIS_HEIGHT) / laneHeight);
    if (lane < 0 || lane >= swimlane.lanes.length) {
      setActive(null);
      return;
    }
    // The milestone whose mark is nearest the pointer along the lane.
    let nearest = 0;
    let gap = Infinity;
    swimlane.lanes[lane].milestones.forEach((milestone, index) => {
      const distance = Math.abs(x(markDate(milestone)) - px);
      if (distance < gap) {
        gap = distance;
        nearest = index;
      }
    });
    setActive({ lane, milestone: nearest });
  };

  const label = `Milestone swimlane of ${plural(swimlane.lanes.length, "study", "studies")} from ${swimlane.from} to ${swimlane.to}, with the data cut on ${dataCut}.`;
  const activeLane = active === null ? null : swimlane.lanes[active.lane];
  const activeMilestone =
    active === null || activeLane === null
      ? null
      : activeLane.milestones[active.milestone];
  const cutX = x(dataCut);

  return (
    <figure className="min-w-0" aria-labelledby={titleId}>
      <figcaption id={titleId} className="sr-only">
        {label}
      </figcaption>
      <Legend />
      <div
        role="group"
        tabIndex={0}
        aria-label={`${label} Use the arrow keys to read each milestone: up and down for studies, left and right for milestones.`}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        className="relative min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <div ref={containerRef} className="w-full min-w-0" aria-hidden="true">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full touch-pan-y"
            focusable="false"
            onPointerMove={onPointerMove}
            onPointerLeave={() => setActive(null)}
            data-testid="portfolio-swimlane"
          >
            {swimlane.years.map((year) => (
              <g key={year}>
                <line
                  x1={x(year)}
                  x2={x(year)}
                  y1={AXIS_HEIGHT - 14}
                  y2={height}
                  stroke="rgba(255,255,255,0.08)"
                />
                {/* A year too near the right edge to fit its label keeps only its gridline. */}
                {x(year) + YEAR_LABEL_WIDTH <= width && (
                  <text
                    x={x(year) + 4}
                    y={AXIS_HEIGHT - 6}
                    fontSize="11"
                    fill="#94a3b8"
                    className="tabular-nums"
                  >
                    {year.slice(0, 4)}
                  </text>
                )}
              </g>
            ))}
            <line
              x1={cutX}
              x2={cutX}
              y1={14}
              y2={height}
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <text
              x={cutX - 4}
              y={11}
              fontSize="11"
              fill="#cbd5e1"
              textAnchor="end"
            >
              Data cut
            </text>
            {swimlane.lanes.map((lane, index) => {
              const top = laneY(index);
              const y = top + trackOffset;
              const first = lane.milestones[0];
              const last = lane.milestones[lane.milestones.length - 1];
              return (
                <g key={lane.studyId}>
                  {index > 0 && (
                    <line
                      x1={0}
                      x2={width}
                      y1={top}
                      y2={top}
                      stroke="rgba(255,255,255,0.05)"
                    />
                  )}
                  {active?.lane === index && (
                    <rect
                      x={0}
                      y={top}
                      width={width}
                      height={laneHeight}
                      fill="rgba(255,255,255,0.04)"
                    />
                  )}
                  <text
                    x={sideLabels ? 0 : 4}
                    y={sideLabels ? y - 2 : top + 16}
                    fontSize="12"
                    fill="#f4f4f6"
                    className="font-mono"
                  >
                    {lane.studyId}
                  </text>
                  <text
                    x={sideLabels ? 0 : 4 + lane.studyId.length * 8}
                    y={sideLabels ? y + 13 : top + 16}
                    dx={sideLabels ? 0 : 8}
                    fontSize="11"
                    fill="#94a3b8"
                  >
                    {lane.status}
                  </text>
                  {first && last && (
                    <line
                      x1={x(first.planned)}
                      x2={x(last.planned)}
                      y1={y}
                      y2={y}
                      stroke="rgba(255,255,255,0.14)"
                      strokeWidth="2"
                    />
                  )}
                  {lane.milestones.map((milestone) =>
                    milestone.status === "late" && milestone.actual ? (
                      <line
                        key={`slip-${milestone.kind}`}
                        x1={x(milestone.planned)}
                        x2={x(milestone.actual)}
                        y1={y}
                        y2={y}
                        stroke={MILESTONE_STATUS.late.colour}
                        strokeWidth="2"
                      />
                    ) : milestone.status === "overdue" ? (
                      <line
                        key={`slip-${milestone.kind}`}
                        x1={x(milestone.planned)}
                        x2={cutX}
                        y1={y}
                        y2={y}
                        stroke={MILESTONE_STATUS.overdue.colour}
                        strokeWidth="2"
                        strokeDasharray="4 3"
                      />
                    ) : null
                  )}
                  {lane.milestones.map((milestone) =>
                    milestone.actual !== null &&
                    milestone.actual !== milestone.planned ? (
                      <line
                        key={`plan-${milestone.kind}`}
                        x1={x(milestone.planned)}
                        x2={x(milestone.planned)}
                        y1={y - 6}
                        y2={y + 6}
                        stroke="#94a3b8"
                        strokeWidth="1.5"
                      />
                    ) : null
                  )}
                  {lane.milestones.map((milestone, position) => (
                    <MilestoneMark
                      key={milestone.kind}
                      status={milestone.status}
                      x={x(markDate(milestone))}
                      y={y}
                      active={
                        active?.lane === index && active.milestone === position
                      }
                    />
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
        {activeLane !== null && activeMilestone !== null && active !== null && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-10 max-w-[16rem] border border-white/[0.12] bg-[#13151a] px-3 py-2 text-xs shadow-lg"
            style={{
              top: `${((laneY(active.lane) + laneHeight) / height) * 100}%`,
              ...(x(markDate(activeMilestone)) > width / 2
                ? {
                    right: `${((width - x(markDate(activeMilestone))) / width) * 100}%`,
                  }
                : { left: `${(x(markDate(activeMilestone)) / width) * 100}%` }),
            }}
          >
            <p className="font-mono text-[11px] text-slate-400">
              {activeLane.studyId}
            </p>
            <p className="mt-0.5 font-semibold text-[#f4f4f6]">
              {activeMilestone.label}
            </p>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono tabular-nums text-slate-200">
              <dt className="text-slate-400">Planned</dt>
              <dd>{activeMilestone.planned}</dd>
              <dt className="text-slate-400">Actual</dt>
              <dd>{activeMilestone.actual ?? "Not yet"}</dd>
            </dl>
            <p className="mt-1 text-slate-200">
              {milestoneStatusText(activeMilestone)}
            </p>
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {announced}
        </p>
      </div>
    </figure>
  );
}
