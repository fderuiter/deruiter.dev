# Architectural Research & Technical Specification: Modularizing Case Studies Data (#3488)

## 1. Executive Summary & Context

This architectural research document defines the design, scanner integrations, and migration blueprint for **Issue #3488**:
> *"refactor(content): case-study entries in per-study modules, old file kept as a re-export"*
> (Tracked in `plans/2026-10-29-roadmap/open-issues.csv`, priority: `p3-medium`, area: `quality`).

### The Problem

The existing file [`lib/case-studies-data.ts`](../../lib/case-studies-data.ts) is a monolithic **3,154-line, 165 KB** module that serves multiple competing roles:
1. Core TypeScript data contract definitions (`CaseStudyData`, `CaseStudyCommands`, `CaseStudyPlayback`, etc.).
2. Interactive terminal sandbox command maps and playback recordings for seven distinct projects (`IMEDNET`, `DUCKDEPLOY`, `CARDIAC_RISK`, `FOUR_GLORY`, `CRF_XL`, `PROMPTOPS`, `DESIGNING_FOR_MY_BROTHER`).
3. Static content definitions for **23 production engineering case studies**, containing thousands of lines of Markdown (`editorial_content`), sanitized HTML, and embedded Mermaid diagrams (`architectural_narrative`).
4. Runtime term compiler bindings (`compileTerms` from [`lib/term-compiler.ts`](../../lib/term-compiler.ts)) mapping over the entire corpus on module initialization.

This monolithic shape presents several architectural liabilities:
- **Merge Friction Across Autonomous Agents**: Multiple active worktrees and agents modifying case studies or adding new projects must touch `lib/case-studies-data.ts`, causing frequent git conflicts.
- **Suboptimal Tree-Shaking & Bundle Weight**: Any consumer needing a single case study or type contract is forced to evaluate the entire 3,154-line module, compiling 23 long-form HTML narratives into memory.
- **Violation of Deep Module Principles**: In accordance with the repository's deep module architecture ([`lib/README.md`](../../lib/README.md) and [`.dependency-cruiser.cjs`](../../.dependency-cruiser.cjs)), cohesive domain components should be cleanly encapsulated behind small, stable public interfaces with private internal implementations.

### Primary Objectives

1. Modularize all 23 case study entries and terminal commands into per-study units within `lib/case-studies/`.
2. Maintain **100% backward compatibility**: [`lib/case-studies-data.ts`](../../lib/case-studies-data.ts) must remain as a transparent re-export facade with zero breaking changes for existing consumers.
3. Preserve all repository invariants and static analysis scanner requirements ([`scripts/mermaid-corpus.ts`](../../scripts/mermaid-corpus.ts), [`__tests__/clinical-standards-profile.test.ts`](../../__tests__/clinical-standards-profile.test.ts), [`__tests__/peer-narrative-copy.test.ts`](../../__tests__/peer-narrative-copy.test.ts), TypeDoc zero-drift, and boundary rules).
4. Establish an automated contract snapshot test suite patterned after [`__tests__/arcade-achievements-exports.test.ts`](../../__tests__/arcade-achievements-exports.test.ts) to guarantee zero export or runtime regression.

---

## 2. Analysis of the Monolithic Source (`lib/case-studies-data.ts`)

### Structure & Inventory

An exhaustive audit of [`lib/case-studies-data.ts`](../../lib/case-studies-data.ts) reveals three distinct structural layers:

```text
lib/case-studies-data.ts (3,154 lines, 165,916 bytes)
├── 1. Type Definitions (Lines 3–38)
│   ├── interface CaseStudyData
│   ├── interface CaseStudyCommandDefinition
│   ├── type CaseStudyCommands
│   ├── interface CaseStudyPlaybackStep
│   └── type CaseStudyPlayback
│
├── 2. Interactive Terminal Commands & Playback (Lines 40–658)
│   ├── IMEDNET_COMMANDS_OBJ & IMEDNET_PLAYBACK_OBJ (Lines 40–141) [Exported]
│   ├── DUCKDEPLOY_COMMANDS_OBJ & DUCKDEPLOY_PLAYBACK_OBJ (Lines 143–277) [Exported]
│   ├── CARDIAC_RISK_COMMANDS_OBJ & CARDIAC_RISK_PLAYBACK_OBJ (Lines 279–389) [Exported]
│   ├── FOUR_GLORY_COMMANDS_OBJ & FOUR_GLORY_PLAYBACK_OBJ (Lines 391–515) [Exported]
│   ├── CRF_XL_COMMANDS_OBJ & CRF_XL_PLAYBACK_OBJ (Lines 517–594) [Exported]
│   ├── PROMPTOPS_COMMANDS_OBJ & PROMPTOPS_PLAYBACK_OBJ (Lines 596–640) [Exported]
│   └── DESIGNING_FOR_MY_BROTHER_COMMANDS_OBJ & ..._PLAYBACK_OBJ (Lines 610–658) [Internal / const]
│
└── 3. Static Content Array & Runtime Compilation (Lines 660–3154)
    ├── const rawFallbackCaseStudies: CaseStudyData[] (23 Case Studies, Lines 660–3148)
    └── export const FALLBACK_CASE_STUDIES: CaseStudyData[] (Lines 3150–3154)
```

### The 23 Case Studies in Canonical Order

The fallback array must preserve the exact indexing and canonical ordering guaranteed by [ADR 0012](../../adr/0012-resilient-hybrid-case-study-fallback.md) and [ADR 0016](../../adr/0016-case-study-editorial-and-multi-platform-linkage-standard.md):

| Index | Slug | Title | Has CLI Commands | Language / Stack |
| :--- | :--- | :--- | :---: | :--- |
| 1 | `clinical-data-mapper` | Clinical Data Mapper: From ODM to SDTM | No | TypeScript |
| 2 | `cadence-clinical` | Cadence: Deterministic Clinical Trial Execution | No | Rust / WebAssembly |
| 3 | `imednet-python-sdk` | iMednet Python SDK & EDC Automation Engine | **Yes** | Python |
| 4 | `wedding-website` | Our Wedding Website: A Registry, a Heart, and a Lapsed Domain | No | TypeScript |
| 5 | `schemaflow` | SchemaFlow: Collaborative JSON Schema Studio | No | TypeScript / React |
| 6 | `hono-kiln` | Hono-Kiln: Edge-First Microservice Runtime | No | TypeScript / Hono |
| 7 | `inbody-qr-decoder` | InBody QR Decoder: Deterministic Biomedical Metric Ingestion | No | TypeScript |
| 8 | `polyglot-tsp` | Polyglot TSP: Algorithmic Verification Across 50+ Languages | No | Polyglot |
| 9 | `oxidizemath` | OxidizeMath: Verified Numerical Computation Engine | No | Rust |
| 10 | `ualbf` | UALBF: Fast Cyclotomic Bipartite Sieve & Obstruction Engine | No | Rust / Lean 4 |
| 11 | `sortify` | Sortify: Air-Gapped Intelligent Document Classification | No | Python |
| 12 | `laser-loon` | Laser Loon: Retro Vector Graphics Simulation | No | TypeScript / Canvas |
| 13 | `sonos-network-controller`| Sonos Topology Controller & Zone Discovery Engine | No | Go |
| 14 | `clintrials` | ClinTrials: Clinical Data Standard Ingestion & Query CLI | No | Python |
| 15 | `equipose-randomization` | Equipose: Reproducible Clinical Trial Randomization | No | Angular / TypeScript |
| 16 | `lambda-wave` | LambdaWave: Real-Time Audio DSP Workstation | No | C++ / WebAudio |
| 17 | `duckdeploy` | DuckDeploy: GitOps Pipeline & Container Orchestrator | **Yes** | Rust |
| 18 | `cardiac-risk-modeling` | Cardiac Risk Modeling: MCMC Survival Analysis | **Yes** | Python / Pyodide |
| 19 | `4glory` | 4Glory: High-Throughput Esports Tournament Platform | **Yes** | Go / Next.js |
| 20 | `crf-xl` | CRF-XL: Universal Case Report Form Compiler | **Yes** | TypeScript |
| 21 | `promptops` | PromptOps: Evaluated LLM Prompt CI/CD Harness | **Yes** | TypeScript / Python |
| 22 | `designing-for-my-brother`| Designing for My Brother: Dyslexia Typography System | **Yes** | TypeScript / CSS |
| 23 | `study-data-pipeline` | Study Data Pipeline: USDM to SDTM, ADaM and TLFs | No | TypeScript / Web Worker |

### Exported Runtime & Type Surface

An inspection via `Object.keys()` confirms that [`lib/case-studies-data.ts`](../../lib/case-studies-data.ts) exports exactly **13 runtime symbols** and **5 TypeScript type contracts**:

- **Runtime Symbols (13)**:
  `CARDIAC_RISK_COMMANDS_OBJ`, `CARDIAC_RISK_PLAYBACK_OBJ`, `CRF_XL_COMMANDS_OBJ`, `CRF_XL_PLAYBACK_OBJ`, `DUCKDEPLOY_COMMANDS_OBJ`, `DUCKDEPLOY_PLAYBACK_OBJ`, `FALLBACK_CASE_STUDIES`, `FOUR_GLORY_COMMANDS_OBJ`, `FOUR_GLORY_PLAYBACK_OBJ`, `IMEDNET_COMMANDS_OBJ`, `IMEDNET_PLAYBACK_OBJ`, `PROMPTOPS_COMMANDS_OBJ`, `PROMPTOPS_PLAYBACK_OBJ`.
- **TypeScript Types (5)**:
  `CaseStudyCommandDefinition`, `CaseStudyCommands`, `CaseStudyData`, `CaseStudyPlayback`, `CaseStudyPlaybackStep`.

Any refactoring must guarantee 100% preservation of all 13 runtime symbols and 5 type contracts.

---

## 3. Prior Art & Architectural Precedents in the Repository

The repository contains two direct, battle-tested refactoring precedents for deep-module extraction:

### Precedent 1: Arcade Achievements Modularization (#3489, commit `aed32540`)

In commit `aed32540b9c86b80cf3e6b5670663046d9511c51`, the 863-line monolithic [`lib/arcade-achievements.ts`](../../lib/arcade-achievements.ts) was refactored into domain-grouped modules under `lib/arcade/achievements/`:
- **Module Structure**: Created `lib/arcade/achievements/types.ts`, per-game definition modules (`clinical-chaos.ts`, `laser-loon.ts`, `working-with-duck.ts`, etc.), and a central aggregator `lib/arcade/achievements/index.ts`.
- **Backward-Compatible Facade**: Kept `lib/arcade-achievements.ts` as a clean facade re-exporting the public symbols from `@/lib/arcade`.
- **Verification Invariant**: Added a contract snapshot test suite ([`__tests__/arcade-achievements-exports.test.ts`](../../__tests__/arcade-achievements-exports.test.ts)) asserting:
  1. `Object.keys(mod).sort()` matches the exact expected symbol array.
  2. Function signatures and parameter lengths remain intact.
  3. `expectTypeOf<...>()` verifies TypeScript interface properties.
  4. Complete `ARCADE_TROPHIES` array equality (`toEqual`) with preserved ordering.

### Precedent 2: Proof Workspace & Deep Module Boundary (#3491, commit `7385a58d`)

In commit `7385a58d3b06c0658629364f50ac8c8ae2893939`, the proof utility functions were relocated behind [`lib/proof/index.ts`](../../lib/proof/index.ts) with internal logic encapsulated in [`lib/proof/internal/proof-utils.ts`](../../lib/proof/internal/proof-utils.ts):
- **Deep Module Boundary**: Aligned with [`.dependency-cruiser.cjs`](../../.dependency-cruiser.cjs) by placing private logic at depth 3 (`lib/proof/internal/`), preventing external consumers from bypassing the public entry point.
- **Coverage Invariant Synchronization**: Updated [`vitest.config.mts`](../../vitest.config.mts) `coverage.exclude` to include `"lib/proof/index.ts"`, satisfying Invariant #1 in [`AGENTS.md`](../../AGENTS.md).

---

## 4. Theoretical Foundations & Primary Sources

### Deep Modules & Information Hiding

John Ousterhout, in *A Philosophy of Software Design* (2018), articulates the core deep-module thesis:
> *"The best modules are those whose interfaces are much simpler than their implementations... A deep module provides powerful capabilities through a simple interface. A shallow module is one whose interface is relatively complex in comparison to the functionality that it provides."*

Applying this to case studies data:
- **Shallow Design (Current)**: A monolithic file forcing callers to understand 3,154 lines of mixed concerns (types, CLI payloads, raw data, terminology compilation).
- **Deep Design (Target)**: A cohesive package `lib/case-studies/` exposing narrow, high-utility entry points (`index.ts`, `types.ts`) while encapsulating individual study metadata, terminal JSON payloads, and compilation logic inside private internal modules.

### Next.js, Turbopack & Tree-Shaking Mechanics

Next.js architecture documentation highlights the operational cost of large content barrels:
- Monolithic data files force AST parsing and module evaluation of thousands of lines of unneeded text during static site generation (SSG) and incremental static regeneration (ISR).
- When per-study modules are isolated, route entrypoints (such as `/work/laser-loon` or `/case-studies/wedding-website`) can import specific study definitions directly or dynamically, enabling the bundler to discard unreferenced case studies from client hydration chunks.
- Isolating types into a dedicated `types.ts` entry point enables TypeScript `import type` elision, ensuring zero runtime code is pulled into lightweight consumers such as [`lib/blog/related.ts`](../../lib/blog/related.ts).

### Architectural Decision Records (ADRs)

- **[ADR 0012: Resilient Hybrid Fallback Data Architecture](../../adr/0012-resilient-hybrid-case-study-fallback.md)**: Establishes that case studies must statically resolve through fallback data when the production PostgreSQL database is unavailable or unseeded. The union contract in `CaseStudyService` relies directly on `FALLBACK_CASE_STUDIES`.
- **[ADR 0016: Case Study Editorial Standard](../../adr/0016-case-study-editorial-and-multi-platform-linkage-standard.md)**: Governs the mandatory fields (`github_url`, `primary_language`, `architectural_narrative`, `editorial_content`) that every case study must satisfy.
- **[ADR 0047: Peer Engineering Narrative](../../adr/0047-peer-engineering-narrative-and-dual-layer-perspective.md)**: Mandates that all user-facing copy in case studies maintain a peer engineering voice with zero deprecated job-seeking phrases.

---

## 5. Comprehensive Scanner & Consumer Impact Analysis

A major risk in modularizing `lib/case-studies-data.ts` is breaking repository-specific static analysis scanners, CI gates, and consumer services that inspect file paths or imports. The table below details all affected systems and required actions:

| Subsystem / Scanner | Location | Current Behavior & Dependency | Failure Mode if Not Addressed | Required Architectural Remediation |
| :--- | :--- | :--- | :--- | :--- |
| **Clinical Standards Profile Gate** | [`__tests__/clinical-standards-profile.test.ts`](../../__tests__/clinical-standards-profile.test.ts) | Scans `lib/` for clinical version declarations (e.g. `Define-XML 2.1`, `SDTMIG v3.3`). Has hardcoded `exempt` set containing `"lib/case-studies-data.ts"`. | Moving clinical case studies (`cadence-clinical.ts`, `study-data-pipeline.ts`) to new files in `lib/` causes this test to fail fast on detected version strings. | Update `exempt` evaluation in test: allow `path.startsWith("lib/case-studies/")` alongside explicit exempt paths. |
| **Peer Narrative Copy Auditor (ADR 0047)** | [`__tests__/peer-narrative-copy.test.ts`](../../__tests__/peer-narrative-copy.test.ts) | Audits files for banned recruiter phrasing. Hardcodes `SCANNED_FILES` including `"lib/case-studies-data.ts"`. | If case studies move out of `lib/case-studies-data.ts` and into a subfolder not covered by `SCANNED_DIRS`, new copy escapes ADR 0047 scanning. | Add `"lib/case-studies"` to `SCANNED_DIRS` (alongside `"lib/blog"`), and keep `"lib/case-studies-data.ts"` in `SCANNED_FILES`. |
| **Mermaid Corpus Validator** | [`scripts/mermaid-corpus.ts`](../../scripts/mermaid-corpus.ts) & [`__tests__/mermaid-corpus.test.ts`](../../__tests__/mermaid-corpus.test.ts) | Extracts and renders static Mermaid blocks. Asserts an exact total of **51 diagrams**. `lib/case-studies-data.ts` supplies **24 of the 51 blocks**. | If `lib/case-studies-data.ts` becomes a re-export without inline blocks, extracted blocks drop to 27, and `mermaid-corpus.test.ts` fails immediately. | Update `CORPUS_FILES` in `scripts/mermaid-corpus.ts` to include the new per-study files (or scan `lib/case-studies/`), ensuring all 51 blocks are extracted. |
| **Architectural Doctor & Route Parity** | [`lib/dx/doctor.ts`](../../lib/dx/doctor.ts) | Checks dynamic case study slugs against `FALLBACK_CASE_STUDIES.some(...)`. | Fails if `FALLBACK_CASE_STUDIES` is missing or malformed. | Ensure `lib/case-studies-data.ts` re-exports `FALLBACK_CASE_STUDIES`. Passes cleanly with zero changes. |
| **Prisma Database Seeder** | [`prisma/seed.ts`](../../prisma/seed.ts) & [`__tests__/helpers/seed-payloads.ts`](../../__tests__/helpers/seed-payloads.ts) | Imports all 12 command and playback objects from `"../lib/case-studies-data"`. Uses `SEED_PAYLOAD_STUB_NAMES` for testing. | Import errors or test stub failure if command objects are renamed or omitted. | Re-export all 12 objects from `lib/case-studies/index.ts` and `lib/case-studies-data.ts`. |
| **Terminology Compiler & Verifier** | [`scripts/verify-terms.ts`](../../scripts/verify-terms.ts) | Evaluates glossary `<span data-term>` attributes across `FALLBACK_CASE_STUDIES`. | Term validation errors if compiled strings drift. | Retain exact `compileTerms` transformation during fallback creation. |
| **LLMs Manifest Generator (ADR 0053)** | [`scripts/generate-llms-txt.ts`](../../scripts/generate-llms-txt.ts) | Reads `FALLBACK_CASE_STUDIES` to generate `/public/llms.txt` and `llms-full.txt`. | Output drift in machine-readable manifests. | Backward compatibility re-export ensures identical manifest output. |
| **CaseStudyService & Route Handlers** | [`lib/services/case-study-service.ts`](../../lib/services/case-study-service.ts), `app/case-studies/[slug]/...` | Provides fallback resolution for detail pages, search APIs, and OpenGraph social images. | Broken builds or 404s if `FALLBACK_CASE_STUDIES` is incomplete. | Preserves full array order and slug parity. |
| **TypeDoc Zero-Drift Governance** | [`scripts/compile-docs.ts`](../../scripts/compile-docs.ts), [`scripts/check-drift.ts`](../../scripts/check-drift.ts) | Compiles documentation with `--treatWarningsAsErrors` across all expanded `lib/` files. | TypeDoc warnings on broken `@link`, unescaped HTML, or missing exports trigger CI failure. | Format JSDoc comments to avoid unescaped JSX tags, comply with MD029/MD033, and export referenced interfaces. |
| **Vitest Coverage Exclusions** | [`vitest.config.mts`](../../vitest.config.mts) | Enforces 80% coverage floors across `lib/**`. Barrel indexes and type files must be excluded (Invariant #1). | Barrel boilerplate skews coverage metrics, failing CI coverage gates. | Add `"lib/case-studies/types.ts"` and `"lib/case-studies/index.ts"` to `coverage.exclude` in `vitest.config.mts`. |
| **Deep-Module Boundary Linter** | [`.dependency-cruiser.cjs`](../../.dependency-cruiser.cjs) | Enforces that outside code only imports package root entry points (depth 2), never subfolders (depth 3+). | `entrypoint-boundary-from-app` fails if app code deep-imports `lib/case-studies/studies/*`. | All public access flows through `lib/case-studies/index.ts` or `lib/case-studies/types.ts`. |

---

## 6. Architectural Evaluation & Trade-Off Analysis

### Option A: Direct Flat Folder (`lib/case-studies/*.ts`)

- **Structure**: Place all 23 studies directly under `lib/case-studies/` (e.g. `lib/case-studies/laser-loon.ts`).
- **Dependency Cruiser Interaction**: Under [`.dependency-cruiser.cjs`](../../.dependency-cruiser.cjs), `PACKAGE_INTERNALS = "^lib/[^/]+/[^/]+/"`. Files at depth 2 (`lib/<pkg>/<file>.ts`) are treated as **public entry points**.
- **Assessment**: Exposing 23 public entry points violates the "small public surface" deep module invariant. It turns implementation files into public entry points without encapsulation.
- **Verdict**: **Rejected**.

### Option B: Subfolder Encapsulation (`lib/case-studies/studies/*.ts` or `data/*.ts`)

- **Structure**:
  ```text
  lib/case-studies/
  ├── index.ts              # Public Entry Point (depth 2)
  ├── types.ts              # Public Type Contracts (depth 2)
  ├── compiler.ts           # Private helper / compiler (depth 2 or subfolder)
  └── studies/              # Encapsulated implementation (depth 3, strictly private)
      ├── clinical-data-mapper.ts
      ├── duckdeploy.ts
      └── ... (23 files)
  ```
- **Dependency Cruiser Interaction**: Files under `lib/case-studies/studies/` are at depth 3 (`^lib/[^/]+/[^/]+/`), which `.dependency-cruiser.cjs` automatically enforces as private package internals. External code (such as `app/`, `components/`, or `__tests__/`) can only reach them through `lib/case-studies/index.ts`.
- **Assessment**: Perfectly aligns with the deep module pattern used in `lib/crf/internal/`, `lib/study-data/internal/`, and `lib/arcade/achievements/`.
- **Verdict**: **Recommended**.

### Co-locating Terminal Commands vs. Dedicated Commands Folder

- **Co-location Pattern**: Place `DUCKDEPLOY_COMMANDS_OBJ` and `DUCKDEPLOY_PLAYBACK_OBJ` inside `lib/case-studies/studies/duckdeploy.ts`.
- **Centralized Pattern**: Keep all commands in a detached `lib/case-studies/commands.ts`.
- **Trade-Off**: Co-location ensures that when an engineer modifies a case study, its interactive terminal commands, descriptions, and mock outputs remain cohesive in a single file. Tree-shaking is maximized because importing `duckdeploy.ts` only bundles the commands for that specific project.
- **Verdict**: **Co-locate inside per-study modules**, re-exporting the 12 public objects from `lib/case-studies/index.ts` and `lib/case-studies-data.ts`.

### Term Compilation: Per-Study vs. Aggregated Mapping

- **Aggregated Mapping**: Export raw data from each study, and have `index.ts` run `.map(cs => ({ ...cs, editorial_content: compileTerms(...) }))`.
- **Per-Study Compilation**: Have each study export its compiled `CaseStudyData` directly using a shared `compileCaseStudy(...)` utility.
- **Trade-Off**: Per-study compilation ensures that if an individual study is imported directly by an internal tool or sub-package, its text is guaranteed to have compiled terminology tooltips without relying on `index.ts`.
- **Verdict**: **Compile per study** via a helper function, guaranteeing that each exported study object is complete and self-contained.

---

## 7. Recommended Target Architecture

### Directory Topology

```text
lib/case-studies/
├── index.ts                      # Primary public entry point
├── types.ts                      # Public TypeScript contracts
├── compiler.ts                   # Case study term compilation utility
└── studies/                      # Private internal study definitions
    ├── clinical-data-mapper.ts
    ├── cadence-clinical.ts
    ├── imednet-python-sdk.ts    # Contains IMEDNET_COMMANDS_OBJ & PLAYBACK
    ├── wedding-website.ts
    ├── schemaflow.ts
    ├── hono-kiln.ts
    ├── inbody-qr-decoder.ts
    ├── polyglot-tsp.ts
    ├── oxidizemath.ts
    ├── ualbf.ts
    ├── sortify.ts
    ├── laser-loon.ts
    ├── sonos-network-controller.ts
    ├── clintrials.ts
    ├── equipose-randomization.ts
    ├── lambda-wave.ts
    ├── duckdeploy.ts             # Contains DUCKDEPLOY_COMMANDS_OBJ & PLAYBACK
    ├── cardiac-risk-modeling.ts  # Contains CARDIAC_RISK_COMMANDS_OBJ & PLAYBACK
    ├── 4glory.ts                 # Contains FOUR_GLORY_COMMANDS_OBJ & PLAYBACK
    ├── crf-xl.ts                 # Contains CRF_XL_COMMANDS_OBJ & PLAYBACK
    ├── promptops.ts              # Contains PROMPTOPS_COMMANDS_OBJ & PLAYBACK
    ├── designing-for-my-brother.ts # Contains DESIGNING_FOR_MY_BROTHER CLI objects
    └── study-data-pipeline.ts

lib/case-studies-data.ts         # Backward-compatibility facade (re-exports index.ts)
```

### Module Specifications

#### 1. `lib/case-studies/types.ts`
Exports the public interfaces:
- `CaseStudyData`
- `CaseStudyCommandDefinition`
- `CaseStudyCommands`
- `CaseStudyPlaybackStep`
- `CaseStudyPlayback`

#### 2. `lib/case-studies/compiler.ts`
Wraps `compileTerms`:
```typescript
import { compileTerms } from "../term-compiler";
import type { CaseStudyData } from "./types";

export function compileCaseStudy(raw: CaseStudyData): CaseStudyData {
  return {
    ...raw,
    editorial_content: compileTerms(raw.editorial_content),
    architectural_narrative: compileTerms(raw.architectural_narrative),
  };
}
```

#### 3. Individual Study Module (Example: `lib/case-studies/studies/duckdeploy.ts`)
```typescript
import { compileCaseStudy } from "../compiler";
import type { CaseStudyCommands, CaseStudyData, CaseStudyPlayback } from "../types";

export const DUCKDEPLOY_COMMANDS_OBJ: CaseStudyCommands = {
  "duckdeploy schema validate --spec ./deployment-schema.json": {
    description: "Validates dynamic JSON Schema AST integrity and checks for recursive reference cycles.",
    payload: { status: "VALID", schemaVersion: "draft-2020-12", nodesParsed: 142 },
  },
  // ... remaining commands
};

export const DUCKDEPLOY_PLAYBACK_OBJ: CaseStudyPlayback = [
  { command: "duckdeploy schema validate --spec ./deployment-schema.json", description: "Validate schema AST" },
  // ... remaining playback steps
];

export const duckDeployCaseStudy: CaseStudyData = compileCaseStudy({
  id: "canonical-17",
  slug: "duckdeploy",
  title: "DuckDeploy: GitOps Pipeline & Zero-Downtime Orchestrator",
  primary_language: "Rust",
  github_url: "https://github.com/fderuiter/duckdeploy",
  published: true,
  simulated_telemetry: false,
  tags: "Rust, Docker, Kubernetes, GitOps, CI/CD, Container Runtime, AST Parser",
  editorial_content: "...",
  architectural_narrative: `...`,
  commands_json: JSON.stringify(DUCKDEPLOY_COMMANDS_OBJ),
  playback_json: JSON.stringify(DUCKDEPLOY_PLAYBACK_OBJ),
  created_at: new Date("2026-09-08T00:00:00Z"),
  updated_at: new Date("2026-09-08T00:00:00Z"),
});
```

#### 4. `lib/case-studies/index.ts`
```typescript
/**
 * Case Studies Data & Registry Module
 *
 * Provides typed definitions, fallback data, and sandbox terminal configurations
 * for all portfolio case studies (#3488).
 */

export * from "./types";
export { compileCaseStudy } from "./compiler";

// Re-export command & playback objects for backward compatibility with prisma/seed.ts
export { IMEDNET_COMMANDS_OBJ, IMEDNET_PLAYBACK_OBJ } from "./studies/imednet-python-sdk";
export { DUCKDEPLOY_COMMANDS_OBJ, DUCKDEPLOY_PLAYBACK_OBJ } from "./studies/duckdeploy";
export { CARDIAC_RISK_COMMANDS_OBJ, CARDIAC_RISK_PLAYBACK_OBJ } from "./studies/cardiac-risk-modeling";
export { FOUR_GLORY_COMMANDS_OBJ, FOUR_GLORY_PLAYBACK_OBJ } from "./studies/4glory";
export { CRF_XL_COMMANDS_OBJ, CRF_XL_PLAYBACK_OBJ } from "./studies/crf-xl";
export { PROMPTOPS_COMMANDS_OBJ, PROMPTOPS_PLAYBACK_OBJ } from "./studies/promptops";

// Re-export individual case studies
export { clinicalDataMapperCaseStudy } from "./studies/clinical-data-mapper";
export { cadenceClinicalCaseStudy } from "./studies/cadence-clinical";
// ... (export remaining 21 case studies)

// Aggregate fallback registry in canonical order
export const FALLBACK_CASE_STUDIES: CaseStudyData[] = [
  clinicalDataMapperCaseStudy,
  cadenceClinicalCaseStudy,
  imednetPythonSdkCaseStudy,
  weddingWebsiteCaseStudy,
  schemaflowCaseStudy,
  honoKilnCaseStudy,
  inbodyQrDecoderCaseStudy,
  polyglotTspCaseStudy,
  oxidizemathCaseStudy,
  ualbfCaseStudy,
  sortifyCaseStudy,
  laserLoonCaseStudy,
  sonosNetworkControllerCaseStudy,
  clintrialsCaseStudy,
  equiposeRandomizationCaseStudy,
  lambdaWaveCaseStudy,
  duckDeployCaseStudy,
  cardiacRiskModelingCaseStudy,
  fourGloryCaseStudy,
  crfXlCaseStudy,
  promptopsCaseStudy,
  designingForMyBrotherCaseStudy,
  studyDataPipelineCaseStudy,
];
```

#### 5. `lib/case-studies-data.ts` (Backward-Compatibility Facade)
```typescript
/**
 * Case Study Data Fallbacks & Terminal Payloads
 *
 * Re-exports the case study catalog and terminal sandbox commands
 * modularized by study under `lib/case-studies/` (#3488).
 */

export {
  CARDIAC_RISK_COMMANDS_OBJ,
  CARDIAC_RISK_PLAYBACK_OBJ,
  CRF_XL_COMMANDS_OBJ,
  CRF_XL_PLAYBACK_OBJ,
  DUCKDEPLOY_COMMANDS_OBJ,
  DUCKDEPLOY_PLAYBACK_OBJ,
  FALLBACK_CASE_STUDIES,
  FOUR_GLORY_COMMANDS_OBJ,
  FOUR_GLORY_PLAYBACK_OBJ,
  IMEDNET_COMMANDS_OBJ,
  IMEDNET_PLAYBACK_OBJ,
  PROMPTOPS_COMMANDS_OBJ,
  PROMPTOPS_PLAYBACK_OBJ,
  type CaseStudyCommandDefinition,
  type CaseStudyCommands,
  type CaseStudyData,
  type CaseStudyPlayback,
  type CaseStudyPlaybackStep,
} from "./case-studies";
```

---

## 8. Testing Strategy & Verification Invariants

To guarantee absolute parity and prevent regressions, the implementation must be accompanied by a dedicated export contract test:
`__tests__/case-studies-exports.test.ts`

### Contract Test Structure

```typescript
import { describe, expect, expectTypeOf, it } from "vitest";
import * as legacyCaseStudiesData from "@/lib/case-studies-data";
import * as newCaseStudies from "@/lib/case-studies";
import type {
  CaseStudyData,
  CaseStudyCommands,
  CaseStudyPlayback,
} from "@/lib/case-studies";

describe("lib/case-studies export contract & parity snapshot (#3488)", () => {
  it("exports the exact set of runtime symbols from legacy facade", () => {
    expect(Object.keys(legacyCaseStudiesData).sort()).toEqual([
      "CARDIAC_RISK_COMMANDS_OBJ",
      "CARDIAC_RISK_PLAYBACK_OBJ",
      "CRF_XL_COMMANDS_OBJ",
      "CRF_XL_PLAYBACK_OBJ",
      "DUCKDEPLOY_COMMANDS_OBJ",
      "DUCKDEPLOY_PLAYBACK_OBJ",
      "FALLBACK_CASE_STUDIES",
      "FOUR_GLORY_COMMANDS_OBJ",
      "FOUR_GLORY_PLAYBACK_OBJ",
      "IMEDNET_COMMANDS_OBJ",
      "IMEDNET_PLAYBACK_OBJ",
      "PROMPTOPS_COMMANDS_OBJ",
      "PROMPTOPS_PLAYBACK_OBJ",
    ]);
  });

  it("mirrors runtime objects identically between facade and module", () => {
    expect(legacyCaseStudiesData.FALLBACK_CASE_STUDIES).toBe(
      newCaseStudies.FALLBACK_CASE_STUDIES
    );
    expect(legacyCaseStudiesData.DUCKDEPLOY_COMMANDS_OBJ).toBe(
      newCaseStudies.DUCKDEPLOY_COMMANDS_OBJ
    );
  });

  it("preserves exact length and slug ordering across 23 case studies", () => {
    expect(newCaseStudies.FALLBACK_CASE_STUDIES).toHaveLength(23);
    const slugs = newCaseStudies.FALLBACK_CASE_STUDIES.map((c) => c.slug);
    expect(slugs).toEqual([
      "clinical-data-mapper",
      "cadence-clinical",
      "imednet-python-sdk",
      "wedding-website",
      "schemaflow",
      "hono-kiln",
      "inbody-qr-decoder",
      "polyglot-tsp",
      "oxidizemath",
      "ualbf",
      "sortify",
      "laser-loon",
      "sonos-network-controller",
      "clintrials",
      "equipose-randomization",
      "lambda-wave",
      "duckdeploy",
      "cardiac-risk-modeling",
      "4glory",
      "crf-xl",
      "promptops",
      "designing-for-my-brother",
      "study-data-pipeline",
    ]);
  });

  it("preserves TypeScript type contracts", () => {
    expectTypeOf<CaseStudyData>().toHaveProperty("id");
    expectTypeOf<CaseStudyData>().toHaveProperty("slug");
    expectTypeOf<CaseStudyData>().toHaveProperty("editorial_content");
    expectTypeOf<CaseStudyData>().toHaveProperty("architectural_narrative");
    expectTypeOf<CaseStudyCommands>().toBeObject();
    expectTypeOf<CaseStudyPlayback>().toBeArray();
  });
});
```

---

## 9. Implementation Roadmap & Execution Checklist

When implementing Issue #3488, the following phased sequence guarantees that all gates pass cleanly:

### Phase 1: Package Scaffolding & Foundation
- [ ] Create `lib/case-studies/types.ts` with all 5 type definitions.
- [ ] Create `lib/case-studies/compiler.ts` with `compileCaseStudy(...)`.
- [ ] Update [`vitest.config.mts`](../../vitest.config.mts) `coverage.exclude` to include:
  - `"lib/case-studies/types.ts"`
  - `"lib/case-studies/index.ts"`

### Phase 2: Per-Study Extraction
- [ ] Create `lib/case-studies/studies/` directory.
- [ ] Extract each of the 23 case studies into its own `<slug>.ts` module.
- [ ] Co-locate the corresponding `_COMMANDS_OBJ` and `_PLAYBACK_OBJ` in the 7 interactive study files.
- [ ] Ensure all dates, tags, and strings are copied with byte-for-byte fidelity.

### Phase 3: Aggregator & Facade
- [ ] Create `lib/case-studies/index.ts` re-exporting types, command objects, individual studies, and `FALLBACK_CASE_STUDIES`.
- [ ] Replace [`lib/case-studies-data.ts`](../../lib/case-studies-data.ts) contents with the re-export facade.

### Phase 4: Scanner & Gate Synchronization
- [ ] **Clinical Standards Profile Gate**: In [`__tests__/clinical-standards-profile.test.ts`](../../__tests__/clinical-standards-profile.test.ts), update the `exempt` evaluation to exempt paths starting with `"lib/case-studies/"`.
- [ ] **Peer Narrative Copy Auditor**: In [`__tests__/peer-narrative-copy.test.ts`](../../__tests__/peer-narrative-copy.test.ts), add `"lib/case-studies"` to `SCANNED_DIRS`.
- [ ] **Mermaid Corpus Validator**: In [`scripts/mermaid-corpus.ts`](../../scripts/mermaid-corpus.ts), expand `CORPUS_FILES` (or add directory resolution) to include all case studies containing Mermaid diagrams, verifying that `__tests__/mermaid-corpus.test.ts` continues finding exactly 51 blocks.

### Phase 5: Verification & Quality Gate Validation
- [ ] Add `__tests__/case-studies-exports.test.ts` export snapshot test.
- [ ] Run `npm run check` (typecheck, lint, and `depcruise` boundary enforcement).
- [ ] Run `npm run check-docs-drift` (TypeDoc compilation with warnings as errors).
- [ ] Run `npm test` (all unit and integration tests).
- [ ] Run `npm run verify` (full DX Doctor diagnostic suite).
