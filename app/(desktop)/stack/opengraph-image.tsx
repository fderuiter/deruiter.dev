import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Systems & Architecture Stack | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "ARCHITECTURE & INFRASTRUCTURE STACK",
    title: "Full-Spectrum Architecture & Engineering Stack",
    description:
      "Deep dive into the 6-layer architecture stack powering sub-millisecond layout calculations, serverless database pooling, and deterministic test gates.",
    badge: "STACK // 6 LAYERS",
    tags: [
      "Neon Postgres",
      "Next.js 16",
      "React 19",
      "Pretext Layout",
      "Tailwind v4",
    ],
    systemStatus: "ARCHITECTURE VERIFIED",
  });
}
