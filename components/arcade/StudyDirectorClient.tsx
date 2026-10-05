"use client";

import React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { IconArrowLeft, IconClipboardCheck } from "@tabler/icons-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import { DesktopOnlyGate } from "@/components/arcade/DesktopOnlyGate";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { getArcadeNeighbors } from "@/lib/arcade";

/** The game opens in the walkable office; the classic desk is one click away. */
const StudyDirectorLoader = () =>
  import("@/components/study-director/StudyDirectorGame").then((mod) => {
    const { StudyDirectorGame } = mod;
    const OfficeFirstStudyDirector: React.FC = () => (
      <StudyDirectorGame officeFirst />
    );
    return OfficeFirstStudyDirector;
  });

const DynamicStudyDirector = dynamic(StudyDirectorLoader, {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[380px] items-center justify-center p-8 font-mono text-xs text-zinc-400">
      Opening the study file…
    </div>
  ),
});

export const StudyDirectorClient: React.FC = () => (
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
            { label: "Study Director: Everything Is Fine" },
          ]}
        />
      </div>

      <div className="mb-8 min-w-0">
        <h1 className="font-mono text-3xl font-extrabold tracking-[-0.035em] break-words text-zinc-100 sm:text-4xl">
          Study Director:{" "}
          <span className="text-amber-400">Everything Is Fine</span>
        </h1>
        <p className="mt-2 max-w-3xl font-mono text-xs text-zinc-300 sm:text-sm">
          Walk the floor of a contract research organization and shepherd one
          clinical study from kickoff to closeout. Talk to a team that is not
          always fine, drive out to the sites, and watch the office show what
          the dashboard will not. Every study, site and person here is
          fictional; nothing is clinical or regulatory advice.
        </p>
      </div>

      <div className="border border-zinc-800 bg-[#13151a] p-1.5 sm:p-4">
        <DesktopOnlyGate gameId="study-director" gameTitle="Study Director">
          <PlayCabinet
            gameId="study-director"
            title="Study Director: Everything Is Fine"
            subtitle="Study 24-081 · Clinical Study Management"
            icon={
              <IconClipboardCheck
                className="h-8 w-8 text-amber-400"
                aria-hidden="true"
              />
            }
            instructions="Walk the office, talk to your team, and drive out to the sites behind the green dashboard. Every action costs minutes and energy, and skipped documentation comes back at inspection. Prefer the dashboard? The classic desk is one button away."
            controls={[
              { key: "W A S D or ↑ ← ↓ →", action: "Walk" },
              { key: "E", action: "Use what you face, or talk" },
              { key: "F", action: "Ask yourself how you are" },
              { key: "Classic desk: 1 - 5", action: "Choose an option" },
              { key: "Classic desk: E", action: "End the day" },
            ]}
            importComponent={StudyDirectorLoader}
          >
            <DynamicStudyDirector />
          </PlayCabinet>
        </DesktopOnlyGate>
      </div>
      <NextPrevNav
        {...getArcadeNeighbors("/arcade/study-director")}
        backToHub={{ title: "All Arcade Games", href: "/arcade" }}
      />
    </div>
  </div>
);
