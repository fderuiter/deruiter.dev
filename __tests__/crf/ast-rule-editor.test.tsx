// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AstRuleEditor } from "@/components/crf/RightInspector/AstRuleEditor";
import { CRFField } from "@/lib/crf/types";

import { getByTooltip } from "../helpers/tooltip";
describe("AstRuleEditor Component", () => {
  afterEach(() => {
    cleanup();
  });

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
      id: "f_notes",
      variableName: "NOTES",
      label: "Investigator Notes",
      dataType: "text",
      columnSpan: 12,
      required: false,
    },
  ];

  it("renders formula input with label, placeholder, and initial status", () => {
    const handleChange = vi.fn();
    render(
      <AstRuleEditor
        formula=""
        onChange={handleChange}
        fields={sampleFields}
        label="AST Dynamic Formula"
      />
    );

    expect(screen.getByText("AST Dynamic Formula")).toBeTruthy();
    expect(
      screen.getByPlaceholderText("e.g. weight / ((height/100) * (height/100))")
    ).toBeTruthy();
    expect(screen.getByText("Ready to compose")).toBeTruthy();
  });

  it("updates formula when user types in textarea", () => {
    const handleChange = vi.fn();
    render(
      <AstRuleEditor
        formula="HEIGHT +"
        onChange={handleChange}
        fields={sampleFields}
      />
    );

    const textarea = screen.getByRole("textbox", { name: "AST Formula Input" });
    fireEvent.change(textarea, { target: { value: "HEIGHT + WEIGHT" } });

    expect(handleChange).toHaveBeenCalledWith("HEIGHT + WEIGHT");
  });

  it("displays syntax error diagnostics for trailing operators", () => {
    render(
      <AstRuleEditor
        formula="HEIGHT +"
        onChange={vi.fn()}
        fields={sampleFields}
      />
    );

    expect(
      screen.getByText(/Expression ends unexpectedly with trailing "\+"/)
    ).toBeTruthy();
    expect(screen.getByText(/1 Error/)).toBeTruthy();
  });

  it("displays warnings for non-numeric field references", () => {
    render(
      <AstRuleEditor
        formula="HEIGHT + NOTES"
        onChange={vi.fn()}
        fields={sampleFields}
      />
    );

    expect(screen.getByText(/has non-numeric type "text"/)).toBeTruthy();
    expect(screen.getByText(/1 Warning/)).toBeTruthy();
  });

  it("inserts variable token when clicking a variable badge", () => {
    const handleChange = vi.fn();
    render(
      <AstRuleEditor
        formula="HEIGHT +"
        onChange={handleChange}
        fields={sampleFields}
      />
    );

    const weightBtn = getByTooltip("Weight (number)");
    fireEvent.click(weightBtn);

    expect(handleChange).toHaveBeenCalled();
  });

  it("allows selecting clinical presets", () => {
    const handleChange = vi.fn();
    render(
      <AstRuleEditor formula="" onChange={handleChange} fields={sampleFields} />
    );

    const presetsBtn = getByTooltip("Select Clinical Derivation Preset");
    fireEvent.click(presetsBtn);

    const mostellerPreset = screen.getByText("Mosteller BSA (m²)");
    fireEvent.click(mostellerPreset);

    expect(handleChange).toHaveBeenCalledWith(
      expect.stringContaining("round(sqrt((HEIGHT * WEIGHT) / 3600), 2)")
    );
  });

  it("toggles live test evaluation and displays calculation preview", () => {
    render(
      <AstRuleEditor
        formula="HEIGHT + WEIGHT"
        onChange={vi.fn()}
        fields={sampleFields}
      />
    );

    const testBtn = getByTooltip("Toggle Live Test Evaluation");
    fireEvent.click(testBtn);

    expect(screen.getByText("Live Evaluation Preview")).toBeTruthy();
    // Default test values: HEIGHT=175, WEIGHT=70 -> 175 + 70 = 245
    expect(screen.getByText("Result: 245")).toBeTruthy();
  });
});
