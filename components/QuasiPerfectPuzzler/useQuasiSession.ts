"use client";

import {
  useState,
  useCallback,
  useEffect,
  useSyncExternalStore,
  useMemo,
  useRef,
} from "react";
import { useAudio } from "@/components/providers/AudioProvider";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import { puzzleLevels } from "@/lib/quasi-perfect/levels";
import { tacticDefs } from "@/lib/quasi-perfect/tactics";
import {
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
import { type ArcadeFx } from "@/hooks/useArcadeFx";

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
export const CURRICULUM_LABEL = `${puzzleLevels.length}-Level ${
  new Set(puzzleLevels.map((lvl) => lvl.chapter)).size
}-Chapter Curriculum · 2 Acts`;
export const ACT_TWO_LOCKED_MESSAGE = `Act 2 opens once Level ${ACT_ONE_CAPSTONE_LEVEL_ID}, the Act 1 capstone, is proved without sorry.`;
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

/** What the session needs from the view. */
/**
 * A named moment in a proof (#3433), for sound, effects and tests. A failed
 * tactic says why: banned by the variant, past its step limit, short of RAM,
 * or refused by the tactic itself.
 */
export type QuasiSessionEvent =
  | { readonly type: "tacticApplied"; readonly tacticId: string }
  | {
      readonly type: "tacticFailed";
      readonly tacticId: string;
      readonly reason: "banned" | "stepLimit" | "ram" | "refused";
    }
  | { readonly type: "goalClosed"; readonly label: string }
  | { readonly type: "subgoalsSplit"; readonly count: number }
  | { readonly type: "levelSolved"; readonly score: LevelScore }
  | { readonly type: "actUnlocked" }
  | { readonly type: "oom" };

interface QuasiSessionOptions {
  /** The board's shake and flash, which the view owns with its stage. */
  readonly fx: ArcadeFx;
  /** Called with each named session event (#3433). */
  readonly onEvent?: (event: QuasiSessionEvent) => void;
}

/**
 * The Quasi-Perfect Puzzler session (#3433): the level and its variant,
 * the mode, the subgoals and the armed tactic and target, RAM, the proof
 * steps with undo and redo, the log, saved progress and Act 2, and the
 * campaign or sandbox tab. Moved verbatim from QuasiPerfectPuzzler.tsx,
 * which renders what it returns.
 */
export function useQuasiSession(options: QuasiSessionOptions) {
  const { fx, onEvent } = options;
  // The latest onEvent, so a new callback each render never re-creates the
  // handlers that emit through it.
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);
  const emit = useCallback((event: QuasiSessionEvent) => {
    onEventRef.current?.(event);
  }, []);
  const { playNote, playSuccess } = useAudio();
  const { announce } = useAnnouncer();

  const [activeTab, setActiveTab] = useState<"campaign" | "sandbox">(
    "campaign"
  );
  const [showHints, setShowHints] = useState<boolean>(false);

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
        emit({ type: "tacticFailed", tacticId: tactic.id, reason: "banned" });
        return;
      }
      if (isStepLimitReached(activeVariant, proofSteps.length, false)) {
        addLog(
          `Step limit of ${activeVariant?.stepLimit} reached without a proof, so '${tactic.name}' was refused. Reset the level to try again.`,
          "error"
        );
        playNote(130.81, 0.2);
        emit({
          type: "tacticFailed",
          tacticId: tactic.id,
          reason: "stepLimit",
        });
        return;
      }

      // Check RAM availability. At 0 GB every tactic, sorry included, is
      // refused until the level is reset (#1651).
      const block = getTacticBlock(tactic, currentRam);
      if (block) {
        addLog(block.message, "error");
        playNote(130.81, 0.2); // Error buzz
        emit({ type: "tacticFailed", tacticId: tactic.id, reason: "ram" });
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
          emit({ type: "subgoalsSplit", count: result.newSubGoals.length });
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
        emit({ type: "tacticApplied", tacticId: tactic.id });

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
          emit({ type: "goalClosed", label: activeSubgoal.label });
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
          emit({ type: "levelSolved", score });
          if (activeVariant) {
            // A variant run never touches the base level's score (#2090).
            if (isVariantRunCleared(activeVariant, steps, usedSorry)) {
              saveVariantClear(currentLevel.id, activeVariant.kind);
            }
          } else {
            saveProgress(score);
            if (!usedSorry && currentLevel.id === ACT_ONE_CAPSTONE_LEVEL_ID) {
              setSessionActTwoOpen(true);
              if (!actTwoOpen) emit({ type: "actUnlocked" });
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
            emit({ type: "oom" });
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
        emit({ type: "tacticFailed", tacticId: tactic.id, reason: "refused" });

        if (nextRam <= 0) {
          addLog(
            "Simulated RAM exhausted; the local tactic session has stopped. Reset the level to continue.",
            "error"
          );
          playNote(98, 0.4);
          emit({ type: "oom" });
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
      emit,
      actTwoOpen,
    ]
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

  // The session's intents (#3433), named for what the player does. The view
  // still calls the handlers above; these are the same calls by name.
  const arm = useCallback((tacticIndex: number) => {
    setSelectedTacticIndex(tacticIndex);
  }, []);
  const disarm = useCallback(() => {
    setSelectedTacticIndex(null);
  }, []);
  const selectTarget = useCallback((nodeId: string | null) => {
    setSelectedTargetId(nodeId);
  }, []);
  const applyTactic = executeTacticOnNode;
  const undo = handleUndo;
  const redo = handleRedo;
  const reset = handleResetLevel;
  const setActiveGoal = setActiveGoalIndex;
  // Admits the active goal with sorry, when the level deals the sorry card.
  const admitSorry = useCallback(() => {
    const index = currentLevel.availableTactics.findIndex(
      (item) => (typeof item === "string" ? item : item.id) === "sorry"
    );
    if (index !== -1) executeTacticOnNode(index, null);
  }, [currentLevel, executeTacticOnNode]);

  return {
    admitSorry,
    applyTactic,
    arm,
    disarm,
    redo,
    reset,
    selectTarget,
    setActiveGoal,
    undo,
    actTwoOpen,
    activeGoalIndex,
    activeHypotheses,
    activeSubgoal,
    activeTab,
    activeVariant,
    announce,
    campaignStars,
    currentLevel,
    currentLevelGolfed,
    currentLevelIndex,
    currentLevelPar,
    currentRam,
    currentScore,
    executeTacticOnNode,
    gameMode,
    generatedLeanScript,
    goalAST,
    handleCancelModeChange,
    handleConfirmModeChange,
    handleRedo,
    handleResetLevel,
    handleSelectVariant,
    handleToggleMode,
    handleUndo,
    history,
    hoveredTargetId,
    isOOM,
    levelSolved,
    levelVariants,
    loadLevel,
    logs,
    modeRules,
    parsedProgress,
    pendingMode,
    playNote,
    playableLevels,
    proofSteps,
    redoHistory,
    runStartingRam,
    selectedTacticIndex,
    selectedTargetId,
    setActiveGoalIndex,
    setActiveTab,
    setHoveredTargetId,
    setSelectedTacticIndex,
    setSelectedTargetId,
    setShowHints,
    showHints,
    stepLimitFailed,
    subgoals,
    targetingHint,
    variantsUnlocked,
  };
}
