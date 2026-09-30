import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { StudyDirectorGame } from "@/components/study-director/StudyDirectorGame";

function start() {
  render(<StudyDirectorGame />);
  fireEvent.click(screen.getByRole("button", { name: /start the study/i }));
}

describe("StudyDirectorGame", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("opens with a briefing that explains attention, documentation and the dashboard", () => {
    render(<StudyDirectorGame />);
    expect(screen.getByTestId("study-briefing")).toBeTruthy();
    expect(screen.getByText(/Arcadia Therapeutics/)).toBeTruthy();
    expect(screen.getByText(/documentation/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /resume/i })).toBeNull();
  });

  it("starts on day 1 with a dashboard, six meters and the inbox", () => {
    start();
    expect(screen.getByText(/Day 1 \/ 77/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getAllByRole("meter").length).toBeGreaterThanOrEqual(12);
    expect(screen.getByRole("region", { name: "Inbox" })).toBeTruthy();
    expect(screen.getAllByText(/biomarkers/i).length).toBeGreaterThan(0);
  });

  it("spends attention when a decision is made and removes it from the inbox", () => {
    start();
    fireEvent.click(
      screen.getByRole("button", { name: /Sure, we'll add them/ })
    );
    const attention = screen.getByRole("img", { name: /attention left today/ });
    expect(attention.getAttribute("aria-label")).toMatch(/^4 of 5/);
    const inbox = screen.getByRole("region", { name: "Inbox" });
    expect(within(inbox).queryByText("Exploratory biomarkers")).toBeNull();
  });

  it("charges extra to document a decision", () => {
    start();
    fireEvent.click(screen.getByLabelText(/Document this decision/));
    fireEvent.click(
      screen.getByRole("button", { name: /Sure, we'll add them/ })
    );
    expect(
      screen
        .getByRole("img", { name: /attention left today/ })
        .getAttribute("aria-label")
    ).toMatch(/^3 of 5/);
  });

  it("supports keyboard shortcuts for choosing and ending the day", () => {
    start();
    const root = document.querySelector(
      '[data-keyboard-boundary="true"]'
    ) as HTMLElement;
    fireEvent.keyDown(root, { key: "1" });
    expect(
      screen
        .getByRole("img", { name: /attention left today/ })
        .getAttribute("aria-label")
    ).toMatch(/^4 of 5/);
    fireEvent.keyDown(root, { key: "e" });
    expect(screen.getByText(/Day 2 \/ 77/)).toBeTruthy();
  });

  it("skips quiet days to the next message", () => {
    start();
    expect(
      screen.queryByRole("button", { name: /Skip to next message/ })
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /Sure, we'll add them/ })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Skip to next message/ })
    );
    expect(screen.getByText(/Day [2-9] \/ 77/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "Inbox" }).textContent).toMatch(
      /1 open/
    );
  });

  it("audits a site and shows its real numbers", () => {
    start();
    expect(screen.getAllByText(/Audit to see the real numbers/).length).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: "Audit Site 03" }));
    expect(screen.getAllByText(/Audit to see the real numbers/).length).toBe(2);
    expect(screen.getByText("Open queries")).toBeTruthy();
    expect(
      screen
        .getByRole("img", { name: /attention left today/ })
        .getAttribute("aria-label")
    ).toMatch(/^3 of 5/);
  });

  it("warns when critical messages will lapse", () => {
    start();
    const root = document.querySelector(
      '[data-keyboard-boundary="true"]'
    ) as HTMLElement;
    for (let i = 0; i < 23; i += 1) fireEvent.keyDown(root, { key: "e" });
    expect(screen.getByText(/critical message/i)).toBeTruthy();
  });

  it("plays to the end and shows the report, then restarts", () => {
    start();
    const root = document.querySelector(
      '[data-keyboard-boundary="true"]'
    ) as HTMLElement;
    for (let i = 0; i < 120 && !screen.queryByTestId("study-report"); i += 1) {
      fireEvent.keyDown(
        document.querySelector('[data-keyboard-boundary="true"]') ?? root,
        { key: "e" }
      );
    }
    expect(screen.getByTestId("study-report")).toBeTruthy();
    expect(screen.getByText(/Your Study Director profile/i)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /start another study/i })
    );
    expect(screen.getByTestId("study-briefing")).toBeTruthy();
  });

  it("offers to resume a saved run", () => {
    start();
    const root = document.querySelector(
      '[data-keyboard-boundary="true"]'
    ) as HTMLElement;
    fireEvent.keyDown(root, { key: "e" });
    cleanup();
    render(<StudyDirectorGame />);
    fireEvent.click(screen.getByRole("button", { name: /resume day 2/i }));
    expect(screen.getByText(/Day 2 \/ 77/)).toBeTruthy();
  });

  it("leads with the open message and a status bar for schedule, budget and attention", () => {
    start();
    const bar = screen.getByTestId("study-status-bar");
    expect(within(bar).getByText("Protocol")).toBeTruthy();
    expect(within(bar).getByText(/Day 1 \/ 77/)).toBeTruthy();
    expect(
      within(bar).getByRole("img", { name: /% of budget spent/ })
    ).toBeTruthy();
    expect(within(bar).getByText("5 left")).toBeTruthy();
    const decision = screen.getByTestId("study-decision");
    expect(
      within(decision).getByRole("heading", { name: "Exploratory biomarkers" })
    ).toBeTruthy();
    expect(
      within(decision).getByRole("button", { name: "End day" })
    ).toBeTruthy();
  });

  it("points at audits when the inbox is empty", () => {
    start();
    fireEvent.click(
      screen.getByRole("button", { name: /Sure, we'll add them/ })
    );
    expect(
      within(screen.getByTestId("study-decision")).getByText(
        /Nothing needs an answer right now/
      )
    ).toBeTruthy();
    expect(screen.getByText(/auditing a site/)).toBeTruthy();
  });
});

describe("Study Director copy", () => {
  it("states the real daily attention everywhere the game is described", async () => {
    const { ATTENTION_PER_DAY } = await import("@/lib/study-director");
    const words = [
      "zero",
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
    ];
    const fs = await import("node:fs");
    const path = await import("node:path");
    const files = [
      "components/arcade/StudyDirectorClient.tsx",
      "components/arcade/ArcadeHubClient.tsx",
      "components/CommandPalette.tsx",
      "lib/arcade-data.ts",
    ];
    for (const file of files) {
      const text = fs
        .readFileSync(path.resolve(process.cwd(), file), "utf8")
        .replace(/\s+/g, " ");
      const counts = [
        ...text.matchAll(/(\w+) (?:daily )?attention points/gi),
      ].map((m) => m[1].toLowerCase());
      for (const count of counts) {
        expect(count, file).toBe(words[ATTENTION_PER_DAY]);
      }
    }
  });
});
