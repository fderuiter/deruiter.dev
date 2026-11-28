# Manage Dependency Licenses

Documentation last reconciled: 2026-11-28.

This page covers what to do when you add or upgrade a dependency, when the
license audit fails, and how credits and notices stay current. The reasoning
is in [ADR 0057](../../adr/0057-open-source-acknowledgments-and-license-compliance.md).

## When you add or upgrade a dependency

1. Install it as usual. If it is a direct dependency, add an entry for it in
   `lib/oss-credits/presets.ts`: a purpose group from `GROUP_ORDER` and one
   line saying why this project uses it.
2. The install regenerates the credits and notices. `postinstall` runs the
   generator, which reads the lockfile, needs network access to the npm
   registry and fetches only what is new or changed. The files are not
   committed. To rerun it by hand:

   ```bash
   npm run oss:credits
   ```

   If it stops with "could not resolve a license text", the package ships no
   license file and has no author to take a copyright holder from. Add a
   reviewed entry to `LICENSE_HOLDER_OVERRIDES`, or a parent to
   `LICENSE_TEXT_INHERITANCE`, in `lib/oss-credits/presets.ts`.

3. Check the license policy:

   ```bash
   npm run audit:licenses
   ```

4. Commit `package.json` and `package-lock.json`. The generated
   `lib/oss-credits/internal/*.generated.json` and
   `public/third-party-notices.txt` are git-ignored build output
   ([ADR 0057 amendment](../../adr/0057-open-source-acknowledgments-and-license-compliance.md#amendment-2026-11-20-generated-at-install-not-committed)).

`npm test` fails with the exact fix command if any of these drift. The check is
byte-exact and offline. To confirm the cached facts against the registry
itself, run `npm run oss:credits -- --verify-registry`.

## When a Dependabot PR is red

The credits are generated at install, and `dependabot[bot]` PRs run
`npm run audit:overrides -- --check --allow-removable` so satisfied overrides do
not fail CI until a human PR retires them and updates `SECURITY.md`. Three
isolated groups still require checked-in artifacts that Dependabot cannot move
on its own: `playwright` (`@playwright/test` CI images), `duckdb-wasm`
(`@duckdb/duckdb-wasm` `.wasm` extensions and SHA-256 digests), and `docker`
(`postgres:17` in `infra/docker/postgres/Dockerfile`, mirrored in CI workflows
and `scripts/migration-replay.ts`). The pre-push guard only accepts the branch
prefixes in `validateBranchName()`, so carry those PRs on a `chore/` branch
instead of pushing to `dependabot/*`:

```bash
git fetch origin dependabot/<ecosystem>/<group-branch>
git checkout -b chore/deps-<date> FETCH_HEAD
git merge origin/main        # when the branch is behind
npx npm@10.9.2 ci
npm run deps:fix
```

`deps:fix` moves every `mcr.microsoft.com/playwright` image in
`.github/workflows/` to the locked `@playwright/test` version, refreshes the
pinned DuckDB `.wasm` extensions and SHA-256 digests in
`components/platform/sql/extensions/README.md` to match the locked
`@duckdb/duckdb-wasm` release, syncs `postgres:17` image digests across
`.github/workflows/ci.yml`, `.github/workflows/neon-backup.yml`, and
`scripts/migration-replay.ts` from `infra/docker/postgres/Dockerfile`, checks
npm overrides, and runs `npm run oss:credits`. Commit what it changed, push,
open a PR that says "Replaces #N", and close Dependabot's PR with a link to it.
Closing a grouped PR is safe because the next weekly run proposes anything
newer.

`npm run deps:fix -- --check` reports the same drift offline without writing.

Dependabot's npm also records the bundled dependencies of
`@tailwindcss/oxide-wasm32-wasi` as lock entries with no tarball of their own.
They are dev-only and travel inside their parent, so the credits skip them.
Verified build-only bundler dependencies pulled by runtime SDKs (such as
`@sentry/bundler-plugins`, `@rollup/plugin-commonjs`, and `rollup` under
`@sentry/nextjs` / `@sentry/node`) are excluded in
`BUILD_ONLY_DEPENDENCY_EDGES` in `lib/oss-credits/internal/facts.ts` so they do
not enter visitor notices. A bundled entry on a shipped package is not skipped:
it stops `oss:credits`, and needs a person to decide how it is credited.

## When `audit:licenses` fails

- **Unapproved license on a dev-only or isolated build-only package.** Prefer a
  different package. If the tool is worth keeping, add a dated exception to
  `config/license-policy.json` conforming to
  `config/license-policy.schema.json`: `createdAt` (`YYYY-MM-DD`), `expiresAt`
  (`YYYY-MM-DD`, at most 90 days from both `createdAt` and today), a GitHub
  handle `riskOwner`, a GitHub issue reference `ticket` (`#NNNN`), and a
  `rationale` explaining how the tool is used.
- **Strong copyleft or source-available / non-commercial license (`GPL`, `AGPL`,
  `SSPL`, `FSL-*`, `BSL-*`, `BUSL-*`, `Elastic-*`, `PolyForm-*`,
  `Commons-Clause`, and similar) on a shipped package.** No exception is
  accepted, including in `shippedCodeExceptions`. Remove the package, replace
  it, or isolate build-only edges from the production closure after verifying
  `.next` traces. A dual license that offers a permissive option (for example
  `MIT OR GPL-3.0-or-later`) passes.
- **LGPL on a shipped package.** Allowed only as an unmodified, dynamically
  linked library, through a `shippedCodeExceptions` entry that says so.
- **Shipped package missing from the notices, or listed without a license
  text.** Run `npm run oss:credits` (`npm run doctor` also enforces notice
  completeness via `requireNotices: true`).

The audit prints a warning 30 days before an exception expires, and
`.github/workflows/scheduled-security-audit.yml` runs
`npm run audit:licenses -- --fail-on-expiring` daily to open or update a
tracking issue before expiry. Renew with a fresh review or remove the
dependency.

## What the page shows

`/acknowledgments` is built from the generated dataset. Direct runtime
dependencies are grouped by purpose with a link to each project, its version
and its license. Every shipped package is searchable, and the full license
texts are at `/third-party-notices.txt`.

## Non-npm credits

Fonts, artwork and datasets are not in the lockfile. Add them to the
"Non-npm credits" list on the page and to `NOTICE`, with the license and a
link to the source.
