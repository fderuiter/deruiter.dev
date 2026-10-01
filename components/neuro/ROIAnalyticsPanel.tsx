"use client";

import React, { useEffect, useRef } from "react";
import {
  HistogramStats,
  QAAnomalyAlert,
  ROIRegionStats,
  VoxelCoord,
} from "@/lib/neuro/types";
import { formatNumber } from "@/lib/utils";
import {
  IconActivity,
  IconAlertTriangle,
  IconChartBar,
  IconCpu,
  IconMapPin,
  IconTarget,
} from "@tabler/icons-react";

interface ROIAnalyticsPanelProps {
  histogram?: HistogramStats | null;
  roiStats?: ROIRegionStats | null;
  qaAlerts?: QAAnomalyAlert[];
  scanDurationMs?: number;
  onJumpToCoord?: (coord: VoxelCoord) => void;
}

export const ROIAnalyticsPanel: React.FC<ROIAnalyticsPanelProps> = ({
  histogram,
  roiStats,
  qaAlerts = [],
  scanDurationMs,
  onJumpToCoord,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render 256-bin histogram canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !histogram) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const bins = histogram.bins;
    let maxBinVal = 1;
    for (let i = 0; i < 256; i++) {
      if (bins[i] > maxBinVal) maxBinVal = bins[i];
    }

    // Background grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw bars
    const barWidth = width / 256;
    ctx.fillStyle = "rgba(0, 245, 212, 0.75)"; // Cyan
    for (let i = 0; i < 256; i++) {
      const binVal = bins[i];
      if (binVal === 0) continue;
      const barHeight = Math.max(2, (binVal / maxBinVal) * (height - 10));
      const x = i * barWidth;
      const y = height - barHeight;

      if (i === histogram.mode) {
        ctx.fillStyle = "rgba(245, 158, 11, 0.95)"; // Amber peak mode
      } else {
        ctx.fillStyle = "rgba(0, 245, 212, 0.75)";
      }
      ctx.fillRect(x, y, Math.max(1, barWidth), barHeight);
    }
  }, [histogram]);

  return (
    <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-4 flex flex-col gap-4 text-xs font-mono">
      {/* Header Telemetry Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <IconActivity className="w-4 h-4 text-brand-cyan" />
          <span className="font-bold text-white uppercase tracking-wider">
            Worker-Mesh & ROI Analytics Engine
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan px-2.5 py-1 rounded-lg text-[10px]">
            <IconCpu className="w-3 h-3 animate-pulse" />
            <span>OFFLOADED TO WEB WORKER · ZERO-COPY TRANSFERABLE</span>
          </span>
          {scanDurationMs !== undefined && scanDurationMs > 0 && (
            <span className="text-[10px] text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-lg">
              SCAN: {scanDurationMs} ms
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Panel 1: 256-Bin Signal Intensity Histogram */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-brand-cyan font-bold">
              <IconChartBar className="w-4 h-4" />
              <span>256-BIN INTENSITY HISTOGRAM</span>
            </div>
            {histogram && (
              <span className="text-[10px] text-zinc-400">
                PEAK MODE: {histogram.mode} INT
              </span>
            )}
          </div>

          <div className="relative w-full h-28 bg-black rounded-lg border border-zinc-800 overflow-hidden flex items-center justify-center">
            <canvas
              ref={canvasRef}
              role="img"
              tabIndex={0}
              aria-label="256-bin signal intensity histogram"
              width={256}
              height={112}
              className="w-full h-full object-cover"
            />
          </div>

          {histogram ? (
            <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
              <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/60">
                <div className="text-zinc-400 text-[9px]">MEAN ± STD</div>
                <div className="font-bold text-white">
                  {histogram.mean} ± {histogram.stdDev}
                </div>
              </div>
              <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/60">
                <div className="text-zinc-400 text-[9px]">MEDIAN INT</div>
                <div className="font-bold text-brand-cyan">
                  {histogram.median}
                </div>
              </div>
              <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/60">
                <div className="text-zinc-400 text-[9px]">MIN / MAX</div>
                <div className="font-bold text-amber-400">
                  {histogram.min} / {histogram.max}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-zinc-400 text-xs py-3">
              Calculating 256-bin signal histogram...
            </div>
          )}
        </div>

        {/* Panel 2: Region Growing ROI Segmentation Stats */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-purple-400 font-bold">
              <IconTarget className="w-4 h-4" />
              <span>3D REGION-GROWING ROI STATS</span>
            </div>
            <span className="text-[10px] text-zinc-400">[TOOL 5]</span>
          </div>

          {roiStats && roiStats.voxelCount > 0 ? (
            <div className="flex flex-col gap-2 pt-1">
              <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/60 flex items-center justify-between">
                <span className="text-zinc-400">SEED VOXEL:</span>
                <span className="font-bold text-purple-400">
                  ({roiStats.seed.x}, {roiStats.seed.y}, {roiStats.seed.z})
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/60">
                  <div className="text-zinc-400 text-[9px]">ROI VOLUME</div>
                  <div className="font-bold text-emerald-400">
                    {formatNumber(roiStats.volumeMm3)} mm³
                  </div>
                </div>
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/60">
                  <div className="text-zinc-400 text-[9px]">VOXEL COUNT</div>
                  <div className="font-bold text-white">
                    {formatNumber(roiStats.voxelCount)} voxels
                  </div>
                </div>
              </div>

              <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/60 text-[11px] flex justify-between">
                <span className="text-zinc-400">ROI MEAN INTENSITY:</span>
                <span className="font-bold text-brand-cyan">
                  {roiStats.meanIntensity} ± {roiStats.stdDevIntensity}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-zinc-400 gap-1.5">
              <IconMapPin className="w-6 h-6 text-zinc-400" />
              <p className="text-xs font-bold text-zinc-400">
                No Seed Voxel Selected
              </p>
              <p className="text-[10px]">
                Select tool [5] (ROI Region Grow) and click any voxel on the 2D
                slice view to perform automated 3D region growing.
              </p>
            </div>
          )}
        </div>

        {/* Panel 3: Continuous QA Anomaly Alert Feed with Jump Shortcuts */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold">
              <IconAlertTriangle className="w-4 h-4" />
              <span>REAL-TIME QA ANOMALY ALERTS</span>
            </div>
            <span className="text-[10px] text-zinc-400">
              {qaAlerts.length} DETECTED
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-44 flex flex-col gap-2 pr-1">
            {qaAlerts.length > 0 ? (
              qaAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-2.5 rounded-lg border flex flex-col gap-1 transition-all ${
                    alert.severity === "critical"
                      ? "bg-rose-950/30 border-rose-500/40 text-rose-300"
                      : "bg-amber-950/30 border-amber-500/40 text-amber-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-[11px] uppercase tracking-wide flex items-center gap-1">
                      <IconAlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {alert.type.replace(/_/g, " ")}
                    </span>

                    {onJumpToCoord && (
                      <button
                        type="button"
                        onClick={() => onJumpToCoord(alert.voxelCoord)}
                        className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-brand-cyan hover:text-white text-[10px] font-bold transition-all flex items-center gap-1 shrink-0"
                      >
                        <IconMapPin className="w-3 h-3" />
                        <span>JUMP TO SLICE</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] opacity-90 leading-snug">
                    {alert.description}
                  </p>

                  <p className="text-[9px] text-zinc-400 font-mono">
                    SUGGESTION: {alert.suggestedAction}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex-1 flex items-center justify-center text-center text-emerald-400 text-xs p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-lg">
                ✓ Full volume scanned: Zero anomaly defects or signal dropouts
                detected.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
