"use client";

import React, {
  useState,
  useEffect,
  useSyncExternalStore,
  useCallback,
  useRef,
} from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { getMatchMediaMatches } from "@/hooks/useMediaQuery";
import {
  MEME_QUOTES,
  SOUNDBOARD_BUTTONS,
  EASTER_EGG_ACHIEVEMENTS,
  ASCII_COWSAY,
  ASCII_DUCK,
  ASCII_LASER_LOON,
  ASCII_TRAIN,
  getUnlockedAchievements,
  unlockAchievement,
  type SoundboardButton,
} from "@/lib/meme-data";
import { clamp } from "@/lib/game-utils";
import { playMemeSound, getMemeSoundDuration } from "@/lib/meme-audio";
import { useAnnouncer } from "@/components/providers/A11yProvider";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  IconSparkles,
  IconTrophy,
  IconVolume,
  IconCopy,
  IconCheck,
  IconTerminal,
  IconArrowLeft,
  IconActivity,
  IconX,
} from "@tabler/icons-react";

function subscribeAchievements(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("meme_achievement_unlocked", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("meme_achievement_unlocked", callback);
    window.removeEventListener("storage", callback);
  };
}

function getAchievementsSnapshot(): string {
  return JSON.stringify(getUnlockedAchievements());
}

function getAchievementsServerSnapshot(): string {
  return "[]";
}

// 24-Bar Architectural Web Audio Spectrum Visualizer
const AudioWaveformVisualizer: React.FC<{
  isPlaying: boolean;
  soundLabel?: string;
}> = ({ isPlaying, soundLabel }) => {
  const barRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    let animFrame: number;
    const prefersReduced = getMatchMediaMatches(
      "(prefers-reduced-motion: reduce)"
    );

    if (prefersReduced) {
      for (let i = 0; i < 24; i++) {
        const el = barRefs.current[i];
        if (el) {
          el.style.setProperty("--bar-scale", "0.15");
        }
      }
      return;
    }

    const updateFrequencies = (currentTime: number) => {
      for (let i = 0; i < 24; i++) {
        const el = barRefs.current[i];
        if (!el) continue;
        let scaleVal: number;
        if (isPlaying) {
          const base = 0.25 + Math.sin(currentTime * 0.01 + i * 0.4) * 0.2;
          const spike = Math.random() * 0.55;
          scaleVal = clamp(base + spike, 0.15, 1.0);
        } else {
          // Idle ambient breath
          scaleVal = 0.1 + Math.sin(currentTime * 0.002 + i * 0.3) * 0.06;
        }
        el.style.setProperty("--bar-scale", scaleVal.toFixed(4));
      }
      animFrame = requestAnimationFrame(updateFrequencies);
    };

    animFrame = requestAnimationFrame(updateFrequencies);
    return () => cancelAnimationFrame(animFrame);
  }, [isPlaying]);

  return (
    <div className="relative rounded-2xl border border-emerald-500/20 bg-slate-950/80 p-4 sm:p-5 backdrop-blur-md overflow-hidden mb-8">
      <div className="flex items-center justify-between gap-3 mb-3 text-xs">
        <div className="flex items-center gap-2 text-emerald-400 font-bold">
          <IconActivity
            className={`w-4 h-4 ${isPlaying ? "animate-pulse" : ""}`}
          />
          <span className="uppercase tracking-wider text-[11px]">
            {isPlaying
              ? `Synthesizing Waveform: ${soundLabel}`
              : "Web Audio Synthesis Engine (Idle)"}
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted">
          24-Channel DSP · 44.1kHz
        </span>
      </div>

      {/* Spectrum Waveform Bars */}
      <div className="flex items-end justify-between gap-1 sm:gap-1.5 h-14 sm:h-16 w-full px-1">
        {Array.from({ length: 24 }).map((_, idx) => (
          <div
            key={idx}
            className="flex-1 flex flex-col items-center justify-end h-full"
          >
            <div
              className={`w-full h-full rounded-t-sm overflow-hidden ${
                isPlaying ? "shadow-[0_0_8px_rgba(16,185,129,0.5)]" : ""
              }`}
            >
              <div
                ref={(el) => {
                  barRefs.current[idx] = el;
                }}
                className={`w-full h-full origin-bottom transform-gpu ${
                  isPlaying
                    ? "bg-gradient-to-t from-emerald-500 via-teal-400 to-cyan-300"
                    : "bg-emerald-950/50 hover:bg-emerald-800/40"
                }`}
                style={{
                  transform: "scaleY(var(--bar-scale, 0.15))",
                  transformOrigin: "bottom",
                  willChange: "transform",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const MemeVaultClient: React.FC = () => {
  const { announce } = useAnnouncer();
  const prefersReducedMotion = useReducedMotion();

  const rawAchievements = useSyncExternalStore(
    subscribeAchievements,
    getAchievementsSnapshot,
    getAchievementsServerSnapshot
  );

  const unlockedIds: string[] = React.useMemo(() => {
    try {
      return JSON.parse(rawAchievements);
    } catch {
      return [];
    }
  }, [rawAchievements]);

  const [activeSound, setActiveSound] = useState<string | null>(null);
  const [activeSoundLabel, setActiveSoundLabel] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [asciiTab, setAsciiTab] = useState<
    "cowsay" | "duck" | "loon" | "train"
  >("cowsay");
  const [reactions, setReactions] = useState<Record<string, number>>({});
  const [celebrationAchievement, setCelebrationAchievement] = useState<
    string | null
  >(null);
  const soundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (soundTimeoutRef.current) {
        clearTimeout(soundTimeoutRef.current);
      }
    };
  }, []);

  // Trigger soundboard sound
  const handlePlaySound = (button: SoundboardButton) => {
    if (soundTimeoutRef.current) {
      clearTimeout(soundTimeoutRef.current);
    }

    setActiveSound(button.id);
    setActiveSoundLabel(button.label);
    playMemeSound(button.synthType);
    unlockAchievement("soundboard-maestro");
    announce(`Played sound: ${button.label}`, "polite");

    const duration = getMemeSoundDuration(button.synthType);
    soundTimeoutRef.current = setTimeout(() => {
      setActiveSound(null);
      soundTimeoutRef.current = null;
    }, duration);
  };

  // React to meme card
  const handleReaction = (id: string) => {
    setReactions((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
    playMemeSound("laser");
  };

  // Trigger Retro Chaos Mode
  const triggerChaosMode = useCallback(() => {
    unlockAchievement("konami-hero");
    playMemeSound("fanfare");
    setCelebrationAchievement("Konami Retro Hero Unlocked!");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("trigger_retro_chaos"));
    }
  }, []);

  const filteredQuotes = MEME_QUOTES.filter(
    (q) => selectedCategory === "all" || q.category === selectedCategory
  );

  const unlockedCount = unlockedIds.length;
  const totalAchievements = EASTER_EGG_ACHIEVEMENTS.length;
  const progressPercent = Math.round((unlockedCount / totalAchievements) * 100);

  const getAsciiContent = () => {
    switch (asciiTab) {
      case "cowsay":
        return ASCII_COWSAY("You found the secret handshake.");
      case "duck":
        return ASCII_DUCK();
      case "loon":
        return ASCII_LASER_LOON();
      case "train":
        return ASCII_TRAIN();
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 font-mono text-slate-100">
      {/* Unlock Celebration Toast Modal */}
      <AnimatePresence>
        {celebrationAchievement && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-4 sm:right-8 z-50 p-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-amber-950 border border-amber-400/50 shadow-[0_0_30px_rgba(245,158,11,0.3)] max-w-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl animate-bounce">🏆</span>
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-amber-400 font-bold">
                    Secret Achievement Unlocked!
                  </h4>
                  <p className="text-sm text-white font-semibold">
                    {celebrationAchievement}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCelebrationAchievement(null)}
                className="p-1 text-zinc-400 hover:text-white transition-colors"
                aria-label="Close celebration toast"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Breadcrumb & Chaos Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <Link
          href="/arcade"
          className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
        >
          <IconArrowLeft className="w-4 h-4" />
          <span>Back to Arcade Hub</span>
        </Link>

        <button
          onClick={triggerChaosMode}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-semibold shadow-lg shadow-emerald-500/10 transition-all hover:scale-105 active:scale-95"
        >
          <IconSparkles className="w-4 h-4 animate-spin" />
          <span>Launch Retro Chaos Mode</span>
        </button>
      </div>

      {/* Header Banner */}
      <div className="relative rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/40 via-slate-900/80 to-slate-950/90 p-6 sm:p-10 mb-12 shadow-[0_0_50px_rgba(16,185,129,0.1)] overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-bold uppercase tracking-wider">
              Meme Soundboard & Trophy Room
            </span>
            <span className="text-xs text-slate-400 font-sans">v2.4.0</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white mb-4">
            Developer Soundboard &amp; Meme Vault
          </h1>

          <p className="text-sm sm:text-base text-slate-300 font-sans leading-relaxed mb-6">
            A soundboard, hidden trophies, and jokes for people who have spent
            too long looking at error messages.
          </p>

          {/* Achievement Progress Bar */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 max-w-xl">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="flex items-center gap-1.5 text-amber-300 font-bold">
                <IconTrophy className="w-4 h-4 text-amber-400" />
                Easter Egg Completion
              </span>
              <span className="text-slate-400">
                {unlockedCount} of {totalAchievements} ({progressPercent}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: progressPercent / 100 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 0.8, ease: "easeOut" }
                }
                className="h-full w-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-amber-400 rounded-full origin-left transform-gpu"
                style={{ transformOrigin: "left", willChange: "transform" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 1: Synthesized Web Audio Soundboard & Waveform Visualizer */}
      <section className="mb-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <IconVolume className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              8-Channel Retro Soundboard
            </h2>
            <p className="text-xs text-slate-400 font-sans">
              Every sound is generated in your browser.
            </p>
          </div>
        </div>

        {/* Dynamic Waveform Visualizer */}
        <AudioWaveformVisualizer
          isPlaying={activeSound !== null}
          soundLabel={activeSoundLabel}
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {SOUNDBOARD_BUTTONS.map((btn) => {
            const isPlaying = activeSound === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => handlePlaySound(btn)}
                className={`relative flex flex-col items-start p-4 sm:p-5 rounded-2xl border bg-gradient-to-b ${btn.accent} transition-all duration-200 text-left focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-md hover:scale-[1.02] active:scale-[0.96] cursor-pointer ${
                  isPlaying
                    ? "ring-2 ring-white shadow-[0_0_25px_rgba(255,255,255,0.3)]"
                    : ""
                }`}
                aria-label={`Play ${btn.label}`}
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <span className="text-2xl sm:text-3xl">{btn.emoji}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/40 text-slate-300 border border-white/10">
                    {btn.category}
                  </span>
                </div>
                <h3 className="font-bold text-sm sm:text-base text-white mb-1">
                  {btn.label}
                </h3>
                <p className="text-xs text-slate-300/80 font-sans leading-snug">
                  {btn.description}
                </p>

                {isPlaying && (
                  <motion.div
                    layoutId="sound-indicator"
                    className="absolute top-2 right-2 flex gap-0.5 items-end h-3"
                  >
                    <span className="w-1 h-3 bg-emerald-400 rounded-full animate-bounce" />
                    <span className="w-1 h-2 bg-emerald-400 rounded-full animate-bounce delay-75" />
                    <span className="w-1 h-3.5 bg-emerald-400 rounded-full animate-bounce delay-150" />
                  </motion.div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 2: Easter Egg Trophy Room */}
      <section className="mb-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <IconTrophy className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Easter Egg Trophy Case
            </h2>
            <p className="text-xs text-slate-400 font-sans">
              Discover secret interactions across the terminal, footer, command
              palette, and games.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {EASTER_EGG_ACHIEVEMENTS.map((ach) => {
            const isUnlocked = unlockedIds.includes(ach.id);
            return (
              <div
                key={ach.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isUnlocked
                    ? "bg-slate-900/90 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                    : "bg-slate-950/60 border-slate-800/80"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-2 rounded-xl bg-slate-800/80 border border-slate-700">
                      {ach.icon}
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-white">
                        {ach.title}
                      </h3>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300">
                        {isUnlocked ? "Unlocked 🏆" : "Locked 🔒"}
                      </span>
                    </div>
                  </div>
                  {isUnlocked && (
                    <span className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                      <IconCheck className="w-4 h-4" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 font-sans leading-relaxed mb-2">
                  {ach.description}
                </p>
                {!isUnlocked && (
                  <p className="text-[11px] text-amber-400/90 italic font-sans">
                    Hint: {ach.hint}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 3: Interactive Meme Deck */}
      <section className="mb-16">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <IconSparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Engineering Meme Deck
              </h2>
              <p className="text-xs text-slate-400 font-sans">
                A few jokes about code, clinical data, and getting through the
                workday.
              </p>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            {["all", "dev", "medtech", "lore", "classic"].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg capitalize font-semibold transition-colors active:scale-95 ${
                  selectedCategory === cat
                    ? "bg-emerald-500 text-slate-950"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredQuotes.map((q) => {
            const rxCount = reactions[q.id] || 0;
            return (
              <div
                key={q.id}
                className="p-5 rounded-2xl border border-slate-800/90 bg-slate-900/70 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase tracking-wider text-[10px] font-bold">
                      {q.tagline || q.category}
                    </span>
                    <CopyButton
                      text={`"${q.quote}" by ${q.author}`}
                      icon={<IconCopy className="w-4 h-4" />}
                      copiedIcon={
                        <IconCheck className="w-4 h-4 text-emerald-400" />
                      }
                      className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Copy Quote"
                      aria-label="Copy Quote"
                      successMessage="Copied quote to clipboard"
                    />
                  </div>

                  <blockquote className="text-sm font-sans text-slate-100 font-medium leading-relaxed mb-4">
                    &ldquo;{q.quote}&rdquo;
                  </blockquote>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 text-xs">
                  <cite className="text-slate-400 text-[11px] truncate max-w-[200px] sm:max-w-xs not-italic">
                    by {q.author}
                  </cite>
                  <button
                    onClick={() => handleReaction(q.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-[11px] transition-transform active:scale-95"
                  >
                    <span>🚀</span>
                    <span>{rxCount > 0 ? rxCount : "React"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 4: ASCII Art Console */}
      <section className="mb-12">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <IconTerminal className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">
              ASCII Terminal Studio
            </h2>
          </div>

          <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            {(["cowsay", "duck", "loon", "train"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setAsciiTab(tab)}
                className={`px-3 py-1 rounded-lg uppercase tracking-wider text-[10px] font-bold transition-colors active:scale-95 ${
                  asciiTab === tab
                    ? "bg-emerald-500 text-slate-950"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tab === "loon" ? "laser loon" : tab}
              </button>
            ))}
          </div>
        </div>

        <div className="relative rounded-2xl border border-slate-800 bg-slate-950 p-4 sm:p-6 overflow-x-auto shadow-inner">
          <CopyButton
            text={() => getAsciiContent()}
            icon={<IconCopy className="w-4 h-4" />}
            copiedIcon={<IconCheck className="w-4 h-4 text-emerald-400" />}
            className="absolute top-4 right-4 p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            title="Copy ASCII Art"
            aria-label="Copy ASCII Art"
            successMessage="Copied ASCII art to clipboard"
          />
          <pre className="text-xs sm:text-sm text-emerald-400 font-mono leading-tight select-all">
            {getAsciiContent()}
          </pre>
        </div>
      </section>
    </div>
  );
};
