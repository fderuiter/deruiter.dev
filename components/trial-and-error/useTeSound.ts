"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { getSoundEngine } from "@/lib/audio/sound-engine";
import {
  registerAudioCleanup,
  useAudio,
} from "@/components/providers/AudioProvider";
import {
  CUE_RECIPES,
  TeMusicLoop,
  type TeCue,
} from "@/components/trial-and-error/teAudio";
import { safeGetRawItem, safeSetRawItem } from "@/lib/safe-storage";

/** Cabinet-level audio switches, persisted per viewer. */
interface TeAudioSettings {
  sfx: boolean;
  music: boolean;
}

/** The cabinet's sound facade. */
interface TeSound {
  /** Plays a named cue, if SFX are on, sound is allowed and the viewer has interacted. */
  play: (cue: TeCue, options?: { step?: number }) => void;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  setSfxEnabled: (on: boolean) => void;
  setMusicEnabled: (on: boolean) => void;
  /** The site-wide mute (AudioProvider), which always wins. */
  siteMuted: boolean;
  unmuteSite: () => void;
}

const SETTINGS_KEY = "te:audio";
const SETTINGS_EVENT = "te:audio-change";
// Music stays off until the viewer turns it on; SFX follow the site mute.
const DEFAULT_SETTINGS = "sfx=1;music=0";

// The viewer's last switch when storage refused to keep it: it holds for
// this page, and the next successful write hands control back to storage.
let pageOnlySettings: string | null = null;

function readSettingsRaw(): string {
  if (pageOnlySettings !== null) return pageOnlySettings;
  const stored = safeGetRawItem(SETTINGS_KEY);
  return stored && /^sfx=[01];music=[01]$/.test(stored)
    ? stored
    : DEFAULT_SETTINGS;
}

function parseSettings(raw: string): TeAudioSettings {
  return { sfx: raw.includes("sfx=1"), music: raw.includes("music=1") };
}

function writeSettings(settings: TeAudioSettings): void {
  const raw = `sfx=${settings.sfx ? 1 : 0};music=${settings.music ? 1 : 0}`;
  // Storage unavailable or full: the choice lasts for this page only (#925).
  // It is kept here rather than in the shared memory cache, so a stale value
  // storage still holds cannot win over it.
  const persisted = safeSetRawItem(SETTINGS_KEY, raw, {
    retainInMemory: false,
  });
  pageOnlySettings = persisted ? null : raw;
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

function subscribeSettings(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SETTINGS_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(SETTINGS_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

let gestureSeen = false;

/** Browsers block audio until a user gesture; so does the cabinet. */
function hasUserGesture(): boolean {
  if (gestureSeen) return true;
  const activation =
    typeof navigator !== "undefined"
      ? (
          navigator as Navigator & {
            userActivation?: { hasBeenActive: boolean };
          }
        ).userActivation
      : undefined;
  return activation?.hasBeenActive === true;
}

function subscribeGesture(): () => void {
  if (typeof window === "undefined" || gestureSeen) return () => {};
  const mark = () => {
    gestureSeen = true;
  };
  window.addEventListener("pointerdown", mark, { once: true, capture: true });
  window.addEventListener("keydown", mark, { once: true, capture: true });
  return () => {
    window.removeEventListener("pointerdown", mark, { capture: true });
    window.removeEventListener("keydown", mark, { capture: true });
  };
}

/**
 * Named, synthesized cabinet sounds over the shared SoundEngine. Muted by
 * default through the site-wide mute; when sound is not allowed or no gesture
 * has happened, `play` returns before any AudioContext work.
 */
export function useTeSound(): TeSound {
  const raw = useSyncExternalStore(
    subscribeSettings,
    readSettingsRaw,
    () => DEFAULT_SETTINGS
  );
  const settings = parseSettings(raw);
  const { muted, setMuted } = useAudio();

  useEffect(() => subscribeGesture(), []);

  return {
    play: (cue, options = {}) => {
      if (!settings.sfx || !hasUserGesture()) return;
      const engine = getSoundEngine();
      if (!engine.isSoundAllowed()) return;
      CUE_RECIPES[cue](engine, options);
    },
    sfxEnabled: settings.sfx,
    musicEnabled: settings.music,
    setSfxEnabled: (on) => writeSettings({ ...settings, sfx: on }),
    setMusicEnabled: (on) => writeSettings({ ...settings, music: on }),
    siteMuted: muted,
    unmuteSite: () => setMuted(false),
  };
}

/**
 * Runs the ambient loop while music is on, the site is unmuted and the tab is
 * visible. It stops when the cabinet unmounts or the tab is hidden, and
 * ducks while `ducked` (score resolution).
 */
export function useTeMusic({
  enabled,
  siteMuted,
  boss,
  ducked,
}: {
  enabled: boolean;
  siteMuted: boolean;
  boss: boolean;
  ducked: boolean;
}): void {
  const loop = useRef<TeMusicLoop | null>(null);

  useEffect(() => {
    if (!enabled || siteMuted || typeof document === "undefined") return;
    const music = (loop.current ??= new TeMusicLoop(getSoundEngine()));
    const sync = () => {
      if (document.visibilityState === "hidden") music.stop();
      else if (hasUserGesture()) music.start(boss);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    // The site's audio teardown (route exit, global stop) also stops the loop.
    const unregister = registerAudioCleanup(() => music.stop());
    return () => {
      document.removeEventListener("visibilitychange", sync);
      unregister();
      music.stop();
    };
  }, [enabled, siteMuted, boss]);

  useEffect(() => {
    loop.current?.duck(ducked);
  }, [ducked]);
}
