import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
export const runtime = "nodejs";
export const alt =
  "Synthetic clinical operations dashboards | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
export default function Image() {
  return createSocialImageResponse({
    category: "CLINICAL DATA PLATFORM",
    title: "Clinical operations dashboards",
    description:
      "Enrollment, activation, data management and quality, drilled from portfolio to site.",
    badge: "OPERATIONS // SYNTHETIC",
    tags: ["Enrollment", "Queries", "Deviations", "Milestones"],
    systemStatus: "GOVERNED METRICS",
  });
}
