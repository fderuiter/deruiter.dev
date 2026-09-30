"use client";

import React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { IconArrowLeft, IconTable } from "@tabler/icons-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { getArcadeNeighbors } from "@/lib/arcade";
import { useTeMotion } from "@/components/trial-and-error/useTeMotion";

const CardTableLoader = () =>
  import("@/components/trial-and-error/Tutorial").then(
    (mod) => mod.TrialAndErrorTable
  );

const DynamicCardTable = dynamic(CardTableLoader, {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[380px] items-center justify-center p-8 font-mono text-xs text-zinc-400">
      Loading Card Table…
    </div>
  ),
});

export const TrialAndErrorClient: React.FC = () => {
  const { loudEffectsEnabled } = useTeMotion();
  return (
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
              { label: "Trial & Error: Biostat Ops" },
            ]}
          />
        </div>

        <div className="mb-8 min-w-0">
          <h1 className="font-mono text-3xl font-extrabold tracking-[-0.035em] text-zinc-100 break-words sm:text-4xl">
            Trial &amp; Error:{" "}
            <span className="text-amber-400">Biostat Ops</span>
          </h1>
          <p className="mt-2 max-w-3xl font-mono text-xs text-zinc-300 sm:text-sm">
            A deckbuilder where clinical outputs are the cards. Pair Tables with
            their Listings, line up a CSR Straight, and play hands worth Chips ×
            Mult to beat the Blind. Inspect a card first if you don&apos;t trust
            the programmer. Every study, subject and rule here is fictional;
            nothing is clinical or regulatory advice.
          </p>
        </div>

        {/* Cabinet scope for the --te-* tokens and loud-moment layers (ADR 0046 amendment). */}
        <div
          data-te-cabinet=""
          data-te-loud={loudEffectsEnabled ? "on" : "off"}
          className="border border-zinc-800 bg-[#13151a] p-1.5 sm:p-4"
        >
          <PlayCabinet
            gameId="trial-and-error"
            title="Trial & Error: Biostat Ops"
            subtitle="Card Table · Small Blind"
            icon={
              <IconTable
                className="h-8 w-8 text-amber-400"
                aria-hidden="true"
              />
            }
            instructions="Select up to five TLF cards and play the best hand against the Blind. Inspect a card (1 CPU) to reveal and correct its defects for +Mult; an uninspected card can still hide a fatal error that zeroes the hand. Play costs 2 CPU, Discard 1 CPU."
            controls={[
              { key: "← →", action: "Move across the hand" },
              { key: "Space", action: "Select or deselect a card" },
              { key: "Enter", action: "Play hand (2 CPU)" },
              { key: "D", action: "Discard selected (1 CPU)" },
              { key: "I", action: "Inspect card (1 CPU)" },
              { key: "Esc", action: "Close Inspect" },
            ]}
            importComponent={CardTableLoader}
          >
            <DynamicCardTable />
          </PlayCabinet>
        </div>
        <NextPrevNav
          {...getArcadeNeighbors("/arcade/trial-and-error")}
          backToHub={{ title: "All Arcade Games", href: "/arcade" }}
        />
      </div>
    </div>
  );
};
