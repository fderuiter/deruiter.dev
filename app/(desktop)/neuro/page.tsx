"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { PageLayout } from "@/components/PageLayout";
import { NeuroReconSkeleton } from "@/components/neuro/NeuroReconSkeleton";

const NeuroReconClient = dynamic(
  () =>
    import("@/components/neuro/NeuroReconClient").then(
      (mod) => mod.NeuroReconClient
    ),
  {
    ssr: false,
    loading: () => <NeuroReconSkeleton />,
  }
);

export default function NeuroReconPage() {
  return (
    <PageLayout
      variant="studio"
      className="bg-zinc-950 text-white selection:bg-brand-cyan/30 selection:text-brand-cyan"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 w-full">
        {/* The studio chrome carries no visible page title, so assistive
            technology had no top-level heading to land on and the document
            outline started at h2. Visually hidden rather than rendered, since a
            display heading would compete with the workspace UI. */}
        <h1 className="sr-only">NeuroRecon Studio</h1>
        <Breadcrumbs
          items={[
            { label: "Systems", href: "/#about" },
            { label: "NeuroRecon Studio", href: "/neuro" },
          ]}
        />
      </div>

      <NeuroReconClient />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 w-full">
        <NextPrevNav
          prev={{
            title: "Logical Proof Workspace",
            href: "/proof",
            label: "Formal Logic Engine",
            tag: "Interactive Proof Canvas",
          }}
          next={{
            title: "Engineering Alignment Simulator",
            href: "/simulator",
            label: "Incident Triage",
            tag: "Engineering Leadership",
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
