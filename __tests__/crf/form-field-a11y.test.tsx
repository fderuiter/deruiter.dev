// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import axe from "axe-core";
import { FormField } from "@/components/crf/FormField";
import { FieldPropertiesTab } from "@/components/crf/RightInspector/FieldPropertiesTab";
import { CdiscMetadataTab } from "@/components/crf/RightInspector/CdiscMetadataTab";
import { BrandingConfigModal } from "@/components/crf/Branding/BrandingConfigModal";
import { StudioTerminal } from "@/components/crf/Terminal/StudioTerminal";
import { getOncologyPresetSync } from "@/lib/crf";
import type { CRFField, CRFForm } from "@/lib/crf";

const study = getOncologyPresetSync();
const sampleForm: CRFForm = study.forms[0];
const sampleField: CRFField = sampleForm.sections[0].fields[0];

// jsdom cannot compute pseudo-element styles and reports every attempt as
// "Not implemented". axe asks for them, so answer with the element's own
// style.
beforeEach(() => {
  const computed = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
    computed(element)
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FormField Component", () => {
  it("generates unique identifier and associates semantic label via htmlFor", () => {
    const { container } = render(
      <FormField label="Subject Demographics">
        <input type="text" />
      </FormField>
    );

    const label = container.querySelector("label");
    const input = container.querySelector("input");

    expect(label).not.toBeNull();
    expect(input).not.toBeNull();
    expect(label?.getAttribute("for")).toBeTruthy();
    expect(input?.getAttribute("id")).toBe(label?.getAttribute("for"));
    expect(screen.getByLabelText("Subject Demographics")).toBe(input);
  });

  it("respects custom id prop when provided", () => {
    const { container } = render(
      <FormField id="custom-field-id" label="Custom Field">
        <input type="text" />
      </FormField>
    );

    const label = container.querySelector("label");
    const input = container.querySelector("input");

    expect(label?.getAttribute("for")).toBe("custom-field-id");
    expect(input?.getAttribute("id")).toBe("custom-field-id");
  });

  it("renders required indicator and passes required to child control", () => {
    const { container } = render(
      <FormField label="Protocol Number" required>
        <input type="text" />
      </FormField>
    );

    const label = container.querySelector("label");
    const input = container.querySelector("input");

    expect(label?.textContent).toContain("Protocol Number");
    expect(label?.textContent).toContain("*");
    expect(input?.hasAttribute("required")).toBe(true);
  });

  it("binds error and description via aria-describedby and sets aria-invalid='true'", () => {
    const { container } = render(
      <FormField
        label="Investigator Code"
        description="Must be 4 digits"
        error="Invalid investigator format"
      >
        <input type="text" />
      </FormField>
    );

    const input = container.querySelector("input");
    const errorEl = container.querySelector("[role='alert']");
    const descEl = container.querySelector("p:not([role='alert'])");

    expect(input).not.toBeNull();
    expect(errorEl).not.toBeNull();
    expect(descEl).not.toBeNull();

    expect(input?.getAttribute("aria-invalid")).toBe("true");

    const describedBy = input?.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(describedBy).toContain(errorEl?.id);
    expect(describedBy).toContain(descEl?.id);

    expect(errorEl?.getAttribute("aria-live")).toBe("polite");
    expect(errorEl?.textContent).toBe("Invalid investigator format");
    expect(descEl?.textContent).toBe("Must be 4 digits");
  });

  it("supports render-prop children passing control props", () => {
    render(
      <FormField
        label="Clinical Site"
        description="Site location code"
        error="Site required"
      >
        {({
          id,
          "aria-describedby": ariaDescribedBy,
          "aria-invalid": ariaInvalid,
        }) => (
          <input
            id={id}
            aria-describedby={ariaDescribedBy}
            aria-invalid={ariaInvalid}
            data-testid="render-prop-input"
          />
        )}
      </FormField>
    );

    const input = screen.getByTestId("render-prop-input");
    expect(input.id).toBeTruthy();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByLabelText("Clinical Site")).toBe(input);
  });

  it("renders labelExtra outside of the label element to avoid invalid nested interactive elements", () => {
    const { container } = render(
      <FormField
        label="Variable Counter"
        labelExtra={<button type="button">Extra Action</button>}
      >
        <input type="text" />
      </FormField>
    );

    const label = container.querySelector("label");
    const button = container.querySelector("button");

    expect(label).not.toBeNull();
    expect(button).not.toBeNull();
    expect(label?.contains(button)).toBe(false);
  });

  it("passes axe-core accessibility audit with zero violations", async () => {
    const { container } = render(
      <div>
        <FormField label="Field A" required description="Description A">
          <input type="text" />
        </FormField>
        <FormField
          label="Field B"
          error="Error B"
          labelExtra={<span>0/8 chars</span>}
        >
          <textarea />
        </FormField>
      </div>
    );

    const results = await axe.run(container);
    const labelViolations = results.violations.filter((v) =>
      ["label", "aria-valid-attr-value", "aria-allowed-attr"].includes(v.id)
    );
    expect(labelViolations).toEqual([]);
  });
});

describe("FieldPropertiesTab Accessibility Integration", () => {
  it("associates labels via htmlFor for all inputs, selects, and textareas in L409-L511", () => {
    const { container } = render(
      <FieldPropertiesTab
        field={sampleField}
        allFieldsInForm={sampleForm.sections[0].fields}
        codelists={study.codelists ?? []}
        onUpdateField={vi.fn()}
      />
    );

    // 1. Variable Name input
    const varInput = screen.getByPlaceholderText(
      "e.g. BRTHYR, SYSBP, AETERM, DITERM"
    );
    expect(varInput.id).toBeTruthy();
    const varLabel = container.querySelector(`label[for="${varInput.id}"]`);
    expect(varLabel).not.toBeNull();
    expect(varLabel?.textContent).toContain("CDASH / SDTM Variable Name");

    // 2. Question Text / Form Label input
    const questionInput = screen.getByPlaceholderText(
      "e.g. Primary Device Deficiency Classification"
    );
    expect(questionInput.id).toBeTruthy();
    const questionLabel = container.querySelector(
      `label[for="${questionInput.id}"]`
    );
    expect(questionLabel).not.toBeNull();
    expect(questionLabel?.textContent).toContain("Question Text / Form Label");

    // 3. Instruction / Clinical Description textarea
    const descTextarea = screen.getByPlaceholderText(
      "e.g. Select the primary reason observed during procedure."
    );
    expect(descTextarea.id).toBeTruthy();
    const descLabel = container.querySelector(
      `label[for="${descTextarea.id}"]`
    );
    expect(descLabel).not.toBeNull();
    expect(descLabel?.textContent).toContain(
      "Instruction / Clinical Description"
    );

    // 4. Data Type select
    const dataTypeLabel = Array.from(container.querySelectorAll("label")).find(
      (l) => l.textContent?.includes("Data Type")
    );
    expect(dataTypeLabel).toBeDefined();
    const dataTypeSelect = container.querySelector(
      `select#${dataTypeLabel?.getAttribute("for")}`
    );
    expect(dataTypeSelect).not.toBeNull();

    // 5. Grid Width select
    const gridWidthLabel = Array.from(container.querySelectorAll("label")).find(
      (l) => l.textContent?.includes("Grid Width")
    );
    expect(gridWidthLabel).toBeDefined();
    const gridWidthSelect = container.querySelector(
      `select#${gridWidthLabel?.getAttribute("for")}`
    );
    expect(gridWidthSelect).not.toBeNull();
  });

  it("sets aria-invalid='true' and aria-describedby when CDASH variable validation fails", () => {
    const { container } = render(
      <FieldPropertiesTab
        field={sampleField}
        allFieldsInForm={sampleForm.sections[0].fields}
        codelists={study.codelists ?? []}
        onUpdateField={vi.fn()}
      />
    );

    const varInput = screen.getByPlaceholderText(
      "e.g. BRTHYR, SYSBP, AETERM, DITERM"
    );

    // Enter invalid variable name (starts with digit)
    fireEvent.change(varInput, { target: { value: "1INVALID" } });

    expect(varInput.getAttribute("aria-invalid")).toBe("true");
    const errorId = varInput.getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();

    const errorEl = container.querySelector(`[id="${errorId}"]`);
    expect(errorEl).not.toBeNull();
    expect(errorEl?.getAttribute("role")).toBe("alert");
    expect(errorEl?.textContent).toContain("must start with a letter");
  });

  it("passes axe-core audit with zero form label violations", async () => {
    const { container } = render(
      <FieldPropertiesTab
        field={sampleField}
        allFieldsInForm={sampleForm.sections[0].fields}
        codelists={study.codelists ?? []}
        onUpdateField={vi.fn()}
      />
    );

    const results = await axe.run(container);
    const formViolations = results.violations.filter((v) =>
      ["label", "aria-valid-attr-value", "aria-allowed-attr"].includes(v.id)
    );
    expect(formViolations).toEqual([]);
  });
});

describe("CdiscMetadataTab Accessibility Integration", () => {
  it("associates labels via htmlFor for all inputs and selects in L84-L163", () => {
    const { container } = render(
      <CdiscMetadataTab
        field={sampleField}
        form={sampleForm}
        onUpdateField={vi.fn()}
      />
    );

    // 1. SDTM Target Domain
    const domainLabel = Array.from(container.querySelectorAll("label")).find(
      (l) => l.textContent?.includes("SDTM Target Domain")
    );
    expect(domainLabel).toBeDefined();
    const domainInput = container.querySelector(
      `input#${domainLabel?.getAttribute("for")}`
    );
    expect(domainInput).not.toBeNull();

    // 2. SDTM Variable
    const sdtmVarLabel = Array.from(container.querySelectorAll("label")).find(
      (l) => l.textContent?.includes("SDTM Variable")
    );
    expect(sdtmVarLabel).toBeDefined();
    const sdtmVarInput = container.querySelector(
      `input#${sdtmVarLabel?.getAttribute("for")}`
    );
    expect(sdtmVarInput).not.toBeNull();

    // 3. CDASH Core Requirement
    const coreLabel = Array.from(container.querySelectorAll("label")).find(
      (l) => l.textContent?.includes("CDASH Core Requirement")
    );
    expect(coreLabel).toBeDefined();
    const coreSelect = container.querySelector(
      `select#${coreLabel?.getAttribute("for")}`
    );
    expect(coreSelect).not.toBeNull();

    // 4. NCI Concept ID
    const nciLabel = Array.from(container.querySelectorAll("label")).find((l) =>
      l.textContent?.includes("NCI Concept ID")
    );
    expect(nciLabel).toBeDefined();
    const nciInput = container.querySelector(
      `input#${nciLabel?.getAttribute("for")}`
    );
    expect(nciInput).not.toBeNull();

    // 5. Annotated CRF Text Overlay
    const acrfLabel = Array.from(container.querySelectorAll("label")).find(
      (l) => l.textContent?.includes("Annotated CRF (aCRF) Text Overlay")
    );
    expect(acrfLabel).toBeDefined();
    const acrfInput = container.querySelector(
      `input#${acrfLabel?.getAttribute("for")}`
    );
    expect(acrfInput).not.toBeNull();

    // Description linkage
    const descId = acrfInput?.getAttribute("aria-describedby");
    expect(descId).toBeTruthy();
    const descEl = container.querySelector(`p#${descId}`);
    expect(descEl?.textContent).toContain("Annotated CRF overlay");
  });

  it("passes axe-core audit with zero form label violations", async () => {
    const { container } = render(
      <CdiscMetadataTab
        field={sampleField}
        form={sampleForm}
        onUpdateField={vi.fn()}
      />
    );

    const results = await axe.run(container);
    const formViolations = results.violations.filter((v) =>
      ["label", "aria-valid-attr-value", "aria-allowed-attr"].includes(v.id)
    );
    expect(formViolations).toEqual([]);
  });
});

describe("BrandingConfigModal Accessibility Integration", () => {
  it("ensures every form control has programmatic label association", () => {
    const { container } = render(
      <BrandingConfigModal onSave={vi.fn()} onClose={vi.fn()} />
    );

    // Organization / Sponsor Name
    const orgLabel = Array.from(container.querySelectorAll("label")).find((l) =>
      l.textContent?.includes("Organization / Sponsor Name")
    );
    expect(orgLabel).toBeDefined();
    const orgInput = container.querySelector(
      `input#${orgLabel?.getAttribute("for")}`
    );
    expect(orgInput).not.toBeNull();

    // Sponsor Logo file input
    const logoLabel = Array.from(container.querySelectorAll("label")).find(
      (l) => l.textContent?.includes("Sponsor Logo")
    );
    expect(logoLabel).toBeDefined();
    const logoInput = container.querySelector(
      `input#${logoLabel?.getAttribute("for")}`
    );
    expect(logoInput).not.toBeNull();
    expect(logoInput?.getAttribute("type")).toBe("file");

    // Primary Brand Color
    const primaryLabel = Array.from(container.querySelectorAll("label")).find(
      (l) => l.textContent?.includes("Primary Brand Color")
    );
    expect(primaryLabel).toBeDefined();
    const primaryTextInput = container.querySelector(
      `input#${primaryLabel?.getAttribute("for")}`
    );
    expect(primaryTextInput).not.toBeNull();
    const primaryColorInput = screen.getByLabelText(
      "Primary Brand Color picker"
    );
    expect(primaryColorInput).not.toBeNull();

    // Accent Highlight Color
    const accentLabel = Array.from(container.querySelectorAll("label")).find(
      (l) => l.textContent?.includes("Accent Highlight Color")
    );
    expect(accentLabel).toBeDefined();
    const accentTextInput = container.querySelector(
      `input#${accentLabel?.getAttribute("for")}`
    );
    expect(accentTextInput).not.toBeNull();
    const accentColorInput = screen.getByLabelText(
      "Accent Highlight Color picker"
    );
    expect(accentColorInput).not.toBeNull();

    // Header Running Text
    const headerLabel = Array.from(container.querySelectorAll("label")).find(
      (l) => l.textContent?.includes("Header Running Text")
    );
    expect(headerLabel).toBeDefined();
    const headerInput = container.querySelector(
      `input#${headerLabel?.getAttribute("for")}`
    );
    expect(headerInput).not.toBeNull();

    // Footer Running Text
    const footerLabel = Array.from(container.querySelectorAll("label")).find(
      (l) => l.textContent?.includes("Footer Running Text")
    );
    expect(footerLabel).toBeDefined();
    const footerInput = container.querySelector(
      `input#${footerLabel?.getAttribute("for")}`
    );
    expect(footerInput).not.toBeNull();

    // Confidentiality Disclaimer
    const disclaimerLabel = Array.from(
      container.querySelectorAll("label")
    ).find((l) => l.textContent?.includes("Confidentiality Disclaimer"));
    expect(disclaimerLabel).toBeDefined();
    const disclaimerTextarea = container.querySelector(
      `textarea#${disclaimerLabel?.getAttribute("for")}`
    );
    expect(disclaimerTextarea).not.toBeNull();
  });

  it("passes axe-core audit with zero form label violations", async () => {
    const { container } = render(
      <BrandingConfigModal onSave={vi.fn()} onClose={vi.fn()} />
    );

    const results = await axe.run(container);
    const formViolations = results.violations.filter((v) =>
      ["label", "aria-valid-attr-value", "aria-allowed-attr"].includes(v.id)
    );
    expect(formViolations).toEqual([]);
  });
});

describe("StudioTerminal Accessibility Integration", () => {
  it("provides accessible name for terminal command input via aria-label", () => {
    render(
      <StudioTerminal
        isOpen={true}
        study={study}
        onClose={vi.fn()}
        onUpdateStudy={vi.fn()}
      />
    );

    const input = screen.getByLabelText("Terminal command input");
    expect(input).toBeDefined();
    expect(input.tagName.toLowerCase()).toBe("input");
  });

  it("passes axe-core audit with zero form label violations", async () => {
    const { container } = render(
      <StudioTerminal
        isOpen={true}
        study={study}
        onClose={vi.fn()}
        onUpdateStudy={vi.fn()}
      />
    );

    const results = await axe.run(container);
    const formViolations = results.violations.filter((v) =>
      ["label", "aria-valid-attr-value", "aria-allowed-attr"].includes(v.id)
    );
    expect(formViolations).toEqual([]);
  });
});
