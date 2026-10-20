import {
  SWIPE_THRESHOLD_PX,
  swipeDirection,
  type SwipeDirection,
} from "@/components/arcade/mobile/swipe";

/** Distance, in CSS pixels, a pointer may wander and still be a tap or a hold. */
const GESTURE_SLOP_PX = 8;
/** Time a still pointer must stay down to count as a long-press. */
export const LONG_PRESS_MS = 450;
/** Longest gap between two taps that still makes a double-tap. */
const DOUBLE_TAP_MS = 300;

/**
 * The input a gesture came from. A Pencil reads as touch (ADR 0061), so a
 * game handles a finger and a Pencil the same way.
 */
type GestureInput = "touch" | "mouse";

/** One pointer sample, taken from a PointerEvent. */
export interface GesturePointer {
  pointerId: number;
  pointerType: string;
  /** Primary button only for a mouse; ignored for touch and pen. */
  button?: number;
  x: number;
  y: number;
}

/** Where a tap, double-tap or long-press landed. */
interface GesturePointInfo {
  x: number;
  y: number;
  input: GestureInput;
}

/** A pan in progress or just ended. */
interface GesturePanInfo extends GesturePointInfo {
  /** Distance from where the pointer went down. */
  dx: number;
  dy: number;
  /** Distance since the previous pan report. */
  deltaX: number;
  deltaY: number;
  /** Velocity in pixels per millisecond, from the latest movement. */
  vx: number;
  vy: number;
}

/** A two-finger pinch and pan in progress or just ended. */
interface GesturePinchInfo {
  /** Finger spread relative to where the pinch began; 1 is unchanged. */
  scale: number;
  /** Midpoint of the two fingers. */
  centerX: number;
  centerY: number;
  /** How far the midpoint has moved since the pinch began. */
  panX: number;
  panY: number;
}

/**
 * Callbacks for each recognised gesture. Leave out the ones a stage does not
 * use. `onTap` fires for every tap, including both taps of a double-tap, so a
 * tap never waits on a possible second one.
 */
export interface GestureHandlers {
  onTap?: (info: GesturePointInfo) => void;
  /** Needs `doubleTap: true`. */
  onDoubleTap?: (info: GesturePointInfo) => void;
  onLongPress?: (info: GesturePointInfo) => void;
  onPanStart?: (info: GesturePanInfo) => void;
  onPan?: (info: GesturePanInfo) => void;
  onPanEnd?: (info: GesturePanInfo) => void;
  /** Fires after `onPanEnd` when the pan went far enough to name a direction. */
  onSwipe?: (direction: SwipeDirection, info: GesturePanInfo) => void;
  /** Needs `pinch: true`. */
  onPinchStart?: (info: GesturePinchInfo) => void;
  onPinch?: (info: GesturePinchInfo) => void;
  onPinchEnd?: (info: GesturePinchInfo) => void;
  /**
   * A pan, pinch or pending tap was abandoned: a second finger landed with
   * pinch off, or the browser sent `pointercancel` (it took the touch to
   * scroll, or the page lost focus).
   */
  onCancel?: () => void;
}

/** Timers and a clock, injected so tests can drive the recogniser. */
interface GestureTimers {
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  now: () => number;
}

/** Tuning for a recogniser. Every field has a default. */
export interface GestureOptions extends Partial<GestureTimers> {
  /** Movement that turns a press into a pan. Default 8px. */
  slop?: number;
  /** Hold time for a long-press. Default 450ms. */
  longPressMs?: number;
  /** Recognise double-taps. Default off. */
  doubleTap?: boolean;
  /** Gap allowed between the taps of a double-tap. Default 300ms. */
  doubleTapMs?: number;
  /** Recognise a two-finger pinch and pan. Default off. */
  pinch?: boolean;
  /** Shortest pan that is also a swipe. Default `SWIPE_THRESHOLD_PX`. */
  swipeThreshold?: number;
  /** Called when a long-press is recognised, for a haptic tick. */
  onHaptic?: () => void;
}

/** The gesture a pointer sequence ended as, so a binding can swallow the click. */
type GestureOutcome =
  "none" | "tap" | "long-press" | "pan" | "pinch" | "cancel";

/** A gesture recogniser for one element. Feed it the element's pointer events. */
interface GestureRecognizer {
  /** A pointer went down. Returns false when the pointer is ignored. */
  down(pointer: GesturePointer): boolean;
  move(pointer: GesturePointer): void;
  /** A pointer lifted. Returns what the sequence was once the last one lifts. */
  up(pointer: GesturePointer): GestureOutcome;
  /** The browser cancelled a pointer, or the binding is going away. */
  cancel(): void;
  /** Ends any pending timer. */
  dispose(): void;
}

interface Sample {
  x: number;
  y: number;
  t: number;
}

type Phase = "idle" | "pending" | "long-press" | "pan" | "pinch" | "spent";

function inputOf(pointerType: string): GestureInput {
  return pointerType === "mouse" ? "mouse" : "touch";
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

/**
 * Builds a recogniser for tap, double-tap, long-press, pan, swipe and an
 * opt-in two-finger pinch. It is pure state: the caller supplies pointer
 * samples and gets callbacks back, so it runs the same in a test and a stage.
 *
 * @param getHandlers - Returns the current handlers; read at each callback so
 * a component's latest closures run.
 * @param options - Slop, timings, opt-ins and optional timer injection.
 * @returns A recogniser for one element.
 */
export function createGestureRecognizer(
  getHandlers: () => GestureHandlers,
  options: GestureOptions = {}
): GestureRecognizer {
  const slop = options.slop ?? GESTURE_SLOP_PX;
  const longPressMs = options.longPressMs ?? LONG_PRESS_MS;
  const doubleTapMs = options.doubleTapMs ?? DOUBLE_TAP_MS;
  const swipeThreshold = options.swipeThreshold ?? SWIPE_THRESHOLD_PX;
  const setTimer =
    options.setTimer ??
    ((callback: () => void, ms: number) => globalThis.setTimeout(callback, ms));
  const clearTimer =
    options.clearTimer ??
    ((handle: unknown) =>
      globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>));
  const now = options.now ?? (() => Date.now());

  const pointers = new Map<number, Sample>();
  let phase: Phase = "idle";
  let primary = -1;
  let input: GestureInput = "touch";
  let start: Sample = { x: 0, y: 0, t: 0 };
  let last: Sample = { x: 0, y: 0, t: 0 };
  let velocity = { vx: 0, vy: 0 };
  let longPressTimer: unknown = null;
  let lastTap: (Sample & { input: GestureInput }) | null = null;
  let pinchStart = { dist: 1, cx: 0, cy: 0 };
  let pinchLast: GesturePinchInfo | null = null;
  let outcome: GestureOutcome = "none";

  const clearLongPress = () => {
    if (longPressTimer !== null) clearTimer(longPressTimer);
    longPressTimer = null;
  };

  const panInfo = (x: number, y: number): GesturePanInfo => ({
    x,
    y,
    input,
    dx: x - start.x,
    dy: y - start.y,
    deltaX: x - last.x,
    deltaY: y - last.y,
    vx: velocity.vx,
    vy: velocity.vy,
  });

  const pinchInfo = (): GesturePinchInfo => {
    const [a, b] = Array.from(pointers.values());
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    return {
      scale: distance(a.x, a.y, b.x, b.y) / pinchStart.dist,
      centerX: cx,
      centerY: cy,
      panX: cx - pinchStart.cx,
      panY: cy - pinchStart.cy,
    };
  };

  /** Abandons the current gesture; the rest of the sequence is ignored. */
  const abandon = () => {
    clearLongPress();
    const wasActive =
      phase === "pending" || phase === "pan" || phase === "pinch";
    phase = "spent";
    outcome = "cancel";
    if (wasActive) getHandlers().onCancel?.();
  };

  const reset = () => {
    clearLongPress();
    pointers.clear();
    phase = "idle";
    primary = -1;
    pinchLast = null;
    outcome = "none";
  };

  return {
    down(pointer) {
      if (pointer.pointerType === "mouse" && (pointer.button ?? 0) !== 0) {
        return false;
      }
      if (pointers.has(pointer.pointerId)) return true;
      const t = now();
      if (pointers.size === 0) {
        pointers.set(pointer.pointerId, { x: pointer.x, y: pointer.y, t });
        phase = "pending";
        primary = pointer.pointerId;
        input = inputOf(pointer.pointerType);
        start = { x: pointer.x, y: pointer.y, t };
        last = start;
        outcome = "none";
        velocity = { vx: 0, vy: 0 };
        longPressTimer = setTimer(() => {
          longPressTimer = null;
          if (phase !== "pending") return;
          phase = "long-press";
          outcome = "long-press";
          options.onHaptic?.();
          getHandlers().onLongPress?.({ x: last.x, y: last.y, input });
        }, longPressMs);
        return true;
      }
      if (pointers.size >= 2) return false;
      pointers.set(pointer.pointerId, { x: pointer.x, y: pointer.y, t });
      if (!options.pinch || phase === "spent" || phase === "long-press") {
        abandon();
        return true;
      }
      // A second finger turns a press or a pan into a pinch.
      clearLongPress();
      if (phase === "pan") getHandlers().onCancel?.();
      const [a, b] = Array.from(pointers.values());
      pinchStart = {
        dist: Math.max(1, distance(a.x, a.y, b.x, b.y)),
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      };
      phase = "pinch";
      pinchLast = pinchInfo();
      getHandlers().onPinchStart?.(pinchLast);
      return true;
    },

    move(pointer) {
      const sample = pointers.get(pointer.pointerId);
      if (!sample) return;
      const t = now();
      pointers.set(pointer.pointerId, { x: pointer.x, y: pointer.y, t });
      if (phase === "pinch") {
        pinchLast = pinchInfo();
        getHandlers().onPinch?.(pinchLast);
        return;
      }
      if (pointer.pointerId !== primary) return;
      if (phase === "pending") {
        if (distance(start.x, start.y, pointer.x, pointer.y) <= slop) return;
        clearLongPress();
        phase = "pan";
        const dt = Math.max(1, t - last.t);
        velocity = {
          vx: (pointer.x - last.x) / dt,
          vy: (pointer.y - last.y) / dt,
        };
        getHandlers().onPanStart?.(panInfo(pointer.x, pointer.y));
        last = { x: pointer.x, y: pointer.y, t };
        return;
      }
      if (phase !== "pan") return;
      const dt = Math.max(1, t - last.t);
      velocity = {
        vx: (pointer.x - last.x) / dt,
        vy: (pointer.y - last.y) / dt,
      };
      getHandlers().onPan?.(panInfo(pointer.x, pointer.y));
      last = { x: pointer.x, y: pointer.y, t };
    },

    up(pointer) {
      if (!pointers.has(pointer.pointerId)) return "none";
      const handlers = getHandlers();
      if (phase === "pinch") {
        handlers.onPinchEnd?.(pinchLast ?? pinchInfo());
        phase = "spent";
        outcome = "pinch";
      } else if (pointer.pointerId === primary) {
        if (phase === "pending") {
          clearLongPress();
          const t = now();
          const info = { x: pointer.x, y: pointer.y, input };
          outcome = "tap";
          handlers.onTap?.(info);
          if (
            options.doubleTap &&
            lastTap &&
            lastTap.input === input &&
            t - lastTap.t <= doubleTapMs &&
            distance(lastTap.x, lastTap.y, pointer.x, pointer.y) <= slop * 3
          ) {
            lastTap = null;
            handlers.onDoubleTap?.(info);
          } else {
            lastTap = { x: pointer.x, y: pointer.y, t, input };
          }
        } else if (phase === "pan") {
          const info = panInfo(pointer.x, pointer.y);
          outcome = "pan";
          handlers.onPanEnd?.(info);
          const direction = swipeDirection(info.dx, info.dy, swipeThreshold);
          if (direction) handlers.onSwipe?.(direction, info);
        }
        phase = "spent";
      }
      pointers.delete(pointer.pointerId);
      if (pointers.size > 0) return "none";
      const ended: GestureOutcome = outcome === "none" ? "cancel" : outcome;
      reset();
      return ended;
    },

    cancel() {
      if (phase === "pinch") getHandlers().onCancel?.();
      else abandon();
      reset();
    },

    dispose() {
      reset();
      lastTap = null;
    },
  };
}
