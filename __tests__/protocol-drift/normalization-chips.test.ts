// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  KPA_TO_MMHG,
  formatDisplay,
  normalizeDate,
  regexSplit,
  standardUnit,
  standardizeUnit,
  vsTestName,
  WAVE1_GRAPH,
} from "@/lib/protocol-drift";
import {
  ok,
  publish,
  runUntil,
  startEngine,
  WAVE_END_MINUTES,
} from "./helpers";

describe("DateLocaleNormalizer", () => {
  it("resolves 08/11/2025 by site profile", () => {
    expect(normalizeDate("08/11/2025", "DD/MM/YYYY")).toEqual({
      ok: true,
      iso: "2025-11-08",
      partial: false,
    });
    expect(normalizeDate("08/11/2025", "MM/DD/YYYY")).toEqual({
      ok: true,
      iso: "2025-08-11",
      partial: false,
    });
  });

  it("accepts ISO and partial dates and rejects garbage", () => {
    expect(normalizeDate("2025-11-08", "DD/MM/YYYY")).toMatchObject({
      ok: true,
      iso: "2025-11-08",
    });
    expect(normalizeDate("2025-10", "DD/MM/YYYY")).toEqual({
      ok: true,
      iso: "2025-10",
      partial: true,
    });
    expect(normalizeDate("2025", "DD/MM/YYYY")).toEqual({
      ok: true,
      iso: "2025",
      partial: true,
    });
    expect(normalizeDate("10/2025", "MM/DD/YYYY")).toEqual({
      ok: true,
      iso: "2025-10",
      partial: true,
    });
    expect(normalizeDate("13/2025", "MM/DD/YYYY").ok).toBe(false);
    expect(normalizeDate("2025-13", "MM/DD/YYYY").ok).toBe(false);
    expect(normalizeDate("2025-02-30", "MM/DD/YYYY").ok).toBe(false);
    expect(normalizeDate("15/11/2025", "MM/DD/YYYY").ok).toBe(false);
    expect(normalizeDate("yesterday", "MM/DD/YYYY")).toEqual({
      ok: false,
      reason: "Unparseable date: yesterday",
    });
  });
});

describe("UnitStandardizer", () => {
  it("maps 16.0 kPa to 120.0 mmHg and keeps 16.0 / kPa as original", () => {
    const std = standardizeUnit("16.0", "kPa");
    expect(std).not.toBeNull();
    expect(std?.orres).toBe("16.0");
    expect(std?.orresu).toBe("kPa");
    expect(std?.stresu).toBe("mmHg");
    expect(std?.stresn).toBe(16 * KPA_TO_MMHG);
    expect(formatDisplay(std?.stresn as number, std?.precision as number)).toBe(
      "120.0"
    );
    expect(formatDisplay(10.7 * KPA_TO_MMHG, 1)).toBe("80.3");
  });

  it("passes mmHg and beats/min through and quarantines unknown units", () => {
    expect(standardizeUnit("118", "mmHg")).toEqual({
      orres: "118",
      orresu: "mmHg",
      stresn: 118,
      stresu: "mmHg",
      precision: 0,
    });
    expect(standardizeUnit("72", "beats/min")?.stresn).toBe(72);
    expect(standardizeUnit("16.0", "psi")).toBeNull();
    expect(standardizeUnit("", "mmHg")).toBeNull();
    expect(standardizeUnit("abc", "mmHg")).toBeNull();
    expect(standardUnit("PULSE")).toBe("beats/min");
    expect(standardUnit("SYSBP")).toBe("mmHg");
    expect(vsTestName("DIABP")).toBe("Diastolic Blood Pressure");
    expect(vsTestName("PULSE")).toBe("Pulse Rate");
  });
});

describe("RegexSplit", () => {
  it("takes 120/80 as primary and diverts the repeat reading to unmatched", () => {
    const r = regexSplit("120/80 sitting, repeat after rest 118/78");
    expect(r.sbp).toBe(120);
    expect(r.dbp).toBe(80);
    expect(r.unmatched).toBe("sitting, repeat after rest 118/78");
    expect(r.readings).toEqual([
      { sbp: 120, dbp: 80 },
      { sbp: 118, dbp: 78 },
    ]);
  });

  it("leaves nothing unmatched for a clean reading and everything for no match", () => {
    expect(regexSplit("124/82")).toMatchObject({
      sbp: 124,
      dbp: 82,
      unmatched: "",
    });
    expect(regexSplit("pt refused")).toMatchObject({
      sbp: null,
      dbp: null,
      unmatched: "pt refused",
    });
  });
});

describe("normalization failures inside the engine", () => {
  it("raises visible issues for an unknown unit and an unparseable date instead of guessing", () => {
    const engine = startEngine();
    publish(engine, WAVE1_GRAPH, "p1");
    runUntil(engine, WAVE_END_MINUTES[1]);
    ok(engine, { type: "SET_PAUSED", isPaused: true });
    ok(engine, {
      type: "SITE_SOURCE_CORRECTION",
      submissionId: "sub-c01-d07",
      payload: {
        visit_date: "31/31/2025",
        sbp: "16.0",
        dbp: "10.7",
        pulse: 70,
        bp_unit: "psi",
      },
      reason: "Re-entered",
    });
    const codes = engine
      .view()
      .issues.filter((i) => i.submissionId === "sub-c01-d07")
      .map((i) => i.code);
    expect(codes).toEqual(
      expect.arrayContaining(["UNKNOWN_UNIT", "DATE_UNPARSEABLE"])
    );
    expect(engine.view().debt.semanticLossCount).toBeGreaterThan(0);
  });
});
