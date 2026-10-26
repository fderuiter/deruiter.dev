import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
export const runtime = "nodejs";
export const alt =
  "Clinical data, end to end: forms to tables to a governed portfolio | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
export default function Image() {
  return createSocialImageResponse({
    category: "CLINICAL",
    title: "Clinical data, end to end",
    description:
      "One synthetic study, from case report forms through SDTM and ADaM to a governed portfolio.",
    badge: "JOURNEY // SYNTHETIC",
    tags: ["CRF Studio", "Protocol Drift", "Study Data", "Platform"],
    systemStatus: "FOUR STEPS, ONE STUDY",
  });
}
