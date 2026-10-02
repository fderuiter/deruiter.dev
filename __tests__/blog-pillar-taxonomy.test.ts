// @vitest-environment node
import { describe, it, expect } from "vitest";
import { FALLBACK_BLOG_POSTS } from "@/lib/fallback-blog-posts";
import { CONTENT_PILLARS } from "@/lib/blog/types";

/**
 * ADR 0041 §3 declares the content-pillar taxonomy closed: `BlogPost.pillar`
 * must be one of `CONTENT_PILLARS`, never free text.
 *
 * Nothing enforced that. `BlogPostData.pillar` is typed `string`, so a typo or
 * an invented pillar compiles, seeds, and renders -- it simply never appears
 * under any pillar filter. These assertions are the enforcement the ADR assumes
 * already exists.
 */
describe("blog content pillar taxonomy", () => {
  const validPillars = new Set<string>(CONTENT_PILLARS);

  it("assigns every post a pillar from the closed taxonomy", () => {
    for (const post of FALLBACK_BLOG_POSTS) {
      expect(
        validPillars.has(post.pillar),
        `"${post.slug}" declares pillar "${post.pillar}", which is not in CONTENT_PILLARS (ADR 0041 §3)`
      ).toBe(true);
    }
  });

  it("declares no duplicate slugs or ids", () => {
    const slugs = FALLBACK_BLOG_POSTS.map((p) => p.slug);
    const ids = FALLBACK_BLOG_POSTS.map((p) => p.id);

    expect(
      slugs.filter((s, i) => slugs.indexOf(s) !== i),
      "duplicate slugs collide on the BlogPost unique constraint and upsert over each other"
    ).toEqual([]);
    expect(
      ids.filter((s, i) => ids.indexOf(s) !== i),
      "duplicate ids collide on the BlogPost primary key"
    ).toEqual([]);
  });

  /**
   * ADR 0041 §6 sets the launch bar at 3-5 posts, one per top-weighted pillar,
   * before /blog is linked prominently. Coverage is asserted per pillar rather
   * than as a total, because four posts concentrated in two pillars satisfies a
   * count while leaving most of the taxonomy dead.
   */
  it("covers every declared pillar with at least one published post", () => {
    const uncovered = CONTENT_PILLARS.filter(
      (pillar) =>
        !FALLBACK_BLOG_POSTS.some((p) => p.pillar === pillar && p.published)
    );

    expect(
      uncovered,
      `pillars with no published post render an empty filter (ADR 0041 §6): ${uncovered.join(", ")}`
    ).toEqual([]);
  });

  it("gives every post the fields the /blog index renders", () => {
    for (const post of FALLBACK_BLOG_POSTS) {
      expect(
        post.title.length,
        `${post.slug} has an empty title`
      ).toBeGreaterThan(0);
      expect(post.dek.length, `${post.slug} has an empty dek`).toBeGreaterThan(
        0
      );
      expect(
        post.body.length,
        `${post.slug} has an empty body`
      ).toBeGreaterThan(0);
      expect(post.tags.length, `${post.slug} has no tags`).toBeGreaterThan(0);
      expect(
        post.created_at instanceof Date &&
          !Number.isNaN(post.created_at.getTime()),
        `${post.slug} has an invalid created_at, which breaks index ordering`
      ).toBe(true);
    }
  });

  /**
   * The body is rendered as sanitized HTML against the same allowlist as
   * `CaseStudy.architectural_narrative` (ADR 0041 §4). Raw `<` inside a code
   * sample must be escaped as `&lt;` or the sanitizer drops the rest of the
   * block, silently truncating the post.
   */
  it("escapes angle brackets inside code samples", () => {
    for (const post of FALLBACK_BLOG_POSTS) {
      const codeBlocks = post.body.match(/<code[^>]*>[\s\S]*?<\/code>/g) ?? [];
      for (const block of codeBlocks) {
        const inner = block
          .replace(/^<code[^>]*>/, "")
          .replace(/<\/code>$/, "");
        expect(
          inner.includes("<"),
          `${post.slug} has an unescaped "<" inside a code sample; use &lt; or the sanitizer truncates the post`
        ).toBe(false);
      }
    }
  });
});
