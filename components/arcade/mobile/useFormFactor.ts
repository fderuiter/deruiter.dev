"use client";

import { useSyncExternalStore } from "react";
import {
  classifyFormFactor,
  parseViewOverride,
  type FormFactor,
} from "@/lib/arcade/form-factor";
import { layoutFits, useDeviceSettings } from "@/lib/arcade";
import { getMatchMediaMatches } from "@/hooks/useMediaQuery";
import { TOUCH_DEVICE_QUERY } from "./immersive";

/** Options for {@link useFormFactor}. */
export interface UseFormFactorOptions {
  /**
   * A forced view, such as the cabinet's developer view picker. `"auto"` or
   * undefined leaves it to this device's Layout setting (#2924), then the
   * size and pointer. A `?view=` URL parameter wins over this, so tests and
   * debugging can force any view.
   */
  readonly override?: FormFactor | "auto";
  /**
   * Whether to measure at all (default true). A cabinet that hosts no views
   * passes false, so it adds no listeners and always reads `"desktop"`.
   */
  readonly enabled?: boolean;
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

// One shared store: every cabinet on the page measures the same window, so
// one set of window listeners notifies every subscriber.
let current: FormFactor | undefined;
const callbacks = new Set<() => void>();
let detach: (() => void) | null = null;

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

function update() {
  const next = compute();
  if (next === current) return;
  current = next;
  callbacks.forEach((callback) => callback());
}

function attach(): () => void {
  window.addEventListener("resize", update);
  window.addEventListener("orientationchange", update);
  // Leaving a text field re-measures, in case the size changed meanwhile.
  document.addEventListener("focusout", update);
  const pointer = window.matchMedia?.(TOUCH_DEVICE_QUERY);
  pointer?.addEventListener?.("change", update);
  return () => {
    window.removeEventListener("resize", update);
    window.removeEventListener("orientationchange", update);
    document.removeEventListener("focusout", update);
    pointer?.removeEventListener?.("change", update);
  };
}

function subscribe(callback: () => void): () => void {
  callbacks.add(callback);
  if (!detach) detach = attach();
  update();
  return () => {
    callbacks.delete(callback);
    if (callbacks.size > 0) return;
    detach?.();
    detach = null;
    // The next Launch starts fresh, without this one's hysteresis.
    current = undefined;
  };
}

function getSnapshot(): FormFactor {
  // With nobody listening the window may have changed unseen, so re-measure.
  if (current === undefined || callbacks.size === 0) current = compute();
  return current;
}

const serverSnapshot = (): FormFactor => "desktop";

const noSubscription = () => () => {};
function subscribeResize(callback: () => void): () => void {
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}
const noFit = () => false;
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
 * while a text field has focus. This device's Layout setting from the
 * cabinet's Setup sheet picks a view instead while the window is wide enough
 * for it; in a narrower window Auto applies until it fits again (#2924). The server and the first client
 * render return `"desktop"`; views mount only after Launch, so nothing
 * depends on the server value.
 *
 * Use this inside a game, not `PHONE_QUERY`. `PHONE_QUERY` stays only for
 * CSS-first surfaces, the desktop-only gate and the hub badges, which must be
 * right before hydration.
 *
 * @param options - Whether to measure, and a forced view such as the developer view picker.
 * @returns The view to show.
 */
export function useFormFactor(options: UseFormFactorOptions = {}): FormFactor {
  const enabled = options.enabled ?? true;
  const measured = useSyncExternalStore(
    enabled ? subscribe : noSubscription,
    enabled ? getSnapshot : serverSnapshot,
    serverSnapshot
  );
  const urlOverride = useSyncExternalStore(
    noSubscription,
    readUrlOverride,
    noUrlOverride
  );
  const { layout } = useDeviceSettings();
  const layoutApplies = useSyncExternalStore(
    enabled && layout !== "auto" ? subscribeResize : noSubscription,
    () => layout !== "auto" && layoutFits(layout, window.innerWidth),
    noFit
  );
  if (!enabled) return "desktop";
  if (urlOverride) return urlOverride;
  if (options.override && options.override !== "auto") return options.override;
  if (layout !== "auto" && layoutApplies) return layout;
  return measured;
}
