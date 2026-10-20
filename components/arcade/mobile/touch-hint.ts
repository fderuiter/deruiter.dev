"use client";

import { useInputModality } from "@/components/arcade/mobile/input-modality";
import { actionHintText, type ActionDefinition } from "@/lib/arcade";

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
 * The control hint an action's labels make (#2356): its key label, its touch
 * label, and "Press" with the key on a desktop.
 *
 * @param action - An action from a `defineActions` map.
 * @returns A frozen hint for `resolveControlHint` or `useControlHint`.
 */
export function controlHintFromAction(action: ActionDefinition): ControlHint {
  const text = actionHintText(action);
  return Object.freeze({
    key: text.key,
    touch: text.touch,
    desktop: text.desktop,
  });
}

function isControlHint(
  hint: ControlHint | ActionDefinition
): hint is ControlHint {
  return "desktop" in hint;
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
 * The phrase for a control on this device. It takes a hand-written hint or an
 * action from the game's action map, whose labels then write the copy.
 *
 * @param hint - The control hint, or an action definition.
 * @returns "Tap" style copy after touch or pen, "Press Space" style elsewhere.
 */
export function useControlHint(hint: ControlHint | ActionDefinition): string {
  const touch = useTouchHint();
  return resolveControlHint(
    isControlHint(hint) ? hint : controlHintFromAction(hint),
    touch
  );
}
