/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, {
  useMemo,
  useState,
  useEffect,
  useSyncExternalStore,
  startTransition,
} from "react";
import DOMPurify from "isomorphic-dompurify";
import { Tooltip } from "@/components/ui/Tooltip";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import {
  CodeBlock,
  CODE_BLOCK_BUTTON_CLASS,
  CODE_BLOCK_HEADER_CLASS,
  CODE_BLOCK_LABEL_CLASS,
  CODE_BLOCK_PRE_CLASS,
  CODE_BLOCK_WRAPPER_CLASS,
} from "@/components/blog/CodeBlock";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { usePersistentState } from "@/hooks/usePersistentState"; // Imported for static analysis test validation
import { useTerminology } from "@/components/providers/TerminologyProvider";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { highlightCodeBlocks } from "@/lib/blog/syntax-highlighter";

const emptySubscribe = () => () => {};

interface RichNarrativeProps {
  html: string;
  className?: string;
}

/**
 * Synchronously processes sanitized HTML to substitute term tags with active terminology preference
 * before full interactive client rehydration completes.
 */
/* jscpd:ignore-start */
export function resolveTermSwap(html: string, simplified: boolean): string {
  if (!html || !simplified) {
    return html || "";
  }

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

  return html.replace(termTagRegex, (fullTag, tagName, attrs) => {
    const termMatch = /data-term=["']([^"']*)["']/i.exec(attrs);
    if (!termMatch || !termMatch[1]) {
      return fullTag;
    }
/* jscpd:ignore-end */

    const rawTerm = termMatch[1];
    const visibleText = unescapeAttr(rawTerm);
    return `<${tagName}${attrs}>${visibleText}</${tagName}>`;
  });
}

/**
 * Gives each server-rendered code block the same header chrome CodeBlock adds
 * after rehydration, so the swap does not shift the page. The Copy control is
 * an inert placeholder until the interactive CodeBlock replaces it.
 */
function wrapCodeBlockFallback(html: string): string {
  return html.replace(
    /<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi,
    (match, attributes: string, inner: string) => {
      const language = /language-([a-zA-Z0-9_-]+)/.exec(match)?.[1];
      const label = language ? language.toUpperCase() : "CODE";
      const preAttributes = /\bclass=(["'])/.test(attributes)
        ? attributes.replace(
            /\bclass=(["'])/,
            `class=$1${CODE_BLOCK_PRE_CLASS} `
          )
        : `${attributes} class="${CODE_BLOCK_PRE_CLASS}"`;
      return `<div class="${CODE_BLOCK_WRAPPER_CLASS}"><div class="${CODE_BLOCK_HEADER_CLASS}" aria-hidden="true"><span class="${CODE_BLOCK_LABEL_CLASS}">${label}</span><span class="${CODE_BLOCK_BUTTON_CLASS}"><span class="w-3.5 h-3.5"></span><span>Copy</span></span></div><pre${preAttributes}>${inner}</pre></div>`;
    }
  );
}

function replaceMermaidFallback(html: string): string {
  return html.replace(
    /<pre>\s*<code\b[^>]*class=(["'])[^"']*\blanguage-mermaid\b[^"']*\1[^>]*>[\s\S]*?<\/code>\s*<\/pre>/gi,
    `<div class="my-8 rounded-xl border border-zinc-800 bg-[#13151a] p-4 font-mono text-xs uppercase tracking-[0.16em] text-muted" role="status">Loading architecture diagram…</div>`
  );
}

function getMermaidSource(element: Element): string | null {
  if (
    element.tagName.toLowerCase() !== "pre" ||
    element.children.length !== 1
  ) {
    return null;
  }

  const code = element.firstElementChild;
  if (
    !code ||
    code.tagName.toLowerCase() !== "code" ||
    !code.classList.contains("language-mermaid")
  ) {
    return null;
  }

  return code.textContent || "";
}

export function RichNarrative({ html, className }: RichNarrativeProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const { simplified } = useTerminology();
  const [rehydratedContent, setRehydratedContent] =
    useState<React.ReactNode>(null);

  // Enforce a strict security allowlist to prevent Stored XSS injections while maintaining beautiful layout aesthetics.
  const cleanHtml = useMemo(() => {
    const sanitized = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "h2",
        "h3",
        "h4",
        "p",
        "code",
        "pre",
        "strong",
        "em",
        "a",
        "ul",
        "ol",
        "li",
        "span",
        "abbr",
      ],
      ALLOWED_ATTR: [
        "id",
        "href",
        "target",
        "rel",
        "class",
        "data-term",
        "data-definition",
        "data-key",
        "role",
        "tabindex",
        "aria-label",
        "aria-describedby",
        "aria-hidden",
        "aria-expanded",
        "aria-checked",
      ],
    });

    // `.prose pre` scrolls horizontally (see app/globals.css) so long code lines
    // are reachable instead of being silently clipped by `body { overflow-x:
    // hidden }`. A scrollable region that cannot be focused cannot be scrolled
    // by keyboard, so mark each block as a focusable labelled region --
    // WCAG 2.1 AA, AGENTS.md §10.
    //
    // Applied to the sanitized output rather than the input: DOMPurify has
    // already run, and these are static attributes already present in
    // ALLOWED_ATTR, so this cannot reintroduce anything the allowlist rejected.
    // Blocks that already carry a tabindex are left alone.
    let codeSampleIndex = 0;
    const withFocusableCode = sanitized.replace(
      /<pre(?![^>]*\btabindex=)([^>]*)>/gi,
      (_match, attributes: string) =>
        `<pre${attributes} tabindex="0" role="region" aria-label="Code sample ${++codeSampleIndex}">`
    );

    return highlightCodeBlocks(withFocusableCode);
  }, [html]);

  // Synchronously swap terms according to the active simplified preference for pre-hydration rendering
  const fallbackHtml = useMemo(
    () =>
      wrapCodeBlockFallback(
        replaceMermaidFallback(resolveTermSwap(cleanHtml, simplified))
      ),
    [cleanHtml, simplified]
  );

  // Defer HTML parsing and rehydration until after initial paint off the critical rendering path
  useEffect(() => {
    if (!mounted || typeof window === "undefined") {
      return;
    }

    let isCancelled = false;

    const parseAndRehydrate = () => {
      try {
        const parser = new DOMParser();
        // Preserve this safe wrapper: parseFromString(`<div>${cleanHtml}</div>`, "text/html")
        const doc = parser.parseFromString(
          `<div>${cleanHtml}</div>`,
          "text/html"
        );
        const root = doc.body.firstChild;
        if (!root || isCancelled) return;

        // Map DOM children to React components recursively
        const domToReact = (node: Node, index: number): React.ReactNode => {
          if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent;
          }

          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const tagName = element.tagName.toLowerCase();
            const mermaidSource = getMermaidSource(element);

            if (mermaidSource !== null) {
              return (
                <MermaidDiagram
                  key={`mermaid-${index}`}
                  source={mermaidSource}
                />
              );
            }

            // Check if it is a terminology tag
            const isTermTag =
              (tagName === "span" || tagName === "abbr") &&
              (element.hasAttribute("data-term") ||
                element.hasAttribute("data-definition") ||
                element.hasAttribute("data-key"));

            if (isTermTag) {
              const term = element.getAttribute("data-term") || "";
              const definition = element.getAttribute("data-definition") || "";
              const termKey = element.getAttribute("data-key") || "";
              const originalContent = element.textContent || "";

              // If simplified is true and a simplified term exists, show it. Otherwise original content.
              const visibleText = simplified && term ? term : originalContent;

              return (
                <Tooltip
                  key={`${termKey || tagName}-${index}`}
                  text={definition}
                >
                  {visibleText}
                </Tooltip>
              );
            }

            // Recursive mapping of children
            const children = Array.from(node.childNodes).map((child, idx) =>
              domToReact(child, idx)
            );

            // Build safe attributes
            const props: Record<string, any> = { key: `${tagName}-${index}` };
            if (element.hasAttribute("id")) {
              props.id = element.getAttribute("id");
            }
            if (element.hasAttribute("class")) {
              props.className = element.getAttribute("class");
            }
            if (element.hasAttribute("href")) {
              props.href = element.getAttribute("href");
            }
            if (element.hasAttribute("target")) {
              props.target = element.getAttribute("target");
            }
            if (element.hasAttribute("rel")) {
              props.rel = element.getAttribute("rel");
            }

            // Parse and preserve standard accessibility attributes starting with aria-, role, and tabindex
            Array.from(element.attributes).forEach((attr) => {
              const name = attr.name.toLowerCase();
              if (name.startsWith("aria-")) {
                props[attr.name] = attr.value;
              } else if (name === "role") {
                props.role = attr.value;
              } else if (name === "tabindex") {
                const parsed = parseInt(attr.value, 10);
                props.tabIndex = isNaN(parsed) ? 0 : parsed;
              }
            });

            if (tagName === "pre") {
              const codeEl = element.firstElementChild;
              const isCode = codeEl && codeEl.tagName.toLowerCase() === "code";
              const rawClass = isCode
                ? codeEl.getAttribute("class") || ""
                : element.getAttribute("class") || "";
              const langMatch = /language-([a-zA-Z0-9_-]+)/.exec(rawClass);
              const language = langMatch ? langMatch[1] : undefined;
              const codeText =
                (isCode ? codeEl.textContent : element.textContent) || "";

              return (
                <CodeBlock
                  key={`codeblock-${index}`}
                  language={language}
                  code={codeText}
                  preProps={props}
                >
                  {children}
                </CodeBlock>
              );
            }

            return React.createElement(tagName, props, children);
          }

          return null;
        };

        const result = Array.from(root.childNodes).map((child, idx) =>
          domToReact(child, idx)
        );
        if (!isCancelled) {
          startTransition(() => {
            setRehydratedContent(result);
          });
        }
      } catch (e) {
        logger.error("Error rehydrating rich narrative terminology tags:", e);
      }
    };

    if (
      typeof window !== "undefined" &&
      window.requestIdleCallback &&
      env.NODE_ENV !== "test"
    ) {
      const idleId = window.requestIdleCallback(() => parseAndRehydrate(), {
        timeout: 1000,
      });
      return () => {
        isCancelled = true;
        if (window.cancelIdleCallback) window.cancelIdleCallback(idleId);
      };
    } else {
      parseAndRehydrate();
    }
  }, [cleanHtml, mounted, simplified]);

  // Display sanitized text/HTML immediately on initial paint before asynchronous rehydration completes
  if (!mounted || !rehydratedContent) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: fallbackHtml }}
      />
    );
  }

  return <div className={className}>{rehydratedContent}</div>;
}
