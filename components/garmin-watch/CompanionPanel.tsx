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
import {
  batteryTone,
  meterTone,
  stageProgress,
  type MeterTone,
} from "./watch-face-art";
import { STAGE_COUNT } from "@/lib/garmin-course";
import {
  bodyBatteryFraction,
  bodyBatteryLabel,
} from "@/lib/garmin-body-battery";
import { trainingEffectLabel } from "@/lib/garmin-culture";
import {
  RACE_CATEGORIES,
  RACE_CATEGORY_INFO,
  RACE_COURSES,
  RACE_COURSE_NAMES,
  type RaceCategory,
  type RaceCourse,
} from "@/lib/garmin-race";
import type { WatchBezelTheme } from "./WatchHardware";
import {
  GROUND_STRIP_FIELDS,
  GROUND_STRIP_FIELD_LABELS,
  GROUND_STRIP_SLOT_LABELS,
  type GroundStripField,
  type GroundStripLayout,
} from "@/lib/garmin-ground-strip";

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

const FITNESS_KEYS: Array<[string, string]> = [
  ["▲ / Space", "Jump (hold for higher)"],
  ["▶ / ◀", "Sprint, or ease to a jog to recharge"],
  ["X / ⌫", "Heat bolt or cape spin"],
  ["L", "Backlight"],
  ["Enter", "Start, pause, run again"],
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

/** A race choice: a 44 px target, amber when picked. */
const raceChoiceClass =
  "min-h-11 w-full rounded-lg border px-2.5 py-2 text-left text-[11px] transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  title?: string;
}

interface ChoiceGroupProps<T extends string> {
  /** The accessible name of the group. */
  label: string;
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled: boolean;
  /** Columns on a wide panel; the group stacks when it is narrower. */
  columns: 1 | 2;
  describedBy?: string;
}

/**
 * A radio group with roving focus: one tab stop, arrow keys move and pick.
 * Each choice is a button with role radio and aria-checked.
 */
function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  columns,
  describedBy,
}: ChoiceGroupProps<T>) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    e.preventDefault();
    const at = options.findIndex((o) => o.value === value);
    const next = options[(at + step + options.length) % options.length];
    onChange(next.value);
    const group = e.currentTarget.parentElement;
    const target = group?.querySelector<HTMLElement>(
      `[data-value="${next.value}"]`
    );
    target?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-describedby={describedBy}
      className={`grid gap-1.5 ${columns === 2 ? "grid-cols-2" : "grid-cols-1"}`}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            data-value={option.value}
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
            onKeyDown={onKeyDown}
            className={`${raceChoiceClass} ${
              checked
                ? "border-amber-400/60 bg-amber-500/[0.08] text-amber-100"
                : "border-white/[0.08] bg-[#0d0e11] text-zinc-300 hover:bg-white/[0.04]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

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
  /** Whether Dev Mode (the firmware rules) is on for the next run. */
  devMode: boolean;
  /** Whether the panel shows the fitness readouts rather than the firmware ones. */
  fitnessView: boolean;
  onToggleDevMode: (e: React.MouseEvent) => void;
  /** Race Mode (#2019) is picked: races run on a seeded course with Dev Mode off. */
  raceMode: boolean;
  raceCourse: RaceCourse;
  raceCategory: RaceCategory;
  /** The race picker is locked while a run is playing or paused. */
  raceLocked: boolean;
  onSetRaceMode: (on: boolean) => void;
  onSetRaceCourse: (course: RaceCourse) => void;
  onSetRaceCategory: (category: RaceCategory) => void;
  /** Samples recorded for the current run. */
  telemetryCount: number;
  onExportCsv: () => void;
  onExportFit: () => void;
  groundStrip: GroundStripLayout;
  onGroundStripSlot: (slot: number, field: GroundStripField) => void;
  onGroundStripReset: () => void;
  /** Laid over the panel, e.g. the end-of-run result card. */
  children?: ReactNode;
}

/**
 * The phone-side "Connect IQ" companion: three glance gauges (RAM, NV flash
 * and battery), two sensor bars, the best score, and the device, bezel and
 * developer controls, grouped in one graphite panel beside the watch.
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
  devMode,
  fitnessView,
  onToggleDevMode,
  raceMode,
  raceCourse,
  raceCategory,
  raceLocked,
  onSetRaceMode,
  onSetRaceCourse,
  onSetRaceCategory,
  telemetryCount,
  onExportCsv,
  onExportFit,
  groundStrip,
  onGroundStripSlot,
  onGroundStripReset,
  children,
}: CompanionPanelProps) {
  const profile = DEVICE_PROFILES[deviceTarget];
  const ramFraction = state.allocatedRamKb / profile.ramLimitKb;
  const flashFraction = state.allocatedFlashKb / profile.flashLimitKb;
  const battery = Math.round(state.battery);
  const thermal = Math.round((state.thermalStress ?? 0) * 100);
  const fog = Math.round(state.fogLevel * 100);
  const status = RUN_STATUS[state.gameState];
  const isPlaying = state.gameState === "playing";
  const bb = state.bodyBattery;
  const bbValue = Math.round(bodyBatteryFraction(bb) * 100);
  const stage = state.stage ?? 1;
  const progress = state.gameState === "idle" ? 0 : stageProgress(state);
  const courseFraction = (stage - 1 + progress) / STAGE_COUNT;
  const te = state.lastTrainingEffect;

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

        {fitnessView ? (
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/[0.08] bg-[#0d0e11] px-2 py-3">
            <RingGauge
              label="BODY BATTERY"
              fraction={bbValue / 100}
              tone={bb?.bonked ? "danger" : batteryTone(bbValue)}
              readout={bodyBatteryLabel(bb)}
              valueNow={bbValue}
              valueMax={100}
              valueText={`${bbValue} of 100${bb?.bonked ? ", bonked" : ""}`}
            />
            <RingGauge
              label="5K"
              fraction={courseFraction}
              tone="ok"
              readout={`Stage ${stage} of ${STAGE_COUNT}`}
              valueNow={Math.round(courseFraction * 100)}
              valueMax={100}
              valueText={`${Math.round(courseFraction * 100)}% of the 5K, stage ${stage} of ${STAGE_COUNT}`}
            />
            <RingGauge
              label="TRAINING EFFECT"
              fraction={(te ?? 0) / 5}
              tone="ok"
              readout={
                te === undefined
                  ? "Clear a stage"
                  : `${te.toFixed(1)} · ${trainingEffectLabel(te)}`
              }
              valueNow={te ?? 0}
              valueMax={5}
              valueText={
                te === undefined
                  ? "No stage cleared yet"
                  : `${te.toFixed(1)} of 5, ${trainingEffectLabel(te)}`
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/[0.08] bg-[#0d0e11] px-2 py-3">
            <RingGauge
              label="RAM"
              fraction={ramFraction}
              tone={meterTone(ramFraction)}
              readout={`${state.allocatedRamKb.toFixed(1)} / ${profile.ramLimitKb} KB`}
              valueNow={state.allocatedRamKb}
              valueMax={profile.ramLimitKb}
              valueText={`${state.allocatedRamKb.toFixed(1)} of ${profile.ramLimitKb} KB`}
            />
            <RingGauge
              label="FLASH"
              fraction={flashFraction}
              tone={meterTone(flashFraction)}
              readout={`${state.allocatedFlashKb.toFixed(1)} / ${profile.flashLimitKb} KB`}
              valueNow={state.allocatedFlashKb}
              valueMax={profile.flashLimitKb}
              valueText={`${state.allocatedFlashKb.toFixed(1)} of ${profile.flashLimitKb} KB`}
            />
            <RingGauge
              label="BATTERY"
              fraction={battery / 100}
              tone={batteryTone(battery)}
              readout={
                battery < 15 && battery > 0
                  ? "Low power"
                  : state.isLightOn
                    ? "Light on"
                    : "Light off"
              }
              valueNow={battery}
              valueMax={100}
              valueText={`${battery}%`}
            />
          </div>
        )}

        {fitnessView ? (
          <div className="flex items-end justify-between gap-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">
              Kudos{" "}
              <span className="text-sm font-bold tabular-nums text-zinc-200">
                {state.kudos ?? 0}
              </span>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                Best
              </div>
              <div className="text-sm font-bold tabular-nums text-amber-300">
                {highScore}
              </div>
            </div>
          </div>
        ) : (
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
        )}

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
            Run mode
          </legend>
          <div className="grid gap-2">
            <ChoiceGroup<"training" | "race">
              label="Run mode"
              value={raceMode ? "race" : "training"}
              disabled={raceLocked}
              columns={2}
              onChange={(value) => onSetRaceMode(value === "race")}
              options={[
                {
                  value: "training",
                  label: "Training Run",
                  title: "A random course every run.",
                },
                {
                  value: "race",
                  label: "Race Mode",
                  title:
                    "The same seeded course every attempt, with Dev Mode off.",
                },
              ]}
            />
            {raceMode && (
              <>
                <p className="text-[10px] text-zinc-400">
                  Races run with Dev Mode off.
                </p>
                <p className="text-[10px] uppercase tracking-wider text-zinc-400">
                  Course
                </p>
                <ChoiceGroup<RaceCourse>
                  label="Race course"
                  value={raceCourse}
                  disabled={raceLocked}
                  columns={1}
                  onChange={onSetRaceCourse}
                  options={RACE_COURSES.map((course) => ({
                    value: course,
                    label: RACE_COURSE_NAMES[course],
                    title:
                      course === "daily"
                        ? "Today's course: the same for everyone, new at local midnight."
                        : "The same course every attempt.",
                  }))}
                />
                <p className="text-[10px] uppercase tracking-wider text-zinc-400">
                  Category
                </p>
                <ChoiceGroup<RaceCategory>
                  label="Race category"
                  value={raceCategory}
                  disabled={raceLocked}
                  columns={1}
                  onChange={onSetRaceCategory}
                  describedBy="race-category-rule"
                  options={RACE_CATEGORIES.map((category) => ({
                    value: category,
                    label: RACE_CATEGORY_INFO[category].name,
                  }))}
                />
                <p
                  id="race-category-rule"
                  className="text-[10px] text-zinc-400"
                >
                  {RACE_CATEGORY_INFO[raceCategory].rule}
                </p>
              </>
            )}
            {raceLocked && (
              <p className="text-[10px] text-zinc-400">
                Run mode changes once this run ends.
              </p>
            )}
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-400">
            Developer tools
          </legend>
          <div className="grid gap-1.5">
            <button
              type="button"
              role="switch"
              aria-checked={devMode && !raceMode}
              aria-label="Dev Mode"
              aria-disabled={raceMode}
              disabled={raceMode}
              onClick={onToggleDevMode}
              title={
                raceMode
                  ? "Races run with Dev Mode off. Your Dev Mode setting is kept."
                  : "Brings back the firmware rules: heap, garbage collection, flash, battery and fog. Applies from the next run."
              }
              className={`${toolClass} border-white/[0.08] bg-[#0d0e11] text-zinc-300 hover:bg-white/[0.04]`}
            >
              Dev Mode: {devMode && !raceMode ? "On" : "Off"}
              {raceMode ? " (races are off)" : ""}
              {!raceMode &&
              fitnessView === devMode &&
              state.gameState !== "idle"
                ? " (next run)"
                : ""}
            </button>
            {!fitnessView && (
              <>
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
              </>
            )}
          </div>
        </fieldset>

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-white/[0.08] pt-3 text-[10px]">
          {(fitnessView ? FITNESS_KEYS : KEYS).map(([key, action]) => (
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
