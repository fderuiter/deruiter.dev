// @vitest-environment jsdom
/**
 * CRF Studio's seven modes grouped into three stages, with one visible next
 * step (#2927 item 12, #2680).
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StudioHeader } from "@/components/crf/StudioHeader";
import {
  MODE_BY_KEY,
  STUDIO_MODE_ORDER,
  STUDIO_STAGES,
  nextStepFor,
  stageOfMode,
} from "@/components/crf/studio-stages";
import type { StudioMode } from "@/lib/crf";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(cleanup);

function renderHeader(activeMode: StudioMode, onChangeMode = vi.fn()) {
  render(
    <StudioHeader
      study={ONCOLOGY_RECIST_PRESET}
      activeMode={activeMode}
      canUndo={false}
      canRedo={false}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
      onChangeMode={onChangeMode}
      onSelectPreset={vi.fn()}
      onOpenDiagnostics={vi.fn()}
      onOpenFormCatalog={vi.fn()}
      onOpenBranding={vi.fn()}
      onOpenExportDocument={vi.fn()}
      onOpenWizard={vi.fn()}
    />
  );
  return onChangeMode;
}

describe("studio stages", () => {
  it("places every mode in exactly one stage, in Design, Schedule, Verify order", () => {
    expect(STUDIO_STAGES.map((stage) => stage.label)).toEqual([
      "Design",
      "Schedule",
      "Verify and ship",
    ]);
    expect(STUDIO_MODE_ORDER).toEqual([
      "designer",
      "grid",
      "rules",
      "matrix",
      "edc",
      "acrf",
      "export",
    ]);
    expect(new Set(STUDIO_MODE_ORDER).size).toBe(7);
  });

  it("numbers the shortcuts in stage order", () => {
    expect(MODE_BY_KEY).toEqual({
      "1": "designer",
      "2": "grid",
      "3": "rules",
      "4": "matrix",
      "5": "edc",
      "6": "acrf",
      "7": "export",
    });
  });

  it("points each stage at the first mode of the next, and the last at the pipeline", () => {
    expect(nextStepFor("rules")).toEqual({
      kind: "mode",
      mode: "matrix",
      label: "Schedule the forms",
    });
    expect(nextStepFor("matrix")).toEqual({
      kind: "mode",
      mode: "edc",
      label: "Test in Live EDC",
    });
    expect(nextStepFor("acrf")).toEqual({
      kind: "pipeline",
      label: "Run the pipeline",
    });
    expect(stageOfMode("grid").id).toBe("design");
  });
});

describe("StudioHeader mode bar", () => {
  it("renders the tabs in stage order inside one tablist", () => {
    renderHeader("designer");
    const tablist = screen.getByRole("tablist", {
      name: "Studio Mode Navigation",
    });
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    expect(tabs).toHaveLength(7);
    expect(tabs.map((tab) => tab.getAttribute("title"))).toEqual([
      expect.stringMatching(/Build the open form.*\(1\)$/),
      expect.stringMatching(/Edit every field.*\(2\)$/),
      expect.stringMatching(/Edit checks.*\(3\)$/),
      expect.stringMatching(/Schedule of Assessments.*\(4\)$/),
      expect.stringMatching(/Enter test data.*\(5\)$/),
      expect.stringMatching(/annotated CRF.*\(6\)$/),
      expect.stringMatching(/Download the study.*\(7\)$/),
    ]);
    expect(
      Array.from(tablist.querySelectorAll("[data-stage]")).map((group) =>
        group.getAttribute("data-stage")
      )
    ).toEqual(["design", "schedule", "verify"]);
  });

  it("groups the phone mode picker by stage", () => {
    renderHeader("designer");
    const picker = screen.getByRole("combobox", { name: "Studio mode" });
    expect(
      Array.from(picker.querySelectorAll("optgroup")).map((group) => [
        group.label,
        Array.from(group.querySelectorAll("option")).map(
          (option) => option.value
        ),
      ])
    ).toEqual([
      ["Design", ["designer", "grid", "rules"]],
      ["Schedule", ["matrix"]],
      ["Verify and ship", ["edc", "acrf", "export"]],
    ]);
  });

  it("moves to the next stage from the next-step button", () => {
    const onChangeMode = renderHeader("grid");
    const next = screen.getByTestId("studio-next-step");
    expect(next.textContent).toContain("Schedule the forms");
    fireEvent.click(next);
    expect(onChangeMode).toHaveBeenCalledWith("matrix");
  });

  it("arrow keys follow the stage order", () => {
    const onChangeMode = renderHeader("rules");
    fireEvent.keyDown(screen.getByRole("tab", { selected: true }), {
      key: "ArrowRight",
    });
    expect(onChangeMode).toHaveBeenCalledWith("matrix");
  });
});
