# ADR 0066: Clinical Data Platform Architecture

## Status

Accepted on 2026-10-20, under the epic
[#2620](https://github.com/fderuiter/deruiter.dev/issues/2620) and its first
step [#2621](https://github.com/fderuiter/deruiter.dev/issues/2621). Builds on
[ADR 0036](0036-free-tier-offloading-and-provider-quota-governance.md)
(free tiers, nothing deployed),
[ADR 0057](0057-open-source-acknowledgments-and-license-compliance.md)
(new dependencies and their attributions) and
[ADR 0065](0065-study-data-pipeline-architecture.md) (the Study Data
Pipeline, which this platform consumes as a data product).

## Context

The site shows clinical data work at the collection end (CRF Studio,
`lib/crf/`) and, with the Study Data Pipeline
([#2582](https://github.com/fderuiter/deruiter.dev/issues/2582), ADR 0065),
at the submission end: one study taken through SDTM, ADaM and Define-XML.
Neither shows the platform a clinical data, analytics and reporting lead
owns around those pipelines: operational and portfolio analytics, a semantic
layer, SQL and BI tooling, data governance, cloud architecture, legacy
migration, validation evidence, and vendor and investment decisions.

This ADR records the target state for that platform. It is written so it can
also be presented as the platform vision to IT and enterprise architecture.

### Capability map

Each capability a platform lead is expected to hold is demonstrated by
something a visitor can open or a reviewer can run. The issues are children
of #2620.

| #   | Capability                                                                  | Demonstrated by                                                                                                   | Issues                                          |
| --- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | Platform evolution for trial execution and portfolio management             | `/platform` hub, this ADR, roadmap, operations and portfolio dashboards                                           | #2621, #2629, #2635, #2645                      |
| 2   | Scalable data products, semantic models, reporting frameworks, self-service | Data products with contracts, metric registry, report framework, explorer                                         | #2622, #2623, #2624, #2625, #2630, #2631, #2632 |
| 3   | CDISC SDTM, ADaM and USDM in solutions                                      | The Study Data Pipeline as a data product; USDM study definitions drive portfolio milestones                      | #2582, #2622                                    |
| 4   | Cloud platforms (AWS) with IT and enterprise architecture                   | AWS reference architecture page and a CDK app with cdk-nag in CI                                                  | #2641, #2642                                    |
| 5   | Modernization: legacy transformation, migration, interoperability           | Migration lab with reconciliation; FHIR, ODM and HL7 adapters; strangler-fig cutover plan                         | #2643, #2644                                    |
| 6   | Governance, quality, traceability, validation, metric consistency           | Catalog and glossary, data quality framework, column lineage, metric parity tests, validation package, controls   | #2626, #2636, #2637, #2638, #2639, #2640        |
| 7   | Clinical dashboards, analytics and operational reporting                    | Operations dashboards, RBQM, portfolio view, report catalog with certification tiers                              | #2625, #2630, #2631, #2632                      |
| 8   | Platform strategy, vendor evaluation, validation, investment planning       | Vendor scorecard, TCO and NPV, build or buy, roadmap, decision memos                                              | #2639, #2645, #2646                             |
| 9   | Modernizing clinical platforms or analytics                                 | Case study and the migration lab                                                                                  | #2643, #2647                                    |
| 10  | SQL, SQL Server and Power BI                                                | dbt-duckdb project, T-SQL on SQL Server in CI, Power BI PBIP/TMDL project, SQL workbench                          | #2627, #2628, #2629, #2633                      |
| 11  | ICH, GCP, FDA and 21 CFR Part 11                                            | Controls matrix (Part 11, ICH E6(R3), ALCOA+), hash-chained audit trail, signature manifestation, RBQM per E6(R3) | #2631, #2639, #2640                             |
| 12  | Large-scale transformation and governance initiatives                       | Operating model (council, RACI, adoption metrics) and transformation case study                                   | #2647                                           |
| 13  | Medical device, pharma and CRO environments                                 | A portfolio that mixes drug, device (IDE) and CRO-run studies, with vendor oversight                              | #2622, #2630, #2646                             |

Four constraints shape the design:

- The site runs on free tiers (ADR 0036). Platform pages must cost nothing on
  the server and must not wake Neon.
- Every number must be reproducible: the same seed gives the same portfolio,
  the same metrics and the same files.
- The audience includes people who validate GxP systems. The site must not
  claim a compliance or validation status it does not have.
- No real patient, sponsor or vendor data may appear.

## Decision

### Medallion layers

One synthetic sponsor portfolio of eight studies (drug Phase I to III, two
device IDE studies, and studies run by a CRO; DEMO-301 from ADR 0065 is one
of them) is modelled in three layers. Data flows towards gold and never back.

| Layer  | Holds                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------- |
| Bronze | Raw operational feeds as received: EDC, CTMS, IRT, eTMF, finance, and a legacy SQL Server-era export                |
| Silver | Conformed, quality-checked data products, each with an owner, a steward and a versioned data contract               |
| Gold   | Kimball star-schema marts (operations, portfolio, RBQM) with conformed dimensions, plus SDTM and ADaM from ADR 0065 |

Each fact table declares its grain. Each data product carries a semantic
version, and a breaking contract change needs a major version bump that CI
checks. The products and their contracts are listed in the
[data contract catalog](../docs/reference/clinical-platform-data-contracts.md). `checkLayerFlow` in the module rejects a lineage edge that flows
from a higher layer into a lower one.

### A deep module

`lib/clinical-platform/` is a deep module (AGENTS.md invariant 21).
`index.ts`, `types.ts` and `presets.ts` are its public contract and
everything under `internal/` is private. Each stage gets its own folder:

| Folder                | Stage                                                                |
| --------------------- | -------------------------------------------------------------------- |
| `internal/portfolio`  | Seeded synthetic portfolio and its bronze feeds                      |
| `internal/warehouse`  | Silver and gold star schemas, DDL for DuckDB, PostgreSQL and T-SQL   |
| `internal/semantic`   | The metric registry and its compilers                                |
| `internal/reporting`  | Report specs, certification tiers, the report catalog and its pack   |
| `internal/quality`    | Data quality rules by DAMA dimension, results and scorecards         |
| `internal/governance` | Catalog, glossary, stewardship and data contracts                    |
| `internal/lineage`    | Column-level lineage as OpenLineage, with impact analysis            |
| `internal/rbqm`       | Key risk indicators, quality tolerance limits and central monitoring |
| `internal/workbench`  | SQL workbench schema browser, saved queries and read-only guard      |
| `internal/migration`  | Legacy extract mapping, reconciliation and cutover planning          |
| `internal/interop`    | FHIR R4, HL7 v2, ODM and Dataset-JSON adapters                       |
| `internal/strategy`   | Vendor scoring, build or buy, total cost of ownership                |

The public types (`Portfolio`, `Study`, `Site`, `DataProduct`,
`DataContract`, `MetricDefinition`, `DqRule`, `LineageEdge`) are the shared
vocabulary every stage and consumer uses. The engine is pure TypeScript with
no DOM, React, Worker or network dependency, and seeded like ADR 0065's
pipeline, so it can be reviewed on unit tests and golden files before any
page exists. It reuses `lib/crf/` (FHIR, ODM, e-signature) and
`lib/term-glossary.ts` through their public entry points.

### One semantic layer, compiled to every consumer

Every metric is defined once in the registry as a `MetricDefinition`: name,
expression, denominator, grain, unit, source product, owner, version and a
certified flag. The registry compiles each definition to every consumer:

- the TypeScript engine behind the dashboards and the explorer;
- SQL for DuckDB, PostgreSQL and T-SQL;
- dbt MetricFlow YAML;
- Power BI TMDL measures.

No dashboard, report or query computes a metric itself. A parity test runs
the same metrics on a fixed seed in TypeScript, DuckDB and on SQL Server in
CI, and fails on any difference. That is metric consistency shown, not
asserted.

### Routes under `/platform`

Pages live under `/platform`: a hub that maps each capability to its demo,
then `/platform/operations`, `/platform/portfolio`, `/platform/explore`,
`/platform/sql`, `/platform/governance`, `/platform/architecture`,
`/platform/modernization` and `/platform/strategy`. Each route is a static
shell. Each issue that adds a route registers it in the Discovery Matrix
(AGENTS.md invariants 3 and 14) in the same pull request, under the merge
lane's hot-file locks. This ADR and its skeleton add no route.

### A Web Worker boundary

Pages run the engine in a Web Worker so generation and aggregation never
block the main thread. The worker imports the computation directly from
`@/lib/clinical-platform`, never the module that constructs the worker,
because a worker whose import graph reaches its own constructor makes its
runtime chunk start itself
([#853](https://github.com/fderuiter/deruiter.dev/issues/853)) and
`ChunkCycleGuardPlugin` fails the build.

### DuckDB-WASM only in the SQL workbench

DuckDB-WASM (MIT) loads on demand inside `/platform/sql` only, after the
visitor asks for it, served from the site's own origin with its own entry in
`lib/dx/bundle-guard.ts`. It is attributed under ADR 0057. Every other page
uses the TypeScript engine, so no other route pays its multi-megabyte cost.

### Projects outside the app

These projects live beside the app, not inside it:

| Folder                 | Contents                                                        |
| ---------------------- | --------------------------------------------------------------- |
| `analytics/`           | A dbt-duckdb project built from the same gold layer             |
| `analytics/sqlserver/` | T-SQL: stored procedures, a temporal table, row-level security  |
| `analytics/powerbi/`   | A Power BI project (PBIP with TMDL) generated from the registry |
| `infra/aws/`           | An AWS CDK app with its own `package.json`, checked by cdk-nag  |

Each has its own workflow file, so `.github/workflows/ci.yml` stays
untouched where possible and the app's install and bundle do not grow. Power
BI Desktop does not run in CI: the text project is generated and
schema-checked there, and screenshots are a one-time human step.

### Zero cost, nothing deployed

The platform follows ADR 0036. Public pages read no database, no new
provider is added, and nothing is deployed to AWS. `cdk synth` and cdk-nag
run offline in CI without an AWS account, and SQL Server runs only as a CI
service container. A live cloud deployment would be a separate decision
with its own cost.

### Consuming the Study Data Pipeline

The platform does not repeat CDISC work. The Study Data Pipeline (#2582,
ADR 0065) publishes its SDTM and ADaM output into the gold layer as one data
product, `STUDY_DATA_PRODUCT_ID`, under its own contract. The platform
imports `runPipeline` and the types from `@/lib/study-data` only, never its
`internal/` stages, and reads the run's datasets and manifest:

- DEMO-301's subjects and visits feed portfolio enrollment and the
  operations metrics for that study, keyed to the run's seed;
- the run manifest's hashes and pinned standard versions become lineage and
  catalog facts;
- the pipeline's conformance findings feed the data quality scorecards.

The portfolio generator
([#2622](https://github.com/fderuiter/deruiter.dev/issues/2622)) takes
DEMO-301's protocol from the USDM definition the pipeline reads, runs the
pipeline with the portfolio's seed, and reads the run's collected layer
(DM, RAND, SV, EX and DS) into the bronze EDC and IRT feeds, moving its
dates by one whole number of days onto the portfolio calendar. The collected
layer is the raw data a site enters, so bronze is fed from the pipeline's
raw layer while its SDTM and ADaM stay in gold, and nothing flows from gold
back into bronze. The portfolio records the run's seed, subject count, date
shift and standard versions so the run can be reproduced.

### Synthetic data and fictional vendors

Every study, site, subject, sponsor and vendor is synthetic. Every page,
table and download carries `SYNTHETIC_DATA_NOTICE`. Vendor names are
invented and are not the names of real companies. The one exception
inherited from ADR 0065, the public CDISC Pilot study, keeps its own label
wherever it appears.

### Regulatory wording

Pages about ICH, GCP, FDA guidance or 21 CFR Part 11 say the platform is
"designed to these controls" and link the controls matrix. They never call
the platform "compliant" or "validated", and they carry
`REGULATORY_WORDING`. `checkRegulatoryWording` finds those claims in page
copy so tests can enforce the rule. The tone follows
[ADR 0047](0047-peer-engineering-narrative-and-dual-layer-perspective.md).

## Consequences

- One portfolio and one semantic layer back every demo, so a metric gives
  the same number on every page, in every SQL dialect and in the Power BI
  model.
- Each stage is library code first, reviewable on unit tests and golden
  files before its page exists.
- The CDISC work stays in one place (ADR 0065) and the platform reuses it
  through a contract.
- No page costs anything on the server, and no cloud account is needed.

What gets harder:

- The scope is large: 28 issues. The minimum story (#2621 to #2624, #2630,
  #2635) has to stand on its own if the rest waits.
- Each compiler target (SQL dialects, MetricFlow, TMDL) is a second
  implementation of every metric, held together only by the parity test.
- The out-of-app projects add toolchains (Python for dbt, a SQL Server
  container, the CDK) that only their own workflows exercise.
- The wording rule needs care in every page and every download, not only in
  the controls matrix.

## Alternatives considered

- **A real warehouse (Postgres on Neon, or a cloud data warehouse).** It
  would wake Neon on public pages or add a provider and break ADR 0036. A
  seeded in-browser model gives the same lessons for nothing.
- **DuckDB-WASM everywhere.** One engine would be simpler, but every route
  would carry several megabytes and wait for the WASM to start. It stays in
  the SQL workbench.
- **Metrics in each dashboard.** Faster to start, but the numbers drift
  apart, which is the problem a semantic layer exists to prevent.
- **Deploy the AWS stack.** It would show a running system but costs money
  and needs an account; synthesized, policy-checked infrastructure code
  shows the design without either.
- **Fold the platform into the Study Data Pipeline.** The pipeline is about
  one study's standards; the platform is about many studies' operations and
  governance. Keeping them apart keeps each module deep and lets the
  platform consume the pipeline like any other product.

## Amendment 2026-10-24: The registry's shape

[#2624](https://github.com/fderuiter/deruiter.dev/issues/2624) built the
registry in `internal/semantic`. Three details differ from the decision
above.

- **A status, not a certified flag.** A metric is `draft`, `certified` or
  `deprecated`. A certified report may use only certified metrics, and a
  deprecated metric cannot return to use.
- **A formula tree, not an expression and a denominator.** The formula is
  a small tree over the gold star schema: a measure (table, aggregation,
  expression, conditions, time key), a ratio of two measures with a scale,
  or the span between two study milestones. Every compiler and the
  TypeScript evaluator walk the same tree, so no target parses another's
  text. Dimensions are named, not written as columns, and each compiler
  resolves them through the schema's keys.
- **Versions enforced by a lock file.** The formula, grain, unit, default
  filters and allowed dimensions form the metric's contract. Changing a
  certified metric's contract needs a major version bump; adding a
  dimension or changing the status needs at least a minor one.
  `__tests__/fixtures/clinical-platform/metric-registry.lock.json` records
  each release, and a test fails when the registry and the lock disagree.

The parity test in this step runs each metric's generated DuckDB SQL on the
seeded gold tables and compares it with the TypeScript evaluator. The
PostgreSQL and T-SQL output, the MetricFlow YAML and the TMDL are golden
files only. Running them on their own engines belongs to the dbt project
(#2627), SQL Server in CI (#2628) and the Power BI project (#2629). Metrics
the gold model cannot compute, such as eTMF completeness or an adverse event
reporting rate, are listed with what they need in the
[metric catalog](../docs/reference/clinical-platform-metrics.md) rather
than approximated.
