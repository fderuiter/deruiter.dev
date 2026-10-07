/**
 * Telemetry export routines for Patty's Drive-Thru (ADR 0059).
 * Generates JSON and CSV time-series telemetry data for custom and default scenarios.
 */

import {
  applyAction,
  computePayStub,
  createShift,
  isShiftOver,
  stepShift,
} from "./engine";
import { scoreShift } from "./view";
import type {
  PayStub,
  ShiftActionEntry,
  ShiftEvent,
  ShiftOutcome,
  ShiftScenarioConfig,
  ShiftState,
  ShiftTallies,
} from "../types";

export interface TelemetryEvent {
  readonly time: number;
  readonly type: string;
  readonly details: Record<string, unknown>;
}

export interface ShiftTelemetryData {
  readonly metadata: {
    readonly seed: string;
    readonly durationSec: number;
    readonly timeWorkedSec: number;
    readonly outcome: ShiftOutcome;
    readonly score: number;
    readonly timestamp: string;
    readonly config: ShiftScenarioConfig;
    readonly tallies: ShiftTallies;
    readonly payStub: PayStub;
  };
  readonly events: readonly TelemetryEvent[];
}

/**
 * Replays shift actions and steps to collect time-series events.
 */
export function collectShiftEvents(
  config: ShiftScenarioConfig,
  history: readonly ShiftActionEntry[] = [],
  finalTime: number = config.durationSec
): TelemetryEvent[] {
  let state = createShift(config);
  const events: TelemetryEvent[] = [];

  const recordEvents = (time: number, shiftEvents: readonly ShiftEvent[]) => {
    for (const ev of shiftEvents) {
      const { type, ...rest } = ev;
      events.push({
        time: Number(time.toFixed(2)),
        type,
        details: rest as Record<string, unknown>,
      });
    }
  };

  const sortedHistory = [...history].sort((a, b) => a.at - b.at);
  const maxTime = Math.min(finalTime, config.durationSec);

  for (const entry of sortedHistory) {
    if (entry.at > maxTime || isShiftOver(state)) break;
    while (!isShiftOver(state) && state.time < entry.at) {
      const dt = Math.min(0.5, entry.at - state.time);
      const stepRes = stepShift(state, dt);
      state = stepRes.state;
      recordEvents(state.time, stepRes.events);
      if (dt <= 0) break;
    }
    if (!isShiftOver(state) && state.time >= entry.at) {
      const actRes = applyAction(state, entry.action);
      state = actRes.state;
      recordEvents(state.time, actRes.events);
    }
  }

  while (!isShiftOver(state) && state.time < maxTime) {
    const dt = Math.min(0.5, maxTime - state.time);
    const stepRes = stepShift(state, dt);
    state = stepRes.state;
    recordEvents(state.time, stepRes.events);
    if (dt <= 0) break;
  }

  return events;
}

/**
 * Generates structured shift telemetry data containing scenario metadata and event logs.
 */
export function generateShiftTelemetry(
  shift: ShiftState,
  history: readonly ShiftActionEntry[] = shift.history ?? []
): ShiftTelemetryData {
  const payStub = computePayStub(shift);
  const score = scoreShift(shift);
  const events = collectShiftEvents(shift.config, history, shift.time);

  return {
    metadata: {
      seed: shift.config.seed,
      durationSec: shift.config.durationSec,
      timeWorkedSec: Number(shift.time.toFixed(2)),
      outcome: shift.outcome,
      score,
      timestamp: new Date().toISOString(),
      config: shift.config,
      tallies: shift.tallies,
      payStub,
    },
    events,
  };
}

/**
 * Exports shift telemetry as a formatted JSON string.
 */
export function exportShiftTelemetryJson(
  shift: ShiftState,
  history: readonly ShiftActionEntry[] = shift.history ?? []
): string {
  const data = generateShiftTelemetry(shift, history);
  return JSON.stringify(data, null, 2);
}

/**
 * Exports shift telemetry as a CSV string.
 */
export function exportShiftTelemetryCsv(
  shift: ShiftState,
  history: readonly ShiftActionEntry[] = shift.history ?? []
): string {
  const data = generateShiftTelemetry(shift, history);
  const lines: string[] = [];

  // Metadata comments header
  lines.push(`# Patty's Drive-Thru Shift Telemetry Export`);
  lines.push(
    `# Seed: ${data.metadata.seed}, Duration: ${data.metadata.durationSec}s, Worked: ${data.metadata.timeWorkedSec}s, Outcome: ${data.metadata.outcome}, Score: ${data.metadata.score}`
  );
  lines.push(`time,type,orderId,itemId,band,outcome,details`);

  for (const ev of data.events) {
    const orderId =
      typeof ev.details.orderId === "number" ? String(ev.details.orderId) : "";
    const itemId =
      typeof ev.details.itemId === "string" ? ev.details.itemId : "";
    const band = typeof ev.details.band === "string" ? ev.details.band : "";
    const outcome =
      typeof ev.details.outcome === "string" ? ev.details.outcome : "";
    const otherDetails = JSON.stringify(
      Object.fromEntries(
        Object.entries(ev.details).filter(
          ([k]) => !["orderId", "itemId", "band", "outcome"].includes(k)
        )
      )
    );
    lines.push(
      `${ev.time},${ev.type},${orderId},${itemId},${band},${outcome},"${otherDetails.replace(
        /"/g,
        '""'
      )}"`
    );
  }

  return lines.join("\n");
}

/**
 * Helper to trigger browser file download for JSON telemetry.
 */
export function downloadShiftTelemetryJson(
  shift: ShiftState,
  filename?: string
): void {
  const json = exportShiftTelemetryJson(shift);
  const name =
    filename ??
    `pdt-telemetry-${shift.config.seed}-${Math.round(shift.time)}s.json`;
  triggerDownload(json, name, "application/json");
}

/**
 * Helper to trigger browser file download for CSV telemetry.
 */
export function downloadShiftTelemetryCsv(
  shift: ShiftState,
  filename?: string
): void {
  const csv = exportShiftTelemetryCsv(shift);
  const name =
    filename ??
    `pdt-telemetry-${shift.config.seed}-${Math.round(shift.time)}s.csv`;
  triggerDownload(csv, name, "text/csv");
}

function triggerDownload(
  content: string,
  filename: string,
  mimeType: string
): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
