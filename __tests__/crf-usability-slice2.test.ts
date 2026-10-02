// @vitest-environment node
import { describe, it, expect } from "vitest";
import { StudyProtocolEngine } from "@/lib/crf/study-engine";
import {
  explainCalculationDerivation,
  lintForm,
} from "@/lib/crf/ast-evaluator";
import type { StudyProtocol, CRFForm, CRFField } from "@/lib/crf/types";

describe("CRF Usability Foundation - Slice 2 Suite", () => {
  describe("Issue #671: Author & Explain Calculated Field Derivations", () => {
    const fieldsList: CRFField[] = [
      {
        id: "fld_height",
        variableName: "HEIGHT",
        label: "Height",
        dataType: "number",
        columnSpan: 6,
        required: false,
        unit: "cm",
      },
      {
        id: "fld_weight",
        variableName: "WEIGHT",
        label: "Weight",
        dataType: "number",
        columnSpan: 6,
        required: false,
        unit: "kg",
      },
      {
        id: "fld_bmi",
        variableName: "BMI",
        label: "Body Mass Index",
        dataType: "calculated",
        columnSpan: 6,
        required: false,
        calculationFormula: "WEIGHT / ((HEIGHT / 100) * (HEIGHT / 100))",
      },
    ];

    it("explains BMI derivation with declared kg/cm inputs and step-by-step breakdown", () => {
      const fieldValues = {
        HEIGHT: 175,
        WEIGHT: 70,
      };

      const targetField = fieldsList.find((f) => f.variableName === "BMI");
      const explanation = explainCalculationDerivation(
        "WEIGHT / ((HEIGHT / 100) * (HEIGHT / 100))",
        fieldValues,
        fieldsList,
        targetField
      );

      expect(explanation.status).toBe("success");
      expect(explanation.result).toBeCloseTo(22.86, 1);
      expect(explanation.targetVariableName).toBe("BMI");
      expect(explanation.dependencies.length).toBe(2);

      const heightDep = explanation.dependencies.find(
        (d) => d.variableName === "HEIGHT"
      );
      expect(heightDep).toBeDefined();
      expect(heightDep?.expectedUnit).toBe("cm");
      expect(heightDep?.actualUnit).toBe("cm");
      expect(heightDep?.status).toBe("provided");

      const weightDep = explanation.dependencies.find(
        (d) => d.variableName === "WEIGHT"
      );
      expect(weightDep).toBeDefined();
      expect(weightDep?.expectedUnit).toBe("kg");
      expect(weightDep?.actualUnit).toBe("kg");
      expect(weightDep?.status).toBe("provided");

      // Verify clinical derivation steps for BMI
      expect(explanation.steps.length).toBeGreaterThanOrEqual(4);
      expect(explanation.steps[0].description).toContain(
        "Gather and validate input dependencies"
      );
      expect(
        explanation.steps.some((s) =>
          s.description.includes("centimeters to meters")
        )
      ).toBe(true);
      expect(
        explanation.steps.some((s) => s.description.includes("squared height"))
      ).toBe(true);
      expect(
        explanation.steps.some((s) =>
          s.description.includes("Divide body weight")
        )
      ).toBe(true);
      expect(explanation.summary).toContain("BMI =");
    });

    it("surfaces missing inputs as explicit diagnostics without plausible invented values", () => {
      const fieldValues = {
        WEIGHT: 70,
        // HEIGHT is intentionally omitted
      };

      const explanation = explainCalculationDerivation(
        "WEIGHT / ((HEIGHT / 100) * (HEIGHT / 100))",
        fieldValues,
        fieldsList,
        fieldsList.find((f) => f.variableName === "BMI")
      );

      expect(explanation.status).toBe("missing_inputs");
      expect(explanation.result).toBeNull();
      expect(explanation.diagnostics.length).toBeGreaterThan(0);
      expect(explanation.diagnostics[0]).toContain("HEIGHT");
      expect(explanation.summary).toContain("missing required inputs");
    });

    it("surfaces null flavors as missing input values", () => {
      const fieldValues = {
        WEIGHT: 70,
        HEIGHT: "NASK", // null flavor
      };

      const explanation = explainCalculationDerivation(
        "WEIGHT / ((HEIGHT / 100) * (HEIGHT / 100))",
        fieldValues,
        fieldsList,
        fieldsList.find((f) => f.variableName === "BMI")
      );

      expect(explanation.status).toBe("missing_inputs");
      expect(explanation.result).toBeNull();
      expect(
        explanation.dependencies.find((d) => d.variableName === "HEIGHT")
          ?.status
      ).toBe("missing");
    });

    it("detects unit mismatch between expected and declared unit", () => {
      const mismatchedFields: CRFField[] = [
        {
          id: "fld_height",
          variableName: "HEIGHT",
          label: "Height",
          dataType: "number",
          columnSpan: 6,
          required: false,
          unit: "in", // Mismatch: inches instead of expected cm
        },
        {
          id: "fld_weight",
          variableName: "WEIGHT",
          label: "Weight",
          dataType: "number",
          columnSpan: 6,
          required: false,
          unit: "kg",
        },
      ];

      const fieldValues = {
        HEIGHT: 68,
        WEIGHT: 70,
      };

      const explanation = explainCalculationDerivation(
        "WEIGHT / ((HEIGHT / 100) * (HEIGHT / 100))",
        fieldValues,
        mismatchedFields
      );

      expect(explanation.status).toBe("invalid_unit");
      expect(
        explanation.diagnostics.some((d) => d.includes("Unit mismatch"))
      ).toBe(true);
    });

    it("surfaces division by zero safely without crashing or returning Infinity/NaN", () => {
      const fieldValues = {
        HEIGHT: 0,
        WEIGHT: 70,
      };

      const explanation = explainCalculationDerivation(
        "WEIGHT / ((HEIGHT / 100) * (HEIGHT / 100))",
        fieldValues,
        fieldsList
      );

      expect(explanation.status).toBe("division_by_zero");
      expect(explanation.result).toBeNull();
      expect(
        explanation.diagnostics.some((d) => d.includes("Division by zero"))
      ).toBe(true);
    });

    it("detects cyclic self-reference when target field is used in its own formula", () => {
      const target = fieldsList.find((f) => f.variableName === "BMI")!;
      const explanation = explainCalculationDerivation(
        "BMI * 1.05",
        { BMI: 22 },
        fieldsList,
        target
      );

      expect(explanation.status).toBe("cyclic_dependency");
      expect(explanation.result).toBeNull();
      expect(
        explanation.diagnostics.some((d) => d.includes("Cyclic dependency"))
      ).toBe(true);
    });

    it("evaluates renamed dependencies seamlessly after author rename", () => {
      const renamedFields: CRFField[] = [
        {
          id: "fld_height",
          variableName: "VS_HT",
          label: "Height",
          dataType: "number",
          columnSpan: 6,
          required: false,
          unit: "cm",
        },
        {
          id: "fld_weight",
          variableName: "VS_WT",
          label: "Weight",
          dataType: "number",
          columnSpan: 6,
          required: false,
          unit: "kg",
        },
      ];

      const fieldValues = {
        VS_HT: 180,
        VS_WT: 81,
      };

      const explanation = explainCalculationDerivation(
        "VS_WT / ((VS_HT / 100) * (VS_HT / 100))",
        fieldValues,
        renamedFields
      );

      expect(explanation.status).toBe("success");
      expect(explanation.result).toBe(25);
    });
  });

  describe("Issue #542: Dependency Web Sentinel", () => {
    const buildTestStudy = (): StudyProtocol => {
      const initial = StudyProtocolEngine.createInitialStudy();
      const customForm: CRFForm = {
        id: "form_vitals",
        name: "Vital Signs Form",
        domain: "CUST",
        description: "Test vitals form",
        version: "1.0",
        sections: [
          {
            id: "sec_vitals",
            title: "Vital Signs",
            fields: [
              {
                id: "fld_sysbp",
                variableName: "SYSBP",
                label: "Systolic Blood Pressure",
                dataType: "integer",
                columnSpan: 6,
                required: true,
                unit: "mmHg",
              },
              {
                id: "fld_diabp",
                variableName: "DIABP",
                label: "Diastolic Blood Pressure",
                dataType: "integer",
                columnSpan: 6,
                required: true,
                unit: "mmHg",
              },
              {
                id: "fld_map",
                variableName: "MAP",
                label: "Mean Arterial Pressure",
                dataType: "calculated",
                columnSpan: 6,
                required: false,
                calculationFormula: "DIABP + (SYSBP - DIABP) / 3",
              },
            ],
          },
          {
            id: "sec_pulse",
            title: "Anthropometry",
            fields: [
              {
                id: "fld_pulse",
                variableName: "PULSE",
                label: "Heart Rate",
                dataType: "integer",
                columnSpan: 6,
                required: true,
                unit: "bpm",
              },
            ],
          },
        ],
        rules: [
          {
            id: "rule_bp_check",
            name: "Systolic Must Exceed Diastolic",
            description: "Verify that systolic BP is greater than diastolic BP",
            actionType: "raise_query",
            targetFieldId: "fld_sysbp",
            triggerFieldIds: ["fld_sysbp", "fld_diabp"],
            logicalOperator: "AND",
            conditions: [
              {
                fieldId: "fld_sysbp",
                operator: "lte",
                value: "",
                compareFieldId: "fld_diabp",
              },
            ],
            querySeverity: "error",
            queryMessage: "Systolic BP must be greater than Diastolic BP.",
          },
          {
            id: "rule_pulse_high",
            name: "High Heart Rate Alert",
            description: "Alert when pulse exceeds 100 bpm",
            actionType: "raise_query",
            targetFieldId: "fld_pulse",
            triggerFieldIds: ["fld_pulse"],
            logicalOperator: "AND",
            conditions: [
              {
                fieldId: "fld_pulse",
                operator: "gt",
                value: 100,
              },
            ],
            querySeverity: "warning",
            queryMessage: "Tachycardia warning: Pulse exceeds 100 bpm.",
          },
        ],
      };

      return {
        ...initial,
        forms: [customForm],
      };
    };

    it("finds all references across targets, triggers, conditions, formulas, and calculations", () => {
      const study = buildTestStudy();
      const vsForm = study.forms[0];
      const sysField = vsForm.sections[0].fields.find(
        (f) => f.variableName === "SYSBP"
      )!;
      const diaField = vsForm.sections[0].fields.find(
        (f) => f.variableName === "DIABP"
      )!;

      // Find references to SYSBP
      const sysRefs = StudyProtocolEngine.findFieldReferences(
        study,
        sysField.id
      );
      expect(sysRefs.length).toBeGreaterThanOrEqual(3);

      const types = sysRefs.map((r) => r.type);
      expect(types).toContain("rule_target");
      expect(types).toContain("rule_trigger");
      expect(types).toContain("rule_condition");
      expect(types).toContain("field_calculation"); // Referenced in MAP calculation formula

      // Find references to DIABP
      const diaRefs = StudyProtocolEngine.findFieldReferences(
        study,
        diaField.id
      );
      const diaTypes = diaRefs.map((r) => r.type);
      expect(diaTypes).toContain("rule_trigger");
      expect(diaTypes).toContain("rule_condition");
      expect(diaTypes).toContain("field_calculation");
    });

    it("previews field removal blast radius with canSafelyDelete and warnings", () => {
      const study = buildTestStudy();
      const vsForm = study.forms[0];
      const sysField = vsForm.sections[0].fields.find(
        (f) => f.variableName === "SYSBP"
      )!;

      const previewSys = StudyProtocolEngine.previewFieldRemoval(
        study,
        vsForm.id,
        sysField.id
      );
      expect(previewSys.canSafelyDelete).toBe(false);
      expect(previewSys.references.length).toBeGreaterThan(0);
      expect(previewSys.warningMessage).toContain("actively referenced");

      // Preview removal of MAP (which is not referenced by anything)
      const mapField = vsForm.sections[0].fields.find(
        (f) => f.variableName === "MAP"
      )!;
      const previewMap = StudyProtocolEngine.previewFieldRemoval(
        study,
        vsForm.id,
        mapField.id
      );
      expect(previewMap.canSafelyDelete).toBe(true);
      expect(previewMap.references.length).toBe(0);
      expect(previewMap.warningMessage).toBeUndefined();
    });

    it("previews section removal blast radius aggregating all fields in containing section", () => {
      const study = buildTestStudy();
      const vsForm = study.forms[0];
      const sec0 = vsForm.sections[0]; // Contains SYSBP, DIABP, MAP
      const sec1 = vsForm.sections[1]; // Contains PULSE

      const previewSec0 = StudyProtocolEngine.previewSectionRemoval(
        study,
        vsForm.id,
        sec0.id
      );
      expect(previewSec0.canSafelyDelete).toBe(false);
      expect(previewSec0.fields.length).toBe(3);
      expect(previewSec0.totalReferencesCount).toBeGreaterThan(0);

      const previewSec1 = StudyProtocolEngine.previewSectionRemoval(
        study,
        vsForm.id,
        sec1.id
      );
      expect(previewSec1.fields.length).toBe(1);
      expect(previewSec1.totalReferencesCount).toBeGreaterThanOrEqual(1); // PULSE has rule2
    });

    it("renames field everywhere updating all rules, conditions, and formulas atomically", () => {
      const study = buildTestStudy();
      const vsForm = study.forms[0];

      // Rename SYSBP to SBP
      const {
        study: updatedStudy,
        updatedField,
        affectedReferencesCount,
        error,
      } = StudyProtocolEngine.renameFieldEverywhere(
        study,
        vsForm.id,
        "SYSBP",
        "SBP"
      );

      expect(error).toBeUndefined();
      expect(updatedField).toBeDefined();
      expect(updatedField?.variableName).toBe("SBP");
      expect(affectedReferencesCount).toBeGreaterThan(0);

      // Verify that MAP calculation formula now references SBP instead of SYSBP
      const updatedVS = StudyProtocolEngine.getForm(updatedStudy, vsForm.id)!;
      const mapField = updatedVS.sections[0].fields.find(
        (f) => f.variableName === "MAP"
      )!;
      expect(mapField.calculationFormula).toContain("SBP");
      expect(mapField.calculationFormula).not.toContain("SYSBP");

      // Verify rule references were updated
      const rule = updatedVS.rules.find((r) => r.id === "rule_bp_check")!;
      expect(rule).toBeDefined();
    });

    it("rejects invalid or colliding variable names during rename everywhere", () => {
      const study = buildTestStudy();
      const vsForm = study.forms[0];

      // Exceeds 8 characters
      const { error: errTooLong } = StudyProtocolEngine.renameFieldEverywhere(
        study,
        vsForm.id,
        "SYSBP",
        "SYSTOLIC_PRESSURE"
      );
      expect(errTooLong).toBeDefined();
      expect(errTooLong).toContain("limit");

      // Duplicate existing variable name
      const { error: errDuplicate } = StudyProtocolEngine.renameFieldEverywhere(
        study,
        vsForm.id,
        "SYSBP",
        "DIABP"
      );
      expect(errDuplicate).toBeDefined();
      expect(errDuplicate).toContain("already exists");
    });

    it("removes field with cascade and restores cleanly with 1-operation undo", () => {
      const study = buildTestStudy();
      const vsForm = study.forms[0];
      const sysField = vsForm.sections[0].fields.find(
        (f) => f.variableName === "SYSBP"
      )!;

      // Remove SYSBP with cascade
      const {
        study: studyAfterDelete,
        removedField,
        undo,
      } = StudyProtocolEngine.removeFieldWithCascade(
        study,
        vsForm.id,
        sysField.id
      );

      expect(removedField).toBeDefined();
      expect(undo).toBeDefined();

      const vsAfter = StudyProtocolEngine.getForm(studyAfterDelete, vsForm.id)!;
      // Field should no longer exist in section 0
      expect(vsAfter.sections[0].fields.some((f) => f.id === sysField.id)).toBe(
        false
      );
      // Dependent rule targeting SYSBP should be pruned
      expect(vsAfter.rules.some((r) => r.targetFieldId === sysField.id)).toBe(
        false
      );

      // Execute 1-operation undo
      const restoredStudy = undo!(studyAfterDelete);
      const vsRestored = StudyProtocolEngine.getForm(restoredStudy, vsForm.id)!;

      // Field should be restored at exact section and index
      expect(
        vsRestored.sections[0].fields.some((f) => f.id === sysField.id)
      ).toBe(true);
      // Rules should be restored
      expect(
        vsRestored.rules.some((r) => r.targetFieldId === sysField.id)
      ).toBe(true);
    });

    it("removes section with cascade and restores cleanly with 1-operation undo", () => {
      const study = buildTestStudy();
      const vsForm = study.forms[0];
      const sec1 = vsForm.sections[1]; // Anthropometry section containing PULSE

      // Remove section with cascade
      const {
        study: studyAfterDelete,
        removedSection,
        undo,
      } = StudyProtocolEngine.removeSectionWithCascade(
        study,
        vsForm.id,
        sec1.id
      );

      expect(removedSection).toBeDefined();
      expect(undo).toBeDefined();

      const vsAfter = StudyProtocolEngine.getForm(studyAfterDelete, vsForm.id)!;
      expect(vsAfter.sections.length).toBe(1);
      // PULSE rule should be pruned
      expect(vsAfter.rules.some((r) => r.id === "rule_pulse_high")).toBe(false);

      // Execute 1-operation undo
      const restoredStudy = undo!(studyAfterDelete);
      const vsRestored = StudyProtocolEngine.getForm(restoredStudy, vsForm.id)!;
      expect(vsRestored.sections.length).toBe(2);
      expect(vsRestored.sections[1].id).toBe(sec1.id);
      expect(vsRestored.rules.some((r) => r.id === "rule_pulse_high")).toBe(
        true
      );
    });

    it("surfaces broken references as explicit draft diagnostics via lintForm rather than valid output", () => {
      const study = buildTestStudy();
      const vsForm = study.forms[0];

      // Intentionally introduce an orphaned condition referencing a non-existent field ID
      const corruptedForm: CRFForm = {
        ...vsForm,
        rules: [
          ...vsForm.rules,
          {
            id: "rule_broken_cond",
            name: "Corrupted Rule",
            description: "Rule with deleted field reference",
            actionType: "raise_query",
            targetFieldId: vsForm.sections[0].fields[0].id,
            triggerFieldIds: [vsForm.sections[0].fields[0].id],
            logicalOperator: "AND",
            conditions: [
              {
                fieldId: "fld_non_existent_ghost",
                operator: "eq",
                value: 42,
              },
            ],
            querySeverity: "error",
          },
        ],
      };

      const diagnostics = lintForm(corruptedForm);
      const brokenCondDiag = diagnostics.find((d) =>
        d.id.includes("broken_rule_cond_")
      );
      expect(brokenCondDiag).toBeDefined();
      expect(brokenCondDiag?.severity).toBe("error");
      expect(brokenCondDiag?.message).toContain("fld_non_existent_ghost");
    });
  });
});
