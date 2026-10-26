/**
 * Triggers physical haptic vibration feedback with graceful degradation
 * for devices or browsers that do not support navigator.vibrate.
 * 
 * @param pattern Single duration in ms or pattern array of durations
 */
export const triggerHaptic = (pattern: number | number[] = 15): void => {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore if not permitted or unsupported by device policy
    }
  }
};

/**
 * Whether this browser can vibrate at all, so a setting can say so instead
 * of offering a switch that does nothing.
 *
 * @returns True when `navigator.vibrate` exists.
 */
export const canVibrate = (): boolean =>
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
