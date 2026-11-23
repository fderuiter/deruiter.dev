/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import { TrialSchemaFigure } from "@/components/study-workspace/TrialSchemaFigure";
import { DEMO_301_USDM } from "@/lib/study-data/presets";
import {
  TAVR_SAVR_USDM,
  importUsdmStudy,
  projectStudyDesignGrid,
  type StudyDesignGrid,
} from "@/lib/study-workspace";
import type { UsdmV4Document } from "@/lib/clinical-standards";

afterEach(cleanup);

/** The trial schema figure drawn from the design grid (#3406, ADR 0074). */

async function gridOf(document: UsdmV4Document): Promise<StudyDesignGrid> {
  const result = await importUsdmStudy({ document });
  if (result.status !== "ok") throw new Error(result.status);
  return projectStudyDesignGrid(result.workspace);
}

const svgTexts = (container: HTMLElement) =>
  [...container.querySelectorAll("svg text")].map((t) => t.textContent);

describe("trial schema figure", () => {
  it("matches the grid for DEMO-301", async () => {
    const grid = await gridOf(DEMO_301_USDM);
    const { container } = render(<TrialSchemaFigure grid={grid} />);
    const texts = svgTexts(container).join(" ");
    for (const name of [
      ...grid.arms.map((arm) => arm.name),
      ...grid.epochs.map((epoch) => epoch.name),
    ]) {
      expect(texts).toContain(name);
    }
    expect(
      screen.getByRole("img").getAttribute("aria-labelledby")
    ).toBeTruthy();
    expect(
      screen.getByText("Trial schema: 3 arms across 3 epochs")
    ).toBeTruthy();
    // Screening and follow-up hold one shared element across every arm, so
    // they are drawn once; treatment is drawn once per arm.
    expect(container.querySelectorAll("svg rect")).toHaveLength(5);
  });

  it("gives a text description with the same arms and epochs", async () => {
    const grid = await gridOf(DEMO_301_USDM);
    render(<TrialSchemaFigure grid={grid} />);
    const description = document.getElementById(
      screen.getByRole("img").getAttribute("aria-describedby") ?? ""
    );
    expect(description?.textContent).toContain(
      "Epochs in order: SCREENING, TREATMENT, FOLLOW-UP."
    );
    const items = [...(description?.querySelectorAll("li") ?? [])].map(
      (li) => li.textContent
    );
    expect(items).toHaveLength(3);
    expect(items[1]).toBe(
      "Demoxacin 10 mg: SCREENING, Screening (shared by all arms); TREATMENT, Demoxacin 10 mg; FOLLOW-UP, Follow-up (shared by all arms)."
    );
  });

  it("draws one box per cell when arms share no element", async () => {
    const grid = await gridOf(TAVR_SAVR_USDM);
    const { container } = render(<TrialSchemaFigure grid={grid} />);
    expect(container.querySelectorAll("svg rect")).toHaveLength(6);
  });

  it("marks a missing cell instead of drawing an element", async () => {
    const grid = await gridOf(TAVR_SAVR_USDM);
    const first = grid.rows[0];
    const missing: StudyDesignGrid = {
      ...grid,
      rows: [
        {
          ...first,
          cells: [
            { ...first.cells[0], cellId: null, elements: [] },
            ...first.cells.slice(1),
          ],
        },
        ...grid.rows.slice(1),
      ],
    };
    const { container } = render(<TrialSchemaFigure grid={missing} />);
    expect(svgTexts(container)).toContain("No cell");
    expect(container.querySelector("svg rect[stroke-dasharray]")).toBeTruthy();
  });

  it("asks for arms and epochs when the design has none", async () => {
    const grid = await gridOf(TAVR_SAVR_USDM);
    render(<TrialSchemaFigure grid={{ ...grid, arms: [], rows: [] }} />);
    expect(screen.getByText(/appears once the design has/)).toBeTruthy();
  });

  it("has no axe violations", async () => {
    const grid = await gridOf(DEMO_301_USDM);
    const { container } = render(<TrialSchemaFigure grid={grid} />);
    const results = await axe.run(container, {
      rules: { region: { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
