/* jscpd:ignore-start */
import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Frederick de Ruiter | Software & Side Projects";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "CLINICAL DATA / SOFTWARE / SIDE PROJECTS",
    title: "Hi, I’m Fred. I make complicated things usable.",
    description:
      "Clinical research tools, browser experiments, and a laser-eyed loon. See what I’ve built and how it works.",
    badge: "PORTFOLIO // 2026",
    tags: ["Next.js 16", "React 19", "Canvas 2D", "Pretext", "Neon Postgres"],
    systemStatus: "COME TAKE A LOOK",
  });
}
/* jscpd:ignore-end */
