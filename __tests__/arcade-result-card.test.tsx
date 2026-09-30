// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { ResultCard } from "@/components/arcade/ResultCard";

function reduceMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const baseProps = {
  title: "Act 1 cleared",
  stamp: "Cleared",
  verdict: "win" as const,
  stats: [
    { label: "Score", value: 1250 },
    { label: "Max combo", value: 7, suffix: "x" },
  ],
};

describe("ResultCard (#1599)", () => {
  beforeEach(() => reduceMotion(true));
  afterEach(cleanup);

  it("is a labelled modal dialog that starts on its primary action", async () => {
    const onReplay = vi.fn();
    const { getByRole } = render(
      <ResultCard
        {...baseProps}
        primary={{ label: "Advance to Act 2", onClick: onReplay }}
        secondary={{ label: "Quit to title", onClick: vi.fn() }}
      />
    );
    const dialog = getByRole("dialog", { name: "Act 1 cleared" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const primary = getByRole("button", { name: "Advance to Act 2" });
    await waitFor(() => expect(document.activeElement).toBe(primary));
    fireEvent.click(primary);
    expect(onReplay).toHaveBeenCalledTimes(1);
  });

  it("shows final values at once under reduced motion", () => {
    const { getByText } = render(
      <ResultCard {...baseProps} primary={{ label: "Go", onClick: vi.fn() }} />
    );
    expect(getByText("1250")).toBeTruthy();
    expect(getByText("7x")).toBeTruthy();
  });

  it("reports a new best against the best from before the run", () => {
    const { getByText, rerender } = render(
      <ResultCard
        {...baseProps}
        score={1250}
        previousBest={1000}
        primary={{ label: "Go", onClick: vi.fn() }}
      />
    );
    expect(getByText("New best, 250 over your old record")).toBeTruthy();

    rerender(
      <ResultCard
        {...baseProps}
        score={800}
        previousBest={1000}
        primary={{ label: "Go", onClick: vi.fn() }}
      />
    );
    expect(getByText("200 short of your best (1000)")).toBeTruthy();

    rerender(
      <ResultCard
        {...baseProps}
        score={300}
        previousBest={0}
        primary={{ label: "Go", onClick: vi.fn() }}
      />
    );
    expect(getByText("First score on the board")).toBeTruthy();
  });

  it("names the verdict for screen readers and never loops an animation", () => {
    const { container, getByText } = render(
      <ResultCard
        {...baseProps}
        verdict="loss"
        stamp="Down"
        primary={{ label: "Go", onClick: vi.fn() }}
      />
    );
    expect(getByText("Down.")).toBeTruthy();
    expect(
      container.querySelector(".animate-pulse, .animate-bounce, .animate-ping")
    ).toBeNull();
  });
});
