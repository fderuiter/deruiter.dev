import type { Metadata } from "next";
import { ROUTE_METADATA_CONFIGS, buildRouteMetadata } from "@/lib/seo-metadata";
import { getBreadcrumbSchema } from "@/lib/seo";
import { getNavBreadcrumbSchemaParents } from "@/lib/navigation";
import { WeddingArchiveView } from "@/components/wedding/WeddingArchiveView";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.wedding
);

export default function WeddingPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden pt-28 sm:pt-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            ...getNavBreadcrumbSchemaParents("/wedding"),
            { name: "Our Wedding", url: "/wedding" },
          ]),
        }}
      />
      <WeddingArchiveView />
    </div>
  );
}
