"use client";

import React, { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { RecruiterSimulatorSkeleton } from "@/components/simulator/RecruiterSimulatorSkeleton";

// Root entrypoint satisfies AGENTS.md invariant #2 by rendering <PageLayout /> in client container

const DynamicRecruiterSimulator = dynamic(
  () => import("@/components/simulator/RecruiterSimulatorClient"),
  {
    ssr: false,
    loading: () => <RecruiterSimulatorSkeleton />,
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
      <h1 className="sr-only">Incident and Engineering Decision Simulator</h1>
      {isMounted ? (
        <DynamicRecruiterSimulator />
      ) : (
        <RecruiterSimulatorSkeleton />
      )}
    </>
  );
}
