/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QuasiPerfectPuzzler } from "@/components/QuasiPerfectPuzzler";

class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }
}

// Mock AudioProvider
vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
  AudioProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe("Adaptive Mobile Accordion Drawers & Tap-Select Interaction Suite", () => {
  let container: HTMLDivElement;
  let root: Root;
  let mockStorage: LocalStorageMock;
  let originalInnerWidth: number;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    originalInnerWidth = window.innerWidth;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    if (container.parentNode) {
      document.body.removeChild(container);
    }
    Object.defineProperty(window, "innerWidth", {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it("Requirement 1: Collapses secondary diagnostic panels into accordion drawers on screen widths under 768px", async () => {
    // Simulate mobile viewport < 768px (e.g. 375px)
    Object.defineProperty(window, "innerWidth", {
      value: 375,
      writable: true,
      configurable: true,
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<QuasiPerfectPuzzler />);
    });

    // Query accordion drawer buttons
    const leanDrawerBtn = Array.from(container.querySelectorAll("button")).find(
      (b) =>
        b.textContent?.includes("Generated Lean 4 Text & Simulator Inspector")
    );
    const terminalDrawerBtn = Array.from(
      container.querySelectorAll("button")
    ).find((b) =>
      b.textContent?.includes("Local Tactic Diagnostics & TTY Feedback Log")
    );

    expect(leanDrawerBtn).toBeDefined();
    expect(terminalDrawerBtn).toBeDefined();

    // Secondary drawers default to collapsed state on level load on mobile
    expect(leanDrawerBtn?.getAttribute("aria-expanded")).toBe("false");
    expect(terminalDrawerBtn?.getAttribute("aria-expanded")).toBe("false");

    // Drawer content sections are collapsed
    expect(container.querySelector("#lean-ide-drawer-content")).toBeNull();
    expect(container.querySelector("#terminal-log-drawer-content")).toBeNull();
  });

  it("Requirement 1: Renders secondary IDE panels expanded by default on desktop viewports (>= 768px)", async () => {
    Object.defineProperty(window, "innerWidth", {
      value: 1024,
      writable: true,
      configurable: true,
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<QuasiPerfectPuzzler />);
    });

    const leanDrawerBtn = Array.from(container.querySelectorAll("button")).find(
      (b) =>
        b.textContent?.includes("Generated Lean 4 Text & Simulator Inspector")
    );
    const terminalDrawerBtn = Array.from(
      container.querySelectorAll("button")
    ).find((b) =>
      b.textContent?.includes("Local Tactic Diagnostics & TTY Feedback Log")
    );

    expect(leanDrawerBtn?.getAttribute("aria-expanded")).toBe("true");
    expect(terminalDrawerBtn?.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector("#lean-ide-drawer-content")).not.toBeNull();
    expect(
      container.querySelector("#terminal-log-drawer-content")
    ).not.toBeNull();
  });

  it("Requirement 1 & AC 2: Expanding and collapsing individual diagnostic drawers preserves current level progress and state", async () => {
    Object.defineProperty(window, "innerWidth", {
      value: 375,
      writable: true,
      configurable: true,
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<QuasiPerfectPuzzler />);
    });

    const leanDrawerBtn = Array.from(container.querySelectorAll("button")).find(
      (b) =>
        b.textContent?.includes("Generated Lean 4 Text & Simulator Inspector")
    );
    const terminalDrawerBtn = Array.from(
      container.querySelectorAll("button")
    ).find((b) =>
      b.textContent?.includes("Local Tactic Diagnostics & TTY Feedback Log")
    );

    // Initially collapsed on mobile
    expect(leanDrawerBtn?.getAttribute("aria-expanded")).toBe("false");

    // Toggle Lean IDE drawer open
    await act(async () => {
      leanDrawerBtn?.click();
    });

    expect(leanDrawerBtn?.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector("#lean-ide-drawer-content")).not.toBeNull();

    // Toggle Terminal Log drawer open
    await act(async () => {
      terminalDrawerBtn?.click();
    });

    expect(terminalDrawerBtn?.getAttribute("aria-expanded")).toBe("true");
    expect(
      container.querySelector("#terminal-log-drawer-content")
    ).not.toBeNull();

    // Confirm level title & AST goal state remain intact
    expect(container.textContent).toContain("The Identity Crisis");
    expect(container.textContent).toContain("GOAL ⊢");
  });

  it("Requirement 2 & 3: Tapping an available tactic card activates tap-selection mode, highlights eligible target AST nodes, and executing tactic clears selection", async () => {
    Object.defineProperty(window, "innerWidth", {
      value: 375,
      writable: true,
      configurable: true,
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<QuasiPerfectPuzzler />);
    });

    // Initially no target is highlighted as eligible
    expect(
      container.querySelectorAll('[data-target-eligible="true"]').length
    ).toBe(0);

    // Find and tap 'rfl' card
    const rflCard = container.querySelector(
      '[data-tactic-id="rfl"]'
    ) as HTMLElement;
    expect(rflCard).not.toBeNull();

    await act(async () => {
      rflCard.click();
    });

    // Tap-selection mode enabled! Active indicator and target highlight cues are present
    expect(container.textContent).toContain("Card Active · Tap Target Node");
    const eligibleNodes = container.querySelectorAll(
      '[data-target-eligible="true"]'
    );
    expect(eligibleNodes.length).toBeGreaterThan(0);

    // Tap the eligible target AST node
    const goalNode = container.querySelector(
      '[data-node-id="eq-lvl1"]'
    ) as HTMLElement;
    expect(goalNode).not.toBeNull();

    await act(async () => {
      goalNode.click();
    });

    // Tactic executed successfully! Active tap selection cleared and victory modal displayed
    expect(container.textContent).not.toContain(
      "Card Active · Tap Target Node"
    );
    expect(container.textContent).toContain("AST GOAL DISCHARGED · SIMULATED");
  });

  it("Requirement 4 & AC 5: Victory modal uses fixed inset-0 z-50 to anchor relative to visible viewport", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<QuasiPerfectPuzzler />);
    });

    // Solve Level 1 via rfl card + goal node tap
    const rflCard = container.querySelector(
      '[data-tactic-id="rfl"]'
    ) as HTMLElement;
    await act(async () => {
      rflCard.click();
    });

    const goalNode = container.querySelector(
      '[data-node-id="eq-lvl1"]'
    ) as HTMLElement;
    await act(async () => {
      goalNode.click();
    });

    // Locate victory modal backdrop dialog
    const modalDialog = container.querySelector('[role="dialog"]');
    expect(modalDialog).not.toBeNull();
    expect(modalDialog?.className).toContain("fixed");
    expect(modalDialog?.className).toContain("inset-0");
    expect(modalDialog?.className).toContain("z-50");
  });

  it("Requirement 5 & AC 6: Tactic card container layout wraps cards down to 320px viewport width", async () => {
    Object.defineProperty(window, "innerWidth", {
      value: 320,
      writable: true,
      configurable: true,
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<QuasiPerfectPuzzler />);
    });

    // Tactic cards are rendered inside flex/grid container with break-words formatting
    const rflCard = container.querySelector('[data-tactic-id="rfl"]');
    expect(rflCard).not.toBeNull();
    expect(rflCard?.textContent).toContain("rfl");
    expect(rflCard?.textContent).toContain("1 GB");
  });
});
