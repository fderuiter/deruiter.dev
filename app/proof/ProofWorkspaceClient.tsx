"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useClipboard } from "@/hooks/useClipboard";
import {
  getSuggestion,
  evaluateProofStatus,
  canConnect,
  getNextTacticHint,
  getFallacyDiagnosis,
  getDeductionLedger,
  pruneStepOrNode,
  exportWorkspaceProof,
  applyRuleToAsts,
  areAstsEqual,
  parseFormula,
  getCompatibleTargets,
  computeMagneticSnap,
  AlignmentGuide,
  THEOREMS,
  TheoremId,
  Edge,
  FallacyDiagnosis,
  ProofNode,
} from "@/lib/proof-utils";
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
import {
  ProofTerminalConsole,
  TerminalLog,
} from "@/components/proof/ProofTerminalConsole";
import { ProofExportModal } from "@/components/proof/ProofExportModal";
import { ProofCustomModal } from "@/components/proof/ProofCustomModal";
import { ProofCoachTour } from "@/components/proof/ProofCoachTour";

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

  const [edges, setEdges] = useState<Edge[]>(activeTheorem.initialEdges);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [mobileActiveView, setMobileActiveView] = useState<
    "canvas" | "ledger" | "systems" | "fallacy" | "terminal"
  >("canvas");
  const [currentFallacy, setCurrentFallacy] = useState<FallacyDiagnosis | null>(
    null
  );

  // Custom Node drag offsets
  const [nodeOffsets, setNodeOffsets] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  // Magnetic Snapping & Drag Guides state
  const [isSnappingEnabled, setIsSnappingEnabled] = useState(true);
  const [activeGuides, setActiveGuides] = useState<AlignmentGuide[]>([]);
  const [dragConnection, setDragConnection] = useState<{
    sourceId: string;
    sourceX: number;
    sourceY: number;
    currentX: number;
    currentY: number;
    hoveredTargetId: string | null;
    isValid: boolean;
    ruleBadge?: string;
  } | null>(null);

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
    setEdges(activeTheorem.initialEdges);
    setSelectedNodeIds([]);
    setNodeOffsets({});
    setCurrentFallacy(null);
    // A custom deep link without valid formulas opens the studio to enter them.
    if (activeTheoremId === "custom" && !activeSession) {
      setIsCustomStudioOpen(true);
    }
  }

  const [customError, setCustomError] = useState<string | null>(null);

  // Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // CLI Console State
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);
  const [consoleInput, setConsoleInput] = useState("");
  const [consoleLogs, setConsoleLogs] = useState<TerminalLog[]>([
    {
      id: "welcome",
      type: "info",
      text: "Interactive Logic Proof Canvas v3.0.0 · Multi-Theorem Formal Verification Suite\nClick nodes to select premises, fire inference rules from the Rule Palette, or run CLI commands. Type 'help' for command syntax.",
    },
  ]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState<{
    step: number;
    total: number;
    log: string;
  } | null>(null);

  // Refs
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initOffsetX: number;
    initOffsetY: number;
  } | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const lastSnapAudioTimeRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const watchdogRef = useRef<NodeJS.Timeout | null>(null);
  const pendingLogsRef = useRef<TerminalLog[]>([]);
  const nextIdRef = useRef(0);
  const initWorkerRef = useRef<() => void>(() => {});
  const consoleInputRef = useRef<HTMLInputElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);
  const terminalLogsContainerRef = useRef<HTMLDivElement>(null);
  const svgCanvasRef = useRef<SVGSVGElement>(null);

  // Frame Throttling Refs for Node & Connection Dragging
  const nodeDragRafIdRef = useRef<number | null>(null);
  const pendingNodeDragRef = useRef<{
    clientX: number;
    clientY: number;
    nodeId: string;
  } | null>(null);
  const connDragRafIdRef = useRef<number | null>(null);
  const pendingConnDragRef = useRef<{
    clientX: number;
    clientY: number;
  } | null>(null);

  const activeTheoremRef = useRef(activeTheorem);
  const nodeOffsetsRef = useRef(nodeOffsets);
  const isSnappingEnabledRef = useRef(isSnappingEnabled);
  const dragConnectionRef = useRef(dragConnection);

  useEffect(() => {
    activeTheoremRef.current = activeTheorem;
  }, [activeTheorem]);

  useEffect(() => {
    nodeOffsetsRef.current = nodeOffsets;
  }, [nodeOffsets]);

  useEffect(() => {
    isSnappingEnabledRef.current = isSnappingEnabled;
  }, [isSnappingEnabled]);

  useEffect(() => {
    dragConnectionRef.current = dragConnection;
  }, [dragConnection]);

  // Clean cancellation of frame callbacks on component unmount
  useEffect(() => {
    return () => {
      if (nodeDragRafIdRef.current !== null) {
        cancelAnimationFrame(nodeDragRafIdRef.current);
        nodeDragRafIdRef.current = null;
      }
      if (connDragRafIdRef.current !== null) {
        cancelAnimationFrame(connDragRafIdRef.current);
        connDragRafIdRef.current = null;
      }
    };
  }, []);

  const { playSuccess, playAutocomplete, playHover } = useAudio();

  const announceToScreenReader = React.useCallback((text: string) => {
    setLiveAnnouncement("");
    setTimeout(() => {
      setLiveAnnouncement(text);
    }, 10);
  }, []);

  // Toasts go through the shared ToastProvider. Most call sites already
  // speak their own message through announceToScreenReader, so they pass
  // announce: false and every message is spoken exactly once.
  const showToast = React.useCallback(
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

  const setActiveTab = React.useCallback(
    (tab: ProofTab) => {
      setParam("tab", tab === "ledger" ? null : tab, { replace: true });
    },
    [setParam]
  );

  const setInspectedNodeId = React.useCallback(
    (nodeId: string) => {
      setParam(
        "inspect",
        nodeId === activeTheorem.targetNodeId ? null : nodeId,
        { replace: true }
      );
    },
    [activeTheorem.targetNodeId, setParam]
  );

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

  const { isC_Proven, isE_Proven } = useMemo(
    () => evaluateProofStatus(edges, activeTheorem),
    [edges, activeTheorem]
  );

  const activeTacticHint = useMemo(
    () => getNextTacticHint(edges, activeTheorem),
    [edges, activeTheorem]
  );

  const deductionLedger = useMemo(
    () => getDeductionLedger(edges, activeTheorem),
    [edges, activeTheorem]
  );

  const toggleSnapping = React.useCallback(() => {
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

  const toggleConsole = React.useCallback(() => {
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

  const clearWatchdog = React.useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const currentRequestIdRef = useRef(0);

  const handleWatchdogTimeout = React.useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }
    initWorkerRef.current();
    setIsSimulating(false);
    setSimulationProgress(null);
    clearWatchdog();

    nextIdRef.current += 1;
    const outputLogId = `out-timeout-${nextIdRef.current}`;
    setConsoleLogs((prev) => [
      ...prev,
      {
        id: outputLogId,
        type: "error",
        text: "Background calculation terminated by watchdog: execution exceeded 5-second limit (potential infinite loop detected)",
      },
    ]);
    announceToScreenReader(
      "Background calculation terminated by watchdog: execution exceeded 5-second limit."
    );
  }, [clearWatchdog, announceToScreenReader]);

  const resetWatchdog = React.useCallback(() => {
    clearWatchdog();
    watchdogRef.current = setTimeout(() => {
      handleWatchdogTimeout();
    }, 5000);
  }, [clearWatchdog, handleWatchdogTimeout]);

  const initWorker = React.useCallback(() => {
    if (typeof window !== "undefined" && typeof Worker !== "undefined") {
      if (workerRef.current) {
        workerRef.current.terminate();
      }

      const worker = new Worker(new URL("./proof-worker.ts", import.meta.url));

      worker.onmessage = (event) => {
        const message = event.data;
        if (!message) return;

        // Discard stale in-flight messages from previous request IDs
        if (
          message.requestId &&
          message.requestId !== currentRequestIdRef.current
        ) {
          return;
        }

        resetWatchdog();

        if (message.type === "progress") {
          pendingLogsRef.current.push({
            id: `sim-${Date.now()}-${Math.random()}`,
            type: "output",
            text: message.log,
          });
          announceToScreenReader(`Simulation update: ${message.log}`);
        } else if (message.type === "done") {
          setIsSimulating(false);
          setSimulationProgress(null);
          clearWatchdog();

          setConsoleLogs((prev) => [
            ...prev,
            {
              id: `sim-done-${Date.now()}`,
              type: "success",
              text: `✔ Background Simulation completed successfully with ${message.stepsCompleted} steps.`,
            },
          ]);
          announceToScreenReader(
            "Background proof simulation completed successfully."
          );
        } else if (message.type === "error") {
          setIsSimulating(false);
          setSimulationProgress(null);
          clearWatchdog();

          setConsoleLogs((prev) => [
            ...prev,
            {
              id: `sim-err-${Date.now()}`,
              type: "error",
              text: `Background Simulation error: ${message.message}`,
            },
          ]);
          announceToScreenReader(
            `Background proof simulation error: ${message.message}`
          );
        }
      };

      workerRef.current = worker;
    }
  }, [clearWatchdog, resetWatchdog, announceToScreenReader]);

  useEffect(() => {
    initWorkerRef.current = initWorker;
  }, [initWorker]);

  useEffect(() => {
    initWorker();

    // 100ms batch logs flush timer
    const flushInterval = setInterval(() => {
      if (pendingLogsRef.current.length > 0) {
        const logsToAppend = [...pendingLogsRef.current];
        pendingLogsRef.current = [];

        setConsoleLogs((prev) => [...prev, ...logsToAppend]);

        const stepLogs = logsToAppend.filter(
          (log) => log.type === "output" && log.text.includes("[Step")
        );
        if (stepLogs.length > 0) {
          const lastStepLog = stepLogs[stepLogs.length - 1];
          const match = lastStepLog.text.match(/\[Step (\d+)\/(\d+)\] (.*)/);
          if (match) {
            const step = parseInt(match[1], 10);
            const total = parseInt(match[2], 10);
            const textLog = match[3];
            setSimulationProgress({ step, total, log: textLog });
          }
        }
      }
    }, 100);

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      clearInterval(flushInterval);
      clearWatchdog();
    };
  }, [initWorker, clearWatchdog]);

  useEffect(() => {
    if (terminalLogsContainerRef.current) {
      terminalLogsContainerRef.current.scrollTop =
        terminalLogsContainerRef.current.scrollHeight;
    }
  }, [consoleLogs]);

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

  const handleSwitchTheorem = React.useCallback(
    (newTheoremId: TheoremId) => {
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

      if (workerRef.current) {
        currentRequestIdRef.current += 1;
        workerRef.current.postMessage({ type: "ABORT" });
        setIsSimulating(false);
        setSimulationProgress(null);
        clearWatchdog();
      }

      setEdges(nextTh.initialEdges);
      setSelectedNodeIds([]);
      setNodeOffsets({});
      setCurrentFallacy(null);

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

      showToast(
        `Switched active theorem scenario to '${nextTh.title}'`,
        "info",
        {
          announce: false,
        }
      );
      announceToScreenReader(`Switched theorem to ${nextTh.title}.`);

      setConsoleLogs((prev) => [
        ...prev,
        {
          id: `switch-${Date.now()}`,
          type: "info",
          text: `Switched active theorem to [${nextTh.title}] · ${nextTh.ruleName}\nGoal: ${nextTh.goalDescription}`,
        },
      ]);
    },
    [
      activeTheoremId,
      customSession,
      clearWatchdog,
      setParams,
      playAutocomplete,
      showToast,
      announceToScreenReader,
    ]
  );

  const handleResetAndStartTour = React.useCallback(() => {
    if (activeTheoremId !== "modus-ponens") {
      handleSwitchTheorem("modus-ponens");
    }
    setEdges([]);
    setSelectedNodeIds([]);
    setNodeOffsets({});
    setCurrentFallacy(null);
  }, [activeTheoremId, handleSwitchTheorem]);

  const handleNodePointerDown = React.useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      e.stopPropagation();
      setDraggingNodeId(nodeId);
      const currentOffset = nodeOffsets[nodeId] || { x: 0, y: 0 };
      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initOffsetX: currentOffset.x,
        initOffsetY: currentOffset.y,
      };
      try {
        (e.target as Element).setPointerCapture(e.pointerId);
      } catch {}
    },
    [nodeOffsets]
  );

  const processNodePointerMove = React.useCallback(
    (clientX: number, clientY: number, nodeId: string) => {
      if (!dragStartRef.current) return;
      const currentActiveTheorem = activeTheoremRef.current;
      const currentOffsets = nodeOffsetsRef.current;
      const currentSnapping = isSnappingEnabledRef.current;

      const sNode = currentActiveTheorem.nodes.find((n) => n.id === nodeId);
      if (!sNode) return;

      const dx = clientX - dragStartRef.current.startX;
      const dy = clientY - dragStartRef.current.startY;
      const rawX = sNode.x + dragStartRef.current.initOffsetX + dx;
      const rawY = sNode.y + dragStartRef.current.initOffsetY + dy;

      if (currentSnapping) {
        const peerNodes = currentActiveTheorem.nodes
          .filter((n) => n.id !== nodeId)
          .map((n) => {
            const off = currentOffsets[n.id] || { x: 0, y: 0 };
            return {
              id: n.id,
              x: n.x + off.x,
              y: n.y + off.y,
              width: 160,
              height: 70,
            };
          });

        const snap = computeMagneticSnap(rawX, rawY, 160, 70, peerNodes, {
          gridSize: 20,
          threshold: 12,
          enableGrid: true,
          enableAlignment: true,
        });

        setActiveGuides(snap.guides);

        if (snap.snappedX || snap.snappedY) {
          const now =
            typeof performance !== "undefined" ? performance.now() : 0;
          if (now - lastSnapAudioTimeRef.current > 350) {
            lastSnapAudioTimeRef.current = now;
            try {
              playHover();
            } catch {}
          }
        }

        setNodeOffsets((prev) => ({
          ...prev,
          [nodeId]: {
            x: snap.x - sNode.x,
            y: snap.y - sNode.y,
          },
        }));
      } else {
        setActiveGuides([]);
        setNodeOffsets((prev) => ({
          ...prev,
          [nodeId]: {
            x: dragStartRef.current!.initOffsetX + dx,
            y: dragStartRef.current!.initOffsetY + dy,
          },
        }));
      }
    },
    [playHover]
  );

  const handleNodePointerMove = React.useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      if (draggingNodeId !== nodeId || !dragStartRef.current) return;
      pendingNodeDragRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        nodeId,
      };

      if (nodeDragRafIdRef.current === null) {
        nodeDragRafIdRef.current = requestAnimationFrame(() => {
          nodeDragRafIdRef.current = null;
          if (pendingNodeDragRef.current) {
            const {
              clientX,
              clientY,
              nodeId: pNodeId,
            } = pendingNodeDragRef.current;
            pendingNodeDragRef.current = null;
            processNodePointerMove(clientX, clientY, pNodeId);
          }
        });
      }
    },
    [draggingNodeId, processNodePointerMove]
  );

  const handleNodePointerUp = React.useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      if (draggingNodeId === nodeId) {
        if (nodeDragRafIdRef.current !== null) {
          cancelAnimationFrame(nodeDragRafIdRef.current);
          nodeDragRafIdRef.current = null;
        }
        if (pendingNodeDragRef.current) {
          const {
            clientX,
            clientY,
            nodeId: pNodeId,
          } = pendingNodeDragRef.current;
          pendingNodeDragRef.current = null;
          processNodePointerMove(clientX, clientY, pNodeId);
        }
        setDraggingNodeId(null);
        dragStartRef.current = null;
        setActiveGuides([]);
        try {
          (e.target as Element).releasePointerCapture(e.pointerId);
        } catch {}
      }
    },
    [draggingNodeId, processNodePointerMove]
  );

  const handleHandlePointerDown = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    const sNode = activeTheorem.nodes.find((n) => n.id === nodeId);
    if (!sNode) return;
    const offset = nodeOffsets[nodeId] || { x: 0, y: 0 };
    const sourceX = sNode.x + offset.x + 160;
    const sourceY = sNode.y + offset.y + 35;

    setDragConnection({
      sourceId: nodeId,
      sourceX,
      sourceY,
      currentX: sourceX,
      currentY: sourceY,
      hoveredTargetId: null,
      isValid: false,
    });

    try {
      (e.target as Element).setPointerCapture(e.pointerId);
      playHover();
    } catch {}

    announceToScreenReader(
      `Started connection drag from Node ${nodeId}. Drag to a compatible target node.`
    );
  };

  const processCanvasPointerMove = React.useCallback(
    (clientX: number, clientY: number) => {
      const currentDragConnection = dragConnectionRef.current;
      if (!currentDragConnection) return;
      const rect = canvasWrapperRef.current?.getBoundingClientRect();
      if (!rect) return;

      const currentX = clientX - rect.left;
      const currentY = clientY - rect.top;

      let hoveredTarget: ProofNode | null = null;
      const currentTheorem = activeTheoremRef.current;
      const currentOffsets = nodeOffsetsRef.current;

      for (const node of currentTheorem.nodes) {
        if (node.id === currentDragConnection.sourceId) continue;
        const off = currentOffsets[node.id] || { x: 0, y: 0 };
        const nX = node.x + off.x;
        const nY = node.y + off.y;
        if (
          currentX >= nX - 10 &&
          currentX <= nX + 170 &&
          currentY >= nY - 10 &&
          currentY <= nY + 85
        ) {
          hoveredTarget = node;
          break;
        }
      }

      const hoveredTargetId = hoveredTarget ? hoveredTarget.id : null;
      let isValid = false;
      let ruleBadge = "";

      if (hoveredTargetId) {
        const validation = canConnect(
          currentDragConnection.sourceId,
          hoveredTargetId,
          edges,
          activeTheorem
        );
        isValid = validation.allowed;
        if (isValid) {
          const targets = getCompatibleTargets(
            currentDragConnection.sourceId,
            activeTheorem,
            edges
          );
          const found = targets.find((c) => c.targetId === hoveredTargetId);
          ruleBadge = found?.badgeLabel || "Valid Inferred Target";
        }
      }

      setDragConnection((prev) =>
        prev
          ? {
              ...prev,
              currentX,
              currentY,
              hoveredTargetId,
              isValid,
              ruleBadge,
            }
          : null
      );
    },
    [edges, activeTheorem]
  );

  const handleCanvasPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (!dragConnection) return;
      pendingConnDragRef.current = { clientX: e.clientX, clientY: e.clientY };

      if (connDragRafIdRef.current === null) {
        connDragRafIdRef.current = requestAnimationFrame(() => {
          connDragRafIdRef.current = null;
          if (pendingConnDragRef.current) {
            const { clientX, clientY } = pendingConnDragRef.current;
            pendingConnDragRef.current = null;
            processCanvasPointerMove(clientX, clientY);
          }
        });
      }
    },
    [dragConnection, processCanvasPointerMove]
  );

  const handleCanvasPointerUp = React.useCallback(
    (e: React.PointerEvent) => {
      if (connDragRafIdRef.current !== null) {
        cancelAnimationFrame(connDragRafIdRef.current);
        connDragRafIdRef.current = null;
      }
      if (pendingConnDragRef.current) {
        const { clientX, clientY } = pendingConnDragRef.current;
        pendingConnDragRef.current = null;
        processCanvasPointerMove(clientX, clientY);
      }
      if (!dragConnection) return;
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {}

      if (dragConnection.hoveredTargetId && dragConnection.isValid) {
        const sId = dragConnection.sourceId;
        const tId = dragConnection.hoveredTargetId;
        setEdges((prev) => [...prev, { source: sId, target: tId }]);
        try {
          playSuccess();
        } catch {}
        showToast(
          `Connected Node ${sId} to Node ${tId} (${dragConnection.ruleBadge || "Inference"})`,
          "success",
          { announce: false }
        );
        announceToScreenReader(
          `Connected Node ${sId} to Node ${tId} via ${dragConnection.ruleBadge || "deductive rule"}.`
        );
        setConsoleLogs((prev) => [
          ...prev,
          {
            id: `drag-conn-${Date.now()}`,
            type: "success",
            text: `Connected Node ${sId} → Node ${tId} via interactive drag cord. Rule: ${dragConnection.ruleBadge || "Inference"}`,
          },
        ]);
      } else if (dragConnection.hoveredTargetId && !dragConnection.isValid) {
        const sId = dragConnection.sourceId;
        const tId = dragConnection.hoveredTargetId;
        const fallacy = getFallacyDiagnosis(sId, tId, edges, activeTheorem);
        setCurrentFallacy(fallacy);
        setActiveTab("fallacy");
        showToast(`Invalid Connection: ${fallacy.fallacyName}`, "error", {
          announce: false,
        });
        announceToScreenReader(`Connection rejected: ${fallacy.fallacyName}`);
      }

      setDragConnection(null);
    },
    [
      dragConnection,
      edges,
      activeTheorem,
      playSuccess,
      processCanvasPointerMove,
      announceToScreenReader,
      setActiveTab,
      showToast,
    ]
  );

  const handleResetLayout = () => {
    setNodeOffsets({});
    setActiveGuides([]);
    setDragConnection(null);
    setEdges(activeTheorem.initialEdges);
    setSelectedNodeIds([]);
    setCurrentFallacy(null);
    try {
      playAutocomplete();
    } catch {}
    showToast("Workspace state reset to default layout.", "info", {
      announce: false,
    });
    announceToScreenReader("Workspace state reset to default layout.");
  };

  const connectNodes = (sourceId: string, nodeId: string) => {
    const validation = canConnect(sourceId, nodeId, edges, activeTheorem);
    if (!validation.allowed) {
      const fallacy = getFallacyDiagnosis(
        sourceId,
        nodeId,
        edges,
        activeTheorem
      );
      setCurrentFallacy(fallacy);
      setActiveTab("fallacy");

      showToast(`Invalid Connection: ${fallacy.fallacyName}`, "error", {
        announce: false,
      });
      announceToScreenReader(
        `Connection rejected: ${fallacy.fallacyName}. ${validation.reason}`
      );
      setConsoleLogs((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          type: "error",
          text: `[FALLACY DETECTED] ${fallacy.fallacyName}: ${validation.reason}\nFormula: ${fallacy.formalFormula}\nAnalogy: ${fallacy.softwareAnalogy}`,
        },
      ]);
      setSelectedNodeIds([]);
      return;
    }

    const newEdge: Edge = { source: sourceId, target: nodeId };
    setEdges((prev) => [...prev, newEdge]);
    setSelectedNodeIds([]);
    setCurrentFallacy(null);

    try {
      playSuccess();
    } catch {}

    showToast(
      `✔ Connected Node ${newEdge.source} → Node ${newEdge.target}!`,
      "success",
      { announce: false }
    );
    announceToScreenReader(
      `Successfully connected Node ${newEdge.source} to Node ${newEdge.target}.`
    );

    const sNode = activeTheorem.nodes.find((n) => n.id === newEdge.source);
    const tNode = activeTheorem.nodes.find((n) => n.id === newEdge.target);

    setConsoleLogs((prev) => [
      ...prev,
      {
        id: `cmd-${Date.now()}`,
        type: "command",
        text: `connect ${newEdge.source} ${newEdge.target}`,
      },
      {
        id: `out-${Date.now()}`,
        type: "success",
        text: `✔ Established edge: Node ${newEdge.source} (${sNode?.label}) → Node ${newEdge.target} (${tNode?.label})`,
      },
    ]);
  };

  const handleNodeClick = (nodeId: string, addToSelection = false) => {
    try {
      playHover();
    } catch {}

    setInspectedNodeId(nodeId);

    if (addToSelection) {
      const wasSelected = selectedNodeIds.includes(nodeId);
      setSelectedNodeIds(
        wasSelected
          ? selectedNodeIds.filter((id) => id !== nodeId)
          : [...selectedNodeIds, nodeId]
      );
      const message = `${wasSelected ? "Deselected" : "Selected"} Node ${nodeId} for rule application.`;
      showToast(message, "info", { announce: false });
      announceToScreenReader(message);
      return;
    }

    if (selectedNodeIds.length === 0) {
      setSelectedNodeIds([nodeId]);
      showToast(
        `Selected Node ${nodeId}. Pick another node or choose an Inference Rule.`,
        "info",
        { announce: false }
      );
      announceToScreenReader(`Selected Node ${nodeId}.`);
      return;
    }

    if (selectedNodeIds.includes(nodeId)) {
      setSelectedNodeIds((prev) => prev.filter((id) => id !== nodeId));
      showToast(`Deselected Node ${nodeId}.`, "info", { announce: false });
      announceToScreenReader(`Deselected Node ${nodeId}.`);
      return;
    }

    if (selectedNodeIds.length === 1) {
      connectNodes(selectedNodeIds[0], nodeId);
      return;
    }

    setSelectedNodeIds([nodeId]);
  };

  const handleApplyRule = (ruleId: string, nodeIds = selectedNodeIds) => {
    if (nodeIds.length === 0) {
      showToast(
        "Select at least 1 premise/lemma node before applying a rule.",
        "info"
      );
      return;
    }

    const selectedNodes = nodeIds
      .map((id) => activeTheorem.nodes.find((n) => n.id === id))
      .filter((n): n is ProofNode => Boolean(n));

    const asts = selectedNodes
      .map((n) => n.ast || parseFormula(n.label))
      .filter((ast): ast is NonNullable<typeof ast> => Boolean(ast));

    const ruleResult = applyRuleToAsts(ruleId, asts);

    if (ruleResult.success && ruleResult.resultAst) {
      try {
        playSuccess();
      } catch {}

      const autoTarget = activeTheorem.nodes.find((node) => {
        if (
          node.type === "premise" ||
          !node.ast ||
          !areAstsEqual(node.ast, ruleResult.resultAst!)
        )
          return false;
        const required =
          node.id === activeTheorem.intermediateNodeId
            ? activeTheorem.intermediateRequires
            : activeTheorem.conclusionRequires;
        return (
          required.length === nodeIds.length &&
          required.every((id) => nodeIds.includes(id)) &&
          nodeIds.every(
            (source) =>
              edges.some(
                (edge) => edge.source === source && edge.target === node.id
              ) || canConnect(source, node.id, edges, activeTheorem).allowed
          )
        );
      });
      if (!autoTarget) {
        showToast(
          "The derived formula does not match an available workspace step. Select that step's required premises.",
          "info"
        );
        return;
      }
      const newEdges: Edge[] = nodeIds
        .filter(
          (source) =>
            !edges.some(
              (edge) => edge.source === source && edge.target === autoTarget.id
            )
        )
        .map((source) => ({
          source,
          target: autoTarget.id,
          ruleApplied: ruleId.toUpperCase(),
        }));
      setEdges((prev) => [...prev, ...newEdges]);

      setSelectedNodeIds([]);
      setCurrentFallacy(null);
      showToast(`✔ ${ruleResult.explanation}`, "success", { announce: false });
      announceToScreenReader(
        `Applied rule ${ruleId.toUpperCase()}: ${ruleResult.explanation}`
      );

      setConsoleLogs((prev) => [
        ...prev,
        {
          id: `cmd-${Date.now()}`,
          type: "command",
          text: `apply ${ruleId} ${nodeIds.join(" ")}`,
        },
        {
          id: `out-${Date.now()}`,
          type: "success",
          text: `✔ ${ruleResult.explanation}`,
        },
      ]);
    } else {
      const sId = nodeIds[0];
      const tId = nodeIds[1] || sId;
      const fallacy = getFallacyDiagnosis(sId, tId, edges, activeTheorem);
      setCurrentFallacy(fallacy);
      setActiveTab("fallacy");

      showToast(
        `Rule Application Failed: ${ruleResult.explanation || fallacy.fallacyName}`,
        "error",
        { announce: false }
      );
      announceToScreenReader(
        `Rule failed: ${ruleResult.explanation || fallacy.fallacyName}`
      );

      setConsoleLogs((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          type: "error",
          text: `[RULE ERROR] ${ruleResult.explanation || fallacy.fallacyName}\n${fallacy.plainEnglish}`,
        },
      ]);
    }
  };

  const handleAutoStep = () => {
    if (isE_Proven) {
      showToast("Goal already fully discharged (Q.E.D.)!", "success");
      return;
    }

    if (!isC_Proven) {
      const [r1, r2] = activeTheorem.intermediateRequires;
      const newEdges: Edge[] = [
        { source: r1, target: activeTheorem.intermediateNodeId },
        { source: r2, target: activeTheorem.intermediateNodeId },
      ];
      setEdges((prev) => [...prev, ...newEdges]);
      showToast(
        `Auto-Step: Connected premises to intermediate Node ${activeTheorem.intermediateNodeId}`,
        "success"
      );
    } else {
      const [cr1, cr2] = activeTheorem.conclusionRequires;
      const newEdges: Edge[] = [
        { source: cr1, target: activeTheorem.targetNodeId },
        { source: cr2, target: activeTheorem.targetNodeId },
      ];
      setEdges((prev) => [...prev, ...newEdges]);
      showToast(
        `Auto-Step: Connected intermediate and premise to Target Node ${activeTheorem.targetNodeId}`,
        "success"
      );
    }

    try {
      playSuccess();
    } catch {}
  };

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
    handler: handleAutoStep,
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

  const handleDeleteStep = (stepOrNode: number | string) => {
    const result = pruneStepOrNode(stepOrNode, edges, activeTheorem);
    if (!result.success) {
      showToast(result.reason, "error", { announce: false });
      announceToScreenReader(result.reason);
      setConsoleLogs((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          type: "error",
          text: `[PRUNE ERROR] ${result.reason}`,
        },
      ]);
      return;
    }

    setEdges(result.newEdges);
    setCurrentFallacy(null);
    showToast(`✔ ${result.reason}`, "info", { announce: false });
    announceToScreenReader(result.reason);

    try {
      playAutocomplete();
    } catch {}

    setConsoleLogs((prev) => [
      ...prev,
      {
        id: `prune-${Date.now()}`,
        type: "info",
        text: `✔ ${result.reason}`,
      },
    ]);
  };

  const handleStartSimulation = (mode: "normal" | "loop" = "normal") => {
    if (isSimulating) return;
    if (activeTheoremId === "custom" && !customSession) {
      setConsoleLogs((prev) => [
        ...prev,
        {
          id: `sim-unavailable-${Date.now()}`,
          type: "info",
          text: "Custom simulation unavailable: entered formulas are not yet loaded into the graph.",
        },
      ]);
      return;
    }

    currentRequestIdRef.current += 1;
    const reqId = currentRequestIdRef.current;

    setIsSimulating(true);
    setSimulationProgress({
      step: 1,
      total: 10,
      log: "Booting Proof Simulation Engine...",
    });
    resetWatchdog();

    setConsoleLogs((prev) => [
      ...prev,
      {
        id: `sim-start-${Date.now()}`,
        type: "info",
        text: `Starting Proof Graph Simulation for [${activeTheorem.title}] in mode '${mode}'...`,
      },
    ]);

    if (workerRef.current) {
      workerRef.current.postMessage({
        type: "START_SIMULATION",
        requestId: reqId,
        mode,
        theoremId: activeTheoremId,
        customFormulas: customSession?.formulas,
      });
    }
  };

  const handleConsoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawInput = consoleInput.trim();
    if (!rawInput) return;

    setHistory((prev) => [rawInput, ...prev]);
    setHistoryIdx(-1);
    setConsoleInput("");

    setConsoleLogs((prev) => [
      ...prev,
      {
        id: `cmd-${Date.now()}`,
        type: "command",
        text: rawInput,
      },
    ]);

    const tokens = rawInput.split(/\s+/);
    const op = tokens[0].toLowerCase();

    if (op === "help") {
      setConsoleLogs((prev) => [
        ...prev,
        {
          id: `help-${Date.now()}`,
          type: "info",
          text: `Interactive Proof Workspace CLI v3.0 Commands:
  connect <src> <tgt>    Connect two nodes with deductive edge
  disconnect <src> <tgt> Remove an edge between nodes
  prune <step|node>      Prune a derived step (Step 3/5 or C/E) and dependent edges
  delete-step <n>        Delete a derived deduction step by line number
  apply <rule> <nodes..> Apply an inference rule (mp, mt, hs, ds, res, and_intro)
  autostep               Automatically advance the next valid inference step
  list                   List all nodes and active edges in graph
  inspect <nodeId>       Inspect details of a specific node
  theorem <id>           Switch theorem scenario (mp, mt, hs, ds, res, 2pc, quorum, cache)
  ledger                 Print deduction ledger table
  export <format>        Export proof (lean, latex, markdown, mermaid)
  simulate normal|loop   Run verification engine in background Web Worker
  clear                  Clear terminal buffer
  help                   Print this command reference`,
        },
      ]);
      announceToScreenReader("Printed help manual.");
      return;
    }

    if (op === "clear") {
      setConsoleLogs([]);
      announceToScreenReader("Cleared terminal logs.");
      return;
    }

    if (op === "list") {
      const nodeListStr = activeTheorem.nodes
        .map(
          (n) => `  [Node ${n.id}] ${n.label} (${n.type}) - ${n.description}`
        )
        .join("\n");
      const edgeListStr =
        edges.length > 0
          ? edges
              .map(
                (e) =>
                  `  ${e.source} -> ${e.target}${e.ruleApplied ? ` [${e.ruleApplied}]` : ""}`
              )
              .join("\n")
          : "  (None)";

      setConsoleLogs((prev) => [
        ...prev,
        {
          id: `list-${Date.now()}`,
          type: "info",
          text: `Active Theorem: ${activeTheorem.title} (${activeTheorem.category})\nNodes:\n${nodeListStr}\nEdges:\n${edgeListStr}\nStatus: ${isE_Proven ? "✔ Q.E.D." : "⏳ INCOMPLETE"}`,
        },
      ]);
      announceToScreenReader("Listed active nodes and connections.");
      return;
    }

    if (op === "connect") {
      const s = tokens[1]?.toUpperCase();
      const t = tokens[2]?.toUpperCase();
      if (!s || !t) {
        setConsoleLogs((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            type: "error",
            text: "Usage: connect <sourceNode> <targetNode>",
          },
        ]);
        return;
      }
      connectNodes(s, t);
      return;
    }

    if (op === "disconnect") {
      const s = tokens[1]?.toUpperCase();
      const t = tokens[2]?.toUpperCase();
      if (!s || !t) {
        setConsoleLogs((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            type: "error",
            text: "Usage: disconnect <sourceNode> <targetNode>",
          },
        ]);
        return;
      }
      setEdges((prev) =>
        prev.filter(
          (e) =>
            !(e.source === s && e.target === t) &&
            !(e.source === t && e.target === s)
        )
      );
      setConsoleLogs((prev) => [
        ...prev,
        {
          id: `disc-${Date.now()}`,
          type: "info",
          text: `Removed edge between Node ${s} and Node ${t}.`,
        },
      ]);
      announceToScreenReader(`Disconnected Node ${s} and Node ${t}.`);
      return;
    }

    if (op === "prune" || op === "delete-step") {
      const target = tokens[1];
      if (!target) {
        setConsoleLogs((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            type: "error",
            text: "Usage: prune <stepNumber|nodeId> or delete-step <stepNumber>",
          },
        ]);
        return;
      }
      handleDeleteStep(target);
      return;
    }

    if (op === "apply") {
      const rule = tokens[1]?.toLowerCase();
      const nodes = tokens.slice(2).map((n) => n.toUpperCase());
      if (!rule || nodes.length === 0) {
        setConsoleLogs((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            type: "error",
            text: "Usage: apply <rule> <node1> [node2...]",
          },
        ]);
        return;
      }
      handleApplyRule(rule, nodes);
      return;
    }

    if (op === "autostep" || op === "solve") {
      handleAutoStep();
      return;
    }

    if (op === "inspect") {
      const nId = tokens[1]?.toUpperCase();
      const node = activeTheorem.nodes.find((n) => n.id === nId);
      if (!node) {
        setConsoleLogs((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            type: "error",
            text: `Node '${nId}' not found.`,
          },
        ]);
        return;
      }
      setInspectedNodeId(node.id);
      setConsoleLogs((prev) => [
        ...prev,
        {
          id: `insp-${Date.now()}`,
          type: "info",
          text: `[Node ${node.id}] ${node.label}\nType: ${node.type.toUpperCase()}\nFormula: ${node.label}\nDescription: ${node.description}\nMeaning: ${node.meaning}`,
        },
      ]);
      announceToScreenReader(`Inspecting Node ${node.id}.`);
      return;
    }

    if (op === "theorem" || op === "switch") {
      const targetTh = tokens[1]?.toLowerCase();
      const map: Record<string, TheoremId> = {
        mp: "modus-ponens",
        mt: "modus-tollens",
        hs: "hypothetical-syllogism",
        ds: "disjunctive-syllogism",
        res: "resolution",
        "2pc": "two-phase-commit",
        quorum: "quorum-overlap",
        cache: "cache-consistency",
        synod: "paxos-synod",
        paxos: "paxos-synod",
        "paxos-synod": "paxos-synod",
        "paxos-phase2b": "paxos-phase2b",
        paxos2b: "paxos-phase2b",
        phase2b: "paxos-phase2b",
        "2b": "paxos-phase2b",
        bft: "bft-quorum",
        "bft-quorum": "bft-quorum",
        pbft: "bft-quorum",
        "pbft-quorum": "bft-quorum",
        custom: "custom",
      };
      const thId = map[targetTh] || (targetTh as TheoremId);
      if (THEOREMS[thId]) {
        handleSwitchTheorem(thId);
      } else {
        setConsoleLogs((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            type: "error",
            text: `Unknown theorem ID '${targetTh}'. Available: mp, mt, hs, ds, res, 2pc, quorum, cache, synod, paxos2b, bft, custom.`,
          },
        ]);
      }
      return;
    }

    if (op === "ledger") {
      const ledger = getDeductionLedger(edges, activeTheorem);
      const textRows = ledger
        .map(
          (s) =>
            `[Step ${s.stepNumber}] ${s.formula.padEnd(14)} | ${s.rule.padEnd(16)} | ${s.isProven ? "✔ PROVEN" : "⏳ PENDING"} | ${s.plainEnglish}`
        )
        .join("\n");
      setConsoleLogs((prev) => [
        ...prev,
        {
          id: `ledger-${Date.now()}`,
          type: "info",
          text: `--- Deduction Ledger: ${activeTheorem.title} ---\n${textRows}`,
        },
      ]);
      announceToScreenReader("Printed deduction ledger.");
      return;
    }

    if (op === "export") {
      const fmt = tokens[1]?.toLowerCase();
      if (
        fmt === "lean" ||
        fmt === "latex" ||
        fmt === "markdown" ||
        fmt === "mermaid"
      ) {
        setConsoleLogs((prev) => [
          ...prev,
          {
            id: `exp-${Date.now()}`,
            type: "info",
            text: exportWorkspaceProof(fmt, edges, activeTheorem),
          },
        ]);
      } else {
        setIsExportModalOpen(true);
      }
      return;
    }

    if (op === "simulate") {
      const mode = tokens[1]?.toLowerCase() === "loop" ? "loop" : "normal";
      handleStartSimulation(mode);
      return;
    }

    setConsoleLogs((prev) => [
      ...prev,
      {
        id: `err-${Date.now()}`,
        type: "error",
        text: `Unknown command '${op}'. Type 'help' for available commands.`,
      },
    ]);
  };

  const handleConsoleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = Math.min(historyIdx + 1, history.length - 1);
        setHistoryIdx(nextIdx);
        setConsoleInput(history[nextIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx > 0) {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        setConsoleInput(history[nextIdx]);
      } else if (historyIdx === 0) {
        setHistoryIdx(-1);
        setConsoleInput("");
      }
    } else if (e.key === "Tab") {
      // Tab completes only while a suggestion is showing. Shift+Tab, a Tab
      // with nothing to complete and browser chords (Ctrl/Alt/Meta+Tab) are
      // left alone so focus moves on normally (#1616, WCAG 2.1.2).
      if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
      const suggestion = getSuggestion(consoleInput);
      if (!suggestion) return;
      e.preventDefault();
      setConsoleInput(suggestion);
      try {
        playAutocomplete();
      } catch {}
    } else if (e.key === "Escape") {
      // A single Escape leaves the input and lands on the console toggle, so
      // focus stays in a predictable place rather than dropping to the body.
      e.preventDefault();
      consoleInputRef.current?.blur();
      toggleBtnRef.current?.focus();
    }
  };

  const suggestion = getSuggestion(consoleInput);

  return (
    <div className="min-h-dvh bg-brand-dark text-slate-100 flex flex-col font-sans pt-20 pb-12 overflow-x-hidden">
      {/* Live Accessibility Announcement Buffer */}
      <div className="sr-only" aria-live="assertive" role="status">
        {liveAnnouncement}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full flex-1 flex flex-col gap-6">
        <ProofCoachTour
          selectedNodeIds={selectedNodeIds}
          edges={edges}
          isE_Proven={isE_Proven}
          activeTheoremId={activeTheoremId}
          canvasWrapperRef={canvasWrapperRef}
          onStartTour={() => {}}
          onResetAndStartTour={handleResetAndStartTour}
        />

        <ProofHeader
          activeTheoremId={activeTheoremId}
          handleSwitchTheorem={handleSwitchTheorem}
          isE_Proven={isE_Proven}
          edges={edges}
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
            edges={edges}
            nodeOffsets={nodeOffsets}
            selectedNodeIds={selectedNodeIds}
            inspectedNodeId={inspectedNodeId}
            isSnappingEnabled={isSnappingEnabled}
            activeGuides={activeGuides}
            dragConnection={dragConnection}
            isSimulating={isSimulating}
            simulationProgress={simulationProgress}
            toggleSnapping={toggleSnapping}
            handleAutoStep={handleAutoStep}
            handleResetLayout={handleResetLayout}
            activeTacticHint={activeTacticHint}
            handleNodePointerDown={handleNodePointerDown}
            handleNodePointerMove={handleNodePointerMove}
            handleNodePointerUp={handleNodePointerUp}
            handleNodeClick={handleNodeClick}
            handleHandlePointerDown={handleHandlePointerDown}
            handleCanvasPointerMove={handleCanvasPointerMove}
            handleCanvasPointerUp={handleCanvasPointerUp}
            handleApplyRule={handleApplyRule}
            handleStartSimulation={handleStartSimulation}
            canvasWrapperRef={canvasWrapperRef}
            svgCanvasRef={svgCanvasRef}
            mobileActiveView={mobileActiveView}
          />

          <ProofLedger
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            mobileActiveView={mobileActiveView}
            setMobileActiveView={setMobileActiveView}
            deductionLedger={deductionLedger}
            handleDeleteStep={handleDeleteStep}
            activeTheorem={activeTheorem}
            currentFallacy={currentFallacy}
            setCurrentFallacy={setCurrentFallacy}
          />
        </div>

        <ProofTerminalConsole
          isConsoleOpen={isConsoleOpen}
          toggleConsole={toggleConsole}
          mobileActiveView={mobileActiveView}
          consoleLogs={consoleLogs}
          consoleInput={consoleInput}
          setConsoleInput={setConsoleInput}
          handleConsoleSubmit={handleConsoleSubmit}
          handleConsoleKeyDown={handleConsoleKeyDown}
          suggestion={suggestion}
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
          edges={edges}
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
          onLoadIntoWorkspace={() => {
            try {
              const formulas = [
                customPremise1,
                customPremise2,
                customPremise3,
                customGoal,
              ];
              const theorem = createCustomTheorem(
                formulas.slice(0, 3),
                formulas[3]
              );
              const serialized = JSON.stringify(formulas);
              if (workerRef.current)
                workerRef.current.postMessage({ type: "ABORT" });
              currentRequestIdRef.current += 1;
              setIsSimulating(false);
              setSimulationProgress(null);
              clearWatchdog();
              setCustomSession({ serialized, formulas, theorem });
              setEdges([]);
              setSelectedNodeIds([]);
              setNodeOffsets({});
              setCurrentFallacy(null);
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
          }}
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
