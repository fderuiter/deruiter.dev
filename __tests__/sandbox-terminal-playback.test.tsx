/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Configure React 19 act environment
(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SandboxTerminal } from "@/components/SandboxTerminal";
import { safeStorage } from "@/lib/safe-storage";
import { writeHashParams } from "@/hooks/useStudioHashParams";

// Mock audio and announcer providers
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
    AudioProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

vi.mock("@/components/providers/A11yProvider", () => ({
  useAnnouncer: () => ({
    announce: vi.fn(),
  }),
  A11yProvider: ({ children }: { children: React.ReactNode }) => children,
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

describe("SandboxTerminal Playback & Step Player Controller Suite", () => {
  let container: HTMLDivElement;
  let root: Root;
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;
  let mockStorage: MockStorage;

  const mockCommands = {
    "test studies list": {
      description: "List mock studies",
      payload: { studies: ["MOCK-1", "MOCK-2"] },
    },
    "test subjects get": {
      description: "Get mock subject",
      payload: { id: "MOCK-SUB-1" },
    },
  };

  const mockPlayback = [
    { command: "test studies list", description: "Run studies query" },
    { command: "test subjects get", description: "Run subject query" },
  ];

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
    container = document.createElement("div");
    document.body.appendChild(container);

    scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock as any;
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

  it("should render the Incident Playback Controller and use passed-in commands", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <SandboxTerminal commands={mockCommands} playback={mockPlayback} />
      );
    });

    // Verify dynamic badges are rendered
    const badgeList = Array.from(container.querySelectorAll("button")).map(
      (el) => el.textContent?.trim()
    );
    expect(badgeList).toContain("test studies list");
    expect(badgeList).toContain("test subjects get");
    expect(badgeList).not.toContain("imednet studies list"); // Should not show default ones

    // Verify playback controller panel is shown
    const panelTitle = container.textContent;
    expect(panelTitle).toContain("Incident Playback Controller");
    expect(panelTitle).toContain(
      "Ready to start step-by-step diagnostic sequence."
    );
  });

  it("should handle Step Forward correctly (typing and execution simulation)", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <SandboxTerminal commands={mockCommands} playback={mockPlayback} />
      );
    });

    const stepForwardBtn = container.querySelector(
      'button[title="Step Forward"]'
    ) as HTMLButtonElement;
    expect(stepForwardBtn).toBeDefined();

    // Trigger step forward
    await act(async () => {
      stepForwardBtn.click();
    });

    // Fast-forward typing timer and execution (typing: 17 * 40 = 680ms, execution: 150 + 450 = 600ms. Total 1280ms)
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Check logs to see if "test studies list" executed
    const logEl = container.querySelector('[role="log"]');
    expect(logEl).not.toBeNull();
    const consoleText = logEl!.textContent;
    expect(consoleText).toContain("test studies list");
    expect(consoleText).toContain("MOCK-1");
  });

  it("should handle Play and Pause cycle smoothly", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <SandboxTerminal commands={mockCommands} playback={mockPlayback} />
      );
    });

    const playBtn = container.querySelector(
      'button[title="Play Sequence"]'
    ) as HTMLButtonElement;
    expect(playBtn).toBeDefined();

    // Start auto-playback
    await act(async () => {
      playBtn.click();
    });

    // Advance for Step 1 typing and execution (needs at least 1280ms)
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    const logEl = container.querySelector('[role="log"]');
    expect(logEl).not.toBeNull();
    expect(logEl!.textContent).toContain("test studies list");

    // Pause playback (playback delay between steps is 1500ms)
    const pauseBtn = container.querySelector(
      'button[title="Pause Playback"]'
    ) as HTMLButtonElement;
    expect(pauseBtn).toBeDefined();

    await act(async () => {
      pauseBtn.click();
    });

    // Fast forward enough that step 2 would have typed if not paused
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Step 2 ("test subjects get") should NOT have executed or typed in logs
    expect(logEl!.textContent).not.toContain("test subjects get");
  });

  it("should handle Step Backward with rolling back logs cleanly", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <SandboxTerminal commands={mockCommands} playback={mockPlayback} />
      );
    });

    const stepForwardBtn = container.querySelector(
      'button[title="Step Forward"]'
    ) as HTMLButtonElement;
    const stepBackBtn = container.querySelector(
      'button[title="Step Back"]'
    ) as HTMLButtonElement;

    // Run step 1
    await act(async () => {
      stepForwardBtn.click();
    });
    await act(async () => {
      vi.advanceTimersByTime(2000); // Wait for typing + execution
    });

    // Run step 2
    await act(async () => {
      stepForwardBtn.click();
    });
    await act(async () => {
      vi.advanceTimersByTime(2000); // Wait for typing + execution
    });

    const logEl = container.querySelector('[role="log"]');
    expect(logEl).not.toBeNull();
    expect(logEl!.textContent).toContain("test studies list");
    expect(logEl!.textContent).toContain("test subjects get");

    // Step back once (should rollback to only step 1 in logs instantly)
    await act(async () => {
      stepBackBtn.click();
    });

    expect(logEl!.textContent).toContain("test studies list");
    expect(logEl!.textContent).not.toContain("test subjects get"); // rolled back!
  });

  it("should handle Reset to initial state completely", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <SandboxTerminal commands={mockCommands} playback={mockPlayback} />
      );
    });

    const stepForwardBtn = container.querySelector(
      'button[title="Step Forward"]'
    ) as HTMLButtonElement;
    const resetBtn = container.querySelector(
      'button[title="Reset"]'
    ) as HTMLButtonElement;

    // Run step 1
    await act(async () => {
      stepForwardBtn.click();
    });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    const logEl = container.querySelector('[role="log"]');
    expect(logEl).not.toBeNull();
    expect(logEl!.textContent).toContain("test studies list");

    // Reset
    await act(async () => {
      resetBtn.click();
    });

    // Logs are back to initial greeting, commands removed
    expect(logEl!.textContent).not.toContain("test studies list");
    expect(logEl!.textContent).toContain("iMednet Python SDK CLI Sandbox");
  });

  it("cancels a pending command response when unmounted mid-execution (#1136)", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <SandboxTerminal commands={mockCommands} playback={mockPlayback} />
      );
    });

    const stepForwardBtn = container.querySelector(
      'button[title="Step Forward"]'
    ) as HTMLButtonElement;
    await act(async () => {
      stepForwardBtn.click();
    });

    // Typing ends near 720ms and the 150ms hand-off follows, so at 900ms only
    // the 450ms simulated response lag is still pending.
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    act(() => {
      root.unmount();
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
