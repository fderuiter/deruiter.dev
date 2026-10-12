"use client";

import { useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * A control named two ways: the key on a keyboard and the gesture on a touch
 * screen. Game copy resolves it with `useControlHint` so a phone reads "Tap"
 * where a desktop reads "Press Space".
 */
export interface ControlHint {
  readonly key: string;
  readonly touch: string;
  readonly desktop: string;
}

/**
 * Builds a control hint. `desktop` defaults to `Press <key>`.
 *
 * @param input - The key name, the touch gesture and an optional desktop phrase.
 * @returns A frozen hint for `resolveControlHint` or `useControlHint`.
 */
export function controlHint(input: {
  key: string;
  touch: string;
  desktop?: string;
}): ControlHint {
  return Object.freeze({
    key: input.key,
    touch: input.touch,
    desktop: input.desktop ?? `Press ${input.key}`,
  });
}

/**
 * Picks the phrase for the device.
 *
 * @param hint - The control hint.
 * @param isTouch - Whether the primary input is a coarse pointer.
 * @returns The touch phrase or the desktop phrase.
 */
export function resolveControlHint(
  hint: ControlHint,
  isTouch: boolean
): string {
  return isTouch ? hint.touch : hint.desktop;
}

/**
 * Whether the primary pointer is coarse (a finger). SSR returns false.
 *
 * @returns True on touch-first devices.
 */
export function useTouchHint(): boolean {
  return useMediaQuery("(pointer: coarse)");
}

/**
 * The phrase for a control on this device.
 *
 * @param hint - The control hint.
 * @returns "Tap" style copy on touch devices, "Press Space" style elsewhere.
 */
export function useControlHint(hint: ControlHint): string {
  return resolveControlHint(hint, useTouchHint());
}
