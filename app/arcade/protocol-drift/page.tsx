import type { Metadata } from "next";
import { ProtocolDriftClient } from "@/components/arcade/ProtocolDriftClient";
import { PageLayout } from "@/components/PageLayout";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getBreadcrumbSchema, getWebApplicationSchema } from "@/lib/seo";

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
            applicationCategory: "GameApplication",
            genre: "Systems Simulation",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Arcade Hub", url: "/arcade" },
            { name: "Protocol Drift", url: "/arcade/protocol-drift" },
          ]),
        }}
      />
      <ProtocolDriftClient />
    </PageLayout>
  );
}
