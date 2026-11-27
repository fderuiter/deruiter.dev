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
  "worktrees",
  ".scratch",
  "scratch",
  "tmp",
  "test-results",
]);

const INLINE_LINK_PATTERN = /\[[^\]]*\]\(([^)]+)\)/g;

function collectMarkdownFiles(
  targetPath: string,
  workspaceRoot: string | undefined,
  ancestors: ReadonlySet<string>
): string[] {
  const resolvedPath =
    workspaceRoot && !path.isAbsolute(targetPath)
      ? path.resolve(workspaceRoot, targetPath)
      : path.resolve(targetPath);

  if (!fs.existsSync(resolvedPath)) return [];

  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolvedPath);
  } catch {
    return [];
  }

  if (stat.isFile()) {
    const lowerName = resolvedPath.toLowerCase();
    return lowerName.endsWith(".md") || lowerName.endsWith(".markdown")
      ? [resolvedPath]
      : [];
  }

  if (stat.isDirectory()) {
    if (SKIP_DIRECTORY_NAMES.has(path.basename(resolvedPath))) return [];

    let realDir: string;
    try {
      realDir = fs.realpathSync(resolvedPath);
    } catch {
      return [];
    }
    if (ancestors.has(realDir)) return [];

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(realDir);

    return fs
      .readdirSync(resolvedPath, { withFileTypes: true })
      .flatMap((entry) => {
        const absolutePath = path.join(resolvedPath, entry.name);
        let isDirectory = entry.isDirectory();
        let isFile = entry.isFile();

        if (entry.isSymbolicLink()) {
          try {
            const targetStat = fs.statSync(absolutePath);
            isDirectory = targetStat.isDirectory();
            isFile = targetStat.isFile();
          } catch {
            return [];
          }
        }

        if (isDirectory) {
          return SKIP_DIRECTORY_NAMES.has(entry.name)
            ? []
            : collectMarkdownFiles(absolutePath, workspaceRoot, nextAncestors);
        }

        if (isFile) {
          const lowerName = entry.name.toLowerCase();
          return lowerName.endsWith(".md") || lowerName.endsWith(".markdown")
            ? [absolutePath]
            : [];
        }

        return [];
      });
  }

  return [];
}

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
      collectMarkdownFiles(tp, workspaceRoot, new Set())
    );
    return Array.from(new Set(allFiles));
  }

  return collectMarkdownFiles(targetPath, workspaceRoot, new Set());
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

  // docs/, adr/, and tracked skill subtrees
  for (const relativeDir of [
    "docs",
    "adr",
    ".agents/skills",
    ".claude/skills",
  ]) {
    const candidateDir = path.join(workspaceRoot, relativeDir);
    if (fs.existsSync(candidateDir)) {
      targets.push(candidateDir);
    }
  }

  return targets;
}

function stripCodeBlocksAndSpans(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const keptLines: string[] = [];
  let activeFenceChar: "`" | "~" | null = null;
  let activeFenceLength = 0;

  for (const line of lines) {
    if (activeFenceChar === null) {
      const openMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (
        openMatch &&
        !(openMatch[1][0] === "`" && openMatch[2].includes("`"))
      ) {
        activeFenceChar = openMatch[1][0] as "`" | "~";
        activeFenceLength = openMatch[1].length;
        keptLines.push("");
        continue;
      }
      keptLines.push(line);
    } else {
      const closePattern = new RegExp(
        `^ {0,3}${activeFenceChar}{${activeFenceLength},}[ \\t]*$`
      );
      if (closePattern.test(line)) {
        activeFenceChar = null;
        activeFenceLength = 0;
      }
    }
  }

  // Code spans can cross soft line breaks, but never a paragraph boundary.
  return keptLines
    .join("\n")
    .split(/(\n[ \t]*\n)/)
    .map((block) => block.replace(/(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g, ""))
    .join("");
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
 * (defaulting to workspace root markdown files, docs/, adr/, .agents/skills/,
 * and .claude/skills/) resolve to real files on disk, so a moved or renamed
 * guide doesn't silently orphan a link.
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
    const content = stripCodeBlocksAndSpans(fs.readFileSync(filePath, "utf-8"));
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
