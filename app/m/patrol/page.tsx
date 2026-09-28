"use client";

import React from "react";
import dynamic from "next/dynamic";
import { PageLayout } from "@/components/PageLayout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

const MobilePatrolClient = dynamic(
  () => import("./MobilePatrolClient").then((mod) => mod.MobilePatrolClient),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-zinc-950 text-white p-8 font-mono text-sm animate-pulse">
        Loading Mobile Patrol Shift Studio...
      </div>
    ),
  }
);

export default function MobilePatrolPage() {
  return (
    <PageLayout
      variant="studio"
      className="bg-zinc-950 text-white selection:bg-brand-cyan/30 selection:text-brand-cyan"
    >
      <h1 className="sr-only">Mobile Patrol Shift Studio</h1>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4 w-full">
        <Breadcrumbs
          items={[
            { label: "Systems", href: "/#about" },
            { label: "Patrol Shift (Mobile)", href: "/m/patrol" },
          ]}
        />
      </div>
      <MobilePatrolClient />
    </PageLayout>
  );
}
