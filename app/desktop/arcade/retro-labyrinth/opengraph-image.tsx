import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const runtime = "nodejs";
export const alt = "Retro Labyrinth: Graveyard Roguelike | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  const config = ROUTE_METADATA_CONFIGS.retroLabyrinth;
  return createSocialImageResponse({
    category: "ENGINEERING ARCADE // GRAVEYARD ROGUELIKE",
    title: config.title,
    description: config.description,
    badge: "PROCEDURAL DUNGEON // TSP",
    tags: [
      "Roguelike",
      "Procedural AST",
      "TSP Walls",
      "Canvas 3D Wireframe",
      "Technical Debt",
    ],
    systemStatus: "DUNGEON LOADED // DEBT HIGH",
  });
}
