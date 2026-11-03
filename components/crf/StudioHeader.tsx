"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useResizeObserver } from "@/hooks/useResizeObserver";
import { StudyProtocol, StudioMode, StudioTheme } from "@/lib/crf/types";
import { getStudyPresetsSync } from "@/lib/crf/presets";
import { useDebouncedDiagnostics } from "@/hooks/useDebouncedDiagnostics";
import {
  IconLayoutGrid,
  IconCalendar,
  IconMathFunction,
  IconShieldCheck,
  IconFileCode,
  IconCode,
  IconSparkles,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBug,
  IconCheck,
  IconBookmark,
  IconFileSpreadsheet,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarRightCollapse,
  IconHelp,
  IconPlayerPlay,
  IconLink,
  IconSun,
  IconMoon,
  IconTerminal2,
  IconFlask2,
  IconGitCompare,
  IconBooks,
  IconSearch,
  IconArrowRight,
} from "@tabler/icons-react";
import { getStudyBranding } from "@/lib/crf";
import {
  STUDIO_MODE_ORDER,
  STUDIO_STAGES,
  modeShortcut,
  nextStepFor,
} from "./studio-stages";
import {
  StudioActionsDrawer,
  StudioHeaderMenus,
  type StudioMenuActions,
} from "./StudioHeaderMenus";
import { safeSetRawItem } from "@/lib/safe-storage";
import {
  STUDY_DATA_HANDOFF_PATH,
  storeStudyHandoff,
} from "@/components/study-data/handoff-storage";

interface StudioHeaderProps {
  study: StudyProtocol;
  activeMode: StudioMode;
  canUndo: boolean;
  canRedo: boolean;
  theme?: StudioTheme;
  onToggleTheme?: () => void;
  isLeftSidebarOpen?: boolean;
  isRightInspectorOpen?: boolean;
  isTerminalOpen?: boolean;
  isTestDockOpen?: boolean;
  onToggleLeftSidebar?: () => void;
  onToggleRightInspector?: () => void;
  onToggleTerminal?: () => void;
  onToggleTestDock?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onChangeMode: (mode: StudioMode) => void;
  onSelectPreset: (presetId: string) => void;
  onOpenDiagnostics: () => void;
  onOpenFormCatalog: () => void;
  onOpenBranding: () => void;
  onOpenExportDocument: () => void;
  onOpenBaselines?: () => void;
  onOpenCompareBaseline?: () => void;
  onOpenLibraryUpgrades?: () => void;
  onOpenWizard: () => void;
  /** Opens the Study Omnibar (#544): find forms, fields, visits and actions. */
  onOpenOmnibar?: () => void;
  onStartSpotlightTour?: () => void;
  onCopyShareLink?: () => void;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  study,
  activeMode,
  canUndo,
  canRedo,
  theme = "dark",
  onToggleTheme,
  isLeftSidebarOpen = true,
  isRightInspectorOpen = true,
  isTerminalOpen = false,
  isTestDockOpen = false,
  onToggleLeftSidebar,
  onToggleRightInspector,
  onToggleTerminal,
  onToggleTestDock,
  onUndo,
  onRedo,
  onChangeMode,
  onSelectPreset,
  onOpenDiagnostics,
  onOpenFormCatalog,
  onOpenBranding,
  onOpenExportDocument,
  onOpenBaselines,
  onOpenCompareBaseline,
  onOpenLibraryUpgrades,
  onOpenWizard,
  onOpenOmnibar,
  onStartSpotlightTour,
  onCopyShareLink,
}) => {
  const router = useRouter();
  const [isSendingToPipeline, setIsSendingToPipeline] = useState(false);

  // Hands the study's USDM export to /study-data in this tab, the same
  // handoff the Exports USDM tab offers. When the browser cannot store it,
  // the Exports mode is the fallback, where the file can be downloaded.
  const sendToPipeline = async () => {
    if (isSendingToPipeline) return;
    setIsSendingToPipeline(true);
    let failed = true;
    try {
      const { exportStudyToUsdmObject } = await import("@/lib/crf");
      failed = storeStudyHandoff(exportStudyToUsdmObject(study)) !== null;
    } catch {
      failed = true;
    }
    setIsSendingToPipeline(false);
    if (failed) {
      onChangeMode("export");
      return;
    }
    router.push(STUDY_DATA_HANDOFF_PATH);
  };
  const [presets] = useState<
    Array<{
      id: string;
      name: string;
      therapeuticArea?: string;
      study: { protocolNumber: string };
    }>
  >(() => getStudyPresetsSync());
  const branding = getStudyBranding(study);
  const { totalIssues } = useDebouncedDiagnostics(study);
  const issueLabel = totalIssues > 0 ? `${totalIssues} Issues` : "Verified";

  const currentPreset = presets.find(
    (p) => p.study.protocolNumber === study.protocolNumber
  );

  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const simulateProtocol = () => {
    safeSetRawItem("crf_active_protocol", JSON.stringify(study), {
      retainInMemory: false,
    });
    router.push("/arcade/clinical-chaos");
  };

  // Every menu item's handler, keyed by the ids in STUDIO_HEADER_MENUS. An
  // item without `run` renders disabled: its handler was not passed, or (the
  // pane toggles) it only applies to the Canvas mode.
  const menuActions: StudioMenuActions = {
    undo: {
      icon: <IconArrowBackUp className="w-3.5 h-3.5" />,
      run: canUndo ? onUndo : undefined,
    },
    redo: {
      icon: <IconArrowForwardUp className="w-3.5 h-3.5" />,
      run: canRedo ? onRedo : undefined,
    },
    find: {
      icon: <IconSearch className="w-3.5 h-3.5" />,
      run: onOpenOmnibar,
    },
    "add-form": {
      icon: <IconSparkles className="w-3.5 h-3.5 text-amber-400" />,
      run: onOpenFormCatalog,
    },
    "library-upgrades": {
      icon: <IconBooks className="w-3.5 h-3.5 text-brand-cyan" />,
      run: onOpenLibraryUpgrades,
    },
    baselines: {
      icon: <IconBookmark className="w-3.5 h-3.5 text-brand-cyan" />,
      run: onOpenBaselines,
    },
    "compare-baseline": {
      icon: <IconGitCompare className="w-3.5 h-3.5 text-brand-cyan" />,
      run: onOpenCompareBaseline,
    },
    branding: {
      icon: (
        <span
          className="block w-3.5 h-3.5 rounded-full border border-zinc-700"
          style={{ backgroundColor: branding.primaryColor }}
        />
      ),
      run: onOpenBranding,
    },
    "toggle-theme": {
      icon:
        theme === "light" ? (
          <IconMoon className="w-3.5 h-3.5 text-amber-500" />
        ) : (
          <IconSun className="w-3.5 h-3.5 text-amber-400" />
        ),
      label:
        theme === "light"
          ? "Switch to Dark Studio Mode"
          : "Switch to Clinical Light Mode",
      run: onToggleTheme,
    },
    "toggle-sidebar": {
      icon: (
        <IconLayoutSidebarLeftCollapse className="w-3.5 h-3.5 text-brand-cyan" />
      ),
      checked: isLeftSidebarOpen,
      run: activeMode === "designer" ? onToggleLeftSidebar : undefined,
    },
    "toggle-inspector": {
      icon: (
        <IconLayoutSidebarRightCollapse className="w-3.5 h-3.5 text-brand-cyan" />
      ),
      checked: isRightInspectorOpen,
      run: activeMode === "designer" ? onToggleRightInspector : undefined,
    },
    "toggle-terminal": {
      icon: <IconTerminal2 className="w-3.5 h-3.5 text-brand-cyan" />,
      checked: isTerminalOpen,
      run: onToggleTerminal,
    },
    guide: {
      icon: <IconHelp className="w-3.5 h-3.5 text-brand-cyan" />,
      run: onOpenWizard,
    },
    tour: {
      icon: <IconPlayerPlay className="w-3.5 h-3.5 text-brand-cyan" />,
      run: onStartSpotlightTour,
    },
    diagnostics: {
      icon:
        totalIssues > 0 ? (
          <IconBug className="w-3.5 h-3.5 text-amber-400" />
        ) : (
          <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
        ),
      badge: issueLabel,
      run: onOpenDiagnostics,
    },
    "toggle-test-dock": {
      icon: <IconFlask2 className="w-3.5 h-3.5 text-brand-cyan" />,
      checked: isTestDockOpen,
      run: onToggleTestDock,
    },
    simulate: {
      icon: (
        <IconPlayerPlay className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
      ),
      run: simulateProtocol,
    },
    "export-doc": {
      icon: <IconFileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />,
      run: onOpenExportDocument,
    },
    "copy-link": {
      icon: <IconLink className="w-3.5 h-3.5 text-brand-cyan" />,
      run: onCopyShareLink,
    },
  };

  const handleModeKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentMode: StudioMode
  ) => {
    const modesList = MODES.map((m) => m.mode);
    const currentIndex = modesList.indexOf(currentMode);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % modesList.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + modesList.length) % modesList.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = modesList.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    const nextMode = modesList[nextIndex];
    onChangeMode(nextMode);
    tabRefs.current[nextMode]?.focus();
  };

  const MODE_DETAILS: {
    mode: StudioMode;
    label: string;
    shortLabel: string;
    /** Plain-language tooltip for visitors who don't know the CDISC terms. */
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      mode: "designer",
      label: "Form Designer",
      shortLabel: "Canvas",
      description: "Build the open form: add, arrange and configure fields",
      icon: <IconLayoutGrid className="w-3.5 h-3.5" />,
    },
    {
      mode: "grid",
      label: "Active Form Grid",
      shortLabel: "Form Grid",
      description: "Edit every field of the open form in one table",
      icon: <IconFileSpreadsheet className="w-3.5 h-3.5" />,
    },
    {
      mode: "matrix",
      label: "Visit Matrix (SoA)",
      shortLabel: "Matrix (SoA)",
      description:
        "Schedule of Assessments: which forms are collected at which visit",
      icon: <IconCalendar className="w-3.5 h-3.5" />,
    },
    {
      mode: "rules",
      label: "Logic & AST Rules",
      shortLabel: "AST Rules",
      description: "Edit checks and show/hide logic, drawn as a graph",
      icon: <IconMathFunction className="w-3.5 h-3.5" />,
    },
    {
      mode: "edc",
      label: "Live EDC Simulation",
      shortLabel: "Live EDC",
      description:
        "Enter test data as a clinical site would and see the checks fire",
      icon: <IconShieldCheck className="w-3.5 h-3.5" />,
    },
    {
      mode: "acrf",
      label: "Annotated aCRF",
      shortLabel: "aCRF Viewer",
      description:
        "The annotated CRF: each question tagged with its SDTM variable",
      icon: <IconFileCode className="w-3.5 h-3.5" />,
    },
    {
      mode: "export",
      label: "CDISC / Exports",
      shortLabel: "Exports",
      description:
        "Download the study as JSON, ODM-XML, SAS, R, FHIR, Word or PDF",
      icon: <IconCode className="w-3.5 h-3.5" />,
    },
  ];

  // Stage order (Design, Schedule, Verify and ship) decides the tab order and
  // each mode's number-key shortcut.
  const MODES = STUDIO_MODE_ORDER.map((mode) => ({
    ...MODE_DETAILS.find((item) => item.mode === mode)!,
    shortcut: modeShortcut(mode),
  }));
  const modesOf = (stageModes: readonly StudioMode[]) =>
    MODES.filter((item) => stageModes.includes(item.mode));
  const nextStep = nextStepFor(activeMode);

  const headerObserverRef = useResizeObserver<HTMLElement>(
    (entry) => {
      const h = Math.round(entry.contentRect.height);
      if (typeof document !== "undefined" && h > 0) {
        document.documentElement.style.setProperty("--header-height", `${h}px`);
      }
    },
    { trackVertical: true }
  );

  return (
    <header
      ref={headerObserverRef}
      className="border-b border-zinc-800 bg-zinc-950/95 sticky top-0 z-30 backdrop-blur-xl"
    >
      {/* TIER 1: Brand, Protocol Selector & Global Actions Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-zinc-900/80 gap-3">
        {/* Left Side: Brand, Protocol Selector & Menus */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-brand-cyan animate-pulse shrink-0" />
            <span className="font-mono text-xs sm:text-sm font-extrabold text-white tracking-wider uppercase truncate">
              CRF Studio
            </span>
          </div>

          <div className="h-3.5 w-px bg-zinc-800 hidden sm:block shrink-0" />

          {/* Protocol Preset Selector */}
          <div className="hidden sm:flex items-center min-w-0 sm:max-w-[240px] md:max-w-[280px] shrink">
            <select
              onChange={(e) => onSelectPreset(e.target.value)}
              value={currentPreset?.id || "custom"}
              aria-label="Select Clinical Protocol Preset"
              className="w-full bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 text-xs font-mono text-zinc-200 rounded-lg px-2.5 py-1 focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan focus:outline-none truncate transition-colors cursor-pointer"
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.study.protocolNumber})
                </option>
              ))}
            </select>
          </div>

          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 hidden sm:inline-flex shrink-0 whitespace-nowrap">
            {study.phase}
          </span>

          <StudioHeaderMenus
            actions={menuActions}
            hasIssues={totalIssues > 0}
            checkBadge={
              <span className="inline-flex items-center gap-1 text-[10px]">
                {totalIssues > 0 ? (
                  <IconBug
                    aria-hidden="true"
                    className="w-3 h-3 text-amber-400"
                  />
                ) : (
                  <IconCheck
                    aria-hidden="true"
                    className="w-3 h-3 text-emerald-400"
                  />
                )}
                {issueLabel}
              </span>
            }
          />
        </div>

        {/* Right Side: Find, the pipeline handoff and the phone actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Study Omnibar Trigger (#544) */}
          {onOpenOmnibar && (
            <button
              type="button"
              onClick={onOpenOmnibar}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors inline-flex items-center gap-1 text-[11px] font-mono shrink-0 active:scale-[0.98]"
              title="Find forms, fields, visits and actions (F)"
              aria-label="Find, F: search the study"
              aria-keyshortcuts="F"
            >
              <IconSearch className="w-3.5 h-3.5" aria-hidden />
              <span className="hidden lg:inline">Find</span>{" "}
              <kbd className="hidden lg:inline-block text-[9px] px-1 rounded bg-zinc-950 border border-zinc-700 text-zinc-400">
                F
              </kbd>
            </button>
          )}

          {/* The clinical journey's next step for this study (#2927); #3395
              leaves the next-step button as the only stage primary. */}
          <button
            type="button"
            onClick={sendToPipeline}
            disabled={isSendingToPipeline}
            className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 font-mono text-xs font-bold rounded-lg border border-amber-500/50 transition-all shrink-0 whitespace-nowrap shadow-xs disabled:opacity-60"
            title="Open this study in the Study Data Pipeline, which tabulates it into SDTM, ADaM and tables"
          >
            <IconArrowRight className="w-3.5 h-3.5 shrink-0" />
            <span>Run Pipeline</span>
          </button>

          <StudioActionsDrawer
            actions={menuActions}
            hasIssues={totalIssues > 0}
          />
        </div>
      </div>

      <div className="sm:hidden px-3 pb-2">
        <select
          value={currentPreset?.id || "custom"}
          onChange={(event) => onSelectPreset(event.target.value)}
          aria-label="Select Clinical Protocol Preset"
          className="w-full min-w-0 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-xs font-mono text-zinc-200 focus:border-brand-cyan focus:outline-none focus:ring-1 focus:ring-brand-cyan"
        >
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name} ({preset.study.protocolNumber})
            </option>
          ))}
        </select>
      </div>

      {/* TIER 2: Segmented Mode Navigation Rail & Workspace Visibility Toggles */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-1.5 bg-zinc-950/90 gap-2 border-t border-zinc-900/50">
        <select
          value={activeMode}
          onChange={(event) => onChangeMode(event.target.value as StudioMode)}
          aria-label="Studio mode"
          className="sm:hidden min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-xs font-mono text-zinc-200 focus:border-brand-cyan focus:outline-none focus:ring-1 focus:ring-brand-cyan"
        >
          {STUDIO_STAGES.map((stage) => (
            <optgroup key={stage.id} label={stage.label}>
              {modesOf(stage.modes).map((item) => (
                <option key={item.mode} value={item.mode}>
                  {item.shortLabel}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {/* Left Side: the seven modes, grouped into three stages */}
        <nav
          role="tablist"
          aria-label="Studio Mode Navigation"
          data-tour="modes"
          className="hidden sm:flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5 min-w-0"
        >
          {STUDIO_STAGES.map((stage, stageIndex) => (
            <div
              key={stage.id}
              role="presentation"
              data-stage={stage.id}
              className="flex items-center gap-1 shrink-0"
            >
              {stageIndex > 0 && (
                <span
                  aria-hidden="true"
                  className="mx-1 h-4 w-px bg-zinc-800 shrink-0"
                />
              )}
              <span
                aria-hidden="true"
                className="hidden lg:inline text-[10px] font-mono uppercase tracking-wider text-zinc-400 whitespace-nowrap"
              >
                {stage.label}
              </span>
              {modesOf(stage.modes).map((item) => {
                const isActive = activeMode === item.mode;
                return (
                  <button
                    ref={(node) => {
                      tabRefs.current[item.mode] = node;
                    }}
                    key={item.mode}
                    role="tab"
                    aria-selected={isActive}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => onChangeMode(item.mode)}
                    onKeyDown={(e) => handleModeKeyDown(e, item.mode)}
                    title={`${item.description} (${item.shortcut})`}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-semibold transition-all rounded-lg whitespace-nowrap outline-none shrink-0 ${
                      isActive
                        ? "bg-brand-cyan/15 text-brand-cyan font-bold border border-brand-cyan/30 shadow-xs"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent"
                    }`}
                  >
                    {item.icon}
                    <span className="hidden 2xl:inline">{item.label}</span>
                    <span className="hidden sm:inline 2xl:hidden">
                      {item.shortLabel}
                    </span>
                    <span className="sm:hidden">{item.shortLabel}</span>
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-mono hidden 2xl:inline-block ${
                        isActive
                          ? "bg-brand-cyan/25 text-brand-cyan font-bold"
                          : "bg-zinc-900 text-zinc-600"
                      }`}
                    >
                      {item.shortcut}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* The one step to take next, so the stages read as a path. */}
        <button
          type="button"
          onClick={() =>
            nextStep.kind === "mode"
              ? onChangeMode(nextStep.mode)
              : void sendToPipeline()
          }
          disabled={nextStep.kind === "pipeline" && isSendingToPipeline}
          data-testid="studio-next-step"
          className="inline-flex items-center gap-1 px-2.5 py-2 sm:py-1 rounded-lg border border-amber-800/50 bg-amber-950/30 text-amber-200 hover:bg-amber-900/40 text-[11px] font-mono font-semibold whitespace-nowrap shrink-0 transition-colors disabled:opacity-60 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand-cyan outline-none"
        >
          <span className="hidden md:inline text-amber-400/80">Next:</span>
          {nextStep.label}
          <IconArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
};
