import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  ALL_SLASH_COMMANDS,
  type CRFField,
  type CRFForm,
  type StudyBaseline,
  type StudyProtocol,
  type StudyReviewActor,
  StudyProtocolEngine,
  getOncologyPresetSync,
} from "@/lib/crf";
import { logger } from "@/lib/logger";
import { useStudyHistory } from "@/components/crf/useStudyHistory";
import { useStudyEditor } from "@/components/crf/useStudyEditor";

const drafts = vi.hoisted(() => ({
  snapshot: vi.fn(),
  draft: vi.fn(),
}));
const templates = vi.hoisted(() => ({ save: vi.fn() }));

vi.mock("@/lib/crf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/crf")>();
  return {
    ...actual,
    saveStudySnapshot: drafts.snapshot,
    saveStudyDraft: drafts.draft,
    saveFormTemplate: templates.save,
  };
});

const AUTHOR: StudyReviewActor = { name: "Study author", role: "Data Manager" };

function newField(variableName: string, extra: Partial<CRFField> = {}) {
  return fromPartial<CRFField>({
    id: `f_new_${variableName}`,
    variableName,
    label: variableName,
    dataType: "text",
    columnSpan: 6,
    required: false,
    ...extra,
  });
}

function setup(
  initial: StudyProtocol = getOncologyPresetSync(),
  start: { formId?: string; visitId?: string; fieldId?: string | null } = {}
) {
  const callbacks = {
    showCanvas: vi.fn(),
    closeWidgetDrawer: vi.fn(),
    playSuccess: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn() },
  };
  const hook = renderHook(() => {
    const history = useStudyHistory(() => initial);
    const [activeFormId, setActiveFormId] = useState(
      start.formId ?? "form_dm_onc"
    );
    const [activeVisitId, setActiveVisitId] = useState(
      start.visitId ?? "v_screen"
    );
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(
      start.fieldId ?? null
    );
    const editor = useStudyEditor({
      history,
      navigation: {
        activeFormId,
        setActiveFormId,
        activeVisitId,
        setActiveVisitId,
        selectedFieldId,
        setSelectedFieldId,
      },
      ...callbacks,
    });
    return { history, editor, activeFormId, activeVisitId, selectedFieldId };
  });
  const current = () => hook.result.current;
  return { ...hook, current, callbacks, initial };
}

const formOf = (study: StudyProtocol, id: string) =>
  study.forms.find((f) => f.id === id)!;

const fieldIds = (form: CRFForm) =>
  form.sections.flatMap((s) => s.fields.map((f) => f.id));

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("useStudyEditor: forms", () => {
  it("falls back to the first form when the active one is missing", () => {
    const { current } = setup(undefined, { formId: "gone" });
    expect(current().editor.activeForm?.id).toBe("form_dm_onc");
  });

  it("adds a form, opens it and shows the canvas", () => {
    const { current, callbacks, initial } = setup(undefined, {
      fieldId: "f_x",
    });
    act(() => current().editor.addForm());
    const study = current().history.study;
    expect(study.forms).toHaveLength(initial.forms.length + 1);
    expect(study.forms.at(-1)?.name).toBe("New Custom Form 7");
    expect(current().activeFormId).toBe(study.forms.at(-1)?.id);
    expect(current().selectedFieldId).toBeNull();
    expect(callbacks.showCanvas).toHaveBeenCalled();
    expect(current().history.canUndo).toBe(true);
  });

  it("duplicates a form and opens the copy", () => {
    const { current, callbacks } = setup();
    act(() => current().editor.duplicateForm("form_vs_onc"));
    const copy = current().history.study.forms.at(-1)!;
    expect(copy.id).not.toBe("form_vs_onc");
    expect(current().activeFormId).toBe(copy.id);
    expect(callbacks.showCanvas).toHaveBeenCalled();
  });

  it("ignores duplicating a form that does not exist", () => {
    const { current, initial } = setup();
    act(() => current().editor.duplicateForm("missing"));
    expect(current().history.study).toBe(initial);
  });

  it("commits a form variant as one step and opens it", () => {
    const { current } = setup(undefined, { fieldId: "f_x" });
    const updated = { ...current().history.study, studyName: "variant" };
    act(() => current().editor.commitFormVariant(updated, "form_vs_onc"));
    expect(current().history.study).toBe(updated);
    expect(current().activeFormId).toBe("form_vs_onc");
    expect(current().selectedFieldId).toBeNull();
  });

  it("deletes the active form and moves to the first remaining one", () => {
    const { current } = setup(undefined, { fieldId: "f_x" });
    act(() => current().editor.deleteForm("form_dm_onc"));
    const study = current().history.study;
    expect(study.forms.some((f) => f.id === "form_dm_onc")).toBe(false);
    expect(current().activeFormId).toBe(study.forms[0].id);
    expect(current().selectedFieldId).toBeNull();
  });

  it("keeps the active form when another one is deleted", () => {
    const { current } = setup(undefined, { fieldId: "f_x" });
    act(() => current().editor.deleteForm("form_lb_onc"));
    expect(current().activeFormId).toBe("form_dm_onc");
    expect(current().selectedFieldId).toBe("f_x");
  });

  it("moves off an active form id that no longer exists", () => {
    const { current } = setup(undefined, { formId: "gone" });
    act(() => current().editor.deleteForm("form_lb_onc"));
    expect(current().activeFormId).toBe("form_dm_onc");
  });

  it("never deletes the last form, or one that is missing", () => {
    const base = getOncologyPresetSync();
    const single = { ...base, forms: [base.forms[0]] };
    const { current } = setup(single);
    act(() => current().editor.deleteForm("form_dm_onc"));
    expect(current().history.study).toBe(single);

    const other = setup();
    act(() => other.current().editor.deleteForm("missing"));
    expect(other.current().history.study).toBe(other.initial);
  });

  it("injects a scaffolded form into a visit and opens it", () => {
    const { current, callbacks } = setup();
    const scaffolded = fromPartial<CRFForm>({
      id: "form_cdash",
      name: "CDASH",
      sections: [],
    });
    act(() =>
      current().editor.injectCdashForm(scaffolded, "v_eos", [
        fromPartial({ id: "CL_NEW" }),
      ])
    );
    const study = current().history.study;
    expect(study.forms.at(-1)?.id).toBe("form_cdash");
    expect(
      study.visits.find((v) => v.id === "v_eos")?.assignedFormIds
    ).toContain("form_cdash");
    expect(study.codelists.at(-1)?.id).toBe("CL_NEW");
    expect(current().activeFormId).toBe("form_cdash");
    expect(callbacks.showCanvas).toHaveBeenCalled();

    act(() =>
      current().editor.injectCdashForm(
        fromPartial<CRFForm>({ id: "form_bare", sections: [] })
      )
    );
    expect(current().history.study.codelists).toBe(study.codelists);
  });

  it("updates the active form's details", () => {
    const { current } = setup();
    act(() => current().editor.updateFormMeta({ name: "Renamed" }));
    expect(formOf(current().history.study, "form_dm_onc").name).toBe("Renamed");
    expect(formOf(current().history.study, "form_vs_onc").name).not.toBe(
      "Renamed"
    );
  });

  it("replaces the active form's rules", () => {
    const { current } = setup();
    act(() => current().editor.updateRules([]));
    expect(formOf(current().history.study, "form_dm_onc").rules).toEqual([]);
  });

  it("saves a form as a template and reports each outcome", () => {
    const { current, callbacks } = setup();
    templates.save.mockReturnValueOnce({ status: "saved" });
    act(() => current().editor.saveFormAsTemplate("form_vs_onc"));
    expect(callbacks.toast.success).toHaveBeenCalledWith(
      expect.stringContaining("as a form template")
    );

    templates.save.mockReturnValueOnce({ status: "limit", max: 12 });
    act(() => current().editor.saveFormAsTemplate("form_vs_onc"));
    expect(callbacks.toast.error).toHaveBeenCalledWith(
      "You can keep 12 form templates. Delete one to save another."
    );

    templates.save.mockReturnValueOnce({ status: "error" });
    act(() => current().editor.saveFormAsTemplate("form_vs_onc"));
    expect(callbacks.toast.error).toHaveBeenCalledWith(
      "This browser could not save the template."
    );

    act(() => current().editor.saveFormAsTemplate("missing"));
    expect(templates.save).toHaveBeenCalledTimes(3);
  });
});

describe("useStudyEditor: visits", () => {
  it("assigns and unassigns a form", () => {
    const { current } = setup();
    act(() => current().editor.assignFormToVisit("v_eos", "form_ae_onc"));
    const assigned = () =>
      current().history.study.visits.find((v) => v.id === "v_eos")!
        .assignedFormIds;
    expect(assigned()).toContain("form_ae_onc");
    act(() => current().editor.unassignFormFromVisit("v_eos", "form_ae_onc"));
    expect(assigned()).not.toContain("form_ae_onc");
  });

  it("adds a visit and selects it", () => {
    const { current, initial } = setup();
    act(() => current().editor.addVisit());
    const visits = current().history.study.visits;
    expect(visits).toHaveLength(initial.visits.length + 1);
    expect(current().activeVisitId).toBe(visits.at(-1)?.id);
  });

  it("deletes the active visit and moves to the first remaining one", () => {
    const { current } = setup();
    act(() => current().editor.deleteVisit("v_screen"));
    expect(current().activeVisitId).toBe("v_c1d1");

    act(() => current().editor.deleteVisit("v_eos"));
    expect(current().activeVisitId).toBe("v_c1d1");
    expect(current().history.study.visits.some((v) => v.id === "v_eos")).toBe(
      false
    );
  });

  it("never deletes the last visit", () => {
    const base = getOncologyPresetSync();
    const single = { ...base, visits: [base.visits[0]] };
    const { current } = setup(single);
    act(() => current().editor.deleteVisit("v_screen"));
    expect(current().history.study).toBe(single);
  });

  it("replaces the visit schedule", () => {
    const { current, initial } = setup();
    act(() => current().editor.updateVisits(initial.visits.slice(0, 2)));
    expect(current().history.study.visits).toHaveLength(2);
  });
});

describe("useStudyEditor: sections", () => {
  it("adds a numbered section to the active form", () => {
    const { current } = setup();
    act(() => current().editor.addSection());
    const sections = formOf(current().history.study, "form_dm_onc").sections;
    expect(sections).toHaveLength(3);
    expect(sections.at(-1)?.title).toBe("Section 3");
  });

  it("retitles a section", () => {
    const { current, initial } = setup();
    const target = formOf(initial, "form_dm_onc").sections[1].id;
    act(() => current().editor.updateSectionTitle(target, "Baseline"));
    const sections = formOf(current().history.study, "form_dm_onc").sections;
    expect(sections[1].title).toBe("Baseline");
    expect(sections[0].title).toBe("Informed Consent");
  });

  it("deletes an unreferenced section straight away", () => {
    const { current, initial } = setup();
    const target = formOf(initial, "form_dm_onc").sections[0].id;
    act(() => current().editor.deleteSection(target));
    expect(
      formOf(current().history.study, "form_dm_onc").sections
    ).toHaveLength(1);
    expect(current().editor.impactPendingDeletion).toBeNull();
  });

  it("holds a referenced section until the cascade is confirmed", () => {
    const { current, initial } = setup(undefined, {
      formId: "form_recist_onc",
    });
    const target = formOf(initial, "form_recist_onc").sections[1].id;
    act(() => current().editor.deleteSection(target));
    expect(current().history.study).toBe(initial);
    expect(current().editor.impactPendingDeletion).toMatchObject({
      type: "section",
      section: { id: target },
    });

    act(() => current().editor.confirmImpactDeletion());
    expect(
      formOf(current().history.study, "form_recist_onc").sections
    ).toHaveLength(1);
    expect(current().editor.impactPendingDeletion).toBeNull();
  });

  it("never deletes a form's only section", () => {
    const { current, initial } = setup(undefined, { formId: "form_vs_onc" });
    const target = formOf(initial, "form_vs_onc").sections[0].id;
    act(() => current().editor.deleteSection(target));
    expect(current().history.study).toBe(initial);
  });

  it("deletes straight away when the referenced section cannot be found", () => {
    const { current } = setup(undefined, { formId: "form_recist_onc" });
    vi.spyOn(StudyProtocolEngine, "previewSectionRemoval").mockReturnValue(
      fromPartial({ canSafelyDelete: false, totalReferencesCount: 2 })
    );
    act(() => current().editor.deleteSection("sec_missing"));
    expect(current().editor.impactPendingDeletion).toBeNull();
    expect(current().history.canUndo).toBe(true);
  });
});

describe("useStudyEditor: fields", () => {
  it("adds a field after the selected one and selects it", () => {
    const { current, callbacks, initial } = setup(undefined, {
      formId: "form_vs_onc",
      fieldId: "f_height",
    });
    act(() => current().editor.addField(newField("NEWVAR")));
    const ids = fieldIds(formOf(current().history.study, "form_vs_onc"));
    expect(ids[ids.indexOf("f_height") + 1]).toBe(current().selectedFieldId);
    expect(callbacks.closeWidgetDrawer).toHaveBeenCalled();
    expect(fieldIds(formOf(initial, "form_vs_onc"))).toHaveLength(9);
  });

  it("renames a field whose variable already exists on the form", () => {
    const { current } = setup(undefined, { formId: "form_vs_onc" });
    act(() =>
      current().editor.addField(newField("HEIGHT"), { targetIndex: 0 })
    );
    const added = formOf(current().history.study, "form_vs_onc").sections[0]
      .fields[0];
    expect(added.variableName).not.toBe("HEIGHT");
  });

  it("splices the field in by hand when the engine refuses it", () => {
    const { current, initial } = setup(undefined, { formId: "form_vs_onc" });
    vi.spyOn(StudyProtocolEngine, "insertField").mockReturnValue({
      study: initial,
      error: "refused",
    });
    act(() =>
      current().editor.addField(newField("MANUAL"), { targetIndex: 99 })
    );
    const fields = formOf(current().history.study, "form_vs_onc").sections[0]
      .fields;
    expect(fields.at(-1)?.variableName).toBe("MANUAL");
    expect(current().selectedFieldId).toBe("f_new_MANUAL");

    act(() => current().editor.addField(newField("APPENDED")));
    expect(
      formOf(current().history.study, "form_vs_onc").sections[0].fields.at(-1)
        ?.variableName
    ).toBe("APPENDED");
  });

  it("updates a field and ignores a refused update", () => {
    const { current } = setup(undefined, { formId: "form_vs_onc" });
    act(() => current().editor.updateField("f_pulse", { label: "Heart rate" }));
    const pulse = () =>
      formOf(current().history.study, "form_vs_onc").sections[0].fields.find(
        (f) => f.id === "f_pulse"
      )!;
    expect(pulse().label).toBe("Heart rate");

    const before = current().history.study;
    vi.spyOn(StudyProtocolEngine, "updateField").mockReturnValue({
      study: before,
      error: "nope",
    });
    act(() => current().editor.updateField("f_pulse", { label: "Pulse" }));
    expect(current().history.study).toBe(before);
  });

  it("duplicates a field and selects the copy", () => {
    const { current, initial } = setup(undefined, { formId: "form_vs_onc" });
    const section = formOf(initial, "form_vs_onc").sections[0].id;
    act(() => current().editor.duplicateField(section, "f_pulse"));
    expect(current().selectedFieldId).not.toBeNull();
    expect(current().selectedFieldId).not.toBe("f_pulse");

    const after = current().history.study;
    act(() => current().editor.duplicateField(section, "missing"));
    expect(current().history.study).toBe(after);
  });

  it("duplicates a field by id from whichever section holds it", () => {
    const { current, initial } = setup(undefined, { formId: "form_vs_onc" });
    act(() => current().editor.duplicateFieldById("f_pulse"));
    expect(current().selectedFieldId).not.toBe("f_pulse");
    expect(
      fieldIds(formOf(current().history.study, "form_vs_onc"))
    ).toHaveLength(fieldIds(formOf(initial, "form_vs_onc")).length + 1);

    const after = current().history.study;
    act(() => current().editor.duplicateFieldById("missing"));
    expect(current().history.study).toBe(after);
  });

  it("deletes an unreferenced field and clears its selection", () => {
    const { current, initial } = setup(undefined, {
      formId: "form_vs_onc",
      fieldId: "f_pulse",
    });
    const section = formOf(initial, "form_vs_onc").sections[0].id;
    act(() => current().editor.deleteField(section, "f_pulse"));
    expect(
      fieldIds(formOf(current().history.study, "form_vs_onc"))
    ).not.toContain("f_pulse");
    expect(current().selectedFieldId).toBeNull();

    act(() => current().editor.deleteField(section, "f_temp"));
    expect(current().selectedFieldId).toBeNull();
  });

  it("keeps another field selected when deleting", () => {
    const { current, initial } = setup(undefined, {
      formId: "form_vs_onc",
      fieldId: "f_temp",
    });
    const section = formOf(initial, "form_vs_onc").sections[0].id;
    act(() => current().editor.deleteField(section, "f_pulse"));
    expect(current().selectedFieldId).toBe("f_temp");
  });

  it("holds a referenced field, then cascades or cancels", () => {
    const { current, initial } = setup(undefined, {
      formId: "form_vs_onc",
      fieldId: "f_height",
    });
    const section = formOf(initial, "form_vs_onc").sections[0].id;
    act(() => current().editor.deleteField(section, "f_height"));
    expect(current().editor.impactPendingDeletion).toMatchObject({
      type: "field",
      field: { id: "f_height" },
      sectionId: section,
    });
    act(() => current().editor.cancelImpactDeletion());
    expect(current().editor.impactPendingDeletion).toBeNull();
    expect(current().history.study).toBe(initial);

    act(() => current().editor.deleteField(section, "f_height"));
    act(() => current().editor.confirmImpactDeletion());
    expect(
      fieldIds(formOf(current().history.study, "form_vs_onc"))
    ).not.toContain("f_height");
    expect(current().selectedFieldId).toBeNull();
  });

  it("keeps the selection when a different referenced field is cascaded", () => {
    const { current, initial } = setup(undefined, {
      formId: "form_vs_onc",
      fieldId: "f_pulse",
    });
    const section = formOf(initial, "form_vs_onc").sections[0].id;
    act(() => current().editor.deleteField(section, "f_weight"));
    act(() => current().editor.confirmImpactDeletion());
    expect(current().selectedFieldId).toBe("f_pulse");
  });

  it("does nothing on confirm with no deletion held", () => {
    const { current, initial } = setup();
    act(() => current().editor.confirmImpactDeletion());
    expect(current().history.study).toBe(initial);
  });

  it("deletes straight away when the referenced field cannot be found", () => {
    const { current } = setup(undefined, { formId: "form_vs_onc" });
    vi.spyOn(StudyProtocolEngine, "previewFieldRemoval").mockReturnValue(
      fromPartial({
        canSafelyDelete: false,
        references: [fromPartial({ type: "rule_target" })],
      })
    );
    act(() => current().editor.deleteField("sec", "missing"));
    expect(current().editor.impactPendingDeletion).toBeNull();
  });

  it("renames a field everywhere and logs a refused rename", () => {
    const { current } = setup(undefined, { formId: "form_vs_onc" });
    act(() => current().editor.renameFieldEverywhere("f_pulse", "PULSERT"));
    expect(fieldIds(formOf(current().history.study, "form_vs_onc"))).toContain(
      "f_pulse"
    );
    expect(
      formOf(current().history.study, "form_vs_onc").sections[0].fields.find(
        (f) => f.id === "f_pulse"
      )?.variableName
    ).toBe("PULSERT");

    const warn = vi
      .spyOn(logger, "warn")
      .mockImplementation(() => fromPartial({}));
    const before = current().history.study;
    act(() => current().editor.renameFieldEverywhere("f_pulse", "HEIGHT"));
    expect(warn).toHaveBeenCalledWith(
      "Failed to rename field everywhere:",
      expect.any(String)
    );
    expect(current().history.study).toBe(before);
  });

  it("saves a codelist, replacing one with the same id", () => {
    const { current, initial } = setup();
    act(() =>
      current().editor.saveCodelist(
        fromPartial({ id: "CL_NY", name: "Yes/No" })
      )
    );
    const codelists = current().history.study.codelists;
    expect(codelists).toHaveLength(initial.codelists.length);
    expect(codelists.at(-1)).toMatchObject({ id: "CL_NY", name: "Yes/No" });
  });
});

describe("useStudyEditor: slash commands", () => {
  const smartBlock = ALL_SLASH_COMMANDS.find(
    (c) => c.action === "insert_smart_block" && c.smartBlockId
  )!;
  const atomic = ALL_SLASH_COMMANDS.find((c) => c.action === "insert_field")!;

  it("inserts a smart block and selects its first field", () => {
    const { current, callbacks } = setup(undefined, { formId: "form_vs_onc" });
    act(() => current().editor.insertSlashCommand(smartBlock));
    expect(current().selectedFieldId).not.toBeNull();
    expect(callbacks.playSuccess).toHaveBeenCalled();
  });

  it("inserts an atomic field at the given spot", () => {
    const { current, callbacks, initial } = setup(undefined, {
      formId: "form_vs_onc",
    });
    const section = formOf(initial, "form_vs_onc").sections[0].id;
    act(() =>
      current().editor.insertSlashCommand(atomic, {
        sectionId: section,
        index: 0,
      })
    );
    const first = formOf(current().history.study, "form_vs_onc").sections[0]
      .fields[0];
    expect(current().selectedFieldId).toBe(first.id);
    expect(callbacks.playSuccess).toHaveBeenCalled();
  });

  it("inserts a section", () => {
    const { current, callbacks } = setup();
    act(() =>
      current().editor.insertSlashCommand(
        fromPartial({ id: "section", action: "insert_section" })
      )
    );
    expect(
      formOf(current().history.study, "form_dm_onc").sections
    ).toHaveLength(3);
    expect(callbacks.playSuccess).toHaveBeenCalled();
  });

  it("does nothing when the engine refuses the insertion", () => {
    const { current, callbacks, initial } = setup();
    vi.spyOn(StudyProtocolEngine, "insertSmartBlock").mockReturnValue(
      fromPartial({ study: initial, insertedFields: [], error: "no" })
    );
    vi.spyOn(StudyProtocolEngine, "insertAtomicSlashField").mockReturnValue(
      fromPartial({ study: initial, error: "no" })
    );
    act(() => current().editor.insertSlashCommand(smartBlock));
    act(() => current().editor.insertSlashCommand(atomic));
    expect(current().history.study).toBe(initial);
    expect(callbacks.playSuccess).not.toHaveBeenCalled();
  });

  it("keeps the selection when a smart block inserts no fields", () => {
    const { current, initial } = setup(undefined, { fieldId: "f_x" });
    vi.spyOn(StudyProtocolEngine, "insertSmartBlock").mockReturnValue(
      fromPartial({ study: { ...initial }, insertedFields: [] })
    );
    act(() => current().editor.insertSlashCommand(smartBlock));
    expect(current().selectedFieldId).toBe("f_x");
    expect(current().history.canUndo).toBe(true);
  });

  it("ignores a smart-block command without a block id", () => {
    const { current, initial } = setup();
    act(() =>
      current().editor.insertSlashCommand(
        fromPartial({ id: "x", action: "insert_smart_block" })
      )
    );
    expect(current().history.study).toBe(initial);
  });
});

describe("useStudyEditor: review threads", () => {
  it("adds a comment and resolves the thread", () => {
    const { current } = setup(undefined, { formId: "form_vs_onc" });
    act(() => current().editor.addReviewComment("f_pulse", "Units?", AUTHOR));
    const threads = () => current().history.study.reviewThreads ?? [];
    expect(threads()).toHaveLength(1);

    act(() =>
      current().editor.setReviewThreadStatus(
        threads()[0].id,
        "resolved",
        AUTHOR
      )
    );
    expect(threads()[0].events.length).toBeGreaterThan(1);

    // An unchanged reviewed field records nothing new.
    const before = current().history.study;
    act(() => current().editor.commitReviewTargetChange("f_pulse"));
    expect(current().history.study).toBe(before);
  });

  it("commits nothing for a field without a review thread", () => {
    const { current, initial } = setup();
    act(() => current().editor.commitReviewTargetChange("f_pulse"));
    expect(current().history.study).toBe(initial);
  });

  it("applies a reviewed edit or rename to the field's own form", () => {
    const { current } = setup();
    act(() =>
      current().editor.commitReviewTargetChange("f_pulse", {
        label: "Heart rate",
      })
    );
    const pulse = () =>
      formOf(current().history.study, "form_vs_onc").sections[0].fields.find(
        (f) => f.id === "f_pulse"
      )!;
    expect(pulse().label).toBe("Heart rate");

    act(() =>
      current().editor.commitReviewTargetChange("f_pulse", {
        variableName: "HR",
        label: "HR",
      })
    );
    expect(pulse().variableName).toBe("HR");
  });

  it("ignores a reviewed edit or rename the engine refuses", () => {
    const { current, initial } = setup();
    act(() =>
      current().editor.commitReviewTargetChange("f_pulse", {
        variableName: "HEIGHT",
      })
    );
    expect(current().history.study).toBe(initial);

    vi.spyOn(StudyProtocolEngine, "updateField").mockReturnValue({
      study: initial,
      error: "nope",
    });
    act(() =>
      current().editor.commitReviewTargetChange("f_pulse", { label: "x" })
    );
    expect(current().history.study).toBe(initial);
  });

  it("records a target change when the field is on no form", () => {
    const { current, initial } = setup();
    act(() =>
      current().editor.commitReviewTargetChange("missing", { label: "x" })
    );
    expect(current().history.study).toBe(initial);
  });

  it("changes the reviewing author", () => {
    const { current } = setup();
    act(() =>
      current().editor.setReviewAuthor({ name: "Ana", role: "Medical Monitor" })
    );
    expect(current().editor.reviewAuthor).toEqual({
      name: "Ana",
      role: "Medical Monitor",
    });
  });
});

describe("useStudyEditor: whole study", () => {
  it("loads a study straight away while the draft is clean", () => {
    const { current } = setup(undefined, {
      formId: "form_vs_onc",
      visitId: "v_eos",
      fieldId: "f_x",
    });
    const target = getOncologyPresetSync();
    act(() => current().editor.requestStudyReplacement(target, "Imported"));
    expect(current().history.study).toBe(target);
    expect(current().history.baselineStudy).toBe(target);
    expect(current().activeFormId).toBe("form_dm_onc");
    expect(current().activeVisitId).toBe("v_screen");
    expect(current().selectedFieldId).toBeNull();
    expect(current().editor.pendingStudyReplacement).toBeNull();
  });

  it("asks first when the draft has unsaved changes", () => {
    const { current } = setup();
    act(() => current().editor.addSection());
    const target = getOncologyPresetSync();
    act(() => current().editor.requestStudyReplacement(target, "Imported"));
    expect(current().editor.pendingStudyReplacement).toEqual({
      targetStudy: target,
      label: "Imported",
    });
    expect(current().history.study).not.toBe(target);

    act(() => current().editor.cancelStudyReplacement());
    expect(current().editor.pendingStudyReplacement).toBeNull();
  });

  it("discards the draft or snapshots it before replacing", () => {
    const { current } = setup();
    act(() => current().editor.addSection());
    const draft = current().history.study;

    const first = getOncologyPresetSync();
    act(() => current().editor.requestStudyReplacement(first, "Wizard"));
    act(() =>
      current().editor.confirmStudyReplacement({ saveSnapshot: false })
    );
    expect(current().history.study).toBe(first);
    expect(drafts.snapshot).not.toHaveBeenCalled();

    act(() => current().editor.addSection());
    const edited = current().history.study;
    const second = getOncologyPresetSync();
    act(() => current().editor.requestStudyReplacement(second, "Preset X"));
    act(() => current().editor.confirmStudyReplacement({ saveSnapshot: true }));
    expect(drafts.snapshot).toHaveBeenCalledWith(
      edited,
      "Snapshot before loading Preset X"
    );
    expect(drafts.draft).toHaveBeenCalledWith(edited);
    expect(current().history.study).toBe(second);
    expect(current().editor.pendingStudyReplacement).toBeNull();
    expect(draft).not.toBe(edited);
  });

  it("does nothing on confirm with no replacement held", () => {
    const { current, initial } = setup();
    act(() => current().editor.confirmStudyReplacement({ saveSnapshot: true }));
    expect(current().history.study).toBe(initial);
    expect(drafts.snapshot).not.toHaveBeenCalled();
  });

  it("loads a preset by id and ignores an unknown one", () => {
    const { current, initial } = setup();
    act(() => current().editor.selectPreset("unknown"));
    expect(current().history.study).toBe(initial);
    act(() => current().editor.selectPreset("custom_blank"));
    expect(current().history.study).not.toBe(initial);
  });

  it("restores a baseline as a fresh draft", () => {
    const { current, callbacks } = setup(undefined, { fieldId: "f_x" });
    act(() => current().editor.addSection());
    const restored = getOncologyPresetSync();
    act(() =>
      current().editor.restoreBaselineAsDraft(
        restored,
        fromPartial<StudyBaseline>({ versionTag: "v1.0" })
      )
    );
    expect(current().history.study).toBe(restored);
    expect(current().history.canUndo).toBe(false);
    expect(current().selectedFieldId).toBeNull();
    expect(callbacks.playSuccess).toHaveBeenCalled();
    expect(callbacks.toast.success).toHaveBeenCalledWith(
      "Restored draft from baseline v1.0"
    );
  });

  it("applies an outside update, keeping the open form when it survives", () => {
    const { current, initial } = setup(undefined, { formId: "form_vs_onc" });
    act(() =>
      current().editor.applyStudyUpdate({ ...initial, studyName: "Edited" })
    );
    expect(current().activeFormId).toBe("form_vs_onc");

    act(() =>
      current().editor.applyStudyUpdate({
        ...initial,
        forms: initial.forms.filter((f) => f.id !== "form_vs_onc"),
      })
    );
    expect(current().activeFormId).toBe("form_dm_onc");

    act(() => current().editor.applyStudyUpdate({ ...initial, forms: [] }));
    expect(current().activeFormId).toBe("form_dm_onc");
  });

  it("updates branding as an undoable step", () => {
    const { current } = setup();
    act(() =>
      current().editor.updateBranding(fromPartial({ primaryColor: "#123456" }))
    );
    expect(current().history.study.branding).toEqual({
      primaryColor: "#123456",
    });
    expect(current().history.canUndo).toBe(true);
  });

  it("records simulator state without an undo step", () => {
    const { current } = setup();
    const state = fromPartial<StudyProtocol["simulationState"]>({});
    act(() => current().editor.updateSimulationState(state!));
    expect(current().history.study.simulationState).toBe(state);
    expect(current().history.canUndo).toBe(false);

    const same = current().history.study;
    act(() => current().editor.updateSimulationState(state!));
    expect(current().history.study).toBe(same);
  });
});

describe("useStudyEditor: a study with no forms", () => {
  it("ignores form-scoped edits", () => {
    const base = getOncologyPresetSync();
    const empty = { ...base, forms: [] };
    const { current } = setup(empty);
    const editor = current().editor;
    expect(editor.activeForm).toBeUndefined();
    act(() => {
      editor.updateFormMeta({ name: "x" });
      editor.addSection();
      editor.deleteSection("s");
      editor.updateSectionTitle("s", "t");
      editor.addField(newField("X"));
      editor.insertSlashCommand(ALL_SLASH_COMMANDS[0]);
      editor.updateField("f", {});
      editor.duplicateField("s", "f");
      editor.duplicateFieldById("f");
      editor.deleteField("s", "f");
      editor.renameFieldEverywhere("f", "Y");
    });
    expect(current().history.study).toBe(empty);
  });
});
