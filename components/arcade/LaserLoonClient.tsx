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
  IconCrosshair,
  IconSnowflake,
  IconFlame,
  IconArrowLeft,
} from "@tabler/icons-react";

const LaserLoonLoader = () =>
  import("@/components/LaserLoon").then((mod) => mod.LaserLoon);

const DynamicLaserLoon = dynamic(LaserLoonLoader, {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-8 min-h-[380px] font-mono text-xs text-zinc-500 animate-pulse">
      <div className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mb-4" />
      <span>Warming up the lasers...</span>
    </div>
  ),
});

export const LaserLoonClient: React.FC = () => {
  return (
    <div className="min-h-screen text-white pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-4 mb-6 border-b border-zinc-800/80 pb-4 flex-wrap">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <Link
              href="/arcade"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-brand-cyan transition-colors"
            >
              <IconArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Arcade Hub</span>
            </Link>
            <span className="text-zinc-700 hidden sm:inline">|</span>
            <Breadcrumbs
              items={[
                { label: "Arcade Hub", href: "/arcade" },
                { label: "Laser Loon" },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/30">
              Civic Arcade / 4-Act Campaign
            </span>
          </div>
        </div>

        {/* Title Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
              <IconCrosshair className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
                Laser Loon:{" "}
                <span className="text-red-400">Quest for the State Flag</span>
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 font-mono mt-1">
                Pilot submission F277 Laser Loon on the Road to the Capitol.
                Battle rival flag redesigns, bureaucracy, and Minnesota folklore
                in this retro arcade campaign.
              </p>
            </div>
          </div>
        </div>

        {/* Game Container */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-4 sm:p-6 shadow-[0_0_50px_rgba(239,68,68,0.1)]">
          <DesktopOnlyGate gameId="laser-loon" gameTitle="Laser Loon">
            <PlayCabinet
              gameId="laser-loon"
              title="Laser Loon: Quest for the State Flag"
              subtitle="A Loon With a Legislative Agenda"
              icon={<IconCrosshair className="w-8 h-8 text-red-400" />}
              instructions="Fly Laser Loon toward the State Capitol, take on rival flags, and blast through red tape. There are ice weapons and boss battles. The flag committee did not request these features."
              controls={[
                { key: "WASD / Arrows", action: "Glide Loon" },
                { key: "Click / Space", action: "Aim & Shoot" },
                { key: "1 - 4", action: "Optic Arsenal" },
                { key: "U", action: "Loon Tremolo" },
                { key: "P", action: "Pause Game" },
              ]}
              importComponent={LaserLoonLoader}
            >
              <DynamicLaserLoon />
            </PlayCabinet>
          </DesktopOnlyGate>
        </div>

        {/* Instructions & Controls Reference */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs text-zinc-400">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 text-red-400 font-bold mb-2">
              <IconCrosshair className="w-4 h-4" />
              <span>Optic Arsenal (1 - 4)</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Aim crosshairs with cursor or touch. Switch between Ruby Eye
              Laser, Cyan Pulse, Aurora Borealis Wave, and Glacial Cryo-Mortar.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 text-cyan-400 font-bold mb-2">
              <IconSnowflake className="w-4 h-4" />
              <span>Haunting Loon Tremolo</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Charge energy meter to 100% by scoring hits. Press U to unleash a
              screen-wide synthesized cryogenic loon cry shockwave!
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold mb-2">
              <IconFlame className="w-4 h-4" />
              <span>MN Civic Power-Ups</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Collect floating Tater Tot Hotdish (laser overcharge), Pronto Pups
              (invulnerability shield), and North Star crystals (multiplier
              surge).
            </p>
          </div>
        </div>

        {/* Sequential Next / Previous Navigation */}
        <NextPrevNav
          {...getArcadeNeighbors("/arcade/laser-loon")}
          backToHub={{
            title: "All Arcade Games",
            href: "/arcade",
          }}
        />
      </div>
    </div>
  );
};
