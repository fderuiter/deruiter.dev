// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import { getOncologyPresetSync } from "@/lib/crf";
import type { CodelistDefinition, CRFField } from "@/lib/crf";
import { FieldPropertiesTab } from "@/components/crf/RightInspector/FieldPropertiesTab";

const study = getOncologyPresetSync();
const codelists: CodelistDefinition[] = study.codelists ?? [];

function allFields(formId: string): CRFField[] {
  const form = study.forms.find((f) => f.id === formId);
  if (!form) throw new Error(`Preset is missing ${formId}`);
  return form.sections.flatMap((s) => s.fields);
}

function fieldByVar(formId: string, variableName: string): CRFField {
  const field = allFields(formId).find((f) => f.variableName === variableName);
  if (!field) throw new Error(`Preset is missing ${variableName}`);
  return field;
}

const sysbp = fieldByVar("form_vs_onc", "SYSBP");
const bmi = fieldByVar("form_vs_onc", "BMI");
const sex = fieldByVar("form_dm_onc", "SEX");
const icdat = fieldByVar("form_dm_onc", "ICDAT");
const aestdtc = fieldByVar("form_ae_onc", "AESTDTC");

const customRadio: CRFField = {
  ...fieldByVar("form_dm_onc", "ICYN"),
  codelistId: undefined,
  customOptions: [
    { code: "MILD", label: "Mild", order: 1 },
    { code: "MODERATE", label: "Moderate", order: 2 },
    { code: "SEVERE", label: "Severe", order: 3 },
  ],
};

type UpdateFn = (updates: Partial<CRFField>) => void;

interface SetupOptions {
  field: CRFField;
  formId?: string;
  codelists?: CodelistDefinition[];
  onSaveToStudyCodelist?: (codelist: CodelistDefinition) => void;
  onRenameEverywhere?: (newVar: string) => void;
  onCommitReviewTargetChange?: () => void;
}

function setup(options: SetupOptions) {
  const onUpdateField = vi.fn<UpdateFn>();
  const props = {
    allFieldsInForm: allFields(options.formId ?? "form_vs_onc"),
    codelists: options.codelists ?? codelists,
    onUpdateField,
    onSaveToStudyCodelist: options.onSaveToStudyCodelist,
    onRenameEverywhere: options.onRenameEverywhere,
    onCommitReviewTargetChange: options.onCommitReviewTargetChange,
  };
  const utils = render(<FieldPropertiesTab field={options.field} {...props} />);
  const rerender = (field: CRFField) =>
    utils.rerender(<FieldPropertiesTab field={field} {...props} />);
  return { ...utils, onUpdateField, rerender };
}

const variableInput = () =>
  screen.getByPlaceholderText("e.g. BRTHYR, SYSBP, AETERM, DITERM");

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("FieldPropertiesTab variable name", () => {
  it("shows the current variable name and its length against the 8 character limit", () => {
    setup({ field: sysbp });
    expect(variableInput()).toHaveProperty("value", "SYSBP");
    expect(screen.getByText("5/8 chars")).toBeTruthy();
  });

  it("uppercases what the user types into the variable name draft without saving it", () => {
    const { onUpdateField } = setup({ field: sysbp });
    fireEvent.change(variableInput(), { target: { value: "vssys" } });
    expect(variableInput()).toHaveProperty("value", "VSSYS");
    expect(onUpdateField).not.toHaveBeenCalled();
  });

  it("flags a variable name that does not start with a letter", () => {
    setup({ field: sysbp, onRenameEverywhere: vi.fn() });
    fireEvent.change(variableInput(), { target: { value: "1SYS" } });
    expect(screen.getByText(/must start with a letter/)).toBeTruthy();
    expect(variableInput().className).toContain("border-red-500/70");
    expect(
      screen.queryByRole("button", { name: /Rename Everywhere/ })
    ).toBeNull();
  });

  it("shows no error and no rename button while the variable name is blank", () => {
    setup({ field: sysbp, onRenameEverywhere: vi.fn() });
    fireEvent.change(variableInput(), { target: { value: "" } });
    expect(screen.queryByText(/cannot be blank/)).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Rename Everywhere/ })
    ).toBeNull();
  });

  it("hides the rename button when no rename handler is given", () => {
    setup({ field: sysbp });
    expect(
      screen.queryByRole("button", { name: /Rename Everywhere/ })
    ).toBeNull();
  });

  it("renames everywhere with the draft name and clears the confirmation after three seconds", () => {
    vi.useFakeTimers();
    const onRenameEverywhere = vi.fn();
    setup({ field: sysbp, onRenameEverywhere });
    fireEvent.change(variableInput(), { target: { value: "vssysbp" } });
    fireEvent.click(screen.getByRole("button", { name: /Rename Everywhere/ }));

    expect(onRenameEverywhere).toHaveBeenCalledWith("VSSYSBP");
    expect(screen.getByText(/Renamed everywhere/)).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText(/Renamed everywhere/)).toBeNull();
  });

  it("resets the draft when a different field is selected", () => {
    const { rerender } = setup({ field: sysbp });
    fireEvent.change(variableInput(), { target: { value: "DRAFT" } });
    rerender(fieldByVar("form_vs_onc", "DIABP"));
    expect(variableInput()).toHaveProperty("value", "DIABP");
  });
});

describe("FieldPropertiesTab label, description, type and width", () => {
  it("emits the new question label and commits the review target on blur", () => {
    const onCommitReviewTargetChange = vi.fn();
    const { onUpdateField } = setup({
      field: sysbp,
      onCommitReviewTargetChange,
    });
    const labelInput = screen.getByDisplayValue(sysbp.label);
    fireEvent.change(labelInput, {
      target: { value: "Systolic Blood Pressure (seated)" },
    });
    expect(onUpdateField).toHaveBeenCalledWith({
      label: "Systolic Blood Pressure (seated)",
    });
    fireEvent.blur(labelInput);
    expect(onCommitReviewTargetChange).toHaveBeenCalledTimes(1);
  });

  it("emits the edited clinical description", () => {
    const { onUpdateField } = setup({
      field: { ...sysbp, description: undefined },
    });
    const textarea = screen.getByPlaceholderText(
      "e.g. Select the primary reason observed during procedure."
    );
    expect(textarea).toHaveProperty("value", "");
    fireEvent.change(textarea, {
      target: { value: "Seated after 5 minutes rest." },
    });
    expect(onUpdateField).toHaveBeenCalledWith({
      description: "Seated after 5 minutes rest.",
    });
  });

  it("emits the chosen data type", () => {
    const { onUpdateField } = setup({ field: sysbp });
    fireEvent.change(screen.getByDisplayValue("Integer Count"), {
      target: { value: "number" },
    });
    expect(onUpdateField).toHaveBeenCalledWith({ dataType: "number" });
  });

  it("emits the grid width as a number and labels the common widths", () => {
    const { onUpdateField } = setup({ field: { ...sysbp, columnSpan: 6 } });
    const widthSelect = screen.getByDisplayValue("6 (Half Width)");
    const optionTexts = Array.from(
      widthSelect.querySelectorAll("option"),
      (o) => o.textContent
    );
    expect(optionTexts).toContain("12 (Full Width)");
    expect(optionTexts).toContain("4 (1/3 Width)");
    expect(optionTexts).toContain("3 cols");

    fireEvent.change(widthSelect, { target: { value: "12" } });
    expect(onUpdateField).toHaveBeenCalledWith({ columnSpan: 12 });
  });
});

describe("FieldPropertiesTab requirement tiers", () => {
  it("treats a required field without a tier as a hard stop", () => {
    setup({ field: { ...sysbp, required: true, requirementTier: undefined } });
    expect(screen.getByText("hard_stop")).toBeTruthy();
    expect(screen.getByText(/Physically blocks saving/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Hard Stop" }).className
    ).toContain("bg-red-500/20");
  });

  it("treats an unrequired field without a tier as optional", () => {
    setup({
      field: { ...sysbp, required: false, requirementTier: undefined },
    });
    expect(screen.getByText("optional")).toBeTruthy();
    expect(screen.getByText(/May be left blank/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Optional" }).className
    ).toContain("bg-zinc-800");
  });

  it("describes the auto-query tier when it is set", () => {
    setup({ field: { ...sysbp, requirementTier: "auto_query" } });
    expect(screen.getByText("auto_query")).toBeTruthy();
    expect(screen.getByText(/registers an open EDC discrepancy/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Auto-Query" }).className
    ).toContain("bg-amber-500/20");
  });

  it("highlights explicit optional and hard stop tiers", () => {
    const { rerender } = setup({
      field: { ...sysbp, required: true, requirementTier: "optional" },
    });
    expect(
      screen.getByRole("button", { name: "Optional" }).className
    ).toContain("bg-zinc-800");
    rerender({ ...sysbp, required: false, requirementTier: "hard_stop" });
    expect(
      screen.getByRole("button", { name: "Hard Stop" }).className
    ).toContain("bg-red-500/20");
  });

  it("emits the tier and required flag for each tier button", () => {
    const { onUpdateField } = setup({ field: sysbp });
    fireEvent.click(screen.getByRole("button", { name: "Optional" }));
    fireEvent.click(screen.getByRole("button", { name: "Hard Stop" }));
    fireEvent.click(screen.getByRole("button", { name: "Auto-Query" }));
    expect(onUpdateField.mock.calls).toEqual([
      [{ requirementTier: "optional", required: false }],
      [{ requirementTier: "hard_stop", required: true }],
      [{ requirementTier: "auto_query", required: true }],
    ]);
  });

  it("emits the read-only flag", () => {
    const { onUpdateField } = setup({
      field: { ...sysbp, readOnly: undefined },
    });
    const checkbox = screen.getByRole("checkbox", { name: "Read-Only" });
    expect(checkbox).toHaveProperty("checked", false);
    fireEvent.click(checkbox);
    expect(onUpdateField).toHaveBeenCalledWith({ readOnly: true });
  });
});

describe("FieldPropertiesTab precision date controls", () => {
  it("does not show date controls for a numeric field", () => {
    setup({ field: sysbp });
    expect(screen.queryByText("Precision Date Controls")).toBeNull();
  });

  it("defaults partial dates off for a standard date and emits both toggles", () => {
    const { onUpdateField } = setup({
      field: {
        ...icdat,
        allowPartial: undefined,
        preventFutureDate: undefined,
      },
      formId: "form_dm_onc",
    });
    const partial = screen.getByRole("checkbox", {
      name: /Allow Partial Dates/,
    });
    const future = screen.getByRole("checkbox", {
      name: /Prevent Future Dates/,
    });
    expect(partial).toHaveProperty("checked", false);
    expect(future).toHaveProperty("checked", false);

    fireEvent.click(partial);
    fireEvent.click(future);
    expect(onUpdateField).toHaveBeenCalledWith({ allowPartial: true });
    expect(onUpdateField).toHaveBeenCalledWith({ preventFutureDate: true });
  });

  it("defaults partial dates on for partial and precision date types", () => {
    const { rerender } = setup({
      field: { ...aestdtc, allowPartial: undefined },
      formId: "form_ae_onc",
    });
    const partial = () =>
      screen.getByRole("checkbox", { name: /Allow Partial Dates/ });
    expect(partial()).toHaveProperty("checked", true);
    rerender({
      ...aestdtc,
      dataType: "precision_date",
      allowPartial: undefined,
    });
    expect(partial()).toHaveProperty("checked", true);
  });

  it("respects an explicit allow-partial setting over the type default", () => {
    const { onUpdateField } = setup({
      field: { ...aestdtc, allowPartial: false, preventFutureDate: true },
      formId: "form_ae_onc",
    });
    const partial = screen.getByRole("checkbox", {
      name: /Allow Partial Dates/,
    });
    expect(partial).toHaveProperty("checked", false);
    expect(
      screen.getByRole("checkbox", { name: /Prevent Future Dates/ })
    ).toHaveProperty("checked", true);
    fireEvent.click(partial);
    expect(onUpdateField).toHaveBeenCalledWith({ allowPartial: true });
  });
});

describe("FieldPropertiesTab clinical governance flags", () => {
  it("emits null flavour, SDV and blinding toggles", () => {
    const { onUpdateField } = setup({
      field: {
        ...sysbp,
        allowNullFlavor: undefined,
        requiresSdv: undefined,
        isBlinded: undefined,
      },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Allow CDISC Null Flavors/ })
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /Requires SDV/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Blinded Variable/ }));
    expect(onUpdateField.mock.calls).toEqual([
      [{ allowNullFlavor: true }],
      [{ requiresSdv: true }],
      [{ isBlinded: true }],
    ]);
  });

  it("emits a cleared flag when an enabled governance flag is unticked", () => {
    const { onUpdateField } = setup({
      field: {
        ...sysbp,
        allowNullFlavor: true,
        requiresSdv: true,
        isBlinded: true,
      },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Allow CDISC Null Flavors/ })
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /Requires SDV/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Blinded Variable/ }));
    expect(onUpdateField.mock.calls).toEqual([
      [{ allowNullFlavor: false }],
      [{ requiresSdv: false }],
      [{ isBlinded: false }],
    ]);
  });
});

describe("FieldPropertiesTab numeric boundaries and units", () => {
  it("shows empty unit and range inputs when none are set", () => {
    setup({
      field: {
        ...sysbp,
        unit: undefined,
        minValue: undefined,
        maxValue: undefined,
      },
    });
    expect(screen.getByPlaceholderText("mmHg, kg, °C")).toHaveProperty(
      "value",
      ""
    );
    const [min, max] = screen.getAllByPlaceholderText("None");
    expect(min).toHaveProperty("value", "");
    expect(max).toHaveProperty("value", "");
  });

  it("emits the unit and parsed range values", () => {
    const { onUpdateField } = setup({
      field: { ...sysbp, unit: "mmHg", minValue: 60, maxValue: 250 },
    });
    expect(screen.getByPlaceholderText("mmHg, kg, °C")).toHaveProperty(
      "value",
      "mmHg"
    );
    const [min, max] = screen.getAllByPlaceholderText("None");
    expect(min).toHaveProperty("value", "60");
    expect(max).toHaveProperty("value", "250");

    fireEvent.change(screen.getByPlaceholderText("mmHg, kg, °C"), {
      target: { value: "kPa" },
    });
    fireEvent.change(min, { target: { value: "70.5" } });
    fireEvent.change(max, { target: { value: "240" } });
    expect(onUpdateField.mock.calls).toEqual([
      [{ unit: "kPa" }],
      [{ minValue: 70.5 }],
      [{ maxValue: 240 }],
    ]);
  });

  it("clears a range bound when its input is emptied", () => {
    const { onUpdateField } = setup({
      field: { ...sysbp, minValue: 60, maxValue: 250 },
    });
    const [min, max] = screen.getAllByPlaceholderText("None");
    fireEvent.change(min, { target: { value: "" } });
    fireEvent.change(max, { target: { value: "" } });
    expect(onUpdateField.mock.calls).toEqual([
      [{ minValue: undefined }],
      [{ maxValue: undefined }],
    ]);
  });

  it("does not show numeric boundaries for a text field", () => {
    setup({
      field: fieldByVar("form_ae_onc", "AETERM"),
      formId: "form_ae_onc",
    });
    expect(screen.queryByText(/Numeric Boundaries/)).toBeNull();
  });
});

describe("FieldPropertiesTab calculated fields", () => {
  it("shows numeric boundaries and the formula editor, and emits formula edits", () => {
    const { onUpdateField } = setup({ field: bmi });
    expect(screen.getByText(/Numeric Boundaries/)).toBeTruthy();
    const formula = screen.getByLabelText("AST Formula Input");
    expect(formula).toHaveProperty("value", bmi.calculationFormula ?? "");
    fireEvent.change(formula, {
      target: { value: "WEIGHT / ((HEIGHT/100) * (HEIGHT/100))" },
    });
    expect(onUpdateField).toHaveBeenCalledWith({
      calculationFormula: "WEIGHT / ((HEIGHT/100) * (HEIGHT/100))",
    });
  });

  it("starts the formula editor empty when no formula is set", () => {
    setup({ field: { ...bmi, calculationFormula: undefined } });
    expect(screen.getByLabelText("AST Formula Input")).toHaveProperty(
      "value",
      ""
    );
  });

  it("does not show the formula editor for a non-calculated field", () => {
    setup({ field: sysbp });
    expect(screen.queryByLabelText("AST Formula Input")).toBeNull();
  });
});

describe("FieldPropertiesTab visual analog scale labels", () => {
  const vas: CRFField = {
    ...sysbp,
    dataType: "vas_scale",
    scaleMinLabel: undefined,
    scaleMaxLabel: undefined,
  };

  it("emits the anchor labels of the scale", () => {
    const { onUpdateField } = setup({ field: vas });
    const min = screen.getByPlaceholderText("e.g. No Pain");
    const max = screen.getByPlaceholderText("e.g. Worst Pain");
    expect(min).toHaveProperty("value", "");
    expect(max).toHaveProperty("value", "");
    fireEvent.change(min, { target: { value: "No Pain" } });
    fireEvent.change(max, { target: { value: "Worst Imaginable Pain" } });
    expect(onUpdateField.mock.calls).toEqual([
      [{ scaleMinLabel: "No Pain" }],
      [{ scaleMaxLabel: "Worst Imaginable Pain" }],
    ]);
  });

  it("shows existing anchor labels", () => {
    setup({
      field: { ...vas, scaleMinLabel: "None", scaleMaxLabel: "Severe" },
    });
    expect(screen.getByPlaceholderText("e.g. No Pain")).toHaveProperty(
      "value",
      "None"
    );
    expect(screen.getByPlaceholderText("e.g. Worst Pain")).toHaveProperty(
      "value",
      "Severe"
    );
  });
});

describe("FieldPropertiesTab standard codelists", () => {
  const sexCodelist = codelists.find((cl) => cl.id === "CL_SEX");
  const codelistPicker = () => {
    const picker = screen
      .getByText("Select Controlled Codelist Library")
      .parentElement?.querySelector("select");
    if (!picker) throw new Error("Codelist picker missing");
    return picker;
  };

  it("does not show the options builder for a non-choice field", () => {
    setup({ field: sysbp });
    expect(screen.queryByText("Options & Terminology")).toBeNull();
  });

  it("previews the bound codelist's choices with a choice count", () => {
    if (!sexCodelist) throw new Error("Preset is missing CL_SEX");
    setup({ field: sex, formId: "form_dm_onc" });
    expect(
      screen.getByText(`${sexCodelist.options.length} choices`)
    ).toBeTruthy();
    expect(screen.getByText("Preview Choices:")).toBeTruthy();
    for (const opt of sexCodelist.options) {
      expect(screen.getByText(`(${opt.code})`)).toBeTruthy();
    }
  });

  it("uses the singular when a codelist has one choice", () => {
    const single: CodelistDefinition = {
      id: "CL_ONE",
      name: "Single Choice",
      options: [{ code: "Y", label: "Yes", order: 1 }],
      isStandard: false,
    };
    setup({
      field: { ...sex, codelistId: "CL_ONE" },
      formId: "form_dm_onc",
      codelists: [single],
    });
    expect(screen.getByText("1 choice")).toBeTruthy();
    expect(
      screen.getByRole("option", {
        name: /Single Choice \(1 options\) \[Custom\]/,
      })
    ).toBeTruthy();
  });

  it("marks CDISC standard codelists in the library picker", () => {
    const standard: CodelistDefinition = {
      id: "CL_STD",
      name: "Standard List",
      options: [],
      isStandard: true,
    };
    setup({
      field: { ...sex, codelistId: undefined },
      formId: "form_dm_onc",
      codelists: [standard],
    });
    expect(
      screen.getByRole("option", {
        name: /Standard List \(0 options\) \[CDISC\]/,
      })
    ).toBeTruthy();
    expect(screen.getByText("0 choices")).toBeTruthy();
    expect(screen.queryByText("Preview Choices:")).toBeNull();
  });

  it("emits the picked codelist and clears custom options", () => {
    const { onUpdateField } = setup({ field: sex, formId: "form_dm_onc" });
    fireEvent.change(codelistPicker(), { target: { value: "CL_NY" } });
    expect(onUpdateField).toHaveBeenCalledWith({
      codelistId: "CL_NY",
      customOptions: undefined,
    });
  });

  it("emits no codelist when the empty choice is picked", () => {
    const { onUpdateField } = setup({ field: sex, formId: "form_dm_onc" });
    fireEvent.change(codelistPicker(), { target: { value: "" } });
    expect(onUpdateField).toHaveBeenCalledWith({
      codelistId: undefined,
      customOptions: undefined,
    });
  });

  it("clones the bound codelist into editable custom options", () => {
    if (!sexCodelist) throw new Error("Preset is missing CL_SEX");
    const { onUpdateField } = setup({ field: sex, formId: "form_dm_onc" });
    fireEvent.click(screen.getByRole("button", { name: "Clone & Customize" }));
    expect(onUpdateField).toHaveBeenCalledWith({
      customOptions: sexCodelist.options,
      codelistId: undefined,
    });
    const [update] = onUpdateField.mock.calls[0];
    expect(update.customOptions?.[0]).not.toBe(sexCodelist.options[0]);
    expect(screen.getByText("Quick-Insert Templates")).toBeTruthy();
  });

  it("seeds two default options when switching to custom without a codelist", () => {
    const { onUpdateField } = setup({
      field: { ...sex, codelistId: undefined, customOptions: undefined },
      formId: "form_dm_onc",
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Custom Options \(0\)/ })
    );
    expect(onUpdateField).toHaveBeenCalledWith({
      customOptions: [
        { code: "OPT_1", label: "Option 1", order: 1 },
        { code: "OPT_2", label: "Option 2", order: 2 },
      ],
      codelistId: undefined,
    });
    expect(screen.getByText(/No custom choices defined yet/)).toBeTruthy();
  });

  it("seeds default options when the bound codelist has no choices", () => {
    const empty: CodelistDefinition = {
      id: "CL_EMPTY",
      name: "Empty",
      options: [],
      isStandard: false,
    };
    const { onUpdateField } = setup({
      field: { ...sex, codelistId: "CL_EMPTY" },
      formId: "form_dm_onc",
      codelists: [empty],
    });
    fireEvent.click(screen.getByRole("button", { name: /Custom Options/ }));
    expect(onUpdateField).toHaveBeenCalledWith(
      expect.objectContaining({
        customOptions: [
          { code: "OPT_1", label: "Option 1", order: 1 },
          { code: "OPT_2", label: "Option 2", order: 2 },
        ],
      })
    );
  });

  it("binds the first study codelist when switching to standard with none bound", () => {
    const { onUpdateField } = setup({
      field: { ...customRadio, customOptions: [] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Standard Codelist" }));
    expect(onUpdateField).toHaveBeenCalledWith({
      codelistId: codelists[0].id,
      customOptions: undefined,
    });
  });

  it("emits nothing when switching to standard with a codelist already bound", () => {
    const { onUpdateField } = setup({ field: sex, formId: "form_dm_onc" });
    fireEvent.click(screen.getByRole("button", { name: "Standard Codelist" }));
    expect(onUpdateField).not.toHaveBeenCalled();
  });

  it("emits nothing when switching to standard and the study has no codelists", () => {
    const { onUpdateField } = setup({ field: customRadio, codelists: [] });
    fireEvent.click(screen.getByRole("button", { name: "Standard Codelist" }));
    expect(onUpdateField).not.toHaveBeenCalled();
    expect(screen.getByText("Select Controlled Codelist Library")).toBeTruthy();
  });
});

describe("FieldPropertiesTab custom options builder", () => {
  const rowInputs = () =>
    screen.getAllByPlaceholderText("Choice Label").map((label) => {
      const row = label.parentElement;
      if (!row) throw new Error("Option row missing");
      return within(row);
    });

  it("opens in custom mode and lists each option in its own row", () => {
    setup({ field: customRadio });
    expect(screen.getByText("3 choices")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Custom Options \(3\)/ }).className
    ).toContain("text-brand-cyan");
    expect(
      screen
        .getAllByPlaceholderText("Choice Label")
        .map((i) => i.getAttribute("value"))
    ).toEqual(["Mild", "Moderate", "Severe"]);
  });

  it("emits nothing when switching to custom while custom options already exist", () => {
    const { onUpdateField } = setup({ field: customRadio });
    fireEvent.click(screen.getByRole("button", { name: /Custom Options/ }));
    expect(onUpdateField).not.toHaveBeenCalled();
  });

  it("emits an edited option label", () => {
    const { onUpdateField } = setup({ field: customRadio });
    fireEvent.change(screen.getByDisplayValue("Moderate"), {
      target: { value: "Moderate (Grade 2)" },
    });
    expect(onUpdateField).toHaveBeenCalledWith({
      customOptions: [
        customRadio.customOptions?.[0],
        { code: "MODERATE", label: "Moderate (Grade 2)", order: 2 },
        customRadio.customOptions?.[2],
      ],
    });
  });

  it("uppercases edited SDTM and NCI codes", () => {
    const { onUpdateField } = setup({ field: customRadio });
    const first = rowInputs()[0];
    fireEvent.change(first.getByPlaceholderText("CODE"), {
      target: { value: "mild1" },
    });
    const nci = first.getByPlaceholderText("C-Code");
    expect(nci).toHaveProperty("value", "");
    fireEvent.change(nci, { target: { value: "c48275" } });
    expect(onUpdateField.mock.calls[0][0].customOptions?.[0]).toEqual({
      code: "MILD1",
      label: "Mild",
      order: 1,
    });
    expect(onUpdateField.mock.calls[1][0].customOptions?.[0]).toEqual({
      code: "MILD",
      label: "Mild",
      order: 1,
      nciCode: "C48275",
    });
  });

  it("disables moving the first option up and the last option down", () => {
    setup({ field: customRadio });
    const ups = screen.getAllByTitle("Move Up");
    const downs = screen.getAllByTitle("Move Down");
    expect(ups[0]).toHaveProperty("disabled", true);
    expect(ups[1]).toHaveProperty("disabled", false);
    expect(downs[2]).toHaveProperty("disabled", true);
    expect(downs[0]).toHaveProperty("disabled", false);
  });

  it("moves an option up and renumbers the order", () => {
    const { onUpdateField } = setup({ field: customRadio });
    fireEvent.click(screen.getAllByTitle("Move Up")[2]);
    expect(onUpdateField).toHaveBeenCalledWith({
      customOptions: [
        { code: "MILD", label: "Mild", order: 1 },
        { code: "SEVERE", label: "Severe", order: 2 },
        { code: "MODERATE", label: "Moderate", order: 3 },
      ],
    });
  });

  it("moves an option down and renumbers the order", () => {
    const { onUpdateField } = setup({ field: customRadio });
    fireEvent.click(screen.getAllByTitle("Move Down")[0]);
    expect(onUpdateField).toHaveBeenCalledWith({
      customOptions: [
        { code: "MODERATE", label: "Moderate", order: 1 },
        { code: "MILD", label: "Mild", order: 2 },
        { code: "SEVERE", label: "Severe", order: 3 },
      ],
    });
  });

  it("deletes an option and renumbers the rest", () => {
    const { onUpdateField } = setup({ field: customRadio });
    fireEvent.click(screen.getAllByTitle("Delete Choice")[0]);
    expect(onUpdateField).toHaveBeenCalledWith({
      customOptions: [
        { code: "MODERATE", label: "Moderate", order: 1 },
        { code: "SEVERE", label: "Severe", order: 2 },
      ],
    });
  });

  it("falls back to the row position when an option has no order", () => {
    setup({
      field: {
        ...customRadio,
        customOptions: [
          fromPartial({ code: "A", label: "Alpha" }),
          fromPartial({ code: "B", label: "Beta" }),
        ],
      },
    });
    const numbers = screen
      .getAllByPlaceholderText("Choice Label")
      .map((i) => i.previousElementSibling?.textContent);
    expect(numbers).toEqual(["1", "2"]);
  });

  it("adds the first option when the custom list is empty", () => {
    const { onUpdateField } = setup({
      field: { ...customRadio, customOptions: undefined },
      codelists: [],
    });
    fireEvent.click(screen.getByRole("button", { name: /Custom Options/ }));
    onUpdateField.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Add Option/ }));
    expect(onUpdateField).toHaveBeenCalledWith({
      customOptions: [{ code: "OPT_1", label: "Option 1", order: 1 }],
    });
  });

  it("replaces the options with a quick template", () => {
    const { onUpdateField } = setup({ field: customRadio });
    fireEvent.click(screen.getByTitle("Load 2 options for Pass / Fail"));
    expect(onUpdateField).toHaveBeenCalledWith({
      customOptions: [
        {
          code: "PASS",
          label: "Pass / Criteria Met",
          nciCode: "C48288",
          order: 1,
        },
        {
          code: "FAIL",
          label: "Fail / Criteria Not Met",
          nciCode: "C48289",
          order: 2,
        },
      ],
      codelistId: undefined,
    });
  });

  it("offers every quick template", () => {
    setup({ field: customRadio });
    for (const name of [
      "Yes / No",
      "Normal / Abnormal (CS/NCS)",
      "Likert 5-Point",
      "Severity (Mild/Mod/Sev)",
      "Pass / Fail",
      "Device Status",
      "CTCAE Grade 1-5",
    ]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
  });
});

describe("FieldPropertiesTab bulk paste", () => {
  const openBulk = () =>
    fireEvent.click(screen.getByRole("button", { name: /Bulk Paste Options/ }));
  const bulkTextarea = () => screen.getByPlaceholderText(/Paste options here/);
  const applyButton = () =>
    screen.getByRole("button", { name: "Apply Bulk Options" });

  it("toggles the bulk paste drawer open and closed", () => {
    setup({ field: customRadio });
    openBulk();
    expect(bulkTextarea()).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /Hide Bulk Paste Tool/ })
    );
    expect(screen.queryByPlaceholderText(/Paste options here/)).toBeNull();
  });

  it("closes the drawer on cancel", () => {
    setup({ field: customRadio });
    openBulk();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByPlaceholderText(/Paste options here/)).toBeNull();
  });

  it("keeps apply disabled until something other than whitespace is pasted", () => {
    setup({ field: customRadio });
    openBulk();
    expect(applyButton()).toHaveProperty("disabled", true);
    fireEvent.change(bulkTextarea(), { target: { value: "   " } });
    expect(applyButton()).toHaveProperty("disabled", true);
    fireEvent.change(bulkTextarea(), { target: { value: "Mild" } });
    expect(applyButton()).toHaveProperty("disabled", false);
  });

  it("generates sanitized codes from line and comma separated text, then closes", () => {
    const { onUpdateField } = setup({ field: customRadio });
    openBulk();
    fireEvent.change(bulkTextarea(), {
      target: {
        value:
          "Not Done\nTreatment-Emergent Adverse Event, ???\n  Grade 3+ (severe) ",
      },
    });
    fireEvent.click(applyButton());
    expect(onUpdateField).toHaveBeenCalledWith({
      customOptions: [
        { code: "NOT_DONE", label: "Not Done", order: 1 },
        {
          code: "TREATMENT_EMERGE",
          label: "Treatment-Emergent Adverse Event",
          order: 2,
        },
        { code: "OPT_3", label: "???", order: 3 },
        { code: "GRADE_3_SEVERE", label: "Grade 3+ (severe)", order: 4 },
      ],
      codelistId: undefined,
    });
    expect(screen.queryByPlaceholderText(/Paste options here/)).toBeNull();
    openBulk();
    expect(bulkTextarea()).toHaveProperty("value", "");
  });

  it("ignores pasted text made only of separators", () => {
    const { onUpdateField } = setup({ field: customRadio });
    openBulk();
    fireEvent.change(bulkTextarea(), { target: { value: " ,\n, " } });
    fireEvent.click(applyButton());
    expect(onUpdateField).not.toHaveBeenCalled();
    expect(bulkTextarea()).toHaveProperty("value", " ,\n, ");
  });
});

describe("FieldPropertiesTab save to study codelists", () => {
  it("hides the save button without a save handler", () => {
    setup({ field: customRadio });
    expect(
      screen.queryByRole("button", { name: /Save to Study Codelists/ })
    ).toBeNull();
  });

  it("hides the save button when there are no custom options", () => {
    setup({
      field: { ...customRadio, customOptions: [] },
      codelists: [],
      onSaveToStudyCodelist: vi.fn(),
    });
    fireEvent.click(screen.getByRole("button", { name: /Custom Options/ }));
    expect(
      screen.queryByRole("button", { name: /Save to Study Codelists/ })
    ).toBeNull();
  });

  it("promotes the options to a study codelist named after the field and binds it", () => {
    const onSaveToStudyCodelist = vi.fn<(cl: CodelistDefinition) => void>();
    const { onUpdateField } = setup({
      field: { ...customRadio, label: "Severity Grade" },
      onSaveToStudyCodelist,
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Save to Study Codelists/ })
    );

    expect(onSaveToStudyCodelist).toHaveBeenCalledTimes(1);
    const [saved] = onSaveToStudyCodelist.mock.calls[0];
    expect(saved.id).toMatch(new RegExp(`^CL_${customRadio.variableName}_`));
    expect(saved.id).toBe(saved.id.toUpperCase());
    expect(saved.name).toBe("Severity Grade (3 Options)");
    expect(saved.isStandard).toBe(false);
    expect(saved.options).toEqual(customRadio.customOptions);
    expect(saved.options[0]).not.toBe(customRadio.customOptions?.[0]);

    expect(onUpdateField).toHaveBeenCalledWith({
      codelistId: saved.id,
      customOptions: undefined,
    });
    expect(screen.getByText("Select Controlled Codelist Library")).toBeTruthy();
  });

  it("falls back to a generic id prefix and the variable name when label or name is blank", () => {
    const onSaveToStudyCodelist = vi.fn<(cl: CodelistDefinition) => void>();
    const { rerender } = setup({
      field: { ...customRadio, variableName: "", label: "Pain Level" },
      onSaveToStudyCodelist,
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Save to Study Codelists/ })
    );
    expect(onSaveToStudyCodelist.mock.calls[0][0].id).toMatch(/^CL_CUSTOM_/);

    rerender({ ...customRadio, label: "" });
    fireEvent.click(screen.getByRole("button", { name: /Custom Options/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /Save to Study Codelists/ })
    );
    expect(onSaveToStudyCodelist.mock.calls[1][0].name).toBe(
      `${customRadio.variableName} (3 Options)`
    );
  });
});
