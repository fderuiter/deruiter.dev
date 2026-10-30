"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useClipboard } from "@/hooks/useClipboard";
import { THEOREMS, TheoremId } from "@/lib/proof";
import { createCustomTheorem } from "@/lib/proof-custom";
import { useAudio } from "@/components/providers/AudioProvider";
import { useStudioHashParams } from "@/hooks/useStudioHashParams";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useToast } from "@/hooks/useToast";
import { useWorkspaceAction } from "@/hooks/useWorkspaceAction";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { ProofHeader } from "@/components/proof/ProofHeader";
import { ProofCanvas } from "@/components/proof/ProofCanvas";
import { ProofLedger } from "@/components/proof/ProofLedger";
import { ProofTerminalConsole } from "@/components/proof/ProofTerminalConsole";
import { ProofExportModal } from "@/components/proof/ProofExportModal";
import { ProofCustomModal } from "@/components/proof/ProofCustomModal";
import { useProofSession } from "./useProofSession";
import { useProofSimulation } from "./useProofSimulation";
import { useProofCanvasDrag } from "./useProofCanvasDrag";
import { useProofConsoleInput } from "./useProofConsoleInput";

type CustomSession = {
  serialized: string;
  formulas: string[];
  theorem: ReturnType<typeof createCustomTheorem>;
};

function readCustomSession(
  serialized: string | null | undefined
): CustomSession | null {
  if (!serialized || serialized.length > 2048) return null;
  try {
    const formulas: unknown = JSON.parse(serialized);
    if (
      !Array.isArray(formulas) ||
      formulas.length !== 4 ||
      !formulas.every((formula) => typeof formula === "string")
    )
      return null;
    const theorem = createCustomTheorem(formulas.slice(0, 3), formulas[3]);
    return { serialized, formulas, theorem };
  } catch {
    return null;
  }
}

type ProofTab = "ledger" | "systems" | "fallacy";
const PROOF_TABS: readonly string[] = ["ledger", "systems", "fallacy"];

function tabFromHash(raw: string | undefined): ProofTab {
  return raw && PROOF_TABS.includes(raw) ? (raw as ProofTab) : "ledger";
}

function theoremFromHash(raw: string | undefined): TheoremId {
  return raw && Object.hasOwn(THEOREMS, raw)
    ? (raw as TheoremId)
    : "modus-ponens";
}

/** Toasts share the old in-page toast's lifetime for every variant. */
const TOAST_DURATION_MS = 4000;

/** Snapping toggles on G with every Ctrl, Alt and Meta combination; Shift is not checked, so G and Shift+G both match. */
const SNAPPING_HOTKEYS: readonly string[] = [
  "g",
  "Ctrl+g",
  "Alt+g",
  "Meta+g",
  "Ctrl+Alt+g",
  "Ctrl+Meta+g",
  "Alt+Meta+g",
  "Ctrl+Alt+Meta+g",
];

/** The console toggles on Ctrl+Backslash or Ctrl+Backquote, with or without Alt and Meta. */
const CONSOLE_HOTKEYS: readonly string[] = ["\\", "`"].flatMap((key) => [
  `Ctrl+${key}`,
  `Ctrl+Alt+${key}`,
  `Ctrl+Meta+${key}`,
  `Ctrl+Alt+Meta+${key}`,
]);

export function ProofWorkspaceClient() {
  const { params, setParam, setParams } = useStudioHashParams();
  const toast = useToast();
  const { playSuccess, playAutocomplete, playHover } = useAudio();

  // Theorem, tab and inspected node are derived from the hash rather than
  // parsed from window.location on startup, so the first client render
  // matches the SSR markup and deep links, in-app changes and Back/Forward
  // all flow through useStudioHashParams. The custom session stays in state
  // because it outlives the hash when the user switches to another theorem.
  const activeTheoremId = useMemo(
    () => theoremFromHash(params.theorem),
    [params.theorem]
  );
  const hashSession = useMemo(
    () =>
      activeTheoremId === "custom" ? readCustomSession(params.custom) : null,
    [activeTheoremId, params.custom]
  );
  // Seeded from the hash snapshot: empty during SSR and hydration (the
  // adjustment below then adopts a deep link), current on a client mount.
  const [customSession, setCustomSession] = useState<CustomSession | null>(
    hashSession
  );
  const activeSession =
    activeTheoremId === "custom" ? (hashSession ?? customSession) : null;
  const activeTheorem = activeSession
    ? activeSession.theorem
    : THEOREMS[activeTheoremId];
  const activeTab = useMemo(() => tabFromHash(params.tab), [params.tab]);
  const inspectedNodeId = params.inspect || activeTheorem.targetNodeId;

  const [mobileActiveView, setMobileActiveView] = useState<
    "canvas" | "ledger" | "systems" | "fallacy" | "terminal"
  >("canvas");
  const [isSnappingEnabled, setIsSnappingEnabled] = useState(true);

  // Custom Studio modal state
  const [isCustomStudioOpen, setIsCustomStudioOpen] = useState(
    activeTheoremId === "custom" && !activeSession
  );
  const [customPremise1, setCustomPremise1] = useState(
    customSession?.formulas[0] ?? "P"
  );
  const [customPremise2, setCustomPremise2] = useState(
    customSession?.formulas[1] ?? "P -> Q"
  );
  const [customPremise3, setCustomPremise3] = useState(
    customSession?.formulas[2] ?? "Q -> R"
  );
  const [customGoal, setCustomGoal] = useState(
    customSession?.formulas[3] ?? "R"
  );
  const [customError, setCustomError] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  const consoleInputRef = useRef<HTMLInputElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);
  const terminalLogsContainerRef = useRef<HTMLDivElement>(null);
  const svgCanvasRef = useRef<SVGSVGElement>(null);

  const announceToScreenReader = useCallback((text: string) => {
    setLiveAnnouncement("");
    setTimeout(() => {
      setLiveAnnouncement(text);
    }, 10);
  }, []);

  // Toasts go through the shared ToastProvider. Most call sites already
  // speak their own message through announceToScreenReader, so they pass
  // announce: false and every message is spoken exactly once.
  const showToast = useCallback(
    (
      message: string,
      type: "success" | "error" | "info" = "info",
      options: { announce?: boolean } = {}
    ) => {
      toast[type](message, {
        duration: TOAST_DURATION_MS,
        announce: options.announce ?? true,
      });
    },
    [toast]
  );

  const setActiveTab = useCallback(
    (tab: ProofTab) => {
      setParam("tab", tab === "ledger" ? null : tab, { replace: true });
    },
    [setParam]
  );

  const setInspectedNodeId = useCallback(
    (nodeId: string) => {
      setParam(
        "inspect",
        nodeId === activeTheorem.targetNodeId ? null : nodeId,
        { replace: true }
      );
    },
    [activeTheorem.targetNodeId, setParam]
  );

  const session = useProofSession({
    theorem: activeTheorem,
    feedback: {
      toast: showToast,
      announce: announceToScreenReader,
      playSuccess,
      playAutocomplete,
      playHover,
    },
    onFallacy: () => setActiveTab("fallacy"),
    onInspect: setInspectedNodeId,
    onSwitchTheorem: (theoremId) => handleSwitchTheorem(theoremId),
    onSimulate: (mode) => handleStartSimulation(mode),
    onOpenExport: () => setIsExportModalOpen(true),
  });
  const { appendLog, resetGraph } = session;

  const simulation = useProofSimulation({
    appendLogs: session.appendLogs,
    announce: announceToScreenReader,
  });
  const { abortSimulation } = simulation;

  const drag = useProofCanvasDrag({
    theorem: activeTheorem,
    edges: session.edges,
    isSnappingEnabled,
    playHover,
    announce: announceToScreenReader,
    onConnect: session.connectByDrag,
    onReject: session.rejectDrag,
  });
  const { resetLayout } = drag;

  // When the hash moves to another theorem or custom session (a deep link
  // after hydration, Back/Forward, or an in-app switch), adopt a shared
  // custom session and reset the per-theorem workspace. This adjusts state
  // during render, React's documented alternative to a sync effect, so the
  // new theorem is never painted with the previous theorem's edges.
  const theoremKey =
    activeTheoremId === "custom"
      ? `custom:${activeSession?.serialized ?? ""}`
      : activeTheoremId;
  const [appliedTheoremKey, setAppliedTheoremKey] = useState(theoremKey);
  if (appliedTheoremKey !== theoremKey) {
    setAppliedTheoremKey(theoremKey);
    if (hashSession && hashSession.serialized !== customSession?.serialized) {
      setCustomSession(hashSession);
      setCustomPremise1(hashSession.formulas[0]);
      setCustomPremise2(hashSession.formulas[1]);
      setCustomPremise3(hashSession.formulas[2]);
      setCustomGoal(hashSession.formulas[3]);
    }
    resetGraph(activeTheorem.initialEdges);
    resetLayout();
    // A custom deep link without valid formulas opens the studio to enter them.
    if (activeTheoremId === "custom" && !activeSession) {
      setIsCustomStudioOpen(true);
    }
  }

  const { copy: copyShareLink } = useClipboard({
    successMessage:
      "Proof Studio link copied to clipboard with current theorem & tab!",
    onSuccess: () => {
      try {
        playSuccess();
      } catch {}
      showToast(
        "Proof Studio link copied to clipboard with current theorem & tab!",
        "success",
        { announce: false }
      );
    },
  });

  const handleCopyShareLink = () => {
    if (typeof window !== "undefined") {
      copyShareLink(window.location.href);
    }
  };

  const toggleSnapping = useCallback(() => {
    // The toast and announcement run beside the state update, never inside
    // a setState updater (AGENTS.md section 4).
    const next = !isSnappingEnabled;
    setIsSnappingEnabled(next);
    try {
      playAutocomplete();
    } catch {}
    showToast(
      next
        ? "Magnetic Snapping enabled (20px grid & alignment crosshairs)"
        : "Magnetic Snapping disabled (freeform drag)",
      "info",
      { announce: false }
    );
    announceToScreenReader(
      next
        ? "Magnetic snapping and alignment guides enabled."
        : "Magnetic snapping disabled."
    );
  }, [isSnappingEnabled, playAutocomplete, showToast, announceToScreenReader]);

  // G toggles snapping, except while typing or inside a keyboard boundary
  // such as the terminal.
  useHotkeys(SNAPPING_HOTKEYS, () => toggleSnapping(), {
    preventDefault: true,
  });

  const toggleConsole = useCallback(() => {
    setIsConsoleOpen((prev) => {
      const next = !prev;
      if (next) {
        lastActiveElementRef.current = document.activeElement as HTMLElement;
        announceToScreenReader(
          "Command console opened split-view alongside proof workspace. Input focused."
        );
        setTimeout(() => {
          consoleInputRef.current?.focus({ preventScroll: true });
        }, 50);
      } else {
        announceToScreenReader(
          "Command console closed. Focus returned to workspace."
        );
        setTimeout(() => {
          toggleBtnRef.current?.focus({ preventScroll: true });
        }, 50);
      }
      return next;
    });
  }, [announceToScreenReader]);

  useEffect(() => {
    if (terminalLogsContainerRef.current) {
      terminalLogsContainerRef.current.scrollTop =
        terminalLogsContainerRef.current.scrollHeight;
    }
  }, [session.consoleLogs]);

  // Ctrl+Backslash and Ctrl+Backquote open the console, focus its input,
  // or close it when the input already has focus. They work from inside
  // inputs and the terminal's keyboard boundary.
  useHotkeys(
    CONSOLE_HOTKEYS,
    () => {
      if (!isConsoleOpen) {
        toggleConsole();
      } else if (document.activeElement !== consoleInputRef.current) {
        consoleInputRef.current?.focus({ preventScroll: true });
        announceToScreenReader("Focused terminal command input.");
      } else {
        toggleConsole();
      }
    },
    {
      preventDefault: true,
      allowInInputs: true,
      allowInKeyboardBoundary: true,
    }
  );

  function handleSwitchTheorem(newTheoremId: TheoremId) {
    if (newTheoremId === activeTheoremId) return;
    if (newTheoremId === "custom" && !customSession) {
      setIsCustomStudioOpen(true);
      return;
    }
    const nextTh =
      newTheoremId === "custom" && customSession
        ? customSession.theorem
        : THEOREMS[newTheoremId];
    if (!nextTh) return;

    abortSimulation();
    resetGraph(nextTh.initialEdges);
    resetLayout();

    setParams(
      {
        theorem: newTheoremId === "modus-ponens" ? null : newTheoremId,
        inspect: null,
        custom:
          newTheoremId === "custom"
            ? (customSession?.serialized ?? null)
            : null,
      },
      { replace: false }
    );

    try {
      playAutocomplete();
    } catch {}

    showToast(`Switched active theorem scenario to '${nextTh.title}'`, "info", {
      announce: false,
    });
    announceToScreenReader(`Switched theorem to ${nextTh.title}.`);
    appendLog(
      "switch",
      "info",
      `Switched active theorem to [${nextTh.title}] · ${nextTh.ruleName}\nGoal: ${nextTh.goalDescription}`
    );
  }

  function handleStartSimulation(mode: "normal" | "loop" = "normal") {
    if (simulation.isSimulating) return;
    if (activeTheoremId === "custom" && !customSession) {
      appendLog(
        "sim-unavailable",
        "info",
        "Custom simulation unavailable: entered formulas are not yet loaded into the graph."
      );
      return;
    }
    simulation.startSimulation({
      mode,
      theoremId: activeTheoremId,
      customFormulas: customSession?.formulas,
    });
    appendLog(
      "sim-start",
      "info",
      `Starting Proof Graph Simulation for [${activeTheorem.title}] in mode '${mode}'...`
    );
  }

  const handleResetLayout = () => {
    resetLayout();
    resetGraph(activeTheorem.initialEdges);
    try {
      playAutocomplete();
    } catch {}
    showToast("Workspace state reset to default layout.", "info", {
      announce: false,
    });
    announceToScreenReader("Workspace state reset to default layout.");
  };

  const handleLoadCustomTheorem = () => {
    try {
      const formulas = [
        customPremise1,
        customPremise2,
        customPremise3,
        customGoal,
      ];
      const theorem = createCustomTheorem(formulas.slice(0, 3), formulas[3]);
      const serialized = JSON.stringify(formulas);
      abortSimulation();
      setCustomSession({ serialized, formulas, theorem });
      resetGraph([]);
      resetLayout();
      setCustomError(null);
      setParams(
        { theorem: "custom", custom: serialized, inspect: null },
        { replace: false }
      );
      setIsCustomStudioOpen(false);
    } catch (error) {
      setCustomError(
        error instanceof Error ? error.message : "Invalid custom proof."
      );
    }
  };

  const consoleInput = useProofConsoleInput({
    onSubmit: (command) => {
      appendLog("cmd", "command", command);
      session.runCommand(command);
    },
    onEscape: () => {
      consoleInputRef.current?.blur();
      toggleBtnRef.current?.focus();
    },
    playAutocomplete,
  });

  useWorkspaceAction({
    id: "proof:verify-premises",
    title: "Proof Canvas: Verify Premises & Auto-Step Tactic",
    description:
      "Automatically discharge compatible deduction rules on active proof tree",
    subToolId: "proof-canvas",
    subToolName: "Proof Canvas",
    badge: "Tactic Step",
    tags: ["proof", "tactic", "logic", "verification"],
    shortcut: "Alt+A",
    handler: session.handleAutoStep,
  });

  useWorkspaceAction({
    id: "proof:reset-layout",
    title: "Proof Canvas: Reset Proof Node Layout",
    description:
      "Reset layout positions and alignment guides on active proof canvas",
    subToolId: "proof-canvas",
    subToolName: "Proof Canvas",
    badge: "Layout",
    tags: ["proof", "layout", "reset"],
    shortcut: "Alt+R",
    handler: handleResetLayout,
  });

  useWorkspaceAction({
    id: "proof:toggle-snapping",
    title: "Proof Canvas: Toggle Magnetic Snap-To-Grid",
    description:
      "Toggle magnetic grid snapping for proof canvas node positioning",
    subToolId: "proof-canvas",
    subToolName: "Proof Canvas",
    badge: "Grid",
    tags: ["proof", "snapping", "grid"],
    shortcut: "G",
    handler: toggleSnapping,
  });

  return (
    <div className="min-h-dvh bg-brand-dark text-slate-100 flex flex-col font-sans pt-20 pb-12 overflow-x-hidden">
      {/* Live Accessibility Announcement Buffer */}
      <div className="sr-only" aria-live="assertive" role="status">
        {liveAnnouncement}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full flex-1 flex flex-col gap-6">
        <ProofHeader
          activeTheoremId={activeTheoremId}
          handleSwitchTheorem={handleSwitchTheorem}
          isE_Proven={session.isE_Proven}
          edges={session.edges}
          handleCopyShareLink={handleCopyShareLink}
          setIsCustomStudioOpen={setIsCustomStudioOpen}
          setIsExportModalOpen={setIsExportModalOpen}
          mobileActiveView={mobileActiveView}
          setMobileActiveView={setMobileActiveView}
          setActiveTab={setActiveTab}
        />

        {/* Workspace Layout: Canvas on Left/Center, Ledger/Inspector on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <ProofCanvas
            activeTheorem={activeTheorem}
            edges={session.edges}
            currentFallacy={session.currentFallacy}
            nodeOffsets={drag.nodeOffsets}
            selectedNodeIds={session.selectedNodeIds}
            inspectedNodeId={inspectedNodeId}
            isSnappingEnabled={isSnappingEnabled}
            activeGuides={drag.activeGuides}
            dragConnection={drag.dragConnection}
            isSimulating={simulation.isSimulating}
            simulationProgress={simulation.simulationProgress}
            toggleSnapping={toggleSnapping}
            handleAutoStep={session.handleAutoStep}
            handleResetLayout={handleResetLayout}
            activeTacticHint={session.activeTacticHint}
            handleNodePointerDown={drag.handleNodePointerDown}
            handleNodePointerMove={drag.handleNodePointerMove}
            handleNodePointerUp={drag.handleNodePointerUp}
            handleNodeClick={session.handleNodeClick}
            handleHandlePointerDown={drag.handleHandlePointerDown}
            handleCanvasPointerMove={drag.handleCanvasPointerMove}
            handleCanvasPointerUp={drag.handleCanvasPointerUp}
            handleApplyRule={session.handleApplyRule}
            handleStartSimulation={handleStartSimulation}
            canvasWrapperRef={drag.canvasWrapperRef}
            svgCanvasRef={svgCanvasRef}
            mobileActiveView={mobileActiveView}
            handleRollback={session.handleRollback}
            ruleMatches={session.ruleMatches}
          />

          <ProofLedger
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            mobileActiveView={mobileActiveView}
            setMobileActiveView={setMobileActiveView}
            deductionLedger={session.deductionLedger}
            handleDeleteStep={session.handleDeleteStep}
            activeTheorem={activeTheorem}
            currentFallacy={session.currentFallacy}
            setCurrentFallacy={session.setCurrentFallacy}
            handleRollback={session.handleRollback}
          />
        </div>

        <ProofTerminalConsole
          isConsoleOpen={isConsoleOpen}
          toggleConsole={toggleConsole}
          mobileActiveView={mobileActiveView}
          consoleLogs={session.consoleLogs}
          consoleInput={consoleInput.consoleInput}
          setConsoleInput={consoleInput.setConsoleInput}
          handleConsoleSubmit={consoleInput.handleConsoleSubmit}
          handleConsoleKeyDown={consoleInput.handleConsoleKeyDown}
          suggestion={consoleInput.suggestion}
          consoleInputRef={consoleInputRef}
          toggleBtnRef={toggleBtnRef}
          terminalLogsContainerRef={terminalLogsContainerRef}
        />

        <ProofExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          activeTheoremId={activeTheoremId}
          theorem={
            activeTheoremId !== "custom" || customSession
              ? activeTheorem
              : undefined
          }
          edges={session.edges}
        />

        <ProofCustomModal
          isOpen={isCustomStudioOpen}
          onClose={() => setIsCustomStudioOpen(false)}
          customPremise1={customPremise1}
          customPremise2={customPremise2}
          customPremise3={customPremise3}
          customGoal={customGoal}
          setCustomPremise1={setCustomPremise1}
          setCustomPremise2={setCustomPremise2}
          setCustomPremise3={setCustomPremise3}
          setCustomGoal={setCustomGoal}
          error={customError}
          onLoadIntoWorkspace={handleLoadCustomTheorem}
        />

        <NextPrevNav
          prev={{ title: "NeuroRecon CAD Simulator", href: "/neuro" }}
          next={{
            title: "Architectural Archetype Simulator",
            href: "/simulator",
          }}
          backToHub={{ title: "Return to Experience Hub", href: "/" }}
        />
      </div>
    </div>
  );
}
