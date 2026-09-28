import type { Metadata } from "next";
import { TrialAndErrorClient } from "@/components/arcade/TrialAndErrorClient";
import { PageLayout } from "@/components/PageLayout";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getBreadcrumbSchema, getWebApplicationSchema } from "@/lib/seo";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.trialAndError
);

export default function TrialAndErrorPage() {
  return (
    <PageLayout variant="studio" className="pt-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getWebApplicationSchema({
            name: ROUTE_METADATA_CONFIGS.trialAndError.title,
            description: ROUTE_METADATA_CONFIGS.trialAndError.description,
            url: ROUTE_METADATA_CONFIGS.trialAndError.path,
            applicationCategory: "GameApplication",
            genre: "Roguelike Deckbuilder",
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
              name: "Trial & Error: Biostat Ops",
              url: "/arcade/trial-and-error",
            },
          ]),
        }}
      />
      <TrialAndErrorClient />
    </PageLayout>
  );
}
