# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Everything merged to `main` after 0.4.0 (2026-09-24) and shipped in the
2026-09-29 production release. The version number is set when the release is
tagged.

### Added

- Trial & Error campaign: three acts linked into one run, the timed FDA
  Information Request, act two and three content, the CSR Lock boss, SOP relic
  triggers, SAP Amendments, seeded protocol deviations, endless post-marketing
  rounds, a skippable guided first Blind, the hand cheat sheet, per-Blind score
  log and boss intro (#1164, #1165, #1166, #1167, #1170, #1171, #1172, #1173,
  #1174, #1183, #1197, #1239, #1397).
- Study Director cabinet at `/arcade/study-director`: ADR 0054, the
  deterministic domain core, archetypes, branching events, the audit mechanic,
  database lock, evaluations and FDA inspection, and routine-work events
  (#1289, #1362, #1363, #1373, #1379, #1390).
- CRF Studio: document-level EDC simulation state, functional protocol audit
  middleware and audit log, and USDM import validation with audit provenance
  (#1260, #1261, #1262, #1276).
- Search and discovery: static `/llms.txt` and `/llms-full.txt` manifests, an
  accessible FAQ accordion with FAQPage schema, engineering bridges linking
  tools to case studies and ADRs, brand fonts and artifact-enriched social
  cards, and the viewport theme color (#1332, #1405, #1413, #1421, #1430;
  ADR 0053).
- Event-driven sub-daily email retries through Upstash QStash (#1337).
- Shared UI and hook primitives: `ToastProvider`, `useDebounce`,
  `useThrottle`, `useSafeTimeout`, `useInterval`, `scrollToElement`,
  `apiClient`, `downloadFile` and locale-pinned number formatting (#1136,
  #1422, #1444, #1465, #1466, #1476).
- Game changes: Retro Labyrinth exits lock until the room objective is done,
  Garmin Watch ramps difficulty and puts costs on pops and GC, Laser Loon
  bosses telegraph volleys, Quasi-Puzzler Story Mode gets a real double RAM
  budget (#1191, #1192, #1399, #1453, #1454).
- Tooling: a 14-day pre-expiry warning for audit overrides, Prisma schema and
  environment checks in doctor, a daily scheduled security audit, and
  shift-left accessibility audits (#1280, #1295, #1301, #1304).

### Changed

- Mobile routes use dedicated touch views with edge middleware redirection
  (#1264).
- `createApiHandler` evaluates `options.auth` inline (#1266).
- Logging, storage and timer access now go through the shared logger,
  `safeStorage` and safe-timer hooks (#1136, #1137, #1467).
- npm install scripts use the native `allowScripts` configuration, and dx
  scripts run only locally installed binaries (#1294, #1429).

### Performance

- Composite indexes for `CaseStudy`, `CaseStudyFeedback` and `BlogPost`, and a
  reordered `BlogPostReaction` unique constraint (#1334, #1335).
- The email retry batch is leased in one `SKIP LOCKED` statement, the
  case-study search index projects summary columns, and telemetry reads use a
  10-second in-memory cache (#1300, #1424, #1433).

### Fixed

- Playtest fixes across Garmin Watch, Neuro Simulator, Quasi-Puzzler, Laser
  Loon, Clinical Trial Chaos, Working with Duck, Meme Vault and the arcade
  hub: score farming, accessibility, 320px layout, copy that no longer matched
  the game, and persistence (#1398, #1400, #1404, #1407, #1408, #1419, #1438,
  #1462, #1463, #1478, #1479).
- Toast viewport landmark and provenance label contrast for WCAG AA (#1447,
  #1481).
- Case-study tags are documented as the comma-separated string the API
  returns (#1439).

## [0.4.0] - 2026-09-24

The first release since the repository became public and adopted the Apache-2.0
license. It ships the technical blog, the Patrol shift simulator, the first
playable Trial & Error slices, the CRF testing workflow, and the build and
release-integrity fixes found during the 2026-09-18/19 release-readiness work
([#863](https://github.com/fderuiter/portfolio/issues/863)).

### Database

Three additive migrations ship with this release. All three were already
applied to production on 2026-09-19 and are backward compatible with the
previously deployed application:

- `20261018000000_add_blog_post`: adds the `BlogPost` table.
- `20261019000000_add_blog_post_reaction`: adds `BlogPostReaction` and its
  indexes.
- `20261020000000_add_case_study_hero_image`: adds the nullable
  `CaseStudy.hero_image_url` column.

### Added

- Technical blog at `/blog`, with authorized draft reading, editing and a
  sanitized draft collection API, and posts across all six ADR 0041 content
  pillars (#795, #797, #876).
- Patrol shift simulator: a headless shift state machine, OET mini-game, OEC
  scene interaction, three scenario packages with interpersonal dialogue, a
  rule-based debrief engine, ambient mini-events, the Welch Village trail map,
  a field manual and an optional audio layer (#827, #831–#833, #837, #838).
- Trial & Error: Biostat Ops foundations: the SAP-defined Demographics QC Desk,
  the Card Table with the QC Desk as the Inspect view, the score timeline and
  scoring player, live card faces, the synth audio and loud-moment layers, an
  Act I of three progressive review Blinds, and the ADR 0046 card-table and
  narrative-frame amendments (#941, #953, #955, #962, #965).
- CRF Studio: runtime show, hide and require sentence rules, versioned
  personal clinical blocks, an in-builder simulator dock, named test scenarios
  with expected outcomes, and durable field review threads (#842–#845, #938).
- Clinical Trial Chaos offices, sponsor inbox, outfits and a guided board
  redesign (#908).
- A 44px minimum touch target and active feedback across arcade HUD controls
  (#820).
- A desktop-only notice for six arcade games on phones (#972).

### Changed

- Licensed the source under Apache-2.0 and hardened public-repository
  readiness (#886).
- Canonicalized on the apex `https://deruiter.dev`, so canonical, OpenGraph,
  sitemap and robots URLs match the serving host (#846).
- Superseded redundant `main`-push CI runs (#847).
- Unified secret scanning into `lib/security-scan` (#888), centralized sound
  engine delegation (#824) and moved `CopyButton` to `components/ui` (#819).
- Ran migrations on the direct Neon endpoint by default (#860).
- Tightened the pre-commit guardrail, branch, docs-drift and test-scope checks
  (#884), and added a direct Stryker CLI runner (#825).

### Fixed

- A production build now fails when a data source is unreachable instead of
  shipping fallback-only content (#858), and local production builds load
  `.env.local` before falling back to a dummy connection (#862).
- Fallback logging is gated on runtime rather than on production alone, so
  builds no longer flood stderr (#857, #861).
- Build output and agent worktrees are no longer uploaded to Vercel (#856), and
  ESLint no longer traverses agent worktrees (#855).
- Seeding upserts by slug instead of wiping tables, and two orphaned case
  studies were recovered (#873).
- Case-study `editorial_content` renders as Markdown with de-duplicated ids,
  and case-study Mermaid diagrams render (#798, #877).
- Hero text stays an opaque LCP candidate, and production layout reflow was
  removed (#839).
- Code blocks no longer clip, duplicate titles were removed, and missing page
  headings were added (#881); `/crf` has a stable heading, titles are bounded,
  and mobile blur is gated (#885).
- Local development no longer spends the Sentry error budget (#883).
- The OpenAPI doctor check normalizes bracketed Next.js route parameters
  (#818).
- QC Desk cell taps are no longer lost at narrow widths (#963).
- The docs-drift gate ignores TypeDoc's literal-union reordering (#966), the
  doctor's file scans skip agent worktrees and Stryker sandboxes (#967), and
  the full doctor diagnostic test runs against a fixture workspace (#973).
- Four failing Playwright specs were fixed and the Linux home baselines were
  regenerated (#970).

### Security

- Added `@upstash/qstash` and bumped `@upstash/redis` (#878).
- Stated the `.env*.local` ignore rule explicitly (#872).

## [0.3.0] - 2026-09-13

First release cut under [ADR 0037](adr/0037-controlled-integration-and-release-deployments.md),
which makes `main` the sole long-lived integration and production branch. This
release reconciles 74 commits of `dev` work into `main`; the version jumps from
`0.1.0` because no `0.2.0` was ever tagged.

### Database

Two migrations ship with this release and were applied to production before the
deployment, in the expand order they were authored:

- `20261015000000_add_email_resilience` — adds `SuppressionList` and
  `OutboundEmailQueue`.
- `20261016000000_enforce_email_contracts` — adds the `SuppressionReason` and
  `OutboundEmailStatus` enums and constrains the columns above to them.
- `20261016000001_telemetry_daily_rollup` — adds the additive
  `TelemetryDailyRollup` aggregate table.

All three are additive and backward compatible with the previously deployed
application.

### Added

- Protected build-once production release and non-production rollback-drill
  workflows, with migration replay, staged synthetic probes, immutable
  promotion evidence, and post-promotion tagging.
- A single authenticated daily maintenance pipeline for the Vercel Hobby cron
  allowance, covering telemetry and reaction-buffer draining, leased outbound-
  email retries, and transactional 30-day telemetry rollups.
- Durable daily telemetry aggregates through the additive `TelemetryDailyRollup`
  migration.
- Shared public-route registration for page benchmarking and service-worker
  precaching.
- Redis read-through compute shield for case studies, with a buffered reaction
  write path that keeps visitor interactions off Neon's serverless compute.
- Explainable grouped AND/OR discrepancy checks in the CRF designer.
- Local draft recovery, restoring an in-progress study after a refresh.
- Doctor-native ADR invariant suite wired into CI verification.
- Agent runtime preflight check.
- Curated featured project previews and a reworked homepage editorial hierarchy.
- Standardized canvas arcade engine event bridge with modal pause handling.
- Fog-state prioritized gesture isolation in the Garmin simulator.
- Integration catalog with setup, verification and recovery guidance.

### Changed

- Reconciled the historical `dev` integration line into the `main` release
  line and adopted short-lived topic branches targeting `main`.
- Disabled automatic Vercel Git deployments so production changes only through
  the protected promotion workflow.
- Hardened outbound email recovery with optimistic row leases, a five-message
  daily maintenance batch, stable Resend idempotency keys, suppression
  rechecks, queue-health metrics, and jittered exponential backoff.
- Forced Preview and local development email delivery into a non-transmitting
  simulation mode.
- Expanded the offline shell to cover every registered public route while
  keeping online navigation on the network path.
- Documentation reorganized into a Diátaxis structure per ADR 0023.
- Arcade state transitions for `GarminWatchSimulator` and `WorkingWithDuck`
  routed through a single gateway each.
- README roadmap replaced with the current epic structure.
- Synthetic probes moved from a 30-minute cadence to daily.
- Documented Node.js support as a range rather than a pinned 22.x.
- CI runs on Node.js 24; Vercel deploys only `main`.

### Fixed

- Removed environment-dependent test paths that could connect unit suites to
  an ambient live database.
- Replaced direct cron-secret string comparison with a fixed-length
  timing-safe digest comparison.
- Corrected the offline page so its copy and navigation behavior reflect the
  browser's actual connection state.
- Preserved buffered telemetry and reaction writes across concurrent or
  partially failed maintenance executions.
- Reaction write-buffer durability: buffered reactions now drain to Postgres
  on the daily maintenance pass instead of accumulating in Redis unbounded.
- Reaction flush idempotency: a replayed batch can no longer double-insert
  rows or double-decrement the buffer.
- Offline safety: cache reads, writes and eviction consult Upstash
  configuration before issuing a request.
- Design manifest generation reproduces its committed output byte for byte,
  so builds no longer dirty the tree or fail the documentation drift gate.
- CI typechecks with the compiler pinned in `package-lock.json` rather than
  the runner image's global TypeScript.
- CI verifies architectural invariants after the build and benchmark phases
  that produce the evidence those invariants assert against.
- CI builds through `npm run build`, the entrypoint Vercel runs, which pins
  `next build --webpack`. `npx next build` defaults to Turbopack on Next 16
  and never completes for this application; it was cancelled at 41m47s.
- CI unit tests no longer receive the Postgres service container's DSN. Four
  suites skip their `@/lib/db` mock whenever `DATABASE_URL` names a non-dummy
  host, and the real client is `@neondatabase/serverless` over a WebSocket,
  which a stock Postgres server cannot answer. The container remains for the
  Prisma CLI steps, which use the native migration engine.
- `lib/security.ts` no longer treats `CI=true` as a build phase, which had
  disabled the fail-closed `CRON_SECRET` guard on every CI runner.
- Sentry honours the sampling and noise bounds ADR 0036 documents: traces are
  sampled at zero outside production and capped at 5% within it, and benign
  client noise is dropped before send.
- Outbound email preserves queued tags and no longer reports unpersisted
  retries.
- Upstash rate limiting isolated, with bounded behaviour during an outage.
- Two Playwright suites no longer point at a port nothing serves, and the CI
  worker count was raised so the suite can finish inside its job timeout.
- The telemetry synthetic probe asserts the status codes `POST
/api/telemetry` actually returns (201/202), not a 200 it never sends.
- Eliminated `any` from production code paths.

### Removed

- The automated `dev` rebase workflow, superseded by ADR 0037.
- Orphaned `portfolio/` and `app/core/` directories.

### Security

- Removed all stale audit exceptions after confirming the current dependency
  graph has zero reported vulnerabilities.
- Added owner and follow-up requirements for any future time-bounded audit
  exception.

[0.4.0]: https://github.com/fderuiter/portfolio/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/fderuiter/portfolio/compare/v0.1.0...v0.3.0
