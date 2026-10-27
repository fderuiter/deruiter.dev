# 0034. Specialty Block Verification Contracts

Date: 2026-09-12

## Status

Proposed — a specification deliverable for #664. Nothing in this document is implemented, and no clause here should be read as a claim that RECIST, ConMeds, AE, or Lab blocks are validated or ready to ship. Sections marked **Human decision required** are open and must be resolved by a maintainer (and, before any real trial use, by qualified clinical/regulatory reviewers) before implementation begins.

## Context

CRF Studio (ADR 0021, ADR 0022) already ships two **parallel, inconsistent** implementations of the four specialty domains this ticket asks about. Both are real, shipped code — this is not a greenfield feature. Any new contract must reconcile them, not add a third variant.

### Implementation A — `lib/crf/cdash-domain-templates.ts` (`scaffoldCdashDomain`, wired to the CDASH scaffolder modal and `presets/oncology-recist.ts`)

- **AE** (`AETERM`, `AESTDTC`/`AEENDTC`, `AEONGO`, `AESEV`, `AESER`, `AEREL`, `AEACN`, `AEOUT`; 8 fields, `isLogForm: true`). `AESEV` uses text codelist values (`"GRADE 1 - MILD"` style, via `CL_AESEV`).
- **CM** (`CMTRT`, `CMINDC`, `CMDOSE`, `CMDOSU`, `CMROUTE`, `CMSTDTC`/`CMENDTC`; 7 fields, `isLogForm: true`). `CMDOSU` is a free-text placeholder, not a codelist. No ongoing-medication field at all.
- **LB** (`LBDAT`, `LBFAST`, then six hardcoded analytes: ALT, AST, BILI, CREAT, ANC, PLAT). Each analyte is its own field with a free-text `unit` string and `minValue`/`maxValue` used as the _only_ bound — there is no separate "reference range" concept, so a value outside range and an invalid value are indistinguishable.
- **RECIST/TR** (imaging date/modality, exactly two hardcoded target-lesion fields `TRL1`/`TRL2`, `TRSLDBAS`, a `calculated` `TRSLDCUR` with formula `"trl1 + trl2"`, `TRPCTCHG`, `TRRESP`). One rule exists, but its `conditions` only checks `is_not_empty` — it does **not** implement the PD (≥+20%)/PR (≤−30%)/CR (0 mm) thresholds its own `description` claims. That is an existing correctness defect in shipped code, not a gap this spec introduces; it should be filed as its own bug ticket against `lib/crf/cdash-domain-templates.ts`, separate from this specification.

### Implementation B — `lib/crf/smart-blocks-engine.ts` (`CLINICAL_SMART_BLOCKS`, the in-canvas `/recist`, `/conmeds`, `/ae`, `/labs` slash commands from ADR 0022 §2)

- **`/ae`**: `AETERM`, `AESEV` (CTCAE-style numeric `"1"`–`"5"` — a _different code scheme_ than Implementation A's text grades for the same variable), `AESER`, `AEREL`, `AEOUT`, `AESTDTC`.
- **`/conmeds`**: `CMTRT`, `CMINDC`, `CMDOSE`, `CMDOSU` (a single-select of unit strings, not free text), `CMROUTE`, `CMSTDTC`, `CMENDTC`, and `CMONGO` — the ongoing flag Implementation A is missing.
- **`/labs`**: a single generic "one test per row" shape (`LBTEST`, `LBORRES`, `LBORRESU`, `LBNRIND`) covering 8 named analytes (HGB, WBC, PLT, ALT, AST, TBIL, CREAT, BUN) — structurally the _opposite_ pattern from Implementation A's one-field-per-analyte layout.
- **`/recist`**: different variable names again (`TRLINKID`, `TRLOC`, `TRLDIAM`, `TRSLD`), a single lesion per block instance instead of two, and a `TRSLD` calculation formula that is literally `"TRLDIAM"` — not a sum, so it isn't actually aggregating anything.

**Verified cross-cutting gap**: none of the 24 `customOptions` blocks in `smart-blocks-engine.ts` reference `codelistId`/`STANDARD_CODELISTS` at all (`grep -c "codelistId:" lib/crf/smart-blocks-engine.ts` → 0). Implementation A does use `codelistId` for AE/CM. So the two implementations disagree on variable names, code schemes, cardinality, _and_ whether standard terminology governance applies at all.

### Terminology and type-contract baseline

- `STANDARD_CODELISTS` (`lib/crf/cdisc-controlled-terminology.ts`, now `lib/clinical-standards/codelists.ts`) provides only NCI Thesaurus-coded lists: `CL_NY`, `CL_SEX`, `CL_RACE`, `CL_ETHNIC`, `CL_AESEV`, `CL_AEREL`, `CL_AEOUT`, `CL_RECIST_RESP`, `CL_ROUTE`, and a few device-specific lists. **No MedDRA, WHO Drug, LOINC, or UCUM reference exists anywhere in `lib/crf` or `adr/`** (verified by case-insensitive search of both directories).
- `ClinicalDataType` (`lib/crf/types.ts`) already declares `"repeating_table" // ConMeds, Adverse Events, Lesions` as an intended pattern, and `CRFField.repeatingColumns` exists to support it — but **neither implementation above uses it**. Both use flat sections with `isLogForm: true` on the parent form instead, so per-item repeat semantics (one row per medication, one row per lesion) aren't actually modeled at the field level today.
- ADR 0022 §7 (Clinical Omnibar) _proposes_ "master dictionary lookups (MedDRA, WHODrug)" as aspirational future scope. No corresponding code exists. This ADR is the first place those two proposals get a concrete contract.

## Decision

For each of the four specialty domains, this ADR fixes one canonical variable set, terminology source, and repeat/baseline model — reconciling Implementations A and B rather than adding a third. Where the two disagree, the column marked "Adopts" states which implementation's shape wins and why.

### 1. Adverse Events (AE)

| Field                 | Type           | Source / codelist                                                       | Notes                                                                                                                                                 |
| --------------------- | -------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AETERM`              | text, required | Verbatim term (free text)                                               | MedDRA-coded `AEDECOD`/`AEBODSYS` are a **Human decision required** — see Terminology below.                                                          |
| `AESTDTC` / `AEENDTC` | partial_date   | ISO 8601 partial                                                        | `AEENDTC` hidden while `AEONGO` is true (Implementation A's existing rule — keep).                                                                    |
| `AEONGO`              | checkbox       | `CL_NY`                                                                 | Adopts Implementation A.                                                                                                                              |
| `AESEV`               | single_select  | **New unified codelist `CL_AESEV_CTCAE5`**: `"1 - MILD"`..`"5 - DEATH"` | Reconciles A's text grades and B's bare numerics into one CTCAE v5.0-labeled codelist so the stored value is both machine-sortable and human-legible. |
| `AESER`               | radio          | `CL_NY`                                                                 | Adopts Implementation A's codelist reference over B's inline `Y`/`N`.                                                                                 |
| `AEREL`               | single_select  | `CL_AEREL`                                                              | Unchanged.                                                                                                                                            |
| `AEACN`               | single_select  | Site-defined action-taken list                                          | Kept as `customOptions`, since CDASH does not mandate a single controlled list here.                                                                  |
| `AEOUT`               | single_select  | `CL_AEOUT`                                                              | Unchanged.                                                                                                                                            |

- **Repeat semantics**: one AE per subject-event, `isLogForm: true` (both implementations already agree on this — no change).
- **Baseline semantics**: not applicable; AEs are event-based, not visit-based.
- **Terminology**: MedDRA is the real-world standard for `AEDECOD`/`AEBODSYS` coding. **Human decision required**: MedDRA is a paid, license-restricted dictionary (MSSO subscription). This repo must not embed real MedDRA content. Recommendation (not a decision this ADR makes): ship `AETERM` as free text only, with an optional "bring-your-own-dictionary" import contract for a site's own licensed MedDRA extract, rather than any bundled synthetic MedDRA-shaped codelist that could be mistaken for the real thing.

### 2. Concomitant Medications (CM / ConMeds)

| Field                 | Type            | Source / codelist                                 | Notes                                                                                                                                                     |
| --------------------- | --------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CMTRT`               | text, required  | Verbatim medication name                          | WHO Drug-coded is a **Human decision required**, same licensing shape as MedDRA below.                                                                    |
| `CMINDC`              | text, required  | Free text                                         | Unchanged.                                                                                                                                                |
| `CMDOSE`              | number, min 0.1 | —                                                 | Unchanged.                                                                                                                                                |
| `CMDOSU`              | single_select   | **Adopts Implementation B** (`mg`, `mL`, `IU`, …) | A's free-text dose unit is replaced with a controlled list — dose units must be structured to support later UCUM mapping.                                 |
| `CMROUTE`             | single_select   | `CL_ROUTE`                                        | Unchanged.                                                                                                                                                |
| `CMONGO`              | radio           | `CL_NY`                                           | **Adopts Implementation B** — Implementation A is missing this field entirely; add it.                                                                    |
| `CMSTDTC` / `CMENDTC` | partial_date    | ISO 8601 partial                                  | `CMENDTC` required unless `CMONGO` is true (Implementation B's existing rule — keep; add the equivalent rule to Implementation A's copy once reconciled). |

- **Repeat semantics**: one CM per medication, `isLogForm: true`.
- **Baseline semantics**: not applicable.
- **Terminology**: WHO Drug Dictionary (WHO-DD) is the real-world standard for coded medication names. Same licensing constraint as MedDRA — **Human decision required**, same recommendation (free-text `CMTRT` plus an optional site-supplied WHO-DD import contract, no bundled proprietary dictionary).

### 3. Laboratory Results (LB)

- **Adopts Implementation B's row shape** (`LBTEST` / `LBORRES` / `LBORRESU` / `LBNRIND`) modeled as `dataType: "repeating_table"` with `repeatingColumns`, rather than Implementation A's one-hardcoded-field-per-analyte layout. This is the one domain where the codebase's own declared-but-unused `"repeating_table"` type is the correct fit: a study defines an analyte panel once, and the panel repeats per collection timepoint.

| Column                  | Type             | Source / codelist                                                                                   | Notes                                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | ---------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LBTEST`                | single_select    | **LOINC-coded panel**, e.g. ALT → `1742-6`, AST → `1920-8`, Creatinine → `2160-0` (see Terminology) | Superset of A's 6 + B's 8 named analytes; study builder picks a subset per protocol.                                                                                                                                                                                                                                                                 |
| `LBORRES`               | number           | —                                                                                                   | Original result, as collected.                                                                                                                                                                                                                                                                                                                       |
| `LBORRESU`              | single_select    | **UCUM units** (e.g. `U/L`, `mg/dL`, `umol/L`)                                                      | Replaces free-text unit strings.                                                                                                                                                                                                                                                                                                                     |
| `LBNRIND`               | single_select    | `NORMAL` / `LOW` / `HIGH` / `CRIT_LOW` / `CRIT_HIGH`                                                | Adopts Implementation B — kept distinct from the numeric validation bound (see below).                                                                                                                                                                                                                                                               |
| `LBORNRLO` / `LBORNRHI` | number, optional | —                                                                                                   | **New**: explicit reference-range bounds captured _per study/lab/analyte_, separate from any hard `minValue`/`maxValue` plausibility bound on `LBORRES`. This fixes the conflated concept identified in the gap analysis: "out of reference range" (clinical flag, `LBNRIND`) and "implausible entry" (data-quality bound) must not share one field. |
| `LBDAT`                 | datetime         | —                                                                                                   | Unchanged.                                                                                                                                                                                                                                                                                                                                           |
| `LBFAST`                | radio            | `CL_NY`                                                                                             | Unchanged.                                                                                                                                                                                                                                                                                                                                           |

- **Repeat semantics**: `repeatingColumns` panel, one instance per collection timepoint (visit); each analyte is a row within that instance.
- **Baseline semantics**: the first non-missing on-study (or pre-dose, if a screening/baseline visit exists) result per analyte per subject is the baseline comparator. **Human decision required**: whether baseline is auto-derived from visit metadata or must be explicitly flagged by the site — the current schema has no visit-timepoint model to derive this from automatically, so auto-derivation would require a separate, larger Study Protocol schema change out of scope here.
- **Terminology**: LOINC (test codes) and UCUM (units) are both freely usable and redistributable under their published terms (LOINC's license permits use and redistribution of codes/names with attribution; UCUM is public-domain-equivalent). Unlike MedDRA/WHO-DD, there is no licensing blocker to referencing a bounded LOINC/UCUM subset directly in this codebase. **Human decision required only on scope**: which analyte panel(s) to pin (e.g., start with the existing 8-analyte union of A+B) and whether to vendor the LOINC attribution notice this ADR is not authorized to draft on its own.

### 4. Tumor Response / RECIST (TR)

- **Adopts a merged shape**: Implementation B's per-lesion instance pattern (`TRLINKID`, `TRLOC`, `TRLDIAM`) generalized to a `repeating_table` of **target lesions** (not a fixed `TRL1`/`TRL2` pair), plus new required concepts neither implementation has today:

| Field                       | Type                      | Source / codelist                                     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------- | ------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TRLINKID`                  | text                      | —                                                     | Lesion identifier, stable across visits.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `TRLOC`                     | single_select             | Anatomical site list (existing `customOptions`, kept) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `TRMETHOD`                  | single_select             | Imaging modality (existing, kept)                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `TRLDIAM`                   | number                    | mm                                                    | Per-lesion diameter, per visit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **`TRLCAT`**                | single_select             | `TARGET` / `NON-TARGET`                               | **New** — RECIST 1.1 requires tracking non-target lesions for overall response; neither implementation models this today.                                                                                                                                                                                                                                                                                                                                                                      |
| **`NEWLESIF`**              | radio                     | `CL_NY`                                               | **New** — "new lesion since baseline" flag, required for PD determination; missing from both implementations.                                                                                                                                                                                                                                                                                                                                                                                  |
| `TRSLDBAS`                  | number, calculated        | mm                                                    | Sum of _target_ lesion diameters at the baseline visit only.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `TRSLDCUR`                  | number, calculated        | mm                                                    | Sum of target lesion diameters at the current visit — corrects Implementation B's formula (`"TRLDIAM"`, a single lesion) to an actual sum across the repeating instances, matching Implementation A's intent.                                                                                                                                                                                                                                                                                  |
| `TRPCTCHG`                  | number, calculated        | `(TRSLDCUR - TRSLDBAS) / TRSLDBAS * 100`              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `TRRESP` (overall response) | single_select, calculated | `CL_RECIST_RESP` (`CR`/`PR`/`SD`/`PD`)                | **Calculation must actually implement** RECIST 1.1 thresholds: CR = disappearance of all target _and_ non-target lesions and no new lesions; PR = ≥30% decrease in `TRSLDCUR` vs. baseline, no new lesions, non-target not unequivocally progressed; PD = ≥20% increase (and ≥5 mm absolute) vs. nadir, or any new lesion, or unequivocal non-target progression; SD = neither PR nor PD. The existing rule's `is_not_empty`-only check does not do this and should be replaced, not extended. |

- **Repeat semantics**: `repeatingColumns` for lesions (cardinality per RECIST 1.1: up to 5 target lesions total, max 2 per organ) × repeats across visits for `TRLDIAM`/`TRLCAT`/`NEWLESIF`.
- **Baseline semantics**: target/non-target lesion selection and `TRSLDBAS` are fixed at the baseline (first on-treatment) visit and must not be editable afterward without an explicit protocol-deviation flag — this write-lock is a **Human decision required** on UX (block edits outright vs. warn-and-log), not resolved here.
- **Terminology**: RECIST 1.1 (Eisenhauer et al., 2009) is a published clinical trial methodology, not a licensed terminology — no licensing blocker. Version must be pinned explicitly in the block's metadata (`recistVersion: "1.1"`) so a future RECIST update doesn't silently change scoring for in-flight studies.

## Synthetic Examples

All values below are synthetic and use only lesion IDs / subject IDs that do not correspond to real records.

**AE — positive (complete)**:

```json
{
  "AETERM": "Headache",
  "AESTDTC": "2026-01-05",
  "AEONGO": false,
  "AEENDTC": "2026-01-07",
  "AESEV": "1 - MILD",
  "AESER": "N",
  "AEREL": "PROBABLE",
  "AEOUT": "RECOVERED/RESOLVED"
}
```

**AE — negative (fails contract: severity outside codelist)**:

```json
{ "AETERM": "Headache", "AESEV": "moderate-ish" }
```

Rejected: `AESEV` must be one of `CL_AESEV_CTCAE5`'s enumerated values.

**AE — boundary (ongoing, so end date must be absent, not empty-string)**:

```json
{ "AETERM": "Rash", "AEONGO": true, "AEENDTC": null }
```

Accepted only if `AEENDTC` is genuinely absent (`null`/undefined) when `AEONGO` is true — an empty string is a distinct, invalid state under this contract.

**LB — missing value using the existing null-flavor contract**:

```json
{ "LBTEST": "2160-0", "LBORRES": null, "nullFlavor": "NOT DONE" }
```

Uses `CRFField.allowNullFlavor`/`nullFlavorValue`, which already exists in `lib/crf/types.ts` — this spec reuses it rather than inventing a parallel missing-value mechanism.

**RECIST — boundary (lesion cap)**: a 6th `TARGET` lesion for one subject is rejected at the repeating-table level (max 5 target, max 2 per organ) rather than silently accepted, per RECIST 1.1.

**RECIST — negative (new lesion contradicts CR)**: `NEWLESIF = Y` with all target/non-target lesions resolved must calculate `TRRESP = PD`, never `CR`, regardless of the SLD math — the new-lesion flag overrides the size-based calculation.

## Human decisions required (summary)

1. MedDRA licensing/import strategy for `AEDECOD`/`AEBODSYS` (free-text-only vs. bring-your-own-dictionary import).
2. WHO Drug licensing/import strategy for coded `CMTRT`, same shape as above.
3. Which LOINC analyte subset to pin for the LB panel, and drafting/approving the LOINC attribution notice.
4. Baseline-derivation strategy for labs (auto vs. explicit flag) — depends on a Study Protocol visit-timepoint model this ADR does not propose.
5. UX for locking RECIST baseline lesion selection after the baseline visit (hard block vs. warn-and-log).
6. Reconciliation plan for Implementations A and B themselves: which module becomes canonical, and the migration/deprecation path for the other (a code decision for whoever implements this, not made here).

## Out of Scope / Non-Claims

- No code is implemented by this ADR.
- No clinical, regulatory, or CDISC-conformance validation is claimed for any block described here.
- No proprietary terminology (MedDRA, WHO Drug) content is bundled, vendored, or synthesized-to-resemble-real by this document or any follow-up implementing it without first resolving the licensing decisions above.
- The RECIST 1.1 threshold logic described here still requires expert (biostatistician/medical monitor) sign-off before any implementation is used for anything beyond a synthetic-data demo.

## Invariant Compliance

- **AGENTS.md Invariant #9** (Specification & API Documentation Synchronization): this ADR is the source-backed contract `#664` requested; no `lib/`, `hooks/`, or `types/` exports changed, so no TypeDoc regeneration is required by this document alone.
- **Verification**: none — this is a specification artifact with no executable surface. `npm run check-docs-drift` was run after adding this file and reports no drift.

## Consequences

### Positive

- Gives a future implementer one canonical variable set, codelist source, and repeat/baseline model per specialty domain instead of two disagreeing ones.
- Separates "clinically out of range" (`LBNRIND`) from "implausible entry" (validation bound), closing a real data-quality gap in the current LB fields.
- Makes the RECIST 1.1 overall-response calculation an explicit, testable contract instead of an unimplemented claim.
- Identifies the MedDRA/WHO-DD licensing blocker before any code tries to embed proprietary dictionary content.

### Negative / Trade-offs

- Reconciling Implementations A and B is real migration work (variable renames, codelist changes) that this ADR does not perform.
- The LB and RECIST blocks both require a `repeating_table` pattern that exists in the type system but has no working example in the codebase yet — the first implementation will be paying down that gap too.
- Several human decisions (terminology licensing, baseline UX) block a complete implementation; a partial implementation that ships only the free-text/no-dictionary paths is possible without them.
