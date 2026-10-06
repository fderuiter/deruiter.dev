"use client";

import React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { IconArrowLeft, IconHeadset } from "@tabler/icons-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import { DesktopOnlyGate } from "@/components/arcade/DesktopOnlyGate";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { getArcadeNeighbors } from "@/lib/arcade";
import { COMPANION_POST_PATH } from "@/lib/patty-drive-thru";

const PattyDriveThruLoader = () =>
  import("@/components/patty-drive-thru/PattyDriveThruGame").then(
    (mod) => mod.PattyDriveThruGame
  );

const DynamicPattyDriveThru = dynamic(PattyDriveThruLoader, {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[380px] items-center justify-center p-8 font-mono text-xs text-zinc-400">
      Finding your name tag…
    </div>
  ),
});

export const PattyDriveThruClient: React.FC = () => (
  <div className="min-h-dvh overflow-x-hidden bg-[#0d0e11] px-4 pb-24 text-zinc-100 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-zinc-800 pb-4 sm:gap-4">
        <Link
          href="/arcade"
          className="inline-flex min-h-[48px] items-center gap-1.5 font-mono text-xs text-zinc-300 hover:text-amber-400"
        >
          <IconArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to Arcade Hub</span>
        </Link>
        <Breadcrumbs
          items={[
            { label: "Arcade Hub", href: "/arcade" },
            { label: "Patty's Drive-Thru" },
          ]}
        />
      </div>

      <div className="mb-8 min-w-0">
        <h1 className="font-mono text-3xl font-extrabold tracking-[-0.035em] break-words text-zinc-100 sm:text-4xl">
          Patty&apos;s <span className="text-amber-400">Drive-Thru</span>
        </h1>
        <p className="mt-2 max-w-3xl font-mono text-xs text-zinc-300 sm:text-sm">
          One shift at the drive-thru window of my first job, 2014 to 2017, as a
          first-person diary entry. Take orders through the headset, fight the
          register, re-enter the drinks the machine loses, and keep moving so
          the manager does not notice you. The chain is fictional and the people
          are renamed.{" "}
          <Link
            href={COMPANION_POST_PATH}
            className="text-amber-400 underline underline-offset-4 hover:text-amber-300"
          >
            Read the notes behind it
          </Link>
          .
        </p>
      </div>

      <div className="border border-zinc-800 bg-[#13151a] p-1.5 sm:p-4">
        <DesktopOnlyGate
          gameId="patty-drive-thru"
          gameTitle="Patty's Drive-Thru"
        >
          <PlayCabinet
            gameId="patty-drive-thru"
            title="Patty's Drive-Thru"
            subtitle="A diary entry · First job · 2014 to 2017"
            icon={
              <IconHeadset
                className="h-8 w-8 text-amber-400"
                aria-hidden="true"
              />
            }
            instructions="Stand in the booth for one compressed shift. Ring orders up on a register that hides the easy things, re-enter the drinks the dispenser loses, flag an adult for the coffee you are too young to brew, and bump tickets before they turn red. Standing still is not an option."
            controls={[
              { key: "A D or ← →", action: "Turn" },
              { key: "Enter or Tab", action: "Use the register" },
              { key: "W", action: "Wipe the counter" },
              { key: "1 - 6", action: "Pick an order" },
              { key: "B", action: "Bump the order" },
              { key: "R", action: "Re-enter a dropped drink" },
              { key: "C", action: "Flag a coworker for coffee" },
              { key: "Esc", action: "Step back from the register" },
            ]}
            importComponent={PattyDriveThruLoader}
          >
            <DynamicPattyDriveThru />
          </PlayCabinet>
        </DesktopOnlyGate>
      </div>
      <NextPrevNav
        {...getArcadeNeighbors("/arcade/patty-drive-thru")}
        backToHub={{ title: "All Arcade Games", href: "/arcade" }}
      />
    </div>
  </div>
);
