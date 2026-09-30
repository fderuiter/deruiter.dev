# Reference

Reference documents record exact contracts, provider snapshots, and release
evidence. Unlike tutorials and how-to guides, these pages are organized for
lookup rather than sequential reading.

## Contracts

- [TypeDoc API reference](api/README.md), generated TypeScript API contracts.
- [`openapi.json`](../../openapi.json), generated HTTP API contract.
- [Integration catalog](integrations-catalog.md), external services and their
  environment boundaries.

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

Provider inventories are dated snapshots. Re-run their documented commands
before making an operational decision; do not infer live provider state from an
old snapshot.
