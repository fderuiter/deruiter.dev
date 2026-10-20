# ADR 0065: Study Data Pipeline Architecture

## Status

Accepted on 2026-10-20, under the epic
[#2582](https://github.com/fderuiter/deruiter.dev/issues/2582) and its first
step [#2583](https://github.com/fderuiter/deruiter.dev/issues/2583). The CDISC
Pilot exception to the synthetic-only rule was decided on the same day in
[#2617](https://github.com/fderuiter/deruiter.dev/issues/2617). Builds on
[ADR 0036](0036-free-tier-offloading-and-provider-quota-governance.md)
(no database, no new provider),
[ADR 0056](0056-protocol-drift-architecture.md) (the seeded clinical-data
engine this follows) and
[ADR 0057](0057-open-source-acknowledgments-and-license-compliance.md)
(attributions).

## Context

The site already shows CDISC work at the collection end. CRF Studio
(`lib/crf/`) builds CDASH forms, carries controlled terminology, lints form
metadata against CDASH 2.2 and SDTMIG 3.4, exports an annotated CRF and an
SDTM mapping spec, round-trips ODM, and imports, exports and diffs USDM.
Protocol Drift (ADR 0056) tabulates two domains and derives ADVS, as a game.

Nothing takes one study from its definition through tabulation and analysis
to tables and figures. That thread is what shows SDTM, ADaM and USDM applied
together: one study defined once, with metadata, conformance and
traceability at every step.

Four constraints shape the design:

- The site runs on free tiers (ADR 0036). A pipeline run must cost nothing
  on the server, so it runs in the visitor's browser.
- The output must be checkable. Tests need golden files, and a reviewer
  needs the same bytes from the same inputs.
- CDISC Library content (full implementation guide text, CORE rule files)
  has terms of use. NCI EVS Controlled Terminology is public.
- No real patient data may appear on the site.

## Decision

### A deep module with a pure engine

`lib/study-data/` is a deep module (AGENTS.md invariant 21). `index.ts`,
`types.ts` and `presets.ts` are its public contract, and everything under
`internal/` is private. Each stage gets its own folder:

| Folder                 | Stage                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| `internal/usdm`        | Read the USDM study design: arms, epochs, visits, activities      |
| `internal/synth`       | Seeded synthetic subjects from the USDM schedule                  |
| `internal/sdtm`        | Trial design and subject domains, SUPPQUAL                        |
| `internal/conformance` | Controlled terminology and rule checks, after SDTM and after ADaM |
| `internal/adam`        | ADSL, BDS, OCCDS and time-to-event datasets                       |
| `internal/define`      | Define-XML 2.1 from the same specifications                       |
| `internal/export`      | Dataset-JSON, CSV, XPT v5 and the hashed package                  |
| `internal/tlf`         | Tables and figures linked through ARS                             |
| `internal/lineage`     | Links from each result back to its source records                 |

The engine is one pure function:

```ts
runPipeline(definition, { seed, nSubjects }): PipelineRun;
```

It has no DOM, React, Worker or network dependency. A `PipelineRun` holds
the datasets, the conformance findings and a run manifest. Mapping and
derivation specifications are typed data that the stages read, so
Define-XML is generated from the same source as the datasets and cannot
drift from them.

### A Web Worker boundary

The `/study-data` page runs the engine in a Web Worker so a large run never
blocks the main thread. The worker imports the computation directly from
`@/lib/study-data`, never the module that constructs the worker. A worker
whose import graph reaches its own constructor makes its runtime chunk start
itself ([#853](https://github.com/fderuiter/deruiter.dev/issues/853)), which
`ChunkCycleGuardPlugin` fails the build on. The pipeline code stays in the
worker chunk and loads on demand, outside the route shell's bundle budget.

### Column-oriented tables with metadata attached

Every dataset in every layer has one shape: a `Dataset` with one value array
per variable and a `VariableMeta` per column. `VariableMeta` carries name,
label, Define-XML data type, length, SDTM role, origin (Collected, Derived,
Assigned, Protocol, Predecessor, Not Available), codelist, derivation method
and predecessor source. Define-XML, Dataset-JSON, CSV and XPT are serialisers
over that one structure. Missing values are `null`.

The collected, SDTM and ADaM layers are separate datasets. Analysis values
never flow back into SDTM.

### Seeded, keyed randomness

One seeded PRNG draws every random value, keyed by the run seed plus a
stable string that names the draw (study, subject, domain, visit, variable).
This is the Protocol Drift pattern. Adding a subject or a domain does not
reroll the others, and the same definition, seed and subject count give
byte-identical outputs. The run manifest records the inputs and a SHA-256 of
every output file, and holds no timestamps.

### Pinned standard versions

`STANDARD_VERSIONS` in `presets.ts` pins every standard the pipeline applies.
The run declares them in TS (`SDTMIGVER` and similar parameters), in
Define-XML and in the manifest.

| Standard                      | Version    |
| ----------------------------- | ---------- |
| USDM                          | 4.0        |
| SDTM                          | 2.0        |
| SDTMIG                        | 3.4        |
| ADaM                          | 2.1        |
| ADaMIG                        | 1.3        |
| Define-XML                    | 2.1        |
| Dataset-JSON                  | 1.1        |
| ARS                           | 1.0        |
| NCI EVS CDISC CT package date | 2026-09-25 |

Changing a version is a controlled upgrade with an impact report across
datasets, metadata and outputs
([#2609](https://github.com/fderuiter/deruiter.dev/issues/2609)), not an edit.

### Synthetic data, with one labelled exception

The pipeline's own study, DEMO-301, is fictional and every subject is
synthetic. Every dataset, table and download says so.

The one exception is the public CDISC Pilot study (CDISCPILOT01), decided
in #2617. It is used in two places:

- **In CI**, as an outside reference. Our ADaM derivations run on its
  published SDTM and are compared with its published ADaM.
- **On the site**, as a second dataset. The page and its downloads label it
  as public, de-identified CDISC Pilot data and name the licence it is
  redistributed under.

Its licence, and that of any package it comes from, is checked before a
snapshot is vendored. If the terms do not allow redistribution, the work
stops and is raised. Nothing else that came from a real study is used.

### CDISC content licensing

The pipeline encodes only the variables, codelist terms and rules it needs,
in its own words. It cites each source by id (the implementation guide
section, the codelist's NCI code, the rule id) and does not copy guide text
or CORE rule files. Controlled terminology comes from the public NCI EVS
package named above. Attributions for CDISC standards, NCI EVS and any
vendored data go on `/acknowledgments`, following ADR 0057.

### Not a validator of record

The conformance stage models a subset of published rules. Each finding
carries the id of the rule it models and a citation. The page says the
stage is a demonstration, not a validator of record, and links to CDISC
CORE for that. Running CORE itself in CI is tracked separately
([#2603](https://github.com/fderuiter/deruiter.dev/issues/2603)).

## Consequences

- One artifact shows USDM, SDTM, ADaM, Define-XML, Dataset-JSON and ARS
  applied together, end to end and reproducibly.
- Each stage is library code with no UI, so it can be reviewed on unit tests
  and golden files before the page exists.
- A run costs nothing on the server and touches no provider quota.
- Pinned versions and the hashed manifest make every output reproducible
  and every upgrade visible.

What gets harder:

- Every variable and rule is encoded by hand. That is slower than loading
  CDISC Library content, and coverage of the standards is a deliberate
  subset.
- The worker boundary needs care: a convenience import from the page module
  into the worker chunk would create the #853 cycle, and the build fails.
- The pilot dataset is real, if de-identified, data. Its labelling and
  licence must be kept with it wherever it appears.
- Large runs (thousands of subjects) need cancellation and bounded memory in
  the worker, which is tracked in
  [#2608](https://github.com/fderuiter/deruiter.dev/issues/2608).

## Alternatives considered

- **Server-side pipeline.** It would wake Neon or need compute on every run
  and breaks ADR 0036. Nothing in the pipeline needs a server.
- **Run R or SAS in the browser (WebR).** The toolchain is familiar to the
  audience, but the download is tens of megabytes and the result is hard to
  golden-file. R is used instead as independent double programming in CI
  ([#2604](https://github.com/fderuiter/deruiter.dev/issues/2604)).
- **Row-oriented records.** Simpler to write, but every serialiser would
  rebuild columns and metadata would live apart from the data. Columns with
  metadata attached make Define-XML and the datasets one structure.
- **Load CDISC Library content through its API.** Complete, but it needs an
  API key, ties the site to CDISC Library terms and adds a provider. Encoding
  what we need, cited by id, avoids all three.
- **Extend Protocol Drift.** It is a game with its own pacing and scoring,
  and two domains. It stays the playful version and links to this pipeline.
