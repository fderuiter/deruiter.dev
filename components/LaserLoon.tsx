"use client";

import React, { useState } from "react";
import {
  getMatchMediaMatches,
  usePrefersReducedMotion,
} from "@/hooks/useMediaQuery";
import { useCabinetTouch, useTouchHint } from "@/components/arcade/mobile";
import { clamp } from "@/lib/game-utils";
import {
  IconFlame,
  IconRefresh,
  IconPlayerPlay,
  IconPlayerPause,
  IconSnowflake,
  IconSparkles,
  IconBook,
  IconX,
  IconVolume,
  IconVolumeOff,
  IconChevronRight,
  IconTarget,
  IconHeart,
  IconMenu2,
} from "@tabler/icons-react";
import { FieldManualButton } from "@/components/FieldManualButton";
import { FullscreenButton } from "@/components/arcade/FullscreenButton";
import { DynamicTabletOrientationHint as TabletOrientationHint } from "@/components/arcade/DynamicTabletOrientationHint";
import { MerchPrompt } from "@/components/merch/MerchPrompt";
import { TwinStickAimDock } from "@/components/arcade/ControlDocks";
import { PauseMenu } from "@/components/laser-loon/PauseMenu";
import { LoonTouchControls } from "@/components/laser-loon/LoonTouchControls";
import { TouchMenuSheet } from "@/components/laser-loon/TouchMenuSheet";
import "@/components/laser-loon/laser-loon-touch.css";
import {
  CAMPAIGN_STAR_TOTAL,
  useLaserLoonSession,
} from "@/components/laser-loon/useLaserLoonSession";
import { ArcadeHud } from "@/components/arcade/ArcadeHud";
import { ResultCard } from "@/components/arcade/ResultCard";
import {
  LaserMode,
  LaserType,
  WEAPONS,
  CAMPAIGN_ACTS,
  FLAG_MUSEUM,
  POWER_UP_CONFIGS,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  LOON_MIN_X,
  LOON_MAX_X,
  LOON_MIN_Y,
  LOON_MAX_Y,
  LOON_MAX_HITS,
  getBossSignature,
  BOSS_SIGNATURE_HINTS,
  getSurvivalWave,
  formatRunClock,
  SURVIVAL_WAVE_SECONDS,
  getActProgressReadout,
  countActStars,
  ENEMY_TYPES,
  getActNewEnemies,
  getEnemyWeakness,
} from "@/lib/laser-loon";

/** Short optic names for the act intro's field guide, as the weapon bar uses. */
const OPTIC_SHORT_NAMES: Record<LaserType, string> = {
  "ruby-laser": "Ruby Laser",
  "cyan-pulse": "Cyan Pulse",
  "aurora-wave": "Aurora Wave",
  "ice-cannon": "Cryo-Mortar",
};

// Screen-reader status reads words, not internal state names (#2142).
const MODE_NAMES: Record<LaserMode, string> = {
  campaign: "Campaign",
  arcade: "Arcade Survival",
  sandbox: "Zero-G Sandbox",
};
const GAME_STATE_NAMES = {
  idle: "Title screen",
  playing: "Playing",
  "act-intro": "Act briefing",
  "act-victory": "Act cleared",
  "act-failed": "Act failed",
  gameover: "Run over",
  "campaign-victory": "Campaign won",
} as const;

// Where each survival wave takes place, for the result card.
const SURVIVAL_WAVE_STOPS = {
  Lake: "on Lake Minnetonka",
  Fair: "at the State Fair",
  Hearing: "in the Commission hearing",
  Capitol: "under the Capitol dome",
} as const;

// The title screen names the mode it will start (#2141).
const MODE_TITLES: Record<
  LaserMode,
  { heading: string; blurb: string; start: string }
> = {
  campaign: {
    heading: "LASER LOON: QUEST FOR THE STATE FLAG",
    blurb: "",
    start: "START CAMPAIGN",
  },
  arcade: {
    heading: "ARCADE SURVIVAL",
    blurb:
      "Three hearts and no finish line. Every 30 seconds a new wave rolls in from the next stop on the road to the Capitol, and from the second wave the enemies shoot back. How long can the loon last?",
    start: "START SURVIVAL",
  },
  sandbox: {
    heading: "ZERO-G SANDBOX",
    blurb:
      "No hearts, a Tremolo that never runs dry, and dials for gravity and spawns. Nothing here counts toward your best.",
    start: "START SANDBOX",
  },
};
const starString = (stars: number) =>
  "★".repeat(stars) + "☆".repeat(Math.max(0, 3 - stars));

export const LaserLoon: React.FC = () => {
  // Device facts are read here and handed to the session (ADR 0062).
  const cabinetTouch = useCabinetTouch();
  const touchHint = useTouchHint();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [initialScreenShake] = useState(
    () => !getMatchMediaMatches("(prefers-reduced-motion: reduce)")
  );
  const {
    isMounted,
    actBests,
    runStars,
    mode,
    laserType,
    gameState,
    currentActNum,
    actKills,
    runKills,
    hitsLeft,
    bossActive,
    bossHp,
    bossMaxHp,
    bossName,
    score,
    effectiveHighScore,
    combo,
    maxCombo,
    runStartBest,
    actResult,
    multiplier,
    survivalSecs,
    ultimateMeter,
    activePowerUpType,
    activePowerUpTimeMs,
    isFocused,
    setIsFocused,
    screenShakeEnabled,
    setScreenShakeEnabled,
    fxStageRef,
    fxFlashRef,
    soundEnabled,
    setSoundEnabled,
    gravity,
    setGravity,
    showMuseum,
    setShowMuseum,
    selectedFlagIndex,
    setSelectedFlagIndex,
    isPaused,
    setIsPaused,
    setIsManualOpen,
    showMenu,
    setShowMenu,
    touch,
    keyTag,
    survivalWave,
    announce,
    togglePause,
    museumTrapRef,
    containerRef,
    canvasRef,
    isFullscreen,
    toggleFullscreen,
    selectLaserType,
    loonPosRef,
    aimPosRef,
    isFiringRef,
    currentAct,
    launchIceBlock,
    spawnTarget,
    triggerBossEncounter,
    fireUltimateTremolo,
    startAct,
    retryAct,
    advanceToNextAct,
    startGame,
    resetGame,
    fireWeapon,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
    handleCanvasPointerCancel,
    handleCanvasMouseMove,
    handleCanvasMouseDown,
    handleCanvasMouseUp,
    handleTouchMove,
    handleTouchStart,
    handleTouchEnd,
    handleDockFirePress,
    handleDockFireRelease,
    chooseMode,
    handleKeyDown,
    handleKeyUp,
  } = useLaserLoonSession({
    touch: cabinetTouch,
    touchHint,
    prefersReducedMotion,
    initialScreenShake,
  });

  // The touch cabinet has no heading above the story, so it is a level 2
  // rather than a level 4 that skips two (#2081).
  const HeadlineTag = touch ? "h2" : "h4";

  if (!isMounted) {
    return (
      <div className="w-full h-[460px] bg-neutral-950 border border-neutral-800 rounded-3xl flex flex-col items-center justify-center p-6 text-center font-mono select-none">
        <div className="text-red-400 text-sm font-bold animate-pulse mb-2">
          [INITIALIZING LASER LOON CRYO ENGINE...]
        </div>
        <p className="text-xs text-neutral-500 max-w-sm">
          Loading submission F277 specs, retro audio synthesizer, and Minnesota
          State Flag campaign lore.
        </p>
      </div>
    );
  }

  // Campaign and survival share the three hearts.
  const heartsStat = {
    label: "Hits",
    value: (
      <span
        className="flex items-center gap-0.5"
        role="img"
        aria-label={`Hits left: ${hitsLeft} of ${LOON_MAX_HITS}`}
      >
        {Array.from({ length: LOON_MAX_HITS }, (_, i) => (
          <IconHeart
            key={i}
            aria-hidden="true"
            className={`w-3.5 h-3.5 ${
              i < hitsLeft ? "text-rose-400 fill-rose-400" : "text-neutral-600"
            }`}
          />
        ))}
      </span>
    ),
  };

  return (
    <div
      className={`arcade-shooter w-full min-w-0 flex flex-col items-center select-none my-3${
        touch ? " ll-touch" : ""
      }`}
    >
      {/* Tablet Orientation Recommendation */}
      <TabletOrientationHint className="w-full max-w-3xl" />

      {!touch && (
        <details className="arcade-shooter-options w-full max-w-3xl">
          <summary className="min-h-12 p-3 cursor-pointer font-mono text-xs text-zinc-300">
            Game modes, weapons & audio
          </summary>
          {/* HUD Header Bar & Mode Selector */}
          <div className="w-full max-w-3xl flex flex-wrap items-center justify-between gap-3 mb-3 px-2">
            {/* Mode Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-neutral-900/80 border border-neutral-800 rounded-xl backdrop-blur-md">
              <button
                onClick={() => chooseMode("campaign")}
                className={`min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer touch-manipulation select-none active:scale-[0.98] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none ${
                  mode === "campaign"
                    ? "bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                🏆 Campaign
              </button>
              <button
                onClick={() => chooseMode("arcade")}
                className={`min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer touch-manipulation select-none active:scale-[0.98] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none ${
                  mode === "arcade"
                    ? "bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                ⚡ Arcade Survival
              </button>
              <button
                onClick={() => chooseMode("sandbox")}
                className={`min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer touch-manipulation select-none active:scale-[0.98] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none ${
                  mode === "sandbox"
                    ? "bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                🧪 Zero-G Sandbox
              </button>
            </div>

            {/* Laser Weapon Selector */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-neutral-900/80 border border-neutral-800 rounded-xl backdrop-blur-md">
              <button
                onClick={() => selectLaserType("ruby-laser")}
                aria-pressed={laserType === "ruby-laser"}
                className={`min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer touch-manipulation select-none active:scale-[0.98] flex items-center justify-center gap-1 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none ${
                  laserType === "ruby-laser"
                    ? "bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                    : "text-neutral-400 hover:text-white border border-transparent"
                }`}
              >
                Ruby (1)
              </button>
              <button
                onClick={() => selectLaserType("cyan-pulse")}
                aria-pressed={laserType === "cyan-pulse"}
                className={`min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer touch-manipulation select-none active:scale-[0.98] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                  laserType === "cyan-pulse"
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                    : "text-neutral-400 hover:text-white border border-transparent"
                }`}
              >
                Pulse (2)
              </button>
              <button
                onClick={() => selectLaserType("aurora-wave")}
                aria-pressed={laserType === "aurora-wave"}
                className={`min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer touch-manipulation select-none active:scale-[0.98] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none ${
                  laserType === "aurora-wave"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "text-neutral-400 hover:text-white border border-transparent"
                }`}
              >
                Aurora (3)
              </button>
              <button
                onClick={() => selectLaserType("ice-cannon")}
                aria-pressed={laserType === "ice-cannon"}
                className={`min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer touch-manipulation select-none active:scale-[0.98] flex items-center justify-center gap-1 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none ${
                  laserType === "ice-cannon"
                    ? "bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-[0_0_10px_rgba(56,189,248,0.3)]"
                    : "text-neutral-400 hover:text-white border border-transparent"
                }`}
              >
                <IconSnowflake className="w-3.5 h-3.5" />
                Cryo-Mortar (4)
              </button>
            </div>

            {/* Score & Museum Buttons */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <button
                onClick={() => setShowMuseum(true)}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-amber-300 border border-amber-500/30 transition-all cursor-pointer touch-manipulation select-none active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
              >
                <IconBook className="w-3.5 h-3.5" />
                <span>Flag Museum</span>
              </button>

              <FieldManualButton
                manualId="laser-loon"
                label="Manual"
                onOpenChange={setIsManualOpen}
              />
              <FullscreenButton
                isFullscreen={isFullscreen}
                onToggle={toggleFullscreen}
                variant="header"
              />
            </div>
          </div>
        </details>
      )}
      {/* Main Interactive Game Container */}
      <div
        ref={containerRef}
        tabIndex={0}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        data-keyboard-boundary="true"
        data-tutorial-target="arena"
        // A run in progress takes Escape for itself (it pauses), so the touch
        // cabinet's Escape does not also leave the game (#2081).
        data-escape-docks={
          touch && gameState === "playing" && !isPaused && !showMenu
            ? "true"
            : undefined
        }
        className={`arcade-shooter-playfield relative outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--game-accent)] flex flex-col justify-center ${
          isFullscreen
            ? "fixed inset-0 z-50 w-full h-[100dvh] max-h-[100dvh] max-w-none rounded-none border-none bg-black p-2 sm:p-4 overflow-hidden select-none touch-none"
            : "w-full max-w-[min(100%,calc((100dvh_-_340px)*768/420))] bg-neutral-950 overflow-hidden"
        }`}
      >
        <FullscreenButton
          isFullscreen={isFullscreen}
          onToggle={toggleFullscreen}
          variant="floating"
        />
        {/* One HUD strip above the stage keeps the arena clear (#1598). */}
        <ArcadeHud
          stats={[
            { label: "Score", value: score, accent: true },
            // Sandbox never saves a score, so it shows no best.
            ...(mode === "sandbox"
              ? []
              : [{ label: "Hi", value: effectiveHighScore }]),
            ...(mode === "campaign"
              ? [
                  { label: "Act", value: `${currentActNum}/4` },
                  getActProgressReadout(
                    actKills,
                    currentAct.requiredMinionKills,
                    {
                      active: bossActive,
                      hp: bossHp,
                      maxHp: currentAct.bossHp,
                    }
                  ),
                  heartsStat,
                ]
              : []),
            ...(mode === "arcade"
              ? [
                  { label: "Wave", value: survivalWave.label },
                  { label: "Time", value: formatRunClock(survivalSecs) },
                  heartsStat,
                ]
              : []),
          ]}
          callouts={
            <>
              {combo > 1 && (
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-amber-300">
                  <IconFlame
                    aria-hidden="true"
                    className="w-3 h-3 text-amber-400"
                  />
                  {combo}x combo ({multiplier}x pts)
                </span>
              )}
              {activePowerUpType && (
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-emerald-300">
                  <IconSparkles
                    aria-hidden="true"
                    className="w-3 h-3 text-emerald-400"
                  />
                  {POWER_UP_CONFIGS[activePowerUpType]?.label} (
                  {Math.ceil(activePowerUpTimeMs / 1000)}s)
                </span>
              )}
              {!touch && !isFocused && gameState === "playing" && (
                <span className="whitespace-nowrap text-zinc-500">
                  Click the arena to aim
                </span>
              )}
            </>
          }
          meter={
            gameState === "playing" && !touch
              ? {
                  label: "Tremolo",
                  percent: mode === "sandbox" ? 100 : ultimateMeter,
                  ready: ultimateMeter >= 100 || mode === "sandbox",
                  onActivate: fireUltimateTremolo,
                  hotkey: "U",
                }
              : undefined
          }
          trailing={
            touch ? (
              <span className="ll-hud-actions">
                <button
                  type="button"
                  onClick={() => {
                    isFiringRef.current = false;
                    setShowMenu(true);
                  }}
                  aria-haspopup="dialog"
                  className="ll-hud-action"
                >
                  <IconMenu2 className="h-4 w-4" aria-hidden="true" />
                  <span>Menu</span>
                </button>
                {(gameState === "playing" || isPaused) && (
                  <button
                    type="button"
                    onClick={togglePause}
                    aria-label={isPaused ? "Resume Game" : "Pause Game"}
                    className="ll-hud-action"
                  >
                    {isPaused ? (
                      <IconPlayerPlay
                        className="h-4 w-4 fill-current"
                        aria-hidden="true"
                      />
                    ) : (
                      <IconPlayerPause className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>{isPaused ? "Resume" : "Pause"}</span>
                  </button>
                )}
              </span>
            ) : /* Fullscreen hides the footer strip, so Pause stays in the HUD
               there; elsewhere it lives below the playfield, out of the
               firing area (#1551). */
            isFullscreen && (gameState === "playing" || isPaused) ? (
              <button
                type="button"
                onClick={togglePause}
                aria-label={isPaused ? "Resume Game" : "Pause Game"}
                className="min-h-[44px] min-w-[44px] px-2 rounded-md text-zinc-200 hover:bg-white/[0.06] font-mono text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--game-accent)] focus-visible:outline-none"
              >
                {isPaused ? (
                  <IconPlayerPlay className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <IconPlayerPause className="w-3.5 h-3.5" />
                )}
                <span>{isPaused ? "Resume" : "Pause"} [P]</span>
              </button>
            ) : undefined
          }
        />

        {/* Stage: the canvas fills the bezel; shake moves this element. */}
        <div
          ref={fxStageRef}
          className={`relative w-full min-w-0 ${
            isFullscreen ? "flex justify-center" : ""
          }${touch ? " ll-stage" : ""}`}
        >
          {/* Docked boss plate: full name and HP, clear of the arena. */}
          {bossActive && (
            <div
              key={`boss-plate-${bossName}`}
              className="loon-boss-plate absolute top-0 inset-x-0 z-20 flex items-center gap-3 px-3 py-1.5 bg-gradient-to-b from-black/80 to-black/0 font-mono text-[11px] font-bold pointer-events-none"
            >
              <span className="shrink-0 uppercase tracking-wider text-rose-300">
                {bossName}
              </span>
              <div
                role="progressbar"
                aria-valuenow={Math.max(
                  0,
                  Math.round((bossHp / bossMaxHp) * 100)
                )}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${bossName} Health`}
                className="flex-1 min-w-0 h-2 bg-neutral-900 rounded-full overflow-hidden border border-white/[0.08]"
              >
                <div
                  className="h-full w-full bg-rose-500 origin-left transition-transform duration-150"
                  style={{
                    transform: `scaleX(${clamp(bossHp / bossMaxHp, 0, 1)})`,
                  }}
                />
              </div>
              <span className="shrink-0 tabular-nums text-zinc-300">
                {Math.max(0, Math.ceil(bossHp))} / {bossMaxHp}
              </span>
            </div>
          )}

          <div
            ref={fxFlashRef}
            aria-hidden="true"
            className="absolute inset-0 z-10 opacity-0 pointer-events-none"
          />

          {/* Game Canvas */}
          <canvas
            ref={canvasRef}
            width={768}
            height={420}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerCancel}
            onMouseMove={handleCanvasMouseMove}
            onMouseDown={handleCanvasMouseDown}
            onMouseUp={handleCanvasMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            style={{ touchAction: "none" }}
            role="application"
            aria-label="Laser Loon Arcade Game. Use arrow keys to reposition the loon, spacebar or enter to fire weapons, and number keys 1 to 4 to select weapons."
            tabIndex={0}
            className={
              isFullscreen
                ? "max-h-[var(--layout-viewport-budget,calc(100dvh-var(--header-height,80px)-var(--footer-height,48px)))] max-h-[calc(100dvh-var(--header-height,80px)-var(--footer-height,48px))] max-w-full aspect-[768/420] object-contain block cursor-crosshair touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--game-accent)]"
                : "w-full h-auto aspect-[768/420] block cursor-crosshair touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--game-accent)]"
            }
          />
        </div>

        {/* Pause Overlay Screen */}
        {isPaused && (
          <div className="arcade-shooter-pause absolute inset-0 bg-neutral-950/90 backdrop-blur-md z-40 flex flex-col items-center justify-center text-center p-4 select-none overflow-y-auto">
            <PauseMenu
              score={score}
              actNum={currentActNum}
              onResume={togglePause}
              onRestart={() => {
                setIsPaused(false);
                startGame();
              }}
              onExit={() => {
                setIsPaused(false);
                resetGame();
              }}
            />
          </div>
        )}

        {touch && showMenu && (
          <TouchMenuSheet
            mode={mode}
            soundEnabled={soundEnabled}
            screenShakeEnabled={screenShakeEnabled}
            onMode={(next) => {
              chooseMode(next);
              setShowMenu(false);
            }}
            onMuseum={() => {
              setShowMenu(false);
              setShowMuseum(true);
            }}
            onManualOpenChange={setIsManualOpen}
            onToggleSound={() => setSoundEnabled((prev) => !prev)}
            onToggleShake={() => setScreenShakeEnabled((prev) => !prev)}
            onClose={() => {
              setShowMenu(false);
              // The sheet gives focus back to the control that opened it, which
              // a tap may not have focused; keep the keyboard on the arena.
              window.setTimeout(
                () => containerRef.current?.focus({ preventScroll: true }),
                0
              );
            }}
          />
        )}

        {/* Accessible fallback controls. They sit off screen until a
            keyboard user tabs into them, then show as a labelled strip so
            focus never lands on something invisible (#2142). */}
        <div
          aria-label="Laser Loon Accessible Subtree"
          className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:inset-x-2 focus-within:bottom-2 focus-within:z-40 focus-within:rounded-xl focus-within:border focus-within:border-neutral-700 focus-within:bg-neutral-950/95 focus-within:p-3 font-mono text-xs text-neutral-200 [&_button]:min-h-12 [&_button]:rounded-lg [&_button]:border [&_button]:border-neutral-700 [&_button]:bg-neutral-900 [&_button]:px-3 [&_button]:text-neutral-100 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-amber-400 [&_button:disabled]:opacity-50 [&_button[aria-pressed=true]]:border-amber-500 [&_legend]:mb-2 [&_legend]:text-neutral-400"
        >
          <fieldset>
            <legend>Laser Loon Game State and Controls</legend>
            <p className="mb-2 text-neutral-400">
              Keyboard controls. Tab past them to leave the game.
            </p>

            <div
              role="group"
              aria-label="Laser Loon Telemetry and Status"
              className="sr-only"
            >
              <output htmlFor="laser-loon-score">Score: {score}</output>
              <output htmlFor="laser-loon-highscore">
                High Score: {effectiveHighScore}
              </output>
              <output htmlFor="laser-loon-mode">
                Mode: {MODE_NAMES[mode]}
              </output>
              <output htmlFor="laser-loon-status">
                Game Status: {GAME_STATE_NAMES[gameState]}
              </output>
              <output htmlFor="laser-loon-act">
                Act: {currentActNum} of 4
              </output>
              <output htmlFor="laser-loon-combo">Combo: {combo}x</output>
              <output htmlFor="laser-loon-multiplier">
                Multiplier: {multiplier}x
              </output>
              {mode === "arcade" && (
                <output htmlFor="laser-loon-timer">
                  Time Survived: {formatRunClock(survivalSecs)}
                </output>
              )}
              <output htmlFor="laser-loon-ultimate">
                Ultimate Tremolo: {ultimateMeter}%
              </output>
              <output htmlFor="laser-loon-weapon">
                Selected Optics: {WEAPONS[laserType]?.name || laserType}
              </output>
              {bossActive && (
                <output htmlFor="laser-loon-boss">
                  Boss {bossName}: {Math.max(0, Math.ceil(bossHp))} /{" "}
                  {bossMaxHp} HP
                </output>
              )}
            </div>

            <div
              role="group"
              aria-label="Laser Loon Interactive Controls"
              className="flex flex-wrap gap-1.5"
            >
              <button
                type="button"
                onClick={startGame}
                disabled={gameState === "playing"}
              >
                Start Game
              </button>

              <button
                type="button"
                onClick={() => chooseMode("campaign")}
                aria-pressed={mode === "campaign"}
              >
                Campaign Mode
              </button>
              <button
                type="button"
                onClick={() => chooseMode("arcade")}
                aria-pressed={mode === "arcade"}
              >
                Arcade Mode
              </button>
              <button
                type="button"
                onClick={() => chooseMode("sandbox")}
                aria-pressed={mode === "sandbox"}
              >
                Sandbox Mode
              </button>

              <button
                type="button"
                onClick={() => selectLaserType("ruby-laser")}
                aria-pressed={laserType === "ruby-laser"}
              >
                Optics: Ruby Laser
              </button>
              <button
                type="button"
                onClick={() => selectLaserType("cyan-pulse")}
                aria-pressed={laserType === "cyan-pulse"}
              >
                Optics: Cyan Pulse
              </button>
              <button
                type="button"
                onClick={() => selectLaserType("aurora-wave")}
                aria-pressed={laserType === "aurora-wave"}
              >
                Optics: Aurora Wave
              </button>
              <button
                type="button"
                onClick={() => selectLaserType("ice-cannon")}
                aria-pressed={laserType === "ice-cannon"}
              >
                Optics: Cryo-Mortar
              </button>

              <button
                type="button"
                onClick={() => {
                  isFiringRef.current = true;
                  fireWeapon();
                  announce("Laser weapon fired.", "polite");
                }}
              >
                Fire Weapon
              </button>

              <button
                type="button"
                onClick={fireUltimateTremolo}
                disabled={ultimateMeter < 100 && mode !== "sandbox"}
              >
                Trigger Loon Tremolo
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextY = Math.max(
                    LOON_MIN_Y,
                    loonPosRef.current.targetY - 25
                  );
                  loonPosRef.current.targetY = nextY;
                  announce(
                    `Moved Loon Up to Y position ${Math.round(nextY)}`,
                    "polite"
                  );
                }}
              >
                Move Loon Up
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextY = Math.min(
                    LOON_MAX_Y,
                    loonPosRef.current.targetY + 25
                  );
                  loonPosRef.current.targetY = nextY;
                  announce(
                    `Moved Loon Down to Y position ${Math.round(nextY)}`,
                    "polite"
                  );
                }}
              >
                Move Loon Down
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextX = Math.max(
                    LOON_MIN_X,
                    loonPosRef.current.targetX - 25
                  );
                  loonPosRef.current.targetX = nextX;
                  announce(
                    `Moved Loon Left to X position ${Math.round(nextX)}`,
                    "polite"
                  );
                }}
              >
                Move Loon Left
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextX = Math.min(
                    LOON_MAX_X,
                    loonPosRef.current.targetX + 25
                  );
                  loonPosRef.current.targetX = nextX;
                  announce(
                    `Moved Loon Right to X position ${Math.round(nextX)}`,
                    "polite"
                  );
                }}
              >
                Move Loon Right
              </button>

              {mode === "sandbox" && (
                <label htmlFor="laser-loon-gravity-input">
                  Sandbox Gravity Setting
                  <input
                    id="laser-loon-gravity-input"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={gravity}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setGravity(val);
                      announce(`Sandbox gravity adjusted to ${val}`, "polite");
                    }}
                  />
                </label>
              )}
            </div>
          </fieldset>
        </div>

        {/* Start Overlay Screen */}
        {gameState === "idle" && (
          <div className="arcade-shooter-start absolute inset-0 bg-neutral-950/85 z-30 flex flex-col items-center text-center p-3 select-none overflow-y-auto">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-3 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.3)] animate-pulse">
              <IconTarget className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-neutral-100 font-mono tracking-tight mb-2">
              {MODE_TITLES[mode].heading}
            </h3>
            <p className="text-xs text-neutral-400 max-w-md mb-6 leading-relaxed">
              {mode === "campaign" ? (
                <>
                  Pilot submission{" "}
                  <span className="text-red-400 font-bold">
                    F277 Laser Loon
                  </span>{" "}
                  across Lake Minnetonka, the State Fair, and Legislative
                  Hearings to claim glory on the State Capitol dome!
                </>
              ) : (
                MODE_TITLES[mode].blurb
              )}
            </p>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startGame();
                  containerRef.current?.focus({ preventScroll: true });
                }}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-6 py-2.5 bg-red-500 hover:bg-red-400 text-white font-mono font-bold text-sm rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all transform hover:scale-105 active:scale-95 cursor-pointer touch-manipulation select-none"
              >
                <IconPlayerPlay className="w-4 h-4 fill-current" />
                <span>
                  {MODE_TITLES[mode].start}
                  {keyTag("SPACE")}
                </span>
              </button>

              <button
                onClick={() => setShowMuseum(true)}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-amber-300 border border-amber-500/30 font-mono font-bold text-sm rounded-xl transition-all cursor-pointer touch-manipulation select-none active:scale-95"
              >
                <IconBook className="w-4 h-4" />
                <span>FLAG MUSEUM</span>
              </button>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-6 text-[10px] font-mono text-neutral-500">
              {touch ? (
                <>
                  <span>DRAG: AIM & STEER</span>
                  <span>HOLD FIRE: LASERS</span>
                  <span>OPTIC KEYS 1-4</span>
                  <span>TREMOLO: ULTIMATE</span>
                </>
              ) : (
                <>
                  <span>MOUSE / WASD: AIM & GLIDE</span>
                  <span>CLICK / DRAG / SPACE: FIRE LASERS</span>
                  <span>KEYS 1-4: OPTICS</span>
                  <span>U: LOON TREMOLO ULTIMATE</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Newspaper Story Card (Act Intro) */}
        {gameState === "act-intro" && (
          <div className="arcade-shooter-story absolute inset-0 bg-black/80 z-30 flex flex-col items-center p-3 select-none overflow-y-auto">
            {/* Act intro as a newspaper front page (#1599). */}
            <article className="loon-newsprint my-auto w-full max-w-[36rem] rounded-sm px-6 py-5 text-left shadow-2xl">
              <header className="text-center">
                <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-widest text-[#5b5346]">
                  <span>Act {currentActNum} of 4</span>
                  <span>{currentAct.location}</span>
                </div>
                <p className="loon-newsprint-masthead mt-1 border-y-[3px] border-double border-[#1c1a17] py-1 text-3xl leading-none">
                  The Loon Ledger
                </p>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#8a2c1f]">
                  {currentAct.newspaperSubheader}
                </p>
                <HeadlineTag className="loon-newsprint-headline mt-1 text-2xl sm:text-3xl leading-[1.05]">
                  {currentAct.newspaperHeadline}
                </HeadlineTag>
              </header>

              <div className="mt-4 border-t border-[#1c1a17]/40 pt-3 text-[13px] leading-snug text-[#2a2620] sm:columns-2 sm:gap-6 [&>p+p]:mt-2">
                {currentAct.storyIntro.map((paragraph, idx) => (
                  <p
                    key={idx}
                    className={
                      idx === 0
                        ? "first-letter:float-left first-letter:mr-1 first-letter:text-4xl first-letter:font-bold first-letter:leading-[0.85]"
                        : undefined
                    }
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              {/* Field guide: the optic each new enemy wants (#2052). */}
              <section
                data-testid="laser-loon-field-guide"
                aria-label="Field guide: optic each new enemy wants"
                className="mt-4 border-t border-[#1c1a17]/40 pt-3"
              >
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#8a2c1f]">
                  Field guide: new on the docket
                </p>
                <ul className="mt-1.5 grid gap-x-6 gap-y-1 text-[12px] leading-snug text-[#2a2620] sm:grid-cols-2">
                  {getActNewEnemies(currentActNum).map((type) => {
                    const enemy = ENEMY_TYPES.find((e) => e.type === type);
                    const weak = getEnemyWeakness(type);
                    if (!enemy || !weak) return null;
                    return (
                      <li
                        key={type}
                        className="flex min-w-0 items-baseline justify-between gap-2 border-b border-dotted border-[#1c1a17]/30"
                      >
                        <span className="min-w-0 truncate">{enemy.label}</span>
                        <span className="shrink-0 font-mono text-[11px] font-bold uppercase">
                          {OPTIC_SHORT_NAMES[weak]} [{WEAPONS[weak].keyNumber}]
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <div className="mt-4 flex items-center justify-between gap-4 border-t border-[#1c1a17] pt-3">
                <span className="min-w-0 font-mono text-[10px] uppercase tracking-widest text-[#5b5346]">
                  Boss sighted: {currentAct.bossName}
                  <span
                    data-testid="laser-loon-boss-hint"
                    className="mt-1 block normal-case tracking-normal"
                  >
                    {
                      BOSS_SIGNATURE_HINTS[
                        getBossSignature(currentAct.bossType)
                      ]
                    }
                  </span>
                  <span
                    data-testid="laser-loon-act-best"
                    className="mt-1 block normal-case tracking-normal"
                  >
                    {actBests[currentActNum]
                      ? `Your best: ${starString(actBests[currentActNum]!.stars)} · ${actBests[currentActNum]!.bestSeconds}s (par ${currentAct.parSeconds}s)`
                      : `Par ${currentAct.parSeconds}s. Beat it with no hits for 3 stars.`}
                  </span>
                </span>
                <button
                  onClick={() => startAct(currentActNum)}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-5 py-2 rounded-sm bg-[#1c1a17] hover:bg-[#35302a] text-[#f3ecd9] font-mono font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors active:scale-[0.98] touch-manipulation select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a2c1f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3ecd9]"
                >
                  <span>Engage stage{keyTag("Space")}</span>
                  <IconChevronRight className="w-4 h-4" />
                </button>
              </div>
            </article>
          </div>
        )}

        {/* End-of-round cards share the Arcade Kit ResultCard (#1599). */}
        {gameState === "act-victory" && (
          <ResultCard
            title={`Act ${currentActNum} cleared`}
            stamp="Cleared"
            verdict="win"
            message={`"${currentAct.victoryQuote}"`}
            stats={[
              { label: "Act score", value: actResult?.actScore ?? 0 },
              { label: "Run total", value: score },
              {
                label: `Time (par ${currentAct.parSeconds}s)`,
                value: actResult?.seconds ?? 0,
                suffix: "s",
              },
            ]}
            primary={{
              label: `Advance to Act ${currentActNum + 1}${keyTag("Space")}`,
              icon: <IconChevronRight className="w-4 h-4" />,
              onClick: advanceToNextAct,
            }}
          >
            {actResult && (
              <p
                data-testid="laser-loon-act-stars"
                className="text-center font-mono text-xs text-neutral-300"
              >
                <span
                  className="mr-2 text-amber-400"
                  aria-label={`${actResult.stars} of 3 stars`}
                >
                  {"★".repeat(actResult.stars)}
                  <span className="text-neutral-600">
                    {"☆".repeat(3 - actResult.stars)}
                  </span>
                </span>
                Cleared
                {actResult.seconds <= currentAct.parSeconds
                  ? " · Beat par"
                  : " · Over par"}
                {hitsLeft >= LOON_MAX_HITS
                  ? " · No hits taken"
                  : " · Took a hit"}
                <span className="mt-1 block text-amber-300">
                  {actResult.newStars && actResult.newTime
                    ? "New best stars and time!"
                    : actResult.newStars
                      ? "New best stars!"
                      : actResult.newTime
                        ? "New best time!"
                        : `Best: ${starString(actBests[currentActNum]?.stars ?? actResult.stars)} · ${actBests[currentActNum]?.bestSeconds ?? actResult.seconds}s`}
                </span>
              </p>
            )}
          </ResultCard>
        )}

        {gameState === "act-failed" && (
          <ResultCard
            title="The loon is down"
            stamp="Down"
            verdict="loss"
            message={
              touch
                ? "Three hits and the loon splashes down. Drag to dodge, freeze enemies with the Glacial Cryo-Mortar (optic 4), and grab a Pronto Pup to shield a hit."
                : "Three hits and the loon splashes down. Dodge with W/S or the arrow keys, freeze enemies with the Glacial Cryo-Mortar [4], and grab a Pronto Pup to shield a hit."
            }
            stats={[
              { label: "Score", value: score },
              {
                label: "Act kills",
                value: Math.min(actKills, currentAct.requiredMinionKills),
                suffix: `/${currentAct.requiredMinionKills}`,
              },
              { label: "Max combo", value: maxCombo, suffix: "x" },
            ]}
            primary={{
              label: `Try Act ${currentActNum} again${keyTag("Space")}`,
              icon: <IconRefresh className="w-4 h-4" />,
              onClick: () => {
                retryAct();
                containerRef.current?.focus({ preventScroll: true });
              },
            }}
            secondary={{ label: "Quit to title", onClick: resetGame }}
          />
        )}

        {gameState === "campaign-victory" && (
          <ResultCard
            title="History made! F277 prevails"
            stamp="State flag"
            verdict="win"
            message={`"${currentAct.victoryQuote}" In this game the loon flies over the Capitol Dome. In real life, the F277 Laser Loon campaign raised over $13,500 for the Saint Paul Public Library Foundation.`}
            stats={[
              { label: "Total score", value: score },
              { label: "Max combo", value: maxCombo, suffix: "x" },
              {
                label: "Stars",
                value: countActStars(runStars),
                suffix: `/${CAMPAIGN_STAR_TOTAL}`,
              },
            ]}
            score={score}
            previousBest={runStartBest}
            primary={{
              label: `Play again${keyTag("Space")}`,
              icon: <IconRefresh className="w-4 h-4" />,
              onClick: startGame,
            }}
            secondary={{
              label: "Flag Museum",
              icon: <IconBook className="w-4 h-4" />,
              onClick: () => setShowMuseum(true),
            }}
          >
            <p
              data-testid="laser-loon-campaign-stars"
              className="font-mono text-xs text-neutral-300"
            >
              {CAMPAIGN_ACTS.map((a) => (
                <span key={a.actNumber} className="mr-3 inline-block">
                  Act {a.actNumber}{" "}
                  <span
                    className="text-amber-400"
                    aria-label={`${runStars[a.actNumber]?.stars ?? 0} of 3 stars`}
                  >
                    {starString(runStars[a.actNumber]?.stars ?? 0)}
                  </span>
                </span>
              ))}
              <span className="mt-1 block text-neutral-400">
                {countActStars(actBests) >= CAMPAIGN_STAR_TOTAL
                  ? "Every star earned. The commission is speechless."
                  : `Best ever: ${countActStars(actBests)}/${CAMPAIGN_STAR_TOTAL} stars. Beat each par with no hits for the rest.`}
              </span>
            </p>
            <MerchPrompt liveLabel="Get official Laser Loon swag at cost" />
          </ResultCard>
        )}

        {gameState === "gameover" && (
          <ResultCard
            title={`Survived ${formatRunClock(survivalSecs)}`}
            stamp={`Wave ${survivalWave.wave + 1}`}
            verdict="neutral"
            message={`The loon went down in wave ${survivalWave.wave + 1}, ${SURVIVAL_WAVE_STOPS[survivalWave.label]}. ${
              survivalWave.wave >= 3
                ? "That is the whole road to the Capitol, and then some."
                : `Last a little longer and the next wave rolls in ${SURVIVAL_WAVE_STOPS[getSurvivalWave((survivalWave.wave + 1) * SURVIVAL_WAVE_SECONDS).label]}.`
            }`}
            stats={[
              { label: "Final score", value: score },
              { label: "Flags downed", value: runKills },
              { label: "Max combo", value: maxCombo, suffix: "x" },
            ]}
            score={score}
            previousBest={runStartBest}
            primary={{
              label: `Play again${keyTag("Space")}`,
              icon: <IconRefresh className="w-4 h-4" />,
              onClick: () => {
                startGame();
                containerRef.current?.focus({ preventScroll: true });
              },
            }}
          />
        )}

        {/* Sandbox Controls Bar */}
        {mode === "sandbox" && (
          <div className="absolute bottom-3 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 p-2 bg-neutral-900/80 border border-neutral-800 rounded-2xl backdrop-blur-md pointer-events-auto">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-neutral-400">
                GRAVITY:
              </span>
              <button
                onClick={() => setGravity(0)}
                className={`min-h-[44px] min-w-[44px] px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer touch-manipulation select-none active:scale-95 flex items-center justify-center ${
                  gravity === 0
                    ? "bg-red-400 text-black"
                    : "bg-neutral-800 text-neutral-400"
                }`}
              >
                Zero-G
              </button>
              <button
                onClick={() => setGravity(0.15)}
                className={`min-h-[44px] min-w-[44px] px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer touch-manipulation select-none active:scale-95 flex items-center justify-center ${
                  gravity === 0.15
                    ? "bg-red-400 text-black"
                    : "bg-neutral-800 text-neutral-400"
                }`}
              >
                Lake
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const loon = loonPosRef.current;
                  launchIceBlock(
                    loon.x + 48,
                    loon.y - 8,
                    aimPosRef.current.x,
                    aimPosRef.current.y
                  );
                }}
                className="min-h-[44px] min-w-[44px] px-3 py-1 bg-sky-950 hover:bg-sky-900 text-sky-300 text-[10px] font-mono font-bold rounded-lg border border-sky-800/60 cursor-pointer touch-manipulation select-none active:scale-95 flex items-center justify-center"
              >
                🧊 Launch Cryo-Mortar
              </button>
              <button
                onClick={() => {
                  if (canvasRef.current) {
                    spawnTarget(DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT);
                  }
                }}
                className="min-h-[44px] min-w-[44px] px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-red-400 text-[10px] font-mono font-bold rounded-lg border border-neutral-700 cursor-pointer touch-manipulation select-none active:scale-95 flex items-center justify-center"
              >
                + Spawn Rival Flag
              </button>
              <button
                onClick={() => {
                  if (canvasRef.current) {
                    triggerBossEncounter(
                      DEFAULT_CANVAS_WIDTH,
                      DEFAULT_CANVAS_HEIGHT
                    );
                  }
                }}
                className="min-h-[44px] min-w-[44px] px-3 py-1 bg-red-950 hover:bg-red-900 text-red-300 text-[10px] font-mono font-bold rounded-lg border border-red-800/60 cursor-pointer touch-manipulation select-none active:scale-95 flex items-center justify-center"
              >
                ⚠️ Spawn Boss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile/Tablet Touch Aim & Fire Dock */}
      {touch ? (
        <div
          className="arcade-shooter-controls ll-dock-wrap"
          data-tutorial-target="controls"
        >
          <LoonTouchControls
            laserType={laserType}
            energyPercent={mode === "sandbox" ? 100 : ultimateMeter}
            tremoloReady={ultimateMeter >= 100 || mode === "sandbox"}
            live={gameState === "playing" || mode === "sandbox"}
            onSelectLaser={selectLaserType}
            onFirePress={handleDockFirePress}
            onFireRelease={handleDockFireRelease}
            onTremolo={fireUltimateTremolo}
          />
        </div>
      ) : (
        <div
          className="arcade-shooter-controls w-full max-w-3xl mt-3 flex justify-center"
          data-tutorial-target="controls"
        >
          <TwinStickAimDock
            onFirePress={() => {
              isFiringRef.current = true;
              fireWeapon();
            }}
            onFireRelease={() => {
              isFiringRef.current = false;
            }}
            onTremoloPress={fireUltimateTremolo}
            onWeaponSelect={(idx) => {
              const types: LaserType[] = [
                "ruby-laser",
                "cyan-pulse",
                "aurora-wave",
                "ice-cannon",
              ];
              if (types[idx]) selectLaserType(types[idx]);
            }}
            selectedWeapon={
              laserType === "ruby-laser"
                ? 0
                : laserType === "cyan-pulse"
                  ? 1
                  : laserType === "aurora-wave"
                    ? 2
                    : 3
            }
            weapons={[
              { id: "ruby-laser", label: "Ruby", color: "red" },
              { id: "cyan-pulse", label: "Pulse", color: "cyan" },
              { id: "aurora-wave", label: "Aurora", color: "emerald" },
              { id: "ice-cannon", label: "Cryo-Mortar", color: "amber" },
            ]}
            energyPercent={ultimateMeter}
          />
        </div>
      )}

      {/* Footer Controls & Toggles */}
      {!touch && (
        <div className="arcade-shooter-footer w-full max-w-3xl flex flex-wrap gap-2 justify-between items-center px-4 mt-2 text-[10px] font-mono text-neutral-500">
          <span>
            Controls: WASD or arrows to fly · Mouse to aim and fire, or Space to
            fire at an enemy in line ahead · 1-4 Optics · U Tremolo · P or Esc
            to pause
          </span>
          <div className="flex items-center gap-4">
            {(gameState === "playing" || isPaused) && (
              <button
                type="button"
                onClick={togglePause}
                aria-label={isPaused ? "Resume Game" : "Pause Game"}
                className="min-h-[44px] min-w-[44px] px-3 py-1 rounded-full bg-neutral-900/90 border border-neutral-800 hover:border-red-500/50 text-neutral-200 hover:text-red-400 font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer touch-manipulation select-none active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none"
              >
                {isPaused ? (
                  <IconPlayerPlay className="w-3.5 h-3.5 fill-current text-red-400" />
                ) : (
                  <IconPlayerPause className="w-3.5 h-3.5 text-red-400" />
                )}
                <span>{isPaused ? "Resume" : "Pause"} [P]</span>
              </button>
            )}
            <button
              onClick={() => setSoundEnabled((prev) => !prev)}
              className="min-h-[44px] min-w-[44px] px-2 py-1 hover:text-neutral-300 transition-colors cursor-pointer flex items-center justify-center gap-1 touch-manipulation select-none active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none rounded-lg"
            >
              {soundEnabled ? (
                <IconVolume className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <IconVolumeOff className="w-3.5 h-3.5" />
              )}
              Audio: {soundEnabled ? "ON" : "MUTED"}
            </button>
            <button
              onClick={() => setScreenShakeEnabled((prev) => !prev)}
              className="min-h-[44px] min-w-[44px] px-2 py-1 hover:text-neutral-300 transition-colors cursor-pointer flex items-center justify-center gap-1 touch-manipulation select-none active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none rounded-lg"
            >
              Screen Shake: {screenShakeEnabled ? "ON" : "OFF"}
            </button>
          </div>
        </div>
      )}

      {/* Flag Museum & Lore Modal */}
      {showMuseum && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            ref={museumTrapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="laser-loon-museum-title"
            className={`bg-neutral-950 border border-neutral-800 rounded-3xl max-w-2xl w-full p-6 relative shadow-2xl overflow-y-auto max-h-[90vh]${
              touch ? " ll-museum-card" : ""
            }`}
          >
            <button
              onClick={() => setShowMuseum(false)}
              aria-label="Close Flag Museum"
              className={`absolute top-5 right-5 min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer touch-manipulation select-none active:scale-95${
                touch ? " ll-museum-close" : ""
              }`}
            >
              <IconX className="w-5 h-5" />
            </button>

            <div
              className={`flex items-center gap-3 mb-6${touch ? " pr-14" : ""}`}
            >
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
                <IconBook className="w-6 h-6" />
              </div>
              <div>
                <h3
                  id="laser-loon-museum-title"
                  className="text-xl font-bold font-mono text-white"
                >
                  Minnesota Flag Redesign Museum
                </h3>
                <p className="text-xs text-neutral-400 font-mono">
                  Historical artifacts, viral submissions, and the F277 Laser
                  Loon legend.
                </p>
              </div>
            </div>

            {/* Flag Selector Carousel */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {FLAG_MUSEUM.map((entry, idx) => (
                <button
                  key={entry.id}
                  onClick={() => setSelectedFlagIndex(idx)}
                  aria-pressed={selectedFlagIndex === idx}
                  className={`min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl text-xs font-mono font-bold whitespace-nowrap cursor-pointer transition-all touch-manipulation select-none active:scale-95 flex items-center justify-center ${
                    selectedFlagIndex === idx
                      ? "bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                      : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
                  }`}
                >
                  {entry.submissionCode}
                </button>
              ))}
            </div>

            {/* Selected Flag Details */}
            {(() => {
              const flag = FLAG_MUSEUM[selectedFlagIndex];
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                    <div>
                      <h4 className="text-lg font-bold text-white font-mono">
                        {flag.name}
                      </h4>
                      <p className="text-xs text-neutral-400">
                        Created by:{" "}
                        <span className="text-neutral-200">{flag.creator}</span>
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      {flag.category}
                    </span>
                  </div>

                  {/* Flag Color Palette Swatches */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-neutral-400">
                      Color Palette:
                    </span>
                    <div className="flex gap-1.5">
                      {flag.flagColors.map((col, i) => (
                        <div
                          key={i}
                          className="w-5 h-5 rounded-md border border-white/20 shadow-sm"
                          style={{ backgroundColor: col }}
                          title={col}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-4 space-y-3 font-mono text-xs">
                    <div>
                      <span className="text-red-400 font-bold block mb-1">
                        Design Overview:
                      </span>
                      <p className="text-neutral-300 leading-relaxed">
                        {flag.description}
                      </p>
                    </div>
                    <div>
                      <span className="text-amber-400 font-bold block mb-1">
                        Historical Significance:
                      </span>
                      <p className="text-neutral-300 leading-relaxed">
                        {flag.historicalSignificance}
                      </p>
                    </div>
                    <div>
                      <span className="text-emerald-400 font-bold block mb-1">
                        Civic Impact:
                      </span>
                      <p className="text-neutral-300 leading-relaxed">
                        {flag.civicImpact}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
