"use client";

import React from "react";
import dynamic from "next/dynamic";
import { safeIsAvailable, safeRawStorage } from "@/lib/safe-storage";
import { useCabinetTouch } from "@/components/arcade/mobile/CabinetTouchContext";
import "./study-director-touch.css";
import { AUDIT_ATTENTION } from "@/lib/study-director";
import { DashboardPanel, MetersPanel, SitesPanel, TeamPanel } from "./Panels";
import { BriefingView } from "./BriefingView";
import { DecisionPanel } from "./DecisionPanel";
import { OutcomeStrip } from "./OutcomeStrip";
import { InboxPanel } from "./InboxPanel";
import { OfficeScene } from "./OfficeScene";
import { dailyHeadline } from "./headline";
import { PhaseTimeline } from "./PhaseTimeline";
import { ShortcutSheet } from "./ShortcutSheet";
import { StatusBar } from "./StatusBar";
import { ReportView } from "./ReportView";
import { mergeCareers } from "./career";
import { PersonnelFile } from "./PersonnelFile";
import { SharePanel } from "./ShareCard";
import { DifficultyPicker } from "./DifficultyPicker";
import {
  DESK_TABS,
  MODE_EVENT,
  MODE_KEY,
  useStudyDirectorSession,
  type DeskTab,
  type PlayMode,
} from "@/components/study-director/useStudyDirectorSession";

const StudyDirectorWorld = dynamic(
  () =>
    import("@/components/study-director-world/StudyDirectorWorld").then(
      (mod) => mod.StudyDirectorWorld
    ),
  {
    ssr: false,
    loading: () => (
      <p className="p-8 font-mono text-xs text-zinc-400">
        Unlocking the office…
      </p>
    ),
  }
);

function rememberMode(mode: PlayMode): void {
  try {
    if (safeIsAvailable()) safeRawStorage.setItem(MODE_KEY, mode);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
  window.dispatchEvent(new Event(MODE_EVENT));
}

/** Opens the walkable office and remembers the choice. */
function enterWorld(): void {
  rememberMode("world");
  window.location.hash = "mode=world";
}

/** Returns to the classic desk, dropping the mode from the link. */
function leaveWorld(): void {
  rememberMode("desk");
  window.history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search
  );
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

/**
 * A screen that scrolls inside the touch cabinet's fixed stage: the briefing
 * before a study and the report after it. It clears the cabinet's floating
 * toolbar and is focusable, so a keyboard can scroll it (#2076).
 */
const TouchScroll: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div
    role="region"
    aria-label={label}
    tabIndex={0}
    className="sd-touch sd-touch-scroll w-full"
  >
    {children}
  </div>
);

/**
 * The Study Director desk: dashboard, inbox, team, sites and a decision
 * panel. All rules live in `lib/study-director`; this is a thin adapter.
 */
export const StudyDirectorGame: React.FC<{ officeFirst?: boolean }> = ({
  officeFirst = false,
}) => {
  // The immersive touch cabinet (ADR 0061, #2076) lays the desk out to fit
  // its stage; desktop markup is untouched.
  const touch = useCabinetTouch();
  const {
    alert,
    audit,
    baseline,
    career,
    choose,
    closeWorldRun,
    confirmAbandon,
    countOfficeStart,
    deskTab,
    difficulty,
    documented,
    events,
    finishDay,
    fromWorld,
    handleKeyDown,
    news,
    notice,
    outcome,
    primaryRef,
    report,
    restart,
    rootRef,
    saved,
    scenario,
    scene,
    selected,
    setConfirmAbandon,
    setDeskTab,
    setDocumented,
    setOutcome,
    setPickedDifficulty,
    setScenario,
    setSelectedId,
    setShowShortcuts,
    sharedDaily,
    sharedSeed,
    showShortcuts,
    skipQuietDays,
    start,
    startNew,
    state,
    updateCareer,
    worldMode,
    worldRun,
  } = useStudyDirectorSession({
    touch,
    officeFirst,
  });

  if (worldMode)
    return (
      <StudyDirectorWorld
        onExit={leaveWorld}
        onCloseout={closeWorldRun}
        onStart={countOfficeStart}
      />
    );

  if (!state) {
    const briefing = (
      <BriefingView
        setup={scenario.setup}
        sites={scenario.sites}
        team={scenario.team}
        scenario={scenario}
        onScenarioChange={setScenario}
        actions={
          <>
            <DifficultyPicker
              value={difficulty}
              onChange={setPickedDifficulty}
            />
            <button
              type="button"
              ref={saved && saved.status === "running" ? undefined : primaryRef}
              onClick={startNew}
              className="min-h-[44px] border border-amber-500 bg-amber-500/10 px-4 text-sm font-bold text-amber-300 hover:bg-amber-500/20"
            >
              Start the study (classic desk)
            </button>
            <button
              type="button"
              onClick={enterWorld}
              className="min-h-[44px] border border-zinc-600 px-4 text-sm text-zinc-200 hover:border-amber-500"
            >
              Walk the office
            </button>
            {saved && saved.status === "running" ? (
              <button
                type="button"
                ref={primaryRef}
                onClick={() => start(saved)}
                className="min-h-[44px] border border-zinc-600 px-4 text-sm text-zinc-200 hover:border-amber-500"
              >
                Resume day {saved.day}
              </button>
            ) : null}
            {sharedSeed ? (
              <p className="basis-full text-[11px] text-[var(--sd-muted)]">
                {sharedDaily
                  ? `Arcade Daily study for ${sharedDaily}, seed `
                  : "Replaying a shared study, seed "}
                <span className="text-zinc-300">{sharedSeed}</span>.
              </p>
            ) : null}
          </>
        }
        footer={
          <PersonnelFile
            career={career}
            onImport={(imported) =>
              updateCareer(mergeCareers(career, imported))
            }
          />
        }
      />
    );
    return touch ? (
      <TouchScroll label="Study briefing">{briefing}</TouchScroll>
    ) : (
      briefing
    );
  }

  const running = state.status === "running";
  const criticalOpen = events.filter((e) => e.urgency === "critical").length;

  const actions = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <button
        type="button"
        onClick={finishDay}
        className="min-h-[44px] border border-[var(--sd-amber)] bg-[var(--sd-amber)]/10 px-4 text-sm font-bold text-amber-300 hover:bg-[var(--sd-amber)]/20 active:scale-[0.98]"
      >
        End day
      </button>
      {events.length === 0 ? (
        <button
          type="button"
          onClick={skipQuietDays}
          className="min-h-[44px] border border-zinc-600 px-4 text-sm text-zinc-200 hover:border-[var(--sd-amber)] active:scale-[0.98]"
        >
          Skip to next message
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => setShowShortcuts(true)}
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        className="min-h-[44px] min-w-[44px] border border-zinc-700 text-sm text-zinc-300 hover:border-[var(--sd-amber)] hover:text-[var(--sd-amber)]"
      >
        ?
      </button>
      <div className="min-w-0 flex-1 basis-56">
        <p
          className={`text-[11px] ${criticalOpen > 0 ? "font-semibold text-red-400" : "text-[var(--sd-muted)]"}`}
        >
          {criticalOpen > 0
            ? `${criticalOpen} critical message${criticalOpen === 1 ? "" : "s"} will lapse if you end the day.`
            : touch
              ? events.length === 0
                ? "Nothing is waiting. End the day or skip ahead."
                : "Tap a message, then an option. End the day when you are done."
              : events.length === 0
                ? "Nothing is waiting. Keys: E end day, N skip to the next message, ? all keys."
                : "Keys: 1-5 choose, D document, J/K move, E end day, ? all keys."}
        </p>
        {alert ? (
          <p className="mt-0.5 text-[11px] font-semibold text-red-400">
            {alert}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-[var(--sd-muted)]" data-testid="study-save-note">
          Saved, day {state.day}
        </span>
        {confirmAbandon ? (
          <>
            <span className="text-zinc-300">Abandon this study?</span>
            <button
              type="button"
              onClick={restart}
              className="min-h-[32px] border border-red-500/60 px-2 text-red-300 hover:bg-red-500/10"
            >
              Abandon
            </button>
            <button
              type="button"
              onClick={() => setConfirmAbandon(false)}
              className="min-h-[32px] border border-zinc-700 px-2 text-zinc-300 hover:border-[var(--sd-amber)]"
            >
              Keep going
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmAbandon(true)}
            className="min-h-[32px] px-1 text-[var(--sd-muted)] underline decoration-dotted underline-offset-2 hover:text-zinc-200"
          >
            Abandon study
          </button>
        )}
      </div>
    </div>
  );

  // The touch cabinet is a fixed stage: the status, the section tabs and the
  // day's actions keep their place, and one section scrolls between them
  // (#2076). Its pieces are the desk's own.
  if (touch) {
    const sections: Record<DeskTab, React.ReactNode> = {
      inbox: (
        <div className="sd-desk-inbox">
          <div className="sd-desk-list">
            <InboxPanel
              state={state}
              events={events}
              selectedId={selected?.id}
              onSelect={setSelectedId}
            />
          </div>
          <DecisionPanel
            state={state}
            event={running ? selected : undefined}
            documented={documented}
            onDocumentedChange={setDocumented}
            onChoose={choose}
            banner={
              outcome ? (
                <OutcomeStrip
                  outcome={outcome}
                  onDismiss={() => setOutcome(null)}
                />
              ) : null
            }
            footer={null}
          />
        </div>
      ),
      dashboard: (
        <div className="sd-desk-pair">
          <DashboardPanel state={state} />
          <MetersPanel state={state} baseline={baseline} />
        </div>
      ),
      team: <TeamPanel state={state} />,
      sites: (
        <SitesPanel
          state={state}
          canAudit={running && state.attention >= AUDIT_ATTENTION}
          onAudit={audit}
        />
      ),
      office: scene ? (
        <OfficeScene
          scene={scene}
          headline={running ? dailyHeadline(state) : undefined}
        />
      ) : null,
    };
    const tabLabel = DESK_TABS.find((t) => t.id === deskTab)?.label ?? "";
    return (
      <div
        ref={rootRef}
        tabIndex={0}
        data-keyboard-boundary="true"
        // An open result strip takes the first Escape from the desk's own
        // keys, instead of the cabinet closing.
        data-escape-docks={outcome ? "true" : undefined}
        data-sd-desk=""
        onKeyDown={handleKeyDown}
        className="sd-touch sd-desk-touch w-full bg-[var(--sd-bg)] font-mono text-[var(--sd-text)] outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
      >
        <div role="status" aria-live="polite" className="sr-only">
          {notice}
        </div>
        {showShortcuts ? (
          <ShortcutSheet onClose={() => setShowShortcuts(false)} />
        ) : null}
        {report ? (
          <div
            role="region"
            aria-label="Study report"
            tabIndex={0}
            className="sd-touch-scroll"
          >
            <ReportView
              report={report}
              world={fromWorld ? worldRun : null}
              onRestart={restart}
              share={
                <SharePanel report={report} news={news} office={fromWorld} />
              }
            />
          </div>
        ) : (
          <>
            <StatusBar state={state} />
            <PhaseTimeline state={state} />
            <nav
              aria-label="Desk sections"
              className="sd-desk-tabs"
              data-testid="desk-tabs"
            >
              {DESK_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={deskTab === tab.id}
                  onClick={() => setDeskTab(tab.id)}
                >
                  {tab.label}
                  {tab.id === "inbox" && events.length > 0
                    ? ` (${events.length})`
                    : ""}
                </button>
              ))}
            </nav>
            <div
              role="region"
              aria-label={`${tabLabel} section`}
              tabIndex={0}
              data-testid="desk-section"
              className="sd-desk-scroll"
            >
              {deskTab !== "inbox" && outcome ? (
                <OutcomeStrip
                  outcome={outcome}
                  onDismiss={() => setOutcome(null)}
                />
              ) : null}
              {sections[deskTab]}
            </div>
            {running ? (
              <div className="sd-desk-actions" data-testid="desk-actions">
                {actions}
              </div>
            ) : null}
          </>
        )}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      data-keyboard-boundary="true"
      data-sd-desk=""
      onKeyDown={handleKeyDown}
      className="space-y-3 bg-[var(--sd-bg)] p-2 font-mono text-[var(--sd-text)] outline-none focus-visible:ring-1 focus-visible:ring-amber-500 sm:p-3"
    >
      <div role="status" aria-live="polite" className="sr-only">
        {notice}
      </div>
      {showShortcuts ? (
        <ShortcutSheet onClose={() => setShowShortcuts(false)} />
      ) : null}

      <StatusBar state={state} />
      <PhaseTimeline state={state} />
      {scene ? (
        <OfficeScene
          scene={scene}
          headline={running ? dailyHeadline(state) : undefined}
        />
      ) : null}

      {report ? (
        <ReportView
          report={report}
          world={fromWorld ? worldRun : null}
          onRestart={restart}
          share={<SharePanel report={report} news={news} office={fromWorld} />}
        />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(0,230px)] xl:grid-cols-[minmax(0,260px)_minmax(0,1fr)_minmax(0,280px)]">
            <div className="min-w-0 space-y-3">
              <InboxPanel
                state={state}
                events={events}
                selectedId={selected?.id}
                onSelect={setSelectedId}
              />
              <DashboardPanel state={state} />
            </div>
            <DecisionPanel
              state={state}
              event={running ? selected : undefined}
              documented={documented}
              onDocumentedChange={setDocumented}
              onChoose={choose}
              banner={
                outcome ? (
                  <OutcomeStrip
                    outcome={outcome}
                    onDismiss={() => setOutcome(null)}
                  />
                ) : null
              }
              footer={running ? actions : null}
            />
            <div className="min-w-0 space-y-3">
              <MetersPanel state={state} baseline={baseline} />
              <TeamPanel state={state} />
            </div>
          </div>
          <SitesPanel
            state={state}
            canAudit={running && state.attention >= AUDIT_ATTENTION}
            onAudit={audit}
          />
        </>
      )}
    </div>
  );
};
