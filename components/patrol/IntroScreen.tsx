"use client";

import React from "react";
import Image from "next/image";
import {
  IconShieldCheck,
  IconStethoscope,
  IconEmergencyBed,
  IconWalk,
  IconChevronRight,
  IconPlayerTrackNext,
  IconChevronDown,
} from "@tabler/icons-react";
import { usePersistentState } from "@/hooks/usePersistentState";

/**
 * localStorage key recording that a patroller has already read the orientation.
 * Persisted client-side only — Patrol Shift has no accounts and no backend.
 */
export const PATROL_INTRO_SEEN_KEY = "patrol_intro_seen";

/**
 * Props for the IntroScreen component.
 */
interface IntroScreenProps {
  /** Callback triggered to advance into the operational morning briefing. */
  onStartShift: () => void;
  /** Callback triggered to skip the introduction and proceed directly to mountain operations. */
  onSkipIntro: () => void;
}

/**
 * Explainer screen introducing Welch Village Ski Patrol operational judgment,
 * Outdoor Emergency Care (OEC), Outdoor Emergency Transportation (OET), and shift roles.
 */
/* jscpd:ignore-start */
export const IntroScreen: React.FC<IntroScreenProps> = ({
  onStartShift,
  onSkipIntro,
}) => {
  const [hasSeenIntro, setHasSeenIntro] = usePersistentState<boolean>(
    PATROL_INTRO_SEEN_KEY,
    false
  );

  const handleStartShift = () => {
    setHasSeenIntro(true);
    onStartShift();
  };

  const handleSkipIntro = () => {
    setHasSeenIntro(true);
    onSkipIntro();
  };

  return (
    <div
      className="flex flex-col gap-6 p-4 sm:p-8 bg-zinc-900/40 rounded-2xl border border-zinc-800/80"
      data-testid="patrol-intro-screen"
      data-intro-mode={hasSeenIntro ? "returning" : "first-visit"}
    >
      {/* Title & Badge */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan text-[10px] font-mono font-bold uppercase tracking-wider">
            Operational Overview
          </span>
          <span className="text-zinc-400 text-xs font-mono">
            CH 1 • 154.570 MHz
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-mono font-bold text-white tracking-tight">
          Welch Village Ski Patrol: Shift Studio
        </h2>
        <p className="text-sm font-sans text-zinc-300 leading-relaxed max-w-3xl">
          Welcome to the Patrol Shift operational judgment simulation. As an
          active volunteer or pro ski patroller at Welch Village, a Twin
          Cities-area hill, your shift demands swift triage, cold-weather
          clinical care, and precise toboggan handling across variable snow,
          ice, and crowded slopes.
        </p>
        <p className="text-[10px] font-mono text-zinc-400">
          Unofficial, fan-made simulation inspired by Welch Village. Not
          affiliated with or endorsed by Welch Village Ski Area.
        </p>
      </div>

      {hasSeenIntro ? (
        <details className="group rounded-xl border border-zinc-800 bg-zinc-950/60">
          <summary className="flex items-center gap-2 px-4 py-3 min-h-[44px] cursor-pointer list-none text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan rounded-xl">
            <IconChevronDown className="w-4 h-4 text-brand-cyan transition-transform group-open:rotate-180" />
            <span>Review full orientation</span>
          </summary>
          <div className="flex flex-col gap-4 p-4 pt-0">
            {/* Core Operational Pillars Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Pillar 1: OEC */}
              <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-brand-cyan">
                  <div className="p-2 rounded-lg bg-brand-cyan/10 border border-brand-cyan/20">
                    <IconStethoscope className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                    Outdoor Emergency Care
                  </h3>
                </div>
                <p className="text-xs font-sans text-zinc-400 leading-relaxed">
                  Rapid trauma assessment, extremity splinting with SAM splints,
                  spine-motion restriction, and hypothermia mitigation in
                  sub-freezing temperatures.
                </p>
              </div>

              {/* Pillar 2: OET */}
              <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-amber-400">
                  <div className="p-2 rounded-lg bg-amber-400/10 border border-amber-400/20">
                    <IconEmergencyBed className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                    Toboggan Handling (OET)
                  </h3>
                </div>
                <p className="text-xs font-sans text-zinc-400 leading-relaxed">
                  Fall-line descent with Cascade / Akja rescue sleds,
                  chain-brake deployment, and coordinated tail-rope braking
                  across Welch Village&apos;s icy pitches.
                </p>
              </div>

              {/* Pillar 3: Hill Coordination */}
              <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <div className="p-2 rounded-lg bg-emerald-400/10 border border-emerald-400/20">
                    <IconWalk className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                    Sweep &amp; Hill Safety
                  </h3>
                </div>
                <p className="text-xs font-sans text-zinc-400 leading-relaxed">
                  Opening trail inspections, hazard bamboo marking, lift
                  liaison, radio protocols, and seamless patient handoffs to
                  municipal EMS.
                </p>
              </div>
            </div>

            {/* Role & Duty Card */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-brand-cyan/10 text-brand-cyan shrink-0 mt-0.5">
                <IconShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-xs">
                <span className="font-mono font-bold text-white uppercase tracking-wider">
                  Shift Role: Hill Patroller &amp; First Responder
                </span>
                <p className="text-zinc-400 leading-relaxed font-sans">
                  You are stationed on hill, equipped with a patrol trauma pack,
                  radio, and assigned to quad chairlift sectors. Await dispatch
                  calls, respond to incidents, package patients, and complete
                  post-call debriefings.
                </p>
              </div>
            </div>
          </div>
        </details>
      ) : (
        <>
          {/* Core Operational Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pillar 1: OEC */}
            <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-brand-cyan">
                <div className="p-2 rounded-lg bg-brand-cyan/10 border border-brand-cyan/20">
                  <IconStethoscope className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  Outdoor Emergency Care
                </h3>
              </div>
              <p className="text-xs font-sans text-zinc-400 leading-relaxed">
                Rapid trauma assessment, extremity splinting with SAM splints,
                spine-motion restriction, and hypothermia mitigation in
                sub-freezing temperatures.
              </p>
            </div>

            {/* Pillar 2: OET */}
            <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-amber-400">
                <div className="p-2 rounded-lg bg-amber-400/10 border border-amber-400/20">
                  <IconEmergencyBed className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  Toboggan Handling (OET)
                </h3>
              </div>
              <p className="text-xs font-sans text-zinc-400 leading-relaxed">
                Fall-line descent with Cascade / Akja rescue sleds, chain-brake
                deployment, and coordinated tail-rope braking across Welch
                Village&apos;s icy pitches.
              </p>
            </div>

            {/* Pillar 3: Hill Coordination */}
            <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-emerald-400">
                <div className="p-2 rounded-lg bg-emerald-400/10 border border-emerald-400/20">
                  <IconWalk className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  Sweep &amp; Hill Safety
                </h3>
              </div>
              <p className="text-xs font-sans text-zinc-400 leading-relaxed">
                Opening trail inspections, hazard bamboo marking, lift liaison,
                radio protocols, and seamless patient handoffs to municipal EMS.
              </p>
            </div>
          </div>

          {/* Role & Duty Card */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-brand-cyan/10 text-brand-cyan shrink-0 mt-0.5">
              <IconShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1 text-xs">
              <span className="font-mono font-bold text-white uppercase tracking-wider">
                Shift Role: Hill Patroller &amp; First Responder
              </span>
              <p className="text-zinc-400 leading-relaxed font-sans">
                You are stationed on hill, equipped with a patrol trauma pack,
                radio, and assigned to quad chairlift sectors. Await dispatch
                calls, respond to incidents, package patients, and complete
                post-call debriefings.
              </p>
            </div>
          </div>

          {/* Alpine Inspiration Spotlight */}
          <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-black/60 shadow-md">
              <Image
                src="/images/sports/fred-ski-flame-suit.jpg"
                alt="Frederick de Ruiter on a snowy ski slope wearing a retro 1990s flame ski suit"
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
            <div className="text-center sm:text-left flex-1 min-w-0">
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 mb-1">
                Slope Heritage // 90s Flame Suit Protocol
              </span>
              <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                Inspired by real days carving Welch Village snow and
                understanding winter mountain topography.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={handleSkipIntro}
          className="min-h-[44px] min-w-[44px] px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:scale-[0.98] border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-mono text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
        >
          <IconPlayerTrackNext className="w-4 h-4" />
          <span>{hasSeenIntro ? "Resume Shift" : "Skip Intro"}</span>
        </button>

        <button
          type="button"
          onClick={handleStartShift}
          className="min-h-[44px] min-w-[44px] px-6 py-2.5 rounded-xl bg-brand-cyan hover:bg-brand-cyan/90 active:scale-[0.98] text-zinc-950 font-mono text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-2 shadow-lg shadow-brand-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <span>
            {hasSeenIntro ? "Start with Briefing" : "Begin Shift Briefing"}
          </span>
          <IconChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
/* jscpd:ignore-end */
};
