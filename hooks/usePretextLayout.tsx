"use client";

import { useState, useLayoutEffect, useRef, useCallback } from "react";
import { useResizeObserver } from "./useResizeObserver";
import {
  prepare,
  layout,
  clearCache,
  type PreparedText,
} from "@chenglou/pretext";
import { resolveSingleThemeFont } from "@/lib/layout-config";
import { useTerminology } from "@/components/providers/TerminologyProvider";
import { useFontPreference } from "@/hooks/useFontPreference";
import {
  parsePretextBlocks,
  calculateBlockHeight,
  BLOCK_LAYOUT_CONFIG,
  type ExtendedRichInlineItem,
} from "@/lib/pretext-block-parser";

export { type ExtendedRichInlineItem };

import {
  isBrowser,
  isLayoutValidationEnabled,
  validateLayoutHeight,
  textPrepareCache,
  textLayoutCache,
  cssPropertyCache,
  fontConfigCache,
  isStylesheetLoaded,
} from "@/lib/graphics-engine";

export interface UsePretextLayoutOptions {
  text: string;
  fontSize?: number;
  lineHeight: number;
  fontFamilyVariable?: string;
  translationMode?: string;
  activeTheme?: string;
  getResponsiveMetrics?: (width: number) => {
    fontSize: number;
    lineHeight: number;
  };
}

export interface PretextLayoutState {
  isReady: boolean;
  height: number;
  lineCount: number;
}

export function usePretextLayout({
  text,
  fontSize = 16,
  lineHeight,
  fontFamilyVariable = "--font-atkinson",
  translationMode,
  activeTheme,
  getResponsiveMetrics,
}: UsePretextLayoutOptions) {
  const [state, setState] = useState<PretextLayoutState>({
    isReady: false,
    height: 0,
    lineCount: 0,
  });

  const { simplified } = useTerminology();
  const { fontMode } = useFontPreference();

  const preparedTextRef = useRef<PreparedText | null>(null);
  const fontStringRef = useRef<string>("");
  const resolvedFontRef = useRef<{
    fontSize: number;
    fontFamilyVariable: string;
    fontString: string;
  } | null>(null);
  const lastWidthRef = useRef<number>(-1);

  const measureText = useCallback(
    (maxWidth: number) => {
      if (!isBrowser() || maxWidth <= 0) return;

      let activeFontSize = fontSize;
      let activeLineHeight = lineHeight;

      if (getResponsiveMetrics) {
        const metrics = getResponsiveMetrics(maxWidth);
        activeFontSize = metrics.fontSize;
        activeLineHeight = metrics.lineHeight;
      }

      // Skip DOM query on resizing if previously resolved
      let fontString = "";
      if (
        resolvedFontRef.current &&
        resolvedFontRef.current.fontSize === activeFontSize &&
        resolvedFontRef.current.fontFamilyVariable === fontFamilyVariable
      ) {
        fontString = resolvedFontRef.current.fontString;
      } else {
        fontString = resolveSingleThemeFont(activeFontSize, fontFamilyVariable);
        resolvedFontRef.current = {
          fontSize: activeFontSize,
          fontFamilyVariable,
          fontString,
        };
      }
      fontStringRef.current = fontString;

      const flooredWidth = Math.floor(maxWidth);
      const blocks = parsePretextBlocks(text);
      const hasSpecialBlocks = blocks.some((b) => b.type !== "paragraph");

      if (hasSpecialBlocks) {
        let totalHeight = 0;
        let totalLines = 0;
        for (const b of blocks) {
          if (b.type === "paragraph") {
            const prepKey = `${b.raw}|${fontString}`;
            let prep = textPrepareCache.get(prepKey);
            if (!prep) {
              prep = prepare(b.raw, fontString);
              textPrepareCache.set(prepKey, prep);
            }
            const res = layout(prep, flooredWidth, activeLineHeight);
            totalHeight += res.height;
            totalLines += res.lineCount;
          } else {
            const blockH = calculateBlockHeight(
              b,
              flooredWidth,
              activeLineHeight
            );
            totalHeight += blockH;
            totalLines += b.lines.length;
          }
        }
        if (blocks.length > 1) {
          totalHeight +=
            (blocks.length - 1) * BLOCK_LAYOUT_CONFIG.PARAGRAPH_GAP;
        }

        setState((prev) => {
          if (prev.height === totalHeight && prev.lineCount === totalLines) {
            return prev;
          }
          return { isReady: true, height: totalHeight, lineCount: totalLines };
        });
        return;
      }

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
      preparedTextRef.current = prepared;

      const cacheKey = `${text}|${fontString}|${flooredWidth}|${activeLineHeight}`;
      let result = stylesheetLoaded ? textLayoutCache.get(cacheKey) : undefined;

      if (!result) {
        result = layout(prepared, flooredWidth, activeLineHeight);
        if (stylesheetLoaded) {
          textLayoutCache.set(cacheKey, result);
        }
      }

      setState((prev) => {
        if (
          prev.height === result.height &&
          prev.lineCount === result.lineCount
        ) {
          return prev;
        }
        return {
          isReady: true,
          height: result.height,
          lineCount: result.lineCount,
        };
      });
    },
    [text, fontSize, lineHeight, fontFamilyVariable, getResponsiveMetrics]
  );

  const containerRef = useResizeObserver<HTMLDivElement>((entry) => {
    const maxWidth = Math.floor(entry.contentRect.width);
    if (maxWidth > 0 && maxWidth !== lastWidthRef.current) {
      lastWidthRef.current = maxWidth;
      measureText(maxWidth);
    }
  });

  useLayoutEffect(() => {
    resolvedFontRef.current = null;
    cssPropertyCache.clear();
    fontConfigCache.clear();
    textPrepareCache.clear();
    textLayoutCache.clear();
    clearCache();
  }, [simplified, translationMode, activeTheme, fontMode]);

  useLayoutEffect(() => {
    if (!isBrowser()) return;

    if (lastWidthRef.current > 0) {
      measureText(lastWidthRef.current);
    } else {
      let fontString = "";
      if (
        resolvedFontRef.current &&
        resolvedFontRef.current.fontSize === fontSize &&
        resolvedFontRef.current.fontFamilyVariable === fontFamilyVariable
      ) {
        fontString = resolvedFontRef.current.fontString;
      } else {
        fontString = resolveSingleThemeFont(fontSize, fontFamilyVariable);
        resolvedFontRef.current = {
          fontSize,
          fontFamilyVariable,
          fontString,
        };
      }
      fontStringRef.current = fontString;
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
      preparedTextRef.current = prepared;
      // With a mounted container, stay not-ready until the ResizeObserver
      // reports a width; marking ready now would publish a zero height.
      if (!containerRef.current) {
        setState((prev) => (prev.isReady ? prev : { ...prev, isReady: true }));
      }
    }
  }, [
    text,
    fontSize,
    fontFamilyVariable,
    measureText,
    containerRef,
    translationMode,
    activeTheme,
    simplified,
    fontMode,
  ]);

  // Removed custom ResizeObserver in favor of unified useResizeObserver hook

  // Layout Height Validation Trigger
  useLayoutEffect(() => {
    // The getBoundingClientRect read below forces a synchronous layout flush
    // immediately after this hook has changed the container height, which is
    // exactly the hydration-time layout thrash #817 tracked. The result only
    // feeds a development-time drift warning, so production skips the
    // measurement entirely rather than measuring and discarding it.
    if (!isLayoutValidationEnabled()) return;
    if (state.isReady && containerRef.current) {
      const actualHeight = containerRef.current.getBoundingClientRect().height;
      validateLayoutHeight(
        state.height,
        actualHeight,
        `usePretextLayout (text: "${text.slice(0, 30)}...")`
      );
    }
  }, [state.isReady, state.height, text, containerRef]);

  return {
    ref: containerRef,
    ...state,
  };
}
