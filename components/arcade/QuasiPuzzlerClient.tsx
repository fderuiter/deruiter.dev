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
    <div className="flex flex-col items-center justify-center p-8 min-h-[380px] font-mono text-xs text-zinc-400">
      <div className="w-8 h-8 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin mb-4" />
      <span>Loading the puzzles...</span>
    </div>
  ),
});

export const QuasiPuzzlerClient: React.FC = () => {
  return (
    <div className="min-h-screen text-white pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-4 mb-6 border-b border-zinc-800/80 pb-4 flex-wrap">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <Link
              href="/arcade"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-indigo-300 transition-colors"
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
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-zinc-900 text-zinc-300 border border-zinc-800">
              Formal Verification / Lean 4 Simulator
            </span>
          </div>
        </div>

        {/* Title Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-indigo-400">
              <IconBrain className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-[-0.035em]">
                Quasi-Perfect <span className="text-indigo-400">Puzzler</span>
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
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-4 sm:p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]">
          <DesktopOnlyGate
            gameId="quasi-puzzler"
            gameTitle="Quasi-Perfect Puzzler"
          >
            <PlayCabinet
              gameId="quasi-puzzler"
              title="Quasi-Perfect Puzzler"
              subtitle="Small Proofs, Limited Memory"
              icon={<IconBrain className="w-8 h-8 text-indigo-400" />}
              instructions="Apply tactics to a proof tree and work your way to a complete proof. You can skip a goal with “sorry,” but the score will notice."
              controls={[
                { key: "Click / Drag", action: "Apply Tactic" },
                { key: "Ctrl/⌘ + Z / Y", action: "Undo / Redo" },
                { key: "R / M", action: "Reset Level / Switch Mode" },
                { key: "H / C / B", action: "Hints / IDE / Brief" },
                { key: "sorry", action: "Admit Goal" },
              ]}
              importComponent={QuasiPerfectPuzzlerLoader}
            >
              <DynamicQuasiPerfectPuzzler />
            </PlayCabinet>
          </DesktopOnlyGate>
        </div>

        {/* Instructions & Controls Reference */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs text-zinc-400">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 text-indigo-300 font-bold mb-2">
              <IconChecklist className="w-4 h-4" />
              <span>Tactics &amp; AST Nodes</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Drag tactic cards from your hand onto AST nodes, or tap a tactic
              card and then tap a target node to execute the proof step.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 text-zinc-200 font-bold mb-2">
              <IconCpu className="w-4 h-4" />
              <span>Lean Server RAM Limits</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Each tactic, including a failed one, consumes simulated memory.
              Story Mode starts with twice the Hacker Mode budget. In either
              mode, if RAM hits 0 GB the simulated tactic session stops and the
              level must be reset. Close the theorem before running out of
              memory.
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
          {...getArcadeNeighbors("/arcade/quasi-puzzler")}
          backToHub={{
            title: "All Arcade Games",
            href: "/arcade",
          }}
        />
      </div>
    </div>
  );
};
