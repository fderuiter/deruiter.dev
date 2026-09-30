"use client";

import React from "react";
import { useClipboard } from "@/hooks/useClipboard";

/**
 * Chrome classes shared with RichNarrative's server-rendered fallback, so the
 * header bar is already in place at first paint and rehydration causes no
 * layout shift.
 */
export const CODE_BLOCK_WRAPPER_CLASS =
  "relative group/code my-6 rounded-xl border border-zinc-800/80 bg-zinc-950/80 overflow-hidden shadow-md";
export const CODE_BLOCK_HEADER_CLASS =
  "flex items-center justify-between px-4 py-2 bg-zinc-900/60 border-b border-zinc-800/60 text-xs font-mono select-none";
export const CODE_BLOCK_LABEL_CLASS =
  "text-zinc-400 font-semibold tracking-wider";
export const CODE_BLOCK_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-brand-cyan/50 text-xs";
export const CODE_BLOCK_PRE_CLASS =
  "p-4 overflow-x-auto text-sm font-mono text-zinc-200 leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950";

interface CodeBlockProps {
  language?: string;
  code: string;
  preProps?: Record<string, unknown>;
  children?: React.ReactNode;
}

export function CodeBlock({
  language,
  code,
  preProps = {},
  children,
}: CodeBlockProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { key: _key, ...cleanPreProps } = preProps as Record<string, unknown>;
  // useClipboard owns the copied state, its reset timer (cleared on
  // unmount), the legacy execCommand fallback and the screen reader
  // announcement through the global live announcer.
  const { copy, copied } = useClipboard({
    successMessage: "Code copied to clipboard",
    errorMessage: "Failed to copy code",
  });

  const handleCopy = () => {
    void copy(code);
  };

  const formattedLanguage = language
    ? language.replace(/^language-/, "").toUpperCase()
    : null;

  return (
    <div className={CODE_BLOCK_WRAPPER_CLASS}>
      {/* Code Block Header with Language Badge & Copy Button */}
      <div className={CODE_BLOCK_HEADER_CLASS}>
        <span className={CODE_BLOCK_LABEL_CLASS}>
          {formattedLanguage || "CODE"}
        </span>

        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Copied code" : "Copy code to clipboard"}
          className={CODE_BLOCK_BUTTON_CLASS}
        >
          {copied ? (
            <>
              <svg
                className="w-3.5 h-3.5 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <svg
                className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Pre-formatted code block */}
      <pre
        {...cleanPreProps}
        className={`${CODE_BLOCK_PRE_CLASS} ${
          (cleanPreProps.className as string) || ""
        }`}
      >
        {children}
      </pre>
    </div>
  );
}
