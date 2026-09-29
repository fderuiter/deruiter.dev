"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Card, CardTitle, type HeadingTag } from "@/components/BentoGrid";
import { type ExtendedRichInlineItem } from "@/hooks/usePretextLayout";
import { BaseCaseStudy } from "@/types/domain";
import {
  GitHubStats,
  getSimulatedTerminalCommand,
  getSimulatedTerminalLogs,
} from "@/lib/github";
import {
  IconStar,
  IconGitFork,
  IconAlertCircle,
  IconTerminal,
  IconChevronRight,
} from "@tabler/icons-react";
import { type RichInlineLine } from "@chenglou/pretext/rich-inline";
import Link from "next/link";
import { CommitSparkline } from "@/components/CommitSparkline";
import { useBentoLayout } from "@/components/providers/BentoLayoutContext";
import { useTerminology } from "@/components/providers/TerminologyProvider";
import { compileTerms } from "@/lib/term-compiler";
import { parsePretextBlocks } from "@/lib/pretext-block-parser";

const REALITY_CONTENT: Record<string, string> = {
  schemaflow:
    "While the drag-and-drop canvas is extremely smooth, we initially faced major rendering bottlenecks when rendering over 150 schema nodes. We had to implement node occlusion culling and state debouncing to maintain 60 FPS, and cyclical dependency detection still requires optimized Web Worker postMessage parsing.",
  "clinical-data-mapper":
    "Handling 2GB+ XML structures in Node.js was a memory nightmare. Even with SAX streaming, V8 garbage collection spikes caused transient API container restarts in production. We had to tune Kubernetes memory limits and implement chunked database transaction commits to stabilize the service under heavy load.",
  "imednet-python-sdk":
    "The platform SOAP endpoints are notoriously flaky and poorly documented. We spent over 80 hours reverse-engineering session token validation schemas. Retries are frequent, and TLS handshake timeouts on legacy endpoints require an aggressive connection pooling and cache synchronization strategy.",
  "cadence-clinical":
    "Building a unified eCRF orchestrator sounds elegant until clinical trial coordinators attempt to create dynamic conditional logic trees with 40 circular dependencies. We had to write a custom DAG resolution engine and aggressive client-side form debouncing to keep the UI from lagging during 50-field visits.",
  "wedding-website":
    "Building a bespoke event portal for your own wedding is the ultimate high-stakes deployment. Zero downtime tolerance when 150 relatives try to RSVP at once, and debugging custom Framer Motion spring physics on aunties' 7-year-old iPads at midnight before the rehearsal dinner was a character-building experience.",
  "hono-kiln":
    "Building an edge-native multi-tenant runtime requires intense discipline around dynamic imports and driver abstractions. We initially experienced subtle connection pool exhaustion during peak serverless burst traffic, which we resolved by implementing HTTP-based Neon database connection pooling and contextual tenant repository proxies.",
  "inbody-qr-decoder":
    "Reverse-engineering proprietary ASCII payloads without official documentation required building an automated fuzzing oracle. Probing production web services with mutated byte slices triggered aggressive rate limits and occasional session token invalidation, requiring us to implement a multi-stage session warmup loop and static offset caching to achieve sub-millisecond execution times.",
  ualbf:
    "Synchronizing Rust multi-threaded DFS tree search with Lean 4 formal verification required strict deterministic FFI serialization. Initial cross-language memory overhead caused GC pauses in Lean 4 during 10M+ certificate streams, resolved by introducing fixed-size binary manifests and bounded C shims.",
  "sonos-network-controller":
    "Bypassing official cloud APIs requires handling inconsistent XML namespaces and escaped DIDL-Lite metadata blocks returned inside SOAP body payloads across varying Sonos firmware versions. Un-memoized SSDP multicast queries caused UDP socket exhaustion on congested local networks, resolved by implementing a 10-second TTL memoization cache.",
  clintrials:
    "Executing multi-arm stochastic Monte Carlo loops directly inside Pyodide Web Workers eliminates server infrastructure costs, but browser memory constraints and Web Worker serialization overhead required custom memory buffers and deterministic seed synchronization to maintain parity with CPython.",
  "equipose-randomization":
    "Enforcing identical bitwise MT19937 seed parity across Python, R, SAS, and Stata required overcoming zero- versus one-indexed array seed mapping differences and floating-point rounding variations across statistical runtimes.",
  "lambda-wave":
    "Combining Haskell's garbage-collected runtime with sub-10ms hard real-time medical device constraints required strict allocation control. We eliminated GC pauses in the raw data ingestion path by implementing C++ lock-free ring buffers over FFI, while automated struct alignment tests verified zero memory padding mismatches across language boundaries.",
};

export const getRealityContent = (slug: string, originalContent: string) => {
  return (
    REALITY_CONTENT[slug] ||
    `Reality Check: ${originalContent} (Dynamic verification and performance testing in live staging revealed minor scaling limits under concurrent loads).`
  );
};

function unescapeEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseInlineNodes(
  input: string,
  simplified: boolean,
  depth = 0
): React.ReactNode[] {
  if (!input) return [];
  if (depth > 5) return [unescapeEntities(input)];

  // Order of matching:
  // 1. Terminology tags: <span ...>...</span> or <abbr ...>...</abbr> or any tag with data-key/data-term/data-definition
  // 2. Bold: **...**
  // 3. Code: `...`
  // 4. Italic: *...*
  const combinedRegex =
    /<(span|abbr)\b([^>]*)>([\s\S]*?)<\/\1>|<([a-z0-9]+)\b([^>]*(?:data-key|data-term|data-definition)[^>]*)>([\s\S]*?)<\/\4>|(\*\*[\s\S]*?\*\*)|(`[^`\n]+`)|(\*[^\*\n]+\*)/gi;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combinedRegex.exec(input)) !== null) {
    const matchIndex = match.index;

    // Plain text before match
    if (matchIndex > lastIndex) {
      const textChunk = unescapeEntities(
        input.slice(lastIndex, matchIndex).replace(/<[^>]+>/g, "")
      );
      if (textChunk) {
        nodes.push(<span key={`text-${lastIndex}`}>{textChunk}</span>);
      }
    }

    // Check if it's a tag match (Match groups 1..6)
    if (match[1] || match[4]) {
      const rawAttrs = match[2] || match[5] || "";
      const innerContent = match[3] || match[6] || "";

      const termMatch = /data-term=["']([^"']*)["']/i.exec(rawAttrs);
      const keyMatch = /data-key=["']([^"']*)["']/i.exec(rawAttrs);

      const termVal = termMatch ? termMatch[1] : "";
      const hasTermVal = Boolean(termVal && termVal.trim());

      let textToDisplay = innerContent;
      if (simplified && hasTermVal) {
        textToDisplay = termVal;
      }

      const keyVal = keyMatch ? keyMatch[1] : `term-${matchIndex}`;
      const unescapedDisplay = unescapeEntities(textToDisplay);

      const children = parseInlineNodes(
        unescapedDisplay,
        simplified,
        depth + 1
      );

      nodes.push(
        <React.Fragment key={`term-${keyVal}-${matchIndex}`}>
          {children.length > 0 ? children : unescapedDisplay}
        </React.Fragment>
      );
    } else if (match[7]) {
      // Bold: **...**
      const rawBold = match[7];
      const boldContent = rawBold.slice(2, -2);
      const children = parseInlineNodes(boldContent, simplified, depth + 1);

      nodes.push(
        <strong
          key={`bold-${matchIndex}`}
          className="font-bold text-neutral-100"
        >
          {children.length > 0 ? children : unescapeEntities(boldContent)}
        </strong>
      );
    } else if (match[8]) {
      // Code: `...`
      const rawCode = match[8];
      const codeContent = rawCode.slice(1, -1);
      const cleanCode = codeContent.replace(/<[^>]+>/g, "");

      nodes.push(
        <code
          key={`code-${matchIndex}`}
          className="px-1.5 py-0.5 mx-0.5 text-[11px] font-mono font-bold bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan rounded-md inline-block shadow-[0_0_10px_rgba(6,182,212,0.05)] align-baseline leading-none"
        >
          {unescapeEntities(cleanCode)}
        </code>
      );
    } else if (match[9]) {
      // Italic: *...*
      const rawItalic = match[9];
      const italicContent = rawItalic.slice(1, -1);
      const children = parseInlineNodes(italicContent, simplified, depth + 1);

      nodes.push(
        <em key={`italic-${matchIndex}`} className="italic text-zinc-300">
          {children.length > 0 ? children : unescapeEntities(italicContent)}
        </em>
      );
    }

    lastIndex = combinedRegex.lastIndex;
  }

  // Trailing text
  if (lastIndex < input.length) {
    const trailingChunk = unescapeEntities(
      input.slice(lastIndex).replace(/<[^>]+>/g, "")
    );
    if (trailingChunk) {
      nodes.push(<span key={`text-${lastIndex}`}>{trailingChunk}</span>);
    }
  }

  return nodes;
}

/* jscpd:ignore-start */
const FormattedMarkdownText: React.FC<{ text: string; className?: string }> = ({
  text,
  className,
}) => {
  const { simplified } = useTerminology();

  const blocks = React.useMemo(() => {
    return parsePretextBlocks(compileTerms(text || ""));
  }, [text]);

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, bIdx) => {
        if (block.type === "log") {
          return (
            <div
              key={bIdx}
              className="my-1.5 p-2 bg-black/80 border border-zinc-800/80 rounded-lg font-mono text-[11px] leading-[18px] text-zinc-300 overflow-x-auto select-text"
            >
              {block.lines.map((line, lIdx) => {
                let lineStyle = "text-zinc-300";
                if (/\[\s*ERROR\s*\]|ERROR:|FATAL/i.test(line)) {
                  lineStyle =
                    "text-rose-400 font-bold bg-rose-500/10 -mx-2 px-2 rounded-sm";
                } else if (/\[\s*WARN\s*\]|WARN:/i.test(line)) {
                  lineStyle = "text-amber-300 font-semibold";
                } else if (/\[\s*INFO\s*\]|INFO:/i.test(line)) {
                  lineStyle = "text-cyan-300";
                } else if (/\[\s*DEBUG\s*\]|DEBUG:/i.test(line)) {
                  lineStyle = "text-zinc-500";
                }
                return (
                  <div
                    key={lIdx}
                    className={cn("whitespace-pre-wrap break-words", lineStyle)}
                  >
                    {line}
                  </div>
                );
              })}
            </div>
          );
        }

        if (block.type === "diff") {
          return (
            <div
              key={bIdx}
              className="my-1.5 p-2 bg-black/80 border border-zinc-800/80 rounded-lg font-mono text-[11px] leading-[18px] overflow-x-auto select-text"
            >
              {block.lines.map((line, lIdx) => {
                let lineStyle = "text-zinc-300";
                if (line.startsWith("+")) {
                  lineStyle =
                    "text-emerald-400 font-semibold bg-emerald-500/10 -mx-2 px-2 rounded-sm";
                } else if (line.startsWith("-")) {
                  lineStyle =
                    "text-rose-400 font-semibold bg-rose-500/10 -mx-2 px-2 rounded-sm";
                } else if (
                  line.startsWith("@@") ||
                  line.startsWith("***") ||
                  line.startsWith("---") ||
                  line.startsWith("+++")
                ) {
                  lineStyle = "text-brand-cyan font-bold";
                }
                return (
                  <div
                    key={lIdx}
                    className={cn("whitespace-pre-wrap break-words", lineStyle)}
                  >
                    {line}
                  </div>
                );
              })}
            </div>
          );
        }

        if (block.type === "code") {
          return (
            <div
              key={bIdx}
              className="my-1.5 p-2 bg-black/80 border border-zinc-800/80 rounded-lg font-mono text-[11px] leading-[18px] text-brand-cyan/90 overflow-x-auto select-text"
            >
              {block.language && block.language !== "code" && (
                <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1 border-b border-zinc-800/60 pb-0.5">
                  {block.language}
                </div>
              )}
              {block.lines.map((line, lIdx) => (
                <div key={lIdx} className="whitespace-pre-wrap break-words">
                  {line || "\u00A0"}
                </div>
              ))}
            </div>
          );
/* jscpd:ignore-end */
        }

        const nodes = parseInlineNodes(block.raw, simplified);
        return (
          <p key={bIdx} className={className}>
            {nodes}
          </p>
        );
      })}
    </div>
  );
};

interface CaseStudyBentoCardProps {
  study: BaseCaseStudy & { githubStats: GitHubStats | null };
  className?: string;
  preCalculatedHeight?: number;
  preCalculatedRealityHeight?: number;
  preCalculatedParagraphsLines?: RichInlineLine[][];
  preCalculatedParagraphsItems?: ExtendedRichInlineItem[][];
  headingTag?: HeadingTag | string;
}

// Map common languages to premium styling colors
const LANGUAGE_COLORS: Record<
  string,
  { bg: string; text: string; hex: string }
> = {
  TypeScript: { bg: "bg-blue-500/10", text: "text-blue-400", hex: "#3178c6" },
  JavaScript: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    hex: "#f1e05a",
  },
  Python: { bg: "bg-emerald-500/10", text: "text-emerald-400", hex: "#3572a5" },
  Rust: { bg: "bg-amber-500/10", text: "text-amber-400", hex: "#dea584" },
  Haskell: { bg: "bg-indigo-500/10", text: "text-indigo-400", hex: "#5e5086" },
  CSS: { bg: "bg-purple-500/10", text: "text-purple-400", hex: "#563d7c" },
  HTML: { bg: "bg-orange-500/10", text: "text-orange-400", hex: "#e34c26" },
  React: { bg: "bg-cyan-500/10", text: "text-cyan-400", hex: "#06b6d4" },
};

const DEFAULT_COLOR = {
  bg: "bg-zinc-500/10",
  text: "text-zinc-400",
  hex: "#8b949e",
};

export const CaseStudyBentoCard: React.FC<CaseStudyBentoCardProps> = ({
  study,
  className,
  preCalculatedHeight,
  preCalculatedRealityHeight,
  headingTag,
}) => {
  const { githubStats } = study;
  const tagsList = study.tags ? study.tags.split(",").map((t) => t.trim()) : [];
  const langColor = LANGUAGE_COLORS[study.primary_language] || DEFAULT_COLOR;

  const {
    heightOverrides,
    registerHeightOverride,
    clearHeightOverride,
    setTransitioning,
  } = useBentoLayout();
  const [mode, setMode] = React.useState<"pitch" | "reality">("pitch");

  const effectiveRealityHeight =
    preCalculatedRealityHeight ||
    (study as unknown as { preCalculatedRealityHeight?: number })
      .preCalculatedRealityHeight;

  const handleToggleMode = (newMode: "pitch" | "reality") => {
    if (newMode === mode) return;

    setTransitioning(study.id, true);
    setMode(newMode);

    if (newMode === "pitch") {
      clearHeightOverride(study.id);
    } else if (effectiveRealityHeight) {
      registerHeightOverride(study.id, effectiveRealityHeight);
    }

    setTimeout(() => {
      setTransitioning(study.id, false);
    }, 400);
  };

  const innerRef = React.useRef<HTMLDivElement>(null);

  const cardHeightValue =
    heightOverrides[study.id] !== undefined
      ? heightOverrides[study.id]
      : preCalculatedHeight;

  return (
    <Card
      className={cn(
        "min-h-[var(--bento-card-height)] h-auto transition-[height,min-height] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]",
        className
      )}
      style={
        {
          "--bento-card-height": cardHeightValue
            ? `${cardHeightValue}px`
            : "auto",
        } as React.CSSProperties
      }
    >
      <div
        ref={innerRef}
        className="flex flex-col h-full justify-between gap-3 flex-1 min-h-0"
      >
        <div>
          {/* Card Top Pill & Header */}
          <div className="flex justify-between items-center mb-2.5">
            <span
              className={`px-2.5 py-0.5 text-[10px] font-mono font-bold border border-current/10 rounded-md ${langColor.bg} ${langColor.text}`}
            >
              {study.primary_language}
            </span>
            <span
              className="text-[10px] font-mono text-zinc-400 truncate max-w-[160px] text-right"
              title={study.slug.toUpperCase()}
            >
              {study.slug.toUpperCase()}
            </span>
          </div>

          <CardTitle
            as={headingTag}
            className="text-base md:text-lg font-extrabold tracking-tight leading-snug mb-2.5"
          >
            {study.title}
          </CardTitle>

          {/* Project Media Asset Image Banner */}
          {study.hero_image_url && (
            <div className="relative w-full h-32 rounded-lg border border-zinc-800 overflow-hidden mb-3 bg-zinc-900 shadow-sm">
              <Image
                src={study.hero_image_url}
                alt={`Validated project media for ${study.title}`}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          )}

          {/* Premium Segmented Mode Switcher */}
          <div className="flex p-0.5 bg-zinc-950/80 border border-zinc-900/80 rounded-lg mb-3 text-xs font-mono relative z-10 w-fit backdrop-blur-sm">
            <button
              onClick={() => handleToggleMode("pitch")}
              className={`min-h-[44px] px-3.5 py-1.5 rounded-md border text-[11px] font-bold transition-all duration-200 cursor-pointer flex items-center justify-center ${
                mode === "pitch"
                  ? "bg-zinc-900 text-brand-cyan border-brand-cyan/30 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              THE PITCH
            </button>
            <button
              onClick={() => handleToggleMode("reality")}
              className={`min-h-[44px] px-3.5 py-1.5 rounded-md border text-[11px] font-bold transition-all duration-200 cursor-pointer flex items-center justify-center ${
                mode === "reality"
                  ? "bg-zinc-900 text-brand-cyan border-brand-cyan/30 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              THE REALITY
            </button>
          </div>

          {/* Description Block using Semantic Formatted Markdown */}
          <div className="mb-3">
            {mode === "pitch" ? (
              <FormattedMarkdownText
                text={study.editorial_content}
                className="text-zinc-400 text-xs md:text-sm leading-relaxed font-sans"
              />
            ) : (
              <FormattedMarkdownText
                text={getRealityContent(study.slug, study.editorial_content)}
                className="text-zinc-400 text-xs md:text-sm leading-relaxed font-sans"
              />
            )}
          </div>

          {/* Dynamic GitHub Statistics Hydration */}
          {githubStats && (
            <div className="space-y-3 mb-3 border-t border-zinc-900/60 pt-3">
              {/* Glowing SVG Commit Timeline Sparkline */}
              <CommitSparkline
                activity={githubStats.commitActivity}
                provenance={githubStats.provenance}
                className="mb-1"
              />

              {/* Refined Inline Badges Row */}
              <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 border-b border-zinc-900/60 pb-2.5 mb-1 gap-1 min-w-0">
                <span className="flex items-center gap-1 min-w-0 shrink">
                  <IconStar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-zinc-300 font-bold truncate">
                    {githubStats.stars.toLocaleString()}
                  </span>{" "}
                  <span className="truncate">STARS</span>
                </span>
                <span className="flex items-center gap-1 min-w-0 shrink">
                  <IconGitFork className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="text-zinc-300 font-bold truncate">
                    {githubStats.forks.toLocaleString()}
                  </span>{" "}
                  <span className="truncate">FORKS</span>
                </span>
                <span className="flex items-center gap-1 min-w-0 shrink">
                  <IconAlertCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-zinc-300 font-bold truncate">
                    {githubStats.openIssues.toLocaleString()}
                  </span>{" "}
                  <span className="truncate">ISSUES</span>
                </span>
              </div>

              {/* Language Percentage Bar */}
              {githubStats.languages.length > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                    <span>LANGUAGE STACK</span>
                    <span className="text-zinc-400">
                      {githubStats.languages[0]?.name}{" "}
                      {githubStats.languages[0]?.percentage}%
                    </span>
                  </div>
                  {/* Aggregated distribution bar */}
                  <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden flex">
                    {githubStats.languages.map((lang, idx) => {
                      const color = LANGUAGE_COLORS[lang.name] || DEFAULT_COLOR;
                      return (
                        <div
                          key={idx}
                          style={{
                            width: `${lang.percentage}%`,
                            backgroundColor: color.hex,
                          }}
                          className="h-full transition-all"
                          title={`${lang.name}: ${lang.percentage}%`}
                        />
                      );
                    })}
                  </div>
                  {/* Legend list */}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] font-mono text-zinc-400">
                    {githubStats.languages.slice(0, 3).map((lang, idx) => {
                      const color = LANGUAGE_COLORS[lang.name] || DEFAULT_COLOR;
                      return (
                        <span key={idx} className="flex items-center">
                          <span
                            className="w-1.5 h-1.5 rounded-full mr-1.5"
                            style={{ backgroundColor: color.hex }}
                          />
                          {lang.name} ({lang.percentage}%)
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Monospace terminal logs commits feed */}
              <div className="bg-black/60 border border-zinc-900/60 rounded-xl p-2.5 font-mono text-[9.5px] leading-tight space-y-1 min-h-[115px] h-auto flex flex-col justify-start overflow-hidden">
                <div className="flex items-center text-zinc-400 border-b border-zinc-900/60 pb-1 mb-1">
                  <IconTerminal className="w-3.5 h-3.5 mr-1 text-zinc-400 shrink-0" />
                  <span className="truncate">
                    {study.simulated_telemetry
                      ? getSimulatedTerminalCommand(study.primary_language)
                      : "git log --oneline -n 5"}
                  </span>
                </div>
                <div className="flex-1 flex flex-col justify-start space-y-1 overflow-y-auto overscroll-contain scrollbar-none text-zinc-400">
                  {study.simulated_telemetry ? (
                    getSimulatedTerminalLogs(study.primary_language).map(
                      (log, i) => (
                        <div
                          key={i}
                          className="truncate flex items-start gap-1"
                        >
                          <span className={log.color || "text-zinc-300"}>
                            {log.text}
                          </span>
                        </div>
                      )
                    )
                  ) : githubStats.recentCommits.length > 0 ? (
                    githubStats.recentCommits.map((c, i) => (
                      <div key={i} className="truncate flex items-start gap-1">
                        <span className="text-brand-cyan select-none shrink-0">
                          {c.sha}
                        </span>
                        <span className="text-zinc-500 select-none shrink-0">
                          |
                        </span>
                        <span
                          className="text-zinc-300 truncate"
                          title={c.message}
                        >
                          {c.message}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-zinc-400 italic">
                      No recent commits located.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tags list (only when no stats are rendered to save visual space, or inline) */}
          {!githubStats && (
            <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
              {tagsList.slice(0, 4).map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 text-[10px] font-mono bg-zinc-900/60 border border-zinc-800 text-zinc-400 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer analyze link with 44px+ tap target */}
        <div className="flex justify-between items-center border-t border-zinc-900/40 pt-1.5 mt-1">
          <Link
            href={`/case-studies/${study.slug}`}
            className="group inline-flex items-center min-h-[44px] py-2 text-xs font-bold text-brand-cyan/80 hover:text-brand-cyan transition-colors duration-300 cursor-pointer relative z-10"
          >
            <span>Analyze Architecture</span>
            <IconChevronRight className="ml-1 w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-200" />
          </Link>
        </div>
      </div>
    </Card>
  );
};
