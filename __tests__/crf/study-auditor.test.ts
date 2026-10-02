// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  StudyAuditor,
  AuditDiagnostic,
  StudyAuditReport,
} from "@/lib/crf/study-auditor";
import { StudyProtocol, CRFForm, CRFField } from "@/lib/crf/types";
import { getOncologyPresetSync, getStudyPresetsSync } from "@/lib/crf/presets";

describe("StudyAuditor Domain Engine (TDD Red-Green-Refactor)", () => {
  const oncologyStudy: StudyProtocol = getOncologyPresetSync();

  describe("Study-Level Audit (StudyAuditor.audit)", () => {
    it("audits a valid clinical study preset and returns a compliant StudyAuditReport", () => {
      const report: StudyAuditReport = StudyAuditor.audit(oncologyStudy);

      expect(report).toBeDefined();
      expect(typeof report.score).toBe("number");
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
      expect(report.health).toBeDefined();
      expect(Array.isArray(report.diagnostics)).toBe(true);
      expect(report.summary).toBeDefined();
      expect(typeof report.summary.errors).toBe("number");
      expect(typeof report.summary.warnings).toBe("number");
      expect(typeof report.autoFix).toBe("function");
      expect(typeof report.autoFixAll).toBe("function");
    });

    it("detects CDASH variable name length violations (>8 chars) with autoFix available", () => {
      const invalidStudy: StudyProtocol = {
        ...oncologyStudy,
        id: "test_overlength_var",
        forms: [
          {
            id: "f_dm",
            name: "Demographics",
            domain: "DM",
            description: "Demographics",
            version: "1.0",
            sections: [
              {
                id: "sec_1",
                title: "Demographics Section",
                fields: [
                  {
                    id: "fld_long_var",
                    variableName: "LONGVARIABLENAME",
                    label: "Overlength Field",
                    dataType: "text",
                    required: true,
                    columnSpan: 6,
                  },
                ],
              },
            ],
            rules: [],
          },
        ],
        visits: [
          {
            id: "v_1",
            oid: "SE.SCR",
            name: "Screening",
            visitType: "Scheduled",
            targetDay: 1,
            windowBefore: 0,
            windowAfter: 0,
            assignedFormIds: ["f_dm"],
          },
        ],
      };

      const report = StudyAuditor.audit(invalidStudy);
      const lenViolation = report.diagnostics.find(
        (d: AuditDiagnostic) => d.ruleId === "SD0001" || d.tier === "cdash"
      );

      expect(lenViolation).toBeDefined();
      expect(lenViolation?.severity).toBe("error");
      expect(lenViolation?.autoFixAvailable).toBe(true);
      expect(lenViolation?.suggestedFix).toBeDefined();
    });

    it("detects orphaned forms unassigned in the Schedule of Activities (SoA)", () => {
      const unassignedStudy: StudyProtocol = {
        ...oncologyStudy,
        id: "test_soa_orphan",
        forms: [
          ...oncologyStudy.forms,
          {
            id: "f_orphan",
            name: "Orphaned Unscheduled Assessment",
            domain: "LB",
            description: "Never added to visits",
            version: "1.0",
            isLogForm: false,
            sections: [],
            rules: [],
          },
        ],
      };

      const report = StudyAuditor.audit(unassignedStudy);
      const orphanDiag = report.diagnostics.find(
        (d: AuditDiagnostic) =>
          d.ruleId === "SD0005" || (d.tier === "soa" && d.formId === "f_orphan")
      );

      expect(orphanDiag).toBeDefined();
      expect(orphanDiag?.severity).toBe("warning");
      expect(orphanDiag?.autoFixAvailable).toBe(true);
    });

    it("detects broken edit check rule trigger field references", () => {
      const brokenRuleStudy: StudyProtocol = {
        ...oncologyStudy,
        id: "test_broken_rule",
        forms: [
          {
            id: "f_vs",
            name: "Vital Signs",
            domain: "VS",
            description: "Vitals",
            version: "1.0",
            sections: [
              {
                id: "sec_vs",
                title: "Vitals Section",
                fields: [
                  {
                    id: "f_sys",
                    variableName: "SYSBP",
                    label: "Systolic BP",
                    dataType: "number",
                    required: true,
                    columnSpan: 6,
                  },
                ],
              },
            ],
            rules: [
              {
                id: "r_broken",
                name: "Broken Rule",
                description: "References missing field",
                triggerFieldIds: ["non_existent_field_id"],
                actionType: "show_field",
                targetFieldId: "f_sys",
                conditions: [],
                logicalOperator: "AND",
              },
            ],
          },
        ],
        visits: [
          {
            id: "v_vs",
            oid: "SE.V1",
            name: "Visit 1",
            visitType: "Scheduled",
            targetDay: 1,
            windowBefore: 0,
            windowAfter: 0,
            assignedFormIds: ["f_vs"],
          },
        ],
      };

      const report = StudyAuditor.audit(brokenRuleStudy);
      const ruleDiag = report.diagnostics.find(
        (d: AuditDiagnostic) =>
          d.tier === "ast" && d.message.includes("non-existent trigger field")
      );

      expect(ruleDiag).toBeDefined();
      expect(ruleDiag?.severity).toBe("error");
    });
  });

  describe("Form-Level Audit (StudyAuditor.auditForm)", () => {
    it("computes accurate health, SDV readiness, and CDASH conformance for individual forms", () => {
      const dmForm =
        oncologyStudy.forms.find((f: CRFForm) => f.domain === "DM") ||
        oncologyStudy.forms[0];
      const formReport = StudyAuditor.auditForm(dmForm, oncologyStudy);

      expect(formReport).toBeDefined();
      expect(formReport.formId).toBe(dmForm.id);
      expect(formReport.health.totalFields).toBeGreaterThan(0);
      expect(
        formReport.health.cdashConformancePercentage
      ).toBeGreaterThanOrEqual(0);
      expect(formReport.health.cdashConformancePercentage).toBeLessThanOrEqual(
        100
      );
      expect(Array.isArray(formReport.diagnostics)).toBe(true);
    });
  });

  describe("Formula-Level Audit (StudyAuditor.auditFormula)", () => {
    it("validates valid arithmetic expressions with variable references", () => {
      const fields: CRFField[] = [
        {
          id: "weight",
          variableName: "WEIGHT",
          label: "Weight",
          dataType: "number",
          required: true,
          columnSpan: 6,
        },
        {
          id: "height",
          variableName: "HEIGHT",
          label: "Height",
          dataType: "number",
          required: true,
          columnSpan: 6,
        },
      ];

      const res = StudyAuditor.auditFormula(
        "weight / ((height / 100) ^ 2)",
        fields
      );
      expect(res.isValid).toBe(true);
      expect(res.referencedVariables.length).toBe(2);
    });

    it("detects syntax errors, unbalanced parentheses, and division by zero", () => {
      const fields: CRFField[] = [
        {
          id: "f1",
          variableName: "V1",
          label: "V1",
          dataType: "number",
          required: true,
          columnSpan: 6,
        },
      ];

      const unbalanced = StudyAuditor.auditFormula("(f1 + 10", fields);
      expect(unbalanced.isValid).toBe(false);
      expect(
        unbalanced.diagnostics.some((d) => d.code === "UNMATCHED_LPAREN")
      ).toBe(true);

      const divZero = StudyAuditor.auditFormula("f1 / 0", fields);
      expect(
        divZero.diagnostics.some((d) => d.code === "DIVISION_BY_ZERO")
      ).toBe(true);
    });
  });

  describe("1-Click AutoFix Engine", () => {
    it("auto-fixes overlength variables and unassigned SoA forms in a single batch pass", () => {
      const dirtyStudy: StudyProtocol = {
        ...oncologyStudy,
        id: "dirty_study_autofix",
        forms: [
          {
            id: "f_dirty",
            name: "Dirty Form",
            domain: "VS",
            description: "Dirty Form",
            version: "1.0",
            sections: [
              {
                id: "sec_dirty",
                title: "Dirty Section",
                fields: [
                  {
                    id: "f_long",
                    variableName: "LONGVARNAMEEXCEEDING8",
                    label: "Long Name",
                    dataType: "text",
                    required: true,
                    columnSpan: 6,
                  },
                ],
              },
            ],
            rules: [],
          },
        ],
        visits: [
          {
            id: "v_1",
            oid: "SE.V1",
            name: "Visit 1",
            visitType: "Scheduled",
            targetDay: 1,
            windowBefore: 0,
            windowAfter: 0,
            assignedFormIds: [], // Empty -> causes SD0005
          },
        ],
      };

      const initialReport = StudyAuditor.audit(dirtyStudy);
      expect(
        initialReport.summary.errors + initialReport.summary.warnings
      ).toBeGreaterThan(0);

      const { protocol: fixedStudy, fixedCount } = initialReport.autoFixAll();
      expect(fixedCount).toBeGreaterThan(0);

      const cleanedReport = StudyAuditor.audit(fixedStudy);
      expect(cleanedReport.summary.errors).toBe(0);
      // Truncated variable name should now be <= 8 chars
      const fixedField = fixedStudy.forms[0].sections[0].fields[0];
      expect(fixedField.variableName.length).toBeLessThanOrEqual(8);
      // Form should now be assigned to visit
      expect(fixedStudy.visits[0].assignedFormIds).toContain("f_dirty");
    });
  });

  describe("Preset Health Verification", () => {
    it("audits all registered study presets without unhandled exceptions", () => {
      const presets = getStudyPresetsSync();
      expect(presets.length).toBeGreaterThan(0);

      presets.forEach((preset) => {
        const protocol = preset.study;
        const report = StudyAuditor.audit(protocol);
        expect(report.health.totalFields).toBeGreaterThanOrEqual(0);
        expect(typeof report.score).toBe("number");
      });
    });
  });
});
