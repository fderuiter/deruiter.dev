// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getOncologyPresetSync } from "@/lib/crf";
import type { CRFField, CRFForm, StudyReviewActor } from "@/lib/crf";
import { InspectorPanel } from "@/components/crf/RightInspector/InspectorPanel";

const study = getOncologyPresetSync();
function dmFormOf(): CRFForm {
  const form = study.forms.find((f) => f.id === "form_dm_onc");
  if (!form) throw new Error("Preset is missing form_dm_onc");
  return form;
}
const dmForm = dmFormOf();
const dmFields = dmForm.sections.flatMap((s) => s.fields);

function fieldByVar(variableName: string): CRFField {
  const field = dmFields.find((f) => f.variableName === variableName);
  if (!field) throw new Error(`Preset is missing ${variableName}`);
  return field;
}

const sex = fieldByVar("SEX");
const customRadio: CRFField = {
  ...fieldByVar("ICYN"),
  dataType: "radio",
  codelistId: undefined,
  customOptions: [
    { code: "MILD", label: "Mild", order: 1 },
    { code: "SEVERE", label: "Severe", order: 2 },
  ],
};

const author: StudyReviewActor = { name: "Reviewer", role: "Data Manager" };

function panel(selectedField: CRFField) {
  return (
    <InspectorPanel
      form={dmForm}
      selectedField={selectedField}
      codelists={study.codelists ?? []}
      onClose={vi.fn()}
      onUpdateField={vi.fn()}
      onUpdateFormMeta={vi.fn()}
      onUpdateRules={vi.fn()}
      reviewAuthor={author}
      onReviewAuthorChange={vi.fn()}
      onAddReviewComment={vi.fn()}
      onSetReviewThreadStatus={vi.fn()}
      onCommitReviewTargetChange={vi.fn()}
    />
  );
}

afterEach(() => {
  cleanup();
});

describe("InspectorPanel field switching", () => {
  // Regression for #2577: the Standard/Custom option mode was chosen only
  // when the properties tab mounted, so it stuck when another field was
  // selected.
  it("shows the standard codelist preview after moving from a custom-options field", () => {
    const sexCodelist = study.codelists?.find((cl) => cl.id === "CL_SEX");
    if (!sexCodelist) throw new Error("Preset is missing CL_SEX");
    expect(sex.codelistId).toBe("CL_SEX");

    const { rerender } = render(panel(customRadio));
    expect(
      screen.getByRole("button", { name: /Custom Options \(2\)/ }).className
    ).toContain("text-brand-cyan");

    rerender(panel(sex));
    expect(
      screen.getByRole("button", { name: /Standard Codelist/ }).className
    ).toContain("text-brand-cyan");
    expect(screen.getByText("Preview Choices:")).toBeTruthy();
    for (const opt of sexCodelist.options) {
      expect(screen.getByText(`(${opt.code})`)).toBeTruthy();
    }
  });
});
