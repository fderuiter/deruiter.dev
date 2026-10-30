"use client";

/**
 * For Better or Bulk (ADR 0060): a real-time co-op setup rush at the
 * Plummer House. This component owns the plan screen, the fixed-step loop,
 * the keyboard, the brothers' text and scoring; the engine owns every rule
 * and the canvas only draws.
 */

import React, { useCallback, useEffect, useRef } from "react";
import {
  DEFAULT_SETUP,
  THROW_OUT_PROMPT,
  TOUCH_SWAP_NAME,
  assistJob,
  clockLabel,
  getHint,
  getPrompt,
  interactKeyName,
  shownPrompts,
  workKeyName,
  type GameState,
  type PlayerId,
  type Setup,
  type SupplyKind,
  CATEGORY_LABELS,
  bankText,
} from "@/lib/for-better-or-bulk";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import { useCanvasResolution } from "@/hooks/useCanvasResolution";
import { useCabinetTouch } from "@/components/arcade/mobile";
import { FbbTouchDock } from "./FbbTouchDock";
import "./fbb-touch.css";
import { BrothersDialog } from "./BrothersDialog";
import { GAME_CODES, type ControlMode } from "./input";
import { BurstLayer, RowFlash, useFbbLoud } from "./bursts";
import {
  activeEventLines,
  CHECKLIST,
  checklistLine,
  seedHeader,
} from "./messages";
import { CeremonyPlayback } from "./CeremonyPlayback";
import { laptopBadgeShown } from "./jokes";
import { writeHideTips } from "./hint-storage";
import { ReceiptView } from "./ReceiptView";
import { ReplayControls } from "./ReplayControls";
import { noRewardLine } from "./rewards";
import { SetupScreen } from "./SetupScreen";
import {
  canvasBurstsFor,
  drawVenue,
  VENUE_HEIGHT,
  VENUE_WIDTH,
} from "./venue-canvas";
import {
  NAMES,
  clearRunHash,
  useForBetterOrBulkSession,
} from "./useForBetterOrBulkSession";

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
function holdLine(
  work: string,
  mode: ControlMode,
  id: PlayerId,
  touch: boolean
): string {
  const keys = workKeyName(id, mode === "coop", touch);
  if (work === THROW_OUT_PROMPT) return `Hold ${keys} to throw it out`;
  return `Hold ${keys}: ${work}`;
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
  const loud = useFbbLoud();
  // The immersive touch cabinet on an iPad (#2123): the dock, the fit layout
  // and copy that names the on-screen keys. Desktop reads false.
  const touch = useCabinetTouch();
  const boundaryRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pauseRef = useRef<HTMLButtonElement>(null);
  const {
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
  } = useForBetterOrBulkSession({
    initialSetup,
    initialMode,
    loud,
    touch,
    boundaryRef,
  });
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
    [mode, loud, stateRef, activeRef, canvasBursts]
  );

  const scaleRef = useCanvasResolution({
    canvasRef,
    logicalWidth: VENUE_WIDTH,
    logicalHeight: VENUE_HEIGHT,
    active: phase === "playing" || phase === "replay",
    onResize: draw,
  });

  useAnimationFrame(
    (deltaMs) => {
      if (advanceFrame(deltaMs)) draw(scaleRef.current);
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
      // is no one to swap with. Tab does nothing rather than moving focus to
      // Pause, where the arrows would stop moving anyone (round 18, S-1).
      event.preventDefault();
      const other: PlayerId = activeRef.current === "fred" ? "abbi" : "fred";
      if (
        event.repeat &&
        stateRef.current?.players[other].presence !== "away"
      ) {
        return;
      }
      swapActive();
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
        <SetupScreen
          initial={setup}
          initialMode={mode}
          touch={touch}
          onStart={start}
        />
      </>
    );
  } else if (phase === "receipt" && receipt) {
    body = (
      <ReceiptView
        receipt={receipt}
        runCode={share?.code ?? null}
        timeChallenge={timeChallenge}
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
    // Solo shows the person at the keys, and the partner too: while he is out or
    // frozen, or idle with no helper (then his line names the swap key).
    const shown: PlayerId[] =
      mode === "coop" ? ["fred", "abbi"] : [...shownPrompts(view, active)];
    // The coach speaks for the person at the keys, and for a frozen partner as before.
    const coached = shown.filter(
      (id) => mode === "coop" || id === active || view.players[id].busyFor > 0
    );
    const eventLines = activeEventLines(view);
    body = (
      <div
        className={`relative flex w-full min-w-0 flex-col gap-2 p-2 sm:p-3${touch ? " fbb-play" : ""}`}
      >
        <div
          data-testid="fbb-strip"
          className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs"
        >
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
              {touch
                ? view.players[partner].presence === "away"
                  ? ` ${NAMES[partner]} is out, so there is no one to swap to`
                  : ` ${TOUCH_SWAP_NAME} plays ${NAMES[partner]}`
                : view.players[partner].presence === "away"
                  ? ` ${NAMES[partner]} is out, so Tab does nothing · Shift+Tab to leave · Escape to pause`
                  : " Tab to swap · Shift+Tab to leave · Escape to pause"}
            </span>
          ) : touch ? (
            <span>Fred on the left · Abbi on the right</span>
          ) : (
            <span>Fred: WASD, E or Space, F · Abbi: arrows, Enter, Shift</span>
          )}
          {/* On touch, Pause sits in the dock by the thumbs, and a keyboard
              case pauses with Escape (#2123). */}
          {touch ? null : (
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
          )}
        </div>

        <div className="fbb-main grid min-w-0 gap-2 @3xl:grid-cols-[minmax(0,1fr)_12rem] @4xl:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="fbb-venue relative min-w-0">
            <div className="fbb-venue-frame relative min-w-0">
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
          </div>
          <div
            data-testid="fbb-panel"
            className="fbb-panel flex min-w-0 flex-col gap-2 font-mono text-xs"
          >
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
                  {coached.map((id) => {
                    // An away person is already said in their prompt.
                    if (view.players[id].presence === "away") return null;
                    const hint = getHint(view, id, {
                      coop: mode === "coop",
                      touch,
                    });
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
                    <span className="min-w-0 break-words">
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
              const prompt = getPrompt(view, id, {
                waiting: mode === "solo" && id !== active,
                touch,
              });
              return (
                <div
                  key={id}
                  className="min-w-0 border-t border-[var(--fbb-rule)] pt-2"
                  data-testid={`fbb-prompt-${id}`}
                >
                  <p className="break-words">{prompt.status}</p>
                  {prompt.interact ? (
                    // A refusal gets no key, so it never reads as an action (round 17).
                    <p
                      className={
                        prompt.interactLands
                          ? "text-[var(--fbb-accent)]"
                          : "text-[var(--fbb-text)]"
                      }
                    >
                      {prompt.interactLands
                        ? `${interactKeyName(id, mode === "coop", touch)}: ${prompt.interact}`
                        : prompt.interact}
                    </p>
                  ) : null}
                  {prompt.floorDrop ? (
                    // A floor drop is a hold: a tap does nothing (ADR 0060 amendment).
                    <p className="text-[var(--fbb-accent)]">
                      {`${prompt.floorDrop.note ? `${prompt.floorDrop.note} ` : ""}Hold ${interactKeyName(id, mode === "coop", touch)} to ${prompt.floorDrop.action}`}
                    </p>
                  ) : null}
                  {prompt.work ? (
                    <p className="text-[var(--fbb-accent)]">
                      {holdLine(prompt.work, mode, id, touch)}
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
                {noRewardLine(speed !== 1)}
              </p>
            ) : null}
          </div>
        </div>

        {touch ? (
          <FbbTouchDock
            mode={mode}
            active={active}
            paused={paused || view.phase !== "playing"}
            canSwap={view.players[partner].presence !== "away"}
            onKey={touchKey}
            onSwap={swapActive}
            onPause={() => setPaused(true)}
          />
        ) : null}
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
      data-fbb-phase={touch ? phase : undefined}
      // In the touch cabinet Escape pauses a running day (and closes a
      // replay) through this element's own keys rather than leaving (#2123).
      data-escape-docks={
        touch &&
        (phase === "playing" || phase === "replay" || phase === "playback")
          ? "true"
          : undefined
      }
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
      className={`@container relative isolate flex min-h-[460px] scroll-mt-28 w-full min-w-0 flex-col items-stretch bg-[var(--fbb-stage)] text-[var(--fbb-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--fbb-focus)]${touch ? " fbb-touch" : ""}`}
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
