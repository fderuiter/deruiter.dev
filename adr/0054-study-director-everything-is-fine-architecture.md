# ADR 0054: Study Director: "Everything Is Fine" Architecture

## Status

Accepted on 2026-09-29 with [#1282](https://github.com/fderuiter/portfolio/issues/1282),
under the epic [#1281](https://github.com/fderuiter/portfolio/issues/1281).
Later Study Director tickets amend this record rather than contradict it.
ADR 0047 stays reserved for the narrative-design work in #927.

## Context

Study Director is a new arcade game about the job of running a clinical study:
one person in the middle of a partly dysfunctional human system, trying to get
a defensible study out the other end. It is not a paperwork game. The player
manages attention, delegates to a team, reads an inbox, and later defends
their own decisions to an inspector. Six meters compete (Scientific
Integrity, Compliance, Timeline, Budget, Client Confidence, Team Capacity)
and cannot all be maximized.

The first delivery is a vertical slice: one ~20-minute study (Study 24-081,
a randomized PK study for a first-time biotech), three sites, six team
members, about 45 events, database lock and a possible FDA inspection.

## Decision

### Deep module

The domain is the deep module `lib/study-director/` ([lib/README.md](../lib/README.md)).
Root files (`index.ts`, `types.ts`, `presets.ts`) are the public contract;
`internal/` is private. Components import only through the root. The module
does not import from `lib/trial-and-error` or `lib/clinical-trial-chaos`, for
the same reason ADR 0046 gives: shared code would couple release cadences.

### Deterministic core

- The only randomness is a counter-based PRNG (`internal/rng.ts`): the value
  at a draw index is a pure function of the run seed and the index. State
  stores the next draw index, so a saved run resumes exactly.
- All state is plain JSON. Every function is pure: `advanceDay`,
  `resolveDecision` and `auditSite` return new state.
- Player-facing failures (not enough attention, unknown target, study over)
  are returned as `{ ok: false, reason }`, not thrown.

### Time and attention

One simulated day is one turn. Each day the player has 5 attention points.
Decisions and audits spend them; documenting a decision costs one more.
Unspent attention does not carry over.

A calm study costs nothing to keep running. Open queries and documentation
debt pull the Study Director into routine work: each day they can take up to
two attention points before any decision (`routineLoad`). A shortcut that saves
attention today is paid back in attention later, and again at inspection.

### The causal chain

Outcomes are not random pop-ups. Each site has a burden (0 to 100) set by
protocol complexity and staffing. Each day in conduct, burden and the site
coordinator's archetype produce deviations and queries; queries raise the
data manager's workload; a loaded data manager clears fewer queries; the
backlog pushes the projected finish, which lowers Timeline and Client
Confidence. A decision on day 4 can therefore surface as a crisis on day 63.

### Everything Is Fine

The dashboard is not the true state. Enrollment, Budget and Timeline are
honest. Safety, Data and Regulatory only show the share of problems each
site has surfaced: a terrified coordinator surfaces most, an invisible one
almost none. Auditing a site (2 attention) reveals its true state and keeps
its dashboard honest for 10 days.

### Documentation debt

Every decision option carries a debt value it adds when the player skips
documentation. Debt lowers Compliance and is what the inspection later
replays against the decision log. This is the reason documentation costs
attention: quick decisions save time now and are paid for later.

### Meters

Meters are derived from true state plus accumulated direct adjustments from
decisions, then clamped to 0 to 100. They are recomputed, never stored, so
they cannot drift out of sync with the state.

### Presentation and platform

- Desktop-only on phones and portrait tablets through `DesktopOnlyGate`
  ([ADR 0048](0048-desktop-only-arcade-games-on-touch-devices.md)).
- The UI is a Study Director's desktop, not a video game: dashboard, team,
  timeline, inbox and a decision panel. No continuous particle or canvas
  loops, and no icon-stuffed cards (the zero-trope invariant). Superseded
  on 2026-09-30 by [ADR 0055](0055-study-director-world-simulation-architecture.md),
  which moves play into an explorable top-down workplace; the classic desk
  remains available.
- Save and resume use the seed, draw index and decision log.

## Consequences

- Balance lives in one place and is testable: determinism, causal
  propagation and dashboard concealment all have unit tests.
- Later slices add content (events, archetypes), the endgame (lock,
  evaluations, profile, inspection) and the UI without changing the core
  contracts above.
- Everything in the game is fictional; no real sponsor, person or study is
  represented, and nothing here is regulatory advice.
