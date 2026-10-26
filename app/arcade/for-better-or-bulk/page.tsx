import type { Metadata } from "next";
import { ForBetterOrBulkClient } from "@/components/arcade/ForBetterOrBulkClient";
import { PageLayout } from "@/components/PageLayout";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getBreadcrumbSchema, getWebApplicationSchema } from "@/lib/seo";
import { getBreadcrumbTrailSchema } from "@/lib/navigation";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.forBetterOrBulk
);

export default function ForBetterOrBulkPage() {
  return (
    <PageLayout variant="studio" className="pt-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getWebApplicationSchema({
            name: ROUTE_METADATA_CONFIGS.forBetterOrBulk.title,
            description: ROUTE_METADATA_CONFIGS.forBetterOrBulk.description,
            url: ROUTE_METADATA_CONFIGS.forBetterOrBulk.path,
            applicationCategory: "GameApplication",
            genre: "Co-op Kitchen Chaos",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema(
            getBreadcrumbTrailSchema("/arcade/for-better-or-bulk")
          ),
        }}
      />
      <ForBetterOrBulkClient />
    </PageLayout>
  );
}
