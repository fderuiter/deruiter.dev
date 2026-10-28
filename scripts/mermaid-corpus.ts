import fs from "fs";
import path from "path";

export interface MermaidBlock {
  file: string;
  index: number;
  source: string;
}

const CORPUS_FILES = [
  "lib/case-studies-data.ts",
  "prisma/seed.ts",
  "ARCHITECTURE.md",
  "docs/explanation/case-study-engineering-notes.md",
  "docs/explanation/inbody-qr-decoder-case-study.md",
  "docs/explanation/audits/product-excellence-evaluation.md",
  "docs/reference/clinical-platform-star-schema.md",
];

const HTML_MERMAID_REGEX =
  /<code\b[^>]*class=(?:["'])[^"']*\blanguage-mermaid\b[^"']*(?:["'])[^>]*>([\s\S]*?)<\/code>/gi;
const MARKDOWN_MERMAID_REGEX = /```mermaid\r?\n([\s\S]*?)\r?\n```/gi;

function unescapeHtml(source: string): string {
  return source
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Extract every checked-in Mermaid source block used by the static corpus. */
export function extractAllMermaidBlocks(
  workspaceRoot: string = process.cwd()
): MermaidBlock[] {
  const blocks: MermaidBlock[] = [];

  for (const file of CORPUS_FILES) {
    const fullPath = path.resolve(workspaceRoot, file);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const text = fs.readFileSync(fullPath, "utf8");
    let index = 1;
    let match: RegExpExecArray | null;

    HTML_MERMAID_REGEX.lastIndex = 0;
    while ((match = HTML_MERMAID_REGEX.exec(text)) !== null) {
      blocks.push({
        file,
        index: index++,
        source: unescapeHtml(match[1].trim()),
      });
    }

    MARKDOWN_MERMAID_REGEX.lastIndex = 0;
    while ((match = MARKDOWN_MERMAID_REGEX.exec(text)) !== null) {
      blocks.push({
        file,
        index: index++,
        source: unescapeHtml(match[1].trim()),
      });
    }
  }

  return blocks;
}
