"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createPauseController,
  type PauseController,
  type PauseListener,
  type PauseMenuItem,
  type PauseReason,
} from "./pause-controller";

const CabinetPauseContext = createContext<PauseController | null>(null);

/** Props for {@link CabinetPauseProvider}. */
export interface CabinetPauseProviderProps {
  readonly controller: PauseController;
  readonly children: ReactNode;
}

/** Provides the cabinet's pause service to the game inside it. */
export function CabinetPauseProvider({
  controller,
  children,
}: CabinetPauseProviderProps) {
  return (
    <CabinetPauseContext.Provider value={controller}>
      {children}
    </CabinetPauseContext.Provider>
  );
}

/**
 * The nearest cabinet's pause controller. Outside a cabinet, such as a game
 * rendered alone in a test, it is a private controller nothing else drives.
 *
 * @returns The controller.
 */
export function useCabinetPauseController(): PauseController {
  const provided = useContext(CabinetPauseContext);
  const [fallback] = useState(createPauseController);
  return provided ?? fallback;
}

/** What {@link useCabinetPause} returns. */
export interface CabinetPause {
  /** True while any reason holds the cabinet paused. */
  readonly paused: boolean;
  readonly reasons: ReadonlySet<PauseReason>;
  readonly pause: (reason: PauseReason) => void;
  /** Clears one reason, or with no argument does what Resume does. */
  readonly resume: (reason?: PauseReason) => void;
  readonly onPause: (listener: PauseListener) => () => void;
  readonly onResume: (listener: () => void) => () => void;
  readonly onSuspend: (listener: () => void) => () => void;
}

/**
 * The cabinet's pause state and controls (#2357). The component re-renders
 * when the state changes. A session pauses its loop while `paused` is set.
 *
 * @returns The pause state, its controls and its subscriptions.
 */
export function useCabinetPause(): CabinetPause {
  const controller = useCabinetPauseController();
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState
  );
  return useMemo(
    () => ({
      paused: state.paused,
      reasons: state.reasons,
      pause: controller.pause,
      resume: controller.resume,
      onPause: controller.onPause,
      onResume: controller.onResume,
      onSuspend: controller.onSuspend,
    }),
    [controller, state]
  );
}

/**
 * Tells the cabinet whether a real-time run is in progress, so it keeps the
 * screen awake while the run plays and is not paused. A turn-based game
 * never calls it.
 *
 * @param running - Whether a real-time run is in progress.
 */
export function useCabinetRunActive(running: boolean): void {
  const controller = useCabinetPauseController();
  useEffect(() => {
    controller.setRunning(running);
    return () => controller.setRunning(false);
  }, [controller, running]);
}

/**
 * Adds a game's own items to the cabinet's pause overlay while the calling
 * component is mounted. Pass a memoised list, so the items are not replaced
 * on every render.
 *
 * @param items - The items, in the order they show after the cabinet's own.
 */
export function usePauseMenuItems(items: readonly PauseMenuItem[]): void {
  const controller = useCabinetPauseController();
  const [owner] = useState(() => Symbol("pause-menu-items"));
  useEffect(
    () => controller.setMenuItems(owner, items),
    [controller, owner, items]
  );
}
