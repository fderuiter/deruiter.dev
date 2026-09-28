"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { PageLayout } from "@/components/PageLayout";
import { PatrolShiftSkeleton } from "@/components/patrol/Skeletons";

const PatrolShiftContainer = dynamic(
  () =>
    import("@/components/patrol/PatrolShiftContainer").then(
      (mod) => mod.PatrolShiftContainer
    ),
  {
    ssr: false,
    loading: () => <PatrolShiftSkeleton />,
  }
);

export default function PatrolShiftPage() {
  return (
    <PageLayout
      variant="studio"
      className="bg-zinc-950 text-white selection:bg-brand-cyan/30 selection:text-brand-cyan"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4 w-full">
        {/* See app/neuro/page.tsx: studio routes render no visible page title,
            leaving assistive technology without a top-level heading. */}
        <h1 className="sr-only">Patrol Shift Studio</h1>
        <Breadcrumbs
          items={[
            { label: "Systems", href: "/#about" },
            { label: "Patrol Shift", href: "/patrol" },
          ]}
        />
      </div>

      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 w-full">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
          <PatrolShiftContainer />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 w-full">
        <NextPrevNav
          prev={{
            title: "CRF Studio & EDC",
            href: "/crf",
            label: "Clinical Trial Forms",
            tag: "CDISC CDASH Studio",
          }}
          next={{
            title: "Proof Workspace",
            href: "/proof",
            label: "Formal Logic Engine",
            tag: "Deductive Proof Canvas",
          }}
          backToHub={{
            title: "Return to Portfolio",
            href: "/",
          }}
        />
      </div>
    </PageLayout>
  );
}
