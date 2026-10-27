import type { Metadata } from "next";
import { IntentLink } from "@/components/ui/IntentLink";
import { PageLayout } from "@/components/PageLayout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
  CLINICAL_JOURNEY,
  JOURNEY_EVIDENCE_LABELS,
  PLANNED_JOURNEY_ITEMS,
  RELATED_CASE_STUDIES,
  RELATED_GAMES,
  RELATED_GAME_LABEL,
  journeyIssueUrl,
} from "@/lib/clinical-journey";
import { getBreadcrumbTrailSchema, getNavGroup } from "@/lib/navigation";
import { getBreadcrumbSchema } from "@/lib/seo";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.clinical
);

const LINK =
  "underline decoration-zinc-600 underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

/**
 * The Clinical group's overview: the clinical data journey on one page, read
 * from `lib/clinical-journey.ts` so it always matches the strip on each step.
 */
export default function ClinicalPage() {
  const platformTools =
    getNavGroup("clinical").sections.find((s) => s.id === "platform-tools")
      ?.items ?? [];

  return (
    <PageLayout className="bg-[#0d0e11] text-[#f4f4f6]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema(getBreadcrumbTrailSchema("/clinical")),
        }}
      />
      <header className="border-b border-white/[0.08] pb-10 sm:pb-14">
        <Breadcrumbs path="/clinical" />
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.2em] text-amber-400">
          Clinical
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">
          Clinical data, end to end
        </h1>
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
          One fictional study, DEMO-301, followed from the forms a site fills in
          to the tables of a study report and the portfolio it belongs to. Each
          step is a working page you can use, and each says what its evidence is
          drawn from.
        </p>
      </header>

      <section aria-labelledby="journey-title" className="py-10 sm:py-14">
        <h2
          id="journey-title"
          className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400"
        >
          The journey, in order
        </h2>
        <ol className="mt-6 grid min-w-0 gap-4">
          {CLINICAL_JOURNEY.map((step, index) => {
            const related = RELATED_CASE_STUDIES.filter(
              (study) => study.step === step.id
            );
            const games = RELATED_GAMES.filter((game) => game.step === step.id);
            const planned = PLANNED_JOURNEY_ITEMS.filter(
              (item) => item.step === step.id
            );
            return (
              <li
                key={step.id}
                className="min-w-0 border border-white/[0.08] bg-[#13151a] p-5 sm:p-6"
              >
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-400">
                  Step {index + 1} · {step.stage}
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
                  <IntentLink href={step.href} className={LINK}>
                    {step.title}
                  </IntentLink>
                </h3>
                <p className="mt-3 max-w-3xl break-words text-slate-300">
                  {step.purpose}
                </p>
                <p className="mt-3 font-mono text-xs text-slate-400">
                  Evidence:{" "}
                  {step.evidence
                    .map((kind) => JOURNEY_EVIDENCE_LABELS[kind])
                    .join(", ")}
                </p>
                {step.id === "govern" && platformTools.length > 0 ? (
                  <ul className="mt-4 flex min-w-0 flex-wrap gap-x-5 gap-y-2 text-sm">
                    {platformTools.map((tool) => (
                      <li key={tool.id} className="min-w-0">
                        <IntentLink href={tool.href} className={LINK}>
                          {tool.title}
                        </IntentLink>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {related.length + games.length + planned.length > 0 ? (
                  <ul className="mt-4 grid min-w-0 gap-2 border-t border-white/[0.08] pt-4 text-sm text-slate-300">
                    {related.map((study) => (
                      <li key={study.slug} className="break-words">
                        <IntentLink
                          href={`/case-studies/${study.slug}`}
                          className={LINK}
                        >
                          {study.title} case study
                        </IntentLink>{" "}
                        <span className="text-slate-400">
                          (Fred&apos;s own project): {study.relation}
                        </span>
                      </li>
                    ))}
                    {games.map((game) => (
                      <li key={game.href} className="break-words">
                        <IntentLink href={game.href} className={LINK}>
                          {game.title}
                        </IntentLink>{" "}
                        <span className="text-slate-400">
                          ({RELATED_GAME_LABEL}): {game.relation}
                        </span>
                      </li>
                    ))}
                    {planned.map((item) => (
                      <li key={item.issue} className="break-words">
                        <span>{item.title}</span>{" "}
                        <span className="text-slate-400">
                          (planned,{" "}
                          <a
                            href={journeyIssueUrl(item.issue)}
                            className={LINK}
                          >
                            #{item.issue}
                          </a>
                          )
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>
    </PageLayout>
  );
}
