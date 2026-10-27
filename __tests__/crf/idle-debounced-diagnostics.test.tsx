// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useDebouncedDiagnostics } from "@/hooks/useDebouncedDiagnostics";
import { DiagnosticsDrawer } from "@/components/crf/DiagnosticsDrawer";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import { StudyProtocol, CRFForm } from "@/lib/crf/types";
import * as astEvaluator from "@/lib/crf";
import * as conformanceLinter from "@/lib/crf";

describe("Targeted Main-Thread Idle Scheduling & Debounced Diagnostic Badge Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("defers aggregate form issue count calculations during active typing and updates on trailing idle edge", async () => {
    const lintFormSpy = vi.spyOn(astEvaluator, "lintForm");

    const TestComponent = ({ study }: { study: StudyProtocol }) => {
      const { totalIssues, isPending } = useDebouncedDiagnostics(study, {
        debounceMs: 200,
        idleTimeoutMs: 100,
      });
      return (
        <div>
          <span data-testid="total-issues">{totalIssues}</span>
          <span data-testid="is-pending">
            {isPending ? "pending" : "ready"}
          </span>
        </div>
      );
    };

    let studyState = ONCOLOGY_RECIST_PRESET;

    await act(async () => {
      root.render(<TestComponent study={studyState} />);
    });

    lintFormSpy.mockClear();

    // Rapid edits (typing simulation)
    const faultyForm: CRFForm = {
      id: "form_bad",
      name: "Bad Form",
      domain: "DM",
      version: "1.0",
      description: "Test",
      rules: [],
      sections: [
        {
          id: "sec1",
          title: "Sec",
          fields: [
            {
              id: "f1",
              variableName: "CALC1",
              label: "Field 1",
              dataType: "calculated",
              calculationFormula: "",
              columnSpan: 6,
              required: true,
            },
          ],
        },
      ],
    };

    // Keystroke 1
    studyState = {
      ...studyState,
      forms: [faultyForm],
    };

    await act(async () => {
      root.render(<TestComponent study={studyState} />);
    });

    expect(
      container.querySelector('[data-testid="is-pending"]')?.textContent
    ).toBe("pending");

    // Keystroke 2 within 100ms
    vi.advanceTimersByTime(100);

    studyState = {
      ...studyState,
      forms: [
        {
          ...faultyForm,
          name: "Bad Form Updated",
        },
      ],
    };

    await act(async () => {
      root.render(<TestComponent study={studyState} />);
    });

    expect(
      container.querySelector('[data-testid="is-pending"]')?.textContent
    ).toBe("pending");

    // Advance time past the 200ms trailing debounce edge
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(
      container.querySelector('[data-testid="is-pending"]')?.textContent
    ).toBe("ready");
    expect(
      Number(
        container.querySelector('[data-testid="total-issues"]')?.textContent
      )
    ).toBeGreaterThan(0);
  });

  it("memoizes diagnostic drawer evaluation results against unchanged study protocol state", async () => {
    const lintFormSpy = vi.spyOn(astEvaluator, "lintForm");
    const validateComplianceSpy = vi.spyOn(
      conformanceLinter,
      "validateStudyCompliance"
    );

    const Wrapper = () => {
      const [, setCount] = useState(0);
      return (
        <div>
          <button onClick={() => setCount((c) => c + 1)}>
            Re-render Parent
          </button>
          <DiagnosticsDrawer
            isOpen={true}
            study={ONCOLOGY_RECIST_PRESET}
            onClose={vi.fn()}
            onSelectForm={vi.fn()}
          />
        </div>
      );
    };

    await act(async () => {
      root.render(<Wrapper />);
    });

    const initialLintCalls = lintFormSpy.mock.calls.length;
    const initialComplianceCalls = validateComplianceSpy.mock.calls.length;

    expect(initialLintCalls).toBeGreaterThan(0);
    expect(initialComplianceCalls).toBeGreaterThan(0);

    // Re-render parent component without changing study prop
    const button = container.querySelector("button");
    await act(async () => {
      button?.click();
    });

    // Verify lintForm and validateStudyCompliance were NOT called again
    expect(lintFormSpy.mock.calls.length).toBe(initialLintCalls);
    expect(validateComplianceSpy.mock.calls.length).toBe(
      initialComplianceCalls
    );
  });

  it("immediately cancels pending background diagnostic computations when new inputs or undo actions occur", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const studyInitial = ONCOLOGY_RECIST_PRESET;
    const studyEdited = {
      ...ONCOLOGY_RECIST_PRESET,
      forms: [
        {
          ...ONCOLOGY_RECIST_PRESET.forms[0],
          name: "Edited Form",
        },
      ],
    };

    const TestHarness = () => {
      const [currentStudy, setCurrentStudy] = useState(studyInitial);
      const { totalIssues, isPending } = useDebouncedDiagnostics(currentStudy, {
        debounceMs: 300,
      });

      return (
        <div>
          <button onClick={() => setCurrentStudy(studyEdited)}>
            Edit Input
          </button>
          <button onClick={() => setCurrentStudy(studyInitial)}>
            Undo Action
          </button>
          <div data-testid="issues">{totalIssues}</div>
          <div data-testid="status">{isPending ? "computing" : "idle"}</div>
        </div>
      );
    };

    await act(async () => {
      root.render(<TestHarness />);
    });

    // Advance 100ms (calculation pending)
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    const editBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Edit Input"
    );
    const undoBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Undo Action"
    );

    // Trigger edit
    await act(async () => {
      editBtn?.click();
    });

    expect(container.querySelector('[data-testid="status"]')?.textContent).toBe(
      "computing"
    );

    // Trigger undo before edit timer completes
    await act(async () => {
      vi.advanceTimersByTime(50);
      undoBtn?.click();
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();

    // Complete timer
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(container.querySelector('[data-testid="status"]')?.textContent).toBe(
      "idle"
    );
  });

  it("preserves object reference identity for form fields and diagnostic items during evaluation without worker cloning", async () => {
    const sampleForm = ONCOLOGY_RECIST_PRESET.forms[0];
    const sampleField = sampleForm.sections[0].fields[0];

    const lintItems = astEvaluator.lintForm(sampleForm);

    // Form field reference identity should remain identical
    expect(sampleForm.sections[0].fields[0]).toBe(sampleField);
    expect(lintItems).toBeDefined();
  });
});
