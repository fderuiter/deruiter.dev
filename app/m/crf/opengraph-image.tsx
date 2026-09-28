import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Mobile CRF Studio | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "CLINICAL DATA & EDC SUITE",
    title: "Mobile CRF Studio",
    description:
      "Touch-optimized clinical research form studio designed for mobile viewports, enabling interactive section and field inspection.",
    badge: "MOBILE EDC // TOUCH",
    tags: [
      "CDISC CDASH",
      "Field Inspector",
      "Clinical eCRF",
      "Regulatory Touch",
    ],
    systemStatus: "MOBILE EDC ACTIVE",
  });
}
