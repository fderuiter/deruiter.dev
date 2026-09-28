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
      "Send a direct message for systems engineering inquiries, consulting opportunities, or clinical data architecture discussions.",
    badge: "DIRECT // RELAY",
    tags: [
      "Inquiries",
      "Collaboration",
      "Consulting",
      "Architecture",
      "Engineering",
    ],
    systemStatus: "RELAY ACTIVE",
  });
}
