import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { fromPartial } from "@total-typescript/shoehorn";
import { ReceiptView } from "@/components/for-better-or-bulk/ReceiptView";
import {
  DEFAULT_SETUP,
  computeReceipt,
  createLevel,
} from "@/lib/for-better-or-bulk";

const REDUCED = "(prefers-reduced-motion: reduce)";

function renderReceipt(seed: number) {
  const receipt = computeReceipt(createLevel({ ...DEFAULT_SETUP, seed }));
  return render(
    <ReceiptView
      receipt={receipt}
      runCode={null}
      onPlayAgain={vi.fn()}
      onChangePlan={vi.fn()}
      onWatchReplay={vi.fn()}
    />
  );
}

/** Replaces scrollIntoView, recording the element and the options of each call. */
function recordScrolls(): { element: Element; options: unknown }[] {
  const calls: { element: Element; options: unknown }[] = [];
  Element.prototype.scrollIntoView = function (
    this: Element,
    options?: ScrollIntoViewOptions
  ) {
    calls.push({ element: this, options });
  };
  return calls;
}

function stubMotion(reduced: boolean): void {
  window.matchMedia = vi.fn((query: string) =>
    fromPartial<MediaQueryList>({
      matches: reduced && query === REDUCED,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  );
}

afterEach(() => {
  cleanup();
  delete (window as Partial<Window>).matchMedia;
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

describe("the receipt lands clean when it opens (#1931)", () => {
  it("scrolls itself to the top of the page, below the navbar, smoothly", () => {
    stubMotion(false);
    const calls = recordScrolls();
    renderReceipt(0);
    const receipt = screen.getByTestId("fbb-receipt");
    expect(calls).toEqual([
      { element: receipt, options: { block: "start", behavior: "smooth" } },
    ]);
    expect(receipt.className).toContain("scroll-mt-28");
  });

  it("jumps without animation when the viewer prefers reduced motion", () => {
    stubMotion(true);
    const calls = recordScrolls();
    renderReceipt(0);
    expect(calls[0]?.options).toEqual({ block: "start", behavior: "auto" });
  });
});

describe("the receipt's copy (#1931)", () => {
  it("never says the weather was perfect on a shower day", () => {
    stubMotion(false);
    recordScrolls();
    renderReceipt(7);
    const weather = screen.getByText("Weather:").closest("li");
    expect(weather?.textContent).toContain("The game had a shower");
    expect(weather?.textContent).not.toMatch(/perfect/i);
  });

  it("keeps the real weather line on a standard day", () => {
    stubMotion(false);
    recordScrolls();
    renderReceipt(0);
    const weather = screen.getByText("Weather:").closest("li");
    expect(weather?.textContent).toContain("The weather was perfect.");
  });

  it("says Unfinished once per category, not twice", () => {
    stubMotion(false);
    recordScrolls();
    renderReceipt(0);
    const readiness = screen.getByRole("region", { name: "At 4:00" });
    const rows = within(readiness).getAllByRole("listitem");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.textContent ?? "").not.toMatch(/Unfinished[\s\S]*Unfinished/);
    }
  });

  it("does not repeat the follow-through label before its status word", () => {
    stubMotion(false);
    recordScrolls();
    renderReceipt(0);
    const follow = screen.getByTestId("fbb-follow-through").textContent ?? "";
    expect(follow.startsWith("Follow-through: Kept.")).toBe(true);
    expect(follow).not.toMatch(/Follow-through:\s*\S+:/);
  });
});
