# ADR 0072: Type-Check with the TypeScript 7 Compiler

## Status

Accepted on 2026-10-27. It changes how `npm run typecheck` and
`npm run typecheck:budget` run, and the memory gate that #2014 and #2743 set
up. The production build's standalone type-check phase
(`scripts/build.js` Phase 1.4, #2100) keeps its place and now runs the new
compiler.

## Context

TypeScript 7.0 shipped on 2026-07-08. It is a port of the compiler to Go,
published as the ordinary `typescript` package, version 7.0.2 when this was
written. Microsoft's stated aim is that code which compiles cleanly on 6.0
compiles the same way on 7.0.

The repository was on TypeScript 6.0.3. The whole-program check covers 6,297
files and was slow and memory-hungry. Memory was the bigger problem. Vercel's
native Typecheck deployment check was killed with exit 137 on every
production deploy until it was removed (#2899), and CI and the production
build both carried a V8 heap ceiling for the checker.

7.0 has one gap that decides the shape of this change. It ships no JavaScript
API. `require("typescript")` on 7.0 returns only a version string, and the
new API is planned for 7.1. Several tools here load the compiler as a
library:

| Tool                                                   | Loads the TypeScript API |
| ------------------------------------------------------ | ------------------------ |
| typescript-eslint (via `eslint-config-next`)           | yes                      |
| TypeDoc (`npm run compile-docs`)                       | yes                      |
| Next.js (`next typegen`, the `next build` setup check) | yes                      |
| dependency-cruiser (`npm run lint:boundaries`)         | yes, to read TypeScript  |
| VS Code's built-in TypeScript and the Next.js plugin   | yes, through tsserver    |
| tsx                                                    | no, it uses esbuild      |
| Vitest                                                 | no, it uses oxc          |
| Stryker                                                | no, it uses Babel        |
| Prisma                                                 | no                       |

typescript-eslint's peer range stops below 6.1, and its maintainers have not
yet added 7.0 support.

## Decision

Run the type check on TypeScript 7 and keep TypeScript 6 installed as the
library, using the side-by-side setup from Microsoft's 7.0 announcement:

```json
"@typescript/native": "npm:typescript@^7.0.2",
"typescript": "npm:@typescript/typescript6@^6.0.2"
```

`@typescript/typescript6` re-exports a real `typescript@6` install (hoisted
to `node_modules/@typescript/old`), so every tool that imports `typescript`
gets the 6.0 API it supports today. The checker that gates CI, Husky and the
production build is 7.0.

The scripts call the 7.0 entry point by path:

```text
next typegen && node node_modules/@typescript/native/bin/tsc --noEmit --checkers 2
```

The path matters. Both packages declare a `tsc` binary, and npm linked
`node_modules/.bin/tsc` to the 6.0 copy, so a bare `tsc` or `npx tsc` still
runs TypeScript 6. A unit test fails if any package script uses a bare `tsc`.

`--checkers 2` is fixed rather than left at the default of 4. 7.0 says
results can depend on checker order in rare cases, so the same value
everywhere keeps CI, Husky and the Vercel build in agreement. On a 4-core
machine 2 was also as fast as 4 and used less memory (below).

The CI memory budget now reads the compiler's own report. A Go binary
ignores `--max-old-space-size`, so `scripts/typecheck-budget.ts` runs a cold
check with `--extendedDiagnostics` and fails when "Memory used" passes
3,072 MB, the same number the 6.0 heap gate used.

VS Code gets the TypeScript 7 extension (`TypeScriptTeam.native-preview`) as
a recommendation. `typescript.tsdk` points at `node_modules/@typescript/old/lib`,
because the compatibility package has no tsserver. That keeps VS Code's
built-in TypeScript and the Next.js language service plugin working for
anyone who switches the 7.0 extension off. The 7.0 language server does not
run tsserver plugins, so the Next.js plugin's hints only show on the 6.0
fallback.

## Evidence

All numbers come from one 4-vCPU, 15 GB cloud container on 2026-10-27, with
cold runs (`--incremental false`) on main at `0545d221`.

| Run                          | Wall time | Peak RSS     | Compiler "Memory used" |
| ---------------------------- | --------- | ------------ | ---------------------- |
| TypeScript 6.0.3             | 130 s     | 3.33 GB      | 3.13 GB                |
| TypeScript 7.0.2, 4 checkers | 26–30 s   | 3.81–3.88 GB | 2.95–2.98 GB           |
| TypeScript 7.0.2, 2 checkers | 24–28 s   | 3.03 GB      | 2.42–2.45 GB           |
| TypeScript 7.0.2, 1 checker  | 32–42 s   | 2.64–2.73 GB | 2.17 GB                |

A warm incremental run on 7.0 took 4.3 s; 7.0 reads and writes
`tsconfig.tsbuildinfo` like 6.0 did.

Both compilers report zero errors on the project's real configuration. That
only proves they agree on clean code, so the parity check also ran both
against a temporary config adding six stricter flags
(`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`,
`noPropertyAccessFromIndexSignature`). That produced 13,810 diagnostics from
6.0 and 13,817 from 7.0. Keyed by file, line and error code:

- 312 differ only in column, where 7.0 points at the unused name instead of
  the start of the import.
- 6 lines in `lib/trial-and-error/internal/run.ts` and its test report the
  same assignment error under a different code (TS2322 against TS2719, which
  adds "two different types with this name exist").
- 8 are new in 7.0, all TS2488: destructuring an indexed element that
  `noUncheckedIndexedAccess` makes possibly `undefined`, for example
  `const [x, y] = shown.curve[rise]` in `lib/trial-and-error/internal/km.ts`.
  6.0 missed these. They only exist under that flag, which the project does
  not use.

No diagnostic 6.0 reported went missing in 7.0.

## Consequences

- A cold type check is about four times faster, and the build, Husky
  hooks and CI's static gate each save around 100 seconds per run.
- Peak memory in the production build's type-check phase drops from about
  3.3 GB to about 3.0 GB. That phase runs in its own process before
  `next build`, so it never overlaps webpack's heap (#2100). The 8 GB Vercel
  build machine keeps its headroom.
- Two TypeScript versions sit in the tree until 7.1. Raising one does not
  raise the other, and the error messages a developer sees in VS Code with
  the 7.0 extension off come from 6.0.
- `npx tsc` runs 6.0. Use `npm run typecheck`, or call
  `node_modules/@typescript/native/bin/tsc` directly.
- Nothing type-aware depends on the checker being 7.0, so if 7.0 ever
  disagrees with 6.0 on real code, reverting is a two-line `package.json`
  change.

When TypeScript 7.1 ships its API and typescript-eslint, TypeDoc, Next.js
and dependency-cruiser support it, drop the alias and the 6.0 package, point
`typescript` at 7.x, and remove the explicit binary path and the `tsdk`
override. The follow-up issue tracks that.

## Related

- [ADR 0039](0039-github-pro-plan-capabilities-and-actions-minutes-governance.md):
  CI time budget.
- [ADR 0051](0051-manual-production-releases.md), amended for #2899: why
  Vercel's native Typecheck check was removed.
- [How to type-check the project](../docs/how-to/type-check-the-project.md).
- [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).
