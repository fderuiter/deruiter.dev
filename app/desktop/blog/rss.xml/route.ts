import { NextResponse } from "next/server";
import { BlogPostService } from "@/lib/services/blog-service";
import { resolveBaseUrl } from "@/lib/domain";

export const dynamic = "force-dynamic";

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Wraps markup in a CDATA section. A literal "]]>" would end the section
 * early and make the whole feed malformed, so each one is split across two
 * adjacent sections, which XML parsers concatenate back into the original.
 */
function cdata(unsafe: string): string {
  return `<![CDATA[${unsafe.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

export async function GET() {
  const baseUrl = resolveBaseUrl();
  const posts = await BlogPostService.getAllPublishedBlogPosts();
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

  const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
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

  return new NextResponse(rssFeed, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
