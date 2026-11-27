"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { StudyRepositoryClient } from "@/components/clinical/study-repository-client";
import { RandomizationWorkspace } from "@/components/randomization/RandomizationWorkspace";
import { StudyAnalysisPanel } from "./StudyAnalysisPanel";
import { StudyDesignPanel, StudyStudioShell } from "./StudyDesignGrid";
import { StudyNarrativePanel } from "./StudyNarrativePanel";
import { StudySchedulePanel } from "./StudySchedulePanel";

/** The five work areas of Clinical Study Studio in protocol build order. */
const STUDY_STUDIO_TABS = [
  {
    id: "design",
    title: "Design",
    summary: "Arms by epochs, the elements in each cell, and interventions.",
  },
  {
    id: "schedule",
    title: "Schedule",
    summary: "Visits ordered by study day and the activities planned at each.",
  },
  {
    id: "narrative",
    title: "Narrative",
    summary: "Objectives, nested endpoints, and eligibility criteria.",
  },
  {
    id: "analysis",
    title: "Analysis intent",
    summary:
      "Estimands, analysis populations, and intercurrent event strategies.",
  },
  {
    id: "randomization",
    title: "Randomization",
    summary: "Allocation schemes, checked by simulation before use.",
  },
] as const;

type StudyStudioTabId = (typeof STUDY_STUDIO_TABS)[number]["id"];

const MONO = "font-[family-name:var(--font-geist-mono)] tabular-nums";

/**
 * Tabbed Clinical Study Studio workspace: connects Design, Schedule,
 * Narrative, Analysis intent, and Randomization over one open study, revision
 * bar, undo/redo history, and browser draft repository.
 */
export function StudyStudioWorkspace({
  repository,
}: {
  readonly repository?: StudyRepositoryClient;
} = {}) {
  const [activeTab, setActiveTab] = useState<StudyStudioTabId>("design");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  return (
    <StudyStudioShell repository={repository}>
      {({ studyId, workspace, apply, resetKey, clearError }) => {
        const selectTab = (id: StudyStudioTabId, focus = false) => {
          setActiveTab(id);
          clearError();
          if (focus) {
            tabRefs.current[id]?.focus();
          }
        };

        const handleTabKeyDown = (
          event: KeyboardEvent<HTMLButtonElement>,
          index: number
        ) => {
          let nextIndex: number | null = null;
          if (event.key === "ArrowRight") {
            nextIndex = (index + 1) % STUDY_STUDIO_TABS.length;
          } else if (event.key === "ArrowLeft") {
            nextIndex =
              (index - 1 + STUDY_STUDIO_TABS.length) % STUDY_STUDIO_TABS.length;
          } else if (event.key === "Home") {
            nextIndex = 0;
          } else if (event.key === "End") {
            nextIndex = STUDY_STUDIO_TABS.length - 1;
          }
          if (nextIndex !== null) {
            event.preventDefault();
            selectTab(STUDY_STUDIO_TABS[nextIndex].id, true);
          }
        };

        const currentTabMeta =
          STUDY_STUDIO_TABS.find((t) => t.id === activeTab) ??
          STUDY_STUDIO_TABS[0];

        return (
          <div className="space-y-6">
            <div
              role="tablist"
              aria-label="Study work areas"
              className="grid gap-2 @md:grid-cols-2 @4xl:grid-cols-5"
            >
              {STUDY_STUDIO_TABS.map((tab, index) => {
                const selected = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    ref={(node) => {
                      tabRefs.current[tab.id] = node;
                    }}
                    id={`study-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`study-panel-${tab.id}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectTab(tab.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    className={`min-h-12 min-w-0 rounded-lg border p-3.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 active:scale-[0.99] ${
                      selected
                        ? "border-amber-400 bg-[#13151a] text-[#f4f4f6]"
                        : "border-white/[0.08] bg-[#0d0e11] text-slate-300 hover:border-slate-500 hover:bg-[#13151a]/60"
                    }`}
                  >
                    <span
                      className={`${MONO} block text-xs ${
                        selected ? "text-amber-300" : "text-slate-400"
                      }`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="mt-1 block break-words text-base font-semibold tracking-[-0.02em]">
                      {tab.title}
                    </span>
                    <span className="mt-1 block break-words text-xs leading-relaxed text-slate-400">
                      {tab.summary}
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              id={`study-panel-${currentTabMeta.id}`}
              role="tabpanel"
              aria-labelledby={`study-tab-${currentTabMeta.id}`}
              tabIndex={0}
              className="min-w-0 space-y-6 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <div className="border-b border-white/[0.08] pb-4">
                <h2 className="text-2xl font-semibold tracking-[-0.035em]">
                  {currentTabMeta.title}
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-300">
                  {currentTabMeta.summary}
                </p>
              </div>

              {activeTab === "design" && (
                <StudyDesignPanel
                  key={`design:${studyId}:${resetKey}`}
                  workspace={workspace}
                  apply={apply}
                />
              )}
              {activeTab === "schedule" && (
                <StudySchedulePanel
                  key={`schedule:${studyId}:${resetKey}`}
                  workspace={workspace}
                  apply={apply}
                />
              )}
              {activeTab === "narrative" && (
                <StudyNarrativePanel
                  key={`narrative:${studyId}:${resetKey}`}
                  workspace={workspace}
                  apply={apply}
                />
              )}
              {activeTab === "analysis" && (
                <StudyAnalysisPanel
                  key={`analysis:${studyId}:${resetKey}`}
                  workspace={workspace}
                  apply={apply}
                />
              )}
              {activeTab === "randomization" && (
                <RandomizationWorkspace workspace={workspace} apply={apply} />
              )}
            </div>
          </div>
        );
      }}
    </StudyStudioShell>
  );
}
