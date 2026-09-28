import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const runtime = "nodejs";
export const alt = "Engineering Dispatch | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

interface ImageProps {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: ImageProps) {
  const { slug } = await params;

  // Find matching config in ROUTE_METADATA_CONFIGS by canonical path
  const config = Object.values(ROUTE_METADATA_CONFIGS).find(
    (c) => c.path === `/blog/${slug}`
  );

  const title = config?.title || `Dispatch: ${slug}`;
  const description =
    config?.description ||
    "A cross-project engineering retrospective, technique write-up, or field note.";
  const tags = config?.keywords?.slice(0, 5) || [
    "Engineering",
    "Retrospective",
    "Blog",
  ];

  return createSocialImageResponse({
    category: "ENGINEERING DISPATCH // BLOG",
    title,
    description,
    badge: `DISPATCH // ${slug.toUpperCase()}`,
    tags,
    systemStatus: "PUBLISHED",
  });
}
