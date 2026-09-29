"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import { DesktopOnlyGate } from "@/components/arcade/DesktopOnlyGate";
import Link from "next/link";
import Image from "next/image";
import {
  IconBone,
  IconTrees,
  IconAlertTriangle,
  IconArrowLeft,
  IconCamera,
  IconHeart,
} from "@tabler/icons-react";
import { getPhotosByCategory } from "@/lib/media-registry";

const WorkingWithDuckLoader = () =>
  import("@/components/WorkingWithDuck").then((mod) => mod.WorkingWithDuck);

const DynamicWorkingWithDuck = dynamic(WorkingWithDuckLoader, {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-8 min-h-[380px] font-mono text-xs text-zinc-500 animate-pulse">
      <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-4" />
      <span>Finding Duck...</span>
    </div>
  ),
});

export const WorkingWithDuckClient: React.FC = () => {
  return (
    <div className="w-full min-h-dvh bg-black text-white pt-4 pb-20 px-3 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-4 mb-6 border-b border-zinc-800/80 pb-4 flex-wrap">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <Link
              href="/arcade"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-amber-400 transition-colors"
            >
              <IconArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Arcade Hub</span>
            </Link>
            <span className="text-zinc-700 hidden sm:inline">|</span>
            <Breadcrumbs
              items={[
                { label: "Arcade Hub", href: "/arcade" },
                { label: "Working With Duck" },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/30">
              Pet Simulation / Multitasking Arcade
            </span>
          </div>
        </div>

        {/* Title Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <IconBone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
                Working With <span className="text-amber-400">Duck</span>
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 font-mono mt-1">
                You have a deadline. Duck has a ball. Try to keep both the
                project and the puppy happy.
              </p>
            </div>
          </div>
        </div>

        {/* Game Container */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-4 sm:p-6 shadow-[0_0_50px_rgba(251,191,36,0.08)]">
          <DesktopOnlyGate
            gameId="working-with-duck"
            gameTitle="Working With Duck"
          >
            <PlayCabinet
              gameId="working-with-duck"
              title="Working With Duck"
              subtitle="Code, Toys, and Questionable Priorities"
              accentColor="amber"
              icon={<IconBone className="w-8 h-8 text-amber-400" />}
              instructions="Try to finish your code while Duck requests toys, treats, and belly rubs. Take him to the park, save a few scrapbook moments, and see how much work gets done."
              controls={[
                { key: "1-3", action: "Toss Toys" },
                { key: "4", action: "Trade Treats" },
                { key: "Space", action: "Steer Duck" },
              ]}
              importComponent={WorkingWithDuckLoader}
            >
              <DynamicWorkingWithDuck />
            </PlayCabinet>
          </DesktopOnlyGate>
        </div>

        {/* Instructions & Controls Reference */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs text-zinc-400">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold mb-2">
              <IconBone className="w-4 h-4" />
              <span>Toys &amp; Ball Trades</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Press <strong>1-3</strong> to toss toys and redirect Duck away
              from portfolio hazards. Press <strong>4</strong> to trade treats
              when Duck does &ldquo;No Take, Only Throw!&rdquo;
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 text-rose-400 font-bold mb-2">
              <IconAlertTriangle className="w-4 h-4" />
              <span>Potty Countdown &amp; Rubs</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              When the Bladder flashes, click &amp; drag Duck to the{" "}
              <strong>Back Door</strong> within 3.5s. When Duck flops on his
              back, scrub your cursor for belly rubs!
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
              <IconTrees className="w-4 h-4" />
              <span>Dog Park &amp; Multipliers</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Click <strong>Go to Dog Park</strong> to flick-throw the ball.
              Steer Duck around mud puddles with <strong>W</strong> or the{" "}
              <strong>arrow keys</strong>, press <strong>Space</strong> to jump
              hurdles, and earn the 20-second Tired Puppy calm buff.
            </p>
          </div>
        </div>

        {/* Real-Life Co-Pilot Gallery */}
        <div className="mt-12 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-zinc-800/80 pb-4">
            <div>
              <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-bold uppercase tracking-wider mb-1">
                <IconCamera className="w-4 h-4" />
                <span>Behind the Simulation</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-mono font-extrabold text-white">
                Meet the Real-Life <span className="text-amber-400">Duck</span>
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <IconHeart className="w-4 h-4 text-rose-400" />
              <span>8-Week Fluff → 80-lb Marshmallow</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {getPhotosByCategory("duck")
              .concat(getPhotosByCategory("bio"))
              .slice(0, 6)
              .map((photo) => (
                <div
                  key={photo.id}
                  className="group relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/50 hover:border-amber-500/40 transition-all flex flex-col"
                >
                  <div className="relative w-full aspect-[3/4] bg-black/40 overflow-hidden">
                    <Image
                      src={photo.src}
                      alt={photo.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-transparent to-transparent opacity-80" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-400/90 text-black">
                        {photo.title}
                      </span>
                    </div>
                  </div>
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                      {photo.caption}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Sequential Next / Previous Navigation */}
        <NextPrevNav
          prev={{
            title: "Retro Labyrinth",
            href: "/arcade/retro-labyrinth",
            label: "Previous Game",
            tag: "Graveyard Roguelike",
          }}
          next={{
            title: "Laser Loon: Quest for the State Flag",
            href: "/arcade/laser-loon",
            label: "Next Game",
            tag: "Civic Arcade Campaign",
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
