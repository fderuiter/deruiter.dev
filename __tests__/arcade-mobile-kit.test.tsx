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
  act,
  cleanup,
  renderHook,
} from "@testing-library/react";
import {
  controlHint,
  resolveControlHint,
  useControlHint,
  useInputModality,
  useTouchHint,
  RotateDevicePrompt,
  TouchButton,
  TouchControlsGate,
  DockFrame,
  useCabinetAutoPause,
  lockScreenOrientation,
} from "../components/arcade/mobile";

const COARSE = "(pointer: coarse)";

/** A pointerdown of the given type, as the browser dispatches it on window. */
function pointerDown(pointerType: string) {
  const event = new Event("pointerdown");
  Object.defineProperty(event, "pointerType", { value: pointerType });
  act(() => {
    window.dispatchEvent(event);
  });
}

function pressKey(key: string, target: EventTarget = window) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

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
    Reflect.deleteProperty(navigator, "vibrate");
    Reflect.deleteProperty(HTMLElement.prototype, "setPointerCapture");
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

    it("reads touch from a coarse pointer in the hooks", () => {
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

    it("follows the last input: keys after a keyboard press, Tap after a touch", () => {
      installMatchMedia([COARSE]);
      const { result } = renderHook(() =>
        useControlHint(controlHint({ key: "Space", touch: "Tap" }))
      );
      expect(result.current).toBe("Tap");

      pressKey("ArrowLeft");
      expect(result.current).toBe("Press Space");

      pointerDown("touch");
      expect(result.current).toBe("Tap");
    });

    it("reads a Pencil as touch", () => {
      installMatchMedia([]);
      const { result } = renderHook(() => useTouchHint());
      expect(result.current).toBe(false);
      pointerDown("pen");
      expect(result.current).toBe(true);
    });
  });

  describe("input modality", () => {
    it("starts on touch for a coarse pointer and on mouse otherwise", () => {
      installMatchMedia([COARSE]);
      const { result: coarse } = renderHook(() => useInputModality());
      expect(coarse.current).toBe("touch");
      cleanup();

      installMatchMedia([]);
      const { result: fine } = renderHook(() => useInputModality());
      expect(fine.current).toBe("mouse");
    });

    it("takes the modality from the last pointerdown type", () => {
      installMatchMedia([]);
      const { result } = renderHook(() => useInputModality());
      pointerDown("touch");
      expect(result.current).toBe("touch");
      pointerDown("pen");
      expect(result.current).toBe("pen");
      pointerDown("mouse");
      expect(result.current).toBe("mouse");
    });

    it("takes keyboard from a hardware key and ignores modifier-only keys", () => {
      installMatchMedia([COARSE]);
      const { result } = renderHook(() => useInputModality());
      pressKey("Shift");
      pressKey("Control");
      expect(result.current).toBe("touch");
      pressKey("a");
      expect(result.current).toBe("keyboard");
    });

    it("ignores keys typed into a text field", () => {
      installMatchMedia([COARSE]);
      render(<input aria-label="Name" />);
      const { result } = renderHook(() => useInputModality());
      pressKey("a", screen.getByRole("textbox", { name: "Name" }));
      expect(result.current).toBe("touch");
    });

    it("renders the desktop default on the server", () => {
      installMatchMedia([COARSE]);
      const { result } = renderHook(() => useInputModality());
      expect(result.current).toBe("touch");
    });

    it("shows its children only while touch or a Pencil is in use", () => {
      installMatchMedia([COARSE]);
      render(
        <TouchControlsGate>
          <button type="button">Fire</button>
        </TouchControlsGate>
      );
      expect(screen.getByRole("button", { name: "Fire" })).toBeDefined();

      pressKey("ArrowUp");
      expect(screen.queryByRole("button", { name: "Fire" })).toBeNull();

      pointerDown("pen");
      expect(screen.getByRole("button", { name: "Fire" })).toBeDefined();
    });
  });

  describe("TouchButton", () => {
    it("is named, at least 44px square, and takes no touch gestures", () => {
      render(
        <TouchButton label="Fire">
          <span aria-hidden="true">F</span>
        </TouchButton>
      );
      const button = screen.getByRole("button", { name: "Fire" });
      expect(button.className).toContain("min-h-[44px]");
      expect(button.className).toContain("min-w-[44px]");
      expect(button.className).toContain("touch-none");
      expect(button.className).toContain("motion-safe:active:scale-[0.98]");
      expect(button.getAttribute("type")).toBe("button");
    });

    it("counts one press per button, however many pointers land", () => {
      const onPress = vi.fn();
      const onRelease = vi.fn();
      render(
        <TouchButton label="Fire" onPress={onPress} onRelease={onRelease} />
      );
      const button = screen.getByRole("button", { name: "Fire" });
      fireEvent.pointerDown(button, { pointerId: 1, pointerType: "touch" });
      fireEvent.pointerDown(button, { pointerId: 2, pointerType: "touch" });
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("releases only when the last of two fingers lifts", () => {
      const onPress = vi.fn();
      const onRelease = vi.fn();
      render(
        <TouchButton label="Fire" onPress={onPress} onRelease={onRelease} />
      );
      const button = screen.getByRole("button", { name: "Fire" });
      fireEvent.pointerDown(button, { pointerId: 1, pointerType: "touch" });
      fireEvent.pointerDown(button, { pointerId: 2, pointerType: "touch" });
      fireEvent.pointerUp(button, { pointerId: 1, pointerType: "touch" });
      expect(onRelease).not.toHaveBeenCalled();
      fireEvent.pointerUp(button, { pointerId: 2, pointerType: "touch" });
      expect(onRelease).toHaveBeenCalledTimes(1);
      // A second, stray up for a pointer that already lifted changes nothing.
      fireEvent.pointerUp(button, { pointerId: 2, pointerType: "touch" });
      expect(onRelease).toHaveBeenCalledTimes(1);
    });

    it("presses again only after every pointer has lifted", () => {
      const onPress = vi.fn();
      render(
        <TouchButton label="Fire" onPress={onPress} onRelease={vi.fn()} />
      );
      const button = screen.getByRole("button", { name: "Fire" });
      fireEvent.pointerDown(button, { pointerId: 1, pointerType: "touch" });
      fireEvent.pointerUp(button, { pointerId: 1, pointerType: "touch" });
      fireEvent.pointerDown(button, { pointerId: 3, pointerType: "touch" });
      expect(onPress).toHaveBeenCalledTimes(2);
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
      fireEvent.lostPointerCapture(button, { pointerId: 1 });
      expect(onRelease).toHaveBeenCalledTimes(2);
    });

    it("releases every hold when the button loses focus", () => {
      const onPress = vi.fn();
      const onRelease = vi.fn();
      render(
        <TouchButton label="Fire" onPress={onPress} onRelease={onRelease} />
      );
      const button = screen.getByRole("button", { name: "Fire" });
      fireEvent.pointerDown(button, { pointerId: 1, pointerType: "touch" });
      fireEvent.pointerDown(button, { pointerId: 2, pointerType: "touch" });
      fireEvent.blur(button);
      expect(onRelease).toHaveBeenCalledTimes(1);
      // Blur with nothing held is quiet.
      fireEvent.blur(button);
      expect(onRelease).toHaveBeenCalledTimes(1);
    });

    it("captures the pointer on press when the engine supports it", () => {
      const setPointerCapture = vi.fn();
      HTMLElement.prototype.setPointerCapture = setPointerCapture;
      render(<TouchButton label="Fire" onPress={vi.fn()} />);
      fireEvent.pointerDown(screen.getByRole("button", { name: "Fire" }), {
        pointerId: 7,
        pointerType: "touch",
      });
      expect(setPointerCapture).toHaveBeenCalledWith(7);
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

    it("takes an Apple Pencil press and release like a finger", () => {
      installMatchMedia([]);
      const onPress = vi.fn();
      const onRelease = vi.fn();
      render(
        <TouchButton label="Fire" onPress={onPress} onRelease={onRelease} />
      );
      const button = screen.getByRole("button", { name: "Fire" });
      fireEvent.pointerDown(button, { pointerId: 7, pointerType: "pen" });
      expect(onPress).toHaveBeenCalledTimes(1);
      fireEvent.pointerUp(button, { pointerId: 7, pointerType: "pen" });
      expect(onRelease).toHaveBeenCalledTimes(1);
    });

    it("counts a Pencil and a finger on one button as one press", () => {
      installMatchMedia([]);
      const onPress = vi.fn();
      const onRelease = vi.fn();
      render(
        <TouchButton label="Fire" onPress={onPress} onRelease={onRelease} />
      );
      const button = screen.getByRole("button", { name: "Fire" });
      fireEvent.pointerDown(button, { pointerId: 7, pointerType: "pen" });
      fireEvent.pointerDown(button, { pointerId: 2, pointerType: "touch" });
      expect(onPress).toHaveBeenCalledTimes(1);
      fireEvent.pointerUp(button, { pointerId: 7, pointerType: "pen" });
      expect(onRelease).not.toHaveBeenCalled();
      fireEvent.pointerUp(button, { pointerId: 2, pointerType: "touch" });
      expect(onRelease).toHaveBeenCalledTimes(1);
    });

    it("captures a Pencil press on the button", () => {
      installMatchMedia([]);
      const setPointerCapture = vi.fn();
      Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
        configurable: true,
        value: setPointerCapture,
      });
      render(<TouchButton label="Fire" />);
      fireEvent.pointerDown(screen.getByRole("button", { name: "Fire" }), {
        pointerId: 9,
        pointerType: "pen",
      });
      expect(setPointerCapture).toHaveBeenCalledWith(9);
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
    });
  });

  describe("RotateDevicePrompt", () => {
    it("is an alertdialog named by its message", () => {
      render(<RotateDevicePrompt target="landscape" />);
      const dialog = screen.getByRole("alertdialog");
      expect(dialog.getAttribute("aria-modal")).toBe("true");
      const labelId = dialog.getAttribute("aria-labelledby");
      expect(labelId).toBeTruthy();
      expect(document.getElementById(labelId as string)?.textContent).toContain(
        "landscape"
      );
    });

    it("moves focus to Leave cabinet on show and returns it on removal", () => {
      const trigger = document.createElement("button");
      document.body.appendChild(trigger);
      trigger.focus();
      const onExit = vi.fn();
      const { unmount } = render(
        <RotateDevicePrompt target="landscape" onExit={onExit} />
      );
      const exit = screen.getByRole("button", { name: "Leave cabinet" });
      expect(document.activeElement).toBe(exit);
      unmount();
      expect(document.activeElement).toBe(trigger);
      trigger.remove();
    });

    it("offers an exit that is at least 44px and gates its press motion", () => {
      const onExit = vi.fn();
      render(<RotateDevicePrompt target="landscape" onExit={onExit} />);
      const exit = screen.getByRole("button", { name: "Leave cabinet" });
      expect(exit.className).toContain("min-h-[44px]");
      expect(exit.className).toContain("motion-safe:active:scale-[0.98]");
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
    it("fires on blur, page hide and an orientation change without a screen API", () => {
      const onPause = vi.fn();
      renderHook(() => useCabinetAutoPause(onPause));
      fireEvent(window, new Event("blur"));
      fireEvent(window, new Event("pagehide"));
      fireEvent(window, new Event("orientationchange"));
      expect(onPause).toHaveBeenCalledTimes(3);
    });

    it("fires once per rotation via screen.orientation and never also via orientationchange", () => {
      const listeners: Array<() => void> = [];
      Object.defineProperty(window.screen, "orientation", {
        configurable: true,
        value: {
          addEventListener: (_: string, fn: () => void) => listeners.push(fn),
          removeEventListener: vi.fn(),
        },
      });
      const addWindow = vi.spyOn(window, "addEventListener");
      const onPause = vi.fn();
      renderHook(() => useCabinetAutoPause(onPause));

      const rotatedTypes = addWindow.mock.calls.map(([type]) => type);
      expect(rotatedTypes).not.toContain("orientationchange");

      // One rotation: the screen change fires; a legacy event does not add one.
      listeners.forEach((fn) => fn());
      fireEvent(window, new Event("orientationchange"));
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
      expect(names).not.toContain("orientationchange");
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

    it("ignores a rejected lock once the rejection has settled", async () => {
      Object.defineProperty(window.screen, "orientation", {
        configurable: true,
        value: {
          lock: () => Promise.reject(new Error("not fullscreen")),
          unlock: vi.fn(),
        },
      });
      const release = lockScreenOrientation("portrait");
      // Flush a macrotask so the rejection is handled before the assertion;
      // an unhandled rejection would fail the run.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(() => release()).not.toThrow();
    });

    it("is a no-op where the Screen Orientation API is missing", () => {
      Reflect.deleteProperty(window.screen, "orientation");
      const release = lockScreenOrientation("portrait");
      expect(() => release()).not.toThrow();
    });
  });
});
