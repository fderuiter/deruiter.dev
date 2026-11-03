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
  IconPalette,
  IconBookmark,
  IconFileSpreadsheet,
  IconDotsVertical,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightExpand,
  IconX,
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
  IconChevronDown,
} from "@tabler/icons-react";
import { getStudyBranding } from "@/lib/crf";
import {
  STUDIO_HEADER_MENUS,
  STUDIO_MODE_ORDER,
  STUDIO_STAGES,
  StudioMenuId,
  modeShortcut,
  nextStepFor,
} from "./studio-stages";
import { useFocusTrap } from "@/hooks/useFocusTrap";
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
  const [activeMenu, setActiveMenu] = useState<StudioMenuId | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSendingToPipeline, setIsSendingToPipeline] = useState(false);

  const menuTriggerRefs = React.useRef<Record<string, HTMLButtonElement | null>>(
    {}
  );
  const menuItemRefs = React.useRef<Record<string, HTMLButtonElement | null>>(
    {}
  );
  const mobileTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const mobileDrawerRef = useFocusTrap<HTMLDivElement>(isMobileMenuOpen, {
    onEscape: () => setIsMobileMenuOpen(false),
    returnFocusTo: mobileTriggerRef,
  });

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

  const currentPreset = presets.find(
    (p) => p.study.protocolNumber === study.protocolNumber
  );

  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const executeAction = (actionFn?: () => void) => {
    setActiveMenu(null);
    setIsMobileMenuOpen(false);
    actionFn?.();
  };

  const getActionMeta = (itemId: string) => {
    switch (itemId) {
      case "undo":
        return {
          icon: <IconArrowBackUp className="w-3.5 h-3.5" />,
          disabled: !canUndo,
          action: () => executeAction(onUndo),
        };
      case "redo":
        return {
          icon: <IconArrowForwardUp className="w-3.5 h-3.5" />,
          disabled: !canRedo,
          action: () => executeAction(onRedo),
        };
      case "add-form":
        return {
          icon: <IconSparkles className="w-3.5 h-3.5 text-amber-400" />,
          disabled: false,
          action: () => executeAction(onOpenFormCatalog),
        };
      case "library-upgrades":
        return {
          icon: <IconBooks className="w-3.5 h-3.5 text-brand-cyan" />,
          disabled: !onOpenLibraryUpgrades,
          action: () => executeAction(onOpenLibraryUpgrades),
        };
      case "baselines":
        return {
          icon: <IconBookmark className="w-3.5 h-3.5 text-brand-cyan" />,
          disabled: !onOpenBaselines,
          action: () => executeAction(onOpenBaselines),
        };
      case "branding":
        return {
          icon: <IconPalette className="w-3.5 h-3.5 text-brand-cyan" />,
          badge: (
            <span
              className="w-2 h-2 rounded-full shrink-0 inline-block"
              style={{ backgroundColor: branding.primaryColor }}
            />
          ),
          disabled: false,
          action: () => executeAction(onOpenBranding),
        };
      case "toggle-sidebar":
        return {
          icon: isLeftSidebarOpen ? (
            <IconLayoutSidebarLeftCollapse className="w-3.5 h-3.5 text-brand-cyan" />
          ) : (
            <IconLayoutSidebarLeftExpand className="w-3.5 h-3.5 text-zinc-400" />
          ),
          badge: isLeftSidebarOpen ? "Visible" : "Hidden",
          disabled: !onToggleLeftSidebar || activeMode !== "designer",
          action: () => executeAction(onToggleLeftSidebar),
        };
      case "toggle-inspector":
        return {
          icon: isRightInspectorOpen ? (
            <IconLayoutSidebarRightCollapse className="w-3.5 h-3.5 text-brand-cyan" />
          ) : (
            <IconLayoutSidebarRightExpand className="w-3.5 h-3.5 text-zinc-400" />
          ),
          badge: isRightInspectorOpen ? "Visible" : "Hidden",
          disabled: !onToggleRightInspector || activeMode !== "designer",
          action: () => executeAction(onToggleRightInspector),
        };
      case "toggle-test-dock":
        return {
          icon: <IconFlask2 className="w-3.5 h-3.5 text-brand-cyan" />,
          badge: isTestDockOpen ? "Open" : "Closed",
          disabled: !onToggleTestDock,
          action: () => executeAction(onToggleTestDock),
        };
      case "toggle-terminal":
        return {
          icon: <IconTerminal2 className="w-3.5 h-3.5 text-brand-cyan" />,
          badge: isTerminalOpen ? "Open" : "Closed",
          disabled: !onToggleTerminal,
          action: () => executeAction(onToggleTerminal),
        };
      case "toggle-theme":
        return {
          icon:
            theme === "light" ? (
              <IconMoon className="w-3.5 h-3.5 text-amber-500" />
            ) : (
              <IconSun className="w-3.5 h-3.5 text-amber-400" />
            ),
          badge: theme === "light" ? "Light" : "Dark",
          disabled: !onToggleTheme,
          action: () => executeAction(onToggleTheme),
        };
      case "guide":
        return {
          icon: <IconHelp className="w-3.5 h-3.5 text-brand-cyan" />,
          disabled: false,
          action: () => executeAction(onOpenWizard),
        };
      case "tour":
        return {
          icon: <IconPlayerPlay className="w-3.5 h-3.5 text-brand-cyan" />,
          disabled: !onStartSpotlightTour,
          action: () => executeAction(onStartSpotlightTour),
        };
      case "diagnostics":
        return {
          icon:
            totalIssues > 0 ? (
              <IconBug className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
            ),
          badge: totalIssues > 0 ? `${totalIssues} Issues` : "Verified",
          disabled: false,
          action: () => executeAction(onOpenDiagnostics),
        };
      case "compare-baseline":
        return {
          icon: <IconGitCompare className="w-3.5 h-3.5 text-brand-cyan" />,
          disabled: !onOpenCompareBaseline,
          action: () => executeAction(onOpenCompareBaseline),
        };
      case "simulate":
        return {
          icon: (
            <IconPlayerPlay className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
          ),
          disabled: false,
          action: () =>
            executeAction(() => {
              if (typeof window !== "undefined") {
                safeSetRawItem("crf_active_protocol", JSON.stringify(study), {
                  retainInMemory: false,
                });
                router.push("/arcade/clinical-chaos");
              }
            }),
        };
      case "pipeline":
        return {
          icon: <IconArrowRight className="w-3.5 h-3.5 text-amber-400" />,
          disabled: isSendingToPipeline,
          action: () =>
            executeAction(() => {
              void sendToPipeline();
            }),
        };
      case "export-doc":
        return {
          icon: <IconFileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />,
          disabled: false,
          action: () => executeAction(onOpenExportDocument),
        };
      case "copy-link":
        return {
          icon: <IconLink className="w-3.5 h-3.5 text-brand-cyan" />,
          disabled: !onCopyShareLink,
          action: () => executeAction(onCopyShareLink),
        };
      default:
        return {
          icon: null,
          disabled: true,
          action: () => {},
        };
    }
  };

  const getDropdownAlignmentClass = (menuId: StudioMenuId) => {
    if (menuId === "share") {
      return "left-0 md:left-auto md:right-0";
    }
    if (menuId === "check") {
      return "left-0 md:left-auto md:right-0 xl:right-auto xl:left-0";
    }
    return "left-0";
  };

  const focusFirstItem = (menuId: StudioMenuId) => {
    const menu = STUDIO_HEADER_MENUS.find((m) => m.id === menuId);
    if (!menu) return;
    for (const item of menu.items) {
      const meta = getActionMeta(item.id);
      if (!meta.disabled) {
        menuItemRefs.current[`${menuId}-${item.id}`]?.focus();
        return;
      }
    }
  };

  const focusLastItem = (menuId: StudioMenuId) => {
    const menu = STUDIO_HEADER_MENUS.find((m) => m.id === menuId);
    if (!menu) return;
    for (let i = menu.items.length - 1; i >= 0; i--) {
      const item = menu.items[i];
      const meta = getActionMeta(item.id);
      if (!meta.disabled) {
        menuItemRefs.current[`${menuId}-${item.id}`]?.focus();
        return;
      }
    }
  };

  const handleMenuTriggerKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    menuId: StudioMenuId,
    index: number
  ) => {
    const menuIds = STUDIO_HEADER_MENUS.map((m) => m.id);
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setActiveMenu(menuId);
      focusFirstItem(menuId);
      if (typeof window !== "undefined") {
        requestAnimationFrame(() => {
          focusFirstItem(menuId);
        });
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveMenu(menuId);
      focusLastItem(menuId);
      if (typeof window !== "undefined") {
        requestAnimationFrame(() => {
          focusLastItem(menuId);
        });
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIndex = (index + 1) % menuIds.length;
      const nextMenuId = menuIds[nextIndex];
      if (activeMenu !== null) {
        setActiveMenu(nextMenuId);
      }
      menuTriggerRefs.current[nextMenuId]?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIndex = (index - 1 + menuIds.length) % menuIds.length;
      const prevMenuId = menuIds[prevIndex];
      if (activeMenu !== null) {
        setActiveMenu(prevMenuId);
      }
      menuTriggerRefs.current[prevMenuId]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      const firstMenuId = menuIds[0];
      if (activeMenu !== null) {
        setActiveMenu(firstMenuId);
      }
      menuTriggerRefs.current[firstMenuId]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      const lastMenuId = menuIds[menuIds.length - 1];
      if (activeMenu !== null) {
        setActiveMenu(lastMenuId);
      }
      menuTriggerRefs.current[lastMenuId]?.focus();
    } else if (e.key === "Escape") {
      if (activeMenu !== null) {
        e.preventDefault();
        setActiveMenu(null);
        menuTriggerRefs.current[menuId]?.focus();
      }
    }
  };

  const handleMenuItemKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    menuId: StudioMenuId,
    itemId: string
  ) => {
    const menu = STUDIO_HEADER_MENUS.find((m) => m.id === menuId);
    if (!menu) return;
    const enabledItems = menu.items.filter((i) => !getActionMeta(i.id).disabled);
    if (enabledItems.length === 0) return;
    const foundIndex = enabledItems.findIndex((i) => i.id === itemId);
    const currentIndex = foundIndex >= 0 ? foundIndex : 0;
    const menuIds = STUDIO_HEADER_MENUS.map((m) => m.id);
    const currentMenuIndex = menuIds.indexOf(menuId);

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const meta = getActionMeta(itemId);
      if (!meta.disabled) {
        meta.action();
        menuTriggerRefs.current[menuId]?.focus();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % enabledItems.length;
      menuItemRefs.current[`${menuId}-${enabledItems[nextIndex].id}`]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex =
        (currentIndex - 1 + enabledItems.length) % enabledItems.length;
      menuItemRefs.current[`${menuId}-${enabledItems[prevIndex].id}`]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      menuItemRefs.current[`${menuId}-${enabledItems[0].id}`]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      menuItemRefs.current[
        `${menuId}-${enabledItems[enabledItems.length - 1].id}`
      ]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setActiveMenu(null);
      menuTriggerRefs.current[menuId]?.focus();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextMenuIndex = (currentMenuIndex + 1) % menuIds.length;
      const nextMenuId = menuIds[nextMenuIndex];
      setActiveMenu(nextMenuId);
      menuTriggerRefs.current[nextMenuId]?.focus();
      focusFirstItem(nextMenuId);
      if (typeof window !== "undefined") {
        requestAnimationFrame(() => {
          focusFirstItem(nextMenuId);
        });
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevMenuIndex =
        (currentMenuIndex - 1 + menuIds.length) % menuIds.length;
      const prevMenuId = menuIds[prevMenuIndex];
      setActiveMenu(prevMenuId);
      menuTriggerRefs.current[prevMenuId]?.focus();
      focusFirstItem(prevMenuId);
      if (typeof window !== "undefined") {
        requestAnimationFrame(() => {
          focusFirstItem(prevMenuId);
        });
      }
    } else if (e.key === "Tab") {
      setActiveMenu(null);
    }
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
      className="border-b border-zinc-850 bg-zinc-950/95 sticky top-0 z-30 backdrop-blur-xl"
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
          <div className="hidden sm:flex items-center min-w-0 sm:max-w-[180px] md:max-w-[220px] shrink">
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

          {/* Transparent click-outside backdrop when activeMenu is open */}
          {activeMenu !== null && (
            <div
              className="fixed inset-0 z-40 bg-transparent"
              onClick={() => setActiveMenu(null)}
              aria-hidden="true"
            />
          )}

          {/* Desktop Secondary Action Menus: Edit, View, Check, Share */}
          <nav
            role="menubar"
            aria-label="Studio Menus"
            className="hidden md:flex items-center gap-0.5 shrink-0 relative z-50 ml-1"
          >
            {STUDIO_HEADER_MENUS.map((menu, menuIndex) => {
              const isOpen = activeMenu === menu.id;
              return (
                <div key={menu.id} className="relative">
                  <button
                    ref={(el) => {
                      menuTriggerRefs.current[menu.id] = el;
                    }}
                    id={`menu-trigger-${menu.id}`}
                    type="button"
                    role="button"
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    aria-controls={`menu-panel-${menu.id}`}
                    onClick={() =>
                      setActiveMenu((prev) => (prev === menu.id ? null : menu.id))
                    }
                    onKeyDown={(e) =>
                      handleMenuTriggerKeyDown(e, menu.id, menuIndex)
                    }
                    className={`px-2.5 py-1 text-xs font-mono font-medium rounded-lg transition-colors inline-flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan ${
                      isOpen
                        ? "bg-zinc-800 text-white font-semibold shadow-xs"
                        : "text-zinc-300 hover:text-white hover:bg-zinc-900"
                    }`}
                  >
                    <span>{menu.label}</span>
                    <IconChevronDown
                      className={`w-3 h-3 text-zinc-400 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  <div
                    id={`menu-panel-${menu.id}`}
                    role="menu"
                    aria-label={`${menu.label} Menu`}
                    aria-labelledby={`menu-trigger-${menu.id}`}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setActiveMenu(null);
                        menuTriggerRefs.current[menu.id]?.focus();
                      }
                    }}
                    className={`absolute ${getDropdownAlignmentClass(
                      menu.id
                    )} top-full mt-1.5 w-72 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1.5 z-50 ${
                      isOpen
                        ? "block animate-in fade-in zoom-in-95 duration-100"
                        : "hidden"
                    }`}
                  >
                    <div className="px-2 py-1 mb-1 border-b border-zinc-800/80">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                        {menu.description}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {menu.items.map((item) => {
                        const meta = getActionMeta(item.id);
                        return (
                          <React.Fragment key={item.id}>
                            {item.dividerBefore && (
                              <div
                                role="separator"
                                className="my-1 border-t border-zinc-800/80"
                              />
                            )}
                            <button
                              ref={(el) => {
                                menuItemRefs.current[
                                  `${menu.id}-${item.id}`
                                ] = el;
                              }}
                              type="button"
                              role="menuitem"
                              aria-label={item.label}
                              disabled={meta.disabled}
                              onClick={meta.action}
                              onKeyDown={(e) =>
                                handleMenuItemKeyDown(e, menu.id, item.id)
                              }
                              title={item.description}
                              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs font-mono rounded-lg text-left transition-colors outline-none focus-visible:ring-1 focus-visible:ring-brand-cyan ${
                                meta.disabled
                                  ? "text-zinc-600 opacity-40 cursor-not-allowed"
                                  : "text-zinc-200 hover:text-white hover:bg-zinc-800 focus:bg-zinc-800"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="shrink-0">{meta.icon}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold truncate">
                                    {item.label}
                                  </div>
                                  <div className="text-[10px] text-zinc-500 truncate">
                                    {item.id === "simulate"
                                      ? "Simulate Protocol in Clinical Chaos"
                                      : item.description}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {meta.badge && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                                    {meta.badge}
                                  </span>
                                )}
                                {item.shortcut && (
                                  <kbd className="text-[10px] font-mono text-zinc-500 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-800">
                                    {item.shortcut}
                                  </kbd>
                                )}
                              </div>
                            </button>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Right Side: Omnibar, Diagnostics, Theme & Mobile Actions Trigger */}
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

          {/* Theme Toggle (Dark / Light) */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors hidden sm:inline-flex items-center gap-1 text-[11px] font-mono shrink-0"
              title={
                theme === "light"
                  ? "Switch to Dark Studio Mode"
                  : "Switch to Clinical Light Mode"
              }
              aria-label={
                theme === "light"
                  ? "Switch to Dark Studio Mode"
                  : "Switch to Clinical Light Mode"
              }
            >
              {theme === "light" ? (
                <IconMoon className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <IconSun className="w-3.5 h-3.5 text-amber-400" />
              )}
            </button>
          )}

          {/* Conformance Diagnostics Badge */}
          <button
            onClick={onOpenDiagnostics}
            data-tour="conformance"
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all border shrink-0 ${
              totalIssues > 0
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
            }`}
            title="Open CDISC Conformance Diagnostics"
          >
            {totalIssues > 0 ? (
              <IconBug className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="hidden md:inline">
              {totalIssues > 0 ? `${totalIssues} Issues` : "Verified"}
            </span>
          </button>

          {/* Mobile Actions Drawer Trigger Button (replaces unorganized 17-item dump) */}
          <div className="relative md:hidden">
            <button
              ref={mobileTriggerRef}
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors inline-flex items-center gap-1 shrink-0"
              title="More Actions & Tools"
              aria-label="More Studio Actions"
              aria-expanded={isMobileMenuOpen}
            >
              <IconDotsVertical className="w-4 h-4" />
              {totalIssues > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>

            {/* Mobile Menu Popover */}
            {isMobileMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-hidden="true"
                />
                <div
                  ref={mobileDrawerRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Studio Actions"
                  tabIndex={-1}
                  className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] max-h-[75dvh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-3 z-50 md:hidden space-y-3 animate-in fade-in zoom-in-95 duration-150 outline-none"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800 px-1">
                    <span className="text-xs font-bold font-mono text-zinc-300 uppercase">
                      Studio Actions
                    </span>
                    <button
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-1 text-zinc-500 hover:text-white rounded"
                      aria-label="Close Studio Actions"
                    >
                      <IconX className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {STUDIO_HEADER_MENUS.map((menu) => (
                    <div key={menu.id} className="space-y-1">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 px-1">
                        {menu.label}
                      </div>
                      <div className="space-y-0.5">
                        {menu.items.map((item) => {
                          const meta = getActionMeta(item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              aria-label={item.label}
                              disabled={meta.disabled}
                              onClick={meta.action}
                              title={item.description}
                              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs font-mono rounded-lg text-left transition-colors ${
                                meta.disabled
                                  ? "text-zinc-600 opacity-40 cursor-not-allowed"
                                  : "text-zinc-200 hover:text-white hover:bg-zinc-800 active:scale-[0.98]"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="shrink-0">{meta.icon}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold truncate">
                                    {item.label}
                                  </div>
                                  <div className="text-[10px] text-zinc-500 truncate">
                                    {item.id === "simulate"
                                      ? "Simulate Protocol in Clinical Chaos"
                                      : item.description}
                                  </div>
                                </div>
                              </div>
                              {item.shortcut && (
                                <kbd className="text-[9px] font-mono text-zinc-500 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-800 shrink-0">
                                  {item.shortcut}
                                </kbd>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
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

        {/* Right Side: In-Studio Terminal Toggle & Workspace Sidebar Toggles */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          {/* Form Test Dock Toggle (#541) */}
          {onToggleTestDock && (
            <button
              onClick={onToggleTestDock}
              aria-pressed={isTestDockOpen}
              className={`p-1.5 rounded-lg border transition-colors inline-flex items-center gap-1.5 text-[11px] font-mono shrink-0 ${
                isTestDockOpen
                  ? "bg-brand-cyan/20 text-brand-cyan border-brand-cyan/40"
                  : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border-zinc-800"
              }`}
              title="Toggle Form Test Dock (⌘\\)"
            >
              <IconFlask2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline font-bold">Test</span>
            </button>
          )}

          {/* Terminal / CLI Drawer Toggle */}
          {onToggleTerminal && (
            <button
              onClick={onToggleTerminal}
              className={`p-1.5 rounded-lg border transition-colors inline-flex items-center gap-1.5 text-[11px] font-mono shrink-0 ${
                isTerminalOpen
                  ? "bg-brand-cyan/20 text-brand-cyan border-brand-cyan/40"
                  : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border-zinc-800"
              }`}
              title="Toggle Interactive In-Studio Terminal (⌘J or `)"
            >
              <IconTerminal2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline font-bold">Terminal</span>
            </button>
          )}

          {/* Left Sidebar Toggle Button */}
          {activeMode === "designer" && onToggleLeftSidebar && (
            <button
              onClick={onToggleLeftSidebar}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors hidden md:inline-flex items-center gap-1 text-[11px] font-mono shrink-0"
              title="Toggle Left Forms Navigator (⌘B)"
            >
              {isLeftSidebarOpen ? (
                <IconLayoutSidebarLeftCollapse className="w-3.5 h-3.5 text-brand-cyan" />
              ) : (
                <IconLayoutSidebarLeftExpand className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>
          )}

          {/* Right Inspector Toggle Button */}
          {activeMode === "designer" && onToggleRightInspector && (
            <button
              onClick={onToggleRightInspector}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors hidden md:inline-flex items-center gap-1 text-[11px] font-mono shrink-0"
              title="Toggle Property Inspector (⌘I)"
            >
              {isRightInspectorOpen ? (
                <IconLayoutSidebarRightCollapse className="w-3.5 h-3.5 text-brand-cyan" />
              ) : (
                <IconLayoutSidebarRightExpand className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
