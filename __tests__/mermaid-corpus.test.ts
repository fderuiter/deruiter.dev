// @vitest-environment node
import path from "path";
import { describe, expect, it } from "vitest";
import { launchChromiumWithFallback } from "../lib/dx/browser-launch";
import {
  extractAllMermaidBlocks,
  validateCorpus,
} from "../scripts/validate-mermaid-corpus";

describe("51-source Mermaid corpus validation", () => {
  it("extracts all 51 static Mermaid diagrams across repository source files", () => {
    expect(extractAllMermaidBlocks()).toHaveLength(51);
  });

  it("keeps the static Mermaid corpus free of click directives", () => {
    const blocksWithClick = extractAllMermaidBlocks().filter((block) =>
      /^\s*click\s+/im.test(block.source)
    );
    expect(blocksWithClick).toEqual([]);
  });

  it("renders every static Mermaid block through the strict browser engine", async () => {
    const { results, total } = await validateCorpus();

    expect(total).toBe(51);
    expect(results.filter((result) => !result.valid)).toEqual([]);
  }, 30_000);

  it("renders HTML-like label text as text rather than DOM elements under strict security", async () => {
    const browser = await launchChromiumWithFallback();
    try {
      const page = await browser.newPage();
      await page.setContent("<!doctype html><html><body></body></html>");
      await page.addScriptTag({
        path: path.join(
          process.cwd(),
          "node_modules/mermaid/dist/mermaid.min.js"
        ),
      });

      const check = await page.evaluate(async () => {
        const mermaid = (
          window as unknown as { mermaid: typeof import("mermaid").default }
        ).mermaid;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          htmlLabels: false,
          flowchart: { htmlLabels: false },
        });
        const host = document.createElement("div");
        document.body.append(host);
        const { svg } = await mermaid.render(
          "strict-xss-label-check",
          'flowchart TD\n  A["<img src=x onerror=alert(1)>"]',
          host
        );
        host.innerHTML = svg;
        return {
          hasImg: host.querySelector("img") !== null,
          hasForeignObject: host.querySelector("foreignObject") !== null,
          hasOnerror: host.querySelector("[onerror]") !== null,
          svgText: host.querySelector("svg")?.textContent ?? "",
        };
      });

      expect(check.hasImg).toBe(false);
      expect(check.hasForeignObject).toBe(false);
      expect(check.hasOnerror).toBe(false);
      expect(check.svgText).toContain('<img src="x">');
      expect(check.svgText).not.toContain("alert(1)");
    } finally {
      await browser.close();
    }
  }, 30_000);
});
