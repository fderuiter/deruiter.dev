// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { DuckControlDock } from "@/components/working-with-duck/DuckControlDock";
import {
  createDuckTouchBridge,
  DuckTouchProvider,
  type DuckCommand,
  type DuckTouchSnapshot,
} from "@/components/working-with-duck/touch-bridge";

const OFFICE: DuckTouchSnapshot = {
  scene: "office",
  aiming: false,
  paused: false,
};

/**
 * Renders the dock under a fresh bridge, with a spy registered as the game's
 * runner. The publish is the game's: it sets the scene the dock draws.
 */
function renderDock(snapshot: DuckTouchSnapshot = OFFICE) {
  const bridge = createDuckTouchBridge();
  const run = vi.fn<(command: DuckCommand) => void>();
  bridge.setRunner(run);
  bridge.publish(snapshot);
  render(
    <DuckTouchProvider bridge={bridge}>
      <DuckControlDock />
    </DuckTouchProvider>
  );
  return { bridge, run };
}

/** A tap is a pointer down, the same event a finger or Pencil sends. */
function tap(name: string) {
  fireEvent.pointerDown(screen.getByRole("button", { name }));
}

describe("DuckControlDock wiring (ADR 0061)", () => {
  afterEach(() => {
    cleanup();
  });

  describe("office scene", () => {
    it.each<[string, DuckCommand]>([
      ["Tennis ball", "toy-1"],
      ["Kong", "toy-2"],
      ["Squeaky toy", "toy-3"],
      ["Treat", "treat"],
      ["Sit", "trick-sit"],
      ["High Five", "trick-high-five"],
      ["Drop It", "trick-drop-it"],
      ["Spin", "trick-spin"],
      ["Work Sprint", "space"],
      ["Pause", "pause"],
    ])("the %s button runs %s", (name, command) => {
      const { run } = renderDock();
      tap(name);
      expect(run).toHaveBeenCalledTimes(1);
      expect(run).toHaveBeenCalledWith(command);
    });

    it("draws no park steering in the office", () => {
      renderDock();
      expect(screen.queryByRole("button", { name: "Move Up" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Move Down" })).toBeNull();
    });

    it("keys are at least 48px tall", () => {
      renderDock();
      const key = screen.getByRole("button", { name: "Kong" });
      expect(key.className).toContain("h-12");
      expect(key.className).toContain("min-h-[44px]");
    });
  });

  describe("park scene", () => {
    const PARK: DuckTouchSnapshot = {
      scene: "park",
      aiming: false,
      paused: false,
    };

    it("steers up and down with the pad, and draws no sideways arrows", () => {
      const { run } = renderDock(PARK);
      expect(screen.queryByRole("button", { name: "Move Left" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Move Right" })).toBeNull();
      tap("Move Up");
      expect(run).toHaveBeenLastCalledWith("steer-up");
      tap("Move Down");
      expect(run).toHaveBeenLastCalledWith("steer-down");
    });

    it("jumps a hurdle with the jump key, and throws while aiming", () => {
      const { run, bridge } = renderDock(PARK);
      tap("Jump");
      expect(run).toHaveBeenLastCalledWith("space");

      act(() => bridge.publish({ ...PARK, aiming: true }));
      tap("Throw");
      expect(run).toHaveBeenLastCalledWith("space");
    });

    it("keeps treat and pause, and drops the office toys and tricks", () => {
      const { run } = renderDock(PARK);
      expect(screen.queryByRole("button", { name: "Kong" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Spin" })).toBeNull();
      tap("Treat");
      expect(run).toHaveBeenLastCalledWith("treat");
      tap("Pause");
      expect(run).toHaveBeenLastCalledWith("pause");
    });
  });

  describe("bathtub scene", () => {
    it("offers the treat and pause only", () => {
      const { run } = renderDock({
        scene: "bath",
        aiming: false,
        paused: false,
      });
      expect(screen.queryByRole("button", { name: "Work Sprint" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Kong" })).toBeNull();
      tap("Treat");
      expect(run).toHaveBeenLastCalledWith("treat");
    });
  });

  describe("paused sprint", () => {
    it("disables every control but Resume, which unpauses through pause", () => {
      const { run } = renderDock({
        scene: "office",
        aiming: false,
        paused: true,
      });
      expect(screen.getByRole("button", { name: "Kong" })).toHaveProperty(
        "disabled",
        true
      );
      expect(
        screen.getByRole("button", { name: "Work Sprint" })
      ).toHaveProperty("disabled", true);
      const resume = screen.getByRole("button", { name: "Resume" });
      expect(resume).toHaveProperty("disabled", false);
      tap("Resume");
      expect(run).toHaveBeenLastCalledWith("pause");
    });
  });

  it("follows the scene the game publishes", () => {
    const { bridge } = renderDock();
    expect(
      screen.getByTestId("duck-control-dock").getAttribute("data-scene")
    ).toBe("office");
    act(() => bridge.publish({ scene: "park", aiming: false, paused: false }));
    expect(
      screen.getByTestId("duck-control-dock").getAttribute("data-scene")
    ).toBe("park");
    expect(screen.getByRole("button", { name: "Move Up" })).toBeTruthy();
  });

  it("draws nothing without a cabinet bridge", () => {
    const { container } = render(<DuckControlDock />);
    expect(container.innerHTML).toBe("");
  });
});
