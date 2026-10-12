import { useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * The orientation a game is designed for. `either` means the game plays in
 * both and never asks the player to turn the device.
 */
export type MobileOrientation = "portrait" | "landscape" | "either";

/** A concrete orientation a game can declare, without `either`. */
export type LockedOrientation = Exclude<MobileOrientation, "either">;

/**
 * Whether the device is held against the game's declared orientation.
 *
 * @param target - The orientation the game declares.
 * @returns True when the device must be turned. Always false for `either`.
 */
export function useOrientationMismatch(target: MobileOrientation): boolean {
  const isPortrait = useMediaQuery("(orientation: portrait)");
  if (target === "either") return false;
  return target === "landscape" ? isPortrait : !isPortrait;
}

/**
 * Asks the platform to hold the screen in an orientation. Only meaningful
 * while a real Fullscreen request is active; the browser rejects it otherwise.
 * Rejections and missing support are ignored, so a game never depends on the
 * lock. Call the returned function to release it.
 *
 * @param target - The orientation to lock.
 * @returns A function that releases the lock.
 */
export function lockScreenOrientation(target: LockedOrientation): () => void {
  if (typeof screen === "undefined") return () => {};
  const orientation = screen.orientation;
  if (!orientation || typeof orientation.lock !== "function") return () => {};
  try {
    orientation.lock(target).catch(() => {});
  } catch {
    // Unsupported here; the rotate prompt still covers the player.
  }
  return () => {
    try {
      orientation.unlock?.();
    } catch {
      // Nothing to release.
    }
  };
}
