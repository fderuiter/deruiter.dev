// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import {
  buildLlmsManifests,
  LLMS_BASE_URL,
  stripHtml,
} from "../scripts/generate-llms-txt";

const root = process.cwd();

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return { ...actual, isProductionEnvironment: () => true };
});

describe("llms.txt manifests (#1253)", () => {
  const { llms, full } = buildLlmsManifests();

  it("lists every route in ROUTE_METADATA_CONFIGS", () => {
    for (const [key, config] of Object.entries(ROUTE_METADATA_CONFIGS)) {
      expect(llms, key).toContain(`(${LLMS_BASE_URL}${config.path})`);
    }
  });

  it("follows the llms.txt shape: H1, blockquote summary, H2 link lists", () => {
    expect(llms.startsWith("# ")).toBe(true);
    expect(llms).toMatch(/\n> .+/);
    expect(llms).toMatch(/\n## .+\n\n- \[.+\]\(https:\/\/.+\): .+/);
    expect(full).toContain("### ");
  });

  it("is deterministic and canonical: no localhost, no timestamps", () => {
    expect(buildLlmsManifests()).toEqual({ llms, full });
    expect(llms + full).not.toMatch(/localhost|vercel\.app|www\.deruiter/);
  });

  it("committed public files match the generator output (zero drift)", () => {
    expect(fs.readFileSync(path.join(root, "public/llms.txt"), "utf8")).toBe(
      llms
    );
    expect(
      fs.readFileSync(path.join(root, "public/llms-full.txt"), "utf8")
    ).toBe(full);
  });

  it("generator never touches the database (zero Neon wake)", () => {
    const source = fs.readFileSync(
      path.join(root, "scripts/generate-llms-txt.ts"),
      "utf8"
    );
    expect(source).not.toMatch(/prisma|@\/lib\/db|CaseStudyService|redis/i);
  });

  it("robots explicitly lets AI crawlers fetch the manifests", async () => {
    const robots = (await import("@/app/robots")).default();
    const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules];
    const ai = rules.find(
      (rule) =>
        Array.isArray(rule.userAgent) && rule.userAgent.includes("GPTBot")
    );
    expect(ai?.allow).toEqual(
      expect.arrayContaining(["/llms.txt", "/llms-full.txt"])
    );
  });
});

// CodeQL alerts 25 and 16: manifest prose comes from an HTML parser, and
// entities are decoded exactly once.
describe("llms manifest text extraction", () => {
  it("keeps paragraphs and list items as separate lines", () => {
    expect(
      stripHtml(
        "<p>First para.</p><p>Second <em>para</em>.</p><ul><li>a</li><li>b</li></ul>"
      )
    ).toBe("First para.\n\nSecond para.\n\na\n\nb");
  });

  it("drops script, style, template and noscript bodies, even when malformed", () => {
    const text = stripHtml(
      "<p>Kept</p><script>var s = '</p><p>leak';</script><style>p{}</style>" +
        "<template><p>tpl</p></template><noscript>ns</noscript>" +
        "<script>unterminated <p>leak2</p>"
    );
    expect(text).toBe("Kept");
  });

  it("reads quoted > inside attributes as part of the tag", () => {
    expect(stripHtml('<p title="a > b">Visible</p>')).toBe("Visible");
  });

  it("keeps code examples readable", () => {
    expect(
      stripHtml("<pre><code>if (a &lt; b &amp;&amp; c) {}</code></pre>")
    ).toBe("if (a < b && c) {}");
  });

  it.each([
    ["&amp;lt;tag&amp;gt;", "&lt;tag&gt;"],
    ["&amp;amp;", "&amp;"],
    ["&#60;b&#62; and &#x3C;i&#x3E;", "<b> and <i>"],
    ["R&amp;D, Q&A and AT&T", "R&D, Q&A and AT&T"],
    ["it&rsquo;s&nbsp;here", "it's here"],
  ])("decodes %j exactly once", (html, text) => {
    expect(stripHtml(`<p>${html}</p>`)).toBe(text);
  });

  it("gives the same output on every run", () => {
    expect(buildLlmsManifests()).toEqual(buildLlmsManifests());
  });
});
