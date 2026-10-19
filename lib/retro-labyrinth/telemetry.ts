import { downloadFile } from "@/lib/download";

export interface StepTrajectoryEntry {
  stepIndex: number;
  timestamp: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  playerHp: number;
  score: number;
}

export interface CombatActionEntry {
  actionIndex: number;
  timestamp: number;
  actionType:
    | "fire_weapon"
    | "enemy_hit"
    | "player_damaged"
    | "enemy_defeated"
    | "item_pickup";
  weaponId?: string;
  targetX?: number;
  targetY?: number;
  damage?: number;
  enemyType?: string;
  details?: string;
}

export interface RunSummaryStats {
  runId: string;
  levelId: string;
  levelTitle: string;
  startTime: number;
  endTime?: number;
  durationMs: number;
  totalSteps: number;
  combatActionsCount: number;
  finalStatus: "playing" | "victory" | "game_over";
  finalScore: number;
  enemiesDefeated: number;
  itemsCollected: number;
  damageDealt: number;
  damageTaken: number;
}

export interface RunTelemetryData {
  summary: RunSummaryStats;
  stepTrajectories: StepTrajectoryEntry[];
  combatLogs: CombatActionEntry[];
}

/**
 * Escapes CSV field values according to RFC-4180 rules and guards against
 * formula trigger character injection (=, +, -, @).
 */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value);

  // Guard against formula execution in spreadsheet software
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }

  // Quote escaping and enclosing
  if (/[",\n\r]/.test(str) || str.startsWith("'")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function exportTelemetryToJson(data: RunTelemetryData): string {
  return JSON.stringify(data, null, 2);
}

export function exportSummaryToCsv(summary: RunSummaryStats): string {
  const headers = [
    "Run ID",
    "Level ID",
    "Level Title",
    "Start Time",
    "End Time",
    "Duration (ms)",
    "Total Steps",
    "Combat Actions",
    "Final Status",
    "Final Score",
    "Enemies Defeated",
    "Items Collected",
    "Damage Dealt",
    "Damage Taken",
  ];

  const row = [
    summary.runId,
    summary.levelId,
    summary.levelTitle,
    summary.startTime,
    summary.endTime ?? "",
    summary.durationMs,
    summary.totalSteps,
    summary.combatActionsCount,
    summary.finalStatus,
    summary.finalScore,
    summary.enemiesDefeated,
    summary.itemsCollected,
    summary.damageDealt,
    summary.damageTaken,
  ];

  return [
    headers.map(escapeCsvValue).join(","),
    row.map(escapeCsvValue).join(","),
  ].join("\n");
}

export function exportStepTrajectoriesToCsv(
  steps: StepTrajectoryEntry[]
): string {
  const headers = [
    "Step Index",
    "Timestamp",
    "X",
    "Y",
    "DX",
    "DY",
    "Player HP",
    "Score",
  ];

  const rows = steps.map((s) => [
    s.stepIndex,
    s.timestamp,
    s.x,
    s.y,
    s.dx,
    s.dy,
    s.playerHp,
    s.score,
  ]);

  return [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((r) => r.map(escapeCsvValue).join(",")),
  ].join("\n");
}

export function exportCombatLogsToCsv(logs: CombatActionEntry[]): string {
  const headers = [
    "Action Index",
    "Timestamp",
    "Action Type",
    "Weapon ID",
    "Target X",
    "Target Y",
    "Damage",
    "Enemy Type",
    "Details",
  ];

  const rows = logs.map((l) => [
    l.actionIndex,
    l.timestamp,
    l.actionType,
    l.weaponId ?? "",
    l.targetX ?? "",
    l.targetY ?? "",
    l.damage ?? "",
    l.enemyType ?? "",
    l.details ?? "",
  ]);

  return [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((r) => r.map(escapeCsvValue).join(",")),
  ].join("\n");
}

export function exportTelemetryToCsv(data: RunTelemetryData): {
  summaryCsv: string;
  stepsCsv: string;
  combatCsv: string;
  combinedCsv: string;
} {
  const summaryCsv = exportSummaryToCsv(data.summary);
  const stepsCsv = exportStepTrajectoriesToCsv(data.stepTrajectories);
  const combatCsv = exportCombatLogsToCsv(data.combatLogs);

  const combinedCsv = [
    "# RUN TELEMETRY SUMMARY",
    summaryCsv,
    "",
    "# STEP TRAJECTORIES",
    stepsCsv,
    "",
    "# COMBAT ACTIONS LOG",
    combatCsv,
  ].join("\n");

  return { summaryCsv, stepsCsv, combatCsv, combinedCsv };
}

export function downloadTelemetryFile(
  data: RunTelemetryData,
  format: "json" | "csv" = "json"
): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `retro-labyrinth-telemetry-${timestamp}.${format}`;

  if (format === "json") {
    const jsonContent = exportTelemetryToJson(data);
    downloadFile(jsonContent, filename, {
      mimeType: "application/json;charset=utf-8",
    });
  } else {
    const { combinedCsv } = exportTelemetryToCsv(data);
    downloadFile(combinedCsv, filename, {
      mimeType: "text/csv;charset=utf-8",
    });
  }
}
