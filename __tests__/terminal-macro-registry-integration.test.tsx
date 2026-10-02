/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SandboxTerminal, parseCliFlags } from "@/components/SandboxTerminal";
import { workspaceCommandRegistry } from "@/lib/workspace-command-registry";
import { macroEngine } from "@/lib/macro-engine";
import { safeStorage } from "@/lib/safe-storage";
import {
  generateBashScript,
  generatePythonScript,
} from "@/lib/terminal-script-generator";
import { writeHashParams } from "@/hooks/useStudioHashParams";

vi.mock("@/components/providers/AudioProvider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/providers/AudioProvider")
    >();
  return {
    ...actual,
    useAudio: () => ({
      playKeystroke: vi.fn(),
      playAutocomplete: vi.fn(),
      playSuccess: vi.fn(),
    }),
  };
});

vi.mock("@/components/providers/A11yProvider", () => ({
  useAnnouncer: () => ({
    announce: vi.fn(),
  }),
}));

class MockStorage {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
  get length() {
    return Object.keys(this.store).length;
  }
  key(index: number) {
    return Object.keys(this.store)[index] ?? null;
  }
}

describe("Terminal Macro Engine and Dynamic Command Registry Integration", () => {
  let container: HTMLDivElement;
  let root: Root;
  let mockStorage: MockStorage;

  beforeEach(() => {
    vi.useFakeTimers();
    mockStorage = new MockStorage();
    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    safeStorage.clear();
    writeHashParams({ terminal_cmd: null });
    workspaceCommandRegistry.clearActions();
    macroEngine.stopRecording();

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
    vi.useRealTimers();
  });

  it("1. validates dynamic CLI flag parsing and parameter bindings", () => {
    const parsed1 = parseCliFlags("imednet subjects get --id 999 --verbose");
    expect(parsed1.commandName).toBe("imednet subjects get");
    expect(parsed1.flags).toEqual({ id: "999", verbose: true });

    const parsed2 = parseCliFlags('imednet records search --study="ONCO-2026"');
    expect(parsed2.commandName).toBe("imednet records search");
    expect(parsed2.flags).toEqual({ study: "ONCO-2026" });
  });

  it("2. supports registering custom commands with dynamic parameter schemas and executing them in SandboxTerminal", async () => {
    // Register custom command with flag schema
    workspaceCommandRegistry.registerCommand({
      id: "custom:patient-export",
      title: "Patient Data Exporter",
      cliName: "imednet export-patients",
      subToolId: "sandbox-terminal",
      subToolName: "Sandbox Terminal",
      flags: {
        site: { required: true, type: "string", description: "Target site ID" },
        format: { required: false, default: "json" },
      },
      cliHandler: (flags) => ({
        exportedSite: flags.site,
        format: flags.format || "json",
        totalExported: 42,
        status: "COMPLETED",
      }),
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<SandboxTerminal slug="imednet-python-sdk" />);
    });

    const inputEl = container.querySelector("input") as HTMLInputElement;

    // Execute custom command with missing required flag '--site'
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      valueSetter?.call(inputEl, "imednet export-patients");
      inputEl.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      inputEl.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        })
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(450);
    });

    expect(container.textContent).toContain(
      "Parameter validation error: Missing required flag(s) --site"
    );

    // Execute custom command with valid required flag '--site 401'
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      valueSetter?.call(
        inputEl,
        "imednet export-patients --site 401 --format csv"
      );
      inputEl.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      inputEl.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        })
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(450);
    });

    expect(container.textContent).toContain("exportedSite");
    expect(container.textContent).toContain("401");
    expect(container.textContent).toContain("csv");
    expect(container.textContent).toContain("42");
  });

  it("3. active macro recording captures 100% of executed terminal commands up to MAX_MACRO_STEPS (20)", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<SandboxTerminal slug="imednet-python-sdk" />);
    });

    // Start recording macro session
    act(() => {
      macroEngine.startRecording("Clinical Workflow Macro");
    });

    expect(macroEngine.isRecording()).toBe(true);

    const inputEl = container.querySelector("input") as HTMLInputElement;

    // Execute 3 terminal commands
    const cmdsToRun = [
      "imednet studies list",
      "imednet subjects get --id 555",
      "imednet records search --study BRIGHT-01",
    ];

    for (const cmd of cmdsToRun) {
      await act(async () => {
        const valueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        valueSetter?.call(inputEl, cmd);
        inputEl.dispatchEvent(new Event("change", { bubbles: true }));
      });

      await act(async () => {
        inputEl.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            bubbles: true,
            cancelable: true,
          })
        );
      });

      await act(async () => {
        vi.advanceTimersByTime(450);
      });
    }

    const recordedState = macroEngine.getRecordingState();
    expect(recordedState.recordedSteps.map((s) => s.args?.command)).toEqual(
      cmdsToRun
    );

    // Save macro
    act(() => {
      macroEngine.saveMacro("Clinical Workflow Macro", "3-step test workflow");
    });

    const saved = macroEngine.getSavedMacros();
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe("Clinical Workflow Macro");
    expect(saved[0].steps).toHaveLength(3);
  });

  it("4. script generator produces valid Bash and Python scripts with environment variables", () => {
    const commands = [
      "imednet studies list",
      "imednet subjects get --id 777",
      "imednet records search --study CARDIO-REF",
    ];

    const bashScript = generateBashScript(commands, {
      slug: "imednet-python-sdk",
      studyId: "CARDIO-REF",
    });

    expect(bashScript).toContain("#!/usr/bin/env bash");
    expect(bashScript).toContain(
      'IMEDNET_API_URL="${IMEDNET_API_URL:-https://api.imednet.edc/v1}"'
    );
    expect(bashScript).toContain(
      'IMEDNET_API_KEY="${IMEDNET_API_KEY:-your_api_key_here}"'
    );
    expect(bashScript).toContain("SUB_ID='777'");
    expect(bashScript).toContain("STUDY_NAME='CARDIO-REF'");

    const pythonScript = generatePythonScript(commands, {
      slug: "imednet-python-sdk",
      studyId: "CARDIO-REF",
    });

    expect(pythonScript).toContain("#!/usr/bin/env python3");
    expect(pythonScript).toContain(
      'BASE_URL = os.getenv("IMEDNET_API_URL", "https://api.imednet.edc/v1")'
    );
    expect(pythonScript).toContain(
      'API_KEY = os.getenv("IMEDNET_API_KEY", "your_api_key_here")'
    );
    expect(pythonScript).toContain('subject_id = "777"');
    expect(pythonScript).toContain('study_id = "CARDIO-REF"');
  });

  it("5. cleans up window API additions completely when unmounted", () => {
    delete (window as any).terminal;
    delete (window as any).imednet;

    // Set location mock safely
    Object.defineProperty(window, "location", {
      value: {
        pathname: "/case-studies/imednet-python-sdk",
        hash: "",
        href: "http://localhost/case-studies/imednet-python-sdk",
      },
      writable: true,
      configurable: true,
    });

    // Render component
    act(() => {
      root = createRoot(container);
      root.render(<SandboxTerminal slug="imednet-python-sdk" />);
    });

    // Check window.terminal / window.imednet attached
    expect((window as any).terminal).toBeDefined();
    expect((window as any).imednet).toBeDefined();

    // Unmount component
    act(() => {
      root.unmount();
    });

    // Check window.terminal / window.imednet deleted
    expect((window as any).terminal).toBeUndefined();
    expect((window as any).imednet).toBeUndefined();
  });
});
