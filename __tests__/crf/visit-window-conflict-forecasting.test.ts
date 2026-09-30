import { describe, expect, it } from "vitest";
import {
  evaluateVisitWindowConflicts,
  calculateScheduleBounds,
  calculateBaselineDrift,
  calculateMilestoneForecasts,
  addDaysToIsoDate,
} from "@/lib/crf/visit-window";
import type { StudyVisit } from "@/lib/crf/types";

describe("CRF Visit Window Conflict Evaluator & Forecasting Engine", () => {
  describe("evaluateVisitWindowConflicts", () => {
    it("detects overlap when targetDay_A + windowAfter_A >= targetDay_B - windowBefore_B (symmetric windows)", () => {
      const visits: StudyVisit[] = [
        {
          id: "v1",
          oid: "SE.VISIT1",
          name: "Visit 1",
          visitType: "Scheduled",
          targetDay: 0,
          windowBefore: 0,
          windowAfter: 5,
          assignedFormIds: [],
        },
        {
          id: "v2",
          oid: "SE.VISIT2",
          name: "Visit 2",
          visitType: "Scheduled",
          targetDay: 7,
          windowBefore: 3,
          windowAfter: 3,
          assignedFormIds: [],
        },
      ];

      // Day 0 + 5 = Day 5; Day 7 - 3 = Day 4. Latest Day 5 >= Earliest Day 4 -> Overlap of 2 days (4 and 5)
      const result = evaluateVisitWindowConflicts(visits);
      expect(result.hasConflicts).toBe(true);
      expect(result.totalConflicts).toBe(1);
      expect(result.conflicts[0].visitIdA).toBe("v1");
      expect(result.conflicts[0].visitIdB).toBe("v2");
      expect(result.conflicts[0].overlapDays).toBe(2);
      expect(result.conflicts[0].message).toContain(
        "Visit 1 late window (Day 5) overlaps Visit 2 early window (Day 4)"
      );
    });

    it("detects asymmetric and one-sided window overlaps accurately", () => {
      const visits: StudyVisit[] = [
        {
          id: "v1",
          oid: "SE.VISIT1",
          name: "Visit 1",
          visitType: "Scheduled",
          targetDay: 10,
          windowBefore: 1,
          windowAfter: 7, // Latest Day = 17
          assignedFormIds: [],
        },
        {
          id: "v2",
          oid: "SE.VISIT2",
          name: "Visit 2",
          visitType: "Scheduled",
          targetDay: 18,
          windowBefore: 2, // Earliest Day = 16
          windowAfter: 0,
          assignedFormIds: [],
        },
      ];

      const result = evaluateVisitWindowConflicts(visits);
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts[0].latestDayA).toBe(17);
      expect(result.conflicts[0].earliestDayB).toBe(16);
      expect(result.conflicts[0].overlapDays).toBe(2);
    });

    it("returns no conflicts when windows do not touch or overlap", () => {
      const visits: StudyVisit[] = [
        {
          id: "v1",
          oid: "SE.VISIT1",
          name: "Visit 1",
          visitType: "Scheduled",
          targetDay: 0,
          windowBefore: 0,
          windowAfter: 2, // Latest Day = 2
          assignedFormIds: [],
        },
        {
          id: "v2",
          oid: "SE.VISIT2",
          name: "Visit 2",
          visitType: "Scheduled",
          targetDay: 7,
          windowBefore: 2, // Earliest Day = 5
          windowAfter: 2,
          assignedFormIds: [],
        },
      ];

      const result = evaluateVisitWindowConflicts(visits);
      expect(result.hasConflicts).toBe(false);
      expect(result.totalConflicts).toBe(0);
      expect(result.conflicts).toHaveLength(0);
    });

    it("detects exact single-day boundary touch (latestDay === earliestDay)", () => {
      const visits: StudyVisit[] = [
        {
          id: "v1",
          oid: "SE.VISIT1",
          name: "Visit 1",
          visitType: "Scheduled",
          targetDay: 0,
          windowBefore: 0,
          windowAfter: 3, // Latest Day = 3
          assignedFormIds: [],
        },
        {
          id: "v2",
          oid: "SE.VISIT2",
          name: "Visit 2",
          visitType: "Scheduled",
          targetDay: 6,
          windowBefore: 3, // Earliest Day = 3
          windowAfter: 3,
          assignedFormIds: [],
        },
      ];

      const result = evaluateVisitWindowConflicts(visits);
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts[0].overlapDays).toBe(1);
    });

    it("flags error severity for out-of-order target days", () => {
      const visits: StudyVisit[] = [
        {
          id: "v1",
          oid: "SE.VISIT1",
          name: "Visit 1",
          visitType: "Scheduled",
          targetDay: 14,
          windowBefore: 0,
          windowAfter: 2,
          assignedFormIds: [],
        },
        {
          id: "v2",
          oid: "SE.VISIT2",
          name: "Visit 2",
          visitType: "Scheduled",
          targetDay: 7,
          windowBefore: 1,
          windowAfter: 1,
          assignedFormIds: [],
        },
      ];

      const result = evaluateVisitWindowConflicts(visits);
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts[0].severity).toBe("error");
      expect(result.conflicts[0].message).toContain("Out-of-order target days");
    });

    it("filters window conflicts by armId when specified", () => {
      const visits: StudyVisit[] = [
        {
          id: "v1",
          oid: "SE.VISIT1",
          name: "Arm A Visit 1",
          visitType: "Scheduled",
          targetDay: 0,
          windowBefore: 0,
          windowAfter: 5,
          assignedFormIds: [],
          armIds: ["arm_a"],
        },
        {
          id: "v2",
          oid: "SE.VISIT2",
          name: "Arm A Visit 2",
          visitType: "Scheduled",
          targetDay: 7,
          windowBefore: 3,
          windowAfter: 3,
          assignedFormIds: [],
          armIds: ["arm_a"],
        },
        {
          id: "v3",
          oid: "SE.VISIT3",
          name: "Arm B Visit 1",
          visitType: "Scheduled",
          targetDay: 0,
          windowBefore: 0,
          windowAfter: 1,
          assignedFormIds: [],
          armIds: ["arm_b"],
        },
        {
          id: "v4",
          oid: "SE.VISIT4",
          name: "Arm B Visit 2",
          visitType: "Scheduled",
          targetDay: 28,
          windowBefore: 3,
          windowAfter: 3,
          assignedFormIds: [],
          armIds: ["arm_b"],
        },
      ];

      const armAConflicts = evaluateVisitWindowConflicts(visits, "arm_a");
      expect(armAConflicts.hasConflicts).toBe(true);

      const armBConflicts = evaluateVisitWindowConflicts(visits, "arm_b");
      expect(armBConflicts.hasConflicts).toBe(false);
    });
  });

  describe("calculateScheduleBounds & calculateBaselineDrift", () => {
    const visits: StudyVisit[] = [
      {
        id: "v1",
        oid: "SE.SCREENING",
        name: "Screening",
        visitType: "Scheduled",
        targetDay: 0,
        windowBefore: 7,
        windowAfter: 0,
        assignedFormIds: [],
      },
      {
        id: "v2",
        oid: "SE.C1D1",
        name: "Cycle 1 Day 1",
        visitType: "Scheduled",
        targetDay: 14,
        windowBefore: 2,
        windowAfter: 2,
        assignedFormIds: [],
      },
      {
        id: "v3",
        oid: "SE.C2D1",
        name: "Cycle 2 Day 1",
        visitType: "Scheduled",
        targetDay: 42,
        windowBefore: 3,
        windowAfter: 5,
        assignedFormIds: [],
      },
    ];

    it("calculates schedule bounds correctly", () => {
      const bounds = calculateScheduleBounds(visits);
      expect(bounds.targetDurationDays).toBe(42); // 42 - 0
      expect(bounds.maxExpansionDays).toBe(54); // (42 + 5) - (0 - 7) = 47 - (-7) = 54
      expect(bounds.maxContractionDays).toBe(39); // (42 - 3) - (0 + 0) = 39 - 0 = 39
      expect(bounds.expansionBufferDays).toBe(7); // 0 + 2 + 5
      expect(bounds.contractionBufferDays).toBe(12); // 7 + 2 + 3
    });

    it("falls back gracefully when no baseline snapshot exists", () => {
      const drift = calculateBaselineDrift(visits);
      expect(drift.hasBaseline).toBe(false);
      expect(drift.targetDurationDriftDays).toBe(0);
      expect(drift.maxExpansionDriftDays).toBe(0);
      expect(drift.maxContractionDriftDays).toBe(0);
      expect(drift.visitDrifts).toHaveLength(0);
    });

    it("calculates baseline drift when baseline snapshot is provided", () => {
      const baselineVisits: StudyVisit[] = [
        {
          id: "v1",
          oid: "SE.SCREENING",
          name: "Screening",
          visitType: "Scheduled",
          targetDay: 0,
          windowBefore: 7,
          windowAfter: 0,
          assignedFormIds: [],
        },
        {
          id: "v2",
          oid: "SE.C1D1",
          name: "Cycle 1 Day 1",
          visitType: "Scheduled",
          targetDay: 14,
          windowBefore: 2,
          windowAfter: 2,
          assignedFormIds: [],
        },
        {
          id: "v3",
          oid: "SE.C2D1",
          name: "Cycle 2 Day 1",
          visitType: "Scheduled",
          targetDay: 28, // Original baseline target was Day 28
          windowBefore: 3,
          windowAfter: 3,
          assignedFormIds: [],
        },
      ];

      const drift = calculateBaselineDrift(
        visits,
        baselineVisits,
        "v1.0 Baseline"
      );
      expect(drift.hasBaseline).toBe(true);
      expect(drift.baselineLabel).toBe("v1.0 Baseline");
      expect(drift.targetDurationDriftDays).toBe(14); // 42 - 28 = +14 days
      expect(drift.visitDrifts).toHaveLength(3);
      expect(drift.visitDrifts[2].targetDayDelta).toBe(14);
    });
  });

  describe("calculateMilestoneForecasts & addDaysToIsoDate", () => {
    it("adds days to ISO dates deterministically in UTC", () => {
      expect(addDaysToIsoDate("2026-10-01", 10)).toBe("2026-10-11");
      expect(addDaysToIsoDate("2026-10-01", -5)).toBe("2026-09-26");
    });

    it("computes deterministic subject milestone forecasts", () => {
      const visits: StudyVisit[] = [
        {
          id: "v1",
          oid: "SE.VISIT1",
          name: "Visit 1",
          visitType: "Scheduled",
          targetDay: 0,
          windowBefore: 0,
          windowAfter: 0,
          assignedFormIds: [],
        },
        {
          id: "v2",
          oid: "SE.VISIT2",
          name: "Visit 2",
          visitType: "Scheduled",
          targetDay: 28,
          windowBefore: 3,
          windowAfter: 3,
          assignedFormIds: [],
        },
      ];

      const forecast = calculateMilestoneForecasts(visits, {
        startDate: "2026-10-01",
        cohortSize: 100,
        enrollmentDurationDays: 60,
        expectedAttritionRate: 15,
      });

      expect(forecast.fsiDate).toBe("2026-10-01");
      expect(forecast.lsiDate).toBe("2026-11-30"); // 2026-10-01 + 60 days
      expect(forecast.fslvDate).toBe("2026-10-29"); // FSI + 28 days
      expect(forecast.lslvDate).toBe("2026-12-28"); // LSI + 28 days
      expect(forecast.earliestStudyCompletionDate).toBe("2026-12-25"); // LSI + (28-3) = LSI + 25
      expect(forecast.latestStudyCompletionDate).toBe("2026-12-31"); // LSI + (28+3) = LSI + 31
      expect(forecast.projectedCompletingSubjects).toBe(85); // 100 * (1 - 0.15)
      expect(forecast.visitProjections).toHaveLength(2);
    });
  });

  describe("Performance SLA", () => {
    it("executes conflict detection, bounds, and forecasting in under 5ms for 100 visits", () => {
      // Generate 100 study visits
      const visits: StudyVisit[] = Array.from({ length: 100 }, (_, i) => ({
        id: `v_${i}`,
        oid: `SE.VISIT_${i}`,
        name: `Visit ${i + 1}`,
        visitType: "Scheduled",
        targetDay: i * 14,
        windowBefore: 3,
        windowAfter: 3,
        assignedFormIds: [],
      }));

      const start = performance.now();
      const conflicts = evaluateVisitWindowConflicts(visits);
      const bounds = calculateScheduleBounds(visits);
      const forecast = calculateMilestoneForecasts(visits, {
        startDate: "2026-10-01",
      });
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(5); // Must complete in under 5ms
      expect(conflicts).toBeDefined();
      expect(bounds).toBeDefined();
      expect(forecast).toBeDefined();
    });
  });
});
