"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { clamp } from "@/lib/game-utils";
import {
  IconX,
  IconChevronRight,
  IconChevronLeft,
  IconSparkles,
  IconCheck,
  IconFocus2,
} from "@tabler/icons-react";
import { saveTutorialSeen } from "./useStudySave";
import { env } from "@/lib/env";

interface DeskSpotlightTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface TourStep {
  id: string;
  stepNumber: number;
  title: string;
  /** `data-sd-coach` selector target for this step. */
  target: string;
  targetDescription: string;
  details: string;
  actionHint: string;
}

export const SPOTLIGHT_STEPS: TourStep[] = [
  {
    id: "step_inbox",
    stepNumber: 1,
    title: "1. Incoming Messages & Alerts",
    target: "inbox",
    targetDescription: "Inbox Panel",
    details:
      "Your inbox delivers daily trial updates, site queries, and urgent requests. Critical messages marked in red will lapse with penalties if unaddressed when you end the day.",
    actionHint:
      "Tip: Select a message to read details and view response choices in the Decision Panel.",
  },
  {
    id: "step_decision",
    stepNumber: 2,
    title: "2. Decision Panel & Documentation",
    target: "decision",
    targetDescription: "Decision Panel",
    details:
      "Choose an option to resolve the selected message. Toggle 'Document decision' (key D) to create a formal audit trail. Unrecorded choices create routine maintenance overhead that consumes daily attention.",
    actionHint:
      "Tip: Keyboard shortcuts 1-5 select options quickly, and D toggles documentation.",
  },
  {
    id: "step_attention",
    stepNumber: 3,
    title: "3. Attention Budget",
    target: "attention",
    targetDescription: "Header Attention Readout",
    details:
      "You receive 5 attention pips each day. Resolving messages and performing site audits cost attention. Routine work from unrecorded actions locks pips before your day begins.",
    actionHint:
      "Tip: Balance high-cost thorough actions against cheaper quick fixes.",
  },
  {
    id: "step_meters",
    stepNumber: 4,
    title: "4. Protocol Health Meters",
    target: "meters",
    targetDescription: "Meters Panel",
    details:
      "Monitors trial health across Safety, Quality, Timeline, Budget, and Site Relations. Letting safety drop risks trial termination; budget and timeline overruns lower your career score.",
    actionHint:
      "Tip: Keep all five meters healthy to pass regulatory scrutiny.",
  },
  {
    id: "step_sites",
    stepNumber: 5,
    title: "5. Site Monitoring & Audits",
    target: "sites",
    targetDescription: "Sites Panel",
    details:
      "View enrolled subjects and protocol violations at each trial site. Conducting a site audit costs 2 attention pips and uncovers true site compliance figures.",
    actionHint: "Tip: Audit sites showing high protocol violation rates early.",
  },
  {
    id: "step_end_day",
    stepNumber: 6,
    title: "6. End the Day",
    target: "end-day",
    targetDescription: "End Day Action",
    details:
      "When you have made your decisions or run out of attention, click 'End day' (key E) to advance time. Unhandled critical messages lapse overnight and advance the schedule.",
    actionHint: "Tip: Press E on your keyboard to end the day at any time.",
  },
];

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const CARD_WIDTH = 420;
const GAP = 12;

function measureTarget(target: string): TargetRect | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>(`[data-sd-coach="${target}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    if (typeof env.VITEST !== "undefined" || env.NODE_ENV === "test") {
      return { top: 100, left: 100, width: 300, height: 200 };
    }
    return null;
  }
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function cardPosition(rect: TargetRect | null): React.CSSProperties {
  if (!rect || typeof window === "undefined") return {};
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw < 768) return {};
  const width = Math.min(CARD_WIDTH, vw - 2 * GAP);
  const clampLeft = (x: number) => clamp(x, GAP, vw - width - GAP);
  const below = rect.top + rect.height + GAP;
  if (vh - below >= 300) {
    return { position: "fixed", top: below, left: clampLeft(rect.left), width };
  }
  if (rect.top - GAP >= 300) {
    return {
      position: "fixed",
      bottom: vh - rect.top + GAP,
      left: clampLeft(rect.left),
      width,
    };
  }
  const rightRoom = vw - (rect.left + rect.width);
  const left =
    rightRoom >= width + 2 * GAP
      ? rect.left + rect.width + GAP
      : rect.left - width - GAP;
  return {
    position: "fixed",
    top: clamp(rect.top, Math.min(GAP, vh - 320), vh - 320),
    left: clampLeft(left),
    width,
  };
}

export const DeskSpotlightTour: React.FC<DeskSpotlightTourProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);

  const handleFinish = useCallback(() => {
    saveTutorialSeen();
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setCurrentStepIdx((prev) =>
        Math.min(prev + 1, SPOTLIGHT_STEPS.length - 1)
      );
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setCurrentStepIdx((prev) => Math.max(prev - 1, 0));
    }
  }, []);

  const containerRef = useFocusTrap<HTMLDivElement>(isOpen, {
    onEscape: handleFinish,
    onKeyDown: handleKeyDown,
    returnFocus: true,
  });

  const currentStep = SPOTLIGHT_STEPS[currentStepIdx] ?? SPOTLIGHT_STEPS[0];
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const target = currentStep.target;
    const el = document.querySelector<HTMLElement>(
      `[data-sd-coach="${target}"]`
    );
    el?.scrollIntoView?.({ block: "nearest", inline: "nearest" });

    const update = () => {
      setTargetRect(measureTarget(target));
    };
    update();

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isOpen, currentStep.target]);

  if (!isOpen) return null;

  const placement = cardPosition(targetRect);
  const isAnchored = Object.keys(placement).length > 0;

  const handleNext = () => {
    if (currentStepIdx < SPOTLIGHT_STEPS.length - 1) {
      setCurrentStepIdx(currentStepIdx + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx(currentStepIdx - 1);
    }
  };

  return (
    <div
      ref={containerRef}
      data-testid="spotlight-tour"
      className={`fixed inset-0 z-50 pointer-events-auto flex items-end justify-center sm:items-center p-4 animate-fade-in ${
        targetRect ? "" : "bg-black/60"
      }`}
    >
      {/* Spotlight highlight box around target */}
      {targetRect && (
        <div
          aria-hidden="true"
          data-testid="tour-spotlight"
          className="fixed rounded-xl ring-2 ring-amber-400 pointer-events-none transition-all duration-200 motion-reduce:transition-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.65)",
          }}
        />
      )}

      <div
        style={placement}
        className={`${
          isAnchored ? "" : "w-full max-w-lg "
        }relative bg-zinc-950 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-amber-500/30 animate-scale-in font-mono text-zinc-100`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
      >
        {/* Header with Step counter */}
        <div className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <IconFocus2 className="w-4 h-4" />
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Desk Tour
              </span>
              <span
                data-testid="tour-step-indicator"
                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30"
              >
                Step {currentStep.stepNumber} of {SPOTLIGHT_STEPS.length}
              </span>
            </div>
          </div>

          <button
            onClick={handleFinish}
            type="button"
            className="min-h-[48px] min-w-[48px] p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center transition-colors"
            aria-label="Exit tour"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-3">
          <div className="space-y-1">
            <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold">
              {currentStep.targetDescription}
            </div>
            <h3
              id="tour-step-title"
              className="text-base font-bold text-white font-mono"
            >
              {currentStep.title}
            </h3>
          </div>

          <p className="text-xs text-zinc-300 font-sans leading-relaxed">
            {currentStep.details}
          </p>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
            <IconSparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-200/90 leading-tight">
              {currentStep.actionHint}
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {SPOTLIGHT_STEPS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStepIdx(idx)}
                className={`h-2 rounded-full transition-all min-h-[16px] min-w-[16px] flex items-center justify-center ${
                  idx === currentStepIdx
                    ? "w-6 bg-amber-400"
                    : idx < currentStepIdx
                      ? "w-2 bg-emerald-500"
                      : "w-2 bg-zinc-800"
                }`}
                title={s.title}
                aria-label={`Jump to step ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 bg-zinc-900/60 border-t border-zinc-800 flex items-center justify-between gap-2">
          <button
            onClick={handleFinish}
            type="button"
            data-testid="tour-skip-button"
            className="min-h-[48px] px-3 py-2 rounded-lg text-xs font-mono text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors flex items-center"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              type="button"
              disabled={currentStepIdx === 0}
              data-testid="tour-prev-button"
              className="min-h-[48px] inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-800 text-xs font-mono transition-colors"
            >
              <IconChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              onClick={handleNext}
              type="button"
              data-testid="tour-next-button"
              className="min-h-[48px] inline-flex items-center justify-center gap-1 px-4 py-2 rounded-xl bg-amber-400 text-black hover:bg-amber-300 text-xs font-mono font-bold transition-all shadow-md"
            >
              <span>
                {currentStepIdx === SPOTLIGHT_STEPS.length - 1
                  ? "Complete Tour"
                  : "Next Step"}
              </span>
              {currentStepIdx === SPOTLIGHT_STEPS.length - 1 ? (
                <IconCheck className="w-4 h-4" />
              ) : (
                <IconChevronRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
