import type { Metadata } from "next";
import { WorkingWithDuckClient } from "@/components/arcade/WorkingWithDuckClient";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getWebApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";

import { PageLayout } from "@/components/PageLayout";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.workingWithDuck
);

export default function WorkingWithDuckPage() {
  return (
    <PageLayout variant="studio" className="pt-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getWebApplicationSchema({
            name: ROUTE_METADATA_CONFIGS.workingWithDuck.title,
            description: ROUTE_METADATA_CONFIGS.workingWithDuck.description,
            url: ROUTE_METADATA_CONFIGS.workingWithDuck.path,
            applicationCategory: "GameApplication",
            genre: "Pet Simulation Arcade",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Arcade Hub", url: "/arcade" },
            { name: "Working With Duck", url: "/arcade/working-with-duck" },
          ]),
        }}
      />
      <WorkingWithDuckClient />
    </PageLayout>
  );
}
