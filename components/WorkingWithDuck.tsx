"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useSyncExternalStore,
  useCallback,
} from "react";
import Link from "next/link";
import { clamp, gameFont } from "@/lib/game-utils";
import Image from "next/image";
import { useAudio } from "@/components/providers/AudioProvider";
import { useTelemetry } from "@/hooks/useTelemetry";
import { FieldManualButton } from "@/components/FieldManualButton";
import { FullscreenButton } from "@/components/arcade/FullscreenButton";
import { ResultCard } from "@/components/arcade/ResultCard";
import { useArcadeFx } from "@/hooks/useArcadeFx";
import { useSkipTitleScreen } from "@/components/arcade/CabinetSetupContext";
import { ArcadeHud } from "@/components/arcade/ArcadeHud";
import { DynamicTabletOrientationHint as TabletOrientationHint } from "@/components/arcade/DynamicTabletOrientationHint";
import { useGameFullscreen as useFullscreen } from "@/components/arcade/CabinetFullscreen";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import {
  safeGetItem,
  safeGetRawItem,
  safeSetRawItem,
} from "@/lib/safe-storage";
import { recordArcadeScore } from "@/lib/arcade-achievements";
import { useDuckService } from "@/hooks/useDuckService";
import { useResponsiveCanvas } from "@/hooks/useResponsiveCanvas";
import { useCanvasResolution } from "@/hooks/useCanvasResolution";
import { applyCanvasScale } from "@/lib/arcade";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import { useHotkeys } from "@/hooks/useHotkeys";
import {
  IconPlayerPlay,
  IconPlayerPause,
  IconRotate,
  IconBone,
  IconBallTennis,
  IconTrees,
  IconVolume,
  IconVolumeOff,
  IconBook,
  IconX,
  IconPhoto,
  IconPalette,
  IconMusic,
  IconMusicOff,
  IconInfoCircle,
  IconShirt,
  IconDroplet,
  IconCheck,
  IconCode,
} from "@tabler/icons-react";
import {
  WorkingWithDuckState,
  DuckAccessory,
  createInitialDuckGameState,
  stepDuckGame,
  startDraggingDuck,
  dragDuckTo,
  releaseDuck,
  activeCodeBurst,
  applySqueakyToy,
  applyKongToy,
  scrubBelly,
  mopIndoorPuddle,
  enterBathtub,
  scrubBathtub,
  rinseBathtub,
  exitBathtub,
  enterDogPark,
  throwParkBall,
  jumpParkHurdle,
  steerParkDuck,
  tapParkWhistle,
  exitDogPark,
  shouldSyncDuckHudState,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DESK_BOUNDS,
  BACK_DOOR_BOUNDS,
  WATER_BOWL_BOUNDS,
  FOOD_BOWL_BOUNDS,
  BATHTUB_BOUNDS,
  DUCK_FACTS,
  SPRINTS,
  SoundCue,
} from "@/lib/working-with-duck-engine";
import {
  drawDuck,
  drawOfficeScene,
} from "@/components/working-with-duck/office-art";
import { drawBathtubScene } from "@/components/working-with-duck/bath-art";

/** Fixed simulation step for the Duck loop: the engine is tuned to 60 ticks/sec (#600). */
const DUCK_FIXED_STEP_MS = 1000 / 60;
/** Most fixed steps one rendered frame may replay after a long gap. */
const DUCK_MAX_CATCHUP_STEPS = 8;

/** Keys the Duck keyboard handler acts on, named for `useHotkeys`. */
const DUCK_HOTKEY_KEYS = [
  "p",
  "1",
  "2",
  "3",
  "4",
  "q",
  "w",
  "e",
  "r",
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
] as const;

/**
 * Every Ctrl/Alt/Meta combination the old window listener accepted. It never
 * checked modifiers, and useHotkeys matches Ctrl, Alt and Meta exactly, so
 * each one is listed. Shift needs no entry: useHotkeys ignores it unless a
 * hotkey names it.
 */
const DUCK_HOTKEY_MODIFIERS = [
  "",
  "Ctrl+",
  "Alt+",
  "Meta+",
  "Ctrl+Alt+",
  "Ctrl+Meta+",
  "Alt+Meta+",
  "Ctrl+Alt+Meta+",
] as const;

const DUCK_HOTKEYS: readonly string[] = DUCK_HOTKEY_KEYS.flatMap((key) =>
  DUCK_HOTKEY_MODIFIERS.map((modifiers) => `${modifiers}${key}`)
);

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

// --- Pure Drawing Helpers Outside Component ---

function drawDogParkScene(
  ctx: CanvasRenderingContext2D,
  state: WorkingWithDuckState,
  aimParkStart: { x: number; y: number } | null = null
) {
  const park = state.parkState;

  // 1. Lush Green Grass
  ctx.fillStyle = "#14532d";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Grass texture accents
  ctx.strokeStyle = "#166534";
  ctx.lineWidth = 2;
  for (let gx = 30; gx < CANVAS_WIDTH; gx += 50) {
    for (let gy = 40; gy < CANVAS_HEIGHT; gy += 60) {
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx - 4, gy - 8);
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + 4, gy - 10);
      ctx.stroke();
    }
  }

  // 2. Mud Puddles
  park.puddles.forEach((puddle) => {
    ctx.fillStyle = "#78350f";
    ctx.strokeStyle = "#451a03";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(
      puddle.x,
      puddle.y,
      puddle.radius * 1.3,
      puddle.radius,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#92400e";
    ctx.beginPath();
    ctx.ellipse(
      puddle.x - 5,
      puddle.y - 4,
      puddle.radius * 0.7,
      puddle.radius * 0.5,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = "#fde68a";
    ctx.font = gameFont(10, "bold");
    ctx.textAlign = "center";
    ctx.fillText("MUD PUDDLE!", puddle.x, puddle.y + 4);
  });

  // 3. Agility Hurdles
  park.hurdles.forEach((hurdle) => {
    ctx.fillStyle = hurdle.cleared ? "#15803d" : "#ea580c";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.fillRect(
      hurdle.x - hurdle.width / 2,
      hurdle.y - hurdle.height / 2,
      hurdle.width,
      hurdle.height
    );
    ctx.strokeRect(
      hurdle.x - hurdle.width / 2,
      hurdle.y - hurdle.height / 2,
      hurdle.width,
      hurdle.height
    );

    ctx.fillStyle = "#ffffff";
    ctx.font = gameFont(9, "bold");
    ctx.textAlign = "center";
    ctx.fillText(
      hurdle.cleared ? "CLEARED" : "JUMP (SPACE)",
      hurdle.x,
      hurdle.y - hurdle.height / 2 - 6
    );
  });

  // 4. Friendly Dog NPCs
  park.friends.forEach((friend) => {
    ctx.save();
    ctx.translate(friend.x, friend.y);
    ctx.fillStyle = friend.breed === "corgi" ? "#d97706" : "#facc15";
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#18181b";
    ctx.font = "12px sans-serif";
    ctx.fillText(friend.breed === "corgi" ? "🦊" : "🐕", 0, 4);

    ctx.fillStyle = friend.greeted ? "#4ade80" : "#ffffff";
    ctx.font = gameFont(9, "bold");
    ctx.fillText(friend.greeted ? `❤️ ${friend.name}` : friend.name, 0, 22);
    ctx.restore();
  });

  // 5. Golden Bonus Bones
  park.bones.forEach((bone) => {
    if (!bone.collected) {
      ctx.save();
      ctx.fillStyle = "#facc15";
      ctx.strokeStyle = "#ca8a04";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(
        bone.x,
        bone.y,
        14 + Math.sin(state.ticks * 0.1) * 2,
        0,
        Math.PI * 2
      );
      ctx.stroke();

      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🦴", bone.x, bone.y + 6);
      ctx.restore();
    }
  });

  // 6. Player at left side
  ctx.fillStyle = "#27272a";
  ctx.beginPath();
  ctx.arc(80, 250, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = gameFont(10, "bold");
  ctx.textAlign = "center";
  ctx.fillText("YOU", 80, 254);

  // 7. Thrown Ball / Frisbee Trajectory
  if (park.status === "thrown" || park.status === "retrieving") {
    if (park.mode === "frisbee") {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.ellipse(park.ballX, park.ballY, 14, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = "#84cc16";
      ctx.beginPath();
      ctx.arc(park.ballX, park.ballY, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Aim Line when aiming
  if (park.status === "aim" && aimParkStart) {
    ctx.strokeStyle = "#a3e635";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(90, 250);
    ctx.lineTo(aimParkStart.x, aimParkStart.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 8. Duck in Park with Jump Offset
  const jumpOffset = park.jumpHeight || 0;
  drawDuck(
    ctx,
    {
      x: park.duckX,
      y: park.duckY - jumpOffset,
      angle: park.duckAngle,
      state: park.status === "retrieving" ? "FETCHING_BALL" : "IDLE_ROAM",
      isCarryingBall: park.status === "retrieving",
    },
    {
      ticks: state.ticks,
      accessory: state.activeAccessory,
      isMuddy: park.status === "muddy",
    }
  );

  // Park Instructions Overlay
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(CANVAS_WIDTH / 2 - 220, 15, 440, 52);
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(CANVAS_WIDTH / 2 - 220, 15, 440, 52);

  ctx.fillStyle = "#ffffff";
  ctx.font = gameFont(11, "bold");
  ctx.textAlign = "center";
  if (park.status === "aim") {
    ctx.fillText(
      "🎾 Phase 1: Click & Drag on field to Launch!",
      CANVAS_WIDTH / 2,
      34
    );
    ctx.fillText(
      "Duck will sprint across to fetch & jump obstacles",
      CANVAS_WIDTH / 2,
      50
    );
  } else if (park.status === "thrown" || park.status === "retrieving") {
    ctx.fillStyle = "#facc15";
    ctx.fillText(
      `🐾 Steer Duck (Mouse) · Jump Hurdles (Space) · Bones: ${park.bonesCollected}/3`,
      CANVAS_WIDTH / 2,
      34
    );
    ctx.fillText(
      "Dodge mud puddles, jump hurdles & greet park friends!",
      CANVAS_WIDTH / 2,
      50
    );
  } else if (park.status === "success") {
    ctx.fillStyle = "#4ade80";
    ctx.fillText(
      `🌟 Perfect Fetch! Duck retrieved ball & ${park.bonesCollected} bones!`,
      CANVAS_WIDTH / 2,
      34
    );
    ctx.fillText(
      "Click 'Return to Office' for 30s Tired Puppy Buff",
      CANVAS_WIDTH / 2,
      50
    );
  } else if (park.status === "muddy") {
    ctx.fillStyle = "#f87171";
    ctx.fillText(
      "💦 Duck splashed in mud! Needs a quick bath in the Washroom!",
      CANVAS_WIDTH / 2,
      34
    );
    ctx.fillText(
      "Click 'Return to Office' to wash in Bathtub",
      CANVAS_WIDTH / 2,
      50
    );
  }
}

function drawCanvas(
  ctx: CanvasRenderingContext2D,
  state: WorkingWithDuckState,
  aimParkStart: { x: number; y: number } | null = null,
  scale = 1
) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (state.inDogPark) {
    drawDogParkScene(ctx, state, aimParkStart);
    return;
  }

  if (state.inBathtub) {
    drawBathtubScene(ctx, state);
    return;
  }

  drawOfficeScene(ctx, state, scale);
}

// --- Main React Component ---

type InterruptionReason =
  "manual" | "scrapbook" | "wardrobe" | "manual_guide" | "hidden";

interface WorkingWithDuckProps {
  /**
   * Test/debug seam only: seeds both gameStateRef and uiState with this
   * exact state at mount instead of a fresh createInitialDuckGameState()
   * call. Lets a real-component + real-engine test drive straight to a
   * specific (e.g. near-terminal) state without simulating thousands of
   * ticks or mocking the engine module (#655). Not used by any production
   * caller.
   */
  initialState?: WorkingWithDuckState;
}

interface DuckSprintResultProps {
  state: WorkingWithDuckState;
  sprintTitle: string;
  /** The saved best, read before this run's score is written over it. */
  storedBest: number;
  onNext: () => void;
  onReplay: () => void;
  onEndless: () => void;
}

const RESULT_LINK =
  "inline-flex min-h-[48px] items-center rounded-xl border border-white/[0.08] px-3 font-mono text-[11px] text-zinc-200 transition-colors hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300";

/**
 * The end of a sprint on the shared arcade result card: what shipped, how
 * good Duck was, the scrapbook photo it earned, and Next or Retry.
 */
function DuckSprintResult({
  state,
  sprintTitle,
  storedBest,
  onNext,
  onReplay,
  onEndless,
}: DuckSprintResultProps) {
  // Captured when the card opens; the save that follows a win would
  // otherwise read as "tied your best".
  const [previousBest] = useState(storedBest);
  const won = state.status === "won";
  const level = state.currentLevel;
  const workPercent = clamp(
    Math.round((state.workProgress / state.targetWorkProgress) * 100),
    0,
    100
  );
  const propsSaved = state.hazards.filter((h) => !h.isChewed).length;
  const stats = [
    { label: "Score", value: state.totalScore },
    { label: "Work shipped", value: workPercent, suffix: "%" },
    { label: "Good Boy", value: Math.round(state.naughtyVsGood) },
    {
      label: "Props saved",
      value: propsSaved,
      suffix: `/${state.hazards.length}`,
    },
  ];

  if (!won) {
    return (
      <ResultCard
        headingId="duck-fail-dialog-heading"
        title="Duck Got a Time-Out!"
        stamp="Time-out"
        verdict="loss"
        message="Too many sneaky chews and missed potty breaks tilted the scale fully red. Take a breath and try again!"
        stats={stats}
        score={state.totalScore}
        previousBest={previousBest}
        primary={{
          label: `Retry Sprint ${level}`,
          onClick: onReplay,
          icon: <IconRotate aria-hidden="true" className="h-4 w-4" />,
        }}
        onEscape={onReplay}
      />
    );
  }

  const fact = state.latestUnlockedFact;
  return (
    <ResultCard
      headingId="duck-win-dialog-heading"
      title="Duck is Asleep & Work is Done"
      stamp="Shipped"
      verdict="win"
      message={`${
        state.mode === "endless" ? "Endless Milestone" : sprintTitle
      } Completed! Every cable survived, the puppy pads held, and the office budget spreadsheet is still unchewed.`}
      stats={stats}
      score={state.totalScore}
      previousBest={previousBest}
      primary={{
        label:
          level < 5 ? `Proceed to Sprint ${level + 1}` : "Play Endless Mode",
        onClick: onNext,
      }}
      secondary={{
        label: `Replay Sprint ${level}`,
        onClick: onReplay,
        icon: <IconRotate aria-hidden="true" className="h-4 w-4" />,
      }}
      onEscape={onNext}
    >
      {fact && (
        <figure className="mt-4 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#0d0e11] p-2.5">
          <div className="relative h-20 w-20 shrink-0 -rotate-2 overflow-hidden rounded-sm border-4 border-b-[10px] border-[#f4f4f6] bg-amber-50 shadow-lg">
            <Image
              src={fact.photoUrl}
              alt={fact.title}
              fill
              className="object-cover"
              sizes="80px"
            />
          </div>
          <figcaption className="min-w-0">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300">
              New scrapbook photo
            </p>
            <p className="mt-0.5 font-mono text-xs font-bold text-zinc-100">
              {fact.title}
            </p>
            <p className="mt-0.5 line-clamp-3 text-[11px] leading-snug text-zinc-400">
              {fact.fact}
            </p>
          </figcaption>
        </figure>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {level < 5 && (
          <button
            type="button"
            onClick={onEndless}
            className={`${RESULT_LINK} min-w-[48px]`}
          >
            <span>Play Endless Mode</span>
          </button>
        )}
        <Link href="/case-studies" className={RESULT_LINK}>
          <span>Browse Case Studies</span>
        </Link>
        <a
          href="https://github.com/fderuiter"
          target="_blank"
          rel="noopener noreferrer"
          className={RESULT_LINK}
        >
          <span>GitHub</span>
        </a>
      </div>
    </ResultCard>
  );
}
// Action dock styles (#1676): graphite keys, amber for the held toy,
// emerald for tricks, and the cabinet accent for the one primary action.
const DOCK_BUTTON =
  "disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation select-none active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300";
const TOY_IDLE =
  "border-white/[0.08] bg-[#13151a] text-zinc-300 hover:border-white/20 hover:text-white";
const TOY_SELECTED = "border-amber-400/70 bg-amber-400/15 text-amber-200";
const TRICK_BUTTON =
  "border-white/[0.08] bg-[#13151a] text-zinc-200 hover:border-emerald-400/50 hover:bg-emerald-400/10 hover:text-emerald-100";
const DOCK_KEY =
  "inline-flex h-5 min-w-5 items-center justify-center rounded border border-b-2 border-white/15 bg-[#0d0e11] px-1 font-mono text-[10px] font-bold text-zinc-300";
const TRICK_KEY =
  "inline-flex h-5 min-w-5 items-center justify-center rounded border border-b-2 border-emerald-400/30 bg-[#0d0e11] px-1 font-mono text-[10px] font-bold text-emerald-300";
const DOCK_GROUP = "flex min-w-0 flex-wrap items-center gap-1";
const DOCK_CAPTION =
  "pr-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400";

export const WorkingWithDuck: React.FC<WorkingWithDuckProps> = ({
  initialState,
}) => {
  const rawHighScore = useSyncExternalStore(
    subscribeStorage,
    getHighScoreSnapshot,
    getServerSnapshot
  );
  const loadedHighScore = parseInt(rawHighScore, 10) || 0;

  const { playNote, muted, setMuted } = useAudio();
  const { recordEvent } = useTelemetry();

  const createDefaultState = () =>
    createInitialDuckGameState(
      1,
      "campaign",
      undefined,
      getStoredUnlockedFacts()
    );

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
  const [isScrapbookOpen, setIsScrapbookOpen] = useState(false);
  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [activeScrapbookIndex, setActiveScrapbookIndex] = useState(0);
  const [scrapbookViewMode, setScrapbookViewMode] = useState<
    "photo" | "vector"
  >("photo");
  const [mobileTab, setMobileTab] = useState<"toys" | "tricks" | "actions">(
    "toys"
  );
  const fx = useArcadeFx();
  const { stageRef: fxStageRef, flashRef: fxFlashRef } = fx;
  const [dismissedTip, setDismissedTip] = useState<string | null>(null);
  const isDraggingDuckStateRef = useRef(false);
  // A pointer drag that ends while the sprint is paused cannot drop Duck
  // (releaseDuck is a no-op while paused, #1645), so the drop waits for the
  // sprint to resume instead of leaving Duck held.
  const pendingDragReleaseRef = useRef(false);
  const isThrowingParkBallRef = useRef(false);
  const aimParkStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isMusicMuted, setIsMusicMuted] = useState(false);

  const { announce } = useAnnouncer();
  const { dispatchCommand, interactHazard } = useDuckService();

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

  const handleGiveTreat = useCallback(() => {
    applyTransition((state) => {
      const res = dispatchCommand({ type: "treat", state });
      return res.success ? res.data.state : state;
    });
  }, [applyTransition, dispatchCommand]);

  const handlePerformTrick = useCallback(
    (trick: "SIT" | "HIGH_FIVE" | "DROP_IT" | "SPIN") => {
      applyTransition((state) => {
        const res = dispatchCommand({ type: "trick", state, trick });
        return res.success ? res.data.state : state;
      });
    },
    [applyTransition, dispatchCommand]
  );

  const handleEquipAccessory = useCallback(
    (accessory: DuckAccessory) => {
      applyTransition((state) => {
        const res = dispatchCommand({ type: "accessory", state, accessory });
        return res.success ? res.data.state : state;
      });
    },
    [applyTransition, dispatchCommand]
  );

  const handleAdvanceLevel = useCallback(() => {
    applyTransition((state) => {
      const res = dispatchCommand({ type: "advance_level", state });
      return res.success ? res.data.state : state;
    });
  }, [applyTransition, dispatchCommand]);

  // Fixed-timestep simulation clock: the engine's tick balance (work
  // increments, timers, combo decay) was tuned assuming 60 ticks/sec, so
  // the loop below advances the simulation by real elapsed time in whole
  // FIXED_STEP_MS chunks instead of once per rendered frame. That keeps
  // gameplay speed identical at 30/60/120Hz instead of scaling with the
  // display's refresh rate (#600).
  const lastFrameTimeRef = useRef<number | null>(null);
  const stepAccumulatorRef = useRef(0);

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

  // One title screen per game (#1516): inside a cabinet, the attract screen
  // was the title, so Launch starts Sprint 1 at once. Sprint 1's guided hints
  // carry its instructions, and Scrapbook, Wardrobe and the Manual stay in
  // the action dock. Later sprints keep their briefing as a short intro.
  const skipTitleScreen = useSkipTitleScreen();

  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!skipTitleScreen || autoStartedRef.current) return;
    autoStartedRef.current = true;
    const state = gameStateRef.current;
    if (state.status === "idle" && state.currentLevel === 1) startSprint();
  }, [skipTitleScreen, startSprint]);

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

  const openScrapbook = useCallback(() => {
    setIsScrapbookOpen(true);
    addInterruption("scrapbook");
  }, [addInterruption]);

  const closeScrapbook = useCallback(() => {
    setIsScrapbookOpen(false);
    removeInterruption("scrapbook");
  }, [removeInterruption]);

  const openWardrobe = useCallback(() => {
    setIsWardrobeOpen(true);
    addInterruption("wardrobe");
  }, [addInterruption]);

  const closeWardrobe = useCallback(() => {
    setIsWardrobeOpen(false);
    removeInterruption("wardrobe");
  }, [removeInterruption]);

  const openManualsCountRef = useRef(0);

  const handleManualOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        openManualsCountRef.current += 1;
        setIsManualOpen(true);
        addInterruption("manual_guide");
      } else {
        openManualsCountRef.current = Math.max(
          0,
          openManualsCountRef.current - 1
        );
        if (openManualsCountRef.current === 0) {
          setIsManualOpen(false);
          removeInterruption("manual_guide");
        }
      }
    },
    [addInterruption, removeInterruption]
  );

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

  // Loud moments (#1677): a chewed prop, an accident, the zoomies, a
  // surprise at the window, and the end of a sprint nudge the stage.
  // useArcadeFx skips all of it under reduced motion and below 768px.
  const chewedCount = (uiState.hazards ?? []).filter((h) => h.isChewed).length;
  const puddleCount = uiState.indoorPuddles?.length ?? 0;
  const hasZoomies = uiState.duck.state === "ZOOMIES";
  const hasSurprise = uiState.activeSurpriseEvent !== null;
  const fxPrevRef = useRef({
    chewedCount,
    puddleCount,
    hasZoomies,
    hasSurprise,
    status: uiState.status,
  });
  useEffect(() => {
    const prev = fxPrevRef.current;
    if (uiState.status === "failed" && prev.status !== "failed") {
      fx.shake(5);
      fx.flash("#fb7185");
    } else if (uiState.status === "won" && prev.status !== "won") {
      fx.flash("#fbbf24");
    } else if (chewedCount > prev.chewedCount) {
      fx.shake(4);
      fx.flash("#fb7185");
    } else if (puddleCount > prev.puddleCount) {
      fx.shake(3);
    } else if (
      (hasZoomies && !prev.hasZoomies) ||
      (hasSurprise && !prev.hasSurprise)
    ) {
      fx.shake(2);
    }
    fxPrevRef.current = {
      chewedCount,
      puddleCount,
      hasZoomies,
      hasSurprise,
      status: uiState.status,
    };
  }, [fx, uiState.status, chewedCount, puddleCount, hasZoomies, hasSurprise]);

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

  const wardrobeTrapRef = useFocusTrap<HTMLDivElement>(isWardrobeOpen, {
    onEscape: () => closeWardrobe(),
  });

  const scrapbookTrapRef = useFocusTrap<HTMLDivElement>(isScrapbookOpen, {
    onEscape: () => closeScrapbook(),
  });

  const pauseTrapRef = useFocusTrap<HTMLDivElement>(
    uiState.status === "paused" &&
      isManuallyPaused &&
      !isScrapbookOpen &&
      !isWardrobeOpen &&
      !isManualOpen,
    {
      onEscape: () => toggleManualPause(),
    }
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toGameCoordinates } = useResponsiveCanvas({
    canvasRef,
    internalWidth: CANVAS_WIDTH,
    internalHeight: CANVAS_HEIGHT,
    maxDpr: 2.0,
  });
  // Sharp on HiDPI screens; drawing stays in the 800x500 logical space.
  const canvasScaleRef = useCanvasResolution({
    canvasRef,
    logicalWidth: CANVAS_WIDTH,
    logicalHeight: CANVAS_HEIGHT,
    // Resizing clears the bitmap; repaint in case the loop is idle.
    onResize: (scale) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      applyCanvasScale(ctx, scale);
      drawCanvas(ctx, gameStateRef.current, aimParkStartRef.current, scale);
    },
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // One-screen rule (#1516): the windowed canvas takes the cabinet's stage
  // budget minus Duck's own chrome, the HUD above it and the action dock
  // below, so the dock's rows stay on screen when they wrap at 1024px.
  // Written straight to a CSS variable, so resizing costs no renders.
  const hudRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = containerRef.current;
    const hud = hudRef.current;
    const dock = dockRef.current;
    if (!container || !hud || !dock) return;
    const measure = () => {
      // 8px margins sit between the HUD, the canvas and the dock.
      const chrome =
        hud.getBoundingClientRect().height +
        dock.getBoundingClientRect().height +
        16;
      container.style.setProperty("--duck-chrome", `${Math.ceil(chrome)}px`);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(hud);
    observer.observe(dock);
    return () => observer.disconnect();
  }, []);

  const [_isNearViewport, setIsNearViewport] = useState<boolean>(() => {
    if (
      typeof window === "undefined" ||
      typeof IntersectionObserver === "undefined"
    ) {
      return true;
    }
    return false;
  });

  // Native IntersectionObserver to defer loading high-res scrapbook photos until container is within 200px of viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsNearViewport(true);
          }
        });
      },
      { rootMargin: "200px" }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);
  const lastBellyScrubPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef);

  // Web Audio Procedural Synthesizer for Duck Sound Effects & Lo-Fi Beats
  const playSoundCue = useCallback(
    (cue: SoundCue) => {
      if (muted) return;
      try {
        if (cue === "tippy-tap") {
          playNote(700 + Math.random() * 200, 0.015);
        } else if (cue === "squeak") {
          playNote(1200, 0.05);
          setTimeout(() => playNote(1650, 0.04), 30);
        } else if (cue === "bark") {
          playNote(340, 0.06);
          setTimeout(() => playNote(220, 0.08), 25);
        } else if (cue === "belly-rub") {
          playNote(523.25 + Math.random() * 100, 0.08);
        } else if (cue === "whistle") {
          playNote(1760, 0.08);
          setTimeout(() => playNote(2093, 0.06), 40);
        } else if (cue === "snore") {
          playNote(160, 0.25);
        } else if (cue === "ding") {
          playNote(523.25, 0.08);
          setTimeout(() => playNote(659.25, 0.08), 60);
          setTimeout(() => playNote(783.99, 0.12), 120);
        } else if (cue === "fail") {
          playNote(220, 0.15);
          setTimeout(() => playNote(180, 0.2), 100);
        } else if (cue === "door-knock") {
          playNote(140, 0.06);
          setTimeout(() => playNote(130, 0.06), 90);
          setTimeout(() => playNote(140, 0.06), 180);
        } else if (cue === "squirrel-chirp") {
          playNote(2200, 0.04);
          setTimeout(() => playNote(2600, 0.04), 50);
        } else if (cue === "hiccup") {
          playNote(650, 0.03);
        } else if (cue === "combo-fanfare") {
          playNote(523.25, 0.06);
          setTimeout(() => playNote(659.25, 0.06), 50);
          setTimeout(() => playNote(783.99, 0.06), 100);
          setTimeout(() => playNote(1046.5, 0.12), 150);
        } else if (cue === "trick-chime") {
          playNote(880, 0.06);
          setTimeout(() => playNote(1174.66, 0.08), 50);
        } else if (cue === "paw-clap") {
          playNote(440, 0.04);
          setTimeout(() => playNote(880, 0.04), 25);
        } else if (cue === "spin-whoosh") {
          playNote(300, 0.06);
          setTimeout(() => playNote(600, 0.06), 40);
        } else if (cue === "bath-soap") {
          playNote(900 + Math.random() * 300, 0.03);
        } else if (cue === "bath-rinse") {
          playNote(400, 0.1);
          setTimeout(() => playNote(500, 0.1), 60);
        } else if (cue === "water-lap") {
          playNote(600, 0.03);
        } else if (cue === "crunch-kibble") {
          playNote(250, 0.03);
        } else if (cue === "code-type") {
          playNote(1200 + Math.random() * 200, 0.015);
        } else if (cue === "frisbee-throw") {
          playNote(700, 0.08);
          setTimeout(() => playNote(950, 0.08), 50);
        }
      } catch {}
    },
    [muted, playNote]
  );

  const playSoundCueRef = useRef(playSoundCue);
  useEffect(() => {
    playSoundCueRef.current = playSoundCue;
  }, [playSoundCue]);

  // Procedural Lo-Fi Background Music Loop
  useEffect(() => {
    if (muted || isMusicMuted || uiState.status !== "running") return;

    const chords = [
      [261.63, 329.63, 392.0, 493.88], // Cmaj7
      [220.0, 261.63, 329.63, 392.0], // Am7
      [293.66, 349.23, 440.0, 523.25], // Dm7
      [196.0, 246.94, 293.66, 349.23], // G7
    ];

    let chordIdx = 0;
    const interval = setInterval(() => {
      try {
        const chord = chords[chordIdx];
        chord.forEach((freq, i) => {
          setTimeout(() => {
            playNote(freq, 0.35);
          }, i * 40);
        });
        chordIdx = (chordIdx + 1) % chords.length;
      } catch {}
    }, 2400);

    return () => clearInterval(interval);
  }, [muted, isMusicMuted, uiState.status, playNote]);

  // Sync high scores safely to localStorage and emit score events
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (uiState.totalScore > 0) {
        recordArcadeScore("working-with-duck", uiState.totalScore);
      }
      if (uiState.highScore > loadedHighScore) {
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
    uiState.totalScore,
    uiState.unlockedFacts,
    loadedHighScore,
  ]);

  // Main 60 FPS Canvas Game Loop
  //
  // The loop stops only while the canvas context is lost; idle, paused and
  // finished sessions keep drawing, exactly as before. The context listeners
  // set a ref that guards the frame already in flight and a state flag that
  // stops the loop; restoring the context starts a fresh one.
  const contextLostRef = useRef(false);
  const [isContextLost, setIsContextLost] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      contextLostRef.current = true;
      setIsContextLost(true);
    };

    const handleContextRestored = () => {
      contextLostRef.current = false;
      // Discard elapsed wall-clock time across the context-loss gap so
      // resuming doesn't replay it as a burst of catch-up steps.
      lastFrameTimeRef.current = null;
      stepAccumulatorRef.current = 0;
      setIsContextLost(false);
    };

    canvas.addEventListener("contextlost", handleContextLost);
    canvas.addEventListener("contextrestored", handleContextRestored);
    return () => {
      canvas.removeEventListener("contextlost", handleContextLost);
      canvas.removeEventListener("contextrestored", handleContextRestored);
    };
  }, []);

  // Simulation runs on a fixed 60Hz timestep (the engine's tick balance —
  // work increments, timers, combo decay — was tuned assuming 60 ticks/sec)
  // driven by real elapsed time, not once per rendered frame, so gameplay
  // speed stays identical whether the display is 30, 60, or 120Hz (#600).
  // The loop's own delta is unclamped (maxDeltaMs: Infinity); the catch-up
  // cap below is the only clamp, as before. lastFrameTimeRef holds the
  // loop's clock (elapsedMs) at the previous frame, so the difference
  // between two frames is the real gap between them.
  useAnimationFrame(
    (_deltaMs, clockMs) => {
      if (contextLostRef.current) return;

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
            const stepped = stepDuckGame(state);
            if (stepped.soundCueQueue.length > 0) {
              cuesToPlay = stepped.soundCueQueue;
              return { ...stepped, soundCueQueue: [] };
            }
            return stepped;
          }, shouldSyncDuckHudState);
          stepAccumulatorRef.current -= DUCK_FIXED_STEP_MS;
          stepsThisFrame++;

          // Process sound cue queue
          cuesToPlay.forEach((cue) => playSoundCueRef.current(cue));
        }
      }

      // Draw canvas frame
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const scale = canvasScaleRef.current;
          applyCanvasScale(ctx, scale);
          drawCanvas(ctx, gameStateRef.current, aimParkStartRef.current, scale);
        }
      }
    },
    { isActive: !isContextLost, maxDeltaMs: Infinity }
  );

  // Keyboard Shortcuts (1-4 for hotbar items, Q-W-E-R for tricks, Space for coding/jumping)
  //
  // DUCK_HOTKEYS lists every key the handler acts on under every Ctrl, Alt
  // and Meta combination, because the listener never checked modifiers.
  // The container is a keyboard boundary, so the binding opts in to it; the
  // handler keeps its own interactive-target and focus checks.
  useHotkeys(
    DUCK_HOTKEYS,
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const interactiveTag =
        target?.tagName === "BUTTON" ||
        target?.tagName === "SELECT" ||
        target?.tagName === "A";
      const interactiveRole =
        target?.getAttribute?.("role") === "button" ||
        target?.getAttribute?.("role") === "link" ||
        target?.getAttribute?.("role") === "menuitem" ||
        target?.getAttribute?.("role") === "tab";
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable ||
        interactiveTag ||
        interactiveRole
      ) {
        return;
      }

      // Restrict key listener to only fire when focus is within our container
      if (
        !containerRef.current ||
        !containerRef.current.contains(document.activeElement)
      ) {
        return;
      }

      const state = gameStateRef.current;
      if (e.key === "p" || e.key === "P") {
        if (state.status === "running" || state.status === "paused") {
          e.preventDefault();
          toggleManualPause();
        }
      } else if (state.status === "paused") {
        // A paused sprint is frozen (#1645): only P acts. Swallow Space and
        // the arrows so they don't scroll the page behind the pause overlay.
        if (e.code === "Space" || e.key.startsWith("Arrow")) {
          e.preventDefault();
        }
      } else if (e.key === "1") {
        if (!state.inDogPark && !state.inBathtub) {
          applyTransition((state) => ({
            ...state,
            selectedItem: "tennis-ball",
          }));
        }
      } else if (e.key === "2") {
        if (!state.inDogPark && !state.inBathtub) {
          applyTransition((state) => ({ ...state, selectedItem: "kong" }));
        }
      } else if (e.key === "3") {
        if (!state.inDogPark && !state.inBathtub) {
          applyTransition((state) => ({
            ...state,
            selectedItem: "squeaky-toy",
          }));
        }
      } else if (e.key === "4") {
        handleGiveTreat();
      } else if (e.key === "q" || e.key === "Q") {
        if (!state.inDogPark && !state.inBathtub) {
          handlePerformTrick("SIT");
        }
      } else if (e.key === "w" || e.key === "W") {
        if (!state.inDogPark && !state.inBathtub) {
          handlePerformTrick("HIGH_FIVE");
        } else if (state.inDogPark) {
          applyTransition((state) =>
            steerParkDuck(state, state.parkState.duckY - 25)
          );
        }
      } else if (e.key === "e" || e.key === "E") {
        if (!state.inDogPark && !state.inBathtub) {
          handlePerformTrick("DROP_IT");
        }
      } else if (e.key === "r" || e.key === "R") {
        if (!state.inDogPark && !state.inBathtub) {
          handlePerformTrick("SPIN");
        }
      } else if (e.code === "Space") {
        e.preventDefault();
        if (state.inDogPark) {
          applyTransition((state) => jumpParkHurdle(state));
        } else if (!state.inBathtub) {
          applyTransition((state) => activeCodeBurst(state));
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (state.inDogPark) {
          applyTransition((state) =>
            steerParkDuck(state, state.parkState.duckY - 25)
          );
        } else {
          const s = applyTransition((state) => {
            let next = state;
            if (next.duck.state !== "DRAGGED") {
              next = startDraggingDuck(next);
            }
            const nextY = Math.max(50, next.duck.y - 25);
            return dragDuckTo(next, next.duck.x, nextY);
          });
          announce(
            `Dragging Duck up. Horizontal position ${Math.round(s.duck.x)}, vertical position ${Math.round(s.duck.y)}. Press Enter to drop.`,
            "polite"
          );
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (state.inDogPark) {
          applyTransition((state) =>
            steerParkDuck(state, state.parkState.duckY + 25)
          );
        } else {
          const s = applyTransition((state) => {
            let next = state;
            if (next.duck.state !== "DRAGGED") {
              next = startDraggingDuck(next);
            }
            const nextY = Math.min(CANVAS_HEIGHT - 50, next.duck.y + 25);
            return dragDuckTo(next, next.duck.x, nextY);
          });
          announce(
            `Dragging Duck down. Horizontal position ${Math.round(s.duck.x)}, vertical position ${Math.round(s.duck.y)}. Press Enter to drop.`,
            "polite"
          );
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (!state.inDogPark) {
          const s = applyTransition((state) => {
            let next = state;
            if (next.duck.state !== "DRAGGED") {
              next = startDraggingDuck(next);
            }
            const nextX = Math.max(50, next.duck.x - 25);
            return dragDuckTo(next, nextX, next.duck.y);
          });
          announce(
            `Dragging Duck left. Horizontal position ${Math.round(s.duck.x)}, vertical position ${Math.round(s.duck.y)}. Press Enter to drop.`,
            "polite"
          );
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (!state.inDogPark) {
          const s = applyTransition((state) => {
            let next = state;
            if (next.duck.state !== "DRAGGED") {
              next = startDraggingDuck(next);
            }
            const nextX = Math.min(CANVAS_WIDTH - 25, next.duck.x + 25);
            return dragDuckTo(next, nextX, next.duck.y);
          });
          announce(
            `Dragging Duck right. Horizontal position ${Math.round(s.duck.x)}, vertical position ${Math.round(s.duck.y)}. Press Enter to drop.`,
            "polite"
          );
        }
      } else if (e.key === "Enter") {
        if (state.duck.state === "DRAGGED") {
          e.preventDefault();
          const s = applyTransition((state) => releaseDuck(state));
          let dropLocation = "on the floor";
          if (s.inBathtub) dropLocation = "in the bathtub";
          else if (
            s.duck.x >= BACK_DOOR_BOUNDS.x &&
            s.duck.x <= BACK_DOOR_BOUNDS.x + BACK_DOOR_BOUNDS.width &&
            s.duck.y >= BACK_DOOR_BOUNDS.y &&
            s.duck.y <= BACK_DOOR_BOUNDS.y + BACK_DOOR_BOUNDS.height
          ) {
            dropLocation = "outside to potty";
          }
          announce(`Dropped Duck ${dropLocation}.`, "polite");
        }
      }
    },
    { allowInKeyboardBoundary: true }
  );

  // Ends a pointer drag. While paused the drop is deferred until the sprint
  // resumes (see pendingDragReleaseRef), so it can't score with the clock
  // stopped (#1645).
  const endPointerDrag = useCallback(
    (state: WorkingWithDuckState): WorkingWithDuckState => {
      isDraggingDuckStateRef.current = false;
      if (state.status === "paused") {
        pendingDragReleaseRef.current = true;
        return state;
      }
      return releaseDuck(state);
    },
    []
  );

  // Global Window Pointer Up & Cancel Handler (Prevents Drag Locking Off-Canvas)
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      const state = gameStateRef.current;
      if (
        state.inDogPark &&
        isThrowingParkBallRef.current &&
        aimParkStartRef.current
      ) {
        isThrowingParkBallRef.current = false;
        const powerX = (aimParkStartRef.current.x - 90) * 0.08;
        const powerY = (aimParkStartRef.current.y - 250) * 0.06;
        applyTransition((state) => throwParkBall(state, powerX, powerY));
        aimParkStartRef.current = null;
        return;
      }

      if (isDraggingDuckStateRef.current) {
        applyTransition((state) => endPointerDrag(state));
      }
    };

    const handleGlobalPointerCancel = () => {
      let needsUpdate = false;
      applyTransition(
        (state) => {
          let next = state;
          if (isThrowingParkBallRef.current) {
            isThrowingParkBallRef.current = false;
            aimParkStartRef.current = null;
            needsUpdate = true;
          }
          if (isDraggingDuckStateRef.current) {
            next = endPointerDrag(next);
            needsUpdate = true;
          }
          return next;
        },
        () => needsUpdate
      );
    };

    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", handleGlobalPointerCancel);
    window.addEventListener("mouseup", handleGlobalPointerUp);
    window.addEventListener("touchend", handleGlobalPointerUp);
    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", handleGlobalPointerCancel);
      window.removeEventListener("mouseup", handleGlobalPointerUp);
      window.removeEventListener("touchend", handleGlobalPointerUp);
    };
  }, [applyTransition, endPointerDrag]);

  // Reactive metrics and status changes screen reader announcer
  const lastAnnouncedBladderRef = useRef(false);
  const lastAnnouncedExcitementRef = useRef(false);
  const lastAnnouncedStatusRef = useRef<string | null>(null);
  const lastAnnouncedWorkProgressRef = useRef(0);

  useEffect(() => {
    if (!uiState) return;

    // Announce status changes
    if (uiState.status !== lastAnnouncedStatusRef.current) {
      if (uiState.status === "won") {
        announce(
          "Sprint completed! Duck is asleep and work is done.",
          "assertive"
        );
      } else if (uiState.status === "failed") {
        announce("Sprint failed. Duck got a time-out.", "assertive");
      } else if (
        uiState.status === "running" &&
        lastAnnouncedStatusRef.current === "idle"
      ) {
        announce(
          `${uiState.mode === "endless" ? "Run" : "Sprint"} started.`,
          "polite"
        );
      } else if (uiState.status === "paused") {
        announce(
          `${uiState.mode === "endless" ? "Run" : "Sprint"} paused.`,
          "polite"
        );
      } else if (
        uiState.status === "running" &&
        lastAnnouncedStatusRef.current === "paused"
      ) {
        announce(
          `${uiState.mode === "endless" ? "Run" : "Sprint"} resumed.`,
          "polite"
        );
      }
      lastAnnouncedStatusRef.current = uiState.status;
    }

    // Announce high bladder
    const isBladderHigh = uiState.bladder > 80;
    if (isBladderHigh && !lastAnnouncedBladderRef.current) {
      announce(
        "Warning: Duck bladder is full. Drag the duck to the back door immediately!",
        "assertive"
      );
      lastAnnouncedBladderRef.current = true;
    } else if (!isBladderHigh) {
      lastAnnouncedBladderRef.current = false;
    }

    // Announce high excitement
    const isExcitementHigh = uiState.excitement > 80;
    if (isExcitementHigh && !lastAnnouncedExcitementRef.current) {
      announce(
        "Warning: Duck excitement is high. Call Sit (Q) or take a dog park trip!",
        "polite"
      );
      lastAnnouncedExcitementRef.current = true;
    } else if (!isExcitementHigh) {
      lastAnnouncedExcitementRef.current = false;
    }

    // Announce major work progress milestones (every 25%)
    const pct = Math.min(
      100,
      Math.round((uiState.workProgress / uiState.targetWorkProgress) * 100)
    );
    const milestone = Math.floor(pct / 25) * 25;
    if (milestone > lastAnnouncedWorkProgressRef.current && milestone > 0) {
      announce(`Work progress is at ${milestone} percent.`, "polite");
      lastAnnouncedWorkProgressRef.current = milestone;
    } else if (pct === 0) {
      lastAnnouncedWorkProgressRef.current = 0;
    }
  }, [uiState, announce]);

  // Canvas Mouse Interactions
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toGameCoordinates(e.clientX, e.clientY);

    const state = gameStateRef.current;

    // A paused sprint ignores the canvas (#1645).
    if (state.status === "paused") return;

    // Bathtub Mode Mouse Scrubbing
    if (state.inBathtub) {
      applyTransition((state) => scrubBathtub(state, x, y));
      return;
    }

    // Dog Park Aiming & Throwing
    if (state.inDogPark) {
      if (state.parkState.status === "aim") {
        aimParkStartRef.current = { x, y };
        isThrowingParkBallRef.current = true;
      }
      return;
    }

    // Check click on surprise event target
    if (state.activeSurpriseEvent) {
      if (
        state.activeSurpriseEvent.type === "squirrel-window" &&
        x >= 340 &&
        x <= 465 &&
        y <= 85
      ) {
        applyTransition((state) => ({
          ...state,
          activeSurpriseEvent: null,
          totalScore: state.totalScore + 200,
          comboStreak: state.comboStreak + 1,
          soundCueQueue: [...state.soundCueQueue, "combo-fanfare"],
          floatingAlerts: [
            ...state.floatingAlerts,
            {
              id: state.nextAlertId,
              x: 400,
              y: 80,
              text: "🐿️ Squirrel Watched! (+200 pts)",
              color: "#38bdf8",
              alpha: 1,
              vy: -1.2,
            },
          ],
        }));
        return;
      }

      if (
        state.activeSurpriseEvent.type === "amazon-delivery" &&
        x >= BACK_DOOR_BOUNDS.x - 70 &&
        x <= BACK_DOOR_BOUNDS.x + 30 &&
        y >= BACK_DOOR_BOUNDS.y + 10 &&
        y <= BACK_DOOR_BOUNDS.y + 70
      ) {
        applyTransition((state) => ({
          ...state,
          activeSurpriseEvent: null,
          totalScore: state.totalScore + 150,
          comboStreak: state.comboStreak + 1,
          soundCueQueue: [...state.soundCueQueue, "combo-fanfare"],
          floatingAlerts: [
            ...state.floatingAlerts,
            {
              id: state.nextAlertId,
              x: BACK_DOOR_BOUNDS.x,
              y: BACK_DOOR_BOUNDS.y + 30,
              text: "📦 Package Retrieved! (+150 pts)",
              color: "#f59e0b",
              alpha: 1,
              vy: -1.2,
            },
          ],
        }));
        return;
      }
    }

    // Check if clicked directly on Desk for Active Code Burst
    if (
      x >= DESK_BOUNDS.x &&
      x <= DESK_BOUNDS.x + DESK_BOUNDS.width &&
      y >= DESK_BOUNDS.y &&
      y <= DESK_BOUNDS.y + DESK_BOUNDS.height
    ) {
      applyTransition((state) => activeCodeBurst(state));
      return;
    }

    // Check if clicked directly on Stations
    if (
      x >= WATER_BOWL_BOUNDS.x &&
      x <= WATER_BOWL_BOUNDS.x + WATER_BOWL_BOUNDS.width &&
      y >= WATER_BOWL_BOUNDS.y &&
      y <= WATER_BOWL_BOUNDS.y + WATER_BOWL_BOUNDS.height
    ) {
      applyTransition((state) => {
        const res = dispatchCommand({
          type: "station",
          state,
          station: "water",
        });
        return res.success ? res.data.state : state;
      });
      return;
    }

    if (
      x >= FOOD_BOWL_BOUNDS.x &&
      x <= FOOD_BOWL_BOUNDS.x + FOOD_BOWL_BOUNDS.width &&
      y >= FOOD_BOWL_BOUNDS.y &&
      y <= FOOD_BOWL_BOUNDS.y + FOOD_BOWL_BOUNDS.height
    ) {
      applyTransition((state) => {
        const res = dispatchCommand({
          type: "station",
          state,
          station: "food",
        });
        return res.success ? res.data.state : state;
      });
      return;
    }

    if (
      x >= BATHTUB_BOUNDS.x &&
      x <= BATHTUB_BOUNDS.x + BATHTUB_BOUNDS.width &&
      y >= BATHTUB_BOUNDS.y &&
      y <= BATHTUB_BOUNDS.y + BATHTUB_BOUNDS.height
    ) {
      applyTransition((state) => enterBathtub(state));
      return;
    }

    // Check if clicked directly on indoor puddle for mopping
    if (state.indoorPuddles && state.indoorPuddles.length > 0) {
      const clickedPuddle = state.indoorPuddles.some(
        (p) => Math.hypot(x - p.x, y - p.y) <= p.radius + 15
      );
      if (clickedPuddle) {
        applyTransition((state) => mopIndoorPuddle(state, x, y));
        return;
      }
    }

    // Check if clicked directly on Duck
    const duckDist = Math.hypot(x - state.duck.x, y - state.duck.y);
    if (duckDist < 38) {
      if (state.duck.state === "NO_TAKE_THROW") {
        handleGiveTreat();
        return;
      }
      applyTransition(
        (state) => startDraggingDuck(state),
        () => false
      );
      isDraggingDuckStateRef.current = true;
      return;
    }

    // Use Selected Hotbar Item on Canvas click
    applyTransition((state) => {
      if (state.selectedItem === "squeaky-toy") {
        const res = interactHazard({
          state,
          action: "distract_with_squeaky",
          x,
          y,
        });
        return res.success ? res.data.state : state;
      } else if (state.selectedItem === "kong") {
        const res = interactHazard({
          state,
          action: "distract_with_kong",
          x,
          y,
        });
        return res.success ? res.data.state : state;
      } else if (state.selectedItem === "tennis-ball") {
        const res = dispatchCommand({
          type: "throw_ball",
          state,
          targetX: x,
          targetY: y,
        });
        return res.success ? res.data.state : state;
      } else if (state.selectedItem === "treat") {
        const res = dispatchCommand({ type: "treat", state });
        return res.success ? res.data.state : state;
      }
      return state;
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toGameCoordinates(e.clientX, e.clientY);

    const state = gameStateRef.current;

    if (state.status === "paused") return;

    // Bathtub Mode Scrubbing
    if (state.inBathtub) {
      applyTransition((state) => scrubBathtub(state, x, y));
      return;
    }

    // Dog Park Mouse Steering during retrieval
    if (state.inDogPark) {
      if (isThrowingParkBallRef.current) {
        aimParkStartRef.current = { x, y };
      } else if (state.parkState.status === "retrieving") {
        applyTransition(
          (state) => steerParkDuck(state, y),
          () => false
        );
      }
      return;
    }

    // Dragging Duck
    if (isDraggingDuckStateRef.current) {
      applyTransition(
        (state) => dragDuckTo(state, x, y),
        () => false
      );
      return;
    }

    // Scrub / Mop Indoor Puddle on Hover & Scrub
    if (state.indoorPuddles && state.indoorPuddles.length > 0) {
      const hoveringPuddle = state.indoorPuddles.some(
        (p) => Math.hypot(x - p.x, y - p.y) <= p.radius + 15
      );
      if (hoveringPuddle) {
        applyTransition((state) => mopIndoorPuddle(state, x, y));
      }
    }

    // Belly Rubbing during The Flop
    if (state.duck.state === "THE_FLOP") {
      const movedDist = Math.hypot(
        x - lastBellyScrubPosRef.current.x,
        y - lastBellyScrubPosRef.current.y
      );
      if (movedDist > 12) {
        lastBellyScrubPosRef.current = { x, y };
        applyTransition((state) => {
          const res = dispatchCommand({ type: "pet", state, x, y });
          return res.success ? res.data.state : state;
        });
      }
    }
  };

  const handleCanvasMouseUp = () => {
    const state = gameStateRef.current;

    if (
      state.inDogPark &&
      isThrowingParkBallRef.current &&
      aimParkStartRef.current
    ) {
      isThrowingParkBallRef.current = false;
      const powerX = (aimParkStartRef.current.x - 90) * 0.08;
      const powerY = (aimParkStartRef.current.y - 250) * 0.06;
      applyTransition((state) => throwParkBall(state, powerX, powerY));
      aimParkStartRef.current = null;
      return;
    }

    if (isDraggingDuckStateRef.current) {
      applyTransition((state) => endPointerDrag(state));
    }
  };

  const lastPointerTimeRef = useRef(0);

  const handleCanvasPointerDown = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    lastPointerTimeRef.current = Date.now();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignored for environments without pointer capture mock
    }
    const fakeMouseEvent = {
      clientX: e.clientX,
      clientY: e.clientY,
    } as React.MouseEvent<HTMLCanvasElement>;
    handleCanvasMouseDown(fakeMouseEvent);
  };

  const handleCanvasPointerMove = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    const fakeMouseEvent = {
      clientX: e.clientX,
      clientY: e.clientY,
    } as React.MouseEvent<HTMLCanvasElement>;
    handleCanvasMouseMove(fakeMouseEvent);
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
    handleCanvasMouseUp();
  };

  const handleCanvasPointerCancel = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
    let needsUpdate = false;
    applyTransition(
      (state) => {
        let next = state;
        if (isDraggingDuckStateRef.current) {
          next = endPointerDrag(next);
          needsUpdate = true;
        }
        if (isThrowingParkBallRef.current) {
          isThrowingParkBallRef.current = false;
          aimParkStartRef.current = null;
          needsUpdate = true;
        }
        return next;
      },
      () => needsUpdate
    );
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (Date.now() - lastPointerTimeRef.current < 100) return;
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      handleCanvasMouseDown({
        clientX: touch.clientX,
        clientY: touch.clientY,
      } as unknown as React.MouseEvent<HTMLCanvasElement>);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (Date.now() - lastPointerTimeRef.current < 100) return;
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      handleCanvasMouseMove({
        clientX: touch.clientX,
        clientY: touch.clientY,
      } as unknown as React.MouseEvent<HTMLCanvasElement>);
    }
  };

  const handleTouchEnd = () => {
    if (Date.now() - lastPointerTimeRef.current < 100) return;
    handleCanvasMouseUp();
  };

  const handleTouchCancel = () => {
    if (Date.now() - lastPointerTimeRef.current < 100) return;
    let needsUpdate = false;
    applyTransition(
      (state) => {
        let next = state;
        if (isDraggingDuckStateRef.current) {
          next = endPointerDrag(next);
          needsUpdate = true;
        }
        if (isThrowingParkBallRef.current) {
          isThrowingParkBallRef.current = false;
          aimParkStartRef.current = null;
          needsUpdate = true;
        }
        return next;
      },
      () => needsUpdate
    );
  };

  const currentSprint =
    SPRINTS.find((s) => s.level === uiState.currentLevel) || SPRINTS[0];

  // Guided Onboarding Hint Text
  let tutorialHint: string | null = null;
  if (uiState.status === "running" && uiState.inDogPark) {
    // Scene tips show on every sprint: the controls change with the scene.
    tutorialHint =
      "Dog Park: drag on the field and let go to throw, steer Duck with the mouse, W or the arrow keys, and press Space to jump. Work, Excitement and Bladder pause until you return to the office.";
  } else if (uiState.status === "running" && uiState.inBathtub) {
    tutorialHint =
      "Bath time: move your cursor over the tub to lather Duck, then Rinse until he's clean and Finish Bath. Work, Excitement and Bladder pause until you're back in the office.";
  } else if (uiState.currentLevel === 1 && uiState.status === "running") {
    if (uiState.duck.state === "THE_FLOP") {
      tutorialHint =
        "Duck flopped on his back! Move your cursor back & forth over his belly!";
    } else if (
      uiState.duck.state === "SNIFFING_POTTY" ||
      uiState.bladder > 80
    ) {
      tutorialHint =
        "Duck needs to go! Click and drag Duck over to the Back Door!";
    } else if (uiState.duck.state === "SNEAKY_CHEW") {
      tutorialHint =
        "Duck is eyeing your work! Drop a Kong (2) or Call Drop It (E) to save it!";
    } else if (uiState.duck.state === "NO_TAKE_THROW") {
      tutorialHint =
        "Duck caught the ball! Press (4) to trade a treat or (E) for Drop It!";
    } else if (uiState.excitement > 80) {
      tutorialHint =
        "Excitement is high! Call Sit (Q) or take a Dog Park trip!";
    } else {
      tutorialHint =
        "Tip: Work advances automatically. Press Space for active coding bursts & try training tricks (Q-W-E-R)!";
    }
  }

  const restartSprint = () => {
    applyTransition(() => {
      const next = createInitialDuckGameState(
        uiState.currentLevel,
        uiState.mode,
        undefined,
        uiState.unlockedFacts
      );
      next.status = "running";
      return next;
    });
  };

  const startEndlessRun = () => {
    applyTransition((state) => {
      const next = createInitialDuckGameState(
        5,
        "endless",
        state.unlockedAccessories,
        state.unlockedFacts
      );
      next.status = "running";
      return next;
    });
  };
  // A dismissed tip stays hidden until the advice changes.
  const visibleTip =
    tutorialHint && tutorialHint !== dismissedTip ? tutorialHint : null;

  const workPercent = Math.min(
    100,
    Math.round((uiState.workProgress / uiState.targetWorkProgress) * 100)
  );

  // The most urgent state gets one word in the HUD; the tip explains it.
  const hudCallout =
    uiState.duck.state === "SNIFFING_POTTY"
      ? {
          text: "To the door",
          className: "border-rose-400/40 bg-rose-400/10 text-rose-200",
        }
      : uiState.excitement > 85
        ? {
            text: "Zoomies",
            className: "border-amber-400/40 bg-amber-400/10 text-amber-200",
          }
        : uiState.calmBuffTimer > 0
          ? {
              text: "Calm",
              className:
                "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
            }
          : null;

  const sessionLabel = uiState.mode === "endless" ? "Run" : "Sprint";
  const displayedHighScore = Math.max(uiState.highScore, loadedHighScore);

  // Paused play is frozen (#1645); toys and tricks only work in the office
  // (#1647). Disabled controls point at the reason via aria-describedby.
  const isPlayFrozen = uiState.status === "paused";
  const isAwayFromOffice = uiState.inDogPark || uiState.inBathtub;
  const officeOnlyDisabled = isPlayFrozen || isAwayFromOffice;
  const pausedReasonId = isPlayFrozen ? "duck-paused-reason" : undefined;
  const officeOnlyReasonId = isPlayFrozen
    ? "duck-paused-reason"
    : isAwayFromOffice
      ? "duck-office-only-reason"
      : undefined;

  const renderPauseButton = (isQuickMeta: boolean) => (
    <button
      onClick={toggleManualPause}
      disabled={uiState.status !== "running" && !isManuallyPaused}
      className={`${
        isQuickMeta ? "p-2" : "p-2.5"
      } rounded-xl border transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-[0.98] ${
        uiState.status !== "running" && !isManuallyPaused
          ? "border-zinc-800/40 bg-zinc-900/30 text-zinc-600 cursor-not-allowed"
          : isManuallyPaused
            ? "border-amber-500/50 bg-amber-500/20 text-amber-300 hover:text-white cursor-pointer"
            : "border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white cursor-pointer"
      }`}
      title={
        isManuallyPaused
          ? `Resume ${sessionLabel}${isQuickMeta ? " (P)" : ""}`
          : `Pause ${sessionLabel}${isQuickMeta ? " (P)" : ""}`
      }
      aria-label={
        isManuallyPaused
          ? `Resume ${sessionLabel}${isQuickMeta ? " (P)" : ""}`
          : `Pause ${sessionLabel}${isQuickMeta ? " (P)" : ""}`
      }
    >
      {isManuallyPaused ? (
        <IconPlayerPlay className="w-4 h-4 text-amber-400 fill-current" />
      ) : (
        <IconPlayerPause className="w-4 h-4" />
      )}
    </button>
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      data-keyboard-boundary="true"
      className={`relative w-full max-w-5xl mx-auto select-none font-sans outline-none ${
        isFullscreen
          ? "fixed inset-0 z-50 w-full h-[100dvh] max-h-[100dvh] max-w-none rounded-none bg-black p-2 sm:p-4 overflow-y-auto overflow-x-hidden flex flex-col justify-between"
          : ""
      }`}
    >
      {/* Tablet Orientation Recommendation */}
      <TabletOrientationHint />

      {/* One slim status bar (#1676): the four needs, the pace and the score */}
      <div
        ref={hudRef}
        data-testid="duck-hud-meters"
        className="mb-2 overflow-hidden rounded-xl border border-white/[0.08] [@media(max-height:650px)]:mb-1.5"
      >
        <ArcadeHud
          stats={[
            {
              label: uiState.mode === "endless" ? "Mode" : "Sprint",
              value:
                uiState.mode === "endless" ? "Endless" : uiState.currentLevel,
            },
          ]}
          gauges={[
            {
              label: "Work",
              ariaLabel: "Work Progress",
              value: workPercent,
              display: `${workPercent}%`,
            },
            {
              label: "Excitement",
              ariaLabel: "Duck Excitement Meter",
              value: uiState.excitement,
              display: `${Math.round(uiState.excitement)}%`,
              tone: uiState.excitement > 80 ? "warn" : "good",
            },
            {
              label: "Bladder",
              ariaLabel: "Duck Bladder Clock Meter",
              value: uiState.bladder,
              display: `${Math.round(uiState.bladder)}%`,
              tone: uiState.bladder > 80 ? "danger" : "good",
            },
            {
              label: "Good Boy",
              ariaLabel: "Naughty versus Good Boy Scale",
              value: uiState.naughtyVsGood,
              min: -100,
              max: 100,
              display: Math.round(uiState.naughtyVsGood),
              tone: uiState.naughtyVsGood < 0 ? "danger" : "good",
              centerTick: true,
            },
          ]}
          callouts={
            hudCallout ? (
              <span
                className={`rounded-md border px-1.5 py-0.5 font-bold uppercase tracking-wider ${hudCallout.className}`}
              >
                {hudCallout.text}
              </span>
            ) : undefined
          }
          trailing={
            // Running Score (#1646): mirrors the sr-only outputs below
            <span
              data-testid="duck-hud-score"
              aria-hidden="true"
              className="inline-flex items-center gap-3 tabular-nums"
            >
              <span className="whitespace-nowrap uppercase tracking-wider text-zinc-400">
                Score{" "}
                <span
                  data-testid="duck-hud-score-value"
                  className="arcade-accent-text font-bold"
                >
                  {uiState.totalScore}
                </span>
              </span>
              <span className="whitespace-nowrap uppercase tracking-wider text-zinc-400">
                Best{" "}
                <span
                  data-testid="duck-hud-highscore-value"
                  className="font-bold text-zinc-100"
                >
                  {displayedHighScore}
                </span>
              </span>
            </span>
          }
        />
      </div>

      {/* Main Canvas Screen Container */}
      <div
        ref={fxStageRef}
        className="relative rounded-2xl border border-white/[0.08] bg-[#0d0e11] overflow-hidden"
      >
        <div
          ref={fxFlashRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 opacity-0"
        />
        <FullscreenButton
          isFullscreen={isFullscreen}
          onToggle={toggleFullscreen}
          variant="floating"
        />
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerCancel}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          style={{ touchAction: "none" }}
          role="application"
          aria-label="Workspace Pet Companion Simulator. Focus this container to operate simulator. Press Tab to select items, Arrow keys to drag the duck around the canvas to guide actions like potty and bath, and Q, W, E, R to issue training commands."
          tabIndex={0}
          className={
            isFullscreen
              ? "max-h-[var(--layout-viewport-budget,calc(100dvh-var(--header-height,80px)-var(--layout-dock-height,64px)))] max-h-[calc(100dvh-var(--header-height,80px)-var(--footer-height,48px))] max-w-full aspect-[800/500] object-contain block cursor-crosshair touch-none my-auto mx-auto [@media(max-height:500px)]:max-h-[45dvh] focus:outline-none focus:ring-2 focus:ring-amber-300/60"
              : "w-[min(100%,max(20rem,calc((var(--arcade-stage-budget,calc(100dvh-10rem))-var(--duck-chrome,14rem)-0.5rem)*1.6)))] mx-auto h-auto aspect-[800/500] cursor-crosshair block touch-none [@media(max-height:500px)]:w-auto [@media(max-height:500px)]:max-w-full [@media(max-height:500px)]:max-h-[52dvh] [@media(max-height:500px)]:mx-auto focus:outline-none focus:ring-2 focus:ring-amber-300/60"
          }
        />

        {/* Guided tip (#1676): clear of the targets, dismissible, never blocks a drag */}
        {visibleTip && (
          <div
            data-testid="duck-tip"
            className={`pointer-events-none absolute inset-x-12 z-10 flex justify-center [@media(max-height:500px)]:hidden ${
              isAwayFromOffice ? "bottom-2 sm:bottom-3" : "top-2 sm:top-3"
            }`}
          >
            <div className="flex max-w-2xl items-start gap-2 rounded-lg border border-amber-400/30 bg-[#0d0e11]/90 py-1.5 pl-2.5 pr-1 font-mono text-[11px] leading-snug text-amber-100 shadow-lg sm:text-xs">
              <IconInfoCircle
                aria-hidden="true"
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300"
              />
              <span>{visibleTip}</span>
              <button
                type="button"
                onClick={() => setDismissedTip(visibleTip)}
                aria-label="Dismiss tip"
                title="Dismiss tip"
                className="pointer-events-auto -my-1 inline-flex min-h-[28px] min-w-[28px] shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-400 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Start Overlay Screen */}
        {uiState.status === "idle" && (
          <div
            data-testid="duck-sprint-briefing"
            className="absolute inset-0 bg-[#0d0e11]/80 flex flex-col items-center justify-center p-4 sm:p-6 text-center z-20 overflow-y-auto"
          >
            <p className="arcade-accent-text mb-1 sm:mb-2 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.2em]">
              {uiState.mode === "endless"
                ? "Endless mode briefing"
                : `Sprint ${uiState.currentLevel} of ${SPRINTS.length} · Briefing`}
            </p>
            <h2 className="mb-1 sm:mb-2 text-lg sm:text-2xl font-extrabold font-mono tracking-[-0.035em] text-zinc-50">
              {uiState.mode === "endless"
                ? "High Score Challenge"
                : currentSprint.title}
            </h2>
            <p className="max-w-md text-[11px] sm:text-sm text-zinc-300 font-mono mb-4 sm:mb-6 leading-relaxed line-clamp-3 sm:line-clamp-none">
              {uiState.mode === "endless"
                ? "Infinite sprints with accelerating puppy impulses. Keep Duck entertained and protect the codebase!"
                : currentSprint.description}
            </p>
            <p
              data-testid="duck-start-highscore"
              className="-mt-2 mb-4 sm:-mt-3 sm:mb-6 text-[11px] sm:text-xs font-mono tabular-nums text-zinc-400"
            >
              High Score{" "}
              <span className="text-zinc-100 font-bold">
                {displayedHighScore}
              </span>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <button
                onClick={startSprint}
                className="arcade-launch-button px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl border text-zinc-950 font-mono font-bold text-xs sm:text-sm transition-colors active:scale-[0.98] flex items-center gap-2 cursor-pointer min-h-[44px]"
              >
                <IconPlayerPlay className="w-4 h-4 fill-current" />
                <span>
                  {uiState.mode === "endless"
                    ? "Start Endless Mode"
                    : `Start Sprint ${uiState.currentLevel}`}
                </span>
              </button>

              <button
                onClick={openScrapbook}
                className="px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-white/[0.08] bg-[#13151a] text-zinc-300 font-mono text-xs hover:text-white hover:border-white/20 transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px]"
              >
                <IconBook className="w-4 h-4" />
                <span>Duck Scrapbook</span>
              </button>

              <button
                onClick={openWardrobe}
                className="px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-white/[0.08] bg-[#13151a] text-zinc-300 font-mono text-xs hover:text-white hover:border-white/20 transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px]"
              >
                <IconShirt aria-hidden="true" className="w-4 h-4" />
                <span>Wardrobe</span>
              </button>

              <FieldManualButton
                manualId="working-with-duck"
                label="Manual"
                onOpenChange={handleManualOpenChange}
                isHotkeyOwner={false}
              />
            </div>
          </div>
        )}

        {/* Paused Overlay Screen */}
        {uiState.status === "paused" &&
          isManuallyPaused &&
          !isScrapbookOpen &&
          !isWardrobeOpen &&
          !isManualOpen && (
            <div
              ref={pauseTrapRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="duck-pause-overlay-heading"
              data-testid="duck-pause-overlay"
              className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 text-center z-20 overflow-y-auto"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2 sm:mb-4 shrink-0">
                <IconPlayerPause className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h2
                id="duck-pause-overlay-heading"
                className="text-xl sm:text-3xl font-extrabold font-mono text-white mb-1 sm:mb-2"
              >
                {sessionLabel} <span className="text-amber-400">Paused</span>
              </h2>
              <p className="text-[11px] sm:text-xs font-mono text-amber-300 font-bold mb-1 sm:mb-2">
                {uiState.mode === "endless"
                  ? "Endless Mode · Paused"
                  : `Sprint ${uiState.currentLevel} · Paused`}
              </p>
              <p className="max-w-md text-[11px] sm:text-sm text-zinc-300 font-mono mb-4 sm:mb-6 leading-relaxed">
                Duck is taking a quick breather. Press{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-amber-300 font-mono text-[11px]">
                  P
                </kbd>{" "}
                or click below to resume.
              </p>
              <button
                onClick={toggleManualPause}
                className="px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl bg-amber-400 text-black font-mono font-bold text-xs sm:text-sm hover:bg-white hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(251,191,36,0.4)] flex items-center gap-2 cursor-pointer min-h-[44px]"
              >
                <IconPlayerPlay className="w-4 h-4 fill-current" />
                <span>Resume {sessionLabel}</span>
              </button>
            </div>
          )}

        {/* Combo Streak Notification Overlay */}
        {uiState.comboStreak >= 2 && (
          <div className="absolute top-4 right-4 z-20 px-3.5 py-1.5 rounded-xl border border-amber-400/40 bg-zinc-900/90 text-amber-300 font-mono text-xs font-bold shadow-2xl flex items-center gap-1.5">
            <span>⚡ {uiState.comboStreak}× COMBO STREAK</span>
          </div>
        )}

        {/* Skill Toast Easter Egg */}
        {uiState.activeSkillToast && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl border border-emerald-500/40 bg-[#0d0e11]/90 text-white shadow-2xl flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold uppercase">
              {uiState.activeSkillToast.badge}
            </span>
            <span className="text-xs font-mono text-zinc-300">
              {uiState.activeSkillToast.text}
            </span>
          </div>
        )}
      </div>

      {/* Unified Tactile Action Dock */}
      <div
        ref={dockRef}
        data-testid="duck-action-dock"
        className="mt-2 flex flex-col gap-2 font-mono [@media(max-height:650px)]:mt-1.5 [@media(max-height:650px)]:gap-1.5"
      >
        <span id="duck-paused-reason" className="sr-only">
          {sessionLabel} paused. Press P or Resume {sessionLabel} to continue.
        </span>
        <span id="duck-office-only-reason" className="sr-only">
          Toys and tricks only work in the office. Return to the office to use
          them.
        </span>
        {/* --- MOBILE VIEWPORT CONTROL DECK (<md, or any short/landscape viewport) --- */}
        <div className="flex [@media(min-width:768px)_and_(min-height:560px)]:hidden flex-col gap-2">
          {/* Segmented Switcher Tabs */}
          <div className="grid grid-cols-3 p-1 rounded-2xl bg-[#0d0e11] border border-white/[0.08] gap-1 text-xs font-bold">
            <button
              onClick={() => setMobileTab("toys")}
              className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] cursor-pointer touch-manipulation select-none active:scale-95 ${
                mobileTab === "toys"
                  ? "bg-amber-400 text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <span>Toys</span>
              {uiState.duck.state === "NO_TAKE_THROW" && (
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-full bg-rose-400"
                />
              )}
            </button>

            <button
              onClick={() => setMobileTab("tricks")}
              className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] cursor-pointer touch-manipulation select-none active:scale-95 ${
                mobileTab === "tricks"
                  ? "bg-amber-400 text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <span>Tricks</span>
              {uiState.excitement > 80 && (
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-full bg-amber-300"
                />
              )}
            </button>

            <button
              onClick={() => setMobileTab("actions")}
              className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] cursor-pointer touch-manipulation select-none active:scale-95 ${
                mobileTab === "actions"
                  ? "bg-amber-400 text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <span>Actions</span>
              {(uiState.inDogPark || uiState.inBathtub || uiState.isMuddy) && (
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-full bg-emerald-400"
                />
              )}
            </button>
          </div>

          {/* Mobile Tab 1: Toys & Treats */}
          {mobileTab === "toys" && (
            <div className="grid grid-cols-2 gap-2 animate-fadeIn">
              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => {
                  applyTransition((state) => ({
                    ...state,
                    selectedItem: "tennis-ball",
                  }));
                }}
                className={`disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 min-h-[48px] cursor-pointer touch-manipulation select-none active:scale-95 ${
                  uiState.selectedItem === "tennis-ball"
                    ? TOY_SELECTED
                    : TOY_IDLE
                }`}
              >
                <IconBallTennis
                  aria-hidden="true"
                  className="w-4 h-4 shrink-0"
                />
                <span>Tennis Ball</span>
              </button>

              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => {
                  applyTransition((state) => ({
                    ...state,
                    selectedItem: "kong",
                  }));
                }}
                className={`disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 min-h-[48px] cursor-pointer touch-manipulation select-none active:scale-95 ${
                  uiState.selectedItem === "kong" ? TOY_SELECTED : TOY_IDLE
                }`}
              >
                <span>Kong Chew</span>
              </button>

              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => {
                  applyTransition((state) => ({
                    ...state,
                    selectedItem: "squeaky-toy",
                  }));
                }}
                className={`disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 min-h-[48px] cursor-pointer touch-manipulation select-none active:scale-95 ${
                  uiState.selectedItem === "squeaky-toy"
                    ? TOY_SELECTED
                    : TOY_IDLE
                }`}
              >
                <IconBone aria-hidden="true" className="w-4 h-4 shrink-0" />
                <span>Squeaky</span>
              </button>

              <button
                disabled={isPlayFrozen}
                aria-describedby={pausedReasonId}
                onClick={handleGiveTreat}
                className={`disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border text-xs font-bold transition-colors flex items-center justify-center gap-2 min-h-[48px] min-w-[44px] cursor-pointer touch-manipulation select-none active:scale-[0.98] ${TOY_IDLE}`}
              >
                <span>Treat</span>
              </button>
            </div>
          )}

          {/* Mobile Tab 2: Training Tricks */}
          {mobileTab === "tricks" && (
            <div className="grid grid-cols-2 gap-2 animate-fadeIn">
              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => handlePerformTrick("SIT")}
                className={`disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border text-xs font-bold transition-colors flex items-center justify-center gap-2 min-h-[48px] min-w-[44px] cursor-pointer touch-manipulation select-none active:scale-[0.98] ${TRICK_BUTTON}`}
              >
                <span>Sit (Calm)</span>
              </button>

              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => handlePerformTrick("HIGH_FIVE")}
                className={`disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border text-xs font-bold transition-colors flex items-center justify-center gap-2 min-h-[48px] min-w-[44px] cursor-pointer touch-manipulation select-none active:scale-[0.98] ${TRICK_BUTTON}`}
              >
                <span>High Five</span>
              </button>

              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => handlePerformTrick("DROP_IT")}
                className={`disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border text-xs font-bold transition-colors flex items-center justify-center gap-2 min-h-[48px] min-w-[44px] cursor-pointer touch-manipulation select-none active:scale-[0.98] ${TRICK_BUTTON}`}
              >
                <span>Drop It!</span>
              </button>

              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => handlePerformTrick("SPIN")}
                className={`disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border text-xs font-bold transition-colors flex items-center justify-center gap-2 min-h-[48px] min-w-[44px] cursor-pointer touch-manipulation select-none active:scale-[0.98] ${TRICK_BUTTON}`}
              >
                <span>Spin Trick</span>
              </button>
            </div>
          )}

          {/* Mobile Tab 3: Actions & Mini-games */}
          {mobileTab === "actions" && (
            <div className="flex flex-col gap-2 animate-fadeIn">
              {!uiState.inDogPark && !uiState.inBathtub ? (
                <>
                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      applyTransition((state) => activeCodeBurst(state));
                    }}
                    className="arcade-launch-button disabled:opacity-40 disabled:cursor-not-allowed w-full py-3 px-4 rounded-2xl border text-zinc-950 font-bold text-xs transition-colors active:scale-[0.98] flex items-center justify-center gap-2 min-h-[48px] cursor-pointer touch-manipulation select-none"
                  >
                    <IconCode aria-hidden="true" className="w-4 h-4" />
                    <span>Focus Work Sprint</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={isPlayFrozen}
                      aria-describedby={pausedReasonId}
                      onClick={() => {
                        applyTransition((state) => enterDogPark(state));
                      }}
                      className="disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 text-emerald-200 active:bg-emerald-400/20 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 min-h-[48px] cursor-pointer touch-manipulation select-none active:scale-[0.98]"
                    >
                      <IconTrees aria-hidden="true" className="w-4 h-4" />
                      <span>Dog Park</span>
                    </button>

                    <button
                      disabled={isPlayFrozen}
                      aria-describedby={pausedReasonId}
                      onClick={() => {
                        applyTransition((state) => enterBathtub(state));
                      }}
                      className={`disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-[48px] cursor-pointer touch-manipulation select-none active:scale-95 ${
                        uiState.isMuddy ? TOY_SELECTED : TOY_IDLE
                      }`}
                    >
                      <IconDroplet aria-hidden="true" className="w-4 h-4" />
                      <span>
                        {uiState.isMuddy ? "Bath: muddy!" : "Bathtub"}
                      </span>
                    </button>
                  </div>
                </>
              ) : uiState.inBathtub ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      applyTransition((state) => rinseBathtub(state));
                    }}
                    className="arcade-launch-button disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border text-zinc-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 min-h-[48px] cursor-pointer touch-manipulation select-none active:scale-[0.98]"
                  >
                    <IconDroplet className="w-4 h-4" />
                    <span>Rinse Spray</span>
                  </button>

                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      applyTransition((state) => exitBathtub(state));
                    }}
                    className="disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs active:bg-zinc-800 transition-colors flex items-center justify-center min-h-[48px] cursor-pointer touch-manipulation select-none active:scale-95"
                  >
                    <span>Finish Bath</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={isPlayFrozen}
                      aria-describedby={pausedReasonId}
                      onClick={() => {
                        applyTransition((state) => jumpParkHurdle(state));
                      }}
                      className="arcade-launch-button disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border text-zinc-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 min-h-[48px] cursor-pointer touch-manipulation select-none active:scale-[0.98]"
                    >
                      <span>Jump Hurdle</span>
                    </button>

                    <button
                      disabled={isPlayFrozen}
                      aria-describedby={pausedReasonId}
                      onClick={() => {
                        applyTransition((state) => tapParkWhistle(state));
                      }}
                      className="disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-bold transition-all flex items-center justify-center min-h-[48px] cursor-pointer touch-manipulation select-none active:scale-95"
                    >
                      <span>Whistle</span>
                    </button>
                  </div>

                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      const isSuccess = uiState.parkState.status === "success";
                      applyTransition((state) => exitDogPark(state, isSuccess));
                    }}
                    className="disabled:opacity-40 disabled:cursor-not-allowed w-full py-2.5 rounded-2xl border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs active:bg-zinc-800 transition-colors flex items-center justify-center min-h-[44px] cursor-pointer touch-manipulation select-none active:scale-95"
                  >
                    <span>Return to Office</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mobile Meta Controls Strip */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2 border-t border-zinc-800/80">
            {renderPauseButton(false)}

            <button
              onClick={openWardrobe}
              className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/80 text-amber-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
              title="Wardrobe"
            >
              <IconShirt className="w-4 h-4" />
            </button>

            <button
              onClick={openScrapbook}
              className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
              title="Scrapbook"
            >
              <IconBook className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsMusicMuted(!isMusicMuted)}
              className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
              title={isMusicMuted ? "Unmute Music" : "Mute Music"}
            >
              {isMusicMuted ? (
                <IconMusicOff className="w-4 h-4 text-zinc-500" />
              ) : (
                <IconMusic className="w-4 h-4 text-emerald-400" />
              )}
            </button>

            <button
              onClick={() => setMuted(!muted)}
              className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
              title={muted ? "Unmute Audio" : "Mute Audio"}
            >
              {muted ? (
                <IconVolumeOff className="w-4 h-4" />
              ) : (
                <IconVolume className="w-4 h-4 text-zinc-200" />
              )}
            </button>

            <FieldManualButton
              manualId="working-with-duck"
              label="Manual"
              onOpenChange={handleManualOpenChange}
              isHotkeyOwner={true}
            />
            <FullscreenButton
              isFullscreen={isFullscreen}
              onToggle={toggleFullscreen}
              variant="header"
            />
          </div>
        </div>

        {/* --- DESKTOP VIEWPORT HOTBAR (>=md and tall enough to fit 3 rows) --- */}
        <div className="hidden [@media(min-width:768px)_and_(min-height:560px)]:flex flex-col gap-2">
          {/* Desktop Row 1: Toys [1-4] + Tricks [Q-W-E-R] */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Toys & Treats */}
            <div role="group" aria-label="Toys" className={DOCK_GROUP}>
              <span aria-hidden="true" className={DOCK_CAPTION}>
                Toys
              </span>
              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => {
                  applyTransition((state) => ({
                    ...state,
                    selectedItem: "tennis-ball",
                  }));
                }}
                aria-pressed={uiState.selectedItem === "tennis-ball"}
                className={`${DOCK_BUTTON} ${uiState.selectedItem === "tennis-ball" ? TOY_SELECTED : TOY_IDLE}`}
                title="Throw ball to play fetch & drain Excitement"
              >
                <kbd className={DOCK_KEY}>1</kbd>
                <IconBallTennis aria-hidden="true" className="w-3.5 h-3.5" />
                <span>Tennis Ball</span>
              </button>

              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => {
                  applyTransition((state) => ({
                    ...state,
                    selectedItem: "kong",
                  }));
                }}
                aria-pressed={uiState.selectedItem === "kong"}
                className={`${DOCK_BUTTON} ${uiState.selectedItem === "kong" ? TOY_SELECTED : TOY_IDLE}`}
                title="Drop chew toy to distract Duck away from desk hazards"
              >
                <kbd className={DOCK_KEY}>2</kbd>
                <span>Kong Chew</span>
              </button>

              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => {
                  applyTransition((state) => ({
                    ...state,
                    selectedItem: "squeaky-toy",
                  }));
                }}
                aria-pressed={uiState.selectedItem === "squeaky-toy"}
                className={`${DOCK_BUTTON} ${uiState.selectedItem === "squeaky-toy" ? TOY_SELECTED : TOY_IDLE}`}
                title="Squeak to instantly get Duck's attention and recall"
              >
                <kbd className={DOCK_KEY}>3</kbd>
                <IconBone aria-hidden="true" className="w-3.5 h-3.5" />
                <span>Squeaky</span>
              </button>

              <button
                disabled={isPlayFrozen}
                aria-describedby={pausedReasonId}
                onClick={handleGiveTreat}
                aria-pressed={uiState.selectedItem === "treat"}
                className={`${DOCK_BUTTON} ${TOY_IDLE}`}
                title="Give treat (trades ball during No Take Only Throw)"
              >
                <kbd className={DOCK_KEY}>4</kbd>
                <span>Treat</span>
              </button>
            </div>

            {/* Training Tricks [Q-W-E-R] */}
            <div role="group" aria-label="Tricks" className={DOCK_GROUP}>
              <span aria-hidden="true" className={DOCK_CAPTION}>
                Tricks
              </span>
              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => handlePerformTrick("SIT")}
                className={`${DOCK_BUTTON} ${TRICK_BUTTON}`}
                title="Command Sit: Calms Excitement (-20) & boosts Good Boy scale"
              >
                <kbd className={TRICK_KEY}>Q</kbd>
                <span>Sit</span>
              </button>

              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => handlePerformTrick("HIGH_FIVE")}
                className={`${DOCK_BUTTON} ${TRICK_BUTTON}`}
                title="Command High Five: Morale boost (+45 pts) & tail wag"
              >
                <kbd className={TRICK_KEY}>W</kbd>
                <span>High Five</span>
              </button>

              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => handlePerformTrick("DROP_IT")}
                className={`${DOCK_BUTTON} ${TRICK_BUTTON}`}
                title="Command Drop It: Immediately drops stolen hazards or ball (+60-75 pts)"
              >
                <kbd className={TRICK_KEY}>E</kbd>
                <span>Drop It</span>
              </button>

              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => handlePerformTrick("SPIN")}
                className={`${DOCK_BUTTON} ${TRICK_BUTTON}`}
                title="Command Spin: Playful trick (+50 pts) with 360 rotation"
              >
                <kbd className={TRICK_KEY}>R</kbd>
                <span>Spin</span>
              </button>
            </div>
          </div>

          {/* Desktop Row 2: Active Desk Coding + Office Stations + Dog Park + Meta */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Active Action Button */}
            <div className="flex items-center gap-2">
              {!uiState.inDogPark && !uiState.inBathtub ? (
                <button
                  disabled={isPlayFrozen}
                  aria-describedby={pausedReasonId}
                  onClick={() => {
                    applyTransition((state) => activeCodeBurst(state));
                  }}
                  className="arcade-launch-button disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl border text-zinc-950 font-bold text-xs transition-colors active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer touch-manipulation select-none"
                  title="Focus work sprint at desk (Spacebar)"
                >
                  <IconCode aria-hidden="true" className="w-4 h-4" />
                  <span>Focus Work Sprint</span>
                  <kbd className="rounded border border-black/20 bg-black/10 px-1 font-mono text-[10px]">
                    Space
                  </kbd>
                </button>
              ) : uiState.inBathtub ? (
                <div className="flex items-center gap-2">
                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      applyTransition((state) => rinseBathtub(state));
                    }}
                    className="arcade-launch-button disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl border text-zinc-950 font-bold text-xs transition-colors active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer touch-manipulation select-none"
                  >
                    <IconDroplet className="w-4 h-4" />
                    <span>Rinse Spray</span>
                  </button>

                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      applyTransition((state) => exitBathtub(state));
                    }}
                    className="disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs hover:bg-zinc-800 transition-colors cursor-pointer touch-manipulation select-none active:scale-95 flex items-center justify-center"
                  >
                    <span>Finish Bath</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      applyTransition((state) => jumpParkHurdle(state));
                    }}
                    className="arcade-launch-button disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl border text-zinc-950 font-bold text-xs transition-colors active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer touch-manipulation select-none"
                  >
                    <span>Agility Jump</span>
                    <kbd className="rounded border border-black/20 bg-black/10 px-1 font-mono text-[10px]">
                      Space
                    </kbd>
                  </button>

                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      applyTransition((state) => tapParkWhistle(state));
                    }}
                    className="disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-bold transition-all cursor-pointer touch-manipulation select-none active:scale-95 flex items-center justify-center"
                  >
                    <span>Whistle</span>
                  </button>

                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      const isSuccess = uiState.parkState.status === "success";
                      applyTransition((state) => exitDogPark(state, isSuccess));
                    }}
                    className="disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs hover:bg-zinc-800 transition-colors cursor-pointer touch-manipulation select-none active:scale-95 flex items-center justify-center"
                  >
                    <span>Return to Office</span>
                  </button>
                </div>
              )}

              {!uiState.inDogPark && !uiState.inBathtub && (
                <>
                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      applyTransition((state) => enterDogPark(state));
                    }}
                    className={`${DOCK_BUTTON} border-emerald-400/40 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20`}
                  >
                    <IconTrees aria-hidden="true" className="w-4 h-4" />
                    <span>Dog Park</span>
                  </button>

                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      applyTransition((state) => enterBathtub(state));
                    }}
                    className={`${DOCK_BUTTON} ${
                      uiState.isMuddy ? TOY_SELECTED : TOY_IDLE
                    }`}
                  >
                    <IconDroplet aria-hidden="true" className="w-4 h-4" />
                    <span>{uiState.isMuddy ? "Bath: muddy!" : "Bathtub"}</span>
                  </button>
                </>
              )}
            </div>

            {/* Quick Meta Controls */}
            <div className="flex items-center gap-2">
              {renderPauseButton(true)}

              <button
                onClick={openWardrobe}
                className="p-2 rounded-xl border border-zinc-800 bg-zinc-900/80 text-amber-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
                title="Duck Wardrobe & Accessories"
              >
                <IconShirt className="w-4 h-4" />
              </button>

              <button
                onClick={openScrapbook}
                className="p-2 rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
                title="Duck Scrapbook & Facts"
              >
                <IconBook className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsMusicMuted(!isMusicMuted)}
                className="p-2 rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
                title={isMusicMuted ? "Unmute Lo-Fi Music" : "Mute Lo-Fi Music"}
              >
                {isMusicMuted ? (
                  <IconMusicOff className="w-4 h-4 text-zinc-500" />
                ) : (
                  <IconMusic className="w-4 h-4 text-emerald-400" />
                )}
              </button>

              <button
                onClick={() => setMuted(!muted)}
                className="p-2 rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
                title={muted ? "Unmute Audio" : "Mute Audio"}
              >
                {muted ? (
                  <IconVolumeOff className="w-4 h-4" />
                ) : (
                  <IconVolume className="w-4 h-4 text-zinc-200" />
                )}
              </button>

              <FieldManualButton
                manualId="working-with-duck"
                label="Manual"
                onOpenChange={handleManualOpenChange}
                isHotkeyOwner={true}
              />
              <FullscreenButton
                isFullscreen={isFullscreen}
                onToggle={toggleFullscreen}
                variant="header"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sprint result (#1677): the shared arcade card with this run's recap */}
      {(uiState.status === "won" || uiState.status === "failed") && (
        <DuckSprintResult
          state={uiState}
          sprintTitle={currentSprint.title}
          storedBest={loadedHighScore}
          onNext={handleAdvanceLevel}
          onReplay={restartSprint}
          onEndless={startEndlessRun}
        />
      )}

      {/* Accessory Wardrobe Modal */}
      {isWardrobeOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn">
          <div
            ref={wardrobeTrapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="duck-wardrobe-dialog-heading"
            className="max-w-md w-full max-h-[90dvh] overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6 font-mono relative"
          >
            <button
              onClick={closeWardrobe}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
            >
              <IconX className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-4 sm:mb-6">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                <IconShirt className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id="duck-wardrobe-dialog-heading"
                  className="text-base sm:text-lg font-bold text-white"
                >
                  Duck&apos;s Wardrobe
                </h3>
                <p className="text-[11px] sm:text-xs text-zinc-400">
                  Equip unlocked accessories
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:gap-2.5">
              {[
                {
                  id: "none",
                  name: "Natural Fluffy Coat",
                  desc: "Pure English Cream marshmallow vibes",
                  icon: "🐾",
                },
                {
                  id: "bucket-hat",
                  name: "Adidas Bucket Hat",
                  desc: "Fact #5 · +10 Charisma & street style",
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
                  desc: "Crimson polka-dot outdoor explorer gear",
                  icon: "🧣",
                },
                {
                  id: "rain-boots",
                  name: "Yellow Mud Boots",
                  desc: "100% Mud puddle immunity at the Dog Park!",
                  icon: "🥾",
                },
              ].map((acc) => {
                const isUnlocked = uiState.unlockedAccessories.includes(
                  acc.id as DuckAccessory
                );
                const isSelected = uiState.activeAccessory === acc.id;

                return (
                  <button
                    key={acc.id}
                    disabled={!isUnlocked}
                    onClick={() =>
                      handleEquipAccessory(acc.id as DuckAccessory)
                    }
                    aria-checked={isSelected}
                    role="radio"
                    className={`w-full p-2.5 sm:p-3 rounded-2xl border text-left flex items-center justify-between transition-all min-h-[48px] min-w-[44px] cursor-pointer touch-manipulation select-none active:scale-95 ${
                      isSelected
                        ? "border-brand-cyan bg-brand-cyan/15 text-white shadow-md"
                        : isUnlocked
                          ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
                          : "border-zinc-800/50 bg-zinc-900/30 text-zinc-600 cursor-not-allowed opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <span className="text-xl sm:text-2xl shrink-0">
                        {acc.icon}
                      </span>
                      <div>
                        <div className="text-xs font-bold flex items-center gap-2">
                          <span>{acc.name}</span>
                          {!isUnlocked && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[9px] text-zinc-400">
                              Locked
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {acc.desc}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <IconCheck className="w-4 h-4 text-brand-cyan shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Polaroid Scrapbook Modal */}
      {isScrapbookOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn">
          <div
            ref={scrapbookTrapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="duck-scrapbook-dialog-heading"
            className="max-w-xl w-full max-h-[90dvh] overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-950 p-4 sm:p-8 font-mono relative"
          >
            <button
              onClick={closeScrapbook}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
            >
              <IconX className="w-4 h-4" />
            </button>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-6 pr-8 sm:pr-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                  <IconBook className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    id="duck-scrapbook-dialog-heading"
                    className="text-base sm:text-lg font-bold text-white"
                  >
                    Duck&apos;s Polaroid Scrapbook
                  </h3>
                  <p className="text-[11px] sm:text-xs text-zinc-400">
                    Real puppy milestones &amp; vector art
                  </p>
                </div>
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center rounded-xl bg-zinc-900 border border-zinc-800 p-1">
                <button
                  onClick={() => setScrapbookViewMode("photo")}
                  className={`px-2.5 sm:px-3 py-1 min-h-[44px] min-w-[44px] rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation select-none active:scale-95 ${
                    scrapbookViewMode === "photo"
                      ? "bg-brand-cyan text-black shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <IconPhoto className="w-3.5 h-3.5" />
                  <span>Real Photos 📷</span>
                </button>

                <button
                  onClick={() => setScrapbookViewMode("vector")}
                  className={`px-2.5 sm:px-3 py-1 min-h-[44px] min-w-[44px] rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation select-none active:scale-95 ${
                    scrapbookViewMode === "vector"
                      ? "bg-brand-cyan text-black shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <IconPalette className="w-3.5 h-3.5" />
                  <span>Vector Art 🎨</span>
                </button>
              </div>
            </div>

            {/* Scrapbook Carousel Card */}
            {(() => {
              const currentFact = DUCK_FACTS[activeScrapbookIndex];
              const isUnlocked = uiState.unlockedFacts.includes(
                currentFact.level
              );
              const activeImageSource =
                scrapbookViewMode === "photo"
                  ? currentFact.photoUrl
                  : currentFact.svgUrl;

              return (
                <div className="rounded-2xl bg-white p-3 sm:p-4 text-black shadow-2xl">
                  <div className="relative w-full aspect-4/3 rounded-xl overflow-hidden bg-zinc-100 mb-2.5 sm:mb-3 border border-zinc-200">
                    {isUnlocked ? (
                      <Image
                        src={activeImageSource}
                        alt={currentFact.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 280px, 480px"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center text-zinc-500 p-4 text-center">
                        <IconBone className="w-8 h-8 mb-2 opacity-40" />
                        <span className="text-xs font-mono font-bold">
                          Locked Milestone
                        </span>
                        <span className="text-[10px] font-sans mt-1">
                          Complete Sprint {currentFact.level} to unlock this
                          milestone!
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-xs sm:text-sm text-zinc-900">
                      {isUnlocked
                        ? currentFact.title
                        : `Sprint ${currentFact.level} Secret`}
                    </h4>
                    <span className="text-[10px] font-mono font-bold text-zinc-500">
                      Card {activeScrapbookIndex + 1} of {DUCK_FACTS.length}
                    </span>
                  </div>

                  <p className="text-[11px] sm:text-xs text-zinc-700 font-sans leading-relaxed">
                    {isUnlocked
                      ? currentFact.fact
                      : "Play through the campaign levels to reveal real photos, artwork, and stories about Duck."}
                  </p>

                  {isUnlocked && (
                    <p className="text-[10px] sm:text-[11px] text-zinc-500 italic font-sans mt-1.5 sm:mt-2">
                      &ldquo;{currentFact.caption}&rdquo;
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Carousel Navigation */}
            <div className="mt-3 sm:mt-4 flex items-center justify-between gap-2">
              <button
                disabled={activeScrapbookIndex === 0}
                onClick={() =>
                  setActiveScrapbookIndex((i) => Math.max(0, i - 1))
                }
                className="px-3 py-1.5 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
              >
                ← Prev
              </button>

              <div className="flex gap-1.5 items-center">
                {DUCK_FACTS.map((f, idx) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveScrapbookIndex(idx)}
                    className={`relative min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer touch-manipulation select-none active:scale-95`}
                    aria-label={`Go to card ${idx + 1}`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full transition-all ${
                        activeScrapbookIndex === idx
                          ? "bg-brand-cyan scale-125"
                          : "bg-zinc-800 hover:bg-zinc-600"
                      }`}
                    />
                  </button>
                ))}
              </div>

              <button
                disabled={activeScrapbookIndex === DUCK_FACTS.length - 1}
                onClick={() =>
                  setActiveScrapbookIndex((i) =>
                    Math.min(DUCK_FACTS.length - 1, i + 1)
                  )
                }
                className="px-3 py-1.5 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Off-screen Accessible DOM Fallback Subtree */}
      <div
        className="sr-only"
        aria-label="Working with Duck Accessible Subtree"
      >
        <fieldset>
          <legend>Working with Duck Companion State and Controls</legend>

          <div role="group" aria-label="Duck Companion Telemetry and Status">
            <output htmlFor="duck-score">
              Sprint Score: {uiState.totalScore}
            </output>
            <output htmlFor="duck-highscore">
              High Score: {displayedHighScore}
            </output>
            <output htmlFor="duck-level">
              Sprint Level: {uiState.currentLevel}
            </output>
            <output htmlFor="duck-work">
              Work Progress:{" "}
              {Math.min(
                100,
                Math.round(
                  (uiState.workProgress / uiState.targetWorkProgress) * 100
                )
              )}
              %
            </output>
            <output htmlFor="duck-excitement">
              Excitement: {Math.round(uiState.excitement)}%
            </output>
            <output htmlFor="duck-bladder">
              Bladder: {Math.round(uiState.bladder)}%
            </output>
            <output htmlFor="duck-accessory">
              Equipped Accessory: {uiState.activeAccessory}
            </output>
            <output htmlFor="duck-location">
              Location:{" "}
              {uiState.inBathtub
                ? "Bathtub"
                : uiState.inDogPark
                  ? "Dog Park"
                  : "Office Workspace"}
            </output>
          </div>

          <div role="group" aria-label="Duck Companion Interactive Actions">
            <button
              type="button"
              onClick={() => {
                if (uiState.status === "idle") {
                  applyTransition((state) => ({ ...state, status: "running" }));
                  announce("Started Duck Companion Simulation.", "polite");
                }
              }}
              disabled={uiState.status === "running"}
            >
              Launch Sprint {uiState.currentLevel || 1}
            </button>

            <button
              type="button"
              disabled={isPlayFrozen}
              onClick={() => {
                handleGiveTreat();
                announce("Gave a delicious treat to the duck.", "polite");
              }}
            >
              Give Treat
            </button>

            <button
              type="button"
              disabled={isPlayFrozen}
              onClick={() => {
                applyTransition((state) => applySqueakyToy(state, 400, 250));
                announce("Played with squeaky toy.", "polite");
              }}
            >
              Use Squeaky Toy
            </button>

            <button
              type="button"
              disabled={isPlayFrozen}
              onClick={() => {
                applyTransition((state) => applyKongToy(state, 400, 250));
                announce("Gave Kong toy filled with peanut butter.", "polite");
              }}
            >
              Use Kong Toy
            </button>

            <button
              type="button"
              disabled={isPlayFrozen}
              onClick={() => {
                applyTransition((state) => scrubBelly(state, 400, 250));
                announce("Gave duck a belly rub.", "polite");
              }}
            >
              Scratch Belly Rub
            </button>

            <button
              type="button"
              disabled={isPlayFrozen}
              onClick={() => {
                applyTransition((state) => activeCodeBurst(state));
                announce("Triggered code burst developer session.", "polite");
              }}
            >
              Trigger Code Burst
            </button>

            <button
              type="button"
              disabled={officeOnlyDisabled}
              onClick={() => {
                handlePerformTrick("SIT");
                announce("Commanded duck to Sit.", "polite");
              }}
            >
              Trick: Sit
            </button>

            <button
              type="button"
              disabled={officeOnlyDisabled}
              onClick={() => {
                handlePerformTrick("HIGH_FIVE");
                announce("Commanded duck to High Five.", "polite");
              }}
            >
              Trick: High Five
            </button>

            <button
              type="button"
              disabled={officeOnlyDisabled}
              onClick={() => {
                handlePerformTrick("DROP_IT");
                announce("Commanded duck to Drop It.", "polite");
              }}
            >
              Trick: Drop It
            </button>

            <button
              type="button"
              disabled={officeOnlyDisabled}
              onClick={() => {
                handlePerformTrick("SPIN");
                announce("Commanded duck to Spin.", "polite");
              }}
            >
              Trick: Spin
            </button>

            {!uiState.inBathtub && (
              <button
                type="button"
                disabled={isPlayFrozen}
                onClick={() => {
                  applyTransition((state) => enterBathtub(state));
                  announce("Entered bathtub for duck bath time.", "polite");
                }}
              >
                Enter Bathtub
              </button>
            )}

            {uiState.inBathtub && (
              <>
                <button
                  type="button"
                  disabled={isPlayFrozen}
                  onClick={() => {
                    applyTransition((state) =>
                      scrubBathtub(state, Date.now(), 1)
                    );
                    announce("Scrubbed duck with soapy bubbles.", "polite");
                  }}
                >
                  Scrub Duck
                </button>
                <button
                  type="button"
                  disabled={isPlayFrozen}
                  onClick={() => {
                    applyTransition((state) => rinseBathtub(state));
                    announce("Rinsed duck with warm water.", "polite");
                  }}
                >
                  Rinse Duck
                </button>
                <button
                  type="button"
                  disabled={isPlayFrozen}
                  onClick={() => {
                    applyTransition((state) => exitBathtub(state));
                    announce("Exited bathtub clean and refreshed.", "polite");
                  }}
                >
                  Exit Bathtub
                </button>
              </>
            )}
          </div>
        </fieldset>
      </div>
    </div>
  );
};
