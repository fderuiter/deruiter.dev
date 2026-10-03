import type { Metadata } from "next";
import { ROUTE_METADATA_CONFIGS, buildRouteMetadata } from "@/lib/seo-metadata";
import { getWebApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";
import { AcknowledgmentsView } from "@/components/acknowledgments/AcknowledgmentsView";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.acknowledgments
);

export default function AcknowledgmentsPage() {
  return (
    <div className="min-h-screen pt-28 sm:pt-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getWebApplicationSchema({
            name: ROUTE_METADATA_CONFIGS.acknowledgments.title,
            description: ROUTE_METADATA_CONFIGS.acknowledgments.description,
            url: ROUTE_METADATA_CONFIGS.acknowledgments.path,
            applicationCategory: "DeveloperApplication",
            genre: "Open Source Acknowledgments",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Systems", url: "/#case-studies" },
            { name: "Open Source Credits", url: "/acknowledgments" },
          ]),
        }}
      />
      <AcknowledgmentsView />
    </div>
  );
}
