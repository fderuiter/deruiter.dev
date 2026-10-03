import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Contact & Direct Inquiries | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "DIRECT CHANNEL // ENCRYPTED RELAY",
    title: "Direct Inquiries & Technical Collaboration",
    description:
      "Send a note about an interesting build, an open-source idea, or a clinical data question.",
    badge: "DIRECT // RELAY",
    tags: [
      "Inquiries",
      "Collaboration",
      "Open Source",
      "Architecture",
      "Clinical Data",
    ],
    systemStatus: "RELAY ACTIVE",
  });
}
