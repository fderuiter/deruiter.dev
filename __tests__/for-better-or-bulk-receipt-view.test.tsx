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

/** Replaces window.scrollTo, recording the options of each call. */
function recordScrolls(): ScrollToOptions[] {
  const calls: ScrollToOptions[] = [];
  window.scrollTo = ((options: ScrollToOptions) => {
    calls.push(options);
  }) as typeof window.scrollTo;
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

const originalScrollTo = window.scrollTo;

afterEach(() => {
  cleanup();
  delete (window as Partial<Window>).matchMedia;
  window.scrollTo = originalScrollTo;
});

describe("the receipt lands clean when it opens (#1931)", () => {
  it("scrolls the page so the receipt sits its scroll margin below the top, smoothly", () => {
    stubMotion(false);
    const calls = recordScrolls();
    renderReceipt(0);
    const receipt = screen.getByTestId("fbb-receipt");
    expect(receipt.className).toContain("scroll-mt-28");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.behavior).toBe("smooth");
    // jsdom lays nothing out, so the receipt is at 0 and the scroll clamps there.
    expect(calls[0]?.top).toBe(0);
  });

  it("jumps without animation when the viewer prefers reduced motion", () => {
    stubMotion(true);
    const calls = recordScrolls();
    renderReceipt(0);
    expect(calls[0]?.behavior).toBe("auto");
  });
});

describe("the receipt's copy (#1931)", () => {
  it("never says the weather was perfect on a shower day", () => {
    stubMotion(false);
    recordScrolls();
    // A day played to 4:00, so the shower has come and gone before the receipt.
    const base = createLevel({ ...DEFAULT_SETUP, seed: 7 });
    const done = {
      ...base,
      phase: "done" as const,
      time: base.duration,
      finishedAt: base.duration,
    };
    render(
      <ReceiptView
        receipt={computeReceipt(done)}
        runCode={null}
        onPlayAgain={vi.fn()}
        onChangePlan={vi.fn()}
        onWatchReplay={vi.fn()}
      />
    );
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

describe("the receipt counts items and clears the navbar (#1933)", () => {
  it("says how many items of a two-item basket are placed, not that it is zero", () => {
    const level = createLevel(DEFAULT_SETUP);
    const state = {
      ...level,
      targets: level.targets.map((t) =>
        t.kind === "basket"
          ? {
              ...t,
              filled: [
                { kind: "arrangement" as const, madeBy: "fred" as const },
              ],
              filledBy: ["fred" as const],
              filledByHelper: [false],
            }
          : t
      ),
    };
    render(
      <ReceiptView
        receipt={computeReceipt(state)}
        runCode={null}
        onPlayAgain={vi.fn()}
        onChangePlan={vi.fn()}
        onWatchReplay={vi.fn()}
      />
    );
    expect(screen.getByText("Only 1 of 2 items placed at 4:00.")).toBeTruthy();
  });

  it("writes money with thousands separators", () => {
    renderReceipt(0);
    expect(screen.getByText(/Total \(budget \$3,400\)/)).toBeTruthy();
    expect(screen.queryByText(/\$\d{4}/)).toBeNull();
  });

  it("focuses the title without a second scroll, so the navbar never covers it", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    try {
      renderReceipt(0);
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
      expect(document.activeElement).toBe(screen.getByTestId("fbb-title"));
    } finally {
      focus.mockRestore();
    }
  });
});
