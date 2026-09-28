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
      '<h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6><p>P</p><pre><code class="language-ts">const safe = true;</code></pre><a href="/proof" target="_blank" rel="noopener">Proof</a><strong>strong</strong><em>em</em><b>b</b><i>i</i><ul><li>ul-li</li></ul><ol><li>ol-li</li></ol><span>span</span><abbr title="abbr">abbr</abbr><blockquote>bq</blockquote><br><div>div</div>'
    );

    expect(sanitized).toContain("<h1>H1</h1>");
    expect(sanitized).toContain("<h2>H2</h2>");
    expect(sanitized).toContain("<h3>H3</h3>");
    expect(sanitized).toContain("<h4>H4</h4>");
    expect(sanitized).toContain("<h5>H5</h5>");
    expect(sanitized).toContain("<h6>H6</h6>");
    expect(sanitized).toContain("<p>P</p>");
    expect(sanitized).toContain('<pre><code class="language-ts">');
    expect(sanitized).toContain('href="/proof"');
    expect(sanitized).toContain('target="_blank"');
    expect(sanitized).toContain("<strong>strong</strong>");
    expect(sanitized).toContain("<em>em</em>");
    expect(sanitized).toContain("<b>b</b>");
    expect(sanitized).toContain("<i>i</i>");
    expect(sanitized).toContain("<ul><li>ul-li</li></ul>");
    expect(sanitized).toContain("<ol><li>ol-li</li></ol>");
    expect(sanitized).toContain("<span>span</span>");
    expect(sanitized).toContain("<abbr");
    expect(sanitized).toContain("<blockquote>bq</blockquote>");
    expect(sanitized).toContain("<br>");
    expect(sanitized).toContain("<div>div</div>");
  });

  it("retains all allowed attributes", () => {
    const sanitized = sanitizeContentHtml(
      '<div id="main-id" class="container" data-term="term" data-definition="def" data-key="key" role="navigation" tabindex="0" aria-label="nav" aria-describedby="desc" aria-hidden="false"><a href="/about" target="_self" rel="nofollow">link</a></div>'
    );

    expect(sanitized).toContain('id="main-id"');
    expect(sanitized).toContain('class="container"');
    expect(sanitized).toContain('data-term="term"');
    expect(sanitized).toContain('data-definition="def"');
    expect(sanitized).toContain('data-key="key"');
    expect(sanitized).toContain('role="navigation"');
    expect(sanitized).toContain('tabindex="0"');
    expect(sanitized).toContain('aria-label="nav"');
    expect(sanitized).toContain('aria-describedby="desc"');
    expect(sanitized).toContain('aria-hidden="false"');
    expect(sanitized).toContain('href="/about"');
    expect(sanitized).toContain('target="_self"');
    expect(sanitized).toContain('rel="nofollow"');
  });
});
