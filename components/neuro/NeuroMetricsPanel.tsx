"use client";

import React from "react";
import { clamp } from "@/lib/game-utils";
import { QAMetrics, ScenarioConfig, ScoreState } from "@/lib/neuro/types";
import {
  IconFlame,
  IconTrophy,
  IconShieldCheck,
  IconCircleDot,
  IconAlertTriangle,
} from "@tabler/icons-react";

interface NeuroMetricsPanelProps {
  scenario: ScenarioConfig;
  metrics: QAMetrics;
  scoreState: ScoreState;
}

export const NeuroMetricsPanel: React.FC<NeuroMetricsPanelProps> = ({
  scenario,
  metrics,
  scoreState,
}) => {
  const isEulerOk = metrics.eulerCharacteristic === scenario.targetEuler;

  return (
    <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
      {/* 1. Euler Characteristic χ */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 p-3 rounded-2xl flex flex-col justify-between min-w-0 break-words">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs font-mono text-zinc-400 min-w-0">
          <span>EULER ESTIMATE (χ)</span>
          <span className="text-[10px] text-zinc-400">
            TARGET: {scenario.targetEuler}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`text-xl font-mono font-bold whitespace-nowrap ${
              isEulerOk ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            χ = {metrics.eulerCharacteristic}
          </span>
          {isEulerOk ? (
            <IconShieldCheck className="w-4 h-4 text-emerald-400" />
          ) : (
            <IconAlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
          )}
        </div>
        <div className="text-[10px] font-mono text-zinc-400 mt-1">
          Scenario-based topology estimate
        </div>
      </div>

      {/* 2. Defect Count */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 p-3 rounded-2xl flex flex-col justify-between min-w-0 break-words">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs font-mono text-zinc-400 min-w-0">
          <span>DEFECT UNITS (EST.)</span>
          <span className="text-[10px] text-zinc-400">
            INITIAL: {scenario.initialDefects}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`text-xl font-mono font-bold ${
              metrics.defectCount === 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {metrics.defectCount}
          </span>
          <span className="text-xs font-mono text-zinc-400">remaining</span>
        </div>
        <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-1">
          <div
            data-testid="defect-progress-bar"
            className="bg-brand-cyan h-full w-full origin-left transform-gpu"
            style={{
              transform: `scaleX(${clamp(
                scenario.initialDefects > 0
                  ? (scenario.initialDefects - metrics.defectCount) /
                      scenario.initialDefects
                  : 1,
                0,
                1
              )})`,
              transformOrigin: "left",
              willChange: "transform",
            }}
          />
        </div>
      </div>

      {/* 3. Dice Similarity Coefficient */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 p-3 rounded-2xl flex flex-col justify-between min-w-0 break-words">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs font-mono text-zinc-400 min-w-0">
          <span>DICE ESTIMATE</span>
          <span className="text-[10px] text-zinc-400">
            GOAL: ≥{(scenario.targetDice * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className={`text-xl font-mono font-bold ${
              metrics.diceScore >= scenario.targetDice
                ? "text-emerald-400"
                : "text-brand-cyan"
            }`}
          >
            {(metrics.diceScore * 100).toFixed(1)}%
          </span>
        </div>
        <div className="text-[10px] font-mono text-zinc-400 mt-1">
          Simulated trend; no reference mask
        </div>
      </div>

      {/* 4. Cortical Thickness Estimate */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 p-3 rounded-2xl flex flex-col justify-between min-w-0 break-words">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs font-mono text-zinc-400 min-w-0">
          <span>THICKNESS ESTIMATE</span>
          <span className="text-[10px] text-zinc-400">MEAN</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-xl font-mono font-bold text-white">
            {metrics.meanCorticalThicknessMm.toFixed(2)}
          </span>
          <span className="text-xs font-mono text-zinc-400">mm</span>
        </div>
        <div className="text-[10px] font-mono text-zinc-400 mt-1">
          Scenario interpolation, not measured
        </div>
      </div>

      {/* 5. Score & Streak */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 p-3 rounded-2xl flex flex-col justify-between min-w-0 break-words">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs font-mono text-zinc-400 min-w-0">
          <span>QA SCORE</span>
          <div className="flex items-center gap-1 text-amber-400 font-bold">
            <IconFlame className="w-3.5 h-3.5" />
            <span>{scoreState.multiplier}x</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <IconTrophy className="w-5 h-5 text-amber-400" />
          <span className="text-xl font-mono font-bold text-amber-400">
            {scoreState.score.toLocaleString()}
          </span>
        </div>
        <div className="text-[10px] font-mono text-zinc-400 mt-1">
          Streak: {scoreState.streak} clean cases
        </div>
      </div>

      {/* 6. Pipeline Resolution Status */}
      <div
        className={`p-3 rounded-2xl border flex flex-col justify-between transition-colors ${
          metrics.isResolved
            ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-400"
            : "bg-zinc-900/80 border-zinc-800/80 text-zinc-400"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs font-mono min-w-0">
          <span>STATUS</span>
          <IconCircleDot
            className={`w-3.5 h-3.5 ${
              metrics.isResolved
                ? "text-emerald-400 animate-ping"
                : "text-zinc-400"
            }`}
          />
        </div>
        <div className="mt-1">
          <span
            className={`text-sm font-mono font-bold uppercase tracking-wider ${
              metrics.isResolved ? "text-emerald-400" : "text-zinc-300"
            }`}
          >
            {metrics.isResolved ? "SIMULATION PASS" : "INSPECTION ACTIVE"}
          </span>
        </div>
        <div className="text-[10px] font-mono mt-1">
          {metrics.isResolved
            ? "Scenario target reached"
            : "Apply manual edits & re-run"}
        </div>
      </div>
    </div>
  );
};
