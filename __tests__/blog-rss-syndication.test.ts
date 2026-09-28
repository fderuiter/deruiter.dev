import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getRss } from "@/app/(desktop)/blog/rss.xml/route";
import { GET as getFeed } from "@/app/feed.xml/route";
import {
  BlogPostService,
  type BlogPostData,
} from "@/lib/services/blog-service";
import { resolveBaseUrl } from "@/lib/domain";
import { JSDOM } from "jsdom";

describe("Blog RSS/Atom Syndication (Issue #763)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("serves valid RSS 2.0 XML with published blog posts", async () => {
    const baseUrl = resolveBaseUrl();
    const mockPosts = [
      {
        id: "post-1",
        slug: "systems-reliability-notes",
        title: "Systems Reliability Notes",
        dek: "Notes on building resilient distributed systems.",
        body: "<p>Deep dive into distributed systems reliability.</p>",
        pillar: "systems-architecture",
        tags: "reliability, distributed-systems",
        published: true,
        reading_time_minutes: 5,
        hero_image_url: null,
        created_at: new Date("2026-03-10T12:00:00.000Z"),
        updated_at: new Date("2026-03-10T12:00:00.000Z"),
      },
      {
        id: "post-2-draft",
        slug: "unpublished-draft-post",
        title: "Unpublished Draft Post",
        dek: "This draft should never appear in public feeds.",
        body: "<p>Secret draft content.</p>",
        pillar: "draft",
        tags: "secret",
        published: false,
        reading_time_minutes: 2,
        hero_image_url: null,
        created_at: new Date("2026-03-12T12:00:00.000Z"),
        updated_at: new Date("2026-03-12T12:00:00.000Z"),
      },
    ];

    vi.spyOn(BlogPostService, "getAllPublishedBlogPosts").mockResolvedValue(
      mockPosts as BlogPostData[]
    );

    const res = await getRss();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/xml");
    expect(res.headers.get("Cache-Control")).toContain("public");

    const xml = await res.text();
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain(
      "<title>Systems Engineering Dispatches | Frederick de Ruiter</title>"
    );
    expect(xml).toContain(`<link>${baseUrl}/blog</link>`);
    expect(xml).toContain("<title>Systems Reliability Notes</title>");
    expect(xml).toContain(
      `<guid isPermaLink="true">${baseUrl}/blog/systems-reliability-notes</guid>`
    );
    expect(xml).toContain(
      "<description>Notes on building resilient distributed systems.</description>"
    );
    expect(xml).toContain("<category>systems-architecture</category>");
    expect(xml).toContain("<category>reliability</category>");
    expect(xml).toContain(
      "<![CDATA[<p>Deep dive into distributed systems reliability.</p>]]>"
    );

    // Assert that unpublished drafts are strictly excluded
    expect(xml).not.toContain("Unpublished Draft Post");
    expect(xml).not.toContain("unpublished-draft-post");
  });

  it("stays well-formed XML when a post body contains a CDATA terminator", async () => {
    const body = "<pre><code>if (a[b[0]]> 1) return;</code></pre>";
    vi.spyOn(BlogPostService, "getAllPublishedBlogPosts").mockResolvedValue([
      {
        id: "post-cdata",
        slug: "cdata-terminator",
        title: "Arrays & <Generics>",
        dek: "Nested ]]> sequences in prose.",
        body,
        pillar: "systems-architecture",
        tags: "xml",
        published: true,
        reading_time_minutes: 1,
        hero_image_url: null,
        created_at: new Date("2026-03-10T12:00:00.000Z"),
        updated_at: new Date("2026-03-10T12:00:00.000Z"),
      },
    ] as BlogPostData[]);

    const xml = await (await getRss()).text();

    // A strict XML parser throws on a raw "]]>" inside the CDATA section.
    const doc = new JSDOM(xml, { contentType: "application/xml" }).window
      .document;
    const encoded = doc.getElementsByTagName("content:encoded")[0];
    expect(encoded?.textContent).toBe(body);
    expect(doc.querySelector("item > title")?.textContent).toBe(
      "Arrays & <Generics>"
    );
  });

  it("redirects /feed.xml to /blog/rss.xml with a 301 status", async () => {
    const baseUrl = resolveBaseUrl();
    const res = await getFeed();
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe(`${baseUrl}/blog/rss.xml`);
  });
});
