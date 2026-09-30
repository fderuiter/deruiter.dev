"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getSoundEngine } from "@/lib/audio/sound-engine";
import { getMatchMediaMatches } from "@/hooks/useMediaQuery";
import { safeGetItem, safeSetRawItem } from "@/lib/safe-storage";

export type AudioProfile = "8-bit" | "90s-retro" | "ambient";

/**
 * Storage key for the synth profile. The value is stored as the bare profile
 * name (not a safeStorage envelope) so preferences saved by earlier releases
 * keep working; write it only through `safeSetRawItem`.
 */
const SOUND_PROFILE_KEY = "sound_profile";

function isAudioProfile(value: unknown): value is AudioProfile {
  return value === "8-bit" || value === "90s-retro" || value === "ambient";
}

const audioCleanupRegistry = new Set<() => void>();

export function registerAudioCleanup(fn: () => void): () => void {
  audioCleanupRegistry.add(fn);
  return () => {
    audioCleanupRegistry.delete(fn);
  };
}

function cleanupGovernedAudio(): void {
  getSoundEngine().stopAll();
  audioCleanupRegistry.forEach((fn) => {
    try {
      fn();
    } catch {
      // Ignore audio cleanup errors
    }
  });
  audioCleanupRegistry.clear();
}

interface AudioContextType {
  volume: number;
  muted: boolean;
  profile: AudioProfile;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setProfile: (p: AudioProfile) => void;
  playNote: (frequency: number, duration: number, pan?: number) => void;
  playKeystroke: (charCode: number) => void;
  playAutocomplete: () => void;
  playSuccess: () => void;
  playSubmit: () => void;
  playError: () => void;
  playHover: (pan?: number) => void;
  playSkillHover: () => void;
  bypassActive: boolean;
}

const defaultAudioContext: AudioContextType = {
  volume: 0.3,
  muted: true,
  profile: "8-bit",
  setVolume: () => {},
  setMuted: () => {},
  setProfile: () => {},
  playNote: () => {},
  playKeystroke: () => {},
  playAutocomplete: () => {},
  playSuccess: () => {},
  playSubmit: () => {},
  playError: () => {},
  playHover: () => {},
  playSkillHover: () => {},
  bypassActive: false,
};

const AudioProviderContext = createContext<AudioContextType | null>(null);

export function useAudio() {
  const context = useContext(AudioProviderContext);
  return context || defaultAudioContext;
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [volume, setVolumeState] = useState(0.3);
  const [muted, setMutedState] = useState(true);
  const [profile, setProfileState] = useState<AudioProfile>("8-bit");
  const [bypassActive, setBypassActive] = useState(false);

  // Sync state with central SoundEngine instance on client mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const engine = getSoundEngine();
    // SoundEngine persists "sound_volume" and "sound_muted" itself; only the
    // synth profile is stored here.
    const savedProfile = safeGetItem<unknown>(SOUND_PROFILE_KEY);

    setTimeout(() => {
      setVolumeState(engine.getVolume());
      setMutedState(engine.isMuted());
      setBypassActive(engine.isBypassActive());
      if (isAudioProfile(savedProfile)) {
        setProfileState(savedProfile);
      }
    }, 0);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkBypass = () => {
      const engine = getSoundEngine();
      setBypassActive(engine.isBypassActive());
    };

    checkBypass();

    const mqForced = window.matchMedia?.("(forced-colors: active)");
    const mqContrast = window.matchMedia?.("(-ms-high-contrast: active)");
    const mqMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");

    mqForced?.addEventListener?.("change", checkBypass);
    mqContrast?.addEventListener?.("change", checkBypass);
    mqMotion?.addEventListener?.("change", checkBypass);

    return () => {
      mqForced?.removeEventListener?.("change", checkBypass);
      mqContrast?.removeEventListener?.("change", checkBypass);
      mqMotion?.removeEventListener?.("change", checkBypass);
    };
  }, []);

  useEffect(() => {
    return () => {
      getSoundEngine().close();
      cleanupGovernedAudio();
    };
  }, []);

  const playNote = (frequency: number, duration: number, pan?: number) => {
    const engine = getSoundEngine();
    if (!engine.isSoundAllowed()) return;

    let type: OscillatorType = "sine";
    let attack = 0.1;
    let decay = 0.1;
    let sustain = 0.5;
    let release = 0.1;
    let profileVolume = 0.5;

    if (profile === "8-bit") {
      type = "square";
      attack = 0.005;
      decay = 0.08;
      sustain = 0.1;
      release = 0.1;
      profileVolume = 0.25;
    } else if (profile === "90s-retro") {
      type = "sawtooth";
      attack = 0.02;
      decay = 0.15;
      sustain = 0.25;
      release = 0.2;
      profileVolume = 0.2;
    } else if (profile === "ambient") {
      type = "sine";
      attack = 0.2;
      decay = 0.3;
      sustain = 0.5;
      release = 0.5;
      profileVolume = 0.55;
    }

    engine.playTone({
      frequency,
      duration,
      type,
      volume: profileVolume,
      pan,
      attack,
      decay,
      sustain,
      release,
    });
  };

  const playKeystroke = (charCode: number) => {
    const pentatonicScale = [
      130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63, 392.0,
      440.0, 523.25, 587.33, 659.25, 783.99, 880.0,
    ];
    const idx = charCode % pentatonicScale.length;
    playNote(pentatonicScale[idx], 0.05);
  };

  const playAutocomplete = () => {
    const notes = [261.63, 329.63, 392.0, 523.25];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        playNote(freq, 0.08);
      }, idx * 60);
    });
  };

  const playSuccess = () => {
    if (profile === "ambient") {
      const notes = [261.63, 329.63, 392.0, 493.88];
      notes.forEach((freq) => {
        playNote(freq, 0.4);
      });
    } else {
      const notes = [329.63, 392.0, 523.25, 659.25];
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          playNote(freq, 0.12);
        }, idx * 80);
      });
    }
  };

  const playSubmit = () => {
    playNote(523.25, 0.06);
    setTimeout(() => {
      playNote(659.25, 0.08);
    }, 50);
  };

  const playError = () => {
    playNote(311.13, 0.08);
    setTimeout(() => {
      playNote(233.08, 0.12);
    }, 60);
  };

  const playHover = (pan?: number) => {
    if (getMatchMediaMatches("(hover: none)")) return;
    const freq = profile === "ambient" ? 440.0 : 880.0;
    playNote(freq, 0.02, pan);
  };

  const playSkillHover = () => {
    if (getMatchMediaMatches("(hover: none)")) return;
    const notes = [261.63, 293.66, 329.63, 392.0, 440.0];
    const randomFreq = notes[Math.floor(Math.random() * notes.length)];
    playNote(randomFreq, 0.1);
  };

  const handleSetVolume = (v: number) => {
    const engine = getSoundEngine();
    engine.setVolume(v);
    setVolumeState(engine.getVolume());
  };

  const handleSetMuted = (m: boolean) => {
    const engine = getSoundEngine();
    engine.setMuted(m);
    setMutedState(engine.isMuted());
    if (m) {
      cleanupGovernedAudio();
    }
  };

  const handleSetProfile = (p: AudioProfile) => {
    setProfileState(p);
    safeSetRawItem(SOUND_PROFILE_KEY, p);

    // Play sound confirmation for swapped profile
    setTimeout(() => {
      let confirmFreq = 523.25; // C5
      if (p === "ambient") {
        confirmFreq = 329.63; // E4
      } else if (p === "90s-retro") {
        confirmFreq = 440.0; // A4
      }
      playNote(confirmFreq, 0.15);
    }, 10);
  };

  const value = React.useMemo(
    () => ({
      volume,
      muted,
      profile,
      setVolume: handleSetVolume,
      setMuted: handleSetMuted,
      setProfile: handleSetProfile,
      playNote,
      playKeystroke,
      playAutocomplete,
      playSuccess,
      playSubmit,
      playError,
      playHover,
      playSkillHover,
      bypassActive,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [volume, muted, profile, bypassActive]
  );

  return (
    <AudioProviderContext.Provider value={value}>
      {children}
    </AudioProviderContext.Provider>
  );
}
