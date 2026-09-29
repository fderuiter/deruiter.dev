"use client";

import React, { useState } from "react";
import {
  IconVolume,
  IconVolumeOff,
  IconMusic,
  IconSparkles,
  IconCrosshair,
  IconCheck,
  IconAlertTriangle,
  IconKeyboard,
  IconArrowsHorizontal,
} from "@tabler/icons-react";
import { useAudio, type AudioProfile } from "@/components/providers/AudioProvider";

export const AudioSynthLab: React.FC = () => {
  const {
    volume,
    muted,
    profile,
    setVolume,
    setMuted,
    setProfile,
    playHover,
    playNote,
    playSuccess,
    playError,
    playKeystroke,
  } = useAudio();

  const [pan, setPan] = useState(0);
  const [activeSoundName, setActiveSoundName] = useState<string | null>(null);

  const triggerSound = (name: string, action: () => void) => {
    setActiveSoundName(name);
    action();
    setTimeout(() => {
      setActiveSoundName(null);
    }, 300);
  };

  const handleProfileChange = (newProfile: AudioProfile) => {
    setProfile(newProfile);
    playHover();
  };

  return (
    <div className="w-full rounded-2xl bg-zinc-900/50 border border-zinc-800/80 p-6 backdrop-blur-xl relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
            <IconMusic className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-mono font-bold text-white flex items-center gap-2">
              <span>Web Audio Synthesizer Lab</span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 rounded-full">
                Zero Assets
              </span>
            </h3>
            <p className="text-xs text-zinc-400 font-sans mt-0.5">
              100% procedural sound synthesis using the native Web Audio API (`AudioContext`, `StereoPannerNode`, `GainNode`).
            </p>
          </div>
        </div>

        {/* Global Volume & Mute Toggle */}
        <div className="flex items-center gap-3 bg-zinc-950/80 border border-zinc-800 px-3 py-1.5 rounded-xl">
          <button
            type="button"
            onClick={() => setMuted(!muted)}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
            aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
          >
            {muted ? (
              <IconVolumeOff className="w-4 h-4 text-rose-400" />
            ) : (
              <IconVolume className="w-4 h-4 text-emerald-400" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            disabled={muted}
            onChange={(e) => {
              if (muted) setMuted(false);
              setVolume(Number(e.target.value));
            }}
            aria-label="Master audio volume"
            className="w-20 accent-purple-400 cursor-pointer disabled:opacity-30"
          />
          <span className="text-[11px] font-mono text-zinc-400 w-8 text-right">
            {muted ? "0%" : `${Math.round(volume * 100)}%`}
          </span>
        </div>
      </div>

      {/* Profile & Panning Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-5">
        <div className="space-y-2">
          <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block font-semibold">
            Synthesizer Timbre Profile
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["8-bit", "90s-retro", "ambient"] as AudioProfile[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleProfileChange(p)}
                className={`py-2 px-2.5 rounded-xl border text-xs font-mono capitalize transition-all cursor-pointer ${
                  profile === p
                    ? "bg-purple-500/15 border-purple-500/50 text-purple-300 font-bold"
                    : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="soundboard-pan" className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block font-semibold flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <IconArrowsHorizontal className="w-3.5 h-3.5 text-purple-400" />
              Spatial Stereo Pan
            </span>
            <span className="text-[10px] text-muted">
              {pan < -0.1 ? `Left ${Math.round(Math.abs(pan) * 100)}%` : pan > 0.1 ? `Right ${Math.round(pan * 100)}%` : "Center"}
            </span>
          </label>
          <div className="flex items-center gap-2 bg-zinc-950/60 border border-zinc-800 rounded-xl p-2">
            <span className="text-[10px] font-mono text-muted">L</span>
            <input
              id="soundboard-pan"
              type="range"
              min={-1}
              max={1}
              step={0.1}
              value={pan}
              onChange={(e) => setPan(Number(e.target.value))}
              aria-label="Stereo panning slider"
              className="w-full accent-purple-400 cursor-pointer"
            />
            <span className="text-[10px] font-mono text-muted">R</span>
          </div>
        </div>
      </div>

      {/* Interactive Soundboard Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
        <button
          type="button"
          onClick={() => triggerSound("tactile", () => playHover(pan))}
          className={`p-3 rounded-xl border flex flex-col items-center text-center gap-2 transition-all cursor-pointer ${
            activeSoundName === "tactile"
              ? "bg-purple-500/20 border-purple-400 scale-95"
              : "bg-zinc-950/70 border-zinc-800 hover:border-purple-500/40 hover:bg-zinc-900/80"
          }`}
        >
          <IconSparkles className="w-4 h-4 text-brand-cyan" />
          <div>
            <div className="text-xs font-mono font-bold text-white">Tactile Pop</div>
            <div className="text-[10px] text-muted font-mono">UI Hover / Click</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => triggerSound("laser", () => playNote(880, 0.08, pan))}
          className={`p-3 rounded-xl border flex flex-col items-center text-center gap-2 transition-all cursor-pointer ${
            activeSoundName === "laser"
              ? "bg-purple-500/20 border-purple-400 scale-95"
              : "bg-zinc-950/70 border-zinc-800 hover:border-purple-500/40 hover:bg-zinc-900/80"
          }`}
        >
          <IconCrosshair className="w-4 h-4 text-purple-400" />
          <div>
            <div className="text-xs font-mono font-bold text-white">Laser Blip</div>
            <div className="text-[10px] text-muted font-mono">880Hz Chip Pulse</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => triggerSound("success", () => playSuccess())}
          className={`p-3 rounded-xl border flex flex-col items-center text-center gap-2 transition-all cursor-pointer ${
            activeSoundName === "success"
              ? "bg-purple-500/20 border-purple-400 scale-95"
              : "bg-zinc-950/70 border-zinc-800 hover:border-emerald-500/40 hover:bg-zinc-900/80"
          }`}
        >
          <IconCheck className="w-4 h-4 text-emerald-400" />
          <div>
            <div className="text-xs font-mono font-bold text-white">Success Chord</div>
            <div className="text-[10px] text-muted font-mono">Major Triad</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => triggerSound("error", () => playError())}
          className={`p-3 rounded-xl border flex flex-col items-center text-center gap-2 transition-all cursor-pointer ${
            activeSoundName === "error"
              ? "bg-purple-500/20 border-purple-400 scale-95"
              : "bg-zinc-950/70 border-zinc-800 hover:border-rose-500/40 hover:bg-zinc-900/80"
          }`}
        >
          <IconAlertTriangle className="w-4 h-4 text-rose-400" />
          <div>
            <div className="text-xs font-mono font-bold text-white">Error Buzz</div>
            <div className="text-[10px] text-muted font-mono">Diminished 5th</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => triggerSound("key", () => playKeystroke(65 + Math.floor(Math.random() * 26)))}
          className={`p-3 rounded-xl border col-span-2 sm:col-span-1 flex flex-col items-center text-center gap-2 transition-all cursor-pointer ${
            activeSoundName === "key"
              ? "bg-purple-500/20 border-purple-400 scale-95"
              : "bg-zinc-950/70 border-zinc-800 hover:border-amber-500/40 hover:bg-zinc-900/80"
          }`}
        >
          <IconKeyboard className="w-4 h-4 text-amber-400" />
          <div>
            <div className="text-xs font-mono font-bold text-white">Keystroke Clack</div>
            <div className="text-[10px] text-muted font-mono">Dynamic ASCII Pitch</div>
          </div>
        </button>
      </div>
    </div>
  );
};
