// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FormCanvas } from "@/components/crf/CenterCanvas/FormCanvas";
import { CRFForm, CodelistDefinition } from "@/lib/crf/types";

describe("FormCanvas & FieldRenderer Component Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockForm: CRFForm = {
    id: "form_test_canvas",
    name: "Vital Signs & Demographics",
    domain: "VS",
    description: "Vital signs panel",
    version: "1.0",
    rules: [],
    sections: [
      {
        id: "sec_1",
        title: "Subject Measurements",
        fields: [
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
        ],
      },
    ],
  };

  const mockCodelists: CodelistDefinition[] = [];

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    if (container.parentNode) {
      document.body.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  it("renders form title, sections, and fields in 12-column grid layout", async () => {
    await act(async () => {
      root.render(
        <FormCanvas
          form={mockForm}
          selectedFieldId={null}
          viewport="desktop"
          codelists={mockCodelists}
          onChangeViewport={vi.fn()}
          onSelectField={vi.fn()}
          onUpdateFormMeta={vi.fn()}
          onAddSection={vi.fn()}
          onDeleteSection={vi.fn()}
          onUpdateSectionTitle={vi.fn()}
          onDuplicateField={vi.fn()}
          onDeleteField={vi.fn()}
          onOpenPalette={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain("Vital Signs & Demographics");
    expect(container.textContent).toContain("Subject Measurements");
    expect(container.textContent).toContain("HEIGHT");
    expect(container.textContent).toContain("WEIGHT");
  });

  it("handles field selection on click", async () => {
    const onSelectField = vi.fn();

    await act(async () => {
      root.render(
        <FormCanvas
          form={mockForm}
          selectedFieldId={null}
          viewport="desktop"
          codelists={mockCodelists}
          onChangeViewport={vi.fn()}
          onSelectField={onSelectField}
          onUpdateFormMeta={vi.fn()}
          onAddSection={vi.fn()}
          onDeleteSection={vi.fn()}
          onUpdateSectionTitle={vi.fn()}
          onDuplicateField={vi.fn()}
          onDeleteField={vi.fn()}
          onOpenPalette={vi.fn()}
        />
      );
    });

    const heightField = container.querySelector('[data-field-id="f_height"]');
    expect(heightField).not.toBeNull();

    await act(async () => {
      heightField?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSelectField).toHaveBeenCalledWith("f_height");
  });

  it("handles column span adjustment (+ and - buttons)", async () => {
    const onUpdateField = vi.fn();

    await act(async () => {
      root.render(
        <FormCanvas
          form={mockForm}
          selectedFieldId="f_height"
          viewport="desktop"
          codelists={mockCodelists}
          onChangeViewport={vi.fn()}
          onSelectField={vi.fn()}
          onUpdateFormMeta={vi.fn()}
          onAddSection={vi.fn()}
          onDeleteSection={vi.fn()}
          onUpdateSectionTitle={vi.fn()}
          onDuplicateField={vi.fn()}
          onDeleteField={vi.fn()}
          onUpdateField={onUpdateField}
          onOpenPalette={vi.fn()}
        />
      );
    });

    // Find column increment button
    const plusBtn = container.querySelector(
      'button[data-tooltip="Expand column span"]'
    );
    expect(plusBtn).not.toBeNull();

    await act(async () => {
      plusBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onUpdateField).toHaveBeenCalledWith("f_height", { columnSpan: 7 });

    // Find column decrement button
    const minusBtn = container.querySelector(
      'button[data-tooltip="Shrink column span"]'
    );
    expect(minusBtn).not.toBeNull();

    await act(async () => {
      minusBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onUpdateField).toHaveBeenCalledWith("f_height", { columnSpan: 5 });
  });

  it("allows deleting and duplicating fields from field action controls", async () => {
    const onDeleteField = vi.fn();
    const onDuplicateField = vi.fn();

    await act(async () => {
      root.render(
        <FormCanvas
          form={mockForm}
          selectedFieldId="f_height"
          viewport="desktop"
          codelists={mockCodelists}
          onChangeViewport={vi.fn()}
          onSelectField={vi.fn()}
          onUpdateFormMeta={vi.fn()}
          onAddSection={vi.fn()}
          onDeleteSection={vi.fn()}
          onUpdateSectionTitle={vi.fn()}
          onDuplicateField={onDuplicateField}
          onDeleteField={onDeleteField}
          onOpenPalette={vi.fn()}
        />
      );
    });

    const duplicateBtn = container.querySelector(
      'button[data-tooltip="Duplicate Field"]'
    );
    expect(duplicateBtn).not.toBeNull();

    await act(async () => {
      duplicateBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onDuplicateField).toHaveBeenCalledWith("sec_1", "f_height");

    const deleteBtn = container.querySelector(
      'button[data-tooltip="Delete Field"]'
    );
    expect(deleteBtn).not.toBeNull();

    await act(async () => {
      deleteBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onDeleteField).toHaveBeenCalledWith("sec_1", "f_height");
  });

  // Regression coverage for #669: the "Add Field" triggers used to open the
  // palette with no section context, so CRFStudioContainer.handleAddField
  // always inserted the picked widget into the form's first section
  // regardless of which section's control the author actually used.
  it("carries the section id to onOpenPalette from a populated section's insertion control when no slash palette is wired (#669)", async () => {
    const onOpenPalette = vi.fn();

    await act(async () => {
      root.render(
        <FormCanvas
          form={mockForm}
          selectedFieldId={null}
          viewport="desktop"
          codelists={mockCodelists}
          onChangeViewport={vi.fn()}
          onSelectField={vi.fn()}
          onUpdateFormMeta={vi.fn()}
          onAddSection={vi.fn()}
          onDeleteSection={vi.fn()}
          onUpdateSectionTitle={vi.fn()}
          onDuplicateField={vi.fn()}
          onDeleteField={vi.fn()}
          onOpenPalette={onOpenPalette}
        />
      );
    });

    const addFieldBtn = container.querySelector(
      'button[aria-label="Add field to Subject Measurements"]'
    ) as HTMLButtonElement;
    expect(addFieldBtn).not.toBeNull();
    expect(addFieldBtn.tagName).toBe("BUTTON");

    await act(async () => {
      addFieldBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenPalette).toHaveBeenCalledWith("sec_1");
  });

  it("prefers the slash palette (with section id and end index) over the plain palette when wired, for a populated section's insertion control (#669)", async () => {
    const onOpenPalette = vi.fn();
    const onOpenSlashPalette = vi.fn();

    await act(async () => {
      root.render(
        <FormCanvas
          form={mockForm}
          selectedFieldId={null}
          viewport="desktop"
          codelists={mockCodelists}
          onChangeViewport={vi.fn()}
          onSelectField={vi.fn()}
          onUpdateFormMeta={vi.fn()}
          onAddSection={vi.fn()}
          onDeleteSection={vi.fn()}
          onUpdateSectionTitle={vi.fn()}
          onDuplicateField={vi.fn()}
          onDeleteField={vi.fn()}
          onOpenPalette={onOpenPalette}
          onOpenSlashPalette={onOpenSlashPalette}
        />
      );
    });

    const addFieldBtn = container.querySelector(
      'button[aria-label="Add field to Subject Measurements"]'
    ) as HTMLButtonElement;
    expect(addFieldBtn).not.toBeNull();

    await act(async () => {
      addFieldBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // mockForm's "Subject Measurements" section has 2 fields, so a new one
    // inserted from this control must land at the end (index 2), not always
    // index 0 or the form's first section.
    expect(onOpenSlashPalette).toHaveBeenCalledWith("sec_1", 2);
    expect(onOpenPalette).not.toHaveBeenCalled();
  });

  it("carries the section id when opening the palette from an empty section's placeholder, as a keyboard-operable button (#669)", async () => {
    const onOpenPalette = vi.fn();
    const formWithEmptySection: CRFForm = {
      ...mockForm,
      sections: [
        ...mockForm.sections,
        { id: "sec_2", title: "Follow-up Notes", fields: [] },
      ],
    };

    await act(async () => {
      root.render(
        <FormCanvas
          form={formWithEmptySection}
          selectedFieldId={null}
          viewport="desktop"
          codelists={mockCodelists}
          onChangeViewport={vi.fn()}
          onSelectField={vi.fn()}
          onUpdateFormMeta={vi.fn()}
          onAddSection={vi.fn()}
          onDeleteSection={vi.fn()}
          onUpdateSectionTitle={vi.fn()}
          onDuplicateField={vi.fn()}
          onDeleteField={vi.fn()}
          onOpenPalette={onOpenPalette}
        />
      );
    });

    const emptySectionEl = container.querySelector(
      '[data-section-id="sec_2"]'
    ) as HTMLElement;
    expect(emptySectionEl).not.toBeNull();
    expect(emptySectionEl.textContent).toContain(
      "No fields in this section yet."
    );

    const addFieldBtn = emptySectionEl.querySelector(
      'button[aria-label="Add field to Follow-up Notes"]'
    ) as HTMLButtonElement;
    expect(addFieldBtn).not.toBeNull();
    expect(addFieldBtn.tagName).toBe("BUTTON");

    await act(async () => {
      addFieldBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenPalette).toHaveBeenCalledWith("sec_2");
  });
});
