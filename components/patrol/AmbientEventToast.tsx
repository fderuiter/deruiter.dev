"use client";

import React, { useState } from "react";
import type { AmbientEvent } from "@/lib/patrol";
import { usePatrolTriageHotkeys } from "@/hooks/usePatrolTriageHotkeys";
import {
  IconRadio,
  IconMapPin,
  IconX,
  IconClock,
  IconCheck,
  IconArrowRight,
  IconAlertCircle,
} from "@tabler/icons-react";

/**
 * Props for the AmbientEventToast component.
 */
interface AmbientEventToastProps {
  /** The active ambient operational event to display. */
  event: AmbientEvent;
  /** Callback triggered when the patroller selects an operational response option. */
  onResolveOption: (optionId: string) => void;
  /** Callback triggered when dismissing the encounter without action. */
  onDismiss: () => void;
  /** Optional additional CSS classes. */
  className?: string;
}

/**
 * Non-blocking, accessible floating toast card presenting Midwest ski patrol
 * operational mini-events on the Mountain Map Hub (Issue #754).
 *
 * Implements WCAG 2.1 Level AA compliance, 44px minimum touch targets,
 * keyboard accessibility with Escape dismissal, and prefers-reduced-motion support.
 */
export const AmbientEventToast: React.FC<AmbientEventToastProps> = ({
  event,
  onResolveOption,
  onDismiss,
  className = "",
}) => {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  const selectedOption = event.options.find((o) => o.id === selectedOptionId);

  const handleSelectOption = (optionId: string) => {
    setSelectedOptionId(optionId);
    onResolveOption(optionId);
  };

  const { focusedIndex, getHotkeyBadge } = usePatrolTriageHotkeys({
    items: event.options,
    isItemSelectable: () => !selectedOptionId,
    onSelectItem: (_index, option) => {
      if (option) handleSelectOption(option.id);
    },
    phase: event.id,
    enabled: !selectedOptionId,
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onDismiss();
    }
  };

  return (
    <div
      role="region"
      aria-label={`Patrol Encounter: ${event.title}`}
      data-testid="ambient-event-toast"
      onKeyDown={handleKeyDown}
      className={`w-full max-w-md bg-zinc-950/95 border border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md font-mono text-zinc-200 transition-all motion-reduce:transition-none ${className}`}
    >
      {/* Toast Header */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <IconRadio className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Ambient Hill Ops</span>
            </span>
            <span className="text-zinc-400 text-[10px] truncate max-w-[180px]">
              {event.sector}
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug">
            {event.title}
          </h3>
          <div className="flex items-center gap-1 text-[11px] text-zinc-400">
            <IconMapPin className="w-3 h-3 text-brand-cyan shrink-0" />
            <span>{event.location}</span>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={onDismiss}
          data-testid="ambient-dismiss-btn"
          aria-label="Dismiss ambient event"
          className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/60 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
        >
          <IconX className="w-4 h-4" />
        </button>
      </div>

      {/* Prompt / Context Body */}
      <div className="py-3 space-y-1.5 text-xs font-sans">
        <p className="text-zinc-100 leading-relaxed">{event.prompt}</p>
        {event.context && (
          <p className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
            <IconAlertCircle className="w-3 h-3 text-zinc-400 shrink-0" />
            <span>{event.context}</span>
          </p>
        )}
      </div>

      {/* Response Options */}
      <div className="space-y-2 pt-1">
        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
          Patrol Operational Response:
        </span>

        <div className="flex flex-col gap-2">
          {event.options.map((option, optIdx) => {
            const isSelected = selectedOptionId === option.id;
            const isFocused = focusedIndex === optIdx && !selectedOptionId;
            const badge = getHotkeyBadge(optIdx);

            return (
              <button
                key={option.id}
                type="button"
                data-testid={`ambient-option-${option.id}`}
                onClick={() => handleSelectOption(option.id)}
                className={`min-h-[44px] min-w-[44px] text-left px-3.5 py-2.5 rounded-xl border transition-all active:scale-[0.98] flex flex-col gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan ${
                  isSelected
                    ? "bg-brand-cyan/15 border-brand-cyan/50 text-white"
                    : isFocused
                      ? "ring-2 ring-brand-cyan border-brand-cyan bg-brand-cyan/10 shadow-lg shadow-brand-cyan/10"
                      : "bg-zinc-900/90 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850 text-zinc-200 hover:text-white cursor-pointer"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {badge && !selectedOptionId && (
                      <span
                        data-testid={`ambient-hotkey-badge-${option.id}`}
                        className="px-1.5 py-0.5 rounded bg-zinc-800 text-brand-cyan text-[10px] font-mono font-bold border border-brand-cyan/30 shrink-0"
                      >
                        {badge}
                      </span>
                    )}
                    <span className="text-xs font-mono font-bold leading-tight truncate">
                      {option.label}
                    </span>
                  </div>
                  {isSelected && (
                    <IconCheck className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
                  )}
                  {option.timeIncrementMinutes && (
                    <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-0.5 shrink-0">
                      <IconClock className="w-3 h-3" />
                      <span>+{option.timeIncrementMinutes}m</span>
                    </span>
                  )}
                </div>
                {option.description && (
                  <p className="text-[11px] font-sans text-zinc-400 leading-snug">
                    {option.description}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Consequence Feedback Note */}
      {selectedOption && (
        <div
          data-testid="ambient-consequence"
          className="mt-3 p-3 rounded-xl bg-zinc-900 border border-emerald-500/40 space-y-1"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
            <IconArrowRight className="w-3 h-3" />
            <span>Operational Consequence</span>
          </div>
          <p className="text-xs font-sans text-zinc-200 leading-relaxed">
            {selectedOption.consequenceText}
          </p>
        </div>
      )}
    </div>
  );
};
