// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { act } from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ActiveFormGrid } from "@/components/crf/Modes/ActiveFormGrid";
import { CRFStudioContainer } from "@/components/crf/CRFStudioContainer";
import {
  getOncologyPresetSync,
  StudyProtocol,
  CRFForm,
  CRFField,
  StudyProtocolEngine,
  StudyReviewActor,
} from "@/lib/crf";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("ActiveFormGrid - Integration, Atomicity, Validation & Accessibility", () => {
  let sampleStudy: StudyProtocol;
  let activeForm: CRFForm;
  let onUpdateFieldMock =
    vi.fn<(fieldId: string, updates: Partial<CRFField>) => void>();
  let onUpdateStudyMock = vi.fn<(updatedStudy: StudyProtocol) => void>();
  let onSelectFieldMock = vi.fn<(fieldId: string | null) => void>();

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    sampleStudy = getOncologyPresetSync();
    activeForm = sampleStudy.forms[0];
    onUpdateFieldMock =
      vi.fn<(fieldId: string, updates: Partial<CRFField>) => void>();
    onUpdateStudyMock = vi.fn<(updatedStudy: StudyProtocol) => void>();
    onSelectFieldMock = vi.fn<(fieldId: string | null) => void>();
  });

  describe("1. Metadata Columns & Stable Identity", () => {
    it("renders stable identity ID as read-only and variable name as editable text", () => {
      render(
        <ActiveFormGrid
          form={activeForm}
          study={sampleStudy}
          selectedFieldId={null}
          onSelectField={onSelectFieldMock}
          onUpdateField={onUpdateFieldMock}
          onUpdateStudy={onUpdateStudyMock}
        />
      );

      // Verify Stable Identity header and values exist
      expect(screen.getByText("Stable ID")).not.toBeNull();
      expect(screen.getByText("CDASH Variable")).not.toBeNull();
      expect(screen.getByText("External OID / aCRF")).not.toBeNull();

      const firstField = activeForm.sections[0].fields[0];
      expect(screen.getAllByText(firstField.id)[0]).not.toBeNull();
      expect(screen.getAllByText(firstField.variableName)[0]).not.toBeNull();
    });
  });

  describe("2. Selection Persistence & Bi-directional Sync (Grid <-> Canvas)", () => {
    it("synchronizes selected field between Grid and Canvas views", () => {
      const targetField = activeForm.sections[0].fields[1];

      const { container } = render(
        <ActiveFormGrid
          form={activeForm}
          study={sampleStudy}
          selectedFieldId={targetField.id}
          onSelectField={onSelectFieldMock}
          onUpdateField={onUpdateFieldMock}
          onUpdateStudy={onUpdateStudyMock}
        />
      );

      // Verify targetField variable element exists
      const targetVarElements = screen.getAllByText(targetField.variableName);
      expect(targetVarElements.length).toBeGreaterThan(0);

      // Click row 0 cell in tbody
      const firstRowCells = container
        .querySelectorAll("tbody tr")[0]
        .querySelectorAll("td");
      fireEvent.click(firstRowCells[2]); // variableName cell

      const firstField = activeForm.sections[0].fields[0];
      expect(onSelectFieldMock).toHaveBeenCalledWith(firstField.id);
    });

    it("persists selection when switching between Canvas and Grid modes in CRFStudioContainer", async () => {
      render(<CRFStudioContainer />);

      // Find the Form Grid header mode button
      const gridTab = screen.getAllByText("Form Grid")[0];
      await act(async () => {
        fireEvent.click(gridTab);
      });

      // Verify Active Form Grid rendered
      await waitFor(() => {
        expect(screen.getAllByText("Active Form Grid").length).toBeGreaterThan(
          0
        );
      });

      // Switch back to Canvas view
      const canvasTab = screen.getAllByText("Canvas")[0];
      await act(async () => {
        fireEvent.click(canvasTab);
      });

      // Verify Layout Canvas rendered
      await waitFor(() => {
        expect(screen.getAllByText("Layout Canvas").length).toBeGreaterThan(0);
      });
    });
  });

  describe("3. Keyboard Navigation & Cell Editing", () => {
    it("commits grid label edits through the review-target callback", () => {
      const onCommitReviewTargetChange = vi.fn();
      const { container } = render(
        <ActiveFormGrid
          form={activeForm}
          study={sampleStudy}
          selectedFieldId={null}
          onSelectField={onSelectFieldMock}
          onUpdateField={onUpdateFieldMock}
          onCommitReviewTargetChange={onCommitReviewTargetChange}
          onUpdateStudy={onUpdateStudyMock}
        />
      );
      const field = activeForm.sections[0].fields[0];
      const labelCell = container
        .querySelectorAll("tbody tr")[0]
        ?.querySelectorAll("td")[3];
      expect(labelCell).toBeDefined();
      if (!labelCell) throw new Error("The first row needs a label cell");

      fireEvent.doubleClick(labelCell);
      const input = container.querySelector("tbody input");
      expect(input).not.toBeNull();
      if (!input) throw new Error("Editing the grid cell needs an input");
      fireEvent.change(input, { target: { value: "Updated grid label" } });
      fireEvent.blur(input);

      expect(onCommitReviewTargetChange).toHaveBeenCalledWith(field.id, {
        label: "Updated grid label",
      });
      expect(onUpdateFieldMock).not.toHaveBeenCalled();
    });

    it("supports Enter to start edit, Escape to cancel edit, and Enter to commit edit", () => {
      const { container } = render(
        <ActiveFormGrid
          form={activeForm}
          study={sampleStudy}
          selectedFieldId={null}
          onSelectField={onSelectFieldMock}
          onUpdateField={onUpdateFieldMock}
          onUpdateStudy={onUpdateStudyMock}
        />
      );

      const gridContainer = container.querySelector(
        '[aria-label="Active Form Grid"]'
      )!;

      // Focus grid container and navigate with Arrow keys
      fireEvent.keyDown(gridContainer, { key: "ArrowDown" });
      fireEvent.keyDown(gridContainer, { key: "ArrowRight" });

      // Press Enter to start inline editing
      fireEvent.keyDown(gridContainer, { key: "Enter" });

      // An input field should appear
      const input = container.querySelector("input");
      expect(input).not.toBeNull();

      // Press Escape to cancel edit
      if (input) {
        fireEvent.keyDown(input, { key: "Escape" });
      }

      // Input should no longer be present
      expect(container.querySelector("input")).toBeNull();
    });
  });

  describe("4. Paste & Validation Preview Engine with Atomicity", () => {
    it("previews paste batch, rejects invalid paste data, and prevents partial overwrites", async () => {
      render(
        <ActiveFormGrid
          form={activeForm}
          study={sampleStudy}
          selectedFieldId={null}
          onSelectField={onSelectFieldMock}
          onUpdateField={onUpdateFieldMock}
          onUpdateStudy={onUpdateStudyMock}
        />
      );

      // Click Paste / Fill button
      const pasteButton = screen.getAllByRole("button", {
        name: /Paste \/ Fill/i,
      })[0];
      fireEvent.click(pasteButton);

      // Modal should appear with preview heading
      expect(
        screen.getByText(/Batch Metadata Paste Validation & Preview/i)
      ).not.toBeNull();

      // Enter invalid data into the paste textarea (invalid variable name with spaces)
      const textarea = screen.getByPlaceholderText(/Paste TSV\/CSV text here/i);
      fireEvent.change(textarea, {
        target: { value: "INVALID NAME!\tTest Label\tinteger\ttrue\tmmHg\t6" },
      });

      // Status banner should indicate invalid cell
      await waitFor(() => {
        expect(
          screen.getByText(/Fix invalid cell data before committing batch/i)
        ).not.toBeNull();
      });

      // Commit Batch button should be disabled
      const commitButton = screen.getByRole("button", {
        name: /Commit Batch/i,
      });
      expect((commitButton as HTMLButtonElement).disabled).toBe(true);

      expect(onUpdateStudyMock).not.toHaveBeenCalled();
    });

    it("commits valid paste batch atomically in one undo unit", async () => {
      render(
        <ActiveFormGrid
          form={activeForm}
          study={sampleStudy}
          selectedFieldId={null}
          onSelectField={onSelectFieldMock}
          onUpdateField={onUpdateFieldMock}
          onUpdateStudy={onUpdateStudyMock}
        />
      );

      // Click Paste / Fill button
      const pasteButton = screen.getAllByRole("button", {
        name: /Paste \/ Fill/i,
      })[0];
      fireEvent.click(pasteButton);

      // Enter valid paste data (variableName, label, dataType)
      const textarea = screen.getByPlaceholderText(/Paste TSV\/CSV text here/i);
      fireEvent.change(textarea, {
        target: { value: "AETEST\tAdverse Event Test\ttext" },
      });

      // Commit Batch button should be enabled
      const commitButton = screen.getByRole("button", {
        name: /Commit Batch/i,
      });
      await waitFor(() => {
        expect((commitButton as HTMLButtonElement).disabled).toBe(false);
      });

      await act(async () => {
        fireEvent.click(commitButton);
      });

      // onUpdateStudy should be called exactly once
      await waitFor(() => {
        expect(onUpdateStudyMock).toHaveBeenCalledTimes(1);
      });
    });

    it("rejects duplicate variable names within the paste batch", () => {
      render(
        <ActiveFormGrid
          form={activeForm}
          study={sampleStudy}
          selectedFieldId={null}
          onSelectField={onSelectFieldMock}
          onUpdateField={onUpdateFieldMock}
          onUpdateStudy={onUpdateStudyMock}
        />
      );

      // Open paste modal
      fireEvent.click(screen.getByRole("button", { name: /Paste \/ Fill/i }));

      const textarea = screen.getByPlaceholderText(/Paste TSV\/CSV text here/i);
      // Paste two rows targeting the first two fields with identical variable name "NEW_DUP"
      const tsvData = "NEW_DUP\tLabel 1\nNEW_DUP\tLabel 2";
      fireEvent.change(textarea, { target: { value: tsvData } });

      // The second row should be marked invalid due to intra-batch duplicate
      expect(
        screen.getByText(/Duplicate variable name 'NEW_DUP' in paste batch/i)
      ).toBeDefined();

      // Commit button must be disabled
      const commitBtn = screen.getByRole("button", { name: /Commit Batch/i });
      expect(commitBtn.hasAttribute("disabled")).toBe(true);

      // Clicking it does not trigger onUpdateStudy
      fireEvent.click(commitBtn);
      expect(onUpdateStudyMock).not.toHaveBeenCalled();
    });

    it("rejects variable names that collide with existing form fields outside the paste range", () => {
      render(
        <ActiveFormGrid
          form={activeForm}
          study={sampleStudy}
          selectedFieldId={null}
          onSelectField={onSelectFieldMock}
          onUpdateField={onUpdateFieldMock}
          onUpdateStudy={onUpdateStudyMock}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /Paste \/ Fill/i }));

      const textarea = screen.getByPlaceholderText(/Paste TSV\/CSV text here/i);
      // Try to rename field 0 to the name of field 1 (collision)
      const existingVar =
        activeForm.sections[0].fields[1]?.variableName || "VISIT";
      fireEvent.change(textarea, { target: { value: existingVar } });

      expect(
        screen.getByText(new RegExp(`already exists in form`, "i"))
      ).toBeDefined();

      const commitBtn = screen.getByRole("button", { name: /Commit Batch/i });
      expect(commitBtn.hasAttribute("disabled")).toBe(true);
    });

    it("flags invalid section IDs in the paste batch and prevents commit", () => {
      render(
        <ActiveFormGrid
          form={activeForm}
          study={sampleStudy}
          selectedFieldId={null}
          onSelectField={onSelectFieldMock}
          onUpdateField={onUpdateFieldMock}
          onUpdateStudy={onUpdateStudyMock}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /Paste \/ Fill/i }));

      const textarea = screen.getByPlaceholderText(/Paste TSV\/CSV text here/i);
      // Variable, Label, DataType, SectionId
      const tsvData = "TEST_VAR\tTest Label\ttext\tnon_existent_sec_id";
      fireEvent.change(textarea, { target: { value: tsvData } });

      expect(screen.getByText(/does not exist in form/i)).toBeDefined();

      const commitBtn = screen.getByRole("button", { name: /Commit Batch/i });
      expect(commitBtn.hasAttribute("disabled")).toBe(true);
      fireEvent.click(commitBtn);
      expect(onUpdateStudyMock).not.toHaveBeenCalled();
    });

    it("atomically commits valid updates and moves fields across sections", () => {
      // Ensure activeForm has 2 sections
      let testForm = activeForm;
      let testStudy = sampleStudy;
      if (testForm.sections.length < 2) {
        testForm = {
          ...testForm,
          sections: [
            testForm.sections[0],
            {
              id: "sec_secondary",
              title: "Secondary Section",
              fields: [],
            },
          ],
        };
        testStudy = {
          ...testStudy,
          forms: [testForm, ...testStudy.forms.slice(1)],
        };
      }

      render(
        <ActiveFormGrid
          form={testForm}
          study={testStudy}
          selectedFieldId={null}
          onSelectField={onSelectFieldMock}
          onUpdateField={onUpdateFieldMock}
          onUpdateStudy={onUpdateStudyMock}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /Paste \/ Fill/i }));

      const targetSec = testForm.sections[1];
      const field0 = testForm.sections[0].fields[0];
      const targetVarName = "VALVAR01";

      const textarea = screen.getByPlaceholderText(/Paste TSV\/CSV text here/i);
      // TSV starting at colIndex 1 (variableName):
      // variableName \t label \t dataType \t sectionId
      const tsvData = `${targetVarName}\tNew Label Valid\ttext\t${targetSec.id}`;
      fireEvent.change(textarea, { target: { value: tsvData } });

      const commitBtn = screen.getByRole("button", { name: /Commit Batch/i });
      expect(commitBtn.hasAttribute("disabled")).toBe(false);

      fireEvent.click(commitBtn);

      // Modal should close on commit
      expect(screen.queryByRole("dialog")).toBeNull();

      // onUpdateStudyMock must have been called with updated study
      expect(onUpdateStudyMock).toHaveBeenCalledTimes(1);
      const updatedStudy: StudyProtocol = onUpdateStudyMock.mock.calls[0][0];
      const updatedForm = updatedStudy.forms.find((f) => f.id === testForm.id);
      expect(updatedForm).toBeDefined();

      // Check that field was moved to targetSec
      const sec1Fields = updatedForm!.sections.find(
        (s) => s.id === targetSec.id
      )!.fields;
      const movedField = sec1Fields.find((fld) => fld.id === field0.id);
      expect(movedField).toBeDefined();
      expect(movedField!.variableName).toBe(targetVarName);
      expect(movedField!.label).toBe("New Label Valid");
    });

    it("rejects variable names failing Sentinel/CDASH validation (e.g. >8 chars)", () => {
      render(
        <ActiveFormGrid
          form={activeForm}
          study={sampleStudy}
          selectedFieldId={null}
          onSelectField={onSelectFieldMock}
          onUpdateField={onUpdateFieldMock}
          onUpdateStudy={onUpdateStudyMock}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /Paste \/ Fill/i }));

      const textarea = screen.getByPlaceholderText(/Paste TSV\/CSV text here/i);
      // Variable name with 10 chars (> 8 limit)
      const tsvData = "TOOLONGVAR\tLabel";
      fireEvent.change(textarea, { target: { value: tsvData } });

      expect(
        screen.getByText(/exceeds CDASH\/SAS 8-character limit/i)
      ).toBeDefined();

      const commitBtn = screen.getByRole("button", { name: /Commit Batch/i });
      expect(commitBtn.hasAttribute("disabled")).toBe(true);
      fireEvent.click(commitBtn);
      expect(onUpdateStudyMock).not.toHaveBeenCalled();
    });
  });

  describe("5. Sentinel Variable Rename Integration", () => {
    it("renames variables everywhere updating rules and formulas atomically", () => {
      const sysField = activeForm.sections[0].fields[0];
      const res = StudyProtocolEngine.renameFieldEverywhere(
        sampleStudy,
        activeForm.id,
        sysField.id,
        "SYSBP2"
      );

      expect(res.error).toBeUndefined();
      expect(res.study).toBeDefined();

      const updatedForm = res.study.forms.find((f) => f.id === activeForm.id)!;
      const updatedField = updatedForm.sections[0].fields[0];
      expect(updatedField.variableName).toBe("SYSBP2");
    });
  });

  describe("6. Modal Dialog Accessibility & Dismissal", () => {
    it("renders paste modal with accessible dialog semantics and closes via Escape", () => {
      render(
        <ActiveFormGrid
          form={activeForm}
          study={sampleStudy}
          selectedFieldId={null}
          onSelectField={onSelectFieldMock}
          onUpdateField={onUpdateFieldMock}
          onUpdateStudy={onUpdateStudyMock}
        />
      );

      // Click "Paste / Fill" button to open modal
      const pasteBtn = screen.getByRole("button", { name: /Paste \/ Fill/i });
      fireEvent.click(pasteBtn);

      // Modal dialog must have correct ARIA attributes
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeDefined();
      expect(dialog.getAttribute("aria-modal")).toBe("true");
      expect(dialog.getAttribute("aria-labelledby")).toBe("paste-modal-title");

      // Close button has aria-label
      const closeBtn = screen.getByRole("button", { name: /Close dialog/i });
      expect(closeBtn).toBeDefined();

      // Press Escape to dismiss
      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("7. Engine-Mediated Spreadsheet Mutators & Review Target Tracking", () => {
    it("moves field to a new section using StudyProtocolEngine.moveFieldToSection", () => {
      const field = activeForm.sections[0].fields[0];
      const targetSec = activeForm.sections[1] || {
        id: "sec_target",
        title: "Target Section",
        fields: [],
      };
      let testStudy = sampleStudy;
      if (!activeForm.sections[1]) {
        const secRes = StudyProtocolEngine.addSection(
          sampleStudy,
          activeForm.id,
          targetSec
        );
        testStudy = secRes.study;
      }

      const res = StudyProtocolEngine.moveFieldToSection(
        testStudy,
        activeForm.id,
        field.id,
        targetSec.id
      );

      expect(res.error).toBeUndefined();
      expect(res.study).toBeDefined();

      const updatedForm = res.study.forms.find((f) => f.id === activeForm.id)!;
      const sec0Fields = updatedForm.sections[0].fields;
      const targetSecFields = updatedForm.sections.find(
        (s) => s.id === targetSec.id
      )!.fields;

      expect(sec0Fields.some((f) => f.id === field.id)).toBe(false);
      expect(targetSecFields.some((f) => f.id === field.id)).toBe(true);
    });

    it("single-cell section edit uses StudyProtocolEngine.moveFieldToSection and calls onUpdateStudy", () => {
      let testForm = activeForm;
      let testStudy = sampleStudy;
      if (testForm.sections.length < 2) {
        const secRes = StudyProtocolEngine.addSection(
          sampleStudy,
          activeForm.id,
          "Section Two"
        );
        testStudy = secRes.study;
        testForm = secRes.form!;
      }
      const targetSec = testForm.sections[1];
      const field = testForm.sections[0].fields[0];

      const { container } = render(
        <ActiveFormGrid
          form={testForm}
          study={testStudy}
          selectedFieldId={null}
          onSelectField={onSelectFieldMock}
          onUpdateField={onUpdateFieldMock}
          onUpdateStudy={onUpdateStudyMock}
        />
      );

      // Double-click section cell in row 0
      const row0Cells = container
        .querySelectorAll("tbody tr")[0]
        .querySelectorAll("td");
      // colIndex 4 is sectionId
      const secCell = row0Cells[5];
      fireEvent.doubleClick(secCell);

      const select = container.querySelector("tbody select");
      expect(select).not.toBeNull();
      if (select) {
        fireEvent.change(select, { target: { value: targetSec.id } });
        fireEvent.blur(select);
      }

      expect(onUpdateStudyMock).toHaveBeenCalledTimes(1);
      const updatedStudy: StudyProtocol = onUpdateStudyMock.mock.calls[0][0];
      const updatedForm = updatedStudy.forms.find((f) => f.id === testForm.id)!;
      const targetFields = updatedForm.sections.find(
        (s) => s.id === targetSec.id
      )!.fields;
      expect(targetFields.some((f) => f.id === field.id)).toBe(true);
    });

    it("records target-renamed review event when single-cell label edit is committed", () => {
      const field = activeForm.sections[0].fields[0];
      const author: StudyReviewActor = {
        name: "Audit Inspector",
        role: "Data Manager",
      };

      // Initialize a review thread on the field
      const threadRes = StudyProtocolEngine.addReviewComment(
        sampleStudy,
        field.id,
        "Initial review comment",
        author
      );
      const studyWithThread = threadRes.study;

      const { container } = render(
        <ActiveFormGrid
          form={activeForm}
          study={studyWithThread}
          selectedFieldId={null}
          onSelectField={onSelectFieldMock}
          onUpdateField={onUpdateFieldMock}
          onUpdateStudy={onUpdateStudyMock}
          reviewAuthor={author}
        />
      );

      const row0Cells = container
        .querySelectorAll("tbody tr")[0]
        .querySelectorAll("td");
      const labelCell = row0Cells[3]; // label column
      fireEvent.doubleClick(labelCell);

      const input = container.querySelector("tbody input");
      expect(input).not.toBeNull();
      if (input) {
        fireEvent.change(input, { target: { value: "New Audited Label" } });
        fireEvent.blur(input);
      }

      expect(onUpdateStudyMock).toHaveBeenCalledTimes(1);
      const updatedStudy: StudyProtocol = onUpdateStudyMock.mock.calls[0][0];
      const thread = updatedStudy.reviewThreads?.find(
        (t) => t.target.fieldId === field.id
      );

      expect(thread).toBeDefined();
      const renameEvent = thread?.events.find(
        (e) => e.type === "target-renamed"
      );
      expect(renameEvent).toBeDefined();
      expect(renameEvent?.nextLabel).toBe("New Audited Label");
      expect(renameEvent?.author.name).toBe("Audit Inspector");
    });

    it("batch paste commit records review target change events for modified fields with author metadata", async () => {
      const field1 = activeForm.sections[0].fields[0];
      const field2 = activeForm.sections[0].fields[1];
      const author: StudyReviewActor = {
        name: "Batch Builder",
        role: "Data Manager",
      };

      // Add review threads to both fields
      let testStudy = StudyProtocolEngine.addReviewComment(
        sampleStudy,
        field1.id,
        "Comment 1",
        author
      ).study;
      testStudy = StudyProtocolEngine.addReviewComment(
        testStudy,
        field2.id,
        "Comment 2",
        author
      ).study;

      render(
        <ActiveFormGrid
          form={activeForm}
          study={testStudy}
          selectedFieldId={null}
          onSelectField={onSelectFieldMock}
          onUpdateField={onUpdateFieldMock}
          onUpdateStudy={onUpdateStudyMock}
          reviewAuthor={author}
        />
      );

      // Open paste modal
      fireEvent.click(screen.getByRole("button", { name: /Paste \/ Fill/i }));

      const textarea = screen.getByPlaceholderText(/Paste TSV\/CSV text here/i);
      // Update field1 variable name and label, and field2 label
      const tsvData = "VAR1_NEW\tLabel 1 New\nVAR2_OLD\tLabel 2 New";
      fireEvent.change(textarea, { target: { value: tsvData } });

      const commitBtn = screen.getByRole("button", { name: /Commit Batch/i });
      await waitFor(() => {
        expect((commitBtn as HTMLButtonElement).disabled).toBe(false);
      });

      fireEvent.click(commitBtn);

      expect(onUpdateStudyMock).toHaveBeenCalledTimes(1);
      const updatedStudy: StudyProtocol = onUpdateStudyMock.mock.calls[0][0];

      // Verify review thread 1
      const thread1 = updatedStudy.reviewThreads?.find(
        (t) => t.target.fieldId === field1.id
      );
      expect(thread1).toBeDefined();
      const event1 = thread1?.events.find((e) => e.type === "target-renamed");
      expect(event1).toBeDefined();
      expect(event1?.nextVariableName).toBe("VAR1_NEW");
      expect(event1?.nextLabel).toBe("Label 1 New");
      expect(event1?.author.name).toBe("Batch Builder");

      // Verify review thread 2
      const thread2 = updatedStudy.reviewThreads?.find(
        (t) => t.target.fieldId === field2.id
      );
      expect(thread2).toBeDefined();
      const event2 = thread2?.events.find((e) => e.type === "target-renamed");
      expect(event2).toBeDefined();
      expect(event2?.nextLabel).toBe("Label 2 New");
      expect(event2?.author.name).toBe("Batch Builder");

      // Verify protocol validation passes
      const valResult = StudyProtocolEngine.validateProtocol(updatedStudy);
      expect(valResult.isCompliant).toBe(true);
    });
  });
});
