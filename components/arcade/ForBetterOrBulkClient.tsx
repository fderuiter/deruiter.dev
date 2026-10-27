"use client";

import React from "react";
import dynamic from "next/dynamic";
import { IntentLink } from "@/components/ui/IntentLink";
import { IconArrowLeft, IconRings } from "@tabler/icons-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { getArcadeNeighbors } from "@/lib/arcade";
import { requestFbbAutoPause } from "@/components/for-better-or-bulk/auto-pause";
import { DEFAULT_SETUP, type Setup } from "@/lib/for-better-or-bulk";

const ForBetterOrBulkLoader = () =>
  import("@/components/for-better-or-bulk/ForBetterOrBulkGame").then(
    (mod) => mod.ForBetterOrBulkGame
  );

const DynamicForBetterOrBulk = dynamic(ForBetterOrBulkLoader, {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[380px] items-center justify-center p-8 font-mono text-xs text-zinc-400">
      Unloading the car…
    </div>
  ),
});

/**
 * The page's opening plan: the default cart with the helper on, so a
 * one-player day starts with the other person working too. Playtests found
 * that the day people finish and enjoy; the harder solo day is one untick away.
 */
const PAGE_SETUP: Setup = { ...DEFAULT_SETUP, assist: true };

export const ForBetterOrBulkClient: React.FC = () => (
  <div className="min-h-dvh overflow-x-hidden bg-[#0d0e11] px-4 pb-24 text-zinc-100 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-zinc-800 pb-4 sm:gap-4">
        <IntentLink
          href="/arcade"
          className="inline-flex min-h-[48px] items-center gap-1.5 font-mono text-xs text-zinc-300 hover:text-amber-400"
        >
          <IconArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to Arcade Hub</span>
        </IntentLink>
        <Breadcrumbs path="/arcade/for-better-or-bulk" />
      </div>

      <div className="mb-8 min-w-0">
        <h1 className="font-mono text-3xl font-extrabold tracking-[-0.035em] break-words text-zinc-100 sm:text-4xl">
          For Better or <span className="text-amber-400">Bulk</span>
        </h1>
        <p className="mt-2 max-w-3xl font-mono text-xs text-zinc-300 sm:text-sm">
          Abbi and I got married on 10/10/25 for under about $4,000, mostly from
          Costco. You bought everything at the warehouse; someone still has to
          turn it into a wedding by 4:00. Play alone, or as two people on one
          keyboard. The layout and the chaos are made up; the hot dogs were
          real.{" "}
          <IntentLink
            href="/wedding"
            className="text-amber-400 underline underline-offset-4 hover:text-amber-300"
          >
            See the real wedding
          </IntentLink>
          .
        </p>
      </div>

      <div className="border border-zinc-800 bg-[#13151a] p-1.5 sm:p-4">
        <PlayCabinet
          gameId="for-better-or-bulk"
          title="For Better or Bulk"
          subtitle="Friday setup · Plummer House · 10/10/25"
          icon={
            <IconRings className="h-8 w-8 text-amber-400" aria-hidden="true" />
          }
          instructions="Pick two website features and fill the cart within budget, then set up the venue before the 4:00 ceremony. Arrange roses at the rose table, grill the hot dogs and wings before they burn, carry chairs to the lawn and hang the lanterns. Fred's brothers will text."
          controls={[
            { key: "WASD / arrows", action: "Move Fred / Abbi" },
            { key: "E or Space / Enter", action: "Pick up or put down" },
            { key: "F / Shift (hold)", action: "Arrange, pluck or simplify" },
            { key: "Tab", action: "Swap people (one player)" },
            { key: "Esc", action: "Pause" },
          ]}
          importComponent={ForBetterOrBulkLoader}
          fullscreenKey={false}
          singleTitleScreen={false}
          // The day, its dock and its panel are built to fit the touch
          // cabinet's viewport, so the stage clips rather than scrolls
          // (ADR 0061, #2123). The plan and the receipt scroll in the game.
          mobileLayout="fit"
          // A hidden tab or a backgrounded app pauses a day in progress.
          onAutoPause={requestFbbAutoPause}
        >
          <DynamicForBetterOrBulk initialSetup={PAGE_SETUP} />
        </PlayCabinet>
      </div>
      <NextPrevNav
        {...getArcadeNeighbors("/arcade/for-better-or-bulk")}
        backToHub={{ title: "All Arcade Games", href: "/arcade" }}
      />
    </div>
  </div>
);
