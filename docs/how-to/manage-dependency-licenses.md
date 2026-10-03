# Manage Dependency Licenses

Documentation last reconciled: 2026-10-03.

This page covers what to do when you add or upgrade a dependency, when the
license audit fails, and how credits and notices stay current. The reasoning
is in [ADR 0057](../../adr/0057-open-source-acknowledgments-and-license-compliance.md).

## When you add or upgrade a dependency

1. Install it as usual. If it is a direct dependency, add an entry for it in
   `lib/oss-credits/presets.ts`: a purpose group from `GROUP_ORDER` and one
   line saying why this project uses it.
2. Regenerate the credits and notices on Linux x64:

   ```bash
   npm run oss:credits
   ```

3. Check the license policy:

   ```bash
   npm run audit:licenses
   ```

4. Commit `package-lock.json`, `lib/oss-credits/internal/credits.generated.json`
   and `public/third-party-notices.txt` together.

`npm test` fails with the exact fix command if any of these drift.

## When `audit:licenses` fails

- **Unapproved license on a dev-only package.** Prefer a different package.
  If the tool is worth keeping, add a dated exception to
  `license-policy.json` with an owner, a ticket and a rationale that
  explains how the tool is used. Exceptions last at most 90 days.
- **Strong copyleft (GPL, AGPL, SSPL and similar) on a shipped package.** No
  exception is accepted. Remove the package or replace it. A dual license that
  offers a permissive option (for example `MIT OR GPL-3.0-or-later`) passes.
- **LGPL on a shipped package.** Allowed only as an unmodified, dynamically
  linked library, through an exception that says so.
- **Shipped package missing from the notices.** Run `npm run oss:credits`.

The audit prints a warning 30 days before an exception expires. Renew it with
a fresh review or remove the dependency.

## What the page shows

`/acknowledgments` is built from the committed dataset. Direct runtime
dependencies are grouped by purpose with a link to each project, its version
and its license. Every shipped package is searchable, and the full license
texts are at `/third-party-notices.txt`.

## Non-npm credits

Fonts, artwork and datasets are not in the lockfile. Add them to the
"Non-npm credits" list on the page and to `NOTICE`, with the license and a
link to the source.
