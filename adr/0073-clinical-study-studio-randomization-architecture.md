# ADR 0073: Clinical Study Studio Randomization Architecture and Compatibility Policy

## Status

Accepted on 2026-11-19, under epic
[#3997](https://github.com/fderuiter/deruiter.dev/issues/3997) and its
foundation ticket
[#3998](https://github.com/fderuiter/deruiter.dev/issues/3998). Builds on
[ADR 0045](0045-source-code-licensing-and-three-layer-reuse-boundary.md)
(Apache-2.0 licensing and clean-room reuse boundary),
[ADR 0036](0036-free-tier-offloading-and-provider-quota-governance.md) (no new
API, database, provider, or authentication),
[ADR 0057](0057-open-source-acknowledgments-and-license-compliance.md)
(dependency and attribution governance), and
[ADR 0065](0065-study-data-pipeline-architecture.md) (pure deep-module engine,
Web Worker isolation, and synthetic-only clinical data boundary). Coordinates
with Clinical Study Studio ownership (#3397, #3399, #3400, #3401, #3406) and
workspace v2 analysis contracts (#3423).

## Context

Clinical Study Studio needs a first-class Randomization work area supporting
permuted-block allocation, ratio-normalized minimization, bounded worker
execution, reproducible Monte Carlo QA, local artifact verification, multi-format
exports, and explicit opt-in integration into the synthetic study-data pipeline.

Prior behavioral reference exists in an AGPL-licensed standalone Angular
prototype (`equipose-randomization`, reviewed at commit `e2e540d2`). Under
[ADR 0045](0045-source-code-licensing-and-three-layer-reuse-boundary.md),
AGPL-licensed implementation code, runtime modules, and test fixtures cannot be
copied into this Apache-2.0 repository. Additionally, the host already ships
deterministic keyed FNV/Mulberry32 permuted-block allocation for DEMO-301 and
device studies in `lib/study-data/`; silently altering those outputs would break
existing golden datasets and downstream SDTM/ADaM/TLF lineage.

## Decision

### 1. Fresh clean-room implementation under ADR 0045

The randomization engine, workspace persistence, UI work area, exports, code
generators, and verification tooling are implemented fresh in TypeScript from
documented behavioral requirements. No AGPL source code, runtime libraries, or
fixtures are copied into this repository. Every new third-party dependency must
use an Apache-2.0-compatible license recorded under ADR 0057, and every numeric
test vector is independently derived and documented in
[`docs/reference/randomization-rebuild.md`](../docs/reference/randomization-rebuild.md).

### 2. Deep-module and host ownership boundaries

Each concern has a single owner with strict deep-module boundaries enforced by
`.dependency-cruiser.cjs`:

- **`lib/randomization/`** owns pure, deterministic randomization contracts,
  validation, resource preflight, PRNG/identity/digest primitives, block and
  minimization algorithms, Monte Carlo QA, export serializers, and code
  packagers. Its public entry points are `lib/randomization/index.ts` and
  `lib/randomization/types.ts`. It never imports React, Next.js, routes,
  providers, `lib/study-workspace/`, `lib/study-data/`, or Web Worker
  constructors.
- **`lib/study-workspace/`** owns the selected USDM v4 study version/design,
  immutable revision history, undo/redo operations (#3399), and revision-bound
  randomization plans. Protocol facts stay separate from simulated site rosters
  and recruitment weights; sites and recruitment assumptions are never written
  back as invented USDM facts.
- **`lib/study-data/`** owns downstream synthetic collection and SDTM/ADaM/TLF
  derivation. It consumes `lib/randomization` strictly through its public entry
  point when an explicit opt-in allocation request is supplied. Recorded `RAND`
  remains the single downstream allocation source.
- **Clinical Study Studio UI (`components/randomization/`, mounted inside the
  #3400 shell)** reuses the host React shell, scoped studio themes, lazy
  document dependencies, CSP, and Serwist service worker. No new standalone
  route, Angular runtime, HTTP API, database table, external provider, or
  authentication layer is added.

### 3. Separate algorithm identities and legacy preservation

Algorithm identity is explicit and versioned on every plan, request, and
artifact:

| Algorithm ID                   | Engine                                     | Default behavior                                                       | Legacy seed parity                               |
| ------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------ |
| `host-keyed-fnv-mulberry32-v1` | Legacy host keyed FNV-1a + Mulberry32      | Default for DEMO-301 and device pipeline runs when no opt-in is passed | Baseline                                         |
| `mt19937-block-v1`             | Pure MT19937 permuted blocks               | Explicit versioned opt-in                                              | None; same visible seed never implies row parity |
| `mt19937-minimization-v1`      | Pure MT19937 ratio-normalized minimization | Explicit versioned opt-in                                              | None; same visible seed never implies row parity |

Existing DEMO-301 and device golden outputs remain byte-identical by default.
New MT19937 algorithms never advertise row-level parity with legacy keyed draws
when given the same visible seed string.

### 4. Seed encoding, ordering, canonicalization, and artifact staleness

- **Seed encoding:** User-supplied or generated string seeds are deterministically
  compressed via UTF-8 byte encoding into a 32-bit unsigned MT19937 seed array.
  Subject identifier random tokens draw from a separate, domain-separated PRNG
  stream so identifier mask edits never perturb treatment allocations.
- **Ordering and canonicalization:** Arm, site, factor, and level identities are
  ordered arrays with stable IDs. Canonical audit payloads serialize sorted keys
  over all allocation-affecting inputs, algorithm/schema versions, and full
  generated rows (excluding mutable UI preferences such as display persona),
  hashed with SHA-256.
- **Immutable provenance and staleness:** Every generated artifact records its
  host study ID, selected study version/design IDs, workspace revision ID and
  USDM SHA-256, contract/plan/artifact schema versions, and algorithm ID. Any
  edit that advances the workspace revision or changes arm/site/factor/seed/cap
  inputs marks previously generated artifacts stale rather than silently reusing
  them.

### 5. Method eligibility, explicit cap scope, and soft block-size limits

- **Ratio validation:** Arm allocation ratios must be positive integers and are
  reduced by their greatest common divisor (GCD) before block or minimization
  scoring.
- **Method eligibility:** Discriminated request unions enforce method rules at
  compile time and runtime:
  - `BLOCK` supports `manual`, `proportional`, and `marginal` cap strategies,
    block-size pools or fixed sequences, site/intersection block-rule overrides,
    and explicit `blockSettings.trackingScope` (`BlockRuleTrackingScope`:
    `global`, `per-site`, or `per-intersection`).
  - `MINIMIZATION` supports `manual` and `marginal` cap strategies only, with
    virtual cohort size, biased-coin probability in `(0.5, 1]`, and expected
    level distributions. Block settings and proportional caps are rejected as
    unsupported combinations.
  - Unknown method strings from imported JSON are reported as validation
    findings (`UNKNOWN_METHOD`) and are never inferred into a runnable method.
- **Explicit cap scope:** Enrollment caps declare `capScope` explicitly as
  `"study-wide"` or `"per-site"`. UI, engine, local verifier, and code
  packagers read the same serialized field so study-wide and per-site semantics
  cannot diverge.
- **Soft block-size usage limits:** Per-block-size usage limits are documented
  and modeled as soft limits with an explicit
  `exhaustionPolicy: "fallback-to-original-pool"` once every configured size in
  the pool has reached its soft limit.

### 6. Coordinated workspace v2 format and resource preflight limits

Randomization plans coordinate with `#3423` (`WorkspaceAnalysisSpec`) under a
single workspace v2 envelope (`analyses` alongside `randomizationPlans`).
Editing a randomization plan never mutates an analysis estimand or win-ratio
specification automatically; pipeline integration (#4015) passes immutable
allocation evidence only.

Before expanding intersections, schedules, imports, or Monte Carlo batches, the
engine enforces overflow-safe (`BigInt`) preflight resource limits:

| Resource                             | Default limit               |
| ------------------------------------ | --------------------------- |
| Generated allocation rows            | `100,000`                   |
| Stratum intersections                | `4,096`                     |
| Treatment arms                       | `16`                        |
| Sites                                | `256`                       |
| Stratification factors               | `16`                        |
| Levels per factor                    | `64`                        |
| Imported artifact size               | `8 MiB` (`8,388,608` bytes) |
| Imported JSON nesting depth          | `64`                        |
| Monte Carlo repetitions              | `200`                       |
| Monte Carlo aggregate generated rows | `10,000,000`                |

Limits may be lowered later with measured browser capacity evidence; raising
them requires updated benchmark proof.

### 7. Honest display masking and local-only privacy

All design computation, verification, and export generation run locally in the
visitor's browser over anonymous synthetic or reference studies. Persona and
blinding toggles are display preferences only — full seeds, plans, and exported
scripts can reconstruct treatment assignments, and the studio makes no false
treatment-access, clinical-validation, or regulatory-compliance claims.

## Consequences

- Downstream leaf tickets (#3999–#4016) share one versioned contract surface,
  one set of stable validation finding codes, and one 155-requirement
  traceability register without depending on external repositories.
- Existing `lib/study-data` pipelines and golden tests remain completely
  untouched until explicit opt-in integration lands in #4015.
- Enforcing `lib/randomization/` purity in `.dependency-cruiser.cjs` guarantees
  the numerical core stays framework-free, worker-safe, and free of chunk
  cycles.
