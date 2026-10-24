"use client";

import { useSyncExternalStore } from "react";
import { TOUCH_DEVICE_QUERY } from "@/components/arcade/mobile/immersive";
import { getMatchMediaMatches } from "@/hooks/useMediaQuery";
import type { InputModality } from "@/lib/arcade";

/**
 * The input the player used last. A touch screen, an Apple Pencil, a hardware
 * keyboard (a keyboard case, a desktop keyboard) or a mouse or trackpad. The
 * type lives with the run-fairness contract in `lib/arcade` (#2547), which
 * keys assists on it.
 */
export type { InputModality };

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

/** Input types a person types text into. A checkbox, range or button is not. */
const TEXT_INPUT_TYPES = new Set([
  "",
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
]);

/**
 * Whether a key was typed into a field. Only text-like fields count, so a key
 * on a checkbox, range or button still reads as keyboard use.
 *
 * @param target - Where the key landed.
 * @returns True when the key was typed into text entry.
 */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("textarea, select")) return true;
  if (target.closest("[contenteditable]:not([contenteditable='false'])")) {
    return true;
  }
  const input = target.closest("input");
  if (!input) return false;
  return TEXT_INPUT_TYPES.has((input.getAttribute("type") ?? "").toLowerCase());
}

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

/**
 * Switch Control and Full Keyboard Access send keydown events too. Those
 * count as keyboard use on purpose: the controls hide until the next touch.
 */
function handleKeyDown(event: KeyboardEvent): void {
  if (MODIFIER_KEYS.has(event.key)) return;
  if (isTextEntry(event.target)) return;
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
