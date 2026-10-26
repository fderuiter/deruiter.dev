import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getNavGroupItems, getNavGroup } from "@/lib/navigation";
import { getBreadcrumbSchema } from "@/lib/seo";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.labs
);

/**
 * The Labs group's overview: the studios and simulators that sit outside the
 * clinical journey, listed from the same navigation data as the Labs menu.
 */
export default function LabsPage() {
  const labs = getNavGroupItems(getNavGroup("labs"));

  return (
    <PageLayout className="bg-[#0d0e11] text-[#f4f4f6]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Labs", url: "/labs" },
          ]),
        }}
      />
      <header className="border-b border-white/[0.08] pb-10 sm:pb-14">
        <Breadcrumbs items={[{ label: "Labs" }]} />
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.2em] text-amber-400">
          Labs
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">
          Studios and simulators
        </h1>
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
          Interactive tools outside clinical data: building a proof step by
          step, looking through an MRI in 3D, triaging an outage and working a
          ski-patrol shift.
        </p>
      </header>

      <ul className="grid min-w-0 gap-4 py-10 sm:grid-cols-2 sm:py-14">
        {labs.map((lab) => (
          <li key={lab.id} className="min-w-0">
            <Link
              href={lab.href}
              className="flex h-full min-w-0 flex-col gap-2 border border-white/[0.08] bg-[#13151a] p-5 transition-colors hover:border-amber-500/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 active:scale-[0.98] sm:p-6"
            >
              {lab.badge ? (
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-amber-400">
                  {lab.badge}
                </span>
              ) : null}
              <span className="break-words text-xl font-semibold tracking-[-0.02em]">
                {lab.title}
              </span>
              <span className="break-words text-slate-300">{lab.subtitle}</span>
            </Link>
          </li>
        ))}
      </ul>
    </PageLayout>
  );
}
