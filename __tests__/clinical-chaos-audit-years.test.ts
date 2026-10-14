// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  addOpenedStations,
  AUDIT_YEAR_LOCKS,
  createInitialAuditorState,
  createInitialPowerUpInventory,
  createInitialScoreState,
  describeAuditYear,
  formatAuditYearLog,
  generateClinicalSubject,
  getAmendmentIntervalSeconds,
  getAuditYear,
  getAuditYearAmendmentFactor,
  getAuditYearAxis,
  getAuditYearErrorChance,
  getAuditYearEscalation,
  getAuditYearSpawnFactor,
  getAuditYearStationCount,
  getLocksToNextAuditYear,
  getSpawnIntervalSeconds,
  getStationsForPhase,
  MAX_CONVEYOR_SUBJECTS,
  mergeEndlessBest,
  parseEndlessBest,
  scrambleStations,
  SPAWN_INTERVAL_BY_PHASE,
  tickShiftClocks,
  type ClinicalSubject,
  type ShiftClocks,
} from "@/lib/clinical-trial-chaos";

describe("Audit Year progression (#2053)", () => {
  it("starts at year 1 and advances every AUDIT_YEAR_LOCKS locks", () => {
    expect(getAuditYear(0)).toBe(1);
    expect(getAuditYear(AUDIT_YEAR_LOCKS - 1)).toBe(1);
    expect(getAuditYear(AUDIT_YEAR_LOCKS)).toBe(2);
    expect(getAuditYear(AUDIT_YEAR_LOCKS * 4 + 2)).toBe(5);
  });

  it("treats negative and non-finite lock counts as zero", () => {
    expect(getAuditYear(-5)).toBe(1);
    expect(getAuditYear(Number.NaN)).toBe(1);
    expect(getLocksToNextAuditYear(Number.NaN)).toBe(AUDIT_YEAR_LOCKS);
  });

  it("counts locks remaining to the next year", () => {
    expect(getLocksToNextAuditYear(0)).toBe(AUDIT_YEAR_LOCKS);
    expect(getLocksToNextAuditYear(AUDIT_YEAR_LOCKS - 1)).toBe(1);
    expect(getLocksToNextAuditYear(AUDIT_YEAR_LOCKS)).toBe(AUDIT_YEAR_LOCKS);
  });

  it("raises spawn, stations, errors, then amendments in turn", () => {
    expect(getAuditYearAxis(1)).toBeNull();
    expect([2, 3, 4, 5, 6].map(getAuditYearAxis)).toEqual([
      "spawn",
      "stations",
      "errors",
      "amendments",
      "spawn",
    ]);
    expect(getAuditYearEscalation(1)).toEqual({
      spawn: 0,
      stations: 0,
      errors: 0,
      amendments: 0,
    });
    expect(getAuditYearEscalation(5)).toEqual({
      spawn: 1,
      stations: 1,
      errors: 1,
      amendments: 1,
    });
    expect(getAuditYearEscalation(6).spawn).toBe(2);
  });

  it("spends station steps on spawn pressure once every station is open", () => {
    // Years 3 and 7 open DS and MH; year 11's station step has no room.
    expect(getAuditYearStationCount(2)).toBe(6);
    expect(getAuditYearStationCount(3)).toBe(7);
    expect(getAuditYearStationCount(7)).toBe(8);
    expect(getAuditYearStationCount(11)).toBe(8);
    expect(getAuditYearEscalation(11).spawn).toBe(
      getAuditYearEscalation(10).spawn + 1
    );
    expect(describeAuditYear(11)).toMatch(/faster/);
    expect(describeAuditYear(3)).toMatch(/station opens/);
  });

  it("makes every axis monotonically harder year over year", () => {
    for (let year = 1; year < 40; year++) {
      expect(getAuditYearSpawnFactor(year + 1)).toBeLessThanOrEqual(
        getAuditYearSpawnFactor(year)
      );
      expect(getAuditYearStationCount(year + 1)).toBeGreaterThanOrEqual(
        getAuditYearStationCount(year)
      );
      expect(getAuditYearErrorChance(0.5, year + 1)).toBeGreaterThanOrEqual(
        getAuditYearErrorChance(0.5, year)
      );
      expect(getAuditYearAmendmentFactor(year + 1)).toBeLessThanOrEqual(
        getAuditYearAmendmentFactor(year)
      );
    }
  });

  it("bounds each axis", () => {
    expect(getAuditYearSpawnFactor(500)).toBeCloseTo(0.35);
    expect(getAuditYearErrorChance(0.5, 500)).toBe(0.95);
    expect(getAuditYearAmendmentFactor(500)).toBeCloseTo(0.4);
    expect(getAuditYearErrorChance(Number.NaN, 1)).toBe(0);
  });

  it("tightens getSpawnIntervalSeconds in later years and leaves year 1 alone", () => {
    expect(getSpawnIntervalSeconds(1, 3, (s) => s, 1, 1)).toBe(
      SPAWN_INTERVAL_BY_PHASE[1]
    );
    expect(getSpawnIntervalSeconds(1, 3, (s) => s, 1, 2)).toBeCloseTo(
      SPAWN_INTERVAL_BY_PHASE[1] * 0.85
    );
    // The empty-queue refill is unaffected.
    expect(getSpawnIntervalSeconds(1, 0, (s) => s, 1, 9)).toBe(
      getSpawnIntervalSeconds(1, 0)
    );
  });

  it("shortens getAmendmentIntervalSeconds once the amendment axis rises", () => {
    expect(getAmendmentIntervalSeconds(1)).toBe(40);
    expect(getAmendmentIntervalSeconds(1, 4)).toBe(40);
    expect(getAmendmentIntervalSeconds(1, 5)).toBeCloseTo(32);
  });

  it("opens stations through getStationsForPhase in endless mode", () => {
    expect(getStationsForPhase(1, "endless")).toHaveLength(6);
    expect(getStationsForPhase(1, "endless", 3).map((s) => s.id)).toContain(
      "DS"
    );
    expect(getStationsForPhase(1, "endless", 7)).toHaveLength(8);
    // Campaign ignores the Audit Year.
    expect(getStationsForPhase(1, "campaign", 9)).toHaveLength(4);
  });

  it("adds opened stations without undoing a scramble", () => {
    const scrambled = scrambleStations(getStationsForPhase(1, "endless", 1));
    const merged = addOpenedStations(
      scrambled,
      getStationsForPhase(1, "endless", 3)
    );
    expect(merged).toHaveLength(7);
    expect(merged.slice(0, 6)).toEqual(scrambled);
    expect(merged[6].id).toBe("DS");
    expect(merged[6].positionIndex).toBe(6);
    expect(addOpenedStations(merged, merged)).toEqual(merged);
  });

  it("formats the audit log line for a new year", () => {
    expect(formatAuditYearLog(4)).toBe(
      "[AUDIT YEAR 4] FDA re-inspection cycle begins. Site data quality slips: more CRFs arrive with discrepancies."
    );
  });
});

describe("endless best (#2053)", () => {
  it("parses stored values defensively", () => {
    expect(parseEndlessBest(null)).toEqual({ score: 0, auditYear: 1 });
    expect(parseEndlessBest("not json")).toEqual({ score: 0, auditYear: 1 });
    expect(parseEndlessBest("42")).toEqual({ score: 0, auditYear: 1 });
    expect(parseEndlessBest('{"score":"x","auditYear":-3}')).toEqual({
      score: 0,
      auditYear: 1,
    });
    expect(parseEndlessBest('{"score":1250.7,"auditYear":4}')).toEqual({
      score: 1250,
      auditYear: 4,
    });
  });

  it("keeps the higher score and the furthest year independently", () => {
    const best = { score: 900, auditYear: 5 };
    expect(mergeEndlessBest(best, 400, 3)).toEqual({
      best,
      improved: false,
    });
    expect(mergeEndlessBest(best, 1200, 2)).toEqual({
      best: { score: 1200, auditYear: 5 },
      improved: true,
    });
    expect(mergeEndlessBest(best, 100, 6).best).toEqual({
      score: 900,
      auditYear: 6,
    });
    expect(mergeEndlessBest(best, Number.NaN, Number.NaN).improved).toBe(false);
  });
});

describe("an idle endless run (#2053)", () => {
  it("still reaches a Form 483 with no player input", () => {
    const domains = getStationsForPhase(1, "endless").map((s) => s.id);
    let seq = 9000;
    const spawn = (): ClinicalSubject =>
      generateClinicalSubject(0.5, false, seq++, domains);
    let clocks: ShiftClocks = {
      subjects: [spawn(), spawn(), spawn()],
      auditor: createInitialAuditorState(),
      scoreState: createInitialScoreState(),
      powerUps: createInitialPowerUpInventory(),
      amendment: null,
    };
    const dt = 0.1;
    let spawnTimer = 0;
    let elapsed = 0;
    let maxed = false;
    while (elapsed < 300 && !maxed) {
      const tick = tickShiftClocks(clocks, dt);
      clocks = tick;
      maxed = tick.suspicionMaxed;
      // No locks, so the run stays in Audit Year 1.
      const year = getAuditYear(clocks.scoreState.subjectsSubmitted);
      spawnTimer += dt;
      if (
        spawnTimer >
          getSpawnIntervalSeconds(
            1,
            clocks.subjects.length,
            (s) => s,
            1,
            year
          ) &&
        clocks.subjects.length < MAX_CONVEYOR_SUBJECTS
      ) {
        spawnTimer = 0;
        clocks = { ...clocks, subjects: [...clocks.subjects, spawn()] };
      }
      elapsed += dt;
    }
    expect(maxed).toBe(true);
    expect(clocks.auditor.behavior).toBe("issuing_483");
    expect(elapsed).toBeLessThan(150);
  });
});
