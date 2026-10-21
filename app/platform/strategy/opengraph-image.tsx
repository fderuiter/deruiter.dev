import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
export const runtime = "nodejs";
export const alt = "Synthetic platform strategy toolkit | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
export default function Image() {
  return createSocialImageResponse({
    category: "CLINICAL DATA PLATFORM",
    title: "Platform strategy toolkit",
    description:
      "Fictional vendor scoring, five-year investment models and a decision memo.",
    badge: "STRATEGY // SYNTHETIC",
    tags: ["Weighted scoring", "NPV", "Roadmap", "Maturity"],
    systemStatus: "INTERACTIVE TOOLKIT",
  });
}
