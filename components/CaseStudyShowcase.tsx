"use client";

import React, { useMemo, useEffect } from "react";
import { CaseStudyBentoCard } from "@/components/ui/CaseStudyBentoCard";
import { BaseCaseStudy } from "@/types/domain";
import { hexToRgba } from "@/lib/utils";
import { GitHubStats } from "@/lib/github";
import { motion, AnimatePresence } from "framer-motion";
import { designManifest } from "@/lib/design-manifest";
import { useMasonryLayout } from "@/hooks/useMasonryLayout";
import { useStudioHashParams } from "@/hooks/useStudioHashParams";
import { BentoLayoutProvider } from "@/components/providers/BentoLayoutContext";
import { usePersona } from "@/components/providers/PersonaProvider";
import {
  isLegacyPersonaValue,
  normalizePersona,
  type PersonaType,
} from "@/lib/persona";

interface HydratedCaseStudy extends BaseCaseStudy {
  githubStats: GitHubStats | null;
}

interface CaseStudyShowcaseProps {
  caseStudies: HydratedCaseStudy[];
}

const FILTER_PARAM = "lang";
const ROLE_PARAM = "role";

const PERSONA_TABS = [
  { id: "all", label: "ALL VIEWS" },
  { id: "professional", label: "PROFESSIONAL / HIGHLIGHTS" },
  { id: "behind-the-scenes", label: "BEHIND THE SCENES / ARCHITECTURE" },
] as const;

const CaseStudyShowcaseInner: React.FC<CaseStudyShowcaseProps> = ({
  caseStudies,
}) => {
  const { persona, setPersona } = usePersona();
  const { getParam, setParam } = useStudioHashParams();

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
  const requestedFilter = getParam(FILTER_PARAM, "All");
  const selectedFilter = filterTabs.includes(requestedFilter)
    ? requestedFilter
    : "All";

  const setSelectedFilter = (tab: string) => {
    setParam(FILTER_PARAM, tab === "All" ? null : tab, { replace: true });
  };

  const rawRoleParam = getParam(
    ROLE_PARAM,
    getParam("persona", "")
  ).toLowerCase();
  // Deep links shared before the ADR 0047 rename carry the legacy values;
  // they resolve to the renamed mode instead of falling back to "all".
  const selectedRole: PersonaType | "all" =
    rawRoleParam === "professional" ||
    rawRoleParam === "behind-the-scenes" ||
    isLegacyPersonaValue(rawRoleParam)
      ? normalizePersona(rawRoleParam)
      : "all";

  // Sync PersonaProvider context when role hash param is explicitly set
  useEffect(() => {
    if (selectedRole !== "all" && persona !== selectedRole) {
      setPersona(selectedRole);
    }
  }, [selectedRole, persona, setPersona]);

  const handleRoleSelect = (roleId: string) => {
    if (roleId === "professional" || roleId === "behind-the-scenes") {
      setPersona(roleId);
      setParam(ROLE_PARAM, roleId, { replace: true });
    } else {
      setParam(ROLE_PARAM, null, { replace: true });
    }
  };

  // Client-side interactive filter & prioritization
  const filteredStudies = useMemo(() => {
    let studies = caseStudies;

    if (selectedFilter !== "All") {
      studies = studies.filter(
        (study) => study.primary_language === selectedFilter
      );
    }

    if (selectedRole === "professional") {
      // Prioritize studies with published telemetry, rich editorial summaries, or high-level highlights
      studies = [...studies].sort((a, b) => {
        const aScore =
          (a.hero_image_url ? 2 : 0) + (a.simulated_telemetry ? 1 : 0);
        const bScore =
          (b.hero_image_url ? 2 : 0) + (b.simulated_telemetry ? 1 : 0);
        return bScore - aScore;
      });
    } else if (selectedRole === "behind-the-scenes") {
      // Prioritize studies with deep architectural narratives and complex telemetry
      studies = [...studies].sort((a, b) => {
        const aLen = (a.architectural_narrative || "").length;
        const bLen = (b.architectural_narrative || "").length;
        return bLen - aLen;
      });
    }

    return studies;
  }, [caseStudies, selectedFilter, selectedRole]);

  const { containerRef, layoutState } = useMasonryLayout(
    caseStudies,
    filteredStudies
  );

  const effectiveCardPersona: PersonaType =
    selectedRole === "all" ? persona : selectedRole;

  return (
    <div className="w-full flex flex-col items-center">
      {/* Primary Showcase Filter Control Bar */}
      <div className="flex max-w-full overflow-x-auto items-center gap-2 mb-8 sm:mb-12 bg-zinc-900/40 p-1.5 rounded-2xl border border-zinc-900/60 backdrop-blur-md relative z-20 scrollbar-none">
        {/* Persona Role Filter Tabs */}
        <div
          className="flex items-center gap-1 shrink-0"
          role="group"
          aria-label="Persona view filter"
        >
          {PERSONA_TABS.map((pTab) => {
            const isActive = selectedRole === pTab.id;
            return (
              <button
                key={pTab.id}
                onClick={() => handleRoleSelect(pTab.id)}
                aria-pressed={isActive}
                className={`relative px-3.5 sm:px-4 py-2.5 sm:py-2 min-h-[40px] sm:min-h-0 flex items-center justify-center text-xs font-mono font-bold transition-colors duration-300 rounded-xl cursor-pointer select-none shrink-0 ${
                  isActive
                    ? "text-brand-cyan"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activePersonaTab"
                    style={
                      {
                        "--tab-glow": `0 0 15px ${hexToRgba(designManifest.colors["brand-cyan"], 0.12)}`,
                      } as React.CSSProperties
                    }
                    className="absolute inset-0 bg-zinc-950 border border-zinc-800/80 rounded-xl -z-10 shadow-[var(--tab-glow)]"
                    transition={designManifest.motion.springs.snappy}
                  />
                )}
                {pTab.label}
              </button>
            );
          })}
        </div>

        {/* Section Divider */}
        <div className="w-px h-5 bg-zinc-800/80 shrink-0 mx-0.5" />

        {/* Language Filter Tabs */}
        <div
          className="flex items-center gap-1 shrink-0"
          role="group"
          aria-label="Language filter"
        >
          {filterTabs.map((tab) => {
            const isActive = selectedFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => setSelectedFilter(tab)}
                aria-pressed={isActive}
                className={`relative px-3.5 sm:px-4 py-2.5 sm:py-2 min-h-[40px] sm:min-h-0 flex items-center justify-center text-xs font-mono font-bold transition-colors duration-300 rounded-xl cursor-pointer select-none shrink-0 ${
                  isActive
                    ? "text-brand-cyan"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeLangTab"
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
              </button>
            );
          })}
        </div>
      </div>

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
                      activePersona={effectiveCardPersona}
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
              <CaseStudyBentoCard
                key={study.id}
                study={study}
                activePersona={effectiveCardPersona}
              />
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
            No projects found matching the active filter criteria.
          </p>
        </motion.div>
      )}
    </div>
  );
};

export const CaseStudyShowcase: React.FC<CaseStudyShowcaseProps> = (props) => {
  return (
    <BentoLayoutProvider>
      <CaseStudyShowcaseInner {...props} />
    </BentoLayoutProvider>
  );
};
