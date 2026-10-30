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
  IDLE_FRAME,
  TICK_SECONDS,
  assistJob,
  assistJobKind,
  clockLabel,
  computeReceipt,
  createLevel,
  dailySeed,
  decodeRunCode,
  encodeRunCode,
  parseSeed,
  recordedFrame,
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
  bestTimeFor,
  parFor,
} from "@/lib/for-better-or-bulk";
import {
  recordArcadeScore,
  unlockArcadeTrophies,
} from "@/lib/arcade-achievements";
import {
  arcadeDailyDateOfNumber,
  readArcadeDailyParam,
} from "@/lib/arcade/daily";
import { recordArcadeDailyResult } from "@/lib/arcade/daily-store";
import { useCabinetSetup } from "@/components/arcade/CabinetSetupContext";
import { FBB_AUTO_PAUSE_EVENT } from "./auto-pause";
import { readBestTimes, saveBestTime } from "./best-time-storage";
import type { TimeChallenge } from "./ChallengeStrip";
import { buildFrame, type ControlMode } from "./input";
import { type DomBurst } from "./bursts";
import {
  completedCategories,
  playStepSounds,
  throttleFloorFull,
  type FeedbackEvent,
} from "./messages";
import { claimJokes, jokesFor, lineFor, type JokeId } from "./jokes";
import { countsForBoard } from "./board";
import { playSfx } from "./sfx";
import { readHideTips, subscribeHideTips } from "./hint-storage";
import { type ReplaySpeed } from "./ReplayControls";
import { noBestTimeReason, runTrophyIds } from "./rewards";
import { scrollBelowNavbar } from "./scroll";
import { burstLifetime, type CanvasBurst } from "./venue-canvas";

/** The arcade id used for scores, trophies and the cabinet. */
const FBB_GAME_ID = "for-better-or-bulk";

/** Most engine steps one animation frame may run, so a slow frame cannot spiral. */
const MAX_STEPS_PER_FRAME = 8;

/** How long a toast stays up, in milliseconds. */
const TOAST_MS = 3500;

export const NAMES: Readonly<Record<PlayerId, string>> = {
  fred: "Fred",
  abbi: "Abbi",
};

/**
 * The day's seed from the page's `?seed=` parameter, or from an Arcade Daily
 * `?daily=YYYY-MM-DD` link (#2113) when there is no seed. Junk, a missing
 * value or an out-of-range number gives the standard day, seed 0.
 */
function seedFromUrl(): number {
  if (typeof window === "undefined") return 0;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("seed");
  if (raw === null) {
    const daily = readArcadeDailyParam(window.location.search);
    if (daily) return dailySeed(new Date(`${daily}T00:00:00Z`));
  }
  return parseSeed(raw);
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
export function clearRunHash(): void {
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

/** What the session needs from the view. */
interface ForBetterOrBulkSessionOptions {
  /** The plan the setup screen starts from; tests pass their own. */
  readonly initialSetup: Setup;
  readonly initialMode: ControlMode;
  /** Whether the loud cabinet is on, which shows bursts. */
  readonly loud: boolean;
  /** True in the immersive touch cabinet, where nothing scrolls on start. */
  readonly touch: boolean;
  /** The cabinet, which takes focus when a day starts or a replay closes. */
  readonly boundaryRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * The For Better or Bulk session (#3440): the phase and setup, the control
 * mode and active player, the engine state and the frames it applied, the
 * held, tapped and pressed keys, pause, toasts and announcements, the
 * receipt, scores and trophies, sharing and replays. Moved verbatim from
 * ForBetterOrBulkGame.tsx, which draws the venue and reads the keyboard.
 */
export function useForBetterOrBulkSession(
  options: ForBetterOrBulkSessionOptions
) {
  const { initialSetup, initialMode, loud, touch, boundaryRef } = options;
  const [phase, setPhase] = useState<Phase>("setup");
  const [setup, setSetup] = useState<Setup>(() => {
    const seed = seedFromUrl();
    return seed === 0 ? initialSetup : { ...initialSetup, seed };
  });
  const [mode, setMode] = useState<ControlMode>(initialMode);
  const [active, setActive] = useState<PlayerId>("abbi");
  const [view, setView] = useState<GameState | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [timeChallenge, setTimeChallenge] = useState<TimeChallenge | null>(
    null
  );
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

  const cabinet = useCabinetSetup();

  const paused = userPaused || (cabinet?.isSetupOpen ?? false);

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
      // Today's seed at normal speed is the Arcade Daily (#2113), kept
      // apart from the board.
      const dailyDate =
        speed === 1
          ? arcadeDailyDateOfNumber(
              state.setup.seed ?? 0,
              "for-better-or-bulk",
              Date.now()
            )
          : null;
      if (dailyDate) {
        recordArcadeDailyResult("for-better-or-bulk", dailyDate, {
          score: outcome.placements,
        });
      }
      const trophies = runTrophyIds(state, result.stars, speed);
      if (trophies.length > 0) unlockArcadeTrophies(trophies);
      // The time challenge sits beside the board score, which stays the
      // placement count: a finished solo day at normal speed may set a best.
      const noBestReason = noBestTimeReason(
        state.setup.assist ?? false,
        speed !== 1
      );
      const record =
        state.finishedAt !== null && noBestReason === null
          ? saveBestTime(state.setup, state.finishedAt)
          : null;
      setTimeChallenge({
        par: parFor(state.setup),
        best: record ? record.best : bestTimeFor(readBestTimes(), state.setup),
        duration: state.duration,
        noBestReason,
        run: { finishedAt: state.finishedAt, record },
      });
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
      setTimeChallenge(null);
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
        // page scrolls them in. scrollIntoView ignored the scroll margin inside
        // the cabinet and parked the header under the bar (#2145). The touch
        // cabinet already fills the screen, so nothing scrolls there.
        if (!touch && cabinetEl) scrollBelowNavbar(cabinetEl);
      });
    },
    [focusAfterPaint, touch, boundaryRef]
  );

  const decide = (decision: PresenceDecision) => {
    if (userPaused) return;
    // Keys down while the text was up are not carried into the game, so a
    // floor hold started before the dialog cannot finish after it. The engine
    // also clears every floor hold when the text opens and on a decision.
    held.current.clear();
    tapped.current.clear();
    pressed.current.clear();
    step({ ...IDLE_FRAME, decision });
    boundaryRef.current?.focus({ preventScroll: true });
  };

  /** Pauses or resumes the clock and says so to screen readers. */
  const setPaused = (next: boolean) => {
    // Keys held when the clock stops would otherwise still be "down" on resume.
    // A floor hold needs E down on every tick, so clearing the keys here also
    // ends any floor hold in progress: a pause resets it.
    held.current.clear();
    tapped.current.clear();
    pressed.current.clear();
    setUserPaused(next);
    setAnnouncement(next ? "Paused. Choose Resume to continue." : "Resumed.");
  };

  /**
   * Swaps the person being played in solo, from Tab or the dock's Swap key.
   * Someone who is out with his brothers cannot take over, so the swap only
   * says so.
   */
  const swapActive = () => {
    const other: PlayerId = activeRef.current === "fred" ? "abbi" : "fred";
    if (stateRef.current?.players[other].presence === "away") {
      setAnnouncement(`${NAMES[other]} is out with his brothers.`);
      return;
    }
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
    activeRef.current = other;
    setActive(other);
    setAnnouncement(`Now playing as ${NAMES[other]}.`);
  };

  /**
   * A touch dock key going down or up (#2123). It is the same key the
   * keyboard would press, so a tap is a press and a hold is a hold.
   */
  const touchKey = (code: string, down: boolean) => {
    if (!down) {
      held.current.delete(code);
      return;
    }
    if (paused || stateRef.current?.phase !== "playing") return;
    if (held.current.has(code)) return;
    held.current.add(code);
    pressed.current.add(code);
    tapped.current.add(code);
  };

  // A hidden tab or a backgrounded iPad app pauses a day in progress. The
  // brothers' text already stops the clock, so it is left as it is.
  const autoPauseRef = useRef<() => void>(() => {});
  useEffect(() => {
    autoPauseRef.current = () => {
      if (
        phase === "playing" &&
        !userPaused &&
        stateRef.current?.phase === "playing"
      ) {
        setPaused(true);
      }
    };
  });
  useEffect(() => {
    const onAutoPause = () => autoPauseRef.current();
    window.addEventListener(FBB_AUTO_PAUSE_EVENT, onAutoPause);
    return () => window.removeEventListener(FBB_AUTO_PAUSE_EVENT, onAutoPause);
  }, []);

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

  /**
   * Plays the replay's frames through the engine. Replays never score. True
   * when a frame was applied and the venue should be drawn.
   */
  const advanceReplay = (deltaMs: number): boolean => {
    const rep = replayRef.current;
    const current = stateRef.current;
    if (!rep || !current) return false;
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
    if (steps === 0) return false;
    stateRef.current = next;
    setView(next);
    if (next.phase === "done" || rep.index >= frames.length) {
      setReplayPlaying(false);
      setReplayEnded(true);
      clearRunHash();
      setReplayAnnouncement(
        `Replay finished at ${clockLabel(next.time, next.duration)}.`
      );
    }
    return true;
  };

  /**
   * One animation frame (#3440): plays the replay, or steps a day in
   * progress in whole ticks, each from both players' keys through
   * buildFrame. True when the venue should be drawn after it.
   */
  const advanceFrame = (deltaMs: number): boolean => {
    if (phase === "replay") return advanceReplay(deltaMs);
    const current = stateRef.current;
    if (!current || current.phase !== "playing") return false;
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
    return true;
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

  // A shared link's run is read once, on mount, and never plays by itself.
  useEffect(() => {
    const code = runCodeFromHash(window.location.hash);
    if (code === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the URL on mount
    setSharedOffer(offerFor(code));
  }, []);

  return {
    advanceFrame,
    active,
    activeRef,
    announcement,
    beginReplay,
    canvasBursts,
    changeReplaySpeed,
    decide,
    exitReplay,
    held,
    hideTips,
    mode,
    paused,
    phase,
    pressed,
    receipt,
    removeRowFlash,
    removeTextBurst,
    replayAnnouncement,
    replayEnded,
    replayPlaying,
    replaySpeed,
    restartReplay,
    rowFlashes,
    setPaused,
    setPhase,
    setSharedOffer,
    setup,
    share,
    sharedOffer,
    speed,
    start,
    stateRef,
    swapActive,
    tapped,
    textBursts,
    timeChallenge,
    toasts,
    todaysSeed,
    toggleReplay,
    touchKey,
    userPaused,
    view,
  };
}
