import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { buildDossierChips } from "@/lib/og-dossier";

export const runtime = "nodejs";
export const alt = "Engineering Dispatch | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
// Cache each card like the article page. Without static params the route ran
// Satori on every crawler fetch, which is the costliest render on the site.
export const revalidate = 3600;

/** No cards are built ahead of time; each is rendered once and then cached. */
export async function generateStaticParams() {
  return [];
}

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

  // The post itself is read through the same cached path as the article page;
  // if it is unavailable the card renders without dossier chips.
  let post: {
    title: string;
    dek: string;
    tags: string[];
    publishedAt: Date;
    readingTimeMinutes: number | null;
  } | null = null;
  try {
    const { getBlogPostBySlug } = await import("@/lib/blog");
    post = await getBlogPostBySlug(slug);
  } catch {
    post = null;
  }

  return createSocialImageResponse({
    preset: "SYSTEMS_ARCHITECTURE",
    dossier: post
      ? buildDossierChips({
          ...(post.readingTimeMinutes
            ? { readingTime: `${post.readingTimeMinutes} min read` }
            : {}),
          publishedAt: post.publishedAt,
          ...(post.tags[0] ? { language: post.tags[0] } : {}),
          verified: true,
        })
      : undefined,
    category: "ENGINEERING DISPATCH // BLOG",
    title: post?.title ?? title,
    description: post?.dek ?? description,
    badge: `DISPATCH // ${slug.toUpperCase()}`,
    tags,
    systemStatus: "PUBLISHED",
  });
}
