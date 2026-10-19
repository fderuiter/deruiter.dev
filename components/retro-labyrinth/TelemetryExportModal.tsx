"use client";

import React, { useEffect } from "react";
import {
  IconX,
  IconDownload,
  IconActivity,
  IconTable,
  IconCode,
} from "@tabler/icons-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  downloadTelemetryFile,
  type RunTelemetryData,
} from "@/lib/retro-labyrinth/telemetry";

interface TelemetryExportModalProps {
  telemetry: RunTelemetryData;
  onClose: () => void;
}

export const TelemetryExportModal: React.FC<TelemetryExportModalProps> = ({
  telemetry,
  onClose,
}) => {
  const modalRef = useFocusTrap<HTMLDivElement>(true, { onEscape: onClose });

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const { summary, stepTrajectories, combatLogs } = telemetry;

  return (
    <div
      className="fixed inset-0 bg-neutral-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Run Telemetry Exporter"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-3xl bg-neutral-900 border border-amber-500/30 rounded-xl shadow-2xl p-4 sm:p-6 text-zinc-100 relative max-h-[90vh] flex flex-col overflow-hidden outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <IconActivity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-amber-400 uppercase tracking-wider">
                GAMEPLAY TELEMETRY LOGS & EXPORTER
              </h2>
              <p className="text-xs text-neutral-400">
                Inspect run statistics, movement step trajectories, and combat
                log actions.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close telemetry exporter"
            className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto my-3 space-y-4 pr-1 text-xs">
          {/* Summary Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-neutral-950 p-3 rounded-lg border border-neutral-800">
            <div>
              <span className="text-neutral-500 block">Run Status</span>
              <span className="font-bold text-amber-300 capitalize">
                {summary.finalStatus}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block">Final Score</span>
              <span className="font-bold text-emerald-400">
                {summary.finalScore}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block">Total Steps</span>
              <span className="font-bold text-cyan-300">
                {summary.totalSteps}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block">Duration</span>
              <span className="font-bold text-zinc-200">
                {(summary.durationMs / 1000).toFixed(1)}s
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block">Enemies Defeated</span>
              <span className="font-bold text-red-400">
                {summary.enemiesDefeated}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block">Items Collected</span>
              <span className="font-bold text-yellow-300">
                {summary.itemsCollected}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block">Damage Dealt</span>
              <span className="font-bold text-orange-400">
                {summary.damageDealt}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block">Damage Taken</span>
              <span className="font-bold text-rose-400">
                {summary.damageTaken}
              </span>
            </div>
          </div>

          {/* Trajectories Preview */}
          <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <IconTable className="w-4 h-4 text-cyan-400" />
                Step Trajectories ({stepTrajectories.length} steps recorded)
              </span>
            </div>
            {stepTrajectories.length === 0 ? (
              <p className="text-neutral-500 italic">
                No movement step trajectory data recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px] text-zinc-300 border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-500">
                      <th className="pb-1 pr-2">Step</th>
                      <th className="pb-1 pr-2">Position (X, Y)</th>
                      <th className="pb-1 pr-2">Delta (DX, DY)</th>
                      <th className="pb-1 pr-2">Player HP</th>
                      <th className="pb-1 pr-2">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stepTrajectories.slice(0, 5).map((step) => (
                      <tr
                        key={step.stepIndex}
                        className="border-b border-neutral-900/60"
                      >
                        <td className="py-1 pr-2 text-cyan-400">
                          #{step.stepIndex}
                        </td>
                        <td className="py-1 pr-2">
                          ({step.x}, {step.y})
                        </td>
                        <td className="py-1 pr-2">
                          ({step.dx}, {step.dy})
                        </td>
                        <td className="py-1 pr-2 text-emerald-400">
                          {step.playerHp} HP
                        </td>
                        <td className="py-1 pr-2">{step.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {stepTrajectories.length > 5 && (
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Showing first 5 of {stepTrajectories.length} step entries.
                    Download full export file for complete dataset.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Combat Actions Log Preview */}
          <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <IconActivity className="w-4 h-4 text-amber-400" />
                Combat & Game Actions Log ({combatLogs.length} actions)
              </span>
            </div>
            {combatLogs.length === 0 ? (
              <p className="text-neutral-500 italic">
                No combat actions recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px] text-zinc-300 border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-500">
                      <th className="pb-1 pr-2">Index</th>
                      <th className="pb-1 pr-2">Action Type</th>
                      <th className="pb-1 pr-2">Target / Weapon</th>
                      <th className="pb-1 pr-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combatLogs.slice(0, 5).map((log) => (
                      <tr
                        key={log.actionIndex}
                        className="border-b border-neutral-900/60"
                      >
                        <td className="py-1 pr-2 text-amber-400">
                          #{log.actionIndex}
                        </td>
                        <td className="py-1 pr-2 font-bold uppercase text-[10px] text-zinc-200">
                          {log.actionType}
                        </td>
                        <td className="py-1 pr-2 text-neutral-400">
                          {log.weaponId || log.enemyType || "—"}
                        </td>
                        <td className="py-1 pr-2 text-neutral-300">
                          {log.details || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {combatLogs.length > 5 && (
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Showing first 5 of {combatLogs.length} combat action
                    entries. Download full export file for complete log.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadTelemetryFile(telemetry, "json")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-black font-bold cursor-pointer transition-colors shadow-md"
            >
              <IconCode className="w-4 h-4" />
              Download JSON Telemetry
            </button>
            <button
              type="button"
              onClick={() => downloadTelemetryFile(telemetry, "csv")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer transition-colors shadow-md"
            >
              <IconDownload className="w-4 h-4" />
              Download CSV Telemetry
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-zinc-100 font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
