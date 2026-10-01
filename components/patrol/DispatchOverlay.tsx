"use client";

import React from "react";
import type { PatrolScenario } from "@/lib/patrol";
import { usePatrolTriageHotkeys } from "@/hooks/usePatrolTriageHotkeys";
import {
  IconRadio,
  IconAlertTriangle,
  IconMapPin,
  IconClock,
  IconCheck,
  IconVolume,
} from "@tabler/icons-react";

/**
 * Props for the DispatchOverlay component.
 */
export interface DispatchOverlayProps {
  /** The active scenario being dispatched, or null if unselected. */
  scenario: PatrolScenario | null;
  /** Callback triggered when the patroller acknowledges dispatch and initiates response. */
  onAcknowledge: () => void;
  /** Focused button index override from parent container. */
  focusedIndex?: number;
  /** Whether hotkey listeners are active. */
  isHotkeyActive?: boolean;
}

/**
 * Authentic radio-style dispatch callout card presenting incoming radio traffic,
 * tone visualizer, incident location/severity, and responder acknowledgment action.
 */
export const DispatchOverlay: React.FC<DispatchOverlayProps> = ({
  scenario,
  onAcknowledge,
  focusedIndex: externalFocusedIndex,
  isHotkeyActive = true,
}) => {
  const dispatchPrompt =
    scenario?.dispatchPrompt ??
    "Patrol 4, Base Dispatch. Respond to skier down on Dan's Dive, East Slopes. Guest reports painful lower extremity injury, unable to bear weight. Respond 10-2 with toboggan.";

  const { focusedIndex: internalFocusedIndex, getHotkeyBadge } =
    usePatrolTriageHotkeys({
      itemsCount: 1,
      onSelectItem: () => onAcknowledge(),
      onAdvancePhase: () => onAcknowledge(),
      phase: scenario?.id ?? "dispatch",
      enabled: isHotkeyActive,
    });

  const activeFocusedIndex = externalFocusedIndex ?? internalFocusedIndex;
  const isFocused = activeFocusedIndex === 0;
  const badge = getHotkeyBadge(0);

  return (
    <div
      className="flex flex-col gap-6 p-4 sm:p-8 bg-zinc-950 rounded-2xl border-2 border-brand-cyan/40 shadow-2xl shadow-brand-cyan/5 relative overflow-hidden"
      data-testid="patrol-dispatch-overlay"
    >
      {/* Top Radio Frequency Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan animate-pulse">
            <IconRadio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-white tracking-wide uppercase">
                Incoming Dispatch Callout
              </span>
              <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-mono font-bold uppercase animate-pulse">
                PRIORITY 10-33
              </span>
            </div>
            <div className="text-[11px] font-mono text-zinc-400">
              Repeater: 154.570 MHz CH 1 • PL 103.5 Hz
            </div>
          </div>
        </div>

        {/* Audio Waveform Simulator */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800"
          aria-hidden="true"
        >
          <IconVolume className="w-4 h-4 text-brand-cyan shrink-0" />
          <div className="flex items-end gap-1 h-4 w-16">
            <span className="w-1 bg-brand-cyan/70 rounded-full h-2 motion-safe:animate-pulse" />
            <span className="w-1 bg-brand-cyan rounded-full h-4 motion-safe:animate-bounce" />
            <span className="w-1 bg-brand-cyan/80 rounded-full h-3 motion-safe:animate-pulse" />
            <span className="w-1 bg-brand-cyan rounded-full h-4 motion-safe:animate-bounce" />
            <span className="w-1 bg-brand-cyan/60 rounded-full h-2 motion-safe:animate-pulse" />
          </div>
          <span className="text-[10px] font-mono text-zinc-400">RX ACTIVE</span>
        </div>
      </div>

      {/* Dispatch Transcript Box */}
      <div className="p-5 rounded-xl bg-zinc-900/90 border border-zinc-800/90 space-y-2">
        <div className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-wider text-brand-cyan">
          <span>Base Dispatcher Radio Transmission</span>
        </div>
        <p className="text-sm sm:text-base font-mono text-zinc-100 leading-relaxed italic">
          &ldquo;{dispatchPrompt}&rdquo;
        </p>
      </div>

      {/* Incident Metadata Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-800 text-brand-cyan">
            <IconMapPin className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono text-zinc-400 uppercase">
              Location
            </div>
            <div className="text-xs font-mono font-bold text-white truncate">
              {scenario?.location ?? "Dan's Dive - East Slopes"}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-800 text-amber-400">
            <IconAlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono text-zinc-400 uppercase">
              Nature of Call
            </div>
            <div className="text-xs font-mono font-bold text-white truncate">
              {scenario?.title ?? "Skier Injury"}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-800 text-emerald-400">
            <IconClock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono text-zinc-400 uppercase">
              Est. Response
            </div>
            <div className="text-xs font-mono font-bold text-white truncate">
              {scenario?.estimatedMinutes ?? 12} Minutes
            </div>
          </div>
        </div>
      </div>

      {/* Dispatch Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="text-xs font-mono text-zinc-400">
          Radio Code: <strong className="text-white">10-4 Acknowledged</strong>{" "}
          • Responding 10-2
        </div>

        <button
          type="button"
          onClick={onAcknowledge}
          data-testid="dispatch-acknowledge-btn"
          className={`min-h-[44px] min-w-[44px] px-6 py-2.5 rounded-xl bg-brand-cyan hover:bg-brand-cyan/90 active:scale-[0.98] text-zinc-950 font-mono text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-2 shadow-lg shadow-brand-cyan/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
            isFocused ? "ring-2 ring-white scale-[1.02]" : ""
          }`}
        >
          {badge && (
            <span
              data-testid="dispatch-hotkey-badge"
              className="px-1.5 py-0.5 rounded bg-zinc-950 text-brand-cyan text-[10px] font-mono font-bold border border-brand-cyan/40"
            >
              {badge}
            </span>
          )}
          <IconCheck className="w-4 h-4" />
          <span>Acknowledge &amp; Respond</span>
          <span className="px-1.5 py-0.5 rounded bg-zinc-950 text-brand-cyan text-[10px] font-mono font-bold border border-brand-cyan/40">
            [Enter]
          </span>
        </button>
      </div>
    </div>
  );
};
