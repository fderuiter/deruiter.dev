# ADR 0057: Open Source Acknowledgments and License Compliance

## Status

Accepted on 2026-10-03, under the epic
[#1798](https://github.com/fderuiter/deruiter.dev/issues/1798) and children
[#1799](https://github.com/fderuiter/deruiter.dev/issues/1799) to
[#1804](https://github.com/fderuiter/deruiter.dev/issues/1804). Extends
[ADR 0045](0045-source-code-licensing-and-three-layer-reuse-boundary.md),
which covers this project's own licensing, with the matching rules for the
software it depends on. Amended on 2026-11-20: the generated files are no
longer committed (see the amendment at the end).

## Context

The repository already gated the lockfile against an SPDX allow-list
(`scripts/license-audit.ts`, `config/license-policy.json`). That answers "may we use
this license?" It did not answer three other questions a public project owes
its dependencies and its visitors:

- Which projects is this site built on, and why? Nothing credited them.
- Do we reproduce the notices that MIT, BSD, ISC and Apache-2.0 require
  whenever code is redistributed? The site serves bundled dependency code to
  every visitor, so the answer must be yes.
- Does the gate distinguish code that ships from tooling that only runs on a
  developer machine or in CI? A copyleft test runner is a different risk
  from a copyleft library inside the browser bundle.

## Decision

**1. Committed outputs, generated from the lockfile and the registry, never
from `node_modules`.** `npm run oss:credits` (`scripts/oss-credits.ts`) reads
`package-lock.json` and, for each locked version, asks the npm registry for
its metadata and (for shipped packages) its tarball, at the URL and against the
integrity hash the lockfile records. A tarball is immutable, so the result is
identical on every platform, including for platform-specific optional binaries
that are not installed locally. It writes three committed files:
`lib/oss-credits/internal/registry-facts.generated.json` (homepage, repository,
author and every license text, keyed by `name@version` and pinned to the
integrity hash), `credits.generated.json` (the page dataset) and
`public/third-party-notices.txt`. The pure logic lives in the deep module
`lib/oss-credits/`; only the script touches the filesystem and the network.
Every direct dependency needs a curated purpose group and one-line reason in
`lib/oss-credits/presets.ts`, so the page says why each project is used.

**2. Drift fails the tests, byte for byte, offline.**
`__tests__/oss-credits.test.ts` re-renders the dataset and the notices from the
committed facts and compares them with the committed files exactly, checks that
the facts cover the lockfile (same versions, same integrity hashes), and checks
that every direct dependency is annotated. It reads committed files only: no
`node_modules`, no network. `npm run oss:credits -- --check` runs the same
comparison, and `npm run oss:credits -- --verify-registry` refetches every
package and compares with the committed facts, for a periodic or pre-release
audit of the registry itself.

**3. "Ships to visitors" is the production closure.** A lockfile entry is
shipped when it is reachable from `packages[""]` across `dependencies`,
`optionalDependencies`, and required `peerDependencies` (skipping optional
`peerDependenciesMeta` edges) via Node module resolution. Unreachable entries,
including `dev: true` and `devOptional: true` packages that sit only on
optional peer paths from runtime packages, are tooling. The audit reports both
counts.

**4. Strong copyleft in shipped code cannot be waived.** GPL, AGPL, SSPL,
OSL, EUPL, CPAL and RPL tokens in a shipped package fail the audit even if an
exception names them, unless the SPDX expression offers a permissive
alternative (for example `MIT OR GPL-3.0-or-later`). Dev-only packages keep
the exception path. LGPL libraries linked dynamically (the libvips binaries
behind Next.js image optimisation) stay allowed through dated exceptions with
an owner and ticket.

**5. Exceptions are reviewed before they lapse.** The existing hard fail on
expiry and 90-day cap stay. The audit now also warns 30 days ahead, naming
the owner and ticket.

**6. Notices ship with the site, with a full text for every package.**
`public/third-party-notices.txt` carries each shipped package's copyright lines
and license text, deduplicated by identical text, plus Apache-2.0 `NOTICE`
files (section 4(d)). A package that ships no license file gets a text in this
order, and generation fails if none applies: the same package family's parent
text (`LICENSE_TEXT_INHERITANCE`, for example the rollup and Next.js platform
binaries), then the SPDX template for its declared license with the copyright
holder from its package metadata (`LICENSE_HOLDER_OVERRIDES` for the few with
no author). There is no identifier-only exemption. The audit fails when a
shipped package does not sit under a license text of real length, so a name or
an SPDX identifier alone never satisfies it.

**7. The `/acknowledgments` page is static.** It renders from the generated
dataset: no database, no network, no client fetch for the main content. It
is registered across the usual discovery matrix.

## Consequences

Adding or upgrading a dependency now touches three generated artifacts. The
pre-commit and CI test run says exactly which command fixes the drift, and
`docs/how-to/manage-dependency-licenses.md` walks through it.

The dataset is a snapshot of the lockfile, not a legal opinion. Code that
Next.js vendors inside its own compiled output is credited through `next`
itself; a vendored package with a different license would not be visible to
this tooling.

## Amendment 2026-11-20: generated at install, not committed

Decision 1 committed the three generated files. In practice every change to
`package-lock.json` made them stale, and the byte-for-byte check then failed
CI. Dependabot cannot run project scripts, so every one of its npm PRs arrived
red and had to be carried by hand (#3995 and #3996 were closed for this), and
a one-line version bump came with thousands of lines of generated diff.

The three files are now build output. `postinstall` runs
`scripts/oss-credits.ts` after `prisma generate`, so `npm ci`, `npm install`,
CI and the Vercel build all write them from the lockfile before anything reads
them. `.gitignore` lists them. Nothing else in the decision changes:

- The sources are still the lockfile and the npm registry, addressed by
  resolved URL and integrity hash, never `node_modules`.
- `registry-facts.generated.json` stays on disk between installs as a cache,
  so a local install fetches only what is new. A cold run takes about 30
  seconds.
- `__tests__/oss-credits.test.ts` still re-renders the dataset and notices from
  the facts and compares them byte for byte, and `npm run audit:licenses`
  still fails a shipped package that is missing from the notices. Those checks
  now confirm the generator ran and agrees with itself, rather than that a
  person remembered to commit its output.
- A package with no resolvable license text now stops the install instead of
  a later test run, with the same fix (`LICENSE_HOLDER_OVERRIDES` or
  `LICENSE_TEXT_INHERITANCE`).

The cost is that every install needs the npm registry and the SPDX license
list, which an install already needs, and the fetch retries with backoff.
`npm run deps:fix` is now only needed to move the Playwright CI images after a
`@playwright/test` bump, so `.github/dependabot.yml` gives that package its
own group.
