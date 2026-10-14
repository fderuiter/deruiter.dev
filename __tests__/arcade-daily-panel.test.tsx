/**
 * @vitest-environment jsdom
 */

import React from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import { ArcadeDailyPanel } from "@/components/arcade/ArcadeDailyPanel";
import {
  ARCADE_DAILY_GAMES,
  ARCADE_DAILY_STORAGE_KEY,
  arcadeDailyHref,
} from "@/lib/arcade/daily";
import { recordArcadeDailyResult } from "@/lib/arcade/daily-store";
import { safeStorage } from "@/lib/safe-storage";

const NOW = new Date("2026-10-14T12:00:00Z");

describe("ArcadeDailyPanel (#2113)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(NOW);
    safeStorage.clear();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("lists today's daily for every seed-capable game", () => {
    render(<ArcadeDailyPanel />);
    const panel = screen.getByTestId("arcade-daily-panel");
    expect(within(panel).getByText("2026-10-14")).toBeTruthy();
    for (const game of ARCADE_DAILY_GAMES) {
      const row = screen.getByTestId(`arcade-daily-${game.id}`);
      const link = within(row).getByRole("link", {
        name: `Play today's ${game.title} daily`,
      });
      expect(link.getAttribute("href")).toBe(
        arcadeDailyHref(game.id, "2026-10-14")
      );
      // 44px touch target.
      expect(link.className).toContain("min-h-[44px]");
      expect(within(row).getByText("Not played today")).toBeTruthy();
    }
    expect(screen.getByTestId("arcade-daily-streak").textContent).toContain(
      "Streak 0 days"
    );
  });

  it("shows a game's best and the streak once a daily is recorded", () => {
    window.localStorage.setItem(
      ARCADE_DAILY_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        bests: {},
        played: ["2026-10-13"],
        longest: 3,
      })
    );
    render(<ArcadeDailyPanel />);
    act(() => {
      recordArcadeDailyResult("patty-drive-thru", "2026-10-14", {
        score: 1250,
      });
      recordArcadeDailyResult("study-director", "2026-10-14", {
        score: 54,
        label: "Grade A, 4 stars",
      });
    });
    expect(
      screen.getByTestId("arcade-daily-patty-drive-thru").textContent
    ).toContain("Today's best: 1,250 shift score");
    expect(
      screen.getByTestId("arcade-daily-study-director").textContent
    ).toContain("Grade A, 4 stars");
    expect(screen.getByTestId("arcade-daily-streak").textContent).toBe(
      "Streak 2 days · Longest 3 days"
    );
  });

  it("rolls to the new day's links at midnight UTC", () => {
    render(<ArcadeDailyPanel />);
    act(() => {
      vi.setSystemTime(new Date("2026-10-15T00:00:30Z"));
      vi.advanceTimersByTime(60_000);
    });
    const link = within(
      screen.getByTestId("arcade-daily-for-better-or-bulk")
    ).getByRole("link");
    expect(link.getAttribute("href")).toBe(
      "/arcade/for-better-or-bulk?daily=2026-10-15"
    );
  });

  it("has zero axe violations", async () => {
    vi.useRealTimers();
    const { container } = render(
      <main>
        <ArcadeDailyPanel />
      </main>
    );
    const result = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });
    expect(result.violations).toEqual([]);
  });
});
