import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  STANDARDS_BOM_SPECS,
  compareVersions,
  standardsBillOfMaterials,
  type StandardFeed,
} from "../lib/clinical-standards";

/**
 * The standards watch (#2992 step 5): reads the newest version of every
 * standard, terminology package and tool in the standards bill of materials
 * from where CDISC and NCI EVS publish them, and records it in
 * `lib/clinical-standards/standards-latest.json`.
 *
 * `check` validates the committed file offline. `refresh` fetches and
 * rewrites it, writes a Markdown summary of what moved, and exits 1 when a
 * source could not be read, keeping that entry's committed value. It needs
 * no CDISC Library key: every source is public. The weekly workflow
 * `.github/workflows/standards-watch.yml` runs `refresh` and opens a pull
 * request when the file changes. Moving a pin stays a controlled upgrade
 * (ADR 0065); this only keeps the gap on record.
 */

const LATEST_FILE = "lib/clinical-standards/standards-latest.json";

/** The shape of `standards-latest.json`. */
export interface LatestVersions {
  readonly $comment: string;
  readonly standards: Record<string, string>;
  readonly terminology: Record<string, string>;
  readonly tools: Record<string, string>;
}

const COMMENT =
  "Written by scripts/standards-watch.ts refresh: the newest version each source publishes. Do not edit by hand; pins live in profile.ts and bom.ts.";

const VERSION = /^v?\d+(\.\d+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&nbsp;": " ",
  "&#039;": "'",
  "&#39;": "'",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
};

/**
 * The text nodes of an HTML page, trimmed, with spaces collapsed.
 *
 * @param html - The page.
 * @returns Each non-empty text node.
 */
export function textNodes(html: string): string[] {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .split(/<[^>]*>/)
    .map((t) =>
      t
        .replace(/&[#\w]+;/g, (e) => ENTITIES[e] ?? e)
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
}

/**
 * The highest version a cdisc.org standard page lists under any of the
 * labels, where a release appears as a text node such as `SDTMIG v3.4`.
 *
 * @param html - The standard's page.
 * @param labels - The exact text before ` v`.
 * @returns The version without its `v`, or undefined when none is listed.
 */
export function siteVersion(
  html: string,
  labels: readonly string[]
): string | undefined {
  const found = textNodes(html).flatMap((node) =>
    labels.flatMap((label) => {
      if (!node.startsWith(`${label} v`)) return [];
      const version = node.slice(label.length + 2);
      return /^\d+(\.\d+)*$/.test(version) ? [version] : [];
    })
  );
  return found.sort(compareVersions).at(-1);
}

/**
 * The highest release tag in `git ls-remote --tags --refs` output, counting
 * only `vX.Y.Z` tags.
 *
 * @param refs - The command's output.
 * @returns The tag without its `v`, or undefined when there is none.
 */
export function latestReleaseTag(refs: string): string | undefined {
  return refs
    .split("\n")
    .map((line) => line.split(/\s+/)[1]?.replace("refs/tags/", "") ?? "")
    .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag))
    .sort(compareVersions)
    .at(-1)
    ?.slice(1);
}

/**
 * The release date an NCI EVS CDISC terminology ODM-XML declares.
 *
 * @param xml - At least the start of the file, through the `ODM` element.
 * @returns The `YYYY-MM-DD` date, or undefined when none is declared.
 */
export function evsReleaseDate(xml: string): string | undefined {
  return xml.match(/SourceSystemVersion="(\d{4}-\d{2}-\d{2})"/)?.[1];
}

/**
 * The keys the file must hold: one per standard, package and tool in the
 * bill of materials.
 *
 * @returns The expected keys of each section.
 */
function expectedKeys() {
  const bom = standardsBillOfMaterials();
  return {
    standards: bom.standards.map((s) => s.standard as string),
    terminology: bom.terminology.map((t) => t.package as string),
    tools: bom.tools.map((t) => t.id as string),
  };
}

/**
 * Problems with a `standards-latest.json`: a missing or extra entry, or a
 * value that is not a version or date.
 *
 * @param latest - The parsed file.
 * @returns One line per problem; empty when the file is valid.
 */
export function validateLatest(latest: LatestVersions): string[] {
  const problems: string[] = [];
  const expected = expectedKeys();
  for (const section of ["standards", "terminology", "tools"] as const) {
    const actual = Object.keys(latest[section] ?? {});
    for (const key of expected[section]) {
      if (!actual.includes(key)) problems.push(`${section}.${key} is missing`);
    }
    for (const key of actual) {
      if (!expected[section].includes(key)) {
        problems.push(`${section}.${key} is not in the bill of materials`);
      }
      const value = latest[section][key];
      const ok = section === "terminology" ? DATE : VERSION;
      if (!ok.test(value)) {
        problems.push(
          `${section}.${key} = ${JSON.stringify(value)} is not valid`
        );
      }
    }
  }
  return problems;
}

/**
 * The file's text, keys in bill-of-materials order, so a refresh that finds
 * nothing new leaves it byte-identical.
 *
 * @param latest - The versions.
 * @returns The JSON text with a trailing newline.
 */
export function serializeLatest(latest: Omit<LatestVersions, "$comment">) {
  const expected = expectedKeys();
  const pick = (section: keyof typeof expected) =>
    Object.fromEntries(
      expected[section].map((key) => [key, latest[section][key]])
    );
  return `${JSON.stringify(
    {
      $comment: COMMENT,
      standards: pick("standards"),
      terminology: pick("terminology"),
      tools: pick("tools"),
    },
    null,
    2
  )}\n`;
}

/** One entry the refresh changed. */
export interface LatestChange {
  readonly key: string;
  readonly from: string;
  readonly to: string;
}

/**
 * The entries whose newest version differs between two files.
 *
 * @param before - The committed file.
 * @param after - The refreshed one.
 * @returns Each changed entry as `section.key`.
 */
export function diffLatest(
  before: Omit<LatestVersions, "$comment">,
  after: Omit<LatestVersions, "$comment">
): LatestChange[] {
  return (["standards", "terminology", "tools"] as const).flatMap((section) =>
    Object.keys(after[section])
      .filter((key) => before[section][key] !== after[section][key])
      .map((key) => ({
        key: `${section}.${key}`,
        from: before[section][key] ?? "(none)",
        to: after[section][key],
      }))
  );
}

/**
 * The Markdown the workflow posts as the pull request body and job summary.
 *
 * @param changes - What moved.
 * @param failures - Sources that could not be read.
 * @param latest - The refreshed versions, to list the pins they leave behind.
 * @returns The summary.
 */
export function summarize(
  changes: readonly LatestChange[],
  failures: readonly string[],
  latest: Omit<LatestVersions, "$comment">
): string {
  const lines = ["## Standards watch", ""];
  if (changes.length === 0) {
    lines.push(
      "Nothing CDISC or NCI EVS publishes has moved since the last refresh."
    );
  } else {
    lines.push(
      "A source published a newer version. This records it; it changes no pin.",
      "",
      "| Entry | Recorded | Now published |",
      "| --- | --- | --- |",
      ...changes.map((c) => `| ${c.key} | ${c.from} | ${c.to} |`)
    );
  }
  if (failures.length > 0) {
    lines.push("", "### Sources that could not be read", "");
    lines.push(...failures.map((f) => `- ${f}`));
  }
  const behind = standardsBillOfMaterials(latest);
  const pending = [
    ...behind.standards
      .filter((s) => s.status === "upgrade-available")
      .map((s) => `${s.standard} ${s.pinned} (published ${s.published})`),
    ...behind.terminology
      .filter((t) => t.status === "upgrade-available")
      .map((t) => `${t.package} CT ${t.pinned} (published ${t.published})`),
    ...behind.tools
      .filter((t) => t.status === "upgrade-available")
      .map((t) => `${t.name} ${t.pinned} (published ${t.published})`),
  ];
  if (pending.length > 0) {
    lines.push(
      "",
      "### Pins with an upgrade available",
      "",
      ...pending.map((p) => `- ${p}`),
      "",
      "Moving a pin is a controlled upgrade with an impact report (ADR 0065), made in its own pull request."
    );
  }
  return `${lines.join("\n")}\n`;
}

/** Reads a feed's newest version. Network access, so not unit-tested. */
async function readFeed(feed: StandardFeed): Promise<string> {
  if (feed.kind === "git-tags") {
    const refs = execFileSync(
      "git",
      ["ls-remote", "--tags", "--refs", `${feed.repository}.git`],
      { encoding: "utf8", timeout: 60_000 }
    );
    const tag = latestReleaseTag(refs);
    if (!tag) throw new Error(`no vX.Y.Z tag in ${feed.repository}`);
    return tag;
  }
  const response = await fetch(feed.page, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${feed.page} returned ${response.status}`);
  const version = siteVersion(await response.text(), feed.labels);
  if (!version) {
    throw new Error(`${feed.page} lists no "${feed.labels.join('" or "')} vX"`);
  }
  return version;
}

async function readEvs(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Range: "bytes=0-4095" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  const date = evsReleaseDate(await response.text());
  if (!date) throw new Error(`${url} declares no SourceSystemVersion`);
  return date;
}

async function refresh(
  committed: LatestVersions
): Promise<{ next: Omit<LatestVersions, "$comment">; failures: string[] }> {
  const failures: string[] = [];
  const next = {
    standards: { ...committed.standards },
    terminology: { ...committed.terminology },
    tools: { ...committed.tools },
  };
  const attempt = async (
    label: string,
    read: () => Promise<string>,
    write: (value: string) => void
  ) => {
    try {
      write(await read());
    } catch (error) {
      failures.push(
        `${label}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
  const bom = standardsBillOfMaterials();
  for (const spec of STANDARDS_BOM_SPECS) {
    await attempt(
      spec.standard,
      () => readFeed(spec.feed),
      (v) => {
        next.standards[spec.standard] = v;
      }
    );
  }
  for (const pkg of bom.terminology) {
    await attempt(
      `${pkg.package} CT`,
      () => readEvs(pkg.feed),
      (v) => {
        next.terminology[pkg.package] = v;
      }
    );
  }
  for (const tool of bom.tools) {
    await attempt(
      tool.name,
      () => readFeed(tool.feed),
      (v) => {
        next.tools[tool.id] = `v${v}`;
      }
    );
  }
  return { next, failures };
}

async function main(argv: readonly string[]): Promise<number> {
  const [command, ...rest] = argv;
  const summaryIndex = rest.indexOf("--summary");
  const summaryFile = summaryIndex >= 0 ? rest[summaryIndex + 1] : undefined;
  if (command !== "check" && command !== "refresh") {
    console.error(
      "Usage: tsx scripts/standards-watch.ts check | refresh [--summary <file>]"
    );
    return 2;
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const file = path.join(root, LATEST_FILE);
  const text = fs.readFileSync(file, "utf8");
  const committed = JSON.parse(text) as LatestVersions;
  const problems = validateLatest(committed);
  if (command === "check") {
    if (text !== serializeLatest(committed)) {
      problems.push("the file is not in its canonical form");
    }
    for (const p of problems) console.error(`${LATEST_FILE}: ${p}`);
    if (problems.length === 0) console.log(`${LATEST_FILE} is valid.`);
    return problems.length === 0 ? 0 : 1;
  }
  const { next, failures } = await refresh(committed);
  const nextProblems = validateLatest({ $comment: COMMENT, ...next });
  if (nextProblems.length > 0) {
    for (const p of nextProblems) console.error(`refresh: ${p}`);
    return 1;
  }
  fs.writeFileSync(file, serializeLatest(next));
  const summary = summarize(diffLatest(committed, next), failures, next);
  if (summaryFile) fs.writeFileSync(summaryFile, summary);
  console.log(summary);
  return failures.length === 0 ? 0 : 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  );
}
