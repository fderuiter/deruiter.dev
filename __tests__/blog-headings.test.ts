// @vitest-environment node
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { extractAndInjectHeadings, slugifyHeading } from "@/lib/blog/headings";

describe("Blog Headings Extractor & Injector (Ticket #1058)", () => {
  it("extracts h2 and h3 headings and injects IDs", () => {
    const input = `
      <h2>The Challenge: Memory Exhaustion</h2>
      <p>Introductory paragraph.</p>
      <h3>Streaming XML Tokenization</h3>
      <p>Details on streaming.</p>
      <h3>Enforcing SDTM Conformance</h3>
      <p>Regulatory rules.</p>
    `;

    const { html, headings } = extractAndInjectHeadings(input);

    expect(headings).toHaveLength(3);
    expect(headings[0]).toEqual({
      id: "section-the-challenge-memory-exhaustion",
      text: "The Challenge: Memory Exhaustion",
      level: 2,
    });
    expect(headings[1]).toEqual({
      id: "section-streaming-xml-tokenization",
      text: "Streaming XML Tokenization",
      level: 3,
    });
    expect(headings[2]).toEqual({
      id: "section-enforcing-sdtm-conformance",
      text: "Enforcing SDTM Conformance",
      level: 3,
    });

    expect(html).toContain('id="section-the-challenge-memory-exhaustion"');
    expect(html).toContain('id="section-streaming-xml-tokenization"');
    expect(html).toContain('id="section-enforcing-sdtm-conformance"');
  });

  it("cleans nested tags from heading text for display in TOC", () => {
    const input = `
      <h2>Building with <code>Float64Array</code> and <strong>Zero GC</strong></h2>
    `;

    const { headings, html } = extractAndInjectHeadings(input);

    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe("Building with Float64Array and Zero GC");
    expect(headings[0].id).toBe(
      "section-building-with-float64array-and-zero-gc"
    );
    expect(html).toContain(
      'id="section-building-with-float64array-and-zero-gc"'
    );
  });

  it("disambiguates duplicate heading titles with numbered suffixes", () => {
    const input = `
      <h2>Common Failure Modes</h2>
      <p>First</p>
      <h2>Common Failure Modes</h2>
      <p>Second</p>
    `;

    const { headings, html } = extractAndInjectHeadings(input);

    expect(headings).toHaveLength(2);
    expect(headings[0].id).toBe("section-common-failure-modes");
    expect(headings[1].id).toBe("section-common-failure-modes-1");

    expect(html).toContain('id="section-common-failure-modes"');
    expect(html).toContain('id="section-common-failure-modes-1"');
  });

  it("preserves pre-existing IDs on headings", () => {
    const input = `
      <h2 id="custom-anchor">Pre-existing ID</h2>
    `;

    const { headings, html } = extractAndInjectHeadings(input);

    expect(headings).toHaveLength(1);
    expect(headings[0].id).toBe("custom-anchor");
    expect(headings[0].text).toBe("Pre-existing ID");
    expect(html).toContain('id="custom-anchor"');
  });

  it("handles HTML with no headings gracefully", () => {
    const input = `<p>Only paragraphs and <pre><code>code</code></pre>.</p>`;
    const { html, headings } = extractAndInjectHeadings(input);

    expect(headings).toEqual([]);
    expect(html).toBe(input);
  });

  it("decodes entities in TOC labels and slugs", () => {
    const { headings } = extractAndInjectHeadings(
      "<h3>Audit Trails &amp; Provenance</h3>"
    );
    expect(headings[0].text).toBe("Audit Trails & Provenance");
    expect(headings[0].id).toBe("section-audit-trails-provenance");
  });

  it("prefixes generated ids so DOMPurify anti-clobbering keeps them", () => {
    const { headings, html } = extractAndInjectHeadings("<h2>Images</h2>");
    expect(headings[0].id).toBe("section-images");
    expect(html).toContain('id="section-images"');
  });

  it("ignores data-id and never duplicates an explicit id", () => {
    const { headings, html } = extractAndInjectHeadings(
      '<h2 data-id="x">Foo</h2><h2 id="section-setup">A</h2><h2>Setup</h2>'
    );
    expect(headings.map((h) => h.id)).toEqual([
      "section-foo",
      "section-setup",
      "section-setup-1",
    ]);
    expect(html).toContain('<h2 id="section-foo" data-id="x">');
  });
});

describe("slugifyHeading plain-text contract (#3837, CodeQL alert 22)", () => {
  it("keeps only lowercase word characters and single dashes", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(slugifyHeading(text)).toMatch(/^[a-z0-9_-]+$/);
        expect(slugifyHeading(text)).not.toMatch(/[<>"'&\s]/);
        expect(slugifyHeading(text)).not.toMatch(/--/);
      })
    );
  });

  it("is deterministic and ignores surrounding and repeated whitespace", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(slugifyHeading(`  ${text}  `)).toBe(slugifyHeading(text));
        expect(slugifyHeading(text)).toBe(slugifyHeading(text));
      })
    );
    expect(slugifyHeading("Data   flow\tand\nlineage")).toBe(
      "data-flow-and-lineage"
    );
  });

  it("treats markup-looking text as text, never as tags", () => {
    expect(slugifyHeading('<b>Bold</b> "quoted"')).toBe("bboldb-quoted");
    expect(slugifyHeading("a < b > c")).toBe("a-b-c");
  });

  it("falls back to section when nothing survives", () => {
    expect(slugifyHeading("")).toBe("section");
    expect(slugifyHeading("<>!?")).toBe("section");
  });

  it("still gives prefixed, unique generated ids from extracted labels", () => {
    const { headings } = extractAndInjectHeadings(
      "<h2><em>Same</em> title</h2><h2>Same title</h2>"
    );
    const ids = headings.map((heading) => heading.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids[0]).toMatch(/same-title$/);
  });
});
