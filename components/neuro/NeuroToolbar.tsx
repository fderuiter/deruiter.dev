"use client";

import React, { useRef } from "react";
import { NeuroEditLayer, ToolMode } from "@/lib/neuro/types";
import {
  formatBytes,
  NEURO_RUN_RECON_KEY,
  NEURO_TOOL_HOTKEYS,
} from "@/lib/neuro";
import {
  IconPointer,
  IconMapPin,
  IconBrush,
  IconEraser,
  IconTarget,
  IconPlayerPlay,
  IconRotateClockwise2,
  IconBook,
  IconEye,
  IconEyeOff,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconUpload,
  IconLayersLinked,
  IconDownload,
  IconTrash,
  IconDatabase,
} from "@tabler/icons-react";
import { TooltipButton } from "@/components/ui/Tooltip";

interface NeuroToolbarProps {
  toolMode: ToolMode;
  brushRadius: number;
  roiTolerance?: number;
  activeLayer?: NeuroEditLayer;
  hasOverlayMask?: boolean;
  overlayMaskName?: string;
  showPialContour: boolean;
  showWmContour: boolean;
  showOverlayMask?: boolean;
  overlayOpacity?: number;
  uploadedFileName?: string;
  canUndo?: boolean;
  canRedo?: boolean;
  storageBytes?: number;
  storageBackend?: "indexeddb" | "memory" | null;
  isProcessing: boolean;
  onToolModeChange: (mode: ToolMode) => void;
  onBrushRadiusChange: (radius: number) => void;
  onActiveLayerChange?: (layer: NeuroEditLayer) => void;
  onTogglePialContour: () => void;
  onToggleWmContour: () => void;
  onToggleOverlayMask?: () => void;
  onOverlayOpacityChange?: (opacity: number) => void;
  onUploadVolumeFile?: (file: File) => void;
  onImportOverlayFile?: (file: File) => void;
  onExportMask?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClearLocalStorage?: () => void;
  onRunRecon: () => void;
  onReset: () => void;
  onOpenFieldManual: () => void;
}

export const NeuroToolbar: React.FC<NeuroToolbarProps> = ({
  toolMode,
  brushRadius,
  roiTolerance = 15,
  activeLayer = "brainmask",
  hasOverlayMask = false,
  overlayMaskName,
  showPialContour,
  showWmContour,
  showOverlayMask = true,
  overlayOpacity = 0.55,
  uploadedFileName,
  canUndo = false,
  canRedo = false,
  storageBytes = 0,
  storageBackend = null,
  isProcessing,
  onToolModeChange,
  onBrushRadiusChange,
  onActiveLayerChange,
  onTogglePialContour,
  onToggleWmContour,
  onToggleOverlayMask,
  onOverlayOpacityChange,
  onUploadVolumeFile,
  onImportOverlayFile,
  onExportMask,
  onUndo,
  onRedo,
  onClearLocalStorage,
  onRunRecon,
  onReset,
  onOpenFieldManual,
}) => {
  const volumeInputRef = useRef<HTMLInputElement | null>(null);
  const overlayInputRef = useRef<HTMLInputElement | null>(null);

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
    {
      id: "roi_select",
      label: "ROI Region Grow",
      key: `${NEURO_TOOL_HOTKEYS.roi_select.digit} / ${NEURO_TOOL_HOTKEYS.roi_select.letter}`,
      icon: <IconTarget className="w-4 h-4 text-purple-400" />,
    },
  ];

  const showNativeIoBar = Boolean(
    onUploadVolumeFile ||
    onImportOverlayFile ||
    onExportMask ||
    onClearLocalStorage
  );

  const availableLayers: { id: NeuroEditLayer; label: string }[] = [
    { id: "brainmask", label: "Brainmask" },
    { id: "wm", label: "WM" },
    ...(hasOverlayMask ? [{ id: "overlay" as const, label: "Overlay" }] : []),
  ];

  return (
    <div className="flex flex-col gap-2.5 bg-zinc-900/80 backdrop-blur-md border border-zinc-800/80 p-2.5 rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Primary Tool Palette */}
        <div className="flex flex-wrap items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          {tools.map((tool) => {
            const isActive = toolMode === tool.id;
            return (
              <TooltipButton
                key={tool.id}
                onClick={() => onToolModeChange(tool.id)}
                tooltip={`${tool.label} [${tool.key}]`}
                className={`flex items-center gap-2 px-3 py-2.5 min-h-[44px] rounded-lg text-xs font-mono transition-all select-none ${
                  isActive
                    ? "bg-zinc-800 text-white font-bold border border-zinc-700 shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                {tool.icon}
                {/* Below sm the word is visually hidden but still names the
                    button, so the name matches the visible text at every width. */}
                <span className="sr-only sm:not-sr-only sm:inline">
                  {tool.label.split(" ")[0]}
                </span>
                <span className="text-[10px] text-zinc-400 hidden lg:inline">
                  [{tool.key}]
                </span>
              </TooltipButton>
            );
          })}
        </div>

        {/* Per-Stroke Undo / Redo Controls */}
        {(onUndo || onRedo) && (
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            <TooltipButton
              onClick={() => onUndo?.()}
              disabled={!canUndo}
              tooltip="Undo stroke [Ctrl+Z / Cmd+Z]"
              aria-label="Undo stroke"
              className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <IconArrowBackUp className="w-4 h-4" />
            </TooltipButton>
            <TooltipButton
              onClick={() => onRedo?.()}
              disabled={!canRedo}
              tooltip="Redo stroke [Ctrl+Shift+Z / Ctrl+Y]"
              aria-label="Redo stroke"
              className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <IconArrowForwardUp className="w-4 h-4" />
            </TooltipButton>
          </div>
        )}

        {/* Brush Radius & Target Layer Controls (when Paint or Erase active) */}
        {(toolMode === "paint" || toolMode === "erase") && (
          <div className="flex flex-wrap items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800 text-xs font-mono">
            <span className="text-zinc-400">BRUSH RADIUS:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((r) => (
                <button
                  key={r}
                  onClick={() => onBrushRadiusChange(r)}
                  aria-label={`Brush radius ${r}`}
                  className={`min-h-[44px] min-w-[44px] px-2 rounded-md font-bold text-xs flex items-center justify-center transition-all ${
                    brushRadius === r
                      ? "bg-brand-cyan text-zinc-950 shadow-sm"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {onActiveLayerChange && (
              <>
                <span className="text-zinc-700">|</span>
                <span className="text-zinc-400">LAYER:</span>
                <div className="flex gap-1">
                  {availableLayers.map((layer) => (
                    <button
                      key={layer.id}
                      type="button"
                      onClick={() => onActiveLayerChange(layer.id)}
                      aria-label={`Edit ${layer.label} layer`}
                      className={`min-h-[44px] px-2.5 rounded-md font-bold text-xs transition-all ${
                        activeLayer === layer.id
                          ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                      }`}
                    >
                      {layer.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Inline ROI Tolerance & Seed Prompt (when ROI Region Grow active) */}
        {toolMode === "roi_select" && (
          <div
            data-testid="neuro-roi-toolbar-prompt"
            className="flex flex-wrap items-center gap-2 min-w-0 bg-zinc-950 px-3 py-2 min-h-[44px] rounded-xl border border-zinc-800 text-xs font-mono"
          >
            <span className="text-zinc-400">ROI TOLERANCE:</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold tabular-nums">
              ±{roiTolerance} INT
            </span>
            <span className="text-zinc-300 min-w-0 break-words sm:border-l sm:border-zinc-800 sm:pl-2">
              Click any 2D slice voxel to seed 3D region growing
            </span>
          </div>
        )}

        {/* Surface Contour Overlays */}
        <div className="flex flex-wrap items-center gap-1.5 max-w-full min-w-0 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs font-mono">
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

          {hasOverlayMask && onToggleOverlayMask && (
            <div className="flex flex-wrap items-center gap-2 px-1 max-w-full min-w-0">
              <button
                type="button"
                onClick={onToggleOverlayMask}
                aria-label={`${overlayMaskName ? `Overlay (${overlayMaskName})` : "Overlay"}: toggle mask visibility`}
                className={`flex items-center gap-1.5 px-2.5 py-2 min-h-[44px] rounded-lg transition-all ${
                  showOverlayMask
                    ? "bg-brand-cyan/15 border border-brand-cyan/30 text-brand-cyan font-bold"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                {showOverlayMask ? (
                  <IconEye className="w-3.5 h-3.5" />
                ) : (
                  <IconEyeOff className="w-3.5 h-3.5" />
                )}
                <span className="truncate max-w-[120px]">
                  {overlayMaskName ? `Overlay (${overlayMaskName})` : "Overlay"}
                </span>
              </button>
              {onOverlayOpacityChange && (
                <label className="flex items-center gap-1.5 text-[11px] text-zinc-300 pr-1">
                  <span className="text-zinc-400">OPACITY</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(overlayOpacity * 100)}
                    aria-label="Overlay mask opacity"
                    onChange={(e) =>
                      onOverlayOpacityChange(parseInt(e.target.value, 10) / 100)
                    }
                    className="w-20 accent-brand-cyan h-1 bg-zinc-800 rounded-lg cursor-pointer"
                  />
                  <span className="tabular-nums text-brand-cyan font-bold w-8">
                    {Math.round(overlayOpacity * 100)}%
                  </span>
                </label>
              )}
            </div>
          )}
        </div>

        {/* Pipeline Action Trigger & Reset */}
        <div className="flex flex-wrap items-center gap-2">
          <TooltipButton
            onClick={onRunRecon}
            disabled={isProcessing}
            tooltip={`Run FreeSurfer recon-all pipeline [${NEURO_RUN_RECON_KEY}]`}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] bg-brand-cyan hover:bg-brand-cyan/90 text-zinc-950 font-mono font-bold text-xs rounded-xl shadow-lg shadow-brand-cyan/15 transition-all disabled:opacity-50"
          >
            <IconPlayerPlay
              className={`w-4 h-4 ${isProcessing ? "animate-spin" : ""}`}
            />
            <span>{isProcessing ? "RECON RUNNING..." : "RUN RECON-ALL"}</span>
            <span className="text-[10px] opacity-75 font-mono hidden md:inline">
              [{NEURO_RUN_RECON_KEY}]
            </span>
          </TooltipButton>

          <TooltipButton
            onClick={onReset}
            tooltip="Reset this case: clears its edits and control points (other cases keep their drafts). Undo is offered afterward."
            aria-label="Reset workspace"
            className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all"
          >
            <IconRotateClockwise2 className="w-4 h-4" />
          </TooltipButton>

          <TooltipButton
            onClick={onOpenFieldManual}
            tooltip="Open FreeSurfer Field Manual & Defect Guide [M]"
            aria-label="Open Field Manual, M"
            aria-keyshortcuts="M"
            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-zinc-950 border border-zinc-800 text-brand-cyan hover:bg-zinc-900 text-xs font-mono font-bold transition-all"
          >
            <IconBook className="w-4 h-4" />
            <span className="hidden sm:inline">FIELD MANUAL</span>{" "}
            <span className="text-[10px] text-zinc-400 font-mono hidden lg:inline">
              [M]
            </span>
          </TooltipButton>
        </div>
      </div>

      {/* Native NIfTI / MGZ I/O & Local Persistence Bar */}
      {showNativeIoBar && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/80 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-2">
            {onUploadVolumeFile && (
              <>
                <input
                  ref={volumeInputRef}
                  type="file"
                  accept=".nii,.nii.gz,.mgz,.mgh,.gz"
                  aria-label="Upload NIfTI or FreeSurfer MGZ volume file"
                  data-testid="neuro-upload-volume-input"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onUploadVolumeFile(file);
                      e.target.value = "";
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => volumeInputRef.current?.click()}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-brand-cyan/40 text-brand-cyan font-bold flex items-center gap-1.5 transition-all"
                >
                  <IconUpload className="w-3.5 h-3.5" />
                  <span>Upload Scan (.nii/.mgz)</span>
                </button>
              </>
            )}

            {onImportOverlayFile && (
              <>
                <input
                  ref={overlayInputRef}
                  type="file"
                  accept=".nii,.nii.gz,.gz"
                  aria-label="Import NIfTI segmentation overlay mask"
                  data-testid="neuro-import-overlay-input"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onImportOverlayFile(file);
                      e.target.value = "";
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => overlayInputRef.current?.click()}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white font-bold flex items-center gap-1.5 transition-all"
                >
                  <IconLayersLinked className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Import Overlay (.nii)</span>
                </button>
              </>
            )}

            {onExportMask && (
              <button
                type="button"
                onClick={onExportMask}
                aria-label={`Export Mask (.nii.gz): ${activeLayer} layer`}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1.5 transition-all"
              >
                <IconDownload className="w-3.5 h-3.5" />
                <span>Export Mask (.nii.gz)</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              data-testid="neuro-storage-status"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400"
            >
              <IconDatabase className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
              <span className="truncate max-w-[180px] text-zinc-300">
                {uploadedFileName ?? "Local Cache"}
              </span>
              <span>·</span>
              <span className="tabular-nums">
                {formatBytes(storageBytes)} / 250 MB
              </span>
              {storageBackend && (
                <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[9px] uppercase text-zinc-300">
                  {storageBackend === "indexeddb" ? "IDB" : "MEM"}
                </span>
              )}
            </div>

            {onClearLocalStorage && (
              <button
                type="button"
                onClick={onClearLocalStorage}
                aria-label="Clear local storage"
                className="min-h-[44px] px-3 py-2 rounded-xl bg-zinc-950 hover:bg-rose-950/40 border border-zinc-800 hover:border-rose-500/40 text-zinc-300 hover:text-rose-300 font-bold flex items-center gap-1.5 transition-all"
              >
                <IconTrash className="w-3.5 h-3.5" />
                <span>Clear Local Storage</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
