// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FreeSurferTerminal } from "@/components/neuro/FreeSurferTerminal";
import { NeuroMetricsPanel } from "@/components/neuro/NeuroMetricsPanel";
import {
  ScenarioConfig,
  QAMetrics,
  ScoreState,
  TerminalLog,
} from "@/lib/neuro/types";

describe("NeuroRecon Subcomponents Suite", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("FreeSurferTerminal Component", () => {
    const sampleLogs: TerminalLog[] = [
      {
        id: "log-1",
        timestamp: "10:00:00",
        type: "command",
        text: "recon-all -s sub-01 -all",
      },
      {
        id: "log-2",
        timestamp: "10:00:01",
        type: "info",
        text: "INFO: Initializing FreeSurfer pipeline...",
      },
      {
        id: "log-3",
        timestamp: "10:00:02",
        type: "output",
        text: "Parsing intensity normalization volumes...",
      },
      {
        id: "log-4",
        timestamp: "10:00:03",
        type: "error",
        text: "ERROR: Topological defect detected in left hemisphere.",
      },
      {
        id: "log-5",
        timestamp: "10:00:04",
        type: "success",
        text: "SUCCESS: Defect voxels successfully patched.",
      },
    ];

    it("renders terminal header, prompt, and stream log formatting across all log types", () => {
      render(
        <FreeSurferTerminal
          logs={sampleLogs}
          onExecuteCommand={vi.fn()}
          onClearLogs={vi.fn()}
        />
      );

      // Header assertions
      expect(screen.getByText("FreeSurfer 7.4.1 CLI Terminal")).not.toBeNull();
      expect(
        screen.getByText("[SUBJECT: sub-01 · ENVIRONMENT: Linux x86_64]")
      ).not.toBeNull();

      // Timestamps
      expect(screen.getByText("[10:00:00]")).not.toBeNull();
      expect(screen.getByText("[10:00:01]")).not.toBeNull();

      // Command log type with prompt prefix
      const cmdLog = screen.getByText("recon-all -s sub-01 -all");
      expect(cmdLog).not.toBeNull();
      expect(cmdLog.parentElement?.textContent).toContain(
        "freesurfer@node-01:~$"
      );

      // Info log type
      const infoLog = screen.getByText(
        "INFO: Initializing FreeSurfer pipeline..."
      );
      expect(infoLog.className).toContain("text-amber-300");

      // Standard output log type
      const outputLog = screen.getByText(
        "Parsing intensity normalization volumes..."
      );
      expect(outputLog.className).toContain("text-zinc-300");

      // Error log type
      const errorLog = screen.getByText(
        "ERROR: Topological defect detected in left hemisphere."
      );
      expect(errorLog.className).toContain("text-rose-400");

      // Success log type
      const successLog = screen.getByText(
        "SUCCESS: Defect voxels successfully patched."
      );
      expect(successLog.className).toContain("text-emerald-400");
    });

    it("triggers onExecuteCommand when clicking quick command buttons", () => {
      const handleExecute = vi.fn();
      render(
        <FreeSurferTerminal
          logs={[]}
          onExecuteCommand={handleExecute}
          onClearLogs={vi.fn()}
        />
      );

      const quickCmds = [
        "recon-all -autorecon2-cp",
        "freeview -f lh.pial:edgecolor=red",
        "stats",
        "euler",
        "help",
      ];

      quickCmds.forEach((cmd) => {
        const button = screen.getByRole("button", { name: cmd });
        fireEvent.click(button);
        expect(handleExecute).toHaveBeenCalledWith(cmd);
      });

      expect(handleExecute).toHaveBeenCalledTimes(quickCmds.length);
    });

    it("triggers onClearLogs when clicking the clear terminal button", () => {
      const handleClear = vi.fn();
      render(
        <FreeSurferTerminal
          logs={sampleLogs}
          onExecuteCommand={vi.fn()}
          onClearLogs={handleClear}
        />
      );

      const clearBtn = screen.getByTitle("Clear terminal buffer");
      fireEvent.click(clearBtn);

      expect(handleClear).toHaveBeenCalledTimes(1);
    });

    it("handles form submission with typed commands and guards against empty input", () => {
      const handleExecute = vi.fn();
      render(
        <FreeSurferTerminal
          logs={[]}
          onExecuteCommand={handleExecute}
          onClearLogs={vi.fn()}
        />
      );

      const input = screen.getByPlaceholderText(
        /Enter FreeSurfer command/i
      ) as HTMLInputElement;

      // Submit empty input -> should not trigger callback
      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.submit(input.closest("form")!);
      expect(handleExecute).not.toHaveBeenCalled();

      // Submit valid command
      fireEvent.change(input, {
        target: { value: " mri_convert orig.mgz orig.nii.gz " },
      });
      expect(input.value).toBe(" mri_convert orig.mgz orig.nii.gz ");

      fireEvent.submit(input.closest("form")!);
      expect(handleExecute).toHaveBeenCalledWith(
        "mri_convert orig.mgz orig.nii.gz"
      );
      expect(input.value).toBe(""); // cleared after submission
    });

    it("navigates CLI command history using ArrowUp and ArrowDown keys", () => {
      const handleExecute = vi.fn();
      render(
        <FreeSurferTerminal
          logs={[]}
          onExecuteCommand={handleExecute}
          onClearLogs={vi.fn()}
        />
      );

      const input = screen.getByPlaceholderText(
        /Enter FreeSurfer command/i
      ) as HTMLInputElement;

      // Execute two commands to populate internal history
      fireEvent.change(input, { target: { value: "command-1" } });
      fireEvent.submit(input.closest("form")!);

      fireEvent.change(input, { target: { value: "command-2" } });
      fireEvent.submit(input.closest("form")!);

      // Press ArrowUp: recall command-2 (latest)
      fireEvent.keyDown(input, { key: "ArrowUp" });
      expect(input.value).toBe("command-2");

      // Press ArrowUp again: recall command-1 (older)
      fireEvent.keyDown(input, { key: "ArrowUp" });
      expect(input.value).toBe("command-1");

      // Press ArrowUp again: stays at earliest history item (command-1)
      fireEvent.keyDown(input, { key: "ArrowUp" });
      expect(input.value).toBe("command-1");

      // Press ArrowDown: move forward to command-2
      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(input.value).toBe("command-2");

      // Press ArrowDown again: resets history index and clears input
      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(input.value).toBe("");
    });

    it("auto-scrolls the log container when logs update", () => {
      const { rerender } = render(
        <FreeSurferTerminal
          logs={[]}
          onExecuteCommand={vi.fn()}
          onClearLogs={vi.fn()}
        />
      );

      const logBox = screen.getByTestId(
        "terminal-log-container"
      ) as HTMLDivElement;
      expect(logBox).not.toBeNull();

      Object.defineProperty(logBox, "scrollHeight", {
        value: 500,
        configurable: true,
      });
      logBox.scrollTop = 0;

      rerender(
        <FreeSurferTerminal
          logs={sampleLogs}
          onExecuteCommand={vi.fn()}
          onClearLogs={vi.fn()}
        />
      );

      expect(logBox.scrollTop).toBe(500);
    });
  });

  describe("NeuroMetricsPanel Component", () => {
    const mockScenario: ScenarioConfig = {
      id: "dura_inclusion",
      title: "Case 01: Dura Over-Inclusion in Temporal Lobe",
      subtitle: "Non-brain tissue misclassified as cortical GM",
      badge: "Dura Inclusion",
      difficulty: "Beginner",
      targetPlane: "coronal",
      targetCoords: { x: 48, y: 32, z: 45 },
      defectDescription: "Dura artifact attached to pial surface",
      lore: {
        biologicalCause: "High T1 dura intensity near transverse sinus",
        algorithmicImpact: "Artificially inflates cortical volume",
        remediationProtocol: "Erode dura voxels using skull strip brush",
        freeSurferCommand: "recon-all -autorecon2-cp",
      },
      initialEuler: -4,
      targetEuler: 2,
      initialDefects: 12,
      targetDice: 0.95,
      recommendedTool: "erase",
      successMessage: "Dura inclusion completely eliminated!",
    };

    const unresolvedMetrics: QAMetrics = {
      eulerCharacteristic: -2,
      defectCount: 6,
      diceScore: 0.885,
      meanCorticalThicknessMm: 2.456,
      controlPointCount: 0,
      voxelEditsCount: 6,
      isResolved: false,
      accuracyScore: 82,
    };

    const resolvedMetrics: QAMetrics = {
      eulerCharacteristic: 2,
      defectCount: 0,
      diceScore: 0.968,
      meanCorticalThicknessMm: 2.381,
      controlPointCount: 0,
      voxelEditsCount: 12,
      isResolved: true,
      accuracyScore: 98,
    };

    const mockScoreState: ScoreState = {
      score: 1250,
      multiplier: 2,
      streak: 3,
      resolvedScenarios: ["dura_inclusion"],
    };

    it("renders metric calculations correctly for active/unresolved state", () => {
      render(
        <NeuroMetricsPanel
          scenario={mockScenario}
          metrics={unresolvedMetrics}
          scoreState={mockScoreState}
        />
      );

      // 1. Euler Characteristic χ
      expect(screen.getByText("EULER ESTIMATE (χ)")).not.toBeNull();
      expect(screen.getByText("TARGET: 2")).not.toBeNull();
      expect(screen.getByText("χ = -2")).not.toBeNull();
      expect(
        screen.getByText("Scenario-based topology estimate")
      ).not.toBeNull();

      // 2. Defect Count
      expect(screen.getByText("DEFECT UNITS (EST.)")).not.toBeNull();
      expect(screen.getByText("INITIAL: 12")).not.toBeNull();
      expect(screen.getByText("6")).not.toBeNull();
      expect(screen.getByText("remaining")).not.toBeNull();
      const activeProgressBar = screen.getByTestId("defect-progress-bar");
      expect(activeProgressBar.style.transform).toBe("scaleX(0.5)");

      // 3. Dice Score
      expect(screen.getByText("DICE ESTIMATE")).not.toBeNull();
      expect(screen.getByText("GOAL: ≥95%")).not.toBeNull();
      expect(screen.getByText("88.5%")).not.toBeNull();
      expect(
        screen.getByText("Simulated trend; no reference mask")
      ).not.toBeNull();

      // 4. Cortical Thickness
      expect(screen.getByText("THICKNESS ESTIMATE")).not.toBeNull();
      expect(screen.getByText("2.46")).not.toBeNull();
      expect(screen.getByText("mm")).not.toBeNull();

      // 5. Score & Streak
      expect(screen.getByText("QA SCORE")).not.toBeNull();
      expect(screen.getByText("2x")).not.toBeNull();
      expect(screen.getByText("1,250")).not.toBeNull();
      expect(screen.getByText("Streak: 3 clean cases")).not.toBeNull();

      // 6. Status
      expect(screen.getByText("STATUS")).not.toBeNull();
      expect(screen.getByText("INSPECTION ACTIVE")).not.toBeNull();
      expect(screen.getByText("Apply manual edits & re-run")).not.toBeNull();
    });

    it("renders metric calculations and badge state correctly for resolved state", () => {
      render(
        <NeuroMetricsPanel
          scenario={mockScenario}
          metrics={resolvedMetrics}
          scoreState={mockScoreState}
        />
      );

      // Euler Characteristic matches target
      expect(screen.getByText("χ = 2")).not.toBeNull();
      expect(
        screen.getByText("Scenario-based topology estimate")
      ).not.toBeNull();

      // 0 defects remaining
      expect(screen.getByText("0")).not.toBeNull();

      // Dice score exceeds target
      expect(screen.getByText("96.8%")).not.toBeNull();

      // Cortical thickness
      expect(screen.getByText("2.38")).not.toBeNull();

      // Resolution status
      expect(screen.getByText("SIMULATION PASS")).not.toBeNull();
      expect(screen.getByText("Scenario target reached")).not.toBeNull();
    });

    it("handles scenario with 0 initial defects cleanly for progress bar calculations", () => {
      const zeroDefectScenario: ScenarioConfig = {
        ...mockScenario,
        initialDefects: 0,
      };

      render(
        <NeuroMetricsPanel
          scenario={zeroDefectScenario}
          metrics={{ ...resolvedMetrics, defectCount: 0 }}
          scoreState={mockScoreState}
        />
      );

      expect(screen.getByText("INITIAL: 0")).not.toBeNull();
      expect(screen.getByText("0")).not.toBeNull();

      // Assert computed progress output scale for 0 initial defects case (100% full progress, scaleX(1))
      const zeroDefectProgressBar = screen.getByTestId("defect-progress-bar");
      expect(zeroDefectProgressBar.style.transform).toBe("scaleX(1)");
    });

    it("updates metric displays when props change dynamically", () => {
      const { rerender } = render(
        <NeuroMetricsPanel
          scenario={mockScenario}
          metrics={unresolvedMetrics}
          scoreState={mockScoreState}
        />
      );

      expect(screen.getByText("INSPECTION ACTIVE")).not.toBeNull();

      rerender(
        <NeuroMetricsPanel
          scenario={mockScenario}
          metrics={resolvedMetrics}
          scoreState={{
            ...mockScoreState,
            score: 2500,
            multiplier: 3,
            streak: 4,
          }}
        />
      );

      expect(screen.getByText("SIMULATION PASS")).not.toBeNull();
      expect(screen.getByText("3x")).not.toBeNull();
      expect(screen.getByText("2,500")).not.toBeNull();
      expect(screen.getByText("Streak: 4 clean cases")).not.toBeNull();
    });
  });
});
