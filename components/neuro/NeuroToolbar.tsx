"use client";

import React from "react";
import { ToolMode } from "@/lib/neuro/types";
import { NEURO_RUN_RECON_KEY, NEURO_TOOL_HOTKEYS } from "@/lib/neuro";
import {
  IconPointer,
  IconMapPin,
  IconBrush,
  IconEraser,
  IconPlayerPlay,
  IconRotateClockwise2,
  IconBook,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react";

interface NeuroToolbarProps {
  toolMode: ToolMode;
  brushRadius: number;
  showPialContour: boolean;
  showWmContour: boolean;
  isProcessing: boolean;
  onToolModeChange: (mode: ToolMode) => void;
  onBrushRadiusChange: (radius: number) => void;
  onTogglePialContour: () => void;
  onToggleWmContour: () => void;
  onRunRecon: () => void;
  onReset: () => void;
  onOpenFieldManual: () => void;
}

export const NeuroToolbar: React.FC<NeuroToolbarProps> = ({
  toolMode,
  brushRadius,
  showPialContour,
  showWmContour,
  isProcessing,
  onToolModeChange,
  onBrushRadiusChange,
  onTogglePialContour,
  onToggleWmContour,
  onRunRecon,
  onReset,
  onOpenFieldManual,
}) => {
  const tools: {
    id: ToolMode;
    label: string;
    key: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "inspect",
      label: "Inspect / Navigate",
      key: `${NEURO_TOOL_HOTKEYS.inspect.digit} / ${NEURO_TOOL_HOTKEYS.inspect.letter}`,
      icon: <IconPointer className="w-4 h-4" />,
    },
    {
      id: "control_point",
      label: "Control Point (110 Intensity)",
      key: `${NEURO_TOOL_HOTKEYS.control_point.digit} / ${NEURO_TOOL_HOTKEYS.control_point.letter}`,
      icon: <IconMapPin className="w-4 h-4 text-brand-cyan" />,
    },
    {
      id: "paint",
      label: "Voxel Paint Brush",
      key: `${NEURO_TOOL_HOTKEYS.paint.digit} / ${NEURO_TOOL_HOTKEYS.paint.letter}`,
      icon: <IconBrush className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: "erase",
      label: "Voxel Erase Brush",
      key: `${NEURO_TOOL_HOTKEYS.erase.digit} / ${NEURO_TOOL_HOTKEYS.erase.letter}`,
      icon: <IconEraser className="w-4 h-4 text-rose-400" />,
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/80 backdrop-blur-md border border-zinc-800/80 p-2.5 rounded-2xl">
      {/* Primary Tool Palette */}
      <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
        {tools.map((tool) => {
          const isActive = toolMode === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => onToolModeChange(tool.id)}
              title={`${tool.label} [${tool.key}]`}
              className={`flex items-center gap-2 px-3 py-2.5 min-h-[44px] rounded-lg text-xs font-mono transition-all select-none ${
                isActive
                  ? "bg-zinc-800 text-white font-bold border border-zinc-700 shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900"
              }`}
            >
              {tool.icon}
              <span className="hidden sm:inline">
                {tool.label.split(" ")[0]}
              </span>
              <span className="text-[10px] text-zinc-400 hidden lg:inline">
                [{tool.key}]
              </span>
            </button>
          );
        })}
      </div>

      {/* Brush Radius Controls (when Paint or Erase active) */}
      {(toolMode === "paint" || toolMode === "erase") && (
        <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800 text-xs font-mono">
          <span className="text-zinc-400">BRUSH RADIUS:</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((r) => (
              <button
                key={r}
                onClick={() => onBrushRadiusChange(r)}
                aria-label={`Brush radius ${r}`}
                className={`w-6 h-6 rounded-md font-bold text-xs flex items-center justify-center transition-all ${
                  brushRadius === r
                    ? "bg-brand-cyan text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Surface Contour Overlays */}
      <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs font-mono">
        <button
          onClick={onTogglePialContour}
          className={`flex items-center gap-1.5 px-2.5 py-2 min-h-[44px] rounded-lg transition-all ${
            showPialContour
              ? "bg-red-500/15 border border-red-500/30 text-red-400 font-bold"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          {showPialContour ? (
            <IconEye className="w-3.5 h-3.5" />
          ) : (
            <IconEyeOff className="w-3.5 h-3.5" />
          )}
          <span>Pial (Red)</span>
        </button>

        <button
          onClick={onToggleWmContour}
          className={`flex items-center gap-1.5 px-2.5 py-2 min-h-[44px] rounded-lg transition-all ${
            showWmContour
              ? "bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 font-bold"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          {showWmContour ? (
            <IconEye className="w-3.5 h-3.5" />
          ) : (
            <IconEyeOff className="w-3.5 h-3.5" />
          )}
          <span>WM (Yellow)</span>
        </button>
      </div>

      {/* Pipeline Action Trigger & Reset */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRunRecon}
          disabled={isProcessing}
          title={`Run FreeSurfer recon-all pipeline [${NEURO_RUN_RECON_KEY}]`}
          className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] bg-brand-cyan hover:bg-brand-cyan/90 text-zinc-950 font-mono font-bold text-xs rounded-xl shadow-lg shadow-brand-cyan/15 transition-all disabled:opacity-50"
        >
          <IconPlayerPlay
            className={`w-4 h-4 ${isProcessing ? "animate-spin" : ""}`}
          />
          <span>{isProcessing ? "RECON RUNNING..." : "RUN RECON-ALL"}</span>
          <span className="text-[10px] opacity-75 font-mono hidden md:inline">
            [{NEURO_RUN_RECON_KEY}]
          </span>
        </button>

        <button
          onClick={onReset}
          title="Reset this case: clears its edits and control points (other cases keep their drafts). Undo is offered afterward."
          aria-label="Reset workspace"
          className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all"
        >
          <IconRotateClockwise2 className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenFieldManual}
          title="Open FreeSurfer Field Manual & Defect Guide [M]"
          aria-label="Open Field Manual"
          className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-zinc-950 border border-zinc-800 text-brand-cyan hover:bg-zinc-900 text-xs font-mono font-bold transition-all"
        >
          <IconBook className="w-4 h-4" />
          <span className="hidden sm:inline">FIELD MANUAL</span>
          <span className="text-[10px] text-zinc-400 font-mono hidden lg:inline">
            [M]
          </span>
        </button>
      </div>
    </div>
  );
};
