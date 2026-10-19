import { describe, it, expect } from "vitest";
import {
  escapeCsvValue,
  exportTelemetryToJson,
  exportSummaryToCsv,
  exportStepTrajectoriesToCsv,
  exportCombatLogsToCsv,
  exportTelemetryToCsv,
  type RunTelemetryData,
} from "@/lib/retro-labyrinth/telemetry";

describe("Retro Labyrinth Run Telemetry Exporter", () => {
  const sampleTelemetry: RunTelemetryData = {
    summary: {
      runId: "run_test_123",
      levelId: "custom",
      levelTitle: "=SUM(1,2) Test Level", // Formula trigger
      startTime: 1700000000000,
      endTime: 1700000060000,
      durationMs: 60000,
      totalSteps: 2,
      combatActionsCount: 2,
      finalStatus: "victory",
      finalScore: 250,
      enemiesDefeated: 1,
      itemsCollected: 1,
      damageDealt: 10,
      damageTaken: 5,
    },
    stepTrajectories: [
      {
        stepIndex: 1,
        timestamp: 1700000001000,
        x: 2,
        y: 1,
        dx: 1,
        dy: 0,
        playerHp: 100,
        score: 0,
      },
      {
        stepIndex: 2,
        timestamp: 1700000002000,
        x: 3,
        y: 1,
        dx: 1,
        dy: 0,
        playerHp: 95,
        score: 50,
      },
    ],
    combatLogs: [
      {
        actionIndex: 1,
        timestamp: 1700000001500,
        actionType: "fire_weapon",
        weaponId: "npm_install",
        damage: 10,
        details: 'Fired "npm_install" weapon',
      },
      {
        actionIndex: 2,
        timestamp: 1700000002500,
        actionType: "item_pickup",
        targetX: 3,
        targetY: 1,
        details: "Picked up Coffee, Hot",
      },
    ],
  };

  it("escapes formula trigger characters (=, +, -, @) to prevent CSV injection", () => {
    expect(escapeCsvValue("=SUM(1,2)")).toBe('"' + "'=SUM(1,2)" + '"');
    expect(escapeCsvValue("+CMD()")).toBe('"' + "'+CMD()" + '"');
    expect(escapeCsvValue("-100")).toBe('"' + "'-100" + '"');
    expect(escapeCsvValue("@ADMIN")).toBe('"' + "'@ADMIN" + '"');
  });

  it("escapes double quotes and commas according to RFC-4180 CSV standard", () => {
    expect(escapeCsvValue('Coffee, "Hot"')).toBe('"Coffee, ""Hot"""');
  });

  it("exports valid JSON telemetry payload", () => {
    const jsonStr = exportTelemetryToJson(sampleTelemetry);
    expect(jsonStr).toContain('"runId": "run_test_123"');
    expect(jsonStr).toContain('"totalSteps": 2');
    const parsed = JSON.parse(jsonStr);
    expect(parsed.summary.finalScore).toBe(250);
  });

  it("exports summary, steps, and combat logs into properly formatted CSV strings", () => {
    const summaryCsv = exportSummaryToCsv(sampleTelemetry.summary);
    expect(summaryCsv).toContain("Run ID,Level ID,Level Title");
    expect(summaryCsv).toContain("run_test_123");

    const stepsCsv = exportStepTrajectoriesToCsv(
      sampleTelemetry.stepTrajectories
    );
    expect(stepsCsv).toContain(
      "Step Index,Timestamp,X,Y,DX,DY,Player HP,Score"
    );
    expect(stepsCsv).toContain("1,1700000001000,2,1,1,0,100,0");

    const combatCsv = exportCombatLogsToCsv(sampleTelemetry.combatLogs);
    expect(combatCsv).toContain("Action Index,Timestamp,Action Type");
    expect(combatCsv).toContain("fire_weapon");
  });

  it("exports combined multi-section telemetry CSV file", () => {
    const { combinedCsv } = exportTelemetryToCsv(sampleTelemetry);
    expect(combinedCsv).toContain("# RUN TELEMETRY SUMMARY");
    expect(combinedCsv).toContain("# STEP TRAJECTORIES");
    expect(combinedCsv).toContain("# COMBAT ACTIONS LOG");
  });
});
