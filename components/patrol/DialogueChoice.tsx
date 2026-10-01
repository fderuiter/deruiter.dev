"use client";

import React, { useState } from "react";
import type { DialogueMoment, DialogueOption, PatrolEvent } from "@/lib/patrol";
import { createDialogueChoiceEvent, findDialogueOption } from "@/lib/patrol";
import { usePatrolTriageHotkeys } from "@/hooks/usePatrolTriageHotkeys";
import {
  IconMessageCircle2,
  IconCheck,
  IconArrowRight,
} from "@tabler/icons-react";

/**
 * Props for the DialogueChoice component.
 */
export interface DialogueChoiceProps {
  /** ID of the scenario this dialogue moment belongs to (recorded on the logged event). */
  scenarioId: string;
  /** The dialogue moment to present. */
  moment: DialogueMoment;
  /** Called once, when the patroller selects an option, with the rich PatrolEvent to append to shift history. */
  onChoose?: (event: PatrolEvent, option: DialogueOption) => void;
  /** Pre-resolved option id, e.g. when re-rendering a moment already answered earlier in the shift. */
  resolvedOptionId?: string;
  /** Optional CSS class overrides. */
  className?: string;
  /** Focused option index override from parent container. */
  focusedIndex?: number;
  /** Whether hotkey listeners are active for this dialogue choice. */
  isHotkeyActive?: boolean;
}

/**
 * Interpersonal/delegation dialogue choice card (Issue #752).
 *
 * Presents a `DialogueMoment` as a set of options distinguished only by
 * their actual words — no style/clarity/closed-loop labels are shown before
 * a choice is made, so nothing telegraphs which option is "better." Once one
 * is selected, it logs a rich `PatrolEvent` (carrying style/clarity/closed-loop
 * context) for the M7 debrief to reference, and shows only the resulting
 * in-fiction response live; the analytical debrief note stays out of the
 * on-scene UI and is read later from the logged event.
 *
 * Notice: Educational simulation prototype.
 */
export const DialogueChoice: React.FC<DialogueChoiceProps> = ({
  scenarioId,
  moment,
  onChoose,
  resolvedOptionId,
  className = "",
  focusedIndex: externalFocusedIndex,
  isHotkeyActive = true,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const effectiveSelectedId = resolvedOptionId ?? selectedId;

  const selectedOption = effectiveSelectedId
    ? findDialogueOption(moment, effectiveSelectedId)
    : undefined;

  const handleSelect = (option: DialogueOption) => {
    if (effectiveSelectedId) return;
    setSelectedId(option.id);
    const event = createDialogueChoiceEvent(scenarioId, moment, option);
    onChoose?.(event, option);
  };

  const { focusedIndex: internalFocusedIndex, getHotkeyBadge } =
    usePatrolTriageHotkeys({
      items: moment.options,
      isItemSelectable: () => !effectiveSelectedId,
      onSelectItem: (_index, option) => {
        if (option) handleSelect(option);
      },
      phase: moment.id,
      enabled: isHotkeyActive && !effectiveSelectedId,
    });

  const activeFocusedIndex = externalFocusedIndex ?? internalFocusedIndex;

  return (
    <div
      role="group"
      aria-label={`Dialogue moment: ${moment.speaker}`}
      data-testid={`dialogue-moment-${moment.id}`}
      className={`flex flex-col gap-3 p-4 sm:p-5 rounded-2xl bg-zinc-950/90 border border-zinc-800/90 font-mono ${className}`}
    >
      <div className="flex items-start gap-2.5 pb-2 border-b border-zinc-800/70">
        <div className="p-1.5 rounded-lg bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan shrink-0">
          <IconMessageCircle2 className="w-4 h-4" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
            {moment.speaker}
          </span>
          <p className="text-sm font-sans text-zinc-100 italic leading-snug">
            &ldquo;{moment.prompt}&rdquo;
          </p>
          {moment.context && (
            <p className="text-[11px] font-sans text-zinc-400 leading-snug">
              {moment.context}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {moment.options.map((option, optIdx) => {
          const isSelected = effectiveSelectedId === option.id;
          const isDisabled = Boolean(effectiveSelectedId) && !isSelected;
          const isFocused =
            activeFocusedIndex === optIdx && !effectiveSelectedId;
          const badge = getHotkeyBadge(optIdx);

          return (
            <button
              key={option.id}
              type="button"
              data-testid={`dialogue-option-${option.id}`}
              disabled={isDisabled}
              aria-pressed={isSelected}
              onClick={() => handleSelect(option)}
              className={`min-h-[44px] min-w-[44px] text-left px-3.5 py-2.5 rounded-xl border transition-all active:scale-[0.98] flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan ${
                isSelected
                  ? "bg-brand-cyan/10 border-brand-cyan/50 text-white"
                  : isFocused
                    ? "ring-2 ring-brand-cyan border-brand-cyan bg-brand-cyan/10 shadow-lg shadow-brand-cyan/10"
                    : isDisabled
                      ? "bg-zinc-950/40 border-zinc-800/40 text-zinc-400 cursor-not-allowed opacity-60"
                      : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-200 hover:text-white cursor-pointer"
              }`}
            >
              {badge && !effectiveSelectedId && (
                <span
                  data-testid={`dialogue-hotkey-badge-${option.id}`}
                  className="px-1.5 py-0.5 rounded bg-zinc-800 text-brand-cyan text-[10px] font-mono font-bold border border-brand-cyan/30 shrink-0"
                >
                  {badge}
                </span>
              )}
              <span className="text-xs font-sans leading-snug flex-1">
                {option.text}
              </span>
              {isSelected && (
                <IconCheck className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {selectedOption && (
        <div
          data-testid="dialogue-response"
          className="mt-1 p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-1.5"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            <IconArrowRight className="w-3 h-3 text-brand-cyan" />
            <span>Response</span>
          </div>
          <p className="text-xs font-sans text-zinc-200 leading-relaxed">
            {selectedOption.response}
          </p>
        </div>
      )}
    </div>
  );
};
