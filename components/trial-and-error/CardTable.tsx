"use client";

import React, {
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, Reorder } from "framer-motion";
import {
  BIOSTAT_OPS_CAMPAIGN,
  CLINICAL_HOLD,
  CPU_COSTS,
  HAND_LEVEL_BONUS,
  HAND_NAMES,
  STALE_ALERT,
  advanceRun,
  cardShortName,
  consumableSellValue,
  costOf,
  createRunState,
  planActs,
  deriveRunView,
  previewAllocation,
  type ClockAction,
  type CpuAction,
  type FootnoteSeal,
  type RestoredRun,
  SEAL_DRAG_TYPE,
  type RunAction,
  type RunPlan,
  type RunLog,
  type RunState,
  type Scenario,
  type TableCardView,
  type TableEvent,
  type TableState,
  RELIC_PHASE_LABELS,
  relicPhase,
} from "@/lib/trial-and-error";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import { isAnyFocusTrapActive, useFocusTrap } from "@/hooks/useFocusTrap";
import { FieldManualButton } from "@/components/FieldManualButton";
import { QcDesk } from "@/components/trial-and-error/QcDesk";
import { FigureDesk } from "@/components/trial-and-error/FigureDesk";
import { CrisisPanel } from "@/components/trial-and-error/CrisisPanel";
import { LevelUpPlate } from "@/components/trial-and-error/LevelUpPlate";
import {
  clearRunSave,
  useSavedRun,
  writeRunSave,
} from "@/components/trial-and-error/useRunSave";
import { RunInfo } from "@/components/trial-and-error/RunInfo";
import { ScoreLog } from "@/components/trial-and-error/ScoreLog";
import { HandCheatSheet } from "@/components/trial-and-error/HandCheatSheet";
import { ActIntro } from "@/components/trial-and-error/ActIntro";
import { BossIntro } from "@/components/trial-and-error/BossIntro";
import { FdaClock } from "@/components/trial-and-error/FdaClock";
import { CsrSlots } from "@/components/trial-and-error/CsrSlots";
import { CsrLockSummary } from "@/components/trial-and-error/CsrLockSummary";
import { FirewallDialog } from "@/components/trial-and-error/FirewallDialog";
import { AmendmentDialog } from "@/components/trial-and-error/AmendmentDialog";
import { DeviationCard } from "@/components/trial-and-error/DeviationCard";
import { CashOut } from "@/components/trial-and-error/CashOut";
import { Shop } from "@/components/trial-and-error/Shop";
import {
  PackOpening,
  type RevealCard,
} from "@/components/trial-and-error/PackOpening";
import { CardBack } from "@/components/trial-and-error/cards/CardBack";
import { CardDetail } from "@/components/trial-and-error/cards/CardDetail";
import { POPULATION_LABEL } from "@/components/trial-and-error/cards/CardFace";
import { HandCard } from "@/components/trial-and-error/cards/HandCard";
import {
  useHandInteraction,
  type PendingFocus,
} from "@/components/trial-and-error/useHandInteraction";
import { handOverlap } from "@/components/trial-and-error/cards/hand-fit";
import { useRowWidthRem } from "@/components/trial-and-error/cards/useRowWidthRem";
import { STAMP_LABELS } from "@/components/trial-and-error/cards/Stamp";
import {
  ScoreBreakdown,
  ScorePlayer,
  useScorePlayback,
} from "@/components/trial-and-error/ScorePlayer";
import { useTeMotion } from "@/components/trial-and-error/useTeMotion";
import {
  LOUD_PRESETS,
  LoudLayer,
} from "@/components/trial-and-error/LoudLayer";
import { cueForStep, type TeCue } from "@/components/trial-and-error/teAudio";
import {
  useTeMusic,
  useTeSound,
} from "@/components/trial-and-error/useTeSound";

interface CardTableProps {
  /**
   * The act to play on its own, or the campaign whose acts are played in
   * order (#924). Defaults to the three-act campaign.
   */
  act?: RunPlan;
  /** Plays a single Blind instead of an act. */
  scenario?: Scenario;
  /**
   * The run seed. Without it the table replays the page's `?seed=`
   * parameter, or starts a fresh random seed.
   */
  seed?: string;
  /**
   * Saves the run to this browser after every move and offers to resume it
   * on the next visit (#1079). Off by default, so embedded and test tables
   * never share a save.
   */
  persist?: boolean;
  /**
   * A coach mark for the guided Blind (#1089). It shows above the table, or
   * inside the Inspect view while that is open, so it is always on screen.
   */
  coach?: React.ReactNode;
  /** Called with the table state after every move, for the guided Blind. */
  onTableChange?: (table: TableState) => void;
  /** Offers "Replay tutorial" in the Field Manual. */
  onReplayTutorial?: () => void;
  /**
   * Replaces Play again or Restart run when the run ends, as the guided Blind
   * does to hand over to the campaign.
   */
  endAction?: (won: boolean) => { label: string; onSelect: () => void };
}

/** The run and every move since it started: what a save replays. */
interface LoggedRun {
  run: RunState;
  log: RunLog;
}

/** A move, or a saved run replacing the fresh one on resume. */
type TableIntent = RunAction | { type: "LOAD_SAVED"; saved: RestoredRun };

function logRun(
  act: RunPlan,
  current: LoggedRun,
  intent: TableIntent
): LoggedRun {
  if (intent.type === "LOAD_SAVED") {
    return { run: intent.saved.run, log: intent.saved.log };
  }
  const run = advanceRun(act, current.run, intent);
  // A new run starts a new log; every other move joins the current one.
  if (intent.type === "RESTART_RUN") {
    return { run, log: { actId: act.id, seed: run.seed, actions: [] } };
  }
  return {
    run,
    log: { ...current.log, actions: [...current.log.actions, intent] },
  };
}

const SEED_PATTERN = /^[A-Za-z0-9-]{1,32}$/;

/** A fresh random run seed, drawn in the browser (the domain never draws one). */
function freshSeed(): string {
  const bytes = new Uint32Array(2);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36)).join("-");
}

/** The page's `?seed=` parameter when it is a valid seed, else a fresh one. */
function initialSeed(): string {
  try {
    const param = new URLSearchParams(window.location.search).get("seed");
    if (param && SEED_PATTERN.test(param)) return param;
  } catch {
    // No location (a test harness): fall through to a fresh seed.
  }
  return freshSeed();
}

const SPEEDS = [1, 2, 4] as const;
const FIGURE_SPACE = "\u2007";

const BUTTON_BASE =
  "min-h-[48px] px-4 py-3 border font-mono text-xs font-bold uppercase tracking-wider touch-manipulation active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-transparent disabled:text-zinc-400";

/** A seal's effect in a few words, for the tray. */
function sealSummary(seal: FootnoteSeal): string {
  switch (seal.effect.kind) {
    case "PLUS_CHIPS":
      return `+${seal.effect.value} Chips`;
    case "PLUS_MULT":
      return `+${seal.effect.value} Mult`;
    case "WAIVE":
      return "Waiver";
  }
}

/** An action's CPU cost this Blind: a discard may carry a modifier's penalty. */
const costFor = (action: CpuAction, discardCost: number): number =>
  action === "DISCARD" ? discardCost : costOf(action);

const COST_NAMES: Record<CpuAction, string> = {
  PLAY_HAND: "Play Hand",
  DISCARD: "Discard",
  INSPECT: "Inspect",
  RECOMPILE: "Recompile",
};

function cardLabel(view: TableCardView, partners: string[] = []): string {
  const { card } = view;
  const parts = [
    `${card.number}, ${card.title}`,
    `${card.cardType.toLowerCase()}`,
    view.blank
      ? `empty shell, accepts ${view.compatiblePopulations.map((p) => POPULATION_LABEL[p]).join(" or ")} data, press A to allocate`
      : `${POPULATION_LABEL[card.population]} population`,
    `${card.chips} Chips`,
  ];
  if (view.debuffed) parts.push("disabled by the boss, scores 0 Chips");
  if (view.stale) {
    parts.push(
      `stale, compiled against ${view.provenance.id}, scores 0 Chips until recompiled`
    );
  }
  if (view.faceDown) {
    parts.push(
      "face down, blinded in the DMC open session, press S for structural QC"
    );
  }
  if (view.structural) {
    const passed = view.structural.checks.filter((c) => c.passed).length;
    parts.push(
      `structural QC ${passed} of ${view.structural.checks.length} checks pass`
    );
  }
  if (view.unverified) parts.push("unverified");
  if (view.inspected) {
    parts.push(
      view.openRedlines > 0
        ? `${view.openRedlines} open redline${view.openRedlines === 1 ? "" : "s"}`
        : "inspected"
    );
  }
  parts.push(...view.stamps.map((stamp) => STAMP_LABELS[stamp]));
  for (const seal of view.seals) parts.push(`footnote seal: ${seal.name}`);
  if (partners.length > 0)
    parts.push(`TLF Pair with ${partners.join(" and ")}`);
  if (view.selected) parts.push("selected");
  return parts.join(", ");
}

const PROMPT_BUTTON =
  "min-h-[44px] border px-4 text-xs font-bold uppercase touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]";

/** A saved run's act and Blind, e.g. "Act II: ... · Internal QC". */
function resumedView(saved: RestoredRun): string {
  const view = deriveRunView(saved.act, saved.run);
  return `${view.act.title}: ${view.blind.blind.name}`;
}

/**
 * The start view when this browser holds a saved run (#1079): Resume run,
 * or New run after a confirmation, since starting over discards the save.
 */
function ResumePrompt({
  saved,
  confirming,
  onResume,
  onNew,
  onConfirmNew,
  onCancelNew,
}: {
  saved: RestoredRun;
  confirming: boolean;
  onResume: () => void;
  onNew: () => void;
  onConfirmNew: () => void;
  onCancelNew: () => void;
}) {
  const view = deriveRunView(saved.act, saved.run);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    (confirming ? confirmRef : resumeRef).current?.focus();
  }, [confirming]);
  return (
    <section
      aria-labelledby="resume-heading"
      className="mx-auto max-w-xl border border-zinc-800 bg-[color:var(--te-surface-1)] p-4 text-left sm:p-6"
      data-testid="resume-run"
    >
      <h2
        id="resume-heading"
        className="text-sm font-bold uppercase tracking-wider text-zinc-100"
      >
        Resume your run?
      </h2>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
        <dt className="text-zinc-400">Act</dt>
        <dd className="min-w-0 text-zinc-200 break-words">{view.act.title}</dd>
        <dt className="text-zinc-400">Blind</dt>
        <dd className="min-w-0 text-zinc-200 break-words">
          {view.blind.blind.name}
        </dd>
        <dt className="text-zinc-400">Seed</dt>
        <dd className="min-w-0 font-mono text-zinc-200 break-all">
          {view.seed}
        </dd>
      </dl>
      {confirming ? (
        <div
          role="group"
          aria-label="Confirm a new run"
          className="mt-4 border border-rose-500/60 p-3 text-xs text-zinc-200"
          data-testid="resume-confirm-new"
        >
          <p className="break-words">
            Start a new run? The saved run will be discarded.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirmNew}
              className={`${PROMPT_BUTTON} border-rose-400 text-rose-300 hover:bg-rose-500/10`}
            >
              Discard and start new
            </button>
            <button
              type="button"
              onClick={onCancelNew}
              className={`${PROMPT_BUTTON} border-zinc-600 text-zinc-300 hover:bg-zinc-800`}
            >
              Keep saved run
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            ref={resumeRef}
            type="button"
            onClick={onResume}
            className={`${PROMPT_BUTTON} border-emerald-500 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20`}
          >
            Resume run
          </button>
          <button
            type="button"
            onClick={onNew}
            className={`${PROMPT_BUTTON} border-zinc-600 text-zinc-300 hover:bg-zinc-800`}
          >
            New run
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * The Card Table: the game's main screen (T&E-UX-01). A thin adapter over
 * the pure run and table reducers in `@/lib/trial-and-error`; it renders the
 * derived view, dispatches intents, and never computes a score. It plays an
 * act's Blinds in order (T&E-02).
 */
export function CardTable({
  act: actProp,
  scenario: single,
  seed,
  persist = false,
  coach,
  onTableChange,
  onReplayTutorial,
  endAction,
}: CardTableProps) {
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
      const run = createRunState(a, seed ?? initialSeed());
      return { run, log: { actId: a.id, seed: run.seed, actions: [] } };
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
  // The act being played: its shop runs between its Blinds.
  const currentAct = planActs(act)[runView.actIndex];
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
  const scenario = runView.blind;
  // The reducer state goes only to domain helpers and the tutorial; every
  // render decision reads the derived view (#996).
  const tableState = run.table;
  useEffect(() => {
    onTableChange?.(tableState);
  }, [onTableChange, tableState]);
  const view = runView.table;
  // Stable effect inputs: the ids keep their identity until the hand changes.
  const handIds = view.handIds;
  const status = view.status;
  const hasCrisis = view.crisis !== null;
  const shopOpen = runView.shop !== null;
  const numbersOf = (ids: readonly string[]) =>
    ids
      .map((id) => {
        const card = scenario.deck.find((c) => c.id === id);
        return card ? cardShortName(card) : id;
      })
      .join(", ");
  const { announce } = useAnnouncer();
  const {
    reducedMotion,
    speed,
    setSpeed,
    loudEffectsEnabled,
    isCompactViewport,
  } = useTeMotion();
  const animateCards = !reducedMotion;
  const physical = !reducedMotion && !isCompactViewport;
  const [handWidthRem, handRef] = useRowWidthRem();
  const timeline = view.lastTimeline;
  const sound = useTeSound();
  const playback = useScorePlayback(timeline, view.lastPlay, {
    speed,
    reducedMotion,
    onStep: (_step, index) => {
      const cue = timeline && cueForStep(timeline, index);
      if (cue) sound.play(cue.cue, { step: cue.step });
    },
  });
  const playing = playback.playing;
  useTeMusic({
    enabled: sound.musicEnabled,
    siteMuted: sound.siteMuted,
    boss: scenario.blind.tier === "BOSS_BLIND",
    ducked: playing,
  });
  const progressStep = timeline?.[timeline.length - 1];
  const progress =
    progressStep?.kind === "BLIND_PROGRESS" ? progressStep : undefined;
  // The Blind's round score ticks over when the TOTAL step lands.
  const displayedRound =
    playing && progress && playback.shown < (timeline?.length ?? 0) - 1
      ? progress.before
      : view.roundScore;
  const flashCleared =
    playing &&
    progress?.crossed === true &&
    playback.shown === (timeline?.length ?? 0);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [runInfoOpen, setRunInfoOpen] = useState(false);
  const [handSheetOpen, setHandSheetOpen] = useState(false);
  /** The relic waiting for a sale to be confirmed, in the shop. */
  const [sellRelicId, setSellRelicId] = useState<string | null>(null);
  const shopView = runView.shop;
  const sellingRelic = shopView
    ? (view.relics.find((r) => r.id === sellRelicId) ?? null)
    : null;
  /** The face-down output the firewall dialog is asking about. */
  const [peekId, setPeekId] = useState<string | null>(null);
  const [amendingId, setAmendingId] = useState<string | null>(null);
  // Every Boss Blind opens on its intro card until it is dismissed.
  const bossIntroKey = `${runView.seed}:${runView.actIndex}:${runView.blindIndex}:${scenario.id}`;
  const [bossIntroSeen, setBossIntroSeen] = useState<string | null>(null);
  const showBossIntro =
    view.bossIntro !== null &&
    view.status === "REVIEWING" &&
    view.untouched &&
    bossIntroSeen !== bossIntroKey;
  // A new study opens on its act card until it is dismissed (#924).
  const actIntroKey = `${runView.seed}:${runView.actIndex}`;
  const [actIntroSeen, setActIntroSeen] = useState<string | null>(null);
  const showActIntro =
    runView.actIntro !== null && view.untouched && actIntroSeen !== actIntroKey;
  const playBossStinger = useEffectEvent(() => sound.play("bossStinger"));
  // Dismissing the intro hands focus to the table: a crisis's first choice
  // when one must be answered first, otherwise the first card in hand.
  const focusTable = useEffectEvent(() => {
    if (view.crisis) {
      crisisRef.current?.focus();
      return;
    }
    const first = view.handIds[0];
    if (first) cardRefs.current.get(first)?.focus();
  });
  const playActCue = useEffectEvent(() => sound.play("cardDeal"));
  const bossIntroOpen = useRef(false);
  useEffect(() => {
    if (showBossIntro) {
      bossIntroOpen.current = true;
      playBossStinger();
    } else if (showActIntro) {
      bossIntroOpen.current = true;
      playActCue();
    } else if (bossIntroOpen.current) {
      bossIntroOpen.current = false;
      focusTable();
    }
  }, [showBossIntro, showActIntro]);
  const detailView = view.hand.find((h) => h.card.id === detailId);

  const sectionRef = useRef<HTMLElement>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const allocateRef = useRef<HTMLButtonElement>(null);
  const crisisRef = useRef<HTMLButtonElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const deskFocusRef = useRef<HTMLElement | null>(null);
  const pendingFocus = useRef<PendingFocus>(null);

  const closeInspect = () => {
    if (view.inspecting) {
      pendingFocus.current = { kind: "card", cardId: view.inspecting };
    }
    dispatch({ type: "CLOSE_INSPECT" });
  };

  const inspected = view.inspection ?? view.figureInspection;
  const figureFace = view.figureInspection
    ? view.hand.find((h) => h.card.id === view.figureInspection?.card.id)?.face
    : undefined;
  const figureParentFace = view.figureInspection?.parent
    ? (view.hand.find((h) => h.card.id === view.figureInspection?.parent?.id)
        ?.face ?? null)
    : null;

  const drawerRef = useFocusTrap<HTMLDivElement>(inspected !== null, {
    onEscape: closeInspect,
    initialFocusRef: deskFocusRef,
    returnFocus: false,
  });

  const detailRef = useFocusTrap<HTMLDivElement>(detailView !== undefined, {
    onEscape: () => setDetailId(null),
  });

  const send = (action: RunAction, focus: PendingFocus = null) => {
    pendingFocus.current = focus;
    dispatch(action);
  };

  // A played hand is announced once, as a summary, after its timeline
  // resolves, so screen readers are not flooded while it plays.
  const playEventCues = useEffectEvent((kind: TableEvent["kind"]) => {
    const cues: Partial<Record<typeof kind, TeCue[]>> = {
      SELECTED: ["cardSelect"],
      DESELECTED: ["cardDeselect"],
      DISCARDED: ["discardWhoosh", "cardDeal"],
      PLAYED: ["cardDeal"],
      INSPECT_OPENED: ["cardFlip"],
      RECOMPILED: ["cardFlip"],
      ALLOCATED: ["cardFlip"],
      SEALED: ["multThunk"],
      SOLD: ["sell"],
      LEVELED_UP: ["chipTick", "multThunk"],
      CRISIS_RESOLVED: ["cardFlip"],
      AMENDED: ["cardFlip"],
    };
    cues[kind]?.forEach((cue) => sound.play(cue));
    if (kind === "PLAYED" || kind === "DISCARDED") {
      // The lock is the run's victory: it gets its own cue and the flame.
      if (view.outcome === "LOCKED") {
        sound.play("csrLocked");
        sound.play("fireIgnite");
      } else if (view.outcome === "CLEARED") sound.play("blindCleared");
      if (view.outcome === "FAILED") sound.play("blindFailed");
    }
  });

  useEffect(() => {
    if (!view.lastEvent || playing) return;
    announce(view.lastEvent.message);
    playEventCues(view.lastEvent.kind);
  }, [view.lastEvent, announce, playing]);

  useEffect(() => {
    if (playing) {
      skipRef.current?.focus();
      return;
    }
    if (status !== "REVIEWING") {
      // The shop and pack reveals manage their own focus.
      if (!shopOpen) restartRef.current?.focus();
      return;
    }
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    // A crisis must be answered first, so focus goes to its first choice.
    if (hasCrisis) {
      crisisRef.current?.focus();
      return;
    }
    const cardId =
      target.kind === "card"
        ? target.cardId
        : handIds[Math.min(target.index, handIds.length - 1)];
    if (cardId) cardRefs.current.get(cardId)?.focus();
  }, [view.lastEvent?.sequence, status, handIds, hasCrisis, playing, shopOpen]);

  // Shift+R opens Run Info from anywhere in the table; a plain R on a card
  // stays Recompile. A dialog already open keeps the key to itself.
  const onWindowKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== "R" || !event.shiftKey) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (runInfoOpen || isAnyFocusTrapActive()) return;
    const focused = document.activeElement;
    if (!focused || !sectionRef.current?.contains(focused)) return;
    if (focused.closest("input, textarea, select, [contenteditable]")) return;
    event.preventDefault();
    setRunInfoOpen(true);
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onWindowKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // H opens the hand cheat sheet from anywhere in the table. Elsewhere on the
  // site H opens the Field Manual from a window listener; this one sits on
  // the table itself and stops the key there, so inside the table H is the
  // cheat sheet and ? (off a card) or the Manual button is the manual. The
  // sheet closes itself on H.
  const onSectionKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key.toLowerCase() !== "h" || event.shiftKey) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable]")) return;
    if (!handSheetOpen && isAnyFocusTrapActive()) return;
    event.preventDefault();
    event.stopPropagation();
    setHandSheetOpen((open) => !open);
  });
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const listener = (event: KeyboardEvent) => onSectionKeyDown(event);
    section.addEventListener("keydown", listener);
    return () => section.removeEventListener("keydown", listener);
    // The resume prompt renders in place of the table, so attach once it goes.
  }, [offerResume]);

  const amending = amendingId
    ? (view.amendmentPreviews.find(
        (p) => p.consumableId === amendingId && p.refusal === null
      ) ?? null)
    : null;
  const peekCard = peekId
    ? (view.hand.find((h) => h.card.id === peekId && h.faceDown) ?? null)
    : null;
  const inspect = (cardId: string | undefined) => {
    if (!cardId) return;
    // Viewing a face-down output is an unblinding: confirm it first.
    if (view.hand.find((h) => h.card.id === cardId)?.faceDown) {
      setPeekId(cardId);
      return;
    }
    send({ type: "INSPECT_CARD", cardId });
  };
  const structural = (cardId: string | undefined) => {
    if (cardId) {
      send({ type: "STRUCTURAL_QC", cardId }, { kind: "card", cardId });
    }
  };
  const recompile = (cardId: string | undefined) => {
    if (cardId) send({ type: "RECOMPILE", cardId }, { kind: "card", cardId });
  };
  const {
    activeIndex,
    setFocusIndex,
    handOrder,
    setDragOrder,
    armed,
    toggleArmed,
    releaseSeal,
    play,
    discard,
    bindCard,
  } = useHandInteraction({
    view,
    playing,
    send,
    announce,
    cardRefs,
    onRead: setDetailId,
    onInspect: inspect,
    onRecompile: recompile,
    onStructural: structural,
    onFocusAllocate: () => allocateRef.current?.focus(),
  });
  const focusedCard = view.hand[activeIndex];

  // A desktop hand overlaps to fit its row; phones keep the scroll strip.
  const overlap = handOverlap({
    count: handOrder.length,
    cardRem: isCompactViewport ? 9 : 10,
    widthRem: isCompactViewport ? 0 : handWidthRem,
    fan: physical,
  });
  const handCards = handOrder.map((id, index) => {
    const h = view.hand.find((c) => c.card.id === id);
    if (!h) return null;
    return (
      <HandCard
        key={id}
        view={h}
        index={index}
        count={handOrder.length}
        overlap={overlap}
        physical={physical}
        animate={animateCards}
        label={cardLabel(
          h,
          h.pairedWith.map(
            (pid) =>
              view.hand.find((c) => c.card.id === pid)?.card.number ?? pid
          )
        )}
        buttonRef={(el) => {
          if (el) cardRefs.current.set(id, el);
          else cardRefs.current.delete(id);
        }}
        interaction={bindCard(id)}
      />
    );
  });

  const preview = view.preview;
  const slashed =
    preview !== null && preview.finalMult < view.previewUnpenalizedMult;
  // The domain already classified against the stage: a hand outside the
  // accepted list means none of them is in the selection.
  const stageRefuses =
    view.stageAccepts !== null &&
    view.classification !== null &&
    !view.stageAccepts.includes(view.classification.handType);
  const cpuPips = Array.from(
    { length: view.cpuAllocation },
    (_, i) => i < view.cpu.available
  );
  const allocation =
    focusedCard?.blank && view.status === "REVIEWING"
      ? previewAllocation(scenario, tableState, focusedCard.card.id)
      : [];
  // Why a costed button the player has something selected for is disabled.
  const costNotes = (
    [
      // The play blocker line already says when CPU stops Play Hand.
      ["PLAY_HAND", view.selected.length > 0 && !view.playBlocker],
      ["DISCARD", view.selected.length > 0],
      ["INSPECT", focusedCard?.inspectable && !focusedCard.inspected],
      ["RECOMPILE", focusedCard?.stale],
    ] as const
  )
    .filter(
      ([action, wanted]) =>
        wanted && view.cpu.available < costFor(action, view.discardCost)
    )
    .map(
      ([action]) =>
        `${COST_NAMES[action]} needs ${costFor(action, view.discardCost)} CPU; ${view.cpu.available} left.`
    );
  // An FDA Information Request's clock: what each costed move takes.
  const clock = view.clock;
  const hoursFor = (action: ClockAction): string =>
    clock ? ` · ${clock.costs[action]}h` : "";
  if (clock && view.status === "REVIEWING") {
    for (const [action, name, wanted] of [
      ["DISCARD", "Discard", view.selected.length > 0],
      [
        "INSPECT",
        "Inspect",
        focusedCard?.inspectable && !focusedCard.inspected,
      ],
    ] as const) {
      if (wanted && clock.hoursLeft < clock.costs[action]) {
        costNotes.push(
          `${name} takes ${clock.costs[action]} hours; ${clock.hoursLeft} left.`
        );
      }
    }
  }
  const costDescribedBy = costNotes.length > 0 ? "cpu-note" : undefined;
  const playDescribedBy =
    [view.playBlocker ? "play-blocker" : null, costDescribedBy]
      .filter(Boolean)
      .join(" ") || undefined;

  if (offerResume && saved) {
    return (
      <ResumePrompt
        saved={saved}
        confirming={resumeChoice === "CONFIRM_NEW"}
        onResume={() => {
          setResumeChoice("DONE");
          dispatch({ type: "LOAD_SAVED", saved });
          announce(`Resumed ${resumedView(saved)}.`);
        }}
        onNew={() => setResumeChoice("CONFIRM_NEW")}
        onConfirmNew={() => {
          setResumeChoice("DONE");
          clearRunSave(act.id);
          announce("Saved run discarded. New run started.");
        }}
        onCancelNew={() => setResumeChoice("PENDING")}
      />
    );
  }

  return (
    <section
      ref={sectionRef}
      aria-labelledby="card-table-heading"
      className="relative w-full min-w-0 bg-[color:var(--te-surface-0)] font-mono text-[color:var(--te-text)] border border-zinc-800 section-isolate"
    >
      <LoudLayer loud={playing} enabled={loudEffectsEnabled} />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="min-w-0">
          <h2
            id="card-table-heading"
            className="text-sm font-bold uppercase tracking-wider break-words"
          >
            Card Table · {scenario.title}
          </h2>
          <p className="text-xs text-zinc-400 break-words">
            {scenario.summary}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Cabinet audio"
            className="flex flex-wrap items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
          >
            {sound.siteMuted && (
              <button
                type="button"
                onClick={sound.unmuteSite}
                className="min-h-[44px] border border-zinc-600 px-3 text-zinc-200 touch-manipulation hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                Sound off · Unmute
              </button>
            )}
            {(
              [
                ["SFX", sound.sfxEnabled, sound.setSfxEnabled],
                ["Music", sound.musicEnabled, sound.setMusicEnabled],
              ] as const
            ).map(([label, on, set]) => (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                onClick={() => set(!on)}
                className={`min-h-[44px] border px-3 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  on
                    ? "border-amber-400 bg-amber-500/10 text-amber-300"
                    : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setRunInfoOpen(true)}
            aria-haspopup="dialog"
            aria-keyshortcuts="Shift+R"
            className="min-h-[44px] border border-zinc-600 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-200 touch-manipulation hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
            data-testid="run-info-button"
          >
            Run Info [Shift+R]
          </button>
          <button
            type="button"
            onClick={() => setHandSheetOpen(true)}
            aria-haspopup="dialog"
            aria-keyshortcuts="H"
            className="min-h-[44px] border border-zinc-600 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-200 touch-manipulation hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
            data-testid="hand-sheet-button"
          >
            Hands [H]
          </button>
          <FieldManualButton
            manualId="trial-and-error"
            label="Manual"
            action={
              onReplayTutorial
                ? {
                    label: "Replay tutorial",
                    description:
                      "Play the guided Blind again: one hand, step by step.",
                    onSelect: onReplayTutorial,
                  }
                : undefined
            }
          />
        </div>
      </header>
      {coach && !inspected && (
        <div className="border-b border-zinc-800 p-3">{coach}</div>
      )}

      <div className="grid gap-px bg-zinc-800 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <aside
          aria-label="Blind"
          className="min-w-0 bg-[color:var(--te-surface-1)] p-3 text-xs"
        >
          <p className="text-[10px] uppercase tracking-wider text-zinc-400 tabular-nums">
            {runView.act.title} · Blind {runView.blindIndex + 1} of{" "}
            {runView.blindCount}
          </p>
          <p
            className="font-bold uppercase tracking-wider text-zinc-300 break-words"
            data-testid="blind-name"
          >
            {scenario.blind.name}
          </p>
          {view.modifiers.map((modifier) => {
            const isBoss = modifier.id === scenario.boss?.id;
            return (
              <p
                key={modifier.id}
                className={`mt-2 border p-2 break-words ${isBoss ? "border-rose-400/60 text-rose-200" : "border-amber-400/60 text-amber-200"}`}
                data-testid={isBoss ? "boss-modifier" : "blind-modifier"}
              >
                <span className="block font-bold uppercase tracking-wider">
                  {isBoss ? "Boss" : "Crisis"}: {modifier.name}
                </span>
                {modifier.description}
              </p>
            );
          })}
          {view.deviation && (
            <p
              className="mt-2 border border-amber-400/60 p-2 text-amber-200 break-words"
              data-testid="deviation-note"
            >
              <span className="block font-bold uppercase tracking-wider">
                Deviation: {view.deviation.name}
              </span>
              After hand {view.deviation.afterHands}, {view.deviation.subjectId}{" "}
              left{" "}
              {view.deviation.populations
                .map((p) => POPULATION_LABEL[p])
                .join(", ")}
              .{" "}
              {view.deviation.staled.length === 1
                ? "1 output went stale."
                : `${view.deviation.staled.length} outputs went stale.`}
            </p>
          )}
          {view.dmcCharter !== null && (
            <div
              className="mt-2 border border-zinc-700 p-2"
              data-testid="dmc-session"
            >
              <p className="flex min-w-0 items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wider text-zinc-400">
                  DMC session
                </span>
                <span
                  className={`border px-1 font-bold tracking-widest ${view.session === "OPEN" ? "border-zinc-500 text-zinc-300" : "border-emerald-400 text-emerald-300"}`}
                  data-testid="session-badge"
                  data-session={view.session}
                >
                  {view.session}
                </span>
              </p>
              <button
                type="button"
                onClick={() =>
                  send({
                    type: "SET_SESSION",
                    session: view.session === "OPEN" ? "CLOSED" : "OPEN",
                  })
                }
                disabled={view.sessionRefusal !== null || playing}
                aria-describedby={
                  view.sessionRefusal ? "session-note" : undefined
                }
                className={`${BUTTON_BASE} mt-2 w-full border-emerald-500 text-emerald-300 hover:bg-emerald-500/10`}
                data-testid="session-toggle"
              >
                {view.session === "OPEN"
                  ? "Convene closed session"
                  : "Return to open session"}
              </button>
              {view.sessionRefusal && (
                <p
                  id="session-note"
                  className="mt-1 text-zinc-400 break-words"
                  data-testid="session-note"
                >
                  {view.sessionRefusal}
                </p>
              )}
              {view.pendingViolations.length > 0 && (
                <p
                  className="mt-1 font-bold text-rose-300 break-words"
                  data-testid="violation-note"
                >
                  Unblinding logged: the next hand scores ×0 Mult.
                </p>
              )}
            </div>
          )}
          {view.encounter && (
            <ol
              aria-label="DMC milestone stages"
              className="mt-2 space-y-1"
              data-testid="encounter-stages"
            >
              {view.encounter.stages.map((stage) => (
                <li
                  key={stage.name}
                  aria-current={stage.status === "ACTIVE" ? "step" : undefined}
                  className={`border p-2 break-words ${stage.status === "ACTIVE" ? "border-amber-400/60" : stage.status === "DEFENDED" ? "border-emerald-500/60" : "border-zinc-700"}`}
                  data-testid="encounter-stage"
                  data-status={stage.status}
                >
                  <span className="block font-bold uppercase tracking-wider text-zinc-200">
                    {stage.name}
                  </span>
                  <span className="block text-zinc-400 tabular-nums">
                    {stage.session} session · {stage.score} of {stage.quota} ·{" "}
                    <span
                      className={
                        stage.status === "DEFENDED"
                          ? "text-emerald-300"
                          : stage.status === "ACTIVE"
                            ? "text-amber-300"
                            : "text-zinc-400"
                      }
                    >
                      {stage.status === "DEFENDED"
                        ? "Defended"
                        : stage.status === "ACTIVE"
                          ? "In play"
                          : "Pending"}
                    </span>
                  </span>
                  <span className="block text-zinc-400">
                    {stage.hands.map((h) => HAND_NAMES[h]).join(", ")}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {clock && <FdaClock clock={clock} questions={view.questions} />}
          {runView.showIntro && (
            <p
              className="mt-2 border border-zinc-700 p-2 text-zinc-300 break-words"
              data-testid="blind-intro"
            >
              {scenario.intro}
            </p>
          )}
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
            <dt className="text-zinc-400">Target</dt>
            <dd
              className="text-right text-[color:var(--te-plus-mult)]"
              data-testid="round-target"
            >
              {view.quota}
            </dd>
            {/* In an FDA Information Request the clock is the counter. */}
            {!clock && (
              <>
                <dt className="text-zinc-400">Round</dt>
                <dd className="text-right" data-testid="round-score">
                  {/* Padded with figure spaces so the right-aligned score
                      keeps its position as digits arrive (no layout shift). */}
                  {String(displayedRound).padStart(
                    String(view.quota).length + 1,
                    FIGURE_SPACE
                  )}
                </dd>
              </>
            )}
            <dt className="text-zinc-400">CPU</dt>
            <dd className="text-right" data-testid="cpu-counter">
              {view.cpu.available}/{view.cpuAllocation}
            </dd>
            <dt className="text-zinc-400">Hands</dt>
            <dd className="text-right" data-testid="hands-affordable">
              {view.handsAffordable}
            </dd>
            {view.handsLeft !== null && (
              <>
                <dt className="text-zinc-400">Hand limit</dt>
                <dd className="text-right" data-testid="hand-limit">
                  {view.handsLeft} left
                </dd>
              </>
            )}
            <dt className="text-zinc-400">Discards</dt>
            <dd className="text-right">{view.discardsAffordable}</dd>
            <dt className="text-zinc-400">Deck</dt>
            <dd className="text-right">{view.deckRemaining}</dd>
            <dt className="text-zinc-400">Snapshot</dt>
            <dd
              className="min-w-0 text-right break-words"
              data-testid="current-snapshot"
            >
              {view.snapshot.id}
            </dd>
          </dl>
          <div
            className="mt-2 flex flex-wrap gap-0.5"
            aria-hidden="true"
            data-testid="cpu-pips"
          >
            {cpuPips.map((on, i) => (
              // Keyed on state, so a pip that empties remounts and its burst
              // plays once: the spent CPU pops off its slot.
              <span
                key={`${i}:${on}`}
                data-pip={on ? "on" : "spent"}
                className={`relative h-3 w-2 border ${on ? "border-emerald-400 bg-emerald-400" : "border-zinc-700"}`}
              >
                {!on && (
                  <span className="te-pip-burst absolute inset-0 bg-emerald-400" />
                )}
              </span>
            ))}
          </div>
          <p
            className={`mt-2 min-h-[1.25rem] font-bold uppercase tracking-wider text-emerald-300 ${flashCleared && loudEffectsEnabled ? LOUD_PRESETS.clearedBlind : ""}`}
            aria-hidden="true"
            data-testid="blind-cleared-flash"
          >
            {flashCleared ? "Cleared" : ""}
          </p>
          <div
            role="group"
            aria-label="Scoring speed"
            className="mt-2 grid grid-cols-3 gap-1"
          >
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={speed === s}
                onClick={() => setSpeed(s)}
                className={`min-h-[44px] border text-xs font-bold tabular-nums touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  speed === s
                    ? "border-amber-400 bg-amber-500/10 text-amber-300"
                    : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
          <ScoreLog
            // The hand being played joins the log once its playback ends.
            entries={playing ? view.scoreLog.slice(0, -1) : view.scoreLog}
            deviation={view.deviation}
          />
        </aside>

        <div className="min-w-0 bg-[color:var(--te-surface-0)] p-3">
          <ul
            aria-label={`Relic rack: ${view.relics.length} of ${view.relicSlots} slots filled.${view.relics.length === 0 ? " Relics arrive with the Procurement Shop and Boss rewards." : ""}${shopView && view.relics.length > 0 ? " Press S on a relic to sell it." : ""}`}
            tabIndex={0}
            className="flex flex-wrap gap-2 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            data-testid="relic-rack"
          >
            {Array.from({ length: view.relicSlots }, (_, i) => {
              const relic = view.relics[i];
              if (!relic) {
                return (
                  <li
                    key={i}
                    className="flex h-12 w-16 items-center justify-center border border-dashed border-zinc-700 text-[10px] uppercase text-zinc-400"
                  >
                    Empty
                  </li>
                );
              }
              const chip =
                "flex h-12 min-w-0 max-w-[10rem] flex-col items-center justify-center border border-emerald-500/60 px-2 text-center text-[10px] font-bold uppercase text-emerald-300 break-words";
              const phase = RELIC_PHASE_LABELS[relicPhase(relic)];
              const face = (
                <>
                  <span className="min-w-0 break-words">{relic.id}</span>
                  <span
                    className="font-normal normal-case text-zinc-400"
                    data-testid="relic-phase"
                  >
                    {phase}
                  </span>
                </>
              );
              return (
                <li
                  key={relic.id}
                  title={`${relic.name} (${phase}): ${relic.description}`}
                  className="min-w-0"
                  data-testid="relic"
                >
                  {shopView ? (
                    <button
                      type="button"
                      aria-label={`${relic.name}, ${phase}: ${relic.description} Sells for $${shopView.relicSellValues[relic.id]}k. Press S or Enter to sell.`}
                      onClick={() => setSellRelicId(relic.id)}
                      onKeyDown={(e) => {
                        if (e.key === "s" || e.key === "S") {
                          e.preventDefault();
                          setSellRelicId(relic.id);
                        }
                      }}
                      className={`${chip} touch-manipulation hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]`}
                      data-testid="relic-sell"
                    >
                      {face}
                    </button>
                  ) : (
                    <span className={chip}>{face}</span>
                  )}
                </li>
              );
            })}
          </ul>
          {sellingRelic && shopView && (
            <div
              role="group"
              aria-label={`Sell ${sellingRelic.name}`}
              className="mt-2 flex flex-wrap items-center gap-2 border border-amber-500/60 p-2 text-xs text-zinc-200"
              data-testid="relic-sell-confirm"
            >
              <span className="min-w-0 break-words">
                Sell {sellingRelic.name} for $
                {shopView.relicSellValues[sellingRelic.id]}k?
              </span>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setSellRelicId(null);
                  send({ type: "SELL_RELIC", relicId: sellingRelic.id });
                }}
                className={`${BUTTON_BASE} border-amber-500 text-amber-300 hover:bg-amber-500/10`}
              >
                Sell
              </button>
              <button
                type="button"
                onClick={() => setSellRelicId(null)}
                className={`${BUTTON_BASE} border-zinc-600 text-zinc-300 hover:bg-zinc-800`}
              >
                Keep
              </button>
            </div>
          )}
          <div
            role="group"
            aria-label={`Consumables: ${view.consumables.length} of ${view.consumableSlots} slots filled. Study budget $${view.budget}k.`}
            className="mt-2 flex flex-wrap items-stretch gap-2"
            data-testid="consumable-tray"
          >
            {Array.from({ length: view.consumableSlots }, (_, i) => {
              const item = view.consumables[i];
              if (!item) {
                return (
                  <span
                    key={`slot-${i}`}
                    className="flex min-h-[48px] w-44 items-center justify-center border border-dashed border-zinc-700 text-[10px] uppercase text-zinc-400"
                  >
                    Empty slot
                  </span>
                );
              }
              const sellButton = (
                <button
                  type="button"
                  onClick={() => {
                    releaseSeal(item.id);
                    send({ type: "SELL_CONSUMABLE", consumableId: item.id });
                  }}
                  // The shop buys between Blinds too.
                  disabled={
                    (view.status !== "REVIEWING" && !shopView) || playing
                  }
                  className="min-h-[44px] border-t border-zinc-800 px-2 text-left uppercase tracking-wider text-zinc-300 touch-manipulation hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:text-zinc-500"
                >
                  Sell · ${consumableSellValue(item)}k
                </button>
              );
              if (item.kind === "AMENDMENT") {
                const { amendment } = item;
                const preview = view.amendmentPreviews.find(
                  (p) => p.consumableId === item.id
                );
                return (
                  <span
                    key={item.id}
                    className="flex w-44 min-w-0 flex-col border border-amber-400/60 text-[10px]"
                    data-testid="consumable"
                    data-kind="amendment"
                  >
                    <button
                      type="button"
                      onClick={() => setAmendingId(item.id)}
                      disabled={
                        view.status !== "REVIEWING" ||
                        playing ||
                        !preview ||
                        preview.refusal !== null
                      }
                      title={preview?.refusal ?? amendment.description}
                      aria-label={`Use ${amendment.name}: ${amendment.description}${preview?.refusal ? ` ${preview.refusal}` : ""}`}
                      className="min-h-[44px] min-w-0 px-2 py-1 text-left touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:text-zinc-400"
                    >
                      <span className="flex items-start gap-1 font-bold uppercase tracking-wider text-amber-300">
                        <span
                          aria-hidden="true"
                          className="flex h-4 w-4 shrink-0 items-center justify-center border border-amber-400 bg-amber-950 text-[7px]"
                        >
                          {amendment.code}
                        </span>
                        <span className="min-w-0 break-words">
                          {amendment.name}
                        </span>
                      </span>
                      <span className="block text-zinc-300 break-words">
                        {preview && preview.refusal === null
                          ? `Use: ${preview.ruleLabel} +${preview.bonus.to} Mult · stales ${preview.staled.length}`
                          : (preview?.refusal ?? amendment.description)}
                      </span>
                    </button>
                    {sellButton}
                  </span>
                );
              }
              if (item.kind === "GUIDANCE") {
                const { guidance } = item;
                const bonus = HAND_LEVEL_BONUS[guidance.handType];
                const level = view.handLevels[guidance.handType].level;
                return (
                  <span
                    key={item.id}
                    className="flex w-44 min-w-0 flex-col border border-sky-400/60 text-[10px]"
                    data-testid="consumable"
                    data-kind="guidance"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        send(
                          { type: "USE_GUIDANCE", consumableId: item.id },
                          { kind: "hand", index: activeIndex }
                        )
                      }
                      disabled={view.status !== "REVIEWING" || playing}
                      title={`${guidance.document}. ${guidance.flavor}`}
                      aria-label={`Use ${guidance.name}: level ${HAND_NAMES[guidance.handType]} up from Lv.${level} to Lv.${level + 1}, +${bonus.chips} Chips and +${bonus.mult} Mult.`}
                      className="min-h-[44px] min-w-0 px-2 py-1 text-left touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:text-zinc-400"
                    >
                      <span className="flex items-start gap-1 font-bold uppercase tracking-wider text-sky-300">
                        <span
                          aria-hidden="true"
                          className="flex h-4 w-4 shrink-0 items-center justify-center border border-sky-400 bg-sky-950 text-[7px]"
                        >
                          GD
                        </span>
                        <span className="min-w-0 break-words">
                          {guidance.name}
                        </span>
                      </span>
                      <span className="block text-zinc-300 break-words">
                        Use: {HAND_NAMES[guidance.handType]} Lv.{level + 1} · +
                        {bonus.chips} Chips +{bonus.mult} Mult
                      </span>
                    </button>
                    {sellButton}
                  </span>
                );
              }
              const { seal } = item;
              const isArmed = armed?.id === item.id;
              return (
                <span
                  key={item.id}
                  className={`flex w-44 min-w-0 flex-col border text-[10px] ${isArmed ? "border-amber-400 bg-amber-500/10" : "border-zinc-700"}`}
                  data-testid="consumable"
                >
                  <button
                    type="button"
                    draggable={view.status === "REVIEWING"}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(SEAL_DRAG_TYPE, item.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => toggleArmed(item.id)}
                    aria-pressed={isArmed}
                    disabled={view.status !== "REVIEWING" || playing}
                    title={seal.footnote}
                    className="min-h-[44px] min-w-0 px-2 py-1 text-left touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:text-zinc-400"
                  >
                    <span className="flex items-start gap-1 font-bold uppercase tracking-wider text-amber-300">
                      <span
                        aria-hidden="true"
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-amber-400 bg-amber-950 text-[7px]"
                      >
                        FN
                      </span>
                      <span className="min-w-0 break-words">{seal.name}</span>
                    </span>
                    <span className="block text-zinc-300">
                      {sealSummary(seal)}
                      {isArmed ? " · pick a card" : ""}
                    </span>
                  </button>
                  {sellButton}
                </span>
              );
            })}
            <span
              className="self-center text-[10px] uppercase tracking-wider text-zinc-400 tabular-nums"
              data-testid="study-budget"
            >
              Budget ${view.budget}k
            </span>
          </div>

          {playing && timeline ? (
            <div className="mt-3 min-h-[13rem] border border-zinc-800 bg-[color:var(--te-surface-1)] px-3 py-2">
              <ScorePlayer
                steps={timeline}
                shown={playback.shown}
                cards={(view.lastPlay?.cardIds ?? []).map((id) => ({
                  id,
                  number:
                    scenario.deck.find((card) => card.id === id)?.number ?? id,
                }))}
                loudEffectsEnabled={loudEffectsEnabled}
                onSkip={playback.skip}
                skipRef={skipRef}
              />
            </div>
          ) : (
            <div
              className="mt-3 min-h-[13rem] border border-zinc-800 bg-[color:var(--te-surface-1)] px-3 py-2"
              data-testid="hand-preview"
            >
              {view.lastEvent?.levelUp && (
                <div className="mb-2">
                  <LevelUpPlate
                    key={view.lastEvent.sequence}
                    levelUp={view.lastEvent.levelUp}
                    reducedMotion={reducedMotion}
                    loud={loudEffectsEnabled}
                  />
                </div>
              )}
              <p className="text-[10px] uppercase tracking-wider text-zinc-400">
                {view.classification ? (
                  <>
                    {HAND_NAMES[view.classification.handType]}{" "}
                    <span className="text-amber-300" data-testid="hand-level">
                      Lv.{view.handLevels[view.classification.handType].level}
                    </span>
                  </>
                ) : (
                  `Select up to ${scenario.table.maxSelection} cards`
                )}
              </p>
              {preview && (
                <p className="mt-1 text-lg font-bold tabular-nums break-words">
                  <span className="text-[color:var(--te-chips)]">
                    [{preview.chips.total}]
                  </span>{" "}
                  × [
                  {slashed && (
                    <s className="text-zinc-400 decoration-rose-400 decoration-2">
                      {view.previewUnpenalizedMult}
                    </s>
                  )}
                  {slashed && " "}
                  <span
                    className={
                      slashed
                        ? "text-rose-300"
                        : "text-[color:var(--te-plus-mult)]"
                    }
                  >
                    {preview.finalMult}
                  </span>
                  ] = {preview.score}
                </p>
              )}
              {view.stageAccepts && view.encounter && (
                <p
                  className={`mt-1 text-xs break-words ${
                    stageRefuses ? "text-rose-300" : "text-zinc-300"
                  }`}
                  data-testid="stage-accepts"
                >
                  Stage {view.encounter.current + 1} accepts:{" "}
                  {view.stageAccepts.map((h) => HAND_NAMES[h]).join(", ")}.
                  {stageRefuses &&
                    ` ${HAND_NAMES[view.classification!.handType]} is not one of them.`}
                </p>
              )}
              {view.flushBrokenBy.length > 0 && (
                <p
                  className="mt-1 text-xs text-rose-300 break-words"
                  data-testid="flush-broken"
                >
                  Population Flush broken: {numbersOf(view.flushBrokenBy)}{" "}
                  {view.flushBrokenBy.length === 1 ? "is" : "are"} stale.
                </p>
              )}
              {view.staleSelected.length > 0 && view.playBlockedReason && (
                <p
                  className="mt-1 text-xs text-rose-300 break-words"
                  data-testid="stale-alert"
                >
                  {view.playBlockedReason}
                  {/* The flush line above already names the stale cards. */}
                  {view.flushBrokenBy.length === 0 &&
                    ` Stale: ${numbersOf(view.staleSelected)}.`}
                </p>
              )}
              {view.emptySelected.length > 0 && (
                <p
                  className="mt-1 text-xs text-rose-300 break-words"
                  data-testid="empty-alert"
                >
                  Empty shell: {numbersOf(view.emptySelected)}. Allocate an
                  analysis set to compile it first.
                </p>
              )}
              {view.previewUnverified && (
                <p
                  className="mt-1 text-xs text-amber-300"
                  data-testid="unverified-flag"
                >
                  ? Unverified: an uninspected card may hide a fatal defect.
                </p>
              )}
            </div>
          )}

          {view.status === "REVIEWING" || playing ? (
            <div inert={playing}>
              {view.crisis && (
                <CrisisPanel
                  key={view.crisis.crisis.id}
                  view={view.crisis}
                  animate={animateCards}
                  loud={loudEffectsEnabled}
                  firstChoiceRef={crisisRef}
                  onChoose={(choiceId) =>
                    send(
                      { type: "RESOLVE_CRISIS", choiceId },
                      { kind: "hand", index: activeIndex }
                    )
                  }
                />
              )}
              {view.deviation?.fresh && (
                <DeviationCard deviation={view.deviation} />
              )}
              <div className="mt-3 flex items-end justify-between gap-2 text-[10px] uppercase tracking-wider text-zinc-400">
                <div
                  className="flex items-center gap-2"
                  data-testid="discard-stack"
                >
                  <span className="relative h-12 w-9">
                    {view.spentCount > 0 && (
                      <CardBack
                        card={{ slot: "discard-top", faceDown: true }}
                        className="absolute inset-0 -rotate-6 opacity-60"
                      />
                    )}
                    <span className="absolute inset-0 border border-dashed border-zinc-700" />
                  </span>
                  <span className="tabular-nums">Spent {view.spentCount}</span>
                </div>
                <div
                  className="flex items-center gap-2"
                  data-testid="draw-pile"
                >
                  <span className="tabular-nums">
                    Deck {view.drawPile.length}
                  </span>
                  <span className="relative h-12 w-9">
                    {/* Only redacted slots reach the pile: no card data. */}
                    {view.drawPile.slice(0, 3).map((back, i) => (
                      <span
                        key={back.slot}
                        className="absolute inset-0"
                        style={{
                          transform: `translate(${i * 2}px, ${-i * 2}px)`,
                        }}
                      >
                        <CardBack card={back} className="h-full w-full" />
                      </span>
                    ))}
                    {view.drawPile.length === 0 && (
                      <span className="absolute inset-0 border border-dashed border-zinc-700" />
                    )}
                  </span>
                </div>
              </div>
              {view.csrLock && view.status === "REVIEWING" && (
                <CsrSlots
                  slots={view.csrLock.report.slots}
                  names={Object.fromEntries(
                    view.hand.map((h) => [h.card.id, h.card.number])
                  )}
                />
              )}
              <Reorder.Group
                as="div"
                axis="x"
                values={handOrder}
                onReorder={setDragOrder}
                role="group"
                aria-label={`Hand of ${view.hand.length}. Arrow keys move, Space selects, Enter plays, D discards, I inspects, R recompiles a stale card, S runs structural QC on a face-down card, A allocates a blank shell, question mark reads the card, Alt with arrows reorders. With a footnote seal picked up, Enter affixes it and Escape puts it back. Shift+R opens Run Info, and H lists every hand.`}
                ref={handRef}
                className="-mx-3 mt-1 flex overflow-x-auto px-3 pb-3 pt-7 [scrollbar-width:thin]"
                data-testid="hand"
              >
                {animateCards ? (
                  <AnimatePresence mode="popLayout">
                    {handCards}
                  </AnimatePresence>
                ) : (
                  handCards
                )}
              </Reorder.Group>

              <div
                className={`mt-3 grid grid-cols-1 gap-2 ${focusedCard?.stale || focusedCard?.faceDown ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}
              >
                <button
                  type="button"
                  onClick={play}
                  data-coach="play"
                  disabled={!view.canPlay}
                  aria-describedby={playDescribedBy}
                  className={`${BUTTON_BASE} border-emerald-500 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20`}
                >
                  Play Hand · {CPU_COSTS.PLAY_HAND} CPU{hoursFor("PLAY_HAND")}{" "}
                  [Enter]
                </button>
                <button
                  type="button"
                  onClick={discard}
                  disabled={!view.canDiscard}
                  aria-describedby={costDescribedBy}
                  className={`${BUTTON_BASE} border-slate-400 text-slate-300 hover:bg-slate-400/10`}
                >
                  Discard · {view.discardCost} CPU{hoursFor("DISCARD")} [D]
                </button>
                <button
                  type="button"
                  onClick={() => inspect(focusedCard?.card.id)}
                  aria-describedby={costDescribedBy}
                  disabled={
                    focusedCard?.faceDown
                      ? false
                      : !focusedCard?.inspectable ||
                        (!focusedCard.inspected && !view.canInspect)
                  }
                  className={`${BUTTON_BASE} ${focusedCard?.faceDown ? "border-rose-400 text-rose-300 hover:bg-rose-500/10" : "border-amber-500 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"}`}
                >
                  {focusedCard?.faceDown ? (
                    <>Unblind {focusedCard.card.number} [I]</>
                  ) : (
                    <>
                      Inspect {focusedCard?.card.number ?? ""} ·{" "}
                      {focusedCard?.inspected
                        ? "open"
                        : `${CPU_COSTS.INSPECT} CPU${hoursFor("INSPECT")}`}{" "}
                      [I]
                    </>
                  )}
                </button>
                {focusedCard?.faceDown && (
                  <button
                    type="button"
                    onClick={() => structural(focusedCard.card.id)}
                    disabled={
                      !focusedCard.structural &&
                      view.cpu.available < CPU_COSTS.INSPECT
                    }
                    aria-describedby={costDescribedBy}
                    className={`${BUTTON_BASE} border-amber-500 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20`}
                    data-testid="structural-qc-button"
                  >
                    Structural QC {focusedCard.card.number} ·{" "}
                    {focusedCard.structural
                      ? "done"
                      : `${CPU_COSTS.INSPECT} CPU${hoursFor("INSPECT")}`}{" "}
                    [S]
                  </button>
                )}
                {focusedCard?.stale && (
                  <button
                    type="button"
                    onClick={() => recompile(focusedCard.card.id)}
                    disabled={!view.canRecompile}
                    aria-describedby={costDescribedBy}
                    className={`${BUTTON_BASE} border-rose-400 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20`}
                  >
                    Recompile {focusedCard.card.number} · {CPU_COSTS.RECOMPILE}{" "}
                    CPU [R]
                  </button>
                )}
              </div>
              {view.playBlocker && (
                // Below the controls, so the hand above never shifts when it
                // comes and goes. The domain names the blocker and its fix.
                <p
                  id="play-blocker"
                  className="mt-2 text-xs text-zinc-300 break-words"
                  data-testid="play-blocker"
                >
                  {view.playBlocker.reason}
                  {view.playBlocker.fix && (
                    <>
                      {" "}
                      <span className="text-zinc-100">
                        {view.playBlocker.fix}
                        {view.playBlocker.key && ` [${view.playBlocker.key}]`}.
                      </span>
                    </>
                  )}
                </p>
              )}
              {costNotes.length > 0 && (
                <p
                  id="cpu-note"
                  className="mt-2 text-xs text-amber-300 break-words"
                  data-testid="cpu-note"
                >
                  {costNotes.join(" ")}
                </p>
              )}
              {focusedCard?.blank && allocation.length > 0 && (
                <div
                  role="group"
                  aria-labelledby="allocate-heading"
                  className="mt-3 border border-dashed border-zinc-600 p-3"
                  data-testid="allocate-panel"
                >
                  <p
                    id="allocate-heading"
                    className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 break-words"
                  >
                    Allocate an analysis set to {focusedCard.card.number} ·
                    free, final
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {allocation.map((option, i) => (
                      <button
                        key={option.population}
                        ref={i === 0 ? allocateRef : undefined}
                        type="button"
                        disabled={option.refusal !== null}
                        onClick={() =>
                          send(
                            {
                              type: "ALLOCATE",
                              cardId: focusedCard.card.id,
                              population: option.population,
                            },
                            { kind: "card", cardId: focusedCard.card.id }
                          )
                        }
                        className={`${BUTTON_BASE} h-auto border-zinc-500 text-left normal-case tracking-normal text-zinc-100 hover:bg-zinc-800`}
                        data-testid="allocate-option"
                      >
                        <span className="block uppercase tracking-wider">
                          Compile on {POPULATION_LABEL[option.population]} · N=
                          {option.subjects}
                        </span>
                        <span className="block font-normal text-zinc-400">
                          {option.snapshot.id} · v{option.snapshot.version}
                        </span>
                        {option.refusal ? (
                          <span className="block font-normal text-rose-300 break-words">
                            {option.refusal}
                          </span>
                        ) : (
                          option.estimate &&
                          option.classification && (
                            <span className="block font-normal tabular-nums break-words">
                              ≈ {HAND_NAMES[option.classification.handType]}{" "}
                              <span className="text-[color:var(--te-chips)]">
                                [{option.estimate.chips.total}]
                              </span>{" "}
                              ×{" "}
                              <span className="text-[color:var(--te-plus-mult)]">
                                [{option.estimate.finalMult}]
                              </span>{" "}
                              = {option.estimate.score}{" "}
                              <span className="text-amber-300">
                                ? unverified
                              </span>
                            </span>
                          )
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 p-4 text-center" data-testid="blind-result">
              <p
                className={`text-lg font-bold uppercase ${view.status === "CLEARED" ? "text-emerald-300" : "text-rose-300"}`}
              >
                {runView.phase === "RUN_WON" && view.csrLock?.lock
                  ? `CSR locked · ${wonLabel}`
                  : runView.phase === "RUN_WON"
                    ? wonLabel
                    : runView.phase === "BLIND_CLEARED" ||
                        runView.phase === "SHOP"
                      ? "Blind cleared"
                      : clock?.hold
                        ? `${CLINICAL_HOLD} · run over`
                        : "Blind failed · run over"}
              </p>
              {clock?.hold && (
                <section
                  aria-labelledby="clinical-hold-heading"
                  className={`${LOUD_PRESETS.crisisSlam} mx-auto mt-3 max-w-md border-2 border-rose-400 bg-[color:var(--te-surface-1)] p-3 text-left text-xs break-words`}
                  data-testid="clinical-hold"
                >
                  <p className="text-[10px] uppercase tracking-wider text-zinc-400">
                    Regulatory correspondence (fictional study)
                  </p>
                  <h3
                    id="clinical-hold-heading"
                    className="mt-1 text-sm font-bold uppercase tracking-wider text-rose-300"
                  >
                    {CLINICAL_HOLD}
                  </h3>
                  <p className="mt-2 text-zinc-300">
                    Your response to the End-of-Phase-2 Information Request was
                    not received within {clock.totalHours} hours.{" "}
                    {view.questions.filter((q) => !q.answered).length} of{" "}
                    {view.questions.length} questions remain open. The program
                    may not proceed to Phase III.
                  </p>
                  <ul className="mt-2 list-disc pl-5 text-zinc-400">
                    {view.questions
                      .filter((q) => !q.answered)
                      .map((q) => (
                        <li key={q.id}>
                          {q.question} ({q.cardNumber})
                        </li>
                      ))}
                  </ul>
                </section>
              )}
              <p className="mt-2 text-sm text-zinc-300 tabular-nums">
                {view.roundScore} of {view.quota} · {view.handsPlayed} hand
                {view.handsPlayed === 1 ? "" : "s"} played · {view.discards}{" "}
                discard
                {view.discards === 1 ? "" : "s"} · {view.cpu.spent} CPU spent
              </p>
              {view.csrLock?.lock && (
                <CsrLockSummary
                  lock={view.csrLock.lock}
                  amendRefusal={view.csrLock.amendRefusal}
                  seed={runView.seed}
                  handsPlayed={view.handsPlayed}
                  cpuSpent={view.cpu.spent}
                  loud={loudEffectsEnabled}
                  onAmend={() => {
                    setFocusIndex(0);
                    send(
                      { type: "AMEND_PROTOCOL" },
                      { kind: "hand", index: 0 }
                    );
                  }}
                />
              )}
              {view.reward && (
                <PackOpening
                  title={
                    view.reward.claimed
                      ? "SOP relic claimed"
                      : "Choose one SOP relic"
                  }
                  picksLeft={view.reward.claimed ? 0 : 1}
                  cards={view.reward.choices.map((relic): RevealCard => ({
                    id: relic.id,
                    kind: "Relic",
                    name: relic.name,
                    description: relic.description,
                    picked: view.reward?.claimed === relic.id,
                    refusal:
                      view.reward?.claimed != null &&
                      view.reward.claimed !== relic.id
                        ? "Another relic was taken."
                        : view.relics.length >= view.relicSlots
                          ? `The relic rack holds ${view.relicSlots}.`
                          : null,
                    warning: null,
                  }))}
                  onPick={(relicId) => send({ type: "CLAIM_RELIC", relicId })}
                  animate={animateCards}
                  loud={loudEffectsEnabled}
                  testId="relic-reward"
                  cardTestId="relic-choice"
                />
              )}
              {runView.phase === "BLIND_CLEARED" && runView.pendingCashOut && (
                <CashOut
                  report={runView.pendingCashOut}
                  paid={false}
                  animate={false}
                  loud={false}
                />
              )}
              {runView.phase === "SHOP" && runView.cashOut && (
                <CashOut
                  report={runView.cashOut}
                  paid
                  animate={animateCards}
                  loud={loudEffectsEnabled}
                />
              )}
              {shopView?.opened ? (
                <PackOpening
                  key={`${shopView.opened.packId}-${shopView.purchases}`}
                  title={shopView.opened.name}
                  picksLeft={shopView.opened.picksLeft}
                  cards={shopView.opened.cards.map((card): RevealCard => ({
                    ...card,
                    kind:
                      card.kind === "SITE"
                        ? "Site"
                        : card.kind === "RELIC"
                          ? "Relic"
                          : card.kind === "GUIDANCE"
                            ? "Guidance"
                            : card.kind === "AMENDMENT"
                              ? "SAP Amendment"
                              : "Seal",
                  }))}
                  onPick={(cardId) => send({ type: "PICK_PACK_CARD", cardId })}
                  onSkip={() => send({ type: "SKIP_PACK" })}
                  animate={animateCards}
                  loud={loudEffectsEnabled}
                />
              ) : (
                shopView && (
                  <Shop
                    view={shopView}
                    budget={view.budget}
                    onBuy={(slot) => send({ type: "BUY", slot })}
                    onBuyPack={(slot) => send({ type: "BUY_PACK", slot })}
                    onReroll={() => send({ type: "REROLL" })}
                  />
                )
              )}
              {runView.nextBlind &&
              (runView.phase === "BLIND_CLEARED" ||
                runView.phase === "SHOP") ? (
                <>
                  <p
                    className="mt-2 text-xs text-zinc-400 break-words"
                    data-testid="next-blind"
                  >
                    Next:{" "}
                    {runView.nextAct && (
                      <>{runView.nextAct.title}, a new study · </>
                    )}
                    {runView.nextBlind.blind.name} · target{" "}
                    {runView.nextBlind.blind.quota}
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {runView.phase === "BLIND_CLEARED" &&
                      runView.pendingCashOut &&
                      currentAct.shop && (
                        <button
                          ref={restartRef}
                          type="button"
                          onClick={() => send({ type: "CASH_OUT" })}
                          className={`${BUTTON_BASE} border-amber-500 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20`}
                          data-testid="cash-out-button"
                        >
                          Cash out ${runView.pendingCashOut.total}k
                        </button>
                      )}
                    <button
                      ref={
                        runView.phase === "BLIND_CLEARED" && currentAct.shop
                          ? undefined
                          : restartRef
                      }
                      type="button"
                      onClick={() => {
                        setFocusIndex(0);
                        setSellRelicId(null);
                        send(
                          { type: "NEXT_BLIND" },
                          { kind: "hand", index: 0 }
                        );
                      }}
                      disabled={
                        view.reward !== null && view.reward.claimed === null
                      }
                      aria-disabled={shopView?.opened ? true : undefined}
                      aria-describedby={
                        runView.phase === "BLIND_CLEARED" && currentAct.shop
                          ? "skip-shop-note"
                          : undefined
                      }
                      className={`${BUTTON_BASE} border-emerald-500 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20`}
                    >
                      {runView.nextAct ? "Next study" : "Next Blind"}
                    </button>
                  </div>
                  {runView.phase === "BLIND_CLEARED" && currentAct.shop && (
                    <p
                      id="skip-shop-note"
                      className="mt-2 text-[11px] text-zinc-400 break-words"
                    >
                      {runView.nextAct ? "Next study" : "Next Blind"} skips the
                      shop; the sponsor still pays.
                    </p>
                  )}
                </>
              ) : runView.endless?.canContinue ? (
                <div
                  className="mt-4 flex flex-wrap justify-center gap-2"
                  data-testid="endless-choice"
                >
                  <button
                    ref={restartRef}
                    type="button"
                    onClick={() => send({ type: "END_RUN" })}
                    className={`${BUTTON_BASE} border-emerald-500 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20`}
                  >
                    Submit and end run
                  </button>
                  <button
                    type="button"
                    onClick={() => send({ type: "CONTINUE_ENDLESS" })}
                    aria-describedby="endless-note"
                    className={`${BUTTON_BASE} border-slate-400 text-slate-300 hover:bg-slate-400/10`}
                  >
                    Continue into post-marketing
                  </button>
                  <p
                    id="endless-note"
                    className="basis-full text-[11px] text-zinc-400 break-words"
                  >
                    The win is recorded either way. Post-marketing rounds raise
                    every quota each round, until a Blind fails.
                  </p>
                </div>
              ) : (
                <>
                  {runView.phase === "RUN_FAILED" &&
                    runView.endless?.campaignWon && (
                      <p
                        className="mt-2 text-xs text-emerald-300 break-words"
                        data-testid="endless-record"
                      >
                        {wonLabel} · {runView.endless.title} round{" "}
                        {endlessRound ?? 0} reached
                      </p>
                    )}
                  <button
                    ref={restartRef}
                    type="button"
                    onClick={() => {
                      if (endAction) {
                        endAction(runView.phase === "RUN_WON").onSelect();
                        return;
                      }
                      setFocusIndex(0);
                      send(
                        { type: "RESTART_RUN", seed: freshSeed() },
                        { kind: "hand", index: 0 }
                      );
                    }}
                    className={`${BUTTON_BASE} mt-4 border-amber-500 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20`}
                  >
                    {endAction
                      ? endAction(runView.phase === "RUN_WON").label
                      : runView.phase === "RUN_WON"
                        ? "Play again"
                        : "Restart run"}
                  </button>
                </>
              )}
            </div>
          )}

          {view.lastPlay && !playing && (
            <p
              className="mt-3 text-xs text-zinc-300 tabular-nums break-words"
              data-testid="last-hand"
            >
              Last hand: {HAND_NAMES[view.lastPlay.classification.handType]} ·{" "}
              {view.lastPlay.evaluation.chips.total} Chips ×{" "}
              {view.lastPlay.evaluation.finalMult} Mult ={" "}
              {view.lastPlay.evaluation.score}
              {view.lastPlay.evaluation.zeroRule.triggered &&
                " (zero-score rule)"}
            </p>
          )}
          {timeline && !playing && <ScoreBreakdown steps={timeline} />}
        </div>
      </div>

      {inspected &&
        // Portalled out of the table's isolated stacking context so the site
        // footer and cabinet chrome cannot paint over it. In real fullscreen
        // only the fullscreen element renders, so the drawer mounts there.
        createPortal(
          <div
            data-te-cabinet=""
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          >
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={
                view.inspection ? "qc-desk-heading" : "figure-desk-heading"
              }
              className="max-h-[90dvh] w-full max-w-5xl overflow-y-auto border border-zinc-700 bg-[color:var(--te-surface-0)]"
              data-testid="inspect-drawer"
            >
              <p
                className="border-b border-zinc-800 px-4 py-2 font-mono text-xs text-zinc-300 break-words"
                data-testid="snapshot-chip"
              >
                Compiled against {inspected.provenance.id} · v
                {inspected.provenance.version} · captured{" "}
                {inspected.provenance.capturedAt.slice(0, 10)}
                {inspected.stale && (
                  <span className="text-rose-300">
                    {" "}
                    · stale:{" "}
                    {view.hand.find((h) => h.card.id === inspected.card.id)
                      ?.staleAlert ?? STALE_ALERT}
                  </span>
                )}
              </p>
              {coach && (
                <div className="border-b border-zinc-800 p-3">{coach}</div>
              )}
              {view.inspection ? (
                <QcDesk
                  card={view.inspection.card}
                  table={view.inspection.table}
                  rulebook={view.rulebook}
                  view={view.inspection}
                  expected={view.inspection.expected}
                  unpenalizedMult={view.inspection.unpenalizedMult}
                  onInspectCell={(row, col) =>
                    send({ type: "INSPECT_CELL", row, col })
                  }
                  onCorrect={(findingId) =>
                    send({ type: "CORRECT_FINDING", findingId })
                  }
                  trace={view.inspection.trace}
                  onTrace={(row, col) => send({ type: "TRACE_CELL", row, col })}
                  traceHours={clock?.costs.TRACE ?? null}
                  reducedMotion={reducedMotion}
                  initialFocusRef={deskFocusRef}
                />
              ) : (
                view.figureInspection &&
                figureFace && (
                  <FigureDesk
                    view={view.figureInspection}
                    face={figureFace}
                    parentFace={figureParentFace}
                    onReconcile={(findingId) =>
                      send({ type: "CORRECT_FINDING", findingId })
                    }
                    initialFocusRef={deskFocusRef}
                  />
                )
              )}
              <div className="border-t border-zinc-800 p-3">
                <button
                  type="button"
                  onClick={closeInspect}
                  data-coach="close-inspect"
                  className={`${BUTTON_BASE} w-full border-zinc-600 text-zinc-200 hover:bg-zinc-800`}
                >
                  Close Inspect [Esc]
                </button>
              </div>
            </div>
          </div>,
          document.fullscreenElement ?? document.body
        )}

      {runInfoOpen && (
        <RunInfo
          rows={view.handTable}
          seed={runView.seed}
          relicSlots={view.relicSlots}
          relics={view.relics}
          accessLog={view.accessLog}
          dmc={view.dmcCharter !== null}
          onClose={() => setRunInfoOpen(false)}
        />
      )}

      {handSheetOpen && (
        <HandCheatSheet
          rows={view.handTable}
          refused={view.refusedHands}
          selected={view.classification?.handType ?? null}
          onClose={() => setHandSheetOpen(false)}
        />
      )}

      {showActIntro && runView.actIntro && (
        <ActIntro
          intro={runView.actIntro}
          loud={loudEffectsEnabled}
          onDismiss={() => setActIntroSeen(actIntroKey)}
        />
      )}

      {showBossIntro && view.bossIntro && (
        <BossIntro
          intro={view.bossIntro}
          onDismiss={() => setBossIntroSeen(bossIntroKey)}
        />
      )}

      {amending && (
        <AmendmentDialog
          preview={amending}
          onCancel={() => setAmendingId(null)}
          onConfirm={() => {
            const consumableId = amending.consumableId;
            setAmendingId(null);
            send(
              { type: "USE_AMENDMENT", consumableId },
              { kind: "hand", index: activeIndex }
            );
          }}
        />
      )}

      {peekCard && (
        <FirewallDialog
          cardName={peekCard.card.number}
          charter={view.dmcCharter}
          onCancel={() => setPeekId(null)}
          onConfirm={() => {
            const cardId = peekCard.card.id;
            setPeekId(null);
            send({ type: "PEEK_BLINDED", cardId }, { kind: "card", cardId });
          }}
        />
      )}

      {detailView &&
        createPortal(
          <div
            data-te-cabinet=""
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          >
            <div
              ref={detailRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="card-detail-heading"
              className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto border border-zinc-700 bg-[color:var(--te-surface-0)] font-mono text-[color:var(--te-text)]"
              data-testid="card-detail"
            >
              <CardDetail view={detailView} headingId="card-detail-heading" />
              <div className="grid grid-cols-1 gap-2 border-t border-zinc-800 p-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    send({ type: "TOGGLE_SELECT", cardId: detailView.card.id })
                  }
                  aria-pressed={detailView.selected}
                  className={`${BUTTON_BASE} border-amber-500 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20`}
                >
                  {detailView.selected ? "Deselect" : "Select"} [Space]
                </button>
                <button
                  type="button"
                  onClick={() => setDetailId(null)}
                  className={`${BUTTON_BASE} border-zinc-600 text-zinc-200 hover:bg-zinc-800`}
                >
                  Close [Esc]
                </button>
              </div>
            </div>
          </div>,
          document.fullscreenElement ?? document.body
        )}
    </section>
  );
}
