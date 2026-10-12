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

/**
 * Stubs the geometry the scroll reads: the receipt's top in the viewport, the
 * page's scroll, and the scroll margin of the receipt's scroll-mt-28 class.
 */
function stubGeometry(geometry: {
  top: number;
  scrollY: number;
  scrollMarginTop: string;
}): void {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
    fromPartial<DOMRect>({ top: geometry.top })
  );
  Object.defineProperty(window, "scrollY", {
    value: geometry.scrollY,
    configurable: true,
    writable: true,
  });
  const computed = window.getComputedStyle.bind(window);
  vi.stubGlobal("getComputedStyle", (element: Element) =>
    element.classList.contains("scroll-mt-28")
      ? fromPartial<CSSStyleDeclaration>({
          scrollMarginTop: geometry.scrollMarginTop,
        })
      : computed(element)
  );
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(window, "scrollY", {
    value: 0,
    configurable: true,
    writable: true,
  });
  delete (window as Partial<Window>).matchMedia;
  window.scrollTo = originalScrollTo;
});

describe("the receipt lands clean when it opens (#1931)", () => {
  it("scrolls the page so the receipt sits its scroll margin below the top, smoothly", () => {
    stubMotion(false);
    stubGeometry({ top: 900, scrollY: 500, scrollMarginTop: "112px" });
    const calls = recordScrolls();
    renderReceipt(0);
    const receipt = screen.getByTestId("fbb-receipt");
    expect(receipt.className).toContain("scroll-mt-28");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.behavior).toBe("smooth");
    // The page's scroll, plus the receipt's offset in the viewport, less its margin.
    expect(calls[0]?.top).toBe(500 + 900 - 112);
  });

  it("clamps the scroll at the top of the page when the receipt is already near it", () => {
    stubMotion(false);
    stubGeometry({ top: 50, scrollY: 0, scrollMarginTop: "112px" });
    const calls = recordScrolls();
    renderReceipt(0);
    expect(calls[0]?.top).toBe(0);
  });

  it("scrolls back up to the receipt when the page has moved past it", () => {
    stubMotion(false);
    stubGeometry({ top: -1500, scrollY: 2000, scrollMarginTop: "112px" });
    const calls = recordScrolls();
    renderReceipt(0);
    expect(calls[0]?.top).toBe(2000 - 1500 - 112);
  });

  it("jumps without animation when the viewer prefers reduced motion", () => {
    stubMotion(true);
    stubGeometry({ top: 900, scrollY: 500, scrollMarginTop: "112px" });
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

describe("the receipt says each fact once (round 17)", () => {
  const view = (receipt: ReturnType<typeof computeReceipt>) =>
    render(
      <ReceiptView
        receipt={receipt}
        runCode={null}
        onPlayAgain={vi.fn()}
        onChangePlan={vi.fn()}
        onWatchReplay={vi.fn()}
      />
    );

  it("prints the finish time once, under the 3:00 challenge", () => {
    stubMotion(false);
    recordScrolls();
    const base = createLevel(DEFAULT_SETUP);
    const done = { ...base, phase: "done" as const, finishedAt: 60 };
    view(computeReceipt(done));
    const text = screen.getByTestId("fbb-receipt").textContent ?? "";
    expect(text.split("Everything was ready at").length - 1).toBe(1);
  });

  it("says a helper day's stars earn no trophies, and says nothing on a standard day", () => {
    stubMotion(false);
    recordScrolls();
    const helped = {
      ...createLevel({ ...DEFAULT_SETUP, assist: true }),
      assistTicks: 10,
    };
    const { unmount } = view(computeReceipt(helped));
    expect(screen.getByTestId("fbb-challenges").textContent).toContain(
      "A helper day, so these stars earn no trophies or board score."
    );
    unmount();
    view(computeReceipt(createLevel(DEFAULT_SETUP)));
    expect(screen.getByTestId("fbb-challenges").textContent).not.toContain(
      "helper day"
    );
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
    expect(
      screen.getByText("Only 1 of 2 items placed at 4:00. Fred carried 1 item.")
    ).toBeTruthy();
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

describe("the receipt's unplanned rows (round 19, N-4)", () => {
  afterEach(cleanup);

  it("says Not planned once, without a second line saying the same", () => {
    const receipt = computeReceipt(
      createLevel({
        ...DEFAULT_SETUP,
        cart: { ...DEFAULT_SETUP.cart, lanterns: false },
      })
    );
    render(
      <ReceiptView
        receipt={receipt}
        runCode={null}
        onPlayAgain={vi.fn()}
        onChangePlan={vi.fn()}
        onWatchReplay={vi.fn()}
      />
    );
    const text = screen.getByTestId("fbb-receipt").textContent ?? "";
    expect(text).toContain("Lanterns: Not planned");
    expect(text).not.toContain("Not in this plan.");
  });
});
