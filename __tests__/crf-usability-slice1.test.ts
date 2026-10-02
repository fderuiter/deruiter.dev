// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import {
  StudyProtocolEngine,
  generateCdashVariableName,
} from "@/lib/crf/study-engine";
import {
  saveStudySnapshot,
  listStudySnapshots,
  isDraftDirty,
  normalizeStudyForComparison,
} from "@/lib/crf/study-draft-storage";
import { getOncologyPresetSync } from "@/lib/crf/presets";
import type { StudyProtocol } from "@/lib/crf/types";

class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe("CRF Usability Foundation - Slice 1 Suite", () => {
  let baseStudy: StudyProtocol;
  let mockStorage: MockStorage;

  beforeEach(() => {
    baseStudy = getOncologyPresetSync();
    mockStorage = new MockStorage();
  });

  describe("Issue #668: Form Removal & Clean Visit/Arm Assignment Pruning", () => {
    it("previews form removal accurately including visits and arms", () => {
      // Create a test study with 2 visits and an arm
      const initial = StudyProtocolEngine.createInitialStudy();
      const { study: s1, form: formVS } = StudyProtocolEngine.addForm(
        initial,
        "VS"
      );
      const { study: s2, form: formAE } = StudyProtocolEngine.addForm(s1, "AE");

      // Add an arm
      const { study: s3 } = StudyProtocolEngine.addArm(s2, {
        id: "arm_experimental",
        name: "Experimental Arm (Drug X)",
        type: "Experimental",
      });

      // Assign formVS to Visit 0, and formAE to Visit 1
      const { study: s4 } = StudyProtocolEngine.assignVisitForms(
        s3,
        s3.visits[0].id,
        [formVS.id]
      );
      const { study: s5 } = StudyProtocolEngine.assignVisitForms(
        s4,
        s4.visits[1].id,
        [formAE.id]
      );

      // Also assign formVS to arm_experimental on Visit 1
      const { study: s6 } = StudyProtocolEngine.assignArmVisitForms(
        s5,
        s5.visits[1].id,
        "arm_experimental",
        [formVS.id]
      );

      // Preview removal of formVS
      const previewVS = StudyProtocolEngine.previewFormRemoval(s6, formVS.id);
      expect(previewVS.affectedVisits.length).toBe(2);
      expect(previewVS.affectedVisits.map((v) => v.id)).toContain(
        s6.visits[0].id
      );
      expect(previewVS.affectedVisits.map((v) => v.id)).toContain(
        s6.visits[1].id
      );
      expect(previewVS.affectedArms.length).toBe(1);
      expect(previewVS.affectedArms[0].id).toBe("arm_experimental");

      // Preview removal of unassigned form
      const { study: s7, form: unassignedForm } = StudyProtocolEngine.addForm(
        s6,
        "DM"
      );
      const previewDM = StudyProtocolEngine.previewFormRemoval(
        s7,
        unassignedForm.id
      );
      expect(previewDM.affectedVisits).toEqual([]);
      expect(previewDM.affectedArms).toEqual([]);
    });

    it("atomically removes form and prunes visit and arm assignments in a single commit", () => {
      const initial = StudyProtocolEngine.createInitialStudy();
      const { study: s1, form: formVS } = StudyProtocolEngine.addForm(
        initial,
        "VS"
      );
      const { study: s2, form: formDM } = StudyProtocolEngine.addForm(s1, "DM");

      // Assign formVS to both visits, and formDM to visit 1
      const { study: s3 } = StudyProtocolEngine.assignVisitForms(
        s2,
        s2.visits[0].id,
        [formVS.id]
      );
      const { study: s4 } = StudyProtocolEngine.assignVisitForms(
        s3,
        s3.visits[1].id,
        [formVS.id, formDM.id]
      );

      // Assign arm specific form
      const { study: s5 } = StudyProtocolEngine.assignArmVisitForms(
        s4,
        s4.visits[0].id,
        "arm_a",
        [formVS.id]
      );

      // Remove formVS
      const {
        study: sRemoved,
        removedForm,
        affectedVisits,
        affectedArms,
      } = StudyProtocolEngine.removeForm(s5, formVS.id);

      expect(removedForm?.id).toBe(formVS.id);
      expect(sRemoved.forms.some((f) => f.id === formVS.id)).toBe(false);
      expect(sRemoved.forms.some((f) => f.id === formDM.id)).toBe(true);

      // Visit 0 should no longer contain formVS
      expect(sRemoved.visits[0].assignedFormIds).not.toContain(formVS.id);
      expect(sRemoved.visits[0].armFormAssignments?.arm_a).not.toContain(
        formVS.id
      );

      // Visit 1 should still contain formDM, but not formVS
      expect(sRemoved.visits[1].assignedFormIds).toContain(formDM.id);
      expect(sRemoved.visits[1].assignedFormIds).not.toContain(formVS.id);

      expect(affectedVisits?.length).toBe(2);
      expect(affectedArms?.length).toBe(1);
    });

    it("supports undo restoration of both removed form and all visit/arm assignments", () => {
      const initial = StudyProtocolEngine.createInitialStudy();
      const { study: s1, form: formVS } = StudyProtocolEngine.addForm(
        initial,
        "VS"
      );
      const { study: s2, form: formDM } = StudyProtocolEngine.addForm(s1, "DM");

      const { study: s3 } = StudyProtocolEngine.assignVisitForms(
        s2,
        s2.visits[0].id,
        [formVS.id]
      );
      const { study: s4 } = StudyProtocolEngine.assignVisitForms(
        s3,
        s3.visits[1].id,
        [formVS.id, formDM.id]
      );
      const { study: s5 } = StudyProtocolEngine.assignArmVisitForms(
        s4,
        s4.visits[0].id,
        "arm_a",
        [formVS.id]
      );

      const removalResult = StudyProtocolEngine.removeForm(s5, formVS.id);
      expect(removalResult.study.forms.some((f) => f.id === formVS.id)).toBe(
        false
      );
      expect(removalResult.undo).toBeDefined();

      // Execute undo restoration
      const restored = removalResult.undo!(removalResult.study);

      // Form is back
      expect(restored.forms.some((f) => f.id === formVS.id)).toBe(true);

      // Visit assignments are restored exactly
      expect(restored.visits[0].assignedFormIds).toContain(formVS.id);
      expect(restored.visits[1].assignedFormIds).toContain(formVS.id);
      expect(restored.visits[1].assignedFormIds).toContain(formDM.id);
      expect(restored.visits[0].armFormAssignments?.arm_a).toContain(formVS.id);
    });
  });

  describe("Issue #667: Form and Field Duplication without Identity Collisions", () => {
    it("generates valid CDASH nonconflicting variable names within <= 8 characters", () => {
      const existing = new Set(["SYSBP", "SYSBP_2", "DIABPR_2"]);

      // 5-char variable
      const nextSysbp = generateCdashVariableName("SYSBP", existing);
      expect(nextSysbp).toBe("SYSBP_3");
      expect(nextSysbp.length).toBeLessThanOrEqual(8);

      // DIABPRAW is an unused valid 8-character base, so it stays unchanged.
      const nextDiabpraw = generateCdashVariableName("DIABPRAW", existing);
      expect(nextDiabpraw).toBe("DIABPRAW");
      expect(nextDiabpraw.length).toBeLessThanOrEqual(8);

      // Lowercase / dirty input
      const nextWeight = generateCdashVariableName("weight_kg", new Set());
      expect(nextWeight.length).toBeLessThanOrEqual(8);
      expect(nextWeight).toMatch(/^[A-Z][A-Z0-9_]*$/);

      // Digits at beginning gets V_ prefix
      const nextNumeric = generateCdashVariableName("123test", new Set());
      expect(nextNumeric).toMatch(/^V_/);
      expect(nextNumeric.length).toBeLessThanOrEqual(8);
    });

    it("duplicates fields with unique IDs, nonconflicting CDASH names, and deep cloning", () => {
      const form = baseStudy.forms[0];
      const targetField = form.sections[0].fields[0];
      expect(targetField).toBeDefined();

      const { study: duplicatedStudy, duplicatedField } =
        StudyProtocolEngine.duplicateField(baseStudy, form.id, targetField.id);

      expect(duplicatedField).toBeDefined();
      expect(duplicatedField!.id).not.toBe(targetField.id);
      expect(duplicatedField!.id).toMatch(/^fld_/);
      expect(duplicatedField!.variableName).not.toBe(targetField.variableName);
      expect(duplicatedField!.variableName.length).toBeLessThanOrEqual(8);
      expect(duplicatedField!.label).toContain("(Copy)");

      // Verify no aliasing (mutating copy does not mutate source)
      duplicatedField!.customOptions = [
        { code: "TEST", label: "Test", order: 1 },
      ];
      expect(targetField.customOptions).not.toEqual(
        duplicatedField!.customOptions
      );

      // Verify placement immediately after original in section
      const updatedForm = duplicatedStudy.forms.find((f) => f.id === form.id)!;
      const originalIdx = updatedForm.sections[0].fields.findIndex(
        (f) => f.id === targetField.id
      );
      const duplicateIdx = updatedForm.sections[0].fields.findIndex(
        (f) => f.id === duplicatedField!.id
      );
      expect(duplicateIdx).toBe(originalIdx + 1);
    });

    it("duplicates fields with repeating columns allocating fresh IDs to all child columns", () => {
      const initial = StudyProtocolEngine.createInitialStudy();
      const { study: s1, form } = StudyProtocolEngine.addForm(initial, "CM");

      const { study: s2, field: tableField } = StudyProtocolEngine.addField(
        s1,
        form.id,
        {
          variableName: "CMTABLE",
          label: "ConMeds Table",
          dataType: "repeating_table",
          repeatingColumns: [
            {
              id: "col_cmtrt",
              variableName: "RC_MED",
              label: "Medication",
              dataType: "text",
              columnSpan: 6,
              required: true,
            },
            {
              id: "col_cmdose",
              variableName: "RC_DOSE",
              label: "Dose",
              dataType: "number",
              columnSpan: 6,
              required: false,
            },
          ],
        }
      );

      const { duplicatedField } = StudyProtocolEngine.duplicateField(
        s2,
        form.id,
        tableField!.id
      );

      expect(duplicatedField).toBeDefined();
      expect(duplicatedField!.repeatingColumns).toBeDefined();
      expect(duplicatedField!.repeatingColumns!.length).toBe(2);

      // IDs must be fresh
      expect(duplicatedField!.repeatingColumns![0].id).not.toBe("col_cmtrt");
      expect(duplicatedField!.repeatingColumns![1].id).not.toBe("col_cmdose");
    });

    it("duplicates forms with fresh identities, deep cloning, and internal rule remapping", () => {
      const initial = StudyProtocolEngine.createInitialStudy();
      const { study: s1, form: customForm } = StudyProtocolEngine.addForm(
        initial,
        "CUSTOM_VS",
        "Custom Vitals"
      );

      const { study: s2, field: heightField } = StudyProtocolEngine.addField(
        s1,
        customForm.id,
        {
          variableName: "HEIGHT",
          dataType: "number",
        }
      );

      const { study: s3, field: weightField } = StudyProtocolEngine.addField(
        s2,
        customForm.id,
        {
          variableName: "WEIGHT",
          dataType: "number",
        }
      );

      const { study: s4, field: bmiField } = StudyProtocolEngine.addField(
        s3,
        customForm.id,
        {
          variableName: "BMI",
          dataType: "calculated",
          calculationFormula: "WEIGHT / ((HEIGHT/100) * (HEIGHT/100))",
        }
      );

      // Add an AST rule on the form targeting BMI with condition on HEIGHT
      const { study: s5, rule: originalRule } = StudyProtocolEngine.addRule(
        s4,
        customForm.id,
        {
          name: "Height check",
          targetFieldIdOrVar: bmiField!.id,
          actionType: "show_field",
          triggerFieldIdsOrVars: [heightField!.id, weightField!.id],
          queryMessage: "Height must be positive",
        }
      );

      expect(originalRule).toBeDefined();

      // Duplicate form
      const { study: s6, duplicatedForm } = StudyProtocolEngine.duplicateForm(
        s5,
        customForm.id,
        {
          customName: "Vital Signs Cycle 2",
          renameVariables: true,
        }
      );

      expect(s6.forms).toHaveLength(s5.forms.length + 1);
      expect(duplicatedForm).toBeDefined();
      expect(duplicatedForm!.id).not.toBe(customForm.id);
      expect(duplicatedForm!.name).toBe("Vital Signs Cycle 2");

      const origFormInS5 = s5.forms.find((f) => f.id === customForm.id)!;
      // Verify sections and fields have distinct fresh IDs
      expect(duplicatedForm!.sections[0].id).not.toBe(
        origFormInS5.sections[0].id
      );
      const dupFields = duplicatedForm!.sections.flatMap((s) => s.fields);
      const origFields = origFormInS5.sections.flatMap((s) => s.fields);

      expect(dupFields.length).toBe(origFields.length);
      for (let i = 0; i < dupFields.length; i++) {
        expect(dupFields[i].id).not.toBe(origFields[i].id);
      }

      // Verify rule remapping: rule in duplicated form points to duplicated field IDs
      expect(duplicatedForm!.rules.length).toBe(origFormInS5.rules.length);
      const dupRule = duplicatedForm!.rules[0];
      expect(dupRule.id).not.toBe(originalRule!.id);

      const dupTargetField = dupFields.find((f) =>
        f.variableName.startsWith("BMI")
      );
      const dupHeightField = dupFields.find((f) =>
        f.variableName.startsWith("HEIGHT")
      );
      const dupWeightField = dupFields.find((f) =>
        f.variableName.startsWith("WEIGHT")
      );

      expect(dupRule.targetFieldId).toBe(dupTargetField!.id);
      expect(dupRule.triggerFieldIds).toContain(dupHeightField!.id);
      expect(dupRule.triggerFieldIds).toContain(dupWeightField!.id);

      // Formulas must be remapped to new variable names
      if (dupTargetField!.calculationFormula) {
        expect(dupTargetField!.calculationFormula).toContain(
          dupHeightField!.variableName
        );
        expect(dupTargetField!.calculationFormula).toContain(
          dupWeightField!.variableName
        );
      }
    });
  });

  describe("Issue #669: Positional Field Insertion in Section and Index", () => {
    it("inserts field at explicit targetIndex in target section", () => {
      const initial = StudyProtocolEngine.createInitialStudy();
      const { study: s1, form } = StudyProtocolEngine.addForm(initial, "DM");

      // Form currently has fields from CDASH scaffold (e.g. 7 fields)
      const initialFieldsCount = form.sections[0].fields.length;
      const initialFirstField = form.sections[0].fields[0];

      // 1. Insert at beginning (targetIndex = 0)
      const { study: s2, field: fPrepend } = StudyProtocolEngine.insertField(
        s1,
        form.id,
        {
          variableName: "PREPEND",
          dataType: "text",
          label: "Prepended Question",
        },
        { sectionIndex: 0, targetIndex: 0 }
      );

      const formS2 = s2.forms.find((f) => f.id === form.id)!;
      expect(formS2.sections[0].fields.length).toBe(initialFieldsCount + 1);
      expect(formS2.sections[0].fields[0].id).toBe(fPrepend!.id);
      expect(formS2.sections[0].fields[1].id).toBe(initialFirstField.id);

      // 2. Insert in middle (targetIndex = 2)
      const { study: s3, field: fMiddle } = StudyProtocolEngine.insertField(
        s2,
        form.id,
        { variableName: "MIDDLE", dataType: "text", label: "Middle Question" },
        { sectionIndex: 0, targetIndex: 2 }
      );

      const formS3 = s3.forms.find((f) => f.id === form.id)!;
      expect(formS3.sections[0].fields[2].id).toBe(fMiddle!.id);

      // 3. Insert targeting specific sectionId
      const targetSecId = formS3.sections[0].id;
      const { study: s4, field: fBySecId } = StudyProtocolEngine.insertField(
        s3,
        form.id,
        { variableName: "BYSEC", dataType: "number", label: "By Section ID" },
        { sectionId: targetSecId, targetIndex: 1 }
      );

      const formS4 = s4.forms.find((f) => f.id === form.id)!;
      expect(formS4.sections[0].fields[1].id).toBe(fBySecId!.id);
    });

    it("rejects duplicate variable names within the same form", () => {
      const initial = StudyProtocolEngine.createInitialStudy();
      const { study: s1, form } = StudyProtocolEngine.addForm(initial, "VS");

      const res = StudyProtocolEngine.insertField(
        s1,
        form.id,
        { variableName: "SYSBP", dataType: "integer" } // SYSBP already exists in VS domain
      );

      expect(res.error).toBeDefined();
      expect(res.error).toContain("already exists");
    });
  });

  describe("Issue #666: Draft Dirty Detection & Snapshot Saving", () => {
    it("accurately detects draft dirty state against saved baseline", () => {
      const baseline = getOncologyPresetSync();
      const current: StudyProtocol = JSON.parse(JSON.stringify(baseline));

      // Same content -> not dirty
      expect(isDraftDirty(current, baseline)).toBe(false);

      // Timestamp change alone should not mark draft as dirty
      current.lastModified = "2026-12-31T23:59:59.999Z";
      expect(isDraftDirty(current, baseline)).toBe(false);

      // Adding a form marks draft dirty
      const withNewForm: StudyProtocol = {
        ...current,
        forms: [
          ...current.forms,
          {
            id: "f_new",
            name: "New Form",
            domain: "CUSTOM",
            description: "",
            version: "1.0",
            sections: [],
            rules: [],
          },
        ],
      };
      expect(isDraftDirty(withNewForm, baseline)).toBe(true);

      // Editing a field variable name marks draft dirty
      const withFieldEdit: StudyProtocol = JSON.parse(JSON.stringify(baseline));
      withFieldEdit.forms[0].sections[0].fields[0].label = "Modified Label";
      expect(isDraftDirty(withFieldEdit, baseline)).toBe(true);
    });

    it("saves and retrieves snapshots in storage with 20-entry limit", () => {
      expect(listStudySnapshots(mockStorage)).toEqual([]);

      // Save a snapshot
      const res1 = saveStudySnapshot(
        baseStudy,
        "Initial baseline",
        mockStorage
      );
      expect(res1.status).toBe("saved");
      if (res1.status === "saved") {
        expect(res1.snapshot.label).toBe("Initial baseline");
        expect(res1.snapshot.study.id).toBe(baseStudy.id);
      }

      const snapshotsAfter1 = listStudySnapshots(mockStorage);
      expect(snapshotsAfter1.length).toBe(1);
      expect(snapshotsAfter1[0].label).toBe("Initial baseline");

      // Save 25 snapshots to test retention limit (max 20)
      for (let i = 1; i <= 25; i++) {
        saveStudySnapshot(baseStudy, `Snapshot ${i}`, mockStorage);
      }

      const cappedSnapshots = listStudySnapshots(mockStorage);
      expect(cappedSnapshots.length).toBe(20);
      expect(cappedSnapshots[0].label).toBe("Snapshot 25");
    });

    it("normalizes studies consistently for equality comparisons", () => {
      const s1 = getOncologyPresetSync();
      const s2 = JSON.parse(JSON.stringify(s1));
      s2.lastModified = "1970-01-01T00:00:00.000Z";

      expect(normalizeStudyForComparison(s1)).toBe(
        normalizeStudyForComparison(s2)
      );
    });
  });
});
