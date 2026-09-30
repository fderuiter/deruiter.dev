"use client";

import "./studio-theme.css";
import React, { useState, useCallback, useEffect, useMemo } from "react";
import { logger } from "@/lib/logger";
import { clamp } from "@/lib/game-utils";
import { useClipboard } from "@/hooks/useClipboard";
import { useToast } from "@/hooks/useToast";
import {
  StudyProtocol,
  StudioMode,
  StudioTheme,
  DeviceViewport,
  CRFForm,
  CRFField,
  CRFSection,
  EditCheckRule,
  StudyVisit,
  StudyBaseline,
  StudyReviewActor,
  CodelistDefinition,
  StudyBranding,
  getPresetByIdSync,
  getOncologyPresetSync,
  loadStudyDraft,
  saveStudyDraft,
  saveStudySnapshot,
  isDraftDirty,
  StudyProtocolEngine,
  generateCdashVariableName,
  generateEngineId,
  FieldImpactPreview,
  SectionImpactPreview,
  SlashCommandItem,
  getStudyBranding,
  EdcSimulationState,
} from "@/lib/crf";
import { useStudyAutosave } from "@/hooks/useStudyAutosave";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { StudioHeader } from "./StudioHeader";
import { StudySpine, LeftSidebarTab } from "./LeftSidebar/StudySpine";
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
import { DEFAULT_TEST_SCOPE, type ConditionalFieldValues } from "@/lib/crf";
import { SlashPaletteModal } from "./SlashPaletteModal";
import { BaselineManagerModal } from "./BaselineManagerModal";
import {
  BaselineCompareModal,
  type BaselineCompareNavigationTarget,
} from "./BaselineCompareModal";
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
import { useStudioHashParams } from "@/hooks/useStudioHashParams";
import { useAudio } from "@/components/providers/AudioProvider";
import {
  IconFileSpreadsheet,
  IconLayoutGrid,
  IconAdjustments,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";

export const CRFStudioContainer: React.FC = () => {
  // Recover the most recently acknowledged local draft (forms, visits, codelists,
  // rules, and branding together) before falling back to the built-in example so
  // a refresh never silently loses an author's in-progress study.
  const [recoveredDraftSavedAt] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const draft = loadStudyDraft();
    return draft.status === "recovered" ? draft.savedAt : null;
  });

  // Study State & History
  const [study, setStudy] = useState<StudyProtocol>(() => {
    if (typeof window !== "undefined") {
      const draft = loadStudyDraft();
      if (draft.status === "recovered") {
        return draft.study;
      }
    }

    const preset = getOncologyPresetSync();
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("crf_studio_default_branding");
        if (cached) {
          const parsedBranding = JSON.parse(cached);
          return {
            ...preset,
            branding: parsedBranding,
          };
        }
      } catch {
        // Fallback to preset
      }
    }
    return preset;
  });

  const {
    status: draftSaveStatus,
    errorMessage: draftSaveError,
    downloadDraft,
  } = useStudyAutosave(study);

  const [history, setHistory] = useState<StudyProtocol[]>([]);
  const [future, setFuture] = useState<StudyProtocol[]>([]);
  const [reviewAuthor, setReviewAuthor] = useState<StudyReviewActor>({
    name: "Study author",
    role: "Data Manager",
  });
  const [baselineStudy, setBaselineStudy] = useState<StudyProtocol>(study);
  const [pendingStudyReplacement, setPendingStudyReplacement] = useState<{
    targetStudy: StudyProtocol;
    label: string;
  } | null>(null);
  const replaceStudyModalRef = useFocusTrap<HTMLDivElement>(
    !!pendingStudyReplacement,
    {
      onEscape: () => setPendingStudyReplacement(null),
    }
  );
  const [impactPendingDeletion, setImpactPendingDeletion] = useState<
    | {
        type: "field";
        field: CRFField;
        sectionId: string;
        preview: FieldImpactPreview;
      }
    | {
        type: "section";
        section: CRFSection;
        preview: SectionImpactPreview;
      }
    | null
  >(null);
  const impactDeletionModalRef = useFocusTrap<HTMLDivElement>(
    impactPendingDeletion !== null,
    {
      onEscape: () => setImpactPendingDeletion(null),
    }
  );

  const { params, setParam, setParams } = useStudioHashParams();
  const { playSuccess } = useAudio();
  const toast = useToast();

  // Studio Navigation & Selection State
  const [activeMode, setActiveModeState] = useState<StudioMode>(() => {
    if (typeof window !== "undefined") {
      const rawMode = new URLSearchParams(window.location.hash.slice(1)).get(
        "mode"
      ) as StudioMode;
      if (
        rawMode &&
        [
          "designer",
          "grid",
          "matrix",
          "rules",
          "edc",
          "acrf",
          "export",
        ].includes(rawMode)
      ) {
        return rawMode;
      }
    }
    return "designer";
  });

  const [activeFormId, setActiveFormIdState] = useState<string>("");

  useEffect(() => {
    if (study && !activeFormId) {
      if (typeof window !== "undefined") {
        const rawForm = new URLSearchParams(window.location.hash.slice(1)).get(
          "form"
        );
        if (rawForm && study.forms.some((f) => f.id === rawForm)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setActiveFormIdState(rawForm);
          return;
        }
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveFormIdState(study.forms[0]?.id || "");
    }
  }, [study, activeFormId]);

  const [selectedFieldId, setSelectedFieldIdState] = useState<string | null>(
    () => {
      if (typeof window !== "undefined") {
        return (
          new URLSearchParams(window.location.hash.slice(1)).get("field") ||
          null
        );
      }
      return null;
    }
  );

  const [theme, setTheme] = useState<StudioTheme>(() => {
    if (typeof window !== "undefined") {
      const rawTheme = new URLSearchParams(window.location.hash.slice(1)).get(
        "theme"
      ) as StudioTheme;
      if (rawTheme === "light" || rawTheme === "dark") {
        return rawTheme;
      }
      try {
        if (typeof window.localStorage?.getItem === "function") {
          const cached = localStorage.getItem(
            "crf_studio_theme"
          ) as StudioTheme;
          if (cached === "light" || cached === "dark") {
            return cached;
          }
        }
      } catch {
        // Fallback to dark
      }
    }
    return "dark";
  });

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
  // means "no explicit target", so handleAddField falls back to the
  // selected field's section or the form's first section.
  const [addFieldTargetSectionId, setAddFieldTargetSectionId] = useState<
    string | null
  >(null);
  // Escape dismissal is already handled by the global keyboard-shortcuts
  // effect below; this trap only owns initial focus, Tab containment, and
  // returning focus to the trigger button on close.
  const mobileWidgetSheetRef = useFocusTrap<HTMLDivElement>(
    isMobileWidgetDrawerOpen
  );

  // Modals & Panels State
  const [isScaffolderOpen, setIsScaffolderOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isBrandingOpen, setIsBrandingOpen] = useState(false);
  const [isExportDocModalOpen, setIsExportDocModalOpen] = useState(false);
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
  const [isBaselinesModalOpen, setIsBaselinesModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  // Selected baseline for the comparison panel, seeded from the URL hash so
  // reloading or reopening the page (#676) restores an equivalent comparison
  // instead of silently dropping which baseline was being reviewed.
  const [compareBaselineId, setCompareBaselineIdState] = useState<
    string | null
  >(() => {
    if (typeof window !== "undefined") {
      return (
        new URLSearchParams(window.location.hash.slice(1)).get("compare") ||
        null
      );
    }
    return null;
  });
  const [slashTargetSectionId, setSlashTargetSectionId] = useState<
    string | undefined
  >();
  const [slashTargetIndex, setSlashTargetIndex] = useState<
    number | undefined
  >();
  const [activeVisitId, setActiveVisitIdState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const rawVisit = new URLSearchParams(window.location.hash.slice(1)).get(
        "visit"
      );
      if (rawVisit) return rawVisit;
    }
    return "";
  });

  useEffect(() => {
    if (study && !activeVisitId && study.visits[0]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveVisitIdState(study.visits[0].id);
    }
  }, [study, activeVisitId]);

  const [leftTab, setLeftTabState] = useState<LeftSidebarTab>(() => {
    if (typeof window !== "undefined") {
      const rawTab = new URLSearchParams(window.location.hash.slice(1)).get(
        "tab"
      ) as LeftSidebarTab | null;
      if (rawTab && ["spine", "forms", "palette"].includes(rawTab))
        return rawTab;
    }
    return "spine";
  });

  // Synchronize incoming hash state on mount or browser Back/Forward navigation
  useEffect(() => {
    const targetMode = (params.mode as StudioMode | undefined) || "designer";
    if (
      ["designer", "matrix", "rules", "edc", "acrf", "export"].includes(
        targetMode
      )
    ) {
      if (targetMode !== activeMode) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveModeState(targetMode);
      }
    }

    const defaultFormId = study?.forms[0]?.id || "";
    const targetForm =
      params.form && study?.forms.some((f) => f.id === params.form)
        ? params.form
        : defaultFormId;
    if (targetForm && targetForm !== activeFormId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveFormIdState(targetForm);
    }

    const rawVisit = params.visit as string | undefined;
    if (rawVisit && study?.visits.some((v) => v.id === rawVisit)) {
      if (rawVisit !== activeVisitId) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveVisitIdState(rawVisit);
      }
    }

    const targetField = params.field || null;
    if (targetField !== selectedFieldId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedFieldIdState(targetField);
    }

    const targetTab = (params.tab as LeftSidebarTab | undefined) || "spine";
    if (
      ["spine", "forms", "palette"].includes(targetTab) &&
      targetTab !== leftTab
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLeftTabState(targetTab);
    }

    const rawTheme = params.theme as StudioTheme | undefined;
    if (rawTheme && (rawTheme === "light" || rawTheme === "dark")) {
      if (rawTheme !== theme) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTheme(rawTheme);
      }
    } else if (params.theme === "" && theme !== "dark") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme("dark");
    }

    const rawCompare = params.compare || null;
    if (rawCompare !== compareBaselineId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompareBaselineIdState(rawCompare);
    }
    // Gated separately from the value-change check above: on first mount
    // from a reopened/shared link, compareBaselineId is already seeded from
    // the hash by its own initializer, so it can equal rawCompare on the
    // very first effect run — this still needs to open the panel.
    if (rawCompare && !isCompareModalOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsCompareModalOpen(true);
    }
  }, [
    params,
    study?.forms,
    study?.visits,
    activeMode,
    activeFormId,
    activeVisitId,
    selectedFieldId,
    leftTab,
    theme,
    compareBaselineId,
    isCompareModalOpen,
  ]);

  // Synchronized Setters with Hybrid Navigation
  const setActiveMode = useCallback(
    (mode: StudioMode) => {
      setActiveModeState(mode);
      setParam("mode", mode === "designer" ? null : mode, { replace: false });
    },
    [setParam]
  );

  const defaultFormId = study?.forms?.[0]?.id;
  const setActiveFormId = useCallback(
    (formId: string) => {
      setActiveFormIdState(formId);
      const isDefault = formId === defaultFormId;
      setParams(
        {
          form: isDefault ? null : formId,
          field: null,
        },
        { replace: true }
      );
    },
    [setParams, defaultFormId]
  );

  const setActiveVisitId = useCallback(
    (visitId: string) => {
      setActiveVisitIdState(visitId);
      setParam("visit", visitId, { replace: true });
    },
    [setParam]
  );

  const setSelectedFieldId = useCallback(
    (fieldId: string | null) => {
      setSelectedFieldIdState(fieldId);
      setParam("field", fieldId, { replace: true });
    },
    [setParam]
  );

  const setCompareBaselineId = useCallback(
    (baselineId: string | null) => {
      setCompareBaselineIdState(baselineId);
      setParam("compare", baselineId, { replace: true });
    },
    [setParam]
  );

  const setLeftTab = useCallback(
    (tab: LeftSidebarTab) => {
      setLeftTabState(tab);
      setParam("tab", tab === "spine" ? null : tab, { replace: true });
    },
    [setParam]
  );

  const handleToggleTheme = useCallback(() => {
    const nextTheme: StudioTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      try {
        if (typeof window.localStorage?.setItem === "function") {
          localStorage.setItem("crf_studio_theme", nextTheme);
        }
      } catch {
        // Ignore localstorage errors in restricted contexts
      }
    }
    setParam("theme", nextTheme === "dark" ? null : nextTheme, {
      replace: true,
    });
  }, [theme, setParam]);

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

  // Push new state onto undo history stack
  const updateStudyWithHistory = useCallback(
    (newStudy: StudyProtocol) => {
      setHistory((prev) => [...prev.slice(-20), study]);
      setFuture([]);
      setStudy(newStudy);
    },
    [study]
  );

  const handleUpdateSimulationState = useCallback(
    (nextSimulationState: EdcSimulationState) => {
      setStudy((prev) => {
        if (prev.simulationState === nextSimulationState) return prev;
        return {
          ...prev,
          simulationState: nextSimulationState,
        };
      });
    },
    []
  );

  const handleAddReviewComment = useCallback(
    (fieldId: string, body: string, author: StudyReviewActor) => {
      const result = StudyProtocolEngine.addReviewComment(
        study,
        fieldId,
        body,
        author
      );
      updateStudyWithHistory(result.study);
    },
    [study, updateStudyWithHistory]
  );

  const handleSetReviewThreadStatus = useCallback(
    (
      threadId: string,
      status: "resolved" | "open",
      author: StudyReviewActor
    ) => {
      updateStudyWithHistory(
        StudyProtocolEngine.setReviewThreadStatus(
          study,
          threadId,
          status,
          author
        )
      );
    },
    [study, updateStudyWithHistory]
  );

  const handleCommitReviewTargetChange = useCallback(
    (fieldId: string, updates?: Partial<CRFField>) => {
      let updatedStudy = study;
      const targetForm = study.forms.find((form) =>
        StudyProtocolEngine.getField(study, form.id, fieldId)
      );
      if (updates && targetForm) {
        if (updates.variableName !== undefined) {
          const rename = StudyProtocolEngine.renameFieldEverywhere(
            study,
            targetForm.id,
            fieldId,
            updates.variableName,
            updates.label,
            reviewAuthor
          );
          if (rename.error) return;
          updatedStudy = rename.study;
        } else {
          const edit = StudyProtocolEngine.updateField(
            study,
            targetForm.id,
            fieldId,
            updates
          );
          if (edit.error) return;
          updatedStudy = StudyProtocolEngine.recordReviewTargetChange(
            edit.study,
            fieldId,
            reviewAuthor
          );
        }
      } else {
        updatedStudy = StudyProtocolEngine.recordReviewTargetChange(
          study,
          fieldId,
          reviewAuthor
        );
      }
      if (updatedStudy !== study) updateStudyWithHistory(updatedStudy);
    },
    [reviewAuthor, study, updateStudyWithHistory]
  );

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, history.length - 1);

    setFuture((prev) => [study, ...prev]);
    setHistory(newHistory);
    setStudy(previous);
  }, [history, study]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);

    setHistory((prev) => [...prev, study]);
    setFuture(newFuture);
    setStudy(next);
  }, [future, study]);

  // Global Keyboard Shortcuts (Undo, Redo, Sidebar Toggles, Mode Switching, Hotkeys)
  // The tour points at the designer's panes, so show them before it starts.
  const startSpotlightTour = () => {
    setActiveMode("designer");
    setIsLeftSidebarOpen(true);
    setIsRightInspectorOpen(true);
    setIsSpotlightTourOpen(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable ||
        !!target?.closest?.("[data-keyboard-boundary]");

      // Escape key to close mobile drawers, slash palette, or clear selection. Runs regardless of
      // focus so it can still dismiss a drawer while a field inside it is focused.
      if (e.key === "Escape") {
        setIsMobileWidgetDrawerOpen(false);
        setIsSlashPaletteOpen(false);
        setIsTestDockOpen(false);
        if (selectedFieldId) {
          setSelectedFieldId(null);
        }
      }

      // Studio-level shortcuts below must never fire while a text editor (or a
      // dialog/select) owns focus: Ctrl/Cmd+Z is native undo, Ctrl/Cmd+B and
      // Ctrl/Cmd+I are native bold/italic in rich-text fields, and none of the
      // others should hijack keystrokes meant for whatever the author is typing.
      if (isInput) {
        return;
      }

      // Slash Command Palette (/)
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setSlashTargetSectionId(undefined);
        setSlashTargetIndex(undefined);
        setIsSlashPaletteOpen(true);
        return;
      }

      // Undo / Redo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
        return;
      }

      // ⌘K / Ctrl+K stays with the site-wide search palette so the shortcut
      // means the same thing on every page (#1208); the scaffolder has its
      // own "+ CDASH Form" button in the studio header.

      // Toggle Left Sidebar (⌘B / Ctrl+B)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsLeftSidebarOpen((prev) => !prev);
        return;
      }

      // Toggle Right Inspector (⌘I / Ctrl+I)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setIsRightInspectorOpen((prev) => !prev);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsTerminalOpen((prev) => !prev);
        return;
      }

      // Form Test Dock (⌘\ / Ctrl+\). Chosen because it is unclaimed by the
      // browser and by the studio's existing bindings.
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setIsTestDockOpen((prev) => !prev);
        return;
      }

      if (e.key === "`") {
        e.preventDefault();
        setIsTerminalOpen((prev) => !prev);
        return;
      }
      // "?" belongs to the page's Studio Guide (FieldManualButton), which
      // listens site-wide; F1 alone opens the protocol wizard (#1208).
      if (e.key === "F1") {
        e.preventDefault();
        setIsWizardOpen((prev) => !prev);
      } else if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        // Same order and numbers as the mode bar's shortcut badges.
        const modeByKey: Record<string, StudioMode> = {
          "1": "designer",
          "2": "grid",
          "3": "matrix",
          "4": "rules",
          "5": "edc",
          "6": "acrf",
          "7": "export",
        };
        const mode = modeByKey[e.key];
        if (mode) setActiveMode(mode);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleUndo,
    handleRedo,
    selectedFieldId,
    setActiveMode,
    setSelectedFieldId,
  ]);

  const handleSaveCodelist = useCallback(
    (newCodelist: CodelistDefinition) => {
      if (!study) return;
      updateStudyWithHistory({
        ...study,
        codelists: [
          ...study.codelists.filter((cl) => cl.id !== newCodelist.id),
          newCodelist,
        ],
      });
    },
    [study, updateStudyWithHistory]
  );

  const activeForm =
    study?.forms?.find((f) => f.id === activeFormId) || study?.forms?.[0];
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

  // Study Replacement Handler with Unsaved Draft Dirty Checking
  const requestStudyReplacement = useCallback(
    (targetStudy: StudyProtocol, label: string) => {
      if (isDraftDirty(study, baselineStudy)) {
        setPendingStudyReplacement({ targetStudy, label });
      } else {
        setBaselineStudy(targetStudy);
        updateStudyWithHistory(targetStudy);
        setActiveFormId(targetStudy.forms[0]?.id || "");
        setActiveVisitId(targetStudy.visits[0]?.id || "");
        setSelectedFieldId(null);
      }
    },
    [
      study,
      baselineStudy,
      updateStudyWithHistory,
      setActiveFormId,
      setActiveVisitId,
      setSelectedFieldId,
    ]
  );

  // Preset Selector Handler
  const handleSelectPreset = (presetId: string) => {
    const preset = getPresetByIdSync(presetId);
    if (preset) {
      requestStudyReplacement(
        preset,
        `Preset "${preset.studyName || presetId}"`
      );
    }
  };

  // Form CRUD
  const handleAddForm = () => {
    const { study: updatedStudy, form: newForm } = StudyProtocolEngine.addForm(
      study,
      "CRF",
      `New Custom Form ${study.forms.length + 1}`
    );

    updateStudyWithHistory(updatedStudy);
    setActiveFormId(newForm.id);
    setSelectedFieldId(null);
    setMobileActiveView("canvas");
  };

  const handleDuplicateForm = (formId: string) => {
    const { study: updatedStudy, duplicatedForm } =
      StudyProtocolEngine.duplicateForm(study, formId);
    if (!duplicatedForm) return;

    updateStudyWithHistory(updatedStudy);
    setActiveFormId(duplicatedForm.id);
    setSelectedFieldId(null);
    setMobileActiveView("canvas");
  };

  const handleDeleteForm = (formId: string) => {
    if (study.forms.length <= 1) return;
    const { study: updatedStudy, removedForm } = StudyProtocolEngine.removeForm(
      study,
      formId
    );
    if (!removedForm) return;

    updateStudyWithHistory(updatedStudy);

    // If active form was deleted, gracefully transition to first remaining form
    if (
      activeFormId === formId ||
      !updatedStudy.forms.some((f) => f.id === activeFormId)
    ) {
      const nextActiveForm = updatedStudy.forms[0]?.id || "";
      setActiveFormId(nextActiveForm);
      setSelectedFieldId(null);
    }
  };

  const handleAssignFormToVisit = useCallback(
    (visitId: string, formId: string) => {
      const updatedVisits = study.visits.map((v) => {
        if (v.id !== visitId) return v;
        if (v.assignedFormIds.includes(formId)) return v;
        return {
          ...v,
          assignedFormIds: [...v.assignedFormIds, formId],
        };
      });
      updateStudyWithHistory({ ...study, visits: updatedVisits });
    },
    [study, updateStudyWithHistory]
  );

  const handleUnassignFormFromVisit = useCallback(
    (visitId: string, formId: string) => {
      const updatedVisits = study.visits.map((v) => {
        if (v.id !== visitId) return v;
        return {
          ...v,
          assignedFormIds: v.assignedFormIds.filter((id) => id !== formId),
        };
      });
      updateStudyWithHistory({ ...study, visits: updatedVisits });
    },
    [study, updateStudyWithHistory]
  );

  const handleAddVisit = useCallback(() => {
    const nextIdx = study.visits.length + 1;
    const newVisit: StudyVisit = {
      id: `v_visit_${Date.now()}`,
      oid: `SE.VISIT_${nextIdx}`,
      name: `Visit ${nextIdx} (Day ${(nextIdx - 1) * 28})`,
      visitType: "Scheduled",
      targetDay: (nextIdx - 1) * 28,
      windowBefore: 3,
      windowAfter: 3,
      assignedFormIds: study.forms.filter((f) => !f.isLogForm).map((f) => f.id),
    };
    updateStudyWithHistory({ ...study, visits: [...study.visits, newVisit] });
    setActiveVisitId(newVisit.id);
  }, [study, updateStudyWithHistory, setActiveVisitId]);

  const handleDeleteVisit = useCallback(
    (visitId: string) => {
      if (study.visits.length <= 1) return;
      const filtered = study.visits.filter((v) => v.id !== visitId);
      updateStudyWithHistory({ ...study, visits: filtered });
      if (activeVisitId === visitId) {
        setActiveVisitId(filtered[0]?.id || "");
      }
    },
    [study, activeVisitId, updateStudyWithHistory, setActiveVisitId]
  );

  const handleInjectCdashForm = useCallback(
    (newForm: CRFForm, targetVisitId?: string) => {
      const nextVisits = targetVisitId
        ? study.visits.map((v) =>
            v.id === targetVisitId
              ? {
                  ...v,
                  assignedFormIds: Array.from(
                    new Set([...v.assignedFormIds, newForm.id])
                  ),
                }
              : v
          )
        : study.visits;

      updateStudyWithHistory({
        ...study,
        forms: [...study.forms, newForm],
        visits: nextVisits,
      });
      setActiveFormId(newForm.id);
      setSelectedFieldId(null);
      setMobileActiveView("canvas");
    },
    [study, updateStudyWithHistory, setActiveFormId, setSelectedFieldId]
  );

  const handleUpdateFormMeta = (updates: Partial<CRFForm>) => {
    if (!activeForm) return;
    const updatedForms = study.forms.map((f) =>
      f.id === activeForm.id ? { ...f, ...updates } : f
    );
    updateStudyWithHistory({ ...study, forms: updatedForms });
  };

  // Section CRUD
  const handleAddSection = () => {
    if (!activeForm) return;
    const newSection: CRFSection = {
      id: `sec_${Date.now()}`,
      title: `Section ${activeForm.sections.length + 1}`,
      fields: [],
    };
    const updatedForm: CRFForm = {
      ...activeForm,
      sections: [...activeForm.sections, newSection],
    };
    handleUpdateFormMeta(updatedForm);
  };

  const handleDeleteSection = (sectionId: string) => {
    if (!activeForm || activeForm.sections.length <= 1) return;
    const preview = StudyProtocolEngine.previewSectionRemoval(
      study,
      activeForm.id,
      sectionId
    );
    if (!preview.canSafelyDelete && preview.totalReferencesCount > 0) {
      const foundSec = activeForm.sections.find((s) => s.id === sectionId);
      if (foundSec) {
        setImpactPendingDeletion({
          type: "section",
          section: foundSec,
          preview,
        });
        return;
      }
    }
    const { study: updatedStudy } =
      StudyProtocolEngine.removeSectionWithCascade(
        study,
        activeForm.id,
        sectionId,
        undefined,
        reviewAuthor
      );
    updateStudyWithHistory(updatedStudy);
  };

  const handleUpdateSectionTitle = (sectionId: string, title: string) => {
    if (!activeForm) return;
    const updatedSections = activeForm.sections.map((s) =>
      s.id === sectionId ? { ...s, title } : s
    );
    handleUpdateFormMeta({ sections: updatedSections });
  };

  // Field CRUD
  const handleAddField = (
    field: CRFField,
    options?: { sectionId?: string; targetIndex?: number }
  ) => {
    if (!activeForm) return;

    let targetSectionId = options?.sectionId;
    let targetIndex = options?.targetIndex;

    // If neither section nor index is provided, position relative to currently selected field
    if (!targetSectionId && selectedFieldId) {
      for (const s of activeForm.sections) {
        const fIdx = s.fields.findIndex((f) => f.id === selectedFieldId);
        if (fIdx !== -1) {
          targetSectionId = s.id;
          if (targetIndex === undefined) {
            targetIndex = fIdx + 1;
          }
          break;
        }
      }
    }

    if (!targetSectionId && activeForm.sections.length > 0) {
      targetSectionId = activeForm.sections[0].id;
    }

    // Ensure variable name is nonconflicting
    const existingVars = new Set<string>();
    for (const s of activeForm.sections) {
      for (const f of s.fields) {
        existingVars.add(f.variableName.toUpperCase());
        if (f.repeatingColumns) {
          for (const rc of f.repeatingColumns) {
            existingVars.add(rc.variableName.toUpperCase());
          }
        }
      }
    }

    let variableName = field.variableName;
    if (existingVars.has(variableName.toUpperCase())) {
      variableName = generateCdashVariableName(variableName, existingVars);
    }
    existingVars.add(variableName.toUpperCase());

    let repeatingColumns = field.repeatingColumns;
    if (repeatingColumns && repeatingColumns.length > 0) {
      repeatingColumns = repeatingColumns.map((rc) => {
        let rcVar = rc.variableName;
        if (existingVars.has(rcVar.toUpperCase())) {
          rcVar = generateCdashVariableName(rcVar, existingVars);
        }
        existingVars.add(rcVar.toUpperCase());
        return {
          ...rc,
          id: generateEngineId("fld"),
          variableName: rcVar,
        };
      });
    }

    const fieldToInsert: CRFField = {
      ...field,
      variableName,
      ...(repeatingColumns ? { repeatingColumns } : {}),
    };

    const { study: updatedStudy, field: insertedField } =
      StudyProtocolEngine.insertField(study, activeForm.id, fieldToInsert, {
        sectionId: targetSectionId,
        targetIndex,
      });

    if (insertedField) {
      updateStudyWithHistory(updatedStudy);
      setSelectedFieldId(insertedField.id);
    } else {
      // Fallback manual splice
      const updatedSections = activeForm.sections.map((sec) => {
        if (sec.id !== targetSectionId) return sec;
        const fields = [...sec.fields];
        const insertAt =
          targetIndex !== undefined
            ? clamp(targetIndex, 0, fields.length)
            : fields.length;
        fields.splice(insertAt, 0, fieldToInsert);
        return { ...sec, fields };
      });
      handleUpdateFormMeta({ sections: updatedSections });
      setSelectedFieldId(fieldToInsert.id);
    }
    setIsMobileWidgetDrawerOpen(false);
  };

  const handleOpenSlashPalette = useCallback(
    (targetSectionId?: string, targetIndex?: number) => {
      let resolvedSectionId = targetSectionId;
      let resolvedIndex = targetIndex;

      if (!resolvedSectionId && selectedFieldId && activeForm) {
        for (const s of activeForm.sections) {
          const fIdx = s.fields.findIndex((f) => f.id === selectedFieldId);
          if (fIdx !== -1) {
            resolvedSectionId = s.id;
            if (resolvedIndex === undefined) {
              resolvedIndex = fIdx + 1;
            }
            break;
          }
        }
      }

      if (!resolvedSectionId && activeForm?.sections.length) {
        resolvedSectionId = activeForm.sections[0].id;
      }

      setSlashTargetSectionId(resolvedSectionId);
      setSlashTargetIndex(resolvedIndex);
      setIsSlashPaletteOpen(true);
    },
    [activeForm, selectedFieldId]
  );

  const handleSelectSlashCommand = (item: SlashCommandItem) => {
    if (!activeForm) return;

    let targetSecId = slashTargetSectionId;
    let targetIdx = slashTargetIndex;

    if (!targetSecId && selectedFieldId) {
      for (const s of activeForm.sections) {
        const fIdx = s.fields.findIndex((f) => f.id === selectedFieldId);
        if (fIdx !== -1) {
          targetSecId = s.id;
          if (targetIdx === undefined) {
            targetIdx = fIdx + 1;
          }
          break;
        }
      }
    }

    if (!targetSecId && activeForm.sections.length > 0) {
      targetSecId = activeForm.sections[0].id;
    }

    if (item.action === "insert_smart_block" && item.smartBlockId) {
      const res = StudyProtocolEngine.insertSmartBlock(
        study,
        activeForm.id,
        item.smartBlockId,
        {
          targetSectionId: targetSecId,
          targetIndex: targetIdx,
        }
      );
      if (!res.error) {
        updateStudyWithHistory(res.study);
        if (res.insertedFields.length > 0) {
          setSelectedFieldId(res.insertedFields[0].id);
        }
        playSuccess();
      }
    } else if (item.action === "insert_section") {
      handleAddSection();
      playSuccess();
    } else if (item.action === "insert_field") {
      const res = StudyProtocolEngine.insertAtomicSlashField(
        study,
        activeForm.id,
        item.id,
        {
          targetSectionId: targetSecId,
          targetIndex: targetIdx,
        }
      );
      if (!res.error && res.insertedField) {
        updateStudyWithHistory(res.study);
        setSelectedFieldId(res.insertedField.id);
        playSuccess();
      }
    }
  };

  const handleUpdateField = (fieldId: string, updates: Partial<CRFField>) => {
    if (!activeForm) return;
    const res = StudyProtocolEngine.updateField(
      study,
      activeForm.id,
      fieldId,
      updates
    );
    if (!res.error && res.study) {
      updateStudyWithHistory(res.study);
    }
  };

  const handleDuplicateField = (sectionId: string, fieldId: string) => {
    if (!activeForm) return;
    const { study: updatedStudy, duplicatedField } =
      StudyProtocolEngine.duplicateField(
        study,
        activeForm.id,
        fieldId,
        sectionId
      );
    if (!duplicatedField) return;

    updateStudyWithHistory(updatedStudy);
    setSelectedFieldId(duplicatedField.id);
  };

  const handleDeleteField = (sectionId: string, fieldId: string) => {
    if (!activeForm) return;
    const preview = StudyProtocolEngine.previewFieldRemoval(
      study,
      activeForm.id,
      fieldId
    );
    if (!preview.canSafelyDelete && preview.references.length > 0) {
      const foundField = activeForm.sections
        .flatMap((s) => s.fields)
        .find((f) => f.id === fieldId);
      if (foundField) {
        setImpactPendingDeletion({
          type: "field",
          field: foundField,
          sectionId,
          preview,
        });
        return;
      }
    }
    const { study: updatedStudy } = StudyProtocolEngine.removeField(
      study,
      activeForm.id,
      fieldId,
      undefined,
      reviewAuthor
    );
    updateStudyWithHistory(updatedStudy);
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  };

  const handleConfirmImpactDeletion = () => {
    if (!activeForm || !impactPendingDeletion) return;
    if (impactPendingDeletion.type === "field") {
      const { study: updatedStudy } =
        StudyProtocolEngine.removeFieldWithCascade(
          study,
          activeForm.id,
          impactPendingDeletion.field.id,
          { purgeReferencingRules: true },
          reviewAuthor
        );
      updateStudyWithHistory(updatedStudy);
      if (selectedFieldId === impactPendingDeletion.field.id) {
        setSelectedFieldId(null);
      }
    } else if (impactPendingDeletion.type === "section") {
      const { study: updatedStudy } =
        StudyProtocolEngine.removeSectionWithCascade(
          study,
          activeForm.id,
          impactPendingDeletion.section.id,
          { purgeReferencingRules: true },
          reviewAuthor
        );
      updateStudyWithHistory(updatedStudy);
    }
    setImpactPendingDeletion(null);
  };

  const handleRenameFieldEverywhere = (
    fieldId: string,
    newVariableName: string,
    author: StudyReviewActor = reviewAuthor
  ) => {
    if (!activeForm) return;
    const { study: updatedStudy, error } =
      StudyProtocolEngine.renameFieldEverywhere(
        study,
        activeForm.id,
        fieldId,
        newVariableName,
        undefined,
        author
      );
    if (error) {
      logger.warn("Failed to rename field everywhere:", error);
      return;
    }
    updateStudyWithHistory(updatedStudy);
  };

  const handleUpdateRules = (rules: EditCheckRule[]) => {
    handleUpdateFormMeta({ rules });
  };

  const handleUpdateVisits = (visits: StudyVisit[]) => {
    updateStudyWithHistory({ ...study, visits });
  };

  const handleUpdateBranding = (newBranding: StudyBranding) => {
    updateStudyWithHistory({
      ...study,
      branding: newBranding,
    });
  };

  const handleRestoreBaselineAsDraft = (
    restoredStudy: StudyProtocol,
    baseline: StudyBaseline
  ) => {
    setHistory([]);
    setFuture([]);
    setStudy(restoredStudy);
    setBaselineStudy(restoredStudy);
    setActiveFormId(restoredStudy.forms[0]?.id || "");
    setActiveVisitId(restoredStudy.visits[0]?.id || "");
    setSelectedFieldId(null);
    playSuccess();
    toast.success(`Restored draft from baseline ${baseline.versionTag}`);
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
      onReviewAuthorChange: setReviewAuthor,
      onAddReviewComment: handleAddReviewComment,
      onSetReviewThreadStatus: handleSetReviewThreadStatus,
      onCommitReviewTargetChange: handleCommitReviewTargetChange,
    }),
    [
      handleAddReviewComment,
      handleCommitReviewTargetChange,
      handleSetReviewThreadStatus,
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
        canUndo={history.length > 0}
        canRedo={future.length > 0}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        isLeftSidebarOpen={isLeftSidebarOpen}
        isRightInspectorOpen={isRightInspectorOpen}
        isTerminalOpen={isTerminalOpen}
        isTestDockOpen={isTestDockOpen}
        onToggleLeftSidebar={() => setIsLeftSidebarOpen((prev) => !prev)}
        onToggleRightInspector={() => setIsRightInspectorOpen((prev) => !prev)}
        onToggleTerminal={() => setIsTerminalOpen((prev) => !prev)}
        onToggleTestDock={() => setIsTestDockOpen((prev) => !prev)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onChangeMode={setActiveMode}
        onSelectPreset={handleSelectPreset}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        onOpenCdashScaffolder={() => setIsScaffolderOpen(true)}
        onOpenBranding={() => setIsBrandingOpen(true)}
        onOpenExportDocument={() => setIsExportDocModalOpen(true)}
        onOpenBaselines={() => setIsBaselinesModalOpen(true)}
        onOpenCompareBaseline={() => setIsCompareModalOpen(true)}
        onOpenWizard={() => setIsWizardOpen(true)}
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
                  onAddVisit={handleAddVisit}
                  onDeleteVisit={handleDeleteVisit}
                  onAddForm={handleAddForm}
                  onDuplicateForm={handleDuplicateForm}
                  onDeleteForm={handleDeleteForm}
                  onOpenCdashScaffolder={() => setIsScaffolderOpen(true)}
                  onAddField={(field) => {
                    handleAddField(field, {
                      sectionId: addFieldTargetSectionId ?? undefined,
                    });
                    setAddFieldTargetSectionId(null);
                  }}
                  onAssignFormToVisit={handleAssignFormToVisit}
                  onUnassignFormFromVisit={handleUnassignFormFromVisit}
                  onInjectCdashForm={handleInjectCdashForm}
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
                    onAddVisit={handleAddVisit}
                    onDeleteVisit={handleDeleteVisit}
                    onAddForm={handleAddForm}
                    onDuplicateForm={handleDuplicateForm}
                    onDeleteForm={handleDeleteForm}
                    onOpenCdashScaffolder={() => setIsScaffolderOpen(true)}
                    onAddField={(field) => {
                      handleAddField(field, {
                        sectionId: addFieldTargetSectionId ?? undefined,
                      });
                      setAddFieldTargetSectionId(null);
                      setMobileActiveView("canvas");
                    }}
                    onAssignFormToVisit={handleAssignFormToVisit}
                    onUnassignFormFromVisit={handleUnassignFormFromVisit}
                    onInjectCdashForm={handleInjectCdashForm}
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
                    onUpdateFormMeta={handleUpdateFormMeta}
                    onAddSection={handleAddSection}
                    onDeleteSection={handleDeleteSection}
                    onUpdateSectionTitle={handleUpdateSectionTitle}
                    onDuplicateField={handleDuplicateField}
                    onDeleteField={handleDeleteField}
                    onUpdateField={handleUpdateField}
                    onCommitReviewTargetChange={handleCommitReviewTargetChange}
                    onOpenPalette={(sectionId) => {
                      setAddFieldTargetSectionId(sectionId ?? null);
                      setIsMobileWidgetDrawerOpen(true);
                    }}
                    onDuplicateForm={handleDuplicateForm}
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
                    onUpdateField={handleUpdateField}
                    onUpdateFormMeta={handleUpdateFormMeta}
                    onUpdateRules={handleUpdateRules}
                    onSaveCodelist={handleSaveCodelist}
                    onDuplicateField={(fId) => {
                      if (activeForm) {
                        const sec = activeForm.sections.find((s) =>
                          s.fields.some((f) => f.id === fId)
                        );
                        if (sec) handleDuplicateField(sec.id, fId);
                      }
                    }}
                    onDuplicateForm={(fId) => handleDuplicateForm(fId)}
                    onRenameEverywhere={
                      selectedField
                        ? (newVar) =>
                            handleRenameFieldEverywhere(
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
                onUpdateFormMeta={handleUpdateFormMeta}
                onAddSection={handleAddSection}
                onDeleteSection={handleDeleteSection}
                onUpdateSectionTitle={handleUpdateSectionTitle}
                onDuplicateField={handleDuplicateField}
                onDeleteField={handleDeleteField}
                onUpdateField={handleUpdateField}
                onCommitReviewTargetChange={handleCommitReviewTargetChange}
                onOpenPalette={(sectionId) => {
                  setAddFieldTargetSectionId(sectionId ?? null);
                  setIsLeftSidebarOpen(true);
                  setLeftTab("palette");
                }}
                onDuplicateForm={handleDuplicateForm}
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
                  onUpdateField={handleUpdateField}
                  onUpdateFormMeta={handleUpdateFormMeta}
                  onUpdateRules={handleUpdateRules}
                  onSaveCodelist={handleSaveCodelist}
                  onDuplicateField={(fId) => {
                    if (activeForm) {
                      const sec = activeForm.sections.find((s) =>
                        s.fields.some((f) => f.id === fId)
                      );
                      if (sec) handleDuplicateField(sec.id, fId);
                    }
                  }}
                  onDuplicateForm={(fId) => handleDuplicateForm(fId)}
                  onRenameEverywhere={
                    selectedField
                      ? (newVar) =>
                          handleRenameFieldEverywhere(selectedField.id, newVar)
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
              onUpdateField={handleUpdateField}
              onCommitReviewTargetChange={handleCommitReviewTargetChange}
              onRenameEverywhere={(fId, newVar) =>
                handleRenameFieldEverywhere(fId, newVar)
              }
              onUpdateStudy={updateStudyWithHistory}
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
                  onUpdateField={handleUpdateField}
                  onUpdateFormMeta={handleUpdateFormMeta}
                  onUpdateRules={handleUpdateRules}
                  onSaveCodelist={handleSaveCodelist}
                  onDuplicateField={(fId) => {
                    if (activeForm) {
                      const sec = activeForm.sections.find((s) =>
                        s.fields.some((f) => f.id === fId)
                      );
                      if (sec) handleDuplicateField(sec.id, fId);
                    }
                  }}
                  onDuplicateForm={(fId) => handleDuplicateForm(fId)}
                  onRenameEverywhere={
                    selectedField
                      ? (newVar) =>
                          handleRenameFieldEverywhere(selectedField.id, newVar)
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
            onUpdateVisits={handleUpdateVisits}
          />
        )}

        {activeMode === "rules" && <RuleGraphStudio study={study} />}

        {activeMode === "edc" && (
          <LiveEdcSimulator
            key={study.id}
            study={study}
            simulationState={study.simulationState}
            onUpdateSimulationState={handleUpdateSimulationState}
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
              requestStudyReplacement(imported, "Imported Study");
            }}
            onOpenExportDocument={() => setIsExportDocModalOpen(true)}
            onOpenBranding={() => setIsBrandingOpen(true)}
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
        onUpdateStudy={(updated) => {
          updateStudyWithHistory(updated);
          if (
            updated.forms[0] &&
            !updated.forms.some((f) => f.id === activeFormId)
          ) {
            setActiveFormId(updated.forms[0].id);
          }
        }}
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
                handleAddField(field, {
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
        onInjectForm={handleInjectCdashForm}
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
        onUpdateStudy={updateStudyWithHistory}
      />

      {isBrandingOpen && (
        <BrandingConfigModal
          initialBranding={getStudyBranding(study)}
          onSave={handleUpdateBranding}
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

      {/* 5-Stage Interactive Clinical Authoring Wizard */}
      <WorkflowWizardModal
        isOpen={isWizardOpen}
        study={study}
        onClose={() => setIsWizardOpen(false)}
        onSwitchMode={setActiveMode}
        onLoadPreset={handleSelectPreset}
        onApplyStudy={(updated) => {
          requestStudyReplacement(updated, "Wizard Protocol");
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
          onClick={() => setPendingStudyReplacement(null)}
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
                onClick={() => setPendingStudyReplacement(null)}
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
                onClick={() => setPendingStudyReplacement(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-xs font-mono text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = pendingStudyReplacement.targetStudy;
                  setBaselineStudy(target);
                  updateStudyWithHistory(target);
                  setActiveFormId(target.forms[0]?.id || "");
                  setActiveVisitId(target.visits[0]?.id || "");
                  setSelectedFieldId(null);
                  setPendingStudyReplacement(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-xs font-mono text-zinc-400 hover:text-red-400 border border-zinc-700 transition-colors"
              >
                Discard &amp; Replace
              </button>
              <button
                type="button"
                onClick={() => {
                  saveStudySnapshot(
                    study,
                    `Snapshot before loading ${pendingStudyReplacement.label}`
                  );
                  saveStudyDraft(study);
                  const target = pendingStudyReplacement.targetStudy;
                  setBaselineStudy(target);
                  updateStudyWithHistory(target);
                  setActiveFormId(target.forms[0]?.id || "");
                  setActiveVisitId(target.visits[0]?.id || "");
                  setSelectedFieldId(null);
                  setPendingStudyReplacement(null);
                }}
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
          onClick={() => setImpactPendingDeletion(null)}
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
                onClick={() => setImpactPendingDeletion(null)}
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
                onClick={() => setImpactPendingDeletion(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-xs font-mono text-zinc-300 transition-colors"
              >
                Cancel (Keep Field)
              </button>
              <button
                type="button"
                onClick={handleConfirmImpactDeletion}
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

      {/* Study Baselines & Version History Manager (#672) */}
      <BaselineManagerModal
        isOpen={isBaselinesModalOpen}
        onClose={() => setIsBaselinesModalOpen(false)}
        study={study}
        onRestoreBaselineAsDraft={handleRestoreBaselineAsDraft}
      />

      <BaselineCompareModal
        isOpen={isCompareModalOpen}
        onClose={handleCloseCompareModal}
        study={study}
        initialBaselineId={compareBaselineId}
        onSelectBaseline={setCompareBaselineId}
        onNavigate={handleNavigateFromCompare}
      />
    </div>
  );
};
