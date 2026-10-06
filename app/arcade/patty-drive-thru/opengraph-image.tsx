import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const runtime = "nodejs";
export const alt =
  "Patty's Drive-Thru, a first-person diary of a first job at a drive-thru window | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  const config = ROUTE_METADATA_CONFIGS.pattyDriveThru;
  return createSocialImageResponse({
    category: "ENGINEERING ARCADE // DIARY",
    title: config.title,
    description: config.description,
    badge: "ONE BOOTH // ONE SHIFT",
    tags: [
      "First-Person 3D",
      "React Three Fiber",
      "Seeded Engine",
      "Keyboard Playable",
      "Autobiographical",
    ],
    systemStatus: "ORDER #4 // RED ON THE BOARD",
  });
}
