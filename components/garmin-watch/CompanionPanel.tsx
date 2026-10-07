"use client";

import React, { type ReactNode } from "react";
import { clamp } from "@/lib/game-utils";
import { IconDeviceWatch } from "@tabler/icons-react";
import { FieldManualButton } from "@/components/FieldManualButton";
import { FullscreenButton } from "@/components/arcade/FullscreenButton";
import {
  DEVICE_PROFILES,
  type DeviceTarget,
  type GameEngineState,
} from "@/lib/garmin-engine";
import type { MeterTone } from "./watch-face-art";
import type { WatchBezelTheme } from "./WatchHardware";
import {
  GROUND_STRIP_FIELDS,
  GROUND_STRIP_FIELD_LABELS,
  GROUND_STRIP_SLOT_LABELS,
  type GroundStripField,
  type GroundStripLayout,
} from "@/lib/garmin-ground-strip";
import type { TelemetrySample } from "@/lib/garmin-telemetry-buffer";
import {
  DEFAULT_WIDGET_LAYOUT,
  METRIC_DEFINITIONS,
  SLOT_LABELS,
  type MetricKey,
  type WidgetLayoutConfig,
  type WidgetSlot,
} from "@/lib/garmin-widget-layout";

/** Gauge fill colours: the shared arcade signals, never the world's cyan. */
const TONE_STROKE: Record<MeterTone, string> = {
  ok: "#10b981",
  warn: "#f59e0b",
  danger: "#ef4444",
};

const TONE_TEXT: Record<MeterTone, string> = {
  ok: "text-emerald-300",
  warn: "text-amber-300",
  danger: "text-rose-300",
};

const GAUGE_R = 26;
const GAUGE_C = 2 * Math.PI * GAUGE_R;

interface RingGaugeProps {
  label: string;
  /** 0 to 1. */
  fraction: number;
  tone: MeterTone;
  /** Readout under the ring, e.g. "1.8 / 32 KB". */
  readout: string;
  valueNow: number;
  valueMax: number;
  valueText: string;
}

/** One round gauge, like a Connect IQ widget glance. */
function RingGauge({
  label,
  fraction,
  tone,
  readout,
  valueNow,
  valueMax,
  valueText,
}: RingGaugeProps) {
  const f = clamp(Number.isFinite(fraction) ? fraction : 0, 0, 1);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={valueMax}
      aria-valuenow={clamp(valueNow, 0, valueMax)}
      aria-valuetext={valueText}
      className="flex min-w-0 flex-col items-center text-center"
    >
      <div className="relative h-16 w-16">
        <svg
          viewBox="0 0 64 64"
          className="h-16 w-16 -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="32"
            cy="32"
            r={GAUGE_R}
            fill="none"
            stroke="#1a1d24"
            strokeWidth="6"
          />
          <circle
            cx="32"
            cy="32"
            r={GAUGE_R}
            fill="none"
            stroke={TONE_STROKE[tone]}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${GAUGE_C * f} ${GAUGE_C}`}
            data-testid={`garmin-gauge-${label.toLowerCase()}`}
            data-tone={tone}
          />
        </svg>
        <span
          aria-hidden="true"
          className={`absolute inset-0 flex items-center justify-center font-mono text-[13px] font-bold tabular-nums ${TONE_TEXT[tone]}`}
        >
          {Math.round(f * 100)}%
        </span>
      </div>
      <span className="mt-1.5 text-[10px] uppercase tracking-wider text-zinc-400">
        {label}:
      </span>
      <span className="min-w-0 break-words text-[11px] tabular-nums text-zinc-200">
        {readout}
      </span>
    </div>
  );
}

/** A thin labelled bar for a secondary sensor. */
function SensorBar({
  label,
  percent,
  tone,
}: {
  label: string;
  percent: number;
  tone: MeterTone;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-[10px]">
        <span className="uppercase tracking-wider text-zinc-400">{label}:</span>{" "}
        <span
          className={`tabular-nums ${tone === "ok" ? "text-zinc-200" : TONE_TEXT[tone]}`}
        >
          {percent}%
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#1a1d24]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${clamp(percent, 0, 100)}%`,
            backgroundColor: tone === "ok" ? "#94a3b8" : TONE_STROKE[tone],
          }}
        />
      </div>
    </div>
  );
}

const DEVICES: Array<{ id: DeviceTarget; label: string }> = [
  { id: "fenix", label: "Fēnix (32KB)" },
  { id: "forerunner", label: "Forerunner (64KB)" },
  { id: "edge", label: "Edge (128KB)" },
];

const THEMES: Array<{ id: WatchBezelTheme; label: string }> = [
  { id: "slate", label: "Tactix" },
  { id: "solar", label: "Solar" },
  { id: "cyan", label: "Cyan" },
];

const KEYS: Array<[string, string]> = [
  ["▲", "Jump"],
  ["▼", "Pop heap variable"],
  ["G / ⌫", "Garbage collect"],
  ["L", "Backlight (burns battery)"],
  ["W / drag", "Wipe screen fog"],
  ["Enter", "Start, pause, reboot"],
];

const RUN_STATUS: Record<
  GameEngineState["gameState"],
  { label: string; dot: string }
> = {
  idle: { label: "Ready", dot: "bg-slate-400" },
  playing: { label: "Running", dot: "bg-emerald-400" },
  paused: { label: "Paused", dot: "bg-amber-400" },
  crashed: { label: "Crashed", dot: "bg-rose-400" },
  shutdown: { label: "Power loss", dot: "bg-rose-400" },
  summary: { label: "Complete", dot: "bg-emerald-400" },
};

const segmentClass = (selected: boolean) =>
  `min-h-[32px] min-w-0 flex-1 rounded-md px-2 py-1 text-[10px] transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
    selected
      ? "bg-white/[0.1] font-bold text-zinc-50"
      : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
  }`;

const toolClass =
  "min-h-[32px] w-full rounded-lg border px-2.5 py-1.5 text-left text-[10px] transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";

interface CompanionPanelProps {
  state: GameEngineState;
  deviceTarget: DeviceTarget;
  bezelTheme: WatchBezelTheme;
  highScore: number;
  isFocused: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onSelectDevice: (target: DeviceTarget, e: React.MouseEvent) => void;
  onSelectTheme: (theme: WatchBezelTheme, e: React.MouseEvent) => void;
  onWriteFlash: (e: React.MouseEvent) => void;
  onClearFlash: (e: React.MouseEvent) => void;
  onDrainBattery: (e: React.MouseEvent) => void;
  /** Samples recorded for the current run. */
  telemetryCount?: number;
  onExportCsv?: (e?: React.MouseEvent) => void;
  onExportFit?: (e?: React.MouseEvent) => void;
  groundStrip?: GroundStripLayout;
  onGroundStripSlot?: (slot: number, field: GroundStripField) => void;
  onGroundStripReset?: () => void;
  /** Telemetry buffer samples */
  telemetrySamples?: TelemetrySample[];
  onClearTelemetry?: (e: React.MouseEvent) => void;
  /** Custom widget layout configuration */
  widgetLayout?: WidgetLayoutConfig;
  onUpdateLayoutSlot?: (slot: WidgetSlot, metric: MetricKey) => void;
  onResetLayout?: (e?: React.MouseEvent) => void;
  /** Laid over the panel, e.g. the end-of-run result card. */
  children?: ReactNode;
}

/**
 * The phone-side "Connect IQ" companion: three glance gauges, telemetry exporter,
 * visual widget slot builder, sensor bars, best score, and controls.
 */
export function CompanionPanel({
  state,
  deviceTarget,
  bezelTheme,
  highScore,
  isFocused,
  isFullscreen,
  onToggleFullscreen,
  onSelectDevice,
  onSelectTheme,
  onWriteFlash,
  onClearFlash,
  onDrainBattery,
  telemetryCount = 0,
  onExportCsv,
  onExportFit,
  groundStrip = ["steps", "distance", "vars"],
  onGroundStripSlot = () => {},
  onGroundStripReset = () => {},
  telemetrySamples = [],
  onClearTelemetry,
  widgetLayout,
  onUpdateLayoutSlot,
  onResetLayout,
  children,
}: CompanionPanelProps) {
  const profile = DEVICE_PROFILES[deviceTarget];
  const layout = widgetLayout ?? DEFAULT_WIDGET_LAYOUT;

  const leftMetric =
    METRIC_DEFINITIONS[layout.leftArc] ?? METRIC_DEFINITIONS.ram;
  const rightMetric =
    METRIC_DEFINITIONS[layout.rightArc] ?? METRIC_DEFINITIONS.flash;
  const topRightMetric =
    METRIC_DEFINITIONS[layout.topRight] ?? METRIC_DEFINITIONS.battery;

  const thermal = Math.round((state.thermalStress ?? 0) * 100);
  const fog = Math.round(state.fogLevel * 100);
  const status = RUN_STATUS[state.gameState];
  const isPlaying = state.gameState === "playing";

  return (
    <aside
      aria-label="Connect IQ companion"
      className="garmin-companion relative isolate w-full min-w-0 self-stretch overflow-hidden rounded-2xl border border-white/[0.08] bg-[#13151a] font-mono text-xs text-zinc-300"
    >
      <div className="flex flex-col gap-4 p-4">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="rounded-lg border border-white/[0.08] bg-[#0d0e11] p-1.5 text-zinc-300">
              <IconDeviceWatch className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold tracking-[-0.02em] text-zinc-50">
                Connect IQ
              </p>
              <p className="truncate text-[10px] text-zinc-400">
                Paired · {profile.name}
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#0d0e11] px-2 py-0.5 text-[10px] text-zinc-300">
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </header>

        <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/[0.08] bg-[#0d0e11] px-2 py-3">
          <RingGauge
            label={leftMetric.shortLabel}
            fraction={leftMetric.resolveFraction(state)}
            tone={leftMetric.resolveTone(state)}
            readout={leftMetric.formatReadout(state)}
            valueNow={leftMetric.resolveValue(state)}
            valueMax={100}
            valueText={leftMetric.formatReadout(state)}
          />
          <RingGauge
            label={rightMetric.shortLabel}
            fraction={rightMetric.resolveFraction(state)}
            tone={rightMetric.resolveTone(state)}
            readout={rightMetric.formatReadout(state)}
            valueNow={rightMetric.resolveValue(state)}
            valueMax={100}
            valueText={rightMetric.formatReadout(state)}
          />
          <RingGauge
            label={topRightMetric.shortLabel}
            fraction={topRightMetric.resolveFraction(state)}
            tone={topRightMetric.resolveTone(state)}
            readout={topRightMetric.formatReadout(state)}
            valueNow={topRightMetric.resolveValue(state)}
            valueMax={100}
            valueText={topRightMetric.formatReadout(state)}
          />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3">
          <SensorBar
            label="THERMAL"
            percent={thermal}
            tone={thermal > 40 ? "warn" : "ok"}
          />
          <SensorBar
            label="CONDENSATION"
            percent={fog}
            tone={fog > 40 ? "danger" : "ok"}
          />
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">
              Best
            </div>
            <div className="text-sm font-bold tabular-nums text-amber-300">
              {highScore}
            </div>
          </div>
        </div>

        <p className="flex items-center gap-2 text-[10px] text-zinc-400">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              isFocused ? "bg-emerald-400" : "bg-zinc-600"
            }`}
          />
          <span className="min-w-0">
            {isFocused
              ? "Watch keys active"
              : "Click the watch to use the keys"}
          </span>
        </p>

        <fieldset className="min-w-0 border-t border-white/[0.08] pt-3">
          <legend className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-400">
            <span>Widget Slot Builder</span>
            {onResetLayout && (
              <button
                type="button"
                onClick={onResetLayout}
                className="text-[9px] text-amber-400 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
              >
                Reset Defaults
              </button>
            )}
          </legend>
          <div className="grid gap-2 rounded-xl border border-white/[0.08] bg-[#0d0e11] p-2.5">
            {(
              [
                "leftArc",
                "rightArc",
                "topRight",
                "topLeft",
                "bottomLeft",
                "bottomCenter",
                "bottomRight",
              ] as WidgetSlot[]
            ).map((slot) => (
              <div
                key={slot}
                className="flex items-center justify-between gap-2 text-[10px]"
              >
                <label
                  htmlFor={`slot-select-${slot}`}
                  className="truncate text-zinc-400"
                >
                  {SLOT_LABELS[slot]}:
                </label>
                <select
                  id={`slot-select-${slot}`}
                  value={layout[slot]}
                  onChange={(e) =>
                    onUpdateLayoutSlot?.(slot, e.target.value as MetricKey)
                  }
                  className="rounded border border-white/[0.1] bg-[#13151a] px-1.5 py-0.5 font-mono text-[10px] text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                >
                  {Object.values(METRIC_DEFINITIONS).map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label} ({m.shortLabel})
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="min-w-0 border-t border-white/[0.08] pt-3">
          <legend className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-400">
            <span>Telemetry Export</span>
            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] tabular-nums text-zinc-300">
              {telemetrySamples.length} samples
            </span>
          </legend>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={onExportCsv}
              disabled={telemetrySamples.length === 0}
              className={`${toolClass} border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-200 hover:bg-emerald-500/[0.12]`}
            >
              Export CSV (.csv)
            </button>
            <button
              type="button"
              onClick={onExportFit}
              disabled={telemetrySamples.length === 0}
              className={`${toolClass} border-cyan-500/30 bg-cyan-500/[0.06] text-cyan-200 hover:bg-cyan-500/[0.12]`}
            >
              Export FIT (.fit)
            </button>
          </div>
          {onClearTelemetry && (
            <button
              type="button"
              onClick={onClearTelemetry}
              disabled={telemetrySamples.length === 0}
              className={`${toolClass} mt-1.5 border-white/[0.08] bg-[#0d0e11] text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200`}
            >
              Clear Telemetry Buffer
            </button>
          )}
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-400">
            Device
          </legend>
          <div className="flex gap-1 rounded-lg border border-white/[0.08] bg-[#0d0e11] p-0.5">
            {DEVICES.map((d) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={deviceTarget === d.id}
                onClick={(e) => onSelectDevice(d.id, e)}
                className={segmentClass(deviceTarget === d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-400">
            Bezel
          </legend>
          <div className="flex gap-1 rounded-lg border border-white/[0.08] bg-[#0d0e11] p-0.5">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={bezelTheme === t.id}
                onClick={(e) => onSelectTheme(t.id, e)}
                className={segmentClass(bezelTheme === t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-400">
            Ground strip
          </legend>
          <div className="grid gap-1.5">
            {GROUND_STRIP_SLOT_LABELS.map((slotLabel, slot) => (
              <label
                key={slotLabel}
                className="flex min-w-0 items-center justify-between gap-2 text-[10px] text-zinc-400"
              >
                <span>{slotLabel}</span>
                <select
                  value={groundStrip[slot]}
                  onChange={(e) =>
                    onGroundStripSlot(slot, e.target.value as GroundStripField)
                  }
                  className="min-h-[32px] min-w-0 flex-1 rounded-md border border-white/[0.08] bg-[#0d0e11] px-2 text-[10px] text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  {GROUND_STRIP_FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {GROUND_STRIP_FIELD_LABELS[field]}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button
              type="button"
              onClick={onGroundStripReset}
              className={`${toolClass} border-white/[0.08] bg-[#0d0e11] text-zinc-300 hover:bg-white/[0.04]`}
            >
              Reset strip
            </button>
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-400">
            Run telemetry
          </legend>
          <p className="mb-1.5 text-[10px] tabular-nums text-zinc-400">
            {telemetryCount} {telemetryCount === 1 ? "sample" : "samples"}, one
            per second of play. The FIT file carries heart rate and distance
            only; the CSV has every metric.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={onExportCsv}
              disabled={telemetryCount === 0}
              className={`${toolClass} border-white/[0.08] bg-[#0d0e11] text-zinc-300 hover:bg-white/[0.04]`}
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={onExportFit}
              disabled={telemetryCount === 0}
              className={`${toolClass} border-white/[0.08] bg-[#0d0e11] text-zinc-300 hover:bg-white/[0.04]`}
            >
              Download FIT
            </button>
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-400">
            Developer tools
          </legend>
          <div className="grid gap-1.5">
            <button
              type="button"
              onClick={onWriteFlash}
              className={`${toolClass} border-amber-500/30 bg-amber-500/[0.06] text-amber-200 hover:bg-amber-500/[0.12]`}
            >
              Write NV Flash (+8KB)
            </button>
            <button
              type="button"
              onClick={onClearFlash}
              className={`${toolClass} border-white/[0.08] bg-[#0d0e11] text-zinc-300 hover:bg-white/[0.04]`}
            >
              Clear Flash Storage
            </button>
            <button
              type="button"
              onClick={onDrainBattery}
              disabled={!isPlaying}
              title={
                isPlaying
                  ? undefined
                  : "Start a run first: each run begins on a full battery"
              }
              className={`${toolClass} border-rose-500/30 bg-rose-500/[0.06] text-rose-200 hover:bg-rose-500/[0.12]`}
            >
              Drain Battery (-20%)
            </button>
          </div>
        </fieldset>

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-white/[0.08] pt-3 text-[10px]">
          {KEYS.map(([key, action]) => (
            <React.Fragment key={key}>
              <dt className="text-zinc-200">{key}</dt>
              <dd className="min-w-0 text-zinc-400">{action}</dd>
            </React.Fragment>
          ))}
        </dl>

        <div className="flex flex-wrap items-center gap-2">
          <FieldManualButton manualId="garmin-watch" label="Manual" />
          <FullscreenButton
            isFullscreen={isFullscreen}
            onToggle={onToggleFullscreen}
            variant="header"
          />
        </div>
      </div>
      {children}
    </aside>
  );
}
