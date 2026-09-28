import type { Metadata } from "next";
import { RetroLabyrinthClient } from "@/components/arcade/RetroLabyrinthClient";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getWebApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";

import { PageLayout } from "@/components/PageLayout";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.retroLabyrinth
);

export default function RetroLabyrinthPage() {
  return (
    <PageLayout variant="studio" className="pt-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getWebApplicationSchema({
            name: ROUTE_METADATA_CONFIGS.retroLabyrinth.title,
            description: ROUTE_METADATA_CONFIGS.retroLabyrinth.description,
            url: ROUTE_METADATA_CONFIGS.retroLabyrinth.path,
            applicationCategory: "GameApplication",
            genre: "Roguelike Simulation",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Arcade Hub", url: "/arcade" },
            { name: "Retro Labyrinth", url: "/arcade/retro-labyrinth" },
          ]),
        }}
      />
      <RetroLabyrinthClient />
    </PageLayout>
  );
}
