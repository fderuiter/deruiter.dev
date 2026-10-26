import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
export const runtime = "nodejs";
export const alt =
  "Self-service explorer over a governed semantic layer | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
export default function Image() {
  return createSocialImageResponse({
    category: "CLINICAL DATA PLATFORM",
    title: "Explore the metrics",
    description:
      "Pick a governed metric, group and filter it, and see its chart, table, definition and SQL.",
    badge: "EXPLORE // SYNTHETIC",
    tags: ["Semantic layer", "Self-service", "Valid joins only", "Shareable"],
    systemStatus: "GOVERNED METRICS",
  });
}
