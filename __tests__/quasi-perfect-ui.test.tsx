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

describe("QuasiPerfectPuzzler UI Component Suite", () => {
  let container: HTMLDivElement;
  let root: Root;
  let mockStorage: LocalStorageMock;

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
    vi.restoreAllMocks();
  });

  it("renders the main puzzler scaffold and Chapter 1 Level 1 initial state", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<QuasiPerfectPuzzler />);
    });

    expect(container.textContent).toContain("Quasi-Perfect Puzzler");
    expect(container.textContent).toContain("The Identity Crisis");
    expect(container.textContent).toContain("Chapter 1 · Equational Reasoning");
    expect(container.textContent).toContain("18-Level 3-Chapter Curriculum");
    expect(container.textContent).toContain("rfl");
    expect(container.textContent).toContain("Generated Lean 4 Text");
    expect(container.textContent).toContain("Story Mode");
    expect(container.textContent).toContain("Hacker Mode");
  });

  it("does not expose a tab panel when only the default goal is present", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<QuasiPerfectPuzzler />);
    });

    expect(container.querySelector('[role="tablist"]')).toBeNull();
    expect(container.querySelector('[role="tabpanel"]')).toBeNull();
    expect(
      container.querySelector('[aria-labelledby^="subgoal-tab-"]')
    ).toBeNull();
  });

  it("solves Level 1 by applying the rfl tactic and displaying the victory modal", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<QuasiPerfectPuzzler />);
    });

    // Find and click the 'rfl' tactic card
    const rflCard = container.querySelector(
      '[data-tactic-id="rfl"]'
    ) as HTMLElement;
    expect(rflCard).not.toBeNull();

    await act(async () => {
      rflCard.click();
    });

    // Click the root goal node
    const goalNode = container.querySelector(
      '[data-node-id="eq-lvl1"]'
    ) as HTMLElement;
    expect(goalNode).not.toBeNull();

    await act(async () => {
      goalNode.click();
    });

    // Check Victory Modal is displayed
    expect(container.textContent).toContain("AST GOAL DISCHARGED · SIMULATED");
    expect(container.textContent).toContain("The Identity Crisis");
  });

  it("toggles and interacts with the Theory Briefing modal", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<QuasiPerfectPuzzler />);
    });

    // Open Theory Briefing modal
    const briefingBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Theory Briefing")
    );
    expect(briefingBtn).toBeDefined();

    await act(async () => {
      briefingBtn?.click();
    });

    expect(container.textContent).toContain("1. Mathematical Intuition");
    expect(container.textContent).toContain(
      "2. Formal Proof Assistant Analogy (Lean 4)"
    );
    expect(container.textContent).toContain(
      "3. Your Mission & Tactical Objective"
    );
    expect(container.textContent).toContain("The Reflexivity Axiom (rfl)");

    // Close modal via Start Proving button
    const startBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Start Proving")
    );
    expect(startBtn).toBeDefined();

    await act(async () => {
      startBtn?.click();
    });

    expect(container.textContent).not.toContain("1. Mathematical Intuition");
  });

  it("switches between Story Mode and Hacker Mode RAM budgets", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<QuasiPerfectPuzzler />);
    });

    // Story Mode shows a real RAM budget, double the Hacker Mode one
    expect(container.textContent).toContain("STORY MODE");
    expect(container.textContent).toContain("32.0 / 32 GB");
    expect(container.textContent).not.toContain("99");

    // Switch to Hacker Mode
    const hackerBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Hacker Mode"
    );
    expect(hackerBtn).toBeDefined();

    await act(async () => {
      hackerBtn?.click();
    });

    // Hacker mode displays RAM Gauge
    expect(container.textContent).toContain("16.0 / 16 GB");
    expect(container.textContent).toContain("Simulated Memory:");
    expect(container.textContent).toContain("SIMULATED RAM NOMINAL");
  });

  it("toggles and interacts with the Progressive Hints system", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<QuasiPerfectPuzzler />);
    });

    // Toggle Hints On
    const hintsButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Hints")
    );
    expect(hintsButton).toBeDefined();

    await act(async () => {
      hintsButton?.click();
    });

    expect(container.textContent).toContain(
      "Interactive Proof Coach · Progressive Hints"
    );
    expect(container.textContent).toContain("Tier 1 · Strategy Clue");
    expect(container.textContent).toContain(
      "Every mathematical object is equal to itself"
    );

    // Reveal Tier 2 Hint
    const revealButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Reveal Next Hint")
    );
    expect(revealButton).toBeDefined();

    await act(async () => {
      revealButton?.click();
    });

    expect(container.textContent).toContain("Tier 2 · Subtree Target Focus");
  });

  it("toggles Sandbox Mode with unlimited RAM", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<QuasiPerfectPuzzler />);
    });

    // Click Sandbox button
    const sandboxButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Sandbox")
    );
    expect(sandboxButton).toBeDefined();

    await act(async () => {
      sandboxButton?.click();
    });

    expect(container.textContent).toContain("Theorem Playground & AST Sandbox");
    expect(container.textContent).toContain("Unlimited RAM");
    expect(container.textContent).toContain("Preset 1");
  });

  it("switches tabs in the Lean IDE Inspector and browses Tactic Encyclopedia", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<QuasiPerfectPuzzler />);
    });

    expect(container.textContent).toContain("theorem identity_crisis");

    // Switch to Encyclopedia tab
    const encButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Tactic Encyclopedia")
    );
    expect(encButton).toBeDefined();

    await act(async () => {
      encButton?.click();
    });

    expect(container.textContent).toContain("tactic");
    expect(container.textContent).toContain("RAM Cost:");
  });

  it("filters levels by chapter across all 18 levels", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<QuasiPerfectPuzzler />);
    });

    const ch2Button = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Ch 2: Logic")
    );
    expect(ch2Button).toBeDefined();

    await act(async () => {
      ch2Button?.click();
    });

    // Chapter 2 contains Levels 7-12
    expect(container.textContent).toContain("L7");
    expect(container.textContent).toContain("L8");
    expect(container.textContent).toContain("L9");
    expect(container.textContent).toContain("L10");
    expect(container.textContent).toContain("L11");
    expect(container.textContent).toContain("L12");

    // Switch to Chapter 3
    const ch3Button = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Ch 3: Quasiperfect")
    );
    expect(ch3Button).toBeDefined();

    await act(async () => {
      ch3Button?.click();
    });

    // Chapter 3 contains Levels 13-18
    expect(container.textContent).toContain("L13");
    expect(container.textContent).toContain("L14");
    expect(container.textContent).toContain("L15");
    expect(container.textContent).toContain("L16");
    expect(container.textContent).toContain("L17");
    expect(container.textContent).toContain("L18");
  });

  it("solves Level 11 with cases, right/left disjunction branching and exact in UI", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<QuasiPerfectPuzzler />);
    });

    // 1. Switch to Level 11
    const l11Button = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "L11"
    );
    expect(l11Button).toBeDefined();

    await act(async () => {
      l11Button?.click();
    });

    expect(container.textContent).toContain("Disjunction Splitting");

    // 2. Play 'cases' on h_or
    const casesCard = container.querySelector(
      '[data-tactic-id="cases"]'
    ) as HTMLElement;
    expect(casesCard).not.toBeNull();

    await act(async () => {
      casesCard.click();
    });

    // Click hypothesis h_or node
    const hypOrNode = container.querySelector(
      '[data-node-id="hyp-disj-lvl11"]'
    ) as HTMLElement;
    expect(hypOrNode).not.toBeNull();

    await act(async () => {
      hypOrNode.click();
    });

    // Multi-goal tabs are now visible!
    expect(container.textContent).toContain("Case 1: P");
    expect(container.textContent).toContain("Case 2: Q");

    // 3. Subgoal 1: select 'right' tactic, then click root goal
    const rightCard = container.querySelector(
      '[data-tactic-id="right"]'
    ) as HTMLElement;
    expect(rightCard).not.toBeNull();

    await act(async () => {
      rightCard.click();
    });

    const goalDisjNode = container.querySelector(
      '[data-node-id="goal-disj-target-lvl11"]'
    ) as HTMLElement;
    expect(goalDisjNode).not.toBeNull();

    await act(async () => {
      goalDisjNode.click();
    });

    // Subgoal 1 now has goal P. Play 'exact h_left'
    const exactHLeft = Array.from(
      container.querySelectorAll('[data-tactic-id="exact"]')
    ).find((el) => el.textContent?.includes("exact h_left")) as HTMLElement;
    expect(exactHLeft).toBeDefined();

    await act(async () => {
      exactHLeft.click();
    });

    const goalPNode = container.querySelector(
      '[data-node-id="var-P-out-lvl11"]'
    ) as HTMLElement;
    expect(goalPNode).not.toBeNull();

    await act(async () => {
      goalPNode.click();
    });

    // Automatically advances to Subgoal 2 (Case 2: Q)
    expect(container.textContent).toContain("Case 2: Q");

    // 4. Subgoal 2: select 'left' tactic, then click root goal
    const leftCard = container.querySelector(
      '[data-tactic-id="left"]'
    ) as HTMLElement;
    expect(leftCard).not.toBeNull();

    await act(async () => {
      leftCard.click();
    });

    const goalDisjNode2 = container.querySelector(
      '[data-node-id="goal-disj-target-lvl11"]'
    ) as HTMLElement;
    expect(goalDisjNode2).not.toBeNull();

    await act(async () => {
      goalDisjNode2.click();
    });

    // Subgoal 2 now has goal Q. Play 'exact h_right'
    const exactHRight = Array.from(
      container.querySelectorAll('[data-tactic-id="exact"]')
    ).find((el) => el.textContent?.includes("exact h_right")) as HTMLElement;
    expect(exactHRight).toBeDefined();

    await act(async () => {
      exactHRight.click();
    });

    const goalQNode = container.querySelector(
      '[data-node-id="var-Q-out-lvl11"]'
    ) as HTMLElement;
    expect(goalQNode).not.toBeNull();

    await act(async () => {
      goalQNode.click();
    });

    // 5. Check Victory Modal
    expect(container.textContent).toContain("AST GOAL DISCHARGED · SIMULATED");
    expect(container.textContent).toContain("Disjunction Splitting");
  });
});
