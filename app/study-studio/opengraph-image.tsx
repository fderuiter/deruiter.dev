import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Clinical Study Studio | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "CLINICAL STUDY STUDIO",
    title: "One study workspace, every view",
    description:
      "Design, schedule, narrative, analysis intent and randomization as views of one USDM study, so every tool reads the same facts.",
    badge: "STUDIO // IN DEVELOPMENT",
    tags: ["USDM", "Study design", "Randomization"],
    systemStatus: "SYNTHETIC STUDIES ONLY",
  });
}
