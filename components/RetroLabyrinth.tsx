"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";
import { useTelemetry } from "@/hooks/useTelemetry";
import { logger } from "@/lib/logger";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import { safeGetRawItem, safeSetRawItem } from "@/lib/safe-storage";
import { recordArcadeScore } from "@/lib/arcade-achievements";
import { clamp } from "@/lib/game-utils";
import { useAudio } from "@/components/providers/AudioProvider";
import {
  IconTrophy,
  IconRefresh,
  IconArrowRight,
  IconCheck,
  IconFileText,
  IconTerminal2,
  IconShoppingCart,
  IconDeviceTv,
} from "@tabler/icons-react";
import { DpadActionDock } from "@/components/arcade/ControlDocks";
import { useResponsiveCanvas } from "@/hooks/useResponsiveCanvas";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import { FieldManualButton } from "@/components/FieldManualButton";
import { FullscreenButton } from "@/components/arcade/FullscreenButton";
import { DynamicTabletOrientationHint as TabletOrientationHint } from "@/components/arcade/DynamicTabletOrientationHint";
import { DynamicCRTCalibrationModal as CRTCalibrationModal } from "@/components/arcade/DynamicCRTCalibrationModal";
import {
  CRTCalibrationConfig,
  loadCRTCalibration,
  saveCRTCalibration,
  renderCRTEffects,
} from "@/lib/arcade/crt-pipeline";
import { useGameFullscreen as useFullscreen } from "@/components/arcade/CabinetFullscreen";
import {
  ActiveSideEffect,
  BossState,
  CRTThemeId,
  CyberdeckClassId,
  CyberdeckProfile,
  DEFAULT_WEAPONS,
  DungeonRoom,
  Enemy,
  FloatingNotification,
  HexMatrixPuzzle,
  ItemPickup,
  ParticleEffect,
  Weapon,
  WeaponId,
  calculateFOV,
  computeShortestTour,
  fireWeapon,
  generateClassicStage1,
  generateClassicStage2,
  generateRoguelikeCampaign,
  generateTSPRoom,
  generateHexMatrixPuzzle,
  selectHexCell,
  consumeBypassChip,
  renderWireframeMesh,
  updateEnemyAI,
  updateFaceForgeBoss,
  getExitLockState,
  grantAmmoForLoadout,
  computeRoomExitScore,
  ENEMY_STEP_INTERVAL_MS,
  type AmmoGrantResult,
  updateTSPMovingWalls,
  retroAudio,
  CRT_THEMES,
  CYBERDECK_CLASSES,
  DARKNET_VENDOR_CATALOG,
  loadCyberdeckProfile,
  RETRO_LABYRINTH_HIGH_SCORE_KEY,
  formatCampaignRoomBadge,
  saveCyberdeckProfile,
  STAGE_1_MAZE,
} from "@/lib/dungeon";

const MAZE = STAGE_1_MAZE;

const START_X = 1;
const START_Y = 1;
const EXIT_X = 13;
const EXIT_Y = 7;
// How recent the player's last step must be for boss salvos to lead it.
const BOSS_LEAD_WINDOW_MS = 600;
/** HP a drone takes when it and the player share a tile. */
const DRONE_CONTACT_DAMAGE = 25;
/**
 * Real time between classic Stage 2 drone steps. It used to be a 4% chance
 * per frame, which ran twice as fast on a 120 Hz display (#1665).
 */
const CLASSIC_DRONE_STEP_INTERVAL_MS = 400;

/**
 * Keys a non-playing overlay swallows so they do not scroll the page (#1669).
 */
const OVERLAY_CONSUMED_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "PageUp",
  "PageDown",
  " ",
  "w",
  "a",
  "s",
  "d",
  "W",
  "A",
  "S",
  "D",
]);

const WEAPON_SHORT_LABELS: Record<WeaponId, string> = {
  npm_install: "npm i",
  git_force_push: "git push -f",
  stack_overflow: "StackOverflow",
  emp_blast: "EMP",
  port_scan: "Port Scan",
  buffer_overflow: "Buffer Overflow",
  zero_day: "0-Day",
  mitm_spoof: "MitM Spoof",
  ransomware_lock: "Ransomware",
};

interface Drone {
  x: number;
  y: number;
  dir: "left" | "right" | "up" | "down";
  minX: number;
  maxX: number;
}

interface RetroLabyrinthProps {
  isMounted?: boolean;
}

type GameStatus =
  | "playing"
  | "paused"
  | "victory"
  | "caught"
  | "timesheet"
  | "hacking"
  | "darknet_shop"
  | "class_select";

/**
 * The floating line for an ammo pickup or purchase, naming what the player's
 * class actually received (#1667).
 */
function describeAmmoGrants(grants: AmmoGrantResult[]): string {
  const totals = new Map<WeaponId, number>();
  for (const grant of grants) {
    if (grant.weaponId && grant.charges > 0) {
      totals.set(
        grant.weaponId,
        (totals.get(grant.weaponId) ?? 0) + grant.charges
      );
    }
  }
  if (totals.size === 0) {
    return grants.some((grant) => grant.weaponId)
      ? "Ammo already full"
      : "No weapon on this class can use this";
  }
  return Array.from(totals)
    .map(([id, charges]) => `+${charges} ${WEAPON_SHORT_LABELS[id]}`)
    .join(", ");
}

const subscribeHighScore = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};
const getHighScoreSnapshot = () => {
  try {
    return safeGetRawItem(RETRO_LABYRINTH_HIGH_SCORE_KEY) || "0";
  } catch {
    return "0";
  }
};
const getHighScoreServerSnapshot = () => "0";
const emptySubscribe = () => () => {};

export const RetroLabyrinth: React.FC<RetroLabyrinthProps> = ({
  isMounted: propIsMounted,
}) => {
  const clientMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const isMounted = propIsMounted ?? clientMounted;
  const rawHighScore = useSyncExternalStore(
    subscribeHighScore,
    getHighScoreSnapshot,
    getHighScoreServerSnapshot
  );
  const loadedHighScore = parseInt(rawHighScore, 10) || 0;
  const { announce } = useAnnouncer();

  // Persistent Cyberdeck Profile & Meta-Progression
  const [profile, setProfile] = useState<CyberdeckProfile>(() =>
    loadCyberdeckProfile()
  );
  const [selectedClassId, setSelectedClassId] =
    useState<CyberdeckClassId>("script_kiddie");
  const selectedClass =
    CYBERDECK_CLASSES[selectedClassId] || CYBERDECK_CLASSES.script_kiddie;

  // CRT Phosphor Theme & Calibration
  const [crtThemeId, setCrtThemeId] = useState<CRTThemeId>("emerald");
  const [crtCalibration, setCrtCalibration] = useState<CRTCalibrationConfig>(
    () => loadCRTCalibration()
  );
  const [isCRTModalOpen, setIsCRTModalOpen] = useState(false);
  const currentTheme = CRT_THEMES[crtThemeId] || CRT_THEMES.emerald;

  // Game mode & stage
  const [gameMode, setGameMode] = useState<"roguelike" | "classic">(
    "roguelike"
  );
  const [stage, setStage] = useState<number>(1);
  const [roomIndex, setRoomIndex] = useState<number>(0);
  const [campaignRooms, setCampaignRooms] = useState<DungeonRoom[]>(() =>
    generateRoguelikeCampaign()
  );

  // Active room & grid
  const [currentMaze, setCurrentMaze] = useState<string[][]>(STAGE_1_MAZE);
  const [playerPosition, setPlayerPosition] = useState({
    x: START_X,
    y: START_Y,
  });
  const [playerHp, setPlayerHp] = useState(selectedClass.baseHp);
  const [maxPlayerHp, setMaxPlayerHp] = useState(selectedClass.baseHp);

  // Cyberdeck RAM & Currency Resources
  const [currentRam, setCurrentRam] = useState(selectedClass.baseRam);
  const [maxRam, setMaxRam] = useState(selectedClass.baseRam);
  const [cryptoBounty, setCryptoBounty] = useState(0);
  // Crypto earned in the current room. Only this counts toward the room's
  // exit bonus, so a coin never scores twice (#1668).
  const [roomCrypto, setRoomCrypto] = useState(0);
  // The Market's CVE Threat Feed, once bought, exposes CVEs on every room
  // entry for the rest of the run (#1668).
  const [cveFeedActive, setCveFeedActive] = useState(false);
  const cveFeedRef = useRef(false);
  const [bypassChips, setBypassChips] = useState(
    selectedClass.startBypassChips
  );

  // Scoring & Stats
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const effectiveHighScore = Math.max(highScore, loadedHighScore);
  const [movesCount, setMovesCount] = useState(0);

  // Game lifecycle status & Modals
  const [gameStatus, setGameStatus] = useState<GameStatus>("playing");
  // Where the Market or class overlay returns to when it closes. A room that
  // was running comes back paused, so nothing hits the player unseen (#1669).
  const overlayReturnStatusRef = useRef<GameStatus>("paused");
  const [isFocused, setIsFocused] = useState(false);

  // Hacking Minigame State
  const [hexPuzzle, setHexPuzzle] = useState<HexMatrixPuzzle | null>(null);
  const [hackingFeedback, setHackingFeedback] = useState<string>("");

  // Combat & Weapons
  const [weapons, setWeapons] =
    useState<Record<WeaponId, Weapon>>(DEFAULT_WEAPONS);
  const [rawActiveWeaponId, setActiveWeaponId] = useState<WeaponId>(() => {
    return selectedClass.starterWeapons?.[0] || "npm_install";
  });
  const activeWeaponId = selectedClass.starterWeapons.includes(
    rawActiveWeaponId
  )
    ? rawActiveWeaponId
    : selectedClass.starterWeapons[0] || "npm_install";
  const [dronesStunned, setDronesStunned] = useState(false);
  const [activeSideEffect, setActiveSideEffect] =
    useState<ActiveSideEffect | null>(null);

  // Room Entities
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [items, setItems] = useState<ItemPickup[]>([]);
  const [boss, setBoss] = useState<BossState | undefined>(undefined);
  // The player's last step and when it was taken; boss salvos lead it (#1321).
  const lastHeadingRef = useRef<{ dx: number; dy: number; at: number } | null>(
    null
  );
  const [tspNodes, setTspNodes] = useState(generateTSPRoom().tspNodes || []);
  const [tspWalls, setTspWalls] = useState(
    generateTSPRoom().tspMovingWalls || []
  );

  // Backward compatibility state for Stage 2 Drone
  const [drones, setDrones] = useState<Drone[]>([]);

  // Field of View & Exploration
  const [exploredMap, setExploredMap] = useState<boolean[][]>(() =>
    Array.from({ length: 9 }, () => Array(15).fill(false))
  );
  const [visibleMap, setVisibleMap] = useState<boolean[][]>(() =>
    Array.from({ length: 9 }, () => Array(15).fill(true))
  );

  // FX: Particles & Floating texts
  const particlesRef = useRef<ParticleEffect[]>([]);
  const floatingTextsRef = useRef<FloatingNotification[]>([]);
  const cursorGridPosRef = useRef<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useResponsiveCanvas({
    canvasRef,
    internalWidth: 240,
    internalHeight: 144,
    maxDpr: 1.5,
  });
  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef);
  const { recordEvent } = useTelemetry();
  const { playNote, playSuccess } = useAudio();

  // Focus management
  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  // Initialize or Switch to a specific Room / Stage
  const loadRoom = useCallback(
    (mode: "roguelike" | "classic", targetStageOrIndex: number) => {
      setGameMode(mode);
      floatingTextsRef.current = [
        {
          id: `objective-${Date.now()}`,
          x: 7,
          y: 8,
          text: "REACH THE EXIT >>",
          color: "#f59e0b",
          alpha: 3,
          vy: 0,
        },
      ];
      setMovesCount(0);
      setRoomCrypto(0);
      setDronesStunned(false);
      setActiveSideEffect(null);
      setGameStatus("playing");

      if (mode === "classic") {
        setStage(targetStageOrIndex);
        const classicRoom =
          targetStageOrIndex === 2
            ? generateClassicStage2()
            : generateClassicStage1();
        setCurrentMaze(classicRoom.grid);
        setPlayerPosition({ x: classicRoom.startX, y: classicRoom.startY });
        setEnemies(classicRoom.enemies);
        setItems([]);
        setBoss(undefined);
        if (targetStageOrIndex === 2) {
          setDrones([{ x: 6, y: 5, dir: "right", minX: 5, maxX: 9 }]);
        } else {
          setDrones([]);
        }
        setVisibleMap(Array.from({ length: 9 }, () => Array(15).fill(true)));
        setExploredMap(Array.from({ length: 9 }, () => Array(15).fill(true)));
      } else {
        const campaign = generateRoguelikeCampaign();
        setCampaignRooms(campaign);
        const idx = clamp(targetStageOrIndex, 0, campaign.length - 1);
        setRoomIndex(idx);
        const currentRoom = campaign[idx];
        setStage(idx + 1);
        setCurrentMaze(currentRoom.grid);
        setPlayerPosition({ x: currentRoom.startX, y: currentRoom.startY });
        setEnemies(
          cveFeedRef.current
            ? currentRoom.enemies.map((e) => ({ ...e, cveExposed: true }))
            : currentRoom.enemies
        );
        setItems(currentRoom.items);
        setBoss(currentRoom.boss);
        setTspNodes(currentRoom.tspNodes || []);
        // A boss or route-node room names its objective instead of the exit,
        // which stays locked until that is done (#1321).
        const roomObjective = getExitLockState(
          currentRoom.boss,
          currentRoom.tspNodes
        );
        if (roomObjective.locked) {
          floatingTextsRef.current[0] = {
            ...floatingTextsRef.current[0],
            text: `${roomObjective.objective} >>`,
          };
        }
        setTspWalls(currentRoom.tspMovingWalls || []);
        // Campaign drones are enemies, moved and drawn with the rest. The
        // classic-mode drone list stays empty so no static copy is left on
        // the spawn tile (#1665).
        setDrones([]);

        const fov = calculateFOV(
          currentRoom.grid,
          currentRoom.startX,
          currentRoom.startY,
          7
        );
        setVisibleMap(fov.visible);
        setExploredMap(fov.explored);
      }
    },
    []
  );

  // HP, RAM, score, crypto, weapon ammo and the Threat Feed as the player
  // entered the current room. Retry restores these, so a breach that ended at
  // 0 HP doesn't restart at 0 HP, dying then retrying can't bank the room's
  // points twice (#1552), and a boss retry has the ammo to win (#1667).
  const roomEntryVitalsRef = useRef({
    hp: selectedClass.baseHp,
    ram: selectedClass.baseRam,
    score: 0,
    cryptoBounty: 0,
    weapons: DEFAULT_WEAPONS,
    cveFeed: false,
  });

  // Switch Stage (classic support)
  const switchStage = useCallback(
    (stgNum: number) => {
      roomEntryVitalsRef.current = {
        ...roomEntryVitalsRef.current,
        score,
        cryptoBounty,
        weapons,
      };
      loadRoom("classic", stgNum);
    },
    [loadRoom, score, cryptoBounty, weapons]
  );

  // Load the opening room on mount so the maze, fog and HUD match the room
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRoom("roguelike", 0);
  }, [loadRoom]);

  // A run that ends in a trace still counts toward the high score; only
  // reaching the exit used to record it (#1552). Same key and bare numeric
  // string as the exit path.
  useEffect(() => {
    if (gameStatus !== "caught" || score <= effectiveHighScore) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighScore(score);
    safeSetRawItem(RETRO_LABYRINTH_HIGH_SCORE_KEY, score.toString());
    recordArcadeScore("retro-labyrinth", score);
  }, [gameStatus, score, effectiveHighScore]);

  // Restart current stage
  const handleRestart = useCallback(() => {
    const entry = roomEntryVitalsRef.current;
    setPlayerHp(entry.hp);
    setCurrentRam(entry.ram);
    setScore(entry.score);
    setCryptoBounty(entry.cryptoBounty);
    setWeapons(entry.weapons);
    cveFeedRef.current = entry.cveFeed;
    setCveFeedActive(entry.cveFeed);
    if (gameMode === "classic") {
      loadRoom("classic", stage);
    } else {
      loadRoom("roguelike", roomIndex);
    }
  }, [gameMode, stage, roomIndex, loadRoom]);

  // Start Roguelike Campaign with chosen Cyberdeck Class
  const startRoguelikeCampaign = useCallback(() => {
    const chosenClass =
      CYBERDECK_CLASSES[selectedClassId] || CYBERDECK_CLASSES.script_kiddie;
    setPlayerHp(chosenClass.baseHp);
    setMaxPlayerHp(chosenClass.baseHp);
    setCurrentRam(chosenClass.baseRam);
    setMaxRam(chosenClass.baseRam);
    setBypassChips(chosenClass.startBypassChips);
    setWeapons(DEFAULT_WEAPONS);
    if (chosenClass.starterWeapons?.[0]) {
      setActiveWeaponId(chosenClass.starterWeapons[0]);
    }
    setScore(0);
    setCryptoBounty(0);
    cveFeedRef.current = false;
    setCveFeedActive(false);
    roomEntryVitalsRef.current = {
      hp: chosenClass.baseHp,
      ram: chosenClass.baseRam,
      score: 0,
      cryptoBounty: 0,
      weapons: DEFAULT_WEAPONS,
      cveFeed: false,
    };
    loadRoom("roguelike", 0);
  }, [selectedClassId, loadRoom]);

  // Advance to next room in roguelike campaign. After the last room the run
  // is complete, and continuing starts a new run from Room 01 (#1668).
  const handleNextRoom = useCallback(() => {
    if (roomIndex >= campaignRooms.length - 1) {
      startRoguelikeCampaign();
      return;
    }
    roomEntryVitalsRef.current = {
      hp: playerHp,
      ram: currentRam,
      score,
      cryptoBounty,
      weapons,
      cveFeed: cveFeedActive,
    };
    loadRoom("roguelike", roomIndex + 1);
  }, [
    roomIndex,
    campaignRooms.length,
    loadRoom,
    startRoguelikeCampaign,
    playerHp,
    currentRam,
    score,
    cryptoBounty,
    weapons,
    cveFeedActive,
  ]);

  // Crypto the player earns (not spends) counts toward this room's exit
  // bonus as well as the balance (#1668).
  const earnCrypto = useCallback((amount: number) => {
    if (amount <= 0) return;
    setCryptoBounty((c) => c + amount);
    setRoomCrypto((r) => r + amount);
  }, []);

  // Grid position of the hacking terminal the player is working on.
  const hackTerminalPosRef = useRef<{ x: number; y: number } | null>(null);

  // Trigger Terminal Hacking Minigame
  const openHackingTerminal = useCallback((difficulty: number = 2) => {
    const puzzle = generateHexMatrixPuzzle(difficulty);
    setHexPuzzle(puzzle);
    setHackingFeedback("INJECT HEX SEQUENCE ALONG HIGHLIGHTED AXIS");
    setGameStatus("hacking");
    retroAudio.playTone(600, 80, "sawtooth", 0.08);
  }, []);

  // Handle Hex Cell Selection in Minigame
  const handleHexCellClick = useCallback(
    (row: number, col: number) => {
      if (!hexPuzzle) return;
      const res = selectHexCell(hexPuzzle, row, col);
      setHexPuzzle(res.puzzle);
      setHackingFeedback(res.message);

      if (res.soundType === "match") {
        retroAudio.playHackSuccess();
        earnCrypto(res.puzzle.rewardCrypto);
        setScore((s) => s + res.puzzle.rewardCrypto * 2);
        if (res.puzzle.rewardBypassChips > 0) {
          setBypassChips((b) => b + res.puzzle.rewardBypassChips);
        }
      } else if (res.soundType === "fail") {
        retroAudio.playTone(150, 200, "sawtooth", 0.1);
      } else {
        retroAudio.playTone(800, 40, "sine", 0.05);
      }
    },
    [hexPuzzle, earnCrypto]
  );

  // Use Bypass Chip in Minigame
  const handleUseBypassChip = useCallback(() => {
    if (!hexPuzzle || bypassChips <= 0) return;
    setBypassChips((b) => b - 1);
    const solved = consumeBypassChip(hexPuzzle);
    setHexPuzzle(solved);
    setHackingFeedback("HARDWARE BYPASS VERIFIED! Terminal Decrypted.");
    retroAudio.playHackSuccess();
    earnCrypto(solved.rewardCrypto);
    setScore((s) => s + solved.rewardCrypto * 2);
  }, [hexPuzzle, bypassChips, earnCrypto]);

  // Close Hacking Minigame Modal. A decrypted terminal goes dark, so the
  // player can walk on without reopening it.
  const closeHackingModal = useCallback(() => {
    const terminal = hackTerminalPosRef.current;
    if (terminal && hexPuzzle?.solved) {
      setCurrentMaze((maze) =>
        maze.map((row, y) =>
          row.map((cell, x) =>
            x === terminal.x && y === terminal.y && cell === "H" ? " " : cell
          )
        )
      );
    }
    hackTerminalPosRef.current = null;
    setGameStatus("playing");
    setHexPuzzle(null);
    containerRef.current?.focus({ preventScroll: true });
  }, [hexPuzzle]);

  // Darknet Vendor Purchase
  const buyDarknetItem = useCallback(
    (itemId: string) => {
      const item = DARKNET_VENDOR_CATALOG.find((i) => i.id === itemId);
      if (!item || cryptoBounty < item.cost) {
        retroAudio.playTone(140, 150, "sawtooth", 0.1);
        return;
      }

      setCryptoBounty((c) => c - item.cost);
      retroAudio.playPickup();

      if (item.category === "ram") {
        setMaxRam((r) => r + 16);
        setCurrentRam((r) => r + 16);
      } else if (item.category === "chip") {
        setBypassChips((b) => b + 1);
      } else if (item.category === "weapon") {
        // 0-Day ammo, or the same damage in a weapon this class can fire.
        const grant = grantAmmoForLoadout(
          weapons,
          selectedClass.starterWeapons,
          "zero_day",
          2,
          false
        );
        setWeapons(grant.updatedWeapons);
        floatingTextsRef.current.push({
          id: `market-ammo-${Date.now()}`,
          x: playerPosition.x,
          y: playerPosition.y,
          text: describeAmmoGrants([grant]),
          color: "#ec4899",
          alpha: 1.5,
          vy: -0.02,
        });
      } else if (item.category === "heal") {
        setPlayerHp((hp) => Math.min(maxPlayerHp, hp + 50));
        setActiveSideEffect(null);
      } else if (item.category === "firmware") {
        // Applies now and on every later room entry this run (#1668).
        cveFeedRef.current = true;
        setCveFeedActive(true);
        setEnemies((prev) => prev.map((e) => ({ ...e, cveExposed: true })));
      }
    },
    [
      cryptoBounty,
      maxPlayerHp,
      weapons,
      selectedClass.starterWeapons,
      playerPosition.x,
      playerPosition.y,
    ]
  );

  // Attempt player move
  const tryMove = useCallback(
    (dx: number, dy: number) => {
      if (gameStatus !== "playing") return;

      const nextX = playerPosition.x + dx;
      const nextY = playerPosition.y + dy;

      // Boundary & Wall check
      if (
        nextY >= 0 &&
        nextY < currentMaze.length &&
        nextX >= 0 &&
        nextX < currentMaze[0].length &&
        currentMaze[nextY][nextX] !== "#" &&
        currentMaze[nextY][nextX] !== "W"
      ) {
        // Walking into a drone or another live enemy costs HP and leaves
        // the player where they were, rather than ending the run outright.
        if (
          !dronesStunned &&
          (drones.some((d) => d.x === nextX && d.y === nextY) ||
            enemies.some(
              (e) =>
                e.x === nextX &&
                e.y === nextY &&
                e.state !== "stunned" &&
                e.state !== "frozen"
            ))
        ) {
          setPlayerHp((hp) => {
            const nextHp = hp - DRONE_CONTACT_DAMAGE;
            if (nextHp <= 0) {
              setGameStatus("caught");
              retroAudio.playAlertPulse();
              return 0;
            }
            return nextHp;
          });
          playNote(200, 0.2);
          return;
        }

        // A locked exit is a wall until the room objective is done (#1321).
        if (gameMode === "roguelike" && nextX === EXIT_X && nextY === EXIT_Y) {
          const exitLock = getExitLockState(boss, tspNodes);
          if (exitLock.locked) {
            floatingTextsRef.current.push({
              id: `exit-locked-${Date.now()}`,
              x: nextX,
              y: nextY,
              text: exitLock.lockedMessage,
              color: "#ef4444",
              alpha: 1.5,
              vy: -0.02,
            });
            playNote(160, 0.15);
            return;
          }
        }

        lastHeadingRef.current = { dx, dy, at: Date.now() };
        const nextMoves = movesCount + 1;
        setPlayerPosition({ x: nextX, y: nextY });
        setMovesCount(nextMoves);

        // Regenerate Cyberdeck RAM
        setCurrentRam((r) => Math.min(maxRam, r + selectedClass.ramRegen));

        // Audio step pulse
        retroAudio.playStep();
        playNote(523.25 + (nextX + nextY) * 20, 0.02);

        // Update FOV in Roguelike mode
        if (gameMode === "roguelike") {
          const fov = calculateFOV(currentMaze, nextX, nextY, 7, exploredMap);
          setVisibleMap(fov.visible);
          setExploredMap(fov.explored);
        }

        // TSP room: Dynamic wall shifting & node collection
        if (
          gameMode === "roguelike" &&
          campaignRooms[roomIndex]?.id === "tsp"
        ) {
          const { updatedGrid, updatedWalls } = updateTSPMovingWalls(
            currentMaze,
            tspWalls,
            nextMoves
          );
          setCurrentMaze(updatedGrid);
          setTspWalls(updatedWalls);

          setTspNodes((prev) =>
            prev.map((node) => {
              if (!node.visited && node.x === nextX && node.y === nextY) {
                playSuccess();
                retroAudio.playPickup();
                setScore((s) => s + 200);
                earnCrypto(50);
                floatingTextsRef.current.push({
                  id: `tsp-node-${Date.now()}`,
                  x: nextX,
                  y: nextY,
                  text: "AIRGAP NODE BYPASS! +200 PTS",
                  color: currentTheme.accentColor,
                  alpha: 1,
                  vy: -0.02,
                });
                return { ...node, visited: true };
              }
              return node;
            })
          );
        }

        // Item Collection check. Ammo goes to a weapon this class can
        // fire, and the floating line says which (#1667).
        const pickup = items.find(
          (item) => !item.collected && item.x === nextX && item.y === nextY
        );
        if (pickup) {
          retroAudio.playPickup();
          playNote(784, 0.1);
          let pickupText = pickup.name;
          const loadout = selectedClass.starterWeapons;
          if (pickup.itemId === "node_modules") {
            const grant = grantAmmoForLoadout(
              weapons,
              loadout,
              "npm_install",
              4,
              true
            );
            setWeapons(grant.updatedWeapons);
            pickupText = describeAmmoGrants([grant]);
            setScore((s) => s + 100);
          } else if (pickup.itemId === "coffee") {
            setPlayerHp((hp) => Math.min(maxPlayerHp, hp + 25));
            setScore((s) => s + 100);
          } else if (pickup.itemId === "git_stash") {
            const pushGrant = grantAmmoForLoadout(
              weapons,
              loadout,
              "git_force_push",
              1,
              true
            );
            const zeroDayGrant = grantAmmoForLoadout(
              pushGrant.updatedWeapons,
              loadout,
              "zero_day",
              1,
              true
            );
            setWeapons(zeroDayGrant.updatedWeapons);
            pickupText = describeAmmoGrants([pushGrant, zeroDayGrant]);
            setScore((s) => s + 200);
          } else if (pickup.itemId === "commit_token") {
            setScore((s) => s + 500);
            earnCrypto(150);
          } else if (pickup.itemId === "ram_expansion") {
            setMaxRam((r) => r + 16);
            setCurrentRam((r) => r + 16);
            setScore((s) => s + 250);
          } else if (pickup.itemId === "crypto_stash") {
            earnCrypto(150);
            setScore((s) => s + 300);
          } else if (pickup.itemId === "bypass_chip") {
            setBypassChips((b) => b + 1);
          }

          floatingTextsRef.current.push({
            id: `pickup-${Date.now()}`,
            x: nextX,
            y: nextY,
            text: pickupText,
            color: pickup.color,
            alpha: 1,
            vy: -0.03,
          });

          setItems((prevItems) =>
            prevItems.map((item) =>
              item.id === pickup.id ? { ...item, collected: true } : item
            )
          );
        }

        // Terminal / Chest Intercept: "T" is the timesheet-locked repo chest,
        // "H" a hex-matrix hacking terminal.
        const tile = currentMaze[nextY][nextX];
        if (gameMode === "roguelike" && (tile === "T" || tile === "H")) {
          if (tile === "T") {
            setGameStatus("timesheet");
          } else {
            hackTerminalPosRef.current = { x: nextX, y: nextY };
            openHackingTerminal(
              campaignRooms[roomIndex]?.securityTier ?? roomIndex + 1
            );
          }
          playNote(440, 0.15);
          return;
        }

        // Exit reached
        if (nextX === EXIT_X && nextY === EXIT_Y) {
          setGameStatus("victory");
          playSuccess();
          retroAudio.playHackSuccess();
          const finalScore = computeRoomExitScore(score, nextMoves, roomCrypto);
          setScore(finalScore);
          if (finalScore > effectiveHighScore) {
            setHighScore(finalScore);
            // Bare numeric string, written raw to keep the stored bytes.
            safeSetRawItem(
              RETRO_LABYRINTH_HIGH_SCORE_KEY,
              finalScore.toString()
            );
            recordArcadeScore("retro-labyrinth", finalScore);
          }

          const updatedProf: CyberdeckProfile = {
            ...profile,
            totalCrypto: profile.totalCrypto + roomCrypto,
            highScore: Math.max(profile.highScore, finalScore),
            runsCompleted: profile.runsCompleted + 1,
          };
          setProfile(updatedProf);
          saveCyberdeckProfile(updatedProf);

          recordEvent("labyrinth_solved", "project_click").catch((err) => {
            logger.error(
              "Failed to record telemetry for labyrinth solution:",
              err
            );
          });
        }
      }
    },
    [
      gameStatus,
      playerPosition,
      boss,
      tspNodes,
      currentMaze,
      movesCount,
      playNote,
      playSuccess,
      gameMode,
      exploredMap,
      roomIndex,
      campaignRooms,
      tspWalls,
      dronesStunned,
      enemies,
      drones,
      items,
      weapons,
      score,
      effectiveHighScore,
      maxPlayerHp,
      maxRam,
      selectedClass,
      currentTheme,
      roomCrypto,
      earnCrypto,
      profile,
      recordEvent,
      openHackingTerminal,
    ]
  );

  // Trigger Active Weapon
  const handleFireWeapon = useCallback(
    (wId: WeaponId) => {
      if (gameStatus !== "playing") return;

      const nowMs = Date.now();
      const res = fireWeapon(
        wId,
        weapons,
        playerPosition.x,
        playerPosition.y,
        playerHp,
        maxPlayerHp,
        enemies,
        boss,
        nowMs,
        currentRam
      );

      if (!res.success) {
        floatingTextsRef.current.push({
          id: `ammo-err-${nowMs}`,
          x: playerPosition.x,
          y: playerPosition.y,
          text: res.message,
          color: "#f43f5e",
          alpha: 1,
          vy: -0.02,
        });
        return;
      }

      // Deduct RAM cost
      const weapon = weapons[wId];
      if (weapon?.ramCost) {
        setCurrentRam((r) => Math.max(0, r - (weapon.ramCost || 0)));
      }

      setWeapons(res.updatedWeapons);
      setEnemies(res.updatedEnemies);
      setBoss(res.updatedBoss);
      setPlayerHp(res.updatedPlayerHp);
      setScore((s) => s + res.scoreGained);
      if (res.cryptoGained) {
        earnCrypto(res.cryptoGained);
      }

      // Audio feedback
      if (wId === "port_scan") {
        retroAudio.playPortScan();
      } else if (wId === "buffer_overflow" || wId === "git_force_push") {
        retroAudio.playExploitBlast();
        if (res.critTriggered) retroAudio.playCriticalHit();
      } else if (wId === "zero_day") {
        retroAudio.playCriticalHit();
      } else if (wId === "stack_overflow") {
        playSuccess();
      } else if (wId === "emp_blast") {
        setDronesStunned(true);
        retroAudio.playAlertPulse();
        setTimeout(() => setDronesStunned(false), 4000);
      } else {
        playNote(330, 0.18);
      }

      if (res.activeSideEffect) {
        setActiveSideEffect(res.activeSideEffect);
      }

      particlesRef.current.push(...res.particles);

      floatingTextsRef.current.push({
        id: `weap-msg-${nowMs}`,
        x: playerPosition.x,
        y: playerPosition.y,
        text: res.critTriggered ? `CRIT! ${res.message}` : res.message,
        color: res.critTriggered ? "#ec4899" : currentTheme.accentColor,
        alpha: 1,
        vy: -0.03,
      });
    },
    [
      gameStatus,
      weapons,
      playerPosition,
      playerHp,
      maxPlayerHp,
      enemies,
      boss,
      currentRam,
      currentTheme,
      playNote,
      playSuccess,
      earnCrypto,
    ]
  );

  // Submit billable hours timesheet in Room 4
  const handleSubmitTimesheet = useCallback(() => {
    setGameStatus("playing");
    playSuccess();
    retroAudio.playHackSuccess();
    setScore((s) => s + 500);
    earnCrypto(150);

    const updatedGrid = currentMaze.map((row) =>
      row.map((cell) => (cell === "T" ? " " : cell))
    );
    setCurrentMaze(updatedGrid);

    floatingTextsRef.current.push({
      id: `timesheet-done-${Date.now()}`,
      x: playerPosition.x,
      y: playerPosition.y,
      text: "TIMESHEET LOGGED: +0.25h (+500 PTS / +150 CRYPTO)",
      color: "#10b981",
      alpha: 1,
      vy: -0.03,
    });
  }, [
    currentMaze,
    playSuccess,
    playerPosition.x,
    playerPosition.y,
    earnCrypto,
  ]);

  // Keyboard controls
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const lowerKey = e.key.toLowerCase();
      if (gameStatus !== "playing") {
        if (gameStatus === "timesheet" && e.key === "Enter") {
          e.preventDefault();
          handleSubmitTimesheet();
        } else if (gameStatus === "hacking" && e.key === "Escape") {
          e.preventDefault();
          closeHackingModal();
        } else if (
          gameStatus === "paused" &&
          (lowerKey === "p" || e.key === "Enter" || e.key === "Escape")
        ) {
          e.preventDefault();
          setGameStatus("playing");
        } else if (
          gameStatus === "caught" &&
          (e.key === "Enter" || lowerKey === "r")
        ) {
          e.preventDefault();
          handleRestart();
        } else if (gameStatus === "victory" && lowerKey === "r") {
          e.preventDefault();
          handleRestart();
        } else if (gameStatus === "victory" && e.key === "Enter") {
          e.preventDefault();
          if (gameMode === "roguelike") {
            // After the last room this starts a new run (#1668).
            handleNextRoom();
          } else {
            handleRestart();
          }
        } else if (OVERLAY_CONSUMED_KEYS.has(e.key)) {
          // Game keys on an overlay do nothing, and must not scroll the page
          // away from the cabinet. A focused button keeps its native Space
          // (#1669).
          const target = e.target as HTMLElement | null;
          const onControl =
            target !== e.currentTarget &&
            !!target?.closest?.("button, a, input, select, textarea");
          if (!(e.key === " " && onControl)) {
            e.preventDefault();
          }
        }
        return;
      }

      if (lowerKey === "p") {
        e.preventDefault();
        setGameStatus("paused");
        return;
      }

      const key = e.key;
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
        "5",
        "c",
        "C",
      ];

      if (interceptKeys.includes(key)) {
        e.preventDefault();
      } else {
        return;
      }

      const isScrambled =
        activeSideEffect?.type === "scrambled_keys" &&
        activeSideEffect.expiresAt > Date.now();

      if (
        key === "1" ||
        key === "2" ||
        key === "3" ||
        key === "4" ||
        key === "5"
      ) {
        const slotIdx = parseInt(key, 10) - 1;
        const weaponId = selectedClass.starterWeapons[slotIdx];
        if (weaponId && weapons[weaponId] && weapons[weaponId].ammo > 0) {
          setActiveWeaponId(weaponId);
          handleFireWeapon(weaponId);
        }
      } else if (key === " ") {
        handleFireWeapon("emp_blast");
      } else if (key.toLowerCase() === "c") {
        setCrtCalibration((prev) => {
          const next = { ...prev, scanlinesEnabled: !prev.scanlinesEnabled };
          saveCRTCalibration(next);
          return next;
        });
      } else if (key === "ArrowUp" || key.toLowerCase() === "w") {
        tryMove(0, isScrambled ? 1 : -1);
      } else if (key === "ArrowDown" || key.toLowerCase() === "s") {
        tryMove(0, isScrambled ? -1 : 1);
      } else if (key === "ArrowLeft" || key.toLowerCase() === "a") {
        tryMove(isScrambled ? 1 : -1, 0);
      } else if (key === "ArrowRight" || key.toLowerCase() === "d") {
        tryMove(isScrambled ? -1 : 1, 0);
      }
    },
    [
      activeSideEffect,
      gameStatus,
      gameMode,
      selectedClass,
      weapons,
      handleFireWeapon,
      handleSubmitTimesheet,
      closeHackingModal,
      handleRestart,
      handleNextRoom,
      tryMove,
    ]
  );

  const handleDirectionalMove = useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      if (gameStatus !== "playing") return;
      const isScrambled =
        activeSideEffect?.type === "scrambled_keys" &&
        activeSideEffect.expiresAt > Date.now();

      if (dir === "up") {
        tryMove(0, isScrambled ? 1 : -1);
      } else if (dir === "down") {
        tryMove(0, isScrambled ? -1 : 1);
      } else if (dir === "left") {
        tryMove(isScrambled ? 1 : -1, 0);
      } else if (dir === "right") {
        tryMove(isScrambled ? -1 : 1, 0);
      }
    },
    [activeSideEffect, gameStatus, tryMove]
  );

  const cycleWeapon = useCallback(() => {
    const starterWeapons = selectedClass.starterWeapons;
    if (!starterWeapons || starterWeapons.length === 0) return;
    const currentIdx = starterWeapons.indexOf(activeWeaponId);

    for (let i = 1; i <= starterWeapons.length; i++) {
      const candidateIdx = (currentIdx + i) % starterWeapons.length;
      const candidateWeaponId = starterWeapons[candidateIdx];
      if (
        candidateWeaponId &&
        weapons[candidateWeaponId] &&
        weapons[candidateWeaponId].ammo > 0
      ) {
        setActiveWeaponId(candidateWeaponId);
        handleFireWeapon(candidateWeaponId);
        break;
      }
    }
  }, [selectedClass.starterWeapons, activeWeaponId, weapons, handleFireWeapon]);

  // Cursor tracking for every campaign room: the TSP room draws a hover
  // highlight from it, and BlinkBrowse also steers the player towards it.
  // Rooms are matched by id, not position, so reordering the campaign
  // cannot strand either mechanic (#1639).
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameMode !== "roguelike" || gameStatus !== "playing") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    const cols = currentMaze[0]?.length || 15;
    const rows = currentMaze.length || 9;

    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;

    if (cellW <= 0 || cellH <= 0) return;

    const rawGridX = Math.floor(canvasX / cellW);
    const rawGridY = Math.floor(canvasY / cellH);

    const gridX = clamp(rawGridX, 0, cols - 1);
    const gridY = clamp(rawGridY, 0, rows - 1);

    cursorGridPosRef.current = { x: gridX, y: gridY };

    if (campaignRooms[roomIndex]?.id !== "blinkbrowse") return;

    if (Math.random() < 0.2) {
      const dx =
        gridX > playerPosition.x ? 1 : gridX < playerPosition.x ? -1 : 0;
      const dy =
        gridY > playerPosition.y ? 1 : gridY < playerPosition.y ? -1 : 0;
      if (dx !== 0 || dy !== 0) {
        tryMove(dx, dy);
      }
    }
  };

  // What still locks the exit in this room, for the objective line (#1321).
  const roomExitLock = useMemo(
    () =>
      gameMode === "roguelike"
        ? getExitLockState(boss, tspNodes)
        : getExitLockState(undefined, undefined),
    [gameMode, boss, tspNodes]
  );

  // Opening the Market or class overlay pauses a running room; closing it
  // returns there paused, or to the result screen it was opened from (#1669).
  const openOverlay = useCallback(
    (overlay: "darknet_shop" | "class_select") => {
      if (gameStatus === overlay) return;
      if (gameStatus !== "darknet_shop" && gameStatus !== "class_select") {
        overlayReturnStatusRef.current =
          gameStatus === "playing" ? "paused" : gameStatus;
      }
      setGameStatus(overlay);
      // Focus the board now: its focus styles shift the layout, and doing
      // that on the first press of an overlay button moved the button out
      // from under the pointer before the click landed.
      containerRef.current?.focus({ preventScroll: true });
    },
    [gameStatus]
  );

  const closeOverlay = useCallback(() => {
    setGameStatus(overlayReturnStatusRef.current);
    containerRef.current?.focus({ preventScroll: true });
  }, []);

  // Choosing a class gives its fresh loadout and restarts the room paused, so
  // nothing fires at the player before they look back at the board. On a
  // room-cleared screen the loadout carries into the next room instead
  // (#1669).
  const chooseClass = useCallback(
    (classId: CyberdeckClassId) => {
      const cls = CYBERDECK_CLASSES[classId] || CYBERDECK_CLASSES.script_kiddie;
      setSelectedClassId(cls.id);
      if (cls.starterWeapons?.[0]) {
        setActiveWeaponId(cls.starterWeapons[0]);
      }
      setMaxPlayerHp(cls.baseHp);
      setMaxRam(cls.baseRam);
      setBypassChips(cls.startBypassChips);
      if (overlayReturnStatusRef.current === "victory") {
        setPlayerHp(cls.baseHp);
        setCurrentRam(cls.baseRam);
        setWeapons(DEFAULT_WEAPONS);
        setGameStatus("victory");
        containerRef.current?.focus({ preventScroll: true });
        return;
      }
      roomEntryVitalsRef.current = {
        ...roomEntryVitalsRef.current,
        hp: cls.baseHp,
        ram: cls.baseRam,
        weapons: DEFAULT_WEAPONS,
      };
      handleRestart();
      setGameStatus("paused");
      containerRef.current?.focus({ preventScroll: true });
    },
    [handleRestart]
  );

  // The Field Manual pauses a running room, the way P does (#1669).
  const handleManualOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) {
      setGameStatus((status) => (status === "playing" ? "paused" : status));
    }
  }, []);

  // Memoized Traveling Salesman Pathfinding Tour
  const tspTour = useMemo(() => {
    return computeShortestTour(
      playerPosition.x,
      playerPosition.y,
      tspNodes,
      EXIT_X,
      EXIT_Y
    ).tour;
  }, [playerPosition.x, playerPosition.y, tspNodes]);

  // Loop State Mirroring Ref for Stable Animation Lifecycle
  const loopStateRef = useRef({
    isMounted,
    currentMaze,
    playerPosition,
    visibleMap,
    exploredMap,
    enemies,
    drones,
    dronesStunned,
    items,
    boss,
    tspNodes,
    tspTour,
    gameMode,
    roomIndex,
    gameStatus,
    activeSideEffect,
    currentTheme,
    crtCalibration,
    playNote,
  });

  useEffect(() => {
    loopStateRef.current = {
      isMounted,
      currentMaze,
      playerPosition,
      visibleMap,
      exploredMap,
      enemies,
      drones,
      dronesStunned,
      items,
      boss,
      tspNodes,
      tspTour,
      gameMode,
      roomIndex,
      gameStatus,
      activeSideEffect,
      currentTheme,
      crtCalibration,
      playNote,
    };
  });

  // Main Real-Time Game Loop
  //
  // The loop runs once mounted while the canvas context is live. The hook's
  // delta is unclamped (maxDeltaMs: Infinity) and clamped to 40 ms below, as
  // before, so the frame clock can rebuild the frame timestamp the engine
  // reads: an anchor taken on the loop's first frame plus the elapsed time.
  // The context listeners set a ref that guards the frame already in flight
  // and a state flag that stops the loop; restoring starts a fresh one.
  const contextLostRef = useRef(false);
  const [isContextLost, setIsContextLost] = useState(false);
  const isLoopActive = isMounted && !isContextLost;
  const frameAnchorRef = useRef<number | null>(null);
  // Phosphor shimmer phase for renderCRTEffects: one step per frame.
  const crtFrameRef = useRef(0);
  // Play time since the last enemy step and classic drone step. Enemies move
  // on elapsed time, not frame count, so a 144 Hz display does not double
  // their speed (#1665).
  const enemyStepElapsedRef = useRef(0);
  const droneStepElapsedRef = useRef(0);
  // The TSP hover highlight reads the rendered campaign, so a new run's
  // rooms replace the old layout on the next frame (#1628).
  const campaignRoomsRef = useRef(campaignRooms);
  useEffect(() => {
    campaignRoomsRef.current = campaignRooms;
  });

  useEffect(() => {
    if (!isMounted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      contextLostRef.current = true;
      setIsContextLost(true);
    };

    const handleContextRestored = () => {
      contextLostRef.current = false;
      setIsContextLost(false);
    };

    canvas.addEventListener("contextlost", handleContextLost);
    canvas.addEventListener("contextrestored", handleContextRestored);
    return () => {
      canvas.removeEventListener("contextlost", handleContextLost);
      canvas.removeEventListener("contextrestored", handleContextRestored);
      contextLostRef.current = false;
      setIsContextLost(false);
    };
  }, [isMounted]);

  // Every fresh loop re-anchors its frame timestamp.
  useEffect(() => {
    if (isLoopActive) frameAnchorRef.current = null;
  }, [isLoopActive]);

  useAnimationFrame(
    (frameDeltaMs, frameClockMs) => {
      if (contextLostRef.current) return;

      if (frameAnchorRef.current === null) {
        frameAnchorRef.current = performance.now() - frameClockMs;
      }
      const timestamp = frameAnchorRef.current + frameClockMs;
      crtFrameRef.current += 1;
      const campaignRooms = campaignRoomsRef.current;

      const {
        currentMaze,
        playerPosition,
        visibleMap,
        exploredMap,
        enemies,
        drones,
        dronesStunned,
        items,
        boss,
        tspNodes,
        tspTour,
        gameMode,
        roomIndex,
        gameStatus,
        activeSideEffect,
        currentTheme,
        crtCalibration,
        playNote,
      } = loopStateRef.current;
      const exitLocked =
        gameMode === "roguelike" && getExitLockState(boss, tspNodes).locked;

      const deltaMs = Math.min(40, frameDeltaMs);

      // 1. Update active side effect expiry. fireWeapon stamps expiresAt on
      // the Date.now() clock, which the key handlers also read, so the loop
      // checks it on that clock rather than the frame timestamp (#1628).
      if (activeSideEffect && activeSideEffect.expiresAt <= Date.now()) {
        setActiveSideEffect(null);
      }

      // 2. Update Enemy AI, one step per ENEMY_STEP_INTERVAL_MS of play.
      // Contact costs HP; the run ends only when HP reaches 0 (#1665).
      if (gameStatus === "playing" && enemies.length > 0 && deltaMs > 0) {
        enemyStepElapsedRef.current += deltaMs;
        if (enemyStepElapsedRef.current >= ENEMY_STEP_INTERVAL_MS) {
          const stepElapsedMs = enemyStepElapsedRef.current;
          enemyStepElapsedRef.current = 0;
          const { updatedEnemies, damageToPlayer } = updateEnemyAI(
            enemies,
            currentMaze,
            playerPosition.x,
            playerPosition.y,
            stepElapsedMs
          );
          setEnemies(updatedEnemies);

          if (damageToPlayer > 0) {
            setPlayerHp((hp) => {
              const nextHp = hp - damageToPlayer;
              if (nextHp <= 0) {
                setGameStatus("caught");
                return 0;
              }
              return nextHp;
            });
            playNote(220, 0.1);
            floatingTextsRef.current.push({
              id: `enemy-hit-${timestamp}`,
              x: playerPosition.x,
              y: playerPosition.y,
              text: `-${damageToPlayer} HP`,
              color: "#ef4444",
              alpha: 1,
              vy: -0.02,
            });
          }
        }
      }

      // 3. Update Boss
      if (
        gameStatus === "playing" &&
        boss &&
        !boss.defeated &&
        gameMode === "roguelike"
      ) {
        const { updatedBoss, spawnedDamage } = updateFaceForgeBoss(
          boss,
          playerPosition.x,
          playerPosition.y,
          timestamp,
          currentMaze[0].length,
          currentMaze.length,
          lastHeadingRef.current &&
            Date.now() - lastHeadingRef.current.at < BOSS_LEAD_WINDOW_MS
            ? lastHeadingRef.current
            : undefined,
          deltaMs
        );
        setBoss(updatedBoss);

        if (spawnedDamage > 0) {
          setPlayerHp((hp) => {
            const nextHp = hp - spawnedDamage;
            if (nextHp <= 0) {
              setGameStatus("caught");
              return 0;
            }
            return nextHp;
          });
          playNote(200, 0.15);
          floatingTextsRef.current.push({
            id: `mesh-hit-${timestamp}`,
            x: playerPosition.x,
            y: playerPosition.y,
            text: `-${spawnedDamage} HP (Vector Hit!)`,
            color: "#ef4444",
            alpha: 1,
            vy: -0.02,
          });
        }
      }

      // 4. Update Classic Drones, one step per
      // CLASSIC_DRONE_STEP_INTERVAL_MS of play.
      if (
        gameStatus === "playing" &&
        !dronesStunned &&
        drones.length > 0 &&
        gameMode === "classic"
      ) {
        droneStepElapsedRef.current += deltaMs;
        if (droneStepElapsedRef.current >= CLASSIC_DRONE_STEP_INTERVAL_MS) {
          droneStepElapsedRef.current = 0;
          setDrones((prev) =>
            prev.map((d) => {
              let nextX = d.x;
              let nextDir = d.dir;
              if (d.dir === "right") {
                if (nextX >= d.maxX) {
                  nextDir = "left";
                  nextX -= 1;
                } else {
                  nextX += 1;
                }
              } else {
                if (nextX <= d.minX) {
                  nextDir = "right";
                  nextX += 1;
                } else {
                  nextX -= 1;
                }
              }

              if (nextX === playerPosition.x && d.y === playerPosition.y) {
                setPlayerHp((hp) => {
                  const nextHp = hp - DRONE_CONTACT_DAMAGE;
                  if (nextHp <= 0) {
                    setGameStatus("caught");
                    return 0;
                  }
                  return nextHp;
                });
                playNote(220, 0.2);
              }

              return { ...d, x: nextX, dir: nextDir };
            })
          );
        }
      }

      // 5. Draw Canvas Frame
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;
          const cols = currentMaze[0]?.length || 15;
          const rows = currentMaze.length || 9;
          const cellW = width / cols;
          const cellH = height / rows;

          // Background Fill using Theme Color
          ctx.fillStyle = currentTheme.bgDark;
          ctx.fillRect(0, 0, width, height);

          // Draw Grid Tiles with Fog of War
          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
              const cell = currentMaze[y][x];
              const px = x * cellW;
              const py = y * cellH;

              const isVis = visibleMap[y]?.[x] ?? true;
              const isExp = exploredMap[y]?.[x] ?? true;

              if (!isExp && gameMode === "roguelike") {
                ctx.fillStyle = "#010804";
                ctx.fillRect(px, py, cellW, cellH);
                continue;
              }

              if (cell === "#") {
                ctx.fillStyle = isVis ? "#1b2a24" : "#101714";
                ctx.fillRect(px, py, cellW, cellH);

                ctx.strokeStyle = isVis
                  ? currentTheme.primaryColor
                  : "rgba(255, 255, 255, 0.14)";
                ctx.lineWidth = 1;
                ctx.strokeRect(px + 0.5, py + 0.5, cellW - 1, cellH - 1);
              } else if (cell === "W") {
                ctx.fillStyle = isVis ? "rgba(168, 85, 247, 0.3)" : "#180829";
                ctx.fillRect(px, py, cellW, cellH);
                ctx.strokeStyle = "#c084fc";
                ctx.lineWidth = 1.5;
                ctx.strokeRect(px + 1, py + 1, cellW - 2, cellH - 2);

                ctx.fillStyle = "#e9d5ff";
                ctx.font = "bold 7px monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("AIRGAP", px + cellW / 2, py + cellH / 2);
              } else if (cell === "T" || cell === "H") {
                ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
                ctx.fillRect(px, py, cellW, cellH);
                ctx.strokeStyle = "#f59e0b";
                ctx.strokeRect(px + 2, py + 2, cellW - 4, cellH - 4);
                ctx.font = "10px monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(
                  cell === "T" ? "🧰" : "💻",
                  px + cellW / 2,
                  py + cellH / 2
                );
              } else if (x === EXIT_X && y === EXIT_Y) {
                const exitColor = exitLocked
                  ? "#ef4444"
                  : currentTheme.primaryColor;
                ctx.fillStyle = exitLocked
                  ? "rgba(239, 68, 68, 0.2)"
                  : "rgba(16, 185, 129, 0.25)";
                ctx.fillRect(px, py, cellW, cellH);

                ctx.strokeStyle = exitColor;
                ctx.lineWidth = 1.5;
                ctx.strokeRect(px + 1.5, py + 1.5, cellW - 3, cellH - 3);

                ctx.fillStyle = exitColor;
                ctx.font = "bold 9px monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(
                  exitLocked ? "LOCK" : "EXIT",
                  px + cellW / 2,
                  py + cellH / 2
                );
              } else {
                ctx.fillStyle = isVis
                  ? currentTheme.glowColor
                  : "rgba(255, 255, 255, 0.08)";
                ctx.beginPath();
                ctx.arc(px + cellW / 2, py + cellH / 2, 1.2, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }

          // C: the exit stays marked through the fog so there is always a goal
          if (
            gameMode === "roguelike" &&
            !(exploredMap[EXIT_Y]?.[EXIT_X] ?? true)
          ) {
            const ex = EXIT_X * cellW;
            const ey = EXIT_Y * cellH;
            ctx.save();
            ctx.setLineDash([2, 2]);
            ctx.strokeStyle = "#f59e0b";
            ctx.lineWidth = 1;
            ctx.strokeRect(ex + 1.5, ey + 1.5, cellW - 3, cellH - 3);
            ctx.fillStyle = "#f59e0b";
            ctx.font = "bold 6px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
              exitLocked ? "LOCK" : "EXIT",
              ex + cellW / 2,
              ey + cellH / 2
            );
            ctx.restore();
          }

          // TSP Route Line in Room 1/3
          if (gameMode === "roguelike" && tspNodes.length > 0) {
            const tour = tspTour;

            ctx.save();
            ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
            ctx.setLineDash([3, 3]);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            tour.forEach((pt, idx) => {
              const ptX = pt.x * cellW + cellW / 2;
              const ptY = pt.y * cellH + cellH / 2;
              if (idx === 0) ctx.moveTo(ptX, ptY);
              else ctx.lineTo(ptX, ptY);
            });
            ctx.stroke();
            ctx.restore();

            tspNodes.forEach((node) => {
              const nx = node.x * cellW + cellW / 2;
              const ny = node.y * cellH + cellH / 2;
              ctx.fillStyle = node.visited
                ? "#10b981"
                : currentTheme.accentColor;
              ctx.beginPath();
              ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
              ctx.fill();
            });
          }

          // Draw Pickups
          items.forEach((item) => {
            if (item.collected) return;
            const ix = item.x * cellW + cellW / 2;
            const iy = item.y * cellH + cellH / 2;
            ctx.font = "10px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(item.symbol, ix, iy);
          });

          // Draw Enemies with CVE Badges
          enemies.forEach((enemy) => {
            const ex = enemy.x * cellW + cellW / 2;
            const ey = enemy.y * cellH + cellH / 2;

            ctx.fillStyle =
              enemy.state === "frozen"
                ? "rgba(56, 189, 248, 0.5)"
                : enemy.state === "confused"
                  ? "rgba(236, 72, 153, 0.4)"
                  : enemy.state === "stunned"
                    ? "rgba(56, 189, 248, 0.3)"
                    : enemy.state === "chase"
                      ? "rgba(239, 68, 68, 0.4)"
                      : "rgba(245, 158, 11, 0.3)";
            ctx.beginPath();
            ctx.arc(ex, ey, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle =
              enemy.state === "frozen"
                ? "#38bdf8"
                : enemy.state === "confused"
                  ? "#ec4899"
                  : enemy.color;
            ctx.beginPath();
            ctx.arc(ex, ey, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Exposed CVE indicator
            if (enemy.cveExposed && enemy.cve) {
              ctx.save();
              ctx.fillStyle = "#ec4899";
              ctx.font = "bold 6px monospace";
              ctx.textAlign = "center";
              ctx.fillText(enemy.cve.substring(0, 4), ex, ey - 6);
              ctx.restore();
            }
          });

          // Draw Classic Stage 2 Drones
          drones.forEach((d) => {
            const dX = d.x * cellW + cellW / 2;
            const dY = d.y * cellH + cellH / 2;

            ctx.fillStyle = dronesStunned
              ? "rgba(56, 189, 248, 0.3)"
              : "rgba(239, 68, 68, 0.3)";
            ctx.beginPath();
            ctx.arc(dX, dY, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = dronesStunned ? "#38bdf8" : "#ef4444";
            ctx.beginPath();
            ctx.arc(dX, dY, 3.5, 0, Math.PI * 2);
            ctx.fill();
          });

          // Draw 3D Wireframe Boss
          if (boss && !boss.defeated && gameMode === "roguelike") {
            const bossCenterX = boss.x * cellW + cellW / 2;
            const bossCenterY = boss.y * cellH + cellH / 2;
            renderWireframeMesh(ctx, boss.mesh, bossCenterX, bossCenterY, true);

            boss.projectiles.forEach((p) => {
              if (!p.alive) return;
              const pX = p.x * cellW + cellW / 2;
              const pY = p.y * cellH + cellH / 2;
              renderWireframeMesh(ctx, p.mesh, pX, pY, false);
            });
          }

          // Draw Player Netrunner Avatar
          const pX = playerPosition.x * cellW + cellW / 2;
          const pY = playerPosition.y * cellH + cellH / 2;

          // An amber "@" cursor block, unlike any node, enemy or pickup
          const blockW = cellW * 0.72;
          const blockH = cellH * 0.72;
          ctx.save();
          ctx.fillStyle = "#f59e0b";
          ctx.fillRect(pX - blockW / 2, pY - blockH / 2, blockW, blockH);
          ctx.strokeStyle = "#fde68a";
          ctx.lineWidth = 1;
          ctx.strokeRect(
            pX - blockW / 2 - 0.5,
            pY - blockH / 2 - 0.5,
            blockW + 1,
            blockH + 1
          );
          ctx.fillStyle = "#0d0e11";
          ctx.font = "bold 10px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("@", pX, pY + 0.5);
          ctx.restore();

          // Draw Particles
          particlesRef.current = particlesRef.current.filter((p) => {
            p.x += p.vx * 0.05;
            p.y += p.vy * 0.05;
            p.alpha -= p.decay;

            if (p.alpha <= 0) return false;

            const partX = p.x * cellW + cellW / 2;
            const partY = p.y * cellH + cellH / 2;

            ctx.save();
            ctx.globalAlpha = Math.max(0, p.alpha);
            if (p.char) {
              ctx.fillStyle = p.color;
              ctx.font = "bold 7px monospace";
              ctx.fillText(p.char, partX, partY);
            } else {
              ctx.fillStyle = p.color;
              ctx.beginPath();
              ctx.arc(partX, partY, p.radius, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();

            return true;
          });

          // Draw Floating Text Notifications
          floatingTextsRef.current = floatingTextsRef.current.filter((ft) => {
            ft.y += ft.vy;
            ft.alpha -= 0.02;

            if (ft.alpha <= 0) return false;

            const tX = ft.x * cellW + cellW / 2;
            const tY = ft.y * cellH + cellH / 2;

            ctx.save();
            ctx.globalAlpha = Math.max(0, ft.alpha);
            ctx.fillStyle = ft.color;
            ctx.font = "bold 8px monospace";
            ctx.textAlign = "center";
            ctx.fillText(ft.text, tX, tY);
            ctx.restore();

            return true;
          });

          // Draw Cursor Hover Highlight Tile
          if (
            cursorGridPosRef.current &&
            gameMode === "roguelike" &&
            campaignRooms[roomIndex]?.id === "tsp" &&
            gameStatus === "playing"
          ) {
            const { x: hx, y: hy } = cursorGridPosRef.current;
            if (hx >= 0 && hx < cols && hy >= 0 && hy < rows) {
              const hpx = hx * cellW;
              const hpy = hy * cellH;
              ctx.save();
              ctx.fillStyle = "rgba(34, 211, 238, 0.2)";
              ctx.fillRect(hpx, hpy, cellW, cellH);
              ctx.strokeStyle = currentTheme.accentColor || "#22d3ee";
              ctx.lineWidth = 1.5;
              ctx.strokeRect(hpx + 0.5, hpy + 0.5, cellW - 1, cellH - 1);
              ctx.restore();
            }
          }

          // Calibrated CRT Post-Processing Pipeline (Phosphor mask, Scanlines, Bloom, Vignette)
          renderCRTEffects(
            ctx,
            width,
            height,
            crtCalibration,
            currentTheme,
            crtFrameRef.current
          );
        }
      }
    },
    { isActive: isLoopActive, maxDeltaMs: Infinity }
  );

  // ASCII Fallback for SSR & Initial Hydration
  const renderAsciiFallback = () => {
    return MAZE.map((row, y) =>
      row
        .map((cell, x) => {
          if (cell === "#") return "█";
          if (x === START_X && y === START_Y) return "@";
          if (x === EXIT_X && y === EXIT_Y) return "E";
          return "·";
        })
        .join(" ")
    ).join("\n");
  };

  if (!isMounted) {
    return (
      <div
        className="relative w-full aspect-[15/9] min-h-[240px] max-h-[100vh] max-h-[100dvh] h-auto bg-neutral-950/80 border border-neutral-900 rounded-2xl flex flex-col items-center justify-center font-mono select-none overflow-hidden my-6"
        data-testid="retro-labyrinth-skeleton"
      >
        <div className="absolute top-3 left-4 right-4 flex justify-between items-center text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
          <span>SYSTEM_LABYRINTH.EXE</span>
          <span className="text-neutral-600">OFFLINE</span>
        </div>

        <pre className="text-[10px] sm:text-[11px] leading-4 tracking-normal text-brand-cyan/60 font-mono select-none text-center p-2">
          {renderAsciiFallback()}
        </pre>

        <div className="absolute bottom-3 left-4 right-4 text-center text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
          [INITIALIZING LABYRINTH ENGINE...]
        </div>
      </div>
    );
  }

  // A class without a 0-Day slot gets the same damage in a weapon it can
  // fire, and the Market card says so (#1667).
  const marketAmmoNote = (category: string) => {
    if (category !== "weapon") return null;
    if (selectedClass.starterWeapons.includes("zero_day")) return null;
    const grant = grantAmmoForLoadout(
      weapons,
      selectedClass.starterWeapons,
      "zero_day",
      2,
      false
    );
    return grant.weaponId
      ? ` Your class has no 0-Day slot, so you get ${describeAmmoGrants([grant])} instead.`
      : " Your class has no weapon that can use it.";
  };

  const isFinalRoom =
    gameMode === "roguelike" && roomIndex >= campaignRooms.length - 1;

  const currentRoom =
    gameMode === "roguelike"
      ? campaignRooms[roomIndex] || campaignRooms[0]
      : stage === 2
        ? generateClassicStage2()
        : generateClassicStage1();

  return (
    <div className="arcade-labyrinth w-full flex flex-col items-center select-none my-6 font-mono">
      {/* Tablet Orientation Recommendation */}
      <TabletOrientationHint className="w-full" />

      <details className="arcade-labyrinth-options w-full">
        <summary className="min-h-12 p-3 cursor-pointer text-xs text-zinc-300">
          Game mode, class & display
        </summary>
        {/* Top HUD Banner: Mode, Class, CRT Theme & Expand Toggle */}
        <div className="mb-2 w-full flex flex-wrap items-center justify-between gap-2 px-1 text-[10px]">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-bold uppercase tracking-wider border transition-all duration-300 ${
                isFocused
                  ? "bg-brand-cyan/10 text-brand-cyan border-brand-cyan/30 shadow-[0_0_10px_rgba(34,211,238,0.15)] animate-pulse"
                  : "bg-neutral-950 text-neutral-500 border-neutral-900"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  isFocused
                    ? "bg-brand-cyan shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                    : "bg-neutral-700"
                }`}
              />
              {isFocused
                ? "Netrunner Breach: ACTIVE"
                : "Click Subnet to Focus & Hack"}
            </span>

            {/* Class Badge */}
            <button
              onClick={() => openOverlay("class_select")}
              className="px-2.5 py-1 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-full flex items-center gap-1 cursor-pointer transition-colors"
              title="Change Cyberdeck Class"
            >
              <span>{selectedClass.icon}</span>
              <span className="font-bold text-brand-cyan">
                {selectedClass.name}
              </span>
            </button>
          </div>

          {/* Mode Selector, CRT Palette & Expand */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <FieldManualButton
              manualId="retro-labyrinth"
              label="Manual"
              onOpenChange={handleManualOpenChange}
            />
            <FullscreenButton
              isFullscreen={isFullscreen}
              onToggle={toggleFullscreen}
              variant="header"
            />

            {/* CRT Theme Switcher */}
            <div className="flex items-center gap-0.5 bg-neutral-900 p-0.5 rounded-lg text-[9px]">
              <button
                onClick={() => setCrtThemeId("emerald")}
                title="Emerald Green (VT220)"
                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                  crtThemeId === "emerald"
                    ? "bg-emerald-500 text-black font-bold"
                    : "text-neutral-400"
                }`}
              >
                🟢
              </button>
              <button
                onClick={() => setCrtThemeId("amber")}
                title="Amber Hacker (IBM 3270)"
                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                  crtThemeId === "amber"
                    ? "bg-amber-500 text-black font-bold"
                    : "text-neutral-400"
                }`}
              >
                🟠
              </button>
              <button
                onClick={() => setCrtThemeId("synthwave")}
                title="Synthwave Neon"
                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                  crtThemeId === "synthwave"
                    ? "bg-pink-500 text-black font-bold"
                    : "text-neutral-400"
                }`}
              >
                🟣
              </button>
              <button
                onClick={() => setCrtThemeId("matrix")}
                title="Matrix Terminal"
                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                  crtThemeId === "matrix"
                    ? "bg-green-600 text-black font-bold"
                    : "text-neutral-400"
                }`}
              >
                🟩
              </button>

              {/* CRT Calibration Trigger */}
              <span className="w-px h-3 bg-neutral-800 mx-0.5" />
              <button
                onClick={() => setIsCRTModalOpen(true)}
                title="Calibrate CRT Display & Phosphor Shaders"
                aria-label="Calibrate CRT Display & Phosphor Shaders"
                className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400 cursor-pointer flex items-center gap-1 transition-colors"
              >
                <IconDeviceTv className="w-3 h-3" />
                <span className="hidden sm:inline">CRT</span>
              </button>
            </div>

            <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-lg text-[9px]">
              <button
                onClick={startRoguelikeCampaign}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  gameMode === "roguelike"
                    ? "bg-brand-cyan text-black font-bold"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Graveyard Roguelike
              </button>
              <button
                onClick={() => switchStage(1)}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  gameMode === "classic" && stage === 1
                    ? "bg-brand-cyan text-black font-bold"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Subnet 01
              </button>
              <button
                onClick={() => switchStage(2)}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  gameMode === "classic" && stage === 2
                    ? "bg-brand-cyan text-black font-bold"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Subnet 02 (Firewall)
              </button>
            </div>
          </div>
        </div>
      </details>
      {/* Main Focusable Game Container */}
      <div
        ref={containerRef}
        tabIndex={0}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        data-keyboard-boundary="true"
        data-field-manual="retro-labyrinth"
        className={`arcade-labyrinth-playfield relative w-full ${
          isFullscreen
            ? "fixed inset-0 z-50 w-full h-[100vh] h-[100dvh] max-h-[100vh] max-h-[100dvh] max-w-none rounded-none border-none bg-black flex flex-col items-center justify-between p-1.5 sm:p-4 select-none touch-none overflow-hidden"
            : "h-auto max-h-[100vh] max-h-[100dvh]"
        } bg-neutral-950/90 border rounded-2xl flex flex-col items-center justify-between p-2.5 overflow-hidden outline-none transition-all duration-300 ${
          isFocused
            ? "border-brand-cyan ring-2 ring-brand-cyan/10 shadow-[0_0_20px_rgba(34,211,238,0.1)] scale-[1.005]"
            : "border-neutral-900"
        }`}
      >
        <FullscreenButton
          isFullscreen={isFullscreen}
          onToggle={toggleFullscreen}
          variant="floating"
        />
        {/* Header HUD: Subnet Badge, HP, RAM, Crypto, Score */}
        <div className="w-full flex flex-wrap justify-between items-center gap-x-3 gap-y-1 text-[10px] font-bold px-2 py-0.5 border-b border-neutral-900/60">
          <div className="flex items-center gap-2">
            <span className="text-neutral-400">
              SYSTEM_LABYRINTH.EXE ·{" "}
              {gameMode === "roguelike"
                ? formatCampaignRoomBadge(currentRoom.badge, roomIndex)
                : currentRoom.badge}
            </span>
            <span className="text-brand-cyan/80 text-[9px] hidden sm:inline truncate max-w-[150px]">
              [{currentRoom.title}]
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {/* Boss HP: the only other feedback is the mesh colour (#1667) */}
            {gameMode === "roguelike" && boss && (
              <div
                className="flex items-center gap-1 text-[9px]"
                data-testid="labyrinth-boss-hp"
              >
                <span className="text-rose-400">BOSS</span>
                <div className="w-14 h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                  <div
                    className="h-full bg-rose-500 transition-all duration-200"
                    style={{
                      width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-neutral-300 font-bold">
                  {boss.defeated ? "DOWN" : boss.hp}
                </span>
              </div>
            )}

            {/* Player HP */}
            <div className="flex items-center gap-1 text-[9px]">
              <span className="text-neutral-500">HP</span>
              <div className="w-14 h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                <div
                  className={`h-full transition-all duration-200 ${
                    playerHp > 50
                      ? "bg-emerald-500"
                      : playerHp > 25
                        ? "bg-amber-500"
                        : "bg-rose-500 animate-pulse"
                  }`}
                  style={{
                    width: `${Math.max(0, (playerHp / maxPlayerHp) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-neutral-300 font-bold">{playerHp}</span>
            </div>

            {/* Cyberdeck RAM */}
            <div className="flex items-center gap-1 text-[9px]">
              <span className="text-cyan-500">RAM</span>
              <div className="w-14 h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                <div
                  className="h-full bg-cyan-500 transition-all duration-200"
                  style={{
                    width: `${Math.max(0, (currentRam / maxRam) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-neutral-300 font-bold">{currentRam}</span>
            </div>

            {/* Crypto Balance */}
            <div
              className="flex items-center gap-1 text-[9px] font-mono text-amber-400 font-bold"
              title="Crypto"
            >
              <span aria-hidden="true">🪙</span>
              <span>{cryptoBounty} Crypto</span>
            </div>

            {/* Total Score & High Score */}
            <div
              className="flex items-center gap-1 text-[9px] font-mono text-brand-cyan font-bold"
              title="Score"
            >
              <span>SCORE: {score}</span>
              {effectiveHighScore > 0 && (
                <span className="text-neutral-500 font-normal">
                  ({effectiveHighScore})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Objective: always say what winning looks like. Short landscape
            screens need every row for the maze, and the in-maze
            "REACH THE EXIT" prompt already carries the goal there. */}
        <p className="w-full px-2 py-0.5 text-[9px] font-bold text-neutral-400 truncate [@media(max-height:500px)]:hidden">
          <span className="text-amber-400">OBJECTIVE</span> ·{" "}
          {roomExitLock.locked ? (
            <>
              <span className="text-rose-400" data-testid="labyrinth-objective">
                {roomExitLock.objective}
              </span>{" "}
              to unlock the <span className="text-amber-400">EXIT</span> (bottom
              right), then guide the <span className="text-amber-400">@</span>{" "}
              there. Bugs and drones cost HP.
            </>
          ) : (
            <>
              Guide the <span className="text-amber-400">@</span> to the{" "}
              <span className="text-amber-400">EXIT</span> (bottom right). Bugs
              and drones cost HP.
            </>
          )}
        </p>

        {/* Active Side-Effect Warning Banner */}
        {activeSideEffect && (
          <div className="w-full bg-rose-950/60 border border-rose-800/60 rounded px-2 py-0.5 my-0.5 flex items-center justify-between text-[9px] text-rose-300 animate-pulse">
            <span>
              ⚠️ {activeSideEffect.title}: {activeSideEffect.description}
            </span>
            <span className="font-bold">ACTIVE</span>
          </div>
        )}

        {/* Game Canvas Container. Height budget: 21rem covers the navbar,
            cabinet header, HUD rows and the hotbar below, so the whole
            stage fits a launched 1280x800 viewport (#1552). */}
        <div
          className={`arcade-labyrinth-canvas relative ${
            isFullscreen
              ? "w-full flex-1 max-h-[var(--layout-viewport-budget,calc(100vh-var(--header-height,80px)-var(--footer-height,48px)))] max-h-[var(--layout-viewport-budget,calc(100dvh-var(--header-height,80px)-var(--footer-height,48px)))] max-h-[calc(100vh-var(--header-height,80px)-var(--footer-height,48px))] max-h-[calc(100dvh-var(--header-height,80px)-var(--footer-height,48px))] aspect-[240/144] min-h-0"
              : "w-[min(100%,calc((100dvh-21rem)*5/3))] min-w-[240px] aspect-[240/144] h-auto"
          } flex items-center justify-center transition-all duration-300 my-auto`}
          style={
            crtCalibration.curvature > 0.05
              ? {
                  borderRadius: `${Math.round(8 + crtCalibration.curvature * 20)}px`,
                  boxShadow: `inset 0 0 ${Math.round(crtCalibration.curvature * 30)}px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)`,
                }
              : undefined
          }
        >
          <canvas
            ref={canvasRef}
            width={240}
            height={144}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={() => {
              cursorGridPosRef.current = null;
            }}
            role="application"
            aria-label="Retro Labyrinth Cyberdeck Dungeon Crawl. Use arrow keys or WASD to navigate, and Tab to access accessible controls."
            tabIndex={0}
            className={`block ${
              isFullscreen
                ? "max-w-full max-h-full aspect-[240/144] object-contain"
                : "w-full aspect-[240/144] h-auto"
            } [image-rendering:pixelated] rounded-lg border border-neutral-900/60 bg-neutral-950 cursor-crosshair focus:outline-none focus:ring-2 focus:ring-emerald-500/50`}
          />

          {/* Off-screen Accessible DOM Fallback Subtree */}
          <div
            className="sr-only"
            aria-label="Retro Labyrinth Accessible Subtree"
          >
            <fieldset>
              <legend>Retro Labyrinth Dungeon Crawl State and Controls</legend>

              <div role="group" aria-label="Dungeon Telemetry and Status">
                <output htmlFor="retro-score">Score: {score}</output>
                <output htmlFor="retro-highscore">
                  High Score: {effectiveHighScore}
                </output>
                <output htmlFor="retro-stage">Stage: {stage}</output>
                <output htmlFor="retro-status">
                  Game Status: {gameStatus}
                </output>
                <output htmlFor="retro-player-pos">
                  Player Location: Grid ({playerPosition.x}, {playerPosition.y})
                </output>
                <output htmlFor="retro-hp">
                  Cyberdeck Integrity: {playerHp} / {maxPlayerHp} HP
                </output>
                {gameMode === "roguelike" && boss && (
                  <output htmlFor="retro-boss-hp">
                    {boss.defeated
                      ? "Boss defeated."
                      : `Boss HP: ${boss.hp} / ${boss.maxHp}`}
                  </output>
                )}
                <output htmlFor="retro-weapon">
                  Active Cyberdeck Weapon: {activeWeaponId}
                </output>
                <output htmlFor="retro-bypass">
                  Bypass Chips: {bypassChips}
                </output>
              </div>

              <div
                role="group"
                aria-label="Interactive Navigation and Combat Actions"
              >
                <button
                  type="button"
                  onClick={() => {
                    handleDirectionalMove("up");
                    announce(
                      `Moved Up to (${playerPosition.x}, ${Math.max(0, playerPosition.y - 1)})`,
                      "polite"
                    );
                  }}
                >
                  Move North / Up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDirectionalMove("down");
                    announce(
                      `Moved Down to (${playerPosition.x}, ${playerPosition.y + 1})`,
                      "polite"
                    );
                  }}
                >
                  Move South / Down
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDirectionalMove("left");
                    announce(
                      `Moved Left to (${Math.max(0, playerPosition.x - 1)}, ${playerPosition.y})`,
                      "polite"
                    );
                  }}
                >
                  Move West / Left
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDirectionalMove("right");
                    announce(
                      `Moved Right to (${playerPosition.x + 1}, ${playerPosition.y})`,
                      "polite"
                    );
                  }}
                >
                  Move East / Right
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleFireWeapon(activeWeaponId);
                    announce(
                      `Dispatched cyber weapon attack: ${activeWeaponId}`,
                      "polite"
                    );
                  }}
                >
                  Execute Selected Cyber Attack ({activeWeaponId})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleUseBypassChip();
                    announce("Used hardware bypass chip.", "polite");
                  }}
                  disabled={bypassChips <= 0}
                >
                  Consume Bypass Chip
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleRestart();
                    announce(
                      "Restarted Cyberdeck Dungeon Simulation.",
                      "polite"
                    );
                  }}
                >
                  Restart Dungeon Simulation
                </button>

                {gameStatus === "victory" && (
                  <button
                    type="button"
                    onClick={() => {
                      handleNextRoom();
                      announce("Navigated to next cyberdeck room.", "polite");
                    }}
                  >
                    Advance to Next Stage
                  </button>
                )}
              </div>
            </fieldset>
          </div>

          {/* Victory Overlay. Clearing the last campaign room ends the run
              with its own card and a new run from Room 01 (#1668). */}
          {gameStatus === "victory" && (
            <div className="absolute inset-0 bg-neutral-950/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-3 rounded-lg border border-brand-cyan/30 z-30">
              <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-1 text-emerald-400 animate-bounce">
                <IconTrophy className="w-4 h-4" />
              </div>
              <h3 className="text-emerald-400 font-bold text-xs uppercase tracking-widest">
                {isFinalRoom ? "RUN COMPLETE" : "MAINFRAME TIER BREACHED"}
              </h3>
              {isFinalRoom && (
                <p className="text-[9px] text-neutral-400 mt-0.5">
                  All {campaignRooms.length} rooms cleared.
                </p>
              )}
              <p className="text-[9px] text-neutral-400 mt-0.5 leading-relaxed">
                Infiltrated in{" "}
                <span className="font-bold text-brand-cyan">{movesCount}</span>{" "}
                moves. Crypto Harvested:{" "}
                <span className="font-bold text-amber-400">+{roomCrypto}</span>
              </p>
              <p className="text-[9px] text-neutral-400">
                Final Score:{" "}
                <span className="font-bold text-brand-cyan">{score}</span>
                {isFinalRoom && (
                  <>
                    {" "}
                    · High Score:{" "}
                    <span className="font-bold text-amber-400">
                      {effectiveHighScore}
                    </span>
                  </>
                )}
              </p>
              <div className="flex gap-2 mt-2">
                {gameMode === "roguelike" && !isFinalRoom ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextRoom();
                      containerRef.current?.focus({ preventScroll: true });
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-brand-cyan hover:bg-cyan-400 text-black text-[9px] font-bold rounded-lg transition-all cursor-pointer shadow-md"
                  >
                    <span>Next Room</span>
                    <IconArrowRight className="w-3 h-3" />
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isFinalRoom) {
                        startRoguelikeCampaign();
                      } else {
                        handleRestart();
                      }
                      containerRef.current?.focus({ preventScroll: true });
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-brand-cyan/40 text-neutral-200 hover:text-brand-cyan text-[9px] font-bold rounded-lg transition-all cursor-pointer"
                  >
                    <IconRefresh className="w-3 h-3" />
                    {isFinalRoom ? "New Run" : "Play Again"}
                  </button>
                )}
              </div>
              <p className="text-[8px] text-neutral-500 mt-1">
                {isFinalRoom
                  ? "Enter for a new run from Room 01 · R to retry this room"
                  : "Enter to continue · R to retry this room"}
              </p>
            </div>
          )}

          {/* Pause Overlay */}
          {gameStatus === "paused" && (
            <div className="absolute inset-0 bg-neutral-950/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-3 rounded-lg border border-brand-cyan/30 z-30">
              <h3 className="text-brand-cyan font-bold text-xs uppercase tracking-widest">
                PAUSED
              </h3>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setGameStatus("playing");
                  containerRef.current?.focus({ preventScroll: true });
                }}
                className="mt-2 px-3 py-1 bg-brand-cyan hover:bg-cyan-400 text-black text-[9px] font-bold rounded-lg transition-all cursor-pointer"
              >
                Resume
              </button>
              <p className="text-[8px] text-neutral-500 mt-1">
                P or Enter to resume
              </p>
            </div>
          )}

          {/* Caught / Game Over Overlay */}
          {gameStatus === "caught" && (
            <div className="absolute inset-0 bg-neutral-950/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-3 rounded-lg border border-rose-500/30 z-30">
              <h3 className="text-rose-400 font-bold text-xs uppercase tracking-widest">
                IP TRACE INTERCEPTED
              </h3>
              <p className="text-[9px] text-neutral-400 mt-1">
                EDR Sentinel Daemons severed your cyberdeck proxy tunnel.
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRestart();
                  containerRef.current?.focus({ preventScroll: true });
                }}
                className="mt-2 px-3 py-1 bg-neutral-900 text-rose-300 border border-rose-800 hover:bg-rose-950 text-[9px] font-bold rounded cursor-pointer transition-colors"
              >
                RETRY BREACH
              </button>
              <p className="text-[8px] text-neutral-500 mt-1">
                Enter or R to retry
              </p>
            </div>
          )}

          {/* Interactive Hex Matrix Hacking Modal Overlay */}
          {gameStatus === "hacking" && hexPuzzle && (
            <div className="absolute inset-0 bg-neutral-950/98 backdrop-blur-md flex flex-col items-center justify-between p-2 rounded-lg border border-cyan-500/40 z-40">
              <div className="w-full flex justify-between items-center text-[9px] font-bold text-cyan-400 border-b border-cyan-900/60 pb-1">
                <div className="flex items-center gap-1">
                  <IconTerminal2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>HEX BUFFER BYPASS MATRIX</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>TARGET: [{hexPuzzle.targetSequence.join(" ")}]</span>
                  <span className="text-amber-400">
                    +{hexPuzzle.rewardCrypto} CRYPTO
                  </span>
                </div>
              </div>

              {/* Buffer Bar */}
              <div className="w-full flex items-center justify-between px-2 py-0.5 text-[8px] bg-neutral-900/80 rounded border border-neutral-800">
                <span className="text-neutral-400">
                  BUFFER [{hexPuzzle.currentInput.length}/
                  {hexPuzzle.maxBufferSize}]:
                </span>
                <span className="text-cyan-300 font-bold">
                  {hexPuzzle.currentInput.length > 0
                    ? hexPuzzle.currentInput.join(" ")
                    : "(EMPTY)"}
                </span>
                <span className="text-pink-400 font-bold">
                  AXIS:{" "}
                  {hexPuzzle.activeAxis === "row"
                    ? `ROW ${hexPuzzle.activeIndex + 1}`
                    : `COL ${hexPuzzle.activeIndex + 1}`}
                </span>
              </div>

              {/* Hex Grid */}
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-1 my-1">
                {hexPuzzle.grid.map((row, rIdx) =>
                  row.map((cell, cIdx) => {
                    const isSelectable =
                      (hexPuzzle.activeAxis === "row" &&
                        rIdx === hexPuzzle.activeIndex) ||
                      (hexPuzzle.activeAxis === "col" &&
                        cIdx === hexPuzzle.activeIndex);

                    return (
                      <button
                        key={`${rIdx}-${cIdx}`}
                        onClick={() => handleHexCellClick(rIdx, cIdx)}
                        disabled={
                          cell.selected || hexPuzzle.solved || hexPuzzle.failed
                        }
                        className={`w-7 h-6 rounded flex items-center justify-center text-[9px] font-bold transition-all cursor-pointer ${
                          cell.selected
                            ? "bg-neutral-900 text-neutral-600 border border-neutral-800"
                            : isSelectable
                              ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400 hover:bg-cyan-500/40 animate-pulse"
                              : "bg-neutral-900/60 text-neutral-500 border border-neutral-900"
                        }`}
                      >
                        {cell.byte}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Feedback text */}
              <div className="text-[8px] font-bold text-center text-cyan-300 px-2 truncate w-full">
                {hackingFeedback}
              </div>

              {/* Minigame Action Footer */}
              <div className="w-full flex items-center justify-between gap-1 pt-1 border-t border-neutral-900/60 text-[8px]">
                <button
                  onClick={handleUseBypassChip}
                  disabled={bypassChips <= 0 || hexPuzzle.solved}
                  className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700 text-emerald-300 hover:bg-emerald-900 disabled:opacity-40 cursor-pointer font-bold"
                >
                  🔌 Hardware Chip ({bypassChips} left)
                </button>

                <button
                  onClick={closeHackingModal}
                  className="px-3 py-0.5 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 cursor-pointer font-bold"
                >
                  {hexPuzzle.solved ? "Complete Decryption" : "Abort [ESC]"}
                </button>
              </div>
            </div>
          )}

          {/* Darknet Vendor Shop Modal */}
          {gameStatus === "darknet_shop" && (
            <div className="absolute inset-0 bg-neutral-950/98 backdrop-blur-md flex flex-col items-center justify-between p-2.5 rounded-lg border border-pink-500/40 z-40">
              <div className="w-full flex justify-between items-center text-[9px] font-bold text-pink-400 border-b border-pink-900/60 pb-1">
                <div className="flex items-center gap-1">
                  <IconShoppingCart className="w-3.5 h-3.5" />
                  <span>DARKNET EXPLOIT BLACK-MARKET</span>
                </div>
                <span className="text-amber-300">
                  🪙 {cryptoBounty} Crypto Available
                </span>
              </div>

              <div className="w-full flex flex-col gap-1 my-1 overflow-y-auto max-h-[140px] pr-1">
                {DARKNET_VENDOR_CATALOG.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-1 bg-neutral-900/80 border border-neutral-800 rounded text-[8px]"
                  >
                    <div className="flex items-center gap-1">
                      <span>{item.icon}</span>
                      <div>
                        <div className="text-neutral-200 font-bold">
                          {item.name}
                        </div>
                        <div className="text-neutral-400 text-[7px]">
                          {item.description}
                          {marketAmmoNote(item.category)}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => buyDarknetItem(item.id)}
                      disabled={
                        cryptoBounty < item.cost ||
                        (item.category === "firmware" && cveFeedActive)
                      }
                      className="px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/40 hover:bg-pink-500/40 disabled:opacity-40 font-bold cursor-pointer whitespace-nowrap"
                    >
                      {item.category === "firmware" && cveFeedActive
                        ? "Active"
                        : `🪙 ${item.cost}`}
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={closeOverlay}
                className="w-full py-0.5 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 rounded text-[8px] font-bold cursor-pointer"
              >
                Close Darknet Market
              </button>
            </div>
          )}

          {/* Cyberdeck Class Select Modal */}
          {gameStatus === "class_select" && (
            <div className="absolute inset-0 bg-neutral-950/98 backdrop-blur-md flex flex-col items-center justify-between p-2.5 rounded-lg border border-cyan-500/40 z-40">
              <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                SELECT CYBERDECK FIRMWARE ARCHETYPE
              </div>

              <div className="grid grid-cols-2 gap-1.5 my-1 w-full max-h-[150px] overflow-y-auto">
                {Object.values(CYBERDECK_CLASSES).map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => chooseClass(cls.id)}
                    className={`p-1.5 rounded border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      selectedClassId === cls.id
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                        : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[9px] text-white">
                        {cls.icon} {cls.name}
                      </span>
                      <span className="text-[7px] text-cyan-400">
                        {cls.baseRam}GB RAM
                      </span>
                    </div>
                    <div className="text-[7px] text-neutral-400 mt-0.5 leading-tight">
                      {cls.passiveBonus}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={closeOverlay}
                className="w-full py-0.5 bg-neutral-800 text-neutral-300 rounded text-[8px] font-bold cursor-pointer"
              >
                Confirm Loadout & Hack
              </button>
            </div>
          )}

          {/* Billable Hours Timesheet Modal (Room 4) */}
          {gameStatus === "timesheet" && (
            <div className="absolute inset-0 bg-neutral-950/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-3 rounded-lg border border-amber-500/40 z-40">
              <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-1 text-amber-400">
                <IconFileText className="w-4 h-4" />
              </div>
              <h3 className="text-amber-400 font-bold text-xs uppercase tracking-wider">
                BILLABLE HOURS INTERRUPT
              </h3>
              <p className="text-[9px] text-neutral-400 mt-0.5 leading-tight">
                Opening this abandoned repo chest requires logging 0.25h of
                admin work.
              </p>
              <div className="w-full max-w-[210px] bg-neutral-900/90 border border-neutral-800 rounded p-1.5 my-1.5 text-left text-[8px] space-y-0.5 text-neutral-300">
                <div>
                  CLIENT:{" "}
                  <span className="text-brand-cyan">Abandoned Repos LLC</span>
                </div>
                <div>
                  TASK:{" "}
                  <span className="text-amber-300">
                    JIRA-404: Refactor Legacy Rust
                  </span>
                </div>
                <div>
                  HOURS:{" "}
                  <span className="text-emerald-400 font-bold">
                    0.25 hrs (Admin)
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSubmitTimesheet();
                  containerRef.current?.focus({ preventScroll: true });
                }}
                className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black text-[9px] font-bold rounded-md transition-all cursor-pointer shadow-md"
              >
                <IconCheck className="w-3 h-3" />
                Submit Timesheet & Open Vault [ENTER]
              </button>
            </div>
          )}
        </div>

        {/* Weapons Hotbar & Controls Footer */}
        <div className="arcade-labyrinth-controls w-full flex flex-col gap-1 px-2 pt-1 border-t border-neutral-900/60">
          <div className="flex flex-wrap items-center justify-between gap-1 text-[8px]">
            {/* Weapon Hotkeys */}
            <div className="flex items-center gap-1 flex-wrap">
              {[0, 1, 2, 3, 4].map((slotIdx) => {
                const keyNum = slotIdx + 1;
                const weaponId = selectedClass.starterWeapons[slotIdx];
                const weapon = weaponId ? weapons[weaponId] : null;
                const isActive = weaponId ? activeWeaponId === weaponId : false;
                const hasAmmo = weapon ? weapon.ammo > 0 : false;
                const isDisabled = !weapon || !hasAmmo;
                const shortLabel = weaponId
                  ? WEAPON_SHORT_LABELS[weaponId] || weapon?.name || weaponId
                  : "---";

                if (!weapon) {
                  return (
                    <button
                      key={`hotbar-slot-${keyNum}`}
                      disabled
                      className="px-1.5 py-0.5 rounded border flex items-center gap-1 bg-neutral-950 text-neutral-600 border-neutral-900 opacity-50 cursor-not-allowed"
                    >
                      <span className="font-bold">
                        [{keyNum}] {shortLabel}
                      </span>
                    </button>
                  );
                }

                return (
                  <button
                    key={`hotbar-slot-${keyNum}`}
                    onClick={() => {
                      if (weaponId && hasAmmo) {
                        setActiveWeaponId(weaponId);
                        handleFireWeapon(weaponId);
                      }
                    }}
                    disabled={isDisabled}
                    className={`px-1.5 py-0.5 rounded border flex items-center gap-1 transition-all ${
                      isDisabled
                        ? "bg-neutral-900/50 text-neutral-600 border-neutral-800/50 cursor-not-allowed opacity-60"
                        : isActive
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.2)] cursor-pointer"
                          : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200 cursor-pointer"
                    }`}
                  >
                    <span className="font-bold">
                      [{keyNum}] {shortLabel}
                    </span>
                    <span
                      className={hasAmmo ? "text-amber-400" : "text-rose-500"}
                    >
                      ({weapon.ammo})
                    </span>
                  </button>
                );
              })}

              <button
                onClick={() => handleFireWeapon("emp_blast")}
                className="px-1.5 py-0.5 rounded border bg-neutral-900 text-cyan-400 border-cyan-800/40 hover:bg-cyan-950 cursor-pointer font-bold"
              >
                [SPACE] EMP
              </button>

              <button
                onClick={() => openOverlay("darknet_shop")}
                className="px-1.5 py-0.5 rounded border bg-pink-950/60 text-pink-300 border-pink-700/60 hover:bg-pink-900 cursor-pointer font-bold"
              >
                🛒 Market
              </button>
            </div>

            {/* Controls string */}
            <div className="text-neutral-500 uppercase tracking-wider hidden md:block">
              WASD / ARROWS · C: CRT SCANLINES
            </div>
          </div>

          {/* Enhanced Touch D-Pad for Mobile & Tablet */}
          <div className="w-full pt-1.5 flex flex-col items-center">
            <DpadActionDock
              onDirectionPress={handleDirectionalMove}
              onActionAPress={() => handleFireWeapon("emp_blast")}
              onActionBPress={cycleWeapon}
              actionALabel="EMP"
              actionBLabel="EXPLOIT"
              className="w-full max-w-sm py-2 px-3"
            />
          </div>
        </div>
      </div>

      {/* CRT Calibration Modal */}
      <CRTCalibrationModal
        isOpen={isCRTModalOpen}
        onClose={() => setIsCRTModalOpen(false)}
        config={crtCalibration}
        onChange={setCrtCalibration}
        themePrimaryColor={currentTheme.primaryColor}
      />
    </div>
  );
};
