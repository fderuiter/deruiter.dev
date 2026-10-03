// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React, { useState } from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
} from "@testing-library/react";
import { StudyOmnibar } from "@/components/crf/StudyOmnibar";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import type { OmnibarAction } from "@/lib/crf/study-omnibar";

const study = ONCOLOGY_RECIST_PRESET;

function Harness({
  onRunAction = vi.fn(),
  onOpenSpy,
  initiallyOpen = false,
  children,
}: {
  onRunAction?: (action: OmnibarAction) => void;
  onOpenSpy?: () => void;
  initiallyOpen?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div data-keyboard-boundary="true" data-studio-theme="dark">
      <button type="button" onClick={() => setOpen(true)}>
        Open finder
      </button>
      {children}
      <StudyOmnibar
        isOpen={open}
        onOpen={() => {
          onOpenSpy?.();
          setOpen(true);
        }}
        onClose={() => setOpen(false)}
        study={study}
        activeFormId="form_vs_onc"
        selectedFieldId={null}
        onRunAction={onRunAction}
      />
    </div>
  );
}

const getInput = () =>
  screen.getByRole("combobox", {
    name: "Search forms, fields, visits and actions",
  });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StudyOmnibar dialog (#544)", () => {
  it("focuses the search input immediately and lists categorized results", () => {
    render(<Harness initiallyOpen />);
    const dialog = screen.getByRole("dialog", { name: "Find in Study" });
    expect(document.activeElement).toBe(getInput());
    for (const heading of [
      "Forms",
      "Fields",
      "Visits",
      "Insert starter blocks",
      "Export",
    ]) {
      expect(within(dialog).getAllByText(heading).length).toBeGreaterThan(0);
    }
  });

  it("moves the active option with the arrow keys and runs it with Enter", () => {
    const onRunAction = vi.fn();
    render(<Harness initiallyOpen onRunAction={onRunAction} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: "weight" } });

    const options = screen.getAllByRole("option");
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    expect(options[0].textContent).toContain("Weight");
    expect(options[0].textContent).toContain(
      "Vital Signs & Physical Metrics (VS)"
    );
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0].id);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[1].getAttribute("aria-selected")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBe(options[1].id);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onRunAction).toHaveBeenCalledTimes(1);
    expect(onRunAction).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "open_field", fieldId: "f_weight" })
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("dismisses on Escape without running anything or reaching window listeners", () => {
    const onRunAction = vi.fn();
    const windowEscape = vi.fn();
    window.addEventListener("keydown", windowEscape);
    render(<Harness initiallyOpen onRunAction={onRunAction} />);
    fireEvent.change(getInput(), { target: { value: "weight" } });
    fireEvent.keyDown(getInput(), { key: "Escape" });
    window.removeEventListener("keydown", windowEscape);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onRunAction).not.toHaveBeenCalled();
    expect(windowEscape).not.toHaveBeenCalled();
  });

  it("restores focus to the control that opened it", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open finder" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(getInput());

    fireEvent.keyDown(getInput(), { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("filters to one category from the category chips", () => {
    render(<Harness initiallyOpen />);
    fireEvent.click(screen.getByRole("button", { name: "Visits" }));
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(study.visits.length);
    expect(
      options.every((o) => o.getAttribute("data-category") === "visit")
    ).toBe(true);
    expect(document.activeElement).toBe(getInput());
  });

  it("runs an export entry and a starter insertion through onRunAction", () => {
    const onRunAction = vi.fn();
    render(<Harness initiallyOpen onRunAction={onRunAction} />);
    fireEvent.change(getInput(), { target: { value: "word pdf" } });
    fireEvent.click(screen.getAllByRole("option")[0]);
    expect(onRunAction).toHaveBeenLastCalledWith({
      kind: "open_export_document",
    });

    fireEvent.click(screen.getByRole("button", { name: "Open finder" }));
    fireEvent.change(getInput(), { target: { value: "/vitals" } });
    const first = screen.getAllByRole("option")[0];
    expect(first.textContent).toContain(
      "Insert into Vital Signs & Physical Metrics (VS)"
    );
    fireEvent.keyDown(getInput(), { key: "Enter" });
    expect(onRunAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "insert", formId: "form_vs_onc" })
    );
  });

  it("explains that MedDRA/WHODrug lookup is unavailable instead of offering it", () => {
    render(<Harness initiallyOpen />);
    fireEvent.change(getInput(), { target: { value: "meddra" } });
    expect(
      screen.getByTestId("study-omnibar-dictionary-notice").textContent
    ).toContain("not available");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });
});

describe("StudyOmnibar F shortcut isolation (#544)", () => {
  function renderWithTargets(onOpenSpy: () => void) {
    return render(
      <Harness onOpenSpy={onOpenSpy}>
        <button type="button">Canvas control</button>
        <input aria-label="Field label" />
        <textarea aria-label="Help text" />
        <select aria-label="Data type">
          <option>text</option>
        </select>
        <div contentEditable suppressContentEditableWarning data-testid="rich">
          Rich text
        </div>
        <div data-keyboard-boundary="true">
          <button type="button">Terminal control</button>
        </div>
        <div role="dialog" aria-label="Other dialog">
          <button type="button">Dialog control</button>
        </div>
      </Harness>
    );
  }

  it("opens from a non-editable studio control", () => {
    const onOpen = vi.fn();
    renderWithTargets(onOpen);
    fireEvent.keyDown(screen.getByRole("button", { name: "Canvas control" }), {
      key: "f",
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "Find in Study" })).toBeTruthy();
  });

  it("stays out of text editors, selects, nested keyboard regions and dialogs", () => {
    const onOpen = vi.fn();
    renderWithTargets(onOpen);
    const targets = [
      screen.getByRole("textbox", { name: "Field label" }),
      screen.getByRole("textbox", { name: "Help text" }),
      screen.getByRole("combobox", { name: "Data type" }),
      screen.getByTestId("rich"),
      screen.getByRole("button", { name: "Terminal control" }),
      screen.getByRole("button", { name: "Dialog control" }),
    ];
    for (const target of targets) {
      fireEvent.keyDown(target, { key: "f" });
    }
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("leaves Ctrl/Cmd+F to the browser's find", () => {
    const onOpen = vi.fn();
    renderWithTargets(onOpen);
    const control = screen.getByRole("button", { name: "Canvas control" });
    fireEvent.keyDown(control, { key: "f", ctrlKey: true });
    fireEvent.keyDown(control, { key: "f", metaKey: true });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("does not reopen while typing f inside the omnibar itself", () => {
    const onOpen = vi.fn();
    render(<Harness initiallyOpen onOpenSpy={onOpen} />);
    fireEvent.keyDown(getInput(), { key: "f" });
    expect(onOpen).not.toHaveBeenCalled();
  });
});
