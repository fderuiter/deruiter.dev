import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import { BusinessGlossary } from "@/components/platform/governance/BusinessGlossary";
import { DataCatalog } from "@/components/platform/governance/DataCatalog";
import {
  DataQuality,
  type DqScenarioEffect,
} from "@/components/platform/governance/DataQuality";
import { GovernancePolicies } from "@/components/platform/governance/GovernancePolicies";
import { StewardshipModel } from "@/components/platform/governance/StewardshipModel";
import {
  DATA_QUALITY_RULES,
  DEFAULT_PORTFOLIO_SEED,
  DQ_ISSUE_LOG,
  DQ_SCENARIOS,
  GOVERNANCE_POLICIES,
  REPORT_PACK,
  applyDqScenario,
  assessDataQuality,
  buildWarehouse,
  businessGlossary,
  checkDataContracts,
  checkStewardship,
  contractData,
  dataCatalog,
  dataContracts,
  dataProducts,
  dataQualityTrend,
  dqIssues,
  generatePortfolio,
  type DqAssessment,
  type Warehouse,
  operationsReportSpecs,
  platformLineage,
} from "@/lib/clinical-platform";
import {
  REGULATORY_WORDING,
  SYNTHETIC_DATA_NOTICE,
} from "@/lib/clinical-platform/presets";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import {
  DEFAULT_SEED,
  DEFAULT_SUBJECT_COUNT,
  DEMO_301_STUDY,
  runPipeline,
  type PipelineRun,
} from "@/lib/study-data";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getBreadcrumbTrailSchema } from "@/lib/navigation";
import { getBreadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.platformGovernance
);

const SECTIONS = [
  { id: "catalog", name: "Data catalog" },
  { id: "quality", name: "Data quality" },
  { id: "glossary", name: "Business glossary" },
  { id: "stewardship", name: "Stewardship" },
  { id: "policies", name: "Policies" },
] as const;

/**
 * What each seeded defect does to the rules it names: their failing rows on
 * the clean warehouse and on a copy carrying the defect.
 */
function scenarioEffects(
  warehouse: Warehouse,
  run: PipelineRun,
  baseline: DqAssessment
): DqScenarioEffect[] {
  const before = new Map(baseline.results.map((r) => [r.ruleId, r]));
  return DQ_SCENARIOS.map((scenario) => {
    const after = new Map(
      assessDataQuality(
        applyDqScenario(warehouse, scenario.id),
        run
      ).results.map((r) => [r.ruleId, r])
    );
    return {
      scenario,
      rules: scenario.ruleIds.map((ruleId) => ({
        ruleId,
        failedBefore: before.get(ruleId)?.failed ?? 0,
        failedAfter: after.get(ruleId)?.failed ?? 0,
        status: after.get(ruleId)?.status ?? "not-applicable",
      })),
    };
  });
}

/**
 * Builds the catalog and glossary from the synthetic portfolio and the
 * DEMO-301 study at build time, with the contract results, the data
 * quality assessment and the lineage graph the catalog shows of each
 * product.
 */
function governanceContent() {
  const warehouse = buildWarehouse(
    generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
  );
  const run = runPipeline(DEMO_301_STUDY, {
    seed: DEFAULT_SEED,
    nSubjects: DEFAULT_SUBJECT_COUNT,
  });
  const products = dataProducts(run);
  const contracts = dataContracts(run);
  const reports = [...REPORT_PACK, ...operationsReportSpecs(warehouse)];
  const quality = assessDataQuality(warehouse, run);
  const catalog = dataCatalog({
    products,
    contracts,
    contractResults: checkDataContracts(
      contracts,
      contractData(warehouse, run),
      { loadedAt: warehouse.asOf }
    ),
    quality,
    lineage: platformLineage(run, reports),
    reports,
  });
  return {
    catalog,
    quality,
    trend: dataQualityTrend(warehouse, run, DQ_ISSUE_LOG),
    issues: dqIssues(DQ_ISSUE_LOG),
    effects: scenarioEffects(warehouse, run, quality),
    productNames: Object.fromEntries(
      quality.byProduct.map((p) => [p.key, p.label])
    ),
    catalogIds: new Set(catalog.map((e) => e.id)),
    glossary: businessGlossary(),
    findings: checkStewardship({ products }),
    reportTitles: Object.fromEntries(reports.map((r) => [r.id, r.title])),
    metricNames: Object.fromEntries(
      catalog.filter((e) => e.kind === "metric").map((e) => [e.id, e.name])
    ),
    productCount: catalog.filter((e) => e.kind === "product").length,
    metricCount: catalog.filter((e) => e.kind === "metric").length,
  };
}

const linkClass =
  "text-amber-300 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-amber-400";

export default function PlatformGovernancePage() {
  const content = governanceContent();
  return (
    <PageLayout className="overflow-x-hidden bg-[#0d0e11] text-[#f4f4f6]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema(
            getBreadcrumbTrailSchema("/platform/governance")
          ),
        }}
      />
      <header className="border-b border-white/[0.08] pb-10">
        <Breadcrumbs path="/platform/governance" />
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.18em] text-amber-400">
          Governance / Catalog
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">
          Govern the data
        </h1>
        <p className="mt-5 max-w-3xl text-slate-300">
          Every data product and governed metric on the platform, in one
          catalog: who owns it, who looks after it, how it is classified,
          whether it met its contract, how it scores on data quality, and what
          reads it. The business glossary holds the terms the metrics are
          defined in, the stewardship model says who decides what, and the
          policies set the rules, each one saying whether code or a person
          applies it. All of it is derived from the same definitions that build
          the{" "}
          <Link href="/platform/operations" className={linkClass}>
            dashboards
          </Link>{" "}
          and the{" "}
          <Link href="/platform/explore" className={linkClass}>
            explorer
          </Link>
          , so the catalog cannot drift from them.
        </p>
        <p className="mt-4 border-l-2 border-amber-500 pl-3 text-sm text-amber-200">
          {SYNTHETIC_DATA_NOTICE} {REGULATORY_WORDING}
        </p>
        <nav aria-label="On this page" className="mt-8">
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className={`${linkClass} inline-flex min-h-12 items-center`}
                >
                  {section.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="space-y-16 pt-10">
        <section aria-labelledby="catalog" className="min-w-0">
          <h2
            id="catalog"
            className="scroll-mt-24 text-2xl font-semibold tracking-[-0.02em]"
          >
            Data catalog
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            {content.productCount} data products and {content.metricCount}{" "}
            governed metrics. A product&apos;s quality score is the mean pass
            rate of the data quality rules that checked it, from the same
            assessment the quality tests run.
          </p>
          <div className="mt-6">
            <DataCatalog
              entries={content.catalog}
              reportTitles={content.reportTitles}
            />
          </div>
        </section>

        <section aria-labelledby="quality" className="min-w-0">
          <h2
            id="quality"
            className="scroll-mt-24 text-2xl font-semibold tracking-[-0.02em]"
          >
            Data quality
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            {DATA_QUALITY_RULES.length} rules check the platform&apos;s data
            products and the Study Data Pipeline, each under one DAMA dimension,
            with a severity, a threshold and the steward who owns it. The same
            assessment gives each catalog entry its quality score.
          </p>
          <div className="mt-6">
            <DataQuality
              assessment={content.quality}
              trend={content.trend}
              issues={content.issues}
              effects={content.effects}
              rules={DATA_QUALITY_RULES}
              productNames={content.productNames}
              catalogIds={content.catalogIds}
            />
          </div>
        </section>

        <section aria-labelledby="glossary" className="min-w-0">
          <h2
            id="glossary"
            className="scroll-mt-24 text-2xl font-semibold tracking-[-0.02em]"
          >
            Business glossary
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            The terms the governed metrics are defined in, read from the
            site&apos;s one glossary, so a definition here matches the one in
            every tooltip. Sources are cited by reference.
          </p>
          <div className="mt-6">
            <BusinessGlossary
              entries={content.glossary}
              metricNames={content.metricNames}
            />
          </div>
        </section>

        <section aria-labelledby="stewardship" className="min-w-0">
          <h2
            id="stewardship"
            className="scroll-mt-24 text-2xl font-semibold tracking-[-0.02em]"
          >
            Stewardship
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            {content.findings.length === 0
              ? "The stewardship check passes: every role sits in exactly one domain, every product and metric has an owner and a steward from the same domain, and every decision has one accountable role."
              : `The stewardship check found ${content.findings.length} ${content.findings.length === 1 ? "problem" : "problems"}:`}
          </p>
          {content.findings.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-200">
              {content.findings.map((finding) => (
                <li
                  key={`${finding.rule}-${finding.subject}-${finding.message}`}
                >
                  {finding.message}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6">
            <StewardshipModel />
          </div>
        </section>

        <section aria-labelledby="policies" className="min-w-0">
          <h2
            id="policies"
            className="scroll-mt-24 text-2xl font-semibold tracking-[-0.02em]"
          >
            Policies
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            {GOVERNANCE_POLICIES.length} policies, written as data so this page
            and the tests read the same rules. A rule applied in code names the
            platform function that applies it.
          </p>
          <div className="mt-6">
            <GovernancePolicies />
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
