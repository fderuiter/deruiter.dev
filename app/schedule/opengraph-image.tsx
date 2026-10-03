import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Book a Coffee Chat or Tech Talk | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "COFFEE CHAT // TECH TALK",
    title: "Book a Coffee Chat or Tech Talk",
    description:
      "Thirty minutes on clinical software, side projects, open-source ideas, or a bug that will not stay fixed.",
    badge: "CALENDAR // SYNC",
    tags: [
      "Clinical Software",
      "Side Projects",
      "Open Source",
      "Systems Design",
      "Clinical Data",
    ],
    systemStatus: "CALENDAR OPEN",
  });
}
