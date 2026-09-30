"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { getArcadeNeighbors } from "@/lib/arcade";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import { DesktopOnlyGate } from "@/components/arcade/DesktopOnlyGate";
import Link from "next/link";
import {
  IconShieldCheck,
  IconFileText,
  IconAlertTriangle,
  IconArrowLeft,
} from "@tabler/icons-react";

const ClinicalTrialChaosLoader = () =>
  import("@/components/ClinicalTrialChaos").then(
    (mod) => mod.ClinicalTrialChaos
  );

const DynamicClinicalTrialChaos = dynamic(ClinicalTrialChaosLoader, {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-8 min-h-[380px] font-mono text-xs text-zinc-500 animate-pulse">
      <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4" />
      <span>Loading Clinical Trial Chaos...</span>
    </div>
  ),
});

export const ClinicalChaosClient: React.FC = () => {
  return (
    <div className="min-h-screen text-white pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-4 mb-6 border-b border-zinc-800/80 pb-4 flex-wrap">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <Link
              href="/arcade"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-emerald-400 transition-colors"
            >
              <IconArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Arcade Hub</span>
            </Link>
            <span className="text-zinc-700 hidden sm:inline">|</span>
            <Breadcrumbs
              items={[
                { label: "Arcade Hub", href: "/arcade" },
                { label: "Clinical Trial Chaos" },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              CDISC SDTM / 21 CFR Part 11 Arcade
            </span>
          </div>
        </div>

        {/* Title Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <IconShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
                Clinical Trial Chaos:{" "}
                <span className="text-emerald-400">CDISC Compliance</span>
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 font-mono mt-1">
                Sort clinical data into SDTM domains, sign the submissions, and
                keep up with the conveyor belt. The auditor is watching. This is
                a game, so at least there’s a restart button.
              </p>
            </div>
          </div>
        </div>

        {/* Game Container */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-1.5 sm:p-6 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
          <DesktopOnlyGate
            gameId="clinical-chaos"
            gameTitle="Clinical Trial Chaos"
          >
            <PlayCabinet
              gameId="clinical-chaos"
              title="Clinical Trial Chaos: CDISC Compliance"
              subtitle="Clinical Data, Against the Clock"
              icon={<IconShieldCheck className="w-8 h-8 text-emerald-400" />}
              instructions="Sort clinical observations, fix data problems, and sign submissions before time runs out. A game inspired by clinical data work, with a considerably less patient auditor."
              controls={[
                { key: "Enter", action: "Next step (fix / route / sign)" },
                { key: "1–8", action: "Pick answer / route to station" },
                { key: "Q W E R", action: "Lifelines" },
                { key: "← →", action: "Change subject" },
              ]}
              importComponent={ClinicalTrialChaosLoader}
            >
              <DynamicClinicalTrialChaos />
            </PlayCabinet>
          </DesktopOnlyGate>
        </div>

        {/* Context that complements the in-game Fix → Route → Sign briefing. */}
        <div className="mt-8 grid grid-cols-1 gap-3 font-mono text-xs text-zinc-400 md:grid-cols-3">
          <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 md:p-4">
            <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
              <IconFileText className="w-4 h-4" />
              <span>Two pressures</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed break-words">
              Keep the auditor&apos;s suspicion below 100% and the sponsor
              satisfied. Clean data and steady throughput both matter.
            </p>
          </div>

          <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 md:p-4">
            <div className="flex items-center gap-2 text-brand-cyan font-bold mb-2">
              <IconShieldCheck className="w-4 h-4" />
              <span>Offices and amendments</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed break-words">
              Your office changes the shift. Check the current station labels:
              later phases add stations, and amendments can reshuffle routes.
            </p>
          </div>

          <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 md:p-4">
            <div className="flex items-center gap-2 text-rose-400 font-bold mb-2">
              <IconAlertTriangle className="w-4 h-4" />
              <span>Shortcuts leave a trail</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed break-words">
              Sponsor shortcuts can hide audit findings in your final BIMO
              report. This is a game simulation, not regulatory guidance.
            </p>
          </div>
        </div>

        {/* Sequential Next / Previous Navigation */}
        <NextPrevNav
          {...getArcadeNeighbors("/arcade/clinical-chaos")}
          backToHub={{
            title: "All Arcade Games",
            href: "/arcade",
          }}
        />
      </div>
    </div>
  );
};
