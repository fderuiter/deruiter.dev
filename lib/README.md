# TS Deep Modules & Architectural Seams (`lib/`)

Modules in `lib/` are structured as **Deep Modules**: a lot of rich behaviour behind a small, well-typed interface placed at a clean seam.

---

## 1. Directory Structure & Boundary Invariants

Every module package under `lib/` (e.g., `lib/crf/`, `lib/laser-loon/`, `lib/neuro/`, `lib/arcade/`, `lib/clinical-trial-chaos/`, `lib/study-data/`, `lib/services/`) follows depth-based encapsulation:

```text
lib/
  <package-name>/
    index.ts          ← Main public entry point.
    presets.ts        ← Secondary public entry point (optional).
    types.ts          ← Type contracts entry point (optional).
    internal/         ← Private implementation (hidden from outside).
    presets/          ← Private package subfolder (hidden from outside).
    core/             ← Private package subfolder (hidden from outside).
```

`lib/crf/` has the same shape as `lib/study-data/`: `index.ts`, `types.ts` and `presets.ts` are its public files, and the implementation lives in `lib/crf/internal/`. Two more root files, `export-pdf.ts` and `export-docx.ts`, are lazy entry points: the studio loads them with a dynamic `import()` so their document libraries stay out of the route's first bundle, and the index does not re-export them (#2927).

`lib/clinical-standards/` holds what CRF Studio and the study-data pipeline share: the standards profile, the USDM v4 types, schema and schedule, and both controlled-terminology subsets. `lib/crf/` and `lib/study-data/` each import it and never import each other (#2927).

`lib/study-workspace/` holds a USDM study open for work: the original document, the study version and design chosen for work, and immutable revisions (epic #3071). It also holds the two device reference studies that complement DEMO-301: the single-arm TAVR study (`TAVR_DEVICE_USDM`) and the randomised TAVR versus SAVR trial analysed by win ratio (`TAVR_SAVR_USDM`). It depends on `lib/clinical-standards` only.

A module with several pipeline stages keeps one private folder per stage under `internal/`. `lib/study-data/` ([ADR 0065](../adr/0065-study-data-pipeline-architecture.md)) is the reference: `internal/usdm`, `internal/synth`, `internal/sdtm`, `internal/conformance`, `internal/adam`, `internal/define`, `internal/export`, `internal/tlf` and `internal/lineage`, all reached only through `runPipeline` and the types and presets at the package root.

### The 6 Canonical Boundary Rules (`.dependency-cruiser.cjs`)

1. **Root Entry Points Are the Only Public Surface (`entrypoint-boundary-from-app`)**:
   Outside code (`app/`, `components/`, `scripts/`, and root files directly under `lib/` such as `lib/env.ts`) may only import from root files directly under `lib/<package>/` (e.g., `import { evaluateFormula } from "@/lib/crf"` or `import { STUDY_PRESETS } from "@/lib/crf/presets"`). Importing directly into subfolders (e.g., `@/lib/crf/presets/oncology-recist`) is strictly forbidden.

2. **Intra-Module Freedom with Inter-Module Seams (`entrypoint-boundary-across-packages`)**:
   Files within a package (e.g., `lib/crf/*`) can import each other freely. When crossing package boundaries (e.g., `lib/laser-loon/` importing from `lib/arcade/`), access must go through the other package's public root entry point (`@/lib/arcade`), never its internal subfolders.

3. **Tests Exercise Modules Through Entry Points (`tests-through-entrypoints`)**:
   Unit and integration tests (`__tests__/`, and a package's own `lib/<pkg>/tests/`) must test behavior through public module entry points. Tests cannot reach into private internals or subfolders, except a package's own local fixtures under `lib/<pkg>/tests/`.

4. **Test Fixtures Stay Private to Tests (`tests-folder-is-private`)**:
   A package's `lib/<pkg>/tests/` folder is reachable only from tests (`__tests__/` or another `lib/<pkg>/tests/` folder). Production code may not import test fixtures.

5. **Trial & Error Isolation (`trial-and-error-isolation`)**:
   Trial & Error (ADR 0046) shares no code with Clinical Trial Chaos or CRF Studio, directly or through anything it transitively imports.

6. **Zero Circular Dependencies (`no-circular`)**:
   No dependency cycles (`A → B → A` or `A → B → C → A`) are allowed anywhere across the workspace.

---

## 2. Entry Points vs. Monolithic Barrels

Do not funnel everything into a monolithic 5,000-line `index.ts`. A module may expose multiple distinct root entry points:

- `lib/<pkg>/index.ts` (primary API)
- `lib/<pkg>/types.ts` (public types)
- `lib/<pkg>/presets.ts` (catalog / presets)

Subfolder internals remain private regardless of how many root entry points exist.

`lib/clinical-platform/` ([ADR 0066](../adr/0066-clinical-data-platform-architecture.md)) follows the same shape with one private folder per stage under `internal/` (the ADR lists them), reached only through `index.ts`, `types.ts` and `presets.ts`. It consumes `lib/study-data/` through that module's public entry point, never its internals.

An arcade game's engine is a deep module too. `lib/<game>/index.ts` holds the pure rules and `lib/<game>/actions.ts` (or the game's `components/<game>/actions.ts`) its action map, with no React and no device reads. The game's session, views and shared parts live under `components/<game>/` ([ADR 0062](../adr/0062-three-views-per-arcade-game.md)). Shared arcade services, such as input, run snapshots, fairness tags and form factor, come only through `@/lib/arcade`. [Build an arcade game for three views](../docs/how-to/build-an-arcade-game-for-three-views.md) walks through the layout.

---

## 3. Running Boundary Verification

Enforced deterministically via [dependency-cruiser](https://github.com/sverweij/dependency-cruiser):

```bash
# Run boundary linter
npm run lint:boundaries

# Run boundary checks as part of typecheck and linting
npm run check

# Run full invariant diagnostics
npm run verify
```
