"use client";

import React from "react";
import {
  PRIORITIES,
  SITE_CHECKS,
  describePerson,
  type WorldState,
} from "@/lib/study-director-world";
import { type StudyState } from "@/lib/study-director";
import { safeIsAvailable, safeRawStorage } from "@/lib/safe-storage";
import { useCabinetTouch } from "@/components/arcade/mobile/CabinetTouchContext";
import "@/components/study-director/study-director-touch.css";
import {
  DigestCard,
  GuestCard,
  InterruptionCard,
  OvernightCard,
  PriorityCard,
} from "./DayCards";
import { FeedbackToasts } from "./FeedbackToasts";
import { FloorView } from "./FloorView";
import { Minimap } from "./Minimap";
import { OfficeDirectory } from "./OfficeDirectory";
import { StageLabels, TasksPanel } from "./StageLabels";
import { currentGoal } from "./stage-model";
import { SiteVisitPanel, SiteVisitReportPanel } from "./SiteVisitPanel";
import { MeetingSection, TeamOverlay } from "./TeamLayer";
import { WorldHud } from "./WorldHud";
import { useReducedMotion } from "./use-reduced-motion";
import { ConditionsPicker, LengthPicker, WorldIntro } from "./WorldIntro";
import { WorldTouchControls } from "./WorldTouchControls";
import {
  INTRO_KEY,
  useStudyDirectorWorldSession,
} from "@/components/study-director-world/useStudyDirectorWorldSession";

const SAID_TONE: Record<"neutral" | "good" | "bad", string> = {
  neutral: "border-[var(--sd-hairline-strong)] text-zinc-200",
  good: "border-[var(--sd-emerald)]/60 text-emerald-300",
  bad: "border-[var(--sd-red)]/60 text-red-300",
};

function markIntroSeen(): void {
  try {
    if (safeIsAvailable()) safeRawStorage.setItem(INTRO_KEY, "1");
  } catch {
    // Storage blocked: the help shows again next visit.
  }
}

const TONE_CLASS = {
  good: "border-[var(--sd-emerald)]/50",
  bad: "border-[var(--sd-red)]/60",
  neutral: "border-[var(--sd-hairline-strong)]",
} as const;

/**
 * Study Director's world (ADR 0055): the walkable CRO floor, a HUD and the
 * office directory. The rules live in `lib/study-director-world`; this is
 * a thin adapter that turns keys and buttons into world calls and draws the
 * result.
 */
export const StudyDirectorWorld: React.FC<{
  onExit: () => void;
  /** Hands a finished study to the classic closeout: report, verdict, share card. */
  onCloseout?: (study: StudyState, world: WorldState) => void;
  /** Called once when a new run leaves its untouched first morning (#2191). */
  onStart?: () => void;
}> = ({ onExit, onCloseout, onStart }) => {
  const reducedMotion = useReducedMotion();
  // The immersive touch cabinet (ADR 0061, #2076) lays the office out to fit
  // its stage; desktop markup is untouched.
  const touch = useCabinetTouch();
  const {
    acted,
    answer,
    away,
    cardsRef,
    chooseDifficulty,
    chooseLength,
    choosing,
    confirmDelegate,
    delegation,
    description,
    difficulty,
    digest,
    directory,
    doCheck,
    drive,
    finishRun,
    goHomeRef,
    guest,
    handOver,
    here,
    hud,
    hudNotice,
    inConference,
    interruption,
    leave,
    length,
    lookAtSelf,
    map,
    meet,
    minutesTo,
    morning,
    nextMorning,
    notice,
    onKeyDown,
    onSite,
    outcome,
    outcomeRef,
    people,
    pickPriority,
    plan,
    plates,
    playfieldRef,
    pressUse,
    prompt,
    report,
    said,
    scene,
    selfNow,
    setConfirmDelegate,
    setOutcome,
    setSharedHeld,
    setShowIntro,
    setShowMap,
    setVisitReport,
    sharedHeld,
    showIntro,
    showMap,
    stepBy,
    tapFloor,
    tasks,
    team,
    toasts,
    view,
    visitReport,
    walk,
    walkTo,
    world,
  } = useStudyDirectorWorldSession({
    onExit,
    onCloseout,
    onStart,
    touch,
  });

  const panel = report ? (
    <OvernightCard
      report={report}
      nextDay={world.study.day}
      onNextDay={nextMorning}
      onCloseout={finishRun}
      closeoutLabel={
        onCloseout ? "See the closeout" : "Switch to the classic desk"
      }
      visit={visitReport}
    />
  ) : outcome ? (
    <div className="space-y-3">
      <section
        ref={outcomeRef}
        aria-labelledby="sd-world-outcome"
        data-testid="world-outcome"
        onKeyDown={(e) => {
          // Escape closes the card from its own buttons too, as it does from
          // the floor.
          if (e.key !== "Escape" || touch) return;
          e.preventDefault();
          setOutcome(null);
          playfieldRef.current?.focus({ preventScroll: true });
        }}
        className={`scroll-mt-nav-24 border p-3 ${TONE_CLASS[outcome.tone]}`}
      >
        <h3 id="sd-world-outcome" className="text-sm font-bold">
          {outcome.title}
        </h3>
        <ul className="mt-1 space-y-1 text-xs text-zinc-200">
          {outcome.lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          {outcome.check ? (
            <button
              type="button"
              onClick={() => outcome.check && doCheck(outcome.check)}
              className="min-h-[40px] border border-[var(--sd-amber)] bg-[var(--sd-amber)]/10 px-3 text-xs font-bold text-amber-300 hover:bg-[var(--sd-amber)]/20 active:scale-[0.98]"
            >
              {SITE_CHECKS[outcome.check].label},{" "}
              {SITE_CHECKS[outcome.check].cost.minutes} minutes
            </button>
          ) : null}
          {(outcome.travel ?? []).map((option) => (
            <button
              key={option.mapId}
              type="button"
              onClick={() => drive(option)}
              className="min-h-[40px] border border-[var(--sd-amber)]/70 px-3 text-xs font-bold text-amber-300 hover:bg-[var(--sd-amber)]/20 active:scale-[0.98]"
            >
              {option.label}, {option.minutes} minutes
            </button>
          ))}
          {outcome.offer === "goHome" ? (
            <button
              ref={goHomeRef}
              type="button"
              onClick={leave}
              className="min-h-[40px] border border-[var(--sd-amber)] bg-[var(--sd-amber)]/10 px-3 text-xs font-bold text-amber-300 hover:bg-[var(--sd-amber)]/20 active:scale-[0.98]"
            >
              Go home
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setOutcome(null);
              playfieldRef.current?.focus({ preventScroll: true });
            }}
            className="min-h-[40px] border border-zinc-700 px-3 text-xs text-zinc-300 hover:border-[var(--sd-amber)]"
          >
            {outcome.offer === "goHome"
              ? "Stay"
              : outcome.check
                ? "Not now"
                : "Close"}
          </button>
        </div>
      </section>
      {/* An open card does not hide the message waiting for an answer: the
          Today list points at it, and going home leaves it unanswered
          (#2336). */}
      {interruption ? (
        <InterruptionCard interruption={interruption} onAnswer={answer} />
      ) : null}
    </div>
  ) : digest || interruption || guest || (!plan.priority && morning) ? (
    <div ref={cardsRef} className="scroll-mt-nav-24 space-y-3">
      {digest ? <DigestCard digest={digest} /> : null}
      {guest ? <GuestCard scene={guest} onMeet={meet} /> : null}
      {interruption ? (
        <InterruptionCard interruption={interruption} onAnswer={answer} />
      ) : null}
      {!plan.priority && morning ? (
        <PriorityCard onChoose={pickPriority} />
      ) : null}
    </div>
  ) : null;

  const liveRegions = (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {notice}
      </div>
      <div
        role="status"
        aria-live="polite"
        data-testid="world-hud-notice"
        className="sr-only"
      >
        {hudNotice}
      </div>
    </>
  );
  const sharedNotice = sharedHeld ? (
    <div
      data-testid="world-shared-ignored"
      className="flex flex-wrap items-center justify-between gap-2 border border-[var(--sd-hairline)] bg-[var(--sd-surface)] px-3 py-2 text-xs"
    >
      <p className="min-w-0">
        You have a study in progress, so the shared link is on hold. Finish this
        study, then open the link again to play the shared one.
      </p>
      <button
        type="button"
        onClick={() => setSharedHeld(false)}
        className="min-h-11 border border-[var(--sd-hairline)] px-3 active:scale-[0.98]"
      >
        Got it
      </button>
    </div>
  ) : null;
  const header = (
    <div
      className={`flex flex-wrap items-center justify-between gap-2${touch ? " sd-world-top" : ""}`}
    >
      <h2 className="text-sm font-bold tracking-[-0.01em]">
        {map.name ? `${map.name} visit` : "The CRO floor"}
      </h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={showMap}
          onClick={() => setShowMap((on) => !on)}
          className="min-h-12 border border-zinc-700 px-3 text-xs text-zinc-300 hover:border-[var(--sd-amber)] hover:text-[var(--sd-amber)]"
        >
          Minimap
        </button>
        <button
          type="button"
          onClick={() => setShowIntro(true)}
          className="min-h-12 border border-zinc-700 px-3 text-xs text-zinc-300 hover:border-[var(--sd-amber)] hover:text-[var(--sd-amber)]"
        >
          Controls
        </button>
        <button
          type="button"
          onClick={onExit}
          className="min-h-12 border border-zinc-700 px-3 text-xs text-zinc-300 hover:border-[var(--sd-amber)] hover:text-[var(--sd-amber)]"
        >
          Switch to the classic desk
        </button>
      </div>
    </div>
  );
  const hudStrip = (
    <WorldHud
      hud={hud}
      minute={world.minute}
      goal={report ? null : currentGoal(world, tasks, acted)}
    />
  );
  const playfield = (
    <div
      ref={playfieldRef}
      tabIndex={0}
      role="group"
      aria-label={`${onSite ? `${map.name ?? "Site"} map` : "Office floor"}. Arrow keys or W A S D walk; E uses what you face; F asks how you are.`}
      aria-describedby="sd-world-room"
      data-keyboard-boundary="true"
      // On the touch cabinet an open result card takes the first Escape from
      // the game's own keys, instead of the cabinet closing (#2076).
      data-escape-docks={touch && outcome ? "true" : undefined}
      data-testid="world-playfield"
      onKeyDown={onKeyDown}
      className="min-w-0 self-start outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
    >
      <FloorView
        scene={scene}
        description={description}
        reducedMotion={reducedMotion}
        onTap={touch && !away && !team.blocking ? tapFloor : undefined}
        overlay={
          <>
            <StageLabels
              view={view}
              plates={plates}
              prompt={away || team.blocking ? null : prompt}
            />
            <FeedbackToasts items={toasts} />
            {said && !away ? (
              <p
                aria-hidden="true"
                data-testid="world-said"
                data-tone={said.tone}
                className={`pointer-events-none absolute top-2 left-2 z-10 max-w-[48%] min-w-0 border bg-[var(--sd-surface)] px-2 py-1 text-[11px] leading-snug break-words ${SAID_TONE[said.tone]}`}
              >
                {said.text}
              </p>
            ) : null}
            {showMap ? (
              <Minimap
                map={map}
                player={world.player}
                people={people}
                view={view}
              />
            ) : null}
          </>
        }
      />
    </div>
  );
  // What just happened, or what the morning asks, opens first in the side
  // column, beside the floor, so it is on screen when it opens: below the
  // pickers and Delegate it opened under the fold (#2252).
  const sideSections = (
    <>
      {panel}
      <section
        aria-labelledby="sd-world-where"
        className="border border-[var(--sd-hairline)] bg-[var(--sd-surface)] p-3"
      >
        <h3
          id="sd-world-where"
          className="text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase"
        >
          Where you are
        </h3>
        <p
          id="sd-world-room"
          data-testid="world-room"
          className="mt-1 text-xs leading-relaxed break-words text-zinc-200"
        >
          {description}
        </p>
        {here.length > 0 ? (
          <ul
            aria-label="People here"
            data-testid="world-people-here"
            className="mt-2 space-y-0.5 text-[11px] text-zinc-300"
          >
            {here.map((p) => (
              <li key={p.memberId} className="break-words">
                {describePerson(world, p)}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2 text-[11px] text-[var(--sd-muted)]">
          {touch
            ? "Tap the floor to walk there. E uses what you face or talks to whoever you face. F asks how you are."
            : "Arrows or WASD walk. E uses what you face or talks to whoever you face. F asks how you are."}
        </p>
        <button
          type="button"
          onClick={lookAtSelf}
          disabled={away}
          className="mt-2 min-h-[32px] border border-zinc-700 px-2 text-[11px] text-zinc-300 hover:border-[var(--sd-amber)] disabled:opacity-50"
        >
          How are you?
        </button>
      </section>
      {away ? null : (
        <TasksPanel
          tasks={tasks}
          priority={plan.priority ? PRIORITIES[plan.priority].label : null}
        />
      )}
      {inConference && !away ? (
        <MeetingSection team={team} world={world} people={people} />
      ) : null}
      {choosing && !showIntro ? (
        <section
          aria-label="Study conditions"
          data-testid="world-conditions"
          className="border border-[var(--sd-hairline)] bg-[var(--sd-surface)] p-3"
        >
          <LengthPicker
            name="sd-world-length"
            value={length}
            onChange={chooseLength}
          />
          <div className="mt-3">
            <ConditionsPicker
              name="sd-world-difficulty"
              value={difficulty}
              onChange={chooseDifficulty}
              length={length}
            />
          </div>
          <p className="mt-2 text-[11px] text-[var(--sd-muted)]">
            Set before the study begins. Anything you do fixes it.
          </p>
        </section>
      ) : null}
      {!away && delegation.available ? (
        <section
          aria-labelledby="sd-world-delegate"
          data-testid="world-delegate"
          className="border border-[var(--sd-hairline)] bg-[var(--sd-surface)] p-3"
        >
          <h3
            id="sd-world-delegate"
            className="text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase"
          >
            Delegate the day
          </h3>
          {confirmDelegate ? (
            <>
              <p className="mt-1 text-xs leading-relaxed break-words text-zinc-200">
                {delegation.messages === 0
                  ? "Nothing is waiting. The team runs the day and you go home."
                  : `The team answers ${delegation.messages === 1 ? "the 1 waiting message" : `the ${delegation.messages} waiting messages`} the quickest way, without writing them up. Some may slip through. Everyone trusts you a little less.`}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handOver}
                  disabled={team.blocking}
                  className="min-h-11 border border-[var(--sd-amber)] bg-[var(--sd-amber)]/10 px-3 text-xs font-bold text-amber-300 hover:bg-[var(--sd-amber)]/20 active:scale-[0.98] disabled:opacity-50"
                >
                  Hand the day to the team
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelegate(false)}
                  className="min-h-11 border border-zinc-700 px-3 text-xs text-zinc-300 hover:border-[var(--sd-amber)] active:scale-[0.98]"
                >
                  Keep working
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 text-[11px] break-words text-[var(--sd-muted)]">
                Skip walking the day. The team settles the inbox and you go
                home, at a cost.
              </p>
              <button
                type="button"
                onClick={() => setConfirmDelegate(true)}
                disabled={team.blocking}
                className="mt-2 min-h-11 border border-zinc-700 px-3 text-xs text-zinc-300 hover:border-[var(--sd-amber)] hover:text-[var(--sd-amber)] active:scale-[0.98] disabled:opacity-50"
              >
                Delegate the day
              </button>
            </>
          )}
        </section>
      ) : null}
      {visitReport && !report ? (
        <SiteVisitReportPanel
          report={visitReport}
          onClose={() => {
            setVisitReport(null);
            playfieldRef.current?.focus({ preventScroll: true });
          }}
        />
      ) : null}
      {onSite ? <SiteVisitPanel world={world} /> : null}
    </>
  );
  const directoryPanel = (
    <OfficeDirectory
      title={onSite ? "Site directory" : undefined}
      entries={directory}
      walkingTo={walk?.entryId ?? null}
      disabled={away || team.blocking || Boolean(world.meeting)}
      note={
        world.meeting && !away
          ? "Closed during a meeting. End it in the conference room first."
          : said?.walk && !away
            ? said.text
            : null
      }
      onWalk={walkTo}
      minutesTo={minutesTo}
    />
  );
  const overlays = (
    <>
      {showIntro ? (
        <WorldIntro
          touch={touch}
          difficulty={choosing ? difficulty : undefined}
          onDifficultyChange={choosing ? chooseDifficulty : undefined}
          length={choosing ? length : undefined}
          onLengthChange={choosing ? chooseLength : undefined}
          onClose={() => {
            markIntroSeen();
            setShowIntro(false);
            playfieldRef.current?.focus({ preventScroll: true });
          }}
        />
      ) : null}
      {away ? null : (
        <TeamOverlay
          team={team}
          world={world}
          returnFocusTo={playfieldRef}
          reducedMotion={reducedMotion}
        />
      )}
    </>
  );

  // The touch cabinet is a fixed stage: the floor and its keys keep their
  // place, and everything else scrolls in its own column or strip (#2076).
  if (touch)
    return (
      <div
        data-sd-world=""
        className="sd-touch sd-world-touch w-full bg-[var(--sd-bg)] font-mono text-[var(--sd-text)]"
      >
        {liveRegions}
        {header}
        {sharedNotice}
        {hudStrip}
        <div className="sd-world-body">
          <div className="sd-world-stage">
            {playfield}
            <WorldTouchControls
              disabled={away || team.blocking || showIntro}
              action={
                prompt
                  ? prompt.text
                      .replace(/^Press E to /, "")
                      .replace(/^./, (c) => c.toUpperCase())
                  : null
              }
              onMove={stepBy}
              onUse={pressUse}
              onSelf={selfNow}
            />
          </div>
          <div
            role="region"
            aria-label="Office details"
            tabIndex={0}
            data-testid="world-side"
            className="sd-world-side space-y-3"
          >
            {sideSections}
            {directoryPanel}
          </div>
        </div>
        {overlays}
      </div>
    );

  return (
    <div
      data-sd-world=""
      className="space-y-3 bg-[var(--sd-bg)] p-2 font-mono text-[var(--sd-text)] sm:p-3"
    >
      {liveRegions}
      {header}
      {sharedNotice}
      {hudStrip}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,260px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        {playfield}
        <div className="min-w-0 space-y-3">{sideSections}</div>
      </div>

      {directoryPanel}
      {overlays}
    </div>
  );
};
