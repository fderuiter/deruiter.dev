export * from "./types";
export * from "./presets";
export * from "./headings";
export * from "./related";

import { BlogPostService, toValidBlogPosts } from "@/lib/services/blog-service";
import type { BlogPostData } from "@/lib/fallback-blog-posts";
import type { BlogPost, BlogPostSummary, ContentPillar } from "./types";

/** Maps a post whose dates `toValidBlogPosts` has already coerced. */
function toBlogPostSummary(parsed: BlogPostData): BlogPostSummary {
  return {
    slug: parsed.slug,
    title: parsed.title,
    dek: parsed.dek,
    pillar: parsed.pillar as ContentPillar,
    tags: (typeof parsed.tags === "string" ? parsed.tags : "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    publishedAt: parsed.created_at,
    updatedAt: parsed.updated_at,
    readingTimeMinutes:
      typeof parsed.reading_time_minutes === "number" &&
      Number.isFinite(parsed.reading_time_minutes) &&
      parsed.reading_time_minutes >= 0
        ? parsed.reading_time_minutes
        : null,
    heroImageUrl:
      typeof parsed.hero_image_url === "string" && parsed.hero_image_url.trim()
        ? parsed.hero_image_url.trim()
        : null,
  };
}

/**
 * Returns every published post, newest first.
 *
 * Backed by `BlogPostService`'s Resilient Hybrid Fallback (Neon, Redis
 * read-through cache, then the static `FALLBACK_BLOG_POSTS` safety net).
 * Guarantees valid date and pillar contracts and deterministic newest-first ordering.
 */
export async function getAllPublishedBlogPosts(): Promise<BlogPostSummary[]> {
  const posts = await BlogPostService.getAllPublishedBlogPosts();
  return toValidBlogPosts(posts)
    .map(toBlogPostSummary)
    .sort((a, b) => {
      const timeDiff = b.publishedAt.getTime() - a.publishedAt.getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return a.slug.localeCompare(b.slug);
    });
}

/**
 * Returns one published post by slug, or `null` if it doesn't exist,
 * isn't published, or has invalid contracts.
 */
export async function getBlogPostBySlug(
  slug: string
): Promise<BlogPost | null> {
  if (!slug || typeof slug !== "string" || !slug.trim()) {
    return null;
  }
  const post = await BlogPostService.getBlogPostBySlug(slug);
  const [parsed] = post ? toValidBlogPosts([post]) : [];
  if (!parsed) {
    return null;
  }
  return {
    ...toBlogPostSummary(parsed),
    body: parsed.body,
  };
}
