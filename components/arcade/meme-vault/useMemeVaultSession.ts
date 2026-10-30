"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  SOUNDBOARD_BUTTONS,
  EASTER_EGG_ACHIEVEMENTS,
  getUnlockedAchievements,
  memeAchievementsStore,
  unlockAchievement,
  type SoundboardButton,
} from "@/lib/meme-data";
import {
  isSoundAllowed,
  playMemeSound,
  getMemeSoundDuration,
  connectMemeAnalyser,
  releaseMemeAnalyser,
  unlockMemeAudio,
  stopAllMemeSounds,
} from "@/lib/meme-audio";
import { useAnnouncer } from "@/components/providers/A11yProvider";
import { useToast } from "@/hooks/useToast";
import { useAppEvent } from "@/hooks/useAppEvent";
import { emitAppEvent } from "@/lib/event-bus";
import { useEchoGame } from "@/components/arcade/meme-vault/useEchoGame";
import type { EchoRound } from "@/lib/meme-echo";
import { padKeyLabel } from "@/components/arcade/meme-vault/vault-geometry";

/** How long a newly unlocked trophy keeps its stamp class. */
const STAMP_MS = 900;

/** A named moment in the vault (#3432), for sound, effects and tests. */
export type MemeVaultEvent =
  | { readonly type: "padLit"; readonly padId: string }
  | { readonly type: "echoWatch"; readonly length: number }
  | { readonly type: "echoTurn"; readonly length: number }
  | { readonly type: "echoMiss"; readonly expected: string }
  | { readonly type: "echoBest"; readonly streak: number }
  | { readonly type: "trophy"; readonly id: string };

/** What the vault's derived events are read from, once per render. */
export interface VaultMoment {
  /** The lit pad: Echo's, or the sample playing. */
  readonly litId: string | null;
  /** Echo's phase, or null when Echo is not running. */
  readonly phase: EchoRound["phase"] | null;
  /** How many pads the current Echo sequence has. */
  readonly length: number;
  /** The pad Echo wanted when the player missed. */
  readonly missedId: string | null;
}

/**
 * The events between two moments: a pad lighting, Echo playing a sequence
 * (echoWatch), handing the player the turn (echoTurn), or a miss. The first
 * moment has nothing to compare with, so it emits nothing.
 */
export function vaultEvents(
  previous: VaultMoment | null,
  next: VaultMoment
): MemeVaultEvent[] {
  if (!previous) return [];
  const events: MemeVaultEvent[] = [];
  if (next.litId !== null && next.litId !== previous.litId) {
    events.push({ type: "padLit", padId: next.litId });
  }
  if (
    next.phase === "showing" &&
    (previous.phase !== "showing" || next.length !== previous.length)
  ) {
    events.push({ type: "echoWatch", length: next.length });
  } else if (next.phase === "input" && previous.phase !== "input") {
    events.push({ type: "echoTurn", length: next.length });
  }
  if (next.missedId !== null && next.missedId !== previous.missedId) {
    events.push({ type: "echoMiss", expected: next.missedId });
  }
  return events;
}

/** What the session needs from the view. */
interface MemeVaultSessionOptions {
  /** Called with each named session event (#3432). */
  readonly onEvent?: (event: MemeVaultEvent) => void;
}

/**
 * The Meme Vault session (#3432): pad playback and the scope's analyser,
 * Echo and its best, the trophy list and its unlock toasts, the silent-
 * press note and the Retro Chaos shortcut. Moved verbatim from
 * MemeVaultClient.tsx, which renders what it returns.
 */
export function useMemeVaultSession(options: MemeVaultSessionOptions) {
  const { onEvent } = options;
  // The latest onEvent, so a new callback each render re-creates nothing.
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);
  const emit = useCallback((event: MemeVaultEvent) => {
    onEventRef.current?.(event);
  }, []);
  const { announce } = useAnnouncer();
  const toast = useToast();

  // One store for the trophy list, kept in step across tabs (#2371).
  const unlockedIds = memeAchievementsStore.useValue();

  const [activeSound, setActiveSound] = useState<string | null>(null);
  const [activeSoundLabel, setActiveSoundLabel] = useState<string>("");

  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [stampId, setStampId] = useState<string | null>(null);
  // A pad pressed while sound is off says so next to the pads (#1941).
  const [silentPress, setSilentPress] = useState(false);
  const soundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stampTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (soundTimeoutRef.current) {
        clearTimeout(soundTimeoutRef.current);
      }
      if (stampTimeoutRef.current) {
        clearTimeout(stampTimeoutRef.current);
      }
      releaseMemeAnalyser();
    };
  }, []);

  // Every trophy unlock, from this page or anywhere else while it is open,
  // gets the same self-dismissing toast (#1328).
  useAppEvent("meme_achievement_unlocked", (detail) => {
    const achievement = EASTER_EGG_ACHIEVEMENTS.find(
      (a) => a.id === detail?.id
    );
    if (!achievement) return;
    emit({ type: "trophy", id: achievement.id });
    if (stampTimeoutRef.current) clearTimeout(stampTimeoutRef.current);
    setStampId(achievement.id);
    stampTimeoutRef.current = setTimeout(() => {
      setStampId(null);
      stampTimeoutRef.current = null;
    }, STAMP_MS);
    toast.success(`Trophy unlocked: ${achievement.title}`, {
      description: achievement.description,
    });
    const found = new Set(getUnlockedAchievements());
    if (EASTER_EGG_ACHIEVEMENTS.every((a) => found.has(a.id))) {
      toast.success("Vault cleared", {
        description: `All ${EASTER_EGG_ACHIEVEMENTS.length} trophies found. The Easter Egg Trophy Case is stamped complete.`,
      });
      announce("Vault cleared. Every trophy found.", "polite");
    }
  });

  // Trigger soundboard sound
  const handlePlaySound = useCallback(
    (button: SoundboardButton) => {
      if (soundTimeoutRef.current) {
        clearTimeout(soundTimeoutRef.current);
      }

      setActiveSound(button.id);
      setActiveSoundLabel(button.label);
      // The scope's tap goes in before the sound's nodes connect.
      setAnalyser(connectMemeAnalyser());
      playMemeSound(button.synthType);
      // The trophy is for hearing a sample, so a muted press doesn't earn it.
      if (isSoundAllowed()) {
        unlockAchievement("soundboard-maestro");
        setSilentPress(false);
        announce(`Played sound: ${button.label}`, "polite");
      } else {
        setSilentPress(true);
        announce(`${button.label} played silently: sound is off.`, "polite");
      }

      const duration = getMemeSoundDuration(button.synthType);
      soundTimeoutRef.current = setTimeout(() => {
        setActiveSound(null);
        soundTimeoutRef.current = null;
      }, duration);
    },
    [announce]
  );

  // Echo (#2049): the vault plays a sequence on the pads and the player
  // repeats it. Its sounds go through playMemeSound, so the mute switch and
  // the reduced-motion opt-in apply as they do to a pad press.
  const playEchoPad = useCallback((button: SoundboardButton) => {
    setActiveSoundLabel(button.label);
    setAnalyser(connectMemeAnalyser());
    playMemeSound(button.synthType);
  }, []);
  const playEchoFail = useCallback(() => {
    playMemeSound("echo-fail");
  }, []);
  const celebrateEchoBest = useCallback(
    (streak: number) => {
      emit({ type: "echoBest", streak });
      toast.success(`New Echo best: ${streak}`, {
        description: `You repeated a ${streak}-pad sequence. It is kept on this device.`,
      });
    },
    [toast, emit]
  );
  const echo = useEchoGame({
    pads: SOUNDBOARD_BUTTONS,
    onPadSound: playEchoPad,
    onFail: playEchoFail,
    onNewBest: celebrateEchoBest,
    announce,
  });
  const { press: pressEcho } = echo;
  const missedIndex = echo.missedId
    ? SOUNDBOARD_BUTTONS.findIndex((b) => b.id === echo.missedId)
    : -1;
  const missedPad =
    missedIndex >= 0
      ? {
          key: padKeyLabel(missedIndex),
          label: SOUNDBOARD_BUTTONS[missedIndex].label,
        }
      : null;

  // A pad press is an Echo answer while a round runs, a sample otherwise.
  const handlePadPress = useCallback(
    (button: SoundboardButton) => {
      // A tap or key is a gesture the browser accepts for audio, so a
      // suspended context resumes here.
      unlockMemeAudio();
      const index = SOUNDBOARD_BUTTONS.findIndex((b) => b.id === button.id);
      if (index >= 0 && pressEcho(index)) return;
      handlePlaySound(button);
    },
    [pressEcho, handlePlaySound]
  );

  // The browser may suspend audio while the page is hidden; the first visible
  // moment after that wakes it, so the next pad plays cleanly.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) unlockMemeAudio();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Trigger Retro Chaos Mode. The button is a shortcut, so it does not award
  // the Konami trophy: only typing the code does (#1328).
  const triggerChaosMode = useCallback(() => {
    playMemeSound("fanfare");
    emitAppEvent("trigger_retro_chaos");
  }, []);

  const unlockedCount = EASTER_EGG_ACHIEVEMENTS.filter((a) =>
    unlockedIds.includes(a.id)
  ).length;
  const totalAchievements = EASTER_EGG_ACHIEVEMENTS.length;

  // Pad lights, Echo's watch and turn, and a miss are read from what the
  // vault shows, once per render (#3432).
  const moment: VaultMoment = {
    litId: echo.litId ?? activeSound,
    phase: echo.round?.phase ?? null,
    length: echo.round?.sequence.length ?? 0,
    missedId: echo.missedId,
  };
  const previousMoment = useRef<VaultMoment | null>(null);
  useEffect(() => {
    for (const event of vaultEvents(previousMoment.current, moment)) {
      emit(event);
    }
    previousMoment.current = moment;
  });

  // The session's intents (#3432), named for what the player does. The view
  // still calls the handlers above; these are the same calls by name.
  const { start: startEchoRound, stop: stopEcho } = echo;
  const pressPad = useCallback(
    (index: number) => {
      const pad = SOUNDBOARD_BUTTONS[index];
      if (pad) handlePadPress(pad);
    },
    [handlePadPress]
  );
  const startEcho = useCallback(() => {
    unlockMemeAudio();
    startEchoRound();
  }, [startEchoRound]);
  // Stops Echo and every sound, and puts out the lit pad.
  const stopAll = useCallback(() => {
    stopEcho();
    stopAllMemeSounds();
    if (soundTimeoutRef.current) {
      clearTimeout(soundTimeoutRef.current);
      soundTimeoutRef.current = null;
    }
    setActiveSound(null);
  }, [stopEcho]);
  // Wakes suspended audio from a tap or key, as a pad press does.
  const allowSound = unlockMemeAudio;

  return {
    allowSound,
    pressPad,
    startEcho,
    stopAll,
    stopEcho,
    activeSound,
    activeSoundLabel,
    analyser,
    echo,
    handlePadPress,
    missedPad,
    silentPress,
    stampId,
    totalAchievements,
    triggerChaosMode,
    unlockedCount,
    unlockedIds,
  };
}
