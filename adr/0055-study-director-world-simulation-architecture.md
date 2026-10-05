# ADR 0055: Study Director World Simulation Architecture

## Status

Accepted on 2026-09-30 at the request of the project owner. It supersedes
one bullet of [ADR 0054](0054-study-director-everything-is-fine-architecture.md):
"The UI is a Study Director's desktop, not a video game." Everything else in
ADR 0054 stays in force: the deep module, the counter-based PRNG, plain-JSON
saves, derived meters, hidden site state, documentation debt, delayed
consequences and the endgame inspection.

## Context

Study Director shipped as a clinical study management simulation presented
as an operations dashboard: inbox, decision, dashboard, end day. The owner
wants a top-down workplace RPG in the spirit of Stardew Valley in which the
player walks the CRO floor, talks to the team, visits sites, attends
meetings and chooses how to spend each day, while the deterministic study
model simulates everything the player is not personally attending to.

The core loop becomes: walk, observe, ask, prioritize, delegate, act,
document, go home, consequences. "Everything is fine" stays the central
joke: the player can walk past a drowning data manager and a smoking bin
carrying a mug labelled FINE.

## Decision

### Three layers

1. **Domain** (`lib/study-director/`, unchanged ownership). The study model
   stays authoritative for sites, team, events, meters, decisions, audits,
   database lock and inspection. Changes to it are additive; the classic
   desk keeps working on the same contracts.
2. **World** (`lib/study-director-world/`, new deep module). Time, energy
   and focus, the map and its locations, NPC schedules and positions,
   professional relationships, what the player has learned, and the
   translation of world actions ("talk to Maya", "assign Site 03 queries",
   "review source at Site 03") into domain calls. Pure and deterministic
   like the domain, with its own seeded stream (`${seed}:world`) so it never
   consumes the domain's draws. Root files (`index.ts`, `types.ts`) are its
   public contract; `internal/` is private. It imports the domain only
   through `@/lib/study-director`.
3. **Presentation** (`components/study-director-world/`). A Canvas 2D view
   of the world and a React overlay for everything that is text: clock and
   HUD, dialogue, phone, EDC and eTMF screens, morning digest, overnight
   report, meetings and inspection. React stays the home of the fake
   enterprise systems; the canvas only draws the world.

### Time, energy and focus replace attention in the world

The day runs on a clock from 08:00. Every meaningful action costs minutes
(walking, talking, reviewing EDC, a sponsor call, a site visit, writing
documentation). The player can stay past 18:00, which costs energy and
lowers team morale. Energy (0 to 100) limits how long the player can keep
going; focus (0 to 100) is spent by demanding work, so a protocol amendment
written late in the day carries more risk than an email. Coffee restores
both, with diminishing returns after the fourth cup.

The domain gains an additive budget mode on `StudyState`: `"attention"`
(the default, today's behaviour) or `"clock"`. In clock mode the domain does
not refuse an action for lack of attention; the world enforces the time
budget instead, and the attention an action would have cost is still
recorded in the decision log so documentation debt and inspection replay
behave exactly as before. Routine load becomes minutes lost at the start of
the day.

### Information is the central resource

The world shows Budget, Timeline and Enrollment directly. Scientific
Integrity, Compliance and Team Capacity are inferred from the world:
clutter on desks, who eats lunch at their desk, who stays late, what people
say, and what the player finds on site visits. The domain's hidden site
state and audit reveal are reused as the backend: observations gathered on
a site visit resolve through `auditSite`.

Dialogue is a pure function of study state, the speaker's trust in the
Study Director and what the player already knows. Nearly every line carries
information, a relationship change, a warning, an opportunity or a joke;
there is no filler. A trusting Maya warns early; a wary Maya says "queries
are being handled."

### People

Each team member keeps the domain's professional state (role, archetype,
skill, speed, reliability, workload) and gains a world layer: energy,
stress, confidence, trust in the Study Director, current task, location and
a daily schedule. Schedules are derived from state, not scripted: an
overloaded member eats lunch at their desk and leaves late. Talking,
coaching and following through build trust; overriding, ignoring and
dumping work lower it. Delegation is the progression system: a member who
has been invested in takes ownership of a stream of work and stops needing
the player.

### Rendering

The world is drawn with a Canvas 2D renderer built on the shared arcade
core (`lib/arcade/core`: game loop, input, viewport), in the same ink-line
style as the office illustration. Phaser was considered: Phaser 4.2.1's
minified build is 344 kB gzip (measured 2026-09-30), which would use the
whole 350 kB lazy-chunk ceiling in `lib/dx/bundle-guard.ts` and need a
vendor exception, for a world that is a few tile maps and about a dozen
sprites. The decision is revisited if the world needs scrolling multi-map
streaming, tweening or audio mixing beyond what the arcade core offers.

The loop renders on demand: it runs while something moves and stops when the
scene is still, so an idle office costs no frames. Motion respects
`prefers-reduced-motion` (people step between tiles instead of gliding).

### Accessibility

The canvas has a text description of the current room and who is in it. An
office directory lists every person, station and destination as ordinary
buttons; choosing one walks the player there, so the whole game can be
played from the keyboard or a screen reader without steering. All dialogue,
screens and reports are DOM.

### Rollout

The world ships on the existing route behind `#mode=world` and a "Preview"
entry on the briefing, while the classic desk stays the default. The
default flips in a later ticket once the world version covers a full study
from briefing to closeout. The desktop-only gate
([ADR 0048](0048-desktop-only-arcade-games-on-touch-devices.md)) still
applies. Saves are separate per mode and versioned.

### First playable scope

The CRO floor (the player's office, data management, regulatory,
biostatistics, medical writing, monitoring, programming, conference room,
break room), three clinical sites reached by fast travel, and sponsor calls
in the conference room and by phone. Later: sponsor HQ, central lab,
pharmacy, work-from-home, work mini-games (source data verification, query
writing, protocol review, database lock board), the inspector replayed as
gameplay, organisational upgrades, and a career across studies.

### Amendment 2026-10-05: the office is the default

The owner expected a Stardew-style game and found the classic desk, so the
default flips (epic #1816). The route opens in the walkable office. The
classic desk stays one click away ("Switch to the classic desk") and keeps
its own saves. The last choice is remembered in the browser; `#mode=desk`
and `#mode=world` links always win, and a finished world run shows its
closeout on the desk without changing the remembered choice. The
"Preview" label is gone. A first-run dialog explains the controls, and the
office directory starts collapsed so the stage gets the room.

## Consequences

- The domain keeps one source of truth, so the classic desk and the world
  can run the same seed and be compared in tests.
- The world layer can be unit-tested without a canvas: time costs,
  schedules, dialogue disclosure and action translation are pure functions.
- The presentation is heavier than a dashboard; the canvas and its art load
  only on the Study Director route, inside the play cabinet.
- Everything in the game is fictional; no real sponsor, person or study is
  represented, and nothing here is regulatory advice.
