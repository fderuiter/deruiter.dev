---
name: steward
description: Drive a deruiter.dev pull request to green. Use when opening a PR, answering CI failures or review comments on one, or resolving a merge conflict with main.
---

Repository conventions for getting a pull request merged. `CONTRIBUTING.md`
section 8 maps each CI job to its local command; this skill covers what
that table doesn't say.

## Before the first push

- Cut the branch from current `main` with a prefix `validateBranchName()`
  in `lib/dx/git-guard.ts` accepts (`feat/`, `fix/`, `docs/`, …).
  `.husky/pre-push` rejects anything else, including `claude/*`. Rename
  the branch rather than editing the guard.
- One issue per PR, linked with `Fixes #N`. File the issue first if none
  exists. Don't stack PRs on other unmerged PRs.
- Run the CI-equivalent suite locally and list what you ran in the PR
  body: `npm run typecheck`, `npm run lint`, `npm run check-docs-drift`,
  `npm run lint:docs`, `npm run verify -- --skip-benchmark-evidence`
  (what CI's static gate runs), and `npx vitest related --run` on the
  changed files. Run the full `npm test` before marking the PR ready.
- Changing an export in `lib/`, `hooks/` or `types/`, or an API route,
  means `npm run compile-docs` and committing the regenerated `docs/`.

## Gotchas

- **Prettier only on the files you touched.** lint-staged formats every
  staged file, so a broad `prettier --write` glob drags formatting-only
  changes into unrelated files, and removing them later needs a
  force-push the guardrail blocks.
- **README or `docs/` conflicts after a merge from main** are usually
  generated output. Take main's side, re-run `npm run compile-docs`, and
  commit the result instead of hand-merging.
- **No double casts in tests.** DX Doctor rejects `as unknown as Type`
  in test files; use `fromPartial` / `fromAny` from
  `@total-typescript/shoehorn`.
- **Touch-target guard is line-based.** A `<button` line with a
  `className` must carry a 48px minimum (`min-h-12`, `min-w-12` or
  equivalent). Give the button the size; don't move `className` to the
  next line to get past the check.
- **No Postgres or Redis connection-URL literals, tests included.** The
  pre-commit regex guard flags the scheme even without credentials (it
  blocked this very file), and CI's credential scanner also reads the PR
  diff embedded in the Playwright report. Build the string from parts or
  read it from the environment.
- **Benchmark evidence belongs to one commit.** `npm run verify` without
  the skip flag checks the Web Vitals evidence that
  `npm run bench:pages -- --assert` writes to the ignored
  `.benchmark-results/`. It must match the current revision on a clean
  tree and is good for 15 minutes (`lib/dx/benchmark-evidence.ts`), so
  re-run the benchmark after each new commit, or use
  `--skip-benchmark-evidence` as CI does.
- **Re-running stale CI takes a real push.** Never push an empty commit
  or close and reopen the PR to retrigger checks.
- **Cloud containers can't run every check.** Their Chromium is older
  than the revision `@playwright/test` pins, so `test:e2e` and the Safari
  device suite only run in CI. Tools built on
  `launchChromiumWithFallback()` (`bench:pages`, the mermaid test) do run
  locally.
