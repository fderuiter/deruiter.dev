"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { recordArcadeDailyResult } from "@/lib/arcade/daily-store";
import {
  recordArcadeMilestone,
  recordArcadeScore,
} from "@/lib/arcade-achievements";
import {
  BIOSTAT_OPS_CAMPAIGN,
  advanceRun,
  createCustomScenario,
  createRunState,
  parseSeed,
  currentRunAct,
  deriveRunView,
  type CustomScenarioSpec,
  type RestoredRun,
  type RunAction,
  type RunChoice,
  type RunPlan,
  type RunLog,
  type RunOrigin,
  type RunState,
  type Scenario,
  type TableState,
  recordDiscoveries,
  recordRun,
  summarizeCampaignWin,
  summarizeRun,
  utcDate,
  type LevelUp,
  type TableView,
} from "@/lib/trial-and-error";
import "@/components/trial-and-error/te-touch.css";
import {
  clearRunSave,
  useSavedRun,
  writeRunSave,
} from "@/components/trial-and-error/useRunSave";
import { updateCodex, useCodex } from "@/components/trial-and-error/useCodex";
import {
  freshSeed,
  useChallengeHash,
} from "@/components/trial-and-error/useChallenge";

/** The run and every move since it started: what a save replays. */
interface LoggedRun {
  run: RunState;
  log: RunLog;
}

/**
 * A move, a saved run replacing the fresh one on resume, or a new run on a
 * chosen seed, sponsor and stake, whose log records how the seed was chosen
 * (#1528) and the sponsor and stake (#950).
 */
type TableIntent =
  | RunAction
  | { type: "LOAD_SAVED"; saved: RestoredRun }
  | {
      type: "NEW_RUN";
      seed: string;
      origin: RunOrigin;
      choice: RunChoice;
      customScenario?: CustomScenarioSpec;
    };

/**
 * The sponsor and stake a run log records: only what differs from the
 * defaults, as the run state and save do, so a default run's log is exactly
 * what it was before sponsors existed.
 */
function loggedChoice(run: RunState): Pick<RunLog, "sponsorId" | "stake"> {
  return {
    ...(run.sponsorId !== undefined && { sponsorId: run.sponsorId }),
    ...(run.stake !== undefined && { stake: run.stake }),
  };
}

function logRun(
  act: RunPlan,
  current: LoggedRun,
  intent: TableIntent
): LoggedRun {
  if (intent.type === "LOAD_SAVED") {
    return { run: intent.saved.run, log: intent.saved.log };
  }
  if (intent.type === "NEW_RUN") {
    const customScenarioObj = intent.customScenario
      ? createCustomScenario(intent.customScenario)
      : null;
    const effectiveAct: RunPlan = customScenarioObj
      ? {
          id: customScenarioObj.id,
          title: customScenarioObj.title,
          blinds: [customScenarioObj],
        }
      : act;

    const chosen = createRunState(effectiveAct, intent.seed, intent.choice);
    const run = advanceRun(
      effectiveAct,
      {
        ...chosen,
        table: { ...chosen.table, lastEvent: current.run.table.lastEvent },
      },
      { type: "RESTART_RUN", seed: intent.seed }
    );
    return {
      run,
      log: {
        actId: effectiveAct.id,
        seed: run.seed,
        ...loggedChoice(run),
        origin: intent.origin,
        actions: [],
      },
    };
  }

  const run = advanceRun(act, current.run, intent);
  // A new run starts a new log; every other move joins the current one.
  if (intent.type === "RESTART_RUN") {
    return {
      run,
      log: {
        actId: act.id,
        seed: run.seed,
        ...loggedChoice(run),
        actions: [],
      },
    };
  }
  return {
    run,
    log: { ...current.log, actions: [...current.log.actions, intent] },
  };
}

/** The page's `?seed=` parameter when it is a valid seed, else a fresh one. */
function initialSeed(): { seed: string; origin?: RunOrigin } {
  try {
    const param = new URLSearchParams(window.location.search).get("seed");
    const seed = param === null ? null : parseSeed(param);
    if (seed) return { seed, origin: { kind: "SEEDED" } };
  } catch {
    // No location (a test harness): fall through to a fresh seed.
  }
  return { seed: freshSeed() };
}

/** A named moment in a run, for views and effects that react to it (#3434). */
export type TrialAndErrorEvent =
  | { readonly type: "handScored"; readonly score: number }
  | { readonly type: "fatalError"; readonly label: string }
  | {
      readonly type: "blindCleared";
      readonly roundScore: number;
      readonly quota: number;
    }
  | {
      readonly type: "blindFailed";
      readonly roundScore: number;
      readonly quota: number;
    }
  | { readonly type: "csrLocked" }
  | { readonly type: "levelUp"; readonly levelUp: LevelUp }
  | { readonly type: "bossIntro"; readonly blindKey: string }
  | { readonly type: "purchase"; readonly slot: number; readonly pack: boolean }
  | { readonly type: "sealApplied" };

/** What `sessionEvents` compares between one move and the next. */
export interface SessionMoment {
  /** The table's last event, or null before the first. */
  readonly event: TableView["lastEvent"];
  readonly outcome: TableView["outcome"];
  readonly timeline: TableView["lastTimeline"];
  readonly roundScore: number;
  readonly quota: number;
  /** The Blind on the table, and whether it opens on a boss intro. */
  readonly blindKey: string;
  readonly bossIntro: boolean;
  /** The moves logged so far, the last being the one just made. */
  readonly actions: readonly RunAction[];
}

/**
 * The named events between two moments of a run (#3434). Nothing is emitted
 * unless the table recorded a new event, so a refused or repeated render
 * emits nothing; a refused move emits nothing either.
 */
export function sessionEvents(
  previous: SessionMoment | null,
  next: SessionMoment
): TrialAndErrorEvent[] {
  const event = next.event;
  if (!previous || !event) return [];
  if (previous.event?.sequence === event.sequence) return [];
  if (event.kind === "REFUSED") return [];
  const events: TrialAndErrorEvent[] = [];
  if (event.kind === "PLAYED") {
    const total = next.timeline?.find((step) => step.kind === "TOTAL");
    events.push({
      type: "handScored",
      score: total?.kind === "TOTAL" ? total.score : 0,
    });
    const zero = next.timeline?.find((step) => step.kind === "ZERO_RULE");
    if (zero?.kind === "ZERO_RULE") {
      events.push({ type: "fatalError", label: zero.label });
    }
  }
  if (next.outcome !== previous.outcome && next.outcome !== null) {
    const result = { roundScore: next.roundScore, quota: next.quota };
    if (next.outcome === "FAILED") {
      events.push({ type: "blindFailed", ...result });
    } else {
      events.push({ type: "blindCleared", ...result });
      if (next.outcome === "LOCKED") events.push({ type: "csrLocked" });
    }
  }
  if (event.kind === "LEVELED_UP" && event.levelUp) {
    events.push({ type: "levelUp", levelUp: event.levelUp });
  }
  if (event.kind === "SEALED") events.push({ type: "sealApplied" });
  const last = next.actions[next.actions.length - 1];
  if (
    next.actions.length > previous.actions.length &&
    last &&
    (last.type === "BUY" || last.type === "BUY_PACK")
  ) {
    events.push({
      type: "purchase",
      slot: last.slot,
      pack: last.type === "BUY_PACK",
    });
  }
  if (next.bossIntro && next.blindKey !== previous.blindKey) {
    events.push({ type: "bossIntro", blindKey: next.blindKey });
  }
  return events;
}

/** Calls `onEvent` with each named event as the run moves (#3434). */
function useSessionEvents(
  log: RunLog,
  view: TableView,
  runView: ReturnType<typeof deriveRunView>,
  onEvent: ((event: TrialAndErrorEvent) => void) | undefined
) {
  const moment: SessionMoment = {
    event: view.lastEvent,
    outcome: view.outcome,
    timeline: view.lastTimeline,
    roundScore: view.roundScore,
    quota: view.quota,
    blindKey: `${runView.seed}:${runView.actIndex}:${runView.blindIndex}:${runView.blind.id}`,
    bossIntro: view.bossIntro !== null,
    actions: log.actions,
  };
  const previousRef = useRef<SessionMoment | null>(null);
  const emit = useEffectEvent((next: SessionMoment) => {
    const events = sessionEvents(previousRef.current, next);
    previousRef.current = next;
    if (onEvent) events.forEach(onEvent);
  });
  // After every render: sessionEvents emits only when the table recorded a
  // new event, so a render with nothing new costs one comparison.
  useEffect(() => {
    emit(moment);
  });
}

/** The table's inputs, as CardTable's props give them. */
interface TrialAndErrorSessionOptions {
  readonly act?: RunPlan;
  readonly scenario?: Scenario;
  readonly seed?: string;
  readonly persist: boolean;
  readonly endAction?: (won: boolean) => {
    label: string;
    onSelect: () => void;
  };
  readonly onTableChange?: (table: TableState) => void;
  /** Called with each named session event (#3434). */
  readonly onEvent?: (event: TrialAndErrorEvent) => void;
}

/**
 * The Trial & Error session (#3434): the run reducer and its log, the
 * saved run and the Resume choice, the save, Codex, campaign-win, daily
 * and trophy glue, the challenge link and the derived run and table
 * views. Moved verbatim from CardTable.tsx; it also emits the named
 * session events. The table renders what it returns.
 */
export function useTrialAndErrorSession(options: TrialAndErrorSessionOptions) {
  const {
    act: actProp,
    scenario: single,
    seed,
    persist,
    endAction,
    onTableChange,
    onEvent,
  } = options;
  const act = useMemo<RunPlan>(
    () =>
      actProp ??
      (single
        ? { id: single.id, title: single.title, blinds: [single] }
        : BIOSTAT_OPS_CAMPAIGN),
    [actProp, single]
  );
  const [{ run, log }, dispatch] = useReducer(
    (current: LoggedRun, intent: TableIntent) => logRun(act, current, intent),
    act,
    (a: RunPlan): LoggedRun => {
      const start = seed === undefined ? initialSeed() : { seed };
      const run = createRunState(a, start.seed);
      return {
        run,
        log: {
          actId: a.id,
          seed: run.seed,
          ...(start.origin ? { origin: start.origin } : {}),
          actions: [],
        },
      };
    }
  );
  const saved = useSavedRun(act, persist);
  // A save found on arrival waits for Resume or New run; until then nothing
  // is written, so the save is never overwritten before the choice.
  const [resumeChoice, setResumeChoice] = useState<
    "PENDING" | "CONFIRM_NEW" | "DONE"
  >("PENDING");
  const offerResume =
    persist &&
    saved !== null &&
    resumeChoice !== "DONE" &&
    log.actions.length === 0;

  const runView = deriveRunView(act, run);
  // A won campaign that can still go on into post-marketing is not over
  // until the player chooses.
  const runOver =
    runView.phase === "RUN_FAILED" ||
    (runView.phase === "RUN_WON" && !runView.endless?.canContinue);
  const endlessRound = runView.endless?.round ?? null;
  // The act being played: its shop runs between its Blinds. In
  // post-marketing this is the round's study, past the planned acts (#2330).
  const currentAct = currentRunAct(act, run);
  // A campaign with post-marketing rounds is won once, whatever act shows.
  const wonLabel =
    runView.act.count > 1 || runView.endless
      ? "Campaign won"
      : `${runView.act.title} complete`;
  // Keep this browser's save in step with the run: written after each move,
  // removed when the run ends or a new one starts. Never while a found save
  // still waits for the player's choice.
  useEffect(() => {
    if (!persist || offerResume) return;
    if (runOver || log.actions.length === 0) {
      clearRunSave(log.actId);
    } else {
      writeRunSave(log);
    }
  }, [persist, offerResume, runOver, log]);
  // The Codex (#1529) records what this browser's runs have shown, and each
  // finished run's summary. Only a persisted campaign table keeps one; the
  // guided Blind and embedded tables never write it.
  const codexEnabled = persist && !endAction;
  const codex = useCodex(codexEnabled);
  const logOrigin = log.origin;
  useEffect(() => {
    if (!codexEnabled || offerResume) return;
    updateCodex((current) =>
      recordDiscoveries(current, act, run, {
        actId: log.actId,
        seed: log.seed,
        ...(logOrigin ? { origin: logOrigin } : {}),
      })
    );
  }, [codexEnabled, offerResume, act, run, log.actId, log.seed, logOrigin]);
  // A run that continues into post-marketing records its campaign win then,
  // so the win and its unlocks survive the run being abandoned (#2331). The
  // run's own end replaces this entry in the history.
  const continuedRun = run.endless && !runOver;
  const recordedWin = useRef<RunLog | null>(null);
  useEffect(() => {
    if (!codexEnabled || offerResume || !continuedRun) return;
    const previous = recordedWin.current;
    recordedWin.current = log;
    // One run's later moves keep the same win: summarize it once per run.
    if (
      previous &&
      previous.seed === log.seed &&
      previous.actId === log.actId &&
      previous.actions.length <= log.actions.length &&
      previous.actions.every((a, i) => a === log.actions[i])
    ) {
      return;
    }
    const win = summarizeCampaignWin(act, log, utcDate(Date.now()));
    if (win) updateCodex((current) => recordRun(current, win));
  }, [codexEnabled, offerResume, continuedRun, act, log]);
  // A finished run is summarized once, from its log, into the history.
  const recordedRun = useRef<RunLog | null>(null);
  useEffect(() => {
    if (!codexEnabled || offerResume || !runOver) return;
    if (log.actions.length === 0 || recordedRun.current === log) return;
    recordedRun.current = log;
    const entry = summarizeRun(act, log, utcDate(Date.now()));
    if (!entry) return;
    updateCodex((current) => recordRun(current, entry));
    // A Daily Protocol run is Trial & Error's Arcade Daily (#2113).
    if (entry.origin?.kind === "DAILY") {
      recordArcadeDailyResult("trial-and-error", entry.origin.date, {
        score: entry.bestHand?.score ?? 0,
      });
    }
  }, [codexEnabled, offerResume, runOver, act, log]);
  const scenario = runView.blind;
  // The reducer state goes only to domain helpers and the tutorial; every
  // render decision reads the derived view (#996).
  const tableState = run.table;
  useEffect(() => {
    onTableChange?.(tableState);
  }, [onTableChange, tableState]);
  const view = runView.table;

  // Sync round score with the arcade achievements system
  useEffect(() => {
    if (view.roundScore > 0) {
      recordArcadeScore("trial-and-error", view.roundScore);
    }
  }, [view.roundScore]);

  // Trophies follow progress through the run, not the round score: one
  // Small Blind hand already scores thousands (#2047).
  const bossBlind = scenario.blind.tier === "BOSS_BLIND";
  const campaignRun = runView.act.count > 1;
  useEffect(() => {
    if (runView.phase === "BLIND_CLEARED") {
      recordArcadeMilestone("trial-and-error", "blind_cleared");
      if (bossBlind && campaignRun) {
        recordArcadeMilestone("trial-and-error", "act_cleared");
      }
    } else if (runView.phase === "RUN_WON") {
      recordArcadeMilestone("trial-and-error", "blind_cleared");
      // A single-act table (the guided Blind, a custom deck) is not a run.
      if (!campaignRun) return;
      recordArcadeMilestone("trial-and-error", "act_cleared");
      recordArcadeMilestone("trial-and-error", "run_won");
    }
  }, [runView.phase, bossBlind, campaignRun]);

  // A challenge link opens the New Run dialog on a persisted table, once any
  // saved run's Resume choice is made; the guided Blind never takes one.
  const hashChallenge = useChallengeHash();
  const challenge = persist && !endAction ? hashChallenge : null;

  useSessionEvents(log, view, runView, onEvent);

  return {
    act,
    challenge,
    codex,
    codexEnabled,
    currentAct,
    dispatch,
    endlessRound,
    log,
    offerResume,
    resumeChoice,
    runOver,
    runView,
    saved,
    scenario,
    setResumeChoice,
    tableState,
    view,
    wonLabel,
  };
}
