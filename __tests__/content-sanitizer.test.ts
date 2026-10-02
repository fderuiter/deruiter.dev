// @vitest-environment node
import { describe, expect, it } from "vitest";
import { sanitizeContentHtml } from "@/lib/content-sanitizer";

describe("content sanitizer", () => {
  it("removes executable and embedded markup", () => {
    const sanitized = sanitizeContentHtml(
      '<p>Safe copy</p><script>alert("xss")</script><iframe src="https://evil.example"></iframe>'
    );

    expect(sanitized).toContain("<p>Safe copy</p>");
    expect(sanitized).not.toContain("script");
    expect(sanitized).not.toContain("iframe");
  });

  it("removes event handlers and inline styles", () => {
    const sanitized = sanitizeContentHtml(
      '<p onclick="alert(1)" style="color: red">Safe copy</p><a href="javascript:alert(1)">Unsafe</a>'
    );

    expect(sanitized).toContain("<p>Safe copy</p>");
    expect(sanitized).not.toContain("onclick");
    expect(sanitized).not.toContain("style=");
    expect(sanitized).not.toContain("javascript:");
  });

  it("retains allowed headings, code blocks, and safe links", () => {
    const sanitized = sanitizeContentHtml(
      '<h2>Design</h2><pre><code class="language-ts">const safe = true;</code></pre><a href="/proof" target="_blank" rel="noopener">Proof</a>'
    );

    expect(sanitized).toContain("<h2>Design</h2>");
    expect(sanitized).toContain('<pre><code class="language-ts">');
    expect(sanitized).toContain('href="/proof"');
    expect(sanitized).toContain('target="_blank"');
  });
});
