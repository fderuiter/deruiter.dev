import type { Metadata } from "next";
import { PattyDriveThruClient } from "@/components/arcade/PattyDriveThruClient";
import { PageLayout } from "@/components/PageLayout";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getBreadcrumbSchema, getWebApplicationSchema } from "@/lib/seo";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.pattyDriveThru
);

export default function PattyDriveThruPage() {
  return (
    <PageLayout variant="studio" className="pt-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getWebApplicationSchema({
            name: ROUTE_METADATA_CONFIGS.pattyDriveThru.title,
            description: ROUTE_METADATA_CONFIGS.pattyDriveThru.description,
            url: ROUTE_METADATA_CONFIGS.pattyDriveThru.path,
            applicationCategory: "GameApplication",
            genre: "Autobiographical Simulation",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Arcade Hub", url: "/arcade" },
            {
              name: "Patty's Drive-Thru",
              url: "/arcade/patty-drive-thru",
            },
          ]),
        }}
      />
      <PattyDriveThruClient />
    </PageLayout>
  );
}
