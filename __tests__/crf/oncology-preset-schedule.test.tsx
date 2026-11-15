// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { VisitMatrixEditor } from "@/components/crf/Modes/VisitMatrixEditor";
import { evaluateVisitWindowConflicts } from "@/lib/crf";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/**
 * The Phase III Oncology preset once opened with two "Overlap Error" badges
 * and a count on Schedule Intelligence (#3138). Its scheduled visits don't
 * overlap; the conflicts came from the Unscheduled visit, whose day-0
 * placeholder was checked as if it sat on the timeline. The check now skips
 * unscheduled visits, and this pins the preset's first open.
 */
describe("Oncology preset schedule on first open (#3138)", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
  });

  it("finds no window conflicts for any arm", () => {
    const arms = [
      undefined,
      ...(ONCOLOGY_RECIST_PRESET.arms ?? []).map((arm) => arm.id),
    ];
    for (const arm of arms) {
      expect(
        evaluateVisitWindowConflicts(ONCOLOGY_RECIST_PRESET.visits, arm)
          .conflicts,
        `arm ${arm ?? "all"}`
      ).toEqual([]);
    }
  });

  it("still keeps the Unscheduled visit the old check tripped on", () => {
    expect(
      ONCOLOGY_RECIST_PRESET.visits.some((v) => v.visitType === "Unscheduled")
    ).toBe(true);
  });

  it("renders no overlap badge and no conflict count in the schedule editor", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        <VisitMatrixEditor
          study={ONCOLOGY_RECIST_PRESET}
          onUpdateVisits={vi.fn()}
        />
      );
    });

    expect(
      container.querySelectorAll('[data-testid^="visit-conflict-badge-"]')
    ).toHaveLength(0);
    expect(container.textContent).not.toMatch(/Overlap (Error|Warning)/);
    const intelligence = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.startsWith("Schedule Intelligence")
    );
    expect(intelligence?.textContent).toBe("Schedule Intelligence");
  });
});
