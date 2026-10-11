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
  clockLabel,
  computeReceipt,
  createLevel,
  getHint,
  getPrompt,
  stepGame,
  type Category,
  type Frame,
  type GameEvent,
  type GameState,
  type PlayerId,
  type PresenceDecision,
  type Receipt,
  type Setup,
  type SupplyKind,
  CATEGORY_LABELS,
} from "@/lib/for-better-or-bulk";
import { recordArcadeScore } from "@/lib/arcade-achievements";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import { useCanvasResolution } from "@/hooks/useCanvasResolution";
import { useCabinetSetup } from "@/components/arcade/CabinetSetupContext";
import { BrothersDialog } from "./BrothersDialog";
import { buildFrame, GAME_CODES, type ControlMode } from "./input";
import { BurstLayer, RowFlash, useFbbLoud, type DomBurst } from "./bursts";
import {
  CHECKLIST,
  checklistLine,
  completedCategories,
  describeEvent,
  throttleFloorFull,
  playStepSounds,
  type FeedbackEvent,
} from "./messages";
import { playSfx } from "./sfx";
import { readHideTips, subscribeHideTips, writeHideTips } from "./hint-storage";
import { ReceiptView } from "./ReceiptView";
import { SetupScreen } from "./SetupScreen";
import {
  BURST_SECONDS,
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
  if (work === THROW_OUT_PROMPT) {
    const keys = mode === "coop" ? (id === "fred" ? "F" : "Shift") : "F/Shift";
    return `Hold ${keys} to throw it out`;
  }
  const keys = mode === "coop" ? (id === "fred" ? "F" : "Shift") : "F or Shift";
  return `Hold ${keys}: ${work}`;
}

/** Fastest clock the `?speed=` parameter allows. */
const MAX_SPEED = 8;

type Phase = "setup" | "playing" | "receipt";

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
    ...bursts.filter((b) => burst.startedAt - b.startedAt < BURST_SECONDS),
    burst,
  ];
}

/** Items placed in the venue: the number the arcade board keeps. */
function placements(state: GameState): number {
  return state.targets.reduce((sum, t) => sum + t.filled.length, 0);
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
  const [setup, setSetup] = useState<Setup>(initialSetup);
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
  const burstId = useRef(0);

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
    active: phase === "playing",
    onResize: draw,
  });

  const pushMessages = useCallback((events: readonly GameEvent[]) => {
    const lines = events
      .map(describeEvent)
      .filter((line): line is string => line !== null);
    if (lines.length === 0) return;
    setAnnouncement(lines[lines.length - 1]);
    const added = lines.map((text) => ({ id: ++toastId.current, text }));
    setToasts((current) => [...current, ...added].slice(-3));
    const timer = setTimeout(() => {
      toastTimers.current.delete(timer);
      setToasts((current) =>
        current.filter((t) => !added.some((a) => a.id === t.id))
      );
    }, TOAST_MS);
    toastTimers.current.add(timer);
  }, []);

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
      setPhase("receipt");
      // A sped-up run is for watching or testing, so it stays off the board.
      if (speed === 1) {
        recordArcadeScore(FBB_GAME_ID, placements(state), {
          title: result.title,
        });
      }
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
    (events: readonly FeedbackEvent[], state: GameState) => {
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
      stateRef.current = result.state;
      const shown = throttleFloorFull(
        result.events,
        result.state.time,
        floorFullShown.current
      );
      pushMessages(shown);
      const events: FeedbackEvent[] = [
        ...shown,
        ...completedCategories(state, result.state).map((category) => ({
          type: "category-complete" as const,
          category,
        })),
      ];
      feedback(events, result.state);
      setView(result.state);
      if (result.state.phase === "done") finish(result.state);
      return result.state;
    },
    [pushMessages, finish, feedback]
  );

  const start = useCallback((next: Setup, nextMode: ControlMode) => {
    canvasBursts.current = [];
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
    setAnnouncement("Setup has started. It is 9:00.");
    setPhase("playing");
    requestAnimationFrame(() =>
      boundaryRef.current?.focus({ preventScroll: true })
    );
  }, []);

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

  useAnimationFrame(
    (deltaMs) => {
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
    { isActive: phase === "playing" && !paused && view?.phase === "playing" }
  );

  // Redraw when the loop is stopped (paused, or on the brothers' text).
  useEffect(() => {
    if (phase === "playing") draw(scaleRef.current);
  }, [phase, view, active, draw, scaleRef]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (phase !== "playing") return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    // Escape pauses or resumes from anywhere in the cabinet, including the
    // Pause and Resume buttons; every other key belongs to the game surface.
    if (event.key === "Escape") {
      event.preventDefault();
      if (!event.repeat) setPaused(!userPaused);
      return;
    }
    if (event.target !== boundaryRef.current) return;
    if (paused) return;
    if (event.key === "Tab" && mode === "solo" && event.shiftKey) {
      // Tab swaps people in solo play, so Shift+Tab moves to Pause instead.
      event.preventDefault();
      pauseRef.current?.focus({ preventScroll: true });
      return;
    }
    if (event.key === "Tab" && mode === "solo") {
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
    body = <SetupScreen initial={setup} initialMode={mode} onStart={start} />;
  } else if (phase === "receipt" && receipt) {
    body = (
      <ReceiptView
        receipt={receipt}
        onPlayAgain={() => start(setup, mode)}
        onChangePlan={() => setPhase("setup")}
      />
    );
  } else if (view) {
    const shown: PlayerId[] = mode === "coop" ? ["fred", "abbi"] : [active];
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
          <span className="text-[var(--fbb-dim)]">Ceremony at 4:00</span>
          {mode === "solo" ? (
            <span data-testid="fbb-active">
              Playing as <span className="font-bold">{NAMES[active]}</span> ·
              Tab to swap · Shift+Tab for Pause
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
                    const away = view.players[id].presence === "away";
                    const hint = away
                      ? `${NAMES[id]} is out with his brothers.`
                      : getHint(view, id);
                    if (!hint) return null;
                    return (
                      <li key={id} className="break-words">
                        {mode === "coop" && !away ? `${NAMES[id]}: ` : null}
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
                      {mode === "coop"
                        ? id === "fred"
                          ? "E"
                          : "Enter"
                        : "E or Enter"}
                      : {prompt.interact}
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
      className="@container relative flex min-h-[460px] w-full min-w-0 flex-col items-stretch bg-[var(--fbb-stage)] text-[var(--fbb-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--fbb-focus)]"
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
