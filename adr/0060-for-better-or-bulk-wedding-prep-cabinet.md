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

## Amendment (2026-10-11): the solo helper

Issue [#1917](https://github.com/fderuiter/deruiter.dev/issues/1917) adds an
optional helper for solo play. It is off by default and never runs in co-op.
When the setup turns it on and the player is alone at the keyboard, a
deterministic policy moves the partner the player is not controlling, Abbi
when Fred is at the keys, and Fred when Abbi is. It walks to the places the
hints name, using the same gates as the hints (`internal/gates.ts`), so the
two cannot disagree about where roses go or what is wanted. It works at about
40% of a skilled player's pace: on two ticks of every five it walks and
presses, and its held work keeps its hold but progresses only on those ticks.
The player stays the main actor. The helper skips any tile the person it helps
is facing and any place that person is carrying an item to, and takes one of
those only when nothing else is open, so it can never stall with an item it
cannot place. A batch the helper put on a grill is its own to collect: it waits
by the grill until the batch cooks, takes it off before any other work, and may
act on that tick even when the placement gate is shut, so its batch cannot burn. Its status line, `Helper: <action>.`, names the goal it is
following. The brothers' leave option says that Abbi works alone until Fred is
back, and a person who is out shows a "Back around" time in the side panel.
It never decides for Fred: it never answers the brothers' text, never changes
presence, and never acts for someone who is out, on a call or re-tying shoes.
The receipt names the helper only when it acted on at least one tick, so a
co-op run or a solo run where the helper never mattered shows no such line.
Replays keep the partner on every frame, so a recorded assisted run replays to
the same full state.

## Amendment (2026-10-11): seeded events and the daily seed

`Setup` now carries an optional `seed`. Seed 0, which is also what an absent
seed means, is the standard day and schedules no events, so every existing
run and pinned test replays unchanged. Any other seed draws two events from
its own generator in `lib/for-better-or-bulk/internal/prng.ts`: a shower
starting between 40 and 100 standard seconds, and a guest rush starting
between 70 and 150. The same seed always gives the same times, so seeded runs
still replay exactly from setup and frames.

- **The shower** lasts 24 seconds. People walk at 0.6 speed on the lawn
  rows below the patio (`PATIO_ROWS`) while it is on, and a toast opens it.
  Walking is the only effect, so nothing is lost or re-done.
- **The guest rush** lasts 15 seconds. Cooked food's pickup window runs at double
  speed while it is on, so the buffet's food has to be collected sooner, but
  nothing burns on the rush's first tick.
- **The receipt** keeps the real weather line. Any shower is printed as game
  weather, on its own line, and a shower the work finished before says so.

`dailySeed(utcDate)` hashes the UTC calendar day, so everyone who plays on one
day gets the same events. It is always from 1 to 2^31 - 1. `?seed=` reads an
integer from the link, and anything that is not a whole number in that range
falls back to the standard day. The setup screen offers "Standard day" and
"Today's seed", and computes the daily seed in the browser only, after the cabinet mounts.

Every line the game can say sits in `LINE_BANK`, each tagged [Real] or
[Fiction]. A [Real] line must quote its fact from section 1 of the design doc word for
word, and the test suite checks it against a verbatim fixture of those facts. The hard rules still hold: no makeup
story, no speech story, the tux shop is "The Suit Wherehouse", and Kirkland
appears only in product text.

## Amendment (2026-10-11): game challenges, run codes and replays

**Status: accepted on 2026-10-11.** The owner, Fred, approved challenge stars
with the copy below. This amendment records that decision.

Every finished run is checked against three game challenges, and the number
met (0 to 3) is shown as stars. The receipt prints the copy "Game challenges.
Not a grade on the wedding." above them. The challenges are about game play
only and read facts the engine already keeps:

- **No burnt batches:** `burntBatches` is zero.
- **Everything set by 3:00:** every planned target was filled by six sevenths
  of the level clock, which is 3:00 on the wall clock.
- **Every promise kept:** the brothers never called him away, or he chose to
  stay, or he took a break and the category he promised to come back for was
  finished by the end. A leave does not meet it. The label names no person
  and judges no one. The challenge was called "Fred stayed" when it was
  approved and was renamed in review; the rule is otherwise as approved, and
  the owner should confirm the new name.

Stars are a game score, not a grade. They never judge the real wedding, and
they never change the receipt's title, follow-through or spending.

**Run codes.** A finished run becomes a code `f1.<base64url>` that the page
puts in a `#run=` link. The body holds the setup (seed and assist included),
the frames run-length encoded, and the result a replay must reproduce:
placements, the finish time and the end time. A four-byte FNV-1a checksum
covers the body, and the decoder accepts only canonical base64url, minimal
varints and no two identical frame runs in a row, so one run has one code. Decoding
never throws. A damaged, truncated, over-long or other-version code is refused
with one message. A code that decodes must also replay strictly to its own
result before it can be shown. Helper-day run codes recorded before this change
no longer verify.

**Replays.** "Watch replay" plays a verified run back through the same
engine, at 1x, 2x or 4x, with play, pause, restart and exit controls (Escape also exits). Once a replay
exits or finishes, and when a shared offer is dismissed, the page clears the
`#run=` fragment so a reload does not offer it again. Replays
record no score and no trophy, and they play no sound. A link with `#run=`
offers the replay on load and never starts it, so audio stays off until a
person chooses. Interaction targeting (the faced tile, then a station beside
the person that takes the item, then the floor) changes which tile a press
uses, so run codes recorded before this change no longer verify, as with the
helper change above.

**Trophies.** Three trophies are awarded from a finished run, not from a
score: Three for Three (three stars on the standard day), A Perfect Day (three
stars on a seeded day) and Nothing Burnt (every task set, no burnt batches).
They award only at normal speed and never to an assisted run. The existing
For Better or Bulk trophies are unchanged.

**Seeds.** Only the standard day (seed 0) records a high score. A seeded day
can still earn its own trophy.

## Amendment (2026-10-12): playtest round 13 chair spots

Issue #1969. Chair spots are solid. A chair spot (O) is a target, not ground,
so a person walking into an empty one stays on the floor and faces it, and a
chair is placed from the tile beside it. The solo assist routes to a floor tile
beside the spot and faces it. Aisle spots (S) stay walkable, and the venue
letters are no longer printed in player copy.

**Run codes recorded before this change may not verify.** A walk into an empty
chair spot now stops on the floor, so the same frames can reach a different
state. An `f1.` code recorded before this rule is refused as not replaying to
the same result. `RUN_CODE_PREFIX` stays `f1.`, as the standing decision for
this cabinet.

## Amendment (2026-10-11): reactive jokes, ceremony playback and the receipt card

**Reactive jokes.** Each joke is named by the engine event that triggers it
(`components/for-better-or-bulk/jokes.ts`). The "Yes" roses joke plays once per
level, on the first rose pickup in a "Yes" cart. The rest play on their event:
a blocked or open phone call, the burnt batch, the re-tied shoes, the leave
choice, the simplified use and the no-FAQ guest. Canvas jokes (the car behind
roses, the smoke, the crumpled note and the suit on its hanger) are drawn from
the same state and only in the loud cabinet. New copy is tagged [Fiction] in
the line bank, except the receipt's real facts.

**Ceremony playback.** The playback is skippable at every point: Skip and
Escape both hand over to the receipt once, and the last scene does the same.
Its scene holds shorten with the game's `?speed=` (each holds at least 1.5
seconds), so an end-to-end run at 8x stays quick. The scenes are one live
region whose text changes, so a screen reader hears each scene.

**Reduced motion.** With `prefers-reduced-motion: reduce`, the playback is a
static summary card with every scene as text. Canvas bursts and the scene
fade are off in that mode and everywhere outside the loud cabinet, and they
animate only `opacity` and `transform` (`app/arcade/arcade.css`).

**Effects scoped to the cabinet.** The loud moments (smoke, crumple, roses,
the ring on a filled target) are drawn only inside `[data-fbb-cabinet]` with
`data-fbb-loud="on"`, as the scoped arcade-cabinet exception in the
zero-trope invariant allows. Nothing is drawn outside the cabinet.

**Receipt card.** The receipt takes focus on its title when the playback hands
over, so focus never drops to the page. It ends with "What actually happened":
fixture facts only (the date and ceremony times, the weather and Abbi's goal),
with a link to `/wedding`. The note never describes the couple's mindset.

## Amendment (2026-10-11): playtest round 5

Round 5 of the playtest (#1948) changed the rules below. Some changes are in
the engine, so a run recorded before them can replay differently. The first
bullet says which runs are affected.

- **Run codes recorded before these changes may no longer verify.** A shared
  run code replays its frames on the current engine and must reproduce its own
  result. A code made before round 5 still verifies unless its run took chairs
  from the chair crate or binned a burnt batch. Those runs replay differently,
  so their codes can fail verification and must be played again to share.
- **Burnt batch recovery.** A burnt batch remembers the crate it was cooked
  from. Binning it (holding work at the bin until it is thrown out) restocks
  one batch of that crate, recorded as a `restocked` event and in the receipt's
  kitchen line. The setup note for the food tiers says so.
- **Chairs come in stacks of two.** One take from the chair crate picks up two
  chairs (one when only one is left). A chair spot takes one chair and the
  second stays in hand. Holding a stack at the bin returns it to the crate,
  count by count, so the venue's eight chairs are never lost. The crate holds
  the venue's eight chairs.
- **One outline per person.** The canvas outlines the tile the interact press
  acts on, solid when the press can act and dashed when that tile is busy or
  waiting. An unused faced tile is not outlined.
- **Simplify says what it does.** The work prompt on an empty centerpiece or
  petal spot reads "leave this table bare (drops it from the plan)", and the
  manual says so.
- **Prompts name the tile.** A take prompt names the item and its crate or
  station, for example "Take the roses from the ROSE crate" and "Take the
  cooked wings off the GRILL (G)".

## Amendment (2026-10-11): playtest round 6

Round 6 of the playtest (#1951, on the #1949 build) changed the rules below.
The first bullet is an engine change, so a run recorded before it can replay
differently. Only runs that touched a corner are affected.

- **Runs recorded before the corner assist may not verify.** A shared run code
  replays its frames on the current engine. A code made before round 6 still
  verifies unless its run pressed into a table corner with no input on the
  other axis. Such a press now nudges the body toward the centre of its lane,
  so those runs replay differently and their codes can fail verification.
  They must be played again to share.
- **Corner assist.** When a press into a blocked edge has no input on the other
  axis, the body moves toward the centre of its own row or column by at most one
  step (the distance it walks in a tick). It only does so when the tile it is
  pressing into is walkable, so a solid wall with no lane does not slide, and
  only when the nudged position is clear. It is deterministic and needs no
  randomness.
- **Keyboard exit is stated in solo.** The solo hint and the manual say that
  Shift+Tab leaves the cabinet, next to Tab, which swaps players.
- **Every toast in a batch is announced.** The live region reads each line that
  arrived in the same frame, joined with a space. Toasts themselves stay
  `aria-hidden`.
- **The bin prompt names the hold.** The engine's prompt is "Hold to throw it
  out", and the cabinet shows it with the key, for example "Hold F to throw it
  out".
- **Fred's carried item is set down when he leaves.** The leave option says
  that whatever he carries is set down on the floor near him, where Abbi can
  pick it up while he is away.

## Amendment (2026-10-11): playtest round 8

Issue #1955. Round 8 fixed what the playtest found in the brothers' text, the
prompts and the receipt copy. The rules below are the current ones.

- **The brothers' text is seen and chosen on purpose.** Focus opens on the
  dialog heading, not on "Stay and help". For 500 ms after the text opens, the
  keyboard's Enter, Space and E cannot choose an option (mouse clicks can, at
  once). Escape never chooses, and it does not open the pause sheet over the
  text. The clock stops in the same step that shows the text and its toast.
- **A promise cannot be kept for free.** The break menu offers only categories
  that still have planned work to do. A category that is already complete is not
  offered, and the engine enforces the same rule: `availableCommitments` in
  `internal/receipt.ts` decides, and `validateDecision` refuses a break whose
  promise is not in that list, so a crafted run cannot keep one.
- **A spot that takes something else says which dish it takes.** A cooked food
  faced at a buffet slot that wants another dish reads "This spot is for wings.
  The hot dogs go on their own spot." and the press does nothing.
- **A blocked station is named before a floor drop.** When the press would put
  an item on the floor and a station in reach that takes it is occupied, the
  prompt reads "The GRILL (G) is full. Put the raw wings on the floor".
- **A body that straddles two tiles can reach either one.** The body is a circle
  of `PLAYER_RADIUS`. It straddles a boundary across its facing only when its
  centre is within `PLAYER_RADIUS / 2` of that boundary, so a sliver of overlap
  does not count. When it straddles, the tile in front of the neighbour is a
  candidate too. The nearest tile's front is tried first, then the other, and a
  press uses the first that takes the held item (or, with empty hands, has
  something to pick up). Work at a station uses the same tile (`workTileFor`).
  The engine, the prompts, the coach outline and the solo assist all read this
  one rule in `internal/press.ts`.
  **Older runs may not verify.** A run recorded before round 8 can press a
  different tile at a straddle, so its replay and share code can fail
  verification. Such runs must be played again to share.
- **A full floor says why.** A press that would drop an item on a full floor
  (`FLOOR_CAP`) does nothing, and the prompt reads "The floor here is full. Find
  a station or the bin.", with the blocked-station line in front when one applies.
  The press also raises the floor-full toast.
- **The solo helper plans presses from a tile centre and keeps to the same tiles
  as the person it helps.** Before an interact or work press, the helper lines up
  on the centre of its tile across its facing, so the press lands where its plan
  says. The tiles claimed by the other person come from `workTileFor` and
  `pressTileFor`, the same rules the simulation uses.
- **A phone call says who is on it and how long is left.** The prompt reads
  "Abbi is on the phone (about 6 min left): What should we get you?", with the
  time in wall-clock minutes like "Back around" in the other prompts.
- **Receipt and toast copy is plain.** The shop is "The Suit Wherehouse" with no
  aside. A blocked website feature reads "Registry scraper: 1 call got through
  without it." Fred's shoe retie reads "Retying a shoelace." and "Fred stops to
  retie a shoelace.", and a stay reads "Fred stayed for the whole setup."

## Amendment (2026-10-12): playtest round 11

Issue #1965. A floor drop needs a deliberate hold, and the chair stack, burnt
food and coach copy say what a press does. The rules below are the current ones.

- **Setting an item down on open floor takes a hold.** A press of interact that
  would put the held item on open floor starts a hold on that tile and facing,
  and does nothing else. The item is set down after E has been held for
  `FLOOR_HOLD_TICKS` (12 ticks, 0.4 s of game time). A tap does nothing. Moving
  to another tile, turning, letting go of E, or anything else that changes the
  tile ends the hold, and a new press starts it again. Presses on stations,
  crates, bins, spots and the buffet stay taps. The input carries `interactHeld`
  for each tick E is down, and `floorDropPress` in `internal/press.ts` says when
  a press would drop on the floor. The solo helper holds E the same way and
  pauses the hold on its resting ticks.
  **Older run codes will not verify.** Frames now carry `interactHeld`, so the
  symbols in a run code mean something different. An `f1.` code recorded before
  this rule decodes to a different day and is refused as not replaying to the
  same result. The decoder never throws on such a code. Play the day again to
  share. `RUN_CODE_PREFIX` stays `f1.`, as the standing decision for this cabinet.
- **A floor hold ends with the brothers' text.** The hold is cleared for both
  people when the text opens and when a decision is made, and the component
  clears the held keys on a decision. E must be pressed again after the dialog.
  A hold also ends on a pause, since a paused clock sees no E.
- **The floor hold shows its progress.** The floor-drop tile fills from its
  bottom in the active amber as E is held, so the count is visible.
- **The floor drop prompt names the hold.** It reads "Hold E to set the roses
  down on the floor here" (Enter for Abbi in co-op, "E or Enter" solo), with a
  station in reach that is full in front when one applies.
- **A chair stack says what one press does.** With a stack of two or more chairs
  at an open chair spot, the prompt reads "Place a chair (1 more in the stack)".
  One press places one chair, and the rest stay in hand.
- **Burnt food is refused with the bin named.** Holding burnt food, a press that
  does nothing anywhere but the bin reads "Burnt food goes in the BIN (X)." The
  bin itself gets the hold line, as before.
- **Coach lines name the key.** The coach names the work key the way the prompts
  do: "hold F" for Fred in co-op, "hold Shift" for Abbi in co-op, and "hold F or
  Shift" solo. The key names come from `workKeyName` and `interactKeyName` in
  `internal/words.ts`, which the game component also uses.
- **The brothers' copy is about the situation.** The text opens before any break
  or leave, so Fred's line reads "The wedding is still on." It says nothing about
  his mood.
- **The weather line has no joke.** The real weather line reads "The weather was
  perfect."
