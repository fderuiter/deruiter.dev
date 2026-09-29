"use client";

import React, { useState, useLayoutEffect, useRef, useCallback } from "react";
import { useResizeObserver } from "./useResizeObserver";
import {
  prepare,
  layout,
  clearCache,
  type PreparedText,
} from "@chenglou/pretext";
import {
  prepareRichInline,
  walkRichInlineLineRanges,
  materializeRichInlineLineRange,
  type PreparedRichInline,
  type RichInlineLine,
  type RichInlineLineRange,
} from "@chenglou/pretext/rich-inline";
import { designManifest } from "@/lib/design-manifest";
import {
  resolveThemeFonts,
  resolveSingleThemeFont,
  type ThemeFonts,
} from "@/lib/layout-config";
import { useTerminology } from "@/components/providers/TerminologyProvider";
import { useFontPreference } from "@/hooks/useFontPreference";
import {
  parsePretextBlocks,
  calculateBlockHeight,
  BLOCK_LAYOUT_CONFIG,
  preparePretextBlocks,
  parseMarkdownToRichItems,
  type ExtendedRichInlineItem,
  type StructuredBlock,
  type PreparedBlock,
  type StructuredBlockType,
} from "@/lib/pretext-block-parser";

export { parseMarkdownToRichItems, type ExtendedRichInlineItem };

import {
  isBrowser,
  isLayoutValidationEnabled,
  validateLayoutHeight,
  textPrepareCache,
  textLayoutCache,
  richItemsCache,
  richPrepareCache,
  richLayoutCache,
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

/* jscpd:ignore-start */
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
    richItemsCache.clear();
    richPrepareCache.clear();
    richLayoutCache.clear();
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
/* jscpd:ignore-end */
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

// Export global lifecycle helpers and rich-inline utilities
export { clearCache, prepareRichInline };

export interface PretextTextProps {
  text: string;
  fontSize?: number;
  lineHeight: number;
  fontFamilyVariable?: string;
  translationMode?: string;
  activeTheme?: string;
  semanticTag?:
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6"
    | "p"
    | "span"
    | "div"
    | "article"
    | "section";
  className?: string;
  children?: React.ReactNode;
}

export const PretextText: React.FC<PretextTextProps> = ({
  text,
  fontSize = 16,
  lineHeight,
  fontFamilyVariable = "--font-atkinson",
  translationMode,
  activeTheme,
  semanticTag = "p",
  className,
  children,
}) => {
  const { ref, height, isReady } = usePretextLayout({
    text,
    fontSize,
    lineHeight,
    fontFamilyVariable,
    translationMode,
    activeTheme,
  });

  const SemanticElement = semanticTag;

  return (
    <div
      className="relative"
      style={{
        height: isReady ? `${height}px` : "auto",
      }}
    >
      {/* 1. Custom Visual Presentation (hidden from screen readers, not selectable) */}
      <div
        ref={ref}
        aria-hidden="true"
        role="presentation"
        data-pretext-layer="visual"
        className={`${className || ""} select-none pointer-events-none`}
      >
        {children || text}
      </div>

      {/* 2. Transparent Standard Semantic Overlay (selectable, readable by screen readers) */}
      <SemanticElement
        data-pretext-layer="semantic"
        className={`${className || ""} absolute inset-0 select-text bg-transparent`}
        style={{
          color: "transparent",
          WebkitTextFillColor: "transparent",
          pointerEvents: "auto",
          margin: 0,
          padding: 0,
        }}
      >
        {text}
      </SemanticElement>
    </div>
  );
};

// ==========================================
// PRETEXT RICH INLINE TEXT ENGINE (ISSUE #45)
// ==========================================

interface ParagraphData {
  items: ExtendedRichInlineItem[];
  prepared: PreparedRichInline | null;
  isEmpty: boolean;
  itemOffset: number;
}

export interface UsePretextRichLayoutOptions {
  text: string;
  fontSize?: number;
  lineHeight: number;
  fontFamilyVariable?: string;
  translationMode?: string;
  activeTheme?: string;
}

/* jscpd:ignore-start */
export function usePretextRichLayout({
  text,
  fontSize = designManifest.typography.sizes.sm.fontSize,
  lineHeight,
  fontFamilyVariable = "--font-atkinson",
  translationMode,
  activeTheme,
}: UsePretextRichLayoutOptions) {
  const [state, setState] = useState<{
    isReady: boolean;
    height: number;
    lines: RichInlineLine[];
    items: ExtendedRichInlineItem[];
  }>({
    isReady: false,
    height: 0,
    lines: [],
    items: [],
  });

  const { simplified } = useTerminology();
  const { fontMode } = useFontPreference();

  const paragraphsRef = useRef<ParagraphData[]>([]);
  const itemsRef = useRef<ExtendedRichInlineItem[]>([]);
  const itemsKeyRef = useRef<string>("");
  const resolvedFontsRef = useRef<{
    fontSize: number;
    fontFamilyVariable: string;
    fonts: ThemeFonts;
  } | null>(null);
  const lastWidthRef = useRef<number>(-1);

  const measureRichText = useCallback(
    (maxWidth: number) => {
      if (paragraphsRef.current.length === 0 || !itemsKeyRef.current) return;

      const flooredWidth = Math.floor(maxWidth);
      const layoutKey = `${itemsKeyRef.current}|${flooredWidth}|${lineHeight}`;
      const stylesheetLoaded = isStylesheetLoaded();
      let cachedResult = stylesheetLoaded
        ? richLayoutCache.get(layoutKey)
        : undefined;

      if (!cachedResult) {
        const materializedLines: RichInlineLine[] = [];
        paragraphsRef.current.forEach((paragraph) => {
          if (paragraph.isEmpty) {
            materializedLines.push({
              fragments: [],
              width: 0,
              end: 0 as unknown as RichInlineLine["end"],
            });
          } else if (paragraph.prepared) {
            const linesRanges: RichInlineLineRange[] = [];
            walkRichInlineLineRanges(
              paragraph.prepared,
              flooredWidth,
              (range) => {
                linesRanges.push(range);
              }
            );

            const paragraphLines = linesRanges.map((range) => {
              const line = materializeRichInlineLineRange(
                paragraph.prepared!,
                range
              );
              const adjustedFragments = line.fragments.map((frag) => ({
                ...frag,
                itemIndex: frag.itemIndex + paragraph.itemOffset,
              }));
              return {
                ...line,
                fragments: adjustedFragments,
              };
            });

            materializedLines.push(...paragraphLines);
          }
        });

        cachedResult = {
          height: materializedLines.length * lineHeight,
          lines: materializedLines,
        };
        if (stylesheetLoaded) {
          richLayoutCache.set(layoutKey, cachedResult);
        }
      }

      const { height: calculatedHeight, lines: materializedLines } =
        cachedResult;

      setState((prev) => {
        if (
          prev.height === calculatedHeight &&
          prev.lines.length === materializedLines.length
        ) {
          return prev;
        }
        return {
          isReady: true,
          height: calculatedHeight,
          lines: materializedLines,
          items: itemsRef.current,
        };
      });
    },
    [lineHeight]
  );

  const containerRef = useResizeObserver<HTMLDivElement>((entry) => {
    const maxWidth = Math.floor(entry.contentRect.width);
    if (maxWidth > 0 && maxWidth !== lastWidthRef.current) {
      lastWidthRef.current = maxWidth;
      measureRichText(maxWidth);
    }
  });

  useLayoutEffect(() => {
    resolvedFontsRef.current = null;
    cssPropertyCache.clear();
    fontConfigCache.clear();
    textPrepareCache.clear();
    textLayoutCache.clear();
    richItemsCache.clear();
    richPrepareCache.clear();
    richLayoutCache.clear();
    clearCache();
  }, [simplified, translationMode, activeTheme, fontMode]);

  useLayoutEffect(() => {
    if (!isBrowser()) return;

    let fonts: ThemeFonts;
    if (
      resolvedFontsRef.current &&
      resolvedFontsRef.current.fontSize === fontSize &&
      resolvedFontsRef.current.fontFamilyVariable === fontFamilyVariable
    ) {
      fonts = resolvedFontsRef.current.fonts;
    } else {
      fonts = resolveThemeFonts(fontSize, fontFamilyVariable);
      resolvedFontsRef.current = {
        fontSize,
        fontFamilyVariable,
        fonts,
      };
/* jscpd:ignore-end */
    }
    const { baseFont, boldFont, italicFont, codeFont } = fonts;

    const fontsKey = `${baseFont}|${boldFont}|${italicFont}|${codeFont}`;
    const itemsKey = `${text}|${fontsKey}`;
    itemsKeyRef.current = itemsKey;

    const stylesheetLoaded = isStylesheetLoaded();
    let parsedParagraphs = stylesheetLoaded
      ? (richItemsCache.get(itemsKey) as ParagraphData[] | undefined)
      : undefined;
    if (!parsedParagraphs) {
      let accumulatedItemOffset = 0;
      const paragraphs = text.split("\n");
      parsedParagraphs = paragraphs.map((paragraphStr) => {
        if (paragraphStr === "") {
          return {
            items: [],
            prepared: null,
            isEmpty: true,
            itemOffset: accumulatedItemOffset,
          };
        }
        const items = parseMarkdownToRichItems(
          paragraphStr,
          baseFont,
          boldFont,
          italicFont,
          codeFont
        );
        const prepared = prepareRichInline(items);
        const res = {
          items,
          prepared,
          isEmpty: false,
          itemOffset: accumulatedItemOffset,
        };
        accumulatedItemOffset += items.length;
        return res;
      });
      if (stylesheetLoaded) {
        richItemsCache.set(itemsKey, parsedParagraphs);
      }
    }
    paragraphsRef.current = parsedParagraphs;

    const allItems: ExtendedRichInlineItem[] = [];
    parsedParagraphs.forEach((p) => {
      allItems.push(...p.items);
    });
    itemsRef.current = allItems;

    if (lastWidthRef.current > 0) {
      measureRichText(lastWidthRef.current);
    } else if (!containerRef.current) {
      // As above: a mounted container waits for its first measured width.
      setState((prev) => (prev.isReady ? prev : { ...prev, isReady: true }));
    }
  }, [
    text,
    fontSize,
    fontFamilyVariable,
    measureRichText,
    containerRef,
    translationMode,
    activeTheme,
    simplified,
    fontMode,
  ]);

  // Removed custom ResizeObserver in favor of unified useResizeObserver hook

  // Layout Height Validation Trigger
  useLayoutEffect(() => {
    // Development-only drift diagnostic; see the note in usePretextLayout.
    if (!isLayoutValidationEnabled()) return;
    if (state.isReady && containerRef.current) {
      const actualHeight = containerRef.current.getBoundingClientRect().height;
      validateLayoutHeight(
        state.height,
        actualHeight,
        `usePretextRichLayout (text: "${text.slice(0, 30)}...")`
      );
    }
  }, [state.isReady, state.height, text, containerRef]);

  return {
    ref: containerRef,
    ...state,
  };
}

export interface PretextRichTextProps {
  lines: RichInlineLine[];
  items: ExtendedRichInlineItem[];
  lineHeight: number;
  className?: string;
  isReady?: boolean;
  fallbackText?: string;
}

export const PretextRichText: React.FC<PretextRichTextProps> = ({
  lines,
  items,
  lineHeight,
  className,
  isReady = true,
  fallbackText = "",
}) => {
  if (!isReady || lines.length === 0) {
    return <p className={className}>{fallbackText}</p>;
  }

  return (
    <div className="relative">
      {/* 1. Custom Visual Presentation (hidden from screen readers, not selectable) */}
      <div
        aria-hidden="true"
        role="presentation"
        data-pretext-layer="visual"
        className={`${className || ""} select-none pointer-events-none`}
        style={{ display: "flex", flexDirection: "column" }}
      >
        {lines.map((line, lineIdx) => (
          <div
            key={lineIdx}
            className="flex flex-nowrap items-center whitespace-nowrap overflow-visible"
            style={{ height: `${lineHeight}px`, lineHeight: `${lineHeight}px` }}
          >
            {line.fragments.length === 0
              ? "\u00A0"
              : line.fragments.map((frag, fragIdx) => {
                  const item = items[frag.itemIndex];

                  if (item?.type === "code") {
                    return (
                      <span
                        key={fragIdx}
                        className="px-1.5 py-0 mx-0.5 text-[11px] font-mono font-bold bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan rounded-md inline-block shadow-[0_0_10px_rgba(6,182,212,0.05)] align-middle leading-[1.3]"
                        style={{
                          marginLeft:
                            frag.gapBefore > 0
                              ? `${frag.gapBefore}px`
                              : undefined,
                        }}
                      >
                        {frag.text}
                      </span>
                    );
                  }

                  const style =
                    item?.type === "bold"
                      ? "font-bold text-neutral-100"
                      : item?.type === "italic"
                        ? "italic text-zinc-300"
                        : "text-zinc-400";

                  return (
                    <span
                      key={fragIdx}
                      className={style}
                      style={{
                        marginLeft:
                          frag.gapBefore > 0
                            ? `${frag.gapBefore}px`
                            : undefined,
                      }}
                    >
                      {frag.text}
                    </span>
                  );
                })}
          </div>
        ))}
      </div>

      {/* 2. Transparent Standard Semantic Overlay (selectable, readable by screen readers) */}
      <p
        data-pretext-layer="semantic"
        className={`${className || ""} absolute inset-0 select-text bg-transparent`}
        style={{
          color: "transparent",
          WebkitTextFillColor: "transparent",
          pointerEvents: "auto",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {lines.map((line, lineIdx) => (
          <span
            key={lineIdx}
            className="flex flex-nowrap items-center whitespace-nowrap overflow-visible"
            style={{ height: `${lineHeight}px`, lineHeight: `${lineHeight}px` }}
          >
            {line.fragments.length === 0 ? (
              <span>{"\u00A0"}</span>
            ) : (
              line.fragments.map((frag, fragIdx) => {
                const item = items[frag.itemIndex];

                if (item?.type === "code") {
                  return (
                    <code
                      key={fragIdx}
                      className="px-1.5 py-0 mx-0.5 text-[11px] font-mono font-bold border inline-block align-middle leading-[1.3]"
                      style={{
                        marginLeft:
                          frag.gapBefore > 0
                            ? `${frag.gapBefore}px`
                            : undefined,
                      }}
                    >
                      {frag.text}
                    </code>
                  );
                }

                if (item?.type === "bold") {
                  return (
                    <strong
                      key={fragIdx}
                      className="font-bold"
                      style={{
                        marginLeft:
                          frag.gapBefore > 0
                            ? `${frag.gapBefore}px`
                            : undefined,
                      }}
                    >
                      {frag.text}
                    </strong>
                  );
                }

                if (item?.type === "italic") {
                  return (
                    <em
                      key={fragIdx}
                      className="italic"
                      style={{
                        marginLeft:
                          frag.gapBefore > 0
                            ? `${frag.gapBefore}px`
                            : undefined,
                      }}
                    >
                      {frag.text}
                    </em>
                  );
                }

                return (
                  <span
                    key={fragIdx}
                    style={{
                      marginLeft:
                        frag.gapBefore > 0 ? `${frag.gapBefore}px` : undefined,
                    }}
                  >
                    {frag.text}
                  </span>
                );
              })
            )}
          </span>
        ))}
      </p>
    </div>
  );
};

export {
  parsePretextBlocks,
  preparePretextBlocks,
  calculateBlockHeight,
  BLOCK_LAYOUT_CONFIG,
  type StructuredBlock,
  type PreparedBlock,
  type StructuredBlockType,
};
