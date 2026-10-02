"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useSyncExternalStore,
  useCallback,
} from "react";
import { useAudio } from "@/components/providers/AudioProvider";
import { getSoundEngine } from "@/lib/audio/sound-engine";
import {
  getMatchMediaMatches,
  usePrefersReducedMotion,
} from "@/hooks/useMediaQuery";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import { useTelemetry } from "@/hooks/useTelemetry";
import { clamp } from "@/lib/game-utils";
import {
  IconFlame,
  IconRefresh,
  IconPlayerPlay,
  IconPlayerPause,
  IconSnowflake,
  IconSparkles,
  IconBook,
  IconX,
  IconVolume,
  IconVolumeOff,
  IconChevronRight,
  IconTarget,
  IconHeart,
} from "@tabler/icons-react";
import { FieldManualButton } from "@/components/FieldManualButton";
import { recordArcadeScore } from "@/lib/arcade-achievements";
import { FullscreenButton } from "@/components/arcade/FullscreenButton";
import { DynamicTabletOrientationHint as TabletOrientationHint } from "@/components/arcade/DynamicTabletOrientationHint";
import { useGameFullscreen as useFullscreen } from "@/components/arcade/CabinetFullscreen";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import { useResponsiveCanvas } from "@/hooks/useResponsiveCanvas";
import { useCanvasResolution } from "@/hooks/useCanvasResolution";
import { applyCanvasScale } from "@/lib/arcade";
import { TwinStickAimDock } from "@/components/arcade/ControlDocks";
import {
  drawActBackdrop,
  drawEnemySilhouette,
  drawLoon,
} from "@/components/laser-loon/scene-art";
import { PauseMenu } from "@/components/laser-loon/PauseMenu";
import { ArcadeHud } from "@/components/arcade/ArcadeHud";
import { ResultCard } from "@/components/arcade/ResultCard";
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
  createInitialState,
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
  FLAG_MUSEUM,
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
  isBossTelegraphing,
  BOSS_MINION_SPAWN_RATE,
} from "@/lib/laser-loon";

const emptySubscribe = () => () => {};

const subscribeHighScore = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};
const getHighScoreSnapshot = () => {
  try {
    return safeGetRawItem("laser_loon_high_score") || "0";
  } catch {
    return "0";
  }
};
const getHighScoreServerSnapshot = () => "0";

export const LaserLoon: React.FC = () => {
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
  const loadedHighScore = parseInt(rawHighScore, 10) || 0;
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
  const [hitsLeft, setHitsLeft] = useState(LOON_MAX_HITS);
  const [bossActive, setBossActive] = useState(false);
  const [bossHp, setBossHp] = useState(100);
  const [bossMaxHp, setBossMaxHp] = useState(100);
  const [bossName, setBossName] = useState("");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const effectiveHighScore = Math.max(highScore, loadedHighScore);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  // The best score before this run, for the result card's best-score line.
  const [runStartBest, setRunStartBest] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [timeLeft, setTimeLeft] = useState(45);
  const [ultimateMeter, setUltimateMeter] = useState(0);
  const [activePowerUpType, setActivePowerUpType] =
    useState<PowerUpType | null>(null);
  const [activePowerUpTimeMs, setActivePowerUpTimeMs] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [screenShakeEnabled, setScreenShakeEnabled] = useState<boolean>(() => {
    return !getMatchMediaMatches("(prefers-reduced-motion: reduce)");
  });
  const fx = useArcadeFx({ enabled: screenShakeEnabled });
  const { stageRef: fxStageRef, flashRef: fxFlashRef } = fx;
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [gravity, setGravity] = useState<number>(0.15); // for sandbox mode
  const [showMuseum, setShowMuseum] = useState(false);
  const [selectedFlagIndex, setSelectedFlagIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  // The simulation also stops behind the Flag Museum and the Field Manual,
  // so reading them never costs a run.
  const isHalted = isPaused || showMuseum || isManualOpen;

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
  const hitsLeftRef = useRef(LOON_MAX_HITS);
  const invulnerableUntilRef = useRef(0);
  const bossSpawnedRef = useRef(false);
  const activePowerUpRef = useRef<{
    type: PowerUpType;
    expiresAt: number;
  } | null>(null);
  const ultimateMeterRef = useRef(0);

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
  const bestScoreRef = useRef(0);
  const addScore = useCallback(
    (pts: number) => {
      const next = scoreRef.current + pts;
      scoreRef.current = next;
      setScore(next);
      if (next > Math.max(bestScoreRef.current, loadedHighScore)) {
        bestScoreRef.current = next;
        setHighScore(next);
        safeSetRawItem("laser_loon_high_score", next.toString());
        recordArcadeScore("laser-loon", next);
      }
    },
    [loadedHighScore]
  );

  const addUltimateMeter = useCallback((amount: number) => {
    const nextVal = Math.min(100, ultimateMeterRef.current + amount);
    ultimateMeterRef.current = nextVal;
    setUltimateMeter(nextVal);
  }, []);

  // Spawner callback
  const spawnTarget = useCallback(
    (width: number, height: number) => {
      const { updatedTargets, nextId } = engineSpawnTarget(
        targetsRef.current,
        nextTargetIdRef.current,
        width,
        height,
        undefined,
        currentActNum
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
      if (outcome === "campaign-victory") {
        setGameState("campaign-victory");
        playSuccess();
        recordEvent("laser_loon_victory", "project_click").catch(() => {});
      } else {
        setGameState("act-victory");
        playSuccess();
      }
    },
    [mode, currentActNum, playSuccess, recordEvent]
  );

  // The render loop reads the latest handlers through a ref rather than
  // restarting whenever the act or mode changes.
  const killHandlersRef = useRef({ awardComboKill, recordCampaignKill });
  useEffect(() => {
    killHandlersRef.current = { awardComboKill, recordCampaignKill };
  }, [awardComboKill, recordCampaignKill]);

  // Trigger Ultimate Move
  const fireUltimateTremolo = useCallback(() => {
    if (ultimateMeterRef.current < 100 && mode !== "sandbox") return;

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
  ]);

  // Start campaign act
  const startAct = useCallback((actNum: number) => {
    setCurrentActNum(actNum);
    setActKills(0);
    actKillsRef.current = 0;
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

  // Start game session
  const startGame = useCallback(() => {
    const fresh = createInitialState(mode);
    setRunStartBest(Math.max(bestScoreRef.current, loadedHighScore));
    scoreRef.current = 0;
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    comboRef.current = 0;
    setMultiplier(1);
    setTimeLeft(fresh.timeLeft);
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
    }

    recordEvent("laser_loon_start", "project_click").catch(() => {});
  }, [mode, recordEvent, loadedHighScore]);

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

  // Countdown timer for arcade mode
  useEffect(() => {
    if (gameState !== "playing" || mode !== "arcade" || isHalted) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, mode, isHalted]);

  // Handle countdown expiration outside functional state updater
  useEffect(() => {
    if (gameState === "playing" && mode === "arcade" && timeLeft === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGameState("gameover");
      playSuccess();
      recordEvent("laser_loon_complete", "project_click").catch(() => {});
    }
  }, [gameState, mode, timeLeft, playSuccess, recordEvent]);

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

    playLaserSound(laserType);

    const loon = loonPosRef.current;
    const eyeX = loon.x + 32;
    const eyeY = loon.y - 12;
    const beakX = loon.x + 48;
    const beakY = loon.y - 8;
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
    isHalted,
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

  const prefersReducedMotion = usePrefersReducedMotion();
  const backdropTheme =
    mode === "campaign"
      ? (CAMPAIGN_ACTS.find((a) => a.actNumber === currentActNum)
          ?.backgroundTheme ?? "lake")
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
          // Arcade & sandbox spawning
          const maxTargets = mode === "arcade" ? 6 : 8;
          if (
            targetsRef.current.length < maxTargets &&
            Math.random() < 0.035 * dt
          ) {
            spawnTarget(width, height);
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

      // Enemy contact costs the loon a hit in campaign play
      if (gameState === "playing" && mode === "campaign") {
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
            setGameState("act-failed");
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

        // Boss rotating energy shields
        if (t.isBoss && t.shieldAngle !== undefined) {
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
        ctx.font = "bold 12px monospace";
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

    aimPosRef.current = { x: mouseX, y: mouseY };

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

  const handleCanvasPointerDown = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    lastPointerTimeRef.current = Date.now();
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
    } else {
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
    isFiringRef.current = false;
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
    isFiringRef.current = false;
    isDraggingLoonRef.current = false;
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (Date.now() - lastPointerTimeRef.current < 100) return;
    updatePointerAim(e.clientX, e.clientY);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (Date.now() - lastPointerTimeRef.current < 100) return;
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
    if (Date.now() - lastPointerTimeRef.current < 100) return;
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
      isFiringRef.current = true;
      fireWeapon();
    }
  };

  const handleTouchEnd = () => {
    if (Date.now() - lastPointerTimeRef.current < 100) return;
    isFiringRef.current = false;
    isDraggingLoonRef.current = false;
  };

  // Keyboard Handlers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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
      } else if (gameState === "act-intro" || gameState === "act-failed") {
        startAct(currentActNum);
      } else if (gameState === "act-victory") {
        setCurrentActNum((prev) => prev + 1);
        setGameState("act-intro");
      } else {
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
      const nextY = Math.max(LOON_MIN_Y, loonPosRef.current.targetY - 25);
      loonPosRef.current.targetY = nextY;
      announce(
        `Loon moved up. Horizontal position: ${Math.round(loonPosRef.current.targetX)}, vertical position: ${Math.round(nextY)}`,
        "polite"
      );
    } else if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") {
      const nextY = Math.min(LOON_MAX_Y, loonPosRef.current.targetY + 25);
      loonPosRef.current.targetY = nextY;
      announce(
        `Loon moved down. Horizontal position: ${Math.round(loonPosRef.current.targetX)}, vertical position: ${Math.round(nextY)}`,
        "polite"
      );
    } else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
      const nextX = Math.max(LOON_MIN_X, loonPosRef.current.targetX - 25);
      loonPosRef.current.targetX = nextX;
      announce(
        `Loon moved left. Horizontal position: ${Math.round(nextX)}, vertical position: ${Math.round(loonPosRef.current.targetY)}`,
        "polite"
      );
    } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
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

  if (!isMounted) {
    return (
      <div className="w-full h-[460px] bg-neutral-950 border border-neutral-800 rounded-3xl flex flex-col items-center justify-center p-6 text-center font-mono select-none">
        <div className="text-red-400 text-sm font-bold animate-pulse mb-2">
          [INITIALIZING LASER LOON CRYO ENGINE...]
        </div>
        <p className="text-xs text-neutral-500 max-w-sm">
          Loading submission F277 specs, retro audio synthesizer, and Minnesota
          State Flag campaign lore.
        </p>
      </div>
    );
  }

  return (
    <div className="arcade-shooter w-full min-w-0 flex flex-col items-center select-none my-3">
      {/* Tablet Orientation Recommendation */}
      <TabletOrientationHint className="w-full max-w-3xl" />

      <details className="arcade-shooter-options w-full max-w-3xl">
        <summary className="min-h-12 p-3 cursor-pointer font-mono text-xs text-zinc-300">
          Game modes, weapons & audio
        </summary>
        {/* HUD Header Bar & Mode Selector */}
        <div className="w-full max-w-3xl flex flex-wrap items-center justify-between gap-3 mb-3 px-2">
          {/* Mode Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-neutral-900/80 border border-neutral-800 rounded-xl backdrop-blur-md">
            <button
              onClick={() => {
                setMode("campaign");
                resetGame();
              }}
              className={`min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer touch-manipulation select-none active:scale-[0.98] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none ${
                mode === "campaign"
                  ? "bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              🏆 Campaign
            </button>
            <button
              onClick={() => {
                setMode("arcade");
                resetGame();
              }}
              className={`min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer touch-manipulation select-none active:scale-[0.98] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none ${
                mode === "arcade"
                  ? "bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              ⚡ Arcade Survival
            </button>
            <button
              onClick={() => {
                setMode("sandbox");
                setGameState("playing");
              }}
              className={`min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer touch-manipulation select-none active:scale-[0.98] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none ${
                mode === "sandbox"
                  ? "bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              🧪 Zero-G Sandbox
            </button>
          </div>

          {/* Laser Weapon Selector */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-neutral-900/80 border border-neutral-800 rounded-xl backdrop-blur-md">
            <button
              onClick={() => selectLaserType("ruby-laser")}
              aria-pressed={laserType === "ruby-laser"}
              className={`min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer touch-manipulation select-none active:scale-[0.98] flex items-center justify-center gap-1 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none ${
                laserType === "ruby-laser"
                  ? "bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                  : "text-neutral-400 hover:text-white border border-transparent"
              }`}
            >
              Ruby (1)
            </button>
            <button
              onClick={() => selectLaserType("cyan-pulse")}
              aria-pressed={laserType === "cyan-pulse"}
              className={`min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer touch-manipulation select-none active:scale-[0.98] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                laserType === "cyan-pulse"
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                  : "text-neutral-400 hover:text-white border border-transparent"
              }`}
            >
              Pulse (2)
            </button>
            <button
              onClick={() => selectLaserType("aurora-wave")}
              aria-pressed={laserType === "aurora-wave"}
              className={`min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer touch-manipulation select-none active:scale-[0.98] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none ${
                laserType === "aurora-wave"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "text-neutral-400 hover:text-white border border-transparent"
              }`}
            >
              Aurora (3)
            </button>
            <button
              onClick={() => selectLaserType("ice-cannon")}
              aria-pressed={laserType === "ice-cannon"}
              className={`min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer touch-manipulation select-none active:scale-[0.98] flex items-center justify-center gap-1 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none ${
                laserType === "ice-cannon"
                  ? "bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-[0_0_10px_rgba(56,189,248,0.3)]"
                  : "text-neutral-400 hover:text-white border border-transparent"
              }`}
            >
              <IconSnowflake className="w-3.5 h-3.5" />
              Cryo-Mortar (4)
            </button>
          </div>

          {/* Score & Museum Buttons */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <button
              onClick={() => setShowMuseum(true)}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-amber-300 border border-amber-500/30 transition-all cursor-pointer touch-manipulation select-none active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
            >
              <IconBook className="w-3.5 h-3.5" />
              <span>Flag Museum</span>
            </button>

            <FieldManualButton
              manualId="laser-loon"
              label="Manual"
              onOpenChange={setIsManualOpen}
            />
            <FullscreenButton
              isFullscreen={isFullscreen}
              onToggle={toggleFullscreen}
              variant="header"
            />
          </div>
        </div>
      </details>
      {/* Main Interactive Game Container */}
      <div
        ref={containerRef}
        tabIndex={0}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        data-keyboard-boundary="true"
        className={`arcade-shooter-playfield relative outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--game-accent)] flex flex-col justify-center ${
          isFullscreen
            ? "fixed inset-0 z-50 w-full h-[100dvh] max-h-[100dvh] max-w-none rounded-none border-none bg-black p-2 sm:p-4 overflow-hidden select-none touch-none"
            : "w-full max-w-[min(100%,calc((100dvh_-_340px)*768/420))] bg-neutral-950 overflow-hidden"
        }`}
      >
        <FullscreenButton
          isFullscreen={isFullscreen}
          onToggle={toggleFullscreen}
          variant="floating"
        />
        {/* One HUD strip above the stage keeps the arena clear (#1598). */}
        <ArcadeHud
          stats={[
            { label: "Score", value: score, accent: true },
            { label: "Hi", value: effectiveHighScore },
            ...(mode === "campaign"
              ? [
                  { label: "Act", value: `${currentActNum}/4` },
                  {
                    label: bossActive ? "Boss" : "Kills",
                    value: bossActive
                      ? "Engaged"
                      : `${actKills}/${currentAct.requiredMinionKills}`,
                  },
                  {
                    label: "Hits",
                    value: (
                      <span
                        className="flex items-center gap-0.5"
                        role="img"
                        aria-label={`Hits left: ${hitsLeft} of ${LOON_MAX_HITS}`}
                      >
                        {Array.from({ length: LOON_MAX_HITS }, (_, i) => (
                          <IconHeart
                            key={i}
                            aria-hidden="true"
                            className={`w-3.5 h-3.5 ${
                              i < hitsLeft
                                ? "text-rose-400 fill-rose-400"
                                : "text-neutral-600"
                            }`}
                          />
                        ))}
                      </span>
                    ),
                  },
                ]
              : []),
            ...(mode === "arcade"
              ? [
                  {
                    label: "Time",
                    value: (
                      <span
                        className={timeLeft <= 10 ? "text-rose-400" : undefined}
                      >
                        {timeLeft}s
                      </span>
                    ),
                  },
                ]
              : []),
          ]}
          callouts={
            <>
              {combo > 1 && (
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-amber-300">
                  <IconFlame
                    aria-hidden="true"
                    className="w-3 h-3 text-amber-400"
                  />
                  {combo}x combo ({multiplier}x pts)
                </span>
              )}
              {activePowerUpType && (
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-emerald-300">
                  <IconSparkles
                    aria-hidden="true"
                    className="w-3 h-3 text-emerald-400"
                  />
                  {POWER_UP_CONFIGS[activePowerUpType]?.label} (
                  {Math.ceil(activePowerUpTimeMs / 1000)}s)
                </span>
              )}
              {!isFocused && gameState === "playing" && (
                <span className="whitespace-nowrap text-zinc-500">
                  Click the arena to aim
                </span>
              )}
            </>
          }
          meter={
            gameState === "playing"
              ? {
                  label: "Tremolo",
                  percent: mode === "sandbox" ? 100 : ultimateMeter,
                  ready: ultimateMeter >= 100 || mode === "sandbox",
                  onActivate: fireUltimateTremolo,
                  hotkey: "U",
                }
              : undefined
          }
          trailing={
            /* Fullscreen hides the footer strip, so Pause stays in the HUD
               there; elsewhere it lives below the playfield, out of the
               firing area (#1551). */
            isFullscreen && (gameState === "playing" || isPaused) ? (
              <button
                type="button"
                onClick={togglePause}
                aria-label={isPaused ? "Resume Game" : "Pause Game"}
                className="min-h-[44px] min-w-[44px] px-2 rounded-md text-zinc-200 hover:bg-white/[0.06] font-mono text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--game-accent)] focus-visible:outline-none"
              >
                {isPaused ? (
                  <IconPlayerPlay className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <IconPlayerPause className="w-3.5 h-3.5" />
                )}
                <span>{isPaused ? "Resume" : "Pause"} [P]</span>
              </button>
            ) : undefined
          }
        />

        {/* Stage: the canvas fills the bezel; shake moves this element. */}
        <div
          ref={fxStageRef}
          className={`relative w-full min-w-0 ${
            isFullscreen ? "flex justify-center" : ""
          }`}
        >
          {/* Docked boss plate: full name and HP, clear of the arena. */}
          {bossActive && (
            <div
              key={`boss-plate-${bossName}`}
              className="loon-boss-plate absolute top-0 inset-x-0 z-20 flex items-center gap-3 px-3 py-1.5 bg-gradient-to-b from-black/80 to-black/0 font-mono text-[11px] font-bold pointer-events-none"
            >
              <span className="shrink-0 uppercase tracking-wider text-rose-300">
                {bossName}
              </span>
              <div
                role="progressbar"
                aria-valuenow={Math.max(
                  0,
                  Math.round((bossHp / bossMaxHp) * 100)
                )}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${bossName} Health`}
                className="flex-1 min-w-0 h-2 bg-neutral-900 rounded-full overflow-hidden border border-white/[0.08]"
              >
                <div
                  className="h-full w-full bg-rose-500 origin-left transition-transform duration-150"
                  style={{
                    transform: `scaleX(${clamp(bossHp / bossMaxHp, 0, 1)})`,
                  }}
                />
              </div>
              <span className="shrink-0 tabular-nums text-zinc-300">
                {Math.max(0, Math.ceil(bossHp))} / {bossMaxHp}
              </span>
            </div>
          )}

          <div
            ref={fxFlashRef}
            aria-hidden="true"
            className="absolute inset-0 z-10 opacity-0 pointer-events-none"
          />

          {/* Game Canvas */}
          <canvas
            ref={canvasRef}
            width={768}
            height={420}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerCancel}
            onMouseMove={handleCanvasMouseMove}
            onMouseDown={handleCanvasMouseDown}
            onMouseUp={handleCanvasMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            style={{ touchAction: "none" }}
            role="application"
            aria-label="Laser Loon Arcade Game. Use arrow keys to reposition the loon, spacebar or enter to fire weapons, and number keys 1 to 4 to select weapons."
            tabIndex={0}
            className={
              isFullscreen
                ? "max-h-[var(--layout-viewport-budget,calc(100dvh-var(--header-height,80px)-var(--footer-height,48px)))] max-h-[calc(100dvh-var(--header-height,80px)-var(--footer-height,48px))] max-w-full aspect-[768/420] object-contain block cursor-crosshair touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--game-accent)]"
                : "w-full h-auto aspect-[768/420] block cursor-crosshair touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--game-accent)]"
            }
          />
        </div>

        {/* Pause Overlay Screen */}
        {isPaused && (
          <div className="arcade-shooter-pause absolute inset-0 bg-neutral-950/90 backdrop-blur-md z-40 flex flex-col items-center justify-center text-center p-4 select-none overflow-y-auto">
            <PauseMenu
              score={score}
              actNum={currentActNum}
              onResume={togglePause}
              onRestart={() => {
                setIsPaused(false);
                startGame();
              }}
              onExit={() => {
                setIsPaused(false);
                resetGame();
              }}
            />
          </div>
        )}

        {/* Off-screen Accessible DOM Fallback Subtree */}
        <div className="sr-only" aria-label="Laser Loon Accessible Subtree">
          <fieldset>
            <legend>Laser Loon Game State and Controls</legend>

            <div role="group" aria-label="Laser Loon Telemetry and Status">
              <output htmlFor="laser-loon-score">Score: {score}</output>
              <output htmlFor="laser-loon-highscore">
                High Score: {effectiveHighScore}
              </output>
              <output htmlFor="laser-loon-mode">Mode: {mode}</output>
              <output htmlFor="laser-loon-status">
                Game Status: {gameState}
              </output>
              <output htmlFor="laser-loon-act">
                Act: {currentActNum} of 4
              </output>
              <output htmlFor="laser-loon-combo">Combo: {combo}x</output>
              <output htmlFor="laser-loon-multiplier">
                Multiplier: {multiplier}x
              </output>
              <output htmlFor="laser-loon-timer">
                Time Remaining: {timeLeft}s
              </output>
              <output htmlFor="laser-loon-ultimate">
                Ultimate Tremolo: {ultimateMeter}%
              </output>
              <output htmlFor="laser-loon-weapon">
                Selected Optics: {WEAPONS[laserType]?.name || laserType}
              </output>
              {bossActive && (
                <output htmlFor="laser-loon-boss">
                  Boss {bossName}: {Math.max(0, Math.ceil(bossHp))} /{" "}
                  {bossMaxHp} HP
                </output>
              )}
            </div>

            <div role="group" aria-label="Laser Loon Interactive Controls">
              <button
                type="button"
                onClick={startGame}
                disabled={gameState === "playing"}
              >
                Start Game
              </button>

              <button
                type="button"
                onClick={() => setMode("campaign")}
                aria-pressed={mode === "campaign"}
              >
                Campaign Mode
              </button>
              <button
                type="button"
                onClick={() => setMode("arcade")}
                aria-pressed={mode === "arcade"}
              >
                Arcade Mode
              </button>
              <button
                type="button"
                onClick={() => setMode("sandbox")}
                aria-pressed={mode === "sandbox"}
              >
                Sandbox Mode
              </button>

              <button
                type="button"
                onClick={() => selectLaserType("ruby-laser")}
                aria-pressed={laserType === "ruby-laser"}
              >
                Optics: Ruby Laser
              </button>
              <button
                type="button"
                onClick={() => selectLaserType("cyan-pulse")}
                aria-pressed={laserType === "cyan-pulse"}
              >
                Optics: Cyan Pulse
              </button>
              <button
                type="button"
                onClick={() => selectLaserType("aurora-wave")}
                aria-pressed={laserType === "aurora-wave"}
              >
                Optics: Aurora Wave
              </button>
              <button
                type="button"
                onClick={() => selectLaserType("ice-cannon")}
                aria-pressed={laserType === "ice-cannon"}
              >
                Optics: Cryo-Mortar
              </button>

              <button
                type="button"
                onClick={() => {
                  isFiringRef.current = true;
                  fireWeapon();
                  announce("Laser weapon fired.", "polite");
                }}
              >
                Fire Weapon
              </button>

              <button
                type="button"
                onClick={fireUltimateTremolo}
                disabled={ultimateMeter < 100 && mode !== "sandbox"}
              >
                Trigger Loon Tremolo
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextY = Math.max(
                    LOON_MIN_Y,
                    loonPosRef.current.targetY - 25
                  );
                  loonPosRef.current.targetY = nextY;
                  announce(
                    `Moved Loon Up to Y position ${Math.round(nextY)}`,
                    "polite"
                  );
                }}
              >
                Move Loon Up
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextY = Math.min(
                    LOON_MAX_Y,
                    loonPosRef.current.targetY + 25
                  );
                  loonPosRef.current.targetY = nextY;
                  announce(
                    `Moved Loon Down to Y position ${Math.round(nextY)}`,
                    "polite"
                  );
                }}
              >
                Move Loon Down
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextX = Math.max(
                    LOON_MIN_X,
                    loonPosRef.current.targetX - 25
                  );
                  loonPosRef.current.targetX = nextX;
                  announce(
                    `Moved Loon Left to X position ${Math.round(nextX)}`,
                    "polite"
                  );
                }}
              >
                Move Loon Left
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextX = Math.min(
                    LOON_MAX_X,
                    loonPosRef.current.targetX + 25
                  );
                  loonPosRef.current.targetX = nextX;
                  announce(
                    `Moved Loon Right to X position ${Math.round(nextX)}`,
                    "polite"
                  );
                }}
              >
                Move Loon Right
              </button>

              {mode === "sandbox" && (
                <label htmlFor="laser-loon-gravity-input">
                  Sandbox Gravity Setting
                  <input
                    id="laser-loon-gravity-input"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={gravity}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setGravity(val);
                      announce(`Sandbox gravity adjusted to ${val}`, "polite");
                    }}
                  />
                </label>
              )}
            </div>
          </fieldset>
        </div>

        {/* Start Overlay Screen */}
        {gameState === "idle" && (
          <div className="arcade-shooter-start absolute inset-0 bg-neutral-950/85 z-30 flex flex-col items-center text-center p-3 select-none overflow-y-auto">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-3 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.3)] animate-pulse">
              <IconTarget className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-neutral-100 font-mono tracking-tight mb-2">
              LASER LOON: QUEST FOR THE STATE FLAG
            </h3>
            <p className="text-xs text-neutral-400 max-w-md mb-6 leading-relaxed">
              Pilot submission{" "}
              <span className="text-red-400 font-bold">F277 Laser Loon</span>{" "}
              across Lake Minnetonka, the State Fair, and Legislative Hearings
              to claim glory on the State Capitol dome!
            </p>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startGame();
                  containerRef.current?.focus({ preventScroll: true });
                }}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-6 py-2.5 bg-red-500 hover:bg-red-400 text-white font-mono font-bold text-sm rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all transform hover:scale-105 active:scale-95 cursor-pointer touch-manipulation select-none"
              >
                <IconPlayerPlay className="w-4 h-4 fill-current" />
                <span>START CAMPAIGN [SPACE]</span>
              </button>

              <button
                onClick={() => setShowMuseum(true)}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-amber-300 border border-amber-500/30 font-mono font-bold text-sm rounded-xl transition-all cursor-pointer touch-manipulation select-none active:scale-95"
              >
                <IconBook className="w-4 h-4" />
                <span>FLAG MUSEUM</span>
              </button>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-6 text-[10px] font-mono text-neutral-500">
              <span>MOUSE / WASD: AIM & GLIDE</span>
              <span>CLICK / DRAG / SPACE: FIRE LASERS</span>
              <span>KEYS 1-4: OPTICS</span>
              <span>U: LOON TREMOLO ULTIMATE</span>
            </div>
          </div>
        )}

        {/* Newspaper Story Card (Act Intro) */}
        {gameState === "act-intro" && (
          <div className="arcade-shooter-story absolute inset-0 bg-black/80 z-30 flex flex-col items-center p-3 select-none overflow-y-auto">
            {/* Act intro as a newspaper front page (#1599). */}
            <article className="loon-newsprint my-auto w-full max-w-[36rem] rounded-sm px-6 py-5 text-left shadow-2xl">
              <header className="text-center">
                <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-widest text-[#5b5346]">
                  <span>Act {currentActNum} of 4</span>
                  <span>{currentAct.location}</span>
                </div>
                <p className="loon-newsprint-masthead mt-1 border-y-[3px] border-double border-[#1c1a17] py-1 text-3xl leading-none">
                  The Loon Ledger
                </p>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#8a2c1f]">
                  {currentAct.newspaperSubheader}
                </p>
                <h4 className="loon-newsprint-headline mt-1 text-2xl sm:text-3xl leading-[1.05]">
                  {currentAct.newspaperHeadline}
                </h4>
              </header>

              <div className="mt-4 border-t border-[#1c1a17]/40 pt-3 text-[13px] leading-snug text-[#2a2620] sm:columns-2 sm:gap-6 [&>p+p]:mt-2">
                {currentAct.storyIntro.map((paragraph, idx) => (
                  <p
                    key={idx}
                    className={
                      idx === 0
                        ? "first-letter:float-left first-letter:mr-1 first-letter:text-4xl first-letter:font-bold first-letter:leading-[0.85]"
                        : undefined
                    }
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between gap-4 border-t border-[#1c1a17] pt-3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#5b5346]">
                  Boss sighted: {currentAct.bossName}
                </span>
                <button
                  onClick={() => startAct(currentActNum)}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-5 py-2 rounded-sm bg-[#1c1a17] hover:bg-[#35302a] text-[#f3ecd9] font-mono font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors active:scale-[0.98] touch-manipulation select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a2c1f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3ecd9]"
                >
                  <span>Engage stage [Space]</span>
                  <IconChevronRight className="w-4 h-4" />
                </button>
              </div>
            </article>
          </div>
        )}

        {/* End-of-round cards share the Arcade Kit ResultCard (#1599). */}
        {gameState === "act-victory" && (
          <ResultCard
            title={`Act ${currentActNum} cleared`}
            stamp="Cleared"
            verdict="win"
            message={`"${currentAct.victoryQuote}"`}
            stats={[
              { label: "Score", value: score },
              { label: "Max combo", value: maxCombo, suffix: "x" },
            ]}
            score={score}
            previousBest={runStartBest}
            primary={{
              label: `Advance to Act ${currentActNum + 1} [Space]`,
              icon: <IconChevronRight className="w-4 h-4" />,
              onClick: () => {
                setCurrentActNum((prev) => prev + 1);
                setGameState("act-intro");
              },
            }}
          />
        )}

        {gameState === "act-failed" && (
          <ResultCard
            title="The loon is down"
            stamp="Down"
            verdict="loss"
            message="Three hits and the loon splashes down. Dodge with W/S or the arrow keys, freeze enemies with the Glacial Cryo-Mortar [4], and grab a Pronto Pup to shield a hit."
            stats={[
              { label: "Score", value: score },
              {
                label: "Act kills",
                value: actKills,
                suffix: `/${currentAct.requiredMinionKills}`,
              },
              { label: "Max combo", value: maxCombo, suffix: "x" },
            ]}
            score={score}
            previousBest={runStartBest}
            primary={{
              label: `Try Act ${currentActNum} again [Space]`,
              icon: <IconRefresh className="w-4 h-4" />,
              onClick: () => {
                startAct(currentActNum);
                containerRef.current?.focus({ preventScroll: true });
              },
            }}
            secondary={{ label: "Quit to title", onClick: resetGame }}
          />
        )}

        {gameState === "campaign-victory" && (
          <ResultCard
            title="History made! F277 prevails"
            stamp="State flag"
            verdict="win"
            message="Laser Loon is hoisted high atop the Minnesota State Capitol Dome! Over $13,500 raised for the Saint Paul Public Library Foundation as the public domain legend lives on."
            stats={[
              { label: "Total score", value: score },
              { label: "Max combo", value: maxCombo, suffix: "x" },
              { label: "Acts", value: CAMPAIGN_ACTS.length },
            ]}
            score={score}
            previousBest={runStartBest}
            primary={{
              label: "Play again [Space]",
              icon: <IconRefresh className="w-4 h-4" />,
              onClick: startGame,
            }}
            secondary={{
              label: "Flag Museum",
              icon: <IconBook className="w-4 h-4" />,
              onClick: () => setShowMuseum(true),
            }}
          />
        )}

        {gameState === "gameover" && (
          <ResultCard
            title="Session concluded"
            stamp="Time"
            verdict="neutral"
            message="Vexillology obstacles and legislative hearings recorded."
            stats={[
              { label: "Final score", value: score },
              { label: "Max combo", value: maxCombo, suffix: "x" },
            ]}
            score={score}
            previousBest={runStartBest}
            primary={{
              label: "Play again [Space]",
              icon: <IconRefresh className="w-4 h-4" />,
              onClick: () => {
                startGame();
                containerRef.current?.focus({ preventScroll: true });
              },
            }}
          />
        )}

        {/* Sandbox Controls Bar */}
        {mode === "sandbox" && (
          <div className="absolute bottom-3 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 p-2 bg-neutral-900/80 border border-neutral-800 rounded-2xl backdrop-blur-md pointer-events-auto">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-neutral-400">
                GRAVITY:
              </span>
              <button
                onClick={() => setGravity(0)}
                className={`min-h-[44px] min-w-[44px] px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer touch-manipulation select-none active:scale-95 flex items-center justify-center ${
                  gravity === 0
                    ? "bg-red-400 text-black"
                    : "bg-neutral-800 text-neutral-400"
                }`}
              >
                Zero-G
              </button>
              <button
                onClick={() => setGravity(0.15)}
                className={`min-h-[44px] min-w-[44px] px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer touch-manipulation select-none active:scale-95 flex items-center justify-center ${
                  gravity === 0.15
                    ? "bg-red-400 text-black"
                    : "bg-neutral-800 text-neutral-400"
                }`}
              >
                Lake
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const loon = loonPosRef.current;
                  launchIceBlock(
                    loon.x + 48,
                    loon.y - 8,
                    aimPosRef.current.x,
                    aimPosRef.current.y
                  );
                }}
                className="min-h-[44px] min-w-[44px] px-3 py-1 bg-sky-950 hover:bg-sky-900 text-sky-300 text-[10px] font-mono font-bold rounded-lg border border-sky-800/60 cursor-pointer touch-manipulation select-none active:scale-95 flex items-center justify-center"
              >
                🧊 Launch Cryo-Mortar
              </button>
              <button
                onClick={() => {
                  if (canvasRef.current) {
                    spawnTarget(DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT);
                  }
                }}
                className="min-h-[44px] min-w-[44px] px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-red-400 text-[10px] font-mono font-bold rounded-lg border border-neutral-700 cursor-pointer touch-manipulation select-none active:scale-95 flex items-center justify-center"
              >
                + Spawn Rival Flag
              </button>
              <button
                onClick={() => {
                  if (canvasRef.current) {
                    triggerBossEncounter(
                      DEFAULT_CANVAS_WIDTH,
                      DEFAULT_CANVAS_HEIGHT
                    );
                  }
                }}
                className="min-h-[44px] min-w-[44px] px-3 py-1 bg-red-950 hover:bg-red-900 text-red-300 text-[10px] font-mono font-bold rounded-lg border border-red-800/60 cursor-pointer touch-manipulation select-none active:scale-95 flex items-center justify-center"
              >
                ⚠️ Spawn Boss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile/Tablet Touch Aim & Fire Dock */}
      <div className="arcade-shooter-controls w-full max-w-3xl mt-3 flex justify-center">
        <TwinStickAimDock
          onFirePress={() => {
            isFiringRef.current = true;
            fireWeapon();
          }}
          onFireRelease={() => {
            isFiringRef.current = false;
          }}
          onTremoloPress={fireUltimateTremolo}
          onWeaponSelect={(idx) => {
            const types: LaserType[] = [
              "ruby-laser",
              "cyan-pulse",
              "aurora-wave",
              "ice-cannon",
            ];
            if (types[idx]) selectLaserType(types[idx]);
          }}
          selectedWeapon={
            laserType === "ruby-laser"
              ? 0
              : laserType === "cyan-pulse"
                ? 1
                : laserType === "aurora-wave"
                  ? 2
                  : 3
          }
          weapons={[
            { id: "ruby-laser", label: "Ruby", color: "red" },
            { id: "cyan-pulse", label: "Pulse", color: "cyan" },
            { id: "aurora-wave", label: "Aurora", color: "emerald" },
            { id: "ice-cannon", label: "Cryo-Mortar", color: "amber" },
          ]}
          energyPercent={ultimateMeter}
        />
      </div>

      {/* Footer Controls & Toggles */}
      <div className="arcade-shooter-footer w-full max-w-3xl flex flex-wrap gap-2 justify-between items-center px-4 mt-2 text-[10px] font-mono text-neutral-500">
        <span>
          Controls: Aim &amp; Click / Space to fire · Keys 1-4 for Optics · U
          for Tremolo
        </span>
        <div className="flex items-center gap-4">
          {(gameState === "playing" || isPaused) && (
            <button
              type="button"
              onClick={togglePause}
              aria-label={isPaused ? "Resume Game" : "Pause Game"}
              className="min-h-[44px] min-w-[44px] px-3 py-1 rounded-full bg-neutral-900/90 border border-neutral-800 hover:border-red-500/50 text-neutral-200 hover:text-red-400 font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer touch-manipulation select-none active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none"
            >
              {isPaused ? (
                <IconPlayerPlay className="w-3.5 h-3.5 fill-current text-red-400" />
              ) : (
                <IconPlayerPause className="w-3.5 h-3.5 text-red-400" />
              )}
              <span>{isPaused ? "Resume" : "Pause"} [P]</span>
            </button>
          )}
          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="min-h-[44px] min-w-[44px] px-2 py-1 hover:text-neutral-300 transition-colors cursor-pointer flex items-center justify-center gap-1 touch-manipulation select-none active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none rounded-lg"
          >
            {soundEnabled ? (
              <IconVolume className="w-3.5 h-3.5 text-red-400" />
            ) : (
              <IconVolumeOff className="w-3.5 h-3.5" />
            )}
            Audio: {soundEnabled ? "ON" : "MUTED"}
          </button>
          <button
            onClick={() => setScreenShakeEnabled((prev) => !prev)}
            className="min-h-[44px] min-w-[44px] px-2 py-1 hover:text-neutral-300 transition-colors cursor-pointer flex items-center justify-center gap-1 touch-manipulation select-none active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none rounded-lg"
          >
            Screen Shake: {screenShakeEnabled ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Flag Museum & Lore Modal */}
      {showMuseum && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            ref={museumTrapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="laser-loon-museum-title"
            className="bg-neutral-950 border border-neutral-800 rounded-3xl max-w-2xl w-full p-6 relative shadow-2xl overflow-y-auto max-h-[90vh]"
          >
            <button
              onClick={() => setShowMuseum(false)}
              aria-label="Close Flag Museum"
              className="absolute top-5 right-5 min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer touch-manipulation select-none active:scale-95"
            >
              <IconX className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
                <IconBook className="w-6 h-6" />
              </div>
              <div>
                <h3
                  id="laser-loon-museum-title"
                  className="text-xl font-bold font-mono text-white"
                >
                  Minnesota Flag Redesign Museum
                </h3>
                <p className="text-xs text-neutral-400 font-mono">
                  Historical artifacts, viral submissions, and the F277 Laser
                  Loon legend.
                </p>
              </div>
            </div>

            {/* Flag Selector Carousel */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {FLAG_MUSEUM.map((entry, idx) => (
                <button
                  key={entry.id}
                  onClick={() => setSelectedFlagIndex(idx)}
                  aria-pressed={selectedFlagIndex === idx}
                  className={`min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl text-xs font-mono font-bold whitespace-nowrap cursor-pointer transition-all touch-manipulation select-none active:scale-95 flex items-center justify-center ${
                    selectedFlagIndex === idx
                      ? "bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                      : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
                  }`}
                >
                  {entry.submissionCode}
                </button>
              ))}
            </div>

            {/* Selected Flag Details */}
            {(() => {
              const flag = FLAG_MUSEUM[selectedFlagIndex];
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                    <div>
                      <h4 className="text-lg font-bold text-white font-mono">
                        {flag.name}
                      </h4>
                      <p className="text-xs text-neutral-400">
                        Created by:{" "}
                        <span className="text-neutral-200">{flag.creator}</span>
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      {flag.category}
                    </span>
                  </div>

                  {/* Flag Color Palette Swatches */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-neutral-400">
                      Color Palette:
                    </span>
                    <div className="flex gap-1.5">
                      {flag.flagColors.map((col, i) => (
                        <div
                          key={i}
                          className="w-5 h-5 rounded-md border border-white/20 shadow-sm"
                          style={{ backgroundColor: col }}
                          title={col}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-4 space-y-3 font-mono text-xs">
                    <div>
                      <span className="text-red-400 font-bold block mb-1">
                        Design Overview:
                      </span>
                      <p className="text-neutral-300 leading-relaxed">
                        {flag.description}
                      </p>
                    </div>
                    <div>
                      <span className="text-amber-400 font-bold block mb-1">
                        Historical Significance:
                      </span>
                      <p className="text-neutral-300 leading-relaxed">
                        {flag.historicalSignificance}
                      </p>
                    </div>
                    <div>
                      <span className="text-emerald-400 font-bold block mb-1">
                        Civic Impact:
                      </span>
                      <p className="text-neutral-300 leading-relaxed">
                        {flag.civicImpact}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
