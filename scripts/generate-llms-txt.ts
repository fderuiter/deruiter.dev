/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTE_METADATA_CONFIGS } from "../lib/seo-metadata";
import { FALLBACK_CASE_STUDIES } from "../lib/case-studies-data";

/**
 * Static generator for the machine-readable manifests `/llms.txt` and
 * `/llms-full.txt` (ADR 0053).
 *
 * Everything is compiled from checked-in sources (route metadata and the
 * bundled case-study text), never from the database, so an AI crawler that
 * fetches either file is served a static asset and cannot wake Neon (ADR 0043).
 * Output is deterministic: no timestamps, and the canonical host is fixed
 * rather than read from the environment.
 */

/** Canonical production origin (AGENTS.md section 18). */
export const LLMS_BASE_URL = "https://deruiter.dev";

const SITE_NAME = "Fred de Ruiter";
const SITE_SUMMARY =
  "Portfolio of Fred de Ruiter, a clinical data engineer. Interactive studios for clinical forms, formal proofs and neuroimaging, a playable arcade, and engineering case studies with architectural write-ups.";

export interface LlmsManifests {
  llms: string;
  full: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

function firstParagraphs(html: string, count: number): string {
  return stripHtml(html)
    .split(/\n\s*\n|\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .slice(0, count)
    .join("\n\n");
}

function routeUrl(routePath: string): string {
  return `${LLMS_BASE_URL}${routePath}`;
}

interface Section {
  heading: string;
  match: (routePath: string) => boolean;
}

const SECTIONS: Section[] = [
  {
    heading: "Systems and studios",
    match: (p) =>
      [
        "/crf",
        "/proof",
        "/simulator",
        "/neuro",
        "/patrol",
        "/stack",
        "/acknowledgments",
      ].includes(p),
  },
  {
    heading: "Arcade",
    match: (p) => p === "/arcade" || p.startsWith("/arcade/") || p === "/merch",
  },
  {
    heading: "Case studies",
    match: (p) =>
      p === "/case-studies" ||
      p.startsWith("/case-studies/") ||
      p === "/work/laser-loon",
  },
  {
    heading: "Writing and contact",
    match: (p) => ["/blog", "/schedule", "/contact"].includes(p),
  },
  {
    heading: "Mobile and utility routes",
    match: () => true,
  },
];

/** Builds both manifests from the checked-in route and case-study sources. */
export function buildLlmsManifests(): LlmsManifests {
  const routes = Object.values(ROUTE_METADATA_CONFIGS)
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path));

  const claimed = new Set<string>();
  const sectionLines: string[] = [];
  for (const section of SECTIONS) {
    const members = routes.filter(
      (route) => !claimed.has(route.path) && section.match(route.path)
    );
    if (members.length === 0) continue;
    sectionLines.push(`## ${section.heading}`, "");
    for (const route of members) {
      claimed.add(route.path);
      sectionLines.push(
        `- [${route.title}](${routeUrl(route.path)}): ${route.description}`
      );
    }
    sectionLines.push("");
  }

  const caseStudies = FALLBACK_CASE_STUDIES.filter((cs) => cs.published)
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const llms = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_SUMMARY}`,
    "",
    `Canonical origin: ${LLMS_BASE_URL}. The full architectural dossier, with case-study abstracts and trade-offs, is at [llms-full.txt](${routeUrl("/llms-full.txt")}).`,
    "",
    ...sectionLines,
    "## Optional",
    "",
    `- [Full dossier](${routeUrl("/llms-full.txt")}): case-study abstracts and architectural narratives`,
    `- [Sitemap](${routeUrl("/sitemap.xml")}): every indexable URL`,
    "",
  ].join("\n");

  const dossier: string[] = [
    `# ${SITE_NAME}: full architectural dossier`,
    "",
    `> ${SITE_SUMMARY}`,
    "",
    `Compiled at build time from checked-in sources. Index: [llms.txt](${routeUrl("/llms.txt")}).`,
    "",
    "## Case studies",
    "",
  ];
  for (const cs of caseStudies) {
    dossier.push(
      `### ${cs.title}`,
      "",
      `URL: ${routeUrl(`/case-studies/${cs.slug}`)}`,
      `Primary language: ${cs.primary_language}`,
      `Source: ${cs.github_url}`,
      "",
      "Abstract:",
      "",
      firstParagraphs(cs.editorial_content, 2),
      "",
      "Architecture and trade-offs:",
      "",
      firstParagraphs(cs.architectural_narrative, 3),
      ""
    );
  }
  dossier.push("## Routes", "", ...sectionLines);

  return { llms, full: dossier.join("\n") };
}

/** Writes both manifests into `<root>/public`. */
export function writeLlmsManifests(workspaceRoot: string): string[] {
  const { llms, full } = buildLlmsManifests();
  const publicDir = path.join(workspaceRoot, "public");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  const targets: Array<[string, string]> = [
    [path.join(publicDir, "llms.txt"), llms],
    [path.join(publicDir, "llms-full.txt"), full],
  ];
  for (const [file, contents] of targets) {
    fs.writeFileSync(file, contents, "utf8");
  }
  return targets.map(([file]) => file);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  for (const file of writeLlmsManifests(process.cwd())) {
    console.log(`Generated ${path.relative(process.cwd(), file)}`);
  }
}
