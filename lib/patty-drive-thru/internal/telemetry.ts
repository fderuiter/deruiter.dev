import { isStandardScenario, SCENARIO_LIMITS } from "../presets";
import type {
  PayStub,
  ShiftConfig,
  ShiftLogEntry,
  ShiftOutcome,
  ShiftScenario,
  ShiftState,
  ShiftTallies,
} from "../types";
import { computePayStub } from "./engine";
import { scoreShift } from "./view";

/** What a finished shift exports: the setup, the result and what happened. */
export interface ShiftTelemetry {
  readonly version: 1;
  readonly seed: string;
  readonly durationSec: number;
  readonly timeWorkedSec: number;
  readonly outcome: ShiftOutcome;
  readonly score: number;
  /** False for a practice scenario, whose score is not recorded. */
  readonly countsTowardScore: boolean;
  /** The scenario dials the shift set; empty for the standard shift. */
  readonly scenario: ShiftScenario;
  readonly tallies: ShiftTallies;
  readonly payStub: PayStub;
  readonly events: readonly ShiftLogEntry[];
}

function scenarioOf(config: ShiftConfig): ShiftScenario {
  const dials: { -readonly [K in keyof ShiftScenario]: number } = {};
  for (const key of Object.keys(SCENARIO_LIMITS) as Array<
    keyof ShiftScenario
  >) {
    const value = config[key];
    if (value !== undefined) dials[key] = value;
  }
  return dials;
}

/** The shift's setup and result with the events the booth logged. */
export function buildShiftTelemetry(
  shift: ShiftState,
  log: readonly ShiftLogEntry[]
): ShiftTelemetry {
  return {
    version: 1,
    seed: shift.config.seed,
    durationSec: shift.config.durationSec,
    timeWorkedSec: Math.round(shift.time * 100) / 100,
    outcome: shift.outcome,
    score: scoreShift(shift),
    countsTowardScore: isStandardScenario(shift.config),
    scenario: scenarioOf(shift.config),
    tallies: shift.tallies,
    payStub: computePayStub(shift),
    events: log,
  };
}

/** The telemetry as formatted JSON. */
export function exportShiftTelemetryJson(
  shift: ShiftState,
  log: readonly ShiftLogEntry[]
): string {
  return JSON.stringify(buildShiftTelemetry(shift, log), null, 2);
}

const CSV_COLUMNS = [
  "time",
  "event",
  "orderId",
  "itemId",
  "band",
  "outcome",
  "nodeId",
] as const;

function cell(value: unknown): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The event log as CSV, one row per event; the scenario is in the JSON. */
export function exportShiftTelemetryCsv(log: readonly ShiftLogEntry[]): string {
  const rows = log.map(({ time, event }) => {
    const fields: Record<string, unknown> = { ...event };
    return [
      Math.round(time * 100) / 100,
      event.type,
      ...CSV_COLUMNS.slice(2).map((column) => fields[column] ?? ""),
    ]
      .map(cell)
      .join(",");
  });
  return [CSV_COLUMNS.join(","), ...rows].join("\n");
}
