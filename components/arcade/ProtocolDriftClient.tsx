"use client";

import React from "react";
import dynamic from "next/dynamic";
import { IconShieldCheck } from "@tabler/icons-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import { DesktopOnlyGate } from "@/components/arcade/DesktopOnlyGate";

// React Flow and the engine adapter load only when the cabinet launches, so
// the arcade hub and the shared bundle never pay for them.
const ProtocolDriftLoader = () =>
  import("@/components/protocol-drift/ProtocolDriftGame").then(
    (mod) => mod.ProtocolDriftGame
  );

const DynamicProtocolDrift = dynamic(ProtocolDriftLoader, {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[380px] items-center justify-center p-8 font-mono text-xs text-zinc-300">
      Opening the workbench…
    </div>
  ),
});

export const ProtocolDriftClient: React.FC = () => (
  <div className="min-h-dvh overflow-x-hidden bg-[#0d0e11] px-4 pb-24 text-zinc-100 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-zinc-800 pb-4 sm:gap-4">
        <Breadcrumbs items={[{ label: "Protocol Drift" }]} />
      </div>

      <div className="mb-8 min-w-0">
        <h1 className="font-mono text-3xl font-extrabold tracking-[-0.035em] break-words text-zinc-100 sm:text-4xl">
          Protocol Drift:{" "}
          <span className="text-amber-400">
            Design the trial. Debug reality.
          </span>
        </h1>
        <p className="mt-2 max-w-3xl font-mono text-xs text-zinc-300 sm:text-sm">
          Wire a clinical data pipeline from site entry to CDISC SDTM and ADaM,
          then keep it honest while coordinators tire, a protocol amendment
          lands mid-flight and the data stops matching the plan. Every study,
          site and person here is fictional; nothing is clinical or regulatory
          advice.
        </p>
      </div>

      <div className="border border-zinc-800 bg-[#13151a] p-1.5 sm:p-4">
        <DesktopOnlyGate gameId="protocol-drift" gameTitle="Protocol Drift">
          <PlayCabinet
            gameId="protocol-drift"
            title="Protocol Drift"
            subtitle="Study PD-101 · Clinical Data Architecture"
            icon={
              <IconShieldCheck
                className="h-8 w-8 text-amber-400"
                aria-hidden="true"
              />
            }
            instructions="Build the Tabulation Lane, run the local test, publish a revision, then run the clock. Query with evidence, document honest uncertainty, and clear both Database Lock gates."
            controls={[
              { key: "Space", action: "Run or pause the clock" },
              { key: "N", action: "Step one simulated hour" },
              { key: "I", action: "Expand the Forensic Inspector" },
              { key: "Esc", action: "Dock the inspector" },
              { key: "Tab", action: "Move through chips, wires and panes" },
            ]}
            importComponent={ProtocolDriftLoader}
          >
            <DynamicProtocolDrift />
          </PlayCabinet>
        </DesktopOnlyGate>
      </div>
    </div>
  </div>
);
