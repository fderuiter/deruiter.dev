# Watch and upgrade the clinical standards

Every CDISC standard the site cites has one pinned version, in
`CLINICAL_STANDARDS_PROFILE` (`lib/clinical-standards/profile.ts`). The
standards bill of materials (`lib/clinical-standards/bom.ts`, #2992) adds,
for each one:

- the official page or repository where CDISC publishes it;
- the newest version published there;
- the checks in this repository that hold the site to the pinned version,
  each marked as CDISC's own engine (CORE), an official schema, local rules,
  or terminology;
- when the site deliberately stays behind, the reason (`hold`);
- its publisher, family, artifact type and lifecycle, the pinned
  standards it builds on (`dependsOn`), what the site can do with it
  (`capabilities`, each `yes` or `subset` with the rest implied `no`) and
  what part of it the site covers (`coverage`).

These are the first fields of the standards registry Protocol Studio will
read. Their names follow the registry proposal in the Clinical Study Studio
plan. Applicability, access and evidence dimensions, and entries for
standards outside the profile, come later.

It does the same for the three NCI EVS terminology packages the CT subset
comes from, and for the pinned CDISC CORE engine.

## The weekly watch

`.github/workflows/standards-watch.yml` runs every Monday and on demand. It
runs `scripts/standards-watch.ts refresh`, which reads:

- the version tables on the cdisc.org standard pages;
- release tags of `cdisc-org/DDF-RA` (USDM),
  `cdisc-org/analysis-results-standard` (ARS) and
  `cdisc-org/cdisc-rules-engine` (CORE);
- the release date in the header of each current NCI EVS terminology
  ODM-XML.

Every source is public, so the job uses no CDISC Library key.

When anything moved, the job commits the new
`lib/clinical-standards/standards-latest.json` on a
`chore/standards-watch-<hash>` branch and opens a pull request whose body
lists what moved and which pins now have an upgrade available. It closes
any older standards-watch pull request it supersedes. GitHub does not run
`pull_request` workflows for a pull request a workflow opens, so the job
dispatches `ci.yml` on the branch, and Merge Gate reports on its commit.

If the repository does not allow GitHub Actions to open pull requests
(Settings → Actions → General → Workflow permissions), the job comments on
or opens an issue titled "Standards watch: newer CDISC versions published"
instead, naming the branch.

When a source cannot be read, for example because a page was redesigned,
the job keeps that entry's committed value, lists the source in the
summary and fails, so the scheduled run shows red.

Run it locally:

```sh
npx tsx scripts/standards-watch.ts refresh   # rewrites standards-latest.json
npx tsx scripts/standards-watch.ts check     # offline: validates the file
```

Never edit `standards-latest.json` by hand.

## Recording is not upgrading

Merging a standards-watch pull request only records that a newer version
exists. Every pin stays where it is, and the bill of materials marks the
gap: `upgrade-available` when nothing holds the pin, `held` when its entry
explains why the site stays.

Moving a pin is a controlled upgrade (ADR 0065), in its own pull request:

1. Change the version in `CLINICAL_STANDARDS_PROFILE`, or `CDISC_CORE_PIN`
   and the `CORE_TAG` and `CORE_COMMIT` of `study-data-core.yml` for CORE,
   or the CT release with `scripts/cdisc-ct-subset.ts` for terminology.
2. Update the vendored schema or rules the entry's checks name.
3. Run the full gate and the `Study Data CDISC CORE` workflow, and refresh
   the recorded findings ([Refresh the recorded CDISC CORE
   findings](refresh-cdisc-core-findings.md)).
4. In the pull request, report what the upgrade changed in the exports and
   findings.

To stay on an older version on purpose, add a `hold` to the standard's
entry in `bom.ts` saying why.
