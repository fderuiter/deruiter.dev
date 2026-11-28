// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  StudyProtocolEngine,
  validateStudyCompliance,
  autoFixViolation,
  autoFixAllViolations,
  StudyAuditor,
  evaluateStudyConformance,
  isValidIso8601DateDefault,
} from "@/lib/crf";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import type { CRFForm, StudyProtocol } from "@/lib/crf/types";

describe("Declarative Conformance Rule Packs & Pure Remediations", () => {
  it("projects identical errors, warnings, formula diagnostics, and compliance status across validateProtocol, validateStudyCompliance, and StudyAuditor.audit", () => {
    const studyWithMixedFindings: StudyProtocol = {
      id: "study_parity_001",
      protocolNumber: "PARITY-2026-01",
      studyName: "Cross-Validator Parity Protocol",
      phase: "Phase II",
      sponsor: "Parity Bio",
      therapeuticArea: "Oncology",
      version: "1.0",
      lastModified: "2026-08-15T00:00:00.000Z",
      codelists: [],
      visits: [
        {
          id: "v_scr",
          oid: "SE.SCR",
          name: "Screening",
          visitType: "Scheduled",
          targetDay: 0,
          windowBefore: 0,
          windowAfter: 0,
          assignedFormIds: ["form_dm_parity", "form_ghost_ref"],
        },
      ],
      forms: [
        {
          id: "form_dm_parity",
          name: "Demographics",
          domain: "DM",
          description: "Incomplete DM with formula and date errors",
          version: "1.0",
          sections: [
            {
              id: "sec_1",
              title: "General",
              fields: [
                {
                  id: "f_overlen",
                  variableName: "SUBJECT_AGE_YEARS",
                  label: "Age",
                  dataType: "number",
                  columnSpan: 6,
                  required: true,
                },
                {
                  id: "f_bad_dt",
                  variableName: "ICDAT",
                  label: "Consent Date",
                  dataType: "datetime",
                  defaultValue: "08/15/2026 2:30 PM",
                  columnSpan: 6,
                  required: true,
                },
                {
                  id: "f_choice_no_cl",
                  variableName: "FASTING",
                  label: "Fasting Status",
                  dataType: "radio",
                  columnSpan: 6,
                  required: false,
                },
                {
                  id: "f_bad_calc",
                  variableName: "CALCBAD",
                  label: "Broken Formula",
                  dataType: "calculated",
                  calculationFormula: "(SUBJECT_AGE_YEARS / 0",
                  columnSpan: 6,
                  required: false,
                },
              ],
            },
          ],
          rules: [
            {
              id: "rule_broken_cond",
              name: "Broken Condition Rule",
              description: "References missing condition field",
              triggerFieldIds: ["f_overlen"],
              targetFieldId: "f_overlen",
              actionType: "raise_query",
              logicalOperator: "AND",
              conditions: [
                {
                  fieldId: "non_existent_cond_field",
                  operator: "gt",
                  value: 18,
                },
              ],
            },
          ],
        },
        {
          id: "form_orphan_custom",
          name: "Unassigned Biomarker Panel",
          domain: "BM_CUSTOM",
          description: "Orphaned custom form",
          version: "1.0",
          sections: [
            {
              id: "sec_bm",
              title: "Biomarker",
              fields: [
                {
                  id: "f_bm",
                  variableName: "BMVAL",
                  label: "Biomarker Value",
                  dataType: "number",
                  columnSpan: 6,
                  required: false,
                },
              ],
            },
          ],
          rules: [],
        },
      ],
    };

    const engineResult = StudyProtocolEngine.validateProtocol(
      studyWithMixedFindings
    );
    const complianceViolations = validateStudyCompliance(
      studyWithMixedFindings
    );
    const auditReport = StudyAuditor.audit(studyWithMixedFindings);
    const canonicalEval = evaluateStudyConformance(studyWithMixedFindings);

    const complianceErrors = complianceViolations.filter(
      (v) => v.severity === "error"
    );
    const complianceWarnings = complianceViolations.filter(
      (v) => v.severity === "warning"
    );

    expect(engineResult.isCompliant).toBe(false);
    expect(auditReport.isCompliant).toBe(false);
    expect(engineResult.isCompliant).toBe(auditReport.isCompliant);

    // Identical error and warning counts across all 3 surfaces
    expect(engineResult.errors.length).toBe(complianceErrors.length);
    expect(engineResult.errors.length).toBe(auditReport.summary.errors);
    expect(engineResult.warnings.length).toBe(complianceWarnings.length);
    expect(engineResult.warnings.length).toBe(auditReport.summary.warnings);
    expect(auditReport.score).toBe(canonicalEval.score);
    expect(auditReport.health).toEqual(canonicalEval.health);

    // Formula syntax error (UNMATCHED_LPAREN) + division by zero warning surfaced in all 3
    expect(
      complianceViolations.some((v) => v.ruleId.startsWith("FORMULA-"))
    ).toBe(true);
    expect(
      auditReport.diagnostics.some((d) => d.ruleId?.startsWith("FORMULA-"))
    ).toBe(true);
    expect(
      engineResult.issues.some(
        (i) => i.rule === "AST-LINT" && i.field === "CALCBAD"
      )
    ).toBe(true);
  });

  it("standardizes SD0002 (R and HR) and SD0004 as error and accepts full ISO 8601 datetime defaults", () => {
    expect(isValidIso8601DateDefault("2026-05-01")).toBe(true);
    expect(isValidIso8601DateDefault("2026-05")).toBe(true);
    expect(isValidIso8601DateDefault("2026-05-UNK")).toBe(true);
    expect(isValidIso8601DateDefault("2026-05-01T14:30:00Z")).toBe(true);
    expect(isValidIso8601DateDefault("2026-05-01T14:30:00+02:00")).toBe(true);
    expect(isValidIso8601DateDefault("2026-05-01T14:30:00.250-04:00")).toBe(
      true
    );
    expect(isValidIso8601DateDefault("UNK")).toBe(true);
    expect(isValidIso8601DateDefault("2026/05/01")).toBe(false);
    expect(isValidIso8601DateDefault("2026-13-45T99:00:00Z")).toBe(false);

    const study: StudyProtocol = {
      ...ONCOLOGY_RECIST_PRESET,
      forms: [
        {
          id: "form_dm_iso",
          name: "Demographics",
          domain: "DM",
          description: "Test SD0002 HR/R and SD0004",
          version: "1.0",
          rules: [],
          sections: [
            {
              id: "sec_1",
              title: "General",
              fields: [
                {
                  id: "f_valid_dt",
                  variableName: "RFSTDTC",
                  label: "Reference Start Datetime",
                  dataType: "datetime",
                  defaultValue: "2026-05-01T14:30:00+02:00",
                  columnSpan: 6,
                  required: false,
                },
                {
                  id: "f_invalid_dt",
                  variableName: "ICDAT",
                  label: "Consent Date",
                  dataType: "date",
                  defaultValue: "May 1, 2026",
                  columnSpan: 6,
                  required: true,
                },
              ],
            },
          ],
        },
      ],
      visits: [
        {
          id: "v_1",
          oid: "SE.V1",
          name: "Screening",
          visitType: "Scheduled",
          targetDay: 0,
          windowBefore: 0,
          windowAfter: 0,
          assignedFormIds: ["form_dm_iso"],
        },
      ],
    };

    const audit = StudyAuditor.audit(study);
    const compliance = validateStudyCompliance(study);

    // Valid ISO 8601 datetime with offset does NOT trigger SD0004
    expect(
      audit.diagnostics.some(
        (d) => d.ruleId === "SD0004" && d.fieldId === "f_valid_dt"
      )
    ).toBe(false);

    // Invalid date default triggers SD0004 with severity "error" everywhere
    const auditSd0004 = audit.diagnostics.find(
      (d) => d.ruleId === "SD0004" && d.fieldId === "f_invalid_dt"
    );
    const compSd0004 = compliance.find(
      (v) => v.ruleId === "SD0004" && v.fieldId === "f_invalid_dt"
    );
    expect(auditSd0004?.severity).toBe("error");
    expect(compSd0004?.severity).toBe("error");

    // Missing HR variable (AGE) and R variable (SEX) both emit severity "error" under SD0002
    const auditAge = audit.diagnostics.find(
      (d) => d.ruleId === "SD0002" && d.variableName === "AGE"
    );
    const auditSex = audit.diagnostics.find(
      (d) => d.ruleId === "SD0002" && d.variableName === "SEX"
    );
    expect(auditAge?.severity).toBe("error");
    expect(auditSex?.severity).toBe("error");
  });

  it("computes cdashConformancePercentage against active standard domains only and scopes SD0005 out of single-form auditForm", () => {
    const completeDmForm = ONCOLOGY_RECIST_PRESET.forms.find(
      (f) => f.domain === "DM"
    )!;

    // Single-form auditForm without studyContext omits SD0005 and evaluates only DM's core variables
    const singleFormReport = StudyAuditor.auditForm(completeDmForm);
    expect(
      singleFormReport.diagnostics.some((d) => d.ruleId === "SD0005")
    ).toBe(false);
    expect(singleFormReport.health.cdashConformancePercentage).toBe(100);

    // Study containing ONLY a complete DM form achieves 100% active-domain CDASH conformance
    // (unscheduled standard domains like VS, AE, LB do not dilute the denominator)
    const dmOnlyStudy: StudyProtocol = {
      ...ONCOLOGY_RECIST_PRESET,
      forms: [completeDmForm],
      visits: [
        {
          id: "v_only",
          oid: "SE.V1",
          name: "Screening",
          visitType: "Scheduled",
          targetDay: 0,
          windowBefore: 0,
          windowAfter: 0,
          assignedFormIds: [completeDmForm.id],
        },
      ],
    };
    expect(
      StudyAuditor.audit(dmOnlyStudy).health.cdashConformancePercentage
    ).toBe(100);

    // When studyContext IS supplied to auditForm and the form is unassigned, SD0005 IS reported
    const unassignedStudy: StudyProtocol = {
      ...dmOnlyStudy,
      visits: [{ ...dmOnlyStudy.visits[0], assignedFormIds: [] }],
    };
    const contextualFormReport = StudyAuditor.auditForm(
      completeDmForm,
      unassignedStudy
    );
    expect(
      contextualFormReport.diagnostics.some((d) => d.ruleId === "SD0005")
    ).toBe(true);
  });

  it("applies pure, deterministic remediations clearing invalid date defaults to empty string without wall-clock dates or random UUIDs", () => {
    const dirtyForm: CRFForm = {
      id: "form_pure_rem",
      name: "Demographics Remediation",
      domain: "DM",
      description: "Dirty form for pure remediation verification",
      version: "1.0",
      rules: [],
      sections: [
        {
          id: "sec_rem_1",
          title: "General",
          fields: [
            {
              id: "f_bad_date",
              variableName: "ICDAT",
              label: "Informed Consent Date",
              dataType: "date",
              defaultValue: "not-a-valid-iso-date",
              columnSpan: 6,
              required: true,
            },
            {
              id: "f_long_a",
              variableName: "DUPLICATE_PREFIX_ALPHA",
              label: "Long Alpha",
              dataType: "text",
              columnSpan: 6,
              required: false,
            },
            {
              id: "f_long_b",
              variableName: "DUPLICATE_PREFIX_BETA",
              label: "Long Beta",
              dataType: "text",
              columnSpan: 6,
              required: false,
            },
          ],
        },
      ],
    };

    const dirtyStudy: StudyProtocol = {
      id: "study_pure_rem_001",
      protocolNumber: "PURE-REM-001",
      studyName: "Pure Remediation Protocol",
      phase: "Phase I",
      sponsor: "Deterministic Bio",
      therapeuticArea: "Oncology",
      version: "1.0",
      lastModified: "2026-08-15T00:00:00.000Z",
      forms: [dirtyForm],
      visits: [
        {
          id: "v_rem_1",
          oid: "SE.V1",
          name: "Screening",
          visitType: "Scheduled",
          targetDay: 0,
          windowBefore: 0,
          windowAfter: 0,
          assignedFormIds: [],
        },
      ],
      codelists: [],
      auditTrail: [],
    };

    // Verify fix_date_format clears to "" via both StudyAuditor and autoFixViolation
    const dateViolation = validateStudyCompliance(dirtyStudy).find(
      (v) => v.ruleId === "SD0004"
    )!;
    const fixedByLinter = autoFixViolation(dirtyStudy, dateViolation);
    expect(fixedByLinter.forms[0].sections[0].fields[0].defaultValue).toBe("");

    const fixedByAuditor = StudyAuditor.applyAutoFix(
      dirtyStudy,
      dateViolation.id
    );
    expect(fixedByAuditor.forms[0].sections[0].fields[0].defaultValue).toBe("");

    // Verify full batch remediation is byte-for-byte deterministic across runs and avoids duplicate truncated variable collisions
    const runA = StudyAuditor.applyAutoFixAll(dirtyStudy);
    const runB = StudyAuditor.applyAutoFixAll(dirtyStudy);
    expect(JSON.stringify(runA)).toBe(JSON.stringify(runB));

    const linterBatchA = autoFixAllViolations(dirtyStudy);
    const linterBatchB = autoFixAllViolations(dirtyStudy);
    expect(JSON.stringify(linterBatchA)).toBe(JSON.stringify(linterBatchB));

    const postAudit = StudyAuditor.audit(runA.protocol);
    expect(postAudit.summary.errors).toBe(0);
    expect(postAudit.summary.warnings).toBe(0);

    const varsAfterTruncate = runA.protocol.forms[0].sections[0].fields.map(
      (f) => f.variableName
    );
    expect(varsAfterTruncate).toContain("DUPLICAT");
    expect(varsAfterTruncate).toContain("DUPLICA1");
  });
});
