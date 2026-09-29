import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const runtime = "nodejs";
export const alt = "Laser Loon: Quest for the State Flag | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  const config = ROUTE_METADATA_CONFIGS.laserLoon;
  return createSocialImageResponse({
    preset: "VECTOR_ARTWORK",
    category: "ENGINEERING ARCADE // PHYSICS SHOOTER",
    title: config.title,
    description: config.description,
    badge: "F277 CAMPAIGN // RETRO SHOOTER",
    tags: [
      "Laser Loon",
      "Canvas 2D",
      "Physics Engine",
      "Raycasting",
      "Particles",
    ],
    systemStatus: "LASERS ARMED // CAPITOL ROAD",
  });
}
