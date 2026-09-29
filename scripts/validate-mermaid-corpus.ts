import path from "path";
import { launchChromiumWithFallback } from "../lib/dx/browser-launch";
import { extractAllMermaidBlocks, type MermaidBlock } from "./mermaid-corpus";

export { extractAllMermaidBlocks, type MermaidBlock };

interface MermaidRenderResult {
  file: string;
  index: number;
  source: string;
  valid: boolean;
  error?: string;
}

/**
 * Render the complete static corpus in Chromium, where Mermaid has access to
 * real SVG geometry. This catches renderer failures that parsing alone misses.
 */
export async function validateCorpus(
  workspaceRoot: string = process.cwd()
): Promise<{ total: number; results: MermaidRenderResult[] }> {
  const blocks = extractAllMermaidBlocks(workspaceRoot);
  const browser = await launchChromiumWithFallback();

  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><html><body></body></html>");
    await page.addScriptTag({
      path: path.join(
        workspaceRoot,
        "node_modules/mermaid/dist/mermaid.min.js"
      ),
    });

    const results = await page.evaluate(async (corpus) => {
      const mermaid = (
        window as unknown as { mermaid: typeof import("mermaid").default }
      ).mermaid;
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });

      const rendered = [];
      for (const block of corpus) {
        try {
          const host = document.createElement("div");
          document.body.append(host);
          const { svg } = await mermaid.render(
            `mermaid-corpus-${block.file.replace(/[^a-z0-9]/gi, "-")}-${block.index}`,
            block.source,
            host
          );
          host.remove();

          if (!svg.includes("<svg")) {
            throw new Error("Mermaid did not produce an SVG diagram.");
          }

          rendered.push({ ...block, valid: true });
        } catch (error) {
          rendered.push({
            ...block,
            valid: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return rendered;
    }, blocks);

    return { total: blocks.length, results };
  } finally {
    await browser.close();
  }
}
