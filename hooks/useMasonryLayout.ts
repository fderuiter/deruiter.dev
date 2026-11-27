import { useState, useLayoutEffect, useRef, useCallback } from "react";
import { useResizeObserver } from "./useResizeObserver";
import { type ExtendedRichInlineItem } from "@/hooks/usePretextLayout";
import { type RichInlineLine } from "@chenglou/pretext/rich-inline";
import { LAYOUT_CONFIG } from "@/lib/layout-config";
import { GitHubStats } from "@/lib/github";
import { calculateMasonryLayout, type PreparedData } from "@/lib/masonry";
import { isBrowser } from "@/lib/graphics-engine";
import { useBentoLayout } from "@/components/providers/BentoLayoutContext";
import { getRealityContent } from "@/components/ui/CaseStudyBentoCard";

import { preparePretextBlocks } from "@/lib/pretext-block-parser";

export interface MasonryItem {
  id: string;
  slug?: string;
  editorial_content: string;
  githubStats?: GitHubStats | null;
}

export interface LayoutItem<T extends MasonryItem> {
  item: T;
  height: number;
  preCalculatedRealityHeight?: number;
  paragraphsLines: RichInlineLine[][];
  paragraphsItems: ExtendedRichInlineItem[][];
}

export function useMasonryLayout<T extends MasonryItem>(
  allItems: T[],
  filteredItems: T[]
) {
  const { heightOverrides } = useBentoLayout();
  const containerWidthRef = useRef<number>(0);
  const preparedDataRef = useRef<Record<string, PreparedData>>({});

  const [layoutState, setLayoutState] = useState<{
    colCount: number;
    columns: (T & {
      height: number;
      preCalculatedRealityHeight?: number;
      paragraphsLines: RichInlineLine[][];
      paragraphsItems: ExtendedRichInlineItem[][];
    })[][];
    isReady: boolean;
  }>({
    colCount: LAYOUT_CONFIG.COLS.SM,
    columns: [
      allItems.map((s) => ({
        ...s,
        height: LAYOUT_CONFIG.FALLBACK_ITEM_HEIGHT,
        preCalculatedRealityHeight: LAYOUT_CONFIG.FALLBACK_ITEM_HEIGHT,
        paragraphsLines: [],
        paragraphsItems: [],
      })),
    ],
    isReady: false,
  });

  useLayoutEffect(() => {
    if (!isBrowser()) return;

    const data: Record<string, PreparedData> = {};
    for (const study of allItems) {
      const blocks = preparePretextBlocks(
        study.editorial_content || "",
        LAYOUT_CONFIG.FONT_SIZE,
        "--font-inter"
      );
      const realityContent = getRealityContent(
        study.slug || study.id,
        study.editorial_content || ""
      );
      const realityBlocks = preparePretextBlocks(
        realityContent,
        LAYOUT_CONFIG.FONT_SIZE,
        "--font-inter"
      );

      const paragraphs = blocks
        .filter((b) => b.type === "paragraph" && b.prepared)
        .map((b) => ({ prepared: b.prepared!, items: b.items || [] }));

      const paddingHeight = study.githubStats
        ? LAYOUT_CONFIG.PADDING_WITH_STATS
        : LAYOUT_CONFIG.PADDING_WITHOUT_STATS;

      data[study.id] = {
        blocks,
        realityBlocks,
        paragraphs,
        paddingHeight,
      };
    }

    preparedDataRef.current = data;
  }, [allItems]);

  const recalculateLayout = useCallback(
    (containerWidth: number) => {
      if (Object.keys(preparedDataRef.current).length === 0) return;

      const { colCount, columns } = calculateMasonryLayout(
        containerWidth,
        filteredItems,
        preparedDataRef.current,
        LAYOUT_CONFIG,
        heightOverrides
      );

      setLayoutState({
        colCount,
        columns,
        isReady: true,
      });
    },
    [filteredItems, heightOverrides]
  );

  const containerRef = useResizeObserver<HTMLDivElement>((entry) => {
    containerWidthRef.current = entry.contentRect.width;
    recalculateLayout(entry.contentRect.width);
  });

  useLayoutEffect(() => {
    if (containerRef.current) {
      const initialWidth = containerRef.current.getBoundingClientRect().width;
      containerWidthRef.current = initialWidth;
      recalculateLayout(initialWidth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (containerWidthRef.current > 0) {
      recalculateLayout(containerWidthRef.current);
    }
  }, [filteredItems, recalculateLayout]);

  return { containerRef, layoutState };
}
