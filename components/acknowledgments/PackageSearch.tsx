"use client";

import React, { useMemo, useState } from "react";
import { ExternalLink } from "./ExternalLink";

/** Slim record: name, version, license, project URL. */
export type PackageTuple = readonly [
  name: string,
  version: string,
  license: string,
  url: string,
];

interface PackageSearchProps {
  packages: readonly PackageTuple[];
}

const PAGE_SIZE = 50;

export function PackageSearch({ packages }: PackageSearchProps) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return packages;
    return packages.filter(
      ([name, , license]) =>
        name.toLowerCase().includes(needle) ||
        license.toLowerCase().includes(needle)
    );
  }, [packages, query]);

  const visible = matches.slice(0, limit);
  const status =
    matches.length === 0
      ? "No packages match your search."
      : `Showing ${visible.length} of ${matches.length} shipped packages.`;

  return (
    <div className="min-w-0 space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="ack-package-search"
          className="block text-sm font-medium text-zinc-200"
        >
          Search shipped packages by name or license
        </label>
        <input
          id="ack-package-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimit(PAGE_SIZE);
          }}
          placeholder="react, MIT, Apache-2.0"
          autoComplete="off"
          spellCheck={false}
          className="w-full min-h-12 rounded-lg border border-zinc-800 bg-[#13151a] px-4 py-3 font-mono text-sm text-zinc-100 placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
        />
        <p
          id="ack-search-status"
          role="status"
          aria-live="polite"
          className="font-mono text-xs tabular-nums text-zinc-300"
        >
          {status}
        </p>
      </div>

      <ul className="divide-y divide-white/[0.08] rounded-lg border border-white/[0.08] bg-[#13151a]">
        {visible.map(([name, version, license, url]) => (
          <li
            key={`${name}@${version}`}
            className="@container flex flex-col gap-1 px-4 py-3 @sm:flex-row @sm:items-baseline @sm:justify-between @sm:gap-4"
          >
            <span className="min-w-0 text-sm text-zinc-100">
              <ExternalLink href={url}>{name}</ExternalLink>
            </span>
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-xs tabular-nums text-zinc-300">
              <span className="break-words">{version}</span>
              <span className="break-words rounded border border-white/[0.08] px-1.5 py-0.5 text-emerald-400">
                {license}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {matches.length > visible.length && (
        <button
          type="button"
          onClick={() => setLimit((current) => current + PAGE_SIZE)}
          className="min-h-12 min-w-12 rounded-lg border border-zinc-700 bg-[#13151a] px-4 py-3 text-sm font-medium text-zinc-100 hover:border-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
        >
          Show {Math.min(PAGE_SIZE, matches.length - visible.length)} more
        </button>
      )}
    </div>
  );
}
