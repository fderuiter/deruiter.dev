import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Telemetry is not under test here. The real hook keeps a background sync
// timer that, with no network, logs a failure after the last test; under load
// the worker can close while that log is in flight, an EnvironmentTeardownError
// that fails the shard though every test passed.
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

// Mocks for window / canvas
beforeEach(() => {
  vi.restoreAllMocks();

  const mockContext = {
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4) }),
    putImageData: vi.fn(),
    createImageData: vi.fn(),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 100 }),
    transform: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    quadraticCurveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    setLineDash: vi.fn(),
    getLineDash: vi.fn().mockReturnValue([]),
  };

  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockContext);
});

import { LaserLoon } from "@/components/LaserLoon";
import { WorkingWithDuck } from "@/components/WorkingWithDuck";
import { QuasiPerfectPuzzler } from "@/components/QuasiPerfectPuzzler/QuasiPerfectPuzzler";
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";
import { ClinicalTrialChaos } from "@/components/ClinicalTrialChaos";
import { RetroLabyrinth } from "@/components/RetroLabyrinth";

describe("Off-screen Canvas DOM Fallback Subtree & Bidirectional ARIA Sync", () => {
  describe("Laser Loon Module", () => {
    it("renders off-screen DOM fallback subtree with semantic controls and outputs", () => {
      const { container } = render(<LaserLoon />);
      const fallbackDiv = container.querySelector(
        'div[aria-label="Laser Loon Accessible Subtree"]'
      );
      expect(fallbackDiv).not.toBeNull();
      expect(fallbackDiv?.classList.contains("sr-only")).toBe(true);

      const fieldset = fallbackDiv?.querySelector("fieldset");
      expect(fieldset).not.toBeNull();
      expect(
        screen.getByText("Laser Loon Game State and Controls")
      ).toBeDefined();

      // Check outputs
      const outputs = container.querySelectorAll("output");
      expect(outputs.length).toBeGreaterThan(0);

      // Check buttons
      const startBtn = screen.getByRole("button", { name: "Start Game" });
      expect(startBtn).toBeDefined();

      const rubyBtn = screen.getByRole("button", {
        name: "Optics: Ruby Laser",
      });
      expect(rubyBtn).toBeDefined();

      // Trigger button interaction
      fireEvent.click(rubyBtn);
      expect(rubyBtn.getAttribute("aria-pressed")).toBe("true");
    });
  });

  describe("Working with Duck Module", () => {
    it("renders off-screen DOM fallback subtree with interactive pet controls", () => {
      const { container } = render(<WorkingWithDuck />);
      const fallbackDiv = container.querySelector(
        'div[aria-label="Working with Duck Accessible Subtree"]'
      );
      expect(fallbackDiv).not.toBeNull();
      expect(fallbackDiv?.classList.contains("sr-only")).toBe(true);

      const outputs = container.querySelectorAll("output");
      expect(outputs.length).toBeGreaterThan(0);

      const treatBtn = screen.getByRole("button", { name: "Give Treat" });
      expect(treatBtn).toBeDefined();

      act(() => {
        fireEvent.click(treatBtn);
      });
    });
  });

  describe("Quasi-Perfect Puzzler Module", () => {
    it("renders off-screen DOM fallback subtree with proof assistant controls", () => {
      const { container } = render(<QuasiPerfectPuzzler />);
      const fallbackDiv = container.querySelector(
        'div[aria-label="Quasi-Puzzler Accessible Subtree"]'
      );
      expect(fallbackDiv).not.toBeNull();
      expect(fallbackDiv?.classList.contains("sr-only")).toBe(true);

      const outputs = container.querySelectorAll("output");
      expect(outputs.length).toBeGreaterThan(0);

      const undoBtn = screen.getByRole("button", { name: "Undo Tactic Step" });
      expect(undoBtn).toBeDefined();
    });
  });

  describe("Garmin Watch Simulator Module", () => {
    it("renders off-screen DOM fallback subtree with physical bezel controls", () => {
      const { container } = render(<GarminWatchSimulator />);
      const fallbackDiv = container.querySelector(
        'div[aria-label="Garmin Watch Accessible Subtree"]'
      );
      expect(fallbackDiv).not.toBeNull();
      // The readouts stay off screen; the watch buttons show while one of
      // them has keyboard focus, so Tab never lands somewhere unseen (#2129).
      const readouts = screen.getByRole("group", {
        name: "Garmin Simulator Telemetry and Status",
      });
      expect(readouts.classList.contains("sr-only")).toBe(true);
      const buttons = screen.getByRole("group", {
        name: "Garmin Watch Physical Controls",
      });
      expect(buttons.classList.contains("sr-only")).toBe(true);
      expect(buttons.classList.contains("focus-within:not-sr-only")).toBe(true);

      const outputs = container.querySelectorAll("output");
      expect(outputs.length).toBeGreaterThan(0);

      const startStopBtn = screen.getByRole("button", {
        name: "START / STOP Button",
      });
      expect(startStopBtn).toBeDefined();

      act(() => {
        fireEvent.click(startStopBtn);
      });
    });
  });

  describe("Clinical Trial Chaos Module", () => {
    it("renders off-screen DOM fallback subtree with SDTM compliance actions", () => {
      const { container } = render(<ClinicalTrialChaos />);
      const fallbackDiv = container.querySelector(
        'div[aria-label="Clinical Trial Chaos Accessible Subtree"]'
      );
      expect(fallbackDiv).not.toBeNull();
      expect(fallbackDiv?.classList.contains("sr-only")).toBe(true);

      const outputs = container.querySelectorAll("output");
      expect(outputs.length).toBeGreaterThan(0);

      const startPhaseBtn = screen.getByRole("button", {
        name: "Start Phase 1",
      });
      expect(startPhaseBtn).toBeDefined();
    });
  });

  describe("Retro Labyrinth Module", () => {
    it("renders off-screen DOM fallback subtree with dungeon navigation controls", () => {
      const { container } = render(<RetroLabyrinth />);
      const fallbackDiv = container.querySelector(
        'div[aria-label="Retro Labyrinth Accessible Subtree"]'
      );
      expect(fallbackDiv).not.toBeNull();
      expect(fallbackDiv?.classList.contains("sr-only")).toBe(true);

      const outputs = container.querySelectorAll("output");
      expect(outputs.length).toBeGreaterThan(0);

      const moveUpBtn = screen.getByRole("button", { name: "Move North / Up" });
      expect(moveUpBtn).toBeDefined();

      act(() => {
        fireEvent.click(moveUpBtn);
      });
    });
  });
});
