import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProofHeader } from "@/components/proof/ProofHeader";
import { THEOREMS } from "@/lib/proof-utils";

/**
 * Proof Canvas on phones (#3465): the view tabs scroll inside a labelled
 * region that shows when more tabs are off screen, and the header controls
 * are at least 44 px on coarse pointers. Layout itself is checked at 320,
 * 375 and 393 px by __tests__/e2e/proof-mobile-layout.spec.ts.
 */

let resizeCallback: (() => void) | null = null;

beforeEach(() => {
  resizeCallback = null;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resizeCallback = callback;
      }
      observe() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderHeader = () =>
  render(
    <ProofHeader
      activeTheoremId="modus-ponens"
      handleSwitchTheorem={vi.fn()}
      isE_Proven={false}
      edges={THEOREMS["modus-ponens"].initialEdges}
      handleCopyShareLink={vi.fn()}
      setIsCustomStudioOpen={vi.fn()}
      setIsExportModalOpen={vi.fn()}
      mobileActiveView="canvas"
      setMobileActiveView={vi.fn()}
      setActiveTab={vi.fn()}
    />
  );

/** Gives the scroller a size, as a browser would after layout. */
function size(el: HTMLElement, scrollWidth: number, clientWidth: number) {
  Object.defineProperty(el, "scrollWidth", {
    value: scrollWidth,
    configurable: true,
  });
  Object.defineProperty(el, "clientWidth", {
    value: clientWidth,
    configurable: true,
  });
}

describe("Proof view tabs on a phone", () => {
  it("puts all four view tabs in a labelled horizontal scroller", () => {
    renderHeader();
    const region = screen.getByRole("region", { name: "Proof views" });
    expect(region.className).toContain("overflow-x-auto");
    expect(
      within(region)
        .getAllByRole("button")
        .map((b) => b.textContent)
    ).toEqual(["Canvas", "Ledger", "Fallacy", "Terminal"]);
  });

  it("shows the end fade only while tabs are off screen to the right", () => {
    renderHeader();
    const region = screen.getByRole("region", { name: "Proof views" });
    const start = screen.getByTestId("proof-view-tabs-more-start");
    const end = screen.getByTestId("proof-view-tabs-more-end");

    size(region, 420, 300);
    act(() => resizeCallback?.());
    expect(end.getAttribute("data-visible")).toBe("true");
    expect(start.getAttribute("data-visible")).toBe("false");

    region.scrollLeft = 120;
    fireEvent.scroll(region);
    expect(end.getAttribute("data-visible")).toBe("false");
    expect(start.getAttribute("data-visible")).toBe("true");
  });

  it("hides the end fade once the last tab is in view, short of the padding", () => {
    renderHeader();
    const region = screen.getByRole("region", { name: "Proof views" });
    size(region, 398, 341);
    region.scrollLeft = 53; // 4 px of padding left to scroll
    fireEvent.scroll(region);
    expect(
      screen
        .getByTestId("proof-view-tabs-more-end")
        .getAttribute("data-visible")
    ).toBe("false");
  });

  it("shows no fade when the tabs fit", () => {
    renderHeader();
    const region = screen.getByRole("region", { name: "Proof views" });
    size(region, 300, 300);
    act(() => resizeCallback?.());
    expect(
      screen
        .getByTestId("proof-view-tabs-more-end")
        .getAttribute("data-visible")
    ).toBe("false");
  });
});

describe("Proof header targets on coarse pointers", () => {
  it("gives every view tab and header action a 44 px minimum", () => {
    renderHeader();
    const region = screen.getByRole("region", { name: "Proof views" });
    const targets = [
      ...within(region).getAllByRole("button"),
      screen.getByRole("button", { name: "Share" }),
      screen.getByRole("button", { name: "Custom Studio" }),
      screen.getByRole("button", { name: "Export" }),
    ];
    for (const target of targets) {
      expect(target.className).toContain("pointer-coarse:min-h-11");
    }
  });
});
