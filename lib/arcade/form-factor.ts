/**
 * Which of a game's three views a cabinet gets (#2354, ADR 0062): the view is
 * chosen by space first, then by pointer.
 *
 * - **Phone:** the short side is 500 px or less, or the width is under
 *   744 px, whatever the pointer. Phones in either orientation, iPad Split
 *   View panes (507 and 678 px) and narrow desktop windows.
 * - **Tablet:** otherwise, when the primary pointer is coarse.
 * - **Desktop:** otherwise.
 *
 * This file is pure, so the rules are unit tested without a browser.
 */

/** One of the three views a game ships. */
export type FormFactor = "phone" | "tablet" | "desktop";

/** Every form factor, in the order a picker lists them. */
export const FORM_FACTORS: readonly FormFactor[] = [
  "phone",
  "tablet",
  "desktop",
] as const;

/** What the classifier needs to know about the cabinet. */
export interface FormFactorInput {
  /** The cabinet viewport width, in CSS px. */
  readonly width: number;
  /** The cabinet viewport height, in CSS px. */
  readonly height: number;
  /** Whether the primary pointer is coarse (a finger or Pencil). */
  readonly coarse: boolean;
}

/** A short side at or under this is a phone. */
export const PHONE_MAX_SHORT_SIDE = 500;
/** A width under this is a phone (a full-screen iPad mini is 744 px wide). */
export const PHONE_MAX_WIDTH_EXCLUSIVE = 744;
/** How far past a breakpoint the size must go before the view swaps back. */
export const FORM_FACTOR_HYSTERESIS = 24;

function isPhoneSize(width: number, height: number, margin: number): boolean {
  const shortSide = Math.min(width, height);
  return (
    shortSide <= PHONE_MAX_SHORT_SIDE + margin ||
    width < PHONE_MAX_WIDTH_EXCLUSIVE + margin
  );
}

/**
 * Classify a cabinet viewport.
 *
 * With `previous`, the result keeps the previous view until the size is past
 * a breakpoint by `FORM_FACTOR_HYSTERESIS`, so a resize that wobbles on the
 * line does not swap views back and forth. Tablet and desktop differ only by
 * pointer, so there is no size margin between them.
 *
 * @param input - The cabinet viewport size and pointer.
 * @param previous - The view the cabinet shows now, if any.
 * @returns The view to show.
 */
export function classifyFormFactor(
  input: FormFactorInput,
  previous?: FormFactor
): FormFactor {
  const width = Math.max(0, input.width);
  const height = Math.max(0, input.height);
  // Leaving the phone view needs the size well clear of the line; entering it
  // from a larger view needs the size well inside it.
  let margin = 0;
  if (previous === "phone") margin = FORM_FACTOR_HYSTERESIS;
  else if (previous) margin = -FORM_FACTOR_HYSTERESIS;
  if (isPhoneSize(width, height, margin)) return "phone";
  return input.coarse ? "tablet" : "desktop";
}

/**
 * Read a `?view=` override from a URL search string. Anything other than a
 * form factor name is ignored.
 *
 * @param search - A `location.search` string, with or without the `?`.
 * @returns The forced view, or null.
 */
export function parseViewOverride(search: string): FormFactor | null {
  const value = new URLSearchParams(search).get("view");
  return value === "phone" || value === "tablet" || value === "desktop"
    ? value
    : null;
}
