"use client";

import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  IconArrowRight,
  IconCalendar,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface NeuroSuccessDialogProps {
  isOpen: boolean;
  message: string;
  eulerCharacteristic: number;
  diceScore: number;
  reward: number;
  onStay: () => void;
  onAdvance: () => void;
  onSchedule: () => void;
}

const SuccessDialogBody: React.FC<Omit<NeuroSuccessDialogProps, "isOpen">> = ({
  message,
  eulerCharacteristic,
  diceScore,
  reward,
  onStay,
  onAdvance,
  onSchedule,
}) => {
  const reduceMotion = useReducedMotion();
  const advanceRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(true, {
    onEscape: onStay,
    initialFocusRef: advanceRef,
  });

  return (
    <motion.div
      initial={{ opacity: reduceMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: reduceMotion ? 1 : 0 }}
      transition={reduceMotion ? { duration: 0 } : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md"
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="neuro-success-title"
        aria-describedby="neuro-success-desc"
        tabIndex={-1}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.9, y: 20 }}
        transition={reduceMotion ? { duration: 0 } : undefined}
        className="w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-zinc-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-5 text-center relative"
      >
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-inner">
          <IconShieldCheck className="w-8 h-8" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">
            SIMULATED RECON PASS
          </span>
          <h2
            id="neuro-success-title"
            className="text-xl font-bold text-white font-mono"
          >
            Scenario Target Reached
          </h2>
          <p
            id="neuro-success-desc"
            className="text-xs text-zinc-300 leading-relaxed font-sans break-words"
          >
            {message}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 bg-zinc-950 p-3 rounded-2xl border border-zinc-800 text-xs font-mono">
          <div className="min-w-0">
            <div className="text-zinc-400">EULER EST.</div>
            <div className="font-bold text-emerald-400">
              χ = {eulerCharacteristic}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-zinc-400">DICE EST.</div>
            <div className="font-bold text-brand-cyan">
              {(diceScore * 100).toFixed(1)}%
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-zinc-400">SCORE</div>
            <div className="font-bold text-amber-400">+{reward} PTS</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <a
            href="/schedule"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onSchedule}
            className="flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-mono font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all"
          >
            <IconCalendar className="w-4 h-4" aria-hidden="true" />
            <span>Schedule Consultation</span>
          </a>
          <button
            type="button"
            onClick={onStay}
            className="px-4 py-2.5 min-h-[44px] rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono transition-all"
          >
            Stay in Current Case
          </button>
          <button
            ref={advanceRef}
            type="button"
            onClick={onAdvance}
            className="flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-brand-cyan hover:bg-brand-cyan/90 text-zinc-950 font-mono font-bold text-xs shadow-lg shadow-brand-cyan/20 transition-all"
          >
            <span>Advance Next Case</span>
            <IconArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/**
 * Modal result dialog shown when a simulated recon meets the scenario target.
 * Traps focus, closes on Escape (stay in case) and restores focus on close.
 */
export const NeuroSuccessDialog: React.FC<NeuroSuccessDialogProps> = ({
  isOpen,
  ...rest
}) => {
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {isOpen && <SuccessDialogBody key="neuro-success-dialog" {...rest} />}
    </AnimatePresence>,
    document.body
  );
};
