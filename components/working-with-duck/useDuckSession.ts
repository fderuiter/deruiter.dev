"use client";

import {
  useState,
  useEffect,
  useRef,
  useSyncExternalStore,
  useCallback,
} from "react";
import { clamp } from "@/lib/game-utils";
import { useTelemetry } from "@/hooks/useTelemetry";
import {
  safeGetItem,
  safeGetRawItem,
  safeSetRawItem,
} from "@/lib/safe-storage";
import {
  recordArcadeMilestone,
  recordArcadeScore,
} from "@/lib/arcade-achievements";
import { type DuckTouchSnapshot } from "@/components/working-with-duck/touch-bridge";
import {
  WorkingWithDuckState,
  DuckAccessory,
  type DuckBestStars,
  computeEndlessScore,
  isHalloweenCostume,
  createInitialDuckGameState,
  stepDuckGame,
  releaseDuck,
  shouldSyncDuckHudState,
  SPRINTS,
  SoundCue,
} from "@/lib/working-with-duck-engine";
import {
  getHalloweenServerSnapshot,
  getHalloweenSnapshot,
  subscribeHalloween,
} from "@/components/working-with-duck/halloween";

/** Fixed simulation step for the Duck loop: the engine is tuned to 60 ticks/sec (#600). */
const DUCK_FIXED_STEP_MS = 1000 / 60;
/** Most fixed steps one rendered frame may replay after a long gap. */
const DUCK_MAX_CATCHUP_STEPS = 8;

const subscribeStorage = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};

const getHighScoreSnapshot = () => {
  if (typeof window === "undefined") return "0";
  try {
    return safeGetRawItem("working_with_duck_high_score") || "0";
  } catch {
    return "0";
  }
};

const getServerSnapshot = () => "0";

/**
 * Storage key for the best score of each campaign sprint (#2159). Later
 * sprints ship more work and so score more, so one shared high score made
 * every sprint a "new best"; the result card compares against this instead.
 */
const SPRINT_BESTS_KEY = "working_with_duck_sprint_bests";
/** Fired in this tab after a sprint best is saved; "storage" only fires in others. */
const SPRINT_BESTS_EVENT = "duck-sprint-bests";

const subscribeSprintBests = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(SPRINT_BESTS_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SPRINT_BESTS_EVENT, callback);
  };
};

const getSprintBestsSnapshot = () => {
  if (typeof window === "undefined") return "{}";
  try {
    return safeGetRawItem(SPRINT_BESTS_KEY) || "{}";
  } catch {
    return "{}";
  }
};

const getSprintBestsServerSnapshot = () => "{}";

/** Parses the stored sprint bests, dropping anything malformed. */
export function parseSprintBests(raw: string): Record<number, number> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const bests: Record<number, number> = {};
    for (const [level, score] of Object.entries(parsed)) {
      const n = Number(level);
      if (Number.isInteger(n) && typeof score === "number" && score > 0) {
        bests[n] = score;
      }
    }
    return bests;
  } catch {
    return {};
  }
}

/** Storage key for the best endless score, kept apart from the high score (#2051). */
const ENDLESS_BEST_KEY = "working_with_duck_endless_best";

const getEndlessBestSnapshot = () => {
  if (typeof window === "undefined") return "0";
  try {
    return safeGetRawItem(ENDLESS_BEST_KEY) || "0";
  } catch {
    return "0";
  }
};

// Validates and loads previously earned scrapbook unlocks before any
// initial persistence write, so a corrupted/missing/inaccessible entry
// can never silently replace valid saved progress with the [1] default
// (#599). Unknown or malformed ids are dropped rather than crashing play;
// createInitialDuckGameState re-validates against DUCK_FACTS and always
// includes the baseline id 1.
const getStoredUnlockedFacts = (): number[] => {
  if (typeof window === "undefined") return [1];
  try {
    // Stored as a plain JSON array. safeGetItem returns null when the key is
    // missing or storage is unavailable, and the raw string for malformed JSON.
    const parsed = safeGetItem<unknown>("working_with_duck_unlocked_facts");
    if (!Array.isArray(parsed)) return [1];
    return parsed.filter(
      (id): id is number => typeof id === "number" && Number.isInteger(id)
    );
  } catch {
    return [1];
  }
};

/** Every wearable, in wardrobe order, with the perk it gives (#2050). */
export const WARDROBE: ReadonlyArray<{
  id: DuckAccessory;
  name: string;
  desc: string;
  icon: string;
}> = [
  {
    id: "none",
    name: "Natural Fluffy Coat",
    desc: "Pure English Cream marshmallow vibes",
    icon: "🐾",
  },
  {
    id: "bucket-hat",
    name: "Adidas Bucket Hat",
    desc: "Shade on his head · Thirst rises 25% slower",
    icon: "🧢",
  },
  {
    id: "bowtie",
    name: "Tech CEO Bowtie",
    desc: "+0.2× Multiplier boost for executive standups",
    icon: "👔",
  },
  {
    id: "bandana",
    name: "Adventure Bandana",
    desc: "Outdoor explorer calm · Excitement rises 25% slower",
    icon: "🧣",
  },
  {
    id: "rain-boots",
    name: "Yellow Mud Boots",
    desc: "100% Mud puddle immunity at the Dog Park!",
    icon: "🥾",
  },
  {
    id: "graduation-hat",
    name: "Golden Graduation Hat",
    desc: "Clear Sprint 5 · Good Boy drains half as fast in an emergency",
    icon: "🎓",
  },
];

/**
 * Halloween costumes (#2737), shown in the wardrobe while Halloween mode is
 * on. They need no unlock and carry no perk.
 */
export const COSTUMES: ReadonlyArray<{
  id: DuckAccessory;
  name: string;
  desc: string;
  icon: string;
}> = [
  {
    id: "duck-costume",
    name: "Duck Costume",
    desc: "A Duck dressed as a duck · Bill, wings and webbed booties",
    icon: "🦆",
  },
  {
    id: "witch-hat",
    name: "Witch Hat",
    desc: "Crooked, pointy and full of treat spells",
    icon: "🧙",
  },
  {
    id: "vampire-cape",
    name: "Vampire Cape",
    desc: "Vants to chew your squeaky toy",
    icon: "🧛",
  },
];

const ACCESSORIES_KEY = "working_with_duck_accessories";
const BEST_STARS_KEY = "working_with_duck_best_stars";

const isAccessory = (value: unknown): value is DuckAccessory =>
  WARDROBE.some((item) => item.id === value) ||
  COSTUMES.some((item) => item.id === value);

// Unlocked and equipped accessories carry across sessions (#2050). A
// missing, malformed or inaccessible entry falls back to the defaults, and
// unknown ids are dropped; createInitialDuckGameState adds the sprint's own.
// A costume needs no unlock, so it stays on while Halloween mode is on.
const getStoredAccessories = (): {
  unlocked: DuckAccessory[] | undefined;
  equipped: DuckAccessory;
} => {
  const fallback = { unlocked: undefined, equipped: "none" as const };
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = safeGetItem<unknown>(ACCESSORIES_KEY);
    if (!parsed || typeof parsed !== "object") return fallback;
    const { unlocked, equipped } = parsed as Record<string, unknown>;
    if (!Array.isArray(unlocked)) return fallback;
    const valid = unlocked.filter(isAccessory);
    return {
      unlocked: valid,
      equipped:
        isAccessory(equipped) &&
        (valid.includes(equipped) ||
          (isHalloweenCostume(equipped) && getHalloweenSnapshot()))
          ? equipped
          : "none",
    };
  } catch {
    return fallback;
  }
};

// Best stars per sprint, stored as a JSON object keyed by sprint level.
const getStoredBestStars = (): DuckBestStars => {
  if (typeof window === "undefined") return {};
  try {
    const parsed = safeGetItem<unknown>(BEST_STARS_KEY);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const best: DuckBestStars = {};
    for (const sprint of SPRINTS) {
      const stars = (parsed as Record<string, unknown>)[String(sprint.level)];
      if (typeof stars === "number" && Number.isInteger(stars)) {
        best[sprint.level] = clamp(stars, 0, 3);
      }
    }
    return best;
  } catch {
    return {};
  }
};

type InterruptionReason =
  "manual" | "scrapbook" | "wardrobe" | "manual_guide" | "hidden";

/** What the session reads from the page, supplied by the view. */
interface DuckSessionOptions {
  /** A state to start from instead of the saved one, as in tests. */
  readonly initialState?: WorkingWithDuckState;
}

/**
 * The Working With Duck session (#3430): the engine state and its HUD
 * copy, the fixed 60 Hz step, pauses and interruptions, the scene, the
 * saved bests, wardrobe and trophies. Moved verbatim from
 * WorkingWithDuck.tsx, which draws and renders what it returns.
 */
export function useDuckSession(options: DuckSessionOptions) {
  const { initialState } = options;
  const rawHighScore = useSyncExternalStore(
    subscribeStorage,
    getHighScoreSnapshot,
    getServerSnapshot
  );
  const loadedHighScore = parseInt(rawHighScore, 10) || 0;
  const rawEndlessBest = useSyncExternalStore(
    subscribeStorage,
    getEndlessBestSnapshot,
    getServerSnapshot
  );
  const loadedEndlessBest = parseInt(rawEndlessBest, 10) || 0;
  const rawSprintBests = useSyncExternalStore(
    subscribeSprintBests,
    getSprintBestsSnapshot,
    getSprintBestsServerSnapshot
  );

  const { recordEvent } = useTelemetry();

  // Halloween mode (#2737): the canvas reads it through a ref, the
  // wardrobe through the snapshot.
  const halloween = useSyncExternalStore(
    subscribeHalloween,
    getHalloweenSnapshot,
    getHalloweenServerSnapshot
  );
  const halloweenRef = useRef(halloween);
  useEffect(() => {
    halloweenRef.current = halloween;
  }, [halloween]);

  const createDefaultState = () => {
    const accessories = getStoredAccessories();
    const state = createInitialDuckGameState(
      1,
      "campaign",
      accessories.unlocked,
      getStoredUnlockedFacts(),
      getStoredBestStars()
    );
    return { ...state, activeAccessory: accessories.equipped };
  };

  // Core Game State Ref for 60 FPS deterministic engine
  const gameStateRef = useRef<WorkingWithDuckState>(
    initialState ?? createDefaultState()
  );
  // UI React State for rendering HUD, modals, and overlays
  const [uiState, setUiState] = useState<WorkingWithDuckState>(
    () => initialState ?? createDefaultState()
  );
  const [isManualPauseActive, setIsManualPauseActive] = useState(false);
  const isManuallyPaused = uiState.status === "paused" && isManualPauseActive;

  // A pointer drag that ends while the sprint is paused cannot drop Duck
  // (releaseDuck is a no-op while paused, #1645), so the drop waits for the
  // sprint to resume instead of leaving Duck held.
  const pendingDragReleaseRef = useRef(false);

  // Single gateway for every gameStateRef mutation: gameStateRef.current and
  // uiState are always written together from the same computed value, so the
  // 60fps-loop ref and the throttled HUD state can never diverge by a call
  // site forgetting to update one of them (#598, #655). `shouldSync` lets the
  // hot per-frame tick path opt out of a React re-render per tick while still
  // going through this one path; every discrete user action defaults to
  // always syncing.
  const applyTransition = useCallback(
    (
      updater: (state: WorkingWithDuckState) => WorkingWithDuckState,
      shouldSync: (next: WorkingWithDuckState) => boolean = () => true
    ): WorkingWithDuckState => {
      const next = updater(gameStateRef.current);
      gameStateRef.current = next;
      if (shouldSync(next)) {
        setUiState(next);
      }
      return next;
    },
    []
  );

  // Fixed-timestep simulation clock: the engine's tick balance (work
  // increments, timers, combo decay) was tuned assuming 60 ticks/sec, so
  // advanceClock below moves the simulation by real elapsed time in whole
  // FIXED_STEP_MS chunks instead of once per rendered frame. That keeps
  // gameplay speed identical at 30/60/120Hz instead of scaling with the
  // display's refresh rate (#600).
  const lastFrameTimeRef = useRef<number | null>(null);
  const stepAccumulatorRef = useRef(0);

  // One rendered frame at loop clock `clockMs` (#3430): steps the engine in
  // whole fixed steps for the real time since the previous frame, and hands
  // each step's sound cues to `playCue`. lastFrameTimeRef holds the loop's
  // clock at the previous frame, so the difference between two frames is the
  // real gap between them.
  const advanceClock = useCallback(
    (clockMs: number, playCue: (cue: SoundCue) => void) => {
      const previousClock = lastFrameTimeRef.current;
      lastFrameTimeRef.current = clockMs;
      const state = gameStateRef.current;

      if (state.status !== "running") {
        // Not simulating (idle/won/lost/paused): don't let time spent here
        // accumulate into a catch-up burst whenever play resumes.
        stepAccumulatorRef.current = 0;
        lastFrameTimeRef.current = null;
      } else {
        // There's no previous frame to diff against right after a sprint
        // starts (or resumes from a context-loss reset): treat it as
        // exactly one fixed step rather than zero, so play advances on the
        // very next frame instead of silently priming the clock first.
        // Every later frame uses real measured elapsed time, clamped so a
        // dropped frame, a backgrounded tab, or that same gap can't be
        // replayed as a runaway catch-up burst.
        const elapsedMs =
          previousClock === null
            ? DUCK_FIXED_STEP_MS
            : Math.min(
                clockMs - previousClock,
                DUCK_FIXED_STEP_MS * DUCK_MAX_CATCHUP_STEPS
              );
        stepAccumulatorRef.current += elapsedMs;

        let stepsThisFrame = 0;
        while (
          stepAccumulatorRef.current >= DUCK_FIXED_STEP_MS &&
          stepsThisFrame < DUCK_MAX_CATCHUP_STEPS &&
          gameStateRef.current.status === "running"
        ) {
          let cuesToPlay: SoundCue[] = [];
          // Throttle UI update every 4 ticks (~15 updates/sec of simulated
          // time for DOM performance), but always flush immediately on a
          // terminal win/fail transition so the victory/failure panel is
          // never hidden behind a stale throttled frame.
          applyTransition((state) => {
            // The engine reads Halloween mode from the state (#2740).
            const stepped = stepDuckGame(
              state.halloween === halloweenRef.current
                ? state
                : { ...state, halloween: halloweenRef.current }
            );
            if (stepped.soundCueQueue.length > 0) {
              cuesToPlay = stepped.soundCueQueue;
              return { ...stepped, soundCueQueue: [] };
            }
            return stepped;
          }, shouldSyncDuckHudState);
          stepAccumulatorRef.current -= DUCK_FIXED_STEP_MS;
          stepsThisFrame++;

          // Process sound cue queue
          cuesToPlay.forEach((cue) => playCue(cue));
        }
      }
    },
    [applyTransition]
  );

  // Forget the previous frame, so the next one counts as one fixed step.
  const resetClock = useCallback(() => {
    lastFrameTimeRef.current = null;
    stepAccumulatorRef.current = 0;
  }, []);

  // Coordinated Interruption Management (#602): tracks active interruption
  // reasons (manual pause, scrapbook, wardrobe, document-hidden). Play only
  // advances when there are zero active interruptions. Closing one dialog
  // does not override another active interruption or manual pause.
  const activeInterruptionsRef = useRef<Set<InterruptionReason>>(new Set());
  const wasRunningBeforeInterruptionRef = useRef(false);

  const addInterruption = useCallback(
    (reason: InterruptionReason) => {
      const currentStatus = gameStateRef.current.status;
      if (currentStatus === "running") {
        wasRunningBeforeInterruptionRef.current = true;
        activeInterruptionsRef.current.add(reason);
        stepAccumulatorRef.current = 0;
        lastFrameTimeRef.current = null;
        applyTransition((state) => ({ ...state, status: "paused" }));
      } else if (currentStatus === "paused") {
        activeInterruptionsRef.current.add(reason);
      }
    },
    [applyTransition]
  );

  const removeInterruption = useCallback(
    (reason: InterruptionReason) => {
      activeInterruptionsRef.current.delete(reason);
      if (
        activeInterruptionsRef.current.size === 0 &&
        wasRunningBeforeInterruptionRef.current
      ) {
        wasRunningBeforeInterruptionRef.current = false;
        stepAccumulatorRef.current = 0;
        lastFrameTimeRef.current = null;
        applyTransition((state) => {
          if (state.status !== "paused") return state;
          const resumed: WorkingWithDuckState = { ...state, status: "running" };
          if (pendingDragReleaseRef.current) {
            pendingDragReleaseRef.current = false;
            return releaseDuck(resumed);
          }
          return resumed;
        });
      }
    },
    [applyTransition]
  );

  const startSprint = useCallback(() => {
    activeInterruptionsRef.current.clear();
    wasRunningBeforeInterruptionRef.current = false;
    applyTransition((state) => ({ ...state, status: "running" }));
    recordEvent("working-with-duck", "project_click").catch(() => {});
  }, [applyTransition, recordEvent]);

  const toggleManualPause = useCallback(() => {
    const currentStatus = gameStateRef.current.status;
    if (currentStatus === "running") {
      setIsManualPauseActive(true);
      addInterruption("manual");
    } else if (currentStatus === "paused") {
      if (activeInterruptionsRef.current.has("manual")) {
        setIsManualPauseActive(false);
        removeInterruption("manual");
      } else {
        setIsManualPauseActive(true);
        addInterruption("manual");
      }
    }
  }, [addInterruption, removeInterruption]);

  // How many field manuals are open; the view counts them as they open
  // and close, and a finished sprint clears the count.
  const openManualsCountRef = useRef(0);

  // Document visibility change listener (suspends simulation when tab is backgrounded)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        addInterruption("hidden");
      } else {
        removeInterruption("hidden");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [addInterruption, removeInterruption]);

  // Reset interruption state when session concludes or returns to idle
  useEffect(() => {
    if (
      uiState.status === "won" ||
      uiState.status === "failed" ||
      uiState.status === "idle"
    ) {
      wasRunningBeforeInterruptionRef.current = false;
      activeInterruptionsRef.current.clear();
      openManualsCountRef.current = 0;
    }
  }, [uiState.status]);

  // Sync high scores safely to localStorage and emit score events
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // Scores are saved when a sprint ends, not while it runs: the result
      // card compares against the stored best, which must still be the best
      // from earlier runs when the card opens (#1942).
      // An endless run is ranked by its own endless best, saved below, so
      // its points never reach the campaign or arcade high score (#2326).
      const sprintOver =
        uiState.mode === "campaign" &&
        (uiState.status === "won" || uiState.status === "failed");
      if (sprintOver && uiState.totalScore > 0) {
        recordArcadeScore("working-with-duck", uiState.totalScore);
        // Duck keeps its own best: the arcade no longer mirrors scores into
        // game keys (#2548).
        if (uiState.totalScore > (parseInt(getHighScoreSnapshot(), 10) || 0)) {
          safeSetRawItem(
            "working_with_duck_high_score",
            String(uiState.totalScore)
          );
        }
      }
      if (
        uiState.status === "won" &&
        uiState.mode === "campaign" &&
        uiState.currentLevel >= 5
      ) {
        recordArcadeMilestone("working-with-duck", "campaign_cleared");
      }
      // A sprint best counts shipped runs only, so a time-out never sets
      // the bar the next real run is measured against.
      if (uiState.status === "won" && uiState.mode === "campaign") {
        const bests = parseSprintBests(getSprintBestsSnapshot());
        if (uiState.totalScore > (bests[uiState.currentLevel] ?? 0)) {
          bests[uiState.currentLevel] = uiState.totalScore;
          safeSetRawItem(SPRINT_BESTS_KEY, JSON.stringify(bests));
          window.dispatchEvent(new Event(SPRINT_BESTS_EVENT));
        }
      }
      // Trophy milestones for real play (#2159): a sprint shipped, and a
      // sprint with all three stars.
      if (uiState.status === "won" && uiState.mode === "campaign") {
        recordArcadeMilestone("working-with-duck", "sprint_shipped");
        if (uiState.sprintStars?.count === 3) {
          recordArcadeMilestone("working-with-duck", "three_star_sprint");
        }
        // Halloween (#2740): a sprint shipped with Duck dressed as a duck.
        // Read from the ref, so changing clothes on the result card neither
        // reruns this effect nor earns the trophy after the fact.
        if (gameStateRef.current.activeAccessory === "duck-costume") {
          recordArcadeMilestone("working-with-duck", "duck_costume_sprint");
        }
      }
      if (sprintOver && uiState.highScore > loadedHighScore) {
        safeSetRawItem(
          "working_with_duck_high_score",
          String(uiState.highScore)
        );
        recordArcadeScore("working-with-duck", uiState.highScore);
      }
      if (uiState.unlockedFacts.length > 0) {
        safeSetRawItem(
          "working_with_duck_unlocked_facts",
          JSON.stringify(uiState.unlockedFacts)
        );
      }
    } catch {}
  }, [
    uiState.highScore,
    uiState.status,
    uiState.totalScore,
    uiState.unlockedFacts,
    uiState.mode,
    uiState.currentLevel,
    uiState.sprintStars,
    loadedHighScore,
  ]);

  // Save the endless best when a run ends, apart from the high score (#2051).
  const endlessRunScore =
    uiState.mode === "endless" && uiState.status === "failed"
      ? computeEndlessScore(uiState)
      : 0;
  useEffect(() => {
    if (endlessRunScore <= loadedEndlessBest) return;
    try {
      safeSetRawItem(ENDLESS_BEST_KEY, String(endlessRunScore));
    } catch {}
  }, [endlessRunScore, loadedEndlessBest]);

  // Persist the wardrobe and best stars so they survive a reload (#2050).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      safeSetRawItem(
        ACCESSORIES_KEY,
        JSON.stringify({
          unlocked: uiState.unlockedAccessories,
          equipped: uiState.activeAccessory,
        })
      );
    } catch {}
  }, [uiState.unlockedAccessories, uiState.activeAccessory]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (Object.keys(uiState.bestStars).length === 0) return;
    try {
      safeSetRawItem(BEST_STARS_KEY, JSON.stringify(uiState.bestStars));
    } catch {}
  }, [uiState.bestStars]);

  const touchScene: DuckTouchSnapshot["scene"] = uiState.inBathtub
    ? "bath"
    : uiState.inDogPark
      ? "park"
      : "office";

  return {
    advanceClock,
    resetClock,
    addInterruption,
    applyTransition,
    gameStateRef,
    halloween,
    halloweenRef,
    isManuallyPaused,
    loadedEndlessBest,
    loadedHighScore,
    openManualsCountRef,
    pendingDragReleaseRef,
    rawSprintBests,
    removeInterruption,
    startSprint,
    toggleManualPause,
    touchScene,
    uiState,
  };
}
