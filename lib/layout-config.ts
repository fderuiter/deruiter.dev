import { designManifest } from "@/lib/design-manifest";
import {
  cssPropertyCache,
  fontConfigCache,
  isStylesheetLoaded,
} from "@/lib/graphics-engine";

export const LAYOUT_CONFIG = {
  // Height offsets used for fallback and SSR
  FALLBACK_ITEM_HEIGHT: 250,

  // We can pull these from designManifest for consistency but centralize their usage here
  PADDING_WITH_STATS: designManifest.masonry.paddingWithStats,
  PADDING_WITHOUT_STATS: designManifest.masonry.paddingWithoutStats,
  // Mobile cards omit one desktop spacing row in their single-column shell.
  MOBILE_PADDING_ADJUSTMENT: 22,

  GAP: designManifest.layout.gap,
  CARD_PADDING: designManifest.layout.cardPadding,

  // Typography dimensions for layout calculations
  FONT_SIZE: designManifest.typography.sizes.sm.fontSize,
  LINE_HEIGHT: designManifest.typography.sizes.sm.lineHeight,

  // Column counts based on breakpoints
  BREAKPOINTS: {
    LG: designManifest.breakpoints.lg,
    MD: designManifest.breakpoints.md,
  },
  COLS: {
    LG: 3,
    MD: 2,
    SM: 1,
  },
} as const;

export interface ThemeFonts {
  baseFont: string;
  boldFont: string;
  italicFont: string;
  codeFont: string;
}

function resolveFallbackFont(fontFamilyVariable: string): string {
  if (
    fontFamilyVariable === "--font-heading" ||
    fontFamilyVariable === "--font-lexend"
  ) {
    return (
      (designManifest.typography.fonts as Record<string, string>).heading ||
      "var(--font-lexend), system-ui, -apple-system, sans-serif"
    );
  }
  if (
    fontFamilyVariable === "--font-mono" ||
    fontFamilyVariable === "--font-geist-mono"
  ) {
    return designManifest.typography.fonts.mono;
  }
  return designManifest.typography.fonts.sans;
}

/* jscpd:ignore-start */
export function resolveThemeFonts(
  fontSize: number,
  fontFamilyVariable: string = "--font-atkinson"
): ThemeFonts {
  const cacheKey = `themeFonts|${fontSize}|${fontFamilyVariable}`;
  const cached = fontConfigCache.get(cacheKey);
  if (cached) {
    return cached as ThemeFonts;
  }

  let resolvedFontFamily = cssPropertyCache.get(fontFamilyVariable);
  let resolvedMonoFamily = cssPropertyCache.get("--font-mono");

  if (resolvedFontFamily && resolvedMonoFamily) {
    const result = {
      baseFont: `400 ${fontSize}px ${resolvedFontFamily}`,
      boldFont: `700 ${fontSize}px ${resolvedFontFamily}`,
      italicFont: `italic 400 ${fontSize}px ${resolvedFontFamily}`,
      codeFont: `500 ${fontSize - 1}px ${resolvedMonoFamily}`,
    };
    fontConfigCache.set(cacheKey, result);
    return result;
  }

  if (typeof window === "undefined") {
    const fallbackSans = resolveFallbackFont(fontFamilyVariable);
    const fallbackMono = designManifest.typography.fonts.mono;
    return {
      baseFont: `400 ${fontSize}px ${fallbackSans}`,
      boldFont: `700 ${fontSize}px ${fallbackSans}`,
      italicFont: `italic 400 ${fontSize}px ${fallbackSans}`,
      codeFont: `500 ${fontSize - 1}px ${fallbackMono}`,
    };
  }

  try {
    const rootStyle = window.getComputedStyle(document.documentElement);
    if (!isStylesheetLoaded(rootStyle)) {
      const fallbackSans = resolveFallbackFont(fontFamilyVariable);
      const fallbackMono = designManifest.typography.fonts.mono;
      return {
        baseFont: `400 ${fontSize}px ${fallbackSans}`,
        boldFont: `700 ${fontSize}px ${fallbackSans}`,
        italicFont: `italic 400 ${fontSize}px ${fallbackSans}`,
        codeFont: `500 ${fontSize - 1}px ${fallbackMono}`,
      };
    }

    if (!resolvedFontFamily) {
      const rawFontFamily = rootStyle
        .getPropertyValue(fontFamilyVariable)
        .trim();
      resolvedFontFamily =
        rawFontFamily || resolveFallbackFont(fontFamilyVariable);
      cssPropertyCache.set(fontFamilyVariable, resolvedFontFamily);
    }

    if (!resolvedMonoFamily) {
      const rawMonoFamily =
        rootStyle.getPropertyValue("--font-mono").trim() ||
        rootStyle.getPropertyValue("--font-geist-mono").trim();
      resolvedMonoFamily =
        rawMonoFamily || designManifest.typography.fonts.mono;
      cssPropertyCache.set("--font-mono", resolvedMonoFamily);
    }

    const result = {
      baseFont: `400 ${fontSize}px ${resolvedFontFamily}`,
      boldFont: `700 ${fontSize}px ${resolvedFontFamily}`,
      italicFont: `italic 400 ${fontSize}px ${resolvedFontFamily}`,
      codeFont: `500 ${fontSize - 1}px ${resolvedMonoFamily}`,
    };
    fontConfigCache.set(cacheKey, result);
    return result;
  } catch {
    const fallbackSans = resolveFallbackFont(fontFamilyVariable);
    const fallbackMono = designManifest.typography.fonts.mono;
    return {
      baseFont: `400 ${fontSize}px ${fallbackSans}`,
      boldFont: `700 ${fontSize}px ${fallbackSans}`,
      italicFont: `italic 400 ${fontSize}px ${fallbackSans}`,
      codeFont: `500 ${fontSize - 1}px ${fallbackMono}`,
    };
  }
}

export function resolveSingleThemeFont(
  fontSize: number,
  fontFamilyVariable: string = "--font-atkinson"
): string {
  const cacheKey = `singleThemeFont|${fontSize}|${fontFamilyVariable}`;
  const cached = fontConfigCache.get(cacheKey);
  if (cached) {
    return cached as string;
  }
/* jscpd:ignore-end */

  let resolvedFontFamily = cssPropertyCache.get(fontFamilyVariable);
  if (resolvedFontFamily) {
    const result = `${fontSize}px ${resolvedFontFamily}`;
    fontConfigCache.set(cacheKey, result);
    return result;
  }

  if (typeof window === "undefined") {
    const fallbackSans = resolveFallbackFont(fontFamilyVariable);
    return `${fontSize}px ${fallbackSans}`;
  }

  try {
    const rootStyle = window.getComputedStyle(document.documentElement);
    if (!isStylesheetLoaded(rootStyle)) {
      const fallbackSans = resolveFallbackFont(fontFamilyVariable);
      return `${fontSize}px ${fallbackSans}`;
    }

    const rawFontFamily = rootStyle.getPropertyValue(fontFamilyVariable).trim();
    resolvedFontFamily =
      rawFontFamily || resolveFallbackFont(fontFamilyVariable);
    cssPropertyCache.set(fontFamilyVariable, resolvedFontFamily);

    const result = `${fontSize}px ${resolvedFontFamily}`;
    fontConfigCache.set(cacheKey, result);
    return result;
  } catch {
    const fallbackSans = resolveFallbackFont(fontFamilyVariable);
    return `${fontSize}px ${fallbackSans}`;
  }
}
