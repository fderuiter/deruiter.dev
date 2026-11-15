import { describe, expect, it } from "vitest";
import { getBlogPostingNode, getBlogPostingSchema } from "@/lib/seo";

/**
 * BlogPosting wordCount (#3839, CodeQL alert 24): counting article words is
 * a text operation, and only the number reaches the JSON-LD node.
 */

function post(body: string) {
  return {
    slug: "word-count",
    title: "Word count",
    dek: "A post used to check the word count.",
    pillar: "clinical-data-engineering" as const,
    tags: ["test"],
    publishedAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-02T00:00:00.000Z"),
    readingTimeMinutes: 1,
    heroImageUrl: null,
    body,
  };
}

const count = (body: string) => getBlogPostingNode(post(body)).wordCount;

describe("BlogPosting wordCount (#3839)", () => {
  it("counts visible words and treats tags as word breaks", () => {
    expect(count("<p>One two</p><p>three</p>")).toBe(3);
    expect(count("plain text with four")).toBe(4);
    expect(count("<h2>Title</h2>\n<p>Body <em>with</em> emphasis.</p>")).toBe(4);
  });

  it("skips script and style contents", () => {
    expect(
      count("<p>Seen</p><script>var hidden = 1;</script><STYLE>p{}</STYLE>")
    ).toBe(1);
    expect(count("<scripted>kept</scripted>")).toBe(1);
  });

  it("stops at unterminated markup instead of counting it", () => {
    expect(count("two words <p unterminated")).toBe(2);
    expect(count("one <script>never closed")).toBe(1);
  });

  it("omits wordCount when nothing visible remains", () => {
    expect(count("<script>only()</script>")).toBeUndefined();
  });

  it("never carries body text into the serialized schema", () => {
    const marker = "BODY_MARKER_3839";
    const raw = getBlogPostingSchema(
      post(`<p>${marker}</p><script>alert("${marker}")</script>`)
    );
    expect(raw).not.toContain(marker);
    expect(raw).not.toContain("<");
    expect(JSON.parse(raw).wordCount).toBe(1);
  });

  it("keeps escaping < in serialized fields", () => {
    const raw = getBlogPostingSchema({ ...post("x"), title: "</script><b>" });
    expect(raw).not.toContain("<");
    expect(JSON.parse(raw).headline).toBe("</script><b>");
  });
});
