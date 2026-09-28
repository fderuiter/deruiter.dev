import type { Metadata } from "next";
import { ArcadeHubClient } from "@/components/arcade/ArcadeHubClient";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import {
  getCollectionPageSchema,
  getWebApplicationSchema,
  getBreadcrumbSchema,
} from "@/lib/seo";
import { ARCADE_GAMES_METADATA } from "@/lib/arcade-data";
import { PageLayout } from "@/components/PageLayout";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.arcade
);

export default function ArcadePage() {
  const collectionItems = ARCADE_GAMES_METADATA.map((game) => ({
    name: game.title,
    url: game.route,
    description: game.description,
  }));

  return (
    <PageLayout variant="studio" className="pt-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getCollectionPageSchema(
            ROUTE_METADATA_CONFIGS.arcade.title,
            ROUTE_METADATA_CONFIGS.arcade.description,
            ROUTE_METADATA_CONFIGS.arcade.path,
            collectionItems
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getWebApplicationSchema({
            name: ROUTE_METADATA_CONFIGS.arcade.title,
            description: ROUTE_METADATA_CONFIGS.arcade.description,
            url: ROUTE_METADATA_CONFIGS.arcade.path,
            applicationCategory: "GameApplication",
            genre: "Interactive Arcade Hub",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Arcade Hub", url: "/arcade" },
          ]),
        }}
      />
      <ArcadeHubClient />
    </PageLayout>
  );
}
