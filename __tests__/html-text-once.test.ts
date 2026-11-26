// @vitest-environment node
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  decodeHtmlEntities,
  htmlToText,
  plainTextSummary,
} from "@/lib/html-text";
import {
  compileTerms,
  resetPatternCache,
  validateTermTags,
} from "@/lib/term-compiler";
import type { TermDefinition } from "@/lib/term-glossary";
import { extractAndInjectHeadings } from "@/lib/blog/headings";
import { resolveSnippetTerminology } from "@/components/ui/InlineMarkdown";

describe("decodeHtmlEntities", () => {
  it("decodes named and numeric entities once", () => {
    expect(decodeHtmlEntities("&amp;lt;tag&amp;gt;")).toBe("&lt;tag&gt;");
    expect(
      decodeHtmlEntities("&lt;b&gt; &quot;q&quot; &#39;s&#x27; &apos;")
    ).toBe("<b> \"q\" 's' '");
    expect(decodeHtmlEntities("&bogus; &#x110000; &")).toBe(
      "&bogus; &#x110000; &"
    );
  });
});

describe("htmlToText", () => {
  it.each([
    ["<p>Hello <b>world</b></p>", "Hello world"],
    ['<a title="a > b">link</a> after', "link after"],
    ["a < b and c > d", "a < b and c > d"],
    ["Escaped &lt;T&gt; stays text", "Escaped <T> stays text"],
    ["Before <!-- <p>hidden</p> --> after", "Before  after"],
    ["Tail <img src=x onerror=alert(1)", "Tail "],
    ["&amp;lt;script&amp;gt;", "&lt;script&gt;"],
  ])("reads %j as %j", (html, text) => {
    expect(htmlToText(html)).toBe(text);
  });

  it("never returns a tag that was escaped in the input", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (raw) => {
        const escaped = raw
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        expect(htmlToText(escaped)).toBe(raw);
      }),
      { numRuns: 300 }
    );
  });
});

// CodeQL alert 17 (#3835)
describe("plainTextSummary", () => {
  it("keeps code generics, drops markup and Markdown markers", () => {
    expect(
      plainTextSummary(
        'A **typed** `Array<T>` and <span data-key="x">term</span> &amp; *more*'
      )
    ).toBe("A typed Array<T> and term & more");
  });

  it("caps the summary at 160 characters", () => {
    expect(plainTextSummary("word ".repeat(80))).toHaveLength(160);
  });
});

// CodeQL alert 15 (#3833)
describe("validateTermTags compares decoded attributes once", () => {
  it("accepts a definition that contains entity-looking text", () => {
    const glossary: TermDefinition[] = [
      {
        key: "entity-term",
        canonical: "Widget",
        simplified: "a &lt;small&gt; part",
        definition: "Shown as &amp;lt;tag&amp;gt; in source",
      },
    ];
    resetPatternCache();
    const html = compileTerms("The Widget works.", glossary);
    expect(html).toContain('data-key="entity-term"');
    expect(validateTermTags(html, glossary)).toEqual({
      valid: true,
      errors: [],
    });
    resetPatternCache();
  });
});

// CodeQL alert 18 (#3836)
describe("resolveSnippetTerminology reads text once", () => {
  const tag =
    '<span data-key="k" data-term="plain &amp;lt;b&amp;gt; words" data-definition="d">Tech &lt;T&gt;</span>';

  it("keeps escaped text visible in both modes", () => {
    expect(resolveSnippetTerminology(`Use ${tag} now.`, false)).toBe(
      "Use Tech <T> now."
    );
    expect(resolveSnippetTerminology(`Use ${tag} now.`, true)).toBe(
      "Use plain &lt;b&gt; words now."
    );
  });

  it("keeps inline code literal and reads quoted attributes whole", () => {
    expect(
      resolveSnippetTerminology(
        'See `Array<T>` and <a title="x > y">link</a>.',
        false
      )
    ).toBe("See `Array<T>` and link.");
  });
});

// CodeQL alert 23 (#3838)
describe("extractAndInjectHeadings reads labels once", () => {
  it("keeps escaped and quoted heading text", () => {
    const { headings, html } = extractAndInjectHeadings(
      '<h2>Using &lt;T&gt; <code>Map&lt;K, V&gt;</code></h2><h3><span title="a > b">Odd</span> label</h3>'
    );
    expect(headings.map((h) => h.text)).toEqual([
      "Using <T> Map<K, V>",
      "Odd label",
    ]);
    expect(html).toContain('id="section-');
    expect(html).not.toContain("<T>");
  });
});
