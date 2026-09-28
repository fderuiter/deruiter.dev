// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { getCompatibleTargets, computeMagneticSnap } from "@/lib/proof-utils";
import { ProofWorkspaceClient as ProofWorkspacePage } from "@/app/(desktop)/proof/ProofWorkspaceClient";

describe("Magnetic Snapping & Drag Guides Suite", () => {
  beforeEach(() => {
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
  });

  describe("getCompatibleTargets (Logic Inference Discovery)", () => {
    it("identifies valid deductive targets for Modus Ponens source nodes", () => {
      // For Node A (P), target should be Node C (Q) via Modus Ponens
      const targetsFromA = getCompatibleTargets("A", "modus-ponens", []);
      expect(targetsFromA.length).toBe(1);
      expect(targetsFromA[0].targetId).toBe("C");
      expect(targetsFromA[0].ruleSymbol).toBe("MP");
      expect(targetsFromA[0].badgeLabel).toContain("MP Target ⊢ Q");

      // For Node B (P -> Q), target should also be Node C (Q)
      const targetsFromB = getCompatibleTargets("B", "modus-ponens", []);
      expect(targetsFromB.length).toBe(1);
      expect(targetsFromB[0].targetId).toBe("C");

      // For Node C (Q) with existing initial edges A->C and B->C
      const targetsFromC = getCompatibleTargets("C", "modus-ponens", [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
      ]);
      expect(targetsFromC.length).toBeGreaterThan(0);
      expect(targetsFromC.some((t) => t.targetId === "E")).toBe(true);
    });

    it("returns empty list if edge is already established", () => {
      const targets = getCompatibleTargets("A", "modus-ponens", [
        { source: "A", target: "C" },
      ]);
      expect(targets).toHaveLength(0);
    });

    it("identifies valid transitive chaining targets for Hypothetical Syllogism", () => {
      const targetsFromA = getCompatibleTargets(
        "A",
        "hypothetical-syllogism",
        []
      );
      expect(targetsFromA.length).toBe(1);
      expect(targetsFromA[0].targetId).toBe("C");
      expect(targetsFromA[0].ruleSymbol).toBe("HS");
      expect(targetsFromA[0].badgeLabel).toContain("HS Target");
    });

    it("handles invalid or unknown source nodes gracefully", () => {
      const targets = getCompatibleTargets("Z", "modus-ponens", []);
      expect(targets).toEqual([]);
    });
  });

  describe("computeMagneticSnap (Smart Crosshair & Grid Math)", () => {
    const peerNodes = [
      { id: "A", x: 100, y: 100, width: 160, height: 70 },
      { id: "B", x: 400, y: 300, width: 160, height: 70 },
    ];

    it("snaps to peer node X center within threshold (12px) and generates vertical alignment guide", () => {
      // Peer A center X is 100 + 80 = 180.
      // If candidate node is at rawX = 105 (center X = 185, distance = 5px < 12px threshold), it should snap to 100.
      const result = computeMagneticSnap(105, 50, 160, 70, peerNodes, {
        gridSize: 20,
        threshold: 12,
        enableGrid: true,
        enableAlignment: true,
      });

      expect(result.snappedX).toBe(true);
      expect(result.x).toBe(100);
      expect(
        result.guides.some((g) => g.type === "vertical" && g.pos === 180)
      ).toBe(true);
    });

    it("snaps to peer node Y axis within threshold and generates horizontal alignment guide", () => {
      // Peer A top Y is 100. If candidate node is at rawY = 106 (dist = 6px < 12px threshold), snap to 100.
      const result = computeMagneticSnap(250, 106, 160, 70, peerNodes, {
        gridSize: 20,
        threshold: 12,
        enableGrid: true,
        enableAlignment: true,
      });

      expect(result.snappedY).toBe(true);
      expect(result.y).toBe(100);
      expect(result.guides.some((g) => g.type === "horizontal")).toBe(true);
    });

    it("falls back to 20px grid snapping when no peer alignment is in proximity", () => {
      // Position far from peer alignment: rawX = 222 (closest 20px grid is 220, dist = 2px)
      const result = computeMagneticSnap(222, 51, 160, 70, peerNodes, {
        gridSize: 20,
        threshold: 12,
        enableGrid: true,
        enableAlignment: true,
      });

      expect(result.x).toBe(220);
      expect(result.snappedX).toBe(true);
    });

    it("returns raw positions when snapping is disabled", () => {
      const result = computeMagneticSnap(105, 105, 160, 70, peerNodes, {
        enableGrid: false,
        enableAlignment: false,
      });

      expect(result.x).toBe(105);
      expect(result.y).toBe(105);
      expect(result.snappedX).toBe(false);
      expect(result.snappedY).toBe(false);
      expect(result.guides).toHaveLength(0);
    });
  });

  describe("ProofWorkspacePage Component Drag Guides & Snap UI", () => {
    it("renders Snap toggle button with active initial status in the canvas header", () => {
      render(<ProofWorkspacePage />);

      const snapBtn = screen.getByRole("button", {
        name: /Magnetic Snapping: Enabled/i,
      });
      expect(snapBtn).toBeDefined();
      expect(snapBtn.getAttribute("aria-pressed")).toBe("true");
    });

    it("toggles snapping on/off when clicking the Snap button", () => {
      render(<ProofWorkspacePage />);

      const snapBtn = screen.getByRole("button", {
        name: /Magnetic Snapping: Enabled/i,
      });
      fireEvent.click(snapBtn);

      const disabledSnapBtn = screen.getByRole("button", {
        name: /Magnetic Snapping: Disabled/i,
      });
      expect(disabledSnapBtn.getAttribute("aria-pressed")).toBe("false");

      // Click again to re-enable
      fireEvent.click(disabledSnapBtn);
      expect(snapBtn.getAttribute("aria-pressed")).toBe("true");
    });

    it("toggles snapping mode when pressing keyboard shortcut 'g'", () => {
      render(<ProofWorkspacePage />);

      const snapBtn = screen.getByRole("button", {
        name: /Magnetic Snapping: Enabled/i,
      });
      expect(snapBtn.getAttribute("aria-pressed")).toBe("true");

      // Press G key
      fireEvent.keyDown(window, { key: "g" });
      expect(
        screen.getByRole("button", { name: /Magnetic Snapping: Disabled/i })
      ).toBeDefined();

      // Press G key again
      fireEvent.keyDown(window, { key: "G" });
      expect(
        screen.getByRole("button", { name: /Magnetic Snapping: Enabled/i })
      ).toBeDefined();
    });

    it("renders connection anchor handles on node cards", () => {
      render(<ProofWorkspacePage />);

      const handleA = screen.getByRole("button", {
        name: /Drag connection handle from Node A/i,
      });
      const handleB = screen.getByRole("button", {
        name: /Drag connection handle from Node B/i,
      });
      expect(handleA).toBeDefined();
      expect(handleB).toBeDefined();
    });

    it("renders compatible target badges when a source node is selected", () => {
      render(<ProofWorkspacePage />);

      // In initial modus-ponens state, A->C and B->C already exist, so selecting Node C shows MP Target ⊢ R (for E)
      const nodeElements = screen.getAllByText("Node C");
      fireEvent.click(nodeElements[0]);

      // Should display rule badge "MP Target ⊢ R"
      expect(screen.getByText(/MP Target ⊢ R/i)).toBeDefined();
    });
  });
});
