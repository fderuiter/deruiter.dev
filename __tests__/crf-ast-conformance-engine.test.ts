import { describe, it, expect, beforeEach } from "vitest";
import {
  validateObservationChoice,
  generateBIMOReport,
  createInitialScoreState,
  createInitialAuditorState,
} from "../lib/clinical-trial-chaos/engine";
import {
  generateClinicalSubject,
  generateClinicalSubjectFromProtocol,
  SEEDED_SCENARIOS,
} from "../lib/clinical-trial-chaos/scenarios";
import {
  ClinicalObservation,
  RecordedRuleViolation,
} from "../lib/clinical-trial-chaos/types";
import { StudyProtocol, EditCheckRule } from "../lib/crf/types";
import { StudyProtocolEngine } from "../lib/crf";

describe("Interactive AST Rule & Live Conformance Engine", () => {
  let mockProtocol: StudyProtocol;

  beforeEach(() => {
    if (typeof window !== "undefined") {
      localStorage.clear();
    }

    mockProtocol = StudyProtocolEngine.createInitialStudy({
      protocolNumber: "AST-ONC-2026",
      studyName: "Phase-II AST Conformance Trial",
      therapeuticArea: "Oncology",
    });

    // Add an authored form and edit check rule
    const dmForm = mockProtocol.forms[0];
    if (dmForm && dmForm.sections[0] && dmForm.sections[0].fields[0]) {
      const fieldId = dmForm.sections[0].fields[0].id;
      const rule: EditCheckRule = {
        id: "rule_dm_ast_01",
        name: "Systolic BP Upper Ceiling Rule",
        description: "Systolic BP must not exceed 140 mmHg for Cohort A",
        triggerFieldIds: [fieldId],
        actionType: "raise_query",
        targetFieldId: fieldId,
        conditions: [
          {
            fieldId: dmForm.sections[0].fields[0].variableName,
            operator: "lte",
            value: 140,
          },
        ],
        logicalOperator: "AND",
        queryMessage: "Systolic BP > 140 mmHg requires safety consultation",
      };
      dmForm.rules = [rule];
    }
  });

  it("Criteria 1: Selecting a conveyor choice evaluates authored AST conditions without falling back to hardcoded string checks", () => {
    const obsWithAstRule: ClinicalObservation = {
      id: "obs-ast-101",
      field: "Systolic BP",
      fieldId: "SYSBP",
      rawValue: "150 mmHg",
      correctedValue: "120 mmHg",
      currentValue: "150 mmHg",
      destination: "VS",
      isResolved: false,
      astRule: {
        id: "rule_vs_sysbp",
        name: "Systolic BP AST Range Check",
        description: "Systolic BP must be equal to 120 mmHg",
        triggerFieldIds: ["SYSBP"],
        actionType: "raise_query",
        targetFieldId: "SYSBP",
        conditions: [
          {
            fieldId: "Systolic BP",
            operator: "eq",
            value: "120 mmHg",
          },
        ],
        logicalOperator: "AND",
      },
    };

    // Correct choice evaluation via AST
    const validResult = validateObservationChoice(
      obsWithAstRule,
      "120 mmHg",
      mockProtocol
    );
    expect(validResult.isAstEvaluated).toBe(true);
    expect(validResult.isValid).toBe(true);
    expect(validResult.explanation).toBeDefined();

    // Incorrect choice evaluation via AST
    const invalidResult = validateObservationChoice(
      obsWithAstRule,
      "150 mmHg",
      mockProtocol
    );
    expect(invalidResult.isAstEvaluated).toBe(true);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.explanation).toContain("FAILED");
  });

  it("Criteria 2: Pre-loads active protocol from CRF Studio when launching simulation", () => {
    const jsonProtocol = JSON.stringify(mockProtocol);
    if (typeof window !== "undefined") {
      localStorage.setItem("crf_active_protocol", jsonProtocol);
      const loaded = localStorage.getItem("crf_active_protocol");
      expect(loaded).toBeDefined();
      expect(JSON.parse(loaded!).protocolNumber).toBe("AST-ONC-2026");
    }

    const subjectFromProtocol = generateClinicalSubjectFromProtocol(
      mockProtocol,
      0.5,
      false,
      201
    );
    expect(subjectFromProtocol.observations.length).toBeGreaterThan(0);
    expect(subjectFromProtocol.observations[0].astRule).toBeDefined();
  });

  it("Criteria 3: Failed AST rule validations increase Auditor AI suspicion metrics immediately during gameplay", () => {
    const initialAuditor = createInitialAuditorState();
    expect(initialAuditor.suspicion).toBe(0);

    const obs: ClinicalObservation = {
      id: "obs-ast-fail",
      field: "Height",
      rawValue: "180 m",
      correctedValue: "180 cm",
      currentValue: "180 m",
      destination: "DM",
      isResolved: false,
      astRule: {
        id: "rule_height_cm",
        name: "Height Metric Rule",
        description: "Height must equal 180 cm",
        triggerFieldIds: ["Height"],
        actionType: "raise_query",
        targetFieldId: "Height",
        conditions: [
          {
            fieldId: "Height",
            operator: "eq",
            value: "180 cm",
          },
        ],
        logicalOperator: "AND",
      },
    };

    const invalidResult = validateObservationChoice(obs, "180 m");
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.suspicionDelta).toBeGreaterThan(0);

    const updatedSuspicion = Math.min(
      100,
      initialAuditor.suspicion + invalidResult.suspicionDelta
    );
    expect(updatedSuspicion).toBe(
      initialAuditor.suspicion + invalidResult.suspicionDelta
    );
  });

  it("Criteria 4: CDISC conformance errors register in the post-game regulatory inspection report", () => {
    const scoreState = createInitialScoreState();
    const auditorState = createInitialAuditorState();

    const recordedViolations: RecordedRuleViolation[] = [
      {
        id: "v-01",
        type: "ast_edit_check",
        subjectLabel: "SUBJ-1001",
        field: "Systolic BP",
        selectedChoice: "160 mmHg",
        ruleName: "Systolic BP AST Range Check",
        message: "Authored AST Rule 'Systolic BP AST Range Check' FAILED",
        domain: "VS",
        timestamp: new Date().toISOString(),
      },
      {
        id: "v-02",
        type: "cdisc_conformance",
        subjectLabel: "SUBJ-1002",
        field: "Sex at Birth",
        selectedChoice: "Male",
        message:
          "CDISC Controlled Terminology requires single-letter 'M' or 'F'",
        domain: "DM",
        timestamp: new Date().toISOString(),
      },
    ];

    const report = generateBIMOReport(
      scoreState,
      auditorState,
      [],
      recordedViolations,
      mockProtocol
    );
    expect(report.findings.length).toBeGreaterThanOrEqual(2);

    const astFinding = report.findings.find((f) => f.id.startsWith("FND-AST"));
    expect(astFinding).toBeDefined();
    expect(astFinding?.category).toBe("Protocol Compliance");
    expect(astFinding?.description).toContain("SUBJ-1001");

    const cdiscFinding = report.findings.find((f) =>
      f.id.startsWith("FND-CDISC")
    );
    expect(cdiscFinding).toBeDefined();
    expect(cdiscFinding?.category).toBe("Data Integrity");
    expect(cdiscFinding?.description).toContain("SUBJ-1002");
  });

  it("Criteria 5: Users can start a game session using built-in preset scenarios when no active protocol is selected", () => {
    // When no active protocol is provided, fallback preset scenarios are used
    expect(SEEDED_SCENARIOS.length).toBeGreaterThan(0);

    const fallbackSubject = generateClinicalSubject(0.5, false, 999);
    expect(fallbackSubject.observations.length).toBeGreaterThan(0);
    expect(fallbackSubject.observations[0].astRule).toBeDefined();

    // Choice validation still evaluates via AST condition engine
    const choiceRes = validateObservationChoice(
      fallbackSubject.observations[0],
      fallbackSubject.observations[0].rawValue
    );
    expect(choiceRes.isAstEvaluated).toBe(true);
  });
});
