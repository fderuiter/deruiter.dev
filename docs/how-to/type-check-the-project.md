# How to type-check the project

The type check runs on TypeScript 7, the Go compiler. TypeScript 6 stays
installed because ESLint, TypeDoc, Next.js and dependency-cruiser load the
compiler as a library, and 7.0 has no library API until 7.1.
[ADR 0072](../../adr/0072-typescript-7-compiler.md) explains the setup and
has the measurements.

## Check the whole project

```bash
npm run typecheck
```

This runs `next typegen` for the route types, then TypeScript 7 with
`--checkers 2`. A cold run takes about 25 seconds on a 4-core machine. After
that, `tsconfig.tsbuildinfo` makes a repeat run take about 4 seconds.

Husky runs the same command before every commit and push, and the production
build runs it in its own phase (`scripts/build.js` Phase 1.4).

## Check the memory budget CI enforces

```bash
npm run typecheck:budget
```

This is a cold check with `--extendedDiagnostics`. It fails when the
compiler's "Memory used" line goes over 3,072 MB. On 2026-10-27 the line read
about 2,420 MB. If it fails, find out what grew before you raise
`TYPECHECK_MEMORY_BUDGET_MB` in `scripts/typecheck-budget.ts`, and record the
new number in ADR 0072.

## Don't use `npx tsc`

`node_modules/.bin/tsc` links to TypeScript 6, so `npx tsc` checks with the
old compiler. Use the npm scripts, or call TypeScript 7 by its path:

```bash
node node_modules/@typescript/native/bin/tsc --noEmit --checkers 2
```

`npx tsc6` also runs TypeScript 6, which is handy when you need to compare the
two.

## Set up VS Code

Install the recommended TypeScript 7 extension
(`TypeScriptTeam.native-preview`). Once it's installed it becomes the editor's
TypeScript, so hovers and errors match `npm run typecheck`.

The 7.0 language server doesn't load tsserver plugins, so the Next.js
plugin's hints (for example, on `"use client"` boundaries) don't appear while
it's on. To get them back, run **Disable TypeScript 7 Language Server**
from the command palette. VS Code then uses the workspace's TypeScript 6
through `typescript.tsdk` in `.vscode/settings.json`.

## Upgrade either compiler

Raise `@typescript/native` (7.x) and `typescript` (the 6.0 compatibility
package) separately in `package.json`, then run `npm install` and
`npm run deps:fix`. After a TypeScript 7 bump, run `npm run typecheck:budget`
and the full test suite.

Once TypeScript 7.1 ships its API and the tools above support it, the alias
goes away. ADR 0072 lists the steps.
