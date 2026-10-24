/**
 * Halloween mode preference (#2737). The player's choice is stored as "on"
 * or "off"; with no choice saved, the mode follows the calendar and is on
 * through October. Read it with useSyncExternalStore so the canvas, the
 * wardrobe and every other tab agree.
 */
import { isHalloweenSeason } from "@/lib/working-with-duck-engine";
import { safeGetRawItem, safeSetRawItem } from "@/lib/safe-storage";

export const HALLOWEEN_KEY = "working_with_duck_halloween";
/** Fired in this tab after the choice changes; "storage" only fires in others. */
const HALLOWEEN_EVENT = "duck-halloween";

/** Whether Halloween mode is on, given the stored choice and today's date. */
export function resolveHalloweenMode(
  stored: string | null,
  today: Date
): boolean {
  if (stored === "on") return true;
  if (stored === "off") return false;
  return isHalloweenSeason(today);
}

export function subscribeHalloween(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(HALLOWEEN_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(HALLOWEEN_EVENT, callback);
  };
}

export function getHalloweenSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return resolveHalloweenMode(safeGetRawItem(HALLOWEEN_KEY), new Date());
}

export const getHalloweenServerSnapshot = () => false;

/** Saves the player's choice and tells this tab's subscribers. */
export function setHalloweenMode(on: boolean) {
  if (typeof window === "undefined") return;
  safeSetRawItem(HALLOWEEN_KEY, on ? "on" : "off");
  window.dispatchEvent(new Event(HALLOWEEN_EVENT));
}
