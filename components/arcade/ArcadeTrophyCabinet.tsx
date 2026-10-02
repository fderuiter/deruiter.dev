"use client";

import React, { useState, useSyncExternalStore, useId } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  IconTrophy,
  IconSparkles,
  IconLock,
  IconCheck,
  IconBone,
  IconCrosshair,
  IconBrain,
  IconCpu,
  IconShieldCheck,
  IconCards,
  IconClipboardCheck,
  IconDeviceGamepad2,
  IconHeart,
  IconFilter,
  IconPlayerPlay,
} from "@tabler/icons-react";
import {
  ARCADE_TROPHIES,
  getArcadeProgress,
  ArcadeProgress,
} from "@/lib/arcade-achievements";
import { ARCADE_GAMES_METADATA } from "@/lib/arcade-data";
import { onAppEvent } from "@/lib/event-bus";

const subscribeArcadeStorage = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  const cleanupScore = onAppEvent("arcade_score_updated", callback);
  const cleanupTrophy = onAppEvent("arcade_trophy_unlocked", callback);

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key.includes("arcade")) {
      callback();
    }
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    cleanupScore();
    cleanupTrophy();
    window.removeEventListener("storage", handleStorage);
  };
};

const getSnapshot = (): ArcadeProgress => {
  return getArcadeProgress();
};

// useSyncExternalStore compares snapshots by identity, so the server
// snapshot must be one stable object rather than a fresh literal per call.
const SERVER_SNAPSHOT: ArcadeProgress = {
  highScores: {},
  unlockedTrophies: {},
  updatedAt: 0,
};

const getServerSnapshot = (): ArcadeProgress => SERVER_SNAPSHOT;

function getTrophyIcon(iconName: string) {
  switch (iconName) {
    case "Bone":
      return <IconBone className="w-5 h-5 text-amber-400" />;
    case "Crosshair":
      return <IconCrosshair className="w-5 h-5 text-red-400" />;
    case "Brain":
      return <IconBrain className="w-5 h-5 text-purple-400" />;
    case "Cpu":
      return <IconCpu className="w-5 h-5 text-amber-400" />;
    case "ShieldCheck":
      return <IconShieldCheck className="w-5 h-5 text-emerald-400" />;
    case "Cards":
      return <IconCards className="w-5 h-5 text-amber-400" />;
    case "ClipboardCheck":
      return <IconClipboardCheck className="w-5 h-5 text-amber-400" />;
    case "DeviceGamepad2":
      return <IconDeviceGamepad2 className="w-5 h-5 text-rose-400" />;
    case "Heart":
      return <IconHeart className="w-5 h-5 text-amber-400" />;
    case "Sparkles":
      return <IconSparkles className="w-5 h-5 text-cyan-400" />;
    default:
      return <IconTrophy className="w-5 h-5 text-amber-400" />;
  }
}

export const ArcadeTrophyCabinet: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const progress = useSyncExternalStore(
    subscribeArcadeStorage,
    getSnapshot,
    getServerSnapshot
  );

  const [statusFilter, setStatusFilter] = useState<
    "all" | "unlocked" | "locked"
  >("all");
  const [gameFilter, setGameFilter] = useState<string>("all");
  const [announcement, setAnnouncement] = useState<string>("");

  const tabListId = useId();

  // Calculate cumulative stats
  const totalScore = Object.values(progress.highScores).reduce(
    (sum, s) => sum + s,
    0
  );
  const unlockedCount = Object.keys(progress.unlockedTrophies).length;
  const totalTrophies = ARCADE_TROPHIES.length;
  const gamesPlayedCount = Object.values(progress.highScores).filter(
    (s) => s > 0
  ).length;

  const filteredTrophies = ARCADE_TROPHIES.filter((trophy) => {
    const isUnlocked = Boolean(progress.unlockedTrophies[trophy.id]);

    if (statusFilter === "unlocked" && !isUnlocked) return false;
    if (statusFilter === "locked" && isUnlocked) return false;

    if (
      gameFilter !== "all" &&
      trophy.gameId !== gameFilter &&
      trophy.gameId !== "cross_game"
    ) {
      return false;
    }

    return true;
  });

  const handleFilterChange = (filter: "all" | "unlocked" | "locked") => {
    setStatusFilter(filter);
    setAnnouncement(`Showing ${filter} trophies filter.`);
  };

  return (
    <div className="w-full my-12 rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
      {/* Accessible Screen Reader Announcer */}
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      {/* Header & Milestone Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-zinc-800 pb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold mb-3">
            <IconTrophy className="w-4 h-4 text-amber-400" />
            <span>TROPHY CABINET &amp; SCOREBOARD</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">
            Personal Best <span className="text-amber-400">Showcase</span>
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400 font-sans">
            Cross-game cumulative scores and milestone trophy achievements.
            Unlocked rewards persist offline.
          </p>
        </div>

        {/* Quick Cumulative Stats Dashboard */}
        <div className="grid grid-cols-3 gap-3 w-full md:w-auto font-mono text-center">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3">
            <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              Total Score
            </span>
            <span className="text-lg sm:text-xl font-bold text-amber-400">
              {totalScore.toLocaleString()}
            </span>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3">
            <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              Trophies
            </span>
            <span className="text-lg sm:text-xl font-bold text-cyan-400">
              {unlockedCount} / {totalTrophies}
            </span>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3">
            <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              Games Played
            </span>
            <span className="text-lg sm:text-xl font-bold text-emerald-400">
              {gamesPlayedCount} / 9
            </span>
          </div>
        </div>
      </div>

      {/* Leaderboard High Scores Cards Grid */}
      <div className="my-8">
        <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4">
          Personal Bests by Game
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ARCADE_GAMES_METADATA.map((game) => {
            const score = progress.highScores[game.id] || 0;
            return (
              <div
                key={game.id}
                className="flex items-center justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 hover:border-zinc-700 transition-colors"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono font-bold">
                    {game.title.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-mono font-bold text-white truncate">
                      {game.title}
                    </h4>
                    <span className="text-[10px] font-mono text-zinc-300">
                      {game.genre}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-xs font-bold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                    {score > 0 ? score.toLocaleString() : "—"}
                  </span>
                  <Link
                    href={game.route}
                    title={`Play ${game.title}`}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                  >
                    <IconPlayerPlay className="w-3.5 h-3.5 fill-current" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trophy Status Filter Bar */}
      <div className="mt-8 border-t border-zinc-800/80 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div
          role="tablist"
          id={tabListId}
          aria-label="Trophy Filter Tabs"
          className="inline-flex rounded-xl bg-zinc-900 p-1 border border-zinc-800 text-xs font-mono font-bold"
        >
          <button
            role="tab"
            aria-selected={statusFilter === "all"}
            onClick={() => handleFilterChange("all")}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              statusFilter === "all"
                ? "bg-amber-500 text-black shadow-md"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            All ({totalTrophies})
          </button>
          <button
            role="tab"
            aria-selected={statusFilter === "unlocked"}
            onClick={() => handleFilterChange("unlocked")}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              statusFilter === "unlocked"
                ? "bg-amber-500 text-black shadow-md"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Unlocked ({unlockedCount})
          </button>
          <button
            role="tab"
            aria-selected={statusFilter === "locked"}
            onClick={() => handleFilterChange("locked")}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              statusFilter === "locked"
                ? "bg-amber-500 text-black shadow-md"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Locked ({totalTrophies - unlockedCount})
          </button>
        </div>

        {/* Game Filter Dropdown */}
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 w-full sm:w-auto">
          <IconFilter className="w-4 h-4 shrink-0 text-zinc-400" />
          <select
            value={gameFilter}
            onChange={(e) => setGameFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 w-full sm:w-auto"
            aria-label="Filter trophies by game"
          >
            <option value="all">All Games &amp; Meta</option>
            {ARCADE_GAMES_METADATA.map((game) => (
              <option key={game.id} value={game.id}>
                {game.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Trophy Cards Showcase Grid */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredTrophies.map((trophy) => {
            const unlockedTimestamp = progress.unlockedTrophies[trophy.id];
            const isUnlocked = Boolean(unlockedTimestamp);

            return (
              <motion.div
                key={trophy.id}
                layout
                initial={
                  shouldReduceMotion
                    ? { opacity: 1, scale: 1 }
                    : { opacity: 0, scale: 0.95 }
                }
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={
                  shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }
                }
                className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all ${
                  isUnlocked
                    ? "border-amber-500/40 bg-gradient-to-br from-amber-950/20 via-zinc-900/60 to-zinc-950 shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                    : "border-zinc-800/80 bg-zinc-900/30 opacity-60 grayscale hover:grayscale-0 hover:opacity-80"
                }`}
              >
                <div>
                  {/* Top Bar: Icon & Status Badge */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                        isUnlocked
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                          : "border-zinc-800 bg-zinc-950 text-zinc-400"
                      }`}
                    >
                      {getTrophyIcon(trophy.icon)}
                    </div>

                    {isUnlocked ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                        <IconCheck className="w-3 h-3" />
                        <span>UNLOCKED</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                        <IconLock className="w-3 h-3" />
                        <span>LOCKED</span>
                      </span>
                    )}
                  </div>

                  {/* Title & Subtitle */}
                  <h4 className="text-base font-bold font-mono text-white">
                    {trophy.title}
                  </h4>
                  <span className="text-[11px] font-mono text-zinc-400 block mt-0.5">
                    {trophy.subtitle}
                  </span>

                  {/* Description & Condition */}
                  <p className="mt-3 text-xs text-zinc-300 font-sans leading-relaxed">
                    {trophy.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800/60 text-[11px] font-mono flex items-center justify-between text-zinc-400">
                  <span>{trophy.conditionDescription}</span>
                  {unlockedTimestamp && (
                    <span className="text-amber-400/80 text-[10px]">
                      {new Date(unlockedTimestamp).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
