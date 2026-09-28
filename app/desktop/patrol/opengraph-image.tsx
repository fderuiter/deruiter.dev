import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const runtime = "nodejs";
export const alt =
  "Patrol Shift Studio: Midwest Ski Patrol Simulator | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  const config = ROUTE_METADATA_CONFIGS.patrol;
  return createSocialImageResponse({
    category: "OPERATIONAL SYSTEMS // PATROL SIMULATOR",
    title: config.title,
    description: config.description,
    badge: "FOUNDATION SCAFFOLD // FSM",
    tags: [
      "Ski Patrol",
      "Operational Judgment",
      "Shift FSM",
      "Dispatch Protocols",
      "Winter Operations",
    ],
    systemStatus: "SIMULATOR ONLINE // SHIFT ACTIVE",
  });
}
