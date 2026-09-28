import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Schedule Technical Consultation | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "TECHNICAL CONSULTATION & ARCHITECTURE SYNC",
    title: "Schedule a Systems Architecture & Strategy Sync",
    description:
      "Direct technical consultation on high-performance frontend architecture, serverless data pipelines, and CDISC regulatory systems.",
    badge: "CALENDAR // SYNC",
    tags: [
      "Systems Design",
      "Technical Advisory",
      "Frontend Architecture",
      "Clinical Data",
      "Mentorship",
    ],
    systemStatus: "CALENDAR OPEN",
  });
}
