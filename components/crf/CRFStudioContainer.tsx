"use client";

import "./studio-theme.css";
import React, { useState, useCallback, useMemo } from "react";
import { useClipboard } from "@/hooks/useClipboard";
import { useToast } from "@/hooks/useToast";
import { DeviceViewport, SlashCommandItem, getStudyBranding } from "@/lib/crf";
import {
  loadInitialStudy,
  loadRecoveredDraftSavedAt,
  resolveInsertionTarget,
  scenarioStaleness,
} from "./study-edit-ops";
import { useStudyHistory } from "./useStudyHistory";
import { useStudioNavigation } from "./useStudioNavigation";
import { useStudyEditor } from "./useStudyEditor";
import { useStudyAutosave } from "@/hooks/useStudyAutosave";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useWorkspaceAction } from "@/hooks/useWorkspaceAction";
import { StudioHeader } from "./StudioHeader";
import { MODE_BY_KEY } from "./studio-stages";
import { StudySpine } from "./LeftSidebar/StudySpine";
import { WidgetPalette } from "./LeftSidebar/WidgetPalette";
import { CdashScaffolderModal } from "./LeftSidebar/CdashScaffolderModal";
import { FormCanvas } from "./CenterCanvas/FormCanvas";
import { InspectorPanel } from "./RightInspector/InspectorPanel";
import dynamic from "next/dynamic";

import { ActiveFormGrid } from "./Modes/ActiveFormGrid";

const AcrfOverlayViewer = dynamic(
  () =>
    import("./Modes/AcrfOverlayViewer").then((mod) => mod.AcrfOverlayViewer),
  { ssr: false }
);

const ExportImportModal = dynamic(
  () =>
    import("./Modes/ExportImportModal").then((mod) => mod.ExportImportModal),
  { ssr: false }
);

const ExportDocumentModal = dynamic(
  () =>
    import("./Modes/ExportDocumentModal").then((mod) => ({
      default: mod.ExportDocumentModal,
    })),
  { ssr: false }
);

const ReviewPackageModal = dynamic(
  () => import("./ReviewPackageModal").then((mod) => mod.ReviewPackageModal),
  { ssr: false }
);

const BrandingConfigModal = dynamic(
  () =>
    import("./Branding/BrandingConfigModal").then(
      (mod) => mod.BrandingConfigModal
    ),
  { ssr: false }
);

const DiagnosticsDrawer = dynamic(
  () => import("./DiagnosticsDrawer").then((mod) => mod.DiagnosticsDrawer),
  { ssr: false }
);

const SpotlightTourOverlay = dynamic(
  () =>
    import("./Wizard/SpotlightTourOverlay").then(
      (mod) => mod.SpotlightTourOverlay
    ),
  { ssr: false }
);

import { StudioTerminal } from "./Terminal/StudioTerminal";
import { FormTestDock } from "./Modes/FormTestDock";
import { ScenarioImpactPanel } from "./Modes/ScenarioImpactPanel";
import { DEFAULT_TEST_SCOPE, type ConditionalFieldValues } from "@/lib/crf";
import { SlashPaletteModal } from "./SlashPaletteModal";
import { StudyOmnibar } from "./StudyOmnibar";
import type { OmnibarAction } from "@/lib/crf/study-omnibar";
import { BaselineManagerModal } from "./BaselineManagerModal";
import {
  BaselineCompareModal,
  type BaselineCompareNavigationTarget,
} from "./BaselineCompareModal";
import { LibraryUpgradeModal } from "./LibraryUpgradeModal";
import {
  VisitMatrixEditorSkeleton,
  RuleGraphStudioSkeleton,
  LiveEdcSimulatorSkeleton,
  WorkflowWizardModalSkeleton,
  CRFStudioSkeleton,
} from "./Skeletons";

const VisitMatrixEditor = dynamic(
  () =>
    import("./Modes/VisitMatrixEditor").then((mod) => mod.VisitMatrixEditor),
  {
    ssr: false,
    loading: () => <VisitMatrixEditorSkeleton />,
  }
);

const RuleGraphStudio = dynamic(
  () => import("./Modes/RuleGraphStudio").then((mod) => mod.RuleGraphStudio),
  {
    ssr: false,
    loading: () => <RuleGraphStudioSkeleton />,
  }
);

const LiveEdcSimulator = dynamic(
  () => import("./Modes/LiveEdcSimulator").then((mod) => mod.LiveEdcSimulator),
  {
    ssr: false,
    loading: () => <LiveEdcSimulatorSkeleton />,
  }
);

const WorkflowWizardModal = dynamic(
  () =>
    import("./Wizard/WorkflowWizardModal").then(
      (mod) => mod.WorkflowWizardModal
    ),
  {
    ssr: false,
    loading: () => <WorkflowWizardModalSkeleton />,
  }
);
import { useHotkeys } from "@/hooks/useHotkeys";
import { useAudio } from "@/components/providers/AudioProvider";
import { useTouchDragAndDrop } from "@/hooks/useTouchDragAndDrop";
import {
  IconFileSpreadsheet,
  IconLayoutGrid,
  IconAdjustments,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";

// Every Ctrl/Meta/Alt combination, so a binding fires regardless of held
// modifiers exactly as the raw listener did. Shift is matched leniently.
const ANY_MODIFIER_PREFIXES: readonly string[] = [
  "",
  "Ctrl+",
  "Meta+",
  "Alt+",
  "Ctrl+Meta+",
  "Ctrl+Alt+",
  "Meta+Alt+",
  "Ctrl+Meta+Alt+",
];

// Ctrl or Meta (either, or both), with or without Alt.
const CTRL_OR_META_PREFIXES: readonly string[] = [
  "Ctrl+",
  "Meta+",
  "Ctrl+Meta+",
  "Ctrl+Alt+",
  "Meta+Alt+",
  "Ctrl+Meta+Alt+",
];

const ESCAPE_HOTKEYS: readonly string[] = ANY_MODIFIER_PREFIXES.map(
  (prefix) => `${prefix}Escape`
);

const STUDIO_HOTKEYS: readonly string[] = [
  "/",
  ...["z", "b", "i", "j", "\\"].flatMap((key) =>
    CTRL_OR_META_PREFIXES.map((prefix) => `${prefix}${key}`)
  ),
  ...["`", "F1"].flatMap((key) =>
    ANY_MODIFIER_PREFIXES.map((prefix) => `${prefix}${key}`)
  ),
  ...Object.keys(MODE_BY_KEY),
];

export const CRFStudioContainer: React.FC = () => {
  // Polyfill touch drag-and-drop support across CRF Studio
  useTouchDragAndDrop();

  const [recoveredDraftSavedAt] = useState(loadRecoveredDraftSavedAt);

  // Study State & History
  const studyHistory = useStudyHistory(loadInitialStudy);
  const { study, canUndo, canRedo, undo, redo, commit } = studyHistory;

  const {
    status: draftSaveStatus,
    errorMessage: draftSaveError,
    downloadDraft,
  } = useStudyAutosave(study);

  const navigation = useStudioNavigation(study);
  const {
    activeMode,
    setActiveMode,
    activeFormId,
    setActiveFormId,
    activeVisitId,
    setActiveVisitId,
    selectedFieldId,
    setSelectedFieldId,
    leftTab,
    setLeftTab,
    theme,
    toggleTheme,
    compareBaselineId,
    setCompareBaselineId,
    isCompareModalOpen,
    setIsCompareModalOpen,
  } = navigation;
  const { playSuccess } = useAudio();
  const toast = useToast();

  const [viewport, setViewport] = useState<DeviceViewport>("desktop");

  // Sidebar Visibility / Collapse States for Desktop & Laptop
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightInspectorOpen, setIsRightInspectorOpen] = useState(true);

  // Mobile Stack Navigation View: "forms" | "canvas" | "inspector"
  const [mobileActiveView, setMobileActiveView] = useState<
    "forms" | "canvas" | "inspector"
  >("canvas");
  const [isMobileWidgetDrawerOpen, setIsMobileWidgetDrawerOpen] =
    useState(false);
  // Section an in-flight "Add Field" palette open should insert into; null
  // means "no explicit target", so addField falls back to the selected
  // field's section or the form's first section.
  const [addFieldTargetSectionId, setAddFieldTargetSectionId] = useState<
    string | null
  >(null);
  // Escape dismissal is already handled by the global keyboard-shortcuts
  // effect below; this trap only owns initial focus, Tab containment, and
  // returning focus to the trigger button on close.
  const mobileWidgetSheetRef = useFocusTrap<HTMLDivElement>(
    isMobileWidgetDrawerOpen
  );

  const showCanvas = useCallback(() => setMobileActiveView("canvas"), []);
  const closeWidgetDrawer = useCallback(
    () => setIsMobileWidgetDrawerOpen(false),
    []
  );
  const editor = useStudyEditor({
    history: studyHistory,
    navigation,
    showCanvas,
    closeWidgetDrawer,
    playSuccess,
    toast,
  });
  const {
    activeForm,
    reviewAuthor,
    pendingStudyReplacement,
    impactPendingDeletion,
  } = editor;

  const replaceStudyModalRef = useFocusTrap<HTMLDivElement>(
    !!pendingStudyReplacement,
    {
      onEscape: editor.cancelStudyReplacement,
    }
  );
  const impactDeletionModalRef = useFocusTrap<HTMLDivElement>(
    impactPendingDeletion !== null,
    {
      onEscape: editor.cancelImpactDeletion,
    }
  );

  // Modals & Panels State
  const [isScaffolderOpen, setIsScaffolderOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isBrandingOpen, setIsBrandingOpen] = useState(false);
  const [isExportDocModalOpen, setIsExportDocModalOpen] = useState(false);
  const [isReviewPackageOpen, setIsReviewPackageOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isSpotlightTourOpen, setIsSpotlightTourOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isTestDockOpen, setIsTestDockOpen] = useState(false);
  // Held here rather than inside the dock so edit -> test -> close -> reopen
  // returns the author to the record they were working on (#541).
  const [testDockValues, setTestDockValues] = useState<ConditionalFieldValues>(
    {}
  );
  const [isSlashPaletteOpen, setIsSlashPaletteOpen] = useState(false);
  const [isOmnibarOpen, setIsOmnibarOpen] = useState(false);
  const [isBaselinesModalOpen, setIsBaselinesModalOpen] = useState(false);
  const [isLibraryUpgradesOpen, setIsLibraryUpgradesOpen] = useState(false);
  const [slashTargetSectionId, setSlashTargetSectionId] = useState<
    string | undefined
  >();
  const [slashTargetIndex, setSlashTargetIndex] = useState<
    number | undefined
  >();

  useWorkspaceAction({
    id: "crf-studio:validate-cdash",
    title: "CRF Studio: Validate CDASH Rules",
    description:
      "Run automated CDASH rule verification and compliance diagnostics",
    subToolId: "crf-studio",
    subToolName: "CRF Studio",
    badge: "Validation",
    tags: ["cdash", "validation", "compliance", "crf"],
    shortcut: "Alt+V",
    handler: () => setIsDiagnosticsOpen(true),
  });

  useWorkspaceAction({
    id: "crf-studio:export-odm",
    title: "CRF Studio: Export ODM-XML Schema",
    description:
      "Export ODM-XML protocol definitions and case report form schemas",
    subToolId: "crf-studio",
    subToolName: "CRF Studio",
    badge: "Export",
    tags: ["odm", "export", "xml", "crf"],
    shortcut: "Alt+E",
    handler: () => setIsExportDocModalOpen(true),
  });

  useWorkspaceAction({
    id: "crf-studio:toggle-theme",
    title: "CRF Studio: Toggle Studio Theme",
    description: "Switch CRF Studio between dark and light themes",
    subToolId: "crf-studio",
    subToolName: "CRF Studio",
    badge: "Theme",
    tags: ["theme", "dark", "light"],
    shortcut: "Alt+T",
    handler: toggleTheme,
  });

  const { copy: copyShareLink } = useClipboard({
    successMessage:
      "View link copied. It opens this navigation state, not the authored study; recipients need their own copy of the study data.",
    onSuccess: () => {
      try {
        playSuccess();
      } catch {}
      // useClipboard already announced successMessage; show it without speaking it twice.
      toast.success(
        "View link copied. It opens this navigation state, not the authored study; recipients need their own copy of the study data.",
        { announce: false }
      );
    },
  });

  const handleCopyShareLink = useCallback(() => {
    if (typeof window !== "undefined") {
      copyShareLink(window.location.href);
    }
  }, [copyShareLink]);

  // Global Keyboard Shortcuts (Undo, Redo, Sidebar Toggles, Mode Switching, Hotkeys)
  // The tour points at the designer's panes, so show them before it starts.
  const startSpotlightTour = () => {
    setActiveMode("designer");
    setIsLeftSidebarOpen(true);
    setIsRightInspectorOpen(true);
    setIsSpotlightTourOpen(true);
  };

  // Escape closes mobile drawers, the slash palette and the test dock, and
  // clears the selection. It runs regardless of focus, inside inputs and the
  // studio's own keyboard boundary, so it can still dismiss a drawer while a
  // field inside it is focused.
  useHotkeys(
    ESCAPE_HOTKEYS,
    () => {
      setIsMobileWidgetDrawerOpen(false);
      setIsSlashPaletteOpen(false);
      setIsTestDockOpen(false);
      if (selectedFieldId) {
        setSelectedFieldId(null);
      }
    },
    { allowInInputs: true, allowInKeyboardBoundary: true }
  );

  // Studio-level shortcuts must never fire while a text editor (or a
  // dialog/select) owns focus: Ctrl/Cmd+Z is native undo, Ctrl/Cmd+B and
  // Ctrl/Cmd+I are native bold/italic in rich-text fields, and none of the
  // others should hijack keystrokes meant for whatever the author is typing.
  // They also stay out of every [data-keyboard-boundary] region, the studio
  // root included, as the raw listener they replace did, so they fire only
  // while focus sits outside the studio.
  useHotkeys(STUDIO_HOTKEYS, (e) => {
    const key = e.key.toLowerCase();
    switch (key) {
      // Slash Command Palette (/)
      case "/":
        e.preventDefault();
        setSlashTargetSectionId(undefined);
        setSlashTargetIndex(undefined);
        setIsSlashPaletteOpen(true);
        return;
      // Undo / Redo (⌘Z / Ctrl+Z, with Shift to redo)
      case "z":
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      // ⌘K / Ctrl+K stays with the site-wide search palette so the shortcut
      // means the same thing on every page (#1208); the scaffolder has its
      // own "+ CDASH Form" button in the studio header.
      // Toggle Left Sidebar (⌘B / Ctrl+B)
      case "b":
        e.preventDefault();
        setIsLeftSidebarOpen((prev) => !prev);
        return;
      // Toggle Right Inspector (⌘I / Ctrl+I)
      case "i":
        e.preventDefault();
        setIsRightInspectorOpen((prev) => !prev);
        return;
      case "j":
      case "`":
        e.preventDefault();
        setIsTerminalOpen((prev) => !prev);
        return;
      // Form Test Dock (⌘\ / Ctrl+\). Chosen because it is unclaimed by the
      // browser and by the studio's existing bindings.
      case "\\":
        e.preventDefault();
        setIsTestDockOpen((prev) => !prev);
        return;
      // "?" belongs to the page's Studio Guide (FieldManualButton), which
      // listens site-wide; F1 alone opens the protocol wizard (#1208).
      case "f1":
        e.preventDefault();
        setIsWizardOpen((prev) => !prev);
        return;
      default: {
        // Same order and numbers as the mode bar's shortcut badges.
        const mode = MODE_BY_KEY[key];
        if (mode) setActiveMode(mode);
      }
    }
  });

  const allFields = activeForm
    ? activeForm.sections.flatMap((s) => s.fields)
    : [];
  const selectedField = allFields.find((f) => f.id === selectedFieldId) || null;

  // Select Field on Mobile automatically slides in Inspector or updates tab
  const handleSelectField = (fieldId: string | null) => {
    setSelectedFieldId(fieldId);
    if (fieldId && typeof window !== "undefined" && window.innerWidth < 768) {
      setMobileActiveView("inspector");
    }
  };

  const handleOpenSlashPalette = useCallback(
    (targetSectionId?: string, targetIndex?: number) => {
      const target = activeForm
        ? resolveInsertionTarget(activeForm, selectedFieldId, {
            sectionId: targetSectionId,
            index: targetIndex,
          })
        : { sectionId: targetSectionId, index: targetIndex };
      setSlashTargetSectionId(target.sectionId);
      setSlashTargetIndex(target.index);
      setIsSlashPaletteOpen(true);
    },
    [activeForm, selectedFieldId]
  );

  const handleSelectSlashCommand = (item: SlashCommandItem) => {
    editor.insertSlashCommand(item, {
      sectionId: slashTargetSectionId,
      index: slashTargetIndex,
    });
  };

  // Study Omnibar (#544). Insertions clear any stale slash target so they
  // resolve exactly as the slash palette does (after the selected field, else
  // the form's first section) and run through handleSelectSlashCommand.
  const handleOpenOmnibar = () => {
    setSlashTargetSectionId(undefined);
    setSlashTargetIndex(undefined);
    setIsSlashPaletteOpen(false);
    setIsOmnibarOpen(true);
  };

  const handleRunOmnibarAction = (action: OmnibarAction) => {
    const showDesigner = () => {
      if (activeMode !== "designer") setActiveMode("designer");
    };
    switch (action.kind) {
      case "open_form":
        showDesigner();
        setActiveFormId(action.formId);
        setSelectedFieldId(null);
        setMobileActiveView("canvas");
        return;
      case "open_field":
        showDesigner();
        if (action.formId !== activeForm?.id) setActiveFormId(action.formId);
        handleSelectField(action.fieldId);
        return;
      case "open_visit":
        showDesigner();
        setIsLeftSidebarOpen(true);
        setLeftTab("spine");
        setActiveVisitId(action.visitId);
        setMobileActiveView("forms");
        return;
      case "insert":
        showDesigner();
        handleSelectSlashCommand(action.command);
        return;
      case "switch_mode":
        setActiveMode(action.mode);
        return;
      case "open_export_document":
        setIsExportDocModalOpen(true);
        return;
      case "open_review_package":
        setIsReviewPackageOpen(true);
        return;
    }
  };

  const handleCloseCompareModal = () => {
    setIsCompareModalOpen(false);
    setCompareBaselineId(null);
  };

  const handleNavigateFromCompare = (
    target: BaselineCompareNavigationTarget
  ) => {
    setActiveMode(target.mode);
    if (target.formId) setActiveFormId(target.formId);
    if (target.visitId) setActiveVisitId(target.visitId);
    setSelectedFieldId(target.fieldId || null);
  };

  const reviewThreadProps = useMemo(
    () => ({
      reviewThreads: study.reviewThreads || [],
      reviewAuthor,
      onReviewAuthorChange: editor.setReviewAuthor,
      onAddReviewComment: editor.addReviewComment,
      onSetReviewThreadStatus: editor.setReviewThreadStatus,
      onCommitReviewTargetChange: editor.commitReviewTargetChange,
    }),
    [
      editor.addReviewComment,
      editor.commitReviewTargetChange,
      editor.setReviewThreadStatus,
      editor.setReviewAuthor,
      reviewAuthor,
      study.reviewThreads,
    ]
  );

  if (!study || !study.forms) {
    return <CRFStudioSkeleton />;
  }

  const activeBranding = getStudyBranding(study);

  return (
    <div
      data-studio-theme={theme}
      data-keyboard-boundary="true"
      style={
        {
          "--brand-primary": activeBranding.primaryColor || "#0284c7",
          "--brand-accent": activeBranding.accentColor || "#0ea5e9",
        } as React.CSSProperties
      }
      className={`flex flex-col min-h-dvh md:min-h-0 md:h-[var(--layout-studio-budget,calc(100dvh-var(--header-height,80px)))] md:max-h-[var(--layout-studio-budget,calc(100dvh-var(--header-height,80px)))] ${
        theme === "light"
          ? "bg-slate-50 text-slate-900"
          : "bg-zinc-950 text-foreground"
      } overflow-visible md:overflow-hidden relative`}
    >
      {/* Studio Header Bar */}
      <StudioHeader
        study={study}
        activeMode={activeMode}
        canUndo={canUndo}
        canRedo={canRedo}
        theme={theme}
        onToggleTheme={toggleTheme}
        isLeftSidebarOpen={isLeftSidebarOpen}
        isRightInspectorOpen={isRightInspectorOpen}
        isTerminalOpen={isTerminalOpen}
        isTestDockOpen={isTestDockOpen}
        onToggleLeftSidebar={() => setIsLeftSidebarOpen((prev) => !prev)}
        onToggleRightInspector={() => setIsRightInspectorOpen((prev) => !prev)}
        onToggleTerminal={() => setIsTerminalOpen((prev) => !prev)}
        onToggleTestDock={() => setIsTestDockOpen((prev) => !prev)}
        onUndo={undo}
        onRedo={redo}
        onChangeMode={setActiveMode}
        onSelectPreset={editor.selectPreset}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        onOpenCdashScaffolder={() => setIsScaffolderOpen(true)}
        onOpenBranding={() => setIsBrandingOpen(true)}
        onOpenExportDocument={() => setIsExportDocModalOpen(true)}
        onOpenBaselines={() => setIsBaselinesModalOpen(true)}
        onOpenCompareBaseline={() => setIsCompareModalOpen(true)}
        onOpenLibraryUpgrades={() => setIsLibraryUpgradesOpen(true)}
        onOpenWizard={() => setIsWizardOpen(true)}
        onOpenOmnibar={handleOpenOmnibar}
        onStartSpotlightTour={startSpotlightTour}
        onCopyShareLink={handleCopyShareLink}
      />

      {/* Local Draft Save Status */}
      <div
        data-testid="draft-save-status"
        role="status"
        aria-live="polite"
        className={`absolute bottom-2 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 text-[10px] font-mono px-2.5 py-1 rounded-lg border backdrop-blur-md whitespace-nowrap ${
          draftSaveStatus === "error"
            ? "bg-rose-950/80 border-rose-500/40 text-rose-200"
            : "bg-zinc-900/80 border-zinc-800 text-zinc-400 pointer-events-none"
        }`}
      >
        {recoveredDraftSavedAt && draftSaveStatus !== "error" && (
          <span>Recovered local draft · </span>
        )}
        {draftSaveStatus === "saving" && <span>Saving…</span>}
        {draftSaveStatus === "saved" && <span>Saved locally</span>}
        {draftSaveStatus === "error" && (
          <>
            <span>
              Local save failed{draftSaveError ? `: ${draftSaveError}` : ""}
            </span>
            <button
              type="button"
              onClick={downloadDraft}
              className="underline hover:text-rose-100 cursor-pointer"
            >
              Download draft
            </button>
          </>
        )}
      </div>

      {/* Main Workspace Body based on Mode */}
      <div className="flex-1 flex min-h-0 overflow-visible md:overflow-hidden relative">
        {activeMode === "designer" && activeForm && (
          <>
            {/* Desktop / Tablet Left Sidebar: Study Spine, Forms & Global Library */}
            {isLeftSidebarOpen && (
              <aside
                aria-label="Study navigator"
                data-tour="navigator"
                className="hidden md:flex w-60 lg:w-64 2xl:w-72 bg-zinc-950 border-r border-zinc-850 flex-col shrink-0 transition-all"
              >
                <StudySpine
                  study={study}
                  activeVisitId={activeVisitId}
                  activeFormId={activeForm.id}
                  activeTab={leftTab}
                  onChangeTab={setLeftTab}
                  onSelectVisit={(id) => setActiveVisitId(id)}
                  onSelectForm={(id) => {
                    setActiveFormId(id);
                    setSelectedFieldId(null);
                  }}
                  onAddVisit={editor.addVisit}
                  onDeleteVisit={editor.deleteVisit}
                  onAddForm={editor.addForm}
                  onDuplicateForm={editor.duplicateForm}
                  onDeleteForm={editor.deleteForm}
                  onOpenCdashScaffolder={() => setIsScaffolderOpen(true)}
                  onAddField={(field) => {
                    editor.addField(field, {
                      sectionId: addFieldTargetSectionId ?? undefined,
                    });
                    setAddFieldTargetSectionId(null);
                  }}
                  onAssignFormToVisit={editor.assignFormToVisit}
                  onUnassignFormFromVisit={editor.unassignFormFromVisit}
                  onInjectCdashForm={editor.injectCdashForm}
                  onCommitFormVariant={editor.commitFormVariant}
                />
              </aside>
            )}

            {/* Mobile Stack Views (Visible only on < md screens) */}
            <div className="md:hidden flex-1 flex flex-col min-w-0">
              {mobileActiveView === "forms" && (
                <div className="flex-1 overflow-y-auto bg-zinc-950">
                  <StudySpine
                    study={study}
                    activeVisitId={activeVisitId}
                    activeFormId={activeForm.id}
                    activeTab={leftTab}
                    onChangeTab={setLeftTab}
                    onSelectVisit={(id) => setActiveVisitId(id)}
                    onSelectForm={(id) => {
                      setActiveFormId(id);
                      setSelectedFieldId(null);
                      setMobileActiveView("canvas");
                    }}
                    onAddVisit={editor.addVisit}
                    onDeleteVisit={editor.deleteVisit}
                    onAddForm={editor.addForm}
                    onDuplicateForm={editor.duplicateForm}
                    onDeleteForm={editor.deleteForm}
                    onOpenCdashScaffolder={() => setIsScaffolderOpen(true)}
                    onAddField={(field) => {
                      editor.addField(field, {
                        sectionId: addFieldTargetSectionId ?? undefined,
                      });
                      setAddFieldTargetSectionId(null);
                      setMobileActiveView("canvas");
                    }}
                    onAssignFormToVisit={editor.assignFormToVisit}
                    onUnassignFormFromVisit={editor.unassignFormFromVisit}
                    onInjectCdashForm={editor.injectCdashForm}
                    onCommitFormVariant={editor.commitFormVariant}
                  />
                </div>
              )}

              {mobileActiveView === "canvas" && (
                <div className="flex-1 flex flex-col min-w-0">
                  <FormCanvas
                    form={activeForm}
                    selectedFieldId={selectedFieldId}
                    viewport={viewport}
                    codelists={study.codelists}
                    onChangeViewport={setViewport}
                    onSelectField={handleSelectField}
                    onUpdateFormMeta={editor.updateFormMeta}
                    onAddSection={editor.addSection}
                    onDeleteSection={editor.deleteSection}
                    onUpdateSectionTitle={editor.updateSectionTitle}
                    onDuplicateField={editor.duplicateField}
                    onDeleteField={editor.deleteField}
                    onUpdateField={editor.updateField}
                    onCommitReviewTargetChange={editor.commitReviewTargetChange}
                    onOpenPalette={(sectionId) => {
                      setAddFieldTargetSectionId(sectionId ?? null);
                      setIsMobileWidgetDrawerOpen(true);
                    }}
                    onSaveAsTemplate={editor.saveFormAsTemplate}
                    onDuplicateForm={editor.duplicateForm}
                    onOpenSlashPalette={handleOpenSlashPalette}
                  />
                </div>
              )}

              {mobileActiveView === "inspector" && (
                <div className="flex-1 overflow-y-auto bg-zinc-950">
                  <InspectorPanel
                    form={activeForm}
                    selectedField={selectedField}
                    codelists={study.codelists}
                    {...reviewThreadProps}
                    onClose={() => {
                      setSelectedFieldId(null);
                      setMobileActiveView("canvas");
                    }}
                    onUpdateField={editor.updateField}
                    onUpdateFormMeta={editor.updateFormMeta}
                    onUpdateRules={editor.updateRules}
                    onSaveCodelist={editor.saveCodelist}
                    onDuplicateField={editor.duplicateFieldById}
                    onDuplicateForm={(fId) => editor.duplicateForm(fId)}
                    onRenameEverywhere={
                      selectedField
                        ? (newVar) =>
                            editor.renameFieldEverywhere(
                              selectedField.id,
                              newVar
                            )
                        : undefined
                    }
                  />
                </div>
              )}
            </div>

            {/* Center Canvas for Desktop/Tablet (Visible on md+ screens) */}
            <div
              data-tour="canvas"
              className="hidden md:flex flex-1 flex-col overflow-hidden"
            >
              <FormCanvas
                form={activeForm}
                selectedFieldId={selectedFieldId}
                viewport={viewport}
                codelists={study.codelists}
                onChangeViewport={setViewport}
                onSelectField={handleSelectField}
                onUpdateFormMeta={editor.updateFormMeta}
                onAddSection={editor.addSection}
                onDeleteSection={editor.deleteSection}
                onUpdateSectionTitle={editor.updateSectionTitle}
                onDuplicateField={editor.duplicateField}
                onDeleteField={editor.deleteField}
                onUpdateField={editor.updateField}
                onCommitReviewTargetChange={editor.commitReviewTargetChange}
                onOpenPalette={(sectionId) => {
                  setAddFieldTargetSectionId(sectionId ?? null);
                  setIsLeftSidebarOpen(true);
                  setLeftTab("palette");
                }}
                onSaveAsTemplate={editor.saveFormAsTemplate}
                onDuplicateForm={editor.duplicateForm}
                onOpenSlashPalette={handleOpenSlashPalette}
                onSwitchMode={setActiveMode}
              />
            </div>

            {/* Desktop / Tablet Right Inspector Panel */}
            {isRightInspectorOpen && (
              <aside
                aria-label="Field inspector"
                data-tour="inspector"
                className="hidden md:flex w-72 lg:w-80 xl:w-96 bg-zinc-950 shrink-0 flex-col transition-all"
              >
                <InspectorPanel
                  form={activeForm}
                  selectedField={selectedField}
                  codelists={study.codelists}
                  {...reviewThreadProps}
                  onClose={() => setSelectedFieldId(null)}
                  onUpdateField={editor.updateField}
                  onUpdateFormMeta={editor.updateFormMeta}
                  onUpdateRules={editor.updateRules}
                  onSaveCodelist={editor.saveCodelist}
                  onDuplicateField={editor.duplicateFieldById}
                  onDuplicateForm={(fId) => editor.duplicateForm(fId)}
                  onRenameEverywhere={
                    selectedField
                      ? (newVar) =>
                          editor.renameFieldEverywhere(selectedField.id, newVar)
                      : undefined
                  }
                />
              </aside>
            )}
          </>
        )}

        {activeMode === "grid" && activeForm && (
          <div className="flex-1 flex overflow-hidden w-full h-full">
            <ActiveFormGrid
              form={activeForm}
              study={study}
              selectedFieldId={selectedFieldId}
              onSelectField={handleSelectField}
              onUpdateField={editor.updateField}
              onCommitReviewTargetChange={editor.commitReviewTargetChange}
              onRenameEverywhere={(fId, newVar) =>
                editor.renameFieldEverywhere(fId, newVar)
              }
              onUpdateStudy={commit}
              onSwitchMode={setActiveMode}
              onAddField={(secId) => {
                setAddFieldTargetSectionId(secId ?? null);
                setIsLeftSidebarOpen(true);
                setLeftTab("palette");
              }}
              reviewAuthor={reviewAuthor}
            />
            {isRightInspectorOpen && (
              <aside
                aria-label="Field inspector"
                className="hidden lg:flex w-80 bg-zinc-950 shrink-0 flex-col transition-all border-l border-zinc-800"
              >
                <InspectorPanel
                  form={activeForm}
                  selectedField={selectedField}
                  codelists={study.codelists}
                  {...reviewThreadProps}
                  onClose={() => setSelectedFieldId(null)}
                  onUpdateField={editor.updateField}
                  onUpdateFormMeta={editor.updateFormMeta}
                  onUpdateRules={editor.updateRules}
                  onSaveCodelist={editor.saveCodelist}
                  onDuplicateField={editor.duplicateFieldById}
                  onDuplicateForm={(fId) => editor.duplicateForm(fId)}
                  onRenameEverywhere={
                    selectedField
                      ? (newVar) =>
                          editor.renameFieldEverywhere(selectedField.id, newVar)
                      : undefined
                  }
                />
              </aside>
            )}
          </div>
        )}

        {activeMode === "matrix" && (
          <VisitMatrixEditor
            study={study}
            onUpdateVisits={editor.updateVisits}
          />
        )}

        {activeMode === "rules" && <RuleGraphStudio study={study} />}

        {activeMode === "edc" && (
          <LiveEdcSimulator
            key={study.id}
            study={study}
            simulationState={study.simulationState}
            onUpdateSimulationState={editor.updateSimulationState}
          />
        )}

        {activeMode === "acrf" && (
          <AcrfOverlayViewer
            study={study}
            activeFormId={activeFormId}
            onOpenExportModal={() => setIsExportDocModalOpen(true)}
            onOpenBranding={() => setIsBrandingOpen(true)}
          />
        )}

        {activeMode === "export" && (
          <ExportImportModal
            study={study}
            onImportStudy={(imported) => {
              editor.requestStudyReplacement(imported, "Imported Study");
            }}
            onOpenExportDocument={() => setIsExportDocModalOpen(true)}
            onOpenBranding={() => setIsBrandingOpen(true)}
            onOpenReviewPackage={() => setIsReviewPackageOpen(true)}
          />
        )}
      </div>

      {/* In-Builder Form Test Dock (#541) */}
      <FormTestDock
        isOpen={isTestDockOpen}
        form={activeForm || null}
        values={testDockValues}
        scope={DEFAULT_TEST_SCOPE}
        codelists={study?.codelists}
        onChangeValues={setTestDockValues}
        onClose={() => setIsTestDockOpen(false)}
      />

      {/* Saved test impact of amendments (#679) */}
      {isTestDockOpen && (
        <ScenarioImpactPanel
          study={study}
          form={activeForm || null}
          values={testDockValues}
          scope={DEFAULT_TEST_SCOPE}
          activeVisitId={activeVisitId}
          onUpdateStudy={commit}
          onNavigate={handleNavigateFromCompare}
        />
      )}

      {/* In-Studio Interactive Terminal Drawer */}
      <StudioTerminal
        isOpen={isTerminalOpen}
        study={study}
        onClose={() => setIsTerminalOpen(false)}
        onOpenWizard={() => setIsWizardOpen(true)}
        onSwitchMode={setActiveMode}
        onOpenModal={(modal) => {
          if (modal === "wizard") setIsWizardOpen(true);
          else if (modal === "branding") setIsBrandingOpen(true);
          else if (modal === "diagnostics") setIsDiagnosticsOpen(true);
          else if (modal === "export") setIsExportDocModalOpen(true);
        }}
        onUpdateStudy={editor.applyStudyUpdate}
      />

      {/* Mobile Stack Bottom Navigation Bar (Visible only in Designer mode on mobile < md) */}
      {activeMode === "designer" && (
        <nav
          aria-label="Mobile View Navigation"
          className="md:hidden flex items-center justify-around border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-lg px-2 py-1.5 z-20"
        >
          <button
            onClick={() => setMobileActiveView("forms")}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
              mobileActiveView === "forms"
                ? "text-brand-cyan font-bold bg-brand-cyan/10"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <IconFileSpreadsheet className="w-4 h-4" />
            <span className="text-[10px] font-mono">
              Forms ({study.forms.length})
            </span>
          </button>

          <button
            onClick={() => setMobileActiveView("canvas")}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
              mobileActiveView === "canvas"
                ? "text-brand-cyan font-bold bg-brand-cyan/10"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <IconLayoutGrid className="w-4 h-4" />
            <span className="text-[10px] font-mono">Canvas</span>
          </button>

          <button
            onClick={() => setMobileActiveView("inspector")}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
              mobileActiveView === "inspector"
                ? "text-brand-cyan font-bold bg-brand-cyan/10"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <IconAdjustments className="w-4 h-4" />
            <span className="text-[10px] font-mono truncate max-w-[80px]">
              {selectedField ? selectedField.variableName : "Inspector"}
            </span>
          </button>
        </nav>
      )}

      {/* Mobile Widget Palette Slide-Up Bottom Sheet */}
      {isMobileWidgetDrawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
            onClick={() => setIsMobileWidgetDrawerOpen(false)}
          />
          <div
            ref={mobileWidgetSheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-widget-sheet-title"
            tabIndex={-1}
            className="fixed bottom-0 inset-x-0 z-50 max-h-[75vh] bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-4 overflow-y-auto md:hidden shadow-2xl space-y-3 animate-in slide-in-from-bottom duration-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
              <div className="flex items-center gap-2">
                <IconSparkles className="w-4 h-4 text-brand-cyan" />
                <span
                  id="mobile-widget-sheet-title"
                  className="text-xs font-mono font-bold text-white uppercase"
                >
                  Add Clinical Widget
                </span>
              </div>
              <button
                onClick={() => setIsMobileWidgetDrawerOpen(false)}
                className="p-1 rounded-full bg-zinc-900 text-zinc-400 hover:text-white"
                aria-label="Close Widget Palette"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>
            <WidgetPalette
              onAddField={(field) => {
                editor.addField(field, {
                  sectionId: addFieldTargetSectionId ?? undefined,
                });
                setAddFieldTargetSectionId(null);
              }}
            />
          </div>
        </>
      )}

      {/* Modals & Drawers */}
      <CdashScaffolderModal
        isOpen={isScaffolderOpen}
        onClose={() => setIsScaffolderOpen(false)}
        onInjectForm={editor.injectCdashForm}
      />

      <DiagnosticsDrawer
        isOpen={isDiagnosticsOpen}
        study={study}
        onClose={() => setIsDiagnosticsOpen(false)}
        onSelectForm={(fId) => {
          setActiveFormId(fId);
          setActiveMode("designer");
          setMobileActiveView("canvas");
        }}
        onUpdateStudy={commit}
      />

      {isBrandingOpen && (
        <BrandingConfigModal
          initialBranding={getStudyBranding(study)}
          onSave={editor.updateBranding}
          onClose={() => setIsBrandingOpen(false)}
        />
      )}

      {isExportDocModalOpen && (
        <ExportDocumentModal
          study={study}
          activeFormId={activeFormId}
          onClose={() => setIsExportDocModalOpen(false)}
          onOpenBranding={() => {
            setIsExportDocModalOpen(false);
            setIsBrandingOpen(true);
          }}
        />
      )}

      {isReviewPackageOpen && (
        <ReviewPackageModal
          study={study}
          isScenarioStale={(scenario) => scenarioStaleness(scenario, study)}
          onClose={() => setIsReviewPackageOpen(false)}
        />
      )}

      {/* 5-Stage Interactive Clinical Authoring Wizard */}
      <WorkflowWizardModal
        isOpen={isWizardOpen}
        study={study}
        onClose={() => setIsWizardOpen(false)}
        onSwitchMode={setActiveMode}
        onLoadPreset={editor.selectPreset}
        onApplyStudy={(updated) => {
          editor.requestStudyReplacement(updated, "Wizard Protocol");
          playSuccess();
        }}
        onStartSpotlightTour={startSpotlightTour}
      />

      {/* Interactive UI Spotlight Tour */}
      <SpotlightTourOverlay
        isOpen={isSpotlightTourOpen}
        onClose={() => setIsSpotlightTourOpen(false)}
      />

      {/* Study Replacement Unsaved Changes Confirmation Modal */}
      {pendingStudyReplacement && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="replace-study-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => editor.cancelStudyReplacement()}
        >
          <div
            ref={replaceStudyModalRef}
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3
                  id="replace-study-modal-title"
                  className="text-sm font-bold font-mono text-white"
                >
                  Unsaved Changes in Current Draft
                </h3>
                <p className="text-xs text-zinc-400 font-sans">
                  You have unsaved changes in your current study draft. Loading{" "}
                  <span className="font-mono text-brand-cyan font-bold">
                    {pendingStudyReplacement.label}
                  </span>{" "}
                  will replace your active workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => editor.cancelStudyReplacement()}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-850 transition-colors"
                aria-label="Cancel study replacement"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
              Choose &quot;Save Snapshot &amp; Replace&quot; to preserve your
              current work in local snapshots before replacing, or &quot;Discard
              &amp; Replace&quot; to switch without saving.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => editor.cancelStudyReplacement()}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-xs font-mono text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  editor.confirmStudyReplacement({ saveSnapshot: false })
                }
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-xs font-mono text-zinc-400 hover:text-red-400 border border-zinc-700 transition-colors"
              >
                Discard &amp; Replace
              </button>
              <button
                type="button"
                onClick={() =>
                  editor.confirmStudyReplacement({ saveSnapshot: true })
                }
                className="px-3.5 py-1.5 rounded-lg bg-brand-cyan hover:bg-brand-cyan/90 text-xs font-mono font-bold text-black transition-colors shadow-sm"
              >
                Save Snapshot &amp; Replace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dependency Web Sentinel Impact Warning & Deletion Confirmation Modal (#542) */}
      {impactPendingDeletion && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="impact-deletion-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => editor.cancelImpactDeletion()}
        >
          <div
            ref={impactDeletionModalRef}
            className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                  <h3
                    id="impact-deletion-modal-title"
                    className="text-sm font-bold font-mono text-white"
                  >
                    Dependency Sentinel: Blast Radius Preview
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 font-sans">
                  {impactPendingDeletion.type === "field" ? (
                    <>
                      Field{" "}
                      <span className="font-mono text-brand-cyan font-bold">
                        {impactPendingDeletion.field.variableName}
                      </span>{" "}
                      (&quot;{impactPendingDeletion.field.label}&quot;) is
                      actively referenced in your study protocol.
                    </>
                  ) : (
                    <>
                      Section{" "}
                      <span className="font-mono text-brand-cyan font-bold">
                        {impactPendingDeletion.section.title}
                      </span>{" "}
                      contains fields with active dependencies in your study
                      protocol.
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => editor.cancelImpactDeletion()}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-850 transition-colors"
                aria-label="Cancel deletion"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            {/* References Blast Radius Details */}
            <div className="bg-zinc-950/80 rounded-xl p-3 border border-zinc-850 space-y-2 max-h-52 overflow-y-auto">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold flex items-center justify-between">
                <span>
                  Active References (
                  {impactPendingDeletion.type === "field"
                    ? impactPendingDeletion.preview.references.length
                    : impactPendingDeletion.preview.totalReferencesCount}
                  )
                </span>
                <span className="text-amber-400 text-[10px]">
                  Cascading Cleanup
                </span>
              </div>
              <ul className="space-y-1.5">
                {(impactPendingDeletion.type === "field"
                  ? impactPendingDeletion.preview.references
                  : impactPendingDeletion.preview.allReferences
                ).map((ref, idx) => (
                  <li
                    key={`ref_${idx}`}
                    className="text-xs font-mono text-zinc-300 p-2 rounded bg-zinc-900/60 border border-zinc-800/80 space-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-brand-cyan">
                        {ref.type.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {ref.formName}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 font-sans">
                      {ref.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
              Confirming deletion will cleanly prune all referencing rules,
              triggers, and conditions across the protocol in a single commit,
              preserving 1-operation undo.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => editor.cancelImpactDeletion()}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-xs font-mono text-zinc-300 transition-colors"
              >
                Cancel (Keep Field)
              </button>
              <button
                type="button"
                onClick={editor.confirmImpactDeletion}
                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-mono font-bold text-white transition-colors shadow-sm"
              >
                Delete &amp; Cascade Prune
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard-Accessible Slash Command Palette (#538) */}
      <SlashPaletteModal
        isOpen={isSlashPaletteOpen}
        onClose={() => setIsSlashPaletteOpen(false)}
        onSelectCommand={handleSelectSlashCommand}
        targetSectionTitle={
          activeForm?.sections.find((s) => s.id === slashTargetSectionId)?.title
        }
        targetIndex={slashTargetIndex}
      />

      <StudyOmnibar
        isOpen={isOmnibarOpen}
        onOpen={handleOpenOmnibar}
        onClose={() => setIsOmnibarOpen(false)}
        study={study}
        activeFormId={activeForm?.id}
        selectedFieldId={selectedFieldId}
        onRunAction={handleRunOmnibarAction}
      />

      {/* Study Baselines & Version History Manager (#672) */}
      <BaselineManagerModal
        isOpen={isBaselinesModalOpen}
        onClose={() => setIsBaselinesModalOpen(false)}
        study={study}
        onRestoreBaselineAsDraft={editor.restoreBaselineAsDraft}
      />

      <BaselineCompareModal
        isOpen={isCompareModalOpen}
        onClose={handleCloseCompareModal}
        study={study}
        initialBaselineId={compareBaselineId}
        onSelectBaseline={setCompareBaselineId}
        onNavigate={handleNavigateFromCompare}
      />

      {/* Personal-library block upgrades: preview, resolve, apply, undo (#681) */}
      <LibraryUpgradeModal
        isOpen={isLibraryUpgradesOpen}
        onClose={() => setIsLibraryUpgradesOpen(false)}
        study={study}
        onApplyUpgrade={commit}
        onUndoUpgrade={undo}
      />
    </div>
  );
};
