import fs from "node:fs";
import path from "node:path";
import type { DiagnosticCheckResult } from "../doctor";

/**
 * Documentation Index Parity Check
 *
 * Verifies that active documentation files under docs/ (excluding generated
 * TypeDoc output in docs/reference/api/ and agent skill files) have inbound
 * index links from root (docs/README.md) or quadrant index files. Internal
 * agent invariant documents in docs/agents/invariants/ are covered by their
 * local directory index file.
 */
export function checkDocumentationIndexParity(
  root: string,
  _fix = false
): DiagnosticCheckResult {
  const docsDir = path.join(root, "docs");
  if (!fs.existsSync(docsDir)) {
    return {
      id: "docs-index-parity",
      name: "Documentation Index Parity",
      category: "docs",
      status: "fail",
      message: "docs/ directory does not exist.",
      fixable: false,
    };
  }

  const failures: string[] = [];

  function scanMarkdownFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...scanMarkdownFiles(fullPath));
        } else if (
          entry.isFile() &&
          (entry.name.endsWith(".md") || entry.name.endsWith(".markdown"))
        ) {
          results.push(fullPath);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(
        `Failed to read directory '${path.relative(root, dir).replace(/\\/g, "/") || dir}': ${msg}`
      );
    }
    return results;
  }

  const allMarkdownFiles = scanMarkdownFiles(docsDir);
  const indexFiles = allMarkdownFiles.filter(
    (filePath) => path.basename(filePath).toLowerCase() === "readme.md"
  );

  const indexedPaths = new Set<string>();
  const inlineLinkRegex = /\[[^\]]*\]\(([^)]+)\)/g;
  const refLinkRegex = /^\[[^\]]+\]:\s*(\S+)/gm;

  for (const indexFile of indexFiles) {
    try {
      const content = fs.readFileSync(indexFile, "utf-8");
      const matches = [
        ...content.matchAll(inlineLinkRegex),
        ...content.matchAll(refLinkRegex),
      ];
      const sourceDir = path.dirname(indexFile);

      for (const match of matches) {
        const raw = match[1]?.trim();
        if (!raw || raw.startsWith("#")) continue;
        if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) continue;
        if (raw.startsWith("//")) continue;

        const clean = raw.split("#")[0].split("?")[0].trim();
        if (!clean) continue;

        const resolved = clean.startsWith("/")
          ? path.resolve(root, clean.slice(1))
          : path.resolve(sourceDir, clean);

        indexedPaths.add(path.normalize(resolved));

        // If target links to a directory containing a README.md, register that README.md as indexed
        if (fs.existsSync(resolved)) {
          try {
            if (fs.statSync(resolved).isDirectory()) {
              indexedPaths.add(
                path.normalize(path.join(resolved, "README.md"))
              );
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            failures.push(
              `Failed to stat path '${path.relative(root, resolved).replace(/\\/g, "/")}': ${msg}`
            );
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(
        `Failed to read index file '${path.relative(root, indexFile).replace(/\\/g, "/")}': ${msg}`
      );
    }
  }

  const unindexed: string[] = [];

  for (const filePath of allMarkdownFiles) {
    const normalized = path.normalize(filePath);
    const relative = path.relative(root, normalized).replace(/\\/g, "/");

    // Skip index files themselves
    if (path.basename(filePath).toLowerCase() === "readme.md") {
      continue;
    }

    // Exclude auto-generated TypeDoc files in docs/reference/api/
    if (
      relative.startsWith("docs/reference/api/") ||
      relative.includes("/reference/api/")
    ) {
      continue;
    }

    // Agent tooling documentation living outside Diátaxis quadrants (governed by AGENTS.md)
    if (
      relative.startsWith("docs/agents/") &&
      !relative.startsWith("docs/agents/invariants/")
    ) {
      continue;
    }

    // Internal agent invariant documents in docs/agents/invariants/ covered by local directory index files
    if (
      relative.startsWith("docs/agents/invariants/") ||
      relative.includes("/agents/invariants/")
    ) {
      if (indexedPaths.has(normalized)) {
        continue;
      }
    }

    if (!indexedPaths.has(normalized)) {
      unindexed.push(relative);
    }
  }

  const details: string[] = [
    ...failures,
    ...unindexed.map(
      (f) =>
        `Unindexed markdown file: ${f}. Missing inbound link from docs/README.md or quadrant index.`
    ),
  ];

  if (details.length > 0) {
    const messages: string[] = [];
    if (unindexed.length > 0) {
      messages.push(
        `Unindexed documentation files detected (${unindexed.length} file(s))`
      );
    }
    if (failures.length > 0) {
      messages.push(
        `Documentation index check errors encountered (${failures.length} error(s))`
      );
    }
    return {
      id: "docs-index-parity",
      name: "Documentation Index Parity",
      category: "docs",
      status: "fail",
      message: `${messages.join(". ")}. Add inbound links in docs/README.md or quadrant index files.`,
      details,
      fixable: false,
    };
  }

  return {
    id: "docs-index-parity",
    name: "Documentation Index Parity",
    category: "docs",
    status: "pass",
    message:
      "All documentation guides are indexed in root or quadrant navigation.",
  };
}
