"use client";

import React from "react";
import dynamic from "next/dynamic";
import { PageLayout } from "@/components/PageLayout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

const MobileNeuroClient = dynamic(
  () => import("./MobileNeuroClient").then((mod) => mod.MobileNeuroClient),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-zinc-950 text-white p-8 font-mono text-sm animate-pulse">
        Loading Mobile NeuroRecon Studio...
      </div>
    ),
  }
);

export default function MobileNeuroPage() {
  return (
    <PageLayout
      variant="studio"
      className="bg-zinc-950 text-white selection:bg-brand-cyan/30 selection:text-brand-cyan"
    >
      <h1 className="sr-only">Mobile NeuroRecon Studio</h1>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4 w-full">
        <Breadcrumbs
          items={[
            { label: "Systems", href: "/#about" },
            { label: "NeuroRecon Studio (Mobile)", href: "/m/neuro" },
          ]}
        />
      </div>
      <MobileNeuroClient />
    </PageLayout>
  );
}
