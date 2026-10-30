"use client";

import React from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { getArcadeNeighbors } from "@/lib/arcade";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import { defineGameViews } from "@/components/arcade/views";
import { RetroLabyrinthCabinetSession } from "@/components/retro-labyrinth/RetroLabyrinthSession";
import {
  RunResumeChoice,
  useSavedRun,
} from "@/components/retro-labyrinth/RunResumeChoice";
import { LABYRINTH_CONTROLS } from "@/lib/retro-labyrinth/actions";
import { IntentLink } from "@/components/ui/IntentLink";
import {
  IconDeviceGamepad2,
  IconCpu,
  IconRoute,
  IconShieldLock,
  IconArrowLeft,
} from "@tabler/icons-react";

const RetroLabyrinthLoader = () =>
  import("@/components/RetroLabyrinth").then((mod) => mod.RetroLabyrinth);

/**
 * The cabinet's views (ADR 0062). One session holds the run above them
 * (#2376), and each view lays the room out for its device (#2839, #2859,
 * #2917).
 */
const RETRO_LABYRINTH_VIEWS = defineGameViews({
  session: RetroLabyrinthCabinetSession,
  desktop: () =>
    import("@/components/retro-labyrinth/views/DesktopView").then((mod) => ({
      default: mod.DesktopView,
    })),
  tablet: () =>
    import("@/components/retro-labyrinth/views/TabletView").then((mod) => ({
      default: mod.TabletView,
    })),
  phone: () =>
    import("@/components/retro-labyrinth/views/PhoneView").then((mod) => ({
      default: mod.PhoneView,
    })),
});

export const RetroLabyrinthClient: React.FC = () => {
  // A saved run swaps Launch for Resume and New run (#3466).
  const savedRun = useSavedRun();
  return (
    <div className="min-h-screen text-white pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-4 mb-6 border-b border-zinc-800/80 pb-4 flex-wrap">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <IntentLink
              href="/arcade"
              className="inline-flex items-center gap-1.5 pointer-coarse:min-h-11 text-xs font-mono text-zinc-400 hover:text-rose-400 transition-colors"
            >
              <IconArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Arcade Hub</span>
            </IntentLink>
            <span className="text-zinc-700 hidden sm:inline">|</span>
            <Breadcrumbs path="/arcade/retro-labyrinth" />
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-500/10 text-rose-300 border border-rose-500/30">
              Dungeon Roguelike / CRT Engine
            </span>
          </div>
        </div>

        {/* Title Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400">
              <IconDeviceGamepad2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
                Retro Labyrinth:{" "}
                <span className="text-rose-400">Graveyard Roguelike</span>
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 font-mono mt-1">
                An abandoned codebase, now with corridors. Navigate moving
                walls, wield developer-themed weapons, and break two wireframe
                bosses.
              </p>
            </div>
          </div>
        </div>

        {/* Game Container. From 1536px it widens past the text column, up
            to 112rem with a 2rem gutter, so the maze's integer fit can take
            the next whole step on 1920 and 2560 screens (#2842). */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-4 sm:p-6 shadow-[0_0_50px_rgba(244,63,94,0.1)] flex flex-col items-center 2xl:mx-[calc(50%-min(50vw-2rem,56rem))]">
          <PlayCabinet
            gameId="retro-labyrinth"
            title="Retro Labyrinth: Graveyard Roguelike"
            subtitle="There Are Bugs in the Dungeon"
            icon={<IconDeviceGamepad2 className="w-8 h-8 text-rose-400" />}
            instructions="Explore a shifting dungeon made from abandoned codebases. Fight bugs, find your way through the fog, and face a wireframe boss with an unreasonable number of angles."
            controls={[...LABYRINTH_CONTROLS]}
            importComponent={RetroLabyrinthLoader}
            mobileOrientation="landscape"
            mobileLayout="fit"
            views={RETRO_LABYRINTH_VIEWS}
            launchControl={savedRun ? RunResumeChoice : undefined}
          />
        </div>

        {/* Instructions & Controls Reference */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs text-zinc-400">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 text-rose-400 font-bold mb-2">
              <IconRoute className="w-4 h-4" />
              <span>TSP Shifting Walls</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              The TSP Enclave, mid-route, recalculates the Traveling Salesperson
              tour as you move. Time your steps through the striped airgap
              walls, which shift every step, to reach the EXIT.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold mb-2">
              <IconCpu className="w-4 h-4" />
              <span>Developer Weapons</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Keys <strong>1</strong> to <strong>3</strong> fire your
              class&apos;s tools. The default Script Kiddie carries npm install
              (AoE blast), Nmap Port Recon (exposes CVEs) and EMP. Other classes
              swap in Buffer Overflow, Zero-Day, MitM Spoof or Ransomware.{" "}
              <strong>Space</strong> always fires an EMP.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 text-slate-300 font-bold mb-2">
              <IconShieldLock className="w-4 h-4" />
              <span>3D Wireframe Bosses</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Every run ends on two bosses: FaceForge, then the Neural Warden.
              Both project real-time rotating 3D wireframe polyhedra. Use walls
              as cover from their volleys, and EMP bursts to stun rogue drones.
            </p>
          </div>
        </div>

        {/* Sequential Next / Previous Navigation */}
        <NextPrevNav
          {...getArcadeNeighbors("/arcade/retro-labyrinth")}
          backToHub={{
            title: "All Arcade Games",
            href: "/arcade",
          }}
        />
      </div>
    </div>
  );
};
