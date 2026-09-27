"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { PageLayout } from "@/components/PageLayout";
import { FieldManualButton } from "@/components/FieldManualButton";
import { CRFStudioSkeleton } from "@/components/crf/Skeletons";

const CRFStudioContainer = dynamic(
  () =>
    import("@/components/crf/CRFStudioContainer").then(
      (mod) => mod.CRFStudioContainer
    ),
  {
    ssr: false,
    loading: () => <CRFStudioSkeleton />,
  }
);

export default function CRFStudioPage() {
  return (
    <PageLayout
      variant="studio"
      className="bg-zinc-950 text-white selection:bg-brand-cyan/30 selection:text-brand-cyan"
    >
      {/* The studio's visible headings belong to whichever mode panel is open,
          so the stable page-level heading is visually hidden rather than
          duplicating a title the layout does not have room for. */}
      <h1 className="sr-only">CRF Studio</h1>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4 w-full flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Breadcrumbs
            items={[
              { label: "Systems", href: "/#about" },
              { label: "CRF Studio", href: "/crf" },
            ]}
          />
        </div>
        <FieldManualButton manualId="crf" label="Studio Guide" />
      </div>

      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 w-full">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
          <CRFStudioContainer />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 w-full">
        <NextPrevNav
          prev={{
            title: "NeuroRecon: FreeSurfer Simulator",
            href: "/neuro",
            label: "Neuroimaging CAD",
            tag: "Interactive 3D Pipeline",
          }}
          next={{
            title: "Logical Proof Workspace",
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
