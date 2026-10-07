"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  POS_MENU,
  SCENARIO_PRESETS,
  validatePosTree,
  type PosNode,
  type ShiftScenarioConfig,
} from "@/lib/patty-drive-thru";

interface ScenarioCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClockIn: (config: ShiftScenarioConfig) => void;
  initialConfig?: Partial<ShiftScenarioConfig>;
}

export function ScenarioCustomizerModal({
  isOpen,
  onClose,
  onClockIn,
  initialConfig,
}: ScenarioCustomizerModalProps) {
  const [config, setConfig] = useState<ShiftScenarioConfig>(() => ({
    ...SCENARIO_PRESETS.standard,
    ...initialConfig,
  }));

  const [selectedPreset, setSelectedPreset] = useState<string>("standard");
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfig({
        ...SCENARIO_PRESETS.standard,
        ...initialConfig,
      });
    }
  }, [isOpen, initialConfig]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const validation = validatePosTree(config.posMenu ?? POS_MENU);

  const handlePresetChange = (presetKey: string) => {
    setSelectedPreset(presetKey);
    const preset = SCENARIO_PRESETS[presetKey];
    if (preset) {
      setConfig({ ...preset });
    }
  };

  const handleStartShift = () => {
    if (!validation.valid) return;
    onClockIn(config);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdt-modal-title"
      data-testid="pdt-scenario-customizer-modal"
    >
      <div
        ref={modalRef}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-[var(--pdt-paper-rule)] bg-[var(--pdt-paper)] p-6 text-[var(--pdt-paper-ink)] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[var(--pdt-paper-rule)] pb-4">
          <div>
            <h2
              id="pdt-modal-title"
              className="font-mono text-xl font-bold tracking-tight"
            >
              Custom Shift Scenario Builder
            </h2>
            <p className="font-mono text-xs text-[var(--pdt-paper-dim)]">
              Configure shift limits, operational parameters, and custom POS
              menu tree.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[var(--pdt-paper-rule)] px-3 py-1 font-mono text-xs font-bold uppercase hover:bg-black/5"
            aria-label="Close customizer"
          >
            ✕
          </button>
        </header>

        <div className="mt-4 flex-1 overflow-y-auto space-y-6 pr-1 font-mono text-xs">
          {/* Preset Selector */}
          <section className="space-y-2">
            <label className="block font-bold uppercase tracking-wider text-[var(--pdt-paper-dim)]">
              Scenario Presets
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(SCENARIO_PRESETS).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePresetChange(key)}
                  className={`rounded border px-3 py-1.5 font-mono text-xs font-bold capitalize transition-colors ${
                    selectedPreset === key
                      ? "border-[var(--pdt-bump-edge)] bg-[var(--pdt-bump)] text-[var(--pdt-ink)]"
                      : "border-[var(--pdt-paper-rule)] hover:bg-black/5"
                  }`}
                >
                  {key.replace(/([A-Z])/g, " $1")}
                </button>
              ))}
            </div>
          </section>

          {/* Core Parameters */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-bold">Shift Seed</label>
              <input
                type="text"
                value={config.seed}
                onChange={(e) => setConfig({ ...config, seed: e.target.value })}
                className="mt-1 w-full rounded border border-[var(--pdt-paper-rule)] bg-white/50 px-2.5 py-1.5 text-xs text-[var(--pdt-paper-ink)]"
              />
            </div>

            <div>
              <label className="block font-bold">Duration (Seconds)</label>
              <input
                type="number"
                min="10"
                max="3600"
                value={config.durationSec}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    durationSec: Number(e.target.value) || 180,
                  })
                }
                className="mt-1 w-full rounded border border-[var(--pdt-paper-rule)] bg-white/50 px-2.5 py-1.5 text-xs text-[var(--pdt-paper-ink)]"
              />
            </div>

            <div>
              <label className="block font-bold">Arrival Gap Min (Sec)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={config.arrivalGapMinSec ?? 7}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    arrivalGapMinSec: Number(e.target.value) || 1,
                  })
                }
                className="mt-1 w-full rounded border border-[var(--pdt-paper-rule)] bg-white/50 px-2.5 py-1.5 text-xs text-[var(--pdt-paper-ink)]"
              />
            </div>

            <div>
              <label className="block font-bold">Arrival Gap Max (Sec)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={config.arrivalGapMaxSec ?? 15}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    arrivalGapMaxSec: Number(e.target.value) || 15,
                  })
                }
                className="mt-1 w-full rounded border border-[var(--pdt-paper-rule)] bg-white/50 px-2.5 py-1.5 text-xs text-[var(--pdt-paper-ink)]"
              />
            </div>

            <div>
              <label className="block font-bold">Idle Grace (Sec)</label>
              <input
                type="number"
                min="0"
                max="30"
                value={config.idleGraceSec ?? 6}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    idleGraceSec: Number(e.target.value) || 0,
                  })
                }
                className="mt-1 w-full rounded border border-[var(--pdt-paper-rule)] bg-white/50 px-2.5 py-1.5 text-xs text-[var(--pdt-paper-ink)]"
              />
            </div>

            <div>
              <label className="block font-bold">Idle Growth Rate (/Sec)</label>
              <input
                type="number"
                min="1"
                max="50"
                value={config.idleRatePerSec ?? 12}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    idleRatePerSec: Number(e.target.value) || 12,
                  })
                }
                className="mt-1 w-full rounded border border-[var(--pdt-paper-rule)] bg-white/50 px-2.5 py-1.5 text-xs text-[var(--pdt-paper-ink)]"
              />
            </div>

            <div>
              <label className="block font-bold">
                Drink Dispenser Drop Chance (0 - 1)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={config.dispenserFailChance ?? 0.4}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    dispenserFailChance: Number(e.target.value) || 0,
                  })
                }
                className="mt-1 w-full rounded border border-[var(--pdt-paper-rule)] bg-white/50 px-2.5 py-1.5 text-xs text-[var(--pdt-paper-ink)]"
              />
            </div>

            <div>
              <label className="block font-bold">Expired SOS Penalty</label>
              <input
                type="number"
                min="1"
                max="50"
                value={config.sosLossExpired ?? 15}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    sosLossExpired: Number(e.target.value) || 15,
                  })
                }
                className="mt-1 w-full rounded border border-[var(--pdt-paper-rule)] bg-white/50 px-2.5 py-1.5 text-xs text-[var(--pdt-paper-ink)]"
              />
            </div>
          </section>

          {/* POS Menu Tree Visualizer & Validation */}
          <section className="space-y-3 rounded border border-[var(--pdt-paper-rule)] bg-black/5 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold uppercase tracking-wider text-[var(--pdt-paper-dim)]">
                POS Menu Tree Layout
              </h3>
              <button
                type="button"
                onClick={() => setConfig({ ...config, posMenu: POS_MENU })}
                className="rounded border border-[var(--pdt-paper-rule)] px-2 py-1 text-[10px] uppercase hover:bg-black/10"
              >
                Reset POS Tree
              </button>
            </div>

            {/* Validation Banner */}
            <div
              className={`rounded border p-3 ${
                validation.valid
                  ? "border-emerald-600/40 bg-emerald-500/10 text-emerald-900"
                  : "border-red-600/40 bg-red-500/10 text-red-900"
              }`}
              data-testid="pdt-pos-validation-status"
            >
              <div className="flex items-center gap-2 font-bold">
                <span>
                  {validation.valid
                    ? "✓ POS Layout Valid"
                    : "⚠ POS Layout Invalid"}
                </span>
              </div>
              {!validation.valid && (
                <ul className="mt-1 list-disc pl-5 text-[11px]">
                  {validation.errors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Render Tree Visualizer */}
            <div className="max-h-48 overflow-y-auto rounded border border-[var(--pdt-paper-rule)] bg-white/80 p-3 font-mono text-[11px]">
              <PosTreeNodes node={config.posMenu ?? POS_MENU} depth={0} />
            </div>
          </section>
        </div>

        <footer className="mt-4 flex items-center justify-end gap-3 border-t border-[var(--pdt-paper-rule)] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[var(--pdt-paper-rule)] px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-black/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStartShift}
            disabled={!validation.valid}
            className={`rounded border-2 px-5 py-2 font-mono text-xs font-bold uppercase tracking-wide transition-transform active:scale-95 ${
              validation.valid
                ? "border-[var(--pdt-bump-edge)] bg-[var(--pdt-bump)] text-[var(--pdt-ink)]"
                : "cursor-not-allowed border-gray-400 bg-gray-200 text-gray-500 opacity-60"
            }`}
            data-testid="pdt-clock-in-custom"
          >
            Clock In with Scenario
          </button>
        </footer>
      </div>
    </div>
  );
}

function PosTreeNodes({ node, depth }: { node: PosNode; depth: number }) {
  return (
    <div style={{ paddingLeft: `${depth * 12}px` }} className="my-0.5">
      <span className="font-semibold text-gray-900">{node.label}</span>
      {node.itemId && (
        <span className="ml-2 rounded bg-blue-100 px-1 py-0.2 text-[10px] text-blue-800">
          item: {node.itemId}
        </span>
      )}
      {node.modifierId && (
        <span className="ml-2 rounded bg-amber-100 px-1 py-0.2 text-[10px] text-amber-800">
          mod: {node.modifierId}
        </span>
      )}
      {node.children && node.children.length > 0 && (
        <div className="border-l border-gray-300">
          {node.children.map((child) => (
            <PosTreeNodes key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
