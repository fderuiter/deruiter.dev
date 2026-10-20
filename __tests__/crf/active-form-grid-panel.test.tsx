// @vitest-environment jsdom
import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import { ActiveFormGrid } from "@/components/crf/Modes/ActiveFormGrid";
import {
  getOncologyPresetSync,
  StudyProtocol,
  CRFForm,
  CRFField,
  StudioMode,
  StudyReviewActor,
  StudyProtocolEngine,
} from "@/lib/crf";

// Column order rendered by the grid (td index is column index + 1 because
// of the leading row-number cell).
const COL = {
  id: 0,
  variableName: 1,
  label: 2,
  dataType: 3,
  sectionId: 4,
  required: 5,
  unit: 6,
  columnSpan: 7,
  codelistId: 8,
  acrfAnnotation: 9,
} as const;
const LAST_COL = COL.acrfAnnotation;

type GridProps = React.ComponentProps<typeof ActiveFormGrid>;

const getForm = (study: StudyProtocol, id: string): CRFForm => {
  const form = study.forms.find((f) => f.id === id);
  if (!form) throw new Error(`Preset is missing form ${id}`);
  return form;
};

const findField = (
  study: StudyProtocol,
  formId: string,
  fieldId: string
): CRFField => {
  const found = StudyProtocolEngine.getField(study, formId, fieldId);
  if (!found) throw new Error(`Field ${fieldId} not found`);
  return found.field;
};

/** A study that no longer contains the form, so every engine call errors. */
const withoutForm = (study: StudyProtocol, formId: string): StudyProtocol => ({
  ...study,
  forms: study.forms.filter((f) => f.id !== formId),
});

const getCell = (
  container: HTMLElement,
  rowIndex: number,
  colIndex: number
): HTMLTableCellElement => {
  const row = container.querySelectorAll("tbody")[0]?.querySelectorAll("tr")[
    rowIndex
  ];
  const cell = row?.querySelectorAll("td")[colIndex + 1];
  if (!cell) throw new Error(`No cell at ${rowIndex},${colIndex}`);
  return cell;
};

const isActive = (cell: HTMLElement) => cell.className.includes("ring-2");

const getGrid = (container: HTMLElement): HTMLElement => {
  const grid = container.querySelector<HTMLElement>(
    '[aria-label="Active Form Grid"]'
  );
  if (!grid) throw new Error("Grid container not rendered");
  return grid;
};

const getEditor = (container: HTMLElement): HTMLElement => {
  const editor = container.querySelector<HTMLElement>(
    "tbody input, tbody select"
  );
  if (!editor) throw new Error("No inline editor is open");
  return editor;
};

const pasteInto = (target: HTMLElement, text: string) => {
  fireEvent.paste(target, {
    clipboardData: { getData: () => text },
  });
};

describe("ActiveFormGrid panel interactions", () => {
  let study: StudyProtocol;
  let vsForm: CRFForm;
  let dmForm: CRFForm;
  const onSelectField = vi.fn<(fieldId: string | null) => void>();
  const onUpdateField =
    vi.fn<(fieldId: string, updates: Partial<CRFField>) => void>();
  const onUpdateStudy = vi.fn<(updatedStudy: StudyProtocol) => void>();

  const renderGrid = (overrides: Partial<GridProps> = {}) =>
    render(
      <ActiveFormGrid
        form={vsForm}
        study={study}
        selectedFieldId={null}
        onSelectField={onSelectField}
        onUpdateField={onUpdateField}
        onUpdateStudy={onUpdateStudy}
        {...overrides}
      />
    );

  const lastStudy = (): StudyProtocol => {
    const call = onUpdateStudy.mock.calls.at(-1);
    if (!call) throw new Error("onUpdateStudy was not called");
    return call[0];
  };

  beforeEach(() => {
    study = getOncologyPresetSync();
    vsForm = getForm(study, "form_vs_onc");
    dmForm = getForm(study, "form_dm_onc");
    onSelectField.mockReset();
    onUpdateField.mockReset();
    onUpdateStudy.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("header toolbar", () => {
    it("shows the form name with its field count", () => {
      renderGrid();
      expect(screen.getByText(vsForm.name)).toBeDefined();
      expect(screen.getByText(/\(\s*9 fields\)/)).toBeDefined();
    });

    it("switches back to the canvas designer from the Canvas View button", () => {
      const onSwitchMode = vi.fn<(mode: StudioMode) => void>();
      renderGrid({ onSwitchMode });
      fireEvent.click(screen.getByRole("button", { name: /Canvas View/i }));
      expect(onSwitchMode).toHaveBeenCalledWith("designer");
    });

    it("adds a field without a target section from the Add Field button", () => {
      const onAddField = vi.fn<(sectionId?: string) => void>();
      renderGrid({ onAddField });
      fireEvent.click(screen.getByRole("button", { name: /Add Field/i }));
      expect(onAddField).toHaveBeenCalledTimes(1);
      expect(onAddField).toHaveBeenCalledWith();
    });

    it("hides the Canvas View and Add Field buttons when no handlers are given", () => {
      renderGrid();
      expect(screen.queryByRole("button", { name: /Canvas View/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /Add Field/i })).toBeNull();
    });
  });

  describe("cell rendering", () => {
    it("labels required and optional fields and shows a dash for a missing unit", () => {
      const { container } = renderGrid({ form: dmForm });
      // ICDAT is required and has no unit.
      expect(getCell(container, 0, COL.required).textContent).toBe("Required");
      expect(getCell(container, 0, COL.unit).textContent).toBe("—");
      const bmiRow = vsForm.sections[0].fields.findIndex(
        (f) => f.id === "f_bmi"
      );
      cleanup();
      const vs = renderGrid();
      expect(getCell(vs.container, bmiRow, COL.required).textContent).toBe(
        "Optional"
      );
    });

    it("shows the codelist name, the raw-input label, or an unknown codelist id", () => {
      const sec = dmForm.sections[0];
      const form: CRFForm = {
        ...dmForm,
        sections: [
          {
            ...sec,
            fields: [
              ...sec.fields,
              { ...sec.fields[1], id: "f_orphan", codelistId: "CL_GONE" },
            ],
          },
        ],
      };
      const { container } = renderGrid({ form });
      expect(getCell(container, 0, COL.codelistId).textContent).toBe(
        "None (Raw Input)"
      );
      const ny = study.codelists.find((cl) => cl.id === "CL_NY");
      expect(getCell(container, 1, COL.codelistId).textContent).toBe(
        `${ny?.name} (${ny?.options.length} items)`
      );
      expect(getCell(container, 2, COL.codelistId).textContent).toBe("CL_GONE");
    });

    it("falls back to defaults for a sparse field with no type, label or span", () => {
      const sparse = fromPartial<CRFField>({
        id: "f_sparse",
        variableName: "",
        required: false,
      });
      const form: CRFForm = {
        ...vsForm,
        sections: [{ ...vsForm.sections[0], fields: [sparse] }],
      };
      const { container } = renderGrid({ form });
      expect(getCell(container, 0, COL.dataType).textContent).toBe("text");
      expect(getCell(container, 0, COL.columnSpan).textContent).toBe("6");
      expect(getCell(container, 0, COL.label).textContent).toBe("—");
      expect(getCell(container, 0, COL.acrfAnnotation).textContent).toBe("—");
      expect(getCell(container, 0, COL.variableName).textContent).toBe("");
    });
  });

  describe("selection sync from outside", () => {
    it("activates the variable column of the externally selected field", async () => {
      const { container } = renderGrid({ selectedFieldId: "f_sysbp" });
      const row = vsForm.sections[0].fields.findIndex(
        (f) => f.id === "f_sysbp"
      );
      await waitFor(() => {
        expect(isActive(getCell(container, row, COL.variableName))).toBe(true);
      });
    });

    it("keeps the active column when the external selection moves to another row", async () => {
      const { container, rerender } = renderGrid();
      fireEvent.click(getCell(container, 0, COL.unit));
      expect(onSelectField).toHaveBeenCalledWith("f_vsdat");

      rerender(
        <ActiveFormGrid
          form={vsForm}
          study={study}
          selectedFieldId="f_pulse"
          onSelectField={onSelectField}
          onUpdateField={onUpdateField}
          onUpdateStudy={onUpdateStudy}
        />
      );
      const pulseRow = vsForm.sections[0].fields.findIndex(
        (f) => f.id === "f_pulse"
      );
      await waitFor(() => {
        expect(isActive(getCell(container, pulseRow, COL.unit))).toBe(true);
      });
    });

    it("leaves the active cell alone when the selected field is already on that row", async () => {
      const { container } = renderGrid({ selectedFieldId: "f_vsdat" });
      fireEvent.click(getCell(container, 0, COL.unit));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      expect(isActive(getCell(container, 0, COL.unit))).toBe(true);
      expect(isActive(getCell(container, 0, COL.variableName))).toBe(false);
    });

    it("ignores an external selection that is not in this form", async () => {
      const { container } = renderGrid({ selectedFieldId: "f_ae_term" });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      expect(container.querySelector("td.ring-2")).toBeNull();
    });
  });

  describe("keyboard navigation", () => {
    it("enters the grid on the first variable cell when Tab is pressed with nothing active", () => {
      const { container } = renderGrid();
      fireEvent.keyDown(getGrid(container), { key: "Tab" });
      expect(isActive(getCell(container, 0, COL.variableName))).toBe(true);
      expect(onSelectField).toHaveBeenCalledWith("f_vsdat");
    });

    it("ignores other keys while no cell is active", () => {
      const { container } = renderGrid();
      fireEvent.keyDown(getGrid(container), { key: "ArrowLeft" });
      expect(container.querySelector("td.ring-2")).toBeNull();
      expect(onSelectField).not.toHaveBeenCalled();
    });

    it("does not activate anything in a form with no fields", () => {
      const form: CRFForm = {
        ...vsForm,
        sections: [{ ...vsForm.sections[0], fields: [] }],
      };
      const { container } = renderGrid({ form });
      fireEvent.keyDown(getGrid(container), { key: "ArrowDown" });
      expect(container.querySelector("td.ring-2")).toBeNull();
      expect(onSelectField).not.toHaveBeenCalled();
    });

    it("moves up and left and stops at the top-left edge", () => {
      const { container } = renderGrid();
      const grid = getGrid(container);
      fireEvent.click(getCell(container, 1, COL.id + 1));
      fireEvent.keyDown(grid, { key: "ArrowUp" });
      expect(onSelectField).toHaveBeenLastCalledWith("f_vsdat");
      fireEvent.keyDown(grid, { key: "ArrowUp" });
      fireEvent.keyDown(grid, { key: "ArrowLeft" });
      fireEvent.keyDown(grid, { key: "ArrowLeft" });
      expect(isActive(getCell(container, 0, COL.id))).toBe(true);
    });

    it("moves down and right and stops at the bottom-right edge", () => {
      const { container } = renderGrid();
      const grid = getGrid(container);
      const lastRow = vsForm.sections[0].fields.length - 1;
      fireEvent.click(getCell(container, lastRow - 1, LAST_COL - 1));
      fireEvent.keyDown(grid, { key: "ArrowDown" });
      expect(onSelectField).toHaveBeenLastCalledWith("f_resp");
      fireEvent.keyDown(grid, { key: "ArrowDown" });
      fireEvent.keyDown(grid, { key: "ArrowRight" });
      fireEvent.keyDown(grid, { key: "ArrowRight" });
      expect(isActive(getCell(container, lastRow, LAST_COL))).toBe(true);
    });

    it("wraps Tab from the last column onto the next row", () => {
      const { container } = renderGrid();
      const grid = getGrid(container);
      fireEvent.click(getCell(container, 0, LAST_COL - 1));
      fireEvent.keyDown(grid, { key: "Tab" });
      expect(isActive(getCell(container, 0, LAST_COL))).toBe(true);
      fireEvent.keyDown(grid, { key: "Tab" });
      expect(isActive(getCell(container, 1, COL.id))).toBe(true);
      expect(onSelectField).toHaveBeenLastCalledWith("f_height");
    });

    it("wraps Shift+Tab from the first column back onto the previous row", () => {
      const { container } = renderGrid();
      const grid = getGrid(container);
      fireEvent.click(getCell(container, 1, COL.variableName));
      fireEvent.keyDown(grid, { key: "Tab", shiftKey: true });
      expect(isActive(getCell(container, 1, COL.id))).toBe(true);
      fireEvent.keyDown(grid, { key: "Tab", shiftKey: true });
      expect(isActive(getCell(container, 0, LAST_COL))).toBe(true);
      expect(onSelectField).toHaveBeenLastCalledWith("f_vsdat");
    });

    it("does not wrap Tab past either end of the grid", () => {
      const { container } = renderGrid();
      const grid = getGrid(container);
      const lastRow = vsForm.sections[0].fields.length - 1;
      fireEvent.click(getCell(container, 0, COL.id));
      fireEvent.keyDown(grid, { key: "Tab", shiftKey: true });
      expect(isActive(getCell(container, 0, COL.id))).toBe(true);
      fireEvent.click(getCell(container, lastRow, LAST_COL));
      fireEvent.keyDown(grid, { key: "Tab" });
      expect(isActive(getCell(container, lastRow, LAST_COL))).toBe(true);
    });

    it("clears the active cell on Escape", () => {
      const { container } = renderGrid();
      fireEvent.click(getCell(container, 2, COL.label));
      fireEvent.keyDown(getGrid(container), { key: "Escape" });
      expect(container.querySelector("td.ring-2")).toBeNull();
    });

    it("does nothing for an unhandled key on an active cell", () => {
      const { container } = renderGrid();
      fireEvent.click(getCell(container, 2, COL.label));
      fireEvent.keyDown(getGrid(container), { key: "a" });
      expect(isActive(getCell(container, 2, COL.label))).toBe(true);
    });

    it("does not open an editor on the read-only Stable ID column", () => {
      const { container } = renderGrid();
      fireEvent.click(getCell(container, 0, COL.id));
      fireEvent.keyDown(getGrid(container), { key: "Enter" });
      fireEvent.doubleClick(getCell(container, 0, COL.id));
      expect(container.querySelector("tbody input, tbody select")).toBeNull();
    });
  });

  describe("inline cell edits", () => {
    const startEditing = (container: HTMLElement, row: number, col: number) => {
      fireEvent.doubleClick(getCell(container, row, col));
      return getEditor(container);
    };

    it("commits with Enter and moves the active cell down one row", () => {
      const { container } = renderGrid();
      const input = startEditing(container, 0, COL.unit);
      fireEvent.change(input, { target: { value: " h " } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(findField(lastStudy(), vsForm.id, "f_vsdat").unit).toBe("h");
      expect(isActive(getCell(container, 1, COL.unit))).toBe(true);
      expect(onSelectField).toHaveBeenLastCalledWith("f_height");
      expect(container.querySelector("tbody input")).toBeNull();
    });

    it("commits with Enter on the last row without moving", () => {
      const { container } = renderGrid();
      const lastRow = vsForm.sections[0].fields.length - 1;
      const input = startEditing(container, lastRow, COL.unit);
      fireEvent.change(input, { target: { value: "rpm" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(findField(lastStudy(), vsForm.id, "f_resp").unit).toBe("rpm");
      expect(onSelectField).not.toHaveBeenCalled();
    });

    it("ignores other keys while editing", () => {
      const { container } = renderGrid();
      const input = startEditing(container, 0, COL.unit);
      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(container.querySelector("tbody input")).toBe(input);
    });

    it("hands a variable rename to onRenameEverywhere in upper case", () => {
      const onRenameEverywhere =
        vi.fn<(fieldId: string, newVarName: string) => void>();
      const { container } = renderGrid({ onRenameEverywhere });
      const input = startEditing(container, 4, COL.variableName);
      fireEvent.change(input, { target: { value: "sysbp2" } });
      fireEvent.blur(input);
      expect(onRenameEverywhere).toHaveBeenCalledWith("f_sysbp", "SYSBP2");
      expect(onUpdateStudy).not.toHaveBeenCalled();
    });

    it("renames a variable through the study engine when no rename handler is given", () => {
      const { container } = renderGrid();
      const input = startEditing(container, 4, COL.variableName);
      fireEvent.change(input, { target: { value: "sysbpx" } });
      fireEvent.blur(input);
      expect(findField(lastStudy(), vsForm.id, "f_sysbp").variableName).toBe(
        "SYSBPX"
      );
    });

    it("drops an invalid variable rename without updating the study", () => {
      const { container } = renderGrid();
      const input = startEditing(container, 4, COL.variableName);
      fireEvent.change(input, { target: { value: "1SYSBP" } });
      fireEvent.blur(input);
      expect(onUpdateStudy).not.toHaveBeenCalled();
    });

    it("does nothing when the variable or label is committed unchanged", () => {
      const onRenameEverywhere =
        vi.fn<(fieldId: string, newVarName: string) => void>();
      const onCommitReviewTargetChange =
        vi.fn<(fieldId: string, updates?: Partial<CRFField>) => void>();
      const { container } = renderGrid({
        onRenameEverywhere,
        onCommitReviewTargetChange,
      });
      fireEvent.blur(startEditing(container, 4, COL.variableName));
      fireEvent.blur(startEditing(container, 4, COL.label));
      expect(onRenameEverywhere).not.toHaveBeenCalled();
      expect(onCommitReviewTargetChange).not.toHaveBeenCalled();
      expect(onUpdateStudy).not.toHaveBeenCalled();
    });

    it("records a label change under the default study author when no review author is set", () => {
      const field = findField(study, vsForm.id, "f_sysbp");
      const threaded = StudyProtocolEngine.addReviewComment(
        study,
        field.id,
        "Check label wording",
        { name: "Monitor", role: "Data Manager" }
      ).study;
      const { container } = renderGrid({ study: threaded });
      const input = startEditing(container, 4, COL.label);
      fireEvent.change(input, { target: { value: "Systolic pressure" } });
      fireEvent.blur(input);

      const thread = lastStudy().reviewThreads?.find(
        (t) => t.target.fieldId === field.id
      );
      const renamed = thread?.events.find((e) => e.type === "target-renamed");
      expect(renamed?.nextLabel).toBe("Systolic pressure");
      expect(renamed?.author.name).toBe("Study author");
    });

    it("skips a label edit when the form is missing from the study", () => {
      const { container } = renderGrid({
        study: withoutForm(study, vsForm.id),
      });
      const input = startEditing(container, 4, COL.label);
      fireEvent.change(input, { target: { value: "Orphaned label" } });
      fireEvent.blur(input);
      expect(onUpdateStudy).not.toHaveBeenCalled();
      expect(onUpdateField).not.toHaveBeenCalled();
    });

    it("changes the data type from the select editor", () => {
      const { container } = renderGrid();
      const select = startEditing(container, 4, COL.dataType);
      expect(select.tagName).toBe("SELECT");
      fireEvent.change(select, { target: { value: "number" } });
      fireEvent.blur(select);
      expect(findField(lastStudy(), vsForm.id, "f_sysbp").dataType).toBe(
        "number"
      );
    });

    it("marks a field optional from the boolean editor", () => {
      const { container } = renderGrid();
      const select = startEditing(container, 4, COL.required);
      expect(within(select).getByText("false (Optional)")).toBeDefined();
      fireEvent.change(select, { target: { value: "false" } });
      fireEvent.blur(select);
      expect(findField(lastStudy(), vsForm.id, "f_sysbp").required).toBe(false);
    });

    it("sets a valid grid span from the number editor", () => {
      const { container } = renderGrid();
      const input = startEditing(container, 4, COL.columnSpan);
      expect(input.getAttribute("type")).toBe("number");
      fireEvent.change(input, { target: { value: "12" } });
      fireEvent.blur(input);
      expect(findField(lastStudy(), vsForm.id, "f_sysbp").columnSpan).toBe(12);
    });

    it("ignores a grid span outside 1 to 12", () => {
      const { container } = renderGrid();
      const input = startEditing(container, 4, COL.columnSpan);
      fireEvent.change(input, { target: { value: "13" } });
      fireEvent.blur(input);
      expect(onUpdateStudy).not.toHaveBeenCalled();
      expect(onUpdateField).not.toHaveBeenCalled();
    });

    it("assigns and clears a codelist", () => {
      const { container } = renderGrid();
      const select = startEditing(container, 4, COL.codelistId);
      fireEvent.change(select, { target: { value: "CL_NY" } });
      fireEvent.blur(select);
      expect(findField(lastStudy(), vsForm.id, "f_sysbp").codelistId).toBe(
        "CL_NY"
      );

      cleanup();
      const dm = renderGrid({ form: dmForm });
      const clear = startEditing(dm.container, 1, COL.codelistId);
      fireEvent.change(clear, { target: { value: "" } });
      fireEvent.blur(clear);
      const icyn = dmForm.sections[0].fields[1];
      expect(icyn?.codelistId).toBe("CL_NY");
      expect(
        findField(lastStudy(), dmForm.id, icyn.id).codelistId
      ).toBeUndefined();
    });

    it("updates the aCRF annotation while keeping existing CDASH metadata", () => {
      const { container } = renderGrid();
      const before = findField(study, vsForm.id, "f_sysbp").cdashMetadata;
      const input = startEditing(container, 4, COL.acrfAnnotation);
      fireEvent.change(input, { target: { value: "VS.VSORRES" } });
      fireEvent.blur(input);
      expect(
        findField(lastStudy(), vsForm.id, "f_sysbp").cdashMetadata
      ).toEqual({ ...before, acrfAnnotation: "VS.VSORRES" });
    });

    it("builds CDASH metadata for a field that has none when annotating it", () => {
      const sec = vsForm.sections[0];
      const form: CRFForm = {
        ...vsForm,
        sections: [
          {
            ...sec,
            fields: sec.fields.map((f) =>
              f.id === "f_sysbp" ? { ...f, cdashMetadata: undefined } : f
            ),
          },
        ],
      };
      const bare: StudyProtocol = {
        ...study,
        forms: study.forms.map((f) => (f.id === form.id ? form : f)),
      };
      const { container } = renderGrid({ form, study: bare });
      const input = startEditing(container, 4, COL.acrfAnnotation);
      fireEvent.change(input, { target: { value: "VS.SYS" } });
      fireEvent.blur(input);
      expect(
        findField(lastStudy(), vsForm.id, "f_sysbp").cdashMetadata
      ).toEqual({
        domain: "VS",
        sdtmVariable: "SYSBP",
        cdashLabel: findField(study, vsForm.id, "f_sysbp").label,
        core: "O",
        acrfAnnotation: "VS.SYS",
      });
    });

    it("falls back to onUpdateField for property edits when the study engine cannot find the form", () => {
      const detached = withoutForm(study, vsForm.id);
      const { container } = renderGrid({ study: detached });
      const edit = (col: number, value: string) => {
        const el = startEditing(container, 4, col);
        fireEvent.change(el, { target: { value } });
        fireEvent.blur(el);
      };
      edit(COL.dataType, "text");
      edit(COL.required, "false");
      edit(COL.unit, "kPa");
      edit(COL.columnSpan, "3");
      edit(COL.codelistId, "");
      edit(COL.acrfAnnotation, "VS.X");

      expect(onUpdateStudy).not.toHaveBeenCalled();
      const updates = onUpdateField.mock.calls.map(([id, upd]) => {
        expect(id).toBe("f_sysbp");
        return upd;
      });
      expect(updates.slice(0, 5)).toEqual([
        { dataType: "text" },
        { required: false },
        { unit: "kPa" },
        { columnSpan: 3 },
        { codelistId: undefined },
      ]);
      expect(updates[5]?.cdashMetadata?.acrfAnnotation).toBe("VS.X");
    });

    it("leaves the section unchanged when the same section is chosen", () => {
      const { container } = renderGrid({ form: dmForm });
      const select = startEditing(container, 0, COL.sectionId);
      fireEvent.blur(select);
      expect(onUpdateStudy).not.toHaveBeenCalled();
    });

    it("skips a section move when the form is missing from the study", () => {
      const { container } = renderGrid({
        form: dmForm,
        study: withoutForm(study, dmForm.id),
      });
      const select = startEditing(container, 0, COL.sectionId);
      fireEvent.change(select, { target: { value: dmForm.sections[1].id } });
      fireEvent.blur(select);
      expect(onUpdateStudy).not.toHaveBeenCalled();
    });
  });

  describe("clipboard paste into the grid", () => {
    const getPreviewRows = () =>
      within(screen.getByRole("dialog"))
        .getByText("Batch Paste Preview Updates")
        .closest("table")
        ?.querySelectorAll("tbody tr") ?? [];

    it("opens the preview from a pasted block starting at the active cell", () => {
      const { container } = renderGrid();
      fireEvent.click(getCell(container, 1, COL.unit));
      pasteInto(getGrid(container), "cm2\t4\nkg2\t5\n");

      const rows = getPreviewRows();
      expect(rows).toHaveLength(4);
      expect(rows[0]?.textContent).toContain("HEIGHT");
      expect(rows[0]?.textContent).toContain("Unit");
      expect(rows[3]?.textContent).toContain("WEIGHT");
      expect(rows[3]?.textContent).toContain("Grid Span");
      expect(
        (screen.getByPlaceholderText(/Paste TSV/i) as HTMLTextAreaElement).value
      ).toBe("cm2\t4\nkg2\t5\n");
    });

    it("starts at the first variable cell when nothing is active", () => {
      const { container } = renderGrid();
      pasteInto(getGrid(container), "VSDTC");
      const rows = getPreviewRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.textContent).toContain("CDASH Variable");
      expect(rows[0]?.textContent).toContain("VSDAT");
    });

    it("ignores an empty clipboard", () => {
      const { container } = renderGrid();
      pasteInto(getGrid(container), "");
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("leaves pasting to the inline editor while a cell is being edited", () => {
      const { container } = renderGrid();
      fireEvent.doubleClick(getCell(container, 0, COL.unit));
      pasteInto(getEditor(container), "pasted");
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("does not open the preview when the paste only covers the read-only column", () => {
      const { container } = renderGrid();
      fireEvent.click(getCell(container, 0, COL.id));
      pasteInto(getGrid(container), "f_new_id");
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("drops pasted rows and columns that fall outside the grid", () => {
      const { container } = renderGrid();
      const lastRow = vsForm.sections[0].fields.length - 1;
      fireEvent.click(getCell(container, lastRow, LAST_COL));
      pasteInto(getGrid(container), "VS.RESP\textra\nVS.MORE");
      const rows = getPreviewRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.textContent).toContain("VS.RESP");
    });

    it("re-validates from the active cell when the Paste / Fill button is used", () => {
      const { container } = renderGrid();
      fireEvent.click(getCell(container, 2, COL.unit));
      fireEvent.click(screen.getByRole("button", { name: /Paste \/ Fill/i }));
      fireEvent.change(screen.getByPlaceholderText(/Paste TSV/i), {
        target: { value: "lbs" },
      });
      const rows = getPreviewRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.textContent).toContain("WEIGHT");
    });
  });

  describe("paste validation", () => {
    const openAndType = (text: string, startCell?: [number, number]) => {
      const { container } = renderGrid();
      if (startCell) fireEvent.click(getCell(container, ...startCell));
      fireEvent.click(screen.getByRole("button", { name: /Paste \/ Fill/i }));
      fireEvent.change(screen.getByPlaceholderText(/Paste TSV/i), {
        target: { value: text },
      });
      return container;
    };

    const commitButton = () =>
      screen.getByRole("button", { name: /Commit Batch/i });

    it("rejects an unknown data type", () => {
      openAndType("decimal", [0, COL.dataType]);
      expect(screen.getByText(/Invalid data type 'decimal'/)).toBeDefined();
      expect(commitButton().hasAttribute("disabled")).toBe(true);
    });

    it("rejects a grid span that is not an integer from 1 to 12", () => {
      openAndType("0\nwide", [0, COL.columnSpan]);
      expect(screen.getByText(/got '0'/)).toBeDefined();
      expect(screen.getByText(/got 'wide'/)).toBeDefined();
      expect(screen.getByText(/0 Valid, 2 Invalid/)).toBeDefined();
    });

    it("rejects a required flag that is not true/false or yes/no", () => {
      openAndType("maybe\nNO\n1", [0, COL.required]);
      expect(
        screen.getByText(/Required must be true\/false or yes\/no/)
      ).toBeDefined();
      expect(screen.getByText(/2 Valid, 1 Invalid/)).toBeDefined();
    });

    it("rejects a codelist id the study does not define and accepts blank or none", () => {
      openAndType("CL_MISSING\nnone\nCL_NY", [0, COL.codelistId]);
      expect(
        screen.getByText(/Codelist ID 'CL_MISSING' does not exist/)
      ).toBeDefined();
      expect(screen.getByText(/2 Valid, 1 Invalid/)).toBeDefined();
    });

    it("accepts a section given by its title in any case", () => {
      openAndType(vsForm.sections[0].title.toUpperCase(), [0, COL.sectionId]);
      expect(screen.getByText(/1 Valid, 0 Invalid/)).toBeDefined();
      expect(commitButton().hasAttribute("disabled")).toBe(false);
    });

    it("rejects a variable rename the study engine cannot apply", () => {
      render(
        <ActiveFormGrid
          form={vsForm}
          study={withoutForm(study, vsForm.id)}
          selectedFieldId={null}
          onSelectField={onSelectField}
          onUpdateField={onUpdateField}
          onUpdateStudy={onUpdateStudy}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /Paste \/ Fill/i }));
      fireEvent.change(screen.getByPlaceholderText(/Paste TSV/i), {
        target: { value: "VSDTC" },
      });
      expect(
        screen.getByText(/Field 'f_vsdat' not found in form 'form_vs_onc'/)
      ).toBeDefined();
    });

    it("closes the preview from the Cancel and Close buttons", () => {
      openAndType("cm");
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /Paste \/ Fill/i }));
      fireEvent.click(screen.getByRole("button", { name: /Close dialog/i }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(onUpdateStudy).not.toHaveBeenCalled();
    });

    it("keeps the commit button disabled for an empty batch", () => {
      renderGrid();
      fireEvent.click(screen.getByRole("button", { name: /Paste \/ Fill/i }));
      expect(screen.getByText(/0 cells to update/)).toBeDefined();
      expect(commitButton().hasAttribute("disabled")).toBe(true);
    });
  });

  describe("committing a paste batch", () => {
    const pasteAt = (
      text: string,
      cell: [number, number],
      overrides: Partial<GridProps> = {}
    ) => {
      const { container } = renderGrid(overrides);
      fireEvent.click(getCell(container, ...cell));
      pasteInto(getGrid(container), text);
      fireEvent.click(screen.getByRole("button", { name: /Commit Batch/i }));
      return container;
    };

    it("applies every property column of a row in one study update", () => {
      const author: StudyReviewActor = {
        name: "Batch Editor",
        role: "Data Manager",
      };
      const threaded = StudyProtocolEngine.addReviewComment(
        study,
        "f_pulse",
        "Confirm units",
        author
      ).study;
      const row = [
        "Heart rate",
        "number",
        vsForm.sections[0].title,
        "no",
        "bpm",
        "5",
        "CL_NY",
        "VS.HR",
      ].join("\t");
      pasteAt(row, [6, COL.label], { study: threaded, reviewAuthor: author });

      expect(onUpdateStudy).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("dialog")).toBeNull();
      const field = findField(lastStudy(), vsForm.id, "f_pulse");
      expect(field).toMatchObject({
        label: "Heart rate",
        dataType: "number",
        required: false,
        unit: "bpm",
        columnSpan: 5,
        codelistId: "CL_NY",
      });
      expect(field.cdashMetadata?.acrfAnnotation).toBe("VS.HR");
      const thread = lastStudy().reviewThreads?.find(
        (t) => t.target.fieldId === "f_pulse"
      );
      const renamed = thread?.events.find((e) => e.type === "target-renamed");
      expect(renamed?.author.name).toBe("Batch Editor");
    });

    it("clears a codelist with a blank cell and builds aCRF metadata for a bare field", () => {
      const sec = vsForm.sections[0];
      const form: CRFForm = {
        ...vsForm,
        sections: [
          {
            ...sec,
            fields: sec.fields.map((f) =>
              f.id === "f_temp"
                ? { ...f, codelistId: "CL_NY", cdashMetadata: undefined }
                : f
            ),
          },
        ],
      };
      const bare: StudyProtocol = {
        ...study,
        forms: study.forms.map((f) => (f.id === form.id ? form : f)),
      };
      pasteAt("\tVS.TEMP", [7, COL.codelistId], { form, study: bare });

      const field = findField(lastStudy(), vsForm.id, "f_temp");
      expect(field.codelistId).toBeUndefined();
      expect(field.cdashMetadata).toEqual({
        domain: "VS",
        sdtmVariable: "TEMP",
        cdashLabel: field.label,
        core: "O",
        acrfAnnotation: "VS.TEMP",
      });
    });

    // Regression for #2576: "none" passed validation as "no codelist" but
    // was stored as the literal codelist id "none".
    it.each(["none", "None", "NONE"])(
      "clears the codelist when '%s' is pasted, like a blank cell",
      (text) => {
        const sec = vsForm.sections[0];
        const form: CRFForm = {
          ...vsForm,
          sections: [
            {
              ...sec,
              fields: sec.fields.map((f) =>
                f.id === "f_temp" ? { ...f, codelistId: "CL_NY" } : f
              ),
            },
          ],
        };
        const coded: StudyProtocol = {
          ...study,
          forms: study.forms.map((f) => (f.id === form.id ? form : f)),
        };
        pasteAt(text, [7, COL.codelistId], { form, study: coded });
        expect(onUpdateStudy).toHaveBeenCalledTimes(1);
        expect(
          findField(lastStudy(), vsForm.id, "f_temp").codelistId
        ).toBeUndefined();
      }
    );

    it("renames a variable without a label in the same row", () => {
      pasteAt("tempc", [7, COL.variableName]);
      const field = findField(lastStudy(), vsForm.id, "f_temp");
      expect(field.variableName).toBe("TEMPC");
    });

    it("moves a field to another section named by its title", () => {
      const target = dmForm.sections[1];
      pasteAt(target.title, [0, COL.sectionId], { form: dmForm });
      const form = getForm(lastStudy(), dmForm.id);
      expect(
        form.sections[1]?.fields.some(
          (f) => f.id === dmForm.sections[0].fields[0].id
        )
      ).toBe(true);
    });

    it("aborts the whole batch and keeps the preview open when the engine rejects an update", () => {
      pasteAt("Unreachable", [0, COL.label], {
        study: withoutForm(study, vsForm.id),
      });
      expect(onUpdateStudy).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    it("aborts the batch when a section move cannot be applied", () => {
      pasteAt(dmForm.sections[1].id, [0, COL.sectionId], {
        form: dmForm,
        study: withoutForm(study, dmForm.id),
      });
      expect(onUpdateStudy).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toBeDefined();
    });
  });
});
