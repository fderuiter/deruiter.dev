import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import { SqlWorkbench } from "@/components/platform/sql/SqlWorkbench";
import {
  DEFAULT_PORTFOLIO_SEED,
  buildWarehouse,
  dataContracts,
  dataProducts,
  generatePortfolio,
  workbenchQueries,
  workbenchSchema,
} from "@/lib/clinical-platform";
import {
  REGULATORY_WORDING,
  SYNTHETIC_DATA_NOTICE,
} from "@/lib/clinical-platform/presets";
import { DEFAULT_SEED, DEMO_301_STUDY, runPipeline } from "@/lib/study-data";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.platformSql
);

/**
 * The schema browser and saved queries are worked out once, at build time,
 * from the same warehouse and contracts the engine loads, so the page shows
 * every table and query before the visitor starts the engine.
 */
function workbenchContent() {
  const warehouse = buildWarehouse(
    generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
  );
  const run = runPipeline(DEMO_301_STUDY, {
    seed: DEFAULT_SEED,
    nSubjects: 24,
  });
  return {
    tables: workbenchSchema(dataProducts(run), dataContracts(run), warehouse),
    queries: workbenchQueries(warehouse.asOf),
  };
}

export default function PlatformSqlPage() {
  const { tables, queries } = workbenchContent();
  return (
    <PageLayout className="overflow-x-hidden bg-[#0d0e11] text-[#f4f4f6]">
      <header className="border-b border-white/[0.08] pb-10">
        <Link
          href="/platform"
          className="text-sm text-amber-300 underline underline-offset-4 pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          ← Clinical Data Platform
        </Link>
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.18em] text-amber-400">
          Self-service / SQL
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">
          Query the warehouse
        </h1>
        <p className="mt-5 max-w-3xl text-slate-300">
          Write SQL against the gold tables every dashboard reads. The engine is
          DuckDB compiled to WebAssembly: it runs in your browser, on your own
          copy of the synthetic warehouse, so a query never reaches a server.
          The database is read-only, file and network access are switched off,
          and a query that runs too long is stopped. Start from a worked example
          or from the SQL behind any governed metric, in DuckDB, PostgreSQL and
          T-SQL, and read each table&apos;s contract in the schema browser
          before you use a column. To explore without SQL, use the{" "}
          <Link
            href="/platform/explore"
            className="text-amber-300 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            metric explorer
          </Link>
          .
        </p>
        <p className="mt-4 border-l-2 border-amber-500 pl-3 text-sm text-amber-200">
          {SYNTHETIC_DATA_NOTICE} {REGULATORY_WORDING}
        </p>
      </header>
      <div className="pt-10">
        <SqlWorkbench tables={tables} queries={queries} />
      </div>
    </PageLayout>
  );
}
