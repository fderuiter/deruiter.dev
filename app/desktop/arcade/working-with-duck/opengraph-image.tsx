import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const runtime = "nodejs";
export const alt =
  "Working With Duck: Pet Simulation Arcade | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  const config = ROUTE_METADATA_CONFIGS.workingWithDuck;
  return createSocialImageResponse({
    category: "ENGINEERING ARCADE // PET SIMULATION",
    title: config.title,
    description: config.description,
    badge: "PUPPY MASCOT // MULTITASKING",
    tags: [
      "Pet Sim",
      "Puppy Management",
      "Dev Multitasking",
      "Canvas Physics",
      "PR Review",
    ],
    systemStatus: "PUPPY ZOOMIES // PR PENDING",
  });
}
