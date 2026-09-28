import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Engineering Dispatches Blog | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "ENGINEERING DISPATCHES & TECHNICAL WRITING",
    title: "Systems Engineering Dispatches",
    description:
      "Cross-project retrospectives, technique write-ups, and field notes on clinical data engineering, formal verification, and browser graphics.",
    badge: "BLOG // ARCHIVE",
    tags: [
      "Engineering Retrospectives",
      "CDISC",
      "Formal Verification",
      "Accessibility",
      "Canvas Graphics",
    ],
    systemStatus: "ARCHIVE ONLINE",
  });
}
