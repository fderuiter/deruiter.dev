"use client";

import React, {
  useState,
  useCallback,
  useSyncExternalStore,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { PanInfo } from "framer-motion";
import { useAudio } from "@/components/providers/AudioProvider";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import { puzzleLevels } from "@/lib/quasi-perfect/levels";
import { tacticDefs } from "@/lib/quasi-perfect/tactics";
import {
  mergeLevelScore,
  resolveSavedLevelIndex,
} from "@/lib/quasi-perfect/progress";
import {
  STORAGE_CHANGE_EVENT,
  safeGetRawItem,
  safeSetRawItem,
} from "@/lib/safe-storage";
import {
  STORY_RAM_MULTIPLIER,
  computeLevelStars,
  describeModeRules,
  getStartingRam,
} from "@/lib/quasi-perfect";
import {
  CompilerLogEntry,
  GameMode,
  GameProgressState,
  LeanProofStep,
  LevelScore,
  PuzzlerLevelDef,
  SubGoal,
} from "@/lib/quasi-perfect/types";
import {
  cloneAST,
  findNodeById,
  isProofComplete,
  areAllSubgoalsClosed,
  generateLeanProofScript,
} from "@/lib/quasi-perfect/engine";
import { ExpressionTree } from "./ExpressionTree";
import { TacticHand } from "./TacticHand";
import { RAMGauge } from "./RAMGauge";
import { VictoryModal } from "./VictoryModal";
import { MultiGoalTabs } from "./MultiGoalTabs";
import { DiagnosticDrawers } from "./DiagnosticDrawers";
import { HintSystem } from "./HintSystem";
import { SandboxMode } from "./SandboxMode";
import { TheoryBriefingModal } from "./TheoryBriefingModal";
import { FieldManualButton } from "@/components/FieldManualButton";
import { FullscreenButton } from "@/components/arcade/FullscreenButton";
import { DynamicTabletOrientationHint as TabletOrientationHint } from "@/components/arcade/DynamicTabletOrientationHint";
import { useGameFullscreen as useFullscreen } from "@/components/arcade/CabinetFullscreen";
import {
  IconBulb,
  IconCode,
  IconFlask,
  IconRotate,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconSparkles,
} from "@tabler/icons-react";

const STORAGE_KEY = "quasi_perfect_puzzler_progress_v1";
const MODE_STORAGE_KEY = "quasi_perfect_puzzler_mode_v1";

// SSR-Safe localStorage sync subscriber
function subscribeProgress(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_CHANGE_EVENT, callback);
  };
}

function getProgressSnapshot(): string {
  if (typeof window === "undefined") return "{}";
  return safeGetRawItem(STORAGE_KEY) || "{}";
}

/** Saved progress, or an empty record when it is missing or corrupt. */
function readSavedProgress(): Partial<GameProgressState> {
  try {
    const parsed: unknown = JSON.parse(getProgressSnapshot());
    return parsed && typeof parsed === "object"
      ? (parsed as Partial<GameProgressState>)
      : {};
  } catch {
    return {};
  }
}

function writeSavedProgress(next: GameProgressState): void {
  if (typeof window === "undefined") return;
  safeSetRawItem(STORAGE_KEY, JSON.stringify(next));
}

function getProgressServerSnapshot(): string {
  return "{}";
}

interface StepHistory {
  subgoals: SubGoal[];
  activeGoalIndex: number;
  ram: number;
  proofSteps: LeanProofStep[];
  logText: string;
}

export const QuasiPerfectPuzzler: React.FC = () => {
  const { playNote, playSuccess } = useAudio();
  const { announce } = useAnnouncer();

  const [activeTab, setActiveTab] = useState<"campaign" | "sandbox">(
    "campaign"
  );
  const [selectedChapter, setSelectedChapter] = useState<number | "all">("all");
  const [showHints, setShowHints] = useState<boolean>(false);
  const [showLeanInspector, setShowLeanInspector] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return false;
    }
    return true;
  });
  const [showBriefingModal, setShowBriefingModal] = useState<boolean>(false);

  // Dual Game Mode State (Story/Casual vs Hacker/Speedrun)
  const [gameMode, setGameMode] = useState<GameMode>(() => {
    if (typeof window === "undefined") return "story";
    try {
      return (localStorage.getItem(MODE_STORAGE_KEY) as GameMode) || "story";
    } catch {
      return "story";
    }
  });

  const [pendingMode, setPendingMode] = useState<GameMode | null>(null);
  const [currentLevelIndex, setCurrentLevelIndex] = useState<number>(0);
  const currentLevel: PuzzlerLevelDef =
    puzzleLevels[currentLevelIndex] || puzzleLevels[0];

  // Multi-Goal State
  const [subgoals, setSubgoals] = useState<SubGoal[]>(() => [
    {
      id: "root-goal",
      label: "Main Goal",
      goal: cloneAST(currentLevel.goal),
      hypotheses: currentLevel.hypotheses.map(cloneAST),
      isCompleted: false,
    },
  ]);
  const [activeGoalIndex, setActiveGoalIndex] = useState<number>(0);

  const activeSubgoal = subgoals[activeGoalIndex] || subgoals[0];
  const goalAST = activeSubgoal.goal;
  const activeHypotheses = activeSubgoal.hypotheses;

  const [currentRam, setCurrentRam] = useState<number>(
    getStartingRam(currentLevel, gameMode)
  );
  const [proofSteps, setProofSteps] = useState<LeanProofStep[]>([]);
  const [history, setHistory] = useState<StepHistory[]>([]);
  const [redoHistory, setRedoHistory] = useState<StepHistory[]>([]);

  const [selectedTacticIndex, setSelectedTacticIndex] = useState<number | null>(
    null
  );
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);

  const [levelSolved, setLevelSolved] = useState<boolean>(false);
  const [currentScore, setCurrentScore] = useState<LevelScore | null>(null);

  const [logs, setLogs] = useState<CompilerLogEntry[]>(() => [
    {
      id: "init-1",
      timestamp: "00:00:01",
      type: "info",
      text: `Local tactic simulator initialized. Loaded [Ch ${currentLevel.chapter} · ${currentLevel.chapterTitle}]: ${currentLevel.title}. Mode: ${gameMode.toUpperCase()}.`,
    },
  ]);

  // SSR-Safe progress state
  const rawProgress = useSyncExternalStore(
    subscribeProgress,
    getProgressSnapshot,
    getProgressServerSnapshot
  );

  const parsedProgress: GameProgressState = useMemo(() => {
    try {
      return JSON.parse(rawProgress) as GameProgressState;
    } catch {
      return { completedLevels: {}, currentLevelIndex: 0 };
    }
  }, [rawProgress]);

  const saveProgress = useCallback((score: LevelScore) => {
    const existing = readSavedProgress();
    writeSavedProgress({
      currentLevelIndex: existing.currentLevelIndex ?? 0,
      completedLevels: {
        ...(existing.completedLevels || {}),
        [score.levelId]: mergeLevelScore(
          existing.completedLevels?.[score.levelId],
          score
        ),
      },
    });
  }, []);

  const saveCurrentLevelIndex = useCallback((index: number) => {
    const existing = readSavedProgress();
    if (existing.currentLevelIndex === index) return;
    writeSavedProgress({
      completedLevels: existing.completedLevels || {},
      currentLevelIndex: index,
    });
  }, []);

  const addLog = useCallback(
    (text: string, type: "info" | "success" | "warning" | "error" = "info") => {
      const entry: CompilerLogEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        type,
        text,
      };
      setLogs((prev) => [...prev, entry]);
    },
    []
  );

  const loadLevel = useCallback(
    (index: number, modeOverride?: GameMode) => {
      const targetLvl = puzzleLevels[index] || puzzleLevels[0];
      const activeMode = modeOverride ?? gameMode;
      setCurrentLevelIndex(index);
      saveCurrentLevelIndex(index);
      setPendingMode(null);
      setSubgoals([
        {
          id: `root-goal-${targetLvl.id}`,
          label: "Main Goal",
          goal: cloneAST(targetLvl.goal),
          hypotheses: targetLvl.hypotheses.map(cloneAST),
          isCompleted: false,
        },
      ]);
      setActiveGoalIndex(0);
      setCurrentRam(getStartingRam(targetLvl, activeMode));
      setProofSteps([]);
      setHistory([]);
      setRedoHistory([]);
      setSelectedTacticIndex(null);
      setSelectedTargetId(null);
      setHoveredTargetId(null);
      setLevelSolved(false);
      setCurrentScore(null);
      setShowHints(false);
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setShowLeanInspector(false);
      }
      setLogs([
        {
          id: `lvl-${targetLvl.id}-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
          type: "info",
          text: `Loaded Chapter ${targetLvl.chapter} [${targetLvl.subtitle}]: ${targetLvl.title}. Mode: ${activeMode.toUpperCase()}.`,
        },
      ]);
      announce(
        `Loaded Level ${targetLvl.id}: ${targetLvl.title}. ${targetLvl.description}`,
        "assertive"
      );
    },
    [gameMode, announce, saveCurrentLevelIndex]
  );

  // Reopen on the saved level once after mount (storage is client-only, so
  // the first render always matches the server's Level 1).
  const restoredLevelRef = useRef(false);
  useEffect(() => {
    if (restoredLevelRef.current) return;
    restoredLevelRef.current = true;
    const index = resolveSavedLevelIndex(readSavedProgress(), puzzleLevels);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (index !== 0) loadLevel(index);
    else saveCurrentLevelIndex(0);
  }, [loadLevel, saveCurrentLevelIndex]);

  const persistMode = useCallback((mode: GameMode) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {
      // Storage fallback
    }
  }, []);

  // A proof is in progress once any RAM has been spent or a step recorded.
  const isProofInProgress =
    !levelSolved &&
    (proofSteps.length > 0 ||
      history.length > 0 ||
      currentRam !== getStartingRam(currentLevel, gameMode));

  const handleToggleMode = useCallback(
    (mode: GameMode) => {
      if (mode === gameMode) {
        setPendingMode(null);
        return;
      }
      if (isProofInProgress) {
        // Never refill or convert RAM mid-proof: require an explicit restart.
        setPendingMode(mode);
        return;
      }
      setGameMode(mode);
      persistMode(mode);
      loadLevel(currentLevelIndex, mode);
    },
    [gameMode, isProofInProgress, persistMode, loadLevel, currentLevelIndex]
  );

  const handleConfirmModeChange = useCallback(() => {
    if (!pendingMode) return;
    const mode = pendingMode;
    setPendingMode(null);
    setGameMode(mode);
    persistMode(mode);
    loadLevel(currentLevelIndex, mode);
  }, [pendingMode, persistMode, loadLevel, currentLevelIndex]);

  const handleCancelModeChange = useCallback(() => {
    setPendingMode(null);
  }, []);

  const armedTacticItem =
    selectedTacticIndex !== null
      ? currentLevel.availableTactics[selectedTacticIndex]
      : undefined;
  const armedTacticId =
    typeof armedTacticItem === "string" ? armedTacticItem : armedTacticItem?.id;
  const targetingHint =
    armedTacticId === "rw"
      ? `rw rewrites a sub-term that matches one side of its hypothesis, never the whole equality. Tap that sub-term; a wrong tap costs ${tacticDefs.rw.failureCost} GB.`
      : undefined;

  // Execute a tactic on a given target AST node
  const executeTacticOnNode = useCallback(
    (tacticIdx: number, targetNodeId: string | null) => {
      if (levelSolved) return;

      const tacticItem = currentLevel.availableTactics[tacticIdx];
      if (!tacticItem) return;

      const tacticId =
        typeof tacticItem === "string" ? tacticItem : tacticItem.id;
      const hypothesisArg =
        typeof tacticItem === "object" ? tacticItem.hypothesis : undefined;
      const tactic = tacticDefs[tacticId];

      if (!tactic) return;

      // Check RAM availability
      // At 0 GB the session has stopped for every tactic, sorry included.
      if (currentRam <= 0 || currentRam < tactic.baseRamCost) {
        addLog(
          currentRam <= 0
            ? `FATAL ERROR: Simulated RAM exhausted; '${tactic.name}' cannot run until the level is reset.`
            : `FATAL ERROR: Insufficient RAM for tactic '${tactic.name}'. Required: ${tactic.baseRamCost} GB, Available: ${currentRam.toFixed(1)} GB.`,
          "error"
        );
        playNote(130.81, 0.2); // Error buzz
        return;
      }

      // Target node in active sub-goal
      let targetNode = goalAST;
      if (targetNodeId) {
        const foundInGoal = findNodeById(goalAST, targetNodeId);
        if (foundInGoal) {
          targetNode = foundInGoal;
        } else {
          for (const hyp of [...activeHypotheses].reverse()) {
            const foundInHyp = findNodeById(hyp, targetNodeId);
            if (foundInHyp) {
              targetNode = foundInHyp;
              break;
            }
          }
        }
      }

      // Execute tactic reducer
      const result = tactic.execute(
        targetNode,
        goalAST,
        activeHypotheses,
        hypothesisArg
      );

      if (result.success) {
        const nextRam = Math.max(0, currentRam - result.ramConsumed);

        // Record history snapshot
        setHistory((prev) => [
          ...prev,
          {
            subgoals: subgoals.map((sg) => ({
              ...sg,
              goal: cloneAST(sg.goal),
              hypotheses: sg.hypotheses.map(cloneAST),
            })),
            activeGoalIndex,
            ram: currentRam,
            proofSteps: [...proofSteps],
            logText: result.message,
          },
        ]);
        setRedoHistory([]);

        // Record Lean proof step
        const newStep: LeanProofStep = {
          id: `step-${Date.now()}`,
          tacticId: tactic.id,
          leanLine: result.leanProofStep || tactic.name,
          explanation: tactic.description,
          goalBefore: activeSubgoal.label,
          goalAfter: result.newAST?.value
            ? String(result.newAST.value)
            : "Reduced",
          subgoalLabel: activeSubgoal.label,
        };
        const updatedSteps = [...proofSteps, newStep];
        setProofSteps(updatedSteps);

        // Handle Subgoal splitting (e.g. cases or split)
        let updatedSubgoals: SubGoal[] = [...subgoals];

        if (result.newSubGoals && result.newSubGoals.length > 0) {
          // Replace current subgoal with branched subgoals
          const before = subgoals.slice(0, activeGoalIndex);
          const after = subgoals.slice(activeGoalIndex + 1);
          updatedSubgoals = [...before, ...result.newSubGoals, ...after];
        } else if (result.newAST) {
          // Update active subgoal AST and hypotheses
          const isThisGoalDone =
            result.isProofComplete || isProofComplete(result.newAST);

          updatedSubgoals[activeGoalIndex] = {
            ...activeSubgoal,
            goal: result.newAST,
            hypotheses: result.newHypotheses || activeSubgoal.hypotheses,
            isCompleted: isThisGoalDone,
          };
        }

        setSubgoals(updatedSubgoals);
        setCurrentRam(nextRam);
        setSelectedTacticIndex(null);
        setSelectedTargetId(null);
        addLog(result.message, tactic.id === "sorry" ? "warning" : "success");

        // Sound feedback
        if (tactic.id === "sorry") {
          playNote(329.63, 0.15);
          setTimeout(() => playNote(220, 0.3), 120);
        } else {
          playNote(659.25, 0.08);
          setTimeout(() => playNote(880, 0.1), 70);
        }

        // Check if all subgoals are closed
        const allClosed = areAllSubgoalsClosed(updatedSubgoals);

        if (allClosed) {
          setLevelSolved(true);
          const usedSorry =
            tactic.id === "sorry" ||
            updatedSteps.some((s) => s.tacticId === "sorry");

          const stars = computeLevelStars(
            currentLevel,
            gameMode,
            nextRam,
            usedSorry
          );

          const score: LevelScore = {
            levelId: currentLevel.id,
            completed: true,
            usedSorry,
            remainingRam: nextRam,
            stars,
            morality: usedSorry ? -100 : 100,
            timestamp: Date.now(),
          };

          setCurrentScore(score);
          saveProgress(score);

          if (!usedSorry) {
            playSuccess();
            announce(
              `Simulated AST goal discharged for Level ${currentLevel.id}.`,
              "assertive"
            );
            addLog(
              `✔ Local AST goal discharged with ${nextRam.toFixed(1)} GB to spare. Generated Lean text is not compiler-checked.`,
              "success"
            );
          } else {
            announce(
              `Theorem admitted via sorry for Level ${currentLevel.id}.`,
              "assertive"
            );
            addLog(
              "▲ Theorem admitted via 'sorry'. Morality Penalty: -100.",
              "warning"
            );
          }
        } else {
          // If current active subgoal was completed, automatically advance to next open subgoal
          if (updatedSubgoals[activeGoalIndex]?.isCompleted) {
            const nextOpenIdx = updatedSubgoals.findIndex(
              (sg) => !sg.isCompleted
            );
            if (nextOpenIdx !== -1) {
              setActiveGoalIndex(nextOpenIdx);
              addLog(
                `Subgoal closed! Advancing to ${updatedSubgoals[nextOpenIdx].label}.`,
                "info"
              );
            }
          }
        }
      } else {
        // Failed step: deduct failure penalty in hacker mode
        const nextRam = Math.max(0, currentRam - result.ramConsumed);
        setCurrentRam(nextRam);
        addLog(result.message, "error");
        playNote(130.81, 0.2); // Low error buzz

        if (nextRam <= 0) {
          addLog(
            "Simulated RAM exhausted; the local tactic session has stopped.",
            "error"
          );
          playNote(98, 0.4);
        }
      }
    },
    [
      levelSolved,
      currentLevel,
      currentRam,
      gameMode,
      goalAST,
      activeHypotheses,
      subgoals,
      activeGoalIndex,
      activeSubgoal,
      proofSteps,
      addLog,
      playNote,
      playSuccess,
      saveProgress,
      announce,
    ]
  );

  // Drag-and-drop collision detection
  const handleCardDragEnd = useCallback(
    (
      tacticIdx: number,
      event: MouseEvent | TouchEvent | PointerEvent,
      _info: PanInfo
    ) => {
      const clientX =
        "clientX" in event
          ? event.clientX
          : (event as TouchEvent).changedTouches?.[0]?.clientX;
      const clientY =
        "clientY" in event
          ? event.clientY
          : (event as TouchEvent).changedTouches?.[0]?.clientY;

      if (typeof clientX === "number" && typeof clientY === "number") {
        const elementsUnderPoint = document.elementsFromPoint(clientX, clientY);
        let targetNodeId: string | null = null;

        for (const el of elementsUnderPoint) {
          const nodeId =
            el.getAttribute("data-node-id") ||
            el.closest("[data-node-id]")?.getAttribute("data-node-id");
          if (nodeId) {
            targetNodeId = nodeId;
            break;
          }
        }

        executeTacticOnNode(tacticIdx, targetNodeId);
      }
      setHoveredTargetId(null);
    },
    [executeTacticOnNode]
  );

  // Undo step
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setRedoHistory((prev) => [
      ...prev,
      {
        subgoals: subgoals.map((sg) => ({
          ...sg,
          goal: cloneAST(sg.goal),
          hypotheses: sg.hypotheses.map(cloneAST),
        })),
        activeGoalIndex,
        ram: currentRam,
        proofSteps: [...proofSteps],
        logText: "Undo",
      },
    ]);
    setSubgoals(last.subgoals);
    setActiveGoalIndex(last.activeGoalIndex);
    setCurrentRam(last.ram);
    setProofSteps(last.proofSteps);
    setHistory((prev) => prev.slice(0, -1));
    setLevelSolved(false);
    setCurrentScore(null);
    addLog("Reverted last tactic step via undo.", "info");
    playNote(392, 0.05);
  }, [
    history,
    subgoals,
    activeGoalIndex,
    currentRam,
    proofSteps,
    addLog,
    playNote,
  ]);

  // Redo step
  const handleRedo = useCallback(() => {
    if (redoHistory.length === 0) return;
    const next = redoHistory[redoHistory.length - 1];
    setHistory((prev) => [
      ...prev,
      {
        subgoals: subgoals.map((sg) => ({
          ...sg,
          goal: cloneAST(sg.goal),
          hypotheses: sg.hypotheses.map(cloneAST),
        })),
        activeGoalIndex,
        ram: currentRam,
        proofSteps: [...proofSteps],
        logText: "Redo",
      },
    ]);
    setSubgoals(next.subgoals);
    setActiveGoalIndex(next.activeGoalIndex);
    setCurrentRam(next.ram);
    setProofSteps(next.proofSteps);
    setRedoHistory((prev) => prev.slice(0, -1));
    addLog("Restored tactic step via redo.", "info");
    playNote(493.88, 0.05);
  }, [
    redoHistory,
    subgoals,
    activeGoalIndex,
    currentRam,
    proofSteps,
    addLog,
    playNote,
  ]);

  const handleResetLevel = useCallback(() => {
    loadLevel(currentLevelIndex);
    playNote(261.63, 0.1);
  }, [loadLevel, currentLevelIndex, playNote]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleUndo();
    } else if (e.key === "y" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleRedo();
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      handleResetLevel();
    } else if (e.key === "h" || e.key === "H") {
      e.preventDefault();
      setShowHints((prev) => !prev);
    } else if (e.key === "c" || e.key === "C") {
      e.preventDefault();
      setShowLeanInspector((prev) => !prev);
    } else if (e.key === "b" || e.key === "B") {
      e.preventDefault();
      setShowBriefingModal((prev) => !prev);
    } else if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      handleToggleMode(gameMode === "story" ? "hacker" : "story");
    }
  };

  const isOOM = currentRam <= 0 && !levelSolved;
  const modeRules = describeModeRules(gameMode, currentLevel);

  // Filtered levels based on chapter tab
  const filteredLevels = useMemo(() => {
    if (selectedChapter === "all") return puzzleLevels;
    return puzzleLevels.filter((lvl) => lvl.chapter === selectedChapter);
  }, [selectedChapter]);

  const generatedLeanScript = useMemo(
    () => generateLeanProofScript(currentLevel, proofSteps, levelSolved),
    [currentLevel, proofSteps, levelSolved]
  );

  const containerRef = useRef<HTMLElement | null>(null);
  const levelHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const [levelIndexOpen, setLevelIndexOpen] = useState<boolean>(false);
  const [modeRulesOpen, setModeRulesOpen] = useState<boolean>(false);

  // Choosing a level from the index collapses it again (small screens) and
  // moves focus and scroll to the active task so keyboard and screen-reader
  // users land on the level they picked.
  const handleSelectLevel = useCallback(
    (index: number) => {
      loadLevel(index);
      setLevelIndexOpen(false);
      requestAnimationFrame(() => {
        const heading = levelHeadingRef.current;
        if (!heading) return;
        heading.focus({ preventScroll: true });
        if (typeof heading.scrollIntoView === "function") {
          // scroll-mt-24 on the heading keeps it clear of the fixed Navbar.
          heading.scrollIntoView({ block: "start" });
        }
      });
    },
    [loadLevel]
  );
  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef);

  return (
    <section
      ref={containerRef}
      aria-labelledby="quasi-puzzler-heading"
      tabIndex={0}
      data-keyboard-boundary="true"
      onKeyDown={handleKeyDown}
      className={`relative font-mono outline-none transition-all ${
        isFullscreen
          ? "fixed inset-0 z-50 w-full h-[100dvh] max-h-[100dvh] max-w-none rounded-none border-none bg-black p-3 sm:p-6 overflow-y-auto select-none"
          : "rounded-2xl border border-brand-cyan/30 bg-zinc-950/90 p-5 shadow-[0_0_35px_-10px_rgba(6,182,212,0.35)] focus:border-brand-cyan"
      }`}
    >
      <FullscreenButton
        isFullscreen={isFullscreen}
        onToggle={toggleFullscreen}
        variant="floating"
      />

      {/* Tablet Orientation Recommendation */}
      <TabletOrientationHint className="w-full mb-3" />

      {/* 1. Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-cyan">
              Formal Methods Arcade · Lean 4 Simulator
            </span>
            <span className="rounded-full bg-purple-500/10 border border-purple-500/30 px-2 py-0.2 text-[9px] font-semibold text-purple-300">
              18-Level 3-Chapter Curriculum
            </span>
          </div>
          <h2
            id="quasi-puzzler-heading"
            className="mt-1 text-2xl font-bold text-zinc-100"
          >
            Quasi-Perfect Puzzler
          </h2>
        </div>

        {/* Campaign vs Sandbox Mode Switch & Field Manual */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Game Mode (Story / Casual vs Hacker / Speedrun) */}
          <div className="bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleToggleMode("story")}
              aria-pressed={gameMode === "story"}
              className={`min-h-[44px] px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none ${
                gameMode === "story"
                  ? "bg-brand-cyan text-black shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Story Mode
            </button>
            <button
              type="button"
              onClick={() => handleToggleMode("hacker")}
              aria-pressed={gameMode === "hacker"}
              className={`min-h-[44px] px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none ${
                gameMode === "hacker"
                  ? "bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.4)] font-extrabold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Hacker Mode
            </button>
          </div>

          <div className="bg-zinc-900 p-1 rounded-xl border border-zinc-800 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("campaign")}
              className={`min-h-[44px] px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none ${
                activeTab === "campaign"
                  ? "bg-purple-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Campaign
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("sandbox")}
              className={`min-h-[44px] flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none ${
                activeTab === "sandbox"
                  ? "bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <IconFlask className="w-3.5 h-3.5" />
              <span>Sandbox</span>
            </button>
          </div>

          <FieldManualButton manualId="quasi-puzzler" label="Manual" />
          <FullscreenButton
            isFullscreen={isFullscreen}
            onToggle={toggleFullscreen}
            variant="header"
          />
        </div>
      </div>

      {/* Active mode rules and mid-proof mode-change confirmation */}
      <div className="mt-3 min-w-0 space-y-2" data-testid="mode-rules">
        <p
          id="quasi-mode-rules-text"
          className={`text-xs text-zinc-400 break-words ${
            modeRulesOpen ? "" : "line-clamp-2 md:line-clamp-none"
          }`}
        >
          <span
            className={`font-bold ${
              gameMode === "story" ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {modeRules.heading}
          </span>{" "}
          {modeRules.budget} {modeRules.failure} {modeRules.exhaustion}{" "}
          {modeRules.scoring} Changing mode mid-proof restarts the level.
        </p>
        {/* Small screens show two lines of the rules so the active level stays near the top */}
        <button
          type="button"
          aria-expanded={modeRulesOpen}
          aria-controls="quasi-mode-rules-text"
          onClick={() => setModeRulesOpen((prev) => !prev)}
          className="md:hidden min-h-[44px] px-1 text-xs font-bold text-brand-cyan underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none rounded"
        >
          {modeRulesOpen ? "Show fewer rules" : "Read all mode rules"}
        </button>
        {pendingMode && (
          <div
            role="alertdialog"
            aria-labelledby="mode-change-title"
            aria-describedby="mode-change-desc"
            className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3"
          >
            <p
              id="mode-change-title"
              className="text-sm font-bold text-amber-300"
            >
              Switch to {pendingMode === "story" ? "Story" : "Hacker"} Mode and
              restart this level?
            </p>
            <p
              id="mode-change-desc"
              className="mt-1 text-xs text-zinc-400 break-words"
            >
              Your current proof steps and RAM usage will be discarded and the
              level restarts with a fresh{" "}
              {getStartingRam(currentLevel, pendingMode)} GB budget.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleConfirmModeChange}
                className="min-h-[44px] px-3 py-2 text-xs font-bold rounded-lg bg-amber-400 text-black focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
              >
                Restart in {pendingMode === "story" ? "Story" : "Hacker"} Mode
              </button>
              <button
                type="button"
                onClick={handleCancelModeChange}
                className="min-h-[44px] px-3 py-2 text-xs font-bold rounded-lg border border-zinc-700 text-zinc-300 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none"
              >
                Keep current proof
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Sandbox View (if selected) */}
      {activeTab === "sandbox" ? (
        <div className="mt-4">
          <SandboxMode />
        </div>
      ) : (
        /* 3. Campaign View */
        <>
          {/* Level Header & Controls */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-zinc-900/40 border border-zinc-850 rounded-xl p-3.5">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-cyan">
                  Chapter {currentLevel.chapter} · {currentLevel.chapterTitle}
                </span>
                <span className="text-zinc-400">|</span>
                <span className="text-[10px] font-bold text-purple-400">
                  {currentLevel.subtitle}
                </span>
                {gameMode === "story" && (
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                    STORY MODE · {STORY_RAM_MULTIPLIER}× RAM
                  </span>
                )}
              </div>
              <h3
                ref={levelHeadingRef}
                tabIndex={-1}
                id="quasi-current-level-heading"
                className="scroll-mt-24 rounded-sm text-base font-bold text-zinc-100 mt-0.5 outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              >
                {currentLevel.title}
              </h3>
              <p className="mt-0.5 text-xs text-zinc-400 max-w-xl">
                {currentLevel.description}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleUndo}
                disabled={history.length === 0 || levelSolved}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none"
              >
                <IconArrowBackUp className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={redoHistory.length === 0 || levelSolved}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none"
              >
                <IconArrowForwardUp className="w-3.5 h-3.5" />
                <span>Redo</span>
              </button>
              <button
                type="button"
                onClick={handleResetLevel}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none"
              >
                <IconRotate className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Tools */}
          <div className="mt-3">
            {/* Tools Toggles */}
            <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={() => setShowBriefingModal(true)}
                className="min-h-[44px] flex flex-col sm:flex-row items-center justify-center gap-1 px-2 sm:px-3 py-1.5 text-center text-xs font-bold rounded-lg border border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan/20 transition-all focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none"
              >
                <IconSparkles className="w-3.5 h-3.5" />
                <span>Theory Briefing</span>
              </button>
              <button
                type="button"
                onClick={() => setShowHints((prev) => !prev)}
                className={`min-h-[44px] flex flex-col sm:flex-row items-center justify-center gap-1 px-2 sm:px-3 py-1.5 text-center text-xs font-bold rounded-lg border transition-all focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none ${
                  showHints
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                }`}
              >
                <IconBulb className="w-3.5 h-3.5" />
                <span>Hints {showHints ? "On" : "Off"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowLeanInspector((prev) => !prev)}
                className={`min-h-[44px] flex flex-col sm:flex-row items-center justify-center gap-1 px-2 sm:px-3 py-1.5 text-center text-xs font-bold rounded-lg border transition-all focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none ${
                  showLeanInspector
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                }`}
              >
                <IconCode className="w-3.5 h-3.5" />
                <span>Lean IDE {showLeanInspector ? "Open" : "Closed"}</span>
              </button>
            </div>
          </div>

          {/* Level index: collapsed behind a disclosure on small screens so the active task stays in reach */}
          <div className="mt-3 md:hidden">
            <button
              type="button"
              aria-expanded={levelIndexOpen}
              aria-controls="quasi-level-index"
              onClick={() => setLevelIndexOpen((prev) => !prev)}
              className="min-h-[44px] w-full flex items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none"
            >
              <span>
                {levelIndexOpen ? "Hide levels" : "Browse levels"} · Level{" "}
                {currentLevel.id} of {puzzleLevels.length}
              </span>
              <span aria-hidden="true">{levelIndexOpen ? "−" : "+"}</span>
            </button>
          </div>
          <div
            id="quasi-level-index"
            data-testid="quasi-level-index"
            className={`mt-3 space-y-2.5 ${levelIndexOpen ? "block" : "hidden md:block"}`}
          >
            {/* Chapter Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase font-bold text-zinc-400 mr-1">
                Chapter:
              </span>
              {[
                { id: "all", label: "All Levels (18)" },
                { id: 1, label: "Ch 1: Equational (1-6)" },
                { id: 2, label: "Ch 2: Logic (7-12)" },
                { id: 3, label: "Ch 3: Quasiperfect (13-18)" },
              ].map((chap) => (
                <button
                  key={chap.id}
                  type="button"
                  onClick={() => setSelectedChapter(chap.id as number | "all")}
                  className={`min-h-[44px] px-3 py-1.5 rounded text-[11px] font-bold transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none ${
                    selectedChapter === chap.id
                      ? "bg-zinc-800 text-brand-cyan border border-brand-cyan/40"
                      : "text-zinc-400 hover:text-zinc-300"
                  }`}
                >
                  {chap.label}
                </button>
              ))}
            </div>

            {/* Level Selector Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-zinc-900/50 rounded-xl border border-zinc-850">
              {filteredLevels.map((lvl) => {
                const actualIdx = puzzleLevels.findIndex(
                  (l) => l.id === lvl.id
                );
                const isCurrent = actualIdx === currentLevelIndex;
                const lvlProgress = parsedProgress.completedLevels?.[lvl.id];

                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => handleSelectLevel(actualIdx)}
                    className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none ${
                      isCurrent
                        ? "bg-brand-cyan text-black shadow-[0_0_10px_rgba(6,182,212,0.5)] font-extrabold"
                        : lvlProgress?.completed
                          ? "bg-zinc-800 text-emerald-300 hover:bg-zinc-700"
                          : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    L{lvl.id}
                    {lvlProgress?.completed && !lvlProgress.usedSorry && (
                      <span className="ml-1 text-[10px] text-amber-400">★</span>
                    )}
                    {lvlProgress?.usedSorry && (
                      <span className="ml-1 text-[10px] text-rose-400">⚠</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Progressive Hints Drawer (if toggled) */}
          {showHints && (
            <div className="mt-4">
              <HintSystem
                hints={currentLevel.hints}
                onClose={() => setShowHints(false)}
              />
            </div>
          )}

          {/* Lean Server RAM Gauge (Story Mode gets a double budget) */}
          <div className="mt-4">
            <RAMGauge
              currentRam={currentRam}
              initialRam={getStartingRam(currentLevel, gameMode)}
            />
          </div>

          {/* OOM Server Crash Alert */}
          {isOOM && (
            <div className="mt-4 rounded-xl border border-rose-500/50 bg-rose-950/40 p-4 text-center">
              <p className="text-sm font-bold text-rose-300">
                💥 SIMULATED RAM EXHAUSTED
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Available RAM was completely exhausted before discharging the
                goal.
              </p>
              <button
                type="button"
                onClick={handleResetLevel}
                className="mt-3 rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-500 transition-colors"
              >
                Reset Simulation &amp; Retry Level
              </button>
            </div>
          )}

          {/* Multi-Goal Branch Tabs */}
          {subgoals.length > 1 && (
            <div className="mt-4">
              <MultiGoalTabs
                subgoals={subgoals}
                activeGoalIndex={activeGoalIndex}
                onSelectGoal={setActiveGoalIndex}
              />
            </div>
          )}

          {/* Main Proof Expression Tree Canvas Panels */}
          {subgoals.map((sg, idx) => {
            const isActive = idx === activeGoalIndex;
            return (
              <div
                key={sg.id}
                id={`subgoal-panel-${sg.id}`}
                role={subgoals.length > 1 ? "tabpanel" : undefined}
                aria-labelledby={
                  subgoals.length > 1 ? `subgoal-tab-${sg.id}` : undefined
                }
                tabIndex={subgoals.length > 1 ? 0 : undefined}
                hidden={!isActive}
                className={isActive ? "mt-4" : "hidden"}
              >
                {isActive && (
                  <ExpressionTree
                    goalAST={goalAST}
                    hypotheses={activeHypotheses}
                    selectedTargetId={selectedTargetId}
                    hoveredTargetId={hoveredTargetId}
                    onSelectTarget={(nodeId) => {
                      playNote(440, 0.05);
                      if (selectedTacticIndex !== null) {
                        executeTacticOnNode(selectedTacticIndex, nodeId);
                      } else {
                        setSelectedTargetId((prev) =>
                          prev === nodeId ? null : nodeId
                        );
                      }
                    }}
                    onHoverTarget={setHoveredTargetId}
                    isProofComplete={levelSolved || activeSubgoal.isCompleted}
                    isTacticActive={selectedTacticIndex !== null}
                    targetingHint={targetingHint}
                  />
                )}
              </div>
            );
          })}

          {/* Off-screen Accessible DOM Fallback Subtree */}
          <div
            className="sr-only"
            aria-label="Quasi-Puzzler Accessible Subtree"
          >
            <fieldset>
              <legend>
                Quasi-Puzzler Lean Proof Assistant State and Controls
              </legend>

              <div role="group" aria-label="Proof Assistant Status and Context">
                <output htmlFor="quasi-level">
                  Level: {currentLevel.title}
                </output>
                <output htmlFor="quasi-goal">
                  Active Goal: {activeSubgoal.label}
                </output>
                <output htmlFor="quasi-ram">
                  RAM Memory: {currentRam.toFixed(1)} GB
                </output>
                <output htmlFor="quasi-status">
                  Proof Status:{" "}
                  {levelSolved
                    ? "Solved"
                    : activeSubgoal.isCompleted
                      ? "Subgoal Closed"
                      : "In Progress"}
                </output>
                <output htmlFor="quasi-steps">
                  Steps Applied: {proofSteps.length}
                </output>
              </div>

              <div
                role="group"
                aria-label="Interactive Tactics and Proof Actions"
              >
                {currentLevel.availableTactics.map((tacticItem, idx) => {
                  const id =
                    typeof tacticItem === "string" ? tacticItem : tacticItem.id;
                  const def = tacticDefs[id];
                  const label = def?.name || id;
                  return (
                    <button
                      key={id + "-" + idx}
                      type="button"
                      onClick={() => {
                        // These buttons are the screen-reader route, so they
                        // apply the tactic to the whole active goal rather
                        // than only selecting it (#1324).
                        setSelectedTacticIndex(idx);
                        executeTacticOnNode(idx, null);
                        announce(`Applied tactic: ${label}`, "polite");
                      }}
                    >
                      Apply Tactic: {label} to the goal
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    handleUndo();
                    announce("Reverted last tactic step.", "polite");
                  }}
                  disabled={history.length === 0}
                >
                  Undo Tactic Step
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleRedo();
                    announce("Restored tactic step.", "polite");
                  }}
                  disabled={redoHistory.length === 0}
                >
                  Redo Tactic Step
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleResetLevel();
                    announce("Reset current proof level.", "polite");
                  }}
                >
                  Reset Level
                </button>
              </div>
            </fieldset>
          </div>

          {/* Tactic Hand */}
          <div className="mt-4">
            <TacticHand
              availableTactics={currentLevel.availableTactics}
              currentRam={currentRam}
              selectedTacticIndex={selectedTacticIndex}
              onSelectTactic={(idx) => {
                playNote(523.25, 0.05);
                if (selectedTargetId !== null) {
                  executeTacticOnNode(idx, selectedTargetId);
                } else {
                  setSelectedTacticIndex((prev) => (prev === idx ? null : idx));
                }
              }}
              onCardDragStart={(idx) => {
                setSelectedTacticIndex(idx);
                playNote(523.25, 0.03);
              }}
              onCardDragEnd={handleCardDragEnd}
              isProofComplete={levelSolved}
            />
          </div>

          {/* Accordion Drawers for Secondary IDE Panels & Diagnostic Terminal Log */}
          <div className="mt-4">
            <DiagnosticDrawers
              key={currentLevelIndex}
              level={currentLevel}
              proofSteps={proofSteps}
              isComplete={levelSolved}
              logs={logs}
              isLeanInspectorOpen={showLeanInspector}
              onToggleLeanInspector={() =>
                setShowLeanInspector((prev) => !prev)
              }
              currentLevelIndex={currentLevelIndex}
            />
          </div>

          {/* Theory Briefing Modal */}
          <TheoryBriefingModal
            level={currentLevel}
            gameMode={gameMode}
            isOpen={showBriefingModal}
            onClose={() => setShowBriefingModal(false)}
            onToggleMode={handleToggleMode}
          />

          {/* Victory Modal */}
          {levelSolved && currentScore && (
            <VictoryModal
              score={currentScore}
              savedBest={parsedProgress.completedLevels?.[currentLevel.id]}
              level={currentLevel}
              totalLevels={puzzleLevels.length}
              currentLevelIndex={currentLevelIndex}
              leanCode={generatedLeanScript}
              onNextLevel={() => {
                if (currentLevelIndex < puzzleLevels.length - 1) {
                  loadLevel(currentLevelIndex + 1);
                }
              }}
              onRestartLevel={handleResetLevel}
            />
          )}
        </>
      )}
    </section>
  );
};
