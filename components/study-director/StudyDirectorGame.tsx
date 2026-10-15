"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import dynamic from "next/dynamic";
import { safeIsAvailable, safeRawStorage } from "@/lib/safe-storage";
import { useCabinetTouch } from "@/components/arcade/mobile/CabinetTouchContext";
import "./study-director-touch.css";
import { recordArcadeMilestone } from "@/lib/arcade-achievements";
import { parseArcadeDailyTag } from "@/lib/arcade/daily";
import { recordArcadeDailyResult } from "@/lib/arcade/daily-store";
import {
  ATTENTION_PER_DAY,
  AUDIT_ATTENTION,
  DEFAULT_SCENARIO,
  auditSite,
  computeMeters,
  createStudyFromScenario,
  endDay,
  finalizeStudy,
  inbox,
  resolveEvent,
  type Difficulty,
  type Meters,
  type StudyEvent,
  type StudyScenario,
  type StudyState,
} from "@/lib/study-director";
import { DashboardPanel, MetersPanel, SitesPanel, TeamPanel } from "./Panels";
import { BriefingView } from "./BriefingView";
import { DecisionPanel } from "./DecisionPanel";
import { OutcomeStrip, type Outcome } from "./OutcomeStrip";
import {
  auditFindings,
  describeChanges,
  diffStates,
  summarizeDays,
} from "./consequences";
import { InboxPanel } from "./InboxPanel";
import { OfficeScene } from "./OfficeScene";
import { sceneFor } from "./scene";
import { dailyHeadline } from "./headline";
import { PhaseTimeline } from "./PhaseTimeline";
import { PHASE_LABELS } from "./labels";
import { ShortcutSheet } from "./ShortcutSheet";
import { StatusBar } from "./StatusBar";
import type { WorldState } from "@/lib/study-director-world";
import { ReportView } from "./ReportView";
import { clearStudySave, loadStudySave, saveStudy } from "./useStudySave";
import {
  KICKOFF_DAY,
  cleanFile,
  dailyResultFor,
  loadCareer,
  mergeCareers,
  recordRun,
  recordStart,
  saveCareer,
  type CareerFile,
  type CareerNews,
} from "./career";
import { verdictFor } from "./closeout";
import { PersonnelFile } from "./PersonnelFile";
import { SharePanel } from "./ShareCard";
import { DifficultyPicker } from "./DifficultyPicker";

/** The desk's sections on the touch cabinet: one at a time, never a long page (#2076). */
const DESK_TABS = [
  { id: "inbox", label: "Inbox" },
  { id: "dashboard", label: "Dashboard" },
  { id: "team", label: "Team" },
  { id: "sites", label: "Sites" },
  { id: "office", label: "Office" },
] as const;

type DeskTab = (typeof DESK_TABS)[number]["id"];

/** "1 new message", "3 new messages" (#1936). */
function messageCount(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

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

function newStudy(
  scenario: StudyScenario,
  sharedSeed: string | null,
  difficulty: Difficulty
): StudyState {
  const seed =
    sharedSeed ??
    `sd-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  return createStudyFromScenario(scenario, seed, difficulty);
}

const SEED_PATTERN = /(?:^#|&)seed=([\w-]{1,60})(?:&|$)/;

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** A seed shared by link (`#seed=...`), or null. */
function hashSeed(): string | null {
  return SEED_PATTERN.exec(window.location.hash)?.[1] ?? null;
}

const WORLD_PATTERN = /(?:^#|&)mode=world(?:&|$)/;
const DESK_PATTERN = /(?:^#|&)mode=desk(?:&|$)/;
const MODE_KEY = "study_director_mode";
const MODE_EVENT = "sd-mode-change";

type PlayMode = "world" | "desk";

/** The mode a player last chose by hand, or null if they never did. */
function storedMode(): PlayMode | null {
  try {
    if (!safeIsAvailable()) return null;
    const value = safeRawStorage.getItem(MODE_KEY);
    return value === "world" || value === "desk" ? value : null;
  } catch {
    return null;
  }
}

function rememberMode(mode: PlayMode): void {
  try {
    if (safeIsAvailable()) safeRawStorage.setItem(MODE_KEY, mode);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
  window.dispatchEvent(new Event(MODE_EVENT));
}

function subscribeMode(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  window.addEventListener(MODE_EVENT, onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener(MODE_EVENT, onChange);
  };
}

/**
 * Which view to show. A link decides first (`#mode=desk` or `#mode=world`),
 * then the player's last choice, then the page's default (`officeFirst`).
 */
function currentMode(officeFirst: boolean): PlayMode {
  const hash = window.location.hash;
  if (DESK_PATTERN.test(hash)) return "desk";
  if (WORLD_PATTERN.test(hash)) return "world";
  return storedMode() ?? (officeFirst ? "world" : "desk");
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
 * Shows the closeout on the desk without changing the saved choice, so the
 * next visit still opens in the office.
 */
function showCloseout(): void {
  window.location.hash = "mode=desk";
}

const DIFFICULTY_PATTERN = /(?:^#|&)difficulty=(calm|standard|rescue)(?:&|$)/;

/** The difficulty a shared link asks for, or null. */
function hashDifficulty(): Difficulty | null {
  return (
    (DIFFICULTY_PATTERN.exec(window.location.hash)?.[1] as
      Difficulty | undefined) ?? null
  );
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
  const [deskTab, setDeskTab] = useState<DeskTab>("inbox");
  const [state, setState] = useState<StudyState | null>(null);
  const [saved, setSaved] = useState<StudyState | null>(() => loadStudySave());
  const [scenario, setScenario] = useState<StudyScenario>(DEFAULT_SCENARIO);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [documented, setDocumented] = useState(false);
  const [notice, setNotice] = useState("");
  // Why the last action could not happen; shown until the next one does.
  const [alert, setAlert] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);
  // Meters at the start of the current day, so the desk can show drift.
  const [baseline, setBaseline] = useState<Meters | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [career, setCareer] = useState<CareerFile>(() => loadCareer());
  const [news, setNews] = useState<CareerNews | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  // A study finished in the world, shown in the classic closeout. It is not
  // saved over the desk's own run (saves are separate per mode, ADR 0055).
  const [fromWorld, setFromWorld] = useState(false);
  // The office run behind that closeout, for its meeting archive and exports.
  const [worldRun, setWorldRun] = useState<WorldState | null>(null);
  const sharedSeed = useSyncExternalStore(subscribeHash, hashSeed, () => null);
  const sharedDaily = sharedSeed
    ? parseArcadeDailyTag(sharedSeed, "study-director")
    : null;
  const worldMode =
    useSyncExternalStore(
      subscribeMode,
      () => currentMode(officeFirst),
      () => "desk" as PlayMode
    ) === "world";
  const sharedDifficulty = useSyncExternalStore(
    subscribeHash,
    hashDifficulty,
    () => null
  );
  const [pickedDifficulty, setPickedDifficulty] = useState<Difficulty | null>(
    null
  );
  const difficulty = pickedDifficulty ?? sharedDifficulty ?? "standard";
  const seq = useRef(0);

  const updateCareer = useCallback((next: CareerFile) => {
    setCareer(next);
    saveCareer(next);
  }, []);

  useEffect(() => {
    if (state && !fromWorld) saveStudy(state);
  }, [state, fromWorld]);

  const rootRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const hasBriefing = state === null;
  useEffect(() => {
    if (hasBriefing) primaryRef.current?.focus({ preventScroll: true });
  }, [hasBriefing]);
  const active = state !== null;
  useEffect(() => {
    if (!active) return;
    rootRef.current?.focus({ preventScroll: true });
    // The touch cabinet covers the page, so the page has nothing to scroll to.
    if (touch) return;
    const top = rootRef.current?.getBoundingClientRect().top;
    if (top !== undefined) {
      // Clear the fixed site header so the day and attention readout stay visible.
      window.scrollTo({ top: window.scrollY + top - 88, behavior: "instant" });
    }
  }, [active, touch]);

  const events = useMemo(() => (state ? inbox(state) : []), [state]);
  const selected: StudyEvent | undefined =
    events.find((e) => e.id === selectedId) ?? events[0];
  const report = useMemo(
    () => (state && state.status === "complete" ? finalizeStudy(state) : null),
    [state]
  );
  const criticalCount = events.filter((e) => e.urgency === "critical").length;
  const scene = useMemo(
    () =>
      state
        ? sceneFor(state, computeMeters(state), {
            criticalCount,
            attentionPerDay: ATTENTION_PER_DAY,
            // Lights go off overnight and after closeout.
            night: outcome?.kind === "overnight" || report !== null,
            pinned: report?.evaluations.regulatory.grade,
          })
        : null,
    [state, criticalCount, outcome, report]
  );

  const start = useCallback((next: StudyState) => {
    setFromWorld(false);
    setDeskTab("inbox");
    setState(next);
    setBaseline(computeMeters(next));
    setOutcome(null);
    setSaved(null);
    setSelectedId(null);
    setDocumented(false);
    setNews(null);
    setConfirmAbandon(false);
    setNotice(
      `Day ${next.day}. ${messageCount(inbox(next).length, "new message")}.`
    );
  }, []);

  const startNew = useCallback(() => {
    updateCareer(recordStart(career));
    if (sharedSeed) {
      // The shared seed is used once; a later restart is a fresh study.
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    }
    start(newStudy(scenario, sharedSeed, difficulty));
  }, [career, scenario, sharedSeed, difficulty, start, updateCareer]);

  /** Files a finished study in the career, once per seed. */
  const closeOut = useCallback(
    (done: StudyState) => {
      if (done.status !== "complete") return;
      const finished = finalizeStudy(done);
      const result = recordRun(career, finished, verdictFor(finished).headline);
      if (finished.evaluations.regulatory.grade === "A") {
        recordArcadeMilestone("study-director", "grade_a");
      }
      if (cleanFile(finished.state))
        recordArcadeMilestone("study-director", "clean_file");
      // A study on the day's Arcade Daily seed records its own best (#2113).
      const dailyDate = parseArcadeDailyTag(done.seed, "study-director");
      if (dailyDate) {
        recordArcadeDailyResult(
          "study-director",
          dailyDate,
          dailyResultFor(finished)
        );
      }
      updateCareer(result.career);
      setNews(result.news);
    },
    [career, updateCareer]
  );

  /**
   * A world run ends where a classic run does: the report, the verdict and
   * the share card, filed in the career like any other study.
   */
  // An office run counts as started once its first morning is touched: the
  // personnel file said "0 started, 1 closed" after an office run (#2191).
  const countOfficeStart = useCallback(
    () => updateCareer(recordStart(career)),
    [career, updateCareer]
  );

  // Three weeks into a study, at the desk, earns Study Kickoff (#2191).
  const deskDay = state?.day ?? 0;
  useEffect(() => {
    if (deskDay >= KICKOFF_DAY)
      recordArcadeMilestone("study-director", "first_weeks");
  }, [deskDay]);

  const closeWorldRun = useCallback(
    (done: StudyState, run: WorldState) => {
      showCloseout();
      setFromWorld(true);
      setWorldRun(run);
      setState(done);
      setBaseline(computeMeters(done));
      setOutcome(null);
      setSelectedId(null);
      setConfirmAbandon(false);
      closeOut(done);
      setNotice("The study is complete.");
    },
    [closeOut]
  );

  const choose = useCallback(
    (event: StudyEvent, optionId: string) => {
      if (!state) return;
      const result = resolveEvent(state, event.id, optionId, documented);
      if (!result.ok) {
        const why =
          result.reason === "not-enough-attention"
            ? "Not enough attention left today. Try a cheaper option or end the day."
            : "That message is no longer open.";
        setAlert(why);
        setNotice(why);
        return;
      }
      setAlert("");
      const label = event.options.find((o) => o.id === optionId)?.label ?? "";
      const changes = diffStates(state, result.state);
      seq.current += 1;
      setOutcome({
        kind: "decision",
        seq: seq.current,
        title: label,
        documented,
        changes,
      });
      setState(result.state);
      setSelectedId(null);
      setDocumented(false);
      // The clicked option unmounts with its message; keep focus on the desk
      // so the keyboard shortcuts keep working.
      rootRef.current?.focus({ preventScroll: true });
      setNotice(
        `${label}. ${documented ? "Documented." : "Not documented."} ${describeChanges(changes)} ${result.state.attention} attention left.`
      );
    },
    [state, documented]
  );

  const audit = useCallback(
    (siteId: string) => {
      if (!state) return;
      const result = auditSite(state, siteId);
      if (!result.ok) {
        const why = "Not enough attention left to audit today.";
        setAlert(why);
        setNotice(why);
        return;
      }
      setAlert("");
      const name = state.sites.find((x) => x.id === siteId)?.name ?? siteId;
      const changes = auditFindings(result.report);
      seq.current += 1;
      setOutcome({
        kind: "audit",
        seq: seq.current,
        title: `Audited ${name}`,
        changes,
      });
      setState(result.state);
      setNotice(
        `Audited ${name}. ${describeChanges(changes)} The real numbers are on its site card.`
      );
    },
    [state]
  );

  /** Shows the overnight report and returns it as a sentence to announce. */
  const reportNight = useCallback(
    (before: StudyState, after: StudyState): string => {
      if (after.status !== "running") {
        setOutcome(null);
        return "";
      }
      const summary = summarizeDays(before, after, inbox(after).length);
      seq.current += 1;
      setOutcome({ kind: "overnight", seq: seq.current, summary });
      return [
        summary.phaseChange
          ? `New phase: ${PHASE_LABELS[summary.phaseChange.to]}.`
          : "",
        summary.lapsed.length > 0
          ? `Lapsed unanswered: ${summary.lapsed.map((l) => l.subject).join(", ")}.`
          : "",
      ]
        .filter(Boolean)
        .join(" ");
    },
    []
  );

  const finishDay = useCallback(() => {
    if (!state) return;
    setAlert("");
    setDeskTab("inbox");
    const next = endDay(state);
    const night = reportNight(state, next);
    setState(next);
    closeOut(next);
    setBaseline(computeMeters(next));
    setSelectedId(null);
    setDocumented(false);
    setNotice(
      next.status === "complete"
        ? "The study is complete."
        : `Day ${next.day}. ${night} ${messageCount(inbox(next).length, "message")} in the inbox.`
    );
  }, [state, reportNight, closeOut]);

  const skipQuietDays = useCallback(() => {
    if (!state) return;
    setAlert("");
    setDeskTab("inbox");
    let next = endDay(state);
    let skipped = 1;
    while (
      next.status === "running" &&
      inbox(next).length === 0 &&
      skipped < 30
    ) {
      next = endDay(next);
      skipped += 1;
    }
    const night = reportNight(state, next);
    setState(next);
    closeOut(next);
    setBaseline(computeMeters(next));
    setSelectedId(null);
    setDocumented(false);
    setNotice(
      next.status === "complete"
        ? "The study is complete."
        : `Skipped ${skipped} days to day ${next.day}. ${night} ${messageCount(inbox(next).length, "message")} in the inbox.`
    );
  }, [state, reportNight, closeOut]);

  const restart = useCallback(() => {
    if (fromWorld) {
      // The desk's own run, if any, is still there to resume.
      setFromWorld(false);
      setWorldRun(null);
      setSaved(loadStudySave());
    } else {
      clearStudySave();
      setSaved(null);
    }
    setState(null);
    setNews(null);
    setConfirmAbandon(false);
    setNotice("");
  }, [fromWorld]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      !state ||
      state.status !== "running" ||
      showShortcuts ||
      e.metaKey ||
      e.ctrlKey ||
      e.altKey
    )
      return;
    const key = e.key.toLowerCase();
    const step =
      key === "j" || key === "arrowdown"
        ? 1
        : key === "k" || key === "arrowup"
          ? -1
          : 0;
    if (key === "?") {
      e.preventDefault();
      setShowShortcuts(true);
    } else if (key === "escape" && outcome) {
      e.preventDefault();
      setOutcome(null);
    } else if (key === "e") {
      e.preventDefault();
      finishDay();
    } else if (key === "n" && events.length === 0) {
      e.preventDefault();
      skipQuietDays();
    } else if (key === "d") {
      e.preventDefault();
      setDocumented((v) => !v);
    } else if (step !== 0 && events.length > 0) {
      e.preventDefault();
      const index = Math.max(
        0,
        events.findIndex((x) => x.id === selected?.id)
      );
      const next = (index + step + events.length) % events.length;
      setSelectedId(events[next].id);
    } else if (/^[1-5]$/.test(key) && selected) {
      const option = selected.options[Number(key) - 1];
      if (option) {
        e.preventDefault();
        choose(selected, option.id);
      }
    }
  };

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
