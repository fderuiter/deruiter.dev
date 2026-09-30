// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CommandPalette } from "@/components/CommandPalette";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/components/providers/AudioProvider", () => ({
  registerAudioCleanup: vi.fn(() => vi.fn()),
  useAudio: () => ({
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
    playNote: vi.fn(),
    volume: 0.3,
    muted: false,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

let mockIsOpen = false;
const mockCloseSearch = vi.fn();
const mockSetIsOpen = vi.fn();

vi.mock("@/components/providers/SearchProvider", () => ({
  useSearch: () => ({
    isOpen: mockIsOpen,
    setIsOpen: mockSetIsOpen,
    closeSearch: mockCloseSearch,
  }),
}));

function pressOn(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

describe("CommandPalette Mod+K toggle (useHotkeys, #1449)", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalPlatform = Object.getOwnPropertyDescriptor(
    window.navigator,
    "platform"
  );

  const setPlatform = (value: string) => {
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      get: () => value,
    });
  };

  const render = async () => {
    await act(async () => {
      root.render(<CommandPalette />);
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOpen = false;
    setPlatform("Win32");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
    if (originalPlatform) {
      Object.defineProperty(window.navigator, "platform", originalPlatform);
    } else {
      delete (window.navigator as { platform?: string }).platform;
    }
  });

  it.each([
    ["Win32", { ctrlKey: true }],
    ["Win32", { metaKey: true }],
    ["MacIntel", { metaKey: true }],
    ["MacIntel", { ctrlKey: true }],
  ])(
    "opens on %s with %o and prevents the default",
    async (platform, modifiers) => {
      setPlatform(platform);
      await render();
      const event = pressOn(window, { key: "k", ...modifiers });
      expect(mockSetIsOpen).toHaveBeenCalledWith(true);
      expect(event.defaultPrevented).toBe(true);
    }
  );

  it("accepts upper-case K and Shift, Alt or both modifiers together", async () => {
    await render();
    pressOn(window, { key: "K", ctrlKey: true, shiftKey: true });
    pressOn(window, { key: "k", ctrlKey: true, altKey: true });
    pressOn(window, { key: "k", metaKey: true, altKey: true });
    pressOn(window, { key: "k", ctrlKey: true, metaKey: true });
    expect(mockSetIsOpen).toHaveBeenCalledTimes(4);
  });

  it("ignores K without Cmd or Ctrl", async () => {
    await render();
    const plain = pressOn(window, { key: "k" });
    pressOn(window, { key: "k", altKey: true });
    pressOn(window, { key: "j", ctrlKey: true });
    expect(mockSetIsOpen).not.toHaveBeenCalled();
    expect(plain.defaultPrevented).toBe(false);
  });

  it("fires while typing in an input, textarea or contenteditable region", async () => {
    await render();
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    document.body.append(input, textarea, editable);

    pressOn(input, { key: "k", ctrlKey: true });
    pressOn(textarea, { key: "k", metaKey: true });
    pressOn(editable, { key: "k", ctrlKey: true });
    expect(mockSetIsOpen).toHaveBeenCalledTimes(3);
  });

  it("leaves Mod+K to a [data-keyboard-boundary] region", async () => {
    await render();
    const boundary = document.createElement("div");
    boundary.setAttribute("data-keyboard-boundary", "");
    const inner = document.createElement("button");
    boundary.appendChild(inner);
    document.body.appendChild(boundary);

    const event = pressOn(inner, { key: "k", ctrlKey: true });
    expect(mockSetIsOpen).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("closes an open palette from inside its own search input", async () => {
    mockIsOpen = true;
    await render();
    const combobox = document.querySelector(
      'input[role="combobox"]'
    ) as HTMLInputElement;
    expect(combobox).not.toBeNull();

    const event = pressOn(combobox, { key: "k", metaKey: true });
    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
    expect(event.defaultPrevented).toBe(true);
  });

  it("keeps Escape and arrow navigation on the search input", async () => {
    mockIsOpen = true;
    await render();
    const combobox = document.querySelector(
      'input[role="combobox"]'
    ) as HTMLInputElement;
    const options = document.querySelectorAll('div[role="option"]');
    expect(options.length).toBeGreaterThan(1);
    expect(options[0].getAttribute("aria-selected")).toBe("true");

    pressOn(combobox, { key: "ArrowDown" });
    expect(options[1].getAttribute("aria-selected")).toBe("true");
    pressOn(combobox, { key: "ArrowUp" });
    expect(options[0].getAttribute("aria-selected")).toBe("true");

    pressOn(combobox, { key: "Escape" });
    expect(mockCloseSearch).toHaveBeenCalled();
    expect(mockSetIsOpen).not.toHaveBeenCalled();
  });

  it("removes the listener on unmount", async () => {
    await render();
    act(() => {
      root.unmount();
    });
    pressOn(window, { key: "k", ctrlKey: true });
    expect(mockSetIsOpen).not.toHaveBeenCalled();
    root = createRoot(container);
  });
});
