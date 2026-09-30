"use client";

import React, { useMemo } from "react";
import { CaseStudyBentoCard } from "@/components/ui/CaseStudyBentoCard";
import { BaseCaseStudy } from "@/types/domain";
import { hexToRgba } from "@/lib/utils";
import { GitHubStats } from "@/lib/github";
import { motion, AnimatePresence } from "framer-motion";
import { designManifest } from "@/lib/design-manifest";
import { useMasonryLayout } from "@/hooks/useMasonryLayout";
import { useStudioHashParams } from "@/hooks/useStudioHashParams";
import { BentoLayoutProvider } from "@/components/providers/BentoLayoutContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface HydratedCaseStudy extends BaseCaseStudy {
  githubStats: GitHubStats | null;
}

interface CaseStudyShowcaseProps {
  caseStudies: HydratedCaseStudy[];
}

const FILTER_PARAM = "lang";

const CaseStudyShowcaseInner: React.FC<CaseStudyShowcaseProps> = ({
  caseStudies,
}) => {
  // Filter tabs are bounded to whatever primary_language values actually appear in
  // the collection today, so a real Rust, Graphic Design, or Angular/TypeScript
  // case study is always reachable instead of being silently unfilterable.
  const filterTabs = useMemo(() => {
    const seen = new Set<string>();
    for (const study of caseStudies) {
      if (study.primary_language) seen.add(study.primary_language);
    }
    return ["All", ...Array.from(seen).sort((a, b) => a.localeCompare(b))];
  }, [caseStudies]);

  // Reflected in the URL hash (via useStudioHashParams' useSyncExternalStore-backed
  // store, replacing rather than pushing history) so the current filter survives a
  // browser Back from a case-study detail page and can be shared as a deep link —
  // without pulling in next/navigation's useSearchParams, which would force this
  // static page's card content out of the prerendered HTML behind a Suspense boundary.
  const { getParam, setParam } = useStudioHashParams();
  const requestedFilter = getParam(FILTER_PARAM, "All");
  const selectedFilter = filterTabs.includes(requestedFilter)
    ? requestedFilter
    : "All";

  const setSelectedFilter = (tab: string) => {
    setParam(FILTER_PARAM, tab === "All" ? null : tab, { replace: true });
  };

  // Client-side interactive filter
  const filteredStudies = useMemo(() => {
    return selectedFilter === "All"
      ? caseStudies
      : caseStudies.filter(
          (study) => study.primary_language === selectedFilter
        );
  }, [caseStudies, selectedFilter]);

  const { containerRef, layoutState } = useMasonryLayout(
    caseStudies,
    filteredStudies
  );

  return (
    <Tabs
      value={selectedFilter}
      onValueChange={setSelectedFilter}
      className="w-full flex flex-col items-center"
    >
      {/* Premium Staggered Filtering Tabs */}
      <TabsList
        aria-label="Case study language filters"
        className="flex max-w-full overflow-x-auto gap-1.5 mb-8 sm:mb-12 bg-zinc-900/40 p-1.5 rounded-2xl border border-zinc-900/60 backdrop-blur-md relative z-20 scrollbar-none"
      >
        {filterTabs.map((tab) => {
          const isActive = selectedFilter === tab;
          return (
            <TabsTrigger
              key={tab}
              value={tab}
              className={`relative px-3.5 sm:px-4 py-2.5 sm:py-2 min-h-[40px] sm:min-h-0 flex items-center justify-center text-xs font-mono font-bold transition-colors duration-300 rounded-xl cursor-pointer select-none shrink-0 ${
                isActive
                  ? "text-brand-cyan"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  style={
                    {
                      "--tab-glow": `0 0 15px ${hexToRgba(designManifest.colors["brand-cyan"], 0.12)}`,
                    } as React.CSSProperties
                  }
                  className="absolute inset-0 bg-zinc-950 border border-zinc-800/80 rounded-xl -z-10 shadow-[var(--tab-glow)]"
                  transition={designManifest.motion.springs.snappy}
                />
              )}
              {tab === "All" ? "ALL PROJECTS" : tab.toUpperCase()}
            </TabsTrigger>
          );
        })}
      </TabsList>

      <TabsContent
        value={selectedFilter}
        className="w-full flex flex-col items-center"
      >
        {/* Dynamic Masonry Bento Grid */}
        <div
          ref={containerRef}
          className="w-full flex gap-4 items-start relative z-10"
        >
          {layoutState.isReady ? (
            layoutState.columns.map((colCards, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-4 flex-1 min-w-0">
                <AnimatePresence mode="popLayout">
                  {colCards.map((study) => (
                    <motion.div
                      key={study.id}
                      layout
                      initial={{ opacity: 0, scale: 0.96, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: -10 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="w-full"
                    >
                      <CaseStudyBentoCard
                        study={study}
                        preCalculatedHeight={study.height}
                        preCalculatedRealityHeight={
                          study.preCalculatedRealityHeight
                        }
                        preCalculatedParagraphsLines={study.paragraphsLines}
                        preCalculatedParagraphsItems={study.paragraphsItems}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ))
          ) : (
            /* SSR Safe Parallel Layout Fallback */
            <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
              {caseStudies.map((study) => (
                <CaseStudyBentoCard key={study.id} study={study} />
              ))}
            </div>
          )}
        </div>

        {/* Empty States fallback */}
        {filteredStudies.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 px-6 bg-zinc-900/10 border border-zinc-900/40 border-dashed rounded-2xl w-full max-w-lg mt-4"
          >
            <p className="text-sm text-zinc-500 italic">
              No projects found matching language filter &quot;{selectedFilter}
              &quot;.
            </p>
          </motion.div>
        )}
      </TabsContent>
    </Tabs>
  );
};

export const CaseStudyShowcase: React.FC<CaseStudyShowcaseProps> = (props) => {
  return (
    <BentoLayoutProvider>
      <CaseStudyShowcaseInner {...props} />
    </BentoLayoutProvider>
  );
};
