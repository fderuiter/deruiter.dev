"use client";

import React from "react";
import { useTerminology } from "@/components/providers/TerminologyProvider";

/**
 * Inline renderer for the light Markdown subset used by `CaseStudy.editorial_content`.
 *
 * `editorial_content` is Markdown (`**bold**`, `` `code` ``), unlike
 * `architectural_narrative`, which is sanitized HTML. Passing the former to an
 * HTML renderer prints the asterisks and backticks literally -- which is what
 * `/case-studies/[slug]` did for every study until this module was extracted.
 *
 * Lives here rather than inside `ProjectTeaserGrid` because it is consumed by
 * both the teaser grid and the case-study detail page. Deliberately depends on
 * nothing in `ProjectTeaserGrid`, so that file can import this one without a
 * cycle (AGENTS.md §21).
 */

/**
 * Synchronously swaps compiled terminology tags for either simplified plain-text definitions
 * or original technical terms, then strips remaining raw HTML tags.
 */
/* jscpd:ignore-start */
export function resolveSnippetTerminology(
  html: string,
  simplified: boolean
): string {
  if (!html) return "";

  const unescapeAttr = (str: string): string => {
    return str
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  };

  const termTagRegex = /<(span|abbr)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

  let resolved = html.replace(
    termTagRegex,
    (fullTag, _tagName, attrs, innerContent) => {
      const isTermTag =
        /data-term=/i.test(attrs) ||
        /data-definition=/i.test(attrs) ||
        /data-key=/i.test(attrs);

      if (!isTermTag) {
        return fullTag;
      }
/* jscpd:ignore-end */

      if (simplified) {
        const termMatch = /data-term=["']([^"']*)["']/i.exec(attrs);
        if (termMatch && termMatch[1]) {
          return unescapeAttr(termMatch[1]);
        }
      }

      return unescapeAttr(innerContent);
    }
  );

  // Strip any remaining or unclosed HTML tags to prevent broken markup in card text
  resolved = resolved.replace(/<[^>]*>/g, "");

  return resolved;
}

interface InlineSnippetPart {
  kind: "text" | "strong" | "code";
  content: string;
}

/**
 * Splits light Markdown into renderable parts.
 *
 * `maxLength` defaults to no truncation. Card surfaces opt in to a budget; the
 * detail page renders the whole field. Defaulting to 240 here, as the previous
 * private copy did, would silently clip a case study's description to a card
 * length on a full-width page.
 */
function createSnippetParts(
  text: string,
  maxLength = Number.POSITIVE_INFINITY
): InlineSnippetPart[] {
  const parts: InlineSnippetPart[] = [];
  const tokenPattern = /(\*\*[^*]+?\*\*|`[^`]+?`)/g;
  let match: RegExpExecArray | null;
  let cursor = 0;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push({ kind: "text", content: text.slice(cursor, match.index) });
    }

    const token = match[0];
    parts.push({
      kind: token.startsWith("**") ? "strong" : "code",
      content: token.startsWith("**") ? token.slice(2, -2) : token.slice(1, -1),
    });
    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    parts.push({ kind: "text", content: text.slice(cursor) });
  }

  let remaining = maxLength;
  const truncatedParts: InlineSnippetPart[] = [];

  for (const part of parts) {
    if (remaining >= part.content.length) {
      truncatedParts.push(part);
      remaining -= part.content.length;
      continue;
    }

    const candidate = part.content.slice(0, remaining);
    const boundary = candidate.lastIndexOf(" ");
    const content = boundary > 0 ? candidate.slice(0, boundary) : candidate;

    if (content) {
      truncatedParts.push({ ...part, content });
    }
    truncatedParts.push({ kind: "text", content: "…" });
    return truncatedParts;
  }

  return truncatedParts;
}

interface InlineMarkdownProps {
  text: string;
  /** Character budget before an ellipsis. Omit to render the whole field. */
  maxLength?: number;
  /** Tailwind classes for `<strong>` spans, so cards and prose can differ. */
  strongClassName?: string;
  /** Tailwind classes for inline `<code>` spans. */
  codeClassName?: string;
}

const DEFAULT_STRONG_CLASS = "font-semibold text-zinc-100";
const DEFAULT_CODE_CLASS =
  "px-1.5 py-0.5 mx-0.5 text-[11px] font-mono bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded";

/**
 * Renders the light Markdown subset after terminology resolution.
 */
export function InlineMarkdown({
  text,
  maxLength,
  strongClassName = DEFAULT_STRONG_CLASS,
  codeClassName = DEFAULT_CODE_CLASS,
}: InlineMarkdownProps) {
  const { simplified } = useTerminology();
  const resolvedText = resolveSnippetTerminology(text, simplified);
  const parts = createSnippetParts(resolvedText, maxLength);

  return (
    <span>
      {parts.map((part, i) => {
        if (part.kind === "strong") {
          return (
            <strong key={i} className={strongClassName}>
              {part.content}
            </strong>
          );
        }
        if (part.kind === "code") {
          return (
            <code key={i} className={codeClassName}>
              {part.content}
            </code>
          );
        }
        return <span key={i}>{part.content}</span>;
      })}
    </span>
  );
}
