import { designManifest } from "./design-manifest";
import { logger } from "@/lib/logger";
import { prepare, layout, type PreparedText } from "@chenglou/pretext";
import {
  type PreparedRichInline,
  type RichInlineLine,
} from "@chenglou/pretext/rich-inline";
import { LRUCache, toCanvasFontFamily } from "./graphics-math";

export * from "./graphics-math";

// --- Global Caches ---
export const textPrepareCache = new LRUCache<string, PreparedText>(500);
export const textLayoutCache = new LRUCache<
  string,
  { height: number; lineCount: number }
>(2000);

export const richItemsCache = new LRUCache<string, unknown[]>(500);
export const richPrepareCache = new LRUCache<string, PreparedRichInline>(500);
export const richLayoutCache = new LRUCache<
  string,
  { height: number; lines: RichInlineLine[] }
>(2000);

// Bounded style and font caches with strict capacity limits to avoid memory growth
export const cssPropertyCache = new LRUCache<string, string>(100);
export const fontConfigCache = new LRUCache<string, unknown>(100);

let lastResizeTime = 0;
if (typeof window !== "undefined") {
  window.addEventListener("resize", () => {
    lastResizeTime = Date.now();
  });
}

let stylesheetLoadedCache = false;

/**
 * Checks for the presence of key custom properties defined under the root style
 * configuration to verify if the stylesheet has loaded.
 */
export function isStylesheetLoaded(rootStyle?: CSSStyleDeclaration): boolean {
  if (!isBrowser()) {
    return false;
  }
  if (
    typeof (
      globalThis as typeof globalThis & { __mockStylesheetLoaded?: boolean }
    ).__mockStylesheetLoaded !== "undefined"
  ) {
    return !!(
      globalThis as typeof globalThis & { __mockStylesheetLoaded?: boolean }
    ).__mockStylesheetLoaded;
  }
  if (stylesheetLoadedCache) {
    return true;
  }
  try {
    const style =
      rootStyle || window.getComputedStyle(document.documentElement);
    const gap = style.getPropertyValue("--layout-gap").trim();
    const brandCyan = style.getPropertyValue("--brand-cyan").trim();
    const fontSizeSm = style.getPropertyValue("--font-size-sm").trim();
    const isLoaded = gap !== "" || brandCyan !== "" || fontSizeSm !== "";
    if (isLoaded) {
      stylesheetLoadedCache = true;
    }
    return isLoaded;
  } catch {
    return false;
  }
}

/**
 * Resets the cached stylesheet loaded flag. Primarily used for unit testing.
 */
export function resetStylesheetLoadedCache(): void {
  stylesheetLoadedCache = false;
}

/**
 * Resolves styled inline code chip extra width dynamically using Computed Style.
 * Returns fallback if run in SSR or if stylesheet has not loaded yet.
 */
export function resolveCodeChipExtraWidth(): number {
  if (!isBrowser()) {
    return 12; // Fallback for SSR
  }

  // Intercept with cache lookups FIRST before stylesheetLoaded checks
  const cacheKey = "code-chip-extra-width";
  const cached = cssPropertyCache.get(cacheKey);
  if (cached !== undefined) {
    return Number(cached);
  }

  if (!isStylesheetLoaded()) {
    return 12; // Return default fallback during unready stylesheet states without cache write
  }

  try {
    const dummy = document.createElement("span");
    dummy.className = "px-1.5 py-0 mx-0.5 border inline-block font-mono";
    dummy.style.position = "absolute";
    dummy.style.visibility = "hidden";
    document.body.appendChild(dummy);

    const style = window.getComputedStyle(dummy);
    const paddingLeft = parseFloat(style.paddingLeft || "0");
    const paddingRight = parseFloat(style.paddingRight || "0");
    const borderLeftWidth = parseFloat(style.borderLeftWidth || "0");
    const borderRightWidth = parseFloat(style.borderRightWidth || "0");
    const marginLeft = parseFloat(style.marginLeft || "0");
    const marginRight = parseFloat(style.marginRight || "0");

    const totalExtraWidth =
      paddingLeft +
      paddingRight +
      borderLeftWidth +
      borderRightWidth +
      marginLeft +
      marginRight;

    document.body.removeChild(dummy);

    const result = totalExtraWidth > 0 ? totalExtraWidth : 12;
    cssPropertyCache.set(cacheKey, String(result));
    return result;
  } catch (err) {
    logger.error("Failed resolving code chip extra width:", err);
    return 12; // Fallback
  }
}

// --- Environment and CSS resolution helpers ---

/**
 * Safe browser environment check to prevent SSR failures.
 */
export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Resolves font family variable dynamically using Computed Style.
 * Returns designManifest sans-serif fallback if run in SSR, unready stylesheet states, or variables are missing.
 */
export function resolveFontFamily(
  variableName: string = "--font-atkinson"
): string {
  const getFallback = (varName: string) =>
    toCanvasFontFamily(
      getFallbackList(varName),
      varName === "--font-mono" || varName === "--font-geist-mono"
        ? "monospace"
        : "sans-serif"
    );
  const getFallbackList = (varName: string) => {
    if (varName === "--font-heading" || varName === "--font-lexend") {
      return (
        (designManifest.typography.fonts as Record<string, string>).heading ||
        "var(--font-lexend), system-ui, -apple-system, sans-serif"
      );
    }
    if (varName === "--font-mono" || varName === "--font-geist-mono") {
      return designManifest.typography.fonts.mono;
    }
    return designManifest.typography.fonts.sans;
  };

  if (!isBrowser()) {
    return getFallback(variableName);
  }

  // Intercept repeated queries with the bounded cache FIRST
  const cached = cssPropertyCache.get(variableName);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const rootStyle = window.getComputedStyle(document.documentElement);
    if (!isStylesheetLoaded(rootStyle)) {
      return getFallback(variableName);
    }
    const rawFontFamily = rootStyle.getPropertyValue(variableName).trim();
    const resolved = rawFontFamily
      ? toCanvasFontFamily(rawFontFamily, getFallback(variableName))
      : getFallback(variableName);
    cssPropertyCache.set(variableName, resolved);
    return resolved;
  } catch {
    return getFallback(variableName);
  }
}

// --- Text Measurement Services ---

/**
 * Offscreen text measurement utilizing Pretext layout calculations.
 * SSR-safe fallback mechanism returns height 0 if running on server.
 */
export function measureTextOffscreen({
  text,
  fontSize,
  lineHeight,
  fontFamilyVariable = "--font-inter",
  maxWidth,
}: {
  text: string;
  fontSize: number;
  lineHeight: number;
  fontFamilyVariable?: string;
  maxWidth: number;
}): { height: number; lineCount: number } {
  if (!isBrowser()) {
    return { height: 0, lineCount: 0 };
  }

  const fontFamily = resolveFontFamily(fontFamilyVariable);
  const fontString = `${fontSize}px ${fontFamily}`;

  const prepareKey = `${text}|${fontString}`;
  const stylesheetLoaded = isStylesheetLoaded();
  let prepared = stylesheetLoaded
    ? textPrepareCache.get(prepareKey)
    : undefined;
  if (!prepared) {
    prepared = prepare(text, fontString);
    if (stylesheetLoaded) {
      textPrepareCache.set(prepareKey, prepared);
    }
  }

  const flooredWidth = Math.floor(maxWidth);
  const cacheKey = `${text}|${fontString}|${flooredWidth}|${lineHeight}`;
  let result = stylesheetLoaded ? textLayoutCache.get(cacheKey) : undefined;
  if (!result) {
    result = layout(prepared, flooredWidth, lineHeight);
    if (stylesheetLoaded) {
      textLayoutCache.set(cacheKey, result);
    }
  }

  return result;
}

import { getEnv } from "./env";

/**
 * Reports whether layout-drift validation is active for the current
 * environment.
 *
 * Callers must consult this before measuring the DOM for
 * `validateLayoutHeight`. The measurement itself is a synchronous
 * `getBoundingClientRect` read issued from a layout effect that has just
 * mutated height, which forces the browser to flush layout and blocks the
 * main thread during hydration. Because the validation is diagnostic only,
 * production must never pay that cost (#817).
 */
export function isLayoutValidationEnabled(): boolean {
  return getEnv().NODE_ENV !== "production";
}

/**
 * Expose a layout validation utility that warns in non-production environments
 * when calculated layout height and actual physical DOM measurement differs by more than 2px.
 */
export function validateLayoutHeight(
  calculated: number,
  actual: number,
  contextMessage?: string
) {
  if (isLayoutValidationEnabled()) {
    if (actual === 0) {
      return;
    }
    if (Date.now() - lastResizeTime < 150) {
      return;
    }
    const deviation = Math.abs(calculated - actual);
    if (deviation > 2) {
      logger.warn(
        `[Layout Validation Warning] Layout drift detected! Calculated height is ${calculated}px, but actual DOM height is ${actual}px (deviation: ${deviation.toFixed(2)}px). ${contextMessage || ""}`
      );
    }
  }
}
