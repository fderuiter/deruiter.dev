"use client";

import React, {
  useState,
  useCallback,
  useEffect,
  useSyncExternalStore,
  useMemo,
  useRef,
} from "react";
import { PanInfo } from "framer-motion";
import { useAudio } from "@/components/providers/AudioProvider";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import { puzzleLevels } from "@/lib/quasi-perfect/levels";
import { tacticDefs } from "@/lib/quasi-perfect/tactics";
import {
  STORY_RAM_MULTIPLIER,
  computeLevelStars,
  describeModeRules,
  areVariantsUnlocked,
  getLevelPar,
  getLevelVariant,
  getLevelVariants,
  getRunStartingRam,
  getStartingRam,
  getTacticBlock,
  ACT_ONE_CAPSTONE_LEVEL_ID,
  ACT_TWO_FIRST_CHAPTER,
  isActTwoUnlocked,
  isGolfedRun,
  isLevelLocked,
  isLevelGolfed,
  isStepLimitReached,
  isTacticBanned,
  isVariantCleared,
  isVariantRunCleared,
  mergeLevelScore,
  parseGameProgress,
  recordClearedVariant,
  resolveResumeLevelIndex,
  withUnlockedChapter,
  countHonestProofs,
} from "@/lib/quasi-perfect";
import {
  STORAGE_CHANGE_EVENT,
  safeGetRawItem,
  safeSetRawItem,
} from "@/lib/safe-storage";
import {
  recordArcadeMilestone,
  recordArcadeScore,
} from "@/lib/arcade-achievements";
import {
  CompilerLogEntry,
  GameMode,
  GameProgressState,
  LeanProofStep,
  LevelScore,
  PuzzlerLevelDef,
  PuzzlerVariantKind,
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
import { LevelMap } from "./LevelMap";
import { VariantPicker } from "./VariantPicker";
import { useArcadeFx } from "@/hooks/useArcadeFx";
import { FieldManualButton } from "@/components/FieldManualButton";
import { FullscreenButton } from "@/components/arcade/FullscreenButton";
import { DynamicTabletOrientationHint as TabletOrientationHint } from "@/components/arcade/DynamicTabletOrientationHint";
import { useGameFullscreen as useFullscreen } from "@/components/arcade/CabinetFullscreen";
import { useCabinetTouch } from "@/components/arcade/mobile";
import {
  IconBulb,
  IconChevronDown,
  IconFlask,
  IconRoute,
  IconRotate,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";

// Matches the level heading's scroll-mt-nav-24 offset (6rem), which clears the fixed Navbar.
const NAVBAR_CLEARANCE_PX = 96;
const STORAGE_KEY = "quasi_perfect_puzzler_progress_v1";
const ACT_ONE_LEVELS = puzzleLevels.filter(
  (lvl) => lvl.chapter < ACT_TWO_FIRST_CHAPTER
);
const ACT_TWO_LEVELS = puzzleLevels.filter(
  (lvl) => lvl.chapter >= ACT_TWO_FIRST_CHAPTER
);
const ACT_ONE_CAPSTONE_INDEX = Math.max(
  0,
  puzzleLevels.findIndex((lvl) => lvl.id === ACT_ONE_CAPSTONE_LEVEL_ID)
);
const CURRICULUM_LABEL = `${puzzleLevels.length}-Level ${
  new Set(puzzleLevels.map((lvl) => lvl.chapter)).size
}-Chapter Curriculum · 2 Acts`;
const ACT_TWO_LOCKED_MESSAGE = `Act 2 opens once Level ${ACT_ONE_CAPSTONE_LEVEL_ID}, the Act 1 capstone, is proved without sorry.`;
const MODE_STORAGE_KEY = "quasi_perfect_puzzler_mode_v1";

// SSR-safe progress subscriber: other tabs fire "storage", writes in this tab
// go through lib/safe-storage, which fires STORAGE_CHANGE_EVENT.
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

function getProgressServerSnapshot(): string {
  return "{}";
}

function readStoredProgress(): GameProgressState {
  if (typeof window === "undefined") return parseGameProgress(null);
  return parseGameProgress(safeGetRawItem(STORAGE_KEY));
}

// Keys and bytes match the earlier direct localStorage writes, so returning
// players keep their progress. Blocked writes are dropped, as before.
function writeStoredProgress(progress: GameProgressState): void {
  if (typeof window === "undefined") return;
  safeSetRawItem(STORAGE_KEY, JSON.stringify(progress), {
    retainInMemory: false,
  });
  // A proof admitted with sorry is not a proof, so it earns neither arcade
  // score nor the first-proof trophy that the score unlocks (#1939).
  const provenCount = countHonestProofs(progress);
  recordArcadeScore("quasi-puzzler", provenCount * 100);
  // The Act 1 trophies keep their meaning (all 18 levels); Act 2 (#2091)
  // does not move the goalposts for them.
  const scores = ACT_ONE_LEVELS.map(
    (lvl) => progress.completedLevels?.[lvl.id]
  );
  const honest = scores.every((score) => score && !score.usedSorry);
  if (honest && scores.every((score) => score && score.stars > 0)) {
    recordArcadeMilestone("quasi-puzzler", "all_levels_proven");
  }
  if (honest && scores.every((score) => score && score.stars >= 3)) {
    recordArcadeMilestone("quasi-puzzler", "all_gold");
  }
  // Act 2 has its own finish beat (#2202): every Act 2 level proved honestly.
  const actTwoProven = ACT_TWO_LEVELS.every((lvl) => {
    const score = progress.completedLevels?.[lvl.id];
    return !!score && !score.usedSorry && score.stars > 0;
  });
  if (actTwoProven) {
    recordArcadeMilestone("quasi-puzzler", "act_two_proven");
  }
}

function isGameMode(value: string | null): value is GameMode {
  return value === "story" || value === "hacker";
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
  // Event-only board feedback: a small shake on a failed tactic, an emerald
  // flash when a goal closes. Off under reduced motion, below 768px and when
  // the cabinet's Setup Wizard turns screen shake off.
  const fx = useArcadeFx();
  const { stageRef: fxStageRef, flashRef: fxFlashRef } = fx;

  const [activeTab, setActiveTab] = useState<"campaign" | "sandbox">(
    "campaign"
  );
  const [showHints, setShowHints] = useState<boolean>(false);
  // Board first (#1519): the Lean inspector starts collapsed at every width.
  const [showLeanInspector, setShowLeanInspector] = useState<boolean>(false);
  const [showBriefingModal, setShowBriefingModal] = useState<boolean>(false);

  // Dual Game Mode State (Story/Casual vs Hacker/Speedrun)
  const [gameMode, setGameMode] = useState<GameMode>(() => {
    if (typeof window === "undefined") return "story";
    const stored = safeGetRawItem(MODE_STORAGE_KEY);
    return isGameMode(stored) ? stored : "story";
  });

  const [pendingMode, setPendingMode] = useState<GameMode | null>(null);
  // The puzzler is loaded with ssr: false, so the saved level can be read
  // before the first render instead of flashing Level 1 (#1650).
  const [currentLevelIndex, setCurrentLevelIndex] = useState<number>(() => {
    const stored = readStoredProgress();
    const index = resolveResumeLevelIndex(stored, puzzleLevels);
    // A locked Act 2 level (#2091) is never reopened; the capstone is.
    return isLevelLocked(stored, puzzleLevels[index] ?? puzzleLevels[0])
      ? ACT_ONE_CAPSTONE_INDEX
      : index;
  });
  const currentLevel: PuzzlerLevelDef =
    puzzleLevels[currentLevelIndex] || puzzleLevels[0];
  // The constrained variant being played, or null for the base level (#2090).
  const [activeVariantKind, setActiveVariantKind] =
    useState<PuzzlerVariantKind | null>(null);
  const activeVariant = useMemo(
    () => getLevelVariant(currentLevel, activeVariantKind),
    [currentLevel, activeVariantKind]
  );

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

  const parsedProgress: GameProgressState = useMemo(
    () => parseGameProgress(rawProgress),
    [rawProgress]
  );

  // Act 2 (#2091) opens with an honest capstone proof. The session flag keeps
  // it open when storage is blocked and the save never lands.
  const [sessionActTwoOpen, setSessionActTwoOpen] = useState<boolean>(false);
  const actTwoOpen = sessionActTwoOpen || isActTwoUnlocked(parsedProgress);
  const playableLevels = actTwoOpen ? puzzleLevels : ACT_ONE_LEVELS;

  // Step par and the saved Golfed badge for the level on the board (#2059).
  const currentLevelPar = getLevelPar(currentLevel);
  const currentLevelGolfed = isLevelGolfed(
    parsedProgress.completedLevels?.[currentLevel.id]
  );

  // Totals for the campaign-complete card: only honest proofs count (#1939).
  const campaignStars = useMemo(() => {
    let earned = 0;
    let proven = 0;
    let challengesCleared = 0;
    let challengesTotal = 0;
    for (const lvl of playableLevels) {
      const best = parsedProgress.completedLevels?.[lvl.id];
      if (best && best.completed && !best.usedSorry && best.stars > 0) {
        earned += best.stars;
        proven += 1;
      }
      for (const variant of getLevelVariants(lvl)) {
        challengesTotal += 1;
        if (isVariantCleared(parsedProgress, lvl.id, variant.kind)) {
          challengesCleared += 1;
        }
      }
    }
    return {
      earned,
      proven,
      possible: playableLevels.length * 3,
      challengesCleared,
      challengesTotal,
    };
  }, [parsedProgress, playableLevels]);

  // Escape hides the result card for this run so the solved board can be read.
  const [dismissedScoreAt, setDismissedScoreAt] = useState<number | null>(null);
  const showResultRef = useRef<HTMLButtonElement | null>(null);
  const dismissResult = useCallback((timestamp: number) => {
    setDismissedScoreAt(timestamp);
    // Hand focus to the button that reopens the card, so keyboard players
    // are not dropped at the top of the cabinet.
    requestAnimationFrame(() => {
      const button = showResultRef.current;
      button?.focus({ preventScroll: true });
      if (typeof button?.scrollIntoView === "function") {
        button.scrollIntoView({ block: "nearest" });
      }
    });
  }, []);

  const saveProgress = useCallback(
    (score: LevelScore) => {
      const existing = readStoredProgress();
      writeStoredProgress(
        withUnlockedChapter({
          ...existing,
          currentLevelIndex,
          completedLevels: {
            ...existing.completedLevels,
            [score.levelId]: mergeLevelScore(
              existing.completedLevels[score.levelId],
              score
            ),
          },
        })
      );
    },
    [currentLevelIndex]
  );

  // A cleared variant is stored on its own, never through mergeLevelScore,
  // so it cannot change the base level's stars (#2090).
  const saveVariantClear = useCallback(
    (levelId: string | number, kind: PuzzlerVariantKind) => {
      const existing = readStoredProgress();
      if (isVariantCleared(existing, levelId, kind)) return;
      writeStoredProgress(recordClearedVariant(existing, levelId, kind));
    },
    []
  );

  const saveCurrentLevelIndex = useCallback((index: number) => {
    const existing = readStoredProgress();
    if (existing.currentLevelIndex === index) return;
    writeStoredProgress({ ...existing, currentLevelIndex: index });
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
    (
      index: number,
      modeOverride?: GameMode,
      variantKind?: PuzzlerVariantKind | null
    ) => {
      const safeIndex = puzzleLevels[index] ? index : 0;
      const targetLvl = puzzleLevels[safeIndex];
      if (
        !sessionActTwoOpen &&
        isLevelLocked(readStoredProgress(), targetLvl)
      ) {
        announce(`Level ${targetLvl.id} is locked. ${ACT_TWO_LOCKED_MESSAGE}`);
        return;
      }
      const activeMode = modeOverride ?? gameMode;
      const variant = getLevelVariant(targetLvl, variantKind ?? null);
      setActiveVariantKind(variant ? variant.kind : null);
      setCurrentLevelIndex(safeIndex);
      saveCurrentLevelIndex(safeIndex);
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
      setCurrentRam(getRunStartingRam(targetLvl, activeMode, variant));
      setProofSteps([]);
      setHistory([]);
      setRedoHistory([]);
      setSelectedTacticIndex(null);
      setSelectedTargetId(null);
      setHoveredTargetId(null);
      setLevelSolved(false);
      setCurrentScore(null);
      setShowHints(false);
      setLogs([
        {
          id: `lvl-${targetLvl.id}-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
          type: "info",
          text: `Loaded Chapter ${targetLvl.chapter} [${targetLvl.subtitle}]: ${targetLvl.title}. Mode: ${activeMode.toUpperCase()}.${variant ? ` Variant: ${variant.title}. ${variant.rule}` : ""}`,
        },
      ]);
      announce(
        variant
          ? `Loaded Level ${targetLvl.id} variant ${variant.title}: ${variant.rule}`
          : `Loaded Level ${targetLvl.id}: ${targetLvl.title}. ${targetLvl.description}`,
        "assertive"
      );
    },
    [gameMode, announce, saveCurrentLevelIndex, sessionActTwoOpen]
  );

  const persistMode = useCallback((mode: GameMode) => {
    if (typeof window === "undefined") return;
    safeSetRawItem(MODE_STORAGE_KEY, mode, { retainInMemory: false });
  }, []);

  const runStartingRam = useMemo(
    () => getRunStartingRam(currentLevel, gameMode, activeVariant),
    [currentLevel, gameMode, activeVariant]
  );

  // A proof is in progress once any RAM has been spent or a step recorded.
  const isProofInProgress =
    !levelSolved &&
    (proofSteps.length > 0 ||
      history.length > 0 ||
      currentRam !== runStartingRam);

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
      loadLevel(currentLevelIndex, mode, activeVariantKind);
    },
    [
      gameMode,
      isProofInProgress,
      persistMode,
      loadLevel,
      currentLevelIndex,
      activeVariantKind,
    ]
  );

  const handleConfirmModeChange = useCallback(() => {
    if (!pendingMode) return;
    const mode = pendingMode;
    setPendingMode(null);
    setGameMode(mode);
    persistMode(mode);
    loadLevel(currentLevelIndex, mode, activeVariantKind);
  }, [
    pendingMode,
    persistMode,
    loadLevel,
    currentLevelIndex,
    activeVariantKind,
  ]);

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

      // Variant rules (#2090): a banned card is never played, and a
      // step-limit run that has used every step is over until reset.
      if (isTacticBanned(activeVariant, tactic.id)) {
        addLog(
          `'${tactic.name}' is banned in this variant. Find another route, or return to the base level.`,
          "error"
        );
        playNote(130.81, 0.2);
        return;
      }
      if (isStepLimitReached(activeVariant, proofSteps.length, false)) {
        addLog(
          `Step limit of ${activeVariant?.stepLimit} reached without a proof, so '${tactic.name}' was refused. Reset the level to try again.`,
          "error"
        );
        playNote(130.81, 0.2);
        return;
      }

      // Check RAM availability. At 0 GB every tactic, sorry included, is
      // refused until the level is reset (#1651).
      const block = getTacticBlock(tactic, currentRam);
      if (block) {
        addLog(block.message, "error");
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
        if (allClosed || updatedSubgoals[activeGoalIndex]?.isCompleted) {
          fx.flash(tactic.id === "sorry" ? "#f59e0b" : "#10b981");
        }

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

          const steps = updatedSteps.length;
          const score: LevelScore = {
            levelId: currentLevel.id,
            completed: true,
            usedSorry,
            remainingRam: nextRam,
            stars,
            morality: usedSorry ? -100 : 100,
            timestamp: Date.now(),
            golfed: isGolfedRun(steps, getLevelPar(currentLevel), usedSorry),
            steps,
          };

          setCurrentScore(score);
          if (activeVariant) {
            // A variant run never touches the base level's score (#2090).
            if (isVariantRunCleared(activeVariant, steps, usedSorry)) {
              saveVariantClear(currentLevel.id, activeVariant.kind);
            }
          } else {
            saveProgress(score);
            if (!usedSorry && currentLevel.id === ACT_ONE_CAPSTONE_LEVEL_ID) {
              setSessionActTwoOpen(true);
            }
          }

          if (!usedSorry) {
            playSuccess();
            announce(
              activeVariant
                ? isVariantRunCleared(activeVariant, steps, usedSorry)
                  ? `Variant ${activeVariant.title} cleared for Level ${currentLevel.id}.`
                  : `Goal discharged, but variant ${activeVariant.title} was not cleared.`
                : `Simulated AST goal discharged for Level ${currentLevel.id}.`,
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
          if (nextRam <= 0) {
            addLog(
              "Simulated RAM exhausted; the local tactic session has stopped. Reset the level to continue.",
              "error"
            );
          }
          if (isStepLimitReached(activeVariant, updatedSteps.length, false)) {
            addLog(
              `Step limit reached: ${updatedSteps.length} of ${activeVariant?.stepLimit} tactics used and goals remain. The run has failed; reset to try again.`,
              "error"
            );
            announce(
              "Step limit reached. The variant run has failed; reset the level to try again.",
              "assertive"
            );
          }
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
        fx.shake(4);

        if (nextRam <= 0) {
          addLog(
            "Simulated RAM exhausted; the local tactic session has stopped. Reset the level to continue.",
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
      saveVariantClear,
      activeVariant,
      announce,
      fx,
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
    loadLevel(currentLevelIndex, undefined, activeVariantKind);
    playNote(261.63, 0.1);
  }, [loadLevel, currentLevelIndex, activeVariantKind, playNote]);

  const handleSelectVariant = useCallback(
    (kind: PuzzlerVariantKind | null) => {
      loadLevel(currentLevelIndex, undefined, kind);
      playNote(392, 0.05);
    },
    [loadLevel, currentLevelIndex, playNote]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    // Typing in the Sandbox fields must reach the field, not the shortcuts.
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        "input, textarea, select, [contenteditable='true'], [role='dialog']"
      )
    ) {
      return;
    }
    if (e.altKey) return;
    if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleUndo();
    } else if (e.key === "y" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleRedo();
    } else if (e.ctrlKey || e.metaKey) {
      return;
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
      // Stop this press reaching the window, where the briefing's own
      // B-to-close listener is already attached by the time it bubbles (#1939).
      e.stopPropagation();
      setShowBriefingModal((prev) => !prev);
    } else if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      handleToggleMode(gameMode === "story" ? "hacker" : "story");
    }
  };

  const isOOM = currentRam <= 0 && !levelSolved;
  const stepLimitFailed = isStepLimitReached(
    activeVariant,
    proofSteps.length,
    levelSolved
  );
  const variantsUnlocked = areVariantsUnlocked(parsedProgress, currentLevel.id);
  const levelVariants = getLevelVariants(currentLevel);
  const modeRules = describeModeRules(gameMode, currentLevel);

  const generatedLeanScript = useMemo(
    () => generateLeanProofScript(currentLevel, proofSteps, levelSolved),
    [currentLevel, proofSteps, levelSolved]
  );

  const containerRef = useRef<HTMLElement | null>(null);
  const levelHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const [levelIndexOpen, setLevelIndexOpen] = useState<boolean>(false);
  const [modeRulesOpen, setModeRulesOpen] = useState<boolean>(false);
  const levelToggleRef = useRef<HTMLButtonElement | null>(null);
  const headerRowRef = useRef<HTMLDivElement | null>(null);
  // The drawer drops from just under the header row, which wraps to two
  // lines on narrower cabinets, so its offset is measured when it opens.
  const [drawerTop, setDrawerTop] = useState<number>(52);
  const currentLevelButtonRef = useRef<HTMLButtonElement | null>(null);

  // Opening the level drawer moves focus to the current level on the map;
  // Escape or Close returns it to the toggle.
  const toggleLevelDrawer = useCallback(() => {
    const next = !levelIndexOpen;
    setLevelIndexOpen(next);
    if (next) {
      const headerHeight = headerRowRef.current?.offsetHeight;
      if (headerHeight) setDrawerTop(headerHeight + 8);
      requestAnimationFrame(() => {
        const button = currentLevelButtonRef.current;
        button?.focus({ preventScroll: true });
        // The focused level must be on screen, not under the fold (#2197).
        if (typeof button?.scrollIntoView === "function") {
          button.scrollIntoView({ block: "nearest" });
        }
      });
    }
  }, [levelIndexOpen]);

  const closeLevelDrawer = useCallback(() => {
    setLevelIndexOpen(false);
    levelToggleRef.current?.focus({ preventScroll: true });
  }, []);

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
          // scroll-mt-nav-24 on the heading keeps it clear of the fixed Navbar.
          heading.scrollIntoView({ block: "start" });
        }
      });
    },
    [loadLevel]
  );
  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef);
  // True inside the immersive touch cabinet (#2042). Every touch-only change
  // below hangs off this, so a desktop cabinet keeps its markup and classes.
  const inCabinet = useCabinetTouch();

  // Deep proof trees push the tactic hand below the fold on desktop screens.
  // While the game fills the view but the hand's slot is cut off at the
  // bottom, the hand docks to the bottom of the viewport; its slot keeps the
  // height so nothing jumps (#1939).
  const handSlotRef = useRef<HTMLDivElement | null>(null);
  const handRef = useRef<HTMLDivElement | null>(null);
  const [handDock, setHandDock] = useState<{
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const updateHandDock = useCallback(() => {
    const slot = handSlotRef.current;
    const hand = handRef.current;
    const section = containerRef.current;
    if (!slot || !hand || !section) return;
    const viewportBottom = window.innerHeight;
    const slotRect = slot.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    // The open level map sits over the board; a docked hand would cover its
    // lower rows, so the hand stays in its slot while the map is open (#2197).
    const shouldDock =
      !levelIndexOpen &&
      slotRect.height > 0 &&
      slotRect.bottom > viewportBottom + 1 &&
      sectionRect.top < viewportBottom / 2;
    setHandDock((prev) => {
      if (!shouldDock) return prev === null ? prev : null;
      const height = hand.offsetHeight;
      const next = { left: slotRect.left, width: slotRect.width, height };
      return prev &&
        prev.left === next.left &&
        prev.width === next.width &&
        prev.height === next.height
        ? prev
        : next;
    });
  }, [levelIndexOpen]);

  // A deep goal (Act 2's induction cases) can sit wholly under the docked
  // hand. When a level loads or the goal changes, the page scrolls just far
  // enough for the tree to clear the hand, without pushing the goal formula
  // under the fixed navbar (#2196).
  const revealProofTree = useCallback(() => {
    const section = containerRef.current;
    const slot = handSlotRef.current;
    const hand = handRef.current;
    if (!section || !slot || !hand) return;
    if (inCabinet) {
      // The touch cabinet scrolls its board, not the page: bring the tree
      // region into the board's view, keeping its top edge visible (#2195).
      const touchBoard = section.querySelector(".qp-touch-board");
      const region = section.querySelector(".qp-touch-tree");
      if (!touchBoard || !region) return;
      const boardRect = touchBoard.getBoundingClientRect();
      const regionRect = region.getBoundingClientRect();
      const by = Math.min(
        regionRect.bottom - boardRect.bottom,
        regionRect.top - boardRect.top
      );
      if (by > 0) touchBoard.scrollTop += by;
      return;
    }
    const viewportBottom = window.innerHeight;
    if (section.getBoundingClientRect().top >= viewportBottom / 2) return;
    const tree = section.querySelector('[data-testid="proof-board-tree"]');
    const board = tree?.closest(".qp-board");
    if (!tree || !board) return;
    const slotRect = slot.getBoundingClientRect();
    const handTop =
      slotRect.bottom > viewportBottom + 1
        ? viewportBottom - hand.offsetHeight
        : slotRect.top;
    const hidden = tree.getBoundingClientRect().bottom - (handTop - 8);
    const room = board.getBoundingClientRect().top - NAVBAR_CLEARANCE_PX;
    const by = Math.min(hidden, room);
    if (by > 0) window.scrollBy({ top: by, behavior: "auto" });
  }, [inCabinet]);

  // Desktop: the height the tree may use so that, scrolled just under the
  // navbar, it ends above the docked hand. The tree's rows close up to fit.
  const [treeFitHeight, setTreeFitHeight] = useState<number | undefined>();
  const measureTreeFit = useCallback(() => {
    const section = containerRef.current;
    const hand = handRef.current;
    if (inCabinet || !section || !hand) return;
    const region = section.querySelector(
      '[data-testid="proof-board-tree"]'
    )?.parentElement;
    const board = region?.closest(".qp-board");
    if (!region || !board) return;
    const headerHeight =
      region.getBoundingClientRect().top - board.getBoundingClientRect().top;
    const next = Math.floor(
      window.innerHeight -
        NAVBAR_CLEARANCE_PX -
        headerHeight -
        hand.offsetHeight -
        16
    );
    setTreeFitHeight((prev) => (prev === next ? prev : next));
  }, [inCabinet]);

  useEffect(() => {
    if (activeTab !== "campaign" || typeof window === "undefined") return;
    measureTreeFit();
    window.addEventListener("resize", measureTreeFit);
    return () => window.removeEventListener("resize", measureTreeFit);
  }, [activeTab, currentLevelIndex, subgoals, activeGoalIndex, measureTreeFit]);

  useEffect(() => {
    if (activeTab !== "campaign" || typeof window === "undefined") return;
    // Two frames: a level picked from the map scrolls its heading first.
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(revealProofTree);
    });
    return () => {
      window.cancelAnimationFrame(outer);
      if (inner) window.cancelAnimationFrame(inner);
    };
  }, [
    activeTab,
    currentLevelIndex,
    subgoals,
    activeGoalIndex,
    // Rows close up after the fit height is measured; reveal again then.
    treeFitHeight,
    revealProofTree,
  ]);

  useEffect(() => {
    if (activeTab !== "campaign" || typeof window === "undefined") return;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updateHandDock();
      });
    };
    schedule();
    window.addEventListener("scroll", schedule, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", schedule);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedule);
    if (observer && containerRef.current)
      observer.observe(containerRef.current);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [activeTab, updateHandDock]);

  const latestLog = logs.length > 1 ? logs[logs.length - 1] : undefined;
  const modeButtonClass = (isOn: boolean) =>
    `qp-focus min-h-[40px] px-3 text-xs font-bold rounded-md transition-colors flex items-center justify-center gap-1 ${
      isOn ? "qp-btn-primary" : "text-zinc-300 hover:text-zinc-100"
    }`;
  const quietButtonClass =
    "qp-btn-quiet qp-focus min-h-[40px] flex items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <section
      ref={containerRef}
      aria-labelledby="quasi-puzzler-heading"
      tabIndex={0}
      data-keyboard-boundary="true"
      onKeyDown={handleKeyDown}
      className={`qp-root relative w-full font-mono outline-none ${
        isFullscreen
          ? "fixed inset-0 z-50 h-[100dvh] max-h-[100dvh] max-w-none bg-[color:var(--qp-stage)] p-3 sm:p-6 overflow-y-auto select-none"
          : "bg-[color:var(--qp-stage)] p-3 sm:p-4"
      }${inCabinet ? " qp-touch" : ""}`}
    >
      <FullscreenButton
        isFullscreen={isFullscreen}
        onToggle={toggleFullscreen}
        variant="floating"
      />

      <h2 id="quasi-puzzler-heading" className="sr-only">
        Quasi-Perfect Puzzler
      </h2>

      {/* Tablet Orientation Recommendation */}
      <TabletOrientationHint className="w-full mb-3" />

      <div className="relative">
        {/* 1. Compact header: level drawer, mode, campaign/sandbox, tools */}
        <div
          ref={headerRowRef}
          className={`flex flex-wrap items-center gap-2${inCabinet ? " qp-touch-header" : ""}`}
        >
          {activeTab === "campaign" && (
            <button
              ref={levelToggleRef}
              type="button"
              aria-expanded={levelIndexOpen}
              aria-controls="quasi-level-index"
              onClick={toggleLevelDrawer}
              className={`${quietButtonClass} ${levelIndexOpen ? "border-[color:var(--qp-accent)]" : ""}`}
            >
              <IconRoute className="w-4 h-4 qp-text-accent" />
              <span className="sr-only">
                {levelIndexOpen ? "Hide levels" : "Browse levels"} ·{" "}
              </span>
              <span className="tabular-nums">
                <span className="hidden xl:inline">
                  Ch {currentLevel.chapter} ·{" "}
                </span>
                Level {currentLevel.id} of {playableLevels.length}
              </span>
              <IconChevronDown
                aria-hidden="true"
                className={`w-3.5 h-3.5 text-zinc-400 ${levelIndexOpen ? "rotate-180" : ""}`}
              />
            </button>
          )}

          <div
            role="group"
            aria-label="Game mode"
            className="flex items-center gap-0.5 rounded-lg border border-[color:var(--qp-hairline)] bg-[color:var(--qp-panel)] p-0.5"
          >
            <button
              type="button"
              onClick={() => handleToggleMode("story")}
              aria-pressed={gameMode === "story"}
              className={modeButtonClass(gameMode === "story")}
            >
              Story<span className="sr-only"> Mode</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleMode("hacker")}
              aria-pressed={gameMode === "hacker"}
              className={modeButtonClass(gameMode === "hacker")}
            >
              Hacker<span className="sr-only"> Mode</span>
            </button>
          </div>

          <div
            role="group"
            aria-label="Campaign or sandbox"
            className="flex items-center gap-0.5 rounded-lg border border-[color:var(--qp-hairline)] bg-[color:var(--qp-panel)] p-0.5"
          >
            <button
              type="button"
              onClick={() => setActiveTab("campaign")}
              aria-pressed={activeTab === "campaign"}
              className={modeButtonClass(activeTab === "campaign")}
            >
              Campaign
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("sandbox")}
              aria-pressed={activeTab === "sandbox"}
              className={modeButtonClass(activeTab === "sandbox")}
            >
              <IconFlask className="hidden xl:block w-3.5 h-3.5" />
              <span>Sandbox</span>
            </button>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {activeTab === "campaign" && (
              <>
                <button
                  type="button"
                  onClick={() => setShowBriefingModal(true)}
                  title="Theory Briefing (B)"
                  className={quietButtonClass}
                >
                  <IconSparkles className="w-3.5 h-3.5 qp-text-accent" />
                  {/* Icon-only below xl keeps the header on one row at
                      1024px, so the tactic hand stays on screen (#1939). */}
                  <span>
                    <span className="sr-only">Theory </span>
                    <span className="sr-only xl:not-sr-only">Briefing</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowHints((prev) => !prev)}
                  aria-pressed={showHints}
                  className={`${quietButtonClass} ${showHints ? "border-amber-500/60 text-amber-200" : ""}`}
                >
                  <IconBulb
                    className={`w-3.5 h-3.5 ${showHints ? "text-amber-300" : ""}`}
                  />
                  <span>
                    Hints
                    <span className="hidden xl:inline">
                      {showHints ? " On" : " Off"}
                    </span>
                  </span>
                </button>
              </>
            )}
            <FieldManualButton manualId="quasi-puzzler" label="Manual" />
            <FullscreenButton
              isFullscreen={isFullscreen}
              onToggle={toggleFullscreen}
              variant="header"
            />
          </div>
        </div>

        {pendingMode && (
          <div
            role="alertdialog"
            aria-labelledby="mode-change-title"
            aria-describedby="mode-change-desc"
            className="mt-3 rounded-xl border border-amber-500/40 bg-amber-950/30 p-3"
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
              {getRunStartingRam(currentLevel, pendingMode, activeVariant)} GB
              budget.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleConfirmModeChange}
                className="qp-focus min-h-[44px] px-3 py-2 text-xs font-bold rounded-lg bg-amber-400 text-black"
              >
                Restart in {pendingMode === "story" ? "Story" : "Hacker"} Mode
              </button>
              <button
                type="button"
                onClick={handleCancelModeChange}
                className={quietButtonClass}
              >
                Keep current proof
              </button>
            </div>
          </div>
        )}

        {/* 2. Sandbox View (if selected) */}
        {activeTab === "sandbox" ? (
          <div className={`mt-4${inCabinet ? " qp-touch-board" : ""}`}>
            <SandboxMode />
          </div>
        ) : (
          <>
            {/* Task row: the level, the RAM stick, undo/redo/reset */}
            <div className="mt-3 grid grid-cols-1 items-center gap-3 md:grid-cols-[minmax(0,1fr)_13rem_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold">
                  <span className="qp-text-accent-strong uppercase tracking-wider">
                    Chapter {currentLevel.chapter} · {currentLevel.chapterTitle}
                  </span>
                  <span className="text-zinc-400" aria-hidden="true">
                    |
                  </span>
                  <span className="text-zinc-300">{currentLevel.subtitle}</span>
                  {gameMode === "story" ? (
                    <span className="rounded border border-[color:var(--qp-hairline)] px-1.5 text-[9px] text-zinc-300">
                      STORY MODE · {STORY_RAM_MULTIPLIER}× RAM
                    </span>
                  ) : (
                    <span className="rounded border border-amber-500/40 px-1.5 text-[9px] text-amber-300">
                      HACKER MODE
                    </span>
                  )}
                </div>
                <h3
                  ref={levelHeadingRef}
                  tabIndex={-1}
                  id="quasi-current-level-heading"
                  className="scroll-mt-nav-24 mt-0.5 rounded-sm text-lg font-bold tracking-[-0.02em] text-zinc-100 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--qp-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  {currentLevel.title}
                </h3>
                <p className="text-xs text-zinc-400 break-words">
                  {currentLevel.description}
                </p>
                <p
                  data-testid="quasi-level-targets"
                  className="mt-1 text-[11px] text-zinc-400 break-words tabular-nums"
                >
                  <span className="font-bold text-amber-300">Gold</span>: use{" "}
                  {Math.max(
                    0,
                    currentLevel.initialRam - currentLevel.goldRamTarget
                  )}{" "}
                  GB or less
                  {currentLevelPar !== null && (
                    <>
                      {" · "}
                      <span data-testid="quasi-level-par">
                        par {currentLevelPar} tactic
                        {currentLevelPar === 1 ? "" : "s"}
                      </span>
                    </>
                  )}
                  {currentLevelGolfed && (
                    <span className="ml-2 rounded border border-emerald-500/40 px-1.5 text-[10px] font-bold text-emerald-300">
                      GOLFED
                    </span>
                  )}
                </p>
                {levelVariants.length > 0 && (
                  <VariantPicker
                    variants={levelVariants}
                    activeKind={activeVariant ? activeVariant.kind : null}
                    unlocked={variantsUnlocked}
                    isCleared={(kind) =>
                      isVariantCleared(parsedProgress, currentLevel.id, kind)
                    }
                    onSelect={handleSelectVariant}
                  />
                )}
              </div>

              <RAMGauge currentRam={currentRam} initialRam={runStartingRam} />

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={history.length === 0 || levelSolved}
                  className={quietButtonClass}
                >
                  <IconArrowBackUp className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={redoHistory.length === 0 || levelSolved}
                  className={quietButtonClass}
                >
                  <IconArrowForwardUp className="w-3.5 h-3.5" />
                  <span>Redo</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetLevel}
                  className={quietButtonClass}
                >
                  <IconRotate className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Level drawer: the chapter map and the mode rules, over the board */}
            <div
              id="quasi-level-index"
              data-testid="quasi-level-index"
              role="region"
              aria-label="Level map"
              style={
                inCabinet
                  ? {
                      top: drawerTop,
                      // The cabinet's own height bounds the map; it scrolls.
                      maxHeight: `calc(100dvh - ${drawerTop + 16}px)`,
                      overflowY: "auto",
                    }
                  : { top: drawerTop }
              }
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  closeLevelDrawer();
                }
              }}
              className={`${
                levelIndexOpen ? "block" : "hidden"
              } absolute inset-x-0 z-30 rounded-2xl border border-[color:var(--qp-hairline)] bg-[color:var(--qp-panel)] p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-zinc-100">
                    Level Map
                  </span>
                  <span className="qp-chip-accent rounded-full border px-2 py-0.5 text-[10px] font-semibold">
                    {CURRICULUM_LABEL}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={closeLevelDrawer}
                  className={quietButtonClass}
                >
                  <IconX className="w-3.5 h-3.5" />
                  <span>Close</span>
                </button>
              </div>

              <LevelMap
                levels={puzzleLevels}
                currentLevelIndex={currentLevelIndex}
                progress={parsedProgress}
                onSelectLevel={handleSelectLevel}
                currentButtonRef={currentLevelButtonRef}
                isLevelLocked={(lvl) =>
                  !actTwoOpen && lvl.chapter >= ACT_TWO_FIRST_CHAPTER
                }
                lockedMessage={ACT_TWO_LOCKED_MESSAGE}
                onLockedSelect={(lvl) =>
                  announce(
                    `Level ${lvl.id} is locked. ${ACT_TWO_LOCKED_MESSAGE}`
                  )
                }
              />

              <div
                className="mt-3 min-w-0 border-t border-[color:var(--qp-hairline)] pt-3"
                data-testid="mode-rules"
              >
                <p
                  id="quasi-mode-rules-text"
                  className={`text-xs text-zinc-400 break-words ${
                    modeRulesOpen ? "" : "line-clamp-2"
                  }`}
                >
                  <span
                    className={`font-bold ${
                      gameMode === "story" ? "text-zinc-100" : "text-amber-300"
                    }`}
                  >
                    {modeRules.heading}
                  </span>{" "}
                  {modeRules.budget} {modeRules.failure} {modeRules.exhaustion}{" "}
                  {modeRules.scoring} Changing mode mid-proof restarts the
                  level.
                </p>
                <button
                  type="button"
                  aria-expanded={modeRulesOpen}
                  aria-controls="quasi-mode-rules-text"
                  onClick={() => setModeRulesOpen((prev) => !prev)}
                  className="qp-focus qp-text-accent-strong min-h-[36px] px-1 text-xs font-bold underline underline-offset-2 rounded"
                >
                  {modeRulesOpen ? "Show fewer rules" : "Read all mode rules"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {activeTab === "campaign" && (
        /* 3. Campaign View */
        <>
          {/* Progressive Hints Drawer (if toggled) */}
          {showHints && (
            <div className="mt-3">
              <HintSystem
                hints={currentLevel.hints}
                onClose={() => setShowHints(false)}
              />
            </div>
          )}

          {/* OOM Server Crash Alert */}
          {isOOM && (
            <div className="mt-3 rounded-xl border border-rose-500/50 bg-rose-950/40 p-4 text-center">
              <p className="text-sm font-bold text-rose-300">
                💥 SIMULATED RAM EXHAUSTED
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Available RAM was completely exhausted before discharging the
                goal. Every tactic, sorry included, is locked until you reset
                the level.
              </p>
              <button
                type="button"
                onClick={handleResetLevel}
                className="qp-focus mt-3 rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-500 transition-colors"
              >
                Reset Simulation &amp; Retry Level
              </button>
            </div>
          )}

          {/* Step-limit variant failure (#2090) */}
          {stepLimitFailed && !isOOM && (
            <div
              data-testid="quasi-step-limit-failed"
              className="mt-3 rounded-xl border border-rose-500/50 bg-rose-950/40 p-4 text-center"
            >
              <p className="text-sm font-bold text-rose-300">
                STEP LIMIT REACHED
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {proofSteps.length} of {activeVariant?.stepLimit} tactics used
                and goals remain. The next tactic would be over the limit, so
                this run has failed. Undo or reset to try again.
              </p>
              <button
                type="button"
                onClick={handleResetLevel}
                className="qp-focus mt-3 min-h-[44px] rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-500 transition-colors"
              >
                Reset and Retry Variant
              </button>
            </div>
          )}

          {/* Multi-Goal Branch Tabs: the split, drawn as a fork */}
          {subgoals.length > 1 && (
            <div className="mt-3">
              <MultiGoalTabs
                subgoals={subgoals}
                activeGoalIndex={activeGoalIndex}
                onSelectGoal={setActiveGoalIndex}
              />
            </div>
          )}

          {/* The proof board */}
          <div
            ref={fxStageRef}
            className={`relative mt-3${inCabinet ? " qp-touch-board" : ""}`}
          >
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
                  className={isActive ? "" : "hidden"}
                >
                  {isActive && (
                    <ExpressionTree
                      goalAST={goalAST}
                      fitHeight={treeFitHeight}
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
                      statusMessage={latestLog}
                    />
                  )}
                </div>
              );
            })}
            <div
              ref={fxFlashRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-2xl opacity-0"
            />
          </div>
          {/* Accessible DOM fallback: off-screen until keyboard focus enters it,
              then shown so sighted keyboard users can see the focused control (#1939). */}
          <div
            data-testid="quasi-accessible-controls"
            className="sr-only focus-within:not-sr-only focus-within:mt-3 focus-within:block focus-within:rounded-xl focus-within:border focus-within:border-zinc-800 focus-within:bg-[#13151a] focus-within:p-3 focus-within:text-sm focus-within:text-zinc-200 [&_button]:m-1 [&_button]:min-h-11 [&_button]:rounded-md [&_button]:border [&_button]:border-zinc-700 [&_button]:px-3 [&_button]:py-2 [&_button:disabled]:opacity-50 [&_output]:mr-3 [&_output]:text-zinc-400"
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
                  // The card's own label carries its argument (use 3 vs use 4,
                  // rw [ih] vs rw [add_succ]), so the buttons stay distinct
                  // (#2200).
                  const label =
                    (typeof tacticItem === "object" &&
                      tacticItem.labelOverride) ||
                    def?.name ||
                    id;
                  const banned = isTacticBanned(activeVariant, id);
                  return (
                    <button
                      key={id + "-" + idx}
                      type="button"
                      disabled={banned}
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
                      {banned ? " (banned in this variant)" : ""}
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

          {/* Tactic Hand, fanned under the board; docks when cut off */}
          <div
            ref={handSlotRef}
            className="mt-1"
            style={handDock ? { height: handDock.height } : undefined}
          >
            <div
              ref={handRef}
              data-testid="quasi-tactic-hand-dock"
              data-docked={handDock ? "true" : "false"}
              className={
                handDock
                  ? "fixed bottom-0 z-40 rounded-t-xl border border-b-0 border-[color:var(--qp-hairline)] bg-[color:var(--qp-stage)] px-3 pt-1 pb-4 shadow-[0_-12px_32px_-12px_rgba(0,0,0,0.9)]"
                  : undefined
              }
              style={
                handDock
                  ? { left: handDock.left, width: handDock.width }
                  : undefined
              }
            >
              <TacticHand
                availableTactics={currentLevel.availableTactics}
                bannedTacticId={activeVariant?.bannedTactic}
                currentRam={currentRam}
                selectedTacticIndex={selectedTacticIndex}
                onSelectTactic={(idx) => {
                  playNote(523.25, 0.05);
                  if (selectedTargetId !== null) {
                    executeTacticOnNode(idx, selectedTargetId);
                  } else {
                    setSelectedTacticIndex((prev) =>
                      prev === idx ? null : idx
                    );
                  }
                }}
                onCardDragStart={(idx) => {
                  setSelectedTacticIndex(idx);
                  playNote(523.25, 0.03);
                }}
                onCardDragEnd={handleCardDragEnd}
                isProofComplete={levelSolved || stepLimitFailed}
              />
            </div>
          </div>

          {/* Accordion Drawers for Secondary IDE Panels & Diagnostic Terminal Log */}
          <div className={`mt-4${inCabinet ? " qp-touch-drawers" : ""}`}>
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
          {levelSolved &&
            currentScore &&
            dismissedScoreAt === currentScore.timestamp && (
              <div className="mt-2 flex justify-center">
                <button
                  ref={showResultRef}
                  type="button"
                  onClick={() => setDismissedScoreAt(null)}
                  className="qp-btn-primary qp-focus min-h-11 rounded-xl px-4 py-2 text-xs font-bold"
                >
                  Show result
                </button>
              </div>
            )}
          {levelSolved &&
            currentScore &&
            dismissedScoreAt !== currentScore.timestamp && (
              <VictoryModal
                score={currentScore}
                savedBest={parsedProgress.completedLevels?.[currentLevel.id]}
                level={currentLevel}
                totalLevels={playableLevels.length}
                currentLevelIndex={currentLevelIndex}
                leanCode={generatedLeanScript}
                ramUsed={runStartingRam - currentScore.remainingRam}
                par={currentLevelPar}
                variant={activeVariant}
                variantCleared={
                  !!activeVariant &&
                  isVariantRunCleared(
                    activeVariant,
                    currentScore.steps ?? 0,
                    currentScore.usedSorry
                  )
                }
                campaignStars={campaignStars}
                onRestartCampaign={() => loadLevel(0)}
                onOpenLevelMap={() => {
                  dismissResult(currentScore.timestamp);
                  if (!levelIndexOpen) toggleLevelDrawer();
                }}
                onDismiss={() => dismissResult(currentScore.timestamp)}
                actTwoUnlocked={
                  currentLevel.id === ACT_ONE_CAPSTONE_LEVEL_ID &&
                  !currentScore.usedSorry &&
                  !activeVariant &&
                  actTwoOpen
                }
                onNextLevel={() => {
                  if (currentLevelIndex < playableLevels.length - 1) {
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
