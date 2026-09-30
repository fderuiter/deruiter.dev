import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  macroEngine,
  MACRO_STORAGE_KEY,
  MAX_MACRO_STEPS,
} from "@/lib/macro-engine";
import { workspaceCommandRegistry } from "@/lib/workspace-command-registry";
import { safeStorage } from "@/lib/safe-storage";
import { logger } from "@/lib/logger";

describe("MacroEngine", () => {
  beforeEach(() => {
    safeStorage.removeItem(MACRO_STORAGE_KEY);
    workspaceCommandRegistry.clearActions();
    if (macroEngine.isRecording()) {
      macroEngine.stopRecording();
    }
    vi.restoreAllMocks();
  });

  afterEach(() => {
    safeStorage.removeItem(MACRO_STORAGE_KEY);
  });

  it("records steps and saves macro sequence to portfolio_macros_v1", () => {
    macroEngine.startRecording("Test Workflow");
    expect(macroEngine.isRecording()).toBe(true);

    macroEngine.recordStep({ actionId: "action-1", timestamp: Date.now() });
    macroEngine.recordStep({ actionId: "action-2", timestamp: Date.now() });

    expect(macroEngine.getRecordingState().recordedStepsCount).toBe(2);

    const saved = macroEngine.saveMacro(
      "Test Workflow",
      "A test macro sequence"
    );
    expect(saved).not.toBeNull();
    expect(saved?.name).toBe("Test Workflow");
    expect(saved?.steps).toHaveLength(2);

    expect(macroEngine.isRecording()).toBe(false);

    const stored = macroEngine.getSavedMacros();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(saved?.id);
  });

  it("enforces safety interlock threshold (maximum 20 steps per macro)", () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => ({
      level: "warn",
      message: "",
      timestamp: "",
    }));
    macroEngine.startRecording("Overflow Macro");

    for (let i = 0; i < 25; i++) {
      macroEngine.recordStep({
        actionId: `action-${i}`,
        timestamp: Date.now(),
      });
    }

    expect(macroEngine.getRecordingState().recordedStepsCount).toBe(
      MAX_MACRO_STEPS
    );
    expect(warnSpy).toHaveBeenCalled();

    const saved = macroEngine.saveMacro("Overflow Macro");
    expect(saved?.steps.length).toBeLessThanOrEqual(MAX_MACRO_STEPS);
  });

  it("validates schema integrity and handles corrupted storage entries safely", () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => ({
      level: "warn",
      message: "",
      timestamp: "",
    }));

    // Write corrupted non-schema state into storage
    safeStorage.setItem(MACRO_STORAGE_KEY, [
      { invalidField: 123 },
      {
        id: "valid_1",
        name: "Valid Macro",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        steps: [{ actionId: "a1", timestamp: Date.now() }],
      },
    ]);

    const macros = macroEngine.getSavedMacros();
    expect(warnSpy).toHaveBeenCalled();
    expect(macros).toHaveLength(1);
    expect(macros[0].name).toBe("Valid Macro");
  });

  it("executes macro sequence asynchronously step by step", async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    workspaceCommandRegistry.registerAction({
      id: "step-1",
      title: "Step 1",
      subToolId: "tool",
      subToolName: "Tool",
      handler: handler1,
    });

    workspaceCommandRegistry.registerAction({
      id: "step-2",
      title: "Step 2",
      subToolId: "tool",
      subToolName: "Tool",
      handler: handler2,
    });

    const saved = macroEngine.saveMacro("Exec Test", "Test", [
      { actionId: "step-1", timestamp: Date.now() },
      { actionId: "step-2", timestamp: Date.now() },
    ]);

    expect(saved).not.toBeNull();

    const success = await macroEngine.executeMacro(saved!.id);
    expect(success).toBe(true);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it("prevents concurrent re-entrant macro execution", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => ({
      level: "warn",
      message: "",
      timestamp: "",
    }));

    workspaceCommandRegistry.registerAction({
      id: "slow-step",
      title: "Slow Step",
      subToolId: "tool",
      subToolName: "Tool",
      handler: () => new Promise((resolve) => setTimeout(resolve, 100)),
    });

    const saved = macroEngine.saveMacro("Re-entrant Test", "Test", [
      { actionId: "slow-step", timestamp: Date.now() },
    ]);

    const exec1 = macroEngine.executeMacro(saved!.id);
    const exec2 = await macroEngine.executeMacro(saved!.id);

    expect(exec2).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "MacroEngine: A macro execution is already in progress"
      )
    );

    await exec1;
  });
});
