"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useSyncExternalStore,
  useCallback,
  useMemo,
} from "react";
import { useAudio } from "@/components/providers/AudioProvider";
import { getSoundEngine } from "@/lib/audio/sound-engine";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import { useTelemetry } from "@/hooks/useTelemetry";
import { clamp, gameFont } from "@/lib/game-utils";
import { useSkipTitleScreen } from "@/components/arcade/CabinetSetupContext";
import {
  recordArcadeMilestone,
  recordArcadeScore,
} from "@/lib/arcade-achievements";
import { useGameFullscreen as useFullscreen } from "@/components/arcade/CabinetFullscreen";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import { useResponsiveCanvas } from "@/hooks/useResponsiveCanvas";
import { useCanvasResolution } from "@/hooks/useCanvasResolution";
import { applyCanvasScale } from "@/lib/arcade";
import {
  drawActBackdrop,
  drawEnemySilhouette,
  drawLoon,
} from "@/components/laser-loon/scene-art";
import {
  AUTOMATIC_REASONS,
  useCabinetPauseController,
  useCabinetRunActive,
} from "@/components/arcade/pause";
import { useCabinetTutorial } from "@/components/arcade/tutorial";
import { useArcadeFx } from "@/hooks/useArcadeFx";
import { safeGetRawItem, safeSetRawItem } from "@/lib/safe-storage";
import {
  LaserMode,
  LaserType,
  Target,
  IceBlock,
  Particle,
  Shockwave,
  FloatingText,
  PowerUp,
  PowerUpType,
  spawnTarget as engineSpawnTarget,
  spawnBossForAct,
  spawnPowerUp as engineSpawnPowerUp,
  updatePowerUps as engineUpdatePowerUps,
  createIceBlock as engineCreateIceBlock,
  updateIceBlocksAndCollisions,
  updateTargetsPosition,
  checkLaserRayHit,
  triggerUltimateTremolo,
  calculateNextComboAndMultiplier,
  classifyCampaignKill,
  createExplosionParticles,
  updateParticles,
  updateShockwaves,
  updateFloatingTexts,
  WEAPONS,
  CAMPAIGN_ACTS,
  POWER_UP_CONFIGS,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  COMBO_TIMEOUT_MS,
  LOON_MIN_X,
  LOON_MAX_X,
  LOON_MIN_Y,
  LOON_MAX_Y,
  LOON_MAX_HITS,
  resolveLoonCollision,
  updateBossAttack,
  getBossSignature,
  STARFLAKE_SHIELD_HALF_ARC,
  isBossTelegraphing,
  BOSS_MINION_SPAWN_RATE,
  getSurvivalWave,
  getActStars,
  LASER_LOON_TUTORIAL_SIGNALS as TUTORIAL,
  parseActBestRecord,
  mergeActBest,
  countActStars,
  LASER_LOON_STARS_KEY,
  type ActBestRecord,
  pickKeyboardAim,
  updateMinionFire,
  type CounterHitPoint,
} from "@/lib/laser-loon";

/** Shortest gap between counter callouts, so rapid fire cannot spam them. */
const COUNTER_CUE_INTERVAL_MS = 260;

const emptySubscribe = () => () => {};

const subscribeHighScore = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};
// Campaign and arcade keep separate bests: a four-act total and a single
// survival run are different scales. Sandbox never saves a score (#2140).
// The campaign keeps the original key, which the arcade hub also reads.
const BEST_SCORE_KEYS: Partial<Record<LaserMode, string>> = {
  campaign: "laser_loon_high_score",
  arcade: "laser_loon_arcade_best",
};
const readBest = (key: string) => {
  try {
    return parseInt(safeGetRawItem(key) || "0", 10) || 0;
  } catch {
    return 0;
  }
};
// A string snapshot keeps useSyncExternalStore's comparison stable.
const getHighScoreSnapshot = () =>
  `${readBest("laser_loon_high_score")}|${readBest("laser_loon_arcade_best")}`;
const getHighScoreServerSnapshot = () => "0|0";
// Saved act stars, read as the raw string so the snapshot compares stably.
const getStarSnapshot = () => {
  try {
    return safeGetRawItem(LASER_LOON_STARS_KEY) || "";
  } catch {
    return "";
  }
};
const getStarServerSnapshot = () => "";
/** Stars a full campaign can earn: three per act. */
export const CAMPAIGN_STAR_TOTAL = CAMPAIGN_ACTS.length * 3;

/**
 * What the view knows about the device. A session never reads the viewport,
 * pointer or form factor itself (ADR 0062), so the view passes them in.
 */
interface LaserLoonSessionOptions {
  /**
   * True inside the immersive touch cabinet (a tablet after Launch). Desktop
   * and the windowed cabinet read false, so their markup is unchanged.
   */
  readonly touch: boolean;
  /** Key names read as taps while the last input was a finger or the Pencil. */
  readonly touchHint: boolean;
  /** The reduced-motion preference, for the backdrop animation. */
  readonly prefersReducedMotion: boolean;
  /** Whether screen shake starts on: off when reduced motion was asked for at mount. */
  readonly initialScreenShake: boolean;
}

/**
 * The Laser Loon session: campaign and mode, act progress, the run loop and
 * the input handlers, moved out of `LaserLoon.tsx` so the component is its
 * JSX (#3436). It returns everything the view reads or calls.
 */
export function useLaserLoonSession(options: LaserLoonSessionOptions) {
  const { touch, touchHint, prefersReducedMotion, initialScreenShake } =
    options;
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const rawHighScore = useSyncExternalStore(
    subscribeHighScore,
    getHighScoreSnapshot,
    getHighScoreServerSnapshot
  );
  const [savedCampaignBest, savedArcadeBest] = rawHighScore
    .split("|")
    .map((n) => parseInt(n, 10) || 0);
  const rawStars = useSyncExternalStore(
    subscribeHighScore,
    getStarSnapshot,
    getStarServerSnapshot
  );
  // A same-tab write fires no storage event, so a clear updates this copy.
  const [savedStars, setSavedStars] = useState<ActBestRecord | null>(null);
  const actBests = useMemo(
    () => savedStars ?? parseActBestRecord(rawStars),
    [savedStars, rawStars]
  );
  // Each act's stars this run, for the campaign card's tally (#2143).
  const [runStars, setRunStars] = useState<ActBestRecord>({});
  const { playNote, playSuccess } = useAudio();
  const { recordEvent } = useTelemetry();

  // Game configuration & React state
  const [mode, setMode] = useState<LaserMode>("campaign");
  const [laserType, setLaserType] = useState<LaserType>("ruby-laser");
  const [gameState, setGameState] = useState<
    | "idle"
    | "playing"
    | "act-intro"
    | "act-victory"
    | "act-failed"
    | "gameover"
    | "campaign-victory"
  >("idle");
  const [currentActNum, setCurrentActNum] = useState(1);
  const [actKills, setActKills] = useState(0);
  // Every flag downed this run, in any mode, for the end-of-run card.
  const [runKills, setRunKills] = useState(0);
  const [hitsLeft, setHitsLeft] = useState(LOON_MAX_HITS);
  const [bossActive, setBossActive] = useState(false);
  const [bossHp, setBossHp] = useState(100);
  const [bossMaxHp, setBossMaxHp] = useState(100);
  const [bossName, setBossName] = useState("");
  const [score, setScore] = useState(0);
  // Bests reached this session, per mode, ahead of the storage snapshot.
  const [sessionBest, setSessionBest] = useState<
    Partial<Record<LaserMode, number>>
  >({});
  const loadedHighScore =
    mode === "campaign"
      ? savedCampaignBest
      : mode === "arcade"
        ? savedArcadeBest
        : 0;
  const effectiveHighScore = Math.max(sessionBest[mode] ?? 0, loadedHighScore);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  // The best score before this run, for the result card's best-score line.
  const [runStartBest, setRunStartBest] = useState(0);
  const [actResult, setActResult] = useState<{
    actScore: number;
    seconds: number;
    stars: 1 | 2 | 3;
    newStars: boolean;
    newTime: boolean;
  } | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  // Arcade Survival's clock counts up: seconds survived, in game time.
  const [survivalSecs, setSurvivalSecs] = useState(0);
  const [ultimateMeter, setUltimateMeter] = useState(0);
  const [activePowerUpType, setActivePowerUpType] =
    useState<PowerUpType | null>(null);
  const [activePowerUpTimeMs, setActivePowerUpTimeMs] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [screenShakeEnabled, setScreenShakeEnabled] =
    useState<boolean>(initialScreenShake);
  const fx = useArcadeFx({ enabled: screenShakeEnabled });
  const { stageRef: fxStageRef, flashRef: fxFlashRef } = fx;
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [gravity, setGravity] = useState<number>(0.15); // for sandbox mode
  const [showMuseum, setShowMuseum] = useState(false);
  const [selectedFlagIndex, setSelectedFlagIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  // The touch cabinet keeps its modes and switches in a menu sheet (#2081).
  const [showMenu, setShowMenu] = useState(false);
  // The cabinet's guided tutorial (#2972) runs in the Sandbox and hears what
  // the player does through these signals.
  const tutorial = useCabinetTutorial();
  const tutorialSignal = tutorial.signal;
  const keyTag = (key: string) => (touchHint ? "" : ` [${key}]`);
  // The simulation also stops behind the Flag Museum, the Field Manual and the
  // menu sheet, so reading them never costs a run.
  const isHalted = isPaused || showMuseum || isManualOpen || showMenu;
  const survivalWave = getSurvivalWave(survivalSecs);

  const { announce } = useAnnouncer();
  const isInitialPauseRef = useRef(true);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  useEffect(() => {
    if (isInitialPauseRef.current) {
      isInitialPauseRef.current = false;
      return;
    }
    announce(isPaused ? "Game paused." : "Game resumed.", "assertive");
  }, [isPaused, announce]);

  const museumTrapRef = useFocusTrap<HTMLDivElement>(showMuseum, {
    onEscape: () => setShowMuseum(false),
    onKeyDown: (event) => {
      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        setShowMuseum(false);
      }
    },
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toGameCoordinates } = useResponsiveCanvas({
    canvasRef,
    internalWidth: DEFAULT_CANVAS_WIDTH,
    internalHeight: DEFAULT_CANVAS_HEIGHT,
    maxDpr: 2.0,
  });
  // Sharp on HiDPI screens; drawing stays in the 768x420 logical space.
  const canvasScaleRef = useCanvasResolution({
    canvasRef,
    logicalWidth: DEFAULT_CANVAS_WIDTH,
    logicalHeight: DEFAULT_CANVAS_HEIGHT,
    active: isMounted,
  });
  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef);

  const selectLaserType = (type: LaserType) => {
    setLaserType(type);
    tutorialSignal(TUTORIAL.optic);
    const weaponName = WEAPONS[type]?.name || type;
    announce(`Weapon selected: ${weaponName}`, "polite");
  };

  // Mutable Game Physics & Animation Refs
  const targetsRef = useRef<Target[]>([]);
  const iceBlocksRef = useRef<IceBlock[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const loonPosRef = useRef({ x: 120, y: 180, targetX: 120, targetY: 180 });
  const aimPosRef = useRef({ x: 420, y: 180 });
  const isFiringRef = useRef(false);
  const isDraggingLoonRef = useRef(false);
  const nextTargetIdRef = useRef(1);
  const nextIceIdRef = useRef(1);
  const nextPowerUpIdRef = useRef(1);
  const nextShockwaveIdRef = useRef(1);
  const nextTextIdRef = useRef(1);
  const lastFireTimeRef = useRef(0);
  const lastComboTimeRef = useRef(0);
  const comboRef = useRef(0);
  const lastBossHpRef = useRef(0);
  const bossHitFlashUntilRef = useRef(0);
  const actKillsRef = useRef(0);
  const runKillsRef = useRef(0);
  // Unpaused play this act, for its par star (#1940).
  const actPlayMsRef = useRef(0);
  // Arcade Survival's game-time clock, and its last whole second shown.
  const survivalMsRef = useRef(0);
  const survivalSecsRef = useRef(0);
  const actStartScoreRef = useRef(0);
  // Keyboard shots aim for the player until the pointer moves again (#1940).
  const keyboardAimRef = useRef(false);
  const hitsLeftRef = useRef(LOON_MAX_HITS);
  const invulnerableUntilRef = useRef(0);
  const bossSpawnedRef = useRef(false);
  const activePowerUpRef = useRef<{
    type: PowerUpType;
    expiresAt: number;
  } | null>(null);
  const ultimateMeterRef = useRef(0);

  // The touch cabinet's pause service stops the game when the tab is hidden,
  // the app is backgrounded or the window blurs (#2081, #2357). A run in
  // progress pauses and a held Fire lets go; resuming is the player's choice.
  // With no run to pause, the cabinet is released at once. The cabinet's
  // own user pause (phone or browser Back, #2545) pauses a run in progress
  // too; with no run it is left to the cabinet, which exits on the next Back.
  const pauseService = useCabinetPauseController();
  useEffect(
    () =>
      pauseService.onPause((reason) => {
        if (reason === "user") {
          if (gameState !== "playing") return;
          isFiringRef.current = false;
          setIsPaused(true);
          return;
        }
        if (!AUTOMATIC_REASONS.has(reason)) return;
        isFiringRef.current = false;
        if (gameState === "playing") setIsPaused(true);
        else pauseService.resume();
      }),
    [gameState, pauseService]
  );
  // The game's own pause menu stays; the cabinet mirrors it, so P, Resume
  // and an automatic pause all agree on whether the run is paused.
  useEffect(() => {
    if (isPaused) pauseService.pause("user");
    else pauseService.resume();
  }, [isPaused, pauseService]);
  // The screen stays awake while the run plays.
  useCabinetRunActive(gameState === "playing" && !isHalted);

  // The touch cabinet's overlays (story, pause, results, menu) start under the
  // status strip, so Menu and Pause stay in reach on every screen. The strip's
  // height changes as it wraps, so it is measured rather than assumed.
  useEffect(() => {
    if (!touch || !isMounted) return;
    const playfield = containerRef.current;
    const hud = playfield?.querySelector<HTMLElement>(".arcade-hud");
    if (!playfield || !hud) return;
    const apply = () =>
      playfield.style.setProperty("--ll-hud-h", `${hud.offsetHeight}px`);
    apply();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(apply);
    observer.observe(hud);
    return () => observer.disconnect();
  }, [touch, isMounted]);

  const currentAct =
    CAMPAIGN_ACTS.find((a) => a.actNumber === currentActNum) ||
    CAMPAIGN_ACTS[0];

  // Synthesized Loon Tremolo / Cry using Web Audio API FM Oscillators
  const playSynthesizedLoonTremolo = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const engine = getSoundEngine();
      if (!engine.isSoundAllowed()) return;
      const ctx = engine.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const masterVol = engine.getVolume();
      const osc = engine.trackSource(ctx.createOscillator());
      const gain = ctx.createGain();
      const lfo = engine.trackSource(ctx.createOscillator());
      const lfoGain = ctx.createGain();

      // Authentic loon yodel / tremolo FM synthesis
      osc.type = "sine";
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(1150, now + 0.35);
      osc.frequency.exponentialRampToValueAtTime(740, now + 0.9);
      osc.frequency.exponentialRampToValueAtTime(980, now + 1.4);
      osc.frequency.exponentialRampToValueAtTime(520, now + 2.0);

      // Vibrato LFO for haunting lake tremolo
      lfo.frequency.setValueAtTime(6.5, now);
      lfoGain.gain.setValueAtTime(35, now);
      lfo.connect(osc.frequency);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.35 * masterVol, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.28 * masterVol, now + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      lfo.start(now);
      osc.start(now);
      lfo.stop(now + 2.2);
      osc.stop(now + 2.2);
    } catch {}
  }, [soundEnabled]);

  // Audio synthesis helpers
  const playLaserSound = useCallback(
    (type: LaserType) => {
      if (!soundEnabled) return;
      try {
        if (type === "ruby-laser") {
          playNote(740, 0.05);
          setTimeout(() => playNote(440, 0.04), 25);
        } else if (type === "cyan-pulse") {
          playNote(880, 0.03);
          setTimeout(() => playNote(587.33, 0.03), 15);
        } else if (type === "aurora-wave") {
          playNote(523.25, 0.05);
          playNote(659.25, 0.05);
          playNote(783.99, 0.05);
        } else if (type === "ice-cannon") {
          playNote(330, 0.08);
          setTimeout(() => playNote(660, 0.06), 30);
        }
      } catch {}
    },
    [soundEnabled, playNote]
  );

  const playIceShatterSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const freqs = [1046.5, 1318.5, 1567.98, 2093.0];
      freqs.forEach((f, idx) => {
        setTimeout(() => playNote(f, 0.05), idx * 22);
      });
    } catch {}
  }, [soundEnabled, playNote]);

  const playExplodeSound = useCallback(
    (isBoss = false) => {
      if (!soundEnabled) return;
      try {
        if (isBoss) {
          playNote(110, 0.2);
          setTimeout(() => playNote(82.4, 0.25), 50);
          setTimeout(() => playNote(55, 0.3), 120);
        } else {
          playNote(220, 0.08);
          setTimeout(() => playNote(110, 0.1), 35);
        }
      } catch {}
    },
    [soundEnabled, playNote]
  );

  const playPowerUpSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
        setTimeout(() => playNote(f, 0.06), idx * 35);
      });
    } catch {}
  }, [soundEnabled, playNote]);

  const playLoonHitSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      [330, 247, 185].forEach((f, idx) => {
        setTimeout(() => playNote(f, 0.07), idx * 60);
      });
    } catch {}
  }, [soundEnabled, playNote]);

  const playComboSound = useCallback(
    (comboCount: number) => {
      if (!soundEnabled) return;
      try {
        const baseFreq = Math.min(1200, 440 + comboCount * 50);
        playNote(baseFreq, 0.08);
        setTimeout(() => playNote(baseFreq * 1.25, 0.1), 50);
      } catch {}
    },
    [soundEnabled, playNote]
  );

  // A resisted hit sounds dull and low; a weakness crit pings bright.
  const playResistSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      playNote(130.81, 0.05);
    } catch {}
  }, [soundEnabled, playNote]);

  const playCritSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      playNote(1318.5, 0.04);
      setTimeout(() => playNote(1760, 0.05), 30);
    } catch {}
  }, [soundEnabled, playNote]);

  // Floating text helper
  const addFloatingText = useCallback(
    (x: number, y: number, text: string, color: string) => {
      floatingTextsRef.current.push({
        id: nextTextIdRef.current++,
        x,
        y,
        text,
        color,
        alpha: 1,
        vy: -1.4,
      });
    },
    []
  );

  // Particle helper
  const spawnExplosion = useCallback(
    (
      x: number,
      y: number,
      color: string,
      count = 20,
      isIce = false,
      isStar = false
    ) => {
      const newParticles = createExplosionParticles(
        x,
        y,
        color,
        count,
        isIce,
        isStar
      );
      particlesRef.current.push(...newParticles);
    },
    []
  );

  // Weapon counter feedback (#2052): every countered hit sparks, a steel
  // glance when resisted and an amber star pop on a weakness crit. The
  // callout and sound are throttled so rapid fire reads, not spams.
  const lastCounterCueRef = useRef(0);
  const showCounterHits = useCallback(
    (points: CounterHitPoint[]) => {
      let cue: CounterHitPoint | undefined;
      for (const pt of points) {
        if (pt.counter === "weak") {
          tutorialSignal(TUTORIAL.crit);
          spawnExplosion(pt.x, pt.y, "#f59e0b", 8, false, true);
          if (!cue || cue.counter !== "weak") cue = pt;
        } else if (pt.counter === "resisted" || pt.counter === "blocked") {
          spawnExplosion(pt.x, pt.y, "#94a3b8", 3);
          if (!cue) cue = pt;
        }
      }
      if (!cue) return;
      const now = performance.now();
      if (now - lastCounterCueRef.current < COUNTER_CUE_INTERVAL_MS) return;
      lastCounterCueRef.current = now;
      if (cue.counter === "weak") {
        addFloatingText(cue.x, cue.y - 18, "CRIT!", "#f59e0b");
        playCritSound();
      } else if (cue.counter === "blocked") {
        addFloatingText(cue.x, cue.y - 18, "SHIELDED", "#94a3b8");
        playResistSound();
      } else {
        addFloatingText(cue.x, cue.y - 18, "RESISTED", "#94a3b8");
        playResistSound();
      }
    },
    [
      spawnExplosion,
      addFloatingText,
      playCritSound,
      playResistSound,
      tutorialSignal,
    ]
  );

  // Launch Ice Block
  const launchIceBlock = useCallback(
    (fromX: number, fromY: number, targetX: number, targetY: number) => {
      const { iceBlock, nextId } = engineCreateIceBlock(
        fromX,
        fromY,
        targetX,
        targetY,
        nextIceIdRef.current
      );
      nextIceIdRef.current = nextId;
      iceBlocksRef.current.push(iceBlock);
      spawnExplosion(fromX, fromY, "#38bdf8", 6, true);
    },
    [spawnExplosion]
  );

  // High score updater. Score and best are tracked in refs so the storage
  // write happens outside any setState updater (AGENTS.md §4), and the best
  // includes the saved score so a lower run never overwrites it.
  const scoreRef = useRef(0);
  const bestScoreRef = useRef<Partial<Record<LaserMode, number>>>({});
  const addScore = useCallback(
    (pts: number) => {
      const next = scoreRef.current + pts;
      scoreRef.current = next;
      setScore(next);
      const key = BEST_SCORE_KEYS[mode];
      if (!key) return;
      if (next > Math.max(bestScoreRef.current[mode] ?? 0, loadedHighScore)) {
        bestScoreRef.current = { ...bestScoreRef.current, [mode]: next };
        setSessionBest(bestScoreRef.current);
        safeSetRawItem(key, next.toString());
        // The arcade hub's one Laser Loon score is the campaign best.
        if (mode === "campaign") recordArcadeScore("laser-loon", next);
      }
    },
    [mode, loadedHighScore]
  );

  const addUltimateMeter = useCallback((amount: number) => {
    const nextVal = Math.min(100, ultimateMeterRef.current + amount);
    ultimateMeterRef.current = nextVal;
    setUltimateMeter(nextVal);
  }, []);

  // Spawner callback
  const spawnTarget = useCallback(
    (width: number, height: number, rosterAct?: number) => {
      const { updatedTargets, nextId } = engineSpawnTarget(
        targetsRef.current,
        nextTargetIdRef.current,
        width,
        height,
        undefined,
        rosterAct ?? currentActNum
      );
      targetsRef.current = updatedTargets;
      nextTargetIdRef.current = nextId;
    },
    [currentActNum]
  );

  // Spawn Boss
  const triggerBossEncounter = useCallback(
    (width: number, height: number) => {
      bossSpawnedRef.current = true;
      const { boss, nextId } = spawnBossForAct(
        currentActNum,
        nextTargetIdRef.current,
        width,
        height
      );
      nextTargetIdRef.current = nextId;
      targetsRef.current = [...targetsRef.current, boss];
      setBossActive(true);
      setBossHp(boss.hp);
      setBossMaxHp(boss.maxHp);
      setBossName(boss.label);
      addFloatingText(
        width * 0.5,
        80,
        `⚠️ BOSS: ${boss.label.toUpperCase()} ⚠️`,
        "#ef4444"
      );
      fx.shake(8);
    },
    [currentActNum, fx, addFloatingText]
  );

  // Spawn Power-Up
  const spawnRandomPowerUp = useCallback((width: number, height: number) => {
    const { updatedPowerUps, nextId } = engineSpawnPowerUp(
      powerUpsRef.current,
      nextPowerUpIdRef.current,
      width,
      height
    );
    powerUpsRef.current = updatedPowerUps;
    nextPowerUpIdRef.current = nextId;
  }, []);

  // Every weapon's kills go through these two handlers, so a kill counts
  // toward the act and a boss kill ends it whichever weapon landed it.
  const awardComboKill = useCallback(
    (t: Target, now: number): number => {
      const { nextCombo, nextMultiplier } = calculateNextComboAndMultiplier(
        comboRef.current,
        lastComboTimeRef.current,
        now
      );
      lastComboTimeRef.current = now;
      comboRef.current = nextCombo;
      setCombo(nextCombo);
      setMaxCombo((best) => Math.max(best, nextCombo));
      setMultiplier(nextMultiplier);

      const extraMul = activePowerUpRef.current?.type === "north-star" ? 3 : 0;
      const pts = t.points * (nextMultiplier + extraMul);
      addScore(pts);

      if (nextCombo > 1 && nextCombo % 3 === 0) {
        playComboSound(nextCombo);
        addFloatingText(t.x, t.y - 20, `${nextMultiplier}x COMBO!`, "#38bdf8");
      }
      return pts;
    },
    [addScore, playComboSound, addFloatingText]
  );

  // A combo lapses COMBO_TIMEOUT_MS after the last kill; clear the HUD pill
  // then instead of leaving a stale multiplier on screen.
  useEffect(() => {
    if (combo <= 1) return;
    const timer = setTimeout(() => {
      comboRef.current = 0;
      setCombo(0);
      setMultiplier(1);
    }, COMBO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [combo]);

  const recordCampaignKill = useCallback(
    (t: Target) => {
      tutorialSignal(TUTORIAL.kill);
      runKillsRef.current += 1;
      setRunKills(runKillsRef.current);
      if (mode !== "campaign") return;
      const outcome = classifyCampaignKill(t, currentActNum);
      if (outcome === "no-credit") return;
      if (outcome === "act-kill") {
        actKillsRef.current += 1;
        setActKills(actKillsRef.current);
        return;
      }
      // Defeated act boss!
      setBossActive(false);
      setBossHp(0);
      const act = CAMPAIGN_ACTS.find((a) => a.actNumber === currentActNum);
      const seconds = Math.round(actPlayMsRef.current / 1000);
      const stars = getActStars(
        seconds,
        act?.parSeconds ?? Infinity,
        LOON_MAX_HITS - hitsLeftRef.current
      );
      // Save the act's best stars and time (#2143).
      const merged = mergeActBest(actBests, currentActNum, stars, seconds);
      safeSetRawItem(LASER_LOON_STARS_KEY, JSON.stringify(merged.record));
      setSavedStars(merged.record);
      setRunStars((prev) => ({
        ...prev,
        [currentActNum]: { stars, bestSeconds: seconds },
      }));
      if (countActStars(merged.record) >= CAMPAIGN_STAR_TOTAL) {
        recordArcadeMilestone("laser-loon", "all_stars");
      }
      setActResult({
        actScore: Math.max(0, scoreRef.current - actStartScoreRef.current),
        seconds,
        stars,
        newStars: merged.newStars,
        newTime: merged.newTime,
      });
      if (hitsLeftRef.current >= LOON_MAX_HITS) {
        recordArcadeMilestone("laser-loon", "act_no_hit");
      }
      if (outcome === "campaign-victory") {
        recordArcadeMilestone("laser-loon", "campaign_cleared");
        setGameState("campaign-victory");
        playSuccess();
        recordEvent("laser_loon_victory", "project_click").catch(() => {});
      } else {
        setGameState("act-victory");
        playSuccess();
      }
    },
    [mode, currentActNum, actBests, playSuccess, recordEvent, tutorialSignal]
  );

  // The render loop reads the latest handlers through a ref rather than
  // restarting whenever the act or mode changes.
  const killHandlersRef = useRef({
    awardComboKill,
    recordCampaignKill,
    showCounterHits,
  });
  useEffect(() => {
    killHandlersRef.current = {
      awardComboKill,
      recordCampaignKill,
      showCounterHits,
    };
  }, [awardComboKill, recordCampaignKill, showCounterHits]);

  // Trigger Ultimate Move
  const fireUltimateTremolo = useCallback(() => {
    if (ultimateMeterRef.current < 100 && mode !== "sandbox") return;
    tutorialSignal(TUTORIAL.ultimate);

    ultimateMeterRef.current = 0;
    setUltimateMeter(0);
    playSynthesizedLoonTremolo();
    fx.shake(14);
    fx.flash("#67e8f9");

    const loon = loonPosRef.current;
    const w = DEFAULT_CANVAS_WIDTH;
    const h = DEFAULT_CANVAS_HEIGHT;

    const result = triggerUltimateTremolo(
      targetsRef.current,
      loon.x + 32,
      loon.y - 12,
      w,
      h,
      nextShockwaveIdRef.current
    );

    targetsRef.current = result.updatedTargets;
    shockwavesRef.current.push(result.newShockwave);
    nextShockwaveIdRef.current = result.nextShockwaveId;

    if (result.pointsEarned > 0) {
      addScore(result.pointsEarned);
    }

    result.killedTargets.forEach((t) => {
      spawnExplosion(t.x, t.y, "#38bdf8", 32, true);
      addFloatingText(
        t.x,
        t.y,
        `TREMOLO VAPORIZED! +${t.points * 3}`,
        "#38bdf8"
      );
      recordCampaignKill(t);
    });

    const survivingBoss = targetsRef.current.find((t) => t.isBoss);
    if (survivingBoss) setBossHp(survivingBoss.hp);

    addFloatingText(w * 0.5, 120, "THE HAUNTING LOON TREMOLO!", "#22d3ee");
  }, [
    fx,
    mode,
    playSynthesizedLoonTremolo,
    addScore,
    spawnExplosion,
    addFloatingText,
    recordCampaignKill,
    tutorialSignal,
  ]);

  // Start campaign act
  const startAct = useCallback((actNum: number) => {
    setCurrentActNum(actNum);
    setActKills(0);
    actKillsRef.current = 0;
    actPlayMsRef.current = 0;
    actStartScoreRef.current = scoreRef.current;
    setActResult(null);
    setHitsLeft(LOON_MAX_HITS);
    hitsLeftRef.current = LOON_MAX_HITS;
    invulnerableUntilRef.current = 0;
    activePowerUpRef.current = null;
    setActivePowerUpType(null);
    bossSpawnedRef.current = false;
    setBossActive(false);
    setIsPaused(false);
    setGameState("playing");
    targetsRef.current = [];
    iceBlocksRef.current = [];
    powerUpsRef.current = [];
    particlesRef.current = [];
    shockwavesRef.current = [];
    floatingTextsRef.current = [];
    loonPosRef.current = { x: 120, y: 180, targetX: 120, targetY: 180 };
  }, []);

  // A retry starts from the score the act began with, so points scored in a
  // failed attempt never stack into the run total or the best (#2140).
  const retryAct = useCallback(() => {
    scoreRef.current = actStartScoreRef.current;
    setScore(actStartScoreRef.current);
    comboRef.current = 0;
    setCombo(0);
    setMultiplier(1);
    startAct(currentActNum);
  }, [startAct, currentActNum]);

  // The next act's intro starts its counter at zero, not at last act's kills.
  const advanceToNextAct = useCallback(() => {
    setActKills(0);
    actKillsRef.current = 0;
    setCurrentActNum((prev) => prev + 1);
    setGameState("act-intro");
  }, []);

  // Start game session
  const startGame = useCallback(() => {
    setRunStartBest(Math.max(bestScoreRef.current[mode] ?? 0, loadedHighScore));
    scoreRef.current = 0;
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    comboRef.current = 0;
    setMultiplier(1);
    setRunStars({});
    survivalMsRef.current = 0;
    survivalSecsRef.current = 0;
    setSurvivalSecs(0);
    setRunKills(0);
    runKillsRef.current = 0;
    setHitsLeft(LOON_MAX_HITS);
    hitsLeftRef.current = LOON_MAX_HITS;
    invulnerableUntilRef.current = 0;
    setIsPaused(false);
    ultimateMeterRef.current = 0;
    setUltimateMeter(0);
    activePowerUpRef.current = null;
    setActivePowerUpType(null);

    if (mode === "campaign") {
      setGameState("act-intro");
      setCurrentActNum(1);
    } else {
      setGameState("playing");
      targetsRef.current = [];
      iceBlocksRef.current = [];
      powerUpsRef.current = [];
      particlesRef.current = [];
      shockwavesRef.current = [];
      floatingTextsRef.current = [];
      loonPosRef.current = { x: 120, y: 180, targetX: 120, targetY: 180 };
    }

    recordEvent("laser_loon_start", "project_click").catch(() => {});
  }, [mode, recordEvent, loadedHighScore]);

  // One title screen per game (#1516): inside a cabinet, the attract screen
  // was the title, so Launch opens the campaign straight on the Act 1
  // newspaper intro. Modes, weapons and the Flag Museum stay in the options
  // disclosure (and M opens the museum); switching mode returns to the start
  // screen, which then works as a mode-change confirmation.
  const skipTitleScreen = useSkipTitleScreen();
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!skipTitleScreen || autoStartedRef.current) return;
    autoStartedRef.current = true;
    if (gameState === "idle") startGame();
  }, [skipTitleScreen, gameState, startGame]);

  // Reset Game
  const resetGame = useCallback(() => {
    setGameState("idle");
    setIsPaused(false);
    scoreRef.current = 0;
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    comboRef.current = 0;
    setMultiplier(1);
    setBossActive(false);
    ultimateMeterRef.current = 0;
    setUltimateMeter(0);
    activePowerUpRef.current = null;
    setActivePowerUpType(null);
    targetsRef.current = [];
    iceBlocksRef.current = [];
    powerUpsRef.current = [];
    particlesRef.current = [];
    shockwavesRef.current = [];
    floatingTextsRef.current = [];
  }, []);

  // Screen reader announcements for major game transitions
  const lastGameStateRef = useRef<string | null>(null);
  const lastBossActiveRef = useRef(false);

  useEffect(() => {
    if (gameState !== lastGameStateRef.current) {
      if (gameState === "playing") {
        announce(
          `Game started. Active weapon is ${WEAPONS[laserType]?.name || laserType}.`,
          "assertive"
        );
      } else if (gameState === "gameover") {
        announce(`Game over. Final score is ${score}.`, "assertive");
      } else if (gameState === "act-victory") {
        announce(`Act ${currentActNum} completed successfully!`, "assertive");
      } else if (gameState === "act-failed") {
        announce(
          `The loon is out of hits. Act ${currentActNum} failed. Press Space to try the act again.`,
          "assertive"
        );
      } else if (gameState === "campaign-victory") {
        announce(
          "Campaign victory! You successfully completed all acts.",
          "assertive"
        );
      }
      lastGameStateRef.current = gameState;
    }
  }, [gameState, laserType, score, currentActNum, announce]);

  useEffect(() => {
    if (bossActive && !lastBossActiveRef.current) {
      announce(`Warning: Boss ${bossName} has spawned!`, "assertive");
      lastBossActiveRef.current = true;
    } else if (!bossActive) {
      lastBossActiveRef.current = false;
    }
  }, [bossActive, bossName, announce]);

  // Active Power-Up timer
  useEffect(() => {
    if (!activePowerUpType || isHalted) return;
    const interval = setInterval(() => {
      if (activePowerUpRef.current) {
        const remaining = activePowerUpRef.current.expiresAt - Date.now();
        if (remaining <= 0) {
          activePowerUpRef.current = null;
          setActivePowerUpType(null);
          setActivePowerUpTimeMs(0);
        } else {
          setActivePowerUpTimeMs(remaining);
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [activePowerUpType, isHalted]);

  // Weapon fire trigger
  const fireWeapon = useCallback(() => {
    if (isHalted) return;
    const now = performance.now();
    const hasHotdish = activePowerUpRef.current?.type === "hotdish";
    const weapon = WEAPONS[laserType] || WEAPONS["ruby-laser"];
    const fireInterval = hasHotdish ? 40 : weapon.fireIntervalMs;

    if (now - lastFireTimeRef.current < fireInterval) return;
    lastFireTimeRef.current = now;
    tutorialSignal(TUTORIAL.fire);

    playLaserSound(laserType);

    const loon = loonPosRef.current;
    const eyeX = loon.x + 32;
    const eyeY = loon.y - 12;
    const beakX = loon.x + 48;
    const beakY = loon.y - 8;
    if (keyboardAimRef.current) {
      aimPosRef.current = pickKeyboardAim(targetsRef.current, eyeX, eyeY);
    }
    const aim = aimPosRef.current;

    if (laserType === "ice-cannon") {
      launchIceBlock(beakX, beakY, aim.x, aim.y);
      return;
    }

    // Raycast hit check
    const hitResult = checkLaserRayHit(
      eyeX,
      eyeY,
      aim.x,
      aim.y,
      laserType,
      targetsRef.current,
      hasHotdish
    );
    targetsRef.current = hitResult.updatedTargets;

    if (hitResult.ultimateGained > 0) {
      addUltimateMeter(hitResult.ultimateGained);
    }

    hitResult.damagedPoints.forEach((pt) => {
      spawnExplosion(pt.x, pt.y, pt.color, 4);
    });
    showCounterHits(hitResult.damagedPoints);

    // Update active boss HP if present
    const activeBoss = targetsRef.current.find((t) => t.isBoss);
    if (activeBoss) {
      setBossHp(activeBoss.hp);
    }

    if (hitResult.killedTargets.length > 0) {
      const hasKilledBoss = hitResult.killedTargets.some((t) => t.isBoss);
      playExplodeSound(hasKilledBoss);
      fx.shake(hasKilledBoss ? 12 : 6);
      if (hasKilledBoss) {
        fx.hitStop(140);
        fx.flash("#fef3c7");
      }

      hitResult.killedTargets.forEach((t) => {
        spawnExplosion(t.x, t.y, t.color, t.isBoss ? 50 : 24, false, t.isBoss);
        const pts = awardComboKill(t, now);
        addFloatingText(t.x, t.y, `+${pts}`, t.color);
        recordCampaignKill(t);
      });
    } else if (hitResult.hitAny) {
      fx.shake(2);
    }
  }, [
    fx,
    laserType,
    playLaserSound,
    playExplodeSound,
    spawnExplosion,
    addFloatingText,
    launchIceBlock,
    addUltimateMeter,
    awardComboKill,
    recordCampaignKill,
    showCounterHits,
    isHalted,
    tutorialSignal,
  ]);

  // A lost 2D context stops the loop until the browser restores it.
  const [isContextLost, setIsContextLost] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!isMounted || !canvas) return;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setIsContextLost(true);
    };
    const handleContextRestored = () => setIsContextLost(false);
    canvas.addEventListener("contextlost", handleContextLost);
    canvas.addEventListener("contextrestored", handleContextRestored);
    return () => {
      canvas.removeEventListener("contextlost", handleContextLost);
      canvas.removeEventListener("contextrestored", handleContextRestored);
    };
  }, [isMounted]);

  const backdropTheme =
    mode === "campaign"
      ? (CAMPAIGN_ACTS.find((a) => a.actNumber === currentActNum)
          ?.backgroundTheme ?? "lake")
      : mode === "arcade"
        ? (CAMPAIGN_ACTS[survivalWave.rosterAct - 1]?.backgroundTheme ?? "lake")
        : "lake";

  // Main Canvas Render & Physics Loop. Frame deltas are clamped to 32 ms, as
  // the hand-rolled loop did, and normalised to 60 fps steps.
  useAnimationFrame(
    (deltaMs) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      // Hit stop holds the last frame for a beat after a boss falls.
      if (fx.isHitStopped()) return;
      // The backdrop parallax and boss hit flash run on wall-clock time.
      const time = performance.now();
      const dt = deltaMs / 16.666;
      // Acts are timed in game time, so a pause or a slow frame never
      // counts against par (#1940).
      if (gameState === "playing" && mode === "campaign") {
        actPlayMsRef.current += deltaMs;
      }
      // Arcade Survival ramps on the same game clock (#2141).
      let wave = getSurvivalWave(survivalMsRef.current / 1000);
      if (gameState === "playing" && mode === "arcade") {
        survivalMsRef.current += deltaMs;
        const seconds = Math.floor(survivalMsRef.current / 1000);
        const next = getSurvivalWave(seconds);
        if (seconds !== survivalSecsRef.current) {
          survivalSecsRef.current = seconds;
          setSurvivalSecs(seconds);
        }
        if (next.wave !== wave.wave) {
          addFloatingText(
            DEFAULT_CANVAS_WIDTH * 0.5,
            80,
            `WAVE ${next.wave + 1}: ${next.label.toUpperCase()}`,
            "#f59e0b"
          );
          announce(
            `Wave ${next.wave + 1}: ${next.label}.${next.fireLevel > 0 ? " Enemies shoot back." : ""}`,
            "polite"
          );
        }
        wave = next;
      }

      const width = DEFAULT_CANVAS_WIDTH;
      const height = DEFAULT_CANVAS_HEIGHT;
      const scale = canvasScaleRef.current;
      applyCanvasScale(ctx, scale);

      ctx.save();

      // 1. Act backdrop: sky plus three parallax layers (#1597). Shake moves
      // the stage element (useArcadeFx), so the canvas never offsets.
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, width, height);
      drawActBackdrop(ctx, backdropTheme, width, height, time, {
        scale,
        animate: !prefersReducedMotion,
      });

      // 2. Loon Position Smooth Lerp
      const loon = loonPosRef.current;
      if (!isDraggingLoonRef.current) {
        loon.x += (loon.targetX - loon.x) * 0.1 * dt;
        loon.y += (loon.targetY - loon.y) * 0.1 * dt;
      }

      // Continuous firing when mouse is held
      if (
        isFiringRef.current &&
        (gameState === "playing" || mode === "sandbox")
      ) {
        fireWeapon();
      }

      // 3. Spawning targets in playing mode
      if (gameState === "playing") {
        if (mode === "campaign") {
          const act = CAMPAIGN_ACTS.find((a) => a.actNumber === currentActNum);
          const reqKills = act ? act.requiredMinionKills : 8;

          if (actKillsRef.current >= reqKills && !bossSpawnedRef.current) {
            triggerBossEncounter(width, height);
          } else if (bossSpawnedRef.current) {
            // A thin trickle of minions keeps the boss fight busy.
            const boss = targetsRef.current.find((t) => t.isBoss);
            const minions = targetsRef.current.filter(
              (t) => !t.isBoss && !t.isProjectile
            ).length;
            const cap = (boss?.bossPhase ?? 1) >= 2 ? 3 : 2;
            if (
              boss &&
              minions < cap &&
              Math.random() < BOSS_MINION_SPAWN_RATE * dt
            ) {
              spawnTarget(width, height);
            }
          } else if (
            !bossSpawnedRef.current &&
            targetsRef.current.length < 5 &&
            Math.random() < 0.032 * dt
          ) {
            spawnTarget(width, height);
          }
        } else {
          // Arcade Survival ramps its crowd and rotates the act rosters;
          // sandbox keeps a steady crowd.
          const arcade = mode === "arcade";
          const maxTargets = arcade ? wave.maxTargets : 8;
          const chance = arcade ? wave.spawnChance : 0.035;
          if (
            targetsRef.current.filter((t) => !t.isProjectile).length <
              maxTargets &&
            Math.random() < chance * dt
          ) {
            spawnTarget(width, height, arcade ? wave.rosterAct : undefined);
          }
        }

        // Random power-up spawns (Hotdish, Pronto Pup, North Star)
        if (powerUpsRef.current.length < 2 && Math.random() < 0.005 * dt) {
          spawnRandomPowerUp(width, height);
        }
      }

      // 4. Update Power-Ups & Player Pickup Collisions
      const powerResult = engineUpdatePowerUps(
        powerUpsRef.current,
        dt,
        loon.x,
        loon.y,
        32
      );
      powerUpsRef.current = powerResult.remainingPowerUps;

      if (powerResult.collectedPowerUp) {
        const p = powerResult.collectedPowerUp;
        activePowerUpRef.current = {
          type: p.type,
          expiresAt: Date.now() + p.durationMs,
        };
        setActivePowerUpType(p.type);
        setActivePowerUpTimeMs(p.durationMs);
        playPowerUpSound();
        addFloatingText(loon.x, loon.y - 25, `POWER UP: ${p.label}!`, p.color);
        spawnExplosion(p.x, p.y, p.color, 20, false, true);
        addUltimateMeter(15);
      }

      // Enemy contact costs the loon a hit in campaign and survival play
      if (gameState === "playing" && mode !== "sandbox") {
        const now = Date.now();
        const contact = resolveLoonCollision({
          targets: targetsRef.current,
          loonX: loon.x,
          loonY: loon.y,
          hitsLeft: hitsLeftRef.current,
          invulnerableUntil: invulnerableUntilRef.current,
          now,
          shielded:
            activePowerUpRef.current?.type === "pronto-pup" &&
            activePowerUpRef.current.expiresAt > now,
        });
        targetsRef.current = contact.targets;

        if (contact.outcome === "blocked" && contact.contact) {
          spawnExplosion(contact.contact.x, contact.contact.y, "#eab308", 16);
          addFloatingText(loon.x, loon.y - 40, "SHIELD BLOCKED!", "#facc15");
        } else if (contact.outcome === "hit") {
          hitsLeftRef.current = contact.hitsLeft;
          invulnerableUntilRef.current = contact.invulnerableUntil;
          setHitsLeft(contact.hitsLeft);
          playLoonHitSound();
          fx.shake(10);
          fx.flash("#f43f5e");
          if (contact.contact) {
            spawnExplosion(contact.contact.x, contact.contact.y, "#f43f5e", 18);
          }
          if (contact.hitsLeft <= 0) {
            isFiringRef.current = false;
            if (mode === "arcade") {
              setGameState("gameover");
              recordEvent("laser_loon_complete", "project_click").catch(
                () => {}
              );
            } else {
              setGameState("act-failed");
            }
          } else {
            addFloatingText(
              loon.x,
              loon.y - 40,
              `OUCH! ${contact.hitsLeft} ${contact.hitsLeft === 1 ? "HIT" : "HITS"} LEFT`,
              "#f43f5e"
            );
          }
        }
      }

      // Render Floating Power-Ups
      powerUpsRef.current.forEach((p) => {
        ctx.save();
        ctx.translate(p.x, p.y);
        const bob = Math.sin(p.pulsePhase) * 4;

        const glow = ctx.createRadialGradient(0, bob, 2, 0, bob, 22);
        glow.addColorStop(0, p.color + "99");
        glow.addColorStop(1, p.color + "00");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, bob, 22, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#18181b";
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, bob, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const icon = POWER_UP_CONFIGS[p.type]?.iconText || "⭐";
        ctx.fillText(icon, 0, bob);

        ctx.restore();
      });

      // 5. Update & Render Ice Blocks and Collisions
      const iceResult = updateIceBlocksAndCollisions(
        iceBlocksRef.current,
        targetsRef.current,
        dt,
        mode,
        gravity,
        width,
        height
      );
      iceBlocksRef.current = iceResult.updatedIceBlocks;
      targetsRef.current = iceResult.updatedTargets;

      // Handle ice shatter events
      iceResult.shatteredBlocks.forEach((pt) => {
        playIceShatterSound();
        spawnExplosion(pt.x, pt.y, "#38bdf8", 18, true);
        fx.shake(4);
      });

      iceResult.frozenTargets.forEach((t) => {
        addFloatingText(t.x, t.y, "CRYO-FROZEN!", "#38bdf8");
      });
      killHandlersRef.current.showCounterHits(iceResult.hitPoints);

      if (iceResult.killedTargets.length > 0) {
        addUltimateMeter(3);
      }

      // Mortar kills score and count like laser kills.
      const iceNow = performance.now();
      iceResult.killedTargets.forEach((t) => {
        spawnExplosion(t.x, t.y, "#38bdf8", 28, true);
        const pts = killHandlersRef.current.awardComboKill(t, iceNow);
        addFloatingText(t.x, t.y, `SHATTERED! +${pts}`, "#38bdf8");
        killHandlersRef.current.recordCampaignKill(t);
      });

      const frozenBoss = iceResult.frozenTargets.find((t) => t.isBoss);
      if (frozenBoss && frozenBoss.hp > 0) setBossHp(frozenBoss.hp);

      // Render Active Ice Blocks
      iceBlocksRef.current.forEach((block) => {
        ctx.save();
        ctx.translate(block.x, block.y);
        ctx.rotate(block.rotation);

        const s = block.size;
        const half = s / 2;

        const iceGlow = ctx.createRadialGradient(0, 0, 2, 0, 0, s);
        iceGlow.addColorStop(0, "rgba(56, 189, 248, 0.7)");
        iceGlow.addColorStop(0.6, "rgba(56, 189, 248, 0.2)");
        iceGlow.addColorStop(1, "rgba(56, 189, 248, 0)");
        ctx.fillStyle = iceGlow;
        ctx.beginPath();
        ctx.arc(0, 0, s, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(186, 230, 253, 0.85)";
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-half, -half, s, s, 4);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-half + 3, -half + 3);
        ctx.lineTo(half - 6, -half + 3);
        ctx.moveTo(-half + 3, -half + 3);
        ctx.lineTo(-half + 3, half - 6);
        ctx.stroke();

        ctx.fillStyle = "#0284c7";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("❄️", 0, 0);

        ctx.restore();
      });

      // Boss volleys, telegraphed by a wind-up ring, can cost the loon a hit
      if (gameState === "playing" && mode === "campaign") {
        const attack = updateBossAttack(
          targetsRef.current,
          dt,
          loon.x,
          loon.y,
          currentActNum,
          nextTargetIdRef.current
        );
        targetsRef.current = attack.targets;
        nextTargetIdRef.current = attack.nextId;
        if (attack.enteredPhaseTwo) {
          const boss = attack.targets.find((t) => t.isBoss);
          if (boss) {
            addFloatingText(boss.x, boss.y - 70, "BOSS ENRAGED!", "#f59e0b");
          }
        }
        if (attack.fired) playLaserSound("ruby-laser");
      }

      // From Act 3, and from survival's second wave, minions shoot back
      // (#1940, #2141).
      if (gameState === "playing" && mode !== "sandbox") {
        const minionFire = updateMinionFire(
          targetsRef.current,
          dt,
          loon.x,
          loon.y,
          mode === "arcade" ? wave.fireLevel : currentActNum,
          nextTargetIdRef.current
        );
        targetsRef.current = minionFire.targets;
        nextTargetIdRef.current = minionFire.nextId;
        if (minionFire.fired > 0) playLaserSound("cyan-pulse");
      }

      // 6. Update & Render Targets / Enemies / Bosses
      targetsRef.current = updateTargetsPosition(
        targetsRef.current,
        dt,
        mode,
        gravity,
        height,
        width
      );

      targetsRef.current.forEach((t) => {
        ctx.save();
        const pulse = Math.sin(t.pulsePhase) * 3;
        // Shape-coded silhouette sized to the hit radius (#1597).
        drawEnemySilhouette(ctx, t);

        // A boss flashes white for a moment whenever it loses HP (#1598).
        if (t.isBoss) {
          if (t.hp < lastBossHpRef.current) {
            bossHitFlashUntilRef.current = time + 90;
          }
          lastBossHpRef.current = t.hp;
          if (time < bossHitFlashUntilRef.current) {
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = "#ffffff";
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.radius * 0.9, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.8;
            ctx.stroke();
            ctx.restore();
          }
        }

        // Wind-up ring before a boss volley
        if (t.isBoss && isBossTelegraphing(t, currentActNum)) {
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.radius + 26 + pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // The Starflake's shield is a solid arc the beam cannot pass (#2144);
        // the other bosses keep their decorative orbiting nodes.
        if (t.isBoss && getBossSignature(t.type) === "burst") {
          const arcR = t.radius + 16;
          const a = t.shieldAngle ?? 0;
          ctx.strokeStyle = "#e0f2fe";
          ctx.lineWidth = 6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.arc(
            t.x,
            t.y,
            arcR,
            a - STARFLAKE_SHIELD_HALF_ARC,
            a + STARFLAKE_SHIELD_HALF_ARC
          );
          ctx.stroke();
          ctx.lineCap = "butt";
        } else if (t.isBoss && t.shieldAngle !== undefined) {
          const numNodes = 6;
          for (let i = 0; i < numNodes; i++) {
            const nodeAngle = t.shieldAngle + (i * Math.PI * 2) / numNodes;
            const nodeX = t.x + Math.cos(nodeAngle) * (t.radius + 16);
            const nodeY = t.y + Math.sin(nodeAngle) * (t.radius + 16);

            ctx.fillStyle = t.color;
            ctx.beginPath();
            ctx.arc(nodeX, nodeY, 4.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Frozen ice box overlay
        if (t.frozenTimer > 0) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(
            t.x - t.radius - 2,
            t.y - t.radius - 2,
            (t.radius + 2) * 2,
            (t.radius + 2) * 2
          );
        }

        // Mini HP ring for multi-hit targets
        if (t.maxHp > 1) {
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = t.isBoss ? 4 : 3;
          ctx.beginPath();
          const hpPct = Math.max(0, t.hp / t.maxHp);
          ctx.arc(
            t.x,
            t.y,
            t.radius + (t.isBoss ? 6 : 3),
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * hpPct
          );
          ctx.stroke();
        }

        // Enemies read by shape alone; the boss's name is on the docked
        // plate above the arena (#1598).

        ctx.restore();
      });

      // 7. Render Shockwaves (Ultimate Haunting Loon Tremolo)
      shockwavesRef.current = updateShockwaves(shockwavesRef.current, dt);
      shockwavesRef.current.forEach((s) => {
        ctx.save();
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = s.alpha;
        ctx.lineWidth = 6;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });

      // 8. Laser Aim Reticle & Active Laser Beams
      const eyeX = loon.x + 32;
      const eyeY = loon.y - 12;
      const aim = aimPosRef.current;
      const hasHotdish = activePowerUpRef.current?.type === "hotdish";

      ctx.strokeStyle =
        laserType === "ice-cannon"
          ? "rgba(56, 189, 248, 0.4)"
          : "rgba(239, 68, 68, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(eyeX, eyeY);
      ctx.lineTo(aim.x, aim.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = hasHotdish
        ? "#f59e0b"
        : laserType === "ice-cannon"
          ? "#38bdf8"
          : "#ef4444";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(aim.x, aim.y, 8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(aim.x - 12, aim.y);
      ctx.lineTo(aim.x + 12, aim.y);
      ctx.moveTo(aim.x, aim.y - 12);
      ctx.lineTo(aim.x, aim.y + 12);
      ctx.stroke();

      if (isFiringRef.current && laserType !== "ice-cannon") {
        ctx.save();
        if (laserType === "ruby-laser") {
          // Iconic F277 Red Eye Laser
          ctx.strokeStyle = "#ef4444";
          ctx.shadowColor = "#f43f5e";
          ctx.shadowBlur = hasHotdish ? 24 : 16;
          ctx.lineWidth = hasHotdish ? 7 : 4.5;
          ctx.beginPath();
          ctx.moveTo(eyeX, eyeY);
          ctx.lineTo(aim.x, aim.y);
          ctx.stroke();

          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (laserType === "cyan-pulse") {
          ctx.strokeStyle = "#22d3ee";
          ctx.shadowColor = "#06b6d4";
          ctx.shadowBlur = 12;
          ctx.lineWidth = hasHotdish ? 6 : 3.5;
          ctx.beginPath();
          ctx.moveTo(eyeX, eyeY);
          ctx.lineTo(aim.x, aim.y);
          ctx.stroke();

          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (laserType === "aurora-wave") {
          // Aurora Borealis Multi-spectral Wave
          const grad = ctx.createLinearGradient(eyeX, eyeY, aim.x, aim.y);
          grad.addColorStop(0, "#10b981");
          grad.addColorStop(0.33, "#06b6d4");
          grad.addColorStop(0.66, "#a855f7");
          grad.addColorStop(1, "#f43f5e");

          ctx.strokeStyle = grad;
          ctx.shadowColor = "#34d399";
          ctx.shadowBlur = 18;
          ctx.lineWidth = hasHotdish ? 10 : 7;
          ctx.beginPath();
          ctx.moveTo(eyeX, eyeY);
          ctx.lineTo(aim.x, aim.y);
          ctx.stroke();

          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();
      }

      // 9. Render Canadian Laser Loon (Submission F277 Spec)
      ctx.save();
      ctx.translate(loon.x, loon.y);

      // Blink after a hit; hold a steady fade when motion is reduced
      const blinkMsLeft = invulnerableUntilRef.current - Date.now();
      if (blinkMsLeft > 0) {
        ctx.globalAlpha = !screenShakeEnabled
          ? 0.5
          : Math.floor(blinkMsLeft / 120) % 2 === 0
            ? 0.25
            : 0.9;
      }

      // Invulnerability shield bubble (Pronto Pup power-up)
      if (activePowerUpRef.current?.type === "pronto-pup") {
        ctx.save();
        ctx.strokeStyle = "#eab308";
        ctx.shadowColor = "#facc15";
        ctx.shadowBlur = 16;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(10, 0, 52, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const eyeGlowColor =
        laserType === "ruby-laser"
          ? "#ef4444"
          : laserType === "ice-cannon"
            ? "#38bdf8"
            : "#22d3ee";
      // The loon, eye at (30, -10) where the laser leaves (#1597).
      drawLoon(ctx, eyeGlowColor);

      ctx.restore();

      // 10. Update & Draw Particles
      particlesRef.current = updateParticles(particlesRef.current, dt);
      particlesRef.current.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.shape === "crystal" ? 8 : 4;

        if (p.shape === "crystal") {
          ctx.translate(p.x, p.y);
          if (p.rotation !== undefined) ctx.rotate(p.rotation);
          ctx.fillRect(-p.radius, -p.radius, p.radius * 2, p.radius * 2);
        } else if (p.shape === "star") {
          ctx.translate(p.x, p.y);
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // 11. Update & Draw Floating Texts
      floatingTextsRef.current = updateFloatingTexts(
        floatingTextsRef.current,
        dt
      );
      floatingTextsRef.current.forEach((f) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, f.alpha);
        ctx.fillStyle = f.color;
        ctx.font = gameFont(12, "bold");
        ctx.textAlign = "center";
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 8;
        ctx.fillText(f.text, f.x, f.y);
        ctx.restore();
      });

      ctx.restore();
    },
    {
      isActive: isMounted && !isHalted && !isContextLost,
      maxDeltaMs: 32,
    }
  );

  // Pointer / Mouse / Touch Controls
  const updatePointerAim = (clientX: number, clientY: number) => {
    const { x: mouseX, y: mouseY } = toGameCoordinates(clientX, clientY);

    keyboardAimRef.current = false;
    aimPosRef.current = { x: mouseX, y: mouseY };

    // A finger steers the loon on a touch cabinet, so it counts as flying.
    if (touch || isDraggingLoonRef.current) tutorialSignal(TUTORIAL.move);
    if (isDraggingLoonRef.current) {
      loonPosRef.current.x = mouseX;
      loonPosRef.current.y = mouseY;
      loonPosRef.current.targetX = mouseX;
      loonPosRef.current.targetY = mouseY;
    } else {
      loonPosRef.current.targetY = clamp(mouseY, LOON_MIN_Y, LOON_MAX_Y);
    }
  };

  const lastPointerTimeRef = useRef(0);
  // Touch cabinet: a finger or the Pencil on the arena only aims and steers.
  // Fire is its own key in the dock, so lifting the aiming finger never lets
  // go of a held Fire, and a tap to aim never shoots (#2081). A mouse or a
  // trackpad on the iPad still clicks to shoot, as on desktop.
  const aimPointersRef = useRef<Set<number>>(new Set());
  const lastTouchPointerTimeRef = useRef(0);
  const isAimOnly = (e: React.PointerEvent<HTMLCanvasElement>) =>
    touch && e.pointerType !== "mouse";
  // iOS follows a tap with compatibility mouse events for the same tap.
  const isCompatMouse = () =>
    touch && Date.now() - lastTouchPointerTimeRef.current < 800;

  const handleCanvasPointerDown = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    lastPointerTimeRef.current = Date.now();
    const aimOnly = isAimOnly(e);
    if (aimOnly) {
      aimPointersRef.current.add(e.pointerId);
      lastTouchPointerTimeRef.current = Date.now();
    }
    if (!canvasRef.current) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignored for test environments without setPointerCapture mock
    }
    containerRef.current?.focus({ preventScroll: true });

    updatePointerAim(e.clientX, e.clientY);

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = DEFAULT_CANVAS_WIDTH / (rect.width || 1);
    const scaleY = DEFAULT_CANVAS_HEIGHT / (rect.height || 1);
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const distToLoon = Math.hypot(
      mouseX - loonPosRef.current.x,
      mouseY - loonPosRef.current.y
    );
    if (mode === "sandbox" && distToLoon < 45) {
      isDraggingLoonRef.current = true;
    } else if (!aimOnly) {
      isFiringRef.current = true;
      fireWeapon();
    }
  };

  const handleCanvasPointerMove = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    updatePointerAim(e.clientX, e.clientY);
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
    if (isAimOnly(e)) {
      aimPointersRef.current.delete(e.pointerId);
      lastTouchPointerTimeRef.current = Date.now();
    } else {
      isFiringRef.current = false;
    }
    isDraggingLoonRef.current = false;
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
    if (isAimOnly(e)) {
      aimPointersRef.current.delete(e.pointerId);
    } else {
      isFiringRef.current = false;
    }
    isDraggingLoonRef.current = false;
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (Date.now() - lastPointerTimeRef.current < 100 || isCompatMouse())
      return;
    updatePointerAim(e.clientX, e.clientY);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (Date.now() - lastPointerTimeRef.current < 100 || isCompatMouse())
      return;
    if (!canvasRef.current) return;
    containerRef.current?.focus({ preventScroll: true });

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = DEFAULT_CANVAS_WIDTH / (rect.width || 1);
    const scaleY = DEFAULT_CANVAS_HEIGHT / (rect.height || 1);
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const distToLoon = Math.hypot(
      mouseX - loonPosRef.current.x,
      mouseY - loonPosRef.current.y
    );
    if (mode === "sandbox" && distToLoon < 45) {
      isDraggingLoonRef.current = true;
    } else {
      isFiringRef.current = true;
      fireWeapon();
    }
  };

  const handleCanvasMouseUp = () => {
    if (Date.now() - lastPointerTimeRef.current < 100 || isCompatMouse())
      return;
    isFiringRef.current = false;
    isDraggingLoonRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (Date.now() - lastPointerTimeRef.current < 100) return;
    if (e.touches.length > 0) {
      updatePointerAim(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (Date.now() - lastPointerTimeRef.current < 100) return;
    if (e.touches.length > 0) {
      updatePointerAim(e.touches[0].clientX, e.touches[0].clientY);
      // The touch cabinet aims here; its Fire key shoots (#2081).
      if (!touch) {
        isFiringRef.current = true;
        fireWeapon();
      }
    }
  };

  const handleTouchEnd = () => {
    if (Date.now() - lastPointerTimeRef.current < 100) return;
    if (!touch) isFiringRef.current = false;
    isDraggingLoonRef.current = false;
  };

  // The dock's Fire key. With a finger on the arena the beam goes where that
  // finger aims; with none it takes the same aim assist as Space.
  const handleDockFirePress = () => {
    if (gameState !== "playing" && mode !== "sandbox") return;
    if (aimPointersRef.current.size === 0) keyboardAimRef.current = true;
    isFiringRef.current = true;
    fireWeapon();
  };
  const handleDockFireRelease = () => {
    isFiringRef.current = false;
  };

  const chooseMode = (next: LaserMode) => {
    setMode(next);
    if (next === "sandbox") setGameState("playing");
    else resetGame();
  };

  // The tutorial (#2972) flies in the Sandbox, where nothing hurts the loon
  // and the Tremolo is always full, and returns to the player's mode after.
  const modeBeforeTutorialRef = useRef<LaserMode | null>(null);
  useEffect(() => {
    const before = modeBeforeTutorialRef.current;
    if (tutorial.active === (before !== null)) return;
    resetGame();
    if (tutorial.active) {
      modeBeforeTutorialRef.current = mode;
      loonPosRef.current = { x: 120, y: 180, targetX: 120, targetY: 180 };
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowMenu(false);
      setMode("sandbox");
      setGameState("playing");
    } else {
      modeBeforeTutorialRef.current = null;
      setMode(before ?? "campaign");
      if (before === "sandbox") setGameState("playing");
    }
  }, [tutorial.active, mode, resetGame]);

  // Keyboard Handlers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // The touch menu sheet is a dialog inside the playfield: its keys,
    // Escape included, belong to its own focus trap, not to the game.
    if (showMenu) return;
    // The Flag Museum opened from M moves focus into itself a moment later.
    // A press that lands before then still belongs to it: Escape or M closes
    // the museum, and the cabinet must not take Escape as leaving the game.
    if (showMuseum) {
      if (e.key === "Escape" || e.key.toLowerCase() === "m") {
        e.preventDefault();
        e.stopPropagation();
        setShowMuseum(false);
      }
      return;
    }
    // Space and Enter on a dialog's button (pause menu, result card) activate
    // that button; the playfield's own shortcuts would otherwise swallow them.
    if (
      (e.key === " " || e.key === "Enter") &&
      e.target instanceof HTMLElement &&
      e.target !== e.currentTarget &&
      e.target.closest('[role="dialog"]')
    ) {
      return;
    }
    const interceptKeys = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "PageUp",
      "PageDown",
      "w",
      "a",
      "s",
      "d",
      "W",
      "A",
      "S",
      "D",
      " ",
      "1",
      "2",
      "3",
      "4",
      "u",
      "U",
      "m",
      "M",
      "p",
      "P",
      "Enter",
      "Escape",
    ];

    if (interceptKeys.includes(e.key)) {
      e.preventDefault();
    }

    if (e.key.toLowerCase() === "p") {
      if (gameState === "playing" || isPaused) {
        togglePause();
        return;
      }
    }

    if (isPaused) {
      // Escape is left to the pause dialog's focus trap, which already
      // resumes on it; toggling here too would re-pause at once.
      if (e.key === " " || e.key === "Enter") {
        togglePause();
      }
      return;
    }

    if (e.key === " " || e.key === "Enter") {
      if (
        gameState === "idle" ||
        gameState === "gameover" ||
        gameState === "campaign-victory"
      ) {
        startGame();
      } else if (gameState === "act-failed") {
        retryAct();
      } else if (gameState === "act-intro") {
        startAct(currentActNum);
      } else if (gameState === "act-victory") {
        advanceToNextAct();
      } else {
        keyboardAimRef.current = true;
        isFiringRef.current = true;
        fireWeapon();
      }
    } else if (e.key.toLowerCase() === "u") {
      fireUltimateTremolo();
    } else if (e.key.toLowerCase() === "m") {
      // The museum's trap mounts during this keypress and closes on M, so
      // keep the event from reaching it.
      e.stopPropagation();
      setShowMuseum(true);
    } else if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") {
      tutorialSignal(TUTORIAL.move);
      const nextY = Math.max(LOON_MIN_Y, loonPosRef.current.targetY - 25);
      loonPosRef.current.targetY = nextY;
      announce(
        `Loon moved up. Horizontal position: ${Math.round(loonPosRef.current.targetX)}, vertical position: ${Math.round(nextY)}`,
        "polite"
      );
    } else if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") {
      tutorialSignal(TUTORIAL.move);
      const nextY = Math.min(LOON_MAX_Y, loonPosRef.current.targetY + 25);
      loonPosRef.current.targetY = nextY;
      announce(
        `Loon moved down. Horizontal position: ${Math.round(loonPosRef.current.targetX)}, vertical position: ${Math.round(nextY)}`,
        "polite"
      );
    } else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
      tutorialSignal(TUTORIAL.move);
      const nextX = Math.max(LOON_MIN_X, loonPosRef.current.targetX - 25);
      loonPosRef.current.targetX = nextX;
      announce(
        `Loon moved left. Horizontal position: ${Math.round(nextX)}, vertical position: ${Math.round(loonPosRef.current.targetY)}`,
        "polite"
      );
    } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
      tutorialSignal(TUTORIAL.move);
      const nextX = Math.min(LOON_MAX_X, loonPosRef.current.targetX + 25);
      loonPosRef.current.targetX = nextX;
      announce(
        `Loon moved right. Horizontal position: ${Math.round(nextX)}, vertical position: ${Math.round(loonPosRef.current.targetY)}`,
        "polite"
      );
    } else if (e.key === "1") {
      selectLaserType("ruby-laser");
    } else if (e.key === "2") {
      selectLaserType("cyan-pulse");
    } else if (e.key === "3") {
      selectLaserType("aurora-wave");
    } else if (e.key === "4") {
      selectLaserType("ice-cannon");
    } else if (e.key === "Escape") {
      // Escape pauses; ending the run is left to the Reset button. The
      // pause dialog's trap mounts during this same keypress and listens on
      // window, so keep the event from reaching it and resuming at once.
      if (gameState === "playing") {
        e.stopPropagation();
        setIsPaused(true);
      }
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === " " || e.key === "Enter") {
      isFiringRef.current = false;
    }
  };

  return {
    isMounted,
    actBests,
    runStars,
    mode,
    laserType,
    gameState,
    currentActNum,
    actKills,
    runKills,
    hitsLeft,
    bossActive,
    bossHp,
    bossMaxHp,
    bossName,
    score,
    effectiveHighScore,
    combo,
    maxCombo,
    runStartBest,
    actResult,
    multiplier,
    survivalSecs,
    ultimateMeter,
    activePowerUpType,
    activePowerUpTimeMs,
    isFocused,
    setIsFocused,
    screenShakeEnabled,
    setScreenShakeEnabled,
    fxStageRef,
    fxFlashRef,
    soundEnabled,
    setSoundEnabled,
    gravity,
    setGravity,
    showMuseum,
    setShowMuseum,
    selectedFlagIndex,
    setSelectedFlagIndex,
    isPaused,
    setIsPaused,
    setIsManualOpen,
    showMenu,
    setShowMenu,
    touch,
    keyTag,
    survivalWave,
    announce,
    togglePause,
    museumTrapRef,
    containerRef,
    canvasRef,
    isFullscreen,
    toggleFullscreen,
    selectLaserType,
    loonPosRef,
    aimPosRef,
    isFiringRef,
    currentAct,
    launchIceBlock,
    spawnTarget,
    triggerBossEncounter,
    fireUltimateTremolo,
    startAct,
    retryAct,
    advanceToNextAct,
    startGame,
    resetGame,
    fireWeapon,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
    handleCanvasPointerCancel,
    handleCanvasMouseMove,
    handleCanvasMouseDown,
    handleCanvasMouseUp,
    handleTouchMove,
    handleTouchStart,
    handleTouchEnd,
    handleDockFirePress,
    handleDockFireRelease,
    chooseMode,
    handleKeyDown,
    handleKeyUp,
  };
}
