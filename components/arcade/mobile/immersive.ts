import { useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * The device test for the immersive touch cabinet: a coarse pointer in a
 * viewport narrower than 1024px. It matches the device, not the window, so a
 * desktop browser resized narrow keeps its fine pointer and the desktop
 * cabinet. ADR 0061 uses the same rule as the gate in ADR 0048.
 */
export const TOUCH_NARROW_QUERY = "(pointer: coarse) and (max-width: 1023px)";

/**
 * Whether the device is a touch device narrower than the desktop breakpoint.
 * SSR and the first client render return false, so hydration matches the
 * windowed cabinet and the immersive layout arrives after mount.
 *
 * @returns True on phones and portrait tablets.
 */
export function useTouchNarrow(): boolean {
  return useMediaQuery(TOUCH_NARROW_QUERY);
}
