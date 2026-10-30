"use client";

import React, {
  useCallback,
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import Image from "next/image";
import "./cabinet-standby.css";
import { isProductionBuild } from "@/lib/env";
import {
  IconPlayerPlay,
  IconPower,
  IconTerminal,
  IconAdjustments,
  IconSchool,
} from "@tabler/icons-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useInterval } from "@/hooks/useInterval";
import { useSafeTimeout } from "@/hooks/useSafeTimeout";
import { CabinetFullscreenContext } from "./CabinetFullscreen";
import { CabinetSetupContext } from "./CabinetSetupContext";
import { CabinetSetupSheet } from "./CabinetSetupSheet";
import { FullscreenButton } from "@/components/arcade/FullscreenButton";
import {
  PreGameSetupWizard,
  getSavedSetupConfig,
  GameSetupConfig,
} from "@/components/arcade/PreGameSetupWizard";
import { logger } from "@/lib/logger";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DesktopOnlyGate } from "./DesktopOnlyGate";
import {
  CabinetTouchContext,
  lockScreenOrientation,
  RotateDevicePrompt,
  InputModalityAttribute,
  TouchControlsGate,
  useCabinetAutoPause,
  useOrientationMismatch,
  PHONE_ORIENTATION_QUERY,
  useTouchDevice,
  useFormFactor,
  usePhone,
  type MobileOrientation,
} from "@/components/arcade/mobile";
import {
  GameViewHost,
  usePrefetchViews,
  useShownView,
  type GameViews,
} from "@/components/arcade/views";
import {
  CabinetPauseProvider,
  PauseOverlay,
  createCabinetHistory,
  createPauseController,
  resolveBack,
  resolveEscape,
  showsPauseOverlay,
  useScreenWakeLock,
  type BackOutcome,
  type PauseReason,
} from "@/components/arcade/pause";
import {
  CabinetTutorialContext,
  TutorialOverlay,
  useTutorialRun,
} from "@/components/arcade/tutorial";
import {
  ARCADE_REGISTRY,
  buildCrtOverlayBackground,
  crtCalibrationForFilter,
  FORM_FACTORS,
  isPhoneGated,
  shouldCabinetDrawCrt,
  type FormFactor,
  type TutorialScript,
} from "@/lib/arcade";

interface ControlItem {
  key: string;
  action: string;
}

/** What a game's own launch choices get from the cabinet (#3466). */
interface LaunchControlProps {
  /** Launches the cabinet, as the Launch button does. */
  readonly launch: () => void;
  /** Starts loading the game engine, as hovering Launch does. */
  readonly prefetch: () => void;
}

interface PlayCabinetProps {
  gameId?: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  instructions: string;
  controls: ControlItem[];
  importComponent: () => Promise<unknown>;
  statusAnnouncement?: string;
  controlDock?: React.ReactNode;
  onLaunch?: () => void;
  onExit?: () => void;
  /**
   * Whether a bare F toggles fullscreen (default true). A game whose work key
   * is F passes false: F then never toggles fullscreen for this cabinet, in
   * any phase or key layout, so the game gets the key untouched (a Shift+F
   * included), and fullscreen is on the cabinet's button. Escape still leaves
   * fullscreen either way.
   */
  fullscreenKey?: boolean;
  /**
   * One title screen per game (#1516). When true (the default), the attract
   * screen is the game's title screen and the cabinet tells the game, through
   * `useSkipTitleScreen()`, to start straight into play after Launch. Pass
   * false for a game whose own start screen carries a choice the attract
   * screen cannot (a mode or character select).
   */
  singleTitleScreen?: boolean;
  /**
   * The orientation this game plays in (ADR 0061). On a touch phone the
   * launched cabinet covers the viewport, and a device held the other way gets
   * a prompt to turn it. `either` (the default) never prompts. Desktop is
   * unaffected.
   */
  mobileOrientation?: MobileOrientation;
  /**
   * How the immersive touch cabinet treats the stage (ADR 0061). `scroll`
   * (the default) keeps the stage a vertical scroll area, so a game that has
   * not had its mobile pass still reaches all of its content. `fit` is for a
   * game built to fit the viewport: the stage clips and takes every gesture.
   * Desktop is unaffected.
   */
  mobileLayout?: "fit" | "scroll";
  /**
   * Called when the game should pause itself: the tab is hidden, the page is
   * closing, the window blurs or the device rotates. Listens only while a
   * touch cabinet is immersive (ADR 0061). Resuming is the game's own choice.
   * A game on the cabinet's pause service (#2357) reads `useCabinetPause()`
   * instead and passes nothing here.
   */
  onAutoPause?: () => void;
  /**
   * The game's three views (ADR 0062), from `defineGameViews`. After Launch
   * the cabinet mounts the view `useFormFactor` picks, sets `data-view` on
   * its root, and swaps views live when the viewport crosses a breakpoint,
   * pausing with reason `view-swap` (and calling `onAutoPause`) first so
   * nothing is lost mid-action. A cabinet with views also shows the shared
   * pause overlay and owns P and Escape (#2357).
   * Without it the cabinet renders `children`, as before.
   */
  views?: GameViews;
  /**
   * The game's own options for the Setup sheet (#2923), shown under the
   * device settings every game shares.
   */
  setupItems?: React.ReactNode;
  /**
   * The game's guided tutorial (#2972). The cabinet offers it once on
   * launch, adds a Tutorial key beside Setup, and gives the game
   * `useCabinetTutorial()` for its practice signals.
   */
  tutorial?: TutorialScript;
  /**
   * Replaces the Launch button with the game's own launch choices, such as
   * Resume and New run (#3466). It gets the cabinet's `launch` and the
   * engine `prefetch`; leave it out for the standard Launch button.
   */
  launchControl?: React.ComponentType<LaunchControlProps>;
  children?: React.ReactNode;
}

// Windowed cabinet chrome before it is measured: the marquee (min-h-12
// buttons, py-2 padding, borders) and the controller bar under the stage.
const DEFAULT_CHROME_PX = 136;
const DEFAULT_HEADER_PX = 80;

// Bottom edge of the site's fixed header, so the cabinet can sit just under
// it. The header's --header-height variable measures its content box, which
// leaves out the header's padding, so measure the element itself.
function measureHeaderOffset(): number {
  if (typeof document === "undefined") return DEFAULT_HEADER_PX;
  const header = document.querySelector<HTMLElement>("body header");
  const bottom = header?.getBoundingClientRect().bottom ?? 0;
  return bottom > 0 && bottom < 240 ? Math.ceil(bottom) : DEFAULT_HEADER_PX;
}

function getKeyboardBoundary(cabinet: HTMLElement): HTMLElement | null {
  return cabinet.querySelector<HTMLElement>('[data-keyboard-boundary="true"]');
}

// A game's own dialog (a fix dialog, a pause menu) gets the first Escape, so
// the press closes it rather than leaving fullscreen. The cabinet's own pause
// overlay is not a game dialog.
function findOpenGameDialog(cabinet: HTMLElement): Element | null {
  const dialogs = cabinet.querySelectorAll(
    '[role="dialog"], [role="alertdialog"], [aria-modal="true"]'
  );
  return (
    Array.from(dialogs).find(
      (dialog) => !dialog.hasAttribute("data-pause-overlay")
    ) ?? null
  );
}

// The sheet a phone Back closes: the top game dialog, but never the cabinet's
// own pause overlay, the rotate prompt, or a dialog that must be accepted
// rather than dismissed (data-escape-holds).
function findBackSheet(cabinet: HTMLElement): HTMLElement | null {
  const dialogs = Array.from(
    cabinet.querySelectorAll<HTMLElement>(
      '[role="dialog"], [role="alertdialog"], [aria-modal="true"]'
    )
  ).filter(
    (dialog) =>
      !dialog.closest("[data-pause-overlay], [data-rotate-prompt]") &&
      dialog.getAttribute("data-escape-holds") !== "true"
  );
  return dialogs[dialogs.length - 1] ?? null;
}

/**
 * Width in CSS px of the touch toolbar: `count` 48px buttons, 4px gaps, the
 * toolbar's 2px padding and 1px borders each side.
 */
function cabinetToolbarWidth(count: number): number {
  return count * 48 + Math.max(0, count - 1) * 4 + 6;
}

/**
 * The arcade cabinet. A game the registry gates on phones (`views.phone` is
 * "gated") gets the desktop-only notice around it there, so flipping the
 * flag gates or un-gates a game with no other change (#2368).
 */
export const PlayCabinet: React.FC<PlayCabinetProps> = (props) =>
  props.gameId && isPhoneGated(props.gameId) ? (
    <DesktopOnlyGate gameId={props.gameId}>
      <Cabinet {...props} />
    </DesktopOnlyGate>
  ) : (
    <Cabinet {...props} />
  );

const Cabinet: React.FC<PlayCabinetProps> = ({
  gameId: rawGameId,
  title,
  subtitle,
  icon,
  instructions,
  controls,
  importComponent,
  statusAnnouncement,
  controlDock,
  onLaunch,
  onExit,
  fullscreenKey = true,
  singleTitleScreen = true,
  mobileOrientation = "either",
  mobileLayout = "scroll",
  onAutoPause,
  views,
  setupItems,
  tutorial,
  launchControl: LaunchControl,
  children,
}) => {
  const gameId = rawGameId || title.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const [isLaunched, setIsLaunched] = useState(false);
  const [isPrefetched, setIsPrefetched] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [bootProgress, setBootProgress] = useState(0);
  // Any touch device, phone or tablet, gets the immersive cabinet once it is
  // launched (ADR 0061). Desktop never sets it, so its markup stays as it was.
  // The device class is latched at Launch and held until exit, so an iPad that
  // turns across a breakpoint mid-game stays immersive instead of jumping layouts.
  const isTouchDevice = useTouchDevice();
  const [launchedOnTouch, setLaunchedOnTouch] = useState(false);
  const touchImmersive = isLaunched && launchedOnTouch;
  // Orientation is a phone concern: a tablet is never asked to turn, and a
  // tablet that rotates does not pause (ADR 0061). One query decides the
  // rotate prompt, the screen lock and the rotation pause: a phone by its short
  // side, so a Split View pane of an iPad stays out of it.
  const phoneOrientation = useMediaQuery(PHONE_ORIENTATION_QUERY);
  const orientationMismatch = useOrientationMismatch(mobileOrientation);
  // The phone is held against the game's orientation: the cabinet is blocked
  // behind the rotate prompt (inert siblings, focus in the prompt).
  const rotateBlocked =
    touchImmersive && phoneOrientation && orientationMismatch;

  const [showWizard, setShowWizard] = useState(false);
  const tutorialRun = useTutorialRun(tutorial);
  const startTutorial = tutorialRun.start;
  const gameName =
    ARCADE_REGISTRY.find((game) => game.slug === gameId)?.name ?? title;
  // The Setup sheet (#2923): device settings, the game's own options and a
  // way into the wizard. The toolbar's Setup key opens it.
  const [showSetup, setShowSetup] = useState(false);
  const setupKeyRef = useRef<HTMLButtonElement>(null);
  const phoneScreen = usePhone();
  const cabinetRef = useRef<HTMLDivElement>(null);
  // The view a cabinet with views shows (ADR 0062). A dev-only picker in the
  // marquee can force one; `?view=` forces one in any build.
  const [devView, setDevView] = useState<FormFactor | "auto">("auto");
  const formFactor = useFormFactor({
    enabled: Boolean(views) && isLaunched,
    override: devView,
  });
  const targetView =
    views && isLaunched ? views.resolved[formFactor] : undefined;
  // A swap loads the new view first; if it fails, the old view stays.
  const { shown: activeView, failed: failedSwap } = useShownView(
    views,
    targetView
  );
  usePrefetchViews(views, targetView);

  // The one pause service (#2357): every reason the cabinet is paused, shared
  // with the game through CabinetPauseProvider.
  const [pauseController] = useState(() =>
    createPauseController({ gameId, view: "desktop" })
  );
  const pauseState = useSyncExternalStore(
    pauseController.subscribe,
    pauseController.getState,
    pauseController.getState
  );
  const pauseMenuItems = useSyncExternalStore(
    pauseController.subscribe,
    pauseController.getMenuItems,
    pauseController.getMenuItems
  );
  useEffect(() => {
    pauseController.setInfo({ gameId, view: activeView ?? "desktop" });
  }, [pauseController, gameId, activeView]);

  const lastTargetRef = useRef<FormFactor | undefined>(undefined);
  useEffect(() => {
    // A live swap pauses the run first; the new view resumes into the pause.
    const previous = lastTargetRef.current;
    lastTargetRef.current = targetView;
    if (previous && targetView && previous !== targetView) {
      pauseController.pause("view-swap");
      onAutoPause?.();
    }
  }, [targetView, onAutoPause, pauseController]);
  const [setupConfig, setSetupConfig] = useState<GameSetupConfig>(() =>
    getSavedSetupConfig(gameId)
  );

  const [runRevision, setRunRevision] = useState(0);
  const setupValue = useMemo(
    () => ({
      config: setupConfig,
      runRevision,
      isSetupOpen: showWizard || showSetup,
      skipTitleScreen: singleTitleScreen,
    }),
    [setupConfig, runRevision, showWizard, showSetup, singleTitleScreen]
  );

  // The one CRT layer (#1516): the Setup Wizard's crtFilter mapped onto
  // lib/arcade/crt-pipeline.ts, drawn by the cabinet as a static overlay
  // unless the game draws its own CRT pass.
  const crtBackground = useMemo(
    () =>
      buildCrtOverlayBackground(crtCalibrationForFilter(setupConfig.crtFilter)),
    [setupConfig.crtFilter]
  );
  const showCabinetCrt =
    crtBackground !== "" && shouldCabinetDrawCrt(gameId, setupConfig.crtFilter);

  // One-screen rule: measure the marquee so the stage budget the games size
  // against (--layout-viewport-budget) is what is left of the viewport under
  // the site header and the marquee.
  const marqueeRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  // Marquee above the stage plus the controller bar below it (and its gap).
  const [chromeHeight, setChromeHeight] = useState(DEFAULT_CHROME_PX);
  const [headerOffset, setHeaderOffset] = useState(DEFAULT_HEADER_PX);

  const {
    isFullscreen,
    isPseudoFullscreen,
    isSupported: fullscreenSupported,
    toggleFullscreen: toggleCabinetFullscreen,
    exitFullscreen,
  } = useFullscreen(cabinetRef, { enableKeyShortcut: false });
  // Real Fullscreen, pseudo-fullscreen (iOS) or the immersive touch cabinet:
  // all of them lay the cabinet out as the fullscreen layout does.
  const immersive = isFullscreen || touchImmersive;
  // The touch toolbar's buttons: Fullscreen only where the API exists (iOS has
  // none), plus Setup and Power.
  const toolbarButtonCount =
    (fullscreenSupported ? 1 : 0) + (tutorialRun.available ? 1 : 0) + 2;
  // iPhone has no element fullscreen, so its phone view shows no Fullscreen
  // control at all; the installed app already runs standalone (ADR 0062). A
  // narrow desktop window in the phone view keeps it.
  const showFullscreenControl = fullscreenSupported || activeView !== "phone";
  const { setSafeTimeout } = useSafeTimeout();
  // Entering fullscreen swaps the header, so focus would otherwise land on the
  // first toolbar button ("Exit Fullscreen"), where the game's Space key
  // presses it. Start the trap on the game's keyboard boundary instead.
  // Escape is handled by the cabinet's capture handler below, which defers
  // to any dialog the game has open.
  const boundaryFocusRef = useRef<HTMLElement | null>(null);
  // The touch cabinet traps focus too: without a real Fullscreen, Tab would
  // otherwise walk out onto the page's links behind it. A phone held against
  // its orientation is inert behind the rotate prompt, which owns focus, so
  // the trap waits for the prompt to go (#2039 playtest).
  const fullscreenFocusRef = useFocusTrap(
    (isFullscreen || touchImmersive) &&
      !showWizard &&
      !showSetup &&
      !rotateBlocked,
    {
      initialFocusRef: boundaryFocusRef,
      returnFocus: false,
    }
  );

  // Point the trap at the game on entry, and hand focus back to the game on
  // exit: the button that was focused before entering has since unmounted.
  const wasFullscreenRef = useRef(false);
  useEffect(() => {
    const cabinet = cabinetRef.current;
    const wasFullscreen = wasFullscreenRef.current;
    wasFullscreenRef.current = isFullscreen;
    if (!cabinet) return;
    const boundary = getKeyboardBoundary(cabinet);
    boundaryFocusRef.current = boundary;
    if (wasFullscreen && !isFullscreen) {
      (boundary ?? cabinet).focus({ preventScroll: true });
    }
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  // No pull-to-refresh while a touch cabinet is open (#2545): the document
  // keeps no overscroll in real fullscreen too, where the pin below is off.
  useEffect(() => {
    if (!touchImmersive || !isFullscreen) return;
    const root = document.documentElement;
    const previousOverscroll = root.style.overscrollBehavior;
    root.style.overscrollBehavior = "none";
    return () => {
      root.style.overscrollBehavior = previousOverscroll;
    };
  }, [touchImmersive, isFullscreen]);

  // The immersive touch cabinet locks page scroll while it is open and gives
  // the back of the page no overscroll bounce. Both are restored on exit.
  // The pin's restore frame, and whether the cabinet is unmounting (navigation
  // or the page leaving), when the scroll must be left alone.
  const restoreFrameRef = useRef<number | null>(null);
  const unmountingRef = useRef(false);
  useLayoutEffect(
    () => () => {
      // Declared before the pin effect, so this runs first on unmount.
      unmountingRef.current = true;
      if (restoreFrameRef.current !== null) {
        window.cancelAnimationFrame(restoreFrameRef.current);
        restoreFrameRef.current = null;
      }
    },
    []
  );
  useLayoutEffect(() => {
    if (!touchImmersive || isFullscreen) return;
    const body = document.body;
    // Scroll anchoring is switched off at launch (see handleLaunch), so the
    // offset read here is the one the player left.
    const previousOverflow = body.style.overflow;
    const previousOverscroll =
      document.documentElement.style.overscrollBehavior;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousWidth = body.style.width;
    // Pin the page where it is. Overflow hidden alone does not stop iOS from
    // scrolling or from restoring a scroll offset when focus moves, so the
    // body goes fixed at its current offset and comes back to it on exit.
    const offset = window.scrollY;
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${offset}px`;
    body.style.width = "100%";
    document.documentElement.style.overscrollBehavior = "none";
    return () => {
      body.style.overflow = previousOverflow;
      body.style.position = previousPosition;
      body.style.top = previousTop;
      body.style.width = previousWidth;
      document.documentElement.style.overscrollBehavior = previousOverscroll;
      if (restoreFrameRef.current !== null) {
        window.cancelAnimationFrame(restoreFrameRef.current);
        restoreFrameRef.current = null;
      }
      // Navigating away or unmounting leaves the page's own scroll alone.
      if (unmountingRef.current) return;
      // The preview lays out again after this commit, and a scroll made before
      // that can clamp to a shorter page. Restore now and again after a frame.
      const restore = () => window.scrollTo(0, offset);
      restore();
      restoreFrameRef.current = window.requestAnimationFrame(() => {
        restoreFrameRef.current = null;
        restore();
      });
    };
  }, [touchImmersive, isFullscreen]);

  // A game that wants a fixed orientation holds it while in real fullscreen.
  // The browser refuses outside fullscreen, and the lock is best effort.
  // Only the touch cabinet asks for a lock; desktop fullscreen never does.
  useEffect(() => {
    if (
      !touchImmersive ||
      !phoneOrientation ||
      !isFullscreen ||
      isPseudoFullscreen ||
      mobileOrientation === "either"
    ) {
      return;
    }
    return lockScreenOrientation(mobileOrientation);
  }, [
    touchImmersive,
    phoneOrientation,
    isFullscreen,
    isPseudoFullscreen,
    mobileOrientation,
  ]);

  // Leaving the immersive cabinet restores the page offset the body pin
  // recorded on entry (see the pin effect above), so the preview is exactly
  // where the player left it. No scrollIntoView: that moved the page on exit.
  //
  // The pause service hears the page hide on every touch cabinet and on any
  // launched cabinet with views; the window losing focus and a phone turning
  // pause only the touch cabinet, as before. A desktop cabinet without views
  // adds no listeners. The legacy onAutoPause still fires on touch only.
  const hostsViews = Boolean(views) && isLaunched;
  const handleAutoPause = useCallback(
    (reason: PauseReason) => {
      pauseController.pause(reason);
      if (touchImmersive) onAutoPause?.();
    },
    [pauseController, touchImmersive, onAutoPause]
  );
  useCabinetAutoPause(
    touchImmersive || hostsViews ? handleAutoPause : undefined,
    {
      pauseOnRotate: touchImmersive && phoneOrientation,
      pauseOnBlur: touchImmersive,
      onSuspend: pauseController.suspend,
    }
  );

  // Setup is a pause of its own, cleared when Setup closes.
  const setupOpen = showWizard || showSetup;
  useEffect(() => {
    if (setupOpen) pauseController.pause("setup");
    else pauseController.resume("setup");
  }, [setupOpen, pauseController]);

  // The screen stays awake while a real-time run plays, and sleeps on pause.
  useScreenWakeLock(isLaunched && pauseState.running && !pauseState.paused);

  // The shared pause overlay belongs to cabinets with views; a game on the
  // old path keeps its own pause menu.
  const overlayOpen =
    hostsViews && !setupOpen && showsPauseOverlay(pauseState.reasons);
  const [exitOffered, setExitOffered] = useState(false);
  if (exitOffered && !overlayOpen) setExitOffered(false);

  // Phone Back and browser Back (#2545): one history entry per launch, and
  // popstate walks the Escape ladder. backRef holds this render's ladder,
  // set below once handleBack exists.
  const backRef = useRef<() => BackOutcome>(() => "exit");
  const [cabinetHistory] = useState(() =>
    createCabinetHistory({ slug: gameId })
  );
  useEffect(() => {
    // A reload while launched leaves the old launch's entry; strip it so the
    // next Back leaves the page as it would have before Launch.
    cabinetHistory.discardStale();
    const handlePopState = () =>
      cabinetHistory.handlePopState(() => backRef.current());
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      // Unmounting (a link followed, say) leaves history alone.
      cabinetHistory.abandon();
    };
  }, [cabinetHistory]);
  // A cabinet without views has no pause overlay to read, so a first Back
  // arms the cabinet and says that the next Back exits. Touching or typing in
  // the game disarms it, as does the game resuming through the service.
  const [backArmed, setBackArmed] = useState(false);
  // True while the cabinet dispatches the Escape that closes a sheet on Back,
  // so its own key rules and the disarm listener leave that press alone.
  const syntheticEscapeRef = useRef(false);
  const launchButtonRef = useRef<HTMLButtonElement>(null);
  const launchControlRef = useRef<HTMLDivElement>(null);
  const focusTriggerOnExitRef = useRef(false);
  const resumeFromOverlay = () => {
    setExitOffered(false);
    pauseController.resume();
  };

  useLayoutEffect(() => {
    const marquee = marqueeRef.current;
    if (!isLaunched || !marquee) return;
    const footer = footerRef.current;
    const measure = () => {
      const top = marquee.getBoundingClientRect().height;
      // The footer bar sits under a 12px (mt-3) gap.
      const bottom = footer ? footer.getBoundingClientRect().height + 12 : 0;
      const next = Math.ceil(top + bottom);
      if (next > 0) setChromeHeight(next);
      setHeaderOffset(measureHeaderOffset());
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(marquee);
    if (footer) observer.observe(footer);
    return () => observer.disconnect();
  }, [isLaunched, immersive]);

  const handlePrefetch = () => {
    if (!isPrefetched) {
      setIsPrefetched(true);
      importComponent()
        .then(() => {
          setIsLoaded(true);
        })
        .catch((err) => {
          logger.error("Prefetch failed:", err);
          setIsPrefetched(false);
        });
    }
  };

  // Scroll anchoring moves the page when the preview becomes the warming-up
  // cabinet, which is before the body pin can record an offset. A touch launch
  // turns it off until the cabinet closes (see the effect below).
  const anchorBeforeLaunchRef = useRef<string | null>(null);
  const restoreAnchor = useCallback(() => {
    const saved = anchorBeforeLaunchRef.current;
    if (saved === null) return;
    anchorBeforeLaunchRef.current = null;
    document.documentElement.style.overflowAnchor = saved;
  }, []);
  useEffect(() => {
    if (!isLaunched) restoreAnchor();
  }, [isLaunched, restoreAnchor]);
  // A cabinet that unmounts while launched, even mid-warmup, gives the page
  // its scroll anchoring back.
  useEffect(() => restoreAnchor, [restoreAnchor]);

  const handleLaunch = () => {
    if (isTouchDevice && anchorBeforeLaunchRef.current === null) {
      anchorBeforeLaunchRef.current =
        document.documentElement.style.overflowAnchor;
      document.documentElement.style.overflowAnchor = "none";
    }
    setLaunchedOnTouch(isTouchDevice);
    setBackArmed(false);
    cabinetHistory.push();
    handlePrefetch();
    setIsWarmingUp(true);
    setBootProgress(0);
    onLaunch?.();
  };

  // CRT warmup: advance the boot bar every 60ms while warming up.
  useInterval(
    () => {
      setBootProgress((prev) => {
        if (isLoaded) {
          const next = prev + Math.floor(Math.random() * 30) + 25;
          if (next >= 100) {
            setIsLaunched(true);
            setShowWizard(false); // Quick-play instant start per ADR 0031
            setIsWarmingUp(false);
            return 100;
          }
          return next;
        } else {
          if (prev >= 85) {
            return 85;
          }
          return prev + Math.floor(Math.random() * 10) + 10;
        }
      });
    },
    isWarmingUp ? 60 : null
  );

  // On launch, bring the cabinet into view and hand keyboard focus to the
  // game's own key-handling container, so the first key press reaches it.
  useEffect(() => {
    if (!isLaunched) return;
    const cabinet = cabinetRef.current;
    if (!cabinet) return;
    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // One-screen rule: put the marquee just under the site header, so the
    // stage gets the rest of the viewport.
    // The site header compacts once the page scrolls, so after the scroll
    // settles, measure again and nudge the cabinet up to the compact header.
    const alignUnderHeader = (
      behavior: ScrollBehavior,
      maxNudge = Infinity
    ) => {
      const headerOffset = measureHeaderOffset();
      setHeaderOffset(headerOffset);
      const delta = cabinet.getBoundingClientRect().top - headerOffset - 4;
      // A larger gap after the first scroll means the player has scrolled
      // on; leave them there.
      if (Math.abs(delta) < 2 || Math.abs(delta) > maxNudge) return;
      if (typeof window.scrollTo !== "function") return;
      try {
        window.scrollTo({ top: Math.max(0, window.scrollY + delta), behavior });
      } catch {
        cabinet.scrollIntoView?.({ block: "start" });
      }
    };
    // The immersive cabinet is fixed to the viewport; there is nothing to align.
    if (!touchImmersive)
      alignUnderHeader(prefersReducedMotion ? "auto" : "smooth");
    const settleTimer = setTimeout(() => {
      if (!touchImmersive) alignUnderHeader("auto", 48);
    }, 700);
    // Focus the cabinet so keys reach the game, then, since the game can
    // render a loading shell first, retry briefly until its keyboard boundary
    // exists. Stop as soon as the game has moved focus somewhere itself, such
    // as a dialog's primary button.
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const active = document.activeElement;
      const gameOwnsFocus =
        !!active && active !== cabinet && cabinet.contains(active);
      if (gameOwnsFocus && attempts > 1) {
        clearInterval(timer);
        return;
      }
      // The rotate prompt owns focus while it is up.
      if (cabinet.querySelector("[data-rotate-prompt]")) {
        clearInterval(timer);
        return;
      }
      const boundary = getKeyboardBoundary(cabinet);
      if (boundary) {
        clearInterval(timer);
        boundary.focus({ preventScroll: true });
      } else if (attempts === 1) {
        cabinet.focus({ preventScroll: true });
      }
      if (attempts >= 20) clearInterval(timer);
    }, 50);
    return () => {
      clearInterval(timer);
      clearTimeout(settleTimer);
    };
  }, [isLaunched, touchImmersive]);

  // Start buttons and game-over overlays unmount while focused, which drops
  // focus to <body> where the game no longer hears its keys. While the player
  // is inside the cabinet, return focus to the game when that happens.
  useEffect(() => {
    if (!isLaunched) return;
    const cabinet = cabinetRef.current;
    if (!cabinet || typeof MutationObserver === "undefined") return;
    let ownsFocus = cabinet.contains(document.activeElement);
    const handleFocusIn = (event: FocusEvent) => {
      ownsFocus = cabinet.contains(event.target as Node);
    };
    const handlePointerDown = (event: PointerEvent) => {
      ownsFocus = cabinet.contains(event.target as Node);
    };
    // Only games that mark a keyboard boundary opt in; others, such as
    // Trial & Error, manage focus themselves.
    //
    // The check waits a task: a game that re-renders on blur mutates the DOM
    // while Tab is still moving focus, when activeElement is momentarily
    // <body>. Checking then pulled focus back and trapped Tab (#1945).
    let pending: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (pending !== null) return;
      pending = setTimeout(() => {
        pending = null;
        const active = document.activeElement;
        if (!ownsFocus || (active && active !== document.body)) return;
        // A modal dialog the game opened owns focus until it moves it (the
        // game's own focus effects), so the boundary does not take it here.
        if (cabinet.querySelector('[aria-modal="true"]')) return;
        getKeyboardBoundary(cabinet)?.focus({ preventScroll: true });
      }, 0);
    });
    observer.observe(cabinet, { childList: true, subtree: true });
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      if (pending !== null) clearTimeout(pending);
      observer.disconnect();
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [isLaunched]);

  const handleExit = () => {
    // Exiting by the cabinet's own controls pops the launch's history entry;
    // after a Back it is already gone.
    cabinetHistory.release();
    setBackArmed(false);
    focusTriggerOnExitRef.current = true;
    // The next launch starts unpaused.
    setExitOffered(false);
    pauseController.resume();
    pauseController.resume("sheet");
    pauseController.resume("setup");
    setIsLaunched(false);
    setLaunchedOnTouch(false);
    setIsWarmingUp(false);
    void exitFullscreen();
    setBootProgress(0);
    onExit?.();
  };

  // Closes a sheet the way its own Escape does: the press goes to the sheet
  // (or the control focused in it), and the cabinet's key rules ignore it.
  const closeSheet = (sheet: HTMLElement) => {
    const active = document.activeElement;
    const target =
      active instanceof HTMLElement && sheet.contains(active) ? active : sheet;
    syntheticEscapeRef.current = true;
    try {
      target.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          bubbles: true,
          cancelable: true,
        })
      );
    } finally {
      syntheticEscapeRef.current = false;
    }
  };

  // One Back: the Escape ladder with exit in place of "offer exit".
  const handleBack = (): BackOutcome => {
    const cabinet = cabinetRef.current;
    // Back while the CRT warms up, or on the rotate prompt, leaves.
    if (!isLaunched || !cabinet || rotateBlocked) {
      handleExit();
      return "exit";
    }
    if (showWizard) {
      setShowWizard(false);
      return "stay";
    }
    if (showSetup) {
      setShowSetup(false);
      return "stay";
    }
    const sheet = findBackSheet(cabinet);
    if (hostsViews) {
      const action = resolveBack({ sheetOpen: sheet !== null, overlayOpen });
      if (action === "close-sheet" && sheet) {
        closeSheet(sheet);
        return "stay";
      }
      if (action === "pause") {
        pauseController.pause("user");
        return "stay";
      }
      handleExit();
      return "exit";
    }
    // Without views: armed exits first, so a game whose pause menu is itself
    // a dialog never loops between pausing and closing that menu.
    if (backArmed) {
      handleExit();
      return "exit";
    }
    if (sheet) {
      closeSheet(sheet);
      return "stay";
    }
    pauseController.pause("user");
    onAutoPause?.();
    setBackArmed(true);
    return "stay";
  };
  useEffect(() => {
    backRef.current = handleBack;
  });

  useEffect(() => {
    if (!backArmed) return;
    const cabinet = cabinetRef.current;
    if (!cabinet) return;
    const disarm = () => {
      if (!syntheticEscapeRef.current) setBackArmed(false);
    };
    cabinet.addEventListener("pointerdown", disarm, true);
    cabinet.addEventListener("keydown", disarm, true);
    const stopResume = pauseController.onResume(() => setBackArmed(false));
    return () => {
      cabinet.removeEventListener("pointerdown", disarm, true);
      cabinet.removeEventListener("keydown", disarm, true);
      stopResume();
    };
  }, [backArmed, pauseController]);

  // Focus goes back to Launch when the cabinet closes (AGENTS.md section 10).
  useEffect(() => {
    if (isLaunched || isWarmingUp || !focusTriggerOnExitRef.current) return;
    focusTriggerOnExitRef.current = false;
    const target =
      launchButtonRef.current ??
      launchControlRef.current?.querySelector<HTMLElement>("button");
    target?.focus({ preventScroll: true });
  }, [isLaunched, isWarmingUp]);

  if (isLaunched) {
    const bezelClasses =
      {
        // The classic bezel takes the game's own accent (--game-accent).
        classic: "arcade-bezel-accent",
        neon: "border-cyan-500/80 shadow-[0_0_30px_rgba(6,182,212,0.25)]",
        woodgrain: "border-yellow-600/80 shadow-[0_0_30px_rgba(234,179,8,0.2)]",
        minimal: "border-zinc-800/80 shadow-[0_0_30px_rgba(0,0,0,0.5)]",
      }[setupConfig.bezelStyle] || "border-zinc-800";

    return (
      <div
        ref={(element) => {
          cabinetRef.current = element;
          fullscreenFocusRef.current = element;
        }}
        onKeyDownCapture={(event) => {
          const target = event.target as HTMLElement;
          if (
            // A key from a game overlay portaled outside the cabinet (the
            // Field Manual) still bubbles through it in React. It belongs
            // to that overlay, so its Escape closes the overlay, not the game.
            !event.currentTarget.contains(target) ||
            syntheticEscapeRef.current ||
            setupOpen ||
            event.repeat ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            target.closest("input, textarea, select, [contenteditable=true]")
          )
            return;
          // A cabinet with views has one key rule (#2357): P toggles pause,
          // and Escape closes the top sheet, then pauses, then offers exit.
          // Cabinets without views keep the data-escape-* rules below until
          // every game has moved to the pause service.
          if (
            hostsViews &&
            (event.key === "Escape" || event.key.toLowerCase() === "p")
          ) {
            const sheetOpen = findOpenGameDialog(event.currentTarget) !== null;
            if (event.key === "Escape") {
              const action = resolveEscape({
                sheetOpen,
                overlayOpen,
                exitOffered,
              });
              // The sheet's own Escape closes it.
              if (action === "close-sheet") return;
              event.preventDefault();
              event.stopPropagation();
              if (action === "pause") pauseController.pause("user");
              else if (action === "offer-exit") setExitOffered(true);
              return;
            }
            if (sheetOpen) return;
            event.preventDefault();
            event.stopPropagation();
            if (overlayOpen) resumeFromOverlay();
            else pauseController.pause("user");
            return;
          }
          // Escape leaves the cabinet: real Fullscreen exits, and the touch
          // cabinet (no Fullscreen) closes the game the way its Exit does.
          const escapeLeaves = isFullscreen || touchImmersive;
          const leaveCabinet = () => {
            if (isFullscreen) void exitFullscreen();
            else handleExit();
          };
          if (event.key === "Escape" && escapeLeaves) {
            // A game that docks a panel on Escape (Protocol Drift's expanded
            // inspector, #2045) gets the press from its own keys. Only the
            // touch cabinet asks for this; desktop is unchanged.
            const keyboardBoundary = getKeyboardBoundary(event.currentTarget);
            if (
              touchImmersive &&
              keyboardBoundary?.getAttribute("data-escape-docks") === "true" &&
              keyboardBoundary.contains(target)
            ) {
              return;
            }
            const dialog = findOpenGameDialog(event.currentTarget);
            // A dialog that must be accepted, not dismissed, holds the press:
            // Escape neither closes it nor leaves the touch cabinet.
            if (
              dialog &&
              touchImmersive &&
              dialog.getAttribute("data-escape-holds") === "true"
            ) {
              return;
            }
            if (dialog) {
              // Let the game handle this press. If its dialog is still open
              // afterwards, the game doesn't close it on Escape (a results
              // screen, say), so fall back to leaving the cabinet.
              setSafeTimeout(() => {
                if (dialog.isConnected) leaveCabinet();
              }, 0);
              return;
            }
          }
          if (
            (fullscreenKey &&
              showFullscreenControl &&
              event.key.toLowerCase() === "f") ||
            (event.key === "Escape" && escapeLeaves)
          ) {
            event.preventDefault();
            event.stopPropagation();
            if (event.key === "Escape") leaveCabinet();
            else void toggleCabinetFullscreen();
          }
        }}
        tabIndex={-1}
        data-arcade-cabinet={gameId}
        data-game={gameId}
        data-fullscreen={immersive}
        {...(activeView
          ? { "data-view": activeView, "data-paused": pauseState.paused }
          : {})}
        {...(touchImmersive
          ? {
              "data-immersive": true,
              "data-mobile-layout": mobileLayout,
            }
          : {})}
        className={`arcade-cabinet w-full flex flex-col items-center max-w-full min-w-0 @container ${
          immersive
            ? "fixed inset-0 z-50 h-dvh max-w-none bg-black overflow-hidden select-none"
            : "relative scroll-mt-nav-24"
        }`}
        style={
          {
            "--layout-dock-height": controlDock ? "120px" : "0px",
            // The touch toolbar floats top-right over the game. A game HUD
            // pads its right side by this, so its top row never runs under
            // the buttons. Width: the buttons, their gaps and padding, plus
            // the toolbar's 8px inset from the edge.
            ...(touchImmersive
              ? {
                  "--cabinet-toolbar-inset": `calc(${cabinetToolbarWidth(toolbarButtonCount) + 8}px + env(safe-area-inset-right, 0px))`,
                }
              : {}),
            // Windowed, the cabinet scrolls to sit under the site header on
            // Launch, so the stage gets the viewport minus header, marquee
            // and dock. Games already size their playfield against
            // --layout-viewport-budget; overriding it here makes them fit.
            ...(immersive
              ? {}
              : {
                  "--arcade-stage-budget": `calc(100dvh - ${headerOffset + 4}px - ${chromeHeight}px - var(--layout-dock-height, 0px) - 4px)`,
                  "--layout-viewport-budget": "var(--arcade-stage-budget)",
                }),
          } as React.CSSProperties
        }
      >
        {touchImmersive && <InputModalityAttribute targetRef={cabinetRef} />}

        {/* Accessible screen reader live status mirror */}
        <div
          role="region"
          aria-label="Game Telemetry & Status Announcements"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {statusAnnouncement || `${title} cabinet active.`}
        </div>

        {/* Fullscreen Mode: Floating Glassmorphic Pill Header */}
        {touchImmersive ? (
          <div
            inert={rotateBlocked}
            data-testid="cabinet-touch-toolbar"
            data-touch-toolbar=""
            // A tap must not leave focus on a toolbar key: Space on a keyboard
            // case would then toggle Fullscreen instead of reaching the game.
            onMouseDown={(event) => {
              if ((event.target as HTMLElement).closest("button")) {
                event.preventDefault();
              }
            }}
            className="arcade-cabinet-toolbar absolute z-50 flex items-center gap-1 p-0.5 bg-black/90 rounded-2xl border border-zinc-700/80 shadow-2xl select-none"
            style={{
              top: "calc(env(safe-area-inset-top, 0px) + 4px)",
              right: "calc(env(safe-area-inset-right, 0px) + 8px)",
            }}
          >
            {fullscreenSupported && (
              <FullscreenButton
                isFullscreen={isFullscreen}
                isPseudoFullscreen={isPseudoFullscreen}
                onToggle={toggleCabinetFullscreen}
                variant="icon"
              />
            )}
            {tutorialRun.available && (
              <button
                type="button"
                onClick={startTutorial}
                aria-label="Tutorial"
                title="Tutorial"
                className="h-12 w-12 inline-flex items-center justify-center rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-amber-400 border border-amber-500/30 transition-all cursor-pointer touch-manipulation select-none active:scale-95 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
              >
                <IconSchool className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
            <button
              ref={setupKeyRef}
              type="button"
              onClick={() => setShowSetup(true)}
              aria-label="Setup"
              title="Setup"
              aria-haspopup="dialog"
              className="h-12 w-12 inline-flex items-center justify-center rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-amber-400 border border-amber-500/30 transition-all cursor-pointer touch-manipulation select-none active:scale-95 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
            >
              <IconAdjustments className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleExit}
              aria-label="Reset / Power Off Cabinet"
              title="Reset / Power Off Cabinet"
              className="h-12 w-12 inline-flex items-center justify-center rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-zinc-400 border border-neutral-800 transition-all cursor-pointer touch-manipulation select-none active:scale-95 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none"
            >
              <IconPower className="w-4 h-4 text-red-500" aria-hidden="true" />
            </button>
          </div>
        ) : immersive ? (
          <div
            inert={rotateBlocked}
            className="arcade-cabinet-toolbar self-end shrink-0 z-50 flex items-center gap-1.5 p-1 bg-black/85 backdrop-blur-md rounded-2xl border border-zinc-700/80 shadow-2xl select-none"
          >
            {showFullscreenControl && (
              <FullscreenButton
                isFullscreen={isFullscreen}
                isPseudoFullscreen={isPseudoFullscreen}
                onToggle={toggleCabinetFullscreen}
                variant="header"
              />
            )}
            {tutorialRun.available && (
              <button
                type="button"
                onClick={startTutorial}
                aria-label="Tutorial"
                className="min-h-12 min-w-12 px-2.5 py-1.5 bg-neutral-900/90 hover:bg-neutral-800 text-amber-400 rounded-xl border border-amber-500/30 transition-all font-mono font-bold text-xs flex items-center justify-center gap-1 cursor-pointer touch-manipulation select-none active:scale-95 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
                title="Tutorial"
              >
                <IconSchool className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Tutorial</span>
              </button>
            )}
            <button
              ref={setupKeyRef}
              type="button"
              onClick={() => setShowSetup(true)}
              aria-label="Setup"
              aria-haspopup="dialog"
              className="min-h-12 min-w-12 px-2.5 py-1.5 bg-neutral-900/90 hover:bg-neutral-800 text-amber-400 rounded-xl border border-amber-500/30 transition-all font-mono font-bold text-xs flex items-center justify-center gap-1 cursor-pointer touch-manipulation select-none active:scale-95 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
              title="Setup"
            >
              <IconAdjustments className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Setup</span>
            </button>
            <button
              type="button"
              onClick={handleExit}
              className="min-h-12 min-w-12 px-2.5 py-1.5 bg-neutral-900/90 hover:bg-neutral-800 text-zinc-400 hover:text-red-400 rounded-xl border border-neutral-800 transition-all font-mono font-bold text-xs flex items-center justify-center gap-1 cursor-pointer touch-manipulation select-none active:scale-95 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none"
              title="Reset / Power Off Cabinet"
            >
              <IconPower className="w-3.5 h-3.5 text-red-500" />
              <span className="hidden sm:inline">Power</span>
            </button>
          </div>
        ) : (
          /* Windowed Mode: Cabinet Marquee / Top Frame Bezel Header Bar */
          <div
            ref={marqueeRef}
            className="w-full flex flex-wrap items-center justify-between px-3.5 py-2 bg-zinc-950/95 border border-zinc-800 rounded-t-2xl font-mono text-xs text-zinc-400 select-none backdrop-blur-md gap-2 shrink-0 z-20"
          >
            <div className="flex grow basis-12 items-center gap-2 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="font-bold tracking-wider text-zinc-200 text-xs uppercase truncate">
                {title}
              </span>
            </div>

            <div
              data-testid="cabinet-header-controls"
              className="flex flex-wrap items-center justify-end gap-1.5 shrink-0 min-w-0 max-w-full ml-auto"
            >
              {views && !isProductionBuild() && (
                <label className="flex min-h-12 items-center gap-1.5 text-xs text-zinc-300">
                  <span>View</span>
                  <select
                    value={devView}
                    onChange={(event) =>
                      setDevView(event.target.value as FormFactor | "auto")
                    }
                    className="min-h-12 rounded-xl border border-zinc-700 bg-neutral-900 px-2 font-mono text-xs text-zinc-200 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
                  >
                    <option value="auto">Auto</option>
                    {FORM_FACTORS.map((factor) => (
                      <option key={factor} value={factor}>
                        {factor}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {showFullscreenControl && (
                <FullscreenButton
                  isFullscreen={isFullscreen}
                  isPseudoFullscreen={isPseudoFullscreen}
                  onToggle={toggleCabinetFullscreen}
                  variant="header"
                />
              )}

              {tutorialRun.available && (
                <button
                  type="button"
                  onClick={startTutorial}
                  aria-label="Tutorial"
                  data-testid="cabinet-tutorial-key"
                  className="min-h-12 min-w-12 px-2.5 py-1.5 bg-neutral-900/90 hover:bg-neutral-800 text-amber-400 rounded-xl border border-amber-500/30 transition-all font-mono font-bold text-xs flex items-center justify-center gap-1 cursor-pointer touch-manipulation select-none active:scale-95 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
                  title="Tutorial"
                >
                  <IconSchool className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Tutorial</span>
                </button>
              )}

              <button
                ref={setupKeyRef}
                type="button"
                onClick={() => setShowSetup(true)}
                aria-label="Setup"
                aria-haspopup="dialog"
                className="min-h-12 min-w-12 px-2.5 py-1.5 bg-neutral-900/90 hover:bg-neutral-800 text-amber-400 rounded-xl border border-amber-500/30 transition-all font-mono font-bold text-xs flex items-center justify-center gap-1 cursor-pointer touch-manipulation select-none active:scale-95 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
                title="Setup"
              >
                <IconAdjustments className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Setup</span>
              </button>

              <button
                type="button"
                onClick={handleExit}
                className="min-h-12 min-w-12 px-2.5 py-1.5 bg-neutral-900/90 hover:bg-neutral-800 text-zinc-400 hover:text-red-400 rounded-xl border border-neutral-800 transition-all font-mono font-bold text-xs flex items-center justify-center gap-1 cursor-pointer touch-manipulation select-none active:scale-95 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none"
                title="Reset / Power Off Cabinet"
              >
                <IconPower className="w-3.5 h-3.5 text-red-500" />
                <span className="hidden sm:inline">Power</span>
              </button>
            </div>
          </div>
        )}

        {/* Game Area Container with Dynamic Viewport Height Budgeting */}
        <div
          className={`relative w-full min-w-0 flex flex-col ${
            immersive ? "flex-1 min-h-0" : ""
          }`}
        >
          <div
            inert={rotateBlocked}
            className={`arcade-cabinet-stage w-full relative min-h-0 min-w-0 ${
              immersive
                ? "flex-1 rounded-2xl border-2"
                : "border-2 border-t-0 rounded-b-2xl"
            } ${
              touchImmersive && mobileLayout === "fit"
                ? "overflow-hidden"
                : "overflow-y-auto overflow-x-hidden"
            } flex flex-col items-center justify-start bg-black ${bezelClasses}`}
          >
            <CabinetTouchContext.Provider value={touchImmersive}>
              <CabinetFullscreenContext.Provider
                value={toggleCabinetFullscreen}
              >
                <CabinetSetupContext.Provider value={setupValue}>
                  <CabinetPauseProvider controller={pauseController}>
                    <CabinetTutorialContext.Provider value={tutorialRun.value}>
                      {views && activeView ? (
                        <GameViewHost
                          views={views}
                          view={activeView}
                          failedSwap={failedSwap}
                        />
                      ) : (
                        children
                      )}
                    </CabinetTutorialContext.Provider>
                  </CabinetPauseProvider>
                </CabinetSetupContext.Provider>
              </CabinetFullscreenContext.Provider>
            </CabinetTouchContext.Provider>

            {hostsViews && (
              <PauseOverlay
                open={overlayOpen}
                reasons={pauseState.reasons}
                layout={activeView === "phone" ? "sheet" : "card"}
                onResume={resumeFromOverlay}
                onRestart={() => {
                  // A new run, as after Setup: the game restarts on it.
                  setRunRevision((revision) => revision + 1);
                  resumeFromOverlay();
                }}
                onSettings={() => setShowSetup(true)}
                onExit={handleExit}
                howToPlay={
                  <>
                    <p>{instructions}</p>
                    <ul className="mt-2 space-y-1">
                      {controls.map((control) => (
                        <li key={`${control.key}-${control.action}`}>
                          <span className="text-zinc-100">{control.key}</span>
                          {": "}
                          {control.action}
                        </li>
                      ))}
                    </ul>
                  </>
                }
                items={pauseMenuItems}
                exitOffered={exitOffered}
                returnFocusTo={cabinetRef}
              />
            )}

            {/* The game's guided tutorial (#2972): the offer, the coach card
              and the closing card, over the stage. */}
            {tutorialRun.available && isLaunched && (
              <TutorialOverlay
                run={tutorialRun}
                gameName={gameName}
                launched={isLaunched}
                touch={touchImmersive}
                covered={setupOpen || overlayOpen || rotateBlocked}
              />
            )}

            {/* 3-Step Setup Wizard Overlay prior to active gameplay / when reconfiguring */}
            <PreGameSetupWizard
              gameId={gameId}
              gameTitle={title}
              isOpen={showWizard}
              onComplete={(cfg) => {
                setSetupConfig(cfg);
                setRunRevision((revision) => revision + 1);
                setShowWizard(false);
              }}
              onCancel={() => setShowWizard(false)}
            />

            {/* The Setup sheet (#2923). The bottom sheet pauses through the
              cabinet's pause service, so it sits inside the provider. */}
            <CabinetPauseProvider controller={pauseController}>
              <CabinetSetupSheet
                open={showSetup}
                onClose={() => setShowSetup(false)}
                asSheet={
                  touchImmersive &&
                  (activeView ? activeView === "phone" : phoneScreen)
                }
                onOpenWizard={() => {
                  setShowSetup(false);
                  setShowWizard(true);
                }}
                onOpenTutorial={
                  tutorialRun.available
                    ? () => {
                        setShowSetup(false);
                        startTutorial();
                      }
                    : undefined
                }
                setupItems={setupItems}
                returnFocusTo={setupKeyRef}
              />
            </CabinetPauseProvider>
          </div>

          {/* Cabinet CRT layer: static, above the game, never over the wizard
            and never intercepting input. */}
          {showCabinetCrt && !showWizard && (
            <div
              aria-hidden="true"
              data-testid="cabinet-crt-layer"
              data-crt-filter={setupConfig.crtFilter}
              className={`pointer-events-none absolute inset-0 z-40 ${
                immersive ? "rounded-2xl" : "rounded-b-2xl"
              }`}
              style={{ backgroundImage: crtBackground }}
            />
          )}
        </div>

        {/* Optional Control Dock Slot (e.g. Virtual Gamepad, Bezel cluster) */}
        {controlDock && (
          <div
            inert={rotateBlocked}
            className="w-full mt-3 flex justify-center shrink-0"
          >
            {touchImmersive ? (
              <TouchControlsGate>{controlDock}</TouchControlsGate>
            ) : (
              controlDock
            )}
          </div>
        )}

        {/* Discrete Retro Controller Menu (visible when not in full-screen) */}
        {!immersive && (
          <div
            ref={footerRef}
            className="mt-3 flex items-center justify-between w-full border border-zinc-800 bg-zinc-900/60 rounded-2xl px-4 py-2 font-mono text-xs text-zinc-400 flex-wrap gap-2 shrink-0"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="uppercase tracking-wider">Cabinet Engaged</span>
            </div>

            <div
              data-testid="cabinet-footer-controls"
              className="flex flex-wrap items-center gap-2 min-w-0 max-w-full"
            >
              <button
                type="button"
                onClick={() => setShowWizard(true)}
                className="min-h-[44px] min-w-[44px] px-3 py-1 bg-zinc-950 text-amber-400 hover:text-amber-300 rounded-lg border border-amber-500/30 transition-all font-bold uppercase text-[10px] tracking-wider flex items-center justify-center gap-1 hover:bg-zinc-900 hover:border-amber-500/50 cursor-pointer touch-manipulation select-none active:scale-95 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
              >
                <IconAdjustments className="w-3.5 h-3.5 text-amber-400" />
                <span>Setup Wizard</span>
              </button>

              <button
                type="button"
                onClick={handleExit}
                className="min-h-[44px] min-w-[44px] px-3 py-1 bg-zinc-950 text-zinc-400 hover:text-white rounded-lg border border-zinc-800 transition-all font-bold uppercase text-[10px] tracking-wider flex items-center justify-center gap-1 hover:bg-zinc-900 hover:border-zinc-700 cursor-pointer touch-manipulation select-none active:scale-95 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none"
              >
                <IconPower className="w-3.5 h-3.5 text-red-500" />
                <span>Reset Cabinet</span>
              </button>
            </div>
          </div>
        )}

        {backArmed && (
          <p
            role="status"
            data-testid="cabinet-back-hint"
            className="pointer-events-none absolute left-1/2 z-50 max-w-[calc(100%-32px)] -translate-x-1/2 rounded-xl border border-zinc-700/80 bg-black/90 px-4 py-2 text-center font-mono text-sm text-zinc-100 shadow-2xl"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
          >
            Press Back again to exit
          </p>
        )}

        {rotateBlocked && mobileOrientation !== "either" && (
          <RotateDevicePrompt target={mobileOrientation} onExit={handleExit} />
        )}
      </div>
    );
  }

  return (
    <div data-game={gameId} className="w-full">
      {/* Static Retro Cabinet Preview Screen with scanlines */}
      {/* The card never clips its content (#2890). A 16:10 box with a fixed
          min-height or clipped overflow gets no content-based minimum, so on
          a phone it cut off its own Launch button. A narrow screen sizes the
          card to its content; from sm the card is 16:10 with min-height auto
          and grows past the ratio when its content needs it. Only the still
          behind it is clipped to the rounded corners. On a short landscape
          screen the card fits under the navbar and the instructions scroll,
          so Launch always shows. */}
      <div
        className="w-full min-h-[min(380px,65dvh)] sm:aspect-[16/10] sm:min-h-auto rounded-2xl border border-zinc-800 bg-zinc-950 flex flex-col justify-between p-6 sm:p-8 [@media(max-height:500px)]:max-h-[calc(100dvh-5rem)] [@media(max-height:500px)]:p-4 relative select-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, #09090b 40%, #020202 100%)",
        }}
      >
        {/* The game's own preview still, dimmed behind the title so the
            attract screen shows what the game looks like. */}
        {!isWarmingUp && (
          <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
            <Image
              src={`/images/arcade/previews/${gameId}.webp`}
              alt=""
              fill
              sizes="(min-width: 1280px) 1200px, 100vw"
              // Already-small WebP stills: skip the optimizer and its quota.
              unoptimized
              className="object-cover object-top opacity-80"
            />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(9,9,11,0.82)_0%,rgba(9,9,11,0.55)_55%,rgba(9,9,11,0.35)_100%)]" />
          </div>
        )}

        {/* The same CRT layer the launched cabinet draws, so the attract
            screen previews the player's setting. */}
        {crtBackground && (
          <div
            aria-hidden="true"
            data-testid="attract-crt-layer"
            className="absolute inset-0 rounded-2xl pointer-events-none z-10"
            style={{ backgroundImage: crtBackground }}
          />
        )}

        {isWarmingUp ? (
          /* CRT Warming up / Booting Screen */
          <div className="flex-1 flex flex-col justify-between font-mono text-xs text-emerald-400 z-10 p-2">
            <div className="space-y-1.5 uppercase tracking-wide">
              <div className="cabinet-standby-text flex items-center gap-2 text-[10px]">
                <IconTerminal className="w-4 h-4 text-emerald-500" />
                <span>SYSTEM DIAGNOSTICS DEPLOYING...</span>
              </div>
              <div
                aria-hidden="true"
                className="mt-2 overflow-hidden whitespace-nowrap text-zinc-400"
              >
                =================================
              </div>
              <div>
                &gt; INITIALIZING PORT CLIENT...{" "}
                <span className="text-emerald-500">OK</span>
              </div>
              <div>
                &gt; ISOLATING ENGINE MEMORY...{" "}
                <span className="text-emerald-500">COMPLETE</span>
              </div>
              <div>
                &gt; CONSTRUCTING AUDIO GRAPH...{" "}
                <span className="text-emerald-500">READY</span>
              </div>
              {bootProgress > 50 && (
                <div>
                  &gt; ESTABLISHING BUFFER CANVAS PORT...{" "}
                  <span className="text-emerald-500">STABLE</span>
                </div>
              )}
              {bootProgress > 75 && (
                <div>
                  &gt; DYNAMICALLY MOUNTING GAME CHUNK...{" "}
                  <span className="text-emerald-500">MOUNTED</span>
                </div>
              )}
            </div>

            <div className="space-y-2 mt-4">
              <div className="cabinet-standby-text flex justify-between items-center text-[10px]">
                <span className="animate-pulse motion-reduce:animate-none">
                  Warming up CRT display...
                </span>
                <span>{bootProgress}%</span>
              </div>
              <div className="w-full h-2.5 bg-zinc-900 rounded-full border border-zinc-800 overflow-hidden shadow-[0_0_8px_#10b981]">
                <div
                  className="h-full w-full bg-emerald-500 origin-left transform-gpu"
                  style={{
                    transform: `scaleX(${bootProgress / 100})`,
                    transformOrigin: "left",
                    willChange: "transform",
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Static Screen Idle State */
          <>
            {/* Header Status Bar */}
            <div className="cabinet-standby-text flex items-center justify-between border-b border-zinc-800/80 pb-4 font-mono text-[10px] text-zinc-400 z-10">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${isPrefetched ? "bg-amber-400" : "bg-zinc-600"} ${isPrefetched && !isLoaded ? "animate-pulse motion-reduce:animate-none" : ""}`}
                />
                <span className="uppercase tracking-wider">
                  {isPrefetched
                    ? isLoaded
                      ? "Engine Cached"
                      : "Prefetching Engine..."
                    : "Cabinet Standby"}
                </span>
              </div>
              <span className="cabinet-standby-text uppercase tracking-widest text-[9px] text-zinc-400">
                FDR PORTFOLIO ARCADE v2.6
              </span>
            </div>

            {/* Cabinet Game Display Details */}
            <div className="flex-1 flex flex-col items-center justify-center text-center my-6 [@media(max-height:500px)]:my-2 [@media(max-height:500px)]:min-h-0 [@media(max-height:500px)]:justify-start [@media(max-height:500px)]:overflow-y-auto max-w-xl mx-auto z-10">
              <div className="arcade-accent-text p-3 rounded-full bg-zinc-950/80 border border-zinc-700/80 mb-4 [@media(max-height:500px)]:hidden">
                {icon}
              </div>
              <h2 className="text-2xl sm:text-4xl [@media(max-height:500px)]:text-xl font-extrabold font-mono text-white tracking-[-0.035em] text-balance [text-shadow:0_2px_12px_rgba(0,0,0,0.8)]">
                {title}
              </h2>
              {subtitle && (
                <p className="cabinet-standby-text arcade-accent-text text-[10px] font-mono uppercase tracking-widest mt-2 font-bold">
                  {subtitle}
                </p>
              )}
              <p className="text-xs text-zinc-300 font-mono mt-3 leading-relaxed">
                {instructions}
              </p>
            </div>

            {/* Bottom Actions & Controls HUD */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-4 border-t border-zinc-800/60 z-10">
              {/* Controls display */}
              <div className="hidden md:flex flex-wrap gap-2 font-mono text-[10px]">
                {controls?.slice(0, 3).map((ctrl, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 bg-zinc-950/85 border border-zinc-800/80 px-2 py-1 rounded-md text-zinc-300"
                  >
                    <span className="px-1.5 py-0.5 bg-zinc-950 text-white border border-zinc-700 rounded text-[9px] font-bold">
                      {ctrl.key}
                    </span>
                    <span>{ctrl.action}</span>
                  </div>
                ))}
              </div>

              {/* Glowing Play Button, or the game's own launch choices */}
              <div className="flex justify-end w-full">
                {LaunchControl ? (
                  <div ref={launchControlRef} className="w-full md:w-auto">
                    <LaunchControl
                      launch={handleLaunch}
                      prefetch={handlePrefetch}
                    />
                  </div>
                ) : (
                  <button
                    ref={launchButtonRef}
                    onMouseEnter={handlePrefetch}
                    onFocus={handlePrefetch}
                    onClick={handleLaunch}
                    className={`w-full md:w-auto min-h-[44px] min-w-[44px] px-8 py-3.5 arcade-launch-button text-black font-extrabold rounded-xl border-b-4 hover:border-b-2 active:border-b-0 active:translate-y-1 active:scale-95 transition-all duration-75 flex items-center justify-center gap-2 font-mono text-xs sm:text-sm tracking-wider shadow-lg uppercase cursor-pointer touch-manipulation select-none`}
                  >
                    <IconPlayerPlay className="w-4 h-4 fill-black text-black" />
                    <span>Launch Cabinet</span>
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
