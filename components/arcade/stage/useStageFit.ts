"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import {
  computeStageFit,
  mapClientToStage,
  mapStageToClient,
  type StageFit,
  type StageFitOptions,
  type StagePoint,
  type StageRect,
  type StageSlot,
} from "@/lib/arcade";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Options for {@link useStageFit}: the pure fit's options. */
export type UseStageFitOptions = StageFitOptions;

/** What {@link useStageFit} returns. */
export interface UseStageFitResult {
  /** The box and backing store, or null until the slot has a size. */
  fit: StageFit | null;
  /** The slot size the fit was computed from, in CSS pixels. */
  slot: StageSlot | null;
  /**
   * Maps a pointer's client position to game units on the canvas shown at
   * `rect` (the canvas's `getBoundingClientRect()`). Null for an empty rect.
   */
  toGame: (
    clientX: number,
    clientY: number,
    rect: StageRect
  ) => StagePoint | null;
  /** Maps a game point to client pixels on the canvas shown at `rect`. */
  toClient: (
    gameX: number,
    gameY: number,
    rect: StageRect
  ) => { x: number; y: number } | null;
}

/**
 * Subscribes to device pixel ratio changes: page zoom, or a window moved to
 * another screen. A resolution query matches only the ratio it was made for,
 * so each change re-arms it for the new ratio.
 */
function subscribeDevicePixelRatio(onChange: () => void): () => void {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return () => {};
  }
  let query: MediaQueryList | null = null;
  const handle = () => {
    arm();
    onChange();
  };
  const disarm = () => {
    if (query && typeof query.removeEventListener === "function") {
      query.removeEventListener("change", handle);
    }
    query = null;
  };
  function arm() {
    disarm();
    try {
      query = window.matchMedia(
        `(resolution: ${window.devicePixelRatio || 1}dppx)`
      );
    } catch {
      query = null;
    }
    if (query && typeof query.addEventListener === "function") {
      query.addEventListener("change", handle);
    }
  }
  arm();
  return disarm;
}

function readDevicePixelRatio(): number {
  return typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
}

function serverDevicePixelRatio(): number {
  return 1;
}

/**
 * Whether a new measurement replaces the slot. Width is what the fit follows
 * (AGENTS.md section 16): a height that only grows, as when a mobile URL bar
 * collapses, waits for the next width change. A height that shrinks refits
 * at once, so the box never overflows its slot.
 */
function acceptsSlot(prev: StageSlot | null, next: StageSlot): boolean {
  if (!prev) return true;
  if (prev.width === next.width && prev.height === next.height) return false;
  if (Math.floor(next.width) !== Math.floor(prev.width)) return true;
  return Math.floor(next.height) < Math.floor(prev.height);
}

/**
 * Sizes a canvas to its stage slot (#2358). Measures the element in `ref`,
 * then keeps the largest box at `aspect` that fits it, snapped by `scale`,
 * with the backing store at the capped device pixel ratio.
 *
 * The slot is measured once on mount and then by a ResizeObserver. State
 * changes only when the slot or the device pixel ratio does, never per frame.
 * A slot with no size keeps the previous fit. The element in `ref` may change
 * between renders; the hook follows it.
 *
 * @param ref - The stage slot (the element the canvas is centred in).
 * @param options - Aspect, scale mode, DPR cap and scale floor.
 * @returns The fit, the measured slot, and pointer mapping helpers.
 */
export function useStageFit(
  ref: RefObject<HTMLElement | null>,
  options: UseStageFitOptions
): UseStageFitResult {
  const { width: aspectWidth, height: aspectHeight } = options.aspect;
  const { scale, maxDpr, minScale } = options;

  const dpr = useSyncExternalStore(
    subscribeDevicePixelRatio,
    readDevicePixelRatio,
    serverDevicePixelRatio
  );
  const [slot, setSlot] = useState<StageSlot | null>(null);
  const slotRef = useRef<StageSlot | null>(null);
  const observedRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  // Runs after every commit, but only does work when the element changed:
  // a game can move its slot to a new parent (desktop to touch layout).
  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (element === observedRef.current) return;
    observerRef.current?.disconnect();
    observerRef.current = null;
    observedRef.current = element;
    if (!element) return;

    const measure = (force: boolean) => {
      const rect = element.getBoundingClientRect();
      if (!(rect.width > 0) || !(rect.height > 0)) return;
      const next = { width: rect.width, height: rect.height };
      const prev = slotRef.current;
      if (
        force
          ? prev?.width === next.width && prev?.height === next.height
          : !acceptsSlot(prev, next)
      ) {
        return;
      }
      slotRef.current = next;
      setSlot(next);
    };
    // A new element is always measured, whatever the last one was.
    measure(true);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure(false));
    observer.observe(element);
    observerRef.current = observer;
  });

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      observedRef.current = null;
    },
    []
  );

  const fit = useMemo(
    () =>
      slot
        ? computeStageFit(slot, dpr, {
            aspect: { width: aspectWidth, height: aspectHeight },
            scale,
            maxDpr,
            minScale,
          })
        : null,
    [slot, dpr, aspectWidth, aspectHeight, scale, maxDpr, minScale]
  );

  const toGame = useCallback(
    (clientX: number, clientY: number, rect: StageRect) =>
      mapClientToStage(clientX, clientY, rect, {
        width: aspectWidth,
        height: aspectHeight,
      }),
    [aspectWidth, aspectHeight]
  );
  const toClient = useCallback(
    (gameX: number, gameY: number, rect: StageRect) =>
      mapStageToClient(gameX, gameY, rect, {
        width: aspectWidth,
        height: aspectHeight,
      }),
    [aspectWidth, aspectHeight]
  );

  return { fit, slot, toGame, toClient };
}
