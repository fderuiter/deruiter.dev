"use client";

import React, {
  useEffect,
  useState,
  useSyncExternalStore,
  useCallback,
} from "react";
import { safeStorage, STORAGE_CHANGE_EVENT } from "@/lib/safe-storage";
import { IconSparkles, IconX, IconPlayerPlay } from "@tabler/icons-react";

/** Storage key for tracking whether the first-time proof tutorial coach tour has been seen. */
export const TUTORIAL_SEEN_KEY = "proof:tutorial-seen";

// Helpers for useSyncExternalStore
function subscribeTutorialSeen(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const handleStorage = (e: StorageEvent) => {
    if (!e.key || e.key === TUTORIAL_SEEN_KEY) callback();
  };
  const handleCustom = () => callback();
  window.addEventListener("storage", handleStorage);
  window.addEventListener(STORAGE_CHANGE_EVENT, handleCustom);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(STORAGE_CHANGE_EVENT, handleCustom);
  };
}

function getTutorialSeenSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const val = safeStorage.getItem<boolean>(TUTORIAL_SEEN_KEY, false);
    return Boolean(val);
  } catch {
    return false;
  }
}

function getTutorialSeenServerSnapshot(): boolean {
  return false;
}

/** Props for the ProofCoachTour component. */
interface ProofCoachTourProps {
  selectedNodeIds: string[];
  edges: Array<{ source: string; target: string; ruleApplied?: string }>;
  isE_Proven: boolean;
  activeTheoremId?: string;
  canvasWrapperRef: React.RefObject<HTMLDivElement | null>;
  onStartTour?: () => void;
  onResetAndStartTour: () => void;
}

interface TargetBox {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Interactive contextual coach mark tour overlay for the Proof Studio workspace.
 * Guides first-time users step-by-step through Modus Ponens formal logic deduction.
 */
export const ProofCoachTour: React.FC<ProofCoachTourProps> = ({
  selectedNodeIds,
  edges,
  isE_Proven,
  canvasWrapperRef,
  onResetAndStartTour,
}) => {
  const tutorialSeen = useSyncExternalStore(
    subscribeTutorialSeen,
    getTutorialSeenSnapshot,
    getTutorialSeenServerSnapshot
  );

  const [isTourActive, setIsTourActive] = useState(false);
  const [step, setStep] = useState<number>(1);
  const [targetBoxes, setTargetBoxes] = useState<TargetBox[]>([]);
  const [announcement, setAnnouncement] = useState("");

  const markTutorialSeen = useCallback(() => {
    safeStorage.setItem(TUTORIAL_SEEN_KEY, true);
  }, []);

  const announce = useCallback((text: string) => {
    setAnnouncement(text);
  }, []);

  const returnFocusToCanvas = useCallback(() => {
    if (canvasWrapperRef.current) {
      canvasWrapperRef.current.focus();
    }
  }, [canvasWrapperRef]);

  // Start Tour
  const handleStartGuidedProof = () => {
    onResetAndStartTour();
    setIsTourActive(true);
    setStep(1);
    announce(
      "Guided Modus Ponens proof tutorial started. Step 1 of 4: Select Premise Node A on the canvas."
    );
  };

  // Skip Tour
  const handleSkipTutorial = () => {
    setIsTourActive(false);
    setTargetBoxes([]);
    markTutorialSeen();
    announce("Tutorial skipped. Returning focus to proof workspace canvas.");
    returnFocusToCanvas();
  };

  // State machine for step transitions
  useEffect(() => {
    if (!isTourActive) return;

    queueMicrotask(() => {
      // Check step 1 -> step 2 / 3
      if (step === 1) {
        if (selectedNodeIds.includes("A") && selectedNodeIds.includes("B")) {
          setStep(3);
          announce(
            "Step 3 of 4: Both premises selected. Click Modus Ponens (MP) in the Rule Palette."
          );
        } else if (selectedNodeIds.includes("A")) {
          setStep(2);
          announce(
            "Step 2 of 4: Node A selected. Now click Premise Node B (P -> Q) to add it to your selection."
          );
        }
      } else if (step === 2) {
        if (selectedNodeIds.includes("A") && selectedNodeIds.includes("B")) {
          setStep(3);
          announce(
            "Step 3 of 4: Both premises selected. Click Modus Ponens (MP) in the Rule Palette."
          );
        }
      } else if (step === 3) {
        const hasC = edges.some(
          (e) => (e.source === "A" || e.source === "B") && e.target === "C"
        );
        if (hasC) {
          setStep(4);
          announce(
            "Step 4 of 4: Node C (Q) derived! Select Node C and Node D (Q -> R), then click Modus Ponens to discharge Conclusion R."
          );
        }
      } else if (step === 4) {
        if (isE_Proven) {
          // Completed!
          markTutorialSeen();
          announce(
            "Q.E.D. Victory! Tutorial completed successfully. You have discharged the Modus Ponens proof."
          );
          setTimeout(() => {
            setIsTourActive(false);
            setTargetBoxes([]);
            returnFocusToCanvas();
          }, 3000);
        }
      }
    });
  }, [
    isTourActive,
    step,
    selectedNodeIds,
    edges,
    isE_Proven,
    markTutorialSeen,
    announce,
    returnFocusToCanvas,
  ]);

  // Recalculate outline box positions when step, nodes or active view change
  useEffect(() => {
    if (!isTourActive) return;

    const updateBoxes = () => {
      let targetSelectors: string[] = [];
      if (step === 1) targetSelectors = ['[data-node-id="A"]'];
      else if (step === 2) targetSelectors = ['[data-node-id="B"]'];
      else if (step === 3) targetSelectors = ['[data-rule="mp"]'];
      else if (step === 4)
        targetSelectors = [
          '[data-node-id="C"]',
          '[data-node-id="D"]',
          '[data-rule="mp"]',
        ];

      const wrapper = canvasWrapperRef.current;
      const boxes: TargetBox[] = [];

      targetSelectors.forEach((sel) => {
        const els = document.querySelectorAll(sel);
        els.forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (wrapper) {
            const wrapRect = wrapper.getBoundingClientRect();
            boxes.push({
              id: sel,
              left: rect.left - wrapRect.left + wrapper.scrollLeft,
              top: rect.top - wrapRect.top + wrapper.scrollTop,
              width: rect.width,
              height: rect.height,
            });
          } else {
            boxes.push({
              id: sel,
              left: rect.left + window.scrollX,
              top: rect.top + window.scrollY,
              width: rect.width,
              height: rect.height,
            });
          }
        });
      });

      setTargetBoxes(boxes);
    };

    updateBoxes();
    const interval = setInterval(updateBoxes, 250);
    window.addEventListener("resize", updateBoxes);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", updateBoxes);
    };
  }, [isTourActive, step, canvasWrapperRef]);

  return (
    <>
      {/* Screen reader live announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Non-blocking First-Time Offer Banner */}
      {!tutorialSeen && !isTourActive && (
        <div
          data-testid="proof-tutorial-banner"
          className="mb-4 p-3.5 rounded-xl border border-amber-400/60 bg-brand-dark/95 backdrop-blur text-amber-300 font-mono shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs z-20 transition-all"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-400/40 shrink-0">
              <IconSparkles className="w-4 h-4" />
            </span>
            <div>
              <span className="font-bold text-amber-300 text-sm block">
                First time in the Proof Studio?
              </span>
              <span className="text-slate-300 text-[11px] block">
                Learn node selection, inference rules, and Q.E.D. logic
                verification with an interactive 4-step walkthrough.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleStartGuidedProof}
              className="px-3.5 py-1.5 rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 font-bold font-mono text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-md shadow-amber-500/20"
            >
              <IconPlayerPlay className="w-3.5 h-3.5 fill-current" />
              Start Guided Proof
            </button>
            <button
              type="button"
              onClick={handleSkipTutorial}
              className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 font-mono text-xs transition cursor-pointer"
            >
              Skip Tutorial
            </button>
          </div>
        </div>
      )}

      {/* Active Coach Mark Tour Overlay */}
      {isTourActive && (
        <div className="relative z-30 mb-4">
          {/* Header Step Callout Ribbon */}
          <div
            data-testid="proof-coach-callout"
            className="p-3.5 rounded-xl border border-amber-400/80 bg-slate-950/95 text-slate-100 font-mono shadow-2xl flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/60 text-amber-300 font-bold text-xs uppercase tracking-wider">
                {step === 4 && isE_Proven
                  ? "Q.E.D. Victory"
                  : `Step ${step} of 4`}
              </span>
              <div>
                <h4 className="font-bold text-amber-300 text-sm">
                  {step === 1 && "Select Premise Node A (P)"}
                  {step === 2 && "Select Premise Node B (P → Q)"}
                  {step === 3 && "Fire Modus Ponens (MP) Inference"}
                  {step === 4 &&
                    (isE_Proven
                      ? "Q.E.D. Theorem Discharged!"
                      : "Discharge Final Conclusion R")}
                </h4>
                <p className="text-slate-300 text-xs">
                  {step === 1 &&
                    "Click Node A on the canvas to highlight Premise P."}
                  {step === 2 &&
                    "Click Node B to select Premise P → Q alongside Node A."}
                  {step === 3 &&
                    "Click MP in the Rule Palette to derive Node C (Q)."}
                  {step === 4 &&
                    (isE_Proven
                      ? "Congratulations! All deduction paths satisfied."
                      : "Select Node C and Node D, then click MP to resolve Conclusion R.")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSkipTutorial}
                className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono transition cursor-pointer flex items-center gap-1"
              >
                <IconX className="w-3.5 h-3.5" />
                Skip Tour
              </button>
            </div>
          </div>

          {/* Dynamic 2px Amber Target Outline Highlights */}
          {targetBoxes.map((box, idx) => (
            <div
              key={`target-highlight-${idx}`}
              className="absolute pointer-events-none z-40 transition-all duration-300 rounded-xl border-2 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-pulse"
              style={{
                left: box.left - 4,
                top: box.top - 4,
                width: box.width + 8,
                height: box.height + 8,
              }}
            >
              <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center justify-center shadow-md animate-bounce">
                {step}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
