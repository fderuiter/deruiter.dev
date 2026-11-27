import { resolveBaseUrl } from "@/lib/domain";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import type { BlogPostData } from "../shared";
import { ListPublishedBlogPostsHandler } from "../list-published-blog-posts/handler";
import type { ListPublishedBlogPostsResult } from "../list-published-blog-posts/spec";
import {
  GetBlogRssFeedInputSchema,
  type GetBlogRssFeedInput,
  type GetBlogRssFeedResult,
  type GetBlogRssFeedSpec,
} from "./spec";

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdata(unsafe: string): string {
  return `<![CDATA[${unsafe.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

export interface GetBlogRssFeedDeps {
  listPublishedPosts?: () => Promise<ListPublishedBlogPostsResult>;
}

export class GetBlogRssFeedHandler implements GetBlogRssFeedSpec {
  private readonly listPublishedPosts: () => Promise<ListPublishedBlogPostsResult>;

  constructor(deps: GetBlogRssFeedDeps = {}) {
    const defaultList = new ListPublishedBlogPostsHandler();
    this.listPublishedPosts =
      deps.listPublishedPosts ?? (() => defaultList.execute());
  }

  async execute(
    input: GetBlogRssFeedInput = {}
  ): Promise<GetBlogRssFeedResult> {
    const parsed = GetBlogRssFeedInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_RSS_FEED_INPUT",
        parsed.error.issues[0]?.message ?? "Invalid RSS feed parameters",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    const baseUrl = parsed.data.baseUrl ?? resolveBaseUrl();
    let posts: BlogPostData[] = [];
    try {
      const postsResult = await this.listPublishedPosts();
      posts = postsResult.success ? postsResult.data : [];
    } catch (error) {
      return createFailure(
        "RSS_GENERATION_FAILED",
        "Failed to load published posts for RSS feed",
        { recoverable: true, details: error }
      );
    }
    const publishedPosts = posts.filter((p) => p.published);

    const lastBuildDate =
      publishedPosts.length > 0
        ? new Date(publishedPosts[0].created_at).toUTCString()
        : new Date().toUTCString();

    const itemsXml = publishedPosts
      .map((post) => {
        const postUrl = `${baseUrl}/blog/${post.slug}`;
        const pubDate = new Date(post.created_at).toUTCString();
        const tags = post.tags
          ? post.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [];

        const categoriesXml = [post.pillar, ...tags]
          .filter(Boolean)
          .map((cat) => `<category>${escapeXml(cat)}</category>`)
          .join("\n      ");

        return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(post.dek || "")}</description>
      ${categoriesXml}
      <content:encoded>${cdata(post.body)}</content:encoded>
    </item>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Systems Engineering Dispatches | Frederick de Ruiter</title>
    <link>${baseUrl}/blog</link>
    <description>Architectural deep-dives, systems reliability, and engineering notes by Frederick de Ruiter.</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${baseUrl}/blog/rss.xml" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

    return createSuccess({ xml, itemCount: publishedPosts.length });
  }
}
