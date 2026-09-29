"use client";

import React, { useMemo, useState } from "react";
import { compileShiftSummary, DEBRIEF_DIMENSION_ORDER, type ShiftState, type PatrolEvent } from "@/lib/patrol";
import {
  IconClock,
  IconRefresh,
  IconCheck,
  IconLogout,
  IconHistory,
  IconMountain,
  IconPhoneIncoming,
  IconAntenna,
  IconFirstAidKit,
  IconRoad,
  IconShieldCheck,
  IconMessage2,
  IconChevronDown,
  IconChevronUp,
  IconUserCheck,
} from "@tabler/icons-react";
import { DebriefDimensionMeter } from "./DebriefDimensionMeter";

/**
 * Props for the ShiftSummary component.
 */
interface ShiftSummaryProps {
  /** The final completed shift state. */
  shiftState: ShiftState;
  /** Complete chronological audit log of all events dispatched during the shift. */
  eventHistory: PatrolEvent[];
  /** Callback triggered to reset the simulation and begin a new patrol shift. */
  onResetShift: () => void;
}

const PLAYFUL_STAT_TILES: {
  key:
    | "callsHandled"
    | "radioTransmissions"
    | "patientsAssisted"
    | "guestsAssisted"
    | "sledTransports"
    | "trailsChecked"
    | "hazardsMarked";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Complete, literal Tailwind classes (never interpolated — the JIT scanner needs full class names). */
  iconWrapClass: string;
}[] = [
  {
    key: "callsHandled",
    label: "Calls Handled",
    icon: IconPhoneIncoming,
    iconWrapClass: "bg-brand-cyan/10 border-brand-cyan/20 text-brand-cyan",
  },
  {
    key: "radioTransmissions",
    label: "Radio Transmissions",
    icon: IconAntenna,
    iconWrapClass: "bg-sky-400/10 border-sky-400/20 text-sky-400",
  },
  {
    key: "patientsAssisted",
    label: "Patients Assisted",
    icon: IconFirstAidKit,
    iconWrapClass: "bg-emerald-400/10 border-emerald-400/20 text-emerald-400",
  },
  {
    key: "guestsAssisted",
    label: "Guests Assisted",
    icon: IconUserCheck,
    iconWrapClass: "bg-teal-400/10 border-teal-400/20 text-teal-400",
  },
  {
    key: "sledTransports",
    label: "Sled Transports",
    icon: IconRoad,
    iconWrapClass: "bg-amber-400/10 border-amber-400/20 text-amber-400",
  },
  {
    key: "trailsChecked",
    label: "Trails Checked",
    icon: IconMountain,
    iconWrapClass: "bg-teal-400/10 border-teal-400/20 text-teal-400",
  },
  {
    key: "hazardsMarked",
    label: "Hazards Checked",
    icon: IconShieldCheck,
    iconWrapClass: "bg-brand-cyan/10 border-brand-cyan/20 text-brand-cyan",
  },
];

/**
 * Final shift summary screen displaying the composite operational record:
 * playful activity counters, aggregated five-dimension performance meters,
 * a filterable chronological audit trail, and shift completion actions
 * (Milestone M7, Issue #753).
 */
export const ShiftSummary: React.FC<ShiftSummaryProps> = ({
  shiftState,
  eventHistory,
  onResetShift,
}) => {
  const summary = useMemo(
    () => compileShiftSummary(eventHistory, shiftState.timeElapsedMinutes),
    [eventHistory, shiftState.timeElapsedMinutes]
  );

  const [isLogExpanded, setIsLogExpanded] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    for (const event of eventHistory) {
      const category = event.context?.category;
      if (typeof category === "string") categories.add(category);
    }
    return Array.from(categories).sort();
  }, [eventHistory]);

  const filteredEvents = useMemo(() => {
    if (categoryFilter === "all") return eventHistory;
    return eventHistory.filter(
      (event) => event.context?.category === categoryFilter
    );
  }, [eventHistory, categoryFilter]);

  return (
    <div
      className="flex flex-col gap-6 p-4 sm:p-8 bg-zinc-900/40 rounded-2xl border border-zinc-800/80"
      data-testid="patrol-shift-summary"
    >
      {/* Shift Complete Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-wider">
              Mountain Closed &bull; Final Sweep Complete
            </span>
            <span className="text-zinc-400 text-xs font-mono">
              Shift 08:00 - 16:30
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-mono font-bold text-white tracking-tight">
            Patrol Shift Complete: Daily Operational Summary
          </h2>
          <p className="text-xs font-sans text-zinc-300 max-w-2xl">
            All chairs powered down, final trail sweep cleared, and patient
            handoff logs archived. Review your composite shift record below.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs font-mono">
          <IconMountain className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            10-7 Off Duty &bull; {summary.totalIncidents} call
            {summary.totalIncidents === 1 ? "" : "s"} &bull;{" "}
            {summary.elapsedShiftMinutes} min
          </span>
        </div>
      </div>

      {/* Playful Operational Stats Grid */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 gap-3.5"
        data-testid="playful-stats-grid"
      >
        {PLAYFUL_STAT_TILES.map(({ key, label, icon: Icon, iconWrapClass }) => (
          <div
            key={key}
            className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center gap-3.5"
            data-testid={`playful-stat-${key}`}
          >
            <div className={`p-2.5 rounded-lg border ${iconWrapClass}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-mono text-zinc-400 uppercase truncate">
                {label}
              </div>
              <div className="text-xl font-mono font-bold text-white">
                {summary.playfulStats[key] ?? 0}
              </div>
            </div>
          </div>
        ))}

        {/* Communication Style Rating (text value, not a count) */}
        <div
          className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center gap-3.5"
          data-testid="playful-stat-communicationRating"
        >
          <div className="p-2.5 rounded-lg bg-violet-400/10 border border-violet-400/20 text-violet-400">
            <IconMessage2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono text-zinc-400 uppercase truncate">
              Communication Style
            </div>
            <div className="text-sm font-mono font-bold text-white truncate">
              {summary.playfulStats.communicationRating}
            </div>
          </div>
        </div>
      </div>

      {/* Composite Shift Performance */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
          Composite Shift Performance
        </h3>
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3.5"
          role="group"
          aria-label="Composite shift performance dimensions"
          data-testid="composite-dimension-grid"
        >
          {DEBRIEF_DIMENSION_ORDER.map((dimension) => (
            <DebriefDimensionMeter
              key={dimension}
              dimension={dimension}
              dimensionScore={summary.compositeDimensions[dimension]}
            />
          ))}
        </div>
      </div>

      {/* Chronological Event History Log */}
      <div className="p-4 sm:p-5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">
            <IconHistory className="w-4 h-4 text-brand-cyan" />
            <span>Chronological Operational Event Log</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="shift-log-category-filter">
              Filter event log by category
            </label>
            <select
              id="shift-log-category-filter"
              data-testid="shift-log-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="min-h-[44px] px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
            >
              <option value="all">All categories</option>
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <button
              type="button"
              data-testid="shift-log-toggle"
              onClick={() => setIsLogExpanded((prev) => !prev)}
              aria-expanded={isLogExpanded}
              aria-controls="shift-log-list"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:scale-[0.98] border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs font-mono transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
            >
              {isLogExpanded ? (
                <IconChevronUp className="w-3.5 h-3.5" />
              ) : (
                <IconChevronDown className="w-3.5 h-3.5" />
              )}
              <span>{isLogExpanded ? "Collapse" : "Expand"}</span>
            </button>

            <span className="text-[11px] font-mono text-zinc-400">
              {filteredEvents.length} of {eventHistory.length} events
            </span>
          </div>
        </div>

        {isLogExpanded && (
          <div
            id="shift-log-list"
            data-testid="shift-log-list"
            className="max-h-60 overflow-y-auto space-y-2 pr-1 select-text"
          >
            {filteredEvents.length > 0 ? (
              filteredEvents.map((evt, idx) => (
                <div
                  key={`${evt.action ?? "event"}-${idx}`}
                  className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60 flex items-center justify-between text-xs font-mono gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <IconCheck className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
                    <span className="text-zinc-200 font-bold truncate">
                      {evt.action ?? evt.type ?? "Operational Event"}
                    </span>
                    {evt.scenarioId && (
                      <span className="text-[10px] text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 hidden sm:inline">
                        {evt.scenarioId}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400 shrink-0">
                    #{idx + 1}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs font-mono text-zinc-400 italic p-3">
                No individual event telemetry logged during this session.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Chronological Shift Highlights */}
      {summary.chronologicalHighlights.length > 0 && (
        <div className="p-4 sm:p-5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">
            <IconClock className="w-4 h-4 text-brand-cyan" />
            <span>Shift Highlights</span>
          </div>
          <ul className="space-y-1.5 text-[11px] font-sans text-zinc-300">
            {summary.chronologicalHighlights.map((highlight, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-brand-cyan shrink-0" aria-hidden="true">
                  &bull;
                </span>
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Shift Controls */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onResetShift}
          data-testid="clock-out-btn"
          className="min-h-[44px] min-w-[44px] px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:scale-[0.98] border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-mono text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
        >
          <IconLogout className="w-4 h-4" />
          <span>Clock Out &amp; Log Off</span>
        </button>

        <button
          type="button"
          onClick={onResetShift}
          data-testid="start-new-shift-btn"
          className="min-h-[44px] min-w-[44px] px-6 py-2.5 rounded-xl bg-brand-cyan hover:bg-brand-cyan/90 active:scale-[0.98] text-zinc-950 font-mono text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-2 shadow-lg shadow-brand-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <IconRefresh className="w-4 h-4" />
          <span>Start New Shift</span>
        </button>
      </div>
    </div>
  );
};
