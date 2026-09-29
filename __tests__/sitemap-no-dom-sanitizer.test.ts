import { describe, expect, it, vi } from "vitest";

// Regression for #1340: a route that only reads content (the sitemap) must not
// load the jsdom-backed sanitizer, which throws a require() of ESM error in the
// Vercel serverless bundle.
vi.mock("isomorphic-dompurify", () => {
  throw new Error("isomorphic-dompurify must not load on read-only routes");
});

vi.mock("@/lib/prisma", () => ({ default: {}, prisma: {} }));

describe("sitemap import chain (#1340)", () => {
  it("imports app/sitemap without loading the DOM sanitizer", async () => {
    const mod = await import("@/app/sitemap");
    expect(typeof mod.default).toBe("function");
  });

  it("sanitizes lazily when content is written", async () => {
    vi.doUnmock("isomorphic-dompurify");
    vi.resetModules();
    const { sanitizeContentHtmlLazy } =
      await import("@/lib/content-sanitizer-lazy");
    await expect(
      sanitizeContentHtmlLazy('<p onclick="x()">hi</p><script>1</script>')
    ).resolves.toBe("<p>hi</p>");
  });
});
