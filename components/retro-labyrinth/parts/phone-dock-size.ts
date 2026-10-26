"use client";

import type { DockSize } from "@/components/arcade/mobile/docks";
import { useDeviceSettings } from "@/lib/arcade";
import { useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * The narrowest phone window each key size fits (#2919): the d-pad and the
 * action cluster are three keys wide each, and the maze keeps at least half
 * the width between them. A narrower phone in landscape steps the keys
 * down, to the 44px floor at the smallest.
 */
const PHONE_DOCK_MIN_WIDTH = { md: 720, lg: 816 } as const;

/**
 * The phone docks' key size: this device's setting, shared with the
 * cabinet's Setup sheet and every other game (#2924), stepped down while a
 * landscape phone is too narrow for it. A phone held upright shows the
 * rotate prompt, not the maze, so its keys keep the chosen size.
 */
export function useDockSizeForPhone(): DockSize {
  const { dockSize: chosen } = useDeviceSettings();
  const portrait = useMediaQuery("(orientation: portrait)");
  const roomForMd = useMediaQuery(`(min-width: ${PHONE_DOCK_MIN_WIDTH.md}px)`);
  const roomForLg = useMediaQuery(`(min-width: ${PHONE_DOCK_MIN_WIDTH.lg}px)`);
  let size: DockSize = chosen;
  if (!portrait) {
    if (size === "lg" && !roomForLg) size = "md";
    if (size === "md" && !roomForMd) size = "sm";
  }
  return size;
}
