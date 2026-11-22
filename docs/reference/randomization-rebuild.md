# Clinical Study Studio Randomization Rebuild Traceability

This reference is the durable repository traceability register for epic
[#3997](https://github.com/fderuiter/deruiter.dev/issues/3997) (*rebuild
randomization inside Clinical Study Studio*), established by
[#3998](https://github.com/fderuiter/deruiter.dev/issues/3998) and governed by
[ADR 0073](../../adr/0073-clinical-study-studio-randomization-architecture.md).

It maps all **155 unique requirements** across 18 capability areas to their
primary implementation ticket, code surface, test definition, and latest
verified execution status so implementation and qualification never depend on
an external repository or private document.

## Status vocabulary

- **`Implemented`**: Code and automated tests exist in this repository and
  passed verification on the recorded commit.
- **`Deferred`**: Owned by a downstream leaf ticket (`#3999`â€“`#4016`) not yet
  implemented on `main`.
- **`Unsupported`**: Capability explicitly disabled or unqualified because the
  required runtime or verification environment is not executed (for example,
  unexecuted SAS/Stata runtime parity until `#4014` qualifies it).

A test definition is always recorded separately from its latest execution
status; checking an issue checkbox is never treated as scientific or
qualification evidence.

## Dependency and fixture provenance

All code in `lib/randomization/` is a fresh clean-room TypeScript
implementation under [ADR 0045](../../adr/0045-source-code-licensing-and-three-layer-reuse-boundary.md).
No AGPL source code, runtime modules, or test fixtures from
`equipose-randomization` (`e2e540d2`) are copied into this repository.

| Category | Item | License / provenance | Governing ticket |
| --- | --- | --- | --- |
| Core contracts & validation | `lib/randomization/types.ts`, `lib/randomization/index.ts`, `lib/randomization/internal/*` | Apache-2.0 (fresh implementation, zero runtime dependencies) | `#3998` |
| Boundary enforcement | `.dependency-cruiser.cjs` (`randomization-engine-purity`) | Apache-2.0 (host repository rule) | `#3998` |
| Contract & traceability tests | `__tests__/randomization-contracts.test.ts`, `__tests__/dependency-cruiser-boundaries.test.ts` | Apache-2.0 (independently derived vectors and fixture trees) | `#3998` |
| PRNG, identity & integrity primitives | `lib/randomization/internal/engines/*`, `internal/identity/*`, `internal/integrity/*` | Apache-2.0 (fresh implementation; NIST FIPS 180-4 SHA-256 & ISO C++11 MT19937 vectors, zero runtime dependencies) | `#3999` |

## Complete 155-requirement traceability matrix

| Requirement ID | Capability | Primary Ticket | Status | Test Definition | Latest Execution Evidence |
| --- | --- | --- | --- | --- | --- |
| `RND-WORKS-001` | Study metadata | `#4006` | `Deferred` | Pending `#4006` | Not yet executed |
| `RND-WORKS-002` | Seven-stage design journey | `#4006` | `Deferred` | Pending `#4006` | Not yet executed |
| `RND-WORKS-003` | Use acknowledgment | `#4006` | `Deferred` | Pending `#4006` | Not yet executed |
| `RND-WORKS-004` | Simple UI preset | `#4006` | `Deferred` | Pending `#4006` | Not yet executed |
| `RND-WORKS-005` | Standard UI preset | `#4006` | `Deferred` | Pending `#4006` | Not yet executed |
| `RND-WORKS-006` | Complex UI preset | `#4006` | `Deferred` | Pending `#4006` | Not yet executed |
| `RND-WORKS-007` | Preset replacement contract | `#4006` | `Deferred` | Pending `#4006` | Not yet executed |
| `RND-WORKS-008` | Exploration mode | `#4006` | `Deferred` | Pending `#4006` | Not yet executed |
| `RND-WORKS-009` | Explicit artifact lifecycle | `#4003` | `Deferred` | Contract types in `lib/randomization/types.ts` (`#3998`); persistence pending `#4003` | Not yet executed |
| `RND-WORKS-010` | Host study linkage | `#4015` | `Deferred` | Provenance contract in `lib/randomization/types.ts` (`#3998`); pipeline linkage pending `#4015` | Not yet executed |
| `RND-DESIG-001` | Method choice | `#4006` | `Deferred` | Discriminated union in `lib/randomization/types.ts` (`#3998`); UI pending `#4006` | Not yet executed |
| `RND-DESIG-002` | Treatment arm editor | `#4006` | `Deferred` | Pending `#4006` | Not yet executed |
| `RND-DESIG-003` | Arm data validation | `#4006` | `Deferred` | Ratio and arm validation in `lib/randomization/index.ts` (`#3998`); UI pending `#4006` | Not yet executed |
| `RND-DESIG-004` | Reduced allocation ratios | `#4006` | `Deferred` | `reduceAllocationRatios` in `lib/randomization/index.ts` (`#3998`); UI pending `#4006` | Not yet executed |
| `RND-DESIG-005` | Sites editor | `#4006` | `Deferred` | Pending `#4006` | Not yet executed |
| `RND-DESIG-006` | Site identity validation | `#4006` | `Deferred` | Site validation in `lib/randomization/index.ts` (`#3998`); UI pending `#4006` | Not yet executed |
| `RND-DESIG-007` | Recruitment weights | `#4006` | `Deferred` | `SiteSpec.recruitmentWeight` contract in `lib/randomization/types.ts` (`#3998`); UI pending `#4006` | Not yet executed |
| `RND-DESIG-008` | Persist recruitment weights | `#4006` | `Deferred` | Pending `#4003` / `#4006` / `#4015` | Not yet executed |
| `RND-DESIG-009` | Factor editor | `#4006` | `Deferred` | Pending `#4006` | Not yet executed |
| `RND-DESIG-010` | Factor reordering | `#4006` | `Deferred` | Ordered factor arrays in `lib/randomization/types.ts` (`#3998`); UI pending `#4006` | Not yet executed |
| `RND-DESIG-011` | Factor and level validation | `#4006` | `Deferred` | Factor/level validation in `lib/randomization/index.ts` (`#3998`); UI pending `#4006` | Not yet executed |
| `RND-DESIG-012` | Custom seed | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-DESIG-013` | Generated seed | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-DESIG-014` | Subject ID mask editor | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-BLOCK-001` | Block size editor | `#4000` | `Implemented` | `__tests__/randomization-blocks.test.ts` (engine); UI pending `#4006` | Pass (`vitest`, `#4000`, 2026-11-22) |
| `RND-BLOCK-002` | Allocation preview | `#4000` | `Implemented` | `__tests__/randomization-blocks.test.ts` (engine); UI pending `#4006` | Pass (`vitest`, `#4000`, 2026-11-22) |
| `RND-BLOCK-003` | Random pool | `#4000` | `Implemented` | `__tests__/randomization-blocks.test.ts` | Pass (`vitest`, `#4000`, 2026-11-22) |
| `RND-BLOCK-004` | Fixed size sequence | `#4000` | `Implemented` | `__tests__/randomization-blocks.test.ts` | Pass (`vitest`, `#4000`, 2026-11-22) |
| `RND-BLOCK-005` | Site rule override | `#4000` | `Implemented` | `__tests__/randomization-blocks.test.ts` | Pass (`vitest`, `#4000`, 2026-11-22) |
| `RND-BLOCK-006` | Intersection rule override | `#4000` | `Implemented` | `__tests__/randomization-blocks.test.ts` | Pass (`vitest`, `#4000`, 2026-11-22) |
| `RND-BLOCK-007` | Rule tracking scope | `#4000` | `Implemented` | `__tests__/randomization-blocks.test.ts` | Pass (`vitest`, `#4000`, 2026-11-22) |
| `RND-BLOCK-008` | Block-size usage limits | `#4000` | `Implemented` | `__tests__/randomization-blocks.test.ts` | Pass (`vitest`, `#4000`, 2026-11-22) |
| `RND-BLOCK-009` | Balanced block composition | `#4000` | `Implemented` | `__tests__/randomization-blocks.test.ts` | Pass (`vitest`, `#4000`, 2026-11-22) |
| `RND-BLOCK-010` | Fisher-Yates shuffle | `#4000` | `Implemented` | `__tests__/randomization-blocks.test.ts` | Pass (`vitest`, `#4000`, 2026-11-22) |
| `RND-BLOCK-011` | Partial final blocks | `#4000` | `Implemented` | `__tests__/randomization-blocks.test.ts` | Pass (`vitest`, `#4000`, 2026-11-22) |
| `RND-BLOCK-012` | Standard traversal order | `#4000` | `Implemented` | `__tests__/randomization-blocks.test.ts` | Pass (`vitest`, `#4000`, 2026-11-22) |
| `RND-CAPS-001` | Manual intersection matrix | `#4000` | `Implemented` | `__tests__/randomization-caps.test.ts` | Pass (`vitest`, `#4000`, 2026-11-22) |
| `RND-CAPS-002` | Enrollment scope | `#4000` | `Implemented` | `__tests__/randomization-caps.test.ts` | Pass (`vitest`, `#4000`, 2026-11-22) |
| `RND-CAPS-003` | Proportional percentages | `#4000` | `Implemented` | `__tests__/randomization-caps.test.ts` | Pass (`vitest`, `#4000`, 2026-11-22) |
| `RND-CAPS-004` | Largest remainder allocation | `#4000` | `Implemented` | `__tests__/randomization-caps.test.ts` | Pass (`vitest`, `#4000`, 2026-11-22) |
| `RND-CAPS-005` | Joint distribution assumption | `#4000` | `Implemented` | `__tests__/randomization-caps.test.ts` | Pass (`vitest`, `#4000`, 2026-11-22) |
| `RND-CAPS-006` | Computed matrix editing | `#4000` | `Implemented` | `__tests__/randomization-caps.test.ts` (engine); UI pending `#4006` | Pass (`vitest`, `#4000`, 2026-11-22) |
| `RND-CAPS-007` | Marginal caps | `#4001` | `Implemented` | `__tests__/randomization-marginal.test.ts` | Pass (`vitest`, `#4001`, 2026-11-22) |
| `RND-CAPS-008` | Marginal termination safeguard | `#4001` | `Implemented` | `__tests__/randomization-marginal.test.ts` | Pass (`vitest`, `#4001`, 2026-11-22) |
| `RND-CAPS-009` | Marginal site fairness | `#4001` | `Implemented` | `__tests__/randomization-marginal.test.ts` | Pass (`vitest`, `#4001`, 2026-11-22) |
| `RND-CAPS-010` | Stale derived cap handling | `#4000` | `Implemented` | `__tests__/randomization-caps.test.ts` | Pass (`vitest`, `#4000`, 2026-11-22) |
| `RND-CAPS-011` | Proportional compute precondition | `#4000` | `Implemented` | `__tests__/randomization-caps.test.ts` | Pass (`vitest`, `#4000`, 2026-11-22) |
| `RND-MINIM-001` | Virtual cohort size | `#4002` | `Implemented` | `__tests__/randomization-minimization.test.ts` | Pass (`vitest`, `#4002`, 2026-11-22) |
| `RND-MINIM-002` | Biased coin probability | `#4002` | `Implemented` | `__tests__/randomization-minimization.test.ts` | Pass (`vitest`, `#4002`, 2026-11-22) |
| `RND-MINIM-003` | Expected level distributions | `#4002` | `Implemented` | `__tests__/randomization-minimization.test.ts` | Pass (`vitest`, `#4002`, 2026-11-22) |
| `RND-MINIM-004` | Valid profile sampling | `#4002` | `Implemented` | `__tests__/randomization-minimization.test.ts` | Pass (`vitest`, `#4002`, 2026-11-22) |
| `RND-MINIM-005` | Per-site marginal state | `#4002` | `Implemented` | `__tests__/randomization-minimization.test.ts` | Pass (`vitest`, `#4002`, 2026-11-22) |
| `RND-MINIM-006` | Ratio-normalized scoring | `#4002` | `Implemented` | `__tests__/randomization-minimization.test.ts` | Pass (`vitest`, `#4002`, 2026-11-22) |
| `RND-MINIM-007` | Preferred-group selection | `#4002` | `Implemented` | `__tests__/randomization-minimization.test.ts` | Pass (`vitest`, `#4002`, 2026-11-22) |
| `RND-MINIM-008` | Capacity stop | `#4002` | `Implemented` | `__tests__/randomization-minimization.test.ts` | Pass (`vitest`, `#4002`, 2026-11-22) |
| `RND-MINIM-009` | No block semantics | `#4002` | `Implemented` | `__tests__/randomization-minimization.test.ts` | Pass (`vitest`, `#4002`, 2026-11-22) |
| `RND-MINIM-010` | No inactive candidates | `#4002` | `Implemented` | `__tests__/randomization-minimization.test.ts` | Pass (`vitest`, `#4002`, 2026-11-22) |
| `RND-MINIM-011` | Unsupported combinations | `#4002` | `Implemented` | `__tests__/randomization-minimization.test.ts` (engine and import); UI pending `#4006`, script export pending its ticket | Pass (`vitest`, `#4002`, 2026-11-22) |
| `RND-IDENT-001` | Site token | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-IDENT-002` | Stratum token | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-IDENT-003` | Sequence token | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-IDENT-004` | Random token | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-IDENT-005` | Mask grammar | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-IDENT-006` | Collision detection | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-IDENT-007` | Stratum identity separation | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-IDENT-008` | Checksum contract | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-IDENT-009` | Legacy mask migration | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-REPRO-001` | MT19937 integer stream | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-REPRO-002` | Float conversion | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-REPRO-003` | Seed compression | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-REPRO-004` | Seed character encoding | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-REPRO-005` | Separate identifier stream | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-REPRO-006` | Generation timestamp | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-REPRO-007` | Canonical audit payload | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-REPRO-008` | Algorithm and format versions | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-REPRO-009` | Immutable result provenance | `#3999` | `Implemented` | `__tests__/randomization-primitives.test.ts` | Pass (`vitest`, `#3999`, 2026-11-19) |
| `RND-EXECU-001` | Background generation | `#4004` | `Deferred` | Pending `#4004` | Not yet executed |
| `RND-EXECU-002` | Worker correlation | `#4004` | `Deferred` | Pending `#4004` | Not yet executed |
| `RND-EXECU-003` | Latest-request publication | `#4004` | `Deferred` | Pending `#4004` | Not yet executed |
| `RND-EXECU-004` | Fallback generation | `#4004` | `Deferred` | Pending `#4004` | Not yet executed |
| `RND-EXECU-005` | Failure completion | `#4004` | `Deferred` | Pending `#4004` | Not yet executed |
| `RND-EXECU-006` | Resource budgets | `#4004` | `Deferred` | Overflow-safe `checkResourcePreflight` and `RANDOMIZATION_RESOURCE_LIMITS` in `lib/randomization` (`#3998`); worker enforcement pending `#4004` | Not yet executed |
| `RND-EXECU-007` | Ready/busy/result states | `#4004` | `Deferred` | Pending `#4004` | Not yet executed |
| `RND-SIMUL-001` | Monte Carlo repetitions | `#4007` | `Deferred` | Pending `#4007` | Not yet executed |
| `RND-SIMUL-002` | Simulation reproducibility | `#4007` | `Deferred` | Pending `#4007` | Not yet executed |
| `RND-SIMUL-003` | Attrition range | `#4007` | `Deferred` | Pending `#4007` | Not yet executed |
| `RND-SIMUL-004` | Independent attrition stream | `#4007` | `Deferred` | Pending `#4007` | Not yet executed |
| `RND-SIMUL-005` | Progress reporting | `#4007` | `Deferred` | Pending `#4007` | Not yet executed |
| `RND-SIMUL-006` | Cancel simulation | `#4007` | `Deferred` | Pending `#4007` | Not yet executed |
| `RND-SIMUL-007` | Worker isolation | `#4007` | `Deferred` | Pending `#4007` | Not yet executed |
| `RND-SIMUL-008` | Aggregate arm statistics | `#4007` | `Deferred` | Pending `#4007` | Not yet executed |
| `RND-SIMUL-009` | Deviation display | `#4007` | `Deferred` | Pending `#4007` | Not yet executed |
| `RND-SIMUL-010` | QA interpretation | `#4007` | `Deferred` | Pending `#4007` | Not yet executed |
| `RND-SIMUL-011` | Bridge to code | `#4007` | `Deferred` | Pending `#4007` | Not yet executed |
| `RND-RESUL-001` | Flat allocation table | `#4008` | `Deferred` | Pending `#4008` | Not yet executed |
| `RND-RESUL-002` | Grouped block view | `#4008` | `Deferred` | Pending `#4008` | Not yet executed |
| `RND-RESUL-003` | Sorting | `#4008` | `Deferred` | Pending `#4008` | Not yet executed |
| `RND-RESUL-004` | Column filters | `#4008` | `Deferred` | Pending `#4008` | Not yet executed |
| `RND-RESUL-005` | Chart cross-filter | `#4008` | `Deferred` | Pending `#4008` | Not yet executed |
| `RND-RESUL-006` | Categorical analytics | `#4008` | `Deferred` | Pending `#4008` | Not yet executed |
| `RND-RESUL-007` | Balance report | `#4008` | `Deferred` | Pending `#4008` | Not yet executed |
| `RND-RESUL-008` | Minimization marginal report | `#4008` | `Deferred` | Pending `#4008` | Not yet executed |
| `RND-RESUL-009` | Balance interpretation | `#4008` | `Deferred` | Pending `#4008` | Not yet executed |
| `RND-RESUL-010` | Audit hash display | `#4008` | `Deferred` | Pending `#4008` | Not yet executed |
| `RND-RESUL-011` | Row action placeholders | `#4008` | `Deferred` | Pending `#4008` | Not yet executed |
| `RND-DISCL-001` | Persona choices | `#4005` | `Deferred` | Pending `#4005` | Not yet executed |
| `RND-DISCL-002` | Organization segment choices | `#4005` | `Deferred` | Pending `#4005` | Not yet executed |
| `RND-DISCL-003` | Treatment masking | `#4005` | `Deferred` | Pending `#4005` | Not yet executed |
| `RND-DISCL-004` | Host authorization boundary | `#4005` | `Deferred` | Pending `#4005` | Not yet executed |
| `RND-DISCL-005` | Inference-safe export policy | `#4005` | `Deferred` | Pending `#4005` | Not yet executed |
| `RND-DISCL-006` | Simulation export restrictions | `#4005` | `Deferred` | Pending `#4005` | Not yet executed |
| `RND-EXPOR-001` | CSV allocation export | `#4010` | `Deferred` | Pending `#4010` | Not yet executed |
| `RND-EXPOR-002` | Excel allocation export | `#4011` | `Deferred` | Pending `#4011` | Not yet executed |
| `RND-EXPOR-003` | PDF report | `#4011` | `Deferred` | Pending `#4011` | Not yet executed |
| `RND-EXPOR-004` | Accessible PDF verification | `#4011` | `Deferred` | Pending `#4011` | Not yet executed |
| `RND-EXPOR-005` | JSON result export | `#4010` | `Deferred` | Pending `#4010` | Not yet executed |
| `RND-EXPOR-006` | CRO validation manifest | `#4010` | `Deferred` | Pending `#4010` | Not yet executed |
| `RND-EXPOR-007` | Methodology narrative | `#4010` | `Deferred` | Pending `#4010` | Not yet executed |
| `RND-EXPOR-008` | Filename safety | `#4010` | `Deferred` | Pending `#4010` | Not yet executed |
| `RND-EXPOR-009` | Uniform artifact provenance | `#4010` | `Deferred` | Pending `#4010` | Not yet executed |
| `RND-CODE-001` | Four languages | `#4012` | `Deferred` | Pending `#4012` | Not yet executed |
| `RND-CODE-002` | Static literal mode | `#4012` | `Deferred` | Pending `#4012` | Not yet executed |
| `RND-CODE-003` | Dynamic block mode | `#4013` | `Deferred` | Pending `#4013` | Not yet executed |
| `RND-CODE-004` | Minimization export eligibility | `#4013` | `Deferred` | Pending `#4013` | Not yet executed |
| `RND-CODE-005` | Both-mode bundle | `#4012` | `Deferred` | Pending `#4012` | Not yet executed |
| `RND-CODE-006` | Code preview and clipboard | `#4012` | `Deferred` | Pending `#4012` | Not yet executed |
| `RND-CODE-007` | Companion ZIP contents | `#4012` | `Deferred` | Pending `#4012` | Not yet executed |
| `RND-CODE-008` | Exact companion fixtures | `#4012` | `Deferred` | Pending `#4012` | Not yet executed |
| `RND-CODE-009` | PRNG validation vector | `#4013` | `Deferred` | Pending `#4013` | Not yet executed |
| `RND-CODE-010` | Mapping and syntax validation | `#4012` | `Deferred` | Pending `#4012` | Not yet executed |
| `RND-CODE-011` | Runtime parity qualification | `#4014` | `Unsupported` | Pending `#4014` | Not executed (SAS/Stata runtimes explicitly disabled) |
| `RND-CODE-012` | Single canonical source | `#4012` | `Deferred` | Pending `#4012` | Not yet executed |
| `RND-VERIF-001` | Local JSON upload | `#4009` | `Deferred` | Pending `#4009` | Not yet executed |
| `RND-VERIF-002` | Regeneration comparison | `#4009` | `Deferred` | Pending `#4009` | Not yet executed |
| `RND-VERIF-003` | Hash validation | `#4009` | `Deferred` | Pending `#4009` | Not yet executed |
| `RND-VERIF-004` | Complete field comparison | `#4009` | `Deferred` | Pending `#4009` | Not yet executed |
| `RND-VERIF-005` | Bounded safe imports | `#4009` | `Deferred` | Import size/depth limits in `RANDOMIZATION_RESOURCE_LIMITS` (`#3998`); verifier pending `#4009` | Not yet executed |
| `RND-PERSI-001` | Draft autosave | `#4003` | `Deferred` | Pending `#4003` | Not yet executed |
| `RND-PERSI-002` | Versioned migration | `#4003` | `Deferred` | Pending `#4003` | Not yet executed |
| `RND-PERSI-003` | Recovery export | `#4003` | `Deferred` | Pending `#4003` | Not yet executed |
| `RND-PERSI-004` | Non-destructive save lifecycle | `#4003` | `Deferred` | Pending `#4003` | Not yet executed |
| `RND-PERSI-005` | Host persistence adapter | `#4003` | `Deferred` | Pending `#4003` | Not yet executed |
| `RND-EXPER-001` | Responsive presentation | `#4006` | `Deferred` | Pending `#4006` | Not yet executed |
| `RND-EXPER-002` | Theme and density | `#4006` | `Deferred` | Pending `#4006` | Not yet executed |
| `RND-EXPER-003` | Keyboard and announcements | `#4006` | `Deferred` | Pending `#4006` | Not yet executed |
| `RND-EXPER-004` | Rendering scalability | `#4008` | `Deferred` | Pending `#4008` | Not yet executed |
| `RND-PLATF-001` | Local design computation | `#4004` | `Deferred` | Pending `#4004` | Not yet executed |
| `RND-PLATF-002` | Host privacy policy | `#4005` | `Deferred` | Pending `#4005` | Not yet executed |
| `RND-PLATF-003` | Offline assets | `#4016` | `Deferred` | Pending `#4016` | Not yet executed |
| `RND-PLATF-004` | Update notification | `#4016` | `Deferred` | Pending `#4016` | Not yet executed |
| `RND-PLATF-005` | Host shell ownership | `#4006` | `Deferred` | Pending `#4006` | Not yet executed |
| `RND-QUALI-001` | Traceable acceptance | `#3998` | `Implemented` | `__tests__/randomization-contracts.test.ts` (155-ID register assertion) | Pass (`vitest`, `#3998`, 2026-11-19) |
| `RND-QUALI-002` | Meaningful golden vectors | `#4000` | `Implemented` | `__tests__/randomization-blocks.test.ts` (block vector), `__tests__/randomization-minimization.test.ts` (hand-calculated minimization cohort) | Pass (`vitest`, `#4000` and `#4002`, 2026-11-22) |
| `RND-QUALI-003` | Cross-browser consistency | `#4016` | `Deferred` | Pending `#4016` | Not yet executed |
| `RND-QUALI-004` | Artifact and dependency provenance | `#3998` | `Implemented` | `__tests__/randomization-contracts.test.ts`, `__tests__/dependency-cruiser-boundaries.test.ts` | Pass (`vitest` + `depcruise`, `#3998`, 2026-11-19) |
