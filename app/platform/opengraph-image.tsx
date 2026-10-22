import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Clinical Data Platform | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "CLINICAL DATA PLATFORM",
    title: "From source feeds to governed decisions",
    description:
      "A synthetic sponsor portfolio mapped through bronze, silver, gold and a shared semantic layer.",
    badge: "PLATFORM // SYNTHETIC",
    tags: ["Data Products", "CDISC", "Semantic Layer", "Governance"],
    systemStatus: "ARCHITECTURE IN PROGRESS",
  });
}
