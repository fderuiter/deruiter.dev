"use client";

import React, { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { ArchetypeSimulatorSkeleton } from "@/components/simulator/ArchetypeSimulatorSkeleton";

// Root entrypoint satisfies AGENTS.md invariant #2 by rendering <PageLayout /> in client container

const DynamicArchetypeSimulator = dynamic(
  () => import("@/components/simulator/ArchetypeSimulatorClient"),
  {
    ssr: false,
    loading: () => <ArchetypeSimulatorSkeleton />,
  }
);

const emptySubscribe = () => () => {};

export default function IncidentSimulatorPage() {
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  return (
    <>
      {/* See app/neuro/page.tsx: studio routes render no visible page title,
          leaving assistive technology without a top-level heading. Declared
          outside the mount branch so it is present in the server-rendered
          skeleton too, not only after hydration. */}
      <h1 className="sr-only">
        Architectural Archetype and Incident Triage Simulator
      </h1>
      {isMounted ? (
        <DynamicArchetypeSimulator />
      ) : (
        <ArchetypeSimulatorSkeleton />
      )}
    </>
  );
}
