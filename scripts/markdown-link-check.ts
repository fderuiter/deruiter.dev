import fs from "node:fs";
import path from "node:path";

export interface MarkdownLinkCheckResult {
  status: "pass" | "fail";
  details: string[];
}

// docs/reference/api/** is machine-generated TypeDoc output (ADR 0023):
// its internal cross-links are produced (and kept internally consistent)
// by typedoc-plugin-markdown itself, and staleness there is already caught
// by the generated-vs-checked-in byte comparison in documentation-drift.ts.
// Heavy build folders and non-doc folders are also skipped when scanning directories.
const SKIP_DIRECTORY_NAMES = new Set([
  "reference",
  "node_modules",
  ".next",
  "coverage",
  ".git",
  ".agents",
  "scratch",
  "tmp",
  "test-results",
]);

const INLINE_LINK_PATTERN = /\[[^\]]*\]\(([^)]+)\)/g;

/**
 * Lists markdown files starting from target path(s).
 * Accepts file paths, directory paths, or arrays thereof.
 */
export function listMarkdownFiles(
  targetPath: string | string[],
  workspaceRoot?: string
): string[] {
  if (Array.isArray(targetPath)) {
    const allFiles = targetPath.flatMap((tp) =>
      listMarkdownFiles(tp, workspaceRoot)
    );
    return Array.from(new Set(allFiles));
  }

  const resolvedPath =
    workspaceRoot && !path.isAbsolute(targetPath)
      ? path.resolve(workspaceRoot, targetPath)
      : path.resolve(targetPath);

  if (!fs.existsSync(resolvedPath)) return [];

  const stat = fs.statSync(resolvedPath);
  if (stat.isFile()) {
    const lowerName = resolvedPath.toLowerCase();
    return lowerName.endsWith(".md") || lowerName.endsWith(".markdown")
      ? [resolvedPath]
      : [];
  }

  if (stat.isDirectory()) {
    if (SKIP_DIRECTORY_NAMES.has(path.basename(resolvedPath))) return [];

    return fs
      .readdirSync(resolvedPath, { withFileTypes: true })
      .flatMap((entry) => {
        const absolutePath = path.join(resolvedPath, entry.name);
        if (entry.isDirectory()) {
          return SKIP_DIRECTORY_NAMES.has(entry.name)
            ? []
            : listMarkdownFiles(absolutePath, workspaceRoot);
        }
        const lowerName = entry.name.toLowerCase();
        return lowerName.endsWith(".md") || lowerName.endsWith(".markdown")
          ? [absolutePath]
          : [];
      });
  }

  return [];
}

function getDefaultTargetPaths(workspaceRoot: string): string[] {
  const targets: string[] = [];

  // Top-level workspace root markdown files
  if (fs.existsSync(workspaceRoot)) {
    for (const entry of fs.readdirSync(workspaceRoot, {
      withFileTypes: true,
    })) {
      if (
        entry.isFile() &&
        (entry.name.toLowerCase().endsWith(".md") ||
          entry.name.toLowerCase().endsWith(".markdown"))
      ) {
        targets.push(path.join(workspaceRoot, entry.name));
      }
    }
  }

  // docs/ and adr/ subtrees
  const docsDir = path.join(workspaceRoot, "docs");
  if (fs.existsSync(docsDir)) {
    targets.push(docsDir);
  }

  const adrDir = path.join(workspaceRoot, "adr");
  if (fs.existsSync(adrDir)) {
    targets.push(adrDir);
  }

  return targets;
}

// Any URL scheme (http:, https:, mailto:, etc.), protocol-relative URLs, and
// pure same-page anchors are out of scope for a local file-existence check.
function isCheckableLink(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("#")) return false;
  if (/^[a-z][a-z0-9+.-]*:/iu.test(trimmed)) return false;
  if (trimmed.startsWith("//")) return false;
  return true;
}

function stripFragmentAndQuery(url: string): string {
  return url.split("#")[0].split("?")[0];
}

/**
 * Validates that relative inline markdown links inside configured target paths
 * (defaulting to workspace root markdown files, docs/, and adr/) resolve to
 * real files on disk, so a moved or renamed guide doesn't silently orphan a link.
 */
export function checkMarkdownLinkIntegrity(
  workspaceRoot: string,
  targetPaths?: string | string[]
): MarkdownLinkCheckResult {
  const details: string[] = [];

  const targets =
    targetPaths !== undefined
      ? typeof targetPaths === "string"
        ? [targetPaths]
        : targetPaths
      : getDefaultTargetPaths(workspaceRoot);

  const markdownFiles = listMarkdownFiles(targets, workspaceRoot);

  for (const filePath of markdownFiles) {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const match of content.matchAll(INLINE_LINK_PATTERN)) {
      const rawUrl = match[1].trim();
      if (!isCheckableLink(rawUrl)) continue;

      const cleanUrl = stripFragmentAndQuery(rawUrl);
      if (!cleanUrl) continue;

      const resolvedPath = cleanUrl.startsWith("/")
        ? path.join(workspaceRoot, cleanUrl)
        : path.resolve(path.dirname(filePath), cleanUrl);

      if (!fs.existsSync(resolvedPath)) {
        const relativeFile = path
          .relative(workspaceRoot, filePath)
          .replace(/\\/g, "/");
        details.push(`${relativeFile}: broken link to '${rawUrl}'`);
      }
    }
  }

  return details.length === 0
    ? { status: "pass", details }
    : { status: "fail", details };
}
