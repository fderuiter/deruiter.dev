/** Shared, deterministic helpers for portfolio game logic. */

export * from "./arcade/utils";

/** Weight accepted by {@link gameFont}: a CSS numeric weight or keyword. */
export type GameFontWeight = number | "normal" | "bold";

/**
 * System monospace stack used after Geist Mono, and on its own where the
 * page's font variable cannot be read (a worker, the server, a test).
 */
export const GAME_FONT_FALLBACK_STACK =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

/** CSS custom property that next/font sets to the loaded Geist Mono family. */
export const GAME_FONT_VARIABLE = "--font-geist-mono";

let cachedFamily: string | null = null;
let lastEmptyRead = Number.NEGATIVE_INFINITY;
const EMPTY_RETRY_MS = 1000;

/**
 * Builds a canvas `font` shorthand from a size, weight and family list.
 * Pure, so the string format is testable without a DOM.
 *
 * @param size - Font size in CSS pixels; non-finite or non-positive sizes become 10.
 * @param weight - Numeric weight (clamped to 100 to 900) or a keyword.
 * @param family - Leading family list, such as the resolved Geist Mono family. Empty means the fallback stack alone.
 * @returns A string such as `700 12px "Geist Mono", ui-monospace, monospace`.
 */
export function buildGameFont(
  size: number,
  weight: GameFontWeight = 400,
  family = ""
): string {
  const safeSize = Number.isFinite(size) && size > 0 ? size : 10;
  const safeWeight =
    typeof weight === "number"
      ? Math.round(
          Math.min(900, Math.max(100, Number.isFinite(weight) ? weight : 400))
        )
      : weight;
  const lead = family.trim();
  const stack = lead
    ? `${lead}, ${GAME_FONT_FALLBACK_STACK}`
    : GAME_FONT_FALLBACK_STACK;
  return `${safeWeight} ${safeSize}px ${stack}`;
}

/**
 * Reads the loaded Geist Mono family from the page's `--font-geist-mono`
 * variable. Canvas `font` strings cannot use `var()`, so canvas text needs the
 * resolved family name. Returns an empty string outside a document.
 *
 * @returns The family list next/font registered, or an empty string.
 */
export function resolveGameFontFamily(): string {
  if (cachedFamily) return cachedFamily;
  if (typeof document === "undefined" || typeof getComputedStyle !== "function")
    return "";
  // Canvas games call this every frame. While the variable is still unset,
  // re-read it at most once a second rather than forcing a style recalc on
  // every text draw.
  const now = Date.now();
  if (now - lastEmptyRead < EMPTY_RETRY_MS) return "";
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(GAME_FONT_VARIABLE)
      .trim();
    if (value) cachedFamily = value;
    else lastEmptyRead = now;
    return value;
  } catch {
    lastEmptyRead = now;
    return "";
  }
}

/**
 * Canvas font for game text in the site's Geist Mono, so canvas and DOM text
 * match. Use it wherever a canvas game would otherwise write
 * `ctx.font = "bold 10px monospace"`.
 *
 * @example
 * ```ts
 * ctx.font = gameFont(10, 700);
 * ```
 *
 * @param size - Font size in CSS pixels.
 * @param weight - Numeric weight or `normal` / `bold`. Defaults to 400.
 * @returns A canvas `font` shorthand led by the loaded Geist Mono family.
 */
export function gameFont(size: number, weight: GameFontWeight = 400): string {
  return buildGameFont(size, weight, resolveGameFontFamily());
}
