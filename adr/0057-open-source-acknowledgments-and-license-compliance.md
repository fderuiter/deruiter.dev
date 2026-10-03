# ADR 0057: Open Source Acknowledgments and License Compliance

## Status

Accepted on 2026-10-03, under the epic
[#1798](https://github.com/fderuiter/deruiter.dev/issues/1798) and children
[#1799](https://github.com/fderuiter/deruiter.dev/issues/1799) to
[#1804](https://github.com/fderuiter/deruiter.dev/issues/1804). Extends
[ADR 0045](0045-source-code-licensing-and-three-layer-reuse-boundary.md),
which covers this project's own licensing, with the matching rules for the
software it depends on.

## Context

The repository already gated the lockfile against an SPDX allow-list
(`scripts/license-audit.ts`, `license-policy.json`). That answers "may we use
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

**1. One committed dataset, generated from the lockfile.** `npm run oss:credits`
(`scripts/oss-credits.ts`) writes
`lib/oss-credits/internal/credits.generated.json` and
`public/third-party-notices.txt`. The pure logic lives in the deep module
`lib/oss-credits/`; only the script touches the filesystem. Every direct
dependency needs a curated purpose group and one-line reason in
`lib/oss-credits/presets.ts`, so the page says why each project is used,
not only that it is.

**2. Drift fails the tests, without needing `node_modules`.**
`__tests__/oss-credits.test.ts` compares the committed dataset with
`package-lock.json` on name, version, license and scope, checks that every
direct dependency is annotated, and checks that the notices file names every
shipped package. Regenerate with `npm run oss:credits` on Linux x64: platform
binaries are installed per platform, which changes which of them ship a
license file but never the package set.

**3. "Ships to visitors" is the production closure.** A lockfile entry
without `dev: true` is shipped. Everything else is tooling. The audit
reports both counts.

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

**6. Notices ship with the site.** `public/third-party-notices.txt` carries
each shipped package's copyright lines and license text, deduplicated by
identical text, plus Apache-2.0 `NOTICE` files (section 4(d)). Packages that
distribute no license file are listed by SPDX identifier. The audit fails when
a shipped package is missing from the file.

**7. The `/acknowledgments` page is static.** It renders from the committed
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
