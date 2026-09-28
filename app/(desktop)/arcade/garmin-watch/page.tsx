import type { Metadata } from "next";
import { GarminWatchClient } from "@/components/arcade/GarminWatchClient";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getWebApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";

import { PageLayout } from "@/components/PageLayout";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.garminWatch
);

export default function GarminWatchPage() {
  return (
    <PageLayout variant="studio" className="pt-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getWebApplicationSchema({
            name: ROUTE_METADATA_CONFIGS.garminWatch.title,
            description: ROUTE_METADATA_CONFIGS.garminWatch.description,
            url: ROUTE_METADATA_CONFIGS.garminWatch.path,
            applicationCategory: "GameApplication",
            genre: "Embedded Simulation",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Arcade Hub", url: "/arcade" },
            { name: "Garmin 32KB Memory Runner", url: "/arcade/garmin-watch" },
          ]),
        }}
      />
      <GarminWatchClient />
    </PageLayout>
  );
}
