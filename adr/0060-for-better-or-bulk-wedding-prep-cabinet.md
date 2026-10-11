# ADR 0060: For Better or Bulk Wedding-Setup Cabinet

## Status

Accepted on 2026-10-11, under the epic
[#1904](https://github.com/fderuiter/deruiter.dev/issues/1904) and its child
[#1905](https://github.com/fderuiter/deruiter.dev/issues/1905). Follows the
headless-engine pattern of
[ADR 0026](0026-headless-arcade-engine-lifecycle-and-html-hud-standard.md),
the desktop-only rule of
[ADR 0048](0048-desktop-only-arcade-games-on-touch-devices.md) and the
playable-diary framing of
[ADR 0059](0059-patty-drive-thru-first-person-3d-cabinet.md).

## Context

_For Better or Bulk_ is a short playable diary of the owner's wedding on
10/10/25 at the Plummer House in Rochester. It came in under about $4,000,
mostly from Costco, and he built the wedding website himself. The premise is
"you bought everything; someone still has to turn it into a wedding."

A first design was a turn-based planner over three days. The owner rejected it
because it played like the site's other management games. The arcade had no
real-time co-op game, so the cabinet takes the most popular archetype that
fits a frantic setup day: a top-down kitchen-chaos game in the style of
_Overcooked_. Fred and Abbi run around the venue between 9:00 and 4:00,
carrying Kirkland roses to the rose table, hot dogs to the grill and chairs to
the lawn, played solo with a swap key or by two people on one keyboard.

Four requirements shape the engine:

- The ending must explain why each outcome happened, without grading the real
  wedding.
- Saved labour must not count as presence: an empty to-do list does not keep a
  promise to be there.
- Runs must replay exactly from their inputs, so a shared run and a test see
  the same level.
- The real story and the invented gameplay must stay distinguishable.

## Decision

### A pure, fixed-step engine

The rules live in the deep module `lib/for-better-or-bulk/`. Its public
surface is `index.ts`, `types.ts` and `presets.ts`. The engine has no React,
no DOM, no database and no randomness. A level is one plain `GameState`.
`stepGame(state, frame)` advances one tick of `TICK_SECONDS` (1/30 s) from
both players' inputs and returns a new state plus one-shot events for sounds,
toasts and jokes. It never mutates its input. Front ends run it from a
fixed-timestep accumulator and record frames.

### A kitchen game on a venue map

`VENUE_MAP` is a 20 by 12 tile grid. People move continuously with circle
against tile collision and interact with the tile in front of them:

- **Crates** hand out roses, food, lanterns and chair stacks from a shared
  stock that the cart set. Stock is exactly what the plan needs for roses, and
  extra food batches are insurance against burning, never a score.
- **Stations** transform what is put on them: held work at the rose table and
  petal bucket turns roses into arrangements or petals, the grill cooks raw
  hot dogs and wings and then burns them if nobody comes back, and the bin
  takes anything.
- **Targets** in the venue take one item each: tables, the aisle, chair spots,
  lantern hooks, the buffet and the bouquet basket. A target the cart did not
  pay for is unplanned, and an empty centerpiece or petal spot can be
  simplified on purpose with held work. Simplified is a distinct readiness
  state from unfinished, so a restrained wedding can finish cleanly.

Each crafted or grilled item and each placement records who did it, so the
receipt can say who made and placed what.

### The website and the brothers

Website features chosen before the level block specific phone calls, which
otherwise freeze someone for a few seconds at fixed times. At 9:50 game time
Fred's brothers text, and the clock stops until he answers:

- **Stay.** Fred keeps working but re-ties his shoes every so often.
- **Break.** Fred leaves for 40 game seconds and promises to come back for one
  thing: chairs, lanterns, the buffet or the flowers. He returns calm and a
  little faster.
- **Leave.** Fred is gone for 70 game seconds on the 200 second clock (scaled
  for the relaxed clock), so a leave at the latest text returns him at 180 s.

Follow-through is kept on staying, or on a break whose promised work is not
unfinished at the end. Leaving always misses it, even when Abbi finishes every
target alone.

### Explanations from conditions

`computeReceipt` derives the whole ending from the final state. Each readiness
line holds a list of conditions, each with its evidence (what the cart bought,
who made the items and who placed them), and its explanation is generated
from that list. Titles come from a fixed priority order, and there is no
score. The receipt says that explanations describe this game, not the real
wedding.

### Replay validation

`replayLevel(setup, frames)` rebuilds a level from its setup and recorded
frames. A brothers decision travels inside its frame, and `validateDecision`
gives a plain-language reason when it does not fit. Strict mode, the default
for shared runs, throws a `ReplayError` at the first decision that does not
fit. Lenient mode drops it with its reason. A property test drives random
inputs for both players and checks that a replay is identical, nobody ends up
inside a wall and no stock goes negative.

### Facts policy

`REAL_WEDDING_FACTS` holds what the owner and his wife reported, and the
engine never reads it. `FICTION_DEFAULTS` lists the details invented for play,
such as the layout, the call times and the break and leave options. All prices
are game prices against a fictional $3,400 budget. The tux shop is the
invented "The Suit Wherehouse". Kirkland and Costco appear only as plain text
in a personal story, with no logos.

## Consequences

- The cabinet, jokes and receipt card
  ([#1906](https://github.com/fderuiter/deruiter.dev/issues/1906),
  [#1907](https://github.com/fderuiter/deruiter.dev/issues/1907)) are thin
  views over `stepGame`, `getPrompt`, `clockLabel` and `computeReceipt`.
- Two-player couch co-op needs only a second key map, because the engine
  already takes both players' inputs every tick.
- Balance lives in `presets.ts`. Tests pin the budget cap, the grill timings,
  the brothers' rules and every title, so tuning cannot silently break them.

## Alternatives considered

- **The turn-based three-day planner.** Rejected by the owner: it played like
  the arcade's existing management games.
- **A packing puzzle or a cart race.** Offered as alternatives. The
  kitchen-chaos format fits a setup day with two people best and supports
  co-op.
- **A grade out of 10.** Rejected: it would put a verdict on a real wedding.
- **Automation satisfying presence.** Rejected: it contradicts the real story
  and makes leaving free.
- **Variable-step simulation.** Rejected: frame-rate dependent results would
  break replay and tests.
