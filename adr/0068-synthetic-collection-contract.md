# ADR 0068: Synthetic Collection Contract

## Status

Accepted on 2026-10-22 for [#2585](https://github.com/fderuiter/deruiter.dev/issues/2585). Refines the seeded collection stage of [ADR 0065](0065-study-data-pipeline-architecture.md).

## Context

DEMO-301 needs reproducible source observations that later SDTM mapping and lineage can inspect. The `nSubjects` input could count either people screened or people randomized, and a single mutable PRNG would reroll earlier subjects when another domain or subject is added. The source layer also needs realistic data problems without implying that its fictional records came from a real study.

## Decision

`nSubjects` counts **screened subjects**, including screen failures. Every subject has a complete consent date before any visit; only randomized subjects have study treatment exposure. Partial dates occur only in selected source observations, such as adverse events. Subject identifiers are synthetic, dates are derived from a fixed fictional anchor, and the output contains no real names or sites.

The generator reads arms, visits, activities, tests and visit windows from the parsed USDM `StudyDefinition`. Each random choice is keyed by seed, study, subject, domain and field. Each collected row receives a stable source identifier for later lineage. The same inputs produce byte-identical columns, and extending the subject count preserves every earlier subject. The generator deliberately includes missed and out-of-window visits, unscheduled visits, early discontinuations, partial adverse-event dates, out-of-range laboratory values and pre-dose adverse events.

The published USDM v4 schema is checked in tests and build checks for the authored definition; runtime reading performs focused structural and reference checks without bundling the full schema in the browser.

## Consequences

Changing the meaning of `nSubjects` or the source identifier scheme would invalidate golden files and downstream lineage, so either change requires a controlled upgrade. Source anomalies remain visible for SDTM mapping and conformance rather than being silently corrected.
