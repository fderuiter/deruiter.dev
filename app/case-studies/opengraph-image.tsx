import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Case Studies Technical Directory | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "ENGINEERING CASE STUDIES & DEEP-DIVES",
    title: "Production Systems Engineering Case Studies",
    description:
      "Comprehensive architectural breakdowns of high-scale canvas layout engines, telemetry streaming pipelines, and regulatory data suites.",
    badge: "STUDIES // ARCHIVE",
    tags: [
      "Systems Design",
      "Performance Engineering",
      "Clinical CDISC",
      "Telemetry Streams",
      "PostgreSQL",
    ],
    systemStatus: "INDEX ONLINE",
  });
}
