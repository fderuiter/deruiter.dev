"use client";

import { useCallback, useState } from "react";

/** The tallest the touch cabinet scales a hand card: 1.9 times. */
const MAX_CARD_SCALE = 1.9;
/** A card is 15rem tall; the rest of the hand area (padding, the action row,
 * a note line) takes about this many px. */
const HAND_CHROME_PX = 230;
const CARD_PX = 240;

/**
 * How much the touch cabinet scales the hand's cards for a hand area
 * `height` px tall (#2120). A short area keeps the desktop card; a tall one
 * (an iPad Pro held upright) grows the cards so the hand fills the table
 * instead of leaving an empty band. Rounded to 0.05 so a resize does not
 * re-render for a pixel. An unmeasured area (0) never scales.
 *
 * @param height - The hand area height in px.
 * @returns A scale between 1 and 1.9.
 */
export function cardScaleFor(height: number): number {
  const fits = (height - HAND_CHROME_PX) / CARD_PX;
  if (!(fits > 1)) return 1;
  return Math.round(Math.min(MAX_CARD_SCALE, fits) * 20) / 20;
}

/** A touch card's width in rem before it scales (te-touch.css agrees). */
export const TOUCH_CARD_REM = 8.5;
/** Hands the touch cabinet sizes a card's width for, so it holds steady. */
const FULL_HAND = 8;
/** The narrowest a card narrows to (a Split View pane): 4.7rem, so each
 * overlapped sliver stays a 44px target at 8 cards. */
const MIN_WIDTH_SCALE = 0.55;

/**
 * The card width scale: the height scale, held back so a full hand still
 * overlaps into the row (each card keeps half its width less half a rem
 * showing at most). A narrow row narrows the card, down to 0.55; it is 1
 * until the row is measured.
 *
 * @param scale - The height scale from {@link cardScaleFor}.
 * @param rowRem - The hand row's width in rem, 0 when unmeasured.
 * @returns A scale between 0.55 and `scale`.
 */
export function cardWidthScaleFor(scale: number, rowRem: number): number {
  if (rowRem <= 0) return 1;
  const widest = (rowRem - 0.5 * (FULL_HAND - 1)) / (1 + (FULL_HAND - 1) / 2);
  const fit = Math.floor((widest / TOUCH_CARD_REM) * 20) / 20;
  const capped = Math.min(scale, fit);
  return Math.max(MIN_WIDTH_SCALE, capped);
}

/**
 * The height of the hand area, when the cabinet fits the table to the stage,
 * as a callback ref. The area's row is `1fr`, so the cards it holds never
 * change it and the scale cannot feed back on itself. Only height is read
 * here; the hand's own width observer is separate (AGENTS.md section 16).
 *
 * @returns The hand area height (0 when unknown) and the ref to attach.
 */
export function useHandAreaHeight() {
  const [height, setHeight] = useState(0);
  const ref = useCallback((element: HTMLElement | null) => {
    if (!element || typeof ResizeObserver === "undefined") return;
    const cabinet = element.closest("[data-mobile-layout]");
    if (cabinet?.getAttribute("data-mobile-layout") !== "fit") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(Math.floor(entry.contentRect.height));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [height, ref] as const;
}
