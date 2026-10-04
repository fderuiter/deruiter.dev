import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Laser Loon Merch, Coming Soon | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "LASER LOON MERCH",
    title: "Laser Loon Merch, Coming Soon",
    description:
      "Stickers, shirts, desk mats, mugs and prints of the F277 flag, planned at base production cost with no artist markup.",
    badge: "AT COST // CC0",
    tags: ["Stickers", "T-Shirts", "Desk Mats", "Mugs", "Prints"],
    systemStatus: "COMING SOON",
  });
}
