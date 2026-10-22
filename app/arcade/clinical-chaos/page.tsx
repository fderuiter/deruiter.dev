import type { Metadata } from "next";
import Link from "next/link";
import { ClinicalChaosClient } from "@/components/arcade/ClinicalChaosClient";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getWebApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";

import { PageLayout } from "@/components/PageLayout";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.clinicalChaos
);

export default function ClinicalChaosPage() {
  return (
    <PageLayout variant="studio" className="pt-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getWebApplicationSchema({
            name: ROUTE_METADATA_CONFIGS.clinicalChaos.title,
            description: ROUTE_METADATA_CONFIGS.clinicalChaos.description,
            url: ROUTE_METADATA_CONFIGS.clinicalChaos.path,
            applicationCategory: "GameApplication",
            genre: "Regulatory Compliance Arcade",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Arcade Hub", url: "/arcade" },
            { name: "Clinical Trial Chaos", url: "/arcade/clinical-chaos" },
          ]),
        }}
      />
      <div className="mx-auto mb-4 w-full max-w-5xl">
        <Link
          href="/platform"
          className="text-xs text-slate-300 underline decoration-zinc-600 underline-offset-4 hover:text-white"
        >
          Explore the Clinical Data Platform behind this game
        </Link>
      </div>
      <ClinicalChaosClient />
    </PageLayout>
  );
}
