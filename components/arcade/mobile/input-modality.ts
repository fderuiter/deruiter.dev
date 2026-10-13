"use client";

import { useSyncExternalStore } from "react";
import { TOUCH_DEVICE_QUERY } from "@/components/arcade/mobile/immersive";
import { getMatchMediaMatches } from "@/hooks/useMediaQuery";

/**
 * The input the player used last. A touch screen, an Apple Pencil, a hardware
 * keyboard (a keyboard case, a desktop keyboard) or a mouse or trackpad.
 */
export type InputModality = "touch" | "pen" | "keyboard" | "mouse";

/** Keys that change state on their own and say nothing about the input. */
const MODIFIER_KEYS = new Set([
  "Shift",
  "Control",
  "Alt",
  "AltGraph",
  "Meta",
  "OS",
  "CapsLock",
  "NumLock",
  "ScrollLock",
  "Fn",
  "FnLock",
  "Hyper",
  "Super",
  "Symbol",
  "SymbolLock",
]);

/** Fields where a key is typed text, not a control press. */
const TEXT_ENTRY =
  "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

type Listener = () => void;

const listeners = new Set<Listener>();
let current: InputModality | null = null;
let attached = false;

/** A coarse pointer starts on touch; anything else starts on a mouse. */
function initialModality(): InputModality {
  return getMatchMediaMatches(TOUCH_DEVICE_QUERY) ? "touch" : "mouse";
}

function setModality(next: InputModality): void {
  if (current === next) return;
  current = next;
  listeners.forEach((listener) => listener());
}

function handlePointerDown(event: PointerEvent): void {
  switch (event.pointerType) {
    case "touch":
      setModality("touch");
      return;
    case "pen":
      setModality("pen");
      return;
    case "mouse":
      setModality("mouse");
      return;
    default:
      return;
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  if (MODIFIER_KEYS.has(event.key)) return;
  if (event.target instanceof Element && event.target.closest(TEXT_ENTRY)) {
    return;
  }
  setModality("keyboard");
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  if (!attached && typeof window !== "undefined") {
    window.addEventListener("pointerdown", handlePointerDown, {
      capture: true,
      passive: true,
    });
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    attached = true;
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && attached) {
      window.removeEventListener("pointerdown", handlePointerDown, {
        capture: true,
      });
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      attached = false;
      // The next subscriber reads the device again rather than a stale input.
      current = null;
    }
  };
}

function getSnapshot(): InputModality {
  if (current === null) current = initialModality();
  return current;
}

/** The server cannot see the device, so it renders the desktop default. */
function getServerSnapshot(): InputModality {
  return "mouse";
}

/**
 * The player's last input, from the last pointerdown type or a hardware key
 * press (modifier keys and typing in a field do not count). It starts on
 * touch for a coarse pointer and on mouse otherwise. SSR returns mouse.
 *
 * @returns The current input modality.
 */
export function useInputModality(): InputModality {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
