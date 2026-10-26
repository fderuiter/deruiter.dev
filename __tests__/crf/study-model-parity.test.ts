// @vitest-environment node
/**
 * CRF Studio has one study model (#2927 item 8): the interfaces in
 * `lib/crf/types.ts` and the Zod schema in `lib/crf/universal-schema.ts`
 * describe the same document. The compile-time checks fail `npm run
 * typecheck` when a field is added to one and not the other, and the
 * round trips catch a schema that would strip or reject what the studio
 * itself writes.
 */
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  AstConditionSchema,
  AuditTrailEntrySchema,
  BiomedicalConceptPropertySchema,
  BiomedicalConceptSchema,
  CdashVariableMetadataSchema,
  CodelistDefinitionSchema,
  CodelistOptionSchema,
  ConditionGroupSchema,
  EDCQuerySchema,
  EdcSimulationStateSchema,
  EditCheckRuleSchema,
  ElectronicSignatureSchema,
  ScenarioRunEvidenceSchema,
  StudyArmSchema,
  StudyCohortSchema,
  StudyEpochSchema,
  StudyLibraryUseSchema,
  StudyProvenanceSchema,
  TestScenarioSchema,
  UniversalCrfBrandingSchema,
  UniversalCrfFieldSchema,
  UniversalCrfFormSchema,
  UniversalCrfProtocolSchema,
  UniversalCrfSectionSchema,
  UniversalCrfVisitSchema,
  ATOMIC_SLASH_COMMANDS,
  CLINICAL_SMART_BLOCKS,
  exportUniversalCrfJson,
  getStudyPresetsSync,
  instantiateAtomicField,
  instantiateSmartBlock,
  parseUniversalCrf,
  validateUniversalCrf,
} from "@/lib/crf";
import type {
  AstCondition,
  ConditionGroup,
  AuditTrailEntry,
  BiomedicalConcept,
  BiomedicalConceptProperty,
  CdashVariableMetadata,
  CodelistDefinition,
  CodelistOption,
  CRFField,
  CRFForm,
  CRFSection,
  EDCQuery,
  EdcSimulationState,
  EditCheckRule,
  ElectronicSignature,
  ScenarioRunEvidence,
  StudyArm,
  StudyBranding,
  StudyCohort,
  StudyEpoch,
  StudyLibraryUse,
  StudyProtocol,
  StudyProvenance,
  StudyVisit,
  TestScenario,
} from "@/lib/crf";

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Out<S extends z.ZodType> = z.output<S>;
type In<S extends z.ZodType> = z.input<S>;
type Parity<T, S extends z.ZodType> = [
  [Out<S>] extends [T] ? true : "schema output is not a T",
  [T] extends [In<S>] ? true : "a T does not parse",
  Equals<keyof T, keyof Out<S>> extends true
    ? true
    : Exclude<keyof T, keyof Out<S>> | Exclude<keyof Out<S>, keyof T>,
];
const same = <T, S extends z.ZodType>(ok: Parity<T, S>) => ok;
// validateUniversalCrf fills a visit's OID and the protocol number and name
// when a file omits them, so for these two the output check is the
// function's own return type rather than the raw schema output.
const covered = <T, S extends z.ZodType>(
  ok: [Parity<T, S>[1], Parity<T, S>[2]]
) => ok;

// Each tuple is [schema output is a T, every T parses, same keys]. A key
// missing from the schema shows up as the type error's string literal.
same<CodelistOption, typeof CodelistOptionSchema>([true, true, true]);
same<CodelistDefinition, typeof CodelistDefinitionSchema>([true, true, true]);
same<CdashVariableMetadata, typeof CdashVariableMetadataSchema>([
  true,
  true,
  true,
]);
same<AstCondition, typeof AstConditionSchema>([true, true, true]);
same<EditCheckRule, typeof EditCheckRuleSchema>([true, true, true]);
same<StudyArm, typeof StudyArmSchema>([true, true, true]);
same<StudyEpoch, typeof StudyEpochSchema>([true, true, true]);
same<StudyCohort, typeof StudyCohortSchema>([true, true, true]);
same<BiomedicalConceptProperty, typeof BiomedicalConceptPropertySchema>([
  true,
  true,
  true,
]);
same<BiomedicalConcept, typeof BiomedicalConceptSchema>([true, true, true]);
same<CRFField, typeof UniversalCrfFieldSchema>([true, true, true]);
same<CRFSection, typeof UniversalCrfSectionSchema>([true, true, true]);
same<CRFForm, typeof UniversalCrfFormSchema>([true, true, true]);
covered<StudyVisit, typeof UniversalCrfVisitSchema>([true, true]);
same<StudyBranding, typeof UniversalCrfBrandingSchema>([true, true, true]);
same<TestScenario, typeof TestScenarioSchema>([true, true, true]);
same<ScenarioRunEvidence, typeof ScenarioRunEvidenceSchema>([true, true, true]);
same<AuditTrailEntry, typeof AuditTrailEntrySchema>([true, true, true]);
same<ElectronicSignature, typeof ElectronicSignatureSchema>([true, true, true]);
same<EDCQuery, typeof EDCQuerySchema>([true, true, true]);
same<EdcSimulationState, typeof EdcSimulationStateSchema>([true, true, true]);
same<StudyProvenance, typeof StudyProvenanceSchema>([true, true, true]);
same<StudyLibraryUse, typeof StudyLibraryUseSchema>([true, true, true]);
covered<StudyProtocol, typeof UniversalCrfProtocolSchema>([true, true]);
same<ConditionGroup, typeof ConditionGroupSchema>([true, true, true]);

const formulaRule: EditCheckRule = {
  id: "rule_bmi",
  name: "Derive BMI",
  description: "Calculated from height and weight",
  triggerFieldIds: ["f_weight", "f_height"],
  actionType: "set_value",
  targetFieldId: "f_bmi",
  logicalOperator: "AND",
  conditions: [],
  formulaExpression: "f_weight / ((f_height / 100) * (f_height / 100))",
};

const groupedRule: EditCheckRule = {
  id: "rule_grouped",
  name: "Diastolic above systolic",
  description: "(A AND B) OR C",
  triggerFieldIds: ["f_sys", "f_dia"],
  actionType: "raise_query",
  targetFieldId: "f_dia",
  logicalOperator: "AND",
  conditions: [{ fieldId: "f_dia", operator: "gt", value: 0 }],
  conditionGroups: [
    {
      id: "g1",
      logicalOperator: "AND",
      conditions: [
        {
          fieldId: "f_dia",
          operator: "gte",
          value: "",
          compareFieldId: "f_sys",
        },
        { fieldId: "f_sys", operator: "is_not_empty", value: "" },
      ],
    },
    { id: "g2", logicalOperator: "OR", conditions: [] },
  ],
  groupLogicalOperator: "OR",
  querySeverity: "error",
  queryMessage: "Diastolic pressure is at or above systolic.",
};

const unsupportedRule: EditCheckRule = {
  id: "rule_imported",
  name: "Imported expression",
  description: "",
  triggerFieldIds: ["f_sys"],
  actionType: "raise_query",
  targetFieldId: "f_sys",
  logicalOperator: "AND",
  conditions: [],
  unsupportedExpression: {
    raw: { xpath: "//ItemData[@ItemOID='SYSBP'] > 200" },
    reason: "neither conditions nor conditionGroups matched",
  },
};

function studyWith(rules: EditCheckRule[]): StudyProtocol {
  const base = getStudyPresetsSync()[0].study;
  return {
    ...base,
    forms: base.forms.map((form, i) =>
      i === 0 ? { ...form, rules: [...form.rules, ...rules] } : form
    ),
    provenance: {
      derivedFromBaselineId: "baseline_1",
      derivedFromVersionTag: "v1.2.0",
      restoredAt: "2026-10-26T00:00:00.000Z",
    },
  };
}

describe("one CRF study model (#2927 item 8)", () => {
  it.each(getStudyPresetsSync().map((p) => [p.id, p.study] as const))(
    "preset %s reopens from native JSON without losing a key",
    (_id, preset) => {
      const json = exportUniversalCrfJson(preset);
      expect(parseUniversalCrf(json)).toMatchObject(JSON.parse(json));
    }
  );

  it("keeps formula rules, which carry no conditions", () => {
    const result = validateUniversalCrf(studyWith([formulaRule]));
    expect(result.errors).toEqual([]);
    expect(result.study?.forms[0].rules).toContainEqual(formulaRule);
  });

  it("keeps condition groups, field comparisons and empty groups", () => {
    const reopened = parseUniversalCrf(
      exportUniversalCrfJson(studyWith([groupedRule]))
    );
    expect(reopened.forms[0].rules).toContainEqual(groupedRule);
  });

  it("keeps an imported expression the evaluator could not map", () => {
    const reopened = parseUniversalCrf(
      exportUniversalCrfJson(studyWith([unsupportedRule]))
    );
    expect(reopened.forms[0].rules).toContainEqual(unsupportedRule);
  });

  it("keeps the baseline version tag a restored study came from", () => {
    const reopened = parseUniversalCrf(exportUniversalCrfJson(studyWith([])));
    expect(reopened.provenance?.derivedFromVersionTag).toBe("v1.2.0");
  });

  it.each(CLINICAL_SMART_BLOCKS.map((b) => [b.id] as const))(
    "smart block %s inserts fields and rules a native file can hold",
    (id) => {
      const { section, rules } = instantiateSmartBlock(id);
      expect(
        UniversalCrfSectionSchema.safeParse(section).error
      ).toBeUndefined();
      for (const rule of rules) {
        expect(EditCheckRuleSchema.safeParse(rule).error).toBeUndefined();
      }
    }
  );

  it.each(ATOMIC_SLASH_COMMANDS.map((c) => [c.id] as const))(
    "slash command %s inserts a field a native file can hold",
    (id) => {
      const field = instantiateAtomicField(id);
      expect(UniversalCrfFieldSchema.safeParse(field).error).toBeUndefined();
    }
  );
});
