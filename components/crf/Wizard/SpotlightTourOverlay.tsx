"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  IconX,
  IconChevronRight,
  IconChevronLeft,
  IconSparkles,
  IconCheck,
  IconFocus2,
} from "@tabler/icons-react";

interface SpotlightTourOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TourStep {
  id: string;
  stepNumber: number;
  title: string;
  /** `data-tour` value of the element this step points at. */
  target: string;
  targetDescription: string;
  details: string;
  actionHint: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "step_navigator",
    stepNumber: 1,
    title: "1. Study navigator",
    target: "navigator",
    targetDescription: "Left panel: Spine, Forms and Palette",
    details:
      "Spine lists the study's visits and the forms collected at each one. Forms lists every form in the study. Palette holds the field types: click one to add it to the open form.",
    actionHint:
      "Tip: the '+ CDASH Form' button in the header adds a standard form such as Demographics or Adverse Events in one click.",
  },
  {
    id: "step_canvas",
    stepNumber: 2,
    title: "2. Form canvas",
    target: "canvas",
    targetDescription: "Center: the form you are building",
    details:
      "The form is laid out on a 12-column grid. Click a field to select it, use - and + to change its width, and use the section arrows to reorder sections.",
    actionHint:
      "Tip: switch between Desktop, Tablet and ePRO Mobile at the top of the canvas to preview each layout.",
  },
  {
    id: "step_inspector",
    stepNumber: 3,
    title: "3. Inspector",
    target: "inspector",
    targetDescription: "Right panel: settings for the selected field or form",
    details:
      "Set the question text, data type, width, required behavior and allowed range. Edit Checks holds validation and show/hide rules, and CDASH / aCRF holds the SDTM mapping.",
    actionHint:
      "Tip: select any field on the canvas to load its settings here.",
  },
  {
    id: "step_modes",
    stepNumber: 4,
    title: "4. Studio modes",
    target: "modes",
    targetDescription: "Mode bar: other views of the same study",
    details:
      "Form Grid edits the open form as a table. Matrix (SoA) shows which forms are collected at which visit. AST Rules shows the edit checks as a graph. Live EDC lets you enter test data as a site would. aCRF Viewer shows the annotated CRF, and Exports downloads the study.",
    actionHint:
      "Tip: press 1 to 7 to jump between the modes in the order shown.",
  },
  {
    id: "step_conformance",
    stepNumber: 5,
    title: "5. CDISC conformance",
    target: "conformance",
    targetDescription: "Header: conformance check",
    details:
      "The studio checks the study against CDISC CDASH and SDTM rules as you edit. It reads 'Verified' when nothing is wrong, or shows the number of issues found.",
    actionHint:
      "Tip: click it to open the diagnostics drawer, where most issues have a one-click fix.",
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
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Places the step card beside its target: below it when there is room,
 * otherwise above, otherwise to whichever side is wider. Without a target
 * (mobile, collapsed panel) the card is centered.
 */
function cardPosition(rect: TargetRect | null): React.CSSProperties {
  if (!rect || typeof window === "undefined") return {};
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw < 768) return {};
  const width = Math.min(CARD_WIDTH, vw - 2 * GAP);
  const clampLeft = (x: number) => Math.min(Math.max(x, GAP), vw - width - GAP);
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
    top: Math.min(Math.max(rect.top, GAP), vh - 320),
    left: clampLeft(left),
    width,
  };
}

export const SpotlightTourOverlay: React.FC<SpotlightTourOverlayProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setCurrentStepIdx((prev) => Math.min(prev + 1, TOUR_STEPS.length - 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setCurrentStepIdx((prev) => Math.max(prev - 1, 0));
    }
  }, []);

  const containerRef = useFocusTrap<HTMLDivElement>(isOpen, {
    onEscape: onClose,
    onKeyDown: handleKeyDown,
    returnFocus: true,
  });

  const currentStep = TOUR_STEPS[currentStepIdx];
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  // Follow the highlighted element through scrolling and resizing. Measuring
  // happens in an animation frame so the overlay reads settled layout.
  useEffect(() => {
    if (!isOpen) return;
    const target = currentStep.target;
    const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
    el?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setTargetRect(measureTarget(target)));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isOpen, currentStep.target]);

  if (!isOpen) return null;

  const placement = cardPosition(targetRect);
  const isAnchored = Object.keys(placement).length > 0;

  const handleNext = () => {
    if (currentStepIdx < TOUR_STEPS.length - 1) {
      setCurrentStepIdx(currentStepIdx + 1);
    } else {
      onClose();
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
      className={`fixed inset-0 z-50 pointer-events-auto flex items-end justify-center sm:items-center p-4 animate-fade-in ${
        targetRect ? "" : "bg-black/60"
      }`}
    >
      {/* Spotlight: a ring around the target whose huge shadow dims the rest
          of the page, so the described control stays visible and unblurred. */}
      {targetRect && (
        <div
          aria-hidden="true"
          data-testid="tour-spotlight"
          className="fixed rounded-xl ring-2 ring-brand-cyan pointer-events-none transition-all duration-200 motion-reduce:transition-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
          }}
        />
      )}
      <div
        style={placement}
        className={`${isAnchored ? "" : "w-full max-w-lg "}relative bg-zinc-950 border border-brand-cyan/40 rounded-3xl shadow-2xl overflow-hidden ring-1 ring-brand-cyan/30 animate-scale-in`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
      >
        {/* Header with Step indicator */}
        <div className="px-5 py-3.5 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30">
              <IconFocus2 className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Interactive UI Tour
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30">
                  Step {currentStep.stepNumber} of {TOUR_STEPS.length}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Exit tour"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-3.5">
          <div className="space-y-1">
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
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

          <div className="p-3 rounded-xl bg-brand-cyan/5 border border-brand-cyan/20 flex items-start gap-2">
            <IconSparkles className="w-4 h-4 text-brand-cyan shrink-0 mt-0.5" />
            <p className="text-[11px] font-mono text-brand-cyan/90 leading-tight">
              {currentStep.actionHint}
            </p>
          </div>

          {/* Step Progress Dots */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {TOUR_STEPS.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setCurrentStepIdx(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentStepIdx
                    ? "w-6 bg-brand-cyan"
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
        <div className="px-5 py-3.5 bg-zinc-900/60 border-t border-zinc-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs font-mono text-zinc-400 hover:text-white transition-colors"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={currentStepIdx === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-800 text-xs font-mono transition-colors"
            >
              <IconChevronLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              onClick={handleNext}
              className="inline-flex items-center gap-1 px-4 py-1.5 rounded-xl bg-brand-cyan text-black hover:bg-white text-xs font-mono font-bold transition-all shadow-md"
            >
              <span>
                {currentStepIdx === TOUR_STEPS.length - 1
                  ? "Complete Tour"
                  : "Next Step"}
              </span>
              {currentStepIdx === TOUR_STEPS.length - 1 ? (
                <IconCheck className="w-3.5 h-3.5" />
              ) : (
                <IconChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
