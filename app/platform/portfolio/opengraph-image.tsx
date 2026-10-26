import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
export const runtime = "nodejs";
export const alt =
  "Synthetic clinical portfolio dashboard | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
export default function Image() {
  return createSocialImageResponse({
    category: "CLINICAL DATA PLATFORM",
    title: "Portfolio dashboard",
    description:
      "Every study's milestones on one timeline, and its cycle times against the portfolio.",
    badge: "PORTFOLIO // SYNTHETIC",
    tags: ["Milestones", "Slippage", "Start-up", "Close-out"],
    systemStatus: "GOVERNED METRICS",
  });
}
