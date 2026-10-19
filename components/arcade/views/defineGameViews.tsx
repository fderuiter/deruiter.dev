"use client";

import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from "react";
import type { FormFactor } from "@/lib/arcade/form-factor";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import { getMatchMediaMatches } from "@/hooks/useMediaQuery";
import { TOUCH_DEVICE_QUERY } from "@/components/arcade/mobile/immersive";
import { reportClientError } from "@/lib/client-sentry";

/** A dynamic import of one view module, whose default export is the view. */
export type GameViewLoader = () => Promise<{ default: ComponentType }>;

/**
 * A game's three views (ADR 0062). Each entry is a dynamic import, so every
 * view is its own chunk. A view not built yet names the view it borrows: a
 * phone view that is still `"desktop"` shows the desktop layout (behind the
 * desktop-only gate on phones until the game's phone pass), and loads no
 * extra chunk.
 */
export interface GameViewsDefinition {
  /**
   * Holds the game's `use<Game>Session()` and provides it with
   * `ArcadeSessionProvider`. The cabinet mounts it once after Launch, above
   * the views, so a view swap keeps the run.
   */
  readonly session?: ComponentType<{ children: ReactNode }>;
  readonly desktop: GameViewLoader;
  readonly tablet: GameViewLoader | "desktop";
  readonly phone: GameViewLoader | "desktop" | "tablet";
}

/** The views a cabinet hosts, made by {@link defineGameViews}. */
export interface GameViews {
  readonly session?: ComponentType<{ children: ReactNode }>;
  /** The view component each form factor shows. Borrowed views share one. */
  readonly components: Readonly<
    Record<FormFactor, LazyExoticComponent<ComponentType>>
  >;
  /** The view each form factor actually shows, after borrowing. */
  readonly resolved: Readonly<Record<FormFactor, FormFactor>>;
  /** Each form factor's import, after borrowing, to preload or retry it. */
  readonly loaders: Readonly<Record<FormFactor, GameViewLoader>>;
}

/**
 * Declare a game's views. Call it once at module scope, so each view's lazy
 * component is made once and its chunk loads only when that view mounts.
 *
 * @param definition - The session holder and the three view imports.
 * @returns The views to pass to `PlayCabinet`'s `views` prop.
 */
export function defineGameViews(definition: GameViewsDefinition): GameViews {
  const desktop = lazy(definition.desktop);
  const tablet =
    definition.tablet === "desktop" ? desktop : lazy(definition.tablet);
  let phone: LazyExoticComponent<ComponentType>;
  if (definition.phone === "desktop") phone = desktop;
  else if (definition.phone === "tablet") phone = tablet;
  else phone = lazy(definition.phone);

  const tabletLoader =
    definition.tablet === "desktop" ? definition.desktop : definition.tablet;
  let phoneLoader: GameViewLoader;
  if (definition.phone === "desktop") phoneLoader = definition.desktop;
  else if (definition.phone === "tablet") phoneLoader = tabletLoader;
  else phoneLoader = definition.phone;

  const tabletShows: FormFactor =
    definition.tablet === "desktop" ? "desktop" : "tablet";
  let phoneShows: FormFactor = "phone";
  if (definition.phone === "desktop") phoneShows = "desktop";
  else if (definition.phone === "tablet") phoneShows = tabletShows;

  return {
    session: definition.session,
    components: { desktop, tablet, phone },
    resolved: { desktop: "desktop", tablet: tabletShows, phone: phoneShows },
    loaders: {
      desktop: definition.desktop,
      tablet: tabletLoader,
      phone: phoneLoader,
    },
  };
}

/** What {@link useShownView} returns. */
export interface ShownView {
  /** The view to mount, or undefined before Launch. */
  readonly shown: FormFactor | undefined;
  /** The view a swap wanted but could not load, if the last swap failed. */
  readonly failed: FormFactor | null;
}

interface ShownState {
  readonly shown: FormFactor | undefined;
  readonly failed: FormFactor | null;
}

/**
 * The view to mount for a target view. The first view mounts at once. A
 * later swap loads the new view's chunk before it unmounts the old view; if
 * the chunk fails, the old view stays and `failed` names the one that did
 * not load, and the swap is tried again when the target next changes.
 *
 * @param views - The game's views, if the cabinet hosts any.
 * @param target - The view the form factor wants, or undefined before Launch.
 * @returns The view to mount and any failed swap.
 */
export function useShownView(
  views: GameViews | undefined,
  target: FormFactor | undefined
): ShownView {
  const [state, setState] = useState<ShownState>({
    shown: target,
    failed: null,
  });
  // Launch mounts the first view directly, and leaving the cabinet clears it.
  if ((target === undefined) !== (state.shown === undefined)) {
    setState({ shown: target, failed: null });
  }
  const shown = target === undefined ? undefined : (state.shown ?? target);

  useEffect(() => {
    if (!views || !target || !shown || target === shown) return;
    let cancelled = false;
    views.loaders[target]().then(
      () => {
        if (!cancelled) setState({ shown: target, failed: null });
      },
      () => {
        if (!cancelled) setState({ shown, failed: target });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [views, target, shown]);

  return {
    shown,
    failed: state.failed !== null && state.failed === target ? target : null,
  };
}

/**
 * After Launch, loads on idle the other views this device can reach, so a
 * swap does not wait on the network. Only a touch device that is not a phone
 * prefetches: an iPad can reach the phone view through Split View, while a
 * phone never leaves the phone view and a desktop loads a view when it swaps.
 *
 * @param views - The game's views, if the cabinet hosts any.
 * @param view - The view the form factor wants, or undefined before Launch.
 */
export function usePrefetchViews(
  views: GameViews | undefined,
  view: FormFactor | undefined
): void {
  useEffect(() => {
    if (!views || !view || view === "phone") return;
    if (!getMatchMediaMatches(TOUCH_DEVICE_QUERY)) return;
    const reachable = new Set<FormFactor>([
      views.resolved.tablet,
      views.resolved.phone,
    ]);
    reachable.delete(views.resolved[view]);
    if (reachable.size === 0) return;
    const prefetch = () => {
      // A failed prefetch is retried by the swap itself.
      reachable.forEach((next) => void views.loaders[next]().catch(() => {}));
    };
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(prefetch);
      return () => window.cancelIdleCallback(handle);
    }
    const timer = window.setTimeout(prefetch, 1);
    return () => window.clearTimeout(timer);
  }, [views, view]);
}

/** Props for {@link GameViewHost}. */
export interface GameViewHostProps {
  readonly views: GameViews;
  /** The view to mount, from {@link useShownView}. */
  readonly view: FormFactor;
  /** A view a swap could not load, so the player hears why nothing changed. */
  readonly failedSwap?: FormFactor | null;
}

function ViewLoading() {
  return (
    <div
      role="status"
      className="flex min-h-[200px] w-full items-center justify-center font-mono text-sm text-zinc-300"
    >
      Loading view…
    </div>
  );
}

const LARGER_ORDER: readonly FormFactor[] = ["phone", "tablet", "desktop"];

/** The next larger view the game really has, for a view that did not load. */
function largerView(views: GameViews, view: FormFactor): FormFactor | null {
  for (let i = LARGER_ORDER.indexOf(view) + 1; i < LARGER_ORDER.length; i++) {
    const candidate = views.resolved[LARGER_ORDER[i]];
    if (candidate !== view) return candidate;
  }
  return null;
}

interface ViewBoundaryProps {
  readonly fallback: ReactNode;
  readonly children: ReactNode;
}

class ViewBoundary extends Component<ViewBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    void reportClientError(error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface Recovery {
  readonly forView: FormFactor;
  readonly attempt: number;
  readonly fallback: FormFactor | null;
  /** A fresh lazy view for a retry; React keeps a failed lazy one failed. */
  readonly retry: LazyExoticComponent<ComponentType> | null;
}

/**
 * Mounts the game's session once, and inside it the one view the cabinet
 * chose. Swapping `view` replaces only the view, so the session keeps the run.
 * If the view's chunk does not load, the slot offers Retry and the next
 * larger view, and the session above it keeps the run meanwhile.
 */
export function GameViewHost({ views, view, failedSwap }: GameViewHostProps) {
  const [recovery, setRecovery] = useState<Recovery>({
    forView: view,
    attempt: 0,
    fallback: null,
    retry: null,
  });
  if (recovery.forView !== view) {
    setRecovery({ forView: view, attempt: 0, fallback: null, retry: null });
  }
  const mounted = recovery.fallback ?? view;
  const { attempt } = recovery;
  const View = recovery.retry ?? views.components[mounted];
  const larger = largerView(views, mounted);
  const { announce } = useAnnouncer();
  const announcedRef = useRef<FormFactor | null>(null);
  useEffect(() => {
    // Name the new layout after a swap; the first view needs no notice.
    const previous = announcedRef.current;
    announcedRef.current = mounted;
    if (previous && previous !== mounted) announce(`${mounted} layout`);
  }, [announce, mounted]);
  const [dismissedSwap, setDismissedSwap] = useState<FormFactor | null>(null);
  if (!failedSwap && dismissedSwap) setDismissedSwap(null);
  const showSwapToast = Boolean(failedSwap) && dismissedSwap !== failedSwap;
  useEffect(() => {
    if (!failedSwap) return;
    announce(
      `The ${failedSwap} layout did not load, so this one stays. It will try again the next time the screen changes size.`
    );
    const timer = window.setTimeout(() => setDismissedSwap(failedSwap), 5000);
    return () => window.clearTimeout(timer);
  }, [announce, failedSwap]);
  const remount = (next: FormFactor) =>
    setRecovery({
      forView: view,
      attempt: attempt + 1,
      fallback: next === view ? null : next,
      retry: lazy(views.loaders[next]),
    });
  const Session = views.session;

  const fallback = (
    <div
      role="alert"
      className="flex min-h-[200px] w-full flex-col items-center justify-center gap-3 p-4 text-center font-mono text-sm text-zinc-200"
    >
      <p>This layout did not load. Your game is paused and safe.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className="min-h-12 rounded border border-zinc-700 px-4 py-2 hover:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 active:scale-[0.98]"
          onClick={() => remount(mounted)}
        >
          Retry
        </button>
        {larger ? (
          <button
            type="button"
            className="min-h-12 rounded border border-zinc-700 px-4 py-2 hover:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 active:scale-[0.98]"
            onClick={() => remount(larger)}
          >
            Use the {larger} layout
          </button>
        ) : null}
      </div>
    </div>
  );

  const content = (
    <>
      {showSwapToast ? (
        <p
          data-testid="view-swap-toast"
          className="pointer-events-none absolute left-1/2 top-2 z-40 max-w-[90%] -translate-x-1/2 rounded border border-zinc-800 bg-[#13151a] px-3 py-1 text-center font-mono text-xs text-zinc-200"
        >
          The {failedSwap} layout did not load. Trying again next time.
        </p>
      ) : null}
      <ViewBoundary key={`${mounted}-${attempt}`} fallback={fallback}>
        <Suspense fallback={<ViewLoading />}>
          <View key={views.resolved[mounted]} />
        </Suspense>
      </ViewBoundary>
    </>
  );
  return Session ? <Session>{content}</Session> : content;
}
