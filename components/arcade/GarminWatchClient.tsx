"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { getArcadeNeighbors } from "@/lib/arcade";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import { DesktopOnlyGate } from "@/components/arcade/DesktopOnlyGate";
import Link from "next/link";
import Image from "next/image";
import {
  IconCpu,
  IconBolt,
  IconFlame,
  IconDeviceWatch,
  IconArrowLeft,
  IconRun,
} from "@tabler/icons-react";
import { getPhotoById } from "@/lib/media-registry";

const GarminWatchSimulatorLoader = () =>
  import("@/components/GarminWatchSimulator").then(
    (mod) => mod.GarminWatchSimulator
  );

const DynamicGarminWatchSimulator = dynamic(GarminWatchSimulatorLoader, {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-8 min-h-[380px] font-mono text-xs text-zinc-500 animate-pulse">
      <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-4" />
      <span>Loading the watch...</span>
    </div>
  ),
});

export const GarminWatchClient: React.FC = () => {
  return (
    <div className="min-h-screen text-white pb-24 px-4 sm:px-6 lg:px-8">
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
                { label: "Monkey C Mayhem" },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/30">
              Monkey C Mayhem / Garmin Schvitz App
            </span>
          </div>
        </div>

        {/* Title Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <IconDeviceWatch className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
                Monkey C Mayhem:{" "}
                <span className="text-amber-400">Garmin Schvitz App</span>
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 font-mono mt-1">
                An endless smartwatch runner with a 32 to 128 KB memory budget
                and an inconvenient tendency to fog up. Manage the memory and
                keep the run alive for a high score.
              </p>
            </div>
          </div>
        </div>

        {/* Game Container */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-4 sm:p-6 shadow-[0_0_50px_rgba(245,158,11,0.1)] flex flex-col items-center">
          <DesktopOnlyGate gameId="garmin-watch" gameTitle="Monkey C Mayhem">
            <PlayCabinet
              gameId="garmin-watch"
              title="Monkey C Mayhem: Garmin Schvitz App"
              subtitle="A Small Watch With a Lot Going On"
              accentColor="amber"
              icon={<IconDeviceWatch className="w-8 h-8 text-amber-400" />}
              instructions="An endless run for a high score. Keep a simulated Garmin Schvitz App running inside its memory budget (32 KB on Fēnix, up to 128 KB on Edge): jump the bugs, free memory before the heap fills, and wipe the fog off the screen before the watch has a very bad day."
              controls={[
                { key: "Enter", action: "Start / Pause" },
                { key: "UP", action: "Jump" },
                { key: "DOWN", action: "Jettison RAM" },
                { key: "Backspace", action: "Force GC" },
                { key: "Drag", action: "Wipe Fog" },
              ]}
              importComponent={GarminWatchSimulatorLoader}
            >
              <div className="flex flex-col items-center w-full">
                <DynamicGarminWatchSimulator />
              </div>
            </PlayCabinet>
          </DesktopOnlyGate>
        </div>

        {/* Instructions & Controls Reference */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs text-zinc-400">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold mb-2">
              <IconCpu className="w-4 h-4" />
              <span>RAM Ceiling &amp; Jettison</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              The app allocates a variable every few seconds, and floating
              memory tokens add more. Press <strong>DOWN</strong> or the bezel
              button to jettison variables before the heap hits the device limit
              (32 KB on Fēnix).
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 text-purple-400 font-bold mb-2">
              <IconBolt className="w-4 h-4" />
              <span>Garbage Collector [GC] Freeze</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Press <strong>BACK / GC</strong> to trigger the garbage collector.
              GC clears unused memory but pauses the game for a simulated 500ms.
              Time it carefully.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 text-rose-400 font-bold mb-2">
              <IconFlame className="w-4 h-4" />
              <span>Thermal Fogging &amp; Screen Wiping</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              High CPU usage causes condensation fog on the circular display.
              Drag your finger or cursor over the watch lens or press{" "}
              <strong>W</strong> to wipe the fog clear.
            </p>
          </div>
        </div>

        {/* Real-World Origin & Inspiration */}
        {(() => {
          const runPhoto = getPhotoById("theodore-wirth-mud-run");
          if (!runPhoto) return null;
          return (
            <div className="mt-12 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 sm:p-8">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-5 relative aspect-[3/2] rounded-2xl overflow-hidden border border-zinc-700 bg-black/60">
                  <Image
                    src={runPhoto.src}
                    alt={runPhoto.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 420px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-400 text-black">
                      Bib #1534 · Garmin on Wrist
                    </span>
                  </div>
                </div>

                <div className="md:col-span-7 min-w-0 flex flex-col justify-center">
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-mono mb-2 w-fit">
                    <IconRun className="w-3.5 h-3.5" />
                    <span>Real-World Engineering Inspiration</span>
                  </div>
                  <h3 className="text-xl font-mono font-extrabold text-white mb-2">
                    Theodore Wirth Mud Run (Run Minnesota 10K)
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-3">
                    The inspiration behind <em>Monkey C Mayhem</em>: 10
                    kilometers of Minnesota trail mud, humidity, and an actual
                    Garmin watch strapped to Fred&apos;s wrist struggling to
                    maintain GPS lock while fogging up under intense effort.
                  </p>
                  <p className="text-xs text-zinc-400 font-mono leading-relaxed">
                    Developing ConnectIQ apps on Garmin devices means living
                    inside strict 32KB RAM budgets: one extra object allocation
                    during a muddy sprint and the runtime panics.
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Sequential Next / Previous Navigation */}
        <NextPrevNav
          {...getArcadeNeighbors("/arcade/garmin-watch")}
          backToHub={{
            title: "All Arcade Games",
            href: "/arcade",
          }}
        />
      </div>
    </div>
  );
};
