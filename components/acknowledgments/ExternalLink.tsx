import React from "react";

interface ExternalLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Outbound link that always opens in a new tab with a safe rel, and tells
 * screen reader users so.
 */
export function ExternalLink({
  href,
  children,
  className = "",
}: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`break-words underline decoration-zinc-600 underline-offset-4 hover:decoration-amber-400 hover:text-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${className}`}
    >
      {children}
      <span className="sr-only"> (opens in new tab)</span>
    </a>
  );
}
