# ADR 0056: Protocol Drift Architecture

## Status

Accepted on 2026-10-03, under the epic
[#1076](https://github.com/fderuiter/portfolio/issues/1076) and sub-issues
[#1091](https://github.com/fderuiter/portfolio/issues/1091) to
[#1097](https://github.com/fderuiter/portfolio/issues/1097). The decisions below were settled on 2026-10-03;
this ADR keeps the ones that bind later work. ADR 0047 stays reserved for the
narrative-design work in #927.

## Context

Protocol Drift is a new arcade game about the gap between a data standard and
the clinic that has to produce data for it. The player is the Lead Clinical
Data Architect for a fictional Phase I trial, Study PD-101. They wire a
pipeline of chips on a React Flow canvas that carries site entries into CDISC
SDTM, keep it honest while coordinators tire and a protocol amendment lands
mid-flight, derive ADaM rows below a Conservation Wall, and clear a dual
Database Lock. It is a systems puzzle, not a paperwork game.

## Decision

### Deep module and engine

The simulation is the deep module `lib/protocol-drift/`
([lib/README.md](../lib/README.md)). `index.ts`, `types.ts` and `presets.ts`
are the public contract; `internal/` is private. The engine is pure
TypeScript with no DOM, React or Worker dependency. It is driven by `PDCommand`
messages and answers with `PDWorkerEvent` messages plus a deep-copied
`ProtocolDriftView`.

- Time is an integer minute from Trial Day 0, 08:00. At 1x one simulated hour
  passes per real second (24 s per trial day); 2x and 5x scale that; `N` steps
  exactly one hour.
- The only randomness is a seeded draw keyed by the run seed and a stable
  string, so a replay of the same command log reproduces every record.
- Illegal state transitions and rejected commands become events
  (`COMMAND_REJECTED`), not exceptions the UI must catch.

### Web Worker boundary

The engine runs inside `components/protocol-drift/engine.worker.ts`, created in
`engine-adapter.ts` with `new Worker(new URL(...), import.meta.url)`. The worker
imports the engine through `@/lib/protocol-drift` and a shared message core
(`engine-core.ts`); it never imports the adapter that constructs it, so the
worker's chunk cannot reach its own constructor and
`ChunkCycleGuardPlugin` ([#853](https://github.com/fderuiter/portfolio/issues/853))
stays quiet. Where `Worker` does not exist (jsdom, very old browsers) the same
core runs in-thread behind the same asynchronous interface.

### State and canvas

- A Zustand store (`components/protocol-drift/store.ts`) holds UI state and the
  canvas graph, sends commands and folds responses. Engine state is never
  duplicated into lib.
- `@xyflow/react` draws the pipeline and is imported only inside the
  PlayCabinet dynamic import, so the arcade hub and shared bundles stay within
  the budgets in `lib/dx/bundle-guard.ts`.
- Tabulation chips are clamped so their whole body stays above the
  Conservation Wall at y416; data flows only downward across it, through the
  Snapshot Handoff.
- Wires are type-checked (`isWireCompatible`). A rejected wire plays the reject
  cue and names the mismatch.

### Epistemic rules the UI must not hide

- No silent selection and no imputation. Text with two readings is kept in an
  `unmatched` list that counts as loss until dispositioned. A partial date
  stays partial; an imputed day adds fabricated precision (4.95 bits) and
  blocks the lock.
- A query reply never resolves an issue. A rubber-stamped
  "Confirmed Correct" leaves the issue Open. An evidence-linked query gets a
  real review and a source correction.
- Routing follows assessment date, not submission date.
- Lock availability depends only on inspectable rules (counts, open queries,
  debt, traces, stale derivations). Each failure links to the entity in the
  Forensic Inspector.

### Persistence

Tier 1 is an IndexedDB autosave (`protocol_drift_saves`) written at every
`WAVE_REVIEW` boundary and after each published revision, with an in-memory
fallback for SSR, private windows and tests. Tier 2 is the versioned
`pd-101-save-v1.json` export and import: a save stores the seed, scenario and
accepted command log, and an import replays it and checks the state hash before
the worker adopts it, so a tampered file changes nothing.

### Presentation

- Graphite surfaces with amber, emerald and steel semantic accents; no brand
  cyan, no glow washes, no purple (AGENTS invariant 20).
- Packet tokens animate only `transform` and `opacity`, are capped at 30, and
  are replaced by stationary per-wire counters under
  `prefers-reduced-motion`.
- The inspector docks at `min(328px, 35vh)`; `I` expands it and `Esc` docks it.
- At container widths below 1400px the toolbox and site rail collapse to icon
  strips, and both can be reopened.
- The canvas has a text alternative (`Pipeline as text`) that lists every chip
  and wire and lets keyboard users add or remove wires.
- Six procedural cues go through `getSoundEngine().playTone`, respect the
  global mute, and play nothing on hover. They live in
  `components/protocol-drift/audio.ts` because the engine module must stay
  free of Web Audio imports.
- Desktop-only on phones and portrait tablets through `DesktopOnlyGate`
  ([ADR 0048](0048-desktop-only-arcade-games-on-touch-devices.md), amended).

## Consequences

- Balance and rules are testable without a browser: the engine suites run in
  Node, the UI suites in jsdom with React Flow's geometry mocked.
- Adding a chip means a `ChipSpec` in lib, with no UI change beyond the
  toolbox order.
- Everything in the game is fictional. No real sponsor, site or person is
  represented, and nothing here is clinical or regulatory advice.

## Amendment 2026-10-05: Protocol Drift is a simulator, not an arcade game

Protocol Drift is a workbench: a node-graph pipeline, an inspector and lock
checklists. It sits with the other simulators and studios rather than with the
games, so it moved from `/arcade/protocol-drift` to `/protocol-drift`
([#1841](https://github.com/fderuiter/deruiter.dev/issues/1841), navigation
epic [#1842](https://github.com/fderuiter/deruiter.dev/issues/1842)).

- `next.config.ts` redirects the old URL to the new one permanently, so links,
  search results and the 2026-10-03 release links keep working.
- The page, its social image and its sitemap, SEO and route-registry entries use
  `/protocol-drift`. It is listed under Simulators in the top bar, the drawer,
  the footer and the command palette, and it no longer appears on the arcade
  hub, in the arcade game count or in the previous/next ring.
- Nothing about the game changed: the engine, the saves (`protocol_drift_high_score`
  and the autosave keys), the trophies and the `PlayCabinet` launch flow are the
  same. Its metadata entry stays in `lib/arcade-data.ts` so the trophy cabinet
  still lists its achievements.
- The desktop-only gate from ADR 0048 stays, because the canvas workbench needs a
  pointer and a wide viewport.
