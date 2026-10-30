"use client";

/**
 * Patty's Drive-Thru (ADR 0059): one drive-thru shift from the author's
 * first job, as a first-person 3D booth with a flat fallback. This component
 * owns the diary pages, the shift loop, the keyboard and pointer input, audio
 * and scoring; the engine owns the rules and the booth scene only renders.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import dynamic from "next/dynamic";
import {
  BOOTH_CREW,
  getKdsTickets,
  isWeekOver,
  type ShiftAction,
  type ShiftConfig,
} from "@/lib/patty-drive-thru";
import { getSoundEngine } from "@/lib/audio/sound-engine";
import {
  getMatchMediaMatches,
  usePrefersReducedMotion,
} from "@/hooks/useMediaQuery";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useCabinetTouch } from "@/components/arcade/mobile";
import { playShiftEvents } from "./booth-audio";
import {
  DiaryIntroPage,
  ShiftEndPage,
  WeekDayEndPage,
  WeekSummaryPage,
} from "./DiaryPages";
import { useBooth } from "./hooks";
import { KdsBoard } from "./KdsBoard";
import { Register } from "./Register";
import { ShiftCaption, ShiftHud } from "./ShiftHud";
import { DilemmaPrompt } from "./DilemmaPrompt";
import { PattyTouchDock } from "./PattyTouchDock";
import { DILEMMA_KEYS } from "./store";
import "./patty-touch.css";
import { TOUCH_LEFT, TOUCH_RIGHT, usePattySession } from "./usePattySession";

const BoothScene = dynamic(() => import("./BoothScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-xs text-[var(--pdt-hud-dim)]">
      Turning on the lights…
    </div>
  ),
});

const BOOTH_DESCRIPTION = `You stand in a drive-thru booth and can turn half a turn either way. On your left are the window, the lane and the headset box. Ahead is the counter with the register, and the kitchen display hangs above it. On your right are the kitchen and the automatic drink dispenser. ${BOOTH_CREW.manager} is somewhere behind you.`;

/** Radians of head turn per pixel of mouse drag. */
const DRAG_RADIANS_PER_PX = 0.0045;
/** Pixels a press must move before it counts as a drag rather than a click. */
const DRAG_THRESHOLD_PX = 5;

const LEFT_KEYS = new Set(["a", "A", "ArrowLeft", TOUCH_LEFT]);
const RIGHT_KEYS = new Set(["d", "D", "ArrowRight", TOUCH_RIGHT]);

let webglSupport: boolean | null = null;

/** True when the browser can make a WebGL context. Checked once, then cached. */
function detectWebgl(): boolean {
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    webglSupport = !!gl;
    if (gl && "getExtension" in gl) {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

const noSubscription = () => () => {};

function useWebglSupport(): boolean {
  return useSyncExternalStore(noSubscription, detectWebgl, () => false);
}

type ViewChoice = "auto" | "3d" | "flat";

interface PattyDriveThruGameProps {
  /** Shift settings; tests pass a fixed seed and duration. */
  config?: Partial<ShiftConfig>;
  /** Forces a view, for tests and for visitors who chose one. */
  initialView?: ViewChoice;
}

export function PattyDriveThruGame({
  config,
  initialView = "auto",
}: PattyDriveThruGameProps) {
  const webgl = useWebglSupport();
  const reducedMotion = usePrefersReducedMotion();
  const [viewChoice, setViewChoice] = useState<ViewChoice>(initialView);
  const [contextLost, setContextLost] = useState(false);
  const autoView = webgl && !reducedMotion ? "3d" : "flat";
  const wanted = viewChoice === "auto" ? autoView : viewChoice;
  const view = wanted === "3d" && webgl && !contextLost ? "3d" : "flat";

  // True inside the immersive touch cabinet (a tablet after Launch). Desktop
  // and the attract screen read false, and none of the touch layout, dock or
  // dialog behaviour below applies to them (#2116).
  const touchCabinet = useCabinetTouch();
  const boundaryRef = useRef<HTMLDivElement>(null);
  const registerRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ yaw: 0, pitch: 0 });
  const pointer = useRef<{
    id: number;
    x: number;
    y: number;
    dragging: boolean;
  } | null>(null);
  const {
    announcement,
    chooseDilemma,
    backToIntro,
    clockIn,
    clockInCustom,
    closeRegister,
    endedLog,
    endedShift,
    facing,
    handleTurn,
    heldKeys,
    longerDilemmas,
    nextWeekDay,
    openRegister,
    paused,
    phase,
    previousBest,
    previousWeekBest,
    registerOpen,
    savedWeek,
    setLongerChoice,
    setPaused,
    startWeek,
    store,
    toggleRegister,
    userPaused,
    userPausedRef,
    week,
    yells,
  } = usePattySession({ config, reducedMotion, boundaryRef });

  // Switching views swaps the whole layout and drops focus from the toggle,
  // which let the browser scroll the cabinet under the navbar. Keep focus on
  // the booth and the cabinet top just below the header (#1938).
  const changeView = useCallback((next: ViewChoice) => {
    setViewChoice(next);
    requestAnimationFrame(() => {
      const boundary = boundaryRef.current;
      boundary?.focus({ preventScroll: true });
      const cabinet = boundary?.closest<HTMLElement>("[data-arcade-cabinet]");
      const header = document.querySelector("header");
      if (!cabinet || !header || typeof window.scrollBy !== "function") return;
      const gap = 8;
      const offset =
        cabinet.getBoundingClientRect().top -
        header.getBoundingClientRect().bottom -
        gap;
      if (offset < 0) window.scrollBy({ top: offset, behavior: "auto" });
    });
  }, []);

  const handleContextLost = useCallback(() => {
    setContextLost(true);
    store.getState().setRegisterOpen(false);
  }, [store]);

  // The shift clock and the head both advance once per animation frame.
  useAnimationFrame(
    (deltaMs) => {
      const dt = deltaMs / 1000;
      const state = store.getState();
      state.tick(dt);
      // Holding both ways cancels out, whichever was pressed first.
      let left = 0;
      let right = 0;
      for (const key of heldKeys.current) {
        if (LEFT_KEYS.has(key)) left = 1;
        if (RIGHT_KEYS.has(key)) right = 1;
      }
      const turn = left - right;
      const { yaw, pitch } = drag.current;
      drag.current = { yaw: 0, pitch: 0 };
      state.moveHead({ turn, dragYaw: yaw, dragPitch: pitch }, dt);
    },
    { isActive: phase === "shift" && !paused }
  );

  // Focus the register's first usable control when it opens.
  useEffect(() => {
    if (!registerOpen || view !== "3d") return;
    const first = registerRef.current?.querySelector<HTMLButtonElement>(
      "button:not([disabled])"
    );
    first?.focus({ preventScroll: true });
  }, [registerOpen, view]);

  // Ringing a leaf or backing out swaps the menu keys, so the focused key
  // unmounts and the browser drops focus on the page body, where the shift
  // shortcuts (B to bump) no longer reach the game. Take focus back.
  const posKey = useBooth(
    store,
    (s) => `${s.shift.pos.path.join("/")}|${s.shift.pos.taps}`
  );
  const lastPosKey = useRef(posKey);
  useEffect(() => {
    if (lastPosKey.current === posKey) return;
    lastPosKey.current = posKey;
    if (phase !== "shift") return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const first =
      registerOpen && view === "3d"
        ? registerRef.current?.querySelector<HTMLButtonElement>(
            "button:not([disabled])"
          )
        : null;
    (first ?? boundaryRef.current)?.focus({ preventScroll: true });
  }, [posKey, phase, registerOpen, view]);

  // Booth audio, panned headset-left and kitchen-right.
  useEffect(() => {
    const hoverNone = getMatchMediaMatches("(hover: none)");
    const engine = getSoundEngine();
    const unsubscribe = store
      .getState()
      .onEvents((events) => playShiftEvents(events, engine, hoverNone));
    return () => {
      unsubscribe();
      engine.stopAll();
    };
  }, [store]);

  // Dialogs in the touch cabinet trap focus, close on Escape and hand focus
  // back to the booth. The booth's own key handler still sees their keys, so
  // the shift shortcuts keep working beside them.
  const resumeRef = useRef<HTMLButtonElement>(null);
  const pauseDialogRef = useFocusTrap<HTMLDivElement>(
    touchCabinet && phase === "shift" && userPaused,
    {
      initialFocusRef: resumeRef,
      onEscape: () => setPaused(false),
      returnFocusTo: boundaryRef,
    }
  );
  const registerSheetOpen =
    touchCabinet && phase === "shift" && view === "3d" && registerOpen;
  const registerSheetRef = useFocusTrap<HTMLDivElement>(registerSheetOpen, {
    onEscape: closeRegister,
    returnFocusTo: boundaryRef,
  });

  const actOnActive = (type: "bump" | "reenterDrink" | "flagCoworker") => {
    const orderId = store.getState().shift.pos.activeOrderId;
    if (orderId !== null)
      store.getState().act({ type, orderId } as ShiftAction);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (phase !== "shift") return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const onBoundary = event.target === boundaryRef.current;
    const key = event.key;
    const state = store.getState();

    // The touch cabinet leaves Escape to the game while a shift runs, so a
    // stray press from a keyboard case steps back instead of closing the
    // cabinet and losing the shift (#2116): it resumes a paused shift, then
    // closes the register, then pauses. A press the register already handled
    // is not handled twice.
    if (touchCabinet && key === "Escape") {
      if (event.defaultPrevented) return;
      event.preventDefault();
      if (userPausedRef.current) setPaused(false);
      else if (view === "3d" && state.registerOpen) closeRegister();
      else setPaused(true);
      return;
    }

    // In the 3D booth Escape first leaves the register, whose own handler
    // may already have closed it by the time the key reaches the booth.
    const closesRegister =
      key === "Escape" && view === "3d" && (state.registerOpen || !onBoundary);
    if ((key === "p" || key === "P" || key === "Escape") && !closesRegister) {
      event.preventDefault();
      setPaused(!userPausedRef.current);
      return;
    }
    // While paused the booth hears nothing but the pause keys.
    if (userPaused) return;

    if (
      view === "3d" &&
      !state.registerOpen &&
      (LEFT_KEYS.has(key) || RIGHT_KEYS.has(key))
    ) {
      event.preventDefault();
      heldKeys.current.add(key);
      return;
    }
    // Q and E answer an open dilemma (#2087).
    const dilemmaKey = DILEMMA_KEYS.indexOf(
      key.toUpperCase() as (typeof DILEMMA_KEYS)[number]
    );
    if (dilemmaKey >= 0) {
      if (chooseDilemma(dilemmaKey)) event.preventDefault();
      return;
    }
    if (/^[1-9]$/.test(key)) {
      const ticket = getKdsTickets(state.shift)[Number(key) - 1];
      if (ticket) {
        event.preventDefault();
        state.act({ type: "selectOrder", orderId: ticket.orderId });
      }
      return;
    }
    switch (key.toLowerCase()) {
      case "b":
        event.preventDefault();
        actOnActive("bump");
        return;
      case "r":
        event.preventDefault();
        actOnActive("reenterDrink");
        return;
      case "c":
        event.preventDefault();
        actOnActive("flagCoworker");
        return;
      case "w":
        event.preventDefault();
        state.act({ type: "wipe" });
        return;
      case "backspace":
        event.preventDefault();
        state.act({ type: "posBack" });
        return;
      case "home":
        event.preventDefault();
        state.act({ type: "posHome" });
        return;
      case "enter":
        if (onBoundary && view === "3d") {
          event.preventDefault();
          openRegister();
        }
        return;
      case "tab":
        if (onBoundary && view === "3d" && !event.shiftKey) {
          event.preventDefault();
          openRegister();
        }
        return;
      case "escape":
        if (view === "3d" && state.registerOpen) closeRegister();
        return;
      default:
        return;
    }
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    heldKeys.current.delete(event.key);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    pointer.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dragging: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const press = pointer.current;
    if (!press || press.id !== event.pointerId) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    if (!press.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    if (!press.dragging) {
      press.dragging = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      if (store.getState().registerOpen) closeRegister();
    }
    drag.current = {
      yaw: drag.current.yaw - dx * DRAG_RADIANS_PER_PX,
      pitch: drag.current.pitch - dy * DRAG_RADIANS_PER_PX,
    };
    press.x = event.clientX;
    press.y = event.clientY;
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointer.current?.id === event.pointerId) pointer.current = null;
  };

  // Diary pages scroll inside the touch cabinet's stage; the page never does.
  const pageClass = touchCabinet
    ? "pdt-page w-full p-3 sm:p-6"
    : "w-full p-3 sm:p-6";

  let body: React.ReactNode;
  if (phase === "intro") {
    body = (
      <div className={pageClass}>
        <DiaryIntroPage
          onClockIn={clockIn}
          onClockInCustom={clockInCustom}
          onStartWeek={() => startWeek()}
          onResumeWeek={startWeek}
          savedWeek={savedWeek}
          longerDilemmas={longerDilemmas}
          onLongerDilemmasChange={setLongerChoice}
        />
      </div>
    );
  } else if (phase === "ended" && endedShift && week) {
    body = (
      <div className={pageClass}>
        {isWeekOver(week) ? (
          <WeekSummaryPage
            week={week}
            shift={endedShift}
            log={endedLog ?? []}
            onNewWeek={() => startWeek()}
            onBackToIntro={backToIntro}
            previousBest={previousWeekBest}
          />
        ) : (
          <WeekDayEndPage
            shift={endedShift}
            log={endedLog ?? []}
            week={week}
            onNextDay={nextWeekDay}
            onStop={backToIntro}
          />
        )}
      </div>
    );
  } else if (phase === "ended" && endedShift) {
    body = (
      <div className={pageClass}>
        <ShiftEndPage
          shift={endedShift}
          log={endedLog ?? []}
          onClockIn={() => clockIn()}
          previousBest={previousBest}
        />
      </div>
    );
  } else if (view === "3d") {
    body = (
      <div
        className={
          touchCabinet
            ? "pdt-booth relative min-h-0 w-full flex-1 overflow-hidden"
            : "relative h-[var(--layout-viewport-budget,calc(100dvh-160px))] min-h-[460px] w-full overflow-hidden"
        }
        aria-describedby="pdt-booth-description"
        data-sheet={registerSheetOpen ? "open" : undefined}
      >
        <p id="pdt-booth-description" className="sr-only">
          {BOOTH_DESCRIPTION}
        </p>
        <div
          className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
          data-testid="pdt-stage"
          data-facing={touchCabinet ? facing : undefined}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <BoothScene
            store={store}
            onOpenRegister={openRegister}
            onContextLost={handleContextLost}
          />
        </div>
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 z-20 p-2 sm:p-3${
            touchCabinet ? " pdt-top" : ""
          }`}
        >
          <ShiftHud
            store={store}
            hideWipe={touchCabinet}
            viewToggle={<ViewToggle view="3d" onChange={changeView} />}
          />
          {registerSheetOpen ? null : (
            <DilemmaPrompt store={store} className="mx-auto mt-2 max-w-xl" />
          )}
        </div>
        {touchCabinet ? (
          registerSheetOpen ? (
            // The register is a sheet over the booth: along the bottom held
            // upright, down the right side held sideways. The caption and any
            // dilemma ride inside it, so it holds everything a player answers.
            <div
              ref={registerSheetRef}
              role="dialog"
              aria-modal="true"
              aria-label="Drive-thru register"
              data-testid="pdt-register-sheet"
              className="pdt-sheet"
            >
              <div className="pdt-sheet-head">
                <ShiftCaption store={store} className="min-w-0 flex-1" />
                <button
                  type="button"
                  onClick={closeRegister}
                  aria-keyshortcuts="Escape"
                  className="pdt-sheet-close min-h-11"
                >
                  Back to booth
                </button>
              </div>
              <DilemmaPrompt store={store} />
              <Register
                ref={registerRef}
                store={store}
                onLeave={closeRegister}
                className="w-full"
              />
            </div>
          ) : (
            <div className="pdt-booth-foot pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-1 p-2">
              <ShiftCaption store={store} className="text-center" />
              <p className="px-3 text-center font-mono text-xs text-[var(--pdt-hud-text)] [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
                Drag the booth or hold the arrows to turn. Tap Register to take
                orders.
              </p>
            </div>
          )
        ) : (
          <div
            className={`absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 p-2 sm:p-3 ${
              registerOpen ? "z-30" : "pointer-events-none z-20"
            }`}
          >
            <ShiftCaption store={store} className="text-center" />
            {registerOpen ? (
              <Register
                ref={registerRef}
                store={store}
                onLeave={closeRegister}
                className="w-full max-w-2xl shadow-2xl"
              />
            ) : (
              <p className="px-3 text-center font-mono text-[11px] text-[var(--pdt-hud-text)] [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
                Enter or Tab: use the register · A / D or drag: turn · W: wipe ·
                Q / E: answer · P or Esc: pause
              </p>
            )}
          </div>
        )}
        {yells > 0 ? (
          <div key={yells} aria-hidden="true" className="pdt-yell-vignette" />
        ) : null}
      </div>
    );
  } else {
    body = (
      <div
        className={`flex w-full min-w-0 flex-col gap-3 p-2 sm:p-4${
          touchCabinet ? " pdt-flat" : ""
        }`}
      >
        <ShiftHud
          store={store}
          hideWipe={touchCabinet}
          viewToggle={
            webgl ? <ViewToggle view="flat" onChange={changeView} /> : null
          }
        />
        <DilemmaPrompt store={store} />
        <ShiftCaption store={store} />
        <p
          className={`font-mono text-[11px] text-[var(--pdt-hud-dim)]${
            touchCabinet ? " sr-only" : ""
          }`}
        >
          {contextLost
            ? "The 3D booth stopped responding, so this is the flat view. "
            : ""}
          {BOOTH_DESCRIPTION}
        </p>
        <p
          data-testid="pdt-key-legend"
          className={`font-mono text-[11px] text-[var(--pdt-hud-text)]${
            touchCabinet ? " sr-only" : ""
          }`}
        >
          Keys: 1-6 pick the ticket with that key · B bump · R re-enter drink ·
          C flag {BOOTH_CREW.coworker} · W wipe · Q / E answer · P or Esc pause
        </p>
        <div
          className={`grid min-w-0 gap-3 @3xl:grid-cols-2${
            touchCabinet ? " pdt-flat-grid" : ""
          }`}
        >
          <KdsBoard store={store} />
          <Register store={store} />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={boundaryRef}
      tabIndex={0}
      data-keyboard-boundary="true"
      data-pdt-cabinet=""
      data-pdt-view={view}
      data-escape-docks={touchCabinet && phase === "shift" ? "true" : undefined}
      data-testid="pdt-game"
      aria-label="Patty's Drive-Thru"
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          heldKeys.current.clear();
        }
      }}
      className={`pdt-root @container relative flex min-h-[460px] w-full min-w-0 flex-col items-stretch bg-[var(--pdt-stage)] text-[var(--pdt-hud-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--pdt-focus)]${
        touchCabinet ? " pdt-touch" : ""
      }`}
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
      {touchCabinet && phase === "shift" ? (
        // In the flat view there is nothing to turn to or open, so the dock
        // keeps only the wipe and the pause.
        <PattyTouchDock
          store={store}
          view={view}
          registerOpen={registerOpen}
          onTurn={handleTurn}
          onToggleRegister={toggleRegister}
          onPause={() => setPaused(true)}
        />
      ) : null}
      {phase === "shift" && userPaused ? (
        <div
          data-testid="pdt-paused"
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
        >
          <div
            ref={pauseDialogRef}
            {...(touchCabinet
              ? {
                  role: "dialog",
                  "aria-modal": true,
                  "aria-labelledby": "pdt-paused-title",
                }
              : {})}
            className="flex flex-col items-center gap-3 rounded border border-[var(--pdt-hud-rule)] bg-[var(--pdt-stage)] p-5 text-center"
          >
            <p
              id={touchCabinet ? "pdt-paused-title" : undefined}
              className="font-mono text-sm font-bold uppercase tracking-wide"
            >
              Shift paused
            </p>
            <p className="font-mono text-[11px] text-[var(--pdt-hud-text)]">
              The clock is stopped. P or Esc to resume.
            </p>
            <button
              ref={resumeRef}
              type="button"
              onClick={() => {
                setPaused(false);
                boundaryRef.current?.focus({ preventScroll: true });
              }}
              className="min-h-11 rounded border border-[var(--pdt-hud-rule)] bg-[var(--pdt-hud-button)] px-4 text-xs font-bold uppercase tracking-wide text-[var(--pdt-hud-text)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pdt-focus)]"
            >
              Resume shift
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: "3d" | "flat";
  onChange: (next: ViewChoice) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(view === "3d" ? "flat" : "3d")}
      className="min-h-11 rounded border border-[var(--pdt-hud-rule)] bg-[var(--pdt-hud-button)] px-3 text-xs font-bold uppercase tracking-wide text-[var(--pdt-hud-text)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pdt-focus)]"
    >
      {view === "3d" ? "Flat view" : "3D booth"}
    </button>
  );
}
