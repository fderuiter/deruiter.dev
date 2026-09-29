// @vitest-environment jsdom
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QuasiPerfectPuzzler } from "@/components/QuasiPerfectPuzzler/QuasiPerfectPuzzler";
import { describeModeRules, puzzleLevels } from "@/lib/quasi-perfect";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));

const click = (el: HTMLElement) => act(() => void fireEvent.click(el));
const text = () => document.body.textContent ?? "";

describe("describeModeRules (#1233)", () => {
  it("describes the finite 2x Story budget and never claims infinite RAM", () => {
    const level = puzzleLevels[1];
    const story = describeModeRules("story", level);
    const hacker = describeModeRules("hacker", level);
    const all = JSON.stringify([story, hacker]);
    expect(all).not.toMatch(/infinite/i);
    expect(story.budget).toContain("2× RAM");
    expect(story.budget).toContain("32 GB");
    expect(hacker.budget).toContain("16 GB");
    expect(story.failure).toMatch(/cost RAM/);
    expect(hacker.failure).toMatch(/cost RAM/);
    expect(story.exhaustion).toContain("0 GB");
    expect(story.exhaustion).toBe(hacker.exhaustion);
  });
});

describe("Quasi-Puzzler mode copy matches behavior (#1233)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it("keeps the Theory Briefing budget copy in step with the mode", () => {
    render(<QuasiPerfectPuzzler />);
    click(screen.getByRole("button", { name: /^L2/i }));
    click(screen.getByRole("button", { name: /Theory Briefing/i }));
    const rules = () => screen.getByTestId("briefing-mode-rules").textContent;
    expect(rules()).toContain("Story Mode:");
    expect(rules()).toContain("2× RAM");
    expect(rules()).not.toMatch(/infinite/i);
    const hackerBtns = screen.getAllByRole("button", {
      name: /^Hacker Mode$/i,
    });
    click(hackerBtns[hackerBtns.length - 1]);
    expect(rules()).toContain("Hacker Mode:");
    expect(rules()).toContain("16 GB");
    expect(rules()).not.toMatch(/infinite/i);
  });

  it.each([
    ["story", 32],
    ["hacker", 16],
  ] as const)("%s mode stops at 0 GB as its copy says", (mode, budget) => {
    render(<QuasiPerfectPuzzler />);
    click(screen.getByRole("button", { name: /^L2/i }));
    click(
      screen.getByRole("button", {
        name: mode === "story" ? /^Story Mode$/i : /^Hacker Mode$/i,
      })
    );
    expect(text()).toContain(`${budget}.0 / ${budget} GB`);
    const rfl = screen
      .getAllByRole("button")
      .find(
        (b) =>
          /rfl/i.test(b.textContent ?? "") &&
          !/Apply Tactic/.test(b.textContent ?? "")
      ) as HTMLElement;
    click(rfl);
    const goalRoot = document.querySelector('[data-node-id="eq-lvl2-symm"]');
    for (let i = 0; i < budget; i += 1) {
      click(goalRoot as HTMLElement);
    }
    expect(text()).toContain("SIMULATED RAM EXHAUSTED");
    expect(text()).toContain(
      "the simulated tactic session stops and the level must be reset"
    );
  });
});
