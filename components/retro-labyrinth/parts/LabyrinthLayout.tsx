"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { DynamicTabletOrientationHint as TabletOrientationHint } from "@/components/arcade/DynamicTabletOrientationHint";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { IconDeviceTv } from "@tabler/icons-react";
import { DpadActionDock } from "@/components/arcade/ControlDocks";
import { FieldManualButton } from "@/components/FieldManualButton";
import { FullscreenButton } from "@/components/arcade/FullscreenButton";
import {
  controlHint,
  HoldDpad,
  TouchControlsGate,
  swipeDirection,
  TouchButton,
  useControlHint,
  useInputModality,
  type Handedness,
} from "@/components/arcade/mobile";
import { PhoneStage, TabletStage } from "@/components/arcade/stage";
import { DynamicCRTCalibrationModal as CRTCalibrationModal } from "@/components/arcade/DynamicCRTCalibrationModal";
import { useActionInput, type ActionInput } from "@/lib/arcade";
import { triggerHaptic } from "@/lib/haptics";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DarknetMarket } from "@/components/retro-labyrinth/parts/DarknetMarket";
import { RoomClearedCard } from "@/components/retro-labyrinth/parts/RoomClearedCard";
import { ClassSelect } from "@/components/retro-labyrinth/parts/ClassSelect";
import { FirmwareBay } from "@/components/retro-labyrinth/parts/FirmwareBay";
import {
  FINAL_ROOM_HINT,
  RETRY_HINT,
  ROOM_CLEAR_HINT,
} from "@/components/retro-labyrinth/control-hints";
import {
  MARKET_CLOSED_REASON,
  formatRunTime,
} from "@/components/retro-labyrinth/run-rules";
import { useGameFullscreen as useFullscreen } from "@/components/arcade/CabinetFullscreen";
import { useCabinetPauseController } from "@/components/arcade/pause";
import {
  PHONE_TOOL_LABELS,
  WEAPON_SHORT_LABELS,
  phoneToolLabel,
} from "@/components/retro-labyrinth/labels";
import { MazeCanvas } from "@/components/retro-labyrinth/parts/MazeCanvas";
import { HexTerminal } from "@/components/retro-labyrinth/parts/HexTerminal";
import { LabyrinthPhoneHud } from "@/components/retro-labyrinth/parts/LabyrinthPhoneHud";
import { RoomHud } from "@/components/retro-labyrinth/parts/RoomHud";
import { RoomStatusCards } from "@/components/retro-labyrinth/parts/RoomStatusCards";
import { RoomTelemetry } from "@/components/retro-labyrinth/parts/RoomTelemetry";
import { TimesheetCard } from "@/components/retro-labyrinth/parts/TimesheetCard";
import { useOptionalLabyrinthSession } from "@/components/retro-labyrinth/RetroLabyrinthSession";
import {
  EXIT_X,
  EXIT_Y,
  START_X,
  START_Y,
  type GameStatus,
  type LabyrinthOverlay,
} from "@/components/retro-labyrinth/useRetroLabyrinthSession";
import {
  CRT_THEMES,
  STAGE_1_MAZE,
  type CRTThemeId,
  type CyberdeckClassId,
} from "@/lib/dungeon";
import {
  LABYRINTH_ACTIONS,
  type LabyrinthActionName,
  type LabyrinthInputContext,
} from "@/lib/retro-labyrinth/actions";

const MAZE = STAGE_1_MAZE;

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

/** The phosphor themes the display menu offers, default first. */
const PHOSPHOR_THEME_OPTIONS: { id: CRTThemeId; label: string }[] = [
  { id: "emerald", label: "Emerald" },
  { id: "amber", label: "Amber" },
  { id: "matrix", label: "Matrix" },
];

/**
 * A hotbar slot's tool name. Below a 896px cabinet (a 1024x768 window) the
 * slot shows only its key and charges so a boss-room loadout stays on one
 * row (#2840); the name stays in the button's accessible name, and shows
 * while the slot has keyboard focus.
 */
const HOTBAR_NAME_CLASS =
  "sr-only @4xl:not-sr-only group-focus-visible:not-sr-only";

/** How long a phone tool toast stays up before it clears (ADR 0061). */
const PHONE_TOAST_MS = 2200;

// The resume copy names the gesture on touch and the keys elsewhere (ADR 0061).
const RESUME_HINT = controlHint({
  key: "P, Esc or Enter",
  touch: "Tap Resume",
  desktop: "P, Esc or Enter to resume",
});

/** Props for {@link LabyrinthLayout}. */
interface LabyrinthLayoutProps {
  /** False while the cabinet keeps the game mounted but hidden. */
  readonly isMounted?: boolean;
  /**
   * Whether the game runs in the immersive touch cabinet (ADR 0061): the
   * compact layout with docks beside the maze, and the options as a sheet.
   */
  readonly touch: boolean;
  /**
   * Whether that cabinet is a phone's. A phone gets the rotate prompt and the
   * phone stage; a tablet keeps the orientation hint and the tablet stage.
   */
  readonly phone: boolean;
}

/**
 * Retro Labyrinth's layout (ADR 0062): the maze, its HUD, hotbar, cards and
 * controls, drawn from the session above it. The views choose `touch` and
 * `phone` for it, so it reads no device itself. The phone lays out on
 * PhoneStage with its own HUD (#2918), the tablet on TabletStage (#2860,
 * #2861), and the desktop in its column.
 */
export function LabyrinthLayout({
  isMounted = true,
  touch,
  phone,
}: LabyrinthLayoutProps) {
  // The view always sits inside a provider: RetroLabyrinth makes one when the
  // cabinet has not.
  const { session } = useOptionalLabyrinthSession()!;
  const { view, intents } = session;
  const {
    gameStatus,
    gameMode,
    stage,
    roomIndex,
    runLength,
    isFinalRoom,
    currentMaze,
    playerHp,
    maxPlayerHp,
    currentRam,
    maxRam,
    cryptoBounty,
    roomCrypto,
    score,
    highScore: effectiveHighScore,
    movesCount,
    runMoves,
    runCrypto,
    runDamage,
    runTimeMs,
    runRoomNames,
    profile,
    selectedClassId,
    selectedClass,
    crtThemeId,
    currentTheme,
    crtCalibration,
    weapons,
    loadout,
    loadoutHasEmp,
    activeWeaponId,
    dronesStunned,
    activeSideEffect,
    runComplete,
    boss,
    tspNodes,
    exitLock,
    exitLocked,
    wallShiftLabel,
    hexPuzzle,
    marketOpen,
    marketRows,
    route,
    rewardOffer,
    pendingReward,
    rewardPromptShown,
    rewardUnavailable,
    unlockNotice,
  } = view;
  const [isFocused, setIsFocused] = useState(false);
  // Touch cabinet (ADR 0061): a compact layout with controls either side of
  // the maze. The options panel is a sheet there, not an inline disclosure.
  const phoneCabinet = touch;
  // A phone gets the rotate prompt; a tablet keeps the orientation hint.
  const phoneDevice = phone;
  // A portrait tablet has the room for larger keys under the maze.
  const portraitView = useMediaQuery("(orientation: portrait)");
  // A landscape tablet frames the maze with a column each side: the route
  // and the d-pad on the left, the objective and the tools on the right.
  const tabletLandscape = phoneCabinet && !phoneDevice && !portraitView;
  // A portrait tablet puts the route, the objective and the boss bar under
  // the maze and the room status, in the room the docks leave (#2861).
  const tabletPortrait = phoneCabinet && !phoneDevice && portraitView;
  // Key numbers are keyboard hints, so they show only while a keyboard is in use.
  const showKeyHints = useInputModality() === "keyboard";
  const resumeHint = useControlHint(RESUME_HINT);
  const retryHint = useControlHint(RETRY_HINT);
  const roomClearHint = useControlHint(ROOM_CLEAR_HINT);
  const finalRoomHint = useControlHint(FINAL_ROOM_HINT);
  const [optionsOpen, setOptionsOpen] = useState(false);
  // The phone sheet's focus refs and trap are hooks, so they sit above the
  // early return for the unmounted skeleton.
  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  const closeOptionsRef = useRef<HTMLButtonElement>(null);
  // The phone sheet is a modal dialog: focus stays inside it while it is open
  // and returns to the Options key when it closes.
  const optionsSheetRef = useFocusTrap<HTMLElement>(
    phoneCabinet && optionsOpen,
    {
      initialFocusRef: closeOptionsRef,
      returnFocusTo: optionsButtonRef,
    }
  );
  const pauseController = useCabinetPauseController();
  const sheetHoldsPause = phoneCabinet && optionsOpen;
  useEffect(() => {
    if (!sheetHoldsPause) return;
    pauseController.pause("sheet");
    return () => pauseController.resume("sheet");
  }, [sheetHoldsPause, pauseController]);
  const [handedness, setHandedness] = useState<Handedness>("right");
  const swipeStartRef = useRef<{ id: number; x: number; y: number } | null>(
    null
  );
  const [isCRTModalOpen, setIsCRTModalOpen] = useState(false);

  // A phone tool press answers with a short line saying what fired and what
  // happened. It is plain text with no motion, so reduced motion needs nothing.
  const [phoneToast, setPhoneToast] = useState<{
    id: number;
    text: string;
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showPhoneToast = useCallback((text: string) => {
    setPhoneToast({ id: Date.now(), text });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      toastTimerRef.current = null;
      setPhoneToast(null);
    }, PHONE_TOAST_MS);
  }, []);
  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  // A live patrol within two steps warns (amber), and one that can step onto
  // the player next turn is red. Only the phone cabinet warns: the touch player
  // has no sight of the maze's edges to read the danger from (ADR 0061).
  const threatLevel = phoneCabinet ? view.threat : "none";
  const wasRedThreatRef = useRef(false);
  useEffect(() => {
    const wasRed = wasRedThreatRef.current;
    const isRed = threatLevel === "red";
    wasRedThreatRef.current = isRed;
    // Buzz once on the rising edge into red, not on every frame it stays red.
    if (isRed && !wasRed) triggerHaptic([40, 60, 40]);
  }, [threatLevel]);

  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef);
  // Focus the board so its keys work at once. Focus no longer changes the
  // board's size (#1693).
  const refocus = useCallback(() => {
    containerRef.current?.focus({ preventScroll: true });
  }, []);

  // The phone answers each tool press, and the opening exit, with a toast.
  useEffect(
    () =>
      session.subscribe((event) => {
        if (!phoneCabinet) return;
        if (event.type === "toolResult") {
          showPhoneToast(
            event.tool
              ? `${phoneToolLabel(event.tool)}: ${event.outcome}`
              : event.outcome
          );
        } else if (event.type === "exitOpened") {
          showPhoneToast("Exit open: reach the EXIT");
        }
      }),
    [session, phoneCabinet, showPhoneToast]
  );

  const openOverlay = useCallback(
    (overlay: LabyrinthOverlay) => {
      intents.openOverlay(overlay);
      refocus();
    },
    [intents, refocus]
  );
  const closeOverlay = useCallback(() => {
    intents.closeOverlay();
    refocus();
  }, [intents, refocus]);
  const finishHack = useCallback(() => {
    intents.finishHack();
    refocus();
  }, [intents, refocus]);
  const chooseClass = useCallback(
    (classId: CyberdeckClassId) => {
      intents.chooseClass(classId);
      refocus();
    },
    [intents, refocus]
  );
  // The Field Manual pauses a running room, the way P does (#1669).
  const handleManualOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) intents.pause();
    },
    [intents]
  );

  // A finished puzzle disables the cell that was just clicked, which drops
  // focus to the page and left Escape and the arrows dead (#1943). Hand it to
  // the Complete Decryption button instead.
  const hackCloseButtonRef = useRef<HTMLButtonElement>(null);
  const hackFinished = !!(hexPuzzle?.solved || hexPuzzle?.failed);
  useEffect(() => {
    if (hackFinished)
      hackCloseButtonRef.current?.focus({ preventScroll: true });
  }, [hackFinished]);

  // Keys and the gamepad act through the action map (#2376). Only keys pressed
  // with focus in the board act, so the rest of the page keeps its keys.
  const statusRef = useRef<GameStatus>(gameStatus);
  useEffect(() => {
    statusRef.current = gameStatus;
  }, [gameStatus]);
  const handleAction = (input: ActionInput<LabyrinthActionName>) => {
    if (input.phase !== "down") return;
    const status = statusRef.current;
    let handled = true;
    switch (input.action) {
      case "move-up":
        intents.move("up");
        break;
      case "move-down":
        intents.move("down");
        break;
      case "move-left":
        intents.move("left");
        break;
      case "move-right":
        intents.move("right");
        break;
      case "tool-1":
      case "tool-2":
      case "tool-3":
      case "tool-4":
      case "tool-5":
        intents.fireTool(Number(input.action.slice(-1)) - 1);
        break;
      case "emp":
        intents.emp();
        break;
      case "exploit":
        intents.exploit();
        break;
      case "market":
        if (marketOpen) openOverlay("darknet_shop");
        else handled = false;
        break;
      case "crt":
        intents.toggleCrt();
        break;
      case "pause":
        handled = intents.togglePause();
        break;
      case "escape":
        handled = intents.cancel();
        if (handled && (status === "hacking" || status === "darknet_shop"))
          refocus();
        break;
      case "confirm":
        // A focused button (a route or reward pick) answers Enter itself.
        if (
          status === "victory" &&
          document.activeElement instanceof HTMLButtonElement
        ) {
          handled = false;
          break;
        }
        handled = intents.confirm();
        if (handled && status === "hacking") refocus();
        break;
      case "retry":
        handled = intents.retryRoom();
        break;
    }
    if (handled) input.preventDefault();
  };
  useActionInput(LABYRINTH_ACTIONS, handleAction, {
    scopeRef: containerRef,
    getContext: (): LabyrinthInputContext =>
      statusRef.current === "playing" ? "run" : "card",
  });

  // Game keys on an overlay do nothing, and must not scroll the page away
  // from the cabinet. A focused button keeps its native Space (#1669).
  const guardOverlayKeys = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      return;
    }
    if (gameStatus === "playing" || !OVERLAY_CONSUMED_KEYS.has(event.key))
      return;
    const target = event.target as HTMLElement | null;
    const onControl =
      target !== event.currentTarget &&
      !!target?.closest?.("button, a, input, select, textarea");
    if (!(event.key === " " && onControl)) event.preventDefault();
  };

  // Focus management
  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

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

        <pre className="text-[10px] sm:text-[11px] leading-4 tracking-normal text-emerald-400/60 font-mono select-none text-center p-2">
          {renderAsciiFallback()}
        </pre>

        <div className="absolute bottom-3 left-4 right-4 text-center text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
          [INITIALIZING LABYRINTH ENGINE...]
        </div>
      </div>
    );
  }

  // Swipe on the maze (phone only): one drag is one step, and a tap does nothing.
  const handleCanvasPointerDown = (
    event: React.PointerEvent<HTMLCanvasElement>
  ) => {
    if (!phoneCabinet || event.pointerType === "mouse") return;
    swipeStartRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };
  const handleCanvasPointerUp = (
    event: React.PointerEvent<HTMLCanvasElement>
  ) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!phoneCabinet || !start || start.id !== event.pointerId) return;
    const direction = swipeDirection(
      event.clientX - start.x,
      event.clientY - start.y
    );
    if (direction) intents.move(direction);
  };
  const handleCanvasPointerCancel = () => {
    swipeStartRef.current = null;
  };

  // Options open over the maze and pause a running room, so the sheet never
  // hides a live fight. The sheet holds the cabinet's `sheet` pause, which
  // shows no pause overlay over it (ADR 0062). A room the sheet paused comes
  // back paused when it closes, so play never restarts under the player's
  // thumb: the pause becomes the player's own, and Resume continues.
  const openOptionsSheet = () => setOptionsOpen(true);
  const closeOptionsSheet = () => {
    if (statusRef.current === "paused") pauseController.pause("user");
    setOptionsOpen(false);
  };

  const roomBadge =
    gameMode === "roguelike"
      ? `ROOM ${String(roomIndex + 1).padStart(2, "0")}`
      : `SUBNET 0${stage}`;

  // The tablet's HUD row. The phone has its own (LabyrinthPhoneHud).
  const tabletHud = (
    <div className="flex h-full w-full min-w-0 items-center gap-2 pl-1 text-xs font-bold">
      <span
        className="shrink-0 text-neutral-300"
        data-testid="labyrinth-phone-floor"
      >
        {roomBadge}
      </span>
      {wallShiftLabel && (
        <span
          className="hidden landscape:min-[700px]:inline shrink-0 text-amber-300"
          data-testid="labyrinth-wall-telegraph-phone"
        >
          {wallShiftLabel}
        </span>
      )}
      <span className="flex shrink-0 items-center gap-1">
        <span className="text-neutral-400">HP</span>
        <span className="h-2 w-10 overflow-hidden rounded-full border border-neutral-800 bg-neutral-900">
          <span
            className={`block h-full motion-safe:transition-all motion-safe:duration-200 ${
              playerHp > 50
                ? "bg-emerald-500"
                : playerHp > 25
                  ? "bg-amber-500"
                  : "bg-rose-500"
            }`}
            style={{ width: `${Math.max(0, (playerHp / maxPlayerHp) * 100)}%` }}
          />
        </span>
        <span className="text-neutral-300" data-testid="labyrinth-phone-hp">
          {playerHp}
        </span>
      </span>
      {gameMode === "roguelike" && boss && (
        <span
          className="shrink-0 text-rose-400"
          data-testid="labyrinth-phone-boss"
        >
          BOSS {boss.defeated ? "DOWN" : boss.hp}
        </span>
      )}
      <span className="min-w-0 flex-1" aria-hidden="true" />
      <span
        className="shrink-0 text-zinc-100"
        data-testid="labyrinth-phone-score"
      >
        {score}
      </span>
      <span
        className="flex shrink-0 items-center gap-1"
        data-testid="labyrinth-phone-ram"
      >
        {threatLevel !== "none" && (
          <span
            role="status"
            className={`font-bold uppercase ${
              threatLevel === "red" ? "text-rose-400" : "text-amber-400"
            }`}
          >
            {threatLevel === "red" ? "Patrol adjacent" : "Patrol 2 steps out"}
          </span>
        )}
        <span className="text-slate-400">RAM</span>
        <span className="text-neutral-300">
          {currentRam}/{maxRam}
        </span>
      </span>
      <button
        ref={optionsButtonRef}
        type="button"
        onClick={openOptionsSheet}
        aria-expanded={optionsOpen}
        aria-controls="labyrinth-options-sheet"
        className="h-11 shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-xs font-bold text-zinc-200 touch-manipulation active:scale-[0.98]"
      >
        Options
      </button>
    </div>
  );

  // The tablet's room panel, kept to a few short rows: the route and exit, the
  // bars, the tool and EMP with the wall countdown, and the event line. CSS
  // shows it on a portrait tablet only.
  const roomNodes = tspNodes ?? [];
  const routeVisited = roomNodes.filter((node) => node.visited).length;
  const empWeapon = weapons.emp_blast;
  const roomPanel = (
    <section
      aria-label="Room status"
      data-testid="labyrinth-room-panel"
      className="flex min-h-0 flex-col gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 font-mono text-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {roomNodes.length > 0 && (
            <span className="font-bold uppercase tracking-wider text-zinc-400">
              Route {routeVisited}/{roomNodes.length}
            </span>
          )}
          <ul aria-label="Route nodes" className="flex items-center gap-1">
            {roomNodes.map((node, index) => (
              <li
                key={`${node.x},${node.y}`}
                aria-label={`Node ${index + 1} ${node.visited ? "visited" : "not visited"}`}
                className={`flex h-6 min-w-6 items-center justify-center rounded border px-1 text-xs font-bold ${
                  node.visited
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                    : "border-zinc-700 text-zinc-400"
                }`}
              >
                {index + 1}
              </li>
            ))}
          </ul>
        </div>
        <span
          className={`font-bold uppercase tracking-wider ${
            exitLocked ? "text-rose-400" : "text-emerald-400"
          }`}
          data-testid="labyrinth-room-exit"
        >
          {exitLocked ? "Exit locked" : "Exit open"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <span className="w-7 font-bold text-zinc-400">HP</span>
          <span className="block h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-900">
            <span
              className={`block h-full transition-[width] duration-200 ${
                playerHp > 50
                  ? "bg-emerald-500"
                  : playerHp > 25
                    ? "bg-amber-500"
                    : "bg-rose-500"
              }`}
              style={{
                width: `${Math.max(0, (playerHp / maxPlayerHp) * 100)}%`,
              }}
            />
          </span>
          <span className="w-12 text-right font-bold text-zinc-100">
            {playerHp}/{maxPlayerHp}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-8 font-bold text-slate-400">RAM</span>
          <span className="block h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-900">
            <span
              className="block h-full bg-sky-500 transition-[width] duration-200"
              style={{ width: `${Math.max(0, (currentRam / maxRam) * 100)}%` }}
            />
          </span>
          <span className="w-12 text-right font-bold text-zinc-100">
            {currentRam}/{maxRam}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-zinc-200">
          <span className="text-zinc-400">TOOL </span>
          {PHONE_TOOL_LABELS[activeWeaponId] ??
            WEAPON_SHORT_LABELS[activeWeaponId] ??
            weapons[activeWeaponId]?.name ??
            activeWeaponId}
        </span>
        <span
          className={`shrink-0 ${dronesStunned ? "text-cyan-300" : "text-amber-300"}`}
        >
          {empWeapon && empWeapon.maxAmmo >= 999
            ? `EMP ∞ · ${empWeapon.ramCost ?? 0} RAM`
            : `EMP ${empWeapon?.ammo ?? 0}/${empWeapon?.maxAmmo ?? 0}`}
          {dronesStunned ? " · stunned" : ""}
        </span>
        {wallShiftLabel && (
          <span
            className="shrink-0 font-bold text-amber-300"
            data-testid="labyrinth-wall-telegraph-panel"
          >
            {wallShiftLabel}
          </span>
        )}
      </div>
      {phoneToast && (
        <p className="truncate text-amber-200" aria-hidden="true">
          {phoneToast.text}
        </p>
      )}
    </section>
  );

  // The touch tools. Landscape (the phone) keys are 44px tall and wide enough
  // for a 12px label; a portrait tablet scales them to its dock.
  const touchActionGrid = (
    <div
      role="group"
      aria-label="Tools and actions"
      className="grid grid-cols-2 gap-1 portrait:min-[480px]:w-max portrait:min-[480px]:gap-2"
    >
      {[0, 1, 2].map((slotIdx) => {
        const weaponId = loadout[slotIdx];
        // A starter slot holding EMP would duplicate the EMP key, so the key
        // stands for it alone.
        if (weaponId === "emp_blast") return null;
        const weapon = weaponId ? weapons[weaponId] : null;
        const hasAmmo = !!weapon && weapon.ammo > 0;
        const shortLabel = weaponId
          ? PHONE_TOOL_LABELS[weaponId] ||
            WEAPON_SHORT_LABELS[weaponId] ||
            weapon?.name ||
            weaponId
          : "---";
        return (
          <TouchButton
            key={`tool-${slotIdx}`}
            label={
              hasAmmo
                ? `${shortLabel}: fire tool ${slotIdx + 1}`
                : `${shortLabel}: out of ammo`
            }
            disabled={!hasAmmo}
            onPress={() => intents.fireTool(slotIdx)}
            className="relative flex h-11 w-14 portrait:h-[calc((100cqh-0.5rem)/3)] portrait:w-[calc((100cqw-0.25rem)/2)] portrait:min-[480px]:h-[var(--touch-key)] portrait:min-[480px]:w-[var(--touch-key)] flex-col items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-1 text-amber-300 disabled:opacity-40"
          >
            {showKeyHints && (
              <span
                aria-hidden="true"
                className="absolute left-1.5 top-1 text-xs leading-none text-amber-200/80"
              >
                {slotIdx + 1}
              </span>
            )}
            <span className="max-w-full truncate text-xs leading-tight portrait:text-sm portrait:min-[480px]:text-[calc(var(--touch-key)*0.16)]">
              {shortLabel}
            </span>
          </TouchButton>
        );
      })}
      <TouchButton
        label="EMP: fire an EMP burst"
        onPress={intents.emp}
        className="flex h-11 w-14 portrait:h-[calc((100cqh-0.5rem)/3)] portrait:w-[calc((100cqw-0.25rem)/2)] portrait:min-[480px]:h-[var(--touch-key)] portrait:min-[480px]:w-[var(--touch-key)] items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-xs portrait:text-sm portrait:min-[480px]:text-[calc(var(--touch-key)*0.16)] font-bold text-slate-200"
      >
        EMP
      </TouchButton>
      <TouchButton
        label="Exploit: cycle to the next tool and fire it"
        onPress={intents.exploit}
        className="flex h-11 w-14 portrait:h-[calc((100cqh-0.5rem)/3)] portrait:w-[calc((100cqw-0.25rem)/2)] portrait:min-[480px]:h-[var(--touch-key)] portrait:min-[480px]:w-[var(--touch-key)] items-center justify-center rounded-lg border border-cyan-700/60 bg-cyan-950/50 text-xs portrait:text-sm portrait:min-[480px]:text-[calc(var(--touch-key)*0.16)] font-bold text-cyan-200"
      >
        EXPLOIT
      </TouchButton>
      <TouchButton
        label={
          marketOpen
            ? "Market: open the darknet market"
            : `Market: ${MARKET_CLOSED_REASON}`
        }
        disabled={!marketOpen}
        onPress={() => openOverlay("darknet_shop")}
        className="disabled:opacity-40 flex h-11 w-14 portrait:h-[calc((100cqh-0.5rem)/3)] portrait:w-[calc((100cqw-0.25rem)/2)] portrait:min-[480px]:h-[var(--touch-key)] portrait:min-[480px]:w-[var(--touch-key)] items-center justify-center rounded-lg border border-amber-700/50 bg-amber-950/40 text-xs portrait:text-sm portrait:min-[480px]:text-[calc(var(--touch-key)*0.16)] font-bold text-amber-300"
      >
        Market
      </TouchButton>
    </div>
  );

  // Mode, class, phosphor theme and calibration. The desktop disclosure and the
  // phone sheet share this markup.
  const optionsContent = (
    <>
      <div className="mb-2 w-full flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-bold uppercase tracking-wider border transition-all duration-300 ${
              isFocused
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                : "bg-neutral-950 text-neutral-400 border-neutral-900"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                isFocused ? "bg-emerald-400" : "bg-neutral-700"
              }`}
            />
            {/* Both labels share one grid cell, so the pill keeps the
                  width of the longer one and focusing the board never
                  reflows the row under the pointer (#1693). */}
            <span className="grid">
              <span
                className={`col-start-1 row-start-1 ${isFocused ? "" : "invisible"}`}
              >
                Netrunner Breach: ACTIVE
              </span>
              <span
                className={`col-start-1 row-start-1 ${isFocused ? "invisible" : ""}`}
              >
                Click Subnet to Focus &amp; Hack
              </span>
            </span>
          </span>

          {/* Class Badge */}
          <button
            onClick={() => {
              if (phoneCabinet) setOptionsOpen(false);
              openOverlay("class_select");
            }}
            className="px-2.5 py-1 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-full flex items-center gap-1 cursor-pointer transition-colors [@media(pointer:coarse)]:min-h-11"
            title="Change Cyberdeck Class"
          >
            <span>{selectedClass.icon}</span>
            <span className="font-bold text-zinc-100">
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
          {!phoneCabinet && (
            <FullscreenButton
              isFullscreen={isFullscreen}
              onToggle={toggleFullscreen}
              variant="header"
            />
          )}

          {/* Phosphor theme: emerald by default, amber as an option
                (#1522). Synthwave pink is gone (AGENTS.md section 20). */}
          <div
            role="group"
            aria-label="Phosphor theme"
            className="flex items-center gap-0.5 bg-neutral-900 p-0.5 rounded-lg text-xs"
          >
            {PHOSPHOR_THEME_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => intents.setTheme(option.id)}
                title={CRT_THEMES[option.id].name}
                aria-pressed={crtThemeId === option.id}
                className={`px-2 py-1 rounded cursor-pointer inline-flex items-center gap-1.5 [@media(pointer:coarse)]:min-h-11 ${
                  crtThemeId === option.id
                    ? "bg-neutral-800 text-zinc-100 font-bold"
                    : "text-neutral-400 hover:text-zinc-200"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-sm"
                  style={{
                    backgroundColor: CRT_THEMES[option.id].primaryColor,
                  }}
                />
                {option.label}
              </button>
            ))}

            {/* CRT Calibration Trigger */}
            <span className="w-px h-3 bg-neutral-800 mx-0.5" />
            <button
              onClick={() => setIsCRTModalOpen(true)}
              title="Calibrate CRT Display & Phosphor Shaders"
              aria-label="Calibrate CRT Display & Phosphor Shaders"
              className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400 cursor-pointer flex items-center gap-1 transition-colors [@media(pointer:coarse)]:min-h-11"
            >
              <IconDeviceTv className="w-3 h-3" />
              <span className="hidden sm:inline">CRT</span>
            </button>
          </div>

          <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-lg text-xs">
            <button
              onClick={intents.newRun}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors [@media(pointer:coarse)]:min-h-11 ${
                gameMode === "roguelike"
                  ? "bg-amber-500 text-black font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Graveyard Roguelike
            </button>
            <button
              onClick={() => intents.playClassic(1)}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors [@media(pointer:coarse)]:min-h-11 ${
                gameMode === "classic" && stage === 1
                  ? "bg-amber-500 text-black font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Subnet 01
            </button>
            <button
              onClick={() => intents.playClassic(2)}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors [@media(pointer:coarse)]:min-h-11 ${
                gameMode === "classic" && stage === 2
                  ? "bg-amber-500 text-black font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Subnet 02 (Firewall)
            </button>
          </div>
        </div>
      </div>
    </>
  );

  // The playfield (canvas frame, its overlays and the accessible subtree) is
  // one node, so the phone row and the desktop column can both place it.
  const canvasFrameNode = (
    <>
      {/* Game Canvas Container. Height budget: 21rem covers the navbar,
            cabinet header, HUD rows and the hotbar below, so the whole
            stage fits a launched 1280x800 viewport (#1552). */}
      <MazeCanvas
        onFrame={session.onFrame}
        scale={phoneCabinet ? "fractional" : "integer"}
        maxDpr={phoneDevice ? 2 : undefined}
        grid={{
          cols: currentMaze[0]?.length || 15,
          rows: currentMaze.length || 9,
        }}
        onPointAt={intents.pointAt}
        onPointerDown={handleCanvasPointerDown}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerCancel}
        frameClassName={`arcade-labyrinth-canvas relative ${
          phoneCabinet
            ? "min-h-0 min-w-0 flex-1 self-stretch portrait:w-full portrait:aspect-[5/3] portrait:h-auto portrait:flex-none"
            : isFullscreen
              ? "w-full flex-1 max-h-[var(--layout-viewport-budget,calc(100vh-var(--header-height,80px)-var(--footer-height,48px)))] max-h-[var(--layout-viewport-budget,calc(100dvh-var(--header-height,80px)-var(--footer-height,48px)))] max-h-[calc(100vh-var(--header-height,80px)-var(--footer-height,48px))] max-h-[calc(100dvh-var(--header-height,80px)-var(--footer-height,48px))] aspect-[240/144] min-h-0"
              : "w-[min(100%,calc((100dvh-21rem)*5/3))] min-w-[240px] aspect-[240/144] h-auto"
        } flex items-center justify-center transition-all duration-300 ${phoneCabinet ? "" : "my-auto"} ${threatLevel === "red" ? "rounded-lg ring-2 ring-rose-500 motion-safe:animate-pulse" : threatLevel === "amber" ? "rounded-lg ring-2 ring-amber-500 motion-safe:animate-pulse" : ""}`}
        frameStyle={
          crtCalibration.curvature > 0.05
            ? {
                borderRadius: `${Math.round(8 + crtCalibration.curvature * 20)}px`,
                boxShadow: `inset 0 0 ${Math.round(crtCalibration.curvature * 30)}px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)`,
              }
            : undefined
        }
        ariaLabel={
          phoneCabinet
            ? "Retro Labyrinth Cyberdeck Dungeon Crawl. Swipe the maze or use the arrow pad to move."
            : "Retro Labyrinth Cyberdeck Dungeon Crawl. Use arrow keys or WASD to navigate, and Tab to access accessible controls."
        }
        unfittedClassName={
          isFullscreen
            ? "max-w-full max-h-full aspect-[240/144] object-contain"
            : "w-full aspect-[240/144] h-auto"
        }
        canvasClassName={`[image-rendering:pixelated] bg-[#0d0e11] cursor-crosshair ${phoneCabinet ? "touch-none select-none" : ""} focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60`}
      >
        {(canvasSize) => (
          <>
            {/* Active side-effect strip: it overlays the top of the board, so
            the maze does not move while it shows (#2291). It clears with
            the run, so nothing sits behind the run-complete card (#2841). */}
            {activeSideEffect && !runComplete && (
              <div
                data-testid="labyrinth-side-effect"
                className="pointer-events-none absolute inset-x-1 top-1 z-20 mx-auto flex items-center justify-between gap-2 rounded border border-rose-800/60 bg-rose-950/85 px-2 py-0.5 text-xs text-rose-300"
                style={
                  canvasSize
                    ? {
                        // Sit on the board itself, which is centred in its frame.
                        top: `calc(50% - ${canvasSize.cssHeight / 2}px + 4px)`,
                        maxWidth: `${Math.max(0, canvasSize.cssWidth - 8)}px`,
                      }
                    : undefined
                }
              >
                <span className="min-w-0 truncate">
                  ⚠️ {activeSideEffect.title}: {activeSideEffect.description}
                </span>
                <span className="shrink-0 font-bold">ACTIVE</span>
              </div>
            )}

            {/* The phone's HUD has no room for the wall countdown, so it
                sits where the toast does while no toast is up (#2918). */}
            {phoneDevice && wallShiftLabel && !phoneToast && (
              <div
                data-testid="labyrinth-wall-telegraph-phone"
                className="pointer-events-none absolute bottom-2 left-1/2 z-10 w-max max-w-[90%] -translate-x-1/2 rounded border border-amber-500/40 bg-zinc-950/90 px-3 py-1 text-center text-xs font-bold text-amber-300"
              >
                {wallShiftLabel}
              </div>
            )}
            {phoneToast && (
              <div
                key={phoneToast.id}
                role="status"
                aria-live="polite"
                data-testid="labyrinth-phone-toast"
                className="pointer-events-none absolute bottom-2 left-1/2 z-10 w-max max-w-[90%] -translate-x-1/2 rounded border border-amber-500/50 bg-zinc-950/90 px-3 py-1.5 text-center text-xs font-bold text-amber-200"
              >
                {phoneToast.text}
              </div>
            )}

            {/* Off-screen Accessible DOM Fallback Subtree */}
            <RoomTelemetry threatLevel={threatLevel} />

            {/* Victory Overlay. Clearing the last campaign room ends the run
              with its own card and a new run from Room 01 (#1668). */}
            {gameStatus === "victory" && (
              <RoomClearedCard
                isFinalRoom={isFinalRoom}
                campaignRoomCount={runLength}
                runMoves={runMoves}
                runCrypto={runCrypto}
                movesCount={movesCount}
                roomCrypto={roomCrypto}
                score={score}
                highScore={effectiveHighScore}
                showNextRoom={gameMode === "roguelike" && !isFinalRoom}
                hint={isFinalRoom ? finalRoomHint : roomClearHint}
                route={
                  gameMode === "roguelike"
                    ? {
                        seed: route.seed,
                        map: route.map,
                        options: route.options,
                        selected: route.selected,
                        onSelect: intents.chooseRoute,
                      }
                    : undefined
                }
                rewards={
                  gameMode === "roguelike"
                    ? {
                        offer: rewardOffer,
                        selected: pendingReward,
                        onSelect: intents.pickReward,
                        prompt: rewardPromptShown,
                        unavailable: rewardUnavailable,
                      }
                    : undefined
                }
                notice={unlockNotice}
                summary={
                  isFinalRoom
                    ? {
                        roomNames: runRoomNames,
                        damageTaken: runDamage,
                        runTime:
                          runTimeMs === null ? null : formatRunTime(runTimeMs),
                      }
                    : undefined
                }
                onFirmware={
                  isFinalRoom && gameMode === "roguelike"
                    ? () => openOverlay("firmware_bay")
                    : undefined
                }
                onNextRoom={() => {
                  intents.continue();
                  refocus();
                }}
                onRestart={() => {
                  if (isFinalRoom) {
                    intents.newRun();
                  } else {
                    intents.retry();
                  }
                  refocus();
                }}
              />
            )}

            <RoomStatusCards
              phoneCabinet={phoneCabinet}
              resumeHint={resumeHint}
              retryHint={retryHint}
              openOverlay={openOverlay}
              refocus={refocus}
            />

            {/* Interactive Hex Matrix Hacking Modal Overlay */}
            <HexTerminal
              closeButtonRef={hackCloseButtonRef}
              onFinish={finishHack}
            />

            {/* Darknet Vendor Shop Modal: a dialog with a focus trap (ADR 0061). */}
            {gameStatus === "darknet_shop" && (
              <DarknetMarket
                crypto={cryptoBounty}
                rows={marketRows}
                onBuy={intents.buy}
                onClose={closeOverlay}
              />
            )}

            {/* Cyberdeck Class Select dialog (#2179). */}
            {gameStatus === "class_select" && (
              <ClassSelect
                profile={profile}
                selectedClassId={selectedClassId}
                onChoose={chooseClass}
                onOpenFirmware={() => openOverlay("firmware_bay")}
                onClose={closeOverlay}
              />
            )}

            {/* Firmware Bay: spends banked crypto between runs (#2085). */}
            {gameStatus === "firmware_bay" && (
              <FirmwareBay
                bankedCrypto={profile.totalCrypto}
                firmware={profile.firmwareUpgrades}
                onBuy={intents.buyFirmware}
                onClose={closeOverlay}
              />
            )}

            {/* Billable Hours Timesheet Modal (Room 4) */}
            <TimesheetCard onSubmitted={refocus} />
            {phoneCabinet && optionsOpen && (
              <section
                ref={optionsSheetRef}
                id="labyrinth-options-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="labyrinth-options-title"
                data-testid="labyrinth-options-sheet"
                onKeyDown={(event) => {
                  // Escape closes the sheet here and stops there, so the game's own
                  // Escape does not also resume the paused room.
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    closeOptionsSheet();
                  }
                }}
                className="absolute inset-0 z-40 flex flex-col gap-2 overflow-y-auto rounded-lg border border-zinc-700 bg-black/90 p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    id="labyrinth-options-title"
                    className="text-xs font-bold uppercase tracking-wider text-amber-400"
                  >
                    Options
                  </span>
                  <button
                    ref={closeOptionsRef}
                    type="button"
                    onClick={closeOptionsSheet}
                    className="min-h-11 min-w-11 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs font-bold text-zinc-200"
                  >
                    Close options
                  </button>
                </div>
                {optionsContent}
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-300">
                  <span>Dominant hand</span>
                  <div
                    role="group"
                    aria-label="Dominant hand"
                    className="flex gap-1"
                  >
                    {(["right", "left"] as const).map((hand) => (
                      <button
                        key={hand}
                        type="button"
                        aria-pressed={handedness === hand}
                        onClick={() => setHandedness(hand)}
                        className={`min-h-11 min-w-11 rounded-lg border px-3 text-xs font-bold capitalize ${
                          handedness === hand
                            ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                            : "border-zinc-700 bg-zinc-900 text-zinc-300"
                        }`}
                      >
                        {hand}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </MazeCanvas>
    </>
  );

  // The desktop hotbar and touch d-pad strip. The phone uses its own dock.
  const footerNode = (
    <>
      {/* Weapons Hotbar & Controls Footer */}
      <div className="arcade-labyrinth-controls @container w-full flex flex-col gap-1 px-2 pt-1 border-t border-neutral-900/60">
        <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
          {/* Weapon Hotkeys */}
          <div className="flex items-center gap-1 flex-wrap">
            {[0, 1, 2, 3, 4].map((slotIdx) => {
              const keyNum = slotIdx + 1;
              const weaponId = loadout[slotIdx];
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
                      [{keyNum}]{" "}
                      <span className={HOTBAR_NAME_CLASS}>{shortLabel}</span>
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={`hotbar-slot-${keyNum}`}
                  onClick={() => {
                    if (weaponId && hasAmmo) intents.fireTool(slotIdx);
                  }}
                  disabled={isDisabled}
                  className={`group px-1.5 py-0.5 rounded border flex items-center gap-1 transition-all ${
                    isDisabled
                      ? "bg-neutral-900/50 text-neutral-600 border-neutral-800/50 cursor-not-allowed opacity-60"
                      : isActive
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.2)] cursor-pointer"
                        : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200 cursor-pointer"
                  }`}
                >
                  <span className="font-bold">
                    [{weaponId === "emp_blast" ? `${keyNum}/SPACE` : keyNum}]{" "}
                    <span className={HOTBAR_NAME_CLASS}>{shortLabel}</span>
                  </span>
                  <span
                    className={hasAmmo ? "text-amber-400" : "text-rose-500"}
                  >
                    ({weapon.ammo})
                  </span>
                </button>
              );
            })}

            {!loadoutHasEmp && (
              <button
                onClick={intents.emp}
                className="px-1.5 py-0.5 rounded border bg-neutral-900 text-slate-300 border-slate-700 hover:bg-slate-900 cursor-pointer font-bold"
              >
                [SPACE] EMP
              </button>
            )}

            <button
              onClick={() => openOverlay("darknet_shop")}
              disabled={!marketOpen}
              aria-describedby={
                marketOpen ? undefined : "labyrinth-market-closed"
              }
              title={marketOpen ? undefined : MARKET_CLOSED_REASON}
              className="px-1.5 py-0.5 rounded border bg-amber-950/40 text-amber-300 border-amber-700/50 hover:bg-amber-900/40 cursor-pointer font-bold disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-amber-950/40"
            >
              🛒 Market
            </button>
            {!marketOpen && (
              <span
                id="labyrinth-market-closed"
                className="text-[11px] text-neutral-400"
                data-testid="labyrinth-market-closed"
              >
                {MARKET_CLOSED_REASON}
              </span>
            )}
          </div>

          {/* Controls string */}
          <div className="text-neutral-400 uppercase tracking-wider hidden md:block">
            WASD / ARROWS · 1-{loadout.length}: TOOLS · SPACE: EMP · P / ESC:
            PAUSE · C: CRT
          </div>
        </div>

        {/* Enhanced Touch D-Pad for Mobile & Tablet */}
        <div className="w-full pt-1.5 flex flex-col items-center">
          <DpadActionDock
            onDirectionPress={intents.move}
            onActionAPress={intents.emp}
            onActionBPress={intents.exploit}
            actionALabel="EMP"
            actionBLabel="EXPLOIT"
            className="w-full max-w-sm py-2 px-3"
          />
        </div>
      </div>
    </>
  );

  // The landscape tablet's columns (#2860). Each is a card on top and its
  // keys in the bottom corner, under a thumb. Keys are 48px.
  const tabletRouteCard = (
    <section
      aria-label="Route"
      data-testid="labyrinth-tablet-route"
      className="flex min-h-0 flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/80 p-2 font-mono text-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold uppercase tracking-wider text-zinc-400">
          {roomBadge}
        </span>
        {roomNodes.length > 0 && (
          <span className="font-bold text-zinc-300">
            {routeVisited}/{roomNodes.length}
          </span>
        )}
      </div>
      {roomNodes.length > 0 && (
        <ul aria-label="Route nodes" className="grid grid-cols-4 gap-1">
          {roomNodes.map((node, index) => (
            <li
              key={`${node.x},${node.y}`}
              aria-label={`Node ${index + 1} ${node.visited ? "visited" : "not visited"}`}
              className={`flex h-7 items-center justify-center rounded border text-xs font-bold ${
                node.visited
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                  : "border-zinc-700 text-zinc-400"
              }`}
            >
              {index + 1}
            </li>
          ))}
        </ul>
      )}
      <span
        className={`font-bold uppercase tracking-wider ${
          exitLocked ? "text-rose-400" : "text-emerald-400"
        }`}
      >
        {exitLocked ? "Exit locked" : "Exit open"}
      </span>
      {wallShiftLabel && (
        <span className="font-bold text-amber-300">{wallShiftLabel}</span>
      )}
    </section>
  );

  const tabletObjectiveCard = (
    <section
      aria-label="Objective"
      data-testid="labyrinth-tablet-objective"
      className="flex min-h-0 flex-col gap-2 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80 p-2 font-mono text-xs"
    >
      {!runComplete && (
        <p className="line-clamp-3 font-bold text-zinc-300">
          <span className="text-amber-400">OBJECTIVE</span>{" "}
          {exitLock.locked ? exitLock.objective : "Reach the exit"}
        </p>
      )}
      {gameMode === "roguelike" && boss && (
        <div
          className="flex flex-col gap-1"
          data-testid="labyrinth-tablet-boss"
        >
          <div className="flex items-center justify-between gap-2 font-bold">
            <span className="text-rose-400">BOSS</span>
            <span className="text-zinc-200">
              {boss.defeated ? "DOWN" : `${boss.hp}/${boss.maxHp}`}
            </span>
          </div>
          <span className="block h-2 overflow-hidden rounded-full border border-zinc-800 bg-zinc-900">
            <span
              className="block h-full bg-rose-500 motion-safe:transition-[width] motion-safe:duration-200"
              style={{ width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%` }}
            />
          </span>
          {!boss.defeated && boss.phaseTitle && (
            <span className="truncate text-zinc-400">{boss.phaseTitle}</span>
          )}
        </div>
      )}
      {/* Portrait shows EMP in the room status above this card. */}
      {!tabletPortrait && (
        <span
          className={`${dronesStunned ? "text-cyan-300" : "text-amber-300"}`}
        >
          {empWeapon && empWeapon.maxAmmo >= 999
            ? `EMP ∞ · ${empWeapon.ramCost ?? 0} RAM`
            : `EMP ${empWeapon?.ammo ?? 0}/${empWeapon?.maxAmmo ?? 0}`}
          {dronesStunned ? " · stunned" : ""}
        </span>
      )}
      {phoneToast && (
        <p className="line-clamp-2 text-amber-200" aria-hidden="true">
          {phoneToast.text}
        </p>
      )}
    </section>
  );

  const tabletKeyClass =
    "relative flex h-12 w-full flex-col items-center justify-center rounded-lg border px-1 text-xs font-bold disabled:opacity-40";
  const tabletToolGrid = (
    <div
      role="group"
      aria-label="Tools and actions"
      className="grid grid-cols-[repeat(4,minmax(3rem,auto))] gap-1"
    >
      {[0, 1, 2, 3, 4].map((slotIdx) => {
        const weaponId = loadout[slotIdx];
        const weapon = weaponId ? weapons[weaponId] : null;
        const hasAmmo = !!weapon && weapon.ammo > 0;
        const shortLabel = weaponId
          ? PHONE_TOOL_LABELS[weaponId] ||
            WEAPON_SHORT_LABELS[weaponId] ||
            weapon?.name ||
            weaponId
          : "---";
        // The name starts with the key's visible text, so speech input can say
        // what it reads.
        let label = `T${slotIdx + 1}: tool ${slotIdx + 1} is empty`;
        if (weaponId) {
          label = hasAmmo
            ? `T${slotIdx + 1} ${shortLabel}: fire tool ${slotIdx + 1}`
            : `T${slotIdx + 1} ${shortLabel}: tool ${slotIdx + 1} is out of ammo`;
        }
        return (
          <TouchButton
            key={`tablet-tool-${slotIdx}`}
            label={label}
            disabled={!hasAmmo}
            onPress={() => intents.fireTool(slotIdx)}
            className={`${tabletKeyClass} border-zinc-700 bg-zinc-900 text-amber-300`}
          >
            <span className="leading-none text-amber-200/80">
              T{slotIdx + 1}
            </span>{" "}
            <span className="max-w-full truncate leading-tight">
              {weaponId ? shortLabel : "---"}
            </span>
          </TouchButton>
        );
      })}
      <TouchButton
        label="EMP: fire an EMP burst"
        onPress={intents.emp}
        className={`${tabletKeyClass} border-slate-700 bg-slate-900 text-slate-200`}
      >
        EMP
      </TouchButton>
      <TouchButton
        label="Exploit: cycle to the next tool and fire it"
        onPress={intents.exploit}
        className={`${tabletKeyClass} border-cyan-700/60 bg-cyan-950/50 text-cyan-200`}
      >
        EXPLOIT
      </TouchButton>
      <TouchButton
        label={
          marketOpen
            ? "Market: open the darknet market"
            : `Market: ${MARKET_CLOSED_REASON}`
        }
        disabled={!marketOpen}
        onPress={() => openOverlay("darknet_shop")}
        className={`${tabletKeyClass} border-amber-700/50 bg-amber-950/40 text-amber-300`}
      >
        MARKET
      </TouchButton>
    </div>
  );

  const tabletMoveColumn = (
    <div className="flex min-h-0 w-[13.25rem] flex-1 flex-col justify-between gap-2 pb-3">
      {tabletRouteCard}
      <div className="flex justify-start">
        <TouchControlsGate>
          <HoldDpad
            onMove={intents.move}
            paused={gameStatus !== "playing" || optionsOpen}
          />
        </TouchControlsGate>
      </div>
    </div>
  );
  const tabletActionColumn = (
    <div className="flex min-h-0 w-[14.5rem] flex-1 flex-col justify-between gap-2 pb-3">
      {tabletObjectiveCard}
      <div className="flex justify-end">
        <TouchControlsGate>{tabletToolGrid}</TouchControlsGate>
      </div>
    </div>
  );

  // The phone stage (#2918): the HUD row over the d-pad column, the maze and
  // the tool column. The phone only plays landscape (it asks a portrait
  // phone to turn), and the stage mirrors the columns for left-handed
  // players. The maze takes the largest 5:3 box between the columns.
  const phoneStage = (
    <PhoneStage
      orientation="landscape"
      handedness={handedness}
      // The playfield already pads 4px, which the toolbar inset counts too.
      className="[--arcade-stage-edge:4px]"
      hud={
        <LabyrinthPhoneHud
          optionsButtonRef={optionsButtonRef}
          optionsOpen={optionsOpen}
          onOptions={openOptionsSheet}
        />
      }
      // The controls sit in a gate: a keyboard hides them, a touch brings
      // them back (ADR 0061).
      moveDock={
        <TouchControlsGate>
          <HoldDpad
            onMove={intents.move}
            compact
            paused={gameStatus !== "playing" || optionsOpen}
          />
        </TouchControlsGate>
      }
      actionDock={<TouchControlsGate>{touchActionGrid}</TouchControlsGate>}
    >
      {canvasFrameNode}
    </PhoneStage>
  );

  // The tablet stage (#2358). Landscape: movement, maze, tools in one row.
  // Portrait: the maze takes the first full-width row at its own height, the
  // room panel the next, and the movement and tool docks share the rest, so
  // the controls sit under the thumbs. Each portrait dock is a size container
  // below 480px, so its keys scale to fill it. The stage mirrors the docks for
  // left-handed players.
  const tabletStage = (
    <TabletStage
      hud={tabletHud}
      handedness={handedness}
      portraitFill="dock"
      // The playfield already pads 4px, which the toolbar inset counts too.
      className="[--arcade-stage-edge:4px]"
      classNames={{
        hud: "border-b border-neutral-900/60",
        body: "portrait:min-[480px]:pb-[max(0.75rem,env(safe-area-inset-bottom))] portrait:min-[480px]:[--touch-key:clamp(80px,16vw,120px)]",
        // The room panel shows on a portrait screen 480px wide or more.
        status: "hidden portrait:min-[480px]:block",
        moveDock:
          "portrait:grid portrait:grid-cols-1 portrait:grid-rows-1 portrait:[container-type:size] portrait:min-[480px]:self-end portrait:min-[480px]:justify-items-start portrait:min-[480px]:[container-type:normal]",
        actionDock:
          "portrait:h-full portrait:items-center portrait:justify-center portrait:[container-type:size] portrait:min-[480px]:h-auto portrait:min-[480px]:self-end portrait:min-[480px]:items-end portrait:min-[480px]:[container-type:normal]",
      }}
      moveDock={
        tabletLandscape ? (
          tabletMoveColumn
        ) : (
          <TouchControlsGate>
            <HoldDpad
              onMove={intents.move}
              compact={!portraitView}
              large={portraitView}
              paused={gameStatus !== "playing" || optionsOpen}
            />
          </TouchControlsGate>
        )
      }
      status={
        tabletPortrait ? (
          <div className="flex min-h-0 flex-col gap-2">
            {roomPanel}
            <div className="grid min-h-0 grid-cols-2 gap-2">
              {tabletRouteCard}
              {tabletObjectiveCard}
            </div>
          </div>
        ) : (
          roomPanel
        )
      }
      actionDock={
        tabletLandscape ? (
          tabletActionColumn
        ) : (
          <TouchControlsGate>{touchActionGrid}</TouchControlsGate>
        )
      }
    >
      {canvasFrameNode}
    </TabletStage>
  );

  return (
    <div
      className={`arcade-labyrinth w-full flex flex-col select-none font-mono ${
        phoneCabinet ? "min-h-0 flex-1 items-stretch" : "items-center mb-6"
      }`}
    >
      {!phoneDevice && <TabletOrientationHint className="w-full" />}
      {!phoneCabinet && (
        <details
          className="arcade-labyrinth-options w-full"
          open={optionsOpen}
          onToggle={(event) => setOptionsOpen(event.currentTarget.open)}
        >
          <summary className="min-h-12 p-3 cursor-pointer text-xs text-zinc-300">
            Game mode, class & display
          </summary>
          {/* Closed options are inert, so Tab cannot reach them over the playfield. */}
          <div inert={!optionsOpen}>{optionsContent}</div>
        </details>
      )}
      {/* Main Focusable Game Container */}
      <div
        ref={containerRef}
        tabIndex={0}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={guardOverlayKeys}
        data-keyboard-boundary="true"
        // A running or paused room takes Escape for itself (it pauses, then
        // resumes), so the touch cabinet's Escape does not also leave the game
        // (#2569).
        data-escape-docks={
          phoneCabinet && (gameStatus === "playing" || gameStatus === "paused")
            ? "true"
            : undefined
        }
        data-field-manual="retro-labyrinth"
        className={`arcade-labyrinth-playfield relative w-full ${
          phoneCabinet
            ? "min-h-0 flex-1"
            : isFullscreen
              ? "fixed inset-0 z-50 w-full h-[100vh] h-[100dvh] max-h-[100vh] max-h-[100dvh] max-w-none rounded-none border-none bg-black flex flex-col items-center justify-between p-1.5 sm:p-4 select-none touch-none overflow-hidden"
              : "h-auto max-h-[100vh] max-h-[100dvh]"
        } bg-neutral-950/90 border rounded-2xl flex flex-col ${phoneCabinet ? "items-stretch justify-start gap-1 p-1" : "items-center justify-between p-2.5"} overflow-hidden outline-none transition-all duration-300 ${
          isFocused
            ? "border-amber-500/60 ring-2 ring-amber-500/10"
            : "border-neutral-900"
        }`}
      >
        {!phoneCabinet && (
          <FullscreenButton
            isFullscreen={isFullscreen}
            onToggle={toggleFullscreen}
            variant="floating"
          />
        )}
        {!phoneCabinet && <RoomHud />}
        {phoneCabinet
          ? phoneDevice
            ? phoneStage
            : tabletStage
          : canvasFrameNode}
        {!phoneCabinet && footerNode}
      </div>

      {/* CRT Calibration Modal */}
      <CRTCalibrationModal
        isOpen={isCRTModalOpen}
        onClose={() => setIsCRTModalOpen(false)}
        config={crtCalibration}
        onChange={intents.setCrtCalibration}
        themePrimaryColor={currentTheme.primaryColor}
      />
    </div>
  );
}
