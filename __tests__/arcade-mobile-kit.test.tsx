// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  renderHook,
} from "@testing-library/react";
import {
  controlHint,
  resolveControlHint,
  useControlHint,
  useTouchHint,
  RotateDevicePrompt,
  TouchButton,
  DockFrame,
  useCabinetAutoPause,
  lockScreenOrientation,
} from "../components/arcade/mobile";

const COARSE = "(pointer: coarse)";
const PORTRAIT = "(orientation: portrait)";

function installMatchMedia(matching: string[]) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: matching.includes(query),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe("arcade mobile kit", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    installMatchMedia([]);
  });

  afterEach(() => {
    cleanup();
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
    Reflect.deleteProperty(window.screen, "orientation");
  });

  describe("control hints", () => {
    it("defaults the desktop phrase to Press <key>", () => {
      const hint = controlHint({ key: "Space", touch: "Tap" });
      expect(hint.desktop).toBe("Press Space");
      expect(resolveControlHint(hint, false)).toBe("Press Space");
      expect(resolveControlHint(hint, true)).toBe("Tap");
    });

    it("keeps an explicit desktop phrase", () => {
      const hint = controlHint({
        key: "F",
        touch: "Tap fire",
        desktop: "Hold F to fire",
      });
      expect(resolveControlHint(hint, false)).toBe("Hold F to fire");
    });

    it("returns a frozen hint", () => {
      expect(Object.isFrozen(controlHint({ key: "E", touch: "Tap" }))).toBe(
        true
      );
    });

    it("reads touch from a coarse pointer in the hook", () => {
      installMatchMedia([COARSE]);
      const { result: touch } = renderHook(() => useTouchHint());
      expect(touch.current).toBe(true);
      const { result } = renderHook(() =>
        useControlHint(controlHint({ key: "Space", touch: "Tap" }))
      );
      expect(result.current).toBe("Tap");
    });

    it("reads the desktop phrase from a fine pointer in the hook", () => {
      installMatchMedia([]);
      const { result } = renderHook(() =>
        useControlHint(controlHint({ key: "Space", touch: "Tap" }))
      );
      expect(result.current).toBe("Press Space");
    });
  });

  describe("TouchButton", () => {
    it("is named and at least 44px square", () => {
      render(
        <TouchButton label="Fire">
          <span aria-hidden="true">F</span>
        </TouchButton>
      );
      const button = screen.getByRole("button", { name: "Fire" });
      expect(button.className).toContain("min-h-[44px]");
      expect(button.className).toContain("min-w-[44px]");
      expect(button.getAttribute("type")).toBe("button");
    });

    it("presses once per pointer-down and releases on pointer-up", () => {
      const onPress = vi.fn();
      const onRelease = vi.fn();
      render(
        <TouchButton label="Fire" onPress={onPress} onRelease={onRelease} />
      );
      const button = screen.getByRole("button", { name: "Fire" });
      fireEvent.pointerDown(button, { pointerId: 1, pointerType: "touch" });
      fireEvent.pointerDown(button, { pointerId: 2, pointerType: "touch" });
      expect(onPress).toHaveBeenCalledTimes(1);
      fireEvent.pointerUp(button, { pointerId: 1, pointerType: "touch" });
      expect(onRelease).toHaveBeenCalledTimes(1);
      fireEvent.pointerUp(button, { pointerId: 2, pointerType: "touch" });
      expect(onRelease).toHaveBeenCalledTimes(1);
    });

    it("releases on pointer cancel and on lost capture", () => {
      const onRelease = vi.fn();
      render(
        <TouchButton label="Fire" onPress={vi.fn()} onRelease={onRelease} />
      );
      const button = screen.getByRole("button", { name: "Fire" });
      fireEvent.pointerDown(button, { pointerId: 1, pointerType: "touch" });
      fireEvent.pointerCancel(button, { pointerId: 1, pointerType: "touch" });
      expect(onRelease).toHaveBeenCalledTimes(1);
      fireEvent.pointerDown(button, { pointerId: 1, pointerType: "touch" });
      fireEvent.lostPointerCapture(button);
      expect(onRelease).toHaveBeenCalledTimes(2);
    });

    it("captures the pointer on press when the engine supports it", () => {
      const setPointerCapture = vi.fn();
      HTMLElement.prototype.setPointerCapture = setPointerCapture;
      try {
        render(<TouchButton label="Fire" onPress={vi.fn()} />);
        fireEvent.pointerDown(screen.getByRole("button", { name: "Fire" }), {
          pointerId: 7,
          pointerType: "touch",
        });
        expect(setPointerCapture).toHaveBeenCalledWith(7);
      } finally {
        Reflect.deleteProperty(HTMLElement.prototype, "setPointerCapture");
      }
    });

    it("still presses when pointer capture is unavailable", () => {
      const onPress = vi.fn();
      render(<TouchButton label="Fire" onPress={onPress} />);
      fireEvent.pointerDown(screen.getByRole("button", { name: "Fire" }), {
        pointerId: 3,
        pointerType: "touch",
      });
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("answers Enter and Space from a keyboard", () => {
      const onPress = vi.fn();
      const onRelease = vi.fn();
      render(
        <TouchButton label="Fire" onPress={onPress} onRelease={onRelease} />
      );
      const button = screen.getByRole("button", { name: "Fire" });
      fireEvent.keyDown(button, { key: "Enter" });
      fireEvent.keyDown(button, { key: "Enter", repeat: true });
      fireEvent.keyUp(button, { key: "Enter" });
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onRelease).toHaveBeenCalledTimes(1);
      fireEvent.keyDown(button, { key: " " });
      fireEvent.keyUp(button, { key: " " });
      expect(onPress).toHaveBeenCalledTimes(2);
      expect(onRelease).toHaveBeenCalledTimes(2);
    });

    it("vibrates on press unless haptics are off", () => {
      const vibrate = vi.fn();
      Object.defineProperty(navigator, "vibrate", {
        configurable: true,
        value: vibrate,
      });
      try {
        render(
          <>
            <TouchButton label="Buzz" onPress={vi.fn()} />
            <TouchButton label="Quiet" haptic={false} onPress={vi.fn()} />
          </>
        );
        fireEvent.pointerDown(screen.getByRole("button", { name: "Quiet" }), {
          pointerId: 1,
          pointerType: "touch",
        });
        expect(vibrate).not.toHaveBeenCalled();
        fireEvent.pointerDown(screen.getByRole("button", { name: "Buzz" }), {
          pointerId: 2,
          pointerType: "touch",
        });
        expect(vibrate).toHaveBeenCalledWith(10);
      } finally {
        Reflect.deleteProperty(navigator, "vibrate");
      }
    });
  });

  describe("RotateDevicePrompt", () => {
    it("renders nothing when the device already matches", () => {
      installMatchMedia([PORTRAIT]);
      const { container } = render(<RotateDevicePrompt target="portrait" />);
      expect(container.innerHTML).toBe("");
    });

    it("asks for landscape when a landscape game is held in portrait", () => {
      installMatchMedia([PORTRAIT]);
      render(<RotateDevicePrompt target="landscape" />);
      expect(screen.getByRole("status").textContent).toContain("landscape");
    });

    it("offers an exit that is at least 44px", () => {
      installMatchMedia([PORTRAIT]);
      const onExit = vi.fn();
      render(<RotateDevicePrompt target="landscape" onExit={onExit} />);
      const exit = screen.getByRole("button", { name: "Leave cabinet" });
      expect(exit.className).toContain("min-h-[44px]");
      fireEvent.click(exit);
      expect(onExit).toHaveBeenCalledTimes(1);
    });
  });

  describe("DockFrame", () => {
    it("keeps the movement dock first for right-handed play", () => {
      const { container } = render(
        <DockFrame>
          <span>move</span>
          <span>act</span>
        </DockFrame>
      );
      const frame = container.firstElementChild as HTMLElement;
      expect(frame.getAttribute("data-handedness")).toBe("right");
      expect(frame.className).toContain("flex-row");
      expect(frame.className).not.toContain("flex-row-reverse");
    });

    it("mirrors the docks for left-handed play", () => {
      const { container } = render(
        <DockFrame handedness="left">
          <span>move</span>
          <span>act</span>
        </DockFrame>
      );
      const frame = container.firstElementChild as HTMLElement;
      expect(frame.getAttribute("data-handedness")).toBe("left");
      expect(frame.className).toContain("flex-row-reverse");
    });
  });

  describe("useCabinetAutoPause", () => {
    it("fires on blur, page hide and orientation change", () => {
      const onPause = vi.fn();
      renderHook(() => useCabinetAutoPause(onPause));
      fireEvent(window, new Event("blur"));
      fireEvent(window, new Event("pagehide"));
      fireEvent(window, new Event("orientationchange"));
      expect(onPause).toHaveBeenCalledTimes(3);
    });

    it("fires when the screen orientation changes", () => {
      const listeners: Array<() => void> = [];
      Object.defineProperty(window.screen, "orientation", {
        configurable: true,
        value: {
          addEventListener: (_: string, fn: () => void) => listeners.push(fn),
          removeEventListener: vi.fn(),
        },
      });
      const onPause = vi.fn();
      renderHook(() => useCabinetAutoPause(onPause));
      listeners.forEach((fn) => fn());
      expect(onPause).toHaveBeenCalledTimes(1);
    });

    it("fires when the tab is hidden and not when it is visible", () => {
      const onPause = vi.fn();
      renderHook(() => useCabinetAutoPause(onPause));
      fireEvent(document, new Event("visibilitychange"));
      expect(onPause).not.toHaveBeenCalled();
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      try {
        fireEvent(document, new Event("visibilitychange"));
      } finally {
        Reflect.deleteProperty(document, "visibilityState");
      }
      expect(onPause).toHaveBeenCalledTimes(1);
    });

    it("stops listening after unmount", () => {
      const onPause = vi.fn();
      const { unmount } = renderHook(() => useCabinetAutoPause(onPause));
      unmount();
      fireEvent(window, new Event("blur"));
      expect(onPause).not.toHaveBeenCalled();
    });

    it("attaches no listeners without a handler", () => {
      const add = vi.spyOn(window, "addEventListener");
      renderHook(() => useCabinetAutoPause(undefined));
      const names = add.mock.calls.map(([name]) => name);
      expect(names).not.toContain("blur");
      expect(names).not.toContain("pagehide");
    });
  });

  describe("lockScreenOrientation", () => {
    it("locks the declared orientation and releases it", () => {
      const lock = vi.fn(() => Promise.resolve());
      const unlock = vi.fn();
      Object.defineProperty(window.screen, "orientation", {
        configurable: true,
        value: { lock, unlock },
      });
      const release = lockScreenOrientation("landscape");
      expect(lock).toHaveBeenCalledWith("landscape");
      release();
      expect(unlock).toHaveBeenCalledTimes(1);
    });

    it("ignores a rejected lock", async () => {
      Object.defineProperty(window.screen, "orientation", {
        configurable: true,
        value: {
          lock: () => Promise.reject(new Error("not fullscreen")),
          unlock: vi.fn(),
        },
      });
      expect(() => lockScreenOrientation("portrait")).not.toThrow();
      await Promise.resolve();
    });

    it("is a no-op where the Screen Orientation API is missing", () => {
      Reflect.deleteProperty(window.screen, "orientation");
      const release = lockScreenOrientation("portrait");
      expect(() => release()).not.toThrow();
    });
  });
});
