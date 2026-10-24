import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import {
  MEDALLION_LAYERS,
  REGULATORY_WORDING,
  SYNTHETIC_DATA_NOTICE,
} from "@/lib/clinical-platform/presets";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { PLATFORM_CAPABILITIES, capabilityStatus } from "./capabilities";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.platform
);

const flow = [
  ...MEDALLION_LAYERS.map((layer) => ({
    label: layer.label,
    summary: layer.summary,
  })),
  {
    label: "Semantic",
    summary: "Governed metrics compiled once for every consumer.",
  },
  {
    label: "Decisions",
    summary: "Dashboards, SQL, BI and reviewable evidence.",
  },
];

export default function PlatformPage() {
  return (
    <PageLayout className="bg-[#0d0e11] text-[#f4f4f6]">
      <header className="border-b border-white/[0.08] pb-12 sm:pb-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-400">
          Clinical systems / 01
        </p>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">
          Clinical Data Platform
        </h1>
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
          A synthetic sponsor portfolio, designed as a connected data and
          reporting system. Follow how operational feeds become governed data
          products, shared measures and decisions a study team can inspect.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 font-mono text-xs">
          <span className="border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-amber-300">
            SYNTHETIC PORTFOLIO
          </span>
          <span className="border border-white/[0.08] bg-[#13151a] px-3 py-2 text-slate-300">
            ARCHITECTURE IN PROGRESS
          </span>
        </div>
      </header>

      <section aria-labelledby="flow-title" className="py-12 sm:py-16">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-400">
              System flow / 02
            </p>
            <h2
              id="flow-title"
              className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl"
            >
              From source to decision
            </h2>
          </div>
          <a
            className="text-sm text-slate-300 underline decoration-zinc-600 underline-offset-4 hover:text-white"
            href="https://github.com/fderuiter/deruiter.dev/blob/main/adr/0066-clinical-data-platform-architecture.md"
          >
            Read the architecture decision
          </a>
        </div>
        <ol
          className="grid gap-2 md:grid-cols-5"
          aria-label="Data platform layers"
        >
          {flow.map((step, index) => (
            <li
              key={step.label}
              className="section-isolate min-w-0 border border-white/[0.08] bg-[#13151a] p-5"
            >
              <span className="font-mono text-xs tabular-nums text-amber-400">
                0{index + 1} / 05
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-[-0.035em]">
                {step.label}
              </h3>
              <p className="mt-2 break-words text-sm leading-relaxed text-slate-300">
                {step.summary}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-4 border-l-2 border-emerald-500 pl-4 text-sm leading-relaxed text-slate-300">
          Governance, quality, lineage and validation evidence span every layer.
          The gold layer&apos;s SDTM and ADaM come from the{" "}
          <Link
            href="/study-data"
            className="text-slate-100 underline decoration-zinc-600 underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            Study Data Pipeline
          </Link>
          , which you can run and trace end to end.
        </p>
      </section>

      <section
        aria-labelledby="capability-title"
        className="border-t border-white/[0.08] py-12 sm:py-16"
      >
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-400">
          Evidence index / 03
        </p>
        <h2
          id="capability-title"
          className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl"
        >
          Capability map
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
          Live links open working demonstrations. Planned links open the issue
          that defines the next artifact.
        </p>
        <div className="mt-8 divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {PLATFORM_CAPABILITIES.map((capability, index) => {
            const status = capabilityStatus(capability);
            return (
              <article
                key={capability.id}
                className="grid min-w-0 gap-4 py-6 md:grid-cols-[3rem_minmax(0,1fr)_minmax(16rem,0.8fr)] md:gap-6"
              >
                <span className="font-mono text-xs tabular-nums text-slate-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="break-words text-lg font-semibold tracking-[-0.035em]">
                      {capability.name}
                    </h3>
                    <span
                      className={
                        status === "Live demo"
                          ? "border border-emerald-500/40 px-2 py-1 font-mono text-[10px] uppercase text-emerald-300"
                          : "border border-slate-500/40 px-2 py-1 font-mono text-[10px] uppercase text-slate-300"
                      }
                    >
                      {status}
                    </span>
                  </div>
                  <p className="mt-2 break-words text-sm leading-relaxed text-slate-300">
                    {capability.summary}
                  </p>
                </div>
                <ul
                  className="flex min-w-0 flex-wrap content-start gap-2"
                  aria-label={`${capability.name} evidence`}
                >
                  {capability.evidence.map((evidence) => (
                    <li key={evidence.href} className="min-w-0">
                      {evidence.kind === "route" ? (
                        <Link
                          className="inline-block max-w-full break-words border border-white/[0.08] bg-[#13151a] px-3 py-2 text-xs text-slate-200 transition-colors hover:border-amber-500/50 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                          href={evidence.href}
                        >
                          {evidence.label} ↗
                        </Link>
                      ) : (
                        <a
                          className="inline-block max-w-full break-words border border-white/[0.08] bg-[#13151a] px-3 py-2 text-xs text-slate-200 transition-colors hover:border-amber-500/50 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                          href={evidence.href}
                        >
                          {evidence.label} ↗
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <aside
        className="section-isolate border border-white/[0.08] bg-[#13151a] p-5 sm:p-7"
        aria-label="Demonstration scope"
      >
        <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-amber-400">
          Scope & evidence
        </h2>
        <p className="mt-3 break-words text-sm leading-relaxed text-slate-200">
          {SYNTHETIC_DATA_NOTICE}
        </p>
        <p className="mt-2 break-words text-sm leading-relaxed text-slate-300">
          {REGULATORY_WORDING} No AWS resources are deployed for this
          demonstration.
        </p>
      </aside>
    </PageLayout>
  );
}
