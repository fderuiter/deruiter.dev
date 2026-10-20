"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { safeGetRawItem, safeSetRawItem } from "@/lib/safe-storage";
import { useStudioHashParams } from "@/hooks/useStudioHashParams";
import type { StudioMode, StudioTheme, StudyProtocol } from "@/lib/crf";
import type { LeftSidebarTab } from "./LeftSidebar/StudySpine";

const STARTUP_MODES: readonly StudioMode[] = [
  "designer",
  "grid",
  "matrix",
  "rules",
  "edc",
  "acrf",
  "export",
];

const LEFT_SIDEBAR_TABS: readonly LeftSidebarTab[] = [
  "spine",
  "forms",
  "palette",
];

/** The studio state a deep link restores on first render (#1451). */
interface StartupHashState {
  mode: StudioMode | null;
  form: string | null;
  field: string | null;
  theme: StudioTheme | null;
  compare: string | null;
  visit: string;
  tab: LeftSidebarTab | null;
}

function readStartupHashState(
  params: Record<string, string>
): StartupHashState {
  const mode = params.mode as StudioMode | undefined;
  const theme = params.theme;
  const tab = params.tab as LeftSidebarTab | undefined;
  return {
    mode: mode && STARTUP_MODES.includes(mode) ? mode : null,
    form: params.form || null,
    field: params.field || null,
    theme: theme === "light" || theme === "dark" ? theme : null,
    compare: params.compare || null,
    visit: params.visit || "",
    tab: tab && LEFT_SIDEBAR_TABS.includes(tab) ? tab : null,
  };
}

/**
 * Where the author is in CRF Studio: mode, form, visit, selected field,
 * sidebar tab, theme and the baseline being compared. Each is mirrored into
 * the URL hash so a link or Back/Forward restores the same view.
 */
export function useStudioNavigation(study: StudyProtocol) {
  const { params, setParam, setParams } = useStudioHashParams();
  // Deep-link state is read from the shared hash store rather than parsed
  // from window.location.hash; the useState initializers below only consult
  // it on first render.
  const startupHash = useMemo(() => readStartupHashState(params), [params]);

  const [activeMode, setActiveModeState] = useState<StudioMode>(
    () => startupHash.mode ?? "designer"
  );

  const [activeFormId, setActiveFormIdState] = useState<string>("");

  const hashFormId = startupHash.form;
  useEffect(() => {
    if (study && !activeFormId) {
      if (hashFormId && study.forms.some((f) => f.id === hashFormId)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveFormIdState(hashFormId);
        return;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveFormIdState(study.forms[0]?.id || "");
    }
  }, [study, activeFormId, hashFormId]);

  const [selectedFieldId, setSelectedFieldIdState] = useState<string | null>(
    () => startupHash.field
  );

  const [theme, setTheme] = useState<StudioTheme>(() => {
    if (startupHash.theme) {
      return startupHash.theme;
    }
    if (typeof window !== "undefined") {
      const cached = safeGetRawItem("crf_studio_theme");
      if (cached === "light" || cached === "dark") {
        return cached;
      }
    }
    return "dark";
  });

  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  // Selected baseline for the comparison panel, seeded from the URL hash so
  // reloading or reopening the page (#676) restores an equivalent comparison
  // instead of silently dropping which baseline was being reviewed.
  const [compareBaselineId, setCompareBaselineIdState] = useState<
    string | null
  >(() => startupHash.compare);
  const [activeVisitId, setActiveVisitIdState] = useState<string>(
    () => startupHash.visit
  );

  useEffect(() => {
    if (study && !activeVisitId && study.visits[0]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveVisitIdState(study.visits[0].id);
    }
  }, [study, activeVisitId]);

  const [leftTab, setLeftTabState] = useState<LeftSidebarTab>(
    () => startupHash.tab ?? "spine"
  );

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

  const toggleTheme = useCallback(() => {
    const nextTheme: StudioTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      safeSetRawItem("crf_studio_theme", nextTheme, { retainInMemory: false });
    }
    setParam("theme", nextTheme === "dark" ? null : nextTheme, {
      replace: true,
    });
  }, [theme, setParam]);

  return {
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
  };
}
