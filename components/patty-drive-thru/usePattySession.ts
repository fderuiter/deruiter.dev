"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_SHIFT_CONFIG,
  DILEMMA_WINDOW_LONG_SEC,
  getDilemma,
  getFacing,
  isStandardScenario,
  isWeekOver,
  scenarioDialsFor,
  scoreShift,
  scoreWeek,
  type ScenarioId,
  type ShiftConfig,
  type WeekState,
} from "@/lib/patty-drive-thru";
import {
  getArcadeProgress,
  recordArcadeMilestone,
  recordArcadeScore,
} from "@/lib/arcade-achievements";
import { parseArcadeDailyTag } from "@/lib/arcade/daily";
import { recordArcadeDailyResult } from "@/lib/arcade/daily-store";
import { useCabinetSetup } from "@/components/arcade/CabinetSetupContext";
import { PATTY_AUTO_PAUSE_EVENT } from "./auto-pause";
import { useBooth } from "./hooks";
import { createBoothStore, type BoothStore } from "./store";
import {
  clearWeekSave,
  recordWeekBest,
  saveWeek,
  useWeekSave,
} from "./week-save";

/** The arcade id used for scores, trophies and the cabinet. */
const PATTY_GAME_ID = "patty-drive-thru";

/** The dock's turn keys hold under their own names, apart from the keyboard's. */
export const TOUCH_LEFT = "touch:left";
export const TOUCH_RIGHT = "touch:right";

/** A fresh seed per shift, so no two shifts play the same. */
function freshSeed(): string {
  return `${DEFAULT_SHIFT_CONFIG.seed}-${Date.now().toString(36)}`;
}

/** A seed from the page's `?seed=` parameter, so a shift can be replayed. */
function seedFromUrl(): string | null {
  const seed = new URLSearchParams(window.location.search).get("seed");
  return seed && /^[\w-]{1,40}$/.test(seed) ? seed : null;
}

/** What the session needs from the view. */
interface PattySessionOptions {
  /** Shift settings; tests pass a fixed seed and duration. */
  readonly config?: Partial<ShiftConfig>;
  /** Whether the player prefers reduced motion, which lengthens dilemmas. */
  readonly reducedMotion: boolean;
  /** The booth, which takes focus when a shift starts or the register closes. */
  readonly boundaryRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * The Patty's Drive-Thru session (#3439): the booth store and what the
 * view reads from it, pause, the scenario and dilemma timer, clocking in
 * to a shift or a week, the register, and the scores, week saves and
 * trophies recorded as shifts end. The store stays the source of truth.
 * Moved verbatim from PattyDriveThruGame.tsx, which keeps the 60 Hz step,
 * the booth scene and the input.
 */
export function usePattySession(options: PattySessionOptions) {
  const { config, reducedMotion, boundaryRef } = options;
  const [store] = useState<BoothStore>(() => createBoothStore(config));
  const phase = useBooth(store, (s) => s.phase);
  const registerOpen = useBooth(store, (s) => s.registerOpen);
  const announcement = useBooth(store, (s) => s.announcement);
  const yells = useBooth(store, (s) => s.yells);
  const endedShift = useBooth(store, (s) =>
    s.phase === "ended" ? s.shift : null
  );
  const endedLog = useBooth(store, (s) => (s.phase === "ended" ? s.log : null));
  const week = useBooth(store, (s) => s.week);
  // Where the head points, for the touch cabinet's turn state (#2116).
  const facing = useBooth(store, (s) => getFacing(s.look));
  const savedWeek = useWeekSave();

  const setup = useCabinetSetup();

  // P, or Escape with the register closed, pauses the shift (#1938); the
  // Setup Wizard pauses it too.
  const [userPaused, setUserPaused] = useState(false);
  // Pause and resume that are safe to repeat. One Escape can reach both the
  // booth's key handler and the pause dialog's own, so asking for a state the
  // shift is already in does nothing instead of flipping it back.
  const userPausedRef = useRef(false);
  const heldKeys = useRef(new Set<string>());
  const setPaused = useCallback((next: boolean) => {
    if (userPausedRef.current === next) return;
    userPausedRef.current = next;
    if (next) heldKeys.current.clear();
    setUserPaused(next);
  }, []);
  const [previousBest, setPreviousBest] = useState<number | null>(null);
  // The best week total before the one just finished (#2086).
  const [previousWeekBest, setPreviousWeekBest] = useState<number | null>(null);
  const paused = (setup?.isSetupOpen ?? false) || userPaused;

  // The scenario last picked, so "Work another shift" plays the same one.
  const scenario = useRef<ScenarioId>("standard");
  // The custom shift's dials and orders when it was the last pick (#2519).
  const customSetup = useRef<Partial<ShiftConfig> | null>(null);

  // A longer dilemma timer (#2087): on by default under reduced motion, and
  // a choice on the intro page for anyone who wants more time.
  const [longerChoice, setLongerChoice] = useState<boolean | null>(null);
  const longerDilemmas = longerChoice ?? reducedMotion;
  const dilemmaWindowSec = longerDilemmas ? DILEMMA_WINDOW_LONG_SEC : undefined;

  const clockIn = useCallback(
    (picked?: ScenarioId) => {
      if (picked) {
        scenario.current = picked;
        customSetup.current = null;
      }
      setPaused(false);
      store.getState().clockIn({
        ...(config?.seed ? {} : { seed: seedFromUrl() ?? freshSeed() }),
        ...(customSetup.current ?? scenarioDialsFor(scenario.current)),
        ...(dilemmaWindowSec !== undefined ? { dilemmaWindowSec } : {}),
      });
      boundaryRef.current?.focus({ preventScroll: true });
    },
    [store, config?.seed, dilemmaWindowSec, setPaused, boundaryRef]
  );

  // A custom shift (#2519): the player's own dials and order queue.
  const clockInCustom = useCallback(
    (setup: Partial<ShiftConfig>) => {
      customSetup.current = setup;
      clockIn();
    },
    [clockIn]
  );

  // A week of shifts (#2086): a new one from a fresh seed, or one resumed.
  const startWeek = useCallback(
    (resume?: WeekState) => {
      setPaused(false);
      store.getState().clockInWeek(
        resume
          ? { week: resume, dilemmaWindowSec }
          : {
              seed: config?.seed ?? seedFromUrl() ?? freshSeed(),
              dilemmaWindowSec,
            }
      );
      boundaryRef.current?.focus({ preventScroll: true });
    },
    [store, config?.seed, dilemmaWindowSec, setPaused, boundaryRef]
  );

  const nextWeekDay = useCallback(() => {
    setPaused(false);
    store.getState().clockInWeek();
    boundaryRef.current?.focus({ preventScroll: true });
  }, [store, setPaused, boundaryRef]);

  const backToIntro = useCallback(() => {
    store.getState().backToIntro();
    boundaryRef.current?.focus({ preventScroll: true });
  }, [store, boundaryRef]);

  const openRegister = useCallback(() => {
    if (store.getState().phase !== "shift") return;
    heldKeys.current.clear();
    store.getState().setRegisterOpen(true);
  }, [store]);

  const closeRegister = useCallback(() => {
    store.getState().setRegisterOpen(false);
    boundaryRef.current?.focus({ preventScroll: true });
  }, [store, boundaryRef]);

  // A week (#2086): each finished day records its own shift score on the
  // arcade board, as a single shift does, so the two compete fairly. The
  // week is saved after every day; once Friday ends, its total is kept as a
  // local best week and the full-week trophy unlocks.
  useEffect(
    () =>
      store.subscribe((state, previous) => {
        const week = state.week;
        if (!week || week === previous.week) return;
        if (week.days.length === (previous.week?.days.length ?? 0)) {
          // A new week has started: forget any older save.
          if (week.days.length === 0) clearWeekSave();
          return;
        }
        if (previous.week === null || state.phase !== "ended") {
          // A saved week picked back up: nothing new to record.
          saveWeek(week);
          return;
        }
        const day = week.days[week.days.length - 1];
        recordArcadeScore(PATTY_GAME_ID, day.score, {
          mode: "week",
          day: day.day,
          outcome: day.outcome,
          served: day.served,
        });
        if (!isWeekOver(week)) {
          saveWeek(week);
          return;
        }
        clearWeekSave();
        setPreviousWeekBest(recordWeekBest(scoreWeek(week)));
        recordArcadeMilestone(PATTY_GAME_ID, "full_week");
      }),
    [store]
  );

  // Record the score once per shift, when it ends.
  useEffect(
    () =>
      store.subscribe((state, previous) => {
        // Practice scenarios are for looking at the numbers, not for the board.
        if (
          state.phase === "ended" &&
          previous.phase === "shift" &&
          isStandardScenario(state.shift.config)
        ) {
          // Read the old best first, so the end card can compare (#1938).
          const best = getArcadeProgress().highScores[PATTY_GAME_ID];
          setPreviousBest(typeof best === "number" ? best : null);
          recordArcadeScore(PATTY_GAME_ID, scoreShift(state.shift), {
            outcome: state.shift.outcome,
            served: state.shift.tallies.served,
          });
          // A shift on the day's Arcade Daily seed keeps its own best (#2113).
          const dailyDate = parseArcadeDailyTag(
            state.shift.config.seed,
            PATTY_GAME_ID
          );
          if (dailyDate) {
            recordArcadeDailyResult(PATTY_GAME_ID, dailyDate, {
              score: scoreShift(state.shift),
            });
          }
          if (
            state.shift.outcome === "completed" &&
            state.shift.tallies.served > 0 &&
            state.shift.tallies.late === 0
          ) {
            recordArcadeMilestone(PATTY_GAME_ID, "zero_late_shift");
          }
        }
      }),
    [store]
  );

  // The dock's turn keys hold while a finger is down.
  const handleTurn = useCallback(
    (direction: "left" | "right", down: boolean) => {
      const held = direction === "left" ? TOUCH_LEFT : TOUCH_RIGHT;
      if (!down) {
        heldKeys.current.delete(held);
        return;
      }
      if (store.getState().registerOpen) return;
      heldKeys.current.add(held);
    },
    [store]
  );

  const toggleRegister = useCallback(() => {
    if (store.getState().registerOpen) closeRegister();
    else openRegister();
  }, [store, openRegister, closeRegister]);

  // The touch cabinet asks the game to stop when the tab is hidden, the page
  // is closing or the window loses focus (#2116). Only a shift in progress
  // pauses, and resuming is the player's choice.
  useEffect(() => {
    const pauseForBackground = () => {
      if (store.getState().phase === "shift") setPaused(true);
    };
    window.addEventListener(PATTY_AUTO_PAUSE_EVENT, pauseForBackground);
    return () =>
      window.removeEventListener(PATTY_AUTO_PAUSE_EVENT, pauseForBackground);
  }, [store, setPaused]);

  // Answers the open dilemma with its first (0) or second (1) option, as Q
  // and E do (#2087). False when no dilemma is open.
  const chooseDilemma = useCallback(
    (slot: number) => {
      const state = store.getState();
      const open = state.shift.dilemma;
      if (!open) return false;
      const option = getDilemma(open.dilemmaId).options[slot];
      state.act({ type: "chooseDilemma", optionId: option.id });
      return true;
    },
    [store]
  );

  return {
    chooseDilemma,
    announcement,
    backToIntro,
    clockIn,
    clockInCustom,
    closeRegister,
    endedLog,
    endedShift,
    facing,
    handleTurn,
    heldKeys,
    longerDilemmas,
    nextWeekDay,
    openRegister,
    paused,
    phase,
    previousBest,
    previousWeekBest,
    registerOpen,
    savedWeek,
    setLongerChoice,
    setPaused,
    startWeek,
    store,
    toggleRegister,
    userPaused,
    userPausedRef,
    week,
    yells,
  };
}
