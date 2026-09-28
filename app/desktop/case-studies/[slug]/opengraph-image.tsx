import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const runtime = "nodejs";
export const alt = "Case Study Technical Deep-Dive | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

interface ImageProps {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: ImageProps) {
  const { slug } = await params;

  // Find matching config in ROUTE_METADATA_CONFIGS by canonical path
  const config = Object.values(ROUTE_METADATA_CONFIGS).find(
    (c) => c.path === `/case-studies/${slug}` || c.path === `/work/${slug}`
  );

  const title = config?.title || `Technical Case Study: ${slug}`;
  const description =
    config?.description ||
    "In-depth technical architecture breakdown and verifiable systems design.";
  const tags = config?.keywords?.slice(0, 5) || [
    "Architecture",
    "TypeScript",
    "Systems",
    "Case Study",
  ];

  return createSocialImageResponse({
    category: "ENGINEERING CASE STUDY // ARCHITECTURAL BREAKDOWN",
    title,
    description,
    badge: `SYS-CASE // ${slug.toUpperCase()}`,
    tags,
    systemStatus: "VERIFIED ARCHITECTURE // PRODUCTION READY",
  });
}
