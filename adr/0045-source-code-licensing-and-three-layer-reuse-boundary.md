# ADR 0045: Source Code Licensing and the Three-Layer Reuse Boundary

## Status

Accepted on 2026-09-21.

Completes the public-repository readiness work landed via
[PR #886](https://github.com/fderuiter/portfolio/pull/886), merged to `main`
as `7fb7e666`, which shipped a code of conduct, issue templates, a security
policy, public repository metadata, and this licensing decision together.
Scopes, but does not modify, the pre-existing CC BY 4.0 grant on
`public/files/`.

## Context

The repository is being opened to the public. Until now the only licensing
artifact in the tree was `public/files/LICENSE.txt`, a CC BY 4.0 grant
covering the Laser Loon brand artwork. That grant is narrow by construction
and says nothing about `app/`, `lib/`, `components/`, or anything else that
compiles. Under default copyright, unlicensed source published to a public
GitHub repository grants a reader the right to view and fork within GitHub,
and nothing else: no right to run, modify, or redistribute it. A portfolio
whose stated purpose is to be read as evidence of engineering craft cannot
sit behind that default: the only thing a reader may legally do with the work
is look at it.

Three things complicate the obvious fix of dropping in an MIT license.

**The repository is not one kind of material.** It interleaves genuinely
reusable engineering (`lib/crf/`, `lib/proof-utils.ts`, `lib/dx/`, the DX
Doctor invariant tooling) with editorial prose (`CASE_STUDY.md`, seeded
narrative records in `prisma/seed.ts`, copy embedded directly in page
source), with personal identity material (biography, resume data,
photography), with already-licensed brand artwork. A single repository-wide
permissive grant would license the biography and the case-study writing for
commercial redistribution alongside the code.

**The deployment is the personal brand.** `deruiter.dev` is a named identity
and the Laser Loon Project is a named mark. A permissive license that is
silent on trademarks invites the reading that permission to reuse the
engineering is permission to reuse the identity, which is exactly the reuse
this repository cannot afford: a wholesale clone redeployed under the
original name is a live impersonation surface, not a licensing abstraction.

**The reuse that is actually wanted is permissive.** Copyleft (GPL/AGPL)
would deter the specific outcome this repository exists to produce: another
engineer lifting the CRF evaluator or the invariant-doctor pattern into their
own work. Copyleft solves a problem this project does not have, at the cost
of the one it does want.

## Decision

**1. The application source is licensed under Apache License 2.0.**
`LICENSE` carries the unmodified Apache-2.0 text with the appendix
boilerplate completed as `Copyright 2026 Frederick de Ruiter`.
`package.json` declares `"license": "Apache-2.0"` while remaining
`"private": true`; the SPDX identifier is metadata for readers and tooling,
not an npm publication signal.

Apache-2.0 over MIT for two clauses that are doing real work here:

- **Section 6 (Trademarks)** withholds trademark rights explicitly. It makes
  the identity boundary a term of the license rather than a request in a
  README, which is the boundary this repository most needs enforced.
- **Section 3 (Patent grant)** and its retaliation termination give both the
  author and downstream users a defined patent position. The clinical-data
  and proof-engine modules are the plausible commercial-adoption surface;
  MIT leaves the patent question entirely unaddressed.

Section 4(d)'s NOTICE propagation is a secondary benefit: attribution
survives redistribution without a per-file header campaign across a tree
this size.

**2. `NOTICE` is the authoritative scope statement, and it names three
layers.** Application source under Apache-2.0; `public/files/` artwork
unchanged under CC BY 4.0; editorial content, biography, resume data,
photography, and the `Frederick de Ruiter` / `deruiter.dev` marks all rights
reserved. Apache-2.0 §4(d) requires redistributors to carry `NOTICE`
forward, so the carve-outs travel with the code rather than being visible
only to whoever reads the original README.

The scope statement is prose in `NOTICE`, not a per-file `SPDX-License-Identifier`
header sweep. Headers on several hundred files would need to stay accurate as
files move between the code and content layers, and the layers are not cleanly
separable by path: a page component holds both Apache-2.0 JSX and all-rights-
reserved copy in the same file. One authoritative statement that names the
mixture is honest where per-file headers would be confidently wrong.

**3. Contributions are inbound = outbound, with no CLA.** Apache-2.0 §5
already makes submitted contributions licensed under the project's terms
absent a separate agreement; `CONTRIBUTING.md` states this explicitly rather
than leaving contributors to infer it. Apache-2.0-incompatible inbound code
(GPL, AGPL, SSPL, non-commercial and source-available licenses) cannot be
merged, and third-party code that is compatible must keep its license intact
and be recorded in `NOTICE`.

**4. The licensing surface is a tested invariant.** `__tests__/public-repository-readiness.test.ts`
asserts the Apache-2.0 text is present and intact (including §6, the clause
the decision turns on), that the SPDX field matches, that `NOTICE` names both
carve-outs, and that the CC BY 4.0 asset grant is still scoped to the
artwork. A future edit that silently widens the grant to the editorial layer
fails CI.

## Consequences

Readers may run, modify, and redistribute the engineering commercially, which
is the outcome a public portfolio wants. Redistributors must preserve
`LICENSE` and `NOTICE`, state their changes, and get no rights to the name.

The trademark and content reservations are terms, not technical controls. A
wholesale clone redeployed under the original branding is now a license
violation with a documented boundary to point at, which is a meaningful
improvement over an unlicensed repository but is still enforcement by
takedown, not prevention.

Apache-2.0 is one-way in practice: grants already made cannot be retracted
from copies already distributed. Future relicensing binds only future
releases, and only while the copyright remains single-author. Accepting
outside contributions under inbound = outbound makes a later license change
require contributor consent. This is the intended trade and the reason the
decision was worth an ADR rather than a dropped-in file.

The layer boundary requires ongoing judgment. Editorial copy embedded in
`.tsx` page source sits inside files that are otherwise Apache-2.0, and no
automated check can classify a string literal as prose or as interface text.
`NOTICE` names the ambiguity rather than pretending the split is mechanical.

## Amendment 2026-10-03: the artwork layer is CC0

The owner confirmed that the Laser Loon artwork is his own work and is
dedicated to the public domain. `public/files/LICENSE.txt`, `NOTICE`, the
README, `CONTRIBUTING.md` and the asset hub now say CC0 1.0 instead of
CC BY 4.0, and the pinned hashes in
`__tests__/public-repository-readiness.test.ts` were updated with the edit.

Nothing else in this decision changes: the artwork is still scoped to
`public/files/`, and the editorial and identity layer stays all rights
reserved. Copies obtained while the CC BY 4.0 grant was in force remain usable
under its terms; CC0 is strictly more permissive, so no recipient loses
anything. Third-party open source is covered separately by
[ADR 0057](0057-open-source-acknowledgments-and-license-compliance.md).
