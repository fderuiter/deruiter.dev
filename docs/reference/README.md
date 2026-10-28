# Reference

Reference documents record exact contracts, provider snapshots, and release
evidence. Unlike tutorials and how-to guides, these pages are organized for
lookup rather than sequential reading.

## Contracts

- TypeDoc API reference for the TypeScript API contracts: run `npm run compile-docs` and open `api/README.md`. It is generated and git-ignored.
- [`openapi.json`](../../openapi.json), generated HTTP API contract.
- [Integration catalog](integrations-catalog.md), external services and their
  environment boundaries.
- [Setup wizard](setup.md), the fresh-clone command, its flags, profiles,
  mutation boundaries and recovery steps.
- [Clinical Data Platform star schema](clinical-platform-star-schema.md), the
  generated silver and gold tables, fact grains, keys and ERD.
- [Clinical Data Platform metric registry](clinical-platform-metrics.md), the
  generated catalog of governed metrics, their definitions, values on the
  default seed and the metrics the gold model cannot yet compute.
- [Clinical Data Platform data contracts](clinical-platform-data-contracts.md),
  the generated catalog of data products, their owners, classifications,
  service levels, retention and versioned contracts.

## Operations and Release Evidence

- [Public repository readiness](public-repository-readiness.md), current
  GitHub Actions, visibility, and secret-exposure constraints.
- [2026-09-22 release readiness audit](../explanation/audits/2026-09-22-release-public-vercel-readiness.md)
, point-in-time source, GitHub, Vercel, production, and local verification
  evidence.
- [Release security evidence for 0.3.0](release-security-evidence-0.3.0.md), 
  dependency and release-security evidence for the candidate version.
- [Neon capacity inventory](neon-capacity-inventory.md), point-in-time database
  capacity and branch inventory.
- [Vercel retention inventory](vercel-retention-inventory.md), deployment and
  retention baseline.

## Performance Evidence

- [CRF Studio workload capacity](crf-workload-capacity.md), measured latency,
  responsiveness, memory and storage headroom of the CRF authoring workflows
  on small, typical and stress studies (`npm run bench:crf`).

Provider inventories are dated snapshots. Re-run their documented commands
before making an operational decision; do not infer live provider state from an
old snapshot.
