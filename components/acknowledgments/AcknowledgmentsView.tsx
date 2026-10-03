import React from "react";
import { CREDITS_DATASET } from "@/lib/oss-credits/dataset";
import {
  countByLicense,
  groupDirectRuntimeByPurpose,
  npmPackageUrl,
  type CreditPackage,
} from "@/lib/oss-credits";
import { GROUP_ORDER } from "@/lib/oss-credits/presets";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ExternalLink } from "./ExternalLink";
import { PackageSearch, type PackageTuple } from "./PackageSearch";

const REPO_URL = "https://github.com/fderuiter/deruiter.dev";

/** Credits that do not come from npm. Add an entry here to list it. */
const NON_NPM_CREDITS: readonly {
  name: string;
  use: string;
  license: string;
  url?: string;
  note?: string;
}[] = [
  {
    name: "Geist Mono",
    use: "Monospace type for metadata and social preview cards.",
    license: "SIL OFL 1.1",
    url: "https://vercel.com/font",
    note: "License text: assets/og-fonts/LICENSE-GeistMono-OFL.txt",
  },
  {
    name: "Lexend",
    use: "Display type for headings and social preview cards.",
    license: "SIL OFL 1.1",
    url: "https://www.lexend.com",
    note: "License text: assets/og-fonts/LICENSE-Lexend-OFL.txt",
  },
  {
    name: "OpenDyslexic",
    use: "Optional reading font for the accessibility setting.",
    license: "SIL OFL 1.1",
    url: "https://opendyslexic.org",
  },
];

function projectUrl(pkg: CreditPackage): string {
  return pkg.homepage ?? pkg.repository ?? npmPackageUrl(pkg.name);
}

function groupTooling(): { group: string; packages: CreditPackage[] }[] {
  const groups = new Map<string, CreditPackage[]>();
  for (const pkg of CREDITS_DATASET.packages) {
    if (!pkg.direct || pkg.scope !== "tooling") continue;
    const key = pkg.group ?? "Other";
    groups.set(key, [...(groups.get(key) ?? []), pkg]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, packages]) => ({ group, packages }));
}

function orderGroups<T extends { group: string }>(groups: T[]): T[] {
  const rank = (g: string) => {
    const i = GROUP_ORDER.indexOf(g);
    return i === -1 ? GROUP_ORDER.length : i;
  };
  return [...groups].sort((a, b) => rank(a.group) - rank(b.group));
}

function PackageRow({ pkg }: { pkg: CreditPackage }) {
  const home = projectUrl(pkg);
  const repo =
    pkg.repository && pkg.repository !== home ? pkg.repository : null;
  return (
    <li className="@container py-4">
      <div className="grid gap-2 @md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] @md:gap-6">
        <div className="min-w-0 space-y-1">
          <div className="break-words text-sm font-semibold text-zinc-100">
            <ExternalLink href={home}>{pkg.name}</ExternalLink>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs tabular-nums text-zinc-300">
            <span className="break-words">{pkg.version}</span>
            <span className="break-words rounded border border-white/[0.08] px-1.5 py-0.5 text-emerald-400">
              {pkg.license}
            </span>
            {repo && (
              <ExternalLink href={repo} className="text-zinc-300">
                source
              </ExternalLink>
            )}
          </div>
        </div>
        <p className="min-w-0 break-words text-sm leading-relaxed text-zinc-300">
          {pkg.reason}
        </p>
      </div>
    </li>
  );
}

function GroupSection({
  group,
  packages,
}: {
  group: string;
  packages: CreditPackage[];
}) {
  const headingId = `group-${group.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <h3
        id={headingId}
        className="mb-1 flex flex-wrap items-baseline gap-x-3 text-base font-semibold text-zinc-100"
      >
        {group}
        <span className="font-mono text-xs font-normal tabular-nums text-zinc-300">
          {packages.length}
        </span>
      </h3>
      <ul className="divide-y divide-white/[0.08] border-t border-white/[0.08]">
        {packages.map((pkg) => (
          <PackageRow key={pkg.name} pkg={pkg} />
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="@container min-w-0 rounded-lg border border-white/[0.08] bg-[#13151a] p-4">
      <dt className="break-words text-xs text-zinc-300">{label}</dt>
      <dd className="mt-1 font-mono text-3xl font-semibold tabular-nums text-amber-400">
        {value}
      </dd>
    </div>
  );
}

export function AcknowledgmentsView() {
  const runtime = CREDITS_DATASET.packages.filter((p) => p.scope === "runtime");
  const directRuntime = orderGroups(
    groupDirectRuntimeByPurpose(CREDITS_DATASET)
  );
  const directTooling = orderGroups(groupTooling());
  const toolingDirectCount = directTooling.reduce(
    (n, g) => n + g.packages.length,
    0
  );
  const licenses = countByLicense(CREDITS_DATASET, "runtime");
  const directRuntimeCount = directRuntime.reduce(
    (n, g) => n + g.packages.length,
    0
  );
  const slim: PackageTuple[] = runtime
    .map((p) => [p.name, p.version, p.license, projectUrl(p)] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="bg-zinc-950 px-4 pb-24 text-foreground sm:px-6 md:px-12 lg:px-24">
      <div className="mx-auto w-full min-w-0 max-w-5xl space-y-14">
        <header className="space-y-5">
          <Breadcrumbs
            items={[
              { label: "Systems", href: "/#case-studies" },
              { label: "Open Source Credits" },
            ]}
          />
          <h1 className="break-words text-3xl font-bold tracking-[-0.035em] text-zinc-50 sm:text-5xl">
            Open source acknowledgments
          </h1>
          <p className="max-w-3xl break-words text-base leading-relaxed text-zinc-300">
            This site stands on the work of thousands of maintainers. Every
            package below is free software that someone wrote, documented and
            kept alive. Thank you. Each name links to the project so you can
            read it, use it, and support it.
          </p>
          <dl className="grid grid-cols-1 gap-3 @container sm:grid-cols-3">
            <Stat label="Packages shipped to visitors" value={runtime.length} />
            <Stat
              label="Direct runtime dependencies"
              value={directRuntimeCount}
            />
            <Stat label="Distinct licenses (shipped)" value={licenses.length} />
          </dl>
        </header>

        <section aria-labelledby="direct-runtime" className="space-y-8">
          <div className="space-y-2">
            <h2
              id="direct-runtime"
              className="text-2xl font-semibold tracking-[-0.02em] text-zinc-50"
            >
              Direct dependencies
            </h2>
            <p className="max-w-3xl break-words text-sm leading-relaxed text-zinc-300">
              The packages this site chose on purpose, grouped by what they do.
            </p>
          </div>
          {directRuntime.map((g) => (
            <GroupSection key={g.group} {...g} />
          ))}
        </section>

        <section aria-labelledby="direct-tooling" className="space-y-4">
          <h2
            id="direct-tooling"
            className="text-2xl font-semibold tracking-[-0.02em] text-zinc-50"
          >
            Build and test tooling
          </h2>
          <p className="max-w-3xl break-words text-sm leading-relaxed text-zinc-300">
            These run while building, testing and checking the site. They do not
            reach visitors.
          </p>
          <details className="group rounded-lg border border-white/[0.08] bg-[#13151a]">
            <summary className="min-h-12 cursor-pointer list-none px-4 py-3 text-sm font-medium text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400">
              Show{" "}
              <span className="font-mono tabular-nums">
                {toolingDirectCount}
              </span>{" "}
              tooling dependencies
            </summary>
            <div className="space-y-8 px-4 pb-4">
              {directTooling.map((g) => (
                <GroupSection key={g.group} {...g} />
              ))}
            </div>
          </details>
        </section>

        <section aria-labelledby="licenses" className="space-y-4">
          <h2
            id="licenses"
            className="text-2xl font-semibold tracking-[-0.02em] text-zinc-50"
          >
            Licenses
          </h2>
          <ul className="grid grid-cols-1 gap-2 @container sm:grid-cols-2 lg:grid-cols-3">
            {licenses.map(({ license, count }) => (
              <li
                key={license}
                className="flex min-w-0 items-baseline justify-between gap-3 rounded-lg border border-white/[0.08] bg-[#13151a] px-3 py-2 font-mono text-xs tabular-nums"
              >
                <span className="min-w-0 break-words text-zinc-100">
                  {license}
                </span>
                <span className="text-zinc-300">{count}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-2 rounded-lg border border-white/[0.08] bg-[#13151a] p-4">
            <h3 className="text-base font-semibold text-amber-400">
              Notable licenses
            </h3>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
              <li className="break-words">
                LGPL-3.0: the libvips binaries arrive through Next.js image
                optimisation (sharp). They are dynamically linked and
                unmodified.
              </li>
              <li className="break-words">
                FSL-1.1-Apache-2.0: the Sentry CLI wrapper is used only at build
                time and is not shipped to visitors.
              </li>
            </ul>
          </div>
          <p className="break-words text-sm leading-relaxed text-zinc-300">
            Full license texts are in{" "}
            <ExternalLink href="/third-party-notices.txt">
              third-party-notices.txt
            </ExternalLink>
            . This project&apos;s own terms are in the repository{" "}
            <ExternalLink href={`${REPO_URL}/blob/main/LICENSE`}>
              LICENSE
            </ExternalLink>{" "}
            and{" "}
            <ExternalLink href={`${REPO_URL}/blob/main/NOTICE`}>
              NOTICE
            </ExternalLink>{" "}
            files.
          </p>
        </section>

        <section aria-labelledby="all-packages" className="space-y-4">
          <h2
            id="all-packages"
            className="text-2xl font-semibold tracking-[-0.02em] text-zinc-50"
          >
            Every shipped package
          </h2>
          <p className="max-w-3xl break-words text-sm leading-relaxed text-zinc-300">
            Direct and transitive. Search the full list of packages that reach
            visitors.
          </p>
          <PackageSearch packages={slim} />
        </section>

        <section aria-labelledby="non-npm" className="space-y-4">
          <h2
            id="non-npm"
            className="text-2xl font-semibold tracking-[-0.02em] text-zinc-50"
          >
            Non-npm credits
          </h2>
          <ul className="divide-y divide-white/[0.08] rounded-lg border border-white/[0.08] bg-[#13151a]">
            {NON_NPM_CREDITS.map((c) => (
              <li key={c.name} className="min-w-0 space-y-1 px-4 py-3">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="break-words text-sm font-semibold text-zinc-100">
                    {c.url ? (
                      <ExternalLink href={c.url}>{c.name}</ExternalLink>
                    ) : (
                      c.name
                    )}
                  </span>
                  <span className="break-words font-mono text-xs text-emerald-400">
                    {c.license}
                  </span>
                </div>
                <p className="break-words text-sm text-zinc-300">{c.use}</p>
                {c.note && (
                  <p className="break-words font-mono text-xs text-zinc-300">
                    {c.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
