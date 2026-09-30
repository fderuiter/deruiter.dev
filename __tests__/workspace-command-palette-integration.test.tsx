/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CommandPalette } from "@/components/CommandPalette";
import { useWorkspaceAction } from "@/hooks/useWorkspaceAction";
import { workspaceCommandRegistry } from "@/lib/workspace-command-registry";
import { macroEngine, MACRO_STORAGE_KEY } from "@/lib/macro-engine";
import { safeStorage } from "@/lib/safe-storage";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/components/providers/AudioProvider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/providers/AudioProvider")
    >();
  return {
    ...actual,
    useAudio: () => ({
      playHover: vi.fn(),
      playSubmit: vi.fn(),
      playSuccess: vi.fn(),
      playNote: vi.fn(),
      volume: 0.3,
      muted: false,
    }),
  };
});

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

let mockIsOpen = false;
const mockCloseSearch = vi.fn();
const mockSetIsOpen = vi.fn((val: boolean) => {
  mockIsOpen = val;
});

vi.mock("@/components/providers/SearchProvider", () => ({
  useSearch: () => ({
    isOpen: mockIsOpen,
    setIsOpen: mockSetIsOpen,
    closeSearch: mockCloseSearch,
  }),
}));

const TestSubToolComponent: React.FC<{
  id: string;
  title: string;
  subToolId: string;
  subToolName: string;
  handler: () => void;
}> = ({ id, title, subToolId, subToolName, handler }) => {
  useWorkspaceAction({
    id,
    title,
    subToolId,
    subToolName,
    tags: ["test", "subtool"],
    shortcut: "Alt+T",
    handler,
  });

  return <div data-testid="sub-tool">SubTool Active</div>;
};

describe("Workspace Command Registry & Command Palette Integration", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOpen = true;
    workspaceCommandRegistry.clearActions();
    safeStorage.removeItem(MACRO_STORAGE_KEY);
    if (macroEngine.isRecording()) {
      macroEngine.stopRecording();
    }

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    safeStorage.removeItem(MACRO_STORAGE_KEY);
  });

  it("renders contextual commands emitted by mounted sub-tools in the command palette", async () => {
    const actionHandler = vi.fn();

    await act(async () => {
      root.render(
        <>
          <TestSubToolComponent
            id="crf-studio:validate-cdash"
            title="CRF Studio: Validate CDASH Rules"
            subToolId="crf-studio"
            subToolName="CRF Studio"
            handler={actionHandler}
          />
          <CommandPalette />
        </>
      );
    });

    const activeList = document.querySelector("#palette-results-list");
    expect(activeList).not.toBeNull();
    expect(activeList?.textContent).toContain(
      "CRF Studio: Validate CDASH Rules"
    );

    const option = document.querySelector(
      '[id*="palette-option-workspace-action-crf-studio:validate-cdash"]'
    );
    expect(option).not.toBeNull();

    await act(async () => {
      (option as HTMLElement).click();
    });

    expect(actionHandler).toHaveBeenCalledTimes(1);
  });

  it("removes contextual commands when sub-tools unmount", async () => {
    const actionHandler = vi.fn();

    await act(async () => {
      root.render(
        <TestSubToolComponent
          id="proof:verify-premises"
          title="Proof Canvas: Verify Premises"
          subToolId="proof-canvas"
          subToolName="Proof Canvas"
          handler={actionHandler}
        />
      );
    });

    expect(
      workspaceCommandRegistry.getAction("proof:verify-premises")
    ).toBeDefined();

    await act(async () => {
      root.render(<div data-testid="empty" />);
    });

    expect(
      workspaceCommandRegistry.getAction("proof:verify-premises")
    ).toBeUndefined();
  });

  it("filters contextual commands using fuzzy search query", async () => {
    await act(async () => {
      root.render(
        <>
          <TestSubToolComponent
            id="crf-studio:validate-cdash"
            title="CRF Studio: Validate CDASH Rules"
            subToolId="crf-studio"
            subToolName="CRF Studio"
            handler={vi.fn()}
          />
          <CommandPalette />
        </>
      );
    });

    const input = document.querySelector("input") as HTMLInputElement;
    expect(input).not.toBeNull();

    await act(async () => {
      input.value = "cdash";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const activeList = document.querySelector("#palette-results-list");
    expect(activeList?.textContent).toContain(
      "CRF Studio: Validate CDASH Rules"
    );
  });

  it("toggles macro recording and records executed actions", async () => {
    const actionHandler = vi.fn();

    await act(async () => {
      root.render(
        <>
          <TestSubToolComponent
            id="crf-studio:validate-cdash"
            title="CRF Studio: Validate CDASH Rules"
            subToolId="crf-studio"
            subToolName="CRF Studio"
            handler={actionHandler}
          />
          <CommandPalette />
        </>
      );
    });

    // Start macro recording
    macroEngine.startRecording("My Macro");
    expect(macroEngine.isRecording()).toBe(true);

    // Execute action
    await act(async () => {
      await workspaceCommandRegistry.executeAction("crf-studio:validate-cdash");
    });

    expect(actionHandler).toHaveBeenCalledTimes(1);
    expect(macroEngine.getRecordingState().recordedStepsCount).toBe(1);

    // Save macro
    const saved = macroEngine.saveMacro("Validate Macro");
    expect(saved).not.toBeNull();
    expect(macroEngine.getSavedMacros()).toHaveLength(1);
  });
});
