"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { safeIsAvailable, safeRawStorage } from "@/lib/safe-storage";
import "./study-director-touch.css";
import { recordArcadeMilestone } from "@/lib/arcade-achievements";
import { parseArcadeDailyTag } from "@/lib/arcade/daily";
import { recordArcadeDailyResult } from "@/lib/arcade/daily-store";
import {
  ATTENTION_PER_DAY,
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
import { type Outcome } from "./OutcomeStrip";
import {
  auditFindings,
  describeChanges,
  diffStates,
  summarizeDays,
} from "./consequences";
import { sceneFor } from "./scene";
import { PHASE_LABELS } from "./labels";
import type { WorldState } from "@/lib/study-director-world";
import { clearStudySave, loadStudySave, saveStudy } from "./useStudySave";
import {
  KICKOFF_DAY,
  cleanFile,
  dailyResultFor,
  loadCareer,
  recordRun,
  recordStart,
  saveCareer,
  type CareerFile,
  type CareerNews,
} from "./career";
import { verdictFor } from "./closeout";

/** The desk's sections on the touch cabinet: one at a time, never a long page (#2076). */
export const DESK_TABS = [
  { id: "inbox", label: "Inbox" },
  { id: "dashboard", label: "Dashboard" },
  { id: "team", label: "Team" },
  { id: "sites", label: "Sites" },
  { id: "office", label: "Office" },
] as const;

/** One of the desk's sections. */
export type DeskTab = (typeof DESK_TABS)[number]["id"];

/** "1 new message", "3 new messages" (#1936). */
function messageCount(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

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
/** Where the last mode the player chose is stored. */
export const MODE_KEY = "study_director_mode";
/** Fired on the window when the mode changes. */
export const MODE_EVENT = "sd-mode-change";

/** The office world or the classic desk. */
export type PlayMode = "world" | "desk";

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
 * The Study Director desk: dashboard, inbox, team, sites and a decision
 * panel. All rules live in `lib/study-director`; this is a thin adapter.
 */
/** What the session reads from the device or the page, supplied by the view (ADR 0062). */
interface StudyDirectorSessionOptions {
  /** Whether the game runs in the touch cabinet (ADR 0061). */
  readonly touch: boolean;
  /** Whether the page opens on the office rather than the desk. */
  readonly officeFirst: boolean;
}

/**
 * The Study Director desk session (#3437): the study, its days and inbox
 * queue, the career file, saves and the handlers the desk calls. Moved
 * verbatim from StudyDirectorGame.tsx; the desk renders what it returns.
 */
export function useStudyDirectorSession(options: StudyDirectorSessionOptions) {
  const { touch, officeFirst } = options;
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
      // The shared seed is used once; a later restart is a fresh study. A
      // link that names the desk keeps naming it, or the page would switch
      // to the office the moment the study starts (#2251).
      const desk = DESK_PATTERN.test(window.location.hash) ? "#mode=desk" : "";
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search + desk
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

  return {
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
  };
}
