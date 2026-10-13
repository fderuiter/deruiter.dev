import { useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * Any touch-first device, phone or tablet, in either orientation. The
 * immersive touch cabinet latches on this query (ADR 0061). It matches the
 * device, not the window, so a desktop browser resized narrow keeps its fine
 * pointer and the desktop cabinet.
 */
export const TOUCH_DEVICE_QUERY = "(pointer: coarse)";

/**
 * Phones in either orientation, plus a touch device whose window is narrower
 * than 744px (ADR 0061). The width bound stops short of 744px so a full-screen
 * iPad mini in portrait is a tablet, while every iPad Split View pane of a
 * 1024px screen (507px, 678px) is a phone. A landscape phone is caught by its
 * short height. The gate (ADR 0048) and the rotate prompt use this query.
 */
export const PHONE_QUERY =
  "(pointer: coarse) and ((max-width: 743px) or (max-height: 500px))";

/**
 * Whether the device is touch-first at all, phone or tablet. SSR and the first
 * client render return false, so hydration matches the windowed cabinet.
 *
 * @returns True on any touch-first device.
 */
export function useTouchDevice(): boolean {
  return useMediaQuery(TOUCH_DEVICE_QUERY);
}

/**
 * Whether the device is a phone, or a touch device in a Split View pane too
 * narrow to be a tablet. Tablets return false, so they never get the rotate
 * prompt or the notice.
 *
 * @returns True on phones.
 */
export function usePhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}
