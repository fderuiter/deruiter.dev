"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { SoundboardButton } from "@/lib/meme-data";
import {
  getEchoBest,
  recordEchoMilestones,
  recordEchoStreak,
} from "@/lib/meme-data";
import {
  ECHO_LIGHT_FRACTION,
  beginEchoInput,
  createEchoRound,
  echoStepMs,
  submitEchoInput,
  type EchoRound,
} from "@/lib/meme-echo";
import { STORAGE_CHANGE_EVENT } from "@/lib/safe-storage";

/** Pause before the first playback, so the start press's own sound clears. */
const LEAD_IN_MS = 450;
/** Pause between a repeated sequence and the next, longer playback. */
const NEXT_ROUND_MS = 750;
/** How long a pad the player presses stays lit. */
const PRESS_FLASH_MS = 180;

interface UseEchoGameOptions {
  pads: readonly SoundboardButton[];
  /** Sounds a pad, for playback and for the player's presses. */
  onPadSound: (pad: SoundboardButton) => void;
  /** Sounds the fail sting. */
  onFail: () => void;
  /** Called when a finished round beat the stored best streak. */
  onNewBest: (streak: number) => void;
  announce: (message: string, politeness?: "polite" | "assertive") => void;
}

interface EchoGame {
  /** The current round, or null before Echo starts or after it stops. */
  round: EchoRound | null;
  /** Id of the pad Echo has lit, or null. */
  litId: string | null;
  /**
   * Id of the pad the vault wanted when a wrong pad ended the round, or
   * null. It stays marked until Echo starts again or stops (#2125).
   */
  missedId: string | null;
  /** Best streak stored on this device. */
  best: number;
  /** True after a pad was pressed while the vault was still playing. */
  early: boolean;
  start: () => void;
  stop: () => void;
  /**
   * Offers a pad press to Echo. Returns true when Echo took it (the round is
   * playing or waiting for input), false when the pad should play as usual.
   */
  press: (padIndex: number) => boolean;
}

function subscribeBest(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_CHANGE_EVENT, callback);
  };
}

function getBestServerSnapshot(): number {
  return 0;
}

function makeSeed(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 0x100000000).toString(36)}`;
}

/**
 * Runs Echo on the sampler pads (#2049): timers for playback and the
 * player's turn, with the sequence rules in the pure lib/meme-echo engine.
 * All timers stop when Echo stops or the vault unmounts.
 */
export function useEchoGame({
  pads,
  onPadSound,
  onFail,
  onNewBest,
  announce,
}: UseEchoGameOptions): EchoGame {
  const [round, setRound] = useState<EchoRound | null>(null);
  const [litId, setLitId] = useState<string | null>(null);
  const [early, setEarly] = useState(false);
  const [missedId, setMissedId] = useState<string | null>(null);
  const earlyRef = useRef(false);
  const best = useSyncExternalStore(
    subscribeBest,
    getEchoBest,
    getBestServerSnapshot
  );

  const roundRef = useRef<EchoRound | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const callbacksRef = useRef({
    pads,
    onPadSound,
    onFail,
    onNewBest,
    announce,
  });
  useEffect(() => {
    callbacksRef.current = { pads, onPadSound, onFail, onNewBest, announce };
  });

  const clearTimers = useCallback(() => {
    for (const timer of timersRef.current) clearTimeout(timer);
    timersRef.current = [];
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms));
  }, []);

  const commit = useCallback((next: EchoRound | null) => {
    roundRef.current = next;
    setRound(next);
    // Any change of round or phase clears the early-press nudge.
    earlyRef.current = false;
    setEarly(false);
  }, []);

  const playBack = useCallback(
    (next: EchoRound, delayMs: number) => {
      const step = echoStepMs(next.sequence.length);
      const lit = Math.round(step * ECHO_LIGHT_FRACTION);
      next.sequence.forEach((padIndex, i) => {
        const at = delayMs + i * step;
        later(() => {
          const pad = callbacksRef.current.pads[padIndex];
          if (!pad) return;
          setLitId(pad.id);
          callbacksRef.current.onPadSound(pad);
        }, at);
        later(() => setLitId(null), at + lit);
      });
      later(
        () => {
          const current = roundRef.current;
          if (!current) return;
          commit(beginEchoInput(current));
          const count = current.sequence.length;
          callbacksRef.current.announce(
            `Your turn: repeat ${count} ${count === 1 ? "pad" : "pads"}.`,
            "polite"
          );
        },
        delayMs + next.sequence.length * step
      );
    },
    [commit, later]
  );

  const start = useCallback(() => {
    clearTimers();
    setLitId(null);
    setMissedId(null);
    const next = createEchoRound(makeSeed());
    commit(next);
    callbacksRef.current.announce(
      "Echo started. Watch the pads, then repeat them.",
      "polite"
    );
    playBack(next, LEAD_IN_MS);
  }, [clearTimers, commit, playBack]);

  const stop = useCallback(() => {
    clearTimers();
    setLitId(null);
    setMissedId(null);
    commit(null);
  }, [clearTimers, commit]);

  const press = useCallback(
    (padIndex: number): boolean => {
      const current = roundRef.current;
      if (!current || current.phase === "over") return false;
      // The vault is still playing: the press is not an answer, but the
      // player is told to wait rather than having the tap vanish.
      if (current.phase === "showing") {
        if (!earlyRef.current) {
          earlyRef.current = true;
          setEarly(true);
          callbacksRef.current.announce(
            "Wait for the vault to finish, then repeat it."
          );
        }
        return true;
      }

      const { round: next, outcome } = submitEchoInput(current, padIndex);
      const { pads: padList, onPadSound: sound } = callbacksRef.current;
      const pad = padList[padIndex];
      commit(next);

      if (outcome === "fail") {
        clearTimers();
        setLitId(null);
        callbacksRef.current.onFail();
        const expected =
          next.expectedPad !== null ? padList[next.expectedPad] : undefined;
        setMissedId(expected?.id ?? null);
        const newBest = recordEchoStreak(next.streak);
        callbacksRef.current.announce(
          `Wrong pad. Echo over with a streak of ${next.streak}.${
            expected ? ` The vault played ${expected.label}.` : ""
          }`,
          "assertive"
        );
        if (newBest) callbacksRef.current.onNewBest(next.streak);
        return true;
      }

      if (pad) {
        setLitId(pad.id);
        sound(pad);
        later(() => {
          setLitId((id) => (id === pad.id ? null : id));
        }, PRESS_FLASH_MS);
      }

      if (outcome === "complete") {
        recordEchoMilestones(next.streak);
        callbacksRef.current.announce(
          `Streak ${next.streak}. Watch the next sequence.`,
          "polite"
        );
        playBack(next, NEXT_ROUND_MS);
      }
      return true;
    },
    [clearTimers, commit, later, playBack]
  );

  useEffect(() => clearTimers, [clearTimers]);

  // A best set before the Echo trophies existed still earns them (#2126).
  useEffect(() => {
    recordEchoMilestones(getEchoBest());
  }, []);

  // A hidden page (app switch, lock screen, Split View hand-off) stops the
  // playback timers, which a browser throttles or freezes, so the sequence
  // never runs unseen. Coming back replays the same sequence from its start.
  // The player's turn has no timers and stays as it was.
  useEffect(() => {
    let paused = false;
    const onVisibility = () => {
      const current = roundRef.current;
      if (document.hidden) {
        if (current?.phase !== "showing") return;
        paused = true;
        clearTimers();
        setLitId(null);
      } else if (paused) {
        paused = false;
        if (current?.phase === "showing") playBack(current, LEAD_IN_MS);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [clearTimers, playBack]);

  return { round, litId, missedId, best, early, start, stop, press };
}
