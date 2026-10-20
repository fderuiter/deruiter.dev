import type { Metadata } from "next";
import Link from "next/link";
import { ProtocolDriftClient } from "@/components/arcade/ProtocolDriftClient";
import { PageLayout } from "@/components/PageLayout";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getBreadcrumbSchema, getWebApplicationSchema } from "@/lib/seo";
import { getNavBreadcrumbSchemaParents } from "@/lib/navigation";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.protocolDrift
);

export default function ProtocolDriftPage() {
  return (
    <PageLayout variant="studio" className="pt-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getWebApplicationSchema({
            name: ROUTE_METADATA_CONFIGS.protocolDrift.title,
            description: ROUTE_METADATA_CONFIGS.protocolDrift.description,
            url: ROUTE_METADATA_CONFIGS.protocolDrift.path,
            applicationCategory: "SimulationApplication",
            genre: "Systems Simulation",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            ...getNavBreadcrumbSchemaParents("/protocol-drift"),
            { name: "Protocol Drift", url: "/protocol-drift" },
          ]),
        }}
      />
      <div className="mx-auto mb-4 w-full max-w-[1600px]">
        <Link
          href="/platform"
          className="text-xs text-slate-300 underline decoration-zinc-600 underline-offset-4 hover:text-white"
        >
          Explore the Clinical Data Platform behind this simulation
        </Link>
      </div>
      <ProtocolDriftClient />
    </PageLayout>
  );
}
