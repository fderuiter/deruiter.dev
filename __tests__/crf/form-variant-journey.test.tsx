// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { StudySpine } from "@/components/crf/LeftSidebar/StudySpine";
import {
  StudyProtocolEngine,
  getFormUses,
  type StudyProtocol,
} from "@/lib/crf";
import { buildSharedVitalsStudy } from "./form-variant-fixtures";

/**
 * Mirrors CRFStudioContainer's history: every commit pushes the previous
 * study, and Undo pops it, so a variant must land as exactly one entry.
 */
function Harness({ initial }: { initial: StudyProtocol }) {
  const [study, setStudy] = useState(initial);
  const [history, setHistory] = useState<StudyProtocol[]>([]);
  const [activeFormId, setActiveFormId] = useState("form_vs");
  const commit = (next: StudyProtocol) => {
    setHistory((h) => [...h, study]);
    setStudy(next);
  };
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setStudy(history[history.length - 1]);
          setHistory((h) => h.slice(0, -1));
        }}
        disabled={history.length === 0}
      >
        Undo
      </button>
      <output data-testid="history-depth">{history.length}</output>
      <output data-testid="study-json">{JSON.stringify(study)}</output>
      <StudySpine
        study={study}
        activeVisitId="v_wk2"
        activeFormId={activeFormId}
        activeTab="forms"
        onChangeTab={vi.fn()}
        onSelectVisit={vi.fn()}
        onSelectForm={setActiveFormId}
        onAddVisit={vi.fn()}
        onDeleteVisit={vi.fn()}
        onAddForm={vi.fn()}
        onDuplicateForm={vi.fn()}
        onDeleteForm={vi.fn()}
        onOpenCdashScaffolder={vi.fn()}
        onAddField={vi.fn()}
        onAssignFormToVisit={vi.fn()}
        onUnassignFormFromVisit={vi.fn()}
        onInjectCdashForm={vi.fn()}
        onCommitFormVariant={(next, variantId) => {
          commit(next);
          setActiveFormId(variantId);
        }}
      />
    </div>
  );
}

describe("form variant journey (#675)", () => {
  let container: HTMLDivElement;
  let root: Root;

  const query = <T extends Element = HTMLElement>(sel: string) =>
    container.querySelector<T & Element>(sel);
  const dialog = () =>
    document.querySelector<HTMLElement>('[data-testid="form-variant-dialog"]');
  const button = (scope: ParentNode, text: string) =>
    Array.from(scope.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === text
    ) as HTMLButtonElement | undefined;
  const dialogLabels = () =>
    Array.from(dialog()!.querySelectorAll("fieldset")).flatMap((fs) =>
      Array.from(fs.querySelectorAll("label")).map((l) => ({ fs, l }))
    );
  const currentStudy = (): StudyProtocol =>
    JSON.parse(query('[data-testid="study-json"]')!.textContent!);
  const openInspector = async () => {
    const trigger = query<HTMLButtonElement>(
      'button[aria-label="Inspect visit uses of form Vital Signs"]'
    )!;
    trigger.focus();
    await act(async () => trigger.click());
    return trigger;
  };
  const pick = async (visitName: string, labelText: string) => {
    const match = dialogLabels().find(
      ({ fs, l }) =>
        fs.querySelector("legend")?.textContent?.includes(visitName) &&
        l.textContent?.includes(labelText)
    )!;
    await act(async () => match.l.querySelector("input")!.click());
  };

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      root = createRoot(container);
      root.render(<Harness initial={buildSharedVitalsStudy()} />);
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
  });

  it("states that ordinary edits affect every use of the shared form", async () => {
    expect(
      query('[data-testid="form-use-count-form_vs"]')?.textContent
    ).toContain("6 uses");
    expect(query('[data-testid="shared-form-notice"]')?.textContent).toContain(
      "change all 6 of its visit uses"
    );

    await openInspector();
    const d = dialog()!;
    expect(d.getAttribute("role")).toBe("dialog");
    expect(d.getAttribute("aria-modal")).toBe("true");
    expect(d.textContent).toContain(
      "Ordinary edits to this form change every use listed here"
    );
    expect(d.querySelectorAll("fieldset")).toHaveLength(2);
    expect(d.querySelectorAll('input[type="checkbox"]')).toHaveLength(6);
    expect(button(d, "Create variant")!.disabled).toBe(true);
  });

  it("previews, creates an arm-specific variant in one undoable step, and keeps edits independent", async () => {
    await openInspector();
    await pick("Week 4", "Placebo");

    const d = dialog()!;
    expect(
      d.querySelector('[data-testid="form-variant-summary"]')?.textContent
    ).toContain("1 of 6 uses move to");
    const changes = d.querySelector(
      '[data-testid="form-variant-changes"]'
    )!.textContent!;
    expect(changes).toContain(
      "Week 4 · Placebo: moves to Vital Signs (Variant)"
    );
    expect(changes).toContain("new arm-specific assignment");

    // The preview changed nothing yet.
    expect(query('[data-testid="history-depth"]')!.textContent).toBe("0");

    await act(async () => button(d, "Create variant")!.click());
    expect(dialog()).toBeNull();
    expect(query('[data-testid="history-depth"]')!.textContent).toBe("1");

    const study = currentStudy();
    const variant = study.forms.find(
      (f) => f.name === "Vital Signs (Variant)"
    )!;
    expect(variant).toBeDefined();
    expect(study.visits[0].assignedFormIds).toEqual(["form_dm", "form_vs"]);
    expect(study.visits[1].armFormAssignments).toEqual({
      arm_placebo: [variant.id],
    });
    expect(getFormUses(study, "form_vs")).toHaveLength(5);
    expect(container.textContent).toContain("Vital Signs (Variant)");

    // Independent subsequent edit: changing the variant leaves the shared form alone.
    const edited = StudyProtocolEngine.updateField(study, variant.id, "SYSBP", {
      label: "Systolic BP (placebo arm)",
    }).study;
    expect(
      edited.forms.find((f) => f.id === "form_vs")!.sections[0].fields[0].label
    ).toBe("Systolic BP");

    // One undo restores every original use.
    await act(async () => button(container, "Undo")!.click());
    const restored = currentStudy();
    expect(restored).toEqual(buildSharedVitalsStudy());
  });

  it("cancel and Escape leave the original uses untouched and restore focus", async () => {
    const trigger = await openInspector();
    await pick("Week 2", "Visit default");
    await act(async () => button(dialog()!, "Cancel")!.click());
    expect(dialog()).toBeNull();
    expect(query('[data-testid="history-depth"]')!.textContent).toBe("0");
    expect(currentStudy()).toEqual(buildSharedVitalsStudy());

    await openInspector();
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(query('[data-testid="history-depth"]')!.textContent).toBe("0");
  });

  it("checking a visit default carries its arms, and unchecking one pins it to the shared form", async () => {
    await openInspector();
    await pick("Week 4", "Visit default");
    expect(
      dialog()!.querySelector('[data-testid="form-variant-summary"]')
        ?.textContent
    ).toContain("3 of 6 uses move");
    await pick("Week 4", "Active");
    const changes = dialog()!.querySelector(
      '[data-testid="form-variant-changes"]'
    )!.textContent!;
    expect(changes).toContain(
      "Week 4 · Active: stays on Vital Signs (new arm-specific assignment)"
    );

    // Selecting every use is refused before commit.
    await pick("Week 4", "Active");
    await pick("Week 2", "Visit default");
    const d = dialog()!;
    expect(
      d.querySelector('[data-testid="form-variant-error"]')?.textContent
    ).toContain("Every use is selected");
    expect(button(d, "Create variant")!.disabled).toBe(true);
  });
});
