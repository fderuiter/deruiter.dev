"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  IconPlayerPlay,
  IconPower,
  IconTerminal,
  IconAdjustments,
} from "@tabler/icons-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useFullscreen } from "@/hooks/useFullscreen";
import { CabinetFullscreenContext } from "./CabinetFullscreen";
import { CabinetSetupContext } from "./CabinetSetupContext";
import { FullscreenButton } from "@/components/arcade/FullscreenButton";
import {
  PreGameSetupWizard,
  getSavedSetupConfig,
  GameSetupConfig,
} from "@/components/arcade/PreGameSetupWizard";
import { logger } from "@/lib/logger";

interface ControlItem {
  key: string;
  action: string;
}

interface PlayCabinetProps {
  gameId?: string;
  title: string;
  subtitle?: string;
  accentColor: "amber" | "red" | "purple" | "emerald" | "rose";
  icon: React.ReactNode;
  instructions: string;
  controls: ControlItem[];
  importComponent: () => Promise<unknown>;
  statusAnnouncement?: string;
  controlDock?: React.ReactNode;
  onLaunch?: () => void;
  onExit?: () => void;
  children: React.ReactNode;
}

function getKeyboardBoundary(cabinet: HTMLElement): HTMLElement | null {
  return cabinet.querySelector<HTMLElement>('[data-keyboard-boundary="true"]');
}

// A game's own dialog (a fix dialog, a pause menu) gets the first Escape, so
// the press closes it rather than leaving fullscreen.
function findOpenGameDialog(cabinet: HTMLElement): Element | null {
  return cabinet.querySelector(
    '[role="dialog"], [role="alertdialog"], [aria-modal="true"]'
  );
}

export const PlayCabinet: React.FC<PlayCabinetProps> = ({
  gameId: rawGameId,
  title,
  subtitle,
  accentColor,
  icon,
  instructions,
  controls,
  importComponent,
  statusAnnouncement,
  controlDock,
  onLaunch,
  onExit,
  children,
}) => {
  const gameId = rawGameId || title.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const [isLaunched, setIsLaunched] = useState(false);
  const [isPrefetched, setIsPrefetched] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [bootProgress, setBootProgress] = useState(0);

  const [showWizard, setShowWizard] = useState(false);
  const cabinetRef = useRef<HTMLDivElement>(null);
  const [setupConfig, setSetupConfig] = useState<GameSetupConfig>(() =>
    getSavedSetupConfig(gameId)
  );

  const [runRevision, setRunRevision] = useState(0);
  const setupValue = useMemo(
    () => ({ config: setupConfig, runRevision, isSetupOpen: showWizard }),
    [setupConfig, runRevision, showWizard]
  );

  const {
    isFullscreen,
    isPseudoFullscreen,
    toggleFullscreen: toggleCabinetFullscreen,
    exitFullscreen,
  } = useFullscreen(cabinetRef, { enableKeyShortcut: false });
  // Entering fullscreen swaps the header, so focus would otherwise land on the
  // first toolbar button ("Exit Fullscreen"), where the game's Space key
  // presses it. Start the trap on the game's keyboard boundary instead.
  // Escape is handled by the cabinet's capture handler below, which defers
  // to any dialog the game has open.
  const boundaryFocusRef = useRef<HTMLElement | null>(null);
  const fullscreenFocusRef = useFocusTrap(isFullscreen && !showWizard, {
    initialFocusRef: boundaryFocusRef,
    returnFocus: false,
  });

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

  const colors = {
    amber: {
      border: "border-amber-500/30",
      borderHover: "hover:border-amber-400/50",
      bgGlow: "bg-amber-500/5",
      text: "text-amber-400",
      textDark: "text-amber-600",
      shadow: "shadow-amber-500/10",
      buttonBg: "bg-amber-500",
      buttonHover: "hover:bg-amber-400",
      buttonBorder: "border-amber-700",
      buttonShadow: "shadow-amber-500/40",
      accent: "amber",
    },
    red: {
      border: "border-red-500/30",
      borderHover: "hover:border-red-400/50",
      bgGlow: "bg-red-500/5",
      text: "text-red-400",
      textDark: "text-red-600",
      shadow: "shadow-red-500/10",
      buttonBg: "bg-red-500",
      buttonHover: "hover:bg-red-400",
      buttonBorder: "border-red-700",
      buttonShadow: "shadow-red-500/40",
      accent: "red",
    },
    purple: {
      border: "border-purple-500/30",
      borderHover: "hover:border-purple-400/50",
      bgGlow: "bg-purple-500/5",
      text: "text-purple-400",
      textDark: "text-purple-600",
      shadow: "shadow-purple-500/10",
      buttonBg: "bg-purple-500",
      buttonHover: "hover:bg-purple-400",
      buttonBorder: "border-purple-700",
      buttonShadow: "shadow-purple-500/40",
      accent: "purple",
    },
    emerald: {
      border: "border-emerald-500/30",
      borderHover: "hover:border-emerald-400/50",
      bgGlow: "bg-emerald-500/5",
      text: "text-emerald-400",
      textDark: "text-emerald-600",
      shadow: "shadow-emerald-500/10",
      buttonBg: "bg-emerald-500",
      buttonHover: "hover:bg-emerald-400",
      buttonBorder: "border-emerald-700",
      buttonShadow: "shadow-emerald-500/40",
      accent: "emerald",
    },
    rose: {
      border: "border-rose-500/30",
      borderHover: "hover:border-rose-400/50",
      bgGlow: "bg-rose-500/5",
      text: "text-rose-400",
      textDark: "text-rose-600",
      shadow: "shadow-rose-500/10",
      buttonBg: "bg-rose-500",
      buttonHover: "hover:bg-rose-400",
      buttonBorder: "border-rose-700",
      buttonShadow: "shadow-rose-500/40",
      accent: "rose",
    },
  }[accentColor];

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

  const handleLaunch = () => {
    handlePrefetch();
    setIsWarmingUp(true);
    setBootProgress(0);
    onLaunch?.();
  };

  useEffect(() => {
    if (!isWarmingUp) return;

    const updateProgress = () => {
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
    };

    const timer = setInterval(updateProgress, 60);
    return () => clearInterval(timer);
  }, [isWarmingUp, isLoaded]);

  // On launch, bring the cabinet into view and hand keyboard focus to the
  // game's own key-handling container, so the first key press reaches it.
  useEffect(() => {
    if (!isLaunched) return;
    const cabinet = cabinetRef.current;
    if (!cabinet) return;
    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cabinet.scrollIntoView?.({
      block: "start",
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
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
      const boundary = getKeyboardBoundary(cabinet);
      if (boundary) {
        clearInterval(timer);
        boundary.focus({ preventScroll: true });
      } else if (attempts === 1) {
        cabinet.focus({ preventScroll: true });
      }
      if (attempts >= 20) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, [isLaunched]);

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
    const observer = new MutationObserver(() => {
      const active = document.activeElement;
      if (!ownsFocus || (active && active !== document.body)) return;
      getKeyboardBoundary(cabinet)?.focus({ preventScroll: true });
    });
    observer.observe(cabinet, { childList: true, subtree: true });
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [isLaunched]);

  const handleExit = () => {
    setIsLaunched(false);
    setIsWarmingUp(false);
    void exitFullscreen();
    setBootProgress(0);
    onExit?.();
  };

  if (isLaunched) {
    const bezelClasses =
      {
        classic: "border-amber-800/80 shadow-[0_0_30px_rgba(217,119,6,0.15)]",
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
            showWizard ||
            event.repeat ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            target.closest("input, textarea, select, [contenteditable=true]")
          )
            return;
          if (event.key === "Escape" && isFullscreen) {
            const dialog = findOpenGameDialog(event.currentTarget);
            if (dialog) {
              // Let the game handle this press. If its dialog is still open
              // afterwards, the game doesn't close it on Escape (a results
              // screen, say), so fall back to leaving fullscreen.
              setTimeout(() => {
                if (dialog.isConnected) void exitFullscreen();
              }, 0);
              return;
            }
          }
          if (
            event.key.toLowerCase() === "f" ||
            (event.key === "Escape" && isFullscreen)
          ) {
            event.preventDefault();
            event.stopPropagation();
            if (event.key === "Escape") void exitFullscreen();
            else void toggleCabinetFullscreen();
          }
        }}
        tabIndex={-1}
        data-arcade-cabinet={gameId}
        data-fullscreen={isFullscreen}
        className={`arcade-cabinet w-full flex flex-col items-center max-w-full min-w-0 @container ${
          isFullscreen
            ? "fixed inset-0 z-50 h-dvh max-w-none bg-black overflow-hidden select-none"
            : "relative scroll-mt-24"
        }`}
        style={
          {
            "--layout-dock-height": controlDock ? "120px" : "0px",
          } as React.CSSProperties
        }
      >
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
        {isFullscreen ? (
          <div className="arcade-cabinet-toolbar self-end shrink-0 z-50 flex items-center gap-1.5 p-1 bg-black/85 backdrop-blur-md rounded-2xl border border-zinc-700/80 shadow-2xl select-none">
            <FullscreenButton
              isFullscreen={isFullscreen}
              isPseudoFullscreen={isPseudoFullscreen}
              onToggle={toggleCabinetFullscreen}
              variant="header"
            />
            <button
              type="button"
              onClick={() => setShowWizard(true)}
              className="min-h-12 min-w-12 px-2.5 py-1.5 bg-neutral-900/90 hover:bg-neutral-800 text-amber-400 rounded-xl border border-amber-500/30 transition-all font-mono font-bold text-xs flex items-center justify-center gap-1 cursor-pointer touch-manipulation select-none active:scale-95 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
              title="Pre-Game Setup Wizard"
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
          <div className="w-full flex items-center justify-between px-3.5 py-2 bg-zinc-950/95 border border-zinc-800 rounded-t-2xl font-mono text-xs text-zinc-400 select-none backdrop-blur-md gap-2 shrink-0 z-20">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399] shrink-0" />
              <span className="font-bold tracking-wider text-zinc-200 text-xs uppercase truncate">
                {title}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <FullscreenButton
                isFullscreen={isFullscreen}
                isPseudoFullscreen={isPseudoFullscreen}
                onToggle={toggleCabinetFullscreen}
                variant="header"
              />

              <button
                type="button"
                onClick={() => setShowWizard(true)}
                className="min-h-12 min-w-12 px-2.5 py-1.5 bg-neutral-900/90 hover:bg-neutral-800 text-amber-400 rounded-xl border border-amber-500/30 transition-all font-mono font-bold text-xs flex items-center justify-center gap-1 cursor-pointer touch-manipulation select-none active:scale-95 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
                title="Pre-Game Setup Wizard"
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
          className={`arcade-cabinet-stage w-full relative min-h-0 min-w-0 ${
            isFullscreen
              ? "flex-1 rounded-2xl border-2"
              : "border-2 border-t-0 rounded-b-2xl"
          } overflow-y-auto overflow-x-hidden flex flex-col items-center justify-start bg-black ${bezelClasses}`}
        >
          <CabinetFullscreenContext.Provider value={toggleCabinetFullscreen}>
            <CabinetSetupContext.Provider value={setupValue}>
              {children}
            </CabinetSetupContext.Provider>
          </CabinetFullscreenContext.Provider>

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
        </div>

        {/* Optional Control Dock Slot (e.g. Virtual Gamepad, Bezel cluster) */}
        {controlDock && (
          <div className="w-full mt-3 flex justify-center shrink-0">
            {controlDock}
          </div>
        )}

        {/* Discrete Retro Controller Menu (visible when not in full-screen) */}
        {!isFullscreen && (
          <div className="mt-3 flex items-center justify-between w-full border border-zinc-800 bg-zinc-900/60 rounded-2xl px-4 py-2 font-mono text-xs text-zinc-400 flex-wrap gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="uppercase tracking-wider">Cabinet Engaged</span>
            </div>

            <div className="flex items-center gap-2">
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
      </div>
    );
  }

  return (
    <div className={`w-full ${colors.shadow} transition-all duration-300`}>
      {/* Static Retro Cabinet Preview Screen with scanlines */}
      <div
        className="w-full aspect-[16/10] min-h-[min(380px,65dvh)] rounded-2xl border border-zinc-800 bg-zinc-950 flex flex-col justify-between p-6 sm:p-8 relative overflow-hidden select-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, #09090b 40%, #020202 100%)",
        }}
      >
        {/* Scanlines Effect */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0),rgba(255,255,255,0)_50%,rgba(0,0,0,0.45)_50%,rgba(0,0,0,0.45))] bg-[size:100%_4px] pointer-events-none z-10" />

        {isWarmingUp ? (
          /* CRT Warming up / Booting Screen */
          <div className="flex-1 flex flex-col justify-between font-mono text-xs text-emerald-400 z-10 p-2">
            <div className="space-y-1.5 uppercase tracking-wide">
              <div className="flex items-center gap-2 text-[10px]">
                <IconTerminal className="w-4 h-4 text-emerald-500" />
                <span>SYSTEM DIAGNOSTICS DEPLOYING...</span>
              </div>
              <div className="text-zinc-600 mt-2">
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
              <div className="flex justify-between items-center text-[10px]">
                <span className="animate-pulse">Warming up CRT display...</span>
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
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 font-mono text-[10px] text-zinc-500 z-10">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${isPrefetched ? "bg-amber-400" : "bg-zinc-600"} animate-pulse`}
                />
                <span className="uppercase tracking-wider">
                  {isPrefetched
                    ? isLoaded
                      ? "Engine Cached"
                      : "Prefetching Engine..."
                    : "Cabinet Standby"}
                </span>
              </div>
              <span className="uppercase tracking-widest text-[9px] text-zinc-600">
                FDR PORTFOLIO ARCADE v2.6
              </span>
            </div>

            {/* Cabinet Game Display Details */}
            <div className="flex-1 flex flex-col items-center justify-center text-center my-6 max-w-xl mx-auto z-10">
              <div
                className={`p-4 rounded-full bg-zinc-900/60 border border-zinc-800/80 text-white mb-4 shadow-inner group-hover:scale-105 transition-transform`}
              >
                {icon}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight uppercase">
                {title}
              </h2>
              {subtitle && (
                <p
                  className={`text-[10px] font-mono ${colors.text} uppercase tracking-widest mt-1 font-bold`}
                >
                  {subtitle}
                </p>
              )}
              <p className="text-xs text-zinc-400 font-mono mt-3 leading-relaxed">
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
                    className="flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800/80 px-2 py-1 rounded-md text-zinc-400"
                  >
                    <span className="px-1.5 py-0.5 bg-zinc-950 text-white border border-zinc-700 rounded text-[9px] font-bold">
                      {ctrl.key}
                    </span>
                    <span>{ctrl.action}</span>
                  </div>
                ))}
              </div>

              {/* Glowing Play Button */}
              <div className="flex justify-end w-full">
                <button
                  onMouseEnter={handlePrefetch}
                  onFocus={handlePrefetch}
                  onClick={handleLaunch}
                  className={`w-full md:w-auto min-h-[44px] min-w-[44px] px-8 py-3.5 ${colors.buttonBg} ${colors.buttonHover} text-black font-extrabold rounded-xl border-b-4 ${colors.buttonBorder} hover:border-b-2 active:border-b-0 active:translate-y-1 active:scale-95 transition-all duration-70s flex items-center justify-center gap-2 font-mono text-xs sm:text-sm tracking-wider shadow-lg ${colors.buttonShadow} uppercase cursor-pointer touch-manipulation select-none`}
                >
                  <IconPlayerPlay className="w-4 h-4 fill-black text-black" />
                  <span>Launch Cabinet</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
