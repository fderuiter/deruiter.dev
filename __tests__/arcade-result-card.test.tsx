// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import axe from "axe-core";
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

describe("ResultCard roll-up (#1940)", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("never shows a negative number when a frame predates the roll-up start", () => {
    reduceMotion(false);
    vi.spyOn(performance, "now").mockReturnValue(1000);
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    const { getByText, queryByText } = render(
      <ResultCard
        {...baseProps}
        primary={{ label: "Next", onClick: vi.fn() }}
      />
    );
    frames.shift()?.(990);
    expect(queryByText(/^-/)).toBeNull();
    expect(getByText("0")).toBeTruthy();
  });
});

describe("ResultCard phone layout, share and details (#2794)", () => {
  const originalShare = Object.getOwnPropertyDescriptor(navigator, "share");
  const originalClipboard = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard"
  );

  function setNavigator(name: "share" | "clipboard", value: unknown) {
    Object.defineProperty(navigator, name, { configurable: true, value });
  }

  beforeEach(() => reduceMotion(true));
  afterEach(() => {
    cleanup();
    for (const [name, descriptor] of [
      ["share", originalShare],
      ["clipboard", originalClipboard],
    ] as const) {
      if (descriptor) Object.defineProperty(navigator, name, descriptor);
      else Reflect.deleteProperty(navigator, name);
    }
  });

  const share = {
    text: "Act 1 cleared with 1250 points.",
    url: "https://deruiter.dev/arcade",
  };

  it("hooks the overlay, card and actions for the phone layout", () => {
    const { container, getByRole } = render(
      <ResultCard
        {...baseProps}
        primary={{ label: "Play again", onClick: vi.fn() }}
        secondary={{ label: "Exit", onClick: vi.fn() }}
        share={share}
      />
    );
    const dialog = getByRole("dialog");
    expect(dialog.classList.contains("arcade-result-card")).toBe(true);
    expect(
      dialog.parentElement?.classList.contains("arcade-result-overlay")
    ).toBe(true);
    const actions = container.querySelector(".arcade-result-actions");
    const labels = Array.from(actions?.querySelectorAll("button") ?? []).map(
      (button) => button.textContent
    );
    // The primary action stays last, so the phone column puts it nearest the thumb.
    expect(labels).toEqual(["Exit", "Share", "Play again"]);
  });

  it("uses Web Share where the browser has it", async () => {
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    setNavigator("share", nativeShare);
    const writeText = vi.fn();
    setNavigator("clipboard", { writeText });
    const { getByRole } = render(
      <ResultCard
        {...baseProps}
        primary={{ label: "Go", onClick: vi.fn() }}
        share={share}
      />
    );
    fireEvent.click(getByRole("button", { name: "Share" }));
    await waitFor(() =>
      expect(nativeShare).toHaveBeenCalledWith({ ...share, title: undefined })
    );
    expect(writeText).not.toHaveBeenCalled();
    expect(getByRole("status").textContent).toBe("");
  });

  it("treats a dismissed share sheet as no error and copies nothing", async () => {
    setNavigator(
      "share",
      vi.fn().mockRejectedValue(new DOMException("closed", "AbortError"))
    );
    const writeText = vi.fn();
    setNavigator("clipboard", { writeText });
    const { getByRole } = render(
      <ResultCard
        {...baseProps}
        primary={{ label: "Go", onClick: vi.fn() }}
        share={share}
      />
    );
    fireEvent.click(getByRole("button", { name: "Share" }));
    await waitFor(() => expect(navigator.share).toHaveBeenCalled());
    expect(writeText).not.toHaveBeenCalled();
    expect(getByRole("status").textContent).toBe("");
  });

  it("copies the text and link when Web Share is missing", async () => {
    setNavigator("share", undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator("clipboard", { writeText });
    const { getByRole } = render(
      <ResultCard
        {...baseProps}
        primary={{ label: "Go", onClick: vi.fn() }}
        share={{ ...share, label: "Share result" }}
      />
    );
    fireEvent.click(getByRole("button", { name: "Share result" }));
    await waitFor(() =>
      expect(getByRole("status").textContent).toBe("Copied to the clipboard.")
    );
    expect(writeText).toHaveBeenCalledWith(`${share.text} ${share.url}`);
  });

  it("says so when it can neither share nor copy", async () => {
    setNavigator("share", undefined);
    setNavigator("clipboard", {
      writeText: vi.fn().mockRejectedValue(new Error("denied")),
    });
    const { getByRole } = render(
      <ResultCard
        {...baseProps}
        primary={{ label: "Go", onClick: vi.fn() }}
        share={share}
      />
    );
    fireEvent.click(getByRole("button", { name: "Share" }));
    await waitFor(() =>
      expect(getByRole("status").textContent).toBe(
        "Sharing is not available here."
      )
    );
  });

  it("keeps game-specific numbers in a closed More stats disclosure", () => {
    const { container, getByText } = render(
      <ResultCard
        {...baseProps}
        primary={{ label: "Go", onClick: vi.fn() }}
        details={[
          { label: "Accuracy", value: 92, suffix: "%" },
          { label: "Bugs squashed", value: 41 },
        ]}
      />
    );
    const disclosure = container.querySelector("details");
    expect(disclosure?.open).toBe(false);
    expect(disclosure?.querySelector("summary")?.textContent).toBe(
      "More stats"
    );
    expect(getByText("92%")).toBeTruthy();
    expect(getByText("41")).toBeTruthy();
  });

  it("has zero axe violations with share and details", async () => {
    const { container } = render(
      <main>
        <ResultCard
          {...baseProps}
          primary={{ label: "Play again", onClick: vi.fn() }}
          secondary={{ label: "Exit", onClick: vi.fn() }}
          share={share}
          details={[{ label: "Accuracy", value: 92, suffix: "%" }]}
        />
      </main>
    );
    const result = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });
    expect(result.violations).toEqual([]);
  });

  it("adds no share, status or disclosure when a game passes neither", () => {
    const { container, queryByRole } = render(
      <ResultCard {...baseProps} primary={{ label: "Go", onClick: vi.fn() }} />
    );
    expect(queryByRole("button", { name: "Share" })).toBeNull();
    expect(queryByRole("status")).toBeNull();
    expect(container.querySelector("details")).toBeNull();
  });
});

describe("ResultCard phone stylesheet (#2794)", () => {
  const css = readFileSync(
    path.resolve(process.cwd(), "app/arcade/arcade.css"),
    "utf8"
  );
  const phoneBlock = css.slice(
    css.indexOf(
      "@media (pointer: coarse) and ((max-width: 743px) or (max-height: 500px)) {\n  .arcade-result-overlay"
    )
  );

  it("scopes the full-screen layout to PHONE_QUERY", () => {
    expect(phoneBlock.length).toBeGreaterThan(0);
    expect(phoneBlock).toMatch(/max-width: none;/);
    expect(phoneBlock).toMatch(
      /\.arcade-result-actions \{\s*margin-top: auto;/
    );
    expect(phoneBlock).toMatch(/\.arcade-result-small \{\s*font-size: 12px;/);
  });
});
