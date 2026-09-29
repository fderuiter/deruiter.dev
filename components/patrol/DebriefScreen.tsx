"use client";

import React from "react";
import { DEBRIEF_DIMENSION_ORDER, type PatrolScenario, type IncidentDebriefResult } from "@/lib/patrol";
import {
  IconArrowBackUp,
  IconRefresh,
  IconAward,
  IconGauge,
  IconSnowflake,
  IconCheck,
  IconAlertTriangle,
  IconInfoCircle,
} from "@tabler/icons-react";
import { DebriefDimensionMeter } from "./DebriefDimensionMeter";

/**
 * Props for the DebriefScreen component.
 */
interface DebriefScreenProps {
  /** The patrol scenario just resolved. */
  scenario: PatrolScenario | null;
  /** The rule-based debrief result for this incident (see `evaluateIncidentDebrief`). */
  result: IncidentDebriefResult;
  /** Callback triggered to return to the mountain map hub and increment completed incidents. */
  onReturnToHub: () => void;
  /** Optional callback to replay the same incident from the beginning. */
  onReplayIncident?: () => void;
}

interface SentimentConfig {
  icon: React.ComponentType<{ className?: string }>;
  containerClass: string;
  iconColorClass: string;
}

const SENTIMENT_CONFIG: Record<
  IncidentDebriefResult["observations"][number]["sentiment"],
  SentimentConfig
> = {
  positive: {
    icon: IconCheck,
    containerClass: "border-emerald-500/30 bg-emerald-500/5",
    iconColorClass: "text-emerald-400",
  },
  caution: {
    icon: IconInfoCircle,
    containerClass: "border-amber-500/30 bg-amber-500/5",
    iconColorClass: "text-amber-400",
  },
  constructive: {
    icon: IconAlertTriangle,
    containerClass: "border-red-500/30 bg-red-500/5",
    iconColorClass: "text-red-400",
  },
};

/**
 * Post-incident contextual debrief screen (Milestone M7, Issue #753).
 *
 * Renders the five-dimension performance meters, 2-3 highlighted qualitative
 * observations, and (when the incident included a toboggan descent) the OET
 * transport telemetry pill, evaluated purely from `evaluateIncidentDebrief`.
 */
export const DebriefScreen: React.FC<DebriefScreenProps> = ({
  scenario,
  result,
  onReturnToHub,
  onReplayIncident,
}) => {
  const highlightedObservations = result.observations.slice(0, 3);

  return (
    <div
      className="flex flex-col gap-6 p-4 sm:p-8 bg-zinc-900/40 rounded-2xl border border-zinc-800/80"
      data-testid="patrol-debrief-screen"
    >
      <div className="sr-only" role="status" aria-live="polite">
        Incident debrief complete. Overall rating: {result.overallRating}.
      </div>

      {/* Debrief Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2.5 py-0.5 rounded-full bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan text-[10px] font-mono font-bold uppercase tracking-wider shrink-0">
              Contextual Incident Debrief
            </span>
            <span className="text-zinc-400 text-xs font-mono truncate min-w-0">
              {scenario?.title ?? "Routine Incident"}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-mono font-bold text-white tracking-tight">
            Incident Performance Review
          </h2>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-950 border border-brand-cyan/40 shadow-sm text-xs font-mono">
          <IconAward className="w-5 h-5 text-brand-cyan shrink-0" />
          <span className="text-zinc-400">Overall:</span>
          <span className="text-base font-bold text-white">
            {result.overallRating}
          </span>
        </div>
      </div>

      {/* Five-Dimension Meters */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-3.5"
        role="group"
        aria-label="Debrief performance dimensions"
        data-testid="debrief-dimension-grid"
      >
        {DEBRIEF_DIMENSION_ORDER.map((dimension) => (
          <DebriefDimensionMeter
            key={dimension}
            dimension={dimension}
            dimensionScore={result.dimensions[dimension]}
          />
        ))}
      </div>

      {/* Qualitative Observations */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
          Field Observations
        </h3>
        <div className="space-y-2.5" data-testid="debrief-observations">
          {highlightedObservations.length > 0 ? (
            highlightedObservations.map((observation) => {
              const config = SENTIMENT_CONFIG[observation.sentiment];
              const Icon = config.icon;
              return (
                <div
                  key={observation.id}
                  data-testid={`observation-${observation.id}`}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs font-mono ${config.containerClass}`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 mt-0.5 ${config.iconColorClass}`}
                  />
                  <div className="space-y-1 min-w-0">
                    <p className="font-bold text-zinc-100">
                      {observation.headline}
                    </p>
                    <p className="text-[11px] font-sans text-zinc-300 leading-relaxed">
                      {observation.detail}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div
              data-testid="observation-fallback"
              className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60 flex items-start gap-3 text-xs font-mono text-zinc-400"
            >
              <IconInfoCircle className="w-4 h-4 shrink-0 mt-0.5 text-zinc-400" />
              <div className="space-y-1 min-w-0">
                <p className="font-bold text-zinc-200">
                  Standard Operational Baseline
                </p>
                <p className="text-[11px] font-sans text-zinc-400 leading-relaxed">
                  No critical deviations recorded. Standard patrol procedures
                  were maintained.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* OET Descent Telemetry Pill */}
      {result.oetSummary && (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs font-mono"
          data-testid="oet-telemetry-pill"
        >
          <span className="inline-flex items-center gap-1.5 text-zinc-300 font-bold">
            <IconGauge className="w-4 h-4 text-brand-cyan shrink-0" />
            Transport Telemetry
          </span>
          <span className="text-zinc-400" aria-hidden="true">
            &bull;
          </span>
          <span className="text-white font-bold">
            {result.oetSummary.controlledStops} controlled stop
            {result.oetSummary.controlledStops === 1 ? "" : "s"}
          </span>
          <span className="text-zinc-400" aria-hidden="true">
            &bull;
          </span>
          <span className="inline-flex items-center gap-1.5 text-white font-bold capitalize">
            <IconSnowflake className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            Ride comfort: {result.oetSummary.rideComfort}
          </span>
          <span className="text-zinc-400" aria-hidden="true">
            &bull;
          </span>
          <span className="text-zinc-400">
            Judgment score:{" "}
            <strong className="text-white">
              {result.oetSummary.judgmentScore}%
            </strong>
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        {onReplayIncident && (
          <button
            type="button"
            onClick={onReplayIncident}
            data-testid="replay-incident-btn"
            className="min-h-[44px] min-w-[44px] px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:scale-[0.98] border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-mono text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
          >
            <IconRefresh className="w-4 h-4" />
            <span>Replay Incident</span>
          </button>
        )}
        <button
          type="button"
          onClick={onReturnToHub}
          data-testid="return-to-hub-btn"
          className="min-h-[44px] min-w-[44px] px-6 py-2.5 rounded-xl bg-brand-cyan hover:bg-brand-cyan/90 active:scale-[0.98] text-zinc-950 font-mono text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-2 shadow-lg shadow-brand-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <IconArrowBackUp className="w-4 h-4" />
          <span>Return to Mountain Patrol Hub</span>
        </button>
      </div>
    </div>
  );
};
