import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
  standardsBillOfMaterials,
  type StandardCheckKind,
  type StandardStatus,
} from "@/lib/clinical-standards";
import { getBreadcrumbTrailSchema } from "@/lib/navigation";
import { getBreadcrumbSchema } from "@/lib/seo";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import {
  conformanceLayers,
  loadRecordedCoreFindings,
  RULE_STATES,
  type RuleLayer,
  type RuleState,
} from "@/lib/study-data";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.clinicalStandards
);

const REPO = "https://github.com/fderuiter/deruiter.dev/blob/main";
const HOW_TO = `${REPO}/docs/how-to/watch-and-upgrade-clinical-standards.md`;
const REFRESH = `${REPO}/docs/how-to/refresh-cdisc-core-findings.md`;

const LINK =
  "underline decoration-zinc-600 underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

const STATE_LABEL: Record<RuleState, string> = {
  pass: "Pass",
  fail: "Fail",
  "not-applicable": "Not applicable",
  "not-evaluated": "Not evaluated",
  unsupported: "Unsupported",
  "execution-error": "Execution error",
};

const STATE_MEANING: Record<RuleState, string> = {
  pass: "It ran and found nothing.",
  fail: "It ran and reported findings.",
  "not-applicable": "It ran, and the data has nothing it applies to.",
  "not-evaluated": "The rules exist, but this site does not run them.",
  unsupported: "No rules exist for this target in the engine named.",
  "execution-error": "The engine could not finish the rule.",
};

const STATE_TONE: Record<RuleState, string> = {
  pass: "border-emerald-500/40 text-emerald-300",
  fail: "border-amber-500/40 text-amber-300",
  "not-applicable": "border-white/[0.12] text-slate-300",
  "not-evaluated": "border-white/[0.12] text-slate-300",
  unsupported: "border-white/[0.12] text-slate-300",
  "execution-error": "border-amber-500/40 text-amber-300",
};

const CHECK_LABEL: Record<StandardCheckKind, string> = {
  "cdisc-engine": "CDISC CORE",
  "official-schema": "Official schema",
  "local-rules": "Site's own rules",
  terminology: "Terminology",
};

const STATUS_LABEL: Record<StandardStatus, string> = {
  current: "Current",
  "upgrade-available": "Upgrade available",
  held: "Held on purpose",
};

const STATUS_TONE: Record<StandardStatus, string> = {
  current: "text-emerald-300",
  "upgrade-available": "text-amber-300",
  held: "text-slate-300",
};

const repoLink = (path: string) => `${REPO}/${path}`;

function LayerOutcomes({ layer }: { layer: RuleLayer }) {
  const states = RULE_STATES.filter((state) => layer.outcomes[state]);
  if (states.length === 0) {
    return layer.state ? (
      <p
        className={`inline-block border px-2 py-1 font-mono text-xs ${STATE_TONE[layer.state]}`}
      >
        {STATE_LABEL[layer.state]}
      </p>
    ) : (
      <p className="font-mono text-xs text-slate-400">Evaluated per run</p>
    );
  }
  return (
    <ul className="flex min-w-0 flex-wrap gap-2">
      {states.map((state) => (
        <li
          key={state}
          className={`border px-2 py-1 font-mono text-xs tabular-nums ${STATE_TONE[state]}`}
        >
          {layer.outcomes[state]} {STATE_LABEL[state].toLowerCase()}
          {state === "fail" && layer.explainedFailures !== undefined
            ? `, ${layer.explainedFailures} explained`
            : ""}
        </li>
      ))}
    </ul>
  );
}

/**
 * The conformance matrix (#2992 step 6): every pinned standard with its
 * newest published version and the checks that bind it, and every rule
 * family with what it found. Built from committed files at build time.
 */
export default async function StandardsConformancePage() {
  const bom = standardsBillOfMaterials();
  const recorded = await loadRecordedCoreFindings();
  const layers = conformanceLayers(recorded);
  const { lock } = recorded;

  return (
    <PageLayout className="bg-[#0d0e11] text-[#f4f4f6]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema(
            getBreadcrumbTrailSchema("/clinical/standards")
          ),
        }}
      />
      <header className="border-b border-white/[0.08] pb-10 sm:pb-14">
        <Breadcrumbs path="/clinical/standards" />
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.2em] text-amber-400">
          Clinical · Evidence
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">
          Standards conformance
        </h1>
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
          Every CDISC standard this site produces or reads: the version it is
          pinned to, the newest version CDISC publishes, and each check that
          holds the site to the pin, with what that check found.
        </p>
        <p
          role="note"
          className="mt-6 max-w-3xl border-l-2 border-amber-500 pl-4 text-sm leading-relaxed text-slate-300"
        >
          A demonstration, not a validated or certified system. All data is
          synthetic. CDISC has not reviewed or endorsed this site; the CDISC
          CORE results are what the open-source engine reported on this
          site&apos;s files.
        </p>
      </header>

      <section aria-labelledby="layers-title" className="py-10 sm:py-14">
        <h2
          id="layers-title"
          className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl"
        >
          Rule families, layer by layer
        </h2>
        <p className="mt-3 max-w-3xl text-slate-300">
          From the shape of a file up to the site&apos;s own rules. Results are
          from {lock.engine} {lock.tag} at commit{" "}
          <span className="font-mono text-sm">{lock.commit.slice(0, 8)}</span>,
          recorded in CI and refreshed by a{" "}
          <a href={REFRESH} className={LINK}>
            documented procedure
          </a>
          .
        </p>
        <dl className="mt-6 grid min-w-0 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {RULE_STATES.map((state) => (
            <div key={state} className="flex min-w-0 gap-3">
              <dt
                className={`shrink-0 border px-2 py-0.5 font-mono text-xs ${STATE_TONE[state]}`}
              >
                {STATE_LABEL[state]}
              </dt>
              <dd className="min-w-0 text-slate-300">{STATE_MEANING[state]}</dd>
            </div>
          ))}
        </dl>
        <ol className="mt-8 grid min-w-0 gap-4">
          {layers.map((layer, index) => (
            <li
              key={layer.id}
              className="min-w-0 border border-white/[0.08] bg-[#13151a] p-5 sm:p-6"
            >
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-400">
                Layer {index + 1}
              </p>
              <h3 className="mt-2 break-words text-xl font-semibold tracking-[-0.02em]">
                {layer.title}
              </h3>
              <dl className="mt-3 grid min-w-0 gap-1 text-sm text-slate-300 sm:grid-cols-[8rem_1fr]">
                <dt className="text-slate-400">Written by</dt>
                <dd className="min-w-0 break-words">{layer.author}</dd>
                <dt className="text-slate-400">Run by</dt>
                <dd className="min-w-0 break-words">{layer.runBy}</dd>
                <dt className="text-slate-400">Run over</dt>
                <dd className="min-w-0 break-words">{layer.scope}</dd>
              </dl>
              <div className="mt-4">
                <LayerOutcomes layer={layer} />
              </div>
              <p className="mt-4 max-w-3xl break-words text-sm text-slate-300">
                {layer.note}
              </p>
              {layer.evidence.length > 0 ? (
                <ul className="mt-4 grid min-w-0 gap-1 border-t border-white/[0.08] pt-4 text-sm">
                  {layer.evidence.map((item) => (
                    <li key={item.path} className="min-w-0 break-words">
                      <a href={repoLink(item.path)} className={LINK}>
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="standards-title"
        className="border-t border-white/[0.08] py-10 sm:py-14"
      >
        <h2
          id="standards-title"
          className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl"
        >
          Standards and versions
        </h2>
        <p className="mt-3 max-w-3xl text-slate-300">
          A weekly job reads the newest published versions from CDISC&apos;s own
          pages and repositories. A newer version is recorded, never adopted
          automatically:{" "}
          <a href={HOW_TO} className={LINK}>
            moving a pin is a separate, reviewed upgrade
          </a>
          .
        </p>
        <ul className="mt-6 grid min-w-0 gap-4 lg:grid-cols-2">
          {bom.standards.map((entry) => (
            <li
              key={entry.standard}
              className="min-w-0 border border-white/[0.08] bg-[#13151a] p-5"
            >
              <h3 className="break-words text-lg font-semibold tracking-[-0.02em]">
                <a href={entry.source} className={LINK}>
                  {entry.name}
                </a>
              </h3>
              <dl className="mt-3 grid min-w-0 grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-sm tabular-nums">
                <dt className="text-slate-400">Pinned</dt>
                <dd className="min-w-0">{entry.pinned}</dd>
                <dt className="text-slate-400">Published</dt>
                <dd className="min-w-0">{entry.published}</dd>
                <dt className="text-slate-400">Status</dt>
                <dd className={`min-w-0 ${STATUS_TONE[entry.status]}`}>
                  {STATUS_LABEL[entry.status]}
                </dd>
              </dl>
              {entry.hold && entry.status === "held" ? (
                <p className="mt-3 break-words text-sm text-slate-300">
                  {entry.hold}
                </p>
              ) : null}
              <ul className="mt-4 grid min-w-0 gap-2 border-t border-white/[0.08] pt-4 text-sm">
                {entry.checks.map((check) => (
                  <li key={check.path} className="min-w-0 break-words">
                    <span className="mr-2 font-mono text-xs text-amber-400">
                      {CHECK_LABEL[check.kind]}
                    </span>
                    <a href={repoLink(check.path)} className={LINK}>
                      {check.description}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <h3 className="mt-10 text-xl font-semibold tracking-[-0.02em]">
          Terminology and tools
        </h3>
        <ul className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {bom.terminology.map((entry) => (
            <li
              key={entry.package}
              className="min-w-0 border border-white/[0.08] bg-[#13151a] p-5"
            >
              <p className="font-semibold">{entry.package} Terminology</p>
              <dl className="mt-3 grid min-w-0 grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-sm tabular-nums">
                <dt className="text-slate-400">Pinned</dt>
                <dd className="min-w-0">{entry.pinned}</dd>
                <dt className="text-slate-400">Published</dt>
                <dd className="min-w-0">{entry.published}</dd>
                <dt className="text-slate-400">Status</dt>
                <dd className={`min-w-0 ${STATUS_TONE[entry.status]}`}>
                  {STATUS_LABEL[entry.status]}
                </dd>
              </dl>
            </li>
          ))}
          {bom.tools.map((tool) => (
            <li
              key={tool.id}
              className="min-w-0 border border-white/[0.08] bg-[#13151a] p-5"
            >
              <p className="font-semibold">
                <a href={tool.source} className={LINK}>
                  {tool.name}
                </a>
              </p>
              <dl className="mt-3 grid min-w-0 grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-sm tabular-nums">
                <dt className="text-slate-400">Pinned</dt>
                <dd className="min-w-0">{tool.pinned}</dd>
                <dt className="text-slate-400">Published</dt>
                <dd className="min-w-0">{tool.published}</dd>
                <dt className="text-slate-400">Status</dt>
                <dd className={`min-w-0 ${STATUS_TONE[tool.status]}`}>
                  {STATUS_LABEL[tool.status]}
                </dd>
              </dl>
            </li>
          ))}
        </ul>
      </section>
    </PageLayout>
  );
}
