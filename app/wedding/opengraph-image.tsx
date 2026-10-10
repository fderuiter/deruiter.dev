import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Abbi & Fred: Our Wedding Archive | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "WEDDING ARCHIVE",
    title: "Abbi & Fred: Our Wedding",
    description:
      "The story, the wedding party and photos from our wedding at the Plummer House in Rochester, Minnesota, on October 10, 2025.",
    badge: "10.10.2025 // ONE YEAR ON",
    tags: ["Plummer House", "Rochester, MN", "Photos", "Wedding Party"],
    systemStatus: "ARCHIVED",
  });
}
