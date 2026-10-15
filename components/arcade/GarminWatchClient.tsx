"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { getArcadeNeighbors } from "@/lib/arcade";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import { DesktopOnlyGate } from "@/components/arcade/DesktopOnlyGate";
import { requestGarminAutoPause } from "@/components/garmin-watch/auto-pause";
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
      <div className="max-w-6xl mx-auto">
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
              Monkey C Mayhem / A Garmin 5K Platformer
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
                <span className="text-amber-400">A Garmin 5K Platformer</span>
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 font-mono mt-1">
                Five 1 km stages on three lives. Stomp Couch Potatoes, jump the
                Hurdles, keep your Body Battery above zero and grab the finish
                pole before the watch gives you a Training Status you did not
                ask for.
              </p>
            </div>
          </div>
        </div>

        {/* Game Container */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-4 sm:p-6 flex flex-col items-center">
          <DesktopOnlyGate gameId="garmin-watch" gameTitle="Monkey C Mayhem">
            {/* The watch waits on its own START button like a real app, so
                a runner never starts before the player is ready. */}
            <PlayCabinet
              gameId="garmin-watch"
              singleTitleScreen={false}
              title="Monkey C Mayhem: A Garmin 5K Platformer"
              subtitle="Five Stages, Three Lives, One Body Battery"
              icon={<IconDeviceWatch className="w-8 h-8" />}
              instructions="Run a 5K in five 1 km stages on three lives. Waiting for GPS, then GO. Hold jump for height, stomp Couch Potatoes and Snooze Buttons, jump the Hurdles, and dodge the course foes: Kettlebells, Move Alerts, Box Jumpers, Auto Laps and the Rep Max on stages 3 and 5. Bump Sync Blocks for Protein Shakes, Heat Maps, Compression Capes and a Runner's High. Keep your Body Battery above zero, earn a Training Effect on each stage, and grab the finish pole. Dev Mode, off by default in the simulator controls, adds the original RAM heap and firmware crash challenge."
              controls={[
                { key: "Enter", action: "Start / Pause" },
                { key: "UP / Space", action: "Jump (hold = higher)" },
                { key: "→ / ←", action: "Sprint / Jog" },
                { key: "X / Backspace", action: "Heat Bolt / Cape Spin" },
                { key: "↓", action: "Enter a Water Station / Slam" },
                { key: "P / Esc", action: "Pause" },
                { key: "W (Dev Mode)", action: "Wipe Fog" },
              ]}
              importComponent={GarminWatchSimulatorLoader}
              // No game key is F (arrows, Space, Enter, P, Escape, X, G, L,
              // W, Backspace), so the cabinet's F-for-fullscreen stays on
              // (#2122). The watch, its dock and the companion are built to
              // fit the touch cabinet's viewport, so the stage clips rather
              // than scrolls (ADR 0061).
              mobileLayout="fit"
              // A hidden tab or a backgrounded app pauses a run in progress.
              onAutoPause={requestGarminAutoPause}
            >
              <div className="garmin-stage flex flex-col items-center w-full">
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
              <span>Body Battery</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Body Battery drains while you run, and faster while you sprint. A
              hit costs 15. Ease to a <strong>jog</strong> with Left to recharge
              it. At 0 you bonk: no sprinting until it recovers to 25. It never
              ends the run.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 text-slate-300 font-bold mb-2">
              <IconBolt className="w-4 h-4" />
              <span>Training Effect &amp; Status</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Each stage clear scores a Training Effect from 0.0 to 5.0, such as{" "}
              <strong>TE 3.4 · Improving</strong>. Game over shows your Training
              Status, from Unproductive to Peaking, and a recovery time in
              hours.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 text-rose-400 font-bold mb-2">
              <IconFlame className="w-4 h-4" />
              <span>Dev Mode (Optional)</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Off by default. Turn it on in the simulator controls to bring back
              the original firmware challenge: the RAM heap, GC freezes, NV
              flash, thermal fog you wipe with <strong>W</strong>, and crash
              reports.
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
                  <h2 className="text-xl font-mono font-extrabold text-white mb-2">
                    Theodore Wirth Mud Run (Run Minnesota 10K)
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-3">
                    The inspiration behind <em>Monkey C Mayhem</em>: 10
                    kilometers of Minnesota trail mud and an actual Garmin watch
                    strapped to Fred&apos;s wrist, searching for GPS lock the
                    whole way.
                  </p>
                  <p className="text-xs text-zinc-400 font-mono leading-relaxed">
                    Developing Connect IQ apps on Garmin devices means living
                    inside strict RAM budgets. Dev Mode brings that limit back
                    to the runner, if you want the full challenge.
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
