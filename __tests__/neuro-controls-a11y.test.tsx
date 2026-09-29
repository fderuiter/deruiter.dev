// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { MultiPlanarSliceViewer } from "@/components/neuro/MultiPlanarSliceViewer";
import { FreeSurferTerminal } from "@/components/neuro/FreeSurferTerminal";
import { generateSyntheticVolume } from "@/lib/neuro/volume-generator";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playClick: vi.fn(),
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
    playAutocomplete: vi.fn(),
  }),
}));

describe("Neuro controls accessible names (#1336)", () => {
  afterEach(() => cleanup());

  it("names each slice slider for its plane with a value text", () => {
    render(
      <MultiPlanarSliceViewer
        volume={generateSyntheticVolume("dura_inclusion")}
        crosshair={{ x: 10, y: 20, z: 30 }}
        toolMode="control_point"
        brushRadius={2}
        showPialContour
        showWmContour
        controlPoints={[]}
        onCrosshairChange={vi.fn()}
        onAddControlPoint={vi.fn()}
        onApplyVoxelEdits={vi.fn()}
      />
    );
    const coronal = screen.getByRole("slider", { name: "Coronal slice" });
    const axial = screen.getByRole("slider", { name: "Axial slice" });
    const sagittal = screen.getByRole("slider", { name: "Sagittal slice" });
    expect(coronal.getAttribute("aria-valuetext")).toContain("20");
    expect(axial.getAttribute("aria-valuetext")).toContain("30");
    expect(sagittal.getAttribute("aria-valuetext")).toContain("10");
  });

  it("labels the terminal send button and makes the log keyboard-scrollable", () => {
    render(
      <FreeSurferTerminal
        logs={[]}
        onExecuteCommand={vi.fn()}
        onClearLogs={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Send command" })).toBeTruthy();
    const log = screen.getByRole("log", { name: "FreeSurfer terminal output" });
    expect(log.getAttribute("tabindex")).toBe("0");
    expect(log.getAttribute("data-testid")).toBe("terminal-log-container");
  });
});
