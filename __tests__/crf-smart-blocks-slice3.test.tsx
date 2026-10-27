import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  StudyProtocolEngine,
  searchSlashCommands,
  instantiateSmartBlock,
  instantiateAtomicField,
  CLINICAL_SMART_BLOCKS,
  ALL_SLASH_COMMANDS,
  explainCalculationDerivation,
  evaluateRuleResult,
} from "@/lib/crf";
import type { StudyProtocol, CRFForm, CRFSection } from "@/lib/crf/types";
import { SlashPaletteModal } from "@/components/crf/SlashPaletteModal";

interface DiscrepancyQuery {
  ruleId: string;
  targetFieldId?: string;
  message: string;
  severity?: string;
}

function evaluateRules(
  form: CRFForm,
  fieldValues: Record<string, string | number | boolean | null | undefined>
): DiscrepancyQuery[] {
  const fields = form.sections.flatMap((s: CRFSection) => s.fields);
  const queries: DiscrepancyQuery[] = [];

  for (const rule of form.rules) {
    const res = evaluateRuleResult(rule, fieldValues, fields);
    if (res === "true") {
      queries.push({
        ruleId: rule.id,
        targetFieldId: rule.targetFieldId,
        message: rule.queryMessage || rule.description || rule.name,
        severity: rule.querySeverity || "warning",
      });
    }
  }

  return queries;
}

describe("CRF Usability & Features Track 3 Slice 3: Smart Blocks & Slash Commands (#538)", () => {
  afterEach(() => {
    cleanup();
  });

  const buildTestStudy = (): StudyProtocol => {
    const initial = StudyProtocolEngine.createInitialStudy();
    const customForm: CRFForm = {
      id: "form_screening",
      name: "Screening & Baseline",
      domain: "SCRN",
      description: "Screening procedures and baseline assessments",
      version: "1.0",
      sections: [
        {
          id: "sec_screening",
          title: "Screening Log",
          fields: [
            {
              id: "fld_subjid",
              variableName: "SUBJID",
              label: "Subject ID",
              dataType: "text",
              columnSpan: 6,
              required: true,
            },
          ],
        },
      ],
      rules: [],
    };

    return {
      ...initial,
      forms: [customForm],
    };
  };

  describe("1. Slash Command Search, Ranking & Categories", () => {
    it("returns all slash commands when query is empty", () => {
      const all = searchSlashCommands("");
      expect(all.length).toBe(ALL_SLASH_COMMANDS.length);
      expect(all.length).toBeGreaterThan(15);
    });

    it("fuzzy matches commands, titles, and keywords", () => {
      // By command prefix
      const vitalsByCmd = searchSlashCommands("/vitals");
      expect(vitalsByCmd.some((c) => c.id === "vitals")).toBe(true);

      // By keyword "bmi"
      const vitalsByKeyword = searchSlashCommands("bmi");
      expect(vitalsByKeyword.some((c) => c.id === "vitals")).toBe(true);

      // By title "demographics"
      const dm = searchSlashCommands("demographics");
      expect(dm.some((c) => c.id === "demographics")).toBe(true);

      // By keyword "consent"
      const consent = searchSlashCommands("consent");
      expect(consent.some((c) => c.id === "demographics")).toBe(true);
    });

    it("filters slash commands by category tab", () => {
      const smartBlocks = searchSlashCommands("", "smart_block");
      expect(smartBlocks.length).toBe(CLINICAL_SMART_BLOCKS.length);
      expect(smartBlocks.every((c) => c.category === "smart_block")).toBe(true);

      const widgets = searchSlashCommands("", "widget");
      expect(widgets.every((c) => c.category === "widget")).toBe(true);

      const layout = searchSlashCommands("", "layout");
      expect(layout.some((c) => c.action === "insert_section")).toBe(true);
    });
  });

  describe("2. Starter Vital Signs Block Behavior (Units, BMI Derivation, Genuine BP Check)", () => {
    it("instantiates standard vitals with documented units and CDASH metadata", () => {
      const { section, rules } = instantiateSmartBlock("vitals");

      const varNames = section.fields.map((f) => f.variableName);
      expect(varNames).toContain("SYSBP");
      expect(varNames).toContain("DIABP");
      expect(varNames).toContain("PULSE");
      expect(varNames).toContain("TEMP");
      expect(varNames).toContain("WEIGHT");
      expect(varNames).toContain("HEIGHT");
      expect(varNames).toContain("BMI");

      // Verify documented clinical units
      const sysbp = section.fields.find((f) => f.variableName === "SYSBP")!;
      const diabp = section.fields.find((f) => f.variableName === "DIABP")!;
      const pulse = section.fields.find((f) => f.variableName === "PULSE")!;
      const temp = section.fields.find((f) => f.variableName === "TEMP")!;
      const weight = section.fields.find((f) => f.variableName === "WEIGHT")!;
      const height = section.fields.find((f) => f.variableName === "HEIGHT")!;
      const bmi = section.fields.find((f) => f.variableName === "BMI")!;

      expect(sysbp.unit).toBe("mmHg");
      expect(diabp.unit).toBe("mmHg");
      expect(pulse.unit).toBe("beats/min");
      expect(temp.unit).toBe("°C");
      expect(weight.unit).toBe("kg");
      expect(height.unit).toBe("cm");
      expect(bmi.unit).toBe("kg/m²");

      // Verify genuine BP discrepancy check rule
      expect(rules.length).toBeGreaterThanOrEqual(1);
      const bpRule = rules.find((r) =>
        r.name.toLowerCase().includes("systolic must exceed diastolic")
      );
      expect(bpRule).toBeDefined();
      expect(bpRule!.conditions[0].compareFieldId).toBe(diabp.id);
      expect(bpRule!.conditions[0].fieldId).toBe(sysbp.id);
      expect(bpRule!.conditions[0].operator).toBe("lte");
    });

    it("evaluates genuine BP check: positive, negative, boundary, and missing cases", () => {
      const { section, rules } = instantiateSmartBlock("vitals");
      const sysbp = section.fields.find((f) => f.variableName === "SYSBP")!;
      const diabp = section.fields.find((f) => f.variableName === "DIABP")!;
      const dummyForm: CRFForm = {
        id: "form_vs",
        name: "VS",
        domain: "VS",
        description: "Vital Signs",
        version: "1.0",
        sections: [section],
        rules,
      };

      // 1. Positive case: SYSBP=120, DIABP=80 -> condition 120 <= 80 is false -> 0 queries raised
      const positiveQueries = evaluateRules(dummyForm, {
        [sysbp.id]: 120,
        [diabp.id]: 80,
      });
      expect(positiveQueries.length).toBe(0);

      // 2. Negative case: SYSBP=75, DIABP=80 -> condition 75 <= 80 is true -> query raised
      const negativeQueries = evaluateRules(dummyForm, {
        [sysbp.id]: 75,
        [diabp.id]: 80,
      });
      expect(negativeQueries.length).toBe(1);
      expect(negativeQueries[0].message).toContain(
        "Systolic Blood Pressure must exceed Diastolic Blood Pressure"
      );

      // 3. Boundary case: SYSBP=80, DIABP=80 -> condition 80 <= 80 is true -> query raised (lte)
      const boundaryQueries = evaluateRules(dummyForm, {
        [sysbp.id]: 80,
        [diabp.id]: 80,
      });
      expect(boundaryQueries.length).toBe(1);

      // 4. Missing inputs: SYSBP missing -> rule does not raise false query
      const missingQueries = evaluateRules(dummyForm, {
        [diabp.id]: 80,
      });
      expect(missingQueries.length).toBe(0);
    });

    it("evaluates BMI calculation derivation: positive, boundary, division by zero, and missing cases", () => {
      const { section } = instantiateSmartBlock("vitals");
      const bmiField = section.fields.find((f) => f.variableName === "BMI")!;
      expect(bmiField.calculationFormula).toBe(
        "WEIGHT / ((HEIGHT / 100) * (HEIGHT / 100))"
      );

      // 1. Positive case: WEIGHT=70 kg, HEIGHT=175 cm -> 70 / (1.75 * 1.75) = 22.86
      const positiveExplanation = explainCalculationDerivation(
        bmiField.calculationFormula!,
        { WEIGHT: 70, HEIGHT: 175 },
        section.fields,
        bmiField
      );
      expect(positiveExplanation.status).toBe("success");
      expect(positiveExplanation.result).toBeCloseTo(22.86, 1);
      expect(positiveExplanation.steps.length).toBeGreaterThanOrEqual(4);

      // 2. Missing case: HEIGHT is missing
      const missingExplanation = explainCalculationDerivation(
        bmiField.calculationFormula!,
        { WEIGHT: 70 },
        section.fields,
        bmiField
      );
      expect(missingExplanation.status).toBe("missing_inputs");
      expect(
        missingExplanation.diagnostics.some((d) => d.includes("HEIGHT"))
      ).toBe(true);

      // 3. Division by zero case: HEIGHT=0
      const divZeroExplanation = explainCalculationDerivation(
        bmiField.calculationFormula!,
        { WEIGHT: 70, HEIGHT: 0 },
        section.fields,
        bmiField
      );
      expect(divZeroExplanation.status).toBe("division_by_zero");
      expect(
        divZeroExplanation.diagnostics.some((d) =>
          d.toLowerCase().includes("division by zero")
        )
      ).toBe(true);
    });
  });

  describe("3. Starter Demographics Block Behavior (Terminology Provenance & Rules)", () => {
    it("instantiates demographics with CDASH standard codelists, age, and consent rules", () => {
      const { section, rules } = instantiateSmartBlock("demographics");
      const varNames = section.fields.map((f) => f.variableName);

      expect(varNames).toContain("ICDAT");
      expect(varNames).toContain("ICYN");
      expect(varNames).toContain("BRTHYR");
      expect(varNames).toContain("AGE");
      expect(varNames).toContain("SEX");
      expect(varNames).toContain("RACE");
      expect(varNames).toContain("ETHNIC");

      const ageField = section.fields.find((f) => f.variableName === "AGE")!;
      expect(ageField.unit).toBe("Years");

      // Verify informed consent rule and age eligibility rule
      const consentRule = rules.find((r) =>
        r.name.toLowerCase().includes("informed consent")
      );
      const ageRule = rules.find((r) =>
        r.name.toLowerCase().includes("age eligibility")
      );

      expect(consentRule).toBeDefined();
      expect(ageRule).toBeDefined();
    });

    it("evaluates demographics rules: positive, negative, boundary, and missing cases", () => {
      const { section, rules } = instantiateSmartBlock("demographics");
      const icyn = section.fields.find((f) => f.variableName === "ICYN")!;
      const age = section.fields.find((f) => f.variableName === "AGE")!;

      const dummyForm: CRFForm = {
        id: "form_dm",
        name: "DM",
        domain: "DM",
        description: "Demographics",
        version: "1.0",
        sections: [section],
        rules,
      };

      // 1. Positive case: ICYN = "Y", AGE = 35 -> 0 queries
      const positiveQueries = evaluateRules(dummyForm, {
        [icyn.id]: "Y",
        [age.id]: 35,
      });
      expect(positiveQueries.length).toBe(0);

      // 2. Negative case: ICYN = "N" -> consent query raised
      const consentNegative = evaluateRules(dummyForm, {
        [icyn.id]: "N",
        [age.id]: 35,
      });
      expect(consentNegative.length).toBe(1);
      expect(consentNegative[0].message).toContain(
        "Written informed consent is a mandatory prerequisite"
      );

      // 3. Age boundary case: AGE = 18 -> meets requirement (lt 18 is false) -> 0 queries
      const ageBoundary = evaluateRules(dummyForm, {
        [icyn.id]: "Y",
        [age.id]: 18,
      });
      expect(ageBoundary.length).toBe(0);

      // 4. Age negative case: AGE = 17 -> fails requirement (lt 18 is true) -> query raised
      const ageNegative = evaluateRules(dummyForm, {
        [icyn.id]: "Y",
        [age.id]: 17,
      });
      expect(ageNegative.length).toBe(1);
      expect(ageNegative[0].message).toContain("Subject must be at least 18");
    });
  });

  describe("4. Repeated Block Insertion: Collision Resistance & Reference Remapping", () => {
    it("allocates distinct identities and remaps calculation formulas and rules without collisions", () => {
      const study = buildTestStudy();
      const form = study.forms[0];

      // 1. Insert first vitals smart block
      const firstResult = StudyProtocolEngine.insertSmartBlock(
        study,
        form.id,
        "vitals"
      );
      expect(firstResult.error).toBeUndefined();
      const studyWithFirst = firstResult.study;
      const formWithFirst = studyWithFirst.forms[0];

      expect(formWithFirst.sections.length).toBe(2);
      expect(formWithFirst.rules.length).toBeGreaterThanOrEqual(1);

      const firstVitalsSec = formWithFirst.sections[1];
      const firstSysbp = firstVitalsSec.fields.find(
        (f) => f.variableName === "SYSBP"
      )!;
      const firstDiabp = firstVitalsSec.fields.find(
        (f) => f.variableName === "DIABP"
      )!;
      const firstBmi = firstVitalsSec.fields.find(
        (f) => f.variableName === "BMI"
      )!;
      expect(firstBmi.calculationFormula).toBe(
        "WEIGHT / ((HEIGHT / 100) * (HEIGHT / 100))"
      );

      // 2. Insert second vitals smart block into the SAME form
      const secondResult = StudyProtocolEngine.insertSmartBlock(
        studyWithFirst,
        form.id,
        "vitals"
      );
      expect(secondResult.error).toBeUndefined();
      const studyWithSecond = secondResult.study;
      const formWithSecond = studyWithSecond.forms[0];

      expect(formWithSecond.sections.length).toBe(3);
      expect(formWithSecond.rules.length).toBeGreaterThanOrEqual(2);

      const secondVitalsSec = formWithSecond.sections[2];

      // Check section ID uniqueness
      expect(secondVitalsSec.id).not.toBe(firstVitalsSec.id);

      // Check field ID uniqueness: all field IDs in entire form must be 100% unique
      const allFieldIds = formWithSecond.sections.flatMap((s) =>
        s.fields.map((f) => f.id)
      );
      const uniqueFieldIds = new Set(allFieldIds);
      expect(uniqueFieldIds.size).toBe(allFieldIds.length);

      // Check nonconflicting valid CDASH variable names (<= 8 chars)
      const secondVars = secondVitalsSec.fields.map((f) => f.variableName);
      expect(secondVars).toContain("SYSBP_2");
      expect(secondVars).toContain("DIABP_2");
      expect(secondVars).toContain("WEIGHT_2");
      expect(secondVars).toContain("HEIGHT_2");
      expect(secondVars).toContain("BMI_2");
      secondVars.forEach((v) => {
        expect(v.length).toBeLessThanOrEqual(8);
        expect(/^[A-Z][A-Z0-9_]*$/.test(v)).toBe(true);
      });

      // Check that 2nd block's BMI calculation formula was remapped to new variable names
      const secondBmi = secondVitalsSec.fields.find(
        (f) => f.variableName === "BMI_2"
      )!;
      expect(secondBmi.calculationFormula).toBe(
        "WEIGHT_2 / ((HEIGHT_2 / 100) * (HEIGHT_2 / 100))"
      );

      // Check that 2nd block's BP rule conditions and triggers were remapped to 2nd block's field IDs
      const secondSysbp = secondVitalsSec.fields.find(
        (f) => f.variableName === "SYSBP_2"
      )!;
      const secondDiabp = secondVitalsSec.fields.find(
        (f) => f.variableName === "DIABP_2"
      )!;
      const secondRule = formWithSecond.rules.find(
        (r) => r.targetFieldId === secondSysbp.id
      )!;
      expect(secondRule).toBeDefined();
      expect(secondRule.targetFieldId).toBe(secondSysbp.id);
      expect(secondRule.triggerFieldIds).toContain(secondSysbp.id);
      expect(secondRule.triggerFieldIds).toContain(secondDiabp.id);
      expect(secondRule.conditions[0].fieldId).toBe(secondSysbp.id);
      expect(secondRule.conditions[0].compareFieldId).toBe(secondDiabp.id);

      // Evaluate 2nd block independently without crosstalk
      // 1st block: normal (120/80) -> no query
      // 2nd block: abnormal (70/80) -> query on 2nd block only
      const queries = evaluateRules(formWithSecond, {
        [firstSysbp.id]: 120,
        [firstDiabp.id]: 80,
        [secondSysbp.id]: 70,
        [secondDiabp.id]: 80,
      });

      expect(queries.length).toBe(1);
      expect(queries[0].targetFieldId).toBe(secondSysbp.id);

      // Verify undo restoration restores original study
      const undone = secondResult.undo();
      expect(undone.forms[0].sections.length).toBe(2);
    });

    it("inserts atomic slash field with collision-free naming and supports undo", () => {
      const study = buildTestStudy();
      const form = study.forms[0];

      const res1 = StudyProtocolEngine.insertAtomicSlashField(
        study,
        form.id,
        "text",
        { targetSectionId: form.sections[0].id }
      );
      expect(res1.error).toBeUndefined();
      expect(res1.insertedField).toBeDefined();
      expect(res1.insertedField!.variableName.length).toBeLessThanOrEqual(8);

      // Insert second atomic text field -> must not collide
      const res2 = StudyProtocolEngine.insertAtomicSlashField(
        res1.study,
        form.id,
        "text",
        { targetSectionId: form.sections[0].id }
      );
      expect(res2.error).toBeUndefined();
      expect(res2.insertedField!.variableName).not.toBe(
        res1.insertedField!.variableName
      );
      expect(res2.insertedField!.variableName.length).toBeLessThanOrEqual(8);

      // Undo restores previous state
      const undone = res2.undo();
      expect(undone.forms[0].sections[0].fields.length).toBe(2);

      // Direct unit test for instantiateAtomicField allocation
      const directField = instantiateAtomicField("signature", {
        existingVariableNames: ["PI_SIG"],
      });
      expect(directField.dataType).toBe("signature");
      expect(directField.variableName).toBe("PI_SIG_2");
    });
  });

  describe("5. SlashPaletteModal UI Component & Keyboard Conformance", () => {
    it("renders modal with search, category tabs, and items", () => {
      const handleClose = vi.fn();
      const handleSelect = vi.fn();

      render(
        <SlashPaletteModal
          isOpen={true}
          onClose={handleClose}
          onSelectCommand={handleSelect}
          targetSectionTitle="Vital Signs Section"
        />
      );

      expect(screen.getByText("Insert Smart Block or Field")).toBeTruthy();
      expect(screen.getByText(/Target: Vital Signs Section/)).toBeTruthy();
      expect(screen.getByText("Smart Blocks")).toBeTruthy();
      expect(screen.getByText("Field Widgets")).toBeTruthy();

      // Check presence of starter blocks
      expect(screen.getByText("Vital Signs & Anthropometrics")).toBeTruthy();
      expect(screen.getByText("Subject Demographics & Consent")).toBeTruthy();
    });

    it("filters items as user types into search input", () => {
      render(
        <SlashPaletteModal
          isOpen={true}
          onClose={vi.fn()}
          onSelectCommand={vi.fn()}
        />
      );

      const input = screen.getByPlaceholderText(
        /Type \/ or search widgets & smart blocks/
      );
      fireEvent.change(input, { target: { value: "vitals" } });

      expect(screen.getByText("Vital Signs & Anthropometrics")).toBeTruthy();
      expect(screen.queryByText("Subject Demographics & Consent")).toBeNull();
    });

    it("selects command when clicking Add button or pressing Enter", () => {
      const handleSelect = vi.fn();
      const handleClose = vi.fn();

      render(
        <SlashPaletteModal
          isOpen={true}
          onClose={handleClose}
          onSelectCommand={handleSelect}
        />
      );

      const input = screen.getByPlaceholderText(
        /Type \/ or search widgets & smart blocks/
      );
      fireEvent.change(input, { target: { value: "/vitals" } });

      // Press enter to select top highlighted item
      fireEvent.keyDown(input, { key: "Enter" });

      expect(handleSelect).toHaveBeenCalledTimes(1);
      expect(handleSelect.mock.calls[0][0].id).toBe("vitals");
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("dismisses without accidental insertion on Escape", () => {
      const handleSelect = vi.fn();
      const handleClose = vi.fn();

      render(
        <SlashPaletteModal
          isOpen={true}
          onClose={handleClose}
          onSelectCommand={handleSelect}
        />
      );

      const input = screen.getByPlaceholderText(
        /Type \/ or search widgets & smart blocks/
      );
      fireEvent.keyDown(input, { key: "Escape" });

      expect(handleClose).toHaveBeenCalledTimes(1);
      expect(handleSelect).not.toHaveBeenCalled();
    });
  });
});
