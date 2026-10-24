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

## Merge lane

The repository's Actions account allows 20 concurrent jobs and a full PR
run uses 16, so ready PRs that run CI side by side queue each other: one PR
takes about 17 minutes alone and over two hours with three others. Build in
parallel; merge one at a time.

- **Claim before building.** Search open PRs for `Fixes #N` and check
  `git log origin/main`, then add `status:in-progress` to the issue with a
  comment naming the thread. A claim with no PR after 24 hours is stale.
- **Open the PR as a draft**, and add labels, assignee and reviewer while
  it is a draft. Every `labeled` event restarts the whole run, and a draft
  runs only `static-gate` and `security-gate`.
- **One ready PR at a time.** The project's lane file
  (`/mnt/project-files/lanes/merge-lane.md` in Claude project sessions)
  names the slot holder; only that PR may be non-draft. Join the queue once
  the draft is green. When it is your turn, merge `main` into the branch
  (a merge commit, not a rebase), rerun the fast checks if `main` moved,
  push, mark ready and enable auto-merge once. Because the slot holder
  always carries the latest `main`, every merge has been tested on the
  `main` it lands on, which `strict: false` alone does not give.
- **A red PR frees the slot.** If the fix needs more than one quick push,
  convert it back to draft and let the next PR go.
- **Hot files take a lock** in the lane file before you edit them:
  `components/CommandPalette.tsx`, `lib/navigation.ts`, `app/sitemap.ts`,
  `lib/seo-metadata.ts`, `lib/dx/page-bench.ts`, `package.json` and the
  lockfile, `.github/workflows/ci.yml`, and `README.md`.
- When GitHub and the lane file disagree, GitHub wins: if two PRs are
  ready, the newer one goes back to draft.

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
- **Dependabot npm PRs need `npm run deps:fix`.** It regenerates the OSS
  credits and moves the Playwright CI images to a bumped
  `@playwright/test`. Merge `main` in first when the branch is behind, then
  run `npx npm@10.9.2 ci` so the credits see `main`'s packages too (see
  `docs/how-to/manage-dependency-licenses.md`).
