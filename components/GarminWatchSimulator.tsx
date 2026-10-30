"use client";

import React from "react";
import { IconPlayerPlay } from "@tabler/icons-react";
import { ResultCard } from "@/components/arcade/ResultCard";
import {
  WatchGlass,
  WatchHardware,
} from "@/components/garmin-watch/WatchHardware";
import { CompanionPanel } from "@/components/garmin-watch/CompanionPanel";
import { TrainingPlanPanel } from "@/components/garmin-watch/TrainingPlanPanel";
import { BadgeCasePanel } from "@/components/garmin-watch/BadgeCasePanel";
import { badgeToast } from "@/lib/garmin/badges";
import { planScreenLabel } from "@/components/garmin-watch/plan-face-art";
import {} from "@/components/garmin-watch/useTrainingPlan";
import {
  pusherAnchorPercent,
  screenBoxPercent,
} from "@/components/garmin-watch/watch-geometry";
import { FullscreenButton } from "@/components/arcade/FullscreenButton";
import { DynamicTabletOrientationHint as TabletOrientationHint } from "@/components/arcade/DynamicTabletOrientationHint";
import {
  formatClock,
  formatDelta,
  formatPace,
  isNegativeSplit,
  paceSecondsPerKm,
  type GarminBests,
} from "@/lib/garmin/splits";
import {
  COACH_SATURDAY_MS,
  RACE_CATEGORY_INFO,
  RACE_COURSE_NAMES,
  formatRaceTime,
  judgeRace,
  raceOutcomeOf,
  type RaceSetup,
} from "@/lib/garmin/race";
import { loadBoard } from "@/lib/garmin/race-store";
import { formatGap } from "@/lib/garmin/ghost";
import {} from "@/lib/garmin/ghost-store";
import { BezelClusterDock } from "@/components/arcade/ControlDocks";
import { useCabinetTouch } from "@/components/arcade/mobile";
import { GarminTouchDock } from "@/components/garmin-watch/GarminTouchDock";
import "@/components/garmin-watch/garmin-touch.css";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { CANVAS_SIZE, GameEngineState, paceMeters } from "@/lib/garmin/engine";
import {
  courseReadout,
  POWER_NAMES,
  type RaceReport,
  splitsKeyOf,
  stageLabel,
  useMonkeyCSession,
} from "@/components/garmin-watch/useMonkeyCSession";

/** Where the canvas sits over the watch's round screen. */
const SCREEN_BOX = screenBoxPercent();

// The screen-reader button row: off screen until one of its buttons takes
// keyboard focus, then a visible row under the watch (#2129).
const WATCH_BUTTON_ROW = [
  "sr-only focus-within:not-sr-only",
  "focus-within:mx-auto focus-within:mt-4 focus-within:flex focus-within:max-w-3xl focus-within:flex-wrap focus-within:justify-center focus-within:gap-2",
  "focus-within:rounded-xl focus-within:border focus-within:border-white/[0.08] focus-within:bg-[#13151a] focus-within:p-3",
  "[&_button]:min-h-11 [&_button]:rounded-lg [&_button]:border [&_button]:border-zinc-700 [&_button]:bg-[#0d0e11] [&_button]:px-3",
  "[&_button]:font-mono [&_button]:text-[11px] [&_button]:text-zinc-200 [&_button]:active:scale-[0.98]",
  "[&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-amber-400",
  "[&_button:disabled]:opacity-50",
].join(" ");

interface GarminWatchSimulatorProps {
  /**
   * Test/debug seam only: seeds both stateRef and gameState with this exact
   * state at mount instead of a fresh createInitialState() call. Lets a
   * real-component + real-engine test drive straight to a specific (e.g.
   * mid-run) state without simulating a full playthrough or mocking the
   * engine module (#685). Not used by any production caller.
   */
  initialState?: GameEngineState;
}

/**
 * The run clock on the result card: finish time (or Time when unfinished),
 * average pace, the splits table against the previous bests, and the negative
 * split and new best notes.
 */
/**
 * The race report under a finished race's card (#2019): the verdict, the
 * splits and best lap, the time bonked, this device's board with the new place,
 * PR or CR, and a Share button.
 */
function RaceReportCard({
  setup,
  state,
  report,
  shareNote,
  onShare,
}: {
  setup: RaceSetup;
  state: GameEngineState;
  report: RaceReport | null;
  shareNote: { text: string; copied: boolean } | null;
  onShare: () => void;
}) {
  const outcome = raceOutcomeOf(state);
  const verdict = judgeRace(setup.category, outcome);
  const splits = outcome.lapSplits;
  const bestLap = splits.length > 0 ? Math.min(...splits) : null;
  const bonkedS = Math.round((state.bonkedMs ?? 0) / 1000);
  const board =
    report?.board ?? loadBoard(setup.course, setup.category, setup.seed);
  const verdictText =
    verdict.result === "time"
      ? formatRaceTime(outcome.timeMs)
      : `${verdict.result.toUpperCase()} · ${verdict.reason}`;
  return (
    <section
      aria-label="Race report"
      className="mt-4 min-w-0 border-t border-white/10 pt-3 font-mono text-[11px] tabular-nums text-zinc-300"
    >
      <p className="text-[10px] uppercase tracking-wider text-zinc-400">
        {RACE_COURSE_NAMES[setup.course]} ·{" "}
        {RACE_CATEGORY_INFO[setup.category].name}
      </p>
      <p className="mt-1 text-base font-bold text-zinc-50">{verdictText}</p>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
        <dt className="text-zinc-400">Best lap</dt>
        <dd>{bestLap === null ? "None" : formatRaceTime(bestLap)}</dd>
        <dt className="text-zinc-400">Bonked</dt>
        <dd>{bonkedS} s</dd>
        {setup.course === "saturday5k" && (
          <>
            <dt className="text-zinc-400">Coach</dt>
            <dd>
              {formatRaceTime(COACH_SATURDAY_MS)}
              {verdict.result === "time" &&
                (outcome.timeMs < COACH_SATURDAY_MS
                  ? " · you beat the coach"
                  : ` · ${formatGap(outcome.timeMs - COACH_SATURDAY_MS)} behind`)}
            </dd>
          </>
        )}
        {report && report.partnerMs !== null && (
          <>
            <dt className="text-zinc-400">Virtual Partner</dt>
            <dd>
              {formatGap(report.partnerMs)}{" "}
              {report.partnerMs < 0 ? "ahead" : "behind"}
            </dd>
          </>
        )}
        <dt className="text-zinc-400">Laps</dt>
        <dd className="min-w-0 break-words">
          {splits.length > 0
            ? splits.map((ms) => formatRaceTime(ms)).join(" · ")
            : "None yet"}
        </dd>
      </dl>
      {report && verdict.result === "time" && (
        <p className="mt-2 text-zinc-100">
          {report.place > 0
            ? `Place ${report.place} on this board${report.record ? ` · ${report.record}` : ""}`
            : "Off the board: the top five are kept"}
        </p>
      )}
      <ol aria-label="This device's board" className="mt-2 grid gap-0.5">
        {board.length === 0 && <li className="text-zinc-400">No times yet</li>}
        {board.map((entry, i) => (
          <li
            key={`${entry.at}-${entry.timeMs}`}
            aria-current={report?.place === i + 1 ? "true" : undefined}
            className={
              report?.place === i + 1 ? "text-amber-200" : "text-zinc-400"
            }
          >
            {i + 1}. {formatRaceTime(entry.timeMs)}
          </li>
        ))}
      </ol>
      {report && (
        <div className="mt-3">
          <button
            type="button"
            onClick={onShare}
            className="min-h-11 w-full rounded-lg border border-white/[0.08] bg-[#0d0e11] px-3 py-2 text-left text-[11px] text-zinc-200 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
          >
            Share result
          </button>
          {shareNote && (
            <p
              className="mt-2 break-words text-[11px] text-zinc-300"
              role="status"
            >
              {shareNote.copied
                ? "Copied to the clipboard."
                : `Copy this result: ${shareNote.text}`}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function RunSplitsSummary({
  state,
  previous,
}: {
  state: GameEngineState;
  previous: GarminBests;
}) {
  const finished = state.gameState === "summary";
  const clockMs = state.runClockMs ?? 0;
  const splits = state.lapSplits ?? [];
  const pace = formatPace(paceSecondsPerKm(clockMs, paceMeters(state)));
  const newBest =
    finished && previous.totalMs !== undefined && clockMs < previous.totalMs;
  return (
    <section
      aria-label="Run clock"
      className="mt-4 min-w-0 border-t border-white/10 pt-3 font-mono text-[11px] tabular-nums text-zinc-300"
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        <dt className="text-zinc-400">{finished ? "Finish time" : "Time"}</dt>
        <dd className="text-right text-zinc-100">{formatClock(clockMs)}</dd>
        <dt className="text-zinc-400">Average pace</dt>
        <dd className="text-right text-zinc-100">{pace}</dd>
      </dl>
      {newBest && <p className="mt-2 text-emerald-400">New best time</p>}
      {splits.length > 0 && (
        <table className="mt-3 w-full min-w-0 text-left">
          <caption className="mb-1 text-left text-zinc-400">
            Splits per km
          </caption>
          <thead>
            <tr>
              <th scope="col" className="font-medium text-zinc-400">
                Lap
              </th>
              <th scope="col" className="font-medium text-zinc-400">
                Split
              </th>
              <th scope="col" className="text-right font-medium text-zinc-400">
                vs best
              </th>
            </tr>
          </thead>
          <tbody>
            {splits.map((split, lap) => (
              <tr key={lap}>
                <th scope="row" className="font-normal text-zinc-400">
                  {lap + 1}
                </th>
                <td>{formatClock(split)}</td>
                <td className="text-right">
                  {formatDelta(split, previous.splits[lap]) || "--"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {isNegativeSplit(splits) && (
        <p className="mt-2 text-zinc-200">
          Negative split: every km faster than the last.
        </p>
      )}
    </section>
  );
}

export const GarminWatchSimulator: React.FC<GarminWatchSimulatorProps> = ({
  initialState,
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  // The immersive touch cabinet (ADR 0061, #2122): the watch, a touch dock
  // and the companion panel share the viewport. Desktop never sets it.
  const touchCabinet = useCabinetTouch();
  const {
    a11yAction,
    a11yBack,
    a11yDown,
    a11yJettison,
    a11yJump,
    a11yLight,
    a11yReadTelemetry,
    a11yStartStop,
    alertMessage,
    alertState,
    announce,
    badgeFresh,
    badgeSave,
    bezelTheme,
    canvasRef,
    containerRef,
    crashType,
    currentProfile,
    devMode,
    deviceTarget,
    dockMode,
    effectiveHighScore,
    endMessage,
    endStats,
    endTitle,
    fitnessView,
    fxFlashRef,
    fxStageRef,
    gameState,
    ghostOn,
    ghostTarget,
    groundStrip,
    handleBack,
    handleCanvasPointerCancel,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
    handleClearFlash,
    handleDockKey,
    handleDrainBattery,
    handleExportCsv,
    handleExportFit,
    handleGroundStripReset,
    handleGroundStripSlot,
    handleJettison,
    handleJump,
    handleJumpRelease,
    handleKeyDown,
    handleKeyUp,
    handlePusherClick,
    handleRunInput,
    handleSaveFlash,
    handleSelectDevice,
    handleSetGhostOn,
    handleSetGhostTarget,
    handleSetRaceCategory,
    handleSetRaceCourse,
    handleSetRunMode,
    handleShareRace,
    handleStartStop,
    handleToggleDevMode,
    handleToggleLight,
    handleWipeFog,
    isFocused,
    isFullscreen,
    outerContainerRef,
    plan,
    planMode,
    pushers,
    raceCategory,
    raceCourse,
    raceMode,
    raceReport,
    raceVerdict,
    rebootFromCard,
    recordEvent,
    resultDismissed,
    returnFocusAfterPointerClick,
    runEnded,
    runLive,
    runRecord,
    runStartBest,
    setBezelTheme,
    setIsFocused,
    setResultDismissed,
    setupCrt,
    shareNote,
    startAction,
    telemetryCount,
    toggleFullscreen,
  } = useMonkeyCSession({
    initialState,
    prefersReducedMotion,
  });

  return (
    <div
      ref={outerContainerRef}
      data-game-fullscreen={isFullscreen}
      className={`garmin-sim w-full select-none @container ${
        touchCabinet
          ? "garmin-touch"
          : isFullscreen
            ? "fixed inset-0 z-50 h-[100dvh] max-h-[100dvh] max-w-none overflow-y-auto overflow-x-hidden bg-black p-3 sm:p-6 touch-none"
            : "px-3 py-5 sm:px-4"
      }`}
    >
      {/* The touch cabinet's toolbar owns Fullscreen, and a tablet is never
          asked to turn (ADR 0061). */}
      {!touchCabinet && (
        <>
          <FullscreenButton
            isFullscreen={isFullscreen}
            onToggle={toggleFullscreen}
            variant="floating"
          />

          {/* Tablet Orientation Recommendation */}
          <TabletOrientationHint className="mx-auto mb-3 w-full max-w-md" />
        </>
      )}

      <div className="garmin-layout mx-auto grid w-full max-w-6xl gap-5 @3xl:grid-cols-[minmax(0,1fr)_18rem] @5xl:grid-cols-[minmax(0,1fr)_21rem] @3xl:items-start">
        <div className="garmin-play flex min-w-0 flex-col items-center">
          {/* Watch: keyboard boundary around the hardware render. */}
          <div
            ref={containerRef}
            tabIndex={0}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              // Held keys can't report their release once focus is gone.
              handleJumpRelease();
              handleRunInput(0);
            }}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            data-keyboard-boundary="true"
            // A run takes Escape for itself (it pauses and resumes), so the
            // touch cabinet's Escape does not also leave the game (#2122).
            data-escape-docks={touchCabinet && runLive ? "true" : undefined}
            className="garmin-chassis relative w-full px-12 outline-none select-none"
          >
            {/* Visible copy of the latest in-run alert; screen readers get
                the role="alert" region below instead. The end of a run has
                its own face and result card. */}
            {alertState.text &&
              alertState.n > 0 &&
              (gameState.gameState === "playing" ||
                gameState.gameState === "paused") && (
                <div
                  key={alertState.n}
                  aria-hidden="true"
                  data-testid="garmin-alert-toast"
                  className="garmin-alert-toast pointer-events-none absolute left-1/2 top-0 z-40 max-w-[18rem] -translate-x-1/2 rounded-md border border-amber-500/40 bg-zinc-950/95 px-3 py-1.5 text-center font-mono text-[11px] leading-snug text-amber-300"
                >
                  {alertState.text}
                </div>
              )}
            <div
              ref={fxStageRef}
              className="garmin-watch-frame relative mx-auto aspect-[520/580]"
            >
              <WatchHardware
                theme={bezelTheme}
                model={currentProfile.name}
                focused={isFocused}
              />

              {/* Round screen: the canvas fills it at device resolution. */}
              <div
                data-testid="garmin-screen"
                className="absolute isolate overflow-hidden rounded-full bg-black"
                style={{
                  left: `${SCREEN_BOX.left}%`,
                  top: `${SCREEN_BOX.top}%`,
                  width: `${SCREEN_BOX.width}%`,
                  height: `${SCREEN_BOX.height}%`,
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={CANVAS_SIZE}
                  height={CANVAS_SIZE}
                  role="img"
                  aria-label={
                    planMode &&
                    plan.save &&
                    gameState.gameState !== "playing" &&
                    gameState.gameState !== "paused"
                      ? `Smartwatch display simulator. ${planScreenLabel(plan.save, plan.screen)}`
                      : `Smartwatch display simulator. Status: ${gameState.gameState}. ${stageLabel(gameState)}, lives ${gameState.lives ?? 1}${(gameState.power ?? "base") === "base" ? "" : `, ${POWER_NAMES[gameState.power ?? "base"]}`}. Score: ${
                          gameState.score
                        }, High Score: ${effectiveHighScore}.${courseReadout(gameState)} ${
                          fitnessView
                            ? `Body Battery: ${Math.round(gameState.bodyBattery?.value ?? 100)}.`
                            : `Memory: ${gameState.allocatedRamKb.toFixed(
                                1
                              )} of ${currentProfile.ramLimitKb} KB. Battery: ${Math.round(
                                gameState.battery
                              )}%. Condensation: ${Math.round(gameState.fogLevel * 100)}%.`
                        }`
                  }
                  onPointerDown={handleCanvasPointerDown}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerCancel={handleCanvasPointerCancel}
                  className="block h-full w-full cursor-crosshair touch-none rounded-full"
                />

                {/* Event flash for crashes (useArcadeFx). */}
                <div
                  ref={fxFlashRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-10 rounded-full opacity-0"
                />

                {/* CRT filter chosen in Pre-Game Setup (static, never animated) */}
                {setupCrt !== "off" && (
                  <div
                    aria-hidden="true"
                    data-testid="garmin-crt-overlay"
                    data-garmin-crt={setupCrt}
                    className="garmin-crt pointer-events-none absolute inset-0 z-20 rounded-full"
                  />
                )}

                {/* Idle start card. The canvas draws no text while idle, so
                    nothing shows through behind it. */}
                {gameState.gameState === "idle" && !planMode && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/65 px-[14%] text-center font-mono">
                    <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-cyan-300">
                      Monkey C Mayhem
                    </span>
                    <span className="mt-1 text-[11px] font-bold text-amber-300">
                      {fitnessView
                        ? "5K · 5 STAGES · BODY BATTERY"
                        : `5K · 5 STAGES · ${currentProfile.ramLimitKb} KB RAM`}
                    </span>
                    <p className="mt-2 max-w-[15rem] text-[11px] leading-snug text-zinc-300">
                      {fitnessView
                        ? "▲ / Space jump (hold for higher) · ◀ ▶ pace. Stomp Couch Potatoes, bump Sync Blocks for power-ups, mind the gaps, keep your Body Battery up. Three lives."
                        : "▲ / Space jump (hold for higher) · ◀ ▶ pace. Stomp bugs, bump Sync Blocks for power-ups, mind the gaps, keep the heap in budget. Three lives."}
                    </p>
                    <button
                      type="button"
                      onClick={handleStartStop}
                      className="arcade-launch-button mt-3 flex min-h-[36px] items-center gap-1.5 rounded-full border border-cyan-300 bg-cyan-400 px-4 text-[11px] font-bold text-zinc-950 transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      <IconPlayerPlay
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      START SIMULATION
                    </button>
                  </div>
                )}

                {/* Overheat fog quick wipe */}
                {gameState.fogLevel > 0.35 &&
                  gameState.gameState === "playing" && (
                    <button
                      type="button"
                      onClick={() => handleWipeFog()}
                      className="absolute right-[20%] top-[24%] z-30 rounded-full border border-amber-300 bg-amber-500 px-2.5 py-1 font-mono text-[10px] font-bold text-black active:scale-[0.98]"
                    >
                      WIPE [W]
                    </button>
                  )}
              </div>

              <WatchGlass />

              {/* Pushers: real buttons over the drawn ones, captioned outward. */}
              {pushers.map((pusher) => {
                const anchor = pusherAnchorPercent(pusher.id);
                const left = anchor.side === "left";
                return (
                  <button
                    key={pusher.id}
                    type="button"
                    onClick={(e) => handlePusherClick(pusher.id, e)}
                    title={pusher.title}
                    aria-label={pusher.ariaLabel}
                    data-pusher={pusher.id}
                    className={`group absolute flex -translate-y-1/2 items-center gap-1.5 rounded-md font-mono leading-none active:scale-[0.98] focus-visible:outline-none ${
                      left ? "flex-row-reverse" : ""
                    }`}
                    style={
                      left
                        ? {
                            right: `calc(${100 - anchor.x}% - 14px)`,
                            top: `${anchor.y}%`,
                          }
                        : {
                            left: `calc(${anchor.x}% - 14px)`,
                            top: `${anchor.y}%`,
                          }
                    }
                  >
                    <span
                      aria-hidden="true"
                      className="block h-7 w-7 rounded-md transition-colors group-hover:bg-white/10 group-focus-visible:ring-2 group-focus-visible:ring-cyan-300/80"
                    />
                    <span
                      className={`flex flex-col gap-0.5 ${left ? "items-end" : "items-start"}`}
                    >
                      <span className="text-[10px] font-bold tracking-wider text-zinc-300 group-hover:text-zinc-50">
                        {pusher.label}
                      </span>
                      <span className="text-[9px] text-zinc-400">
                        {pusher.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {touchCabinet ? (
            // The touch cabinet's dock: hold to jog, sprint and jump (#2122).
            <GarminTouchDock
              mode={dockMode}
              startAction={startAction}
              onKey={handleDockKey}
            />
          ) : (
            /* Touch devices get the bezel pushers as a dock as well. */
            <div className="mt-4 hidden w-full max-w-xl justify-center [@media(hover:none)]:flex">
              <BezelClusterDock
                onButtonPress={(btn) => {
                  if (btn === "light") handleToggleLight();
                  else if (btn === "up") handleJump();
                  else if (btn === "down") handleJettison();
                  else if (btn === "start") handleStartStop();
                  else if (btn === "back") handleBack();
                }}
              />
            </div>
          )}
        </div>

        <CompanionPanel
          state={gameState}
          deviceTarget={deviceTarget}
          bezelTheme={bezelTheme}
          highScore={effectiveHighScore}
          isFocused={isFocused}
          isFullscreen={isFullscreen}
          onToggleFullscreen={touchCabinet ? undefined : toggleFullscreen}
          onSelectDevice={(target, e) => {
            handleSelectDevice(target);
            returnFocusAfterPointerClick(e);
          }}
          onSelectTheme={(theme, e) => {
            setBezelTheme(theme);
            returnFocusAfterPointerClick(e);
          }}
          onWriteFlash={(e) => {
            handleSaveFlash();
            returnFocusAfterPointerClick(e);
          }}
          onClearFlash={(e) => {
            handleClearFlash();
            returnFocusAfterPointerClick(e);
          }}
          telemetryCount={telemetryCount}
          onExportCsv={handleExportCsv}
          onExportFit={handleExportFit}
          groundStrip={groundStrip}
          onGroundStripSlot={handleGroundStripSlot}
          onGroundStripReset={handleGroundStripReset}
          onDrainBattery={(e) => {
            handleDrainBattery();
            returnFocusAfterPointerClick(e);
          }}
          devMode={devMode}
          fitnessView={fitnessView}
          onToggleDevMode={(e) => {
            handleToggleDevMode();
            returnFocusAfterPointerClick(e);
          }}
          raceMode={raceMode}
          planMode={planMode}
          raceCourse={raceCourse}
          raceCategory={raceCategory}
          raceLocked={
            gameState.gameState === "playing" ||
            gameState.gameState === "paused"
          }
          onSetRunMode={handleSetRunMode}
          onSetRaceCourse={handleSetRaceCourse}
          onSetRaceCategory={handleSetRaceCategory}
          onRunChoicePick={returnFocusAfterPointerClick}
          ghostOn={ghostOn}
          ghostTarget={ghostTarget}
          onSetGhostOn={handleSetGhostOn}
          onSetGhostTarget={handleSetGhostTarget}
          badgePanel={<BadgeCasePanel save={badgeSave} fresh={badgeFresh} />}
          planPanel={
            <TrainingPlanPanel
              save={plan.save}
              locked={
                gameState.gameState === "playing" ||
                gameState.gameState === "paused"
              }
              onChoose={(id) => {
                plan.choose(id);
                containerRef.current?.focus({ preventScroll: true });
              }}
              onNewPlan={plan.startNew}
              bagOpen={plan.bagOpen}
              onOpenBag={plan.openBag}
              onCloseBag={plan.closeBag}
              onUseItem={plan.applyItem}
              onUnpackItem={plan.unpackItem}
            />
          }
        >
          {runEnded &&
            !resultDismissed &&
            (!gameState.plan || plan.screen.kind === "result") && (
              <ResultCard
                key={`${gameState.gameState}-${crashType}`}
                title={endTitle}
                stamp={
                  gameState.gameState === "shutdown"
                    ? "Power loss"
                    : gameState.gameState === "crashed"
                      ? fitnessView
                        ? "DNF"
                        : "Crashed"
                      : "Finished"
                }
                verdict={
                  raceVerdict
                    ? raceVerdict.result === "time"
                      ? "win"
                      : "loss"
                    : gameState.gameState === "summary"
                      ? "win"
                      : "loss"
                }
                preventScroll
                message={endMessage}
                stats={endStats}
                score={gameState.score}
                previousBest={runStartBest}
                primary={
                  gameState.plan
                    ? {
                        label: "Back to training",
                        icon: (
                          <IconPlayerPlay
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        ),
                        onClick: () => {
                          setResultDismissed(true);
                          plan.showReport();
                          containerRef.current?.focus({ preventScroll: true });
                        },
                      }
                    : {
                        label: fitnessView ? "Run Again" : "Reboot & Restart",
                        icon: (
                          <IconPlayerPlay
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        ),
                        onClick: rebootFromCard,
                      }
                }
                secondary={{
                  label: "Inspect watch",
                  onClick: () => {
                    setResultDismissed(true);
                    containerRef.current?.focus({ preventScroll: true });
                  },
                }}
              >
                {gameState.plan && plan.screen.kind === "result" && (
                  <p className="mt-3 text-[12px] text-zinc-200">
                    {plan.screen.outcome.text}
                  </p>
                )}
                {badgeFresh.length > 0 && (
                  <ul aria-label="Badges earned" className="mt-3 grid gap-1">
                    {badgeFresh.map((id) => (
                      <li
                        key={id}
                        className="rounded-md border border-amber-500/40 bg-amber-500/[0.08] px-2 py-1 font-mono text-[11px] text-amber-200"
                      >
                        {badgeToast(id)}
                      </li>
                    ))}
                  </ul>
                )}
                {gameState.race && (
                  <RaceReportCard
                    setup={gameState.race}
                    state={gameState}
                    report={raceReport}
                    shareNote={shareNote}
                    onShare={() => {
                      if (raceReport) void handleShareRace(raceReport);
                    }}
                  />
                )}
                <RunSplitsSummary
                  state={gameState}
                  previous={
                    runRecord?.key === splitsKeyOf(gameState)
                      ? runRecord.previous
                      : { splits: gameState.bestSplits ?? [] }
                  }
                />
                {/* Left out where the panel is narrow, so the card and its
                    buttons fit beside the watch (#2132). */}
                <p className="mt-4 text-[11px] text-zinc-400 @3xl:@max-5xl:hidden">
                  Shipping a real Connect IQ app?{" "}
                  <a
                    href="/schedule"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      recordEvent("garmin_simulator", "project_click")
                    }
                    className="text-zinc-300 underline underline-offset-2 hover:text-zinc-50"
                  >
                    Book Consultation
                  </a>
                </p>
              </ResultCard>
            )}
        </CompanionPanel>
      </div>
      {/* Accessible DOM fallback: the state readouts stay off screen, and
          the watch buttons show as a visible row whenever one of them has
          keyboard focus, so Tab never lands on an invisible control (#2129). */}
      <div aria-label="Garmin Watch Accessible Subtree">
        <fieldset>
          <legend className="sr-only">
            Garmin Watch Embedded Simulator State and Physical Controls
          </legend>

          <div
            role="group"
            aria-label="Garmin Simulator Telemetry and Status"
            className="sr-only"
          >
            <output aria-live="off" htmlFor="garmin-state">
              State: {gameState.gameState}
            </output>
            <output aria-live="off" htmlFor="garmin-stage">
              {stageLabel(gameState)}
            </output>
            <output aria-live="off" htmlFor="garmin-score">
              Score: {gameState.score}
            </output>
            <output aria-live="off" htmlFor="garmin-highscore">
              High Score: {effectiveHighScore}
            </output>
            <output aria-live="off" htmlFor="garmin-device">
              Device Target: {currentProfile.name}
            </output>
            {/* A fitness run reads its own numbers; the firmware readouts
                only mean something on a Dev Mode run (#2240). */}
            {fitnessView ? (
              <>
                <output aria-live="off" htmlFor="garmin-body-battery">
                  Body Battery:{" "}
                  {Math.round(gameState.bodyBattery?.value ?? 100)}
                </output>
                <output aria-live="off" htmlFor="garmin-run-time">
                  Run Time: {formatClock(gameState.runClockMs ?? 0)}
                </output>
                <output aria-live="off" htmlFor="garmin-distance">
                  Distance:{" "}
                  {(Math.max(0, gameState.distanceMeters) / 1000).toFixed(2)} km
                </output>
                <output aria-live="off" htmlFor="garmin-lives">
                  Lives: {gameState.lives ?? 1}
                </output>
                <output aria-live="off" htmlFor="garmin-kudos">
                  Kudos: {gameState.kudos ?? 0}
                </output>
              </>
            ) : (
              <>
                <output aria-live="off" htmlFor="garmin-ram">
                  RAM Memory: {gameState.allocatedRamKb.toFixed(1)} /{" "}
                  {currentProfile.ramLimitKb} KB
                </output>
                <output aria-live="off" htmlFor="garmin-battery">
                  Battery Level: {Math.round(gameState.battery)}%
                </output>
                <output aria-live="off" htmlFor="garmin-thermal">
                  Thermal Stress:{" "}
                  {Math.round((gameState.thermalStress ?? 0) * 100)}%
                </output>
                <output aria-live="off" htmlFor="garmin-fog">
                  Condensation Fog: {Math.round(gameState.fogLevel * 100)}%
                </output>
              </>
            )}
          </div>

          <div
            role="group"
            aria-label="Garmin Watch Physical Controls"
            className={WATCH_BUTTON_ROW}
          >
            <p className="w-full text-center font-mono text-[10px] uppercase tracking-wider text-zinc-400">
              Watch buttons
            </p>
            <button type="button" onClick={a11yLight}>
              LIGHT / Backlight Button
            </button>

            <button
              type="button"
              onClick={a11yJump}
              disabled={gameState.gameState !== "playing"}
            >
              UP / Jump Button
            </button>

            {fitnessView ? (
              <button
                type="button"
                onClick={a11yDown}
                disabled={gameState.gameState !== "playing"}
              >
                DOWN / Water Station or Burpee Slam Button
              </button>
            ) : (
              <button
                type="button"
                onClick={a11yJettison}
                disabled={gameState.gameState !== "playing"}
              >
                DOWN / Jettison Variable Button
              </button>
            )}

            <button type="button" onClick={a11yStartStop}>
              START / STOP Button
            </button>

            {!fitnessView && (
              <button
                type="button"
                onClick={a11yBack}
                disabled={
                  gameState.gameState !== "playing" || gameState.isGcActive
                }
              >
                BACK / Force GC Button
              </button>
            )}

            <button
              type="button"
              onClick={a11yAction}
              disabled={gameState.gameState !== "playing"}
            >
              X / Throw Heat Bolt, Cape Spin or Spin Jump Button
            </button>

            <button type="button" onClick={a11yReadTelemetry}>
              Read Telemetry
            </button>

            {!fitnessView && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    handleWipeFog();
                    announce("Wiped screen condensation fog.", "polite");
                  }}
                >
                  Wipe Screen Fog
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleSaveFlash();
                    announce(
                      "Saved variable to NVRAM flash storage.",
                      "polite"
                    );
                  }}
                >
                  Save NVRAM Flash
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleClearFlash();
                    announce("Cleared NVRAM flash storage.", "polite");
                  }}
                >
                  Clear NVRAM Flash
                </button>
              </>
            )}
          </div>
        </fieldset>
      </div>

      {/* Off-screen Live Regions for Screen Reader Telemetry & Assertive Alerts */}
      {/* Polite status changes only on run transitions; changing telemetry is
          read on demand via the Read Telemetry button (#1215). */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {`Garmin Simulator Telemetry. Status: ${gameState.gameState}.`}
      </div>

      <div
        className="sr-only"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        {alertMessage}
      </div>
    </div>
  );
};
