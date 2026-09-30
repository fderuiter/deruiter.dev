"use client";

import React, { useCallback, useState } from "react";
import {
  CRTCalibrationConfig,
  CRTPresetId,
  CRT_PRESETS,
  DEFAULT_CRT_PRESET_ID,
  PhosphorMaskType,
  saveCRTCalibration,
} from "@/lib/arcade/crt-pipeline";
import { ModalContainer } from "@/components/ui/ModalContainer";
import {
  IconDeviceTv,
  IconX,
  IconRefresh,
  IconSparkles,
  IconCheck,
  IconAdjustmentsHorizontal,
  IconSun,
  IconColumns,
} from "@tabler/icons-react";

export interface CRTCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: CRTCalibrationConfig;
  onChange: (config: CRTCalibrationConfig) => void;
  themePrimaryColor?: string;
}

export const CRTCalibrationModal: React.FC<CRTCalibrationModalProps> = ({
  isOpen,
  onClose,
  config,
  onChange,
  themePrimaryColor: _themePrimaryColor = "#10b981",
}) => {
  const [activePreset, setActivePreset] = useState<CRTPresetId | "custom">(
    () => {
      // Check if initial config matches any preset
      const match = Object.values(CRT_PRESETS).find((preset) => {
        const p = preset.config;
        return (
          p.scanlinesEnabled === config.scanlinesEnabled &&
          p.phosphorMask === config.phosphorMask &&
          Math.abs(p.scanlineIntensity - config.scanlineIntensity) < 0.05 &&
          Math.abs(p.phosphorIntensity - config.phosphorIntensity) < 0.05
        );
      });
      return match ? match.id : "custom";
    }
  );

  const handlePresetSelect = useCallback(
    (presetId: CRTPresetId) => {
      const preset = CRT_PRESETS[presetId];
      if (!preset) return;
      setActivePreset(presetId);
      const newConfig = { ...preset.config };
      onChange(newConfig);
      saveCRTCalibration(newConfig);
    },
    [onChange]
  );

  const handleConfigChange = useCallback(
    <K extends keyof CRTCalibrationConfig>(
      key: K,
      value: CRTCalibrationConfig[K]
    ) => {
      setActivePreset("custom");
      const newConfig = { ...config, [key]: value };
      onChange(newConfig);
      saveCRTCalibration(newConfig);
    },
    [config, onChange]
  );

  const handleResetDefaults = useCallback(() => {
    handlePresetSelect(DEFAULT_CRT_PRESET_ID);
  }, [handlePresetSelect]);

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      titleId="crt-calibration-title"
      ariaDescribedBy="crt-calibration-desc"
      maxWidth="max-w-2xl"
      overlayClassName="backdrop-blur-md animate-fadeIn"
      className="block bg-neutral-950 p-6 font-mono"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <IconDeviceTv className="w-6 h-6" />
          </div>
          <div>
            <h2
              id="crt-calibration-title"
              className="text-lg font-bold text-white flex items-center gap-2"
            >
              CRT Display Calibration
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-normal">
                Post-Processing Shader
              </span>
            </h2>
            <p id="crt-calibration-desc" className="text-xs text-zinc-400">
              Calibrate RGB subpixel phosphor mask emulation, bloom glow, and
              scanline rasters.
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 focus:outline-none"
          aria-label="Close CRT Calibration Dialog"
        >
          <IconX className="w-5 h-5" />
        </button>
      </div>

      {/* 1-Click Curated Presets */}
      <div className="mb-6">
        <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <IconSparkles className="w-3.5 h-3.5 text-amber-400" />
          Display Archetype Presets
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(Object.keys(CRT_PRESETS) as CRTPresetId[]).map((presetId) => {
            const preset = CRT_PRESETS[presetId];
            const isSelected = activePreset === presetId;
            return (
              <button
                key={presetId}
                onClick={() => handlePresetSelect(presetId)}
                className={`p-2.5 rounded-xl text-left border transition-all text-xs flex flex-col justify-between cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus:outline-none ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                    : "border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-300 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-bold truncate">{preset.name}</span>
                  {isSelected && (
                    <IconCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {preset.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Granular Sliders & Custom Calibration */}
      <div className="space-y-5 border-t border-zinc-850 pt-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <IconAdjustmentsHorizontal className="w-3.5 h-3.5 text-brand-cyan" />
            Fine-Tuning Controls
          </span>
          {activePreset === "custom" && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30">
              Custom Calibration
            </span>
          )}
        </div>

        {/* Scanline Master Toggle & Opacity */}
        <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor="crt-scanline-toggle"
              className="text-xs font-bold text-zinc-200 cursor-pointer flex items-center gap-2"
            >
              <input
                id="crt-scanline-toggle"
                type="checkbox"
                checked={config.scanlinesEnabled}
                onChange={(e) =>
                  handleConfigChange("scanlinesEnabled", e.target.checked)
                }
                className="rounded bg-zinc-800 border-zinc-700 text-emerald-500 focus:ring-emerald-400 w-4 h-4 cursor-pointer"
              />
              CRT Scanline Rasters
            </label>
            <span className="text-xs font-mono text-zinc-400">
              {config.scanlinesEnabled
                ? `${Math.round(config.scanlineIntensity * 100)}%`
                : "Disabled"}
            </span>
          </div>

          {config.scanlinesEnabled && (
            <div className="space-y-3 pt-2">
              <div>
                <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                  <span>Scanline Darkness / Intensity</span>
                  <span>{Math.round(config.scanlineIntensity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={config.scanlineIntensity}
                  onChange={(e) =>
                    handleConfigChange(
                      "scanlineIntensity",
                      parseFloat(e.target.value)
                    )
                  }
                  aria-label="Scanline Darkness Intensity"
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                  <span>Raster Pitch / Density</span>
                  <span>
                    {config.scanlineDensity === 2
                      ? "Fine (2px)"
                      : config.scanlineDensity === 3
                        ? "Standard (3px)"
                        : "Thick (4px)"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[2, 3, 4].map((pitch) => (
                    <button
                      key={pitch}
                      onClick={() =>
                        handleConfigChange("scanlineDensity", pitch)
                      }
                      className={`py-1 text-[10px] rounded border transition-colors cursor-pointer ${
                        config.scanlineDensity === pitch
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                          : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {pitch === 2
                        ? "Fine (2px)"
                        : pitch === 3
                          ? "Standard (3px)"
                          : "Thick (4px)"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RGB Phosphor Mask Emulation */}
        <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <IconColumns className="w-3.5 h-3.5 text-rose-400" />
              RGB Subpixel Phosphor Mask
            </span>
            <span className="text-xs font-mono text-zinc-400">
              {config.phosphorMask === "none"
                ? "Off"
                : `${Math.round(config.phosphorIntensity * 100)}%`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
            {(
              [
                { id: "none", label: "Off" },
                { id: "aperture-grille", label: "Aperture Grille" },
                { id: "shadow-mask", label: "Shadow Mask" },
                { id: "monochrome-dot", label: "Monochrome Dot" },
              ] as const
            ).map((mask) => (
              <button
                key={mask.id}
                onClick={() =>
                  handleConfigChange(
                    "phosphorMask",
                    mask.id as PhosphorMaskType
                  )
                }
                className={`py-1.5 px-2 rounded-lg border text-center transition-colors cursor-pointer ${
                  config.phosphorMask === mask.id
                    ? "bg-rose-500/20 border-rose-500 text-rose-300 font-bold"
                    : "bg-zinc-800/60 border-zinc-700/80 text-zinc-400 hover:text-white"
                }`}
              >
                {mask.label}
              </button>
            ))}
          </div>

          {config.phosphorMask !== "none" && (
            <div>
              <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                <span>Phosphor Mask Opacity</span>
                <span>{Math.round(config.phosphorIntensity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={config.phosphorIntensity}
                onChange={(e) =>
                  handleConfigChange(
                    "phosphorIntensity",
                    parseFloat(e.target.value)
                  )
                }
                aria-label="Phosphor Mask Opacity"
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
              />
            </div>
          )}
        </div>

        {/* Bloom, Vignette & Curvature */}
        <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between text-xs font-bold text-zinc-200 mb-1">
              <span className="flex items-center gap-1.5">
                <IconSun className="w-3.5 h-3.5 text-amber-400" />
                Phosphor Bloom Glow
              </span>
              <span className="text-zinc-400">
                {Math.round(config.bloomIntensity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={config.bloomIntensity}
              onChange={(e) =>
                handleConfigChange("bloomIntensity", parseFloat(e.target.value))
              }
              aria-label="Phosphor Bloom Glow Intensity"
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-zinc-200 mb-1">
              <span>Tube Vignette Falloff</span>
              <span className="text-zinc-400">
                {Math.round(config.vignetteIntensity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={config.vignetteIntensity}
              onChange={(e) =>
                handleConfigChange(
                  "vignetteIntensity",
                  parseFloat(e.target.value)
                )
              }
              aria-label="Tube Vignette Falloff Intensity"
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-zinc-200 mb-1">
              <span>Barrel Curvature</span>
              <span className="text-zinc-400">
                {Math.round(config.curvature * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.02"
              value={config.curvature}
              onChange={(e) =>
                handleConfigChange("curvature", parseFloat(e.target.value))
              }
              aria-label="Barrel Curvature Factor"
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
            />
          </div>

          <div className="flex items-center justify-between pt-4">
            <label
              htmlFor="crt-shimmer-toggle"
              className="text-xs font-bold text-zinc-200 cursor-pointer flex items-center gap-2"
            >
              <input
                id="crt-shimmer-toggle"
                type="checkbox"
                checked={config.flickerShimmer}
                onChange={(e) =>
                  handleConfigChange("flickerShimmer", e.target.checked)
                }
                className="rounded bg-zinc-800 border-zinc-700 text-emerald-500 focus:ring-emerald-400 w-4 h-4 cursor-pointer"
              />
              Phosphor Micro-Shimmer
            </label>
            <span className="text-[10px] text-zinc-500">60Hz Aura</span>
          </div>
        </div>
      </div>

      {/* Actions Footer */}
      <div className="flex items-center justify-between border-t border-zinc-800 pt-5 mt-6">
        <button
          onClick={handleResetDefaults}
          className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus:outline-none"
        >
          <IconRefresh className="w-3.5 h-3.5" />
          Reset Defaults
        </button>

        <button
          onClick={onClose}
          className="px-5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-white focus:outline-none"
        >
          <IconCheck className="w-4 h-4" />
          Apply & Close
        </button>
      </div>
    </ModalContainer>
  );
};
