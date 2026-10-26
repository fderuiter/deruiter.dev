# ADR 0070: Always-Free AWS Data Stores, Read at Build Time

## Status

Accepted on 2026-10-26 for [#2975](https://github.com/fderuiter/deruiter.dev/issues/2975), under epic [#2974](https://github.com/fderuiter/deruiter.dev/issues/2974). Amends [ADR 0066](0066-clinical-data-platform-architecture.md) ("Zero cost, nothing deployed") and [ADR 0036](0036-free-tier-offloading-and-provider-quota-governance.md) (provider quotas).

## Context

ADR 0066 kept the Clinical Data Platform's AWS story on paper: a synthesized CDK app, nothing deployed, because a live account costs money. Since then the Vercel Marketplace has offered AWS products with one-click provisioning and short-lived OIDC credentials, and the owner asked for a plan that uses only **permanent monthly free quotas**, not trials or credits.

Of the seven products offered, two have such a quota (checked against AWS pricing pages on 2026-10-26):

| Product            | Always free, per month                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Amazon Aurora DSQL | 100,000 DPUs and 1 GB of storage                                                                                |
| Amazon DynamoDB    | 25 GB of storage, 25 write and 25 read capacity units in provisioned mode, 2.5 million stream reads, per region |

S3 (no always-free storage for accounts opened after 2025-07-15), S3 Tables, S3 Vectors, OpenSearch Serverless and Aurora PostgreSQL are covered only by sign-up credits or are billed. Separately, Vercel Hobby Fluid Compute was at about 3h15m of its 4h per 30 days, so a new per-request server call is not affordable either.

On 2026-10-26 the owner provisioned one Aurora DSQL cluster and one DynamoDB table through the Marketplace, in a new AWS account on the **Free account plan**: $100 of credits, no card, closed after six months (about 2027-04-26) unless upgraded to the Paid plan. The always-free quotas continue only on the Paid plan.

## Decision

- **Two AWS resources, both always-free.** Aurora DSQL is the platform's warehouse of record: each release loads the synthetic gold layer into it and records whether it agrees with the DuckDB copy. DynamoDB is the data-product run ledger: one item per pipeline or release run, holding versions, golden hashes, conformance results and artifact checksums. No other AWS product is used.
- **Writes come from GitHub Actions only.** The release train and CI write, through a GitHub OIDC role in the AWS account, scoped to the one cluster and the one table. No visitor action and no Vercel function writes to AWS.
- **Reads happen at build time only.** Production builds read through the Marketplace integration's role, using the `VERCEL_OIDC_TOKEN` builds receive, and render static pages. No route handler, server component, ISR revalidation or middleware calls AWS at request time, so Fluid Compute does not grow.
- **Variables are prefixed.** The integrations write `DSQL_*` (Production only) and `DYNAMODB_*` (Production and Preview) variables, because Neon's unprefixed `PG*` variables already exist and must not change. Code reads only the prefixed names, declared in `lib/env.ts`.
- **A failed read fails the production build.** It goes through `failBuildOnDataSourceError()` like the database and cache (ADR 0036's runtime-only fallback rule). A build without the variables, such as Preview for DSQL, renders the page without the AWS section rather than with invented content.
- **Capacity stays inside the quota.** One region. The DynamoDB table runs in provisioned mode at 5 read and 5 write units with auto scaling off, and every table and index together stays within 25 and 25. DSQL loads are batched to at most 3,000 rows per transaction, its limit, and the first load's DPU use and size are measured before the job is scheduled.
- **Cost is watched, not assumed.** Without a card the account cannot be billed; the risk is spending credits. A monthly check confirms $0.00 of usage beyond the free quotas. Before the account would close, the owner upgrades it to the Paid plan and adds a zero-spend budget, or the integrations are removed.

## Consequences

The platform shows a running AWS piece without a visitor ever waiting on AWS or spending Vercel compute. The cost is a second write path (GitHub Actions to AWS) and an AWS account whose plan has a deadline. If the account lapses, the build-time reads fail, which is loud by design; removing the integration variables returns the pages to their pre-AWS form.

The DSQL schema cannot use temporary tables, triggers or PL/pgSQL, and allows one DDL statement per transaction, so its DDL is emitted separately from the DuckDB and T-SQL dialects rather than shared.

## Alternatives considered

- **S3 or S3 Tables (Iceberg) as the warehouse of record.** DuckDB can read Iceberg, but storage, requests, monitoring and compaction are billed, and browsers cannot hold the IAM credentials a catalog needs, so visitors could not query it without a server hop.
- **Query DSQL live from `/platform/sql`.** It would show a real distributed database answering, but every query would be a function invocation against a nearly exhausted compute budget. The DuckDB workbench stays in the browser.
- **Replace Upstash and Neon for visitor counters with DynamoDB.** Compute-neutral and plausibly simpler, but it changes ADR 0036's governed design. Deferred until the two uses above have run a month at $0.
- **Keep nothing deployed (ADR 0066 as written).** Cheaper in attention, but it leaves the AWS story unproven when a free, credential-less path now exists.
