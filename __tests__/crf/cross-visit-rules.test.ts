// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  calculateBMI,
  calculateMostellerBSA,
  calculateDuboisBSA,
  calculateCockcroftGaultCrCl,
  calculateBazettQTc,
  calculateFridericiaQTc,
  calculateRecistSldChange,
  evaluateCondition,
  evaluateRule,
} from "@/lib/crf/ast-evaluator";
import { evaluateMatrixFormObligations } from "@/lib/crf/cross-visit-rules";
import { CRFField, EditCheckRule, StudyVisit } from "@/lib/crf/types";

describe("AST Clinical Calculations & Cross-Visit Logic Engine", () => {
  it("should accurately compute BMI", () => {
    // 70kg, 175cm -> 70 / (1.75^2) = 22.857 -> 22.9
    expect(calculateBMI(70, 175)).toBe(22.9);
    expect(calculateBMI(0, 175)).toBe(0);
  });

  it("should accurately compute Mosteller BSA", () => {
    // 178cm, 75kg -> sqrt(178*75/3600) = sqrt(3.7083) = 1.9257 -> 1.93
    expect(calculateMostellerBSA(178, 75)).toBe(1.93);
  });

  it("should accurately compute DuBois BSA", () => {
    // 0.007184 * (178^0.725) * (75^0.425) -> ~1.92
    const bsa = calculateDuboisBSA(178, 75);
    expect(bsa).toBeGreaterThan(1.85);
    expect(bsa).toBeLessThan(1.98);
  });

  it("should calculate Cockcroft-Gault Creatinine Clearance with female adjustment", () => {
    // Age 50, Weight 70kg, Cr 1.0 mg/dL
    // Male: ((140-50)*70)/(72*1.0) = 6300/72 = 87.5
    expect(calculateCockcroftGaultCrCl(50, 70, 1.0, false)).toBe(87.5);
    // Female: 87.5 * 0.85 = 74.375 -> 74.4
    expect(calculateCockcroftGaultCrCl(50, 70, 1.0, true)).toBe(74.4);
  });

  it("should compute Bazett and Fridericia QTc correctly", () => {
    // QT = 400ms, RR = 1.0s (HR 60bpm) -> QTc = 400ms
    expect(calculateBazettQTc(400, 1.0)).toBe(400);
    expect(calculateFridericiaQTc(400, 1.0)).toBe(400);

    // QT = 420ms, RR = 0.81s (HR ~74bpm) -> sqrt(0.81) = 0.9 -> 420/0.9 = 467ms
    expect(calculateBazettQTc(420, 0.81)).toBe(467);
  });

  it("should compute RECIST 1.1 SLD percentage change", () => {
    // Baseline 50mm, Current 40mm -> -20.0%
    expect(calculateRecistSldChange(50, 40)).toBe(-20.0);
    // Baseline 50mm, Current 60mm -> +20.0%
    expect(calculateRecistSldChange(50, 60)).toBe(20.0);
  });

  it("should evaluate cross-visit conditions correctly", () => {
    const fieldsList: CRFField[] = [
      {
        id: "f_weight",
        variableName: "WEIGHT",
        label: "Weight",
        dataType: "number",
        columnSpan: 6,
        required: true,
      },
    ];

    const values = {
      v_screen_f_weight: 80,
      v_w4_f_weight: 70,
      f_weight: 70,
    };

    // Check baseline weight condition
    const cond = {
      fieldId: "f_weight",
      crossVisitId: "v_screen",
      operator: "gt" as const,
      value: 75,
    };

    const isTrue = evaluateCondition(cond, values, fieldsList);
    expect(isTrue).toBe(true);

    const isFalse = evaluateCondition(
      {
        fieldId: "f_weight",
        crossVisitId: "v_screen",
        operator: "lt" as const,
        value: 75,
      },
      values,
      fieldsList
    );
    expect(isFalse).toBe(false);
  });

  it("should evaluate full edit check rules with logical operators", () => {
    const fieldsList: CRFField[] = [
      {
        id: "f_age",
        variableName: "AGE",
        label: "Age",
        dataType: "integer",
        columnSpan: 6,
        required: true,
      },
      {
        id: "f_ic",
        variableName: "ICYN",
        label: "Informed Consent",
        dataType: "radio",
        columnSpan: 6,
        required: true,
      },
    ];

    const rule: EditCheckRule = {
      id: "rule_eligibility",
      name: "Adult Consent Rule",
      description: "Must be >= 18 and Consent = Y",
      triggerFieldIds: ["f_age", "f_ic"],
      targetFieldId: "f_ic",
      actionType: "raise_query",
      conditions: [
        { fieldId: "f_age", operator: "gte", value: 18 },
        { fieldId: "f_ic", operator: "eq", value: "Y" },
      ],
      logicalOperator: "AND",
    };

    expect(evaluateRule(rule, { f_age: 25, f_ic: "Y" }, fieldsList)).toBe(true);
    expect(evaluateRule(rule, { f_age: 16, f_ic: "Y" }, fieldsList)).toBe(
      false
    );
    expect(evaluateRule(rule, { f_age: 25, f_ic: "N" }, fieldsList)).toBe(
      false
    );
  });

  it("evaluates matrix-level conditional form obligations across study visits", () => {
    const studyVisits: StudyVisit[] = [
      {
        id: "v_screen",
        oid: "SE.SCREEN",
        name: "Screening",
        visitType: "Scheduled",
        targetDay: 0,
        windowBefore: 0,
        windowAfter: 0,
        assignedFormIds: ["f_dm", "f_vs"],
      },
      {
        id: "v_w1",
        oid: "SE.W1",
        name: "Week 1",
        visitType: "Scheduled",
        targetDay: 7,
        windowBefore: 1,
        windowAfter: 1,
        assignedFormIds: ["f_vs"],
      },
      {
        id: "v_w4",
        oid: "SE.W4",
        name: "Week 4",
        visitType: "Scheduled",
        targetDay: 28,
        windowBefore: 3,
        windowAfter: 3,
        assignedFormIds: ["f_vs", "f_ae"],
      },
    ];

    const conditionalRules = [
      {
        formId: "f_pk",
        condition: { fieldId: "ARM", operator: "eq" as const, value: "Active" },
        targetVisitIds: ["v_w1", "v_w4"],
      },
    ];

    // When subject is on Active ARM, PK form is added to Week 1 and Week 4
    const resolvedActive = evaluateMatrixFormObligations(
      studyVisits,
      conditionalRules,
      { ARM: "Active" }
    );
    expect(
      resolvedActive.find((v) => v.id === "v_w1")?.assignedFormIds
    ).toContain("f_pk");
    expect(
      resolvedActive.find((v) => v.id === "v_screen")?.assignedFormIds
    ).not.toContain("f_pk");

    // When subject is on Placebo, PK form is not added
    const resolvedPlacebo = evaluateMatrixFormObligations(
      studyVisits,
      conditionalRules,
      { ARM: "Placebo" }
    );
    expect(
      resolvedPlacebo.find((v) => v.id === "v_w1")?.assignedFormIds
    ).not.toContain("f_pk");
  });
});
