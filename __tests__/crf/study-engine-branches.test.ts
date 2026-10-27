// @vitest-environment node
import { describe, it, expect } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import { StudyProtocolEngine, appendProtocolAuditEntry } from "@/lib/crf";
import type {
  CRFField,
  CRFForm,
  EditCheckRule,
  StudyProtocol,
  StudyVisit,
} from "@/lib/crf/types";

const REVIEWER = { name: "Dr. Reviewer", role: "Medical Monitor" } as const;

function field(
  id: string,
  variableName: string,
  extra: Partial<CRFField> = {}
): CRFField {
  return {
    id,
    variableName,
    label: `${variableName} label`,
    dataType: "number",
    columnSpan: 6,
    required: false,
    ...extra,
  };
}

function rule(id: string, extra: Partial<EditCheckRule> = {}): EditCheckRule {
  return {
    id,
    name: `Rule ${id}`,
    description: `Rule ${id}`,
    triggerFieldIds: [],
    actionType: "raise_query",
    targetFieldId: "",
    conditions: [],
    logicalOperator: "AND",
    ...extra,
  };
}

/**
 * A custom "XX" form with two sections, a calculated field, a grid with a
 * calculated repeating column, and rules that reference AVAR in every way
 * findFieldReferences knows about.
 */
function richForm(): CRFForm {
  return {
    id: "form_xx",
    name: "Rich Form",
    domain: "XX",
    description: "fixture",
    version: "1.0",
    sections: [
      {
        id: "sec_a",
        title: "Section A",
        fields: [
          field("fld_a", "AVAR"),
          field("fld_b", "BVAR", { calculationFormula: "AVAR * 2" }),
        ],
      },
      {
        id: "sec_b",
        title: "Section B",
        fields: [
          field("fld_g", "GRID", {
            dataType: "repeating_table",
            repeatingColumns: [
              field("rc_1", "RCONE", { calculationFormula: "AVAR + 1" }),
              field("rc_2", "RCTWO"),
            ],
          }),
          field("fld_c", "CVAR"),
        ],
      },
    ],
    rules: [
      rule("r_target", {
        targetFieldId: "fld_a",
        triggerFieldIds: ["fld_a"],
      }),
      rule("r_cond", {
        targetFieldId: "fld_c",
        triggerFieldIds: ["fld_c"],
        conditions: [
          {
            fieldId: "fld_c",
            operator: "gt",
            value: 1,
            compareFieldId: "AVAR",
          },
        ],
      }),
      rule("r_group", {
        targetFieldId: "fld_c",
        triggerFieldIds: ["fld_c"],
        conditionGroups: [
          {
            id: "g1",
            logicalOperator: "AND",
            conditions: [{ fieldId: "AVAR", operator: "eq", value: 3 }],
          },
          {
            id: "g2",
            logicalOperator: "OR",
            conditions: [{ fieldId: "fld_c", operator: "eq", value: 4 }],
          },
        ],
      }),
      rule("r_cross", {
        targetFieldId: "fld_c",
        triggerFieldIds: ["fld_c"],
        conditions: [
          {
            fieldId: "AVAR",
            crossVisitId: "v_screening",
            operator: "neq",
            value: 0,
            compareFieldId: "fld_a",
          },
        ],
      }),
      rule("r_formula", {
        targetFieldId: "fld_b",
        triggerFieldIds: ["fld_b"],
        actionType: "set_value",
        formulaExpression: "AVAR / 10",
      }),
    ],
  };
}

function richStudy(): StudyProtocol {
  return StudyProtocolEngine.createInitialStudy({
    protocolNumber: "SE-BR-1",
    forms: [richForm()],
  });
}

describe("appendProtocolAuditEntry actor handling", () => {
  it("defaults to the System Auditor for blank string actors", () => {
    const s = appendProtocolAuditEntry(richStudy(), {
      actionType: "X",
      actor: "   ",
    });
    const entry = s.auditTrail!.at(-1)!;
    expect(entry.changedBy).toBe("System Auditor");
    expect(entry.userRole).toBe("System Auditor");
    expect(entry.subjectId).toBe("PROTOCOL");
    expect(entry.previousValue).toBeNull();
    expect(entry.newValue).toBeNull();
    expect(entry.reasonForChange).toBe("Protocol mutation: X");
    expect(entry).not.toHaveProperty("diagnosticId");
    expect(entry).not.toHaveProperty("details");
  });

  it("trims string actors and accepts partial actor objects", () => {
    const named = appendProtocolAuditEntry(richStudy(), {
      actionType: "X",
      actor: "  Alice  ",
    });
    expect(named.auditTrail!.at(-1)!.changedBy).toBe("Alice");

    const roleOnly = appendProtocolAuditEntry(richStudy(), {
      actionType: "X",
      actor: { role: "Monitor" },
    });
    expect(roleOnly.auditTrail!.at(-1)!.changedBy).toBe("System Auditor");
    expect(roleOnly.auditTrail!.at(-1)!.userRole).toBe("Monitor");
  });

  it("deep-clones values and keeps diagnostics and details", () => {
    const details = { nested: { a: 1 } };
    const s = appendProtocolAuditEntry(richStudy(), {
      actionType: "X",
      diagnosticId: "diag_1",
      details,
      previousValue: { v: 1 },
    });
    const entry = s.auditTrail!.at(-1)!;
    expect(entry.diagnosticId).toBe("diag_1");
    expect(entry.details).toEqual(details);
    expect(entry.details).not.toBe(details);
    expect(entry.previousValue).toEqual({ v: 1 });
  });

  it("appends to an existing trail without mutating it", () => {
    const first = appendProtocolAuditEntry(richStudy(), { actionType: "A" });
    const second = appendProtocolAuditEntry(first, { actionType: "B" });
    expect(first.auditTrail).toHaveLength(1);
    expect(second.auditTrail!.map((e) => e.actionType)).toEqual(["A", "B"]);
  });
});

describe("review threads", () => {
  it("rejects empty comments, blank reviewers and unknown fields", () => {
    const s = richStudy();
    expect(() =>
      StudyProtocolEngine.addReviewComment(s, "fld_a", "   ")
    ).toThrow("Review comment cannot be empty.");
    expect(() =>
      StudyProtocolEngine.addReviewComment(s, "fld_a", "ok", {
        name: "  ",
        role: "Data Manager",
      })
    ).toThrow("Reviewer name is required.");
    expect(() =>
      StudyProtocolEngine.addReviewComment(s, "fld_missing", "hi")
    ).toThrow("Field 'fld_missing' was not found.");
  });

  it("appends to an existing thread, even after its field is deleted", () => {
    const s0 = richStudy();
    const { study: s1, thread } = StudyProtocolEngine.addReviewComment(
      s0,
      "fld_c",
      "first",
      REVIEWER,
      "2026-01-01T00:00:00.000Z"
    );
    const removed = StudyProtocolEngine.removeFieldWithCascade(
      s1,
      "XX",
      "fld_c",
      undefined,
      { name: "  ", role: "Data Manager" }
    ).study;
    const deletedThread = removed.reviewThreads![0];
    expect(StudyProtocolEngine.isReviewTargetDeleted(deletedThread)).toBe(true);
    // A blank reviewer name falls back to the default review actor.
    expect(deletedThread.events.at(-1)!.author.name).toBe("Study author");

    const { study: s2, thread: t2 } = StudyProtocolEngine.addReviewComment(
      removed,
      "fld_c",
      "  second  "
    );
    expect(t2.id).toBe(thread.id);
    expect(s2.reviewThreads).toHaveLength(1);
    expect(t2.events.map((e) => e.type)).toEqual([
      "comment",
      "target-deleted",
      "comment",
    ]);
    expect(t2.events.at(-1)).toMatchObject({ body: "second" });
  });

  it("status changes are idempotent and validate the reviewer", () => {
    const { study, thread } = StudyProtocolEngine.addReviewComment(
      richStudy(),
      "fld_a",
      "check"
    );
    expect(
      StudyProtocolEngine.setReviewThreadStatus(study, "missing", "resolved")
    ).toBe(study);
    expect(
      StudyProtocolEngine.setReviewThreadStatus(study, thread.id, "open")
    ).toBe(study);
    expect(() =>
      StudyProtocolEngine.setReviewThreadStatus(study, thread.id, "resolved", {
        name: " ",
        role: "Data Manager",
      })
    ).toThrow("Reviewer name is required.");

    const resolved = StudyProtocolEngine.setReviewThreadStatus(
      study,
      thread.id,
      "resolved",
      REVIEWER
    );
    expect(StudyProtocolEngine.countOpenReviewThreads(resolved)).toBe(0);
    const reopened = StudyProtocolEngine.setReviewThreadStatus(
      resolved,
      thread.id,
      "open"
    );
    expect(reopened.reviewThreads![0].events.at(-1)!.type).toBe("reopened");
    expect(StudyProtocolEngine.countOpenReviewThreads(reopened)).toBe(1);
  });

  it("countOpenReviewThreads handles studies without threads", () => {
    expect(StudyProtocolEngine.countOpenReviewThreads(richStudy())).toBe(0);
  });

  it("recordReviewTargetChange records renames only when something changed", () => {
    const s0 = richStudy();
    expect(StudyProtocolEngine.recordReviewTargetChange(s0, "fld_a")).toBe(s0);

    const { study } = StudyProtocolEngine.addReviewComment(s0, "fld_a", "hi");
    // Unchanged field -> no event.
    expect(StudyProtocolEngine.recordReviewTargetChange(study, "fld_a")).toBe(
      study
    );

    const updated = StudyProtocolEngine.updateField(study, "XX", "fld_a", {
      label: "New label",
    }).study;
    const recorded = StudyProtocolEngine.recordReviewTargetChange(
      updated,
      "fld_a",
      REVIEWER
    );
    const t = recorded.reviewThreads![0];
    expect(t.target.label).toBe("New label");
    expect(t.events.at(-1)).toMatchObject({
      type: "target-renamed",
      previousLabel: "AVAR label",
      nextLabel: "New label",
    });

    // A thread whose field has since vanished is left alone.
    const gone = {
      ...study,
      forms: [],
    };
    expect(StudyProtocolEngine.recordReviewTargetChange(gone, "fld_a")).toBe(
      gone
    );
  });
});

describe("form removal, restoration and duplication", () => {
  function armedStudy(): StudyProtocol {
    const base = richStudy();
    const visits: StudyVisit[] = base.visits.map((v, i) => ({
      ...v,
      assignedFormIds: i === 0 ? ["form_xx"] : [],
      formIds: i === 0 ? ["form_xx"] : ["other"],
      armFormAssignments:
        i === 0 ? { arm_a: ["form_xx"], arm_ghost: ["form_xx"] } : undefined,
    }));
    return {
      ...base,
      visits,
      arms: [{ id: "arm_a", name: "Arm A", type: "Experimental" }],
    };
  }

  it("previewFormRemoval returns nothing for unknown forms", () => {
    expect(StudyProtocolEngine.previewFormRemoval(richStudy(), "ZZ")).toEqual({
      affectedVisits: [],
      affectedArms: [],
    });
  });

  it("removeForm is a no-op for unknown forms", () => {
    const s = richStudy();
    const res = StudyProtocolEngine.removeForm(s, "ZZ");
    expect(res.study).toBe(s);
    expect(res.removedForm).toBeUndefined();
  });

  it("removeForm prunes formIds and arm assignments and reports synthetic arms", () => {
    const s = armedStudy();
    const res = StudyProtocolEngine.removeForm(s, "XX", "Remover");
    expect(res.affectedArms!.map((a) => a.id).sort()).toEqual([
      "arm_a",
      "arm_ghost",
    ]);
    // Unknown arm ids are synthesised from the assignment key.
    expect(res.affectedArms!.find((a) => a.id === "arm_ghost")).toEqual({
      id: "arm_ghost",
      name: "arm_ghost",
      type: "Experimental",
    });
    const v0 = res.study.visits[0];
    expect(v0.formIds).toEqual([]);
    expect(v0.armFormAssignments).toEqual({ arm_a: [], arm_ghost: [] });
    expect(res.study.visits[1].formIds).toEqual(["other"]);
    expect(res.study.auditTrail!.at(-1)!.changedBy).toBe("Remover");

    const restored = res.undo!(res.study);
    expect(restored.forms.map((f) => f.id)).toEqual(["form_xx"]);
    expect(restored.visits[0].assignedFormIds).toEqual(["form_xx"]);
    expect(restored.visits[0].formIds).toEqual(["form_xx"]);
    expect(restored.visits[0].armFormAssignments).toEqual({
      arm_a: ["form_xx"],
      arm_ghost: ["form_xx"],
    });
  });

  it("restoreForm does not duplicate a form that already exists", () => {
    const s = richStudy();
    const restored = StudyProtocolEngine.restoreForm(s, s.forms[0]);
    expect(restored.forms).toHaveLength(1);
  });

  it("restoreForm appends when the original index is out of range", () => {
    const { study } = StudyProtocolEngine.addForm(
      StudyProtocolEngine.createInitialStudy(),
      "VS"
    );
    const form = richForm();
    const restored = StudyProtocolEngine.restoreForm(study, form, [], 99);
    expect(restored.forms.at(-1)!.id).toBe("form_xx");
    const negative = StudyProtocolEngine.restoreForm(study, form, [], -1);
    expect(negative.forms.at(-1)!.id).toBe("form_xx");
    const front = StudyProtocolEngine.restoreForm(study, form, [], 0);
    expect(front.forms[0].id).toBe("form_xx");
  });

  it("restoreForm accepts a StudyVisit[] snapshot", () => {
    const original = armedStudy();
    const { study: removed } = StudyProtocolEngine.removeForm(original, "XX");
    // Strip formIds/arm assignments on the current visits entirely.
    const bare: StudyProtocol = {
      ...removed,
      visits: removed.visits.map((v) => ({
        id: v.id,
        oid: v.oid,
        name: v.name,
        visitType: v.visitType,
        targetDay: v.targetDay,
        windowBefore: v.windowBefore,
        windowAfter: v.windowAfter,
        assignedFormIds: v.assignedFormIds,
      })),
    };
    const restored = StudyProtocolEngine.restoreForm(
      bare,
      richForm(),
      original.visits
    );
    const v0 = restored.visits[0];
    expect(v0.assignedFormIds).toEqual(["form_xx"]);
    expect(v0.formIds).toEqual(["form_xx"]);
    expect(v0.armFormAssignments).toEqual({
      arm_a: ["form_xx"],
      arm_ghost: ["form_xx"],
    });
    // The second visit never held the form.
    expect(restored.visits[1].assignedFormIds).toEqual([]);
    expect(restored.visits[1].armFormAssignments).toBeUndefined();
  });

  it("restoreForm skips visits missing from the snapshot", () => {
    const s = richStudy();
    const restored = StudyProtocolEngine.restoreForm(
      { ...s, forms: [] },
      richForm(),
      [{ visitId: "unknown", assigned: true }]
    );
    expect(restored.visits).toEqual(s.visits);
  });

  it("restoreForm with assignment snapshots is idempotent on already-assigned visits", () => {
    const s = armedStudy();
    const restored = StudyProtocolEngine.restoreForm(s, s.forms[0], [
      {
        visitId: s.visits[0].id,
        assigned: true,
        inFormIds: true,
        armAssignments: ["arm_a"],
      },
      {
        visitId: s.visits[1].id,
        assigned: false,
        inFormIds: true,
        armAssignments: ["arm_b"],
      },
    ]);
    expect(restored.visits[0].assignedFormIds).toEqual(["form_xx"]);
    expect(restored.visits[0].formIds).toEqual(["form_xx"]);
    expect(restored.visits[0].armFormAssignments!.arm_a).toEqual(["form_xx"]);
    expect(restored.visits[1].formIds).toEqual(["other", "form_xx"]);
    expect(restored.visits[1].armFormAssignments).toEqual({
      arm_b: ["form_xx"],
    });
  });

  it("duplicateForm reports unknown forms", () => {
    const res = StudyProtocolEngine.duplicateForm(richStudy(), "ZZ");
    expect(res.error).toBe("Form 'ZZ' not found in protocol.");
    expect(res.duplicatedForm).toBeUndefined();
  });

  it("duplicateForm remaps ids, variables, grid columns, groups and formulas", () => {
    const s = richStudy();
    const res = StudyProtocolEngine.duplicateForm(s, "XX", {
      customName: "Copy",
    });
    const copy = res.duplicatedForm!;
    expect(copy.name).toBe("Copy");
    expect(copy.domain).toBe("XX");
    expect(copy.id).not.toBe("form_xx");

    const vars = copy.sections.flatMap((sec) =>
      sec.fields.map((f) => f.variableName)
    );
    expect(vars).not.toContain("AVAR");
    const grid = copy.sections[1].fields[0];
    expect(grid.repeatingColumns!.map((c) => c.variableName)).not.toContain(
      "RCONE"
    );

    const newA = copy.sections[0].fields[0];
    const newB = copy.sections[0].fields[1];
    expect(newB.calculationFormula).toBe(`${newA.variableName} * 2`);

    const targetRule = copy.rules.find((r) => r.name === "Rule r_target")!;
    expect(targetRule.targetFieldId).toBe(newA.id);
    expect(targetRule.triggerFieldIds).toEqual([newA.id]);

    const condRule = copy.rules.find((r) => r.name === "Rule r_cond")!;
    expect(condRule.conditions[0].compareFieldId).toBe(newA.id);

    const groupRule = copy.rules.find((r) => r.name === "Rule r_group")!;
    expect(groupRule.conditionGroups![0].id).not.toBe("g1");
    expect(groupRule.conditionGroups![0].conditions[0].fieldId).toBe(newA.id);
    expect(
      groupRule.conditionGroups![1].conditions[0].compareFieldId
    ).toBeUndefined();

    const formulaRule = copy.rules.find((r) => r.name === "Rule r_formula")!;
    expect(formulaRule.formulaExpression).toBe(`${newA.variableName} / 10`);

    // Source form is untouched.
    expect(res.study.forms[0]).toEqual(s.forms[0]);
  });

  it("duplicateForm keeps variable names when renameVariables is false", () => {
    const res = StudyProtocolEngine.duplicateForm(richStudy(), "XX", {
      newDomain: "yy",
      renameVariables: false,
    });
    const copy = res.duplicatedForm!;
    expect(copy.domain).toBe("YY");
    expect(copy.name).toBe("Rich Form (Copy)");
    expect(copy.sections[0].fields[0].variableName).toBe("AVAR");
    expect(copy.sections[1].fields[0].repeatingColumns![0].variableName).toBe(
      "RCONE"
    );
    // The formula is still remapped from variable name to the new field id.
    expect(copy.sections[0].fields[1].calculationFormula).toBe("AVAR * 2");
  });
});

describe("field duplication, sections and insertion", () => {
  it("duplicateField reports unknown fields", () => {
    const res = StudyProtocolEngine.duplicateField(richStudy(), "XX", "NOPE");
    expect(res.error).toBe("Field 'NOPE' not found in form 'XX'.");
  });

  it("duplicateField copies a grid with fresh column identities", () => {
    const res = StudyProtocolEngine.duplicateField(richStudy(), "XX", "GRID");
    const dup = res.duplicatedField!;
    expect(dup.label).toBe("GRID label (Copy)");
    expect(dup.variableName).not.toBe("GRID");
    const cols = dup.repeatingColumns!;
    expect(cols.map((c) => c.variableName)).not.toContain("RCONE");
    expect(cols.map((c) => c.id)).not.toContain("rc_1");
    // Inserted right after the original in the same section.
    expect(res.form!.sections[1].fields[1].id).toBe(dup.id);
  });

  it("duplicateField appends to a different target section and ignores unknown ones", () => {
    const toOther = StudyProtocolEngine.duplicateField(
      richStudy(),
      "XX",
      "AVAR",
      "sec_b"
    );
    expect(toOther.form!.sections[1].fields.at(-1)!.id).toBe(
      toOther.duplicatedField!.id
    );

    const unknown = StudyProtocolEngine.duplicateField(
      richStudy(),
      "XX",
      "AVAR",
      "sec_missing"
    );
    expect(unknown.form!.sections[0].fields[1].id).toBe(
      unknown.duplicatedField!.id
    );
  });

  it("addSection handles unknown forms, strings and partial sections", () => {
    expect(StudyProtocolEngine.addSection(richStudy(), "ZZ", "New").error).toBe(
      "Form 'ZZ' not found in protocol."
    );

    const titled = StudyProtocolEngine.addSection(richStudy(), "XX", "Extra");
    expect(titled.section!.title).toBe("Extra");
    expect(titled.section!.fields).toEqual([]);

    const fromObject = StudyProtocolEngine.addSection(richStudy(), "XX", {
      id: "sec_custom",
      fields: [field("fld_z", "ZVAR")],
    });
    expect(fromObject.section).toEqual({
      id: "sec_custom",
      title: "New Section",
      fields: [field("fld_z", "ZVAR")],
    });

    const blankObject = StudyProtocolEngine.addSection(richStudy(), "XX", {});
    expect(blankObject.section!.id).toMatch(/sec/);
    expect(blankObject.section!.fields).toEqual([]);
  });

  it("insertField creates a default section in a section-less form", () => {
    const s = StudyProtocolEngine.createInitialStudy({
      forms: [{ ...richForm(), sections: [] }],
    });
    const res = StudyProtocolEngine.insertField(s, "XX", {
      variableName: "newvar",
      dataType: "text",
    });
    expect(res.form!.sections).toHaveLength(1);
    expect(res.form!.sections[0].title).toBe("General Assessment");
    expect(res.field!.variableName).toBe("NEWVAR");
    expect(res.field!.label).toBe("NEWVAR");
    expect(res.field!.requirementTier).toBe("optional");
  });

  it("insertField rejects collisions with repeating columns", () => {
    const s = richStudy();
    expect(
      StudyProtocolEngine.insertField(s, "XX", {
        variableName: "rcone",
        dataType: "text",
      }).error
    ).toBe("Variable 'RCONE' already exists in form 'XX'.");

    expect(
      StudyProtocolEngine.insertField(s, "XX", {
        variableName: "NEWGRID",
        dataType: "repeating_table",
        repeatingColumns: [field("x", "newgrid")],
      }).error
    ).toBe(
      "Repeating column variable 'NEWGRID' conflicts with parent variable 'NEWGRID'."
    );

    expect(
      StudyProtocolEngine.insertField(s, "XX", {
        variableName: "NEWGRID",
        dataType: "repeating_table",
        repeatingColumns: [field("x", "RCTWO")],
      }).error
    ).toBe("Repeating column variable 'RCTWO' already exists in form 'XX'.");

    expect(
      StudyProtocolEngine.insertField(s, "XX", {
        variableName: "NEWGRID",
        dataType: "repeating_table",
        repeatingColumns: [field("x", "AVAR")],
      }).error
    ).toBe("Repeating column variable 'AVAR' already exists in form 'XX'.");
  });

  it("insertField resolves sections by id, falls back to index and clamps positions", () => {
    const s = richStudy();
    const byId = StudyProtocolEngine.insertField(
      s,
      "XX",
      { variableName: "N1", dataType: "text", required: true },
      { sectionId: "sec_b", targetIndex: 0 }
    );
    expect(byId.form!.sections[1].fields[0].variableName).toBe("N1");
    expect(byId.field!.requirementTier).toBe("hard_stop");

    const fallback = StudyProtocolEngine.insertField(
      s,
      "XX",
      { variableName: "N2", dataType: "text" },
      { sectionId: "sec_missing", sectionIndex: 42, targetIndex: -5 }
    );
    expect(fallback.form!.sections[1].fields[0].variableName).toBe("N2");

    const missingNoIndex = StudyProtocolEngine.insertField(
      s,
      "XX",
      { variableName: "N3", dataType: "text" },
      { sectionId: "sec_missing" }
    );
    expect(missingNoIndex.form!.sections[0].fields.at(-1)!.variableName).toBe(
      "N3"
    );

    const actorFromArg = StudyProtocolEngine.insertField(
      s,
      "XX",
      { variableName: "N4", dataType: "text" },
      undefined,
      "Second Arg Actor"
    );
    expect(actorFromArg.study.auditTrail!.at(-1)!.changedBy).toBe(
      "Second Arg Actor"
    );
  });

  it("addField maps option objects and keeps the explicit actor", () => {
    const res = StudyProtocolEngine.addField(
      richStudy(),
      "XX",
      { variableName: "OPTF", dataType: "text" },
      { sectionId: "sec_b" },
      { name: "Fallback", role: "Data Manager" }
    );
    expect(res.form!.sections[1].fields.at(-1)!.variableName).toBe("OPTF");
    expect(res.study.auditTrail!.at(-1)!.changedBy).toBe("Fallback");

    const withOwnActor = StudyProtocolEngine.addField(
      richStudy(),
      "XX",
      { variableName: "OPTG", dataType: "text" },
      { actor: "Inline" },
      "Ignored"
    );
    expect(withOwnActor.study.auditTrail!.at(-1)!.changedBy).toBe("Inline");
  });
});

describe("smart blocks and slash fields", () => {
  it("insertSmartBlock reports unknown forms with an undo that returns the input", () => {
    const s = richStudy();
    const res = StudyProtocolEngine.insertSmartBlock(s, "ZZ", "vitals");
    expect(res.error).toBe("Form 'ZZ' not found in protocol.");
    expect(res.insertedFields).toEqual([]);
    expect(res.undo()).toBe(s);
  });

  it("insertSmartBlock can insert as a new section at an index", () => {
    const s = richStudy();
    const res = StudyProtocolEngine.insertSmartBlock(s, "XX", "vitals", {
      targetIndex: 0,
    });
    expect(res.insertedSection).toBeDefined();
    expect(res.study.forms[0].sections[0]).toBe(res.insertedSection);
    expect(res.undo()).toBe(s);
  });

  it("insertSmartBlock merges fields into an existing section", () => {
    const res = StudyProtocolEngine.insertSmartBlock(
      richStudy(),
      "XX",
      "vitals",
      { targetSectionId: "sec_a", targetIndex: 1 }
    );
    expect(res.insertedSection).toBeUndefined();
    const sec = res.study.forms[0].sections[0];
    expect(sec.fields[0].id).toBe("fld_a");
    expect(sec.fields[1].id).toBe(res.insertedFields[0].id);
    expect(sec.fields.at(-1)!.id).toBe("fld_b");

    const appended = StudyProtocolEngine.insertSmartBlock(
      richStudy(),
      "XX",
      "vitals",
      { targetSectionId: "sec_a" }
    );
    expect(appended.study.forms[0].sections[0].fields.at(-1)!.id).toBe(
      appended.insertedFields.at(-1)!.id
    );
  });

  it("insertSmartBlock appends a new section when the target section is unknown", () => {
    const res = StudyProtocolEngine.insertSmartBlock(
      richStudy(),
      "XX",
      "vitals",
      { targetSectionId: "sec_missing" }
    );
    expect(res.study.forms[0].sections).toHaveLength(3);
    expect(res.insertedSection).toBeUndefined();
  });

  it("insertAtomicSlashField reports unknown forms", () => {
    const s = richStudy();
    const res = StudyProtocolEngine.insertAtomicSlashField(s, "ZZ", "text");
    expect(res.error).toBe("Form 'ZZ' not found in protocol.");
    expect(res.undo()).toBe(s);
  });

  it("insertAtomicSlashField inserts a field and undo restores the input", () => {
    const s = richStudy();
    const res = StudyProtocolEngine.insertAtomicSlashField(s, "XX", "number", {
      targetSectionId: "sec_b",
      targetIndex: 0,
    });
    expect(res.error).toBeUndefined();
    expect(res.study.forms[0].sections[1].fields[0].id).toBe(
      res.insertedField!.id
    );
    expect(res.undo()).toBe(s);
  });
});

describe("field update and move", () => {
  it("updateField reports unknown fields and keeps the variable name when not given", () => {
    expect(
      StudyProtocolEngine.updateField(richStudy(), "XX", "NOPE", {}).error
    ).toBe("Field 'NOPE' not found in form 'XX'.");

    const res = StudyProtocolEngine.updateField(richStudy(), "XX", "AVAR", {
      label: "Changed",
    });
    expect(res.field!.variableName).toBe("AVAR");
    expect(res.field!.label).toBe("Changed");

    const renamed = StudyProtocolEngine.updateField(richStudy(), "XX", "AVAR", {
      variableName: "  newname ",
    });
    expect(renamed.field!.variableName).toBe("NEWNAME");
  });

  it("moveFieldToSection validates field and section and short-circuits same section", () => {
    const s = richStudy();
    expect(
      StudyProtocolEngine.moveFieldToSection(s, "XX", "NOPE", "sec_b").error
    ).toBe("Field 'NOPE' not found in form 'XX'.");
    expect(
      StudyProtocolEngine.moveFieldToSection(s, "XX", "AVAR", "Nowhere").error
    ).toBe("Target section 'Nowhere' not found in form 'Rich Form'.");

    const same = StudyProtocolEngine.moveFieldToSection(
      s,
      "XX",
      "AVAR",
      " section a "
    );
    expect(same.study).toBe(s);

    const moved = StudyProtocolEngine.moveFieldToSection(
      s,
      "XX",
      "AVAR",
      "Section B"
    );
    expect(moved.form!.sections[0].fields.map((f) => f.id)).toEqual(["fld_b"]);
    expect(moved.form!.sections[1].fields.at(-1)!.id).toBe("fld_a");
  });
});

describe("findFieldReferences and removal previews", () => {
  it("returns nothing for blank targets", () => {
    expect(StudyProtocolEngine.findFieldReferences(richStudy(), "  ")).toEqual(
      []
    );
  });

  it("finds every kind of reference to AVAR", () => {
    const refs = StudyProtocolEngine.findFieldReferences(richStudy(), "avar");
    const types = refs.map((r) => r.type);
    expect(types).toEqual(
      expect.arrayContaining([
        "rule_target",
        "rule_trigger",
        "rule_condition",
        "cross_visit_rule",
        "rule_formula",
        "field_calculation",
      ])
    );
    const cross = refs.filter((r) => r.type === "cross_visit_rule");
    expect(cross.map((r) => r.description)).toEqual([
      "Cross-visit rule 'Rule r_cross' evaluates this field at visit 'v_screening'.",
      "Cross-visit rule 'Rule r_cross' compares against this field at visit 'v_screening'.",
    ]);
    expect(
      refs.some(
        (r) =>
          r.type === "rule_condition" &&
          r.description ===
            "Rule 'Rule r_cond' compares against this field in condition."
      )
    ).toBe(true);
    expect(
      refs.some((r) => r.type === "field_calculation" && r.fieldId === "rc_1")
    ).toBe(true);
  });

  it("resolves repeating columns and reports their containing grid", () => {
    const refs = StudyProtocolEngine.findFieldReferences(
      richStudy(),
      "rctwo",
      "form_xx"
    );
    expect(refs).toEqual([
      expect.objectContaining({
        type: "repeating_column",
        fieldId: "fld_g",
        variableName: "GRID",
      }),
    ]);
  });

  it("previewFieldRemoval reports safe deletes for unknown fields", () => {
    const preview = StudyProtocolEngine.previewFieldRemoval(
      richStudy(),
      "ZZ",
      "NOPE"
    );
    expect(preview).toEqual({
      targetFieldId: "NOPE",
      targetVariableName: "NOPE",
      formId: "ZZ",
      references: [],
      canSafelyDelete: true,
    });
  });

  it("previewFieldRemoval summarises rule and calculation references", () => {
    const preview = StudyProtocolEngine.previewFieldRemoval(
      richStudy(),
      "XX",
      "AVAR"
    );
    expect(preview.canSafelyDelete).toBe(false);
    expect(preview.warningMessage).toMatch(
      /^Field 'AVAR' is actively referenced by \d+ rule reference\(s\) and \d+ calculation formula\(s\)\./
    );
  });

  it("previewFieldRemoval names only calculation formulas when no rule refers", () => {
    const form = richForm();
    const s = StudyProtocolEngine.createInitialStudy({
      forms: [{ ...form, rules: [] }],
    });
    const preview = StudyProtocolEngine.previewFieldRemoval(s, "XX", "AVAR");
    expect(preview.warningMessage).toMatch(
      /referenced by 2 calculation formula\(s\)\./
    );
  });

  it("previewFieldRemoval does not count a grid's own columns as references", () => {
    const preview = StudyProtocolEngine.previewFieldRemoval(
      richStudy(),
      "XX",
      "fld_g"
    );
    // fld_g itself is a grid; its own columns are not counted as references.
    expect(preview.canSafelyDelete).toBe(true);
  });

  it("previewSectionRemoval handles unknown forms and sections", () => {
    const unknownForm = StudyProtocolEngine.previewSectionRemoval(
      richStudy(),
      "ZZ",
      "sec_a"
    );
    expect(unknownForm.formId).toBe("ZZ");
    expect(unknownForm.canSafelyDelete).toBe(true);

    const unknownSection = StudyProtocolEngine.previewSectionRemoval(
      richStudy(),
      "XX",
      "sec_missing"
    );
    expect(unknownSection.formId).toBe("form_xx");
    expect(unknownSection.sectionTitle).toBe("sec_missing");
  });

  it("previewSectionRemoval deduplicates references across fields", () => {
    const preview = StudyProtocolEngine.previewSectionRemoval(
      richStudy(),
      "XX",
      "sec_a"
    );
    expect(preview.fields).toHaveLength(2);
    const keys = preview.allReferences.map(
      (r) => `${r.type}:${r.ruleId ?? ""}:${r.fieldId ?? ""}:${r.description}`
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(preview.totalReferencesCount).toBe(preview.allReferences.length);
    expect(preview.warningMessage).toContain("Section 'Section A' contains 2");
  });
});

describe("renameFieldEverywhere", () => {
  it("validates the field, the new name and collisions", () => {
    const s = richStudy();
    expect(
      StudyProtocolEngine.renameFieldEverywhere(s, "XX", "NOPE", "NEW").error
    ).toBe("Field 'NOPE' not found in form 'XX'.");
    expect(
      StudyProtocolEngine.renameFieldEverywhere(s, "XX", "AVAR", "   ").error
    ).toBe("Variable name cannot be empty.");
    expect(
      StudyProtocolEngine.renameFieldEverywhere(s, "XX", "AVAR", "1BAD").error
    ).toBeTruthy();
    expect(
      StudyProtocolEngine.renameFieldEverywhere(s, "XX", "AVAR", "bvar").error
    ).toBe("Variable name 'BVAR' already exists in form 'Rich Form'.");
    expect(
      StudyProtocolEngine.renameFieldEverywhere(s, "XX", "AVAR", "RCTWO").error
    ).toBe("Variable name 'RCTWO' already exists in form 'Rich Form'.");
  });

  it("rewrites formulas, variable-name references and grid columns", () => {
    const res = StudyProtocolEngine.renameFieldEverywhere(
      richStudy(),
      "XX",
      "AVAR",
      "ANEW",
      "A new label"
    );
    expect(res.error).toBeUndefined();
    expect(res.updatedField).toMatchObject({
      variableName: "ANEW",
      label: "A new label",
    });
    const form = res.study.forms[0];
    expect(form.sections[0].fields[1].calculationFormula).toBe("ANEW * 2");
    expect(
      form.sections[1].fields[0].repeatingColumns![0].calculationFormula
    ).toBe("ANEW + 1");
    const byId = (id: string) => form.rules.find((r) => r.id === id)!;
    expect(byId("r_cond").conditions[0].compareFieldId).toBe("ANEW");
    expect(byId("r_group").conditionGroups![0].conditions[0].fieldId).toBe(
      "ANEW"
    );
    expect(byId("r_cross").conditions[0].fieldId).toBe("ANEW");
    expect(byId("r_formula").formulaExpression).toBe("ANEW / 10");
    // Two calculations + four rules (cond, group, cross, formula).
    expect(res.affectedReferencesCount).toBe(6);
  });

  it("rewrites rule targets and triggers stored by variable name", () => {
    const form = richForm();
    form.rules = [
      rule("r_var", {
        targetFieldId: "CVAR",
        triggerFieldIds: ["CVAR", "fld_b"],
        conditions: [{ fieldId: "fld_b", operator: "eq", value: 1 }],
      }),
      rule("r_untouched", { targetFieldId: "fld_b" }),
    ];
    const s = StudyProtocolEngine.createInitialStudy({ forms: [form] });
    const res = StudyProtocolEngine.renameFieldEverywhere(
      s,
      "XX",
      "CVAR",
      "CNEW"
    );
    // Without newLabel the label is preserved.
    expect(res.updatedField!.label).toBe("CVAR label");
    const [renamed, untouched] = res.study.forms[0].rules;
    expect(renamed.targetFieldId).toBe("CNEW");
    expect(renamed.triggerFieldIds).toEqual(["CNEW", "fld_b"]);
    expect(renamed.conditions[0]).not.toHaveProperty("compareFieldId");
    expect(untouched.targetFieldId).toBe("fld_b");
    expect(res.affectedReferencesCount).toBe(1);
  });
});

describe("removeFieldWithCascade, restoreField and removeField", () => {
  it("reports unknown fields", () => {
    const res = StudyProtocolEngine.removeFieldWithCascade(
      richStudy(),
      "XX",
      "NOPE"
    );
    expect(res.error).toBe("Field 'NOPE' not found in form 'XX'.");
    expect(res.affectedReferences).toEqual([]);
  });

  it("prunes rules referencing the field and undo restores them", () => {
    const s = richStudy();
    const res = StudyProtocolEngine.removeFieldWithCascade(s, "XX", "AVAR", {
      actor: "Cascade Actor",
    });
    const rules = res.study.forms[0].rules;
    const ids = rules.map((r) => r.id);
    expect(ids).not.toContain("r_target");
    const cond = rules.find((r) => r.id === "r_cond")!;
    expect(cond.conditions).toEqual([]);
    const group = rules.find((r) => r.id === "r_group")!;
    expect(group.conditionGroups!.map((g) => g.id)).toEqual(["g2"]);
    expect(res.study.auditTrail!.at(-1)!.changedBy).toBe("Cascade Actor");

    const restored = res.undo!(res.study);
    expect(restored.forms[0].sections[0].fields[0].id).toBe("fld_a");
    expect(restored.forms[0].rules.map((r) => r.id).sort()).toEqual(
      s.forms[0].rules.map((r) => r.id).sort()
    );
  });

  it("drops rules left with no triggers and no conditions", () => {
    const form = richForm();
    form.rules = [
      rule("r_only", { targetFieldId: "fld_c", triggerFieldIds: ["fld_a"] }),
    ];
    const s = StudyProtocolEngine.createInitialStudy({ forms: [form] });
    const res = StudyProtocolEngine.removeFieldWithCascade(s, "XX", "AVAR");
    expect(res.study.forms[0].rules).toEqual([]);
  });

  it("keeps rules when purgeReferencingRules is false", () => {
    const s = richStudy();
    const res = StudyProtocolEngine.removeFieldWithCascade(s, "XX", "AVAR", {
      purgeReferencingRules: false,
    });
    expect(res.study.forms[0].rules).toEqual(s.forms[0].rules);
  });

  it("restoreField guards unknown forms, existing fields and empty sections", () => {
    const s = richStudy();
    const fld = field("fld_new", "NEWV");
    expect(StudyProtocolEngine.restoreField(s, "ZZ", fld)).toBe(s);
    expect(
      StudyProtocolEngine.restoreField(
        s,
        "XX",
        s.forms[0].sections[0].fields[0]
      )
    ).toBe(s);

    const noSections = StudyProtocolEngine.createInitialStudy({
      forms: [{ ...richForm(), sections: [] }],
    });
    expect(StudyProtocolEngine.restoreField(noSections, "XX", fld)).toBe(
      noSections
    );
  });

  it("restoreField falls back to the first section and appends out-of-range indexes", () => {
    const s = richStudy();
    const fld = field("fld_new", "NEWV");
    const res = StudyProtocolEngine.restoreField(
      s,
      "XX",
      fld,
      "sec_missing",
      99
    );
    expect(res.forms[0].sections[0].fields.at(-1)!.id).toBe("fld_new");
    const neg = StudyProtocolEngine.restoreField(s, "XX", fld, undefined, -1);
    expect(neg.forms[0].sections[0].fields.at(-1)!.id).toBe("fld_new");
    const withRules = StudyProtocolEngine.restoreField(
      s,
      "XX",
      fld,
      "sec_b",
      0,
      [rule("r_extra")]
    );
    expect(withRules.forms[0].sections[1].fields[0].id).toBe("fld_new");
    expect(withRules.forms[0].rules.at(-1)!.id).toBe("r_extra");
  });

  it("removeField wraps cascade errors and success", () => {
    const s = richStudy();
    const missing = StudyProtocolEngine.removeField(s, "XX", "NOPE");
    expect(missing.study).toBe(s);
    expect(missing.error).toBe("Field 'NOPE' not found in form 'XX'.");

    const ok = StudyProtocolEngine.removeField(s, "XX", "CVAR");
    expect(ok.removedField!.id).toBe("fld_c");
    expect(ok.form!.id).toBe("form_xx");
    expect(typeof ok.undo).toBe("function");
  });
});

describe("removeSectionWithCascade and restoreSection", () => {
  it("validates form, section and the last-section guard", () => {
    const s = richStudy();
    expect(
      StudyProtocolEngine.removeSectionWithCascade(s, "ZZ", "sec_a").error
    ).toBe("Form 'ZZ' not found in protocol.");
    expect(
      StudyProtocolEngine.removeSectionWithCascade(s, "XX", "sec_missing").error
    ).toBe("Section 'sec_missing' not found in form 'Rich Form'.");

    const single = StudyProtocolEngine.createInitialStudy({
      forms: [{ ...richForm(), sections: [richForm().sections[0]] }],
    });
    expect(
      StudyProtocolEngine.removeSectionWithCascade(single, "XX", "sec_a").error
    ).toBe("Cannot remove the only remaining section in form 'Rich Form'.");
  });

  it("removes a section, prunes rules, marks review targets and undoes", () => {
    const { study } = StudyProtocolEngine.addReviewComment(
      richStudy(),
      "fld_a",
      "watch"
    );
    const res = StudyProtocolEngine.removeSectionWithCascade(
      study,
      "XX",
      "sec_a",
      undefined,
      REVIEWER
    );
    expect(res.removedFields.map((f) => f.id)).toEqual(["fld_a", "fld_b"]);
    const ruleIds = res.study.forms[0].rules.map((r) => r.id);
    expect(ruleIds).not.toContain("r_target");
    expect(ruleIds).not.toContain("r_formula");
    const group = res.study.forms[0].rules.find((r) => r.id === "r_group")!;
    expect(group.conditionGroups!.map((g) => g.id)).toEqual(["g2"]);
    expect(
      StudyProtocolEngine.isReviewTargetDeleted(res.study.reviewThreads![0])
    ).toBe(true);

    const restored = res.undo!(res.study);
    expect(restored.forms[0].sections.map((sec) => sec.id)).toEqual([
      "sec_a",
      "sec_b",
    ]);
    expect(restored.forms[0].rules).toHaveLength(study.forms[0].rules.length);
  });

  it("keeps rules when purgeReferencingRules is false", () => {
    const s = richStudy();
    const res = StudyProtocolEngine.removeSectionWithCascade(s, "XX", "sec_a", {
      purgeReferencingRules: false,
    });
    expect(res.study.forms[0].rules).toEqual(s.forms[0].rules);
  });

  it("restoreSection guards unknown forms and existing sections", () => {
    const s = richStudy();
    const sec = s.forms[0].sections[0];
    expect(StudyProtocolEngine.restoreSection(s, "ZZ", sec)).toBe(s);
    const same = StudyProtocolEngine.restoreSection(s, "XX", sec);
    expect(same.forms[0].sections).toHaveLength(2);

    const extra = { id: "sec_new", title: "New", fields: [] };
    const appended = StudyProtocolEngine.restoreSection(s, "XX", extra, 50);
    expect(appended.forms[0].sections.at(-1)!.id).toBe("sec_new");
    const neg = StudyProtocolEngine.restoreSection(s, "XX", extra, -2, []);
    expect(neg.forms[0].sections.at(-1)!.id).toBe("sec_new");
  });
});

describe("visits, arms, epochs, cohorts and concepts", () => {
  it("addVisit applies defaults and sorts by target day", () => {
    const res = StudyProtocolEngine.addVisit(richStudy(), {
      name: "!!!",
      targetDay: -7,
    });
    expect(res.visit.oid).toBe("SE.VISIT");
    expect(res.visit.visitType).toBe("Scheduled");
    expect(res.study.visits[0].id).toBe(res.visit.id);

    const explicit = StudyProtocolEngine.addVisit(richStudy(), {
      id: "v_x",
      oid: "SE.X",
      name: "Week 2",
      targetDay: 14,
      visitType: "Unscheduled",
      windowBefore: 2,
      windowAfter: 3,
      assignedFormIds: ["form_xx"],
      isRepeating: true,
    });
    expect(explicit.visit).toMatchObject({
      id: "v_x",
      oid: "SE.X",
      visitType: "Unscheduled",
      windowBefore: 2,
      windowAfter: 3,
      isRepeating: true,
    });
  });

  it("assignVisitForms ignores unknown and duplicate form tokens", () => {
    const res = StudyProtocolEngine.assignVisitForms(richStudy(), "screening", [
      "XX",
      "form_xx",
      "ZZ",
    ]);
    expect(res.visit!.assignedFormIds).toEqual(["form_xx"]);
  });

  it("assignArmVisitForms validates visits and records arm assignments", () => {
    const s = richStudy();
    expect(
      StudyProtocolEngine.assignArmVisitForms(s, "Nope", "arm_a", ["XX"]).error
    ).toBe("Visit 'Nope' not found in protocol.");

    const first = StudyProtocolEngine.assignArmVisitForms(
      s,
      "v_screening",
      "arm_a",
      ["XX", "xx", "ZZ"]
    );
    expect(first.visit!.armIds).toEqual(["arm_a"]);
    expect(first.visit!.armFormAssignments).toEqual({ arm_a: ["form_xx"] });

    const second = StudyProtocolEngine.assignArmVisitForms(
      first.study,
      "Screening",
      "arm_a",
      []
    );
    expect(second.visit!.armIds).toEqual(["arm_a"]);
    expect(second.visit!.armFormAssignments).toEqual({ arm_a: [] });
  });

  it("arm, epoch and cohort removals are no-ops for unknown ids", () => {
    const s = richStudy();
    expect(StudyProtocolEngine.removeArm(s, "x").study).toBe(s);
    expect(StudyProtocolEngine.removeEpoch(s, "x").study).toBe(s);
    expect(StudyProtocolEngine.removeCohort(s, "x").study).toBe(s);
  });

  it("adds, replaces and removes arms, epochs, cohorts and concepts", () => {
    let s = richStudy();
    s = StudyProtocolEngine.addArm(s, {
      id: "a1",
      name: "A1",
      type: "Experimental",
    }).study;
    s = StudyProtocolEngine.addArm(s, {
      id: "a1",
      name: "A1 renamed",
      type: "Experimental",
    }).study;
    expect(s.arms).toEqual([
      { id: "a1", name: "A1 renamed", type: "Experimental" },
    ]);

    s = StudyProtocolEngine.addEpoch(s, {
      id: "e2",
      name: "Treatment",
      sequenceNumber: 2,
    }).study;
    s = StudyProtocolEngine.addEpoch(s, {
      id: "e1",
      name: "Screening",
      sequenceNumber: 1,
    }).study;
    expect(s.epochs!.map((e) => e.id)).toEqual(["e1", "e2"]);

    s = StudyProtocolEngine.addCohort(s, { id: "c1", name: "C1" }).study;
    s = StudyProtocolEngine.addCohort(s, { id: "c1", name: "C1b" }).study;
    expect(s.cohorts).toEqual([{ id: "c1", name: "C1b" }]);

    s = StudyProtocolEngine.addBiomedicalConcept(s, {
      id: "bc1",
      name: "Height",
    }).study;
    s = StudyProtocolEngine.addBiomedicalConcept(s, {
      id: "bc1",
      name: "Body Height",
    }).study;
    expect(s.biomedicalConcepts).toEqual([{ id: "bc1", name: "Body Height" }]);

    const arm = StudyProtocolEngine.removeArm(s, "a1");
    expect(arm.removedArm!.name).toBe("A1 renamed");
    expect(arm.study.arms).toEqual([]);
    const epoch = StudyProtocolEngine.removeEpoch(s, "e1");
    expect(epoch.study.epochs!.map((e) => e.id)).toEqual(["e2"]);
    const cohort = StudyProtocolEngine.removeCohort(s, "c1");
    expect(cohort.study.cohorts).toEqual([]);
  });

  it("getArmAwareVisitMatrix resolves epochs and arm-specific forms", () => {
    let s = richStudy();
    s = {
      ...s,
      visits: s.visits.map((v, i) =>
        i === 0
          ? {
              ...v,
              epochId: "e1",
              assignedFormIds: ["form_xx"],
              armFormAssignments: { a1: [] },
            }
          : v
      ),
    };
    s = StudyProtocolEngine.addEpoch(s, {
      id: "e1",
      name: "Screening Epoch",
      sequenceNumber: 1,
    }).study;

    const noArms = StudyProtocolEngine.getArmAwareVisitMatrix(s);
    expect(noArms).toHaveLength(1);
    expect(noArms[0].armName).toBe("Default Protocol Schedule");
    expect(noArms[0].visits[0].epochName).toBe("Screening Epoch");
    expect(noArms[0].visits[1].epochName).toBeUndefined();

    s = StudyProtocolEngine.addArm(s, {
      id: "a1",
      name: "A1",
      type: "Experimental",
    }).study;
    s = StudyProtocolEngine.addArm(s, {
      id: "a2",
      name: "A2",
      type: "Placebo Comparator",
    }).study;
    const matrix = StudyProtocolEngine.getArmAwareVisitMatrix(s);
    expect(matrix.map((m) => m.armId)).toEqual(["a1", "a2"]);
    expect(matrix[0].visits[0].assignedFormIds).toEqual([]);
    expect(matrix[1].visits[0].assignedFormIds).toEqual(["form_xx"]);
    expect(matrix[0].visits[0].epochName).toBe("Screening Epoch");
    expect(matrix[0].visits[1].epochName).toBeUndefined();
  });
});

describe("rules, presets, validation and export", () => {
  it("addRule resolves trigger variables and defaults severity", () => {
    const res = StudyProtocolEngine.addRule(richStudy(), "XX", {
      name: "Triggered",
      targetFieldIdOrVar: "UNKNOWNVAR",
      actionType: "raise_query",
      triggerFieldIdsOrVars: ["AVAR", "MISSING", "CVAR"],
    });
    expect(res.rule!.targetFieldId).toBe("UNKNOWNVAR");
    expect(res.rule!.triggerFieldIds).toEqual(["fld_a", "fld_c"]);
    expect(res.rule!.querySeverity).toBe("warning");
    expect(res.rule!.description).toBe("Edit check rule for UNKNOWNVAR");

    const fallback = StudyProtocolEngine.addRule(richStudy(), "XX", {
      name: "No resolvable triggers",
      targetFieldIdOrVar: "AVAR",
      actionType: "raise_query",
      triggerFieldIdsOrVars: ["MISSING"],
      querySeverity: "error",
      queryMessage: "Msg",
    });
    expect(fallback.rule!.triggerFieldIds).toEqual(["fld_a"]);
    expect(fallback.rule!.querySeverity).toBe("error");
    expect(fallback.rule!.description).toBe("Msg");
  });

  it("loadPreset falls back to the oncology preset for unknown ids", () => {
    const res = StudyProtocolEngine.loadPreset("does-not-exist");
    expect(res.presetInfo).toEqual({
      id: "oncology_recist",
      name: "Phase III Immuno-Oncology (RECIST 1.1)",
    });
    expect(res.study.forms.length).toBeGreaterThan(0);
    expect(StudyProtocolEngine.listDomains().length).toBeGreaterThan(0);
  });

  it("validateProtocol flags long names, orphan forms and missing visit forms", () => {
    const form = richForm();
    form.sections[0].fields.push(field("fld_long", "WAYTOOLONGNAME"));
    const s: StudyProtocol = {
      ...StudyProtocolEngine.createInitialStudy({ forms: [form] }),
    };
    s.visits = s.visits.map((v, i) =>
      i === 0 ? { ...v, assignedFormIds: ["ghost_form"] } : v
    );
    const res = StudyProtocolEngine.validateProtocol(s);
    const rules = res.issues.map((i) => i.rule);
    expect(rules).toContain("CDASH-VAR-LEN");
    expect(rules).toContain("SOA-ORPHAN");
    expect(rules).toContain("SOA-MISSING-FORM");
    expect(res.isCompliant).toBe(false);

    const logForm = StudyProtocolEngine.validateProtocol(
      StudyProtocolEngine.createInitialStudy({
        forms: [{ ...richForm(), isLogForm: true }],
      })
    );
    expect(logForm.issues.map((i) => i.rule)).not.toContain("SOA-ORPHAN");
  });

  it("exportProtocol rejects unsupported formats and captures thrown errors", () => {
    const unsupported = StudyProtocolEngine.exportProtocol(
      richStudy(),
      fromAny("xml")
    );
    expect(unsupported).toEqual({
      success: false,
      output: "",
      format: "xml",
      sizeBytes: 0,
      error: "Unsupported format 'xml'",
    });

    const broken: StudyProtocol = {
      ...richStudy(),
      // A null form entry makes the SAS exporter throw mid-compilation.
      forms: [fromAny(null)],
    };
    const thrown = StudyProtocolEngine.exportProtocol(broken, "sas");
    expect(thrown.success).toBe(false);
    expect(thrown.output).toBe("");
    expect(thrown.sizeBytes).toBe(0);
    expect(thrown.error).toMatch(/null/);
  });

  it("exports yaml, sas and r with a byte count", () => {
    for (const fmt of ["yaml", "sas", "r", "fhir"] as const) {
      const res = StudyProtocolEngine.exportProtocol(richStudy(), fmt);
      expect(res.success).toBe(true);
      expect(res.sizeBytes).toBe(res.output.length);
    }
  });
});
