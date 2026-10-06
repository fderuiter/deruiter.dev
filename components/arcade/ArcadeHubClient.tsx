"use client";

import React, { useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  IconCrosshair,
  IconBrain,
  IconCpu,
  IconShieldCheck,
  IconDeviceGamepad2,
  IconArrowRight,
  IconTrophy,
  IconPlayerPlay,
  IconBone,
  IconCards,
  IconClipboardCheck,
} from "@tabler/icons-react";
import { FieldManualButton } from "@/components/FieldManualButton";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ARCADE_GAME_COUNT } from "@/lib/arcade";
import { safeGetRawItem } from "@/lib/safe-storage";
import { ArcadeTrophyCabinet } from "@/components/arcade/ArcadeTrophyCabinet";
import { ArcadeTrailer } from "@/components/arcade/ArcadeTrailer";
import { onAppEvent } from "@/lib/event-bus";

interface ArcadeGameCard {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  genre: string;
  description: string;
  mechanics: string[];
  techStack: string[];
  icon: React.ReactNode;
  accentColor: string;
  borderHover: string;
  badgeBg: string;
  storageKey?: string;
  route: string;
}

const subscribeStorage = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  const cleanupScore = onAppEvent("arcade_score_updated", callback);
  const handleStorage = () => callback();
  window.addEventListener("storage", handleStorage);
  return () => {
    cleanupScore();
    window.removeEventListener("storage", handleStorage);
  };
};

const getScore = (key?: string) => () => {
  if (!key || typeof window === "undefined") return "0";
  try {
    return safeGetRawItem(key) || "0";
  } catch {
    return "0";
  }
};

const getServerScore = () => "0";

// Same query as DesktopOnlyGate (ADR 0048): phones and portrait tablets.
const SHOW_ON_TOUCH_COMPACT_INLINE =
  "hidden [@media(pointer:coarse)_and_(max-width:1023px)]:inline-block";
const SHOW_ON_TOUCH_COMPACT_BLOCK =
  "hidden [@media(pointer:coarse)_and_(max-width:1023px)]:block";

const ARCADE_GAMES: ArcadeGameCard[] = [
  {
    id: "working-with-duck",
    slug: "working-with-duck",
    title: "Working With Duck",
    subtitle: "Code, Toys, and Questionable Priorities",
    genre: "Pet Simulation & AI",
    description:
      "Try to finish your code while Duck requests toys, treats, and belly rubs. Take him to the park, save a few scrapbook moments, and see how much work gets done.",
    mechanics: [
      "Autonomous Dog AI",
      "Tug-of-War Multipliers",
      "Dog Park Whistle Recall",
      "Polaroid Scrapbook",
    ],
    techStack: [
      "HTML5 Canvas 2D",
      "Web Audio Synthesizer",
      "Deterministic State Machine",
    ],
    icon: <IconBone className="w-6 h-6 text-amber-400" />,
    accentColor: "from-amber-500/20 via-amber-500/5 to-transparent",
    borderHover: "hover:border-amber-400/50",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    storageKey: "working_with_duck_high_score",
    route: "/arcade/working-with-duck",
  },
  {
    id: "laser-loon",
    slug: "laser-loon",
    title: "Laser Loon: Quest for the State Flag",
    subtitle: "A Loon With a Legislative Agenda",
    genre: "Raycast Arcade Shooter",
    description:
      "Fly Laser Loon toward the State Capitol, take on rival flags, and blast through red tape. There are ice weapons and boss battles. The flag committee did not request these features.",
    mechanics: [
      "Raycast Collision",
      "Cryo Freezing",
      "Loon Tremolo Ultimate",
      "Campaign Boss Battles",
    ],
    techStack: [
      "HTML5 Canvas",
      "Web Audio Dual-Synth",
      "Multi-Phase AI Engine",
    ],
    icon: <IconCrosshair className="w-6 h-6 text-red-400" />,
    accentColor: "from-red-500/20 via-red-500/5 to-transparent",
    borderHover: "hover:border-red-400/50",
    badgeBg: "bg-red-500/10 text-red-400 border-red-500/30",
    storageKey: "laser_loon_high_score",
    route: "/arcade/laser-loon",
  },
  {
    id: "quasi-puzzler",
    slug: "quasi-puzzler",
    title: "Quasi-Perfect Puzzler",
    subtitle: "Small Proofs, Limited Memory",
    genre: "Formal Verification",
    description:
      "Solve Lean-inspired logic puzzles by applying tactics to a proof tree. Each move costs simulated memory, so a correct answer needs a sensible route.",
    mechanics: [
      "AST Expression Tree",
      "Proof Tactics (intro, rw, simp)",
      "RAM Exhaustion OOM",
      "Morality Scoring",
    ],
    techStack: [
      "TypeScript AST",
      "Interactive Drag & Drop",
      "Lean 4 Engine Sim",
    ],
    icon: <IconBrain className="w-6 h-6 text-purple-400" />,
    accentColor: "from-purple-500/20 via-purple-500/5 to-transparent",
    borderHover: "hover:border-purple-400/50",
    badgeBg: "bg-purple-500/10 text-purple-300 border-purple-500/30",
    storageKey: "quasi_perfect_puzzler_progress_v1",
    route: "/arcade/quasi-puzzler",
  },
  {
    id: "garmin-watch",
    slug: "garmin-watch",
    title: "Monkey C Mayhem: Garmin Schvitz App",
    subtitle: "A Small Watch With a Lot Going On",
    genre: "Embedded Systems",
    description:
      "Keep a simulated Garmin Schvitz App running with a 32KB memory budget. Clear memory, dodge obstacles, and wipe the fog off the screen before the watch has a very bad day.",
    mechanics: [
      "Circular LCD 280×280",
      "32KB Monkey C RAM Limit",
      "500ms GC Freeze",
      "Overheat Fog Wiping",
    ],
    techStack: [
      "HTML5 Canvas",
      "Piezo Audio Synthesis",
      "Embedded State Engine",
    ],
    icon: <IconCpu className="w-6 h-6 text-amber-400" />,
    accentColor: "from-amber-500/20 via-amber-500/5 to-transparent",
    borderHover: "hover:border-amber-400/50",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    storageKey: "garmin_simulator_high_score",
    route: "/arcade/garmin-watch",
  },
  {
    id: "clinical-chaos",
    slug: "clinical-chaos",
    title: "Clinical Trial Chaos: CDISC Compliance",
    subtitle: "Clinical Data, Against the Clock",
    genre: "Regulatory Simulation",
    description:
      "Sort clinical observations, fix data problems, and sign submissions before time runs out. A game inspired by clinical data work, with a considerably less patient auditor.",
    mechanics: [
      "CDISC SDTM Domains (DM, VS, AE, LB)",
      "21 CFR § 11 Signatures",
      "FDA Auditor Patrol AI",
      "Protocol Amendments",
    ],
    techStack: [
      "FDA Compliance Sim",
      "Conveyor Belt Physics",
      "Web Audio Alarms",
    ],
    icon: <IconShieldCheck className="w-6 h-6 text-emerald-400" />,
    accentColor: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    borderHover: "hover:border-emerald-400/50",
    badgeBg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    storageKey: "clinical_chaos_highscore",
    route: "/arcade/clinical-chaos",
  },
  {
    id: "trial-and-error",
    slug: "trial-and-error",
    title: "Trial & Error: Biostat Ops",
    subtitle: "Three Studies, One Compound",
    genre: "Roguelike Deckbuilder",
    description:
      "Clinical outputs are the cards. QC tables against the SAP, play Chips × Mult hands to beat each review, and carry one fictional compound through three studies to CSR Lock, then on into post-marketing.",
    mechanics: [
      "SAP Rulebook QC",
      "Chips × Mult Hands",
      "Relics & Procurement Shop",
      "Post-Marketing Rounds",
    ],
    techStack: [
      "Pure Deterministic Reducers",
      "Seeded Replayable Runs",
      "Zod Scenario Contracts",
    ],
    icon: <IconCards className="w-6 h-6 text-amber-400" />,
    accentColor: "from-amber-500/20 via-amber-500/5 to-transparent",
    borderHover: "hover:border-amber-400/50",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    storageKey: "trial_and_error_high_score",
    route: "/arcade/trial-and-error",
  },
  {
    id: "study-director",
    slug: "study-director",
    title: "Study Director: Everything Is Fine",
    subtitle: "Clinical Study Management Simulator",
    genre: "Management Simulation",
    description:
      "Walk the floor of a contract research organization and shepherd one study from kickoff to closeout. Talk to a team that is not always fine, drive out to the sites behind the green dashboard, and defend your decisions when the FDA arrives.",
    mechanics: [
      "Walkable CRO Office",
      "Team Trust and Schedules",
      "Site Visits",
      "Documentation Debt",
      "FDA Inspection Replay",
    ],
    techStack: [
      "Seeded Deterministic Simulation",
      "Canvas 2D Office",
      "Causal Risk Model",
      "Decision Log Replay",
    ],
    icon: <IconClipboardCheck className="w-6 h-6 text-amber-400" />,
    accentColor: "from-amber-500/20 via-amber-500/5 to-transparent",
    borderHover: "hover:border-amber-400/50",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    storageKey: "study_director_high_score",
    route: "/arcade/study-director",
  },
  {
    id: "retro-labyrinth",
    slug: "retro-labyrinth",
    title: "Retro Labyrinth: Graveyard Roguelike",
    subtitle: "There Are Bugs in the Dungeon",
    genre: "Procedural Roguelike",
    description:
      "Explore a shifting dungeon made from abandoned codebases. Fight bugs, find your way through the fog, and face a wireframe boss with an unreasonable number of angles.",
    mechanics: [
      "TSP Dynamic Mazes",
      "FOV Fog-of-War",
      "Developer Weapons Inventory",
      "3D Wireframe Boss",
    ],
    techStack: [
      "CRT Canvas Filter",
      "Procedural Dungeon Gen",
      "Matrix 3D Math",
    ],
    icon: <IconDeviceGamepad2 className="w-6 h-6 text-rose-400" />,
    accentColor: "from-rose-500/20 via-rose-500/5 to-transparent",
    borderHover: "hover:border-rose-400/50",
    badgeBg: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    storageKey: "retro_labyrinth_highscore",
    route: "/arcade/retro-labyrinth",
  },
];

function GameCard({ game, index }: { game: ArcadeGameCard; index: number }) {
  const shouldReduceMotion = useReducedMotion();
  const getSnapshot = React.useCallback(
    () => getScore(game.storageKey)(),
    [game.storageKey]
  );

  const rawScore = useSyncExternalStore(
    subscribeStorage,
    getSnapshot,
    getServerScore
  );

  let formattedScore = rawScore;
  if (game.id === "quasi-puzzler" && rawScore !== "0") {
    try {
      const parsed = JSON.parse(rawScore);
      const count = Object.keys(parsed?.completedLevels || {}).length;
      formattedScore = `${count} / 5 Proofs`;
    } catch {
      formattedScore = "Progress Saved";
    }
  }

  return (
    <motion.div
      initial={
        shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
      }
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { delay: index * 0.08, duration: 0.4 }
      }
      className={`group relative flex flex-col justify-between rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 md:p-8 backdrop-blur-xl transition-all duration-300 ${game.borderHover} hover:shadow-[0_0_30px_rgba(0,0,0,0.8)]`}
    >
      {/* Ambient background glow on card */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-cyan-500/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

      <div className="relative z-10">
        {/* Gameplay thumbnail. The Play Game link below is the keyboard path,
            so this duplicate link is hidden from tab order and screen readers. */}
        <Link
          href={game.route}
          tabIndex={-1}
          aria-hidden="true"
          className="-mx-6 -mt-6 mb-6 block overflow-hidden rounded-t-3xl border-b border-zinc-800/80 md:-mx-8 md:-mt-8"
        >
          <Image
            src={`/images/arcade/previews/${game.slug}.webp`}
            alt=""
            width={800}
            height={500}
            loading="lazy"
            // Already-small WebP stills: skip the optimizer and its quota.
            unoptimized
            className="block aspect-[16/10] h-auto w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        </Link>

        {/* Top Badges & Icon */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/80 shadow-inner">
              {game.icon}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${game.badgeBg}`}
              >
                {game.genre}
              </span>
              <span
                className={`${SHOW_ON_TOUCH_COMPACT_INLINE} px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border border-zinc-700 text-zinc-300`}
              >
                Desktop only
              </span>
            </div>
          </div>

          {formattedScore && formattedScore !== "0" && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-mono">
              <IconTrophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-bold">{formattedScore}</span>
            </div>
          )}
        </div>

        {/* Title & Description */}
        <h2 className="text-xl md:text-2xl font-bold font-mono tracking-tight text-white group-hover:text-brand-cyan transition-colors">
          {game.title}
        </h2>
        <p className="mt-1 text-xs font-mono text-zinc-300 font-medium">
          {game.subtitle}
        </p>

        <p className="mt-4 text-xs md:text-sm text-zinc-300 leading-relaxed font-sans">
          {game.description}
        </p>

        {/* Mechanics Chips */}
        <div className="mt-5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-300 font-bold block mb-2">
            How to Play
          </span>
          <div className="flex flex-wrap gap-1.5">
            {game.mechanics.map((m) => (
              <span
                key={m}
                className="px-2 py-0.5 rounded-md bg-zinc-950/70 border border-zinc-800 text-[11px] font-mono text-zinc-300"
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Tech Stack Chips */}
        <div className="mt-3">
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-300 font-bold block mb-2">
            Built With
          </span>
          <div className="flex flex-wrap gap-1.5">
            {game.techStack.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-md bg-brand-cyan/5 border border-brand-cyan/20 text-[11px] font-mono text-cyan-300"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Action CTA */}
      <div className="relative z-10 mt-8 pt-4 border-t border-zinc-800/60 flex items-center justify-between gap-3 flex-wrap">
        <FieldManualButton manualId={game.id} variant="card" />

        <Link
          href={game.route}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-400 text-zinc-950 font-mono text-xs font-bold transition-all duration-200 hover:bg-white hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer"
        >
          <IconPlayerPlay className="w-3.5 h-3.5 fill-current" />
          <span>Play Game</span>
          <IconArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.div>
  );
}

export const ArcadeHubClient: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div className="min-h-screen text-white pb-24 px-4 sm:px-6 lg:px-8">
      {/* Top Ambient Glows */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-brand-cyan/5 blur-[160px] pointer-events-none hidden sm:block" />
      <div className="fixed bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-brand-blue/5 blur-[140px] pointer-events-none hidden sm:block" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Navigation Breadcrumbs */}
        <div className="mb-8">
          <Breadcrumbs items={[{ label: "Arcade Hub", href: "/arcade" }]} />
        </div>

        {/* Header Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold mb-4">
            <span>SIDE PROJECTS YOU CAN PLAY</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold font-mono tracking-tight text-white">
            Engineering{" "}
            <span className="text-brand-cyan">Arcade &amp; Labs</span>
          </h1>
          <p className="mt-4 text-sm md:text-base text-zinc-400 font-sans leading-relaxed">
            Browser games about the things I apparently think about after work:
            logic, clinical data, tiny computers, and a puppy who would like my
            attention.
          </p>

          <p
            className={`${SHOW_ON_TOUCH_COMPACT_BLOCK} mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300`}
          >
            On a phone? These games need a desktop, but the{" "}
            <Link
              href="/arcade/meme-vault"
              className="text-emerald-300 underline underline-offset-4"
            >
              Meme Vault
            </Link>{" "}
            works fine here.
          </p>

          {/* Quick Metrics Bar */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs font-mono">
            <span className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
              <strong>{ARCADE_GAME_COUNT} Playable Games</strong>
            </span>
            <span className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
              <strong>Web Audio Synthesis</strong>
            </span>
            <span className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
              <strong>Built for Keyboard &amp; Mouse</strong>
            </span>
            <span className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
              <strong>Custom Canvas Engines</strong>
            </span>
          </div>
        </div>

        <ArcadeTrailer />

        {/* Games Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {ARCADE_GAMES.map((game, index) => (
            <GameCard key={game.id} game={game} index={index} />
          ))}
        </div>

        {/* Interactive Trophy Cabinet & Score Dashboard */}
        <ArcadeTrophyCabinet />

        {/* Easter Egg Meme Vault Discovery Card */}
        <motion.div
          initial={
            shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={
            shouldReduceMotion ? { duration: 0 } : { delay: 0.5, duration: 0.4 }
          }
          className="relative rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-950/80 p-6 sm:p-8 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.1)] hover:border-emerald-500/50 transition-all"
        >
          <div className="flex w-full min-w-0 flex-col items-start gap-4 sm:w-auto sm:flex-row sm:items-center">
            {/* 16:10 still at every width, like the game cards (#1516). */}
            <Link
              href="/arcade/meme-vault"
              tabIndex={-1}
              aria-hidden="true"
              className="block w-full shrink-0 overflow-hidden rounded-2xl border border-emerald-500/30 sm:w-40"
            >
              <Image
                src="/images/arcade/previews/meme-vault.webp"
                alt=""
                width={800}
                height={500}
                loading="lazy"
                unoptimized
                className="block aspect-[16/10] h-auto w-full object-cover object-top"
              />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                  Meme Soundboard
                </span>
                <span className="text-xs font-mono text-zinc-300">
                  SOUNDS &amp; EASTER EGGS
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold font-mono text-white">
                Developer Soundboard &amp; Meme Vault
              </h2>
              <p className="text-xs sm:text-sm text-zinc-300 font-sans mt-1">
                Make some noise, find a few hidden trophies, and borrow some
                ASCII art.
              </p>
            </div>
          </div>

          <Link
            href="/arcade/meme-vault"
            className="inline-flex shrink-0 items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs font-bold transition-all duration-200 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer"
          >
            <span>Enter Vault</span>
            <IconArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </div>
  );
};
