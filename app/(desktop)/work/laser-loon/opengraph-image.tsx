import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const runtime = "nodejs";
export const alt =
  "The Laser Loon: Graphic Design Case Study & Open Vector Asset Hub | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  const config = ROUTE_METADATA_CONFIGS.laserLoonCaseStudy;
  return createSocialImageResponse({
    preset: "VECTOR_ARTWORK",
    title: config
      ? config.title
      : "The Laser Loon: Graphic Design & Vector Asset Hub",
    description: config
      ? config.description
      : "Download source .ai, .eps, .pdf, .svg, and .png master vector files for the Laser Loon (MN Flag Submission F277) under Creative Commons.",
    badge: "MN FLAG F277 // VECTOR HUB",
    tags: [
      "Laser Loon",
      "Minnesota State Flag",
      "Vector Distribution",
      "SVG / AI / EPS",
      "Creative Commons",
    ],
    systemStatus: "OPEN ASSET HUB // CC BY 4.0",
  });
}
