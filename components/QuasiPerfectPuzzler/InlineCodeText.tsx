import React from "react";

/**
 * Briefing copy marks Lean names with backticks (`use 3`). Render those
 * spans as code rather than showing the backticks themselves (#2249).
 */
export function InlineCodeText({ text }: { text: string }) {
  const parts = text.split("`");
  // An unmatched backtick leaves an even number of parts: keep it as text.
  if (parts.length % 2 === 0) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <code
            key={i}
            className="rounded bg-black/40 px-1 font-mono text-[0.95em] text-zinc-100"
          >
            {part}
          </code>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}
