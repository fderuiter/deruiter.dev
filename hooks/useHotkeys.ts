"use client";

import { useEffect, useEffectEvent } from "react";
import { isAnyFocusTrapActive } from "@/hooks/useFocusTrap";

/**
 * Handler invoked when a registered hotkey matches a keydown event.
 */
export type HotkeyHandler = (event: KeyboardEvent, hotkey: string) => void;

/**
 * Options controlling when a `useHotkeys` binding fires.
 */
export interface UseHotkeysOptions {
  /**
   * Whether the listener is attached. Defaults to true.
   */
  enabled?: boolean;
  /**
   * Fire even while the user is typing in an input, textarea, select or
   * contenteditable region. Defaults to false.
   */
  allowInInputs?: boolean;
  /**
   * Fire even when the event originates inside a `[data-keyboard-boundary]`
   * region (a game or terminal that owns its own keys). Defaults to false.
   */
  allowInKeyboardBoundary?: boolean;
  /**
   * Skip the binding while any `useFocusTrap` dialog or drawer is active, so
   * background shortcuts do not fire behind a modal. Defaults to false.
   */
  ignoreWhenModalOpen?: boolean;
  /**
   * Call `preventDefault()` on the event when a hotkey matches. Defaults to false.
   */
  preventDefault?: boolean;
  /**
   * Call `stopPropagation()` on the event when a hotkey matches. Defaults to false.
   */
  stopPropagation?: boolean;
  /**
   * Where the keydown listener is attached. Defaults to `"window"`.
   */
  target?: "window" | "document";
  /**
   * When set, only events whose target is inside this element are handled.
   */
  targetRef?: React.RefObject<HTMLElement | null>;
}

/**
 * A parsed hotkey such as `Mod+Shift+K`.
 */
export interface ParsedHotkey {
  /** Lower-cased `KeyboardEvent.key` value to match (e.g. `"k"`, `"escape"`, `" "`). */
  key: string;
  /** Cmd on macOS, Ctrl elsewhere. */
  mod: boolean;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
}

const KEY_ALIASES: Record<string, string> = {
  esc: "escape",
  space: " ",
  spacebar: " ",
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  del: "delete",
  return: "enter",
  plus: "+",
};

/**
 * Parses a hotkey string such as `Mod+K`, `Shift+?` or `Escape`.
 *
 * Modifier names are case-insensitive: `Mod`, `Ctrl`/`Control`, `Meta`/`Cmd`/`Command`,
 * `Alt`/`Option` and `Shift`. The final segment is the key; use `Plus` for a literal plus sign.
 *
 * @param hotkey - The hotkey description.
 * @returns The parsed modifiers and key.
 */
export function parseHotkey(hotkey: string): ParsedHotkey {
  const parts = hotkey.split("+").map((part) => part.trim());
  const rawKey = parts.pop() ?? "";
  const parsed: ParsedHotkey = {
    key: "",
    mod: false,
    ctrl: false,
    meta: false,
    alt: false,
    shift: false,
  };

  for (const part of parts) {
    switch (part.toLowerCase()) {
      case "mod":
        parsed.mod = true;
        break;
      case "ctrl":
      case "control":
        parsed.ctrl = true;
        break;
      case "meta":
      case "cmd":
      case "command":
        parsed.meta = true;
        break;
      case "alt":
      case "option":
        parsed.alt = true;
        break;
      case "shift":
        parsed.shift = true;
        break;
      default:
        break;
    }
  }

  const lowered = rawKey.toLowerCase();
  parsed.key = KEY_ALIASES[lowered] ?? lowered;
  return parsed;
}

/**
 * Detects Apple platforms, where the `Mod` modifier maps to the Command key.
 *
 * @returns True on macOS and iOS, false elsewhere and during server rendering.
 */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform = nav.userAgentData?.platform || nav.platform || "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/**
 * Checks whether a keydown event matches a hotkey.
 *
 * Ctrl, Meta and Alt must match exactly, so `K` does not fire on `Ctrl+K`.
 * Shift is only required when the hotkey names it, because Shift is already
 * reflected in `event.key` for printable characters such as `?`.
 *
 * @param event - The keydown event.
 * @param hotkey - A hotkey string or a parsed hotkey.
 * @param isApple - Whether `Mod` means Command. Defaults to the detected platform.
 * @returns True when the event matches.
 */
export function matchesHotkey(
  event: Pick<
    KeyboardEvent,
    "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
  >,
  hotkey: string | ParsedHotkey,
  isApple: boolean = isApplePlatform()
): boolean {
  const parsed = typeof hotkey === "string" ? parseHotkey(hotkey) : hotkey;
  if (typeof event.key !== "string" || event.key.toLowerCase() !== parsed.key) {
    return false;
  }

  const wantCtrl = parsed.ctrl || (parsed.mod && !isApple);
  const wantMeta = parsed.meta || (parsed.mod && isApple);

  if (event.ctrlKey !== wantCtrl) return false;
  if (event.metaKey !== wantMeta) return false;
  if (event.altKey !== parsed.alt) return false;
  if (parsed.shift && !event.shiftKey) return false;
  return true;
}

/**
 * Checks whether an event target is a place where the user types text:
 * an input, textarea, select or contenteditable region.
 *
 * @param target - The event target, usually `event.target`.
 * @returns True when keystrokes should be left to the element.
 */
export function isEditableElement(target: EventTarget | null): boolean {
  if (!target || typeof Element === "undefined") return false;
  if (!(target instanceof Element)) return false;

  const tagName = target.tagName;
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    return true;
  }
  if (target instanceof HTMLElement && target.isContentEditable) {
    return true;
  }
  // JSDOM does not implement isContentEditable, so also check the attribute.
  return Boolean(
    target.closest('[contenteditable]:not([contenteditable="false"])')
  );
}

/**
 * Checks whether an event target sits inside a `[data-keyboard-boundary]`
 * region, such as a game canvas or terminal that owns its own keys.
 *
 * @param target - The event target, usually `event.target`.
 * @returns True when the target is inside a keyboard boundary.
 */
export function isWithinKeyboardBoundary(target: EventTarget | null): boolean {
  if (!target || typeof Element === "undefined") return false;
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("[data-keyboard-boundary]"));
}

/**
 * Binds one or more keyboard shortcuts to a handler for the lifetime of the component.
 *
 * Shortcuts are ignored while the user is typing in form fields or
 * contenteditable regions, and inside `[data-keyboard-boundary]` regions,
 * unless the matching option opts in. `Mod` means Command on macOS and Ctrl
 * elsewhere. The listener is removed on unmount or when `enabled` becomes
 * false, and the latest handler is always called without re-binding.
 *
 * @example
 * ```tsx
 * useHotkeys("Mod+K", () => setOpen(true), { preventDefault: true });
 * useHotkeys(["?", "h"], toggleHelp);
 * ```
 *
 * @param hotkeys - A hotkey string or a list of them, e.g. `"Mod+K"` or `["Escape", "q"]`.
 * @param handler - Called with the event and the hotkey string that matched.
 * @param options - Behavior options; see {@link UseHotkeysOptions}.
 */
export function useHotkeys(
  hotkeys: string | readonly string[],
  handler: HotkeyHandler,
  options: UseHotkeysOptions = {}
): void {
  const {
    enabled = true,
    allowInInputs = false,
    allowInKeyboardBoundary = false,
    ignoreWhenModalOpen = false,
    preventDefault = false,
    stopPropagation = false,
    target = "window",
    targetRef,
  } = options;

  // A stable string key keeps the effect from re-binding when callers pass a
  // fresh array literal on every render.
  const hotkeyKey = typeof hotkeys === "string" ? hotkeys : hotkeys.join("\n");

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.isComposing) return;
    if (!allowInInputs && isEditableElement(event.target)) return;
    if (!allowInKeyboardBoundary && isWithinKeyboardBoundary(event.target)) {
      return;
    }
    if (ignoreWhenModalOpen && isAnyFocusTrapActive()) return;
    if (targetRef) {
      const scope = targetRef.current;
      if (!scope || !(event.target instanceof Node)) return;
      if (!scope.contains(event.target)) return;
    }

    const isApple = isApplePlatform();
    const matched = hotkeyKey
      .split("\n")
      .find((hotkey) => matchesHotkey(event, hotkey, isApple));
    if (matched === undefined) return;

    if (preventDefault) event.preventDefault();
    if (stopPropagation) event.stopPropagation();
    handler(event, matched);
  });

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const node: Window | Document = target === "document" ? document : window;
    const listener = (event: Event) => onKeyDown(event as KeyboardEvent);
    node.addEventListener("keydown", listener);
    return () => node.removeEventListener("keydown", listener);
  }, [enabled, target]);
}
