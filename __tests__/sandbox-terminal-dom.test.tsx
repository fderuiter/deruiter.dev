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

const setInputValue = (inputEl: HTMLInputElement, value: string) => {
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;
  valueSetter?.call(inputEl, value);
  inputEl.dispatchEvent(new Event("change", { bubbles: true }));
};

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

describe("SandboxTerminal JSDOM Emulator States", () => {
  let container: HTMLDivElement;
  let root: Root;
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;
  let mockStorage: MockStorage;

  beforeEach(() => {
    vi.useFakeTimers();
    mockStorage = new MockStorage();
    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    container = document.createElement("div");
    document.body.appendChild(container);

    // Mock scrollIntoView since JSDOM does not implement visual rendering methods
    scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock as any;
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    document.body.removeChild(container);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should render terminal, input, and execute command with network delay", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<SandboxTerminal />);
    });

    const inputEl = container.querySelector("input") as HTMLInputElement;
    expect(inputEl).toBeDefined();
    expect(inputEl.placeholder).toContain("Type 'help'");

    // Simulate typing 'help'
    await act(async () => {
      setInputValue(inputEl, "help");
    });

    expect(inputEl.value).toBe("help");

    // Simulate pressing Enter with full properties
    await act(async () => {
      inputEl.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        })
      );
    });

    // Check that it shows "Executing clinical API query..." loading state
    expect(container.textContent).toContain("Executing clinical API query...");

    // Advance fake timers by 450ms for simulated latency
    await act(async () => {
      vi.advanceTimersByTime(450);
    });

    // Loading indicator should be gone, and help logs should be displayed
    expect(container.textContent).not.toContain(
      "Executing clinical API query..."
    );
    expect(container.textContent).toContain(
      "Available Curated Clinical EDC SDK Commands"
    );
    const logViewport = container.querySelector('[role="log"]');
    expect(logViewport).toBeDefined();
  });

  it("should handle command history with ArrowUp and ArrowDown keys", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<SandboxTerminal />);
    });

    const inputEl = container.querySelector("input") as HTMLInputElement;

    // Type and execute "clear"
    await act(async () => {
      setInputValue(inputEl, "clear");
    });
    await act(async () => {
      inputEl.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        })
      );
    });
    await act(async () => {
      vi.advanceTimersByTime(450);
    });

    // Confirm input is empty after execution
    expect(inputEl.value).toBe("");

    // Press ArrowUp to retrieve history
    await act(async () => {
      inputEl.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowUp",
          code: "ArrowUp",
          keyCode: 38,
          which: 38,
          bubbles: true,
          cancelable: true,
        })
      );
    });

    // Input should be hydrated with the last command "clear"
    expect(inputEl.value).toBe("clear");

    // Press ArrowDown to clear/navigate out of history
    await act(async () => {
      inputEl.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          code: "ArrowDown",
          keyCode: 40,
          which: 40,
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(inputEl.value).toBe("");
  });

  it("should handle autocomplete on Tab keypress", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<SandboxTerminal />);
    });

    const inputEl = container.querySelector("input") as HTMLInputElement;

    // Type prefix "imednet st"
    await act(async () => {
      setInputValue(inputEl, "imednet st");
    });

    // Press Tab
    await act(async () => {
      const e = new KeyboardEvent("keydown", {
        key: "Tab",
        code: "Tab",
        keyCode: 9,
        which: 9,
        bubbles: true,
        cancelable: true,
      });
      inputEl.dispatchEvent(e);
    });

    // Input should autocomplete to "imednet studies list"
    expect(inputEl.value).toBe("imednet studies list");
  });

  it("should blur input on Escape keypress", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<SandboxTerminal />);
    });

    const inputEl = container.querySelector("input") as HTMLInputElement;
    inputEl.focus();
    expect(document.activeElement).toBe(inputEl);

    await act(async () => {
      inputEl.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          keyCode: 27,
          which: 27,
          bubbles: true,
          cancelable: true,
        })
      );
    });

    expect(document.activeElement).not.toBe(inputEl);
  });

  it("should execute loon easter egg and render Laser Loon ASCII", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<SandboxTerminal />);
    });

    const inputEl = container.querySelector("input") as HTMLInputElement;

    await act(async () => {
      setInputValue(inputEl, "loon");
    });

    await act(async () => {
      inputEl.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        })
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(450);
    });

    expect(container.textContent).toContain("L A K E   M I N N E T O N K A");
    expect(container.textContent).toContain("P E W !");
  });

  it("should display updated suggestions on unknown command", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<SandboxTerminal />);
    });

    const inputEl = container.querySelector("input") as HTMLInputElement;

    await act(async () => {
      setInputValue(inputEl, "unknown-cmd-xyz");
    });

    await act(async () => {
      inputEl.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        })
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(450);
    });

    expect(container.textContent).toContain("try 'loon', 'cowsay', or 'duck'");
  });

  it("should copy JSON payload to clipboard when CopyButton is clicked", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<SandboxTerminal />);
    });

    const inputEl = container.querySelector("input") as HTMLInputElement;

    await act(async () => {
      setInputValue(inputEl, "imednet studies list");
    });

    await act(async () => {
      inputEl.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        })
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(450);
    });

    const copyBtn = container.querySelector(
      'button[aria-label="Copy JSON payload"]'
    ) as HTMLButtonElement;
    expect(copyBtn).not.toBeNull();

    await act(async () => {
      copyBtn.click();
    });

    expect(writeTextMock).toHaveBeenCalled();
    const copiedText = writeTextMock.mock.calls[0][0];
    expect(copiedText).toContain("BRIGHT-01");
    expect(JSON.parse(copiedText)).toEqual([
      {
        studyID: "BRIGHT-01",
        name: "Phase III Pediatric Leukemia Study",
        status: "ACTIVE",
        subjectsCount: 142,
        version: "v4.2.1",
      },
      {
        studyID: "ONCO-2026",
        name: "Advanced Melanoma Immunotherapy Trial",
        status: "ENROLLING",
        subjectsCount: 89,
        version: "v1.0.8",
      },
      {
        studyID: "CARDIO-REF",
        name: "Congestive Heart Failure Observational Registry",
        status: "COMPLETED",
        subjectsCount: 310,
        version: "v2.5.0",
      },
    ]);
  });
});
