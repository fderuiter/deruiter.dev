// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  StudyProtocolEngine,
  collectFormIdentities,
  createFormVariant,
  findFormReferenceIssues,
  formUseKey,
  getFormUses,
  previewFormVariant,
  type CRFForm,
  type StudyProtocol,
} from "@/lib/crf";
import { buildSharedVitalsStudy } from "./form-variant-fixtures";

const PLACEBO_WK4 = formUseKey("v_wk4", "arm_placebo");

function effectiveForms(study: StudyProtocol, visitId: string, armId: string) {
  const matrix = StudyProtocolEngine.getArmAwareVisitMatrix(study);
  const arm = matrix.find((a) => a.armId === armId)!;
  return arm.visits.find((v) => v.visitId === visitId)!.assignedFormIds;
}

function fieldIds(form: CRFForm): Set<string> {
  return new Set(
    form.sections.flatMap((s) =>
      s.fields.flatMap((f) => [
        f.id,
        ...(f.repeatingColumns || []).map((c) => c.id),
      ])
    )
  );
}

describe("form variants (#675)", () => {
  it("lists every current use: the visit defaults and each arm following them", () => {
    const study = buildSharedVitalsStudy();
    const uses = getFormUses(study, "form_vs");

    expect(uses.map((u) => u.key)).toEqual([
      "v_wk2",
      "v_wk2::arm_active",
      "v_wk2::arm_placebo",
      "v_wk4",
      "v_wk4::arm_active",
      "v_wk4::arm_placebo",
    ]);
    expect(uses.filter((u) => u.kind === "arm_inherited")).toHaveLength(4);
    expect(uses[2].armName).toBe("Placebo");
  });

  it("reports arm-specific assignments as their own uses", () => {
    const study = buildSharedVitalsStudy();
    study.visits[1].armFormAssignments = {
      arm_active: ["form_vs"],
      arm_placebo: [],
    };

    const uses = getFormUses(study, "form_vs").filter(
      (u) => u.visitId === "v_wk4"
    );
    expect(uses.map((u) => [u.key, u.kind])).toEqual([
      ["v_wk4", "visit_default"],
      ["v_wk4::arm_active", "arm_override"],
    ]);
  });

  it("previews the selected change without touching the study", () => {
    const study = buildSharedVitalsStudy();
    const before = JSON.stringify(study);
    const preview = previewFormVariant(study, "form_vs", {
      selectedUseKeys: [PLACEBO_WK4],
      variantName: "Vital Signs (Placebo Wk4)",
    });

    expect(preview.error).toBeUndefined();
    expect(preview.movedCount).toBe(1);
    expect(preview.remainingCount).toBe(5);
    const placebo = preview.changes.find((c) => c.use.key === PLACEBO_WK4)!;
    expect(placebo.outcome).toBe("moves_to_variant");
    expect(placebo.createsArmAssignment).toBe(true);
    expect(
      preview.changes.filter((c) => c.outcome === "stays_on_source")
    ).toHaveLength(5);
    expect(JSON.stringify(study)).toBe(before);
  });

  it("creates a variant with distinct nested identities and references that resolve to its own fields", () => {
    const study = buildSharedVitalsStudy();
    const result = createFormVariant(study, "form_vs", {
      selectedUseKeys: [PLACEBO_WK4],
      variantName: "Vital Signs (Placebo Wk4)",
    });

    expect(result.error).toBeUndefined();
    const variant = result.variant!;
    const sourceIds = new Set(study.forms.flatMap(collectFormIdentities));
    const variantIds = collectFormIdentities(variant);

    // Form, sections, fields, repeating columns, rules and condition groups.
    expect(variantIds).toHaveLength(
      collectFormIdentities(study.forms[1]).length
    );
    expect(new Set(variantIds).size).toBe(variantIds.length);
    for (const id of variantIds) expect(sourceIds.has(id)).toBe(false);
    for (const id of collectFormIdentities(study.forms[1])) {
      expect(result.identityMap![id]).toBeDefined();
    }

    // Variable names are kept; every rule reference points at the variant's own fields.
    const own = fieldIds(variant);
    const [bpRule, mapRule] = variant.rules;
    expect(own.has(bpRule.targetFieldId)).toBe(true);
    bpRule.triggerFieldIds.forEach((id) => expect(own.has(id)).toBe(true));
    expect(own.has(bpRule.conditions[0].compareFieldId!)).toBe(true);
    expect(own.has(bpRule.conditionGroups![0].conditions[0].fieldId)).toBe(
      true
    );
    expect(mapRule.triggerFieldIds).toEqual(["SYSBP", "DIABP"]);
    const sys = result.identityMap!.fld_sys;
    const dia = result.identityMap!.fld_dia;
    expect(mapRule.formulaExpression).toBe(`(${sys} + 2 * ${dia}) / 3`);
    const mapField = variant.sections[0].fields.find(
      (f) => f.variableName === "MAP"
    )!;
    expect(mapField.calculationFormula).toBe(`(${sys} + 2 * ${dia}) / 3`);
    expect(findFormReferenceIssues(result.study, variant)).toEqual([]);
    expect(variant.sections[0].fields.map((f) => f.variableName)).toEqual([
      "SYSBP",
      "DIABP",
      "MAP",
      "VSREPS",
    ]);
  });

  it("demonstrates two shared visits, one variant, and an arm-specific assignment", () => {
    const study = buildSharedVitalsStudy();
    const { study: next, variant } = createFormVariant(study, "form_vs", {
      selectedUseKeys: [PLACEBO_WK4],
      variantName: "Vital Signs (Placebo Wk4)",
    });

    const wk2 = next.visits.find((v) => v.id === "v_wk2")!;
    const wk4 = next.visits.find((v) => v.id === "v_wk4")!;
    expect(wk2).toEqual(study.visits[0]);
    expect(wk4.assignedFormIds).toEqual(["form_vs"]);
    expect(wk4.armFormAssignments).toEqual({ arm_placebo: [variant!.id] });

    expect(effectiveForms(next, "v_wk2", "arm_active")).toContain("form_vs");
    expect(effectiveForms(next, "v_wk2", "arm_placebo")).toContain("form_vs");
    expect(effectiveForms(next, "v_wk4", "arm_active")).toEqual(["form_vs"]);
    expect(effectiveForms(next, "v_wk4", "arm_placebo")).toEqual([variant!.id]);

    expect(getFormUses(next, "form_vs")).toHaveLength(5);
    expect(getFormUses(next, variant!.id).map((u) => u.key)).toEqual([
      PLACEBO_WK4,
    ]);
    expect(next.auditTrail?.at(-1)?.actionType).toBe("FORM_VARIANT_CREATE");
  });

  it("keeps subsequent edits independent in both directions", () => {
    const study = buildSharedVitalsStudy();
    const { study: s1, variant } = createFormVariant(study, "form_vs", {
      selectedUseKeys: [PLACEBO_WK4],
    });
    expect(variant!.name).toBe("Vital Signs (Variant)");
    const variantSys = variant!.sections[0].fields[0].id;

    const s2 = StudyProtocolEngine.updateField(s1, variant!.id, variantSys, {
      label: "Systolic BP (seated, placebo)",
    }).study;
    const s3 = StudyProtocolEngine.updateField(s2, "form_vs", "fld_sys", {
      unit: "kPa",
    }).study;

    const source = s3.forms.find((f) => f.id === "form_vs")!;
    const copy = s3.forms.find((f) => f.id === variant!.id)!;
    expect(source.sections[0].fields[0].label).toBe("Systolic BP");
    expect(source.sections[0].fields[0].unit).toBe("kPa");
    expect(copy.sections[0].fields[0].label).toBe(
      "Systolic BP (seated, placebo)"
    );
    expect(copy.sections[0].fields[0].unit).toBe("mmHg");
  });

  it("pins unselected arms to the shared form when their visit default moves", () => {
    const study = buildSharedVitalsStudy();
    const {
      study: next,
      variant,
      preview,
    } = createFormVariant(study, "form_vs", {
      selectedUseKeys: ["v_wk4", "v_wk4::arm_active"],
    });

    const pinned = preview.changes.find((c) => c.use.key === PLACEBO_WK4)!;
    expect(pinned.outcome).toBe("stays_on_source");
    expect(pinned.createsArmAssignment).toBe(true);

    const wk4 = next.visits.find((v) => v.id === "v_wk4")!;
    expect(wk4.assignedFormIds).toEqual([variant!.id]);
    expect(wk4.armFormAssignments).toEqual({ arm_placebo: ["form_vs"] });
    expect(effectiveForms(next, "v_wk4", "arm_active")).toEqual([variant!.id]);
    expect(effectiveForms(next, "v_wk4", "arm_placebo")).toEqual(["form_vs"]);
  });

  it("reassigns explicit arm assignments and legacy form lists in place", () => {
    const study = buildSharedVitalsStudy();
    study.visits[0].formIds = ["form_dm", "form_vs"];
    study.visits[1].armFormAssignments = {
      arm_active: ["form_vs"],
      arm_placebo: ["form_vs"],
    };
    const { study: next, variant } = createFormVariant(study, "form_vs", {
      selectedUseKeys: [
        "v_wk2",
        "v_wk2::arm_active",
        "v_wk2::arm_placebo",
        "v_wk4::arm_active",
      ],
    });

    expect(next.visits[0].assignedFormIds).toEqual(["form_dm", variant!.id]);
    expect(next.visits[0].formIds).toEqual(["form_dm", variant!.id]);
    expect(next.visits[1].armFormAssignments).toEqual({
      arm_active: [variant!.id],
      arm_placebo: ["form_vs"],
    });
  });

  it.each([
    [[], "Select at least one use"],
    [
      [
        "v_wk2",
        "v_wk2::arm_active",
        "v_wk2::arm_placebo",
        "v_wk4",
        "v_wk4::arm_active",
        PLACEBO_WK4,
      ],
      "Every use is selected",
    ],
    [["v_missing"], "is not a current use"],
  ])("rejects selection %j atomically", (keys, message) => {
    const study = buildSharedVitalsStudy();
    const result = createFormVariant(study, "form_vs", {
      selectedUseKeys: keys,
    });
    expect(result.error).toContain(message);
    expect(result.study).toBe(study);
    expect(result.variant).toBeUndefined();
  });

  it("rejects an empty or duplicate variant name and an unknown form", () => {
    const study = buildSharedVitalsStudy();
    expect(
      createFormVariant(study, "form_vs", {
        selectedUseKeys: [PLACEBO_WK4],
        variantName: "demographics",
      }).error
    ).toContain("already exists");
    expect(
      createFormVariant(study, "form_vs", {
        selectedUseKeys: [PLACEBO_WK4],
        variantName: "  ",
      }).error
    ).toBe("Name the variant.");
    expect(
      createFormVariant(study, "form_nope", { selectedUseKeys: [PLACEBO_WK4] })
        .error
    ).toContain("not found");
  });

  it("undo removes the variant and restores the original uses in one step", () => {
    const study = buildSharedVitalsStudy();
    const result = createFormVariant(study, "form_vs", {
      selectedUseKeys: ["v_wk4", "v_wk4::arm_active"],
    });
    // A later unrelated edit survives the undo; a later reuse of the variant is pruned.
    const later = StudyProtocolEngine.assignVisitForms(
      { ...result.study, studyName: "Renamed" },
      "v_wk2",
      [result.variant!.id]
    ).study;

    const restored = result.undo!(later);
    expect(restored.studyName).toBe("Renamed");
    expect(restored.forms.map((f) => f.id)).toEqual(["form_dm", "form_vs"]);
    expect(restored.visits).toEqual(study.visits);
    expect(getFormUses(restored, "form_vs")).toEqual(
      getFormUses(study, "form_vs")
    );
  });
});
