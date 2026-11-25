import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt =
  "Clinical AI governance: failure modes, guidance references, validation evidence and walkthroughs | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "CLINICAL",
    title: "AI governance",
    description:
      "Failure modes, regulatory guidance references, validation evidence and walkthroughs for AI-assisted clinical data work on synthetic studies.",
    badge: "EVIDENCE // SYNTHETIC",
    tags: ["FDA AI Draft", "EU Annex 22", "GAMP AI", "Synthetic"],
    systemStatus: "SYNTHETIC DEMO ONLY",
  });
}
