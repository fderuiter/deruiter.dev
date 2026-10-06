import type { Metadata } from "next";
import { ArcadeHubClient } from "@/components/arcade/ArcadeHubClient";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import {
  getCollectionPageSchema,
  getWebApplicationSchema,
  getBreadcrumbSchema,
} from "@/lib/seo";
import { ARCADE_GAMES_METADATA } from "@/lib/arcade-data";
import { ARCADE_GAME_ROUTES } from "@/lib/arcade";
import { PageLayout } from "@/components/PageLayout";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.arcade
);

export default function ArcadePage() {
  // Protocol Drift keeps its trophies in the cabinet but now lives with the
  // simulators, so the hub's collection lists only the games on the hub.
  const hubRoutes: readonly string[] = ARCADE_GAME_ROUTES;
  const collectionItems = ARCADE_GAMES_METADATA.filter((game) =>
    hubRoutes.includes(game.route)
  ).map((game) => ({
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
