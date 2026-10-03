"use client";

import React from "react";
import { clamp } from "@/lib/game-utils";
import { ramChipFill } from "./boardArt";

interface RAMGaugeProps {
  currentRam: number;
  initialRam: number;
}

const CHIPS = 8;

/**
 * Simulated RAM as a memory stick: eight chips that empty from the right as
 * tactics spend memory, gold contact pins along the bottom, and the exact
 * readout beside it. Indigo while nominal, amber under pressure, red when
 * exhausted. Each chip's fill is a scaleX transform, so a spend animates
 * on the compositor (and not at all under reduced motion).
 */
export const RAMGauge: React.FC<RAMGaugeProps> = ({
  currentRam,
  initialRam,
}) => {
  const percentage =
    initialRam > 0 ? clamp((currentRam / initialRam) * 100, 0, 100) : 0;
  const isOOM = currentRam <= 0;
  const isLowMemory = currentRam > 0 && percentage <= 30;
  const tone = isOOM ? "out" : isLowMemory ? "low" : "nominal";
  const fills = ramChipFill(currentRam, initialRam, CHIPS);

  const statusText = isOOM
    ? "SIMULATED RAM EXHAUSTED"
    : isLowMemory
      ? "HIGH MEMORY PRESSURE"
      : "SIMULATED RAM NOMINAL";

  return (
    <div className="w-full flex flex-col gap-1 font-mono">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs">
        <span className="text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
          Simulated Memory:
        </span>
        <span className="font-bold text-zinc-200 tabular-nums">
          <span
            className={
              isOOM
                ? "text-rose-300 font-extrabold"
                : isLowMemory
                  ? "text-amber-300 font-extrabold"
                  : "qp-text-accent-strong"
            }
          >
            {currentRam.toFixed(1)}
          </span>
          <span className="text-zinc-400"> / {initialRam} GB</span>
        </span>
      </div>

      {/* The stick */}
      <div
        role="meter"
        aria-label="Simulated RAM"
        aria-valuemin={0}
        aria-valuemax={initialRam}
        aria-valuenow={Math.max(0, Number(currentRam.toFixed(1)))}
        aria-valuetext={`${currentRam.toFixed(1)} of ${initialRam} GB, ${statusText.toLowerCase()}`}
        className="qp-stick relative rounded-md px-1.5 pt-1.5 pb-2"
      >
        <div className="flex gap-1">
          {fills.map((fill, i) => (
            <div
              key={i}
              className="qp-stick-chip relative h-3.5 flex-1 overflow-hidden rounded-[3px]"
            >
              <div
                data-tone={tone}
                className="qp-stick-fill absolute inset-0 origin-left"
                style={{ transform: `scaleX(${fill})` }}
              />
            </div>
          ))}
        </div>
        <div
          aria-hidden="true"
          className="qp-stick-pins absolute inset-x-2 bottom-0.5 h-1 rounded-sm"
        />
        {/* Key notch */}
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-[38%] h-1.5 w-1.5 rounded-t-sm bg-[color:var(--qp-stage)]"
        />
      </div>

      <span
        className={`self-start text-[10px] font-bold tracking-wider ${
          isOOM
            ? "text-rose-300"
            : isLowMemory
              ? "text-amber-300"
              : "text-zinc-400"
        }`}
      >
        {statusText}
      </span>
    </div>
  );
};
