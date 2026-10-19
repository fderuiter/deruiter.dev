"use client";

import { useSyncExternalStore } from "react";
import {
  classifyFormFactor,
  parseViewOverride,
  type FormFactor,
} from "@/lib/arcade/form-factor";
import { getMatchMediaMatches } from "@/hooks/useMediaQuery";
import { TOUCH_DEVICE_QUERY } from "./immersive";

/** Options for {@link useFormFactor}. */
export interface UseFormFactorOptions {
  /**
   * A forced view, such as the player's Layout setting. `"auto"` or
   * undefined lets the size and pointer decide. A `?view=` URL parameter
   * wins over this, so tests and debugging can force any view.
   */
  readonly override?: FormFactor | "auto";
}

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** Whether a text field has focus, so an on-screen keyboard may be open. */
function isTyping(): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  if (active.isContentEditable || active instanceof HTMLTextAreaElement) {
    return true;
  }
  return (
    active instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(active.type)
  );
}

// One shared store: every cabinet on the page measures the same window.
let current: FormFactor | undefined;
let listeners = 0;

function compute(): FormFactor {
  // An on-screen keyboard can shrink the layout viewport; never swap for it.
  if (current !== undefined && isTyping()) return current;
  return classifyFormFactor(
    {
      width: window.innerWidth,
      height: window.innerHeight,
      coarse: getMatchMediaMatches(TOUCH_DEVICE_QUERY),
    },
    current
  );
}

function subscribe(callback: () => void): () => void {
  const update = () => {
    const next = compute();
    if (next !== current) {
      current = next;
      callback();
    }
  };
  window.addEventListener("resize", update);
  window.addEventListener("orientationchange", update);
  // Leaving a text field re-measures, in case the size changed meanwhile.
  document.addEventListener("focusout", update);
  const pointer = window.matchMedia?.(TOUCH_DEVICE_QUERY);
  pointer?.addEventListener?.("change", update);
  listeners += 1;
  update();
  return () => {
    listeners -= 1;
    window.removeEventListener("resize", update);
    window.removeEventListener("orientationchange", update);
    document.removeEventListener("focusout", update);
    pointer?.removeEventListener?.("change", update);
  };
}

function getSnapshot(): FormFactor {
  // With nobody listening the window may have changed unseen, so re-measure.
  if (current === undefined || listeners === 0) current = compute();
  return current;
}

const serverSnapshot = (): FormFactor => "desktop";

const noSubscription = () => () => {};
const readUrlOverride = (): FormFactor | null =>
  parseViewOverride(window.location?.search ?? "");
const noUrlOverride = (): FormFactor | null => null;

/**
 * Which of a game's three views the cabinet gets: phone, tablet or desktop
 * (ADR 0062). It measures the window's layout viewport, never the cabinet's
 * inline box (a desktop cabinet can sit under 500 px tall before Launch) and
 * never the visual viewport (pinch zoom and the on-screen keyboard shrink
 * it). It re-decides on resize, rotation and pointer changes, with 24 px
 * hysteresis so a size on the line does not flip views, and holds its choice
 * while a text field has focus. The server and the first client
 * render return `"desktop"`; views mount only after Launch, so nothing
 * depends on the server value.
 *
 * Use this inside a game, not `PHONE_QUERY`. `PHONE_QUERY` stays only for
 * CSS-first surfaces, the desktop-only gate and the hub badges, which must be
 * right before hydration.
 *
 * @param options - A forced view, such as the player's Layout setting.
 * @returns The view to show.
 */
export function useFormFactor(options: UseFormFactorOptions = {}): FormFactor {
  const measured = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const urlOverride = useSyncExternalStore(
    noSubscription,
    readUrlOverride,
    noUrlOverride
  );
  if (urlOverride) return urlOverride;
  if (options.override && options.override !== "auto") return options.override;
  return measured;
}
