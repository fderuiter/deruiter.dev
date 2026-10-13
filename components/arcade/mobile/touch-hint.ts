"use client";

import { useInputModality } from "@/components/arcade/mobile/input-modality";

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
 * Whether the player's last input was a finger or a Pencil. It follows the
 * input modality, not the pointer query, so a keyboard case on an iPad reads
 * the keys. SSR returns false.
 *
 * @returns True when the last input was touch or pen.
 */
export function useTouchHint(): boolean {
  const modality = useInputModality();
  return modality === "touch" || modality === "pen";
}

/**
 * The phrase for a control on this device.
 *
 * @param hint - The control hint.
 * @returns "Tap" style copy after touch or pen, "Press Space" style elsewhere.
 */
export function useControlHint(hint: ControlHint): string {
  return resolveControlHint(hint, useTouchHint());
}
