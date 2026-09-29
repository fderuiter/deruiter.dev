import { describe, it, expect } from "vitest";
import {
  evaluateFormula,
  evaluateCondition,
  evaluateRule,
  isMissingOrNullFlavor,
  lintForm,
  lintFormula,
  tokenizeWithSpans,
  mapPresetToFormVariables,
  CLINICAL_FORMULA_PRESETS,
  calculateBMI,
  calculateMostellerBSA,
  calculateDuboisBSA,
  calculateCockcroftGaultCrCl,
  calculateBazettQTc,
  calculateFridericiaQTc,
  calculateRecistSldChange,
} from "@/lib/crf/ast-evaluator";
import { CRFField, EditCheckRule, CRFForm } from "@/lib/crf/types";

describe("CRF Studio - AST Formula & Rule Evaluator", () => {
  const sampleFields: CRFField[] = [
    {
      id: "f_height",
      variableName: "HEIGHT",
      label: "Height",
      dataType: "number",
      columnSpan: 6,
      required: true,
      unit: "cm",
    },
    {
      id: "f_weight",
      variableName: "WEIGHT",
      label: "Weight",
      dataType: "number",
      columnSpan: 6,
      required: true,
      unit: "kg",
    },
    {
      id: "f_sysbp",
      variableName: "SYSBP",
      label: "Systolic BP",
      dataType: "integer",
      columnSpan: 6,
      required: true,
    },
    {
      id: "f_diabp",
      variableName: "DIABP",
      label: "Diastolic BP",
      dataType: "integer",
      columnSpan: 6,
      required: true,
    },
  ];

  describe("evaluateFormula", () => {
    it("evaluates basic arithmetic operations correctly", () => {
      const values = { f_height: 10, f_weight: 5 };
      expect(evaluateFormula("f_height + f_weight", values, sampleFields)).toBe(
        15
      );
      expect(evaluateFormula("f_height - f_weight", values, sampleFields)).toBe(
        5
      );
      expect(evaluateFormula("f_height * f_weight", values, sampleFields)).toBe(
        50
      );
      expect(evaluateFormula("f_height / f_weight", values, sampleFields)).toBe(
        2
      );
    });

    it("evaluates complex clinical formulas (e.g. BMI)", () => {
      const values = { height: 180, weight: 81 };
      // BMI = 81 / ((180/100) * (180/100)) = 81 / (1.8 * 1.8) = 81 / 3.24 = 25
      const formula = "round(weight / ((height / 100) * (height / 100)), 1)";
      expect(evaluateFormula(formula, values, sampleFields)).toBe(25);
    });

    it("evaluates mathematical functions (sqrt, max, min, abs, round)", () => {
      const values = { val1: 16, val2: 25 };
      const fields: CRFField[] = [
        {
          id: "val1",
          variableName: "VAL1",
          label: "V1",
          dataType: "number",
          columnSpan: 6,
          required: false,
        },
        {
          id: "val2",
          variableName: "VAL2",
          label: "V2",
          dataType: "number",
          columnSpan: 6,
          required: false,
        },
      ];

      expect(evaluateFormula("sqrt(val1)", values, fields)).toBe(4);
      expect(evaluateFormula("max(val1, val2)", values, fields)).toBe(25);
      expect(evaluateFormula("min(val1, val2)", values, fields)).toBe(16);
      expect(evaluateFormula("abs(-42)", {}, fields)).toBe(42);
      expect(evaluateFormula("round(3.14159, 2)", {}, fields)).toBe(3.14);
      expect(evaluateFormula("cbrt(27)", {}, fields)).toBe(3);
      expect(evaluateFormula("clamp(120, 0, 100)", {}, fields)).toBe(100);
      expect(evaluateFormula("clamp(-5, 0, 100)", {}, fields)).toBe(0);
      expect(evaluateFormula("clamp(50, 0, 100)", {}, fields)).toBe(50);
    });

    it("returns explicit null for division/modulo by zero and missing inputs without throwing", () => {
      expect(evaluateFormula("10 / 0", {}, [])).toBeNull();
      expect(evaluateFormula("10 % 0", {}, [])).toBeNull();
      expect(evaluateFormula("100 / MISSING_VAR", {}, sampleFields)).toBeNull();
      expect(
        evaluateFormula(
          "WEIGHT / ((HEIGHT / 100) ^ 2)",
          { WEIGHT: 70, HEIGHT: 0 },
          sampleFields
        )
      ).toBeNull();
      expect(evaluateFormula("invalid token #@$", {}, [])).toBeNull();
      expect(evaluateFormula("", {}, [])).toBeNull();
    });
  });

  describe("evaluateCondition & evaluateRule", () => {
    it("evaluates relational operators (gt, gte, lt, lte, eq, neq)", () => {
      const values = { f_sysbp: 185 };

      expect(
        evaluateCondition(
          { fieldId: "f_sysbp", operator: "gt", value: 180 },
          values,
          sampleFields
        )
      ).toBe(true);

      expect(
        evaluateCondition(
          { fieldId: "f_sysbp", operator: "lt", value: 180 },
          values,
          sampleFields
        )
      ).toBe(false);

      expect(
        evaluateCondition(
          { fieldId: "f_sysbp", operator: "gte", value: 185 },
          values,
          sampleFields
        )
      ).toBe(true);

      expect(
        evaluateCondition(
          { fieldId: "f_sysbp", operator: "eq", value: 185 },
          values,
          sampleFields
        )
      ).toBe(true);
    });

    it("evaluates presence checks (is_empty, is_not_empty)", () => {
      expect(
        evaluateCondition(
          { fieldId: "f_sysbp", operator: "is_empty", value: "" },
          {},
          sampleFields
        )
      ).toBe(true);

      expect(
        evaluateCondition(
          { fieldId: "f_sysbp", operator: "is_not_empty", value: "" },
          { f_sysbp: 120 },
          sampleFields
        )
      ).toBe(true);
    });

    it("evaluates logical AND vs OR rules", () => {
      const ruleAnd: EditCheckRule = {
        id: "rule_1",
        name: "Hypertension Check",
        description: "Both systolic and diastolic high",
        triggerFieldIds: ["f_sysbp", "f_diabp"],
        actionType: "raise_query",
        targetFieldId: "f_sysbp",
        logicalOperator: "AND",
        conditions: [
          { fieldId: "f_sysbp", operator: "gt", value: 140 },
          { fieldId: "f_diabp", operator: "gt", value: 90 },
        ],
      };

      expect(
        evaluateRule(ruleAnd, { f_sysbp: 150, f_diabp: 95 }, sampleFields)
      ).toBe(true);
      expect(
        evaluateRule(ruleAnd, { f_sysbp: 150, f_diabp: 80 }, sampleFields)
      ).toBe(false);

      const ruleOr: EditCheckRule = {
        ...ruleAnd,
        logicalOperator: "OR",
      };
      expect(
        evaluateRule(ruleOr, { f_sysbp: 150, f_diabp: 80 }, sampleFields)
      ).toBe(true);
      expect(
        evaluateRule(ruleOr, { f_sysbp: 120, f_diabp: 75 }, sampleFields)
      ).toBe(false);
    });
  });

  describe("CDISC Null Flavor & Missing Value Guard Engine", () => {
    it("isMissingOrNullFlavor identifies null, undefined, empty string, and all CDISC null flavor codes", () => {
      expect(isMissingOrNullFlavor(null)).toBe(true);
      expect(isMissingOrNullFlavor(undefined)).toBe(true);
      expect(isMissingOrNullFlavor("")).toBe(true);
      expect(isMissingOrNullFlavor("   ")).toBe(true);

      // Standard CDISC null flavor codes
      ["ND", "NA", "UNK", "ASKU", "NASK", "MSK"].forEach((code) => {
        expect(isMissingOrNullFlavor(code)).toBe(true);
        expect(isMissingOrNullFlavor(code.toLowerCase())).toBe(true);
        expect(isMissingOrNullFlavor(`  ${code}  `)).toBe(true);
      });

      // Collected non-missing values
      expect(isMissingOrNullFlavor(0)).toBe(false);
      expect(isMissingOrNullFlavor("0")).toBe(false);
      expect(isMissingOrNullFlavor(120)).toBe(false);
      expect(isMissingOrNullFlavor("120")).toBe(false);
      expect(isMissingOrNullFlavor(false)).toBe(false);
      expect(isMissingOrNullFlavor(true)).toBe(false);
      expect(isMissingOrNullFlavor("COMPLETE")).toBe(false);
    });

    it("relational numeric operators (gt, gte, lt, lte) return false when comparing against missing or null flavor values", () => {
      const nullFlavors = [
        "ND",
        "NA",
        "UNK",
        "ASKU",
        "NASK",
        "MSK",
        null,
        undefined,
        "",
      ];

      nullFlavors.forEach((nfVal) => {
        const values = { f_sysbp: nfVal };

        expect(
          evaluateCondition(
            { fieldId: "f_sysbp", operator: "gt", value: 140 },
            values,
            sampleFields
          )
        ).toBe(false);
        expect(
          evaluateCondition(
            { fieldId: "f_sysbp", operator: "gte", value: 0 },
            values,
            sampleFields
          )
        ).toBe(false);
        expect(
          evaluateCondition(
            { fieldId: "f_sysbp", operator: "lt", value: 200 },
            values,
            sampleFields
          )
        ).toBe(false);
        expect(
          evaluateCondition(
            { fieldId: "f_sysbp", operator: "lte", value: 0 },
            values,
            sampleFields
          )
        ).toBe(false);
      });
    });

    it("treats CDISC null flavor codes as missing during presence checks (is_empty, is_not_empty)", () => {
      ["ND", "NA", "UNK", "ASKU", "NASK", "MSK"].forEach((nf) => {
        expect(
          evaluateCondition(
            { fieldId: "f_sysbp", operator: "is_empty", value: "" },
            { f_sysbp: nf },
            sampleFields
          )
        ).toBe(true);
        expect(
          evaluateCondition(
            { fieldId: "f_sysbp", operator: "is_not_empty", value: "" },
            { f_sysbp: nf },
            sampleFields
          )
        ).toBe(false);
      });
    });

    it("normalizes CDISC null flavor strings to null in formula context before math expression execution", () => {
      // Formula: WEIGHT / ((HEIGHT / 100) ^ 2)
      expect(
        evaluateFormula("f_weight + 10", { f_weight: "ND" }, sampleFields)
      ).toBeNull();

      expect(
        evaluateFormula(
          "f_weight / ((f_height / 100) ^ 2)",
          { f_height: 180, f_weight: "UNK" },
          sampleFields
        )
      ).toBeNull();

      expect(
        evaluateFormula(
          "f_height - f_weight",
          { f_height: "NA", f_weight: 70 },
          sampleFields
        )
      ).toBeNull();

      expect(
        evaluateFormula("sqrt(f_weight)", { f_weight: "ASKU" }, sampleFields)
      ).toBeNull();
    });

    it("evaluates valid zero numeric inputs accurately in relational checks and calculations", () => {
      const valuesZero = { f_sysbp: 0, f_diabp: 0, f_weight: 0, f_height: 180 };

      // Relational checks
      expect(
        evaluateCondition(
          { fieldId: "f_sysbp", operator: "eq", value: 0 },
          valuesZero,
          sampleFields
        )
      ).toBe(true);
      expect(
        evaluateCondition(
          { fieldId: "f_sysbp", operator: "gte", value: 0 },
          valuesZero,
          sampleFields
        )
      ).toBe(true);
      expect(
        evaluateCondition(
          { fieldId: "f_sysbp", operator: "gt", value: 0 },
          valuesZero,
          sampleFields
        )
      ).toBe(false);
      expect(
        evaluateCondition(
          { fieldId: "f_sysbp", operator: "lte", value: 0 },
          valuesZero,
          sampleFields
        )
      ).toBe(true);
      expect(
        evaluateCondition(
          { fieldId: "f_sysbp", operator: "is_empty", value: "" },
          valuesZero,
          sampleFields
        )
      ).toBe(false);

      // Calculations
      expect(evaluateFormula("f_sysbp + 10", valuesZero, sampleFields)).toBe(
        10
      );
      expect(evaluateFormula("f_sysbp * 5", valuesZero, sampleFields)).toBe(0);
      expect(
        evaluateFormula(
          "f_weight / ((f_height / 100) ^ 2)",
          valuesZero,
          sampleFields
        )
      ).toBe(0);
    });

    it("prevents false-positive edit check queries when dependent fields contain null flavors", () => {
      const hypertensionRule: EditCheckRule = {
        id: "rule_htn",
        name: "Hypertension Query",
        description: "Flag when both systolic > 140 and diastolic > 90",
        triggerFieldIds: ["f_sysbp", "f_diabp"],
        actionType: "raise_query",
        targetFieldId: "f_sysbp",
        logicalOperator: "AND",
        conditions: [
          { fieldId: "f_sysbp", operator: "gt", value: 140 },
          { fieldId: "f_diabp", operator: "gt", value: 90 },
        ],
      };

      // Diastolic BP not done (ND) -> rule should return false (no query)
      expect(
        evaluateRule(
          hypertensionRule,
          { f_sysbp: 150, f_diabp: "ND" },
          sampleFields
        )
      ).toBe(false);
      // Diastolic BP unknown (UNK) -> rule should return false
      expect(
        evaluateRule(
          hypertensionRule,
          { f_sysbp: 150, f_diabp: "UNK" },
          sampleFields
        )
      ).toBe(false);
      // Diastolic BP uncollected (null) -> rule should return false
      expect(
        evaluateRule(
          hypertensionRule,
          { f_sysbp: 150, f_diabp: null },
          sampleFields
        )
      ).toBe(false);

      // Actual high systolic and diastolic -> rule returns true
      expect(
        evaluateRule(
          hypertensionRule,
          { f_sysbp: 150, f_diabp: 95 },
          sampleFields
        )
      ).toBe(true);
    });

    it("preserves field lookup resolution across cross-visit, visit-level, and nullFlavorValue fallback contexts", () => {
      const fieldWithNullFlavor: CRFField = {
        id: "f_weight",
        variableName: "WEIGHT",
        label: "Weight",
        dataType: "number",
        columnSpan: 6,
        required: false,
        nullFlavorValue: "ND",
      };

      // Visit-level lookup with scoped key
      expect(
        evaluateCondition(
          { fieldId: "WEIGHT", operator: "is_empty", value: "" },
          { V1_f_weight: "ND" },
          [fieldWithNullFlavor],
          "V1"
        )
      ).toBe(true);

      // Cross-visit lookup
      expect(
        evaluateCondition(
          {
            fieldId: "WEIGHT",
            operator: "is_empty",
            value: "",
            crossVisitId: "V2",
          },
          { V2_WEIGHT: "NA" },
          [fieldWithNullFlavor]
        )
      ).toBe(true);

      // Fallback to field's active nullFlavorValue
      expect(
        evaluateCondition(
          { fieldId: "f_weight", operator: "is_empty", value: "" },
          {},
          [fieldWithNullFlavor]
        )
      ).toBe(true);
    });
  });

  describe("lintForm", () => {
    it("flags duplicate IDs, missing variable names, and broken rule references", () => {
      const badForm: CRFForm = {
        id: "form_bad",
        name: "Invalid Form",
        domain: "BAD",
        description: "Test form with errors",
        version: "1.0",
        sections: [
          {
            id: "sec_1",
            title: "Sec 1",
            fields: [
              {
                id: "f_dup",
                variableName: "", // Missing variable name
                label: "Field 1",
                dataType: "text",
                columnSpan: 6,
                required: false,
              },
              {
                id: "f_dup", // Duplicate ID
                variableName: "VAR_DUP",
                label: "Field 2",
                dataType: "calculated", // Empty formula
                columnSpan: 6,
                required: false,
              },
            ],
          },
        ],
        rules: [
          {
            id: "r_broken",
            name: "Broken Rule",
            description: "Ref non-existent field",
            triggerFieldIds: ["non_existent_field"],
            targetFieldId: "f_dup",
            actionType: "raise_query",
            conditions: [
              { fieldId: "non_existent_field", operator: "eq", value: "x" },
            ],
            logicalOperator: "AND",
          },
        ],
      };

      const diagnostics = lintForm(badForm);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics.some((d) => d.id.startsWith("dup_id_"))).toBe(true);
      expect(diagnostics.some((d) => d.id.startsWith("missing_var_"))).toBe(
        true
      );
      expect(diagnostics.some((d) => d.id.startsWith("broken_rule_ref_"))).toBe(
        true
      );
    });
  });

  describe("tokenizeWithSpans & lintFormula", () => {
    it("handles empty formulas cleanly", () => {
      const result = lintFormula("", sampleFields);
      expect(result.isValid).toBe(true);
      expect(result.diagnostics[0]?.code).toBe("EMPTY_FORMULA");

      const sciNotation = lintFormula("1.5e-3 + 2.5E10", sampleFields);
      expect(sciNotation.isValid).toBe(true);

      const invalidToken = lintFormula("f_height # f_weight", sampleFields);
      expect(invalidToken.isValid).toBe(false);

      const sdtmFields: CRFField[] = [
        {
          id: "f_sdtm",
          variableName: "CUSTOM_HEIGHT",
          label: "Height",
          dataType: "number",
          columnSpan: 6,
          required: true,
          cdashMetadata: {
            domain: "VS",
            sdtmVariable: "HEIGHT",
            cdashLabel: "Height",
            core: "HR",
            acrfAnnotation: "VS.HEIGHT",
          },
        },
      ];
      const sdtmMapped = mapPresetToFormVariables("HEIGHT + 5", sdtmFields);
      expect(sdtmMapped).toContain("CUSTOM_HEIGHT");
    });

    it("tracks tokens with start and end character spans and bracket depths", () => {
      const formula = "round(f_height / 100, 2)";
      const res = lintFormula(formula, sampleFields);
      expect(res.isValid).toBe(true);
      expect(res.tokens.length).toBeGreaterThan(0);
      expect(res.tokens[0].type).toBe("FUNCTION");
      expect(res.tokens[0].value).toBe("round");
      expect(res.tokens[0].start).toBe(0);
      expect(res.tokens[0].end).toBe(5);
    });

    it("detects unclosed and unexpected parentheses", () => {
      const unclosed = lintFormula("f_height * (f_weight + 5", sampleFields);
      expect(unclosed.isValid).toBe(false);
      expect(
        unclosed.diagnostics.some((d) => d.code === "UNMATCHED_LPAREN")
      ).toBe(true);

      const extraClose = lintFormula("f_height * 2)", sampleFields);
      expect(extraClose.isValid).toBe(false);
      expect(
        extraClose.diagnostics.some((d) => d.code === "UNMATCHED_RPAREN")
      ).toBe(true);

      const emptyParen = lintFormula("f_height * ()", sampleFields);
      expect(emptyParen.isValid).toBe(false);
      expect(
        emptyParen.diagnostics.some((d) => d.code === "EMPTY_PARENTHESES")
      ).toBe(true);
    });

    it("flags consecutive binary operators and trailing operators", () => {
      const consecutive = lintFormula("f_height + * f_weight", sampleFields);
      expect(consecutive.isValid).toBe(false);
      expect(
        consecutive.diagnostics.some((d) => d.code === "CONSECUTIVE_OPERATORS")
      ).toBe(true);

      const trailing = lintFormula("f_height +", sampleFields);
      expect(trailing.isValid).toBe(false);
      expect(
        trailing.diagnostics.some((d) => d.code === "TRAILING_OPERATOR")
      ).toBe(true);
    });

    it("flags static division by zero", () => {
      const divZero = lintFormula("f_weight / 0", sampleFields);
      expect(divZero.isValid).toBe(false);
      expect(
        divZero.diagnostics.some((d) => d.code === "DIVISION_BY_ZERO")
      ).toBe(true);
    });

    it("flags unknown variables and non-numeric variable types", () => {
      const mixedFields: CRFField[] = [
        ...sampleFields,
        {
          id: "f_name",
          variableName: "SUBJNAME",
          label: "Subject Name",
          dataType: "text",
          columnSpan: 6,
          required: false,
        },
      ];

      const unknownVar = lintFormula("f_height + UNKNOWN_FIELD", mixedFields);
      expect(
        unknownVar.diagnostics.some((d) => d.code === "UNKNOWN_VARIABLE")
      ).toBe(true);

      const unknownFn = lintFormula("unknownFunc(f_height)", mixedFields);
      expect(
        unknownFn.diagnostics.some((d) => d.code === "UNKNOWN_FUNCTION")
      ).toBe(true);

      const nonNum = lintFormula("f_height + SUBJNAME", mixedFields);
      expect(
        nonNum.diagnostics.some((d) => d.code === "NON_NUMERIC_VARIABLE")
      ).toBe(true);
    });

    it("detects circular self-referencing dependencies", () => {
      const circular = lintFormula("f_bmi + 10", sampleFields, "f_bmi");
      expect(circular.isValid).toBe(false);
      expect(
        circular.diagnostics.some((d) => d.code === "CIRCULAR_REFERENCE")
      ).toBe(true);
    });

    it("validates function arity for mathematical operations", () => {
      const badSqrt = lintFormula("sqrt(10, 20)", sampleFields);
      expect(badSqrt.isValid).toBe(false);
      expect(badSqrt.diagnostics.some((d) => d.code === "INVALID_ARITY")).toBe(
        true
      );

      const badRound = lintFormula("round(10, 2, 3)", sampleFields);
      expect(badRound.isValid).toBe(false);
      expect(badRound.diagnostics.some((d) => d.code === "INVALID_ARITY")).toBe(
        true
      );

      const badClamp = lintFormula("clamp(10, 20)", sampleFields);
      expect(badClamp.isValid).toBe(false);
      expect(badClamp.diagnostics.some((d) => d.code === "INVALID_ARITY")).toBe(
        true
      );

      const badAbs = lintFormula("abs(10, 20)", sampleFields);
      expect(badAbs.isValid).toBe(false);
      expect(badAbs.diagnostics.some((d) => d.code === "INVALID_ARITY")).toBe(
        true
      );
    });

    it("tokenizes with exact spans and identifies functions vs identifiers", () => {
      const tokens = tokenizeWithSpans("max(f_height, f_weight) + 42");
      expect(tokens.length).toBe(8);
      expect(tokens[0].type).toBe("FUNCTION");
      expect(tokens[0].value).toBe("max");
      expect(tokens[1].type).toBe("LPAREN");
      expect(tokens[1].depth).toBe(0);
      expect(tokens[2].type).toBe("IDENTIFIER");
      expect(tokens[6].type).toBe("OP");
      expect(tokens[7].type).toBe("NUMBER");
    });

    it("provides clinical formula presets and maps preset variables to form fields", () => {
      expect(CLINICAL_FORMULA_PRESETS.length).toBeGreaterThanOrEqual(8);
      const mosteller = CLINICAL_FORMULA_PRESETS.find(
        (p) => p.id === "bsa_mosteller"
      );
      expect(mosteller).toBeDefined();

      expect(mapPresetToFormVariables("", [])).toBe("");
      expect(mapPresetToFormVariables("HEIGHT + WEIGHT", [])).toBe(
        "HEIGHT + WEIGHT"
      );

      const customFields: CRFField[] = [
        {
          id: "field_ht",
          variableName: "VS_HT",
          label: "Height in cm",
          dataType: "number",
          columnSpan: 6,
          required: true,
        },
        {
          id: "field_wt",
          variableName: "VS_WT",
          label: "Weight in kg",
          dataType: "number",
          columnSpan: 6,
          required: true,
        },
      ];

      const mapped = mapPresetToFormVariables(mosteller!.formula, customFields);
      expect(mapped).toContain("VS_HT");
      expect(mapped).toContain("VS_WT");

      const fuzzyFields: CRFField[] = [
        {
          id: "f_1",
          variableName: "MY_PATIENT_HEIGHT",
          label: "Height",
          dataType: "number",
          columnSpan: 6,
          required: true,
        },
      ];
      const fuzzyMapped = mapPresetToFormVariables(
        "round(HEIGHT, 0)",
        fuzzyFields
      );
      expect(fuzzyMapped).toContain("MY_PATIENT_HEIGHT");
    });

    it("evaluates direct clinical calculation functions (BMI, BSA, CrCl, QTc, RECIST)", () => {
      // calculateBMI
      expect(calculateBMI(80, 180)).toBe(24.7);
      expect(calculateBMI(80, 0)).toBeNull();
      expect(calculateBMI(80, -10)).toBeNull();

      // calculateMostellerBSA
      expect(calculateMostellerBSA(180, 80)).toBe(2.0);
      expect(calculateMostellerBSA(0, 80)).toBeNull();
      expect(calculateMostellerBSA(180, -5)).toBeNull();

      // calculateDuboisBSA
      expect(calculateDuboisBSA(180, 80)).toBe(2);
      expect(calculateDuboisBSA(-1, 80)).toBeNull();
      expect(calculateDuboisBSA(180, -1)).toBeNull();

      // calculateCockcroftGaultCrCl
      expect(calculateCockcroftGaultCrCl(60, 70, 1.0, false)).toBe(77.8);
      expect(calculateCockcroftGaultCrCl(60, 70, 1.0, true)).toBe(66.1);
      expect(calculateCockcroftGaultCrCl(60, 70, 0, false)).toBeNull();

      // calculateBazettQTc & calculateFridericiaQTc
      expect(calculateBazettQTc(400, 1.0)).toBe(400);
      expect(calculateBazettQTc(400, 0)).toBeNull();
      expect(calculateFridericiaQTc(400, 1.0)).toBe(400);
      expect(calculateFridericiaQTc(400, -0.5)).toBeNull();

      // calculateRecistSldChange
      expect(calculateRecistSldChange(100, 120)).toBe(20.0);
      expect(calculateRecistSldChange(100, 70)).toBe(-30.0);
      expect(calculateRecistSldChange(0, 50)).toBeNull();
    });
  });
});
