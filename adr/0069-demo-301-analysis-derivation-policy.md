# ADR 0069: DEMO-301 Analysis Derivation Policy

## Status

Accepted on 2026-10-23 for [#2589](https://github.com/fderuiter/deruiter.dev/issues/2589) and [#2590](https://github.com/fderuiter/deruiter.dev/issues/2590), under [ADR 0065](0065-study-data-pipeline-architecture.md).

## Context

ADaM structures define where analysis variables belong, but the study must decide which subjects, observations and events enter each analysis. DEMO-301 has date-only measurements, visit windows, partial adverse-event dates and treatment discontinuations. Silent defaults would change the seed-301 goldens and later tables.

## Decision

- ADSL has one row per screened subject. `SAFFL` means dosed and groups by treatment received. `ITTFL` represents DEMO-301's Full Analysis Set: randomized and dosed, grouped by assigned treatment. `EFFFL` additionally requires usable systolic blood pressure at baseline and after baseline.
- The latest nonmissing assessment on or before first dose is baseline. An assessment at the designated Baseline visit on first-dose day qualifies. Same-date ties prefer that visit and then the lower source sequence.
- Observed scheduled and unscheduled assessments compete for USDM visit windows. A row belongs to the eligible window closest to its target day. Within each subject, parameter and analysis visit, `ANL01FL` selects the assessment closest to target day, then earlier date, then lower source sequence.
- `DTYPE="LOCF"` rows carry the latest earlier postbaseline value into missing planned visits for sensitivity analysis. They never receive `ANL01FL`. The primary treatment-policy analysis uses observed postdiscontinuation values when available; LOCF is not a substitute for them.
- An adverse event starts on an imputed first day when its date gives only a month, except a month containing first dose uses first-dose day if an earlier onset cannot be established. A month-only end date uses its last day, capped at last contact. Imputation flags distinguish these values from observed dates. An impossible end-before-start interval is a finding with a missing analysis end date.
- Treatment emergence runs from first dose through 14 days after last dose, capped at last known study contact. An observed or imputed start on first-dose day qualifies; a start before it does not.
- The time-to-event risk set is dosed subjects. An event requires both an AE action of drug withdrawal and a matching adverse-event disposition. The AE supplies the event date and primary SDTM pointer; the DS sequence is retained as corroboration. Otherwise, censor at the earlier of last known contact and discontinuation for another reason. Event and censor durations count first-dose day as day 1.

## Consequences

The rules are typed derivation data and testable boundaries. Seeded goldens, property tests and handcrafted date/event fixtures guard the decisions. A later study may use a different analysis plan; these are DEMO-301 policies, not universal CDISC rules.
