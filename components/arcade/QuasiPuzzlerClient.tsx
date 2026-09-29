"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import Link from "next/link";
import {
  IconBrain,
  IconCpu,
  IconChecklist,
  IconShieldLock,
  IconArrowLeft,
} from "@tabler/icons-react";

const QuasiPerfectPuzzlerLoader = () =>
  import("@/components/QuasiPerfectPuzzler").then(
    (mod) => mod.QuasiPerfectPuzzler
  );

const DynamicQuasiPerfectPuzzler = dynamic(QuasiPerfectPuzzlerLoader, {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-8 min-h-[380px] font-mono text-xs text-zinc-500 animate-pulse">
      <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4" />
      <span>Loading the puzzles...</span>
    </div>
  ),
});

export const QuasiPuzzlerClient: React.FC = () => {
  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-4 mb-6 border-b border-zinc-800/80 pb-4 flex-wrap">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <Link
              href="/arcade"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-purple-400 transition-colors"
            >
              <IconArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Arcade Hub</span>
            </Link>
            <span className="text-zinc-700 hidden sm:inline">|</span>
            <Breadcrumbs
              items={[
                { label: "Arcade Hub", href: "/arcade" },
                { label: "Quasi-Perfect Puzzler" },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/30">
              Formal Verification / Lean 4 Simulator
            </span>
          </div>
        </div>

        {/* Title Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-400">
              <IconBrain className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
                Quasi-Perfect <span className="text-purple-400">Puzzler</span>
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 font-mono mt-1">
                Apply tactics to a proof tree and work your way to a complete
                proof. You can skip a goal with “sorry,” but the score will
                notice.
              </p>
            </div>
          </div>
        </div>

        {/* Game Container */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-4 sm:p-6 shadow-[0_0_50px_rgba(168,85,247,0.1)]">
          <PlayCabinet
            gameId="quasi-puzzler"
            title="Quasi-Perfect Puzzler"
            subtitle="Small Proofs, Limited Memory"
            accentColor="purple"
            icon={<IconBrain className="w-8 h-8 text-purple-400" />}
            instructions="Apply tactics to a proof tree and work your way to a complete proof. You can skip a goal with “sorry,” but the score will notice."
            controls={[
              { key: "Click / Drag", action: "Apply Tactic" },
              { key: "Z / Y", action: "Undo / Redo" },
              { key: "R", action: "Reset Level" },
              { key: "H / C / B", action: "Hints / IDE / Brief" },
              { key: "sorry", action: "Admit Goal" },
            ]}
            importComponent={QuasiPerfectPuzzlerLoader}
          >
            <DynamicQuasiPerfectPuzzler />
          </PlayCabinet>
        </div>

        {/* Instructions & Controls Reference */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs text-zinc-400">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 text-purple-400 font-bold mb-2">
              <IconChecklist className="w-4 h-4" />
              <span>Tactics &amp; AST Nodes</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Drag tactic cards from your hand onto AST nodes, or tap a tactic
              card and then tap a target node to execute the proof step.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 text-brand-cyan font-bold mb-2">
              <IconCpu className="w-4 h-4" />
              <span>Lean Server RAM Limits</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Each tactic consumes language server memory. If RAM hits 0 GB, the
              Lean runtime crashes (OOM). Close the theorem before running out
              of memory.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold mb-2">
              <IconShieldLock className="w-4 h-4" />
              <span>Theorem Morality &amp; Sorry</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Admitting goals via <code>sorry</code> instantly passes the level
              but incurs a heavy -100 Morality Penalty and 0 stars. Solve
              genuinely for gold ratings!
            </p>
          </div>
        </div>

        {/* Sequential Next / Previous Navigation */}
        <NextPrevNav
          prev={{
            title: "Laser Loon: Quest for the State Flag",
            href: "/arcade/laser-loon",
            label: "Previous Game",
            tag: "Civic Arcade Campaign",
          }}
          next={{
            title: "Monkey C Mayhem: Garmin Schvitz App",
            href: "/arcade/garmin-watch",
            label: "Next Game",
            tag: "Embedded Simulator",
          }}
          backToHub={{
            title: "All Arcade Games",
            href: "/arcade",
          }}
        />
      </div>
    </div>
  );
};
