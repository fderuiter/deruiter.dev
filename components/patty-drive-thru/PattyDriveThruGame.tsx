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
  DEFAULT_SHIFT_CONFIG,
  getKdsTickets,
  scoreShift,
  type ShiftAction,
  type ShiftConfig,
  type ShiftScenarioConfig,
} from "@/lib/patty-drive-thru";
import { recordArcadeScore } from "@/lib/arcade-achievements";
import { getSoundEngine } from "@/lib/audio/sound-engine";
import {
  getMatchMediaMatches,
  usePrefersReducedMotion,
} from "@/hooks/useMediaQuery";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import { useCabinetSetup } from "@/components/arcade/CabinetSetupContext";
import { playShiftEvents } from "./booth-audio";
import { DiaryIntroPage, ShiftEndPage } from "./DiaryPages";
import { useBooth } from "./hooks";
import { KdsBoard } from "./KdsBoard";
import { Register } from "./Register";
import { ShiftCaption, ShiftHud } from "./ShiftHud";
import { createBoothStore, type BoothStore } from "./store";

/** The arcade id used for scores, trophies and the cabinet. */
const PATTY_GAME_ID = "patty-drive-thru";

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

const LEFT_KEYS = new Set(["a", "A", "ArrowLeft"]);
const RIGHT_KEYS = new Set(["d", "D", "ArrowRight"]);

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

/** A fresh seed per shift, so no two shifts play the same. */
function freshSeed(): string {
  return `${DEFAULT_SHIFT_CONFIG.seed}-${Date.now().toString(36)}`;
}

/** A seed from the page's `?seed=` parameter, so a shift can be replayed. */
function seedFromUrl(): string | null {
  const seed = new URLSearchParams(window.location.search).get("seed");
  return seed && /^[\w-]{1,40}$/.test(seed) ? seed : null;
}

export function PattyDriveThruGame({
  config,
  initialView = "auto",
}: PattyDriveThruGameProps) {
  const [store] = useState<BoothStore>(() => createBoothStore(config));
  const phase = useBooth(store, (s) => s.phase);
  const registerOpen = useBooth(store, (s) => s.registerOpen);
  const announcement = useBooth(store, (s) => s.announcement);
  const yells = useBooth(store, (s) => s.yells);
  const endedShift = useBooth(store, (s) =>
    s.phase === "ended" ? s.shift : null
  );

  const webgl = useWebglSupport();
  const reducedMotion = usePrefersReducedMotion();
  const [viewChoice, setViewChoice] = useState<ViewChoice>(initialView);
  const [contextLost, setContextLost] = useState(false);
  const autoView = webgl && !reducedMotion ? "3d" : "flat";
  const wanted = viewChoice === "auto" ? autoView : viewChoice;
  const view = wanted === "3d" && webgl && !contextLost ? "3d" : "flat";

  const setup = useCabinetSetup();
  const paused = setup?.isSetupOpen ?? false;

  const boundaryRef = useRef<HTMLDivElement>(null);
  const registerRef = useRef<HTMLDivElement>(null);
  const heldKeys = useRef(new Set<string>());
  const drag = useRef({ yaw: 0, pitch: 0 });
  const pointer = useRef<{
    id: number;
    x: number;
    y: number;
    dragging: boolean;
  } | null>(null);

  const clockIn = useCallback(
    (customConfig?: Partial<ShiftScenarioConfig>) => {
      const mergedConfig = customConfig
        ? { ...customConfig }
        : config?.seed
          ? { ...config }
          : { ...config, seed: seedFromUrl() ?? freshSeed() };
      store.getState().clockIn(mergedConfig);
      boundaryRef.current?.focus({ preventScroll: true });
    },
    [store, config]
  );

  const openRegister = useCallback(() => {
    if (store.getState().phase !== "shift") return;
    heldKeys.current.clear();
    store.getState().setRegisterOpen(true);
  }, [store]);

  const closeRegister = useCallback(() => {
    store.getState().setRegisterOpen(false);
    boundaryRef.current?.focus({ preventScroll: true });
  }, [store]);

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

  // Record the score once per shift, when it ends.
  useEffect(
    () =>
      store.subscribe((state, previous) => {
        if (state.phase === "ended" && previous.phase === "shift") {
          recordArcadeScore(PATTY_GAME_ID, scoreShift(state.shift), {
            outcome: state.shift.outcome,
            served: state.shift.tallies.served,
          });
        }
      }),
    [store]
  );

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

    if (
      view === "3d" &&
      !state.registerOpen &&
      (LEFT_KEYS.has(key) || RIGHT_KEYS.has(key))
    ) {
      event.preventDefault();
      heldKeys.current.add(key);
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

  let body: React.ReactNode;
  if (phase === "intro") {
    body = (
      <div className="w-full p-3 sm:p-6">
        <DiaryIntroPage onClockIn={clockIn} />
      </div>
    );
  } else if (phase === "ended" && endedShift) {
    body = (
      <div className="w-full p-3 sm:p-6">
        <ShiftEndPage shift={endedShift} onClockIn={clockIn} />
      </div>
    );
  } else if (view === "3d") {
    body = (
      <div
        className="relative h-[var(--layout-viewport-budget,calc(100dvh-160px))] min-h-[460px] w-full overflow-hidden"
        aria-describedby="pdt-booth-description"
      >
        <p id="pdt-booth-description" className="sr-only">
          {BOOTH_DESCRIPTION}
        </p>
        <div
          className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
          data-testid="pdt-stage"
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
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-2 sm:p-3">
          <ShiftHud
            store={store}
            viewToggle={<ViewToggle view="3d" onChange={setViewChoice} />}
          />
        </div>
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
              Enter or Tab: use the register · A / D or drag: turn · W: wipe
            </p>
          )}
        </div>
        {yells > 0 ? (
          <div key={yells} aria-hidden="true" className="pdt-yell-vignette" />
        ) : null}
      </div>
    );
  } else {
    body = (
      <div className="flex w-full min-w-0 flex-col gap-3 p-2 sm:p-4">
        <ShiftHud
          store={store}
          viewToggle={
            webgl ? <ViewToggle view="flat" onChange={setViewChoice} /> : null
          }
        />
        <ShiftCaption store={store} />
        <p className="font-mono text-[11px] text-[var(--pdt-hud-dim)]">
          {contextLost
            ? "The 3D booth stopped responding, so this is the flat view. "
            : ""}
          {BOOTH_DESCRIPTION}
        </p>
        <div className="grid min-w-0 gap-3 @3xl:grid-cols-2">
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
      data-testid="pdt-game"
      aria-label="Patty's Drive-Thru"
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          heldKeys.current.clear();
        }
      }}
      className="pdt-root @container relative flex min-h-[460px] w-full min-w-0 flex-col items-stretch bg-[var(--pdt-stage)] text-[var(--pdt-hud-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--pdt-focus)]"
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
