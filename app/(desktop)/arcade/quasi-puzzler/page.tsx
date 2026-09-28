import type { Metadata } from "next";
import { QuasiPuzzlerClient } from "@/components/arcade/QuasiPuzzlerClient";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getWebApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";

import { PageLayout } from "@/components/PageLayout";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.quasiPuzzler
);

export default function QuasiPuzzlerPage() {
  return (
    <PageLayout variant="studio" className="pt-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getWebApplicationSchema({
            name: ROUTE_METADATA_CONFIGS.quasiPuzzler.title,
            description: ROUTE_METADATA_CONFIGS.quasiPuzzler.description,
            url: ROUTE_METADATA_CONFIGS.quasiPuzzler.path,
            applicationCategory: "GameApplication",
            genre: "Formal Logic Puzzle",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Arcade Hub", url: "/arcade" },
            { name: "Quasi-Perfect Puzzler", url: "/arcade/quasi-puzzler" },
          ]),
        }}
      />
      <QuasiPuzzlerClient />
    </PageLayout>
  );
}
