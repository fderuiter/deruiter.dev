/**
 * @vitest-environment jsdom
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";

const downloads = vi.hoisted(() => [] as { content: string; name: string }[]);
vi.mock("@/lib/download", () => ({
  downloadFile: (content: string, name: string) => {
    downloads.push({ content, name });
  },
}));
import { StudyDesignGrid } from "@/components/study-workspace/StudyDesignGrid";

afterEach(cleanup);

/** Run, cancel and results in the Randomization work area (#4006 part 3). */

async function opened() {
  const view = render(<StudyDesignGrid />);
  await screen.findByRole("table");
  return view;
}

const area = () =>
  within(screen.getByRole("region", { name: "Randomization work area" }));
const runArea = () =>
  within(screen.getByRole("region", { name: "Run and results", hidden: true }));
const stageButton = (title: string) =>
  within(area().getByRole("navigation", { name: "Randomization stages" }))
    .getAllByRole("button")
    .find((button) => button.textContent?.endsWith(title))!;

function commit(label: string, value: string) {
  const input = area().getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

async function readyExploration() {
  await opened();
  fireEvent.click(stageButton("Mechanics"));
  commit("Seed", "RunPanelSeed1");
  fireEvent.click(stageButton("Review"));
}

describe("randomization run panel", () => {
  it("keeps Run off until the plan is ready", async () => {
    await opened();
    fireEvent.click(stageButton("Review"));
    expect(
      (runArea().getByRole("button", { name: "Run" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      runArea().getByText(/Run is available once review reports/)
    ).toBeTruthy();
  });

  it("runs the frozen request, shows masked results and pages them", async () => {
    await readyExploration();
    fireEvent.click(runArea().getByRole("button", { name: "Run" }));
    await waitFor(() =>
      expect(
        runArea().getByText(/^16 of 16 allocations generated/)
      ).toBeTruthy()
    );
    const table = await runArea().findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(17);
    expect(within(table).queryByText("Treatment")).toBeNull();
    expect(
      (
        runArea().getByRole("button", {
          name: "Next rows",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    // An exploration never exports.
    expect(
      (
        runArea().getByRole("button", {
          name: "Download CSV",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(
      runArea().getByText(/An exploration cannot be exported/)
    ).toBeTruthy();
  });

  it("reproduces the same digest on a rerun with the same seed", async () => {
    await readyExploration();
    fireEvent.click(runArea().getByRole("button", { name: "Run" }));
    const first = await runArea().findByText(/^[0-9a-f]{64}$/);
    const digest = first.textContent;
    fireEvent.click(runArea().getByRole("button", { name: "Run again" }));
    await waitFor(() =>
      expect(runArea().getByText(/^[0-9a-f]{64}$/).textContent).toBe(digest)
    );
  });

  it("marks results stale after a plan edit and keeps them visible", async () => {
    await readyExploration();
    fireEvent.click(runArea().getByRole("button", { name: "Run" }));
    await runArea().findByRole("table");
    fireEvent.click(stageButton("Mechanics"));
    commit("Seed", "AnotherSeed2");
    fireEvent.click(stageButton("Review"));
    expect(runArea().getByRole("alert").textContent).toMatch(
      /stale: inputs-changed/
    );
    expect(runArea().getByRole("table")).toBeTruthy();
  });

  it("exports a promoted plan's masked schedule with the study metadata", async () => {
    await opened();
    fireEvent.click(area().getByRole("checkbox"));
    fireEvent.click(stageButton("Review"));
    fireEvent.click(
      area().getByRole("button", { name: "Promote to a plan for this study" })
    );
    fireEvent.click(stageButton("Mechanics"));
    commit("Seed", "ExportSeed42");
    fireEvent.click(stageButton("Review"));
    fireEvent.click(runArea().getByRole("button", { name: "Run" }));
    await runArea().findByRole("table");
    fireEvent.click(runArea().getByRole("button", { name: "Download CSV" }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    const csv = downloads[0].content;
    expect(csv).toMatch(/^# Protocol ID: \S+/m);
    expect(csv).toMatch(/^# Study name: \S+/m);
    expect(csv).toMatch(/^# Phase: \S+/m);
    expect(csv).toMatch(/^# Seed: ExportSeed42 \(custom\)$/m);
    expect(csv).toMatch(/masked-presentation/);
    expect(csv.split("\n").filter((l) => /^\d+,/.test(l)).length).toBe(16);
  });

  it("has no axe violations with results on screen", async () => {
    const { container } = await opened();
    fireEvent.click(stageButton("Mechanics"));
    commit("Seed", "RunPanelSeed1");
    fireEvent.click(stageButton("Review"));
    fireEvent.click(runArea().getByRole("button", { name: "Run" }));
    await runArea().findByRole("table");
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
