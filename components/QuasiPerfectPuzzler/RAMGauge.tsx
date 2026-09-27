"use client";

import React from "react";
import { clamp } from "@/lib/game-utils";
import { motion, useReducedMotion } from "framer-motion";

interface RAMGaugeProps {
  currentRam: number;
  initialRam: number;
}

export const RAMGauge: React.FC<RAMGaugeProps> = ({
  currentRam,
  initialRam,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const percentage = clamp((currentRam / initialRam) * 100, 0, 100);
  const isOOM = currentRam <= 0;
  const isLowMemory = currentRam > 0 && percentage <= 30;

  const getBarColor = () => {
    if (isOOM) return "bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.8)]";
    if (isLowMemory)
      return "bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]";
    return "bg-brand-cyan shadow-[0_0_15px_rgba(6,182,212,0.5)]";
  };

  const getStatusText = () => {
    if (isOOM) return "SIMULATED RAM EXHAUSTED";
    if (isLowMemory) return "HIGH MEMORY PRESSURE";
    return "SIMULATED RAM NOMINAL";
  };

  return (
    <div className="w-full flex flex-col gap-1.5 font-mono">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
            Simulated Memory:
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              isOOM
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                : isLowMemory
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
            }`}
          >
            {getStatusText()}
          </span>
        </div>

        <span className="font-bold text-zinc-200">
          <span
            className={
              isOOM
                ? "text-rose-400 font-extrabold"
                : isLowMemory
                  ? "text-amber-300 font-extrabold"
                  : "text-brand-cyan"
            }
          >
            {currentRam.toFixed(1)}
          </span>
          <span className="text-zinc-500"> / {initialRam} GB</span>
        </span>
      </div>

      {/* Progress Track */}
      <div className="h-2.5 w-full rounded-full bg-zinc-900 border border-zinc-800 p-0.5 overflow-hidden">
        <motion.div
          className={`h-full w-full rounded-full origin-left transform-gpu ${getBarColor()}`}
          initial={{ scaleX: percentage / 100 }}
          animate={{ scaleX: percentage / 100 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { ease: "easeOut", duration: 0.3 }
          }
          style={{ transformOrigin: "left", willChange: "transform" }}
        />
      </div>
    </div>
  );
};
