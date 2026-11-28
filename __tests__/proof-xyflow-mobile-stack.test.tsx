// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import {
  THEOREMS,
  canConnect,
  evaluateProofStatus,
  getNextTacticHint,
  type TheoremId,
} from "@/lib/proof";
import { createCustomTheorem, decodeGuidedEdgesHash } from "@/lib/proof-custom";
import { resolveWorkerSimulationSteps } from "@/app/proof/proof-worker";
import { ProofWorkspaceClient } from "@/app/proof/ProofWorkspaceClient";
import { ToastProvider } from "@/hooks/useToast";

function mockViewportMatchMedia(matchesMobile: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("max-width: 767px") ? matchesMobile : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("Proof XYFlow Desktop Graph & Mobile Topological Stack", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.history.replaceState(null, "", "/proof");
    globalThis.Worker = class MockWorker {
      postMessage = vi.fn();
      terminate = vi.fn();
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
      onmessage = null;
      onerror = null;
    } as unknown as typeof Worker;
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
  });

  it("renders reserved-height canvas skeleton then resolves XYFlow desktop graph on viewports >= 768px", async () => {
    mockViewportMatchMedia(false);
    const { container } = render(
      <ToastProvider>
        <ProofWorkspaceClient />
      </ToastProvider>
    );

    const skeleton = screen.queryByTestId("proof-canvas-surface-skeleton");
    if (skeleton) {
      expect(skeleton.className).toContain("min-h-[760px]");
      expect(skeleton.className).toContain("md:min-h-[520px]");
    }

    await screen.findByRole("button", { name: /^Node A / }, { timeout: 10000 });
    expect(container.querySelector(".react-flow")).not.toBeNull();
    expect(screen.queryByTestId("proof-mobile-topological-stack")).toBeNull();
    for (const id of ["A", "B", "C", "D", "E"]) {
      expect(
        screen.getByRole("button", { name: new RegExp(`^Node ${id} `) })
      ).toBeTruthy();
    }
  });

  it("renders 3-stage vertical mobile topological stack below 768px with tap-to-connect and accessible counterexample disclosure", () => {
    mockViewportMatchMedia(true);
    const { container } = render(
      <ToastProvider>
        <ProofWorkspaceClient />
      </ToastProvider>
    );

    expect(container.querySelector(".react-flow")).toBeNull();
    const stack = screen.getByTestId("proof-mobile-topological-stack");
    expect(stack).toBeTruthy();

    const stage1 = screen.getByTestId("proof-mobile-stage-1");
    const stage2 = screen.getByTestId("proof-mobile-stage-2");
    const stage3 = screen.getByTestId("proof-mobile-stage-3");

    expect(within(stage1).getByText("Node A")).toBeTruthy();
    expect(within(stage1).getByText("Node B")).toBeTruthy();
    expect(within(stage2).getByText("Node C")).toBeTruthy();
    expect(within(stage2).getByText("Node D")).toBeTruthy();
    expect(within(stage3).getByText("Node E")).toBeTruthy();

    // Selecting Node C highlights compatible target chip on Node E
    fireEvent.click(within(stage2).getByRole("button", { name: /^Node C / }));
    const tapConnectChip = within(stage3).getByRole("button", {
      name: /Tap to Connect Node C → Node E/i,
    });
    fireEvent.click(tapConnectChip);

    // Quick-connect button completes remaining step D -> E to discharge Q.E.D.
    const quickConnectBtn = within(stage3).getByRole("button", {
      name: /Connect C \+ D → Node E/i,
    });
    fireEvent.click(quickConnectBtn);
    expect(
      within(stage3).getByRole("button", { name: /^Node E PROVEN / })
    ).toBeTruthy();

    // Trigger rejected fallacy D -> C via CLI and verify mobile counterexample disclosure + focus restoration
    const input = screen.getByPlaceholderText(/Enter logic command/i);
    fireEvent.change(input, { target: { value: "connect D C" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    const counterexampleBtn = within(stage2).getByRole("button", {
      name: /^Counterexample.*badge for Node C/i,
    });
    expect(counterexampleBtn.getAttribute("aria-expanded")).toBe("false");
    const controlledPanelId = counterexampleBtn.getAttribute("aria-controls");
    expect(controlledPanelId).toBeTruthy();

    fireEvent.click(counterexampleBtn);
    expect(counterexampleBtn.getAttribute("aria-expanded")).toBe("true");
    expect(within(stage2).queryByRole("dialog")).toBeNull();

    const panel = within(stage2).getByRole("region", {
      name: /Counterexample diagnostics for Node C/i,
    });
    expect(panel.id).toBe(controlledPanelId);

    // Pressing Escape closes disclosure and restores focus to toggle
    fireEvent.keyDown(window, { key: "Escape" });
    expect(counterexampleBtn.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(counterexampleBtn);

    // Re-open and close via X button; focus returns to toggle
    fireEvent.click(counterexampleBtn);
    const closeBtn = within(stage2).getByRole("button", {
      name: /Close counterexample panel/i,
    });
    closeBtn.focus();
    fireEvent.click(closeBtn);
    expect(counterexampleBtn.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(counterexampleBtn);

    const dismissBtn = screen.getAllByRole("button", {
      name: /Dismiss Fallacy/i,
    })[0];
    fireEvent.click(dismissBtn);

    expect(screen.queryByText("FALLACY DETECTED")).toBeNull();
    expect(
      within(stage2).getByRole("button", { name: /^Node C PROVEN / })
    ).toBeTruthy();
  });

  it("enforces forward-only validPairs and directed proof status across all 12 built-in and custom theorems", () => {
    const theoremIds = Object.keys(THEOREMS) as TheoremId[];
    expect(theoremIds).toHaveLength(12);

    for (const id of theoremIds) {
      const th =
        id === "custom"
          ? createCustomTheorem(["P", "P -> Q", "Q -> R"], "R")
          : THEOREMS[id];

      expect(th.validPairs).toEqual([
        ["A", "C"],
        ["B", "C"],
        ["C", "E"],
        ["D", "E"],
      ]);

      // Reverse connections must fail validation
      expect(canConnect("C", "A", [], th).allowed).toBe(false);
      expect(canConnect("C", "B", [], th).allowed).toBe(false);
      expect(canConnect("E", "C", th.initialEdges, th).allowed).toBe(false);
      expect(canConnect("E", "D", th.initialEdges, th).allowed).toBe(false);

      // Reverse edges must never mark C or E proven
      const reverseStatus = evaluateProofStatus(
        [
          { source: "C", target: "A" },
          { source: "C", target: "B" },
          { source: "E", target: "C" },
          { source: "E", target: "D" },
        ],
        th
      );
      expect(reverseStatus.isC_Proven).toBe(false);
      expect(reverseStatus.isE_Proven).toBe(false);

      const reverseWithProvenC = evaluateProofStatus(
        [
          { source: "A", target: "C" },
          { source: "B", target: "C" },
          { source: "E", target: "C" },
          { source: "E", target: "D" },
        ],
        th
      );
      expect(reverseWithProvenC.isC_Proven).toBe(true);
      expect(reverseWithProvenC.isE_Proven).toBe(false);
      expect(
        getNextTacticHint(
          [
            { source: "A", target: "C" },
            { source: "B", target: "C" },
            { source: "E", target: "C" },
          ],
          th
        ).stepNumber
      ).toBe(2);
    }
  });

  it("emits theorem-specific simulation steps for all 12 theorems including consensus theorems", () => {
    const paxosSynod = resolveWorkerSimulationSteps("paxos-synod");
    expect(paxosSynod.length).toBeGreaterThan(0);
    expect(paxosSynod.join(" ")).toMatch(/quorum|Paxos|ballot/i);

    const paxosPhase2b = resolveWorkerSimulationSteps("paxos-phase2b");
    expect(paxosPhase2b.length).toBeGreaterThan(0);
    expect(paxosPhase2b.join(" ")).toMatch(/2b|chosen|quorum/i);

    const bftQuorum = resolveWorkerSimulationSteps("bft-quorum");
    expect(bftQuorum.length).toBeGreaterThan(0);
    expect(bftQuorum.join(" ")).toMatch(/Byzantine|honest|quorum|3f/i);

    for (const id of Object.keys(THEOREMS) as TheoremId[]) {
      const steps =
        id === "custom"
          ? resolveWorkerSimulationSteps("custom", [
              "A",
              "A -> B",
              "B -> C",
              "C",
            ])
          : resolveWorkerSimulationSteps(id);
      expect(steps.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("normalizes legacy reversed URL hash edges to forward validPairs, drops invalid pairs, and persists proven edges in window.location.hash", () => {
    const mp = THEOREMS["modus-ponens"];
    expect(decodeGuidedEdgesHash("A>C,B>C,E>C:MP,E>D:MP,A>E", mp)).toEqual([
      { source: "A", target: "C" },
      { source: "B", target: "C" },
      { source: "C", target: "E", ruleApplied: "MP" },
      { source: "D", target: "E", ruleApplied: "MP" },
    ]);
    expect(decodeGuidedEdgesHash("C>A,E>C,E>D", mp)).toEqual([
      { source: "A", target: "C" },
      { source: "C", target: "E" },
      { source: "D", target: "E" },
    ]);
    expect(decodeGuidedEdgesHash("A>E,B>D", mp)).toBeNull();

    // Hydrating a legacy reversed hash discharges Q.E.D. and normalizes window.location.hash
    window.history.replaceState(
      null,
      "",
      `/proof#edges=${encodeURIComponent("C>A,C>B,E>C,E>D")}`
    );
    mockViewportMatchMedia(false);
    render(
      <ToastProvider>
        <ProofWorkspaceClient />
      </ToastProvider>
    );

    expect(screen.getByText(/GRAPH COMPLETE/)).toBeTruthy();
    expect(decodeURIComponent(window.location.hash)).toContain(
      "edges=A>C,B>C,C>E,D>E"
    );
  });
});
