"use client";

/**
 * For Better or Bulk (ADR 0060): a real-time co-op setup rush at the
 * Plummer House. This component owns the plan screen, the fixed-step loop,
 * the keyboard, the brothers' text and scoring; the engine owns every rule
 * and the canvas only draws.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  DEFAULT_SETUP,
  IDLE_FRAME,
  THROW_OUT_PROMPT,
  TICK_SECONDS,
  assistJob,
  assistJobKind,
  clockLabel,
  computeReceipt,
  createLevel,
  dailySeed,
  decodeRunCode,
  encodeRunCode,
  getHint,
  getPrompt,
  interactKeyName,
  parseSeed,
  shownPrompts,
  recordedFrame,
  workKeyName,
  runCodeFromHash,
  runResultOf,
  stepGame,
  verifyRun,
  type Category,
  type Frame,
  type GameEvent,
  type GameState,
  type PlayerId,
  type PresenceDecision,
  type Receipt,
  type Setup,
  type SharedRun,
  type SupplyKind,
  CATEGORY_LABELS,
  bankText,
} from "@/lib/for-better-or-bulk";
import {
  recordArcadeScore,
  unlockArcadeTrophies,
} from "@/lib/arcade-achievements";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import { useCanvasResolution } from "@/hooks/useCanvasResolution";
import { useCabinetSetup } from "@/components/arcade/CabinetSetupContext";
import { BrothersDialog } from "./BrothersDialog";
import { buildFrame, GAME_CODES, type ControlMode } from "./input";
import { BurstLayer, RowFlash, useFbbLoud, type DomBurst } from "./bursts";
import {
  activeEventLines,
  CHECKLIST,
  checklistLine,
  completedCategories,
  playStepSounds,
  seedHeader,
  throttleFloorFull,
  type FeedbackEvent,
} from "./messages";
import { CeremonyPlayback } from "./CeremonyPlayback";
import {
  claimJokes,
  jokesFor,
  laptopBadgeShown,
  lineFor,
  type JokeId,
} from "./jokes";
import { countsForBoard } from "./board";
import { playSfx } from "./sfx";
import { readHideTips, subscribeHideTips, writeHideTips } from "./hint-storage";
import { ReceiptView } from "./ReceiptView";
import { ReplayControls, type ReplaySpeed } from "./ReplayControls";
import { NO_REWARD_LINE, runTrophyIds } from "./rewards";
import { SetupScreen } from "./SetupScreen";
import {
  burstLifetime,
  canvasBurstsFor,
  drawVenue,
  VENUE_HEIGHT,
  VENUE_WIDTH,
  type CanvasBurst,
} from "./venue-canvas";

/** The arcade id used for scores, trophies and the cabinet. */
const FBB_GAME_ID = "for-better-or-bulk";

/** Most engine steps one animation frame may run, so a slow frame cannot spiral. */
const MAX_STEPS_PER_FRAME = 8;

/** How long a toast stays up, in milliseconds. */
const TOAST_MS = 3500;

const NAMES: Readonly<Record<PlayerId, string>> = {
  fred: "Fred",
  abbi: "Abbi",
};

/** The crate kinds the side panel counts, in the order it lists them. */
const STOCK_LABELS: readonly { kind: SupplyKind; label: string }[] = [
  { kind: "roses", label: "Roses" },
  { kind: "hotdogs-raw", label: "Hot dogs" },
  { kind: "wings-raw", label: "Wings" },
  { kind: "mac", label: "Mac" },
  { kind: "quinoa", label: "Quinoa" },
  { kind: "lantern", label: "Lanterns" },
  { kind: "chairs", label: "Chairs" },
];

/** Stock left in each crate in play, as one compact line. */
function stockLine(state: GameState): string {
  return STOCK_LABELS.filter(
    ({ kind }) =>
      state.supplies.some((s) => s.kind === kind) &&
      (kind !== "lantern" || state.setup.cart.lanterns)
  )
    .map(({ kind, label }) => `${label} ${state.stock[kind]}`)
    .join(" · ");
}

/** The line that names the key to hold for a work prompt. */
function holdLine(work: string, mode: ControlMode, id: PlayerId): string {
  const keys = workKeyName(id, mode === "coop");
  if (work === THROW_OUT_PROMPT) return `Hold ${keys} to throw it out`;
  return `Hold ${keys}: ${work}`;
}

/**
 * The day's seed from the page's `?seed=` parameter. Junk, a missing value
 * or an out-of-range number gives the standard day, seed 0.
 */
function seedFromUrl(): number {
  if (typeof window === "undefined") return 0;
  return parseSeed(new URLSearchParams(window.location.search).get("seed"));
}

/** Fastest clock the `?speed=` parameter allows. */
const MAX_SPEED = 8;

type Phase = "setup" | "playing" | "playback" | "receipt" | "replay";

/** A finished run that can be shared: the run and its code. */
interface Share {
  readonly run: SharedRun;
  readonly code: string;
}

/** A shared link's run, once read: offered to watch, or refused with why. */
type SharedOffer =
  | { readonly status: "none" }
  | { readonly status: "offer"; readonly run: SharedRun }
  | { readonly status: "refused"; readonly message: string };

/** Where a replay was opened from, so exiting returns there. */
type ReplayOrigin = "setup" | "receipt";

/** The replay in progress: its run, how far it has played, and its speed. */
interface ReplayRun {
  readonly run: SharedRun;
  readonly origin: ReplayOrigin;
  index: number;
  accumulator: number;
  speed: ReplaySpeed;
}

/**
 * Reads a shared link's run code once: decoded, then checked by a strict
 * replay. A damaged or unreplayable code is refused with its message.
 */
function offerFor(code: string): SharedOffer {
  const decoded = decodeRunCode(code);
  if (!decoded.ok) return { status: "refused", message: decoded.message };
  const verified = verifyRun(decoded.run);
  return verified.ok
    ? { status: "offer", run: decoded.run }
    : { status: "refused", message: verified.message };
}

/**
 * The run code for a finished run, only when a strict replay reproduces its
 * result. A run that cannot be encoded or replayed is simply not shared.
 */
function shareFor(run: SharedRun): Share | null {
  try {
    if (!verifyRun(run).ok) return null;
    return { run, code: encodeRunCode(run) };
  } catch {
    return null;
  }
}

/**
 * Clears the `#run=` fragment and keeps the path and query, so a reload no
 * longer offers the shared run. A browser that refuses the change keeps the
 * offer until the next load, which is harmless.
 */
function clearRunHash(): void {
  try {
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`
    );
  } catch {
    // The address bar keeps its fragment; nothing else depends on it.
  }
}

/**
 * A clock multiplier from the page's `?speed=` parameter, 1 to 8, so a long
 * level can be watched or tested quickly. The rules are the same at any
 * speed; only more engine steps run per animation frame.
 */
function speedFromUrl(): number {
  if (typeof window === "undefined") return 1;
  const value = Number(
    new URLSearchParams(window.location.search).get("speed")
  );
  return Number.isInteger(value) && value >= 1 && value <= MAX_SPEED
    ? value
    : 1;
}

interface Toast {
  id: number;
  text: string;
}

/** Whether the viewer asked for less motion. Read when called, not in render. */
function prefersReducedMotion(): boolean {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
  );
}

/** A checklist row whose category just completed; one flash per entry. */
interface RowFlashEntry {
  id: number;
  category: Category;
}

/**
 * Adds one canvas burst and drops the ones that have already run out, timed
 * on the game clock so a paused level keeps its bursts still.
 */
function withBurst(
  bursts: readonly CanvasBurst[],
  burst: CanvasBurst
): CanvasBurst[] {
  return [
    ...bursts.filter(
      (b) => burst.startedAt - b.startedAt < burstLifetime(b.kind)
    ),
    burst,
  ];
}

interface ForBetterOrBulkGameProps {
  /** The plan the setup screen starts from; tests pass their own. */
  initialSetup?: Setup;
  initialMode?: ControlMode;
}

export function ForBetterOrBulkGame({
  initialSetup = DEFAULT_SETUP,
  initialMode = "solo",
}: ForBetterOrBulkGameProps) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [setup, setSetup] = useState<Setup>(() => {
    const seed = seedFromUrl();
    return seed === 0 ? initialSetup : { ...initialSetup, seed };
  });
  const [mode, setMode] = useState<ControlMode>(initialMode);
  const [active, setActive] = useState<PlayerId>("abbi");
  const [view, setView] = useState<GameState | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [textBursts, setTextBursts] = useState<readonly DomBurst[]>([]);
  const [rowFlashes, setRowFlashes] = useState<readonly RowFlashEntry[]>([]);
  const [speed] = useState(speedFromUrl);
  const [share, setShare] = useState<Share | null>(null);
  const [sharedOffer, setSharedOffer] = useState<SharedOffer>({
    status: "none",
  });
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<ReplaySpeed>(1);
  const [replayAnnouncement, setReplayAnnouncement] = useState("");
  // Read once, on mount, so the header does not change across midnight mid-run.
  const [todaysSeed] = useState(() => dailySeed(new Date()));
  const [replayEnded, setReplayEnded] = useState(false);
  const hideTips = useSyncExternalStore(
    subscribeHideTips,
    readHideTips,
    () => false
  );

  const loud = useFbbLoud();
  const cabinet = useCabinetSetup();
  const paused = userPaused || (cabinet?.isSetupOpen ?? false);

  const boundaryRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pauseRef = useRef<HTMLButtonElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const held = useRef(new Set<string>());
  const tapped = useRef(new Set<string>());
  const pressed = useRef(new Set<string>());
  const accumulator = useRef(0);
  const toastId = useRef(0);
  const toastTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const activeRef = useRef<PlayerId>("abbi");
  const floorFullShown = useRef<Partial<Record<PlayerId, number>>>({});
  const canvasBursts = useRef<CanvasBurst[]>([]);
  /** The once-per-level jokes already played in this run. */
  const jokesPlayed = useRef(new Set<JokeId>());
  const burstId = useRef(0);
  /** Every frame the engine applied this run, so the run can be shared. */
  const recorded = useRef<Frame[]>([]);
  const replayRef = useRef<ReplayRun | null>(null);
  /** Whether a helper is on for this day, and the last job kind the live region announced. */
  const helperOnRef = useRef(false);
  const helperKindRef = useRef<string | null>(null);
  /** The one focus move still waiting for a paint, cancelled on unmount. */
  const pendingFocus = useRef<number | null>(null);

  const draw = useCallback(
    (scale: number) => {
      const ctx = canvasRef.current?.getContext("2d");
      const state = stateRef.current;
      if (!ctx || !state) return;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      // Bursts are drawn only in the loud cabinet; the game clock times them.
      drawVenue(
        ctx,
        state,
        mode === "solo" ? activeRef.current : null,
        canvasBurstsFor(loud, canvasBursts.current)
      );
    },
    [mode, loud]
  );

  const scaleRef = useCanvasResolution({
    canvasRef,
    logicalWidth: VENUE_WIDTH,
    logicalHeight: VENUE_HEIGHT,
    active: phase === "playing" || phase === "replay",
    onResize: draw,
  });

  const pushMessages = useCallback(
    (
      events: readonly GameEvent[],
      jokesOf: ReadonlyMap<FeedbackEvent, readonly JokeId[]>
    ) => {
      const lines = events
        .map((event) => lineFor(event, jokesOf.get(event) ?? []))
        .filter((line): line is string => line !== null);
      if (lines.length === 0) return;
      // Toasts are aria-hidden, so the live region carries every line of the batch.
      setAnnouncement(lines.join(" "));
      const added = lines.map((text) => ({ id: ++toastId.current, text }));
      setToasts((current) => [...current, ...added].slice(-3));
      const timer = setTimeout(() => {
        toastTimers.current.delete(timer);
        setToasts((current) =>
          current.filter((t) => !added.some((a) => a.id === t.id))
        );
      }, TOAST_MS);
      toastTimers.current.add(timer);
    },
    []
  );

  useEffect(() => {
    const timers = toastTimers.current;
    return () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const finish = useCallback(
    (state: GameState) => {
      const result = computeReceipt(state);
      setReceipt(result);
      setPhase("playback");
      const outcome = runResultOf(state);
      setShare(
        shareFor({
          setup: state.setup,
          frames: [...recorded.current],
          result: outcome,
        })
      );
      // Only a standard day at normal speed may replace the board score.
      if (countsForBoard(state, speed)) {
        recordArcadeScore(FBB_GAME_ID, outcome.placements, {
          title: result.title,
        });
      }
      const trophies = runTrophyIds(state, result.stars, speed);
      if (trophies.length > 0) unlockArcadeTrophies(trophies);
    },
    [speed]
  );

  const removeTextBurst = useCallback((id: number) => {
    setTextBursts((current) => current.filter((b) => b.id !== id));
  }, []);

  const removeRowFlash = useCallback((id: number) => {
    setRowFlashes((current) => current.filter((f) => f.id !== id));
  }, []);

  /**
   * Sound and bursts for one step's events. Sound plays only at 1x, and the
   * engine's mute decides the rest. Bursts show only in the loud cabinet.
   */
  const feedback = useCallback(
    (
      events: readonly FeedbackEvent[],
      state: GameState,
      jokesOf: ReadonlyMap<FeedbackEvent, readonly JokeId[]>
    ) => {
      if (speed === 1) playStepSounds(events, playSfx);
      for (const event of events) {
        if (!loud) continue;
        if (event.type === "target-filled") {
          const target = state.targets.find((t) => t.id === event.target);
          if (target) {
            canvasBursts.current = withBurst(canvasBursts.current, {
              kind: "ring",
              x: target.x,
              y: target.y,
              startedAt: state.time,
            });
          }
        } else if (event.type === "burnt") {
          const station = state.stations.find((s) => s.id === event.station);
          if (station) {
            canvasBursts.current = withBurst(canvasBursts.current, {
              kind: "charcoal",
              x: station.x,
              y: station.y,
              startedAt: state.time,
            });
          }
        } else if (event.type === "simplified") {
          const target = state.targets.find((t) => t.id === event.target);
          if (target) {
            canvasBursts.current = withBurst(canvasBursts.current, {
              kind: "crumple",
              x: target.x,
              y: target.y,
              startedAt: state.time,
            });
          }
        } else if (jokesOf.get(event)?.includes("roses-yes")) {
          canvasBursts.current = withBurst(canvasBursts.current, {
            kind: "roses",
            x: 0,
            y: 0,
            startedAt: state.time,
          });
        } else if (event.type === "brothers-text") {
          burstId.current += 1;
          const id = burstId.current;
          setTextBursts((current) => [
            ...current,
            { id, text: "The brothers are texting" },
          ]);
        } else if (event.type === "category-complete") {
          burstId.current += 1;
          const id = burstId.current;
          setRowFlashes((current) => [
            ...current,
            { id, category: event.category },
          ]);
        }
      }
    },
    [speed, loud]
  );

  /**
   * The one path for every engine step (the loop, a swap and a decision):
   * applies the frame, shows the new state and finishes the level if it ended.
   */
  const step = useCallback(
    (frame: Frame): GameState | null => {
      const state = stateRef.current;
      if (!state) return null;
      const result = stepGame(state, frame);
      if (state.phase !== "done") {
        recorded.current.push(recordedFrame(state, frame));
      }
      stateRef.current = result.state;
      // The helper's job line is announced when its kind changes (carrying,
      // waiting, away), not when its target changes. It goes first, so an event
      // line in the same step still speaks.
      if (
        helperOnRef.current &&
        replayRef.current === null &&
        result.state.phase === "playing"
      ) {
        const helperId: PlayerId =
          activeRef.current === "fred" ? "abbi" : "fred";
        const kind = assistJobKind(result.state, helperId);
        if (kind !== helperKindRef.current) {
          helperKindRef.current = kind;
          setAnnouncement(assistJob(result.state, helperId));
        }
      }
      const shown = throttleFloorFull(
        result.events,
        result.state.time,
        floorFullShown.current
      );
      // Claimed in event order, so a once-per-level joke lands on its first trigger only.
      const jokesOf = new Map<FeedbackEvent, readonly JokeId[]>();
      for (const event of shown) {
        jokesOf.set(
          event,
          claimJokes(jokesFor(event, result.state), jokesPlayed.current)
        );
      }
      pushMessages(shown, jokesOf);
      const events: FeedbackEvent[] = [
        ...shown,
        ...completedCategories(state, result.state).map((category) => ({
          type: "category-complete" as const,
          category,
        })),
      ];
      feedback(events, result.state, jokesOf);
      setView(result.state);
      if (result.state.phase === "done") finish(result.state);
      return result.state;
    },
    [pushMessages, finish, feedback]
  );

  /** Moves focus after the next paint, replacing any move still waiting. */
  const focusAfterPaint = useCallback((task: () => void) => {
    if (pendingFocus.current !== null)
      cancelAnimationFrame(pendingFocus.current);
    pendingFocus.current = requestAnimationFrame(() => {
      pendingFocus.current = null;
      task();
    });
  }, []);

  useEffect(() => {
    return () => {
      if (pendingFocus.current !== null) {
        cancelAnimationFrame(pendingFocus.current);
        pendingFocus.current = null;
      }
    };
  }, []);

  const start = useCallback(
    (next: Setup, nextMode: ControlMode) => {
      canvasBursts.current = [];
      jokesPlayed.current = new Set();
      recorded.current = [];
      replayRef.current = null;
      setShare(null);
      setReplayPlaying(false);
      setTextBursts([]);
      setRowFlashes([]);
      setSetup(next);
      setMode(nextMode);
      const state = createLevel(next);
      stateRef.current = state;
      accumulator.current = 0;
      held.current.clear();
      tapped.current.clear();
      pressed.current.clear();
      floorFullShown.current = {};
      activeRef.current = "abbi";
      setActive("abbi");
      setView(state);
      setReceipt(null);
      setUserPaused(false);
      setToasts([]);
      // A helper day opens with the helper's job line (Fred helps Abbi here),
      // so the live region says it once, and later only when the job's kind changes.
      const helperOn = nextMode === "solo" && next.assist === true;
      helperOnRef.current = helperOn;
      helperKindRef.current = helperOn ? assistJobKind(state, "fred") : null;
      setAnnouncement(
        helperOn
          ? `Setup has started. It is 9:00. ${assistJob(state, "fred")}`
          : "Setup has started. It is 9:00."
      );
      setPhase("playing");
      focusAfterPaint(() => {
        const cabinetEl = boundaryRef.current;
        cabinetEl?.focus({ preventScroll: true });
        // The header and status line sit under the sticky navbar unless the
        // page scrolls them in; the cabinet's scroll-margin-top clears the bar.
        if (cabinetEl && typeof cabinetEl.scrollIntoView === "function") {
          cabinetEl.scrollIntoView({
            block: "start",
            behavior: prefersReducedMotion() ? "auto" : "smooth",
          });
        }
      });
    },
    [focusAfterPaint]
  );

  const decide = (decision: PresenceDecision) => {
    if (userPaused) return;
    tapped.current.clear();
    step({ ...IDLE_FRAME, decision });
    boundaryRef.current?.focus({ preventScroll: true });
  };

  /** Pauses or resumes the clock and says so to screen readers. */
  const setPaused = (next: boolean) => {
    // Keys held when the clock stops would otherwise still be "down" on resume.
    held.current.clear();
    tapped.current.clear();
    pressed.current.clear();
    setUserPaused(next);
    setAnnouncement(next ? "Paused. Choose Resume to continue." : "Resumed.");
  };

  /** Opens a replay of a verified run: from the receipt or a shared link. */
  const beginReplay = (run: SharedRun, origin: ReplayOrigin) => {
    const state = createLevel(run.setup);
    stateRef.current = state;
    canvasBursts.current = [];
    jokesPlayed.current = new Set();
    setTextBursts([]);
    setRowFlashes([]);
    replayRef.current = { run, origin, index: 0, accumulator: 0, speed: 1 };
    setView(state);
    setReplaySpeed(1);
    setReplayEnded(false);
    setReplayPlaying(true);
    setReplayAnnouncement(
      `Replay started at ${clockLabel(0, state.duration)}.`
    );
    setPhase("replay");
  };

  /** Plays the replay's frames through the engine. Replays never score. */
  const advanceReplay = (deltaMs: number) => {
    const rep = replayRef.current;
    const current = stateRef.current;
    if (!rep || !current) return;
    rep.accumulator += (deltaMs / 1000) * rep.speed;
    const maxSteps = MAX_STEPS_PER_FRAME * rep.speed;
    const frames = rep.run.frames;
    let next = current;
    let steps = 0;
    while (
      rep.accumulator >= TICK_SECONDS &&
      steps < maxSteps &&
      rep.index < frames.length &&
      next.phase !== "done"
    ) {
      const frame = frames[rep.index];
      if (!frame) break;
      next = stepGame(next, frame).state;
      rep.index += 1;
      rep.accumulator -= TICK_SECONDS;
      steps += 1;
    }
    if (steps === maxSteps) rep.accumulator = 0;
    if (steps === 0) return;
    stateRef.current = next;
    setView(next);
    draw(scaleRef.current);
    if (next.phase === "done" || rep.index >= frames.length) {
      setReplayPlaying(false);
      setReplayEnded(true);
      clearRunHash();
      setReplayAnnouncement(
        `Replay finished at ${clockLabel(next.time, next.duration)}.`
      );
    }
  };

  const restartReplay = () => {
    const rep = replayRef.current;
    if (!rep) return;
    const state = createLevel(rep.run.setup);
    stateRef.current = state;
    rep.index = 0;
    rep.accumulator = 0;
    canvasBursts.current = [];
    jokesPlayed.current = new Set();
    setView(state);
    setReplayEnded(false);
    setReplayPlaying(true);
    setReplayAnnouncement(
      `Replay restarted at ${clockLabel(0, state.duration)}.`
    );
  };

  const toggleReplay = () => {
    const rep = replayRef.current;
    const current = stateRef.current;
    if (!rep || !current) return;
    if (replayPlaying) {
      setReplayPlaying(false);
      setReplayAnnouncement(
        `Replay paused at ${clockLabel(current.time, current.duration)}.`
      );
      return;
    }
    if (current.phase === "done" || rep.index >= rep.run.frames.length) {
      restartReplay();
      return;
    }
    setReplayPlaying(true);
    setReplayAnnouncement(`Replay playing at ${rep.speed}x.`);
  };

  const changeReplaySpeed = (next: ReplaySpeed) => {
    const rep = replayRef.current;
    if (!rep) return;
    rep.speed = next;
    setReplaySpeed(next);
    setReplayAnnouncement(`Replay speed ${next}x.`);
  };

  /** Leaves the replay and puts focus back on the control that opened it. */
  const exitReplay = () => {
    const origin = replayRef.current?.origin ?? "setup";
    replayRef.current = null;
    stateRef.current = null;
    setReplayPlaying(false);
    setReplayEnded(false);
    setReplayAnnouncement("Replay closed.");
    clearRunHash();
    setPhase(origin === "receipt" ? "receipt" : "setup");
    const trigger =
      origin === "receipt" ? "fbb-watch-replay" : "fbb-shared-watch";
    focusAfterPaint(() => {
      const target = document.getElementById(trigger);
      (target ?? boundaryRef.current)?.focus({ preventScroll: true });
    });
  };

  useAnimationFrame(
    (deltaMs) => {
      if (phase === "replay") {
        advanceReplay(deltaMs);
        return;
      }
      const current = stateRef.current;
      if (!current || current.phase !== "playing") return;
      accumulator.current += (deltaMs / 1000) * speed;
      const maxSteps = MAX_STEPS_PER_FRAME * speed;
      let steps = 0;
      while (accumulator.current >= TICK_SECONDS && steps < maxSteps) {
        const frame = buildFrame(
          held.current,
          tapped.current,
          pressed.current,
          mode,
          activeRef.current
        );
        pressed.current.clear();
        tapped.current.clear();
        const next = step(frame);
        accumulator.current -= TICK_SECONDS;
        steps++;
        if (!next || next.phase !== "playing") break;
      }
      if (steps === maxSteps) accumulator.current = 0;
      draw(scaleRef.current);
    },
    {
      isActive:
        (phase === "playing" && !paused && view?.phase === "playing") ||
        (phase === "replay" && replayPlaying),
    }
  );

  // Redraw when the loop is stopped (paused, or on the brothers' text).
  useEffect(() => {
    if (phase === "playing" || phase === "replay") draw(scaleRef.current);
  }, [phase, view, active, draw, scaleRef]);

  // A shared link's run is read once, on mount, and never plays by itself.
  useEffect(() => {
    const code = runCodeFromHash(window.location.hash);
    if (code === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the URL on mount
    setSharedOffer(offerFor(code));
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (phase === "replay") {
      if (event.key === "Escape" && !event.repeat) {
        event.preventDefault();
        exitReplay();
      }
      return;
    }
    if (phase !== "playing") return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    // Escape pauses or resumes from anywhere in the cabinet, including the
    // Pause and Resume buttons; every other key belongs to the game surface.
    if (event.key === "Escape") {
      event.preventDefault();
      // The brothers' text is already a stop: a pause sheet would cover it, and
      // Escape never answers it either (round 8, B1).
      if (stateRef.current?.phase === "brothers") return;
      if (!event.repeat) setPaused(!userPaused);
      return;
    }
    if (event.target !== boundaryRef.current) return;
    if (paused) return;
    // Shift+Tab, and Tab in co-op, are never intercepted: the browser moves
    // focus in DOM order, from the cabinet root to Pause and back out.
    if (event.key === "Tab" && mode === "solo" && !event.shiftKey) {
      // Someone who is out with his brothers cannot take the keys, so there
      // is no one to swap with: Tab is left to the browser, which reaches Pause.
      const other: PlayerId = activeRef.current === "fred" ? "abbi" : "fred";
      if (stateRef.current?.players[other].presence === "away") {
        setAnnouncement(`${NAMES[other]} is out with his brothers.`);
        return;
      }
      event.preventDefault();
      if (event.repeat) return;
      // A press that has not reached the engine yet belongs to the person
      // who was active when it was made, so apply it before swapping.
      if (pressed.current.size > 0 && stateRef.current?.phase === "playing") {
        step(
          buildFrame(
            held.current,
            tapped.current,
            pressed.current,
            mode,
            activeRef.current
          )
        );
        pressed.current.clear();
        tapped.current.clear();
      }
      const next = activeRef.current === "fred" ? "abbi" : "fred";
      activeRef.current = next;
      setActive(next);
      setAnnouncement(`Now playing as ${NAMES[next]}.`);
      return;
    }
    if (GAME_CODES.has(event.code)) {
      event.preventDefault();
      held.current.add(event.code);
      if (!event.repeat) {
        pressed.current.add(event.code);
        tapped.current.add(event.code);
      }
    }
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    held.current.delete(event.code);
  };

  let body: React.ReactNode;
  if (phase === "setup") {
    body = (
      <>
        {sharedOffer.status !== "none" ? (
          <section
            aria-labelledby="fbb-shared-title"
            data-testid="fbb-shared"
            className="mx-auto mt-3 flex w-full max-w-xl min-w-0 flex-col gap-2 rounded border border-[var(--fbb-rule)] bg-[var(--fbb-panel)] p-3 font-mono text-xs"
          >
            <h2
              id="fbb-shared-title"
              className="font-bold uppercase tracking-wide"
            >
              A shared run
            </h2>
            {sharedOffer.status === "offer" ? (
              <>
                <p className="break-words">
                  Watch replay plays this run back frame by frame, the same plan
                  and the same choices. A replay records no score.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    id="fbb-shared-watch"
                    type="button"
                    onClick={() => beginReplay(sharedOffer.run, "setup")}
                    className="min-h-11 rounded border border-[var(--fbb-accent)] px-4 font-bold uppercase tracking-wide text-[var(--fbb-accent)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)]"
                  >
                    Watch replay
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearRunHash();
                      setSharedOffer({ status: "none" });
                    }}
                    className="min-h-11 rounded border border-[var(--fbb-control)] px-4 font-bold uppercase tracking-wide active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)]"
                  >
                    Dismiss
                  </button>
                </div>
              </>
            ) : sharedOffer.status === "refused" ? (
              <p role="alert" className="break-words text-[var(--fbb-alert)]">
                {sharedOffer.message}
              </p>
            ) : null}
          </section>
        ) : null}
        <SetupScreen initial={setup} initialMode={mode} onStart={start} />
      </>
    );
  } else if (phase === "receipt" && receipt) {
    body = (
      <ReceiptView
        receipt={receipt}
        runCode={share?.code ?? null}
        onPlayAgain={() => start(setup, mode)}
        onChangePlan={() => setPhase("setup")}
        onWatchReplay={() => {
          if (share) beginReplay(share.run, "receipt");
        }}
      />
    );
  } else if (phase === "replay" && view) {
    body = (
      <div
        className="relative flex w-full min-w-0 flex-col gap-2 p-2 sm:p-3"
        data-testid="fbb-replay-view"
      >
        <ReplayControls
          clock={clockLabel(view.time, view.duration)}
          playing={replayPlaying}
          finished={replayEnded || view.phase === "done"}
          speed={replaySpeed}
          announcement={replayAnnouncement}
          onTogglePlay={toggleReplay}
          onRestart={restartReplay}
          onSpeedChange={changeReplaySpeed}
          onExit={exitReplay}
        />
        <canvas
          ref={canvasRef}
          width={VENUE_WIDTH}
          height={VENUE_HEIGHT}
          role="img"
          aria-label="Replay of the setup on the Plummer House patio and lawn, showing where everyone stood and what was placed."
          data-testid="fbb-replay-canvas"
          className="block aspect-[5/3] h-auto w-full rounded border border-[var(--fbb-rule)]"
        />
        <ul
          aria-label="Still to do"
          className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 font-mono text-xs"
        >
          {CHECKLIST.map((category) => {
            const line = checklistLine(view, category);
            if (!line) return null;
            return (
              <li key={category} className="min-w-0 break-words">
                {CATEGORY_LABELS[category]}: {line.done}/{line.planned}
              </li>
            );
          })}
        </ul>
      </div>
    );
  } else if (phase === "playback" && view) {
    body = (
      <CeremonyPlayback
        state={view}
        speed={speed}
        onDone={() => setPhase("receipt")}
      />
    );
  } else if (view) {
    const partner: PlayerId = active === "fred" ? "abbi" : "fred";
    // Solo shows the person at the keys, and the partner too while he is out or frozen.
    const shown: PlayerId[] =
      mode === "coop" ? ["fred", "abbi"] : [...shownPrompts(view, active)];
    const eventLines = activeEventLines(view);
    body = (
      <div className="relative flex w-full min-w-0 flex-col gap-2 p-2 sm:p-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
          <span
            className="text-lg font-extrabold tabular-nums"
            data-testid="fbb-clock"
            suppressHydrationWarning
          >
            {clockLabel(view.time, view.duration)}
          </span>
          <span
            data-testid="fbb-seed-name"
            className="min-w-0 break-words text-[var(--fbb-dim)]"
          >
            {seedHeader(view, todaysSeed)}
          </span>
          {eventLines.map((line) => (
            <span
              key={line}
              data-testid="fbb-event"
              className="font-bold text-[var(--fbb-accent)]"
            >
              {line}
            </span>
          ))}
          {/* The ceremony is the last time in the header, after the rush and shower. */}
          <span className="text-[var(--fbb-dim)]">Ceremony at 4:00</span>
          {mode === "solo" ? (
            <span data-testid="fbb-active">
              Playing as <span className="font-bold">{NAMES[active]}</span> ·
              {view.players[partner].presence === "away"
                ? " Tab to reach Pause · Shift+Tab to leave · Escape to pause"
                : " Tab to swap · Shift+Tab to leave · Escape to pause"}
            </span>
          ) : (
            <span>Fred: WASD, E, F · Abbi: arrows, Enter, Shift</span>
          )}
          <button
            ref={pauseRef}
            type="button"
            onClick={() => {
              setPaused(!userPaused);
              boundaryRef.current?.focus({ preventScroll: true });
            }}
            className="ml-auto min-h-11 rounded border border-[var(--fbb-control)] px-3 font-bold uppercase tracking-wide active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)]"
          >
            {userPaused ? "Resume" : "Pause"}
          </button>
        </div>

        <div className="grid min-w-0 gap-2 @4xl:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="relative min-w-0">
            <canvas
              ref={canvasRef}
              width={VENUE_WIDTH}
              height={VENUE_HEIGHT}
              role="img"
              aria-label="Top-down view of the Plummer House patio and lawn, with Fred, Abbi, the supply crates from the car, the rose table, the grill and every spot that still needs something."
              aria-describedby="fbb-checklist"
              data-testid="fbb-canvas"
              className="block aspect-[5/3] h-auto w-full rounded border border-[var(--fbb-rule)]"
            />
            <ul
              className="pointer-events-none absolute inset-x-2 top-2 flex flex-col items-start gap-1"
              aria-hidden="true"
            >
              {toasts.map((toast) => (
                <li
                  key={toast.id}
                  className="rounded bg-[var(--fbb-toast)] px-2 py-1 font-mono text-[11px] text-[var(--fbb-text)]"
                >
                  {toast.text}
                </li>
              ))}
            </ul>
            <BurstLayer bursts={textBursts} onDone={removeTextBurst} />
          </div>
          <div className="flex min-w-0 flex-col gap-2 font-mono text-xs">
            {laptopBadgeShown(view) ? (
              <p
                data-testid="fbb-laptop"
                className="break-words rounded border border-[var(--fbb-ok)] bg-[var(--fbb-toast)] px-2 py-1 font-bold text-[var(--fbb-ok)]"
              >
                {bankText("joke-leaving")}
              </p>
            ) : null}
            {hideTips ? (
              <button
                type="button"
                onClick={() => writeHideTips(false)}
                className="min-h-11 self-start rounded border border-[var(--fbb-control)] px-3 font-bold uppercase active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)]"
              >
                Show tips
              </button>
            ) : (
              <section
                aria-label="Coach tips"
                data-testid="fbb-coach"
                className="flex min-w-0 flex-col gap-1 rounded border border-[var(--fbb-rule)] p-2"
              >
                <ul className="flex flex-col gap-1">
                  {shown.map((id) => {
                    // An away person is already said in their prompt.
                    if (view.players[id].presence === "away") return null;
                    const hint = getHint(view, id, { coop: mode === "coop" });
                    if (!hint) return null;
                    return (
                      <li key={id} className="break-words">
                        {mode === "coop" ? `${NAMES[id]}: ` : null}
                        {hint}
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  onClick={() => writeHideTips(true)}
                  className="min-h-11 self-start px-1 font-bold uppercase underline active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)]"
                >
                  Hide tips
                </button>
              </section>
            )}
            <p
              className="tabular-nums text-[var(--fbb-dim)]"
              data-testid="fbb-stock"
            >
              {stockLine(view)}
            </p>
            <ul
              id="fbb-checklist"
              aria-label="Still to do"
              className="flex flex-col gap-1"
              data-testid="fbb-checklist"
            >
              {CHECKLIST.map((category) => {
                const line = checklistLine(view, category);
                if (!line) return null;
                const done = line.done === line.planned;
                return (
                  <li
                    key={category}
                    className={`relative flex justify-between gap-2 ${done ? "text-[var(--fbb-ok)]" : ""}`}
                  >
                    {rowFlashes
                      .filter((f) => f.category === category)
                      .map((f) => (
                        <RowFlash
                          key={f.id}
                          onDone={() => removeRowFlash(f.id)}
                        />
                      ))}
                    <span className="min-w-0 truncate">
                      {CATEGORY_LABELS[category]}
                    </span>
                    <span className="tabular-nums">
                      {line.done}/{line.planned}
                    </span>
                  </li>
                );
              })}
            </ul>
            {shown.map((id) => {
              const prompt = getPrompt(view, id);
              return (
                <div
                  key={id}
                  className="min-w-0 border-t border-[var(--fbb-rule)] pt-2"
                  data-testid={`fbb-prompt-${id}`}
                >
                  <p className="break-words">{prompt.status}</p>
                  {prompt.interact ? (
                    <p className="text-[var(--fbb-accent)]">
                      {`${interactKeyName(id, mode === "coop")}: ${prompt.interact}`}
                    </p>
                  ) : null}
                  {prompt.floorDrop ? (
                    // A floor drop is a hold: a tap does nothing (ADR 0060 amendment).
                    <p className="text-[var(--fbb-accent)]">
                      {`${prompt.floorDrop.note ? `${prompt.floorDrop.note} ` : ""}Hold ${interactKeyName(id, mode === "coop")} to ${prompt.floorDrop.action}`}
                    </p>
                  ) : null}
                  {prompt.work ? (
                    <p className="text-[var(--fbb-accent)]">
                      {holdLine(prompt.work, mode, id)}
                    </p>
                  ) : null}
                </div>
              );
            })}
            {mode === "solo" && view.setup.assist ? (
              // The text follows the helper's job; the live region announces
              // a change of kind only (see step), so this line is not one.
              <p
                data-testid="fbb-helper"
                className="min-w-0 break-words border-t border-[var(--fbb-rule)] pt-2 text-[var(--fbb-text)]"
              >
                {assistJob(view, partner)}
              </p>
            ) : null}
            {(mode === "solo" && view.setup.assist) || speed !== 1 ? (
              <p
                data-testid="fbb-no-rewards"
                className="min-w-0 break-words pt-2 text-[var(--fbb-dim)]"
              >
                {NO_REWARD_LINE}
              </p>
            ) : null}
          </div>
        </div>

        {userPaused ? (
          <div
            role="region"
            aria-labelledby="fbb-paused-title"
            className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(13,14,17,0.72)]"
          >
            <div className="flex flex-col gap-2 rounded border border-[var(--fbb-control)] bg-[var(--fbb-panel)] p-4 font-mono text-xs">
              <p id="fbb-paused-title" className="font-bold">
                Paused at {clockLabel(view.time, view.duration)}
              </p>
              <button
                type="button"
                onClick={() => {
                  setPaused(false);
                  boundaryRef.current?.focus({ preventScroll: true });
                }}
                className="min-h-11 rounded border border-[var(--fbb-accent)] px-3 font-bold uppercase active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)]"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={() => setPhase("setup")}
                className="min-h-11 rounded border border-[var(--fbb-control)] px-3 font-bold uppercase active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)]"
              >
                Back to the plan
              </button>
            </div>
          </div>
        ) : null}
        {view.phase === "brothers" ? (
          <BrothersDialog state={view} onDecide={decide} />
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={boundaryRef}
      tabIndex={0}
      data-keyboard-boundary="true"
      data-fbb-cabinet=""
      data-fbb-loud={loud ? "on" : "off"}
      data-testid="fbb-game"
      aria-label="For Better or Bulk"
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (next && event.currentTarget.contains(next)) return;
        held.current.clear();
        tapped.current.clear();
        // A focused child removed from the page (the Start button) blurs
        // with no target; anything else that takes focus away pauses.
        const removedChild =
          next === null && event.target !== event.currentTarget;
        if (phase === "playing" && !removedChild) setPaused(true);
      }}
      className="@container relative isolate flex min-h-[460px] w-full min-w-0 flex-col items-stretch bg-[var(--fbb-stage)] text-[var(--fbb-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--fbb-focus)]"
    >
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
      {body}
    </div>
  );
}
