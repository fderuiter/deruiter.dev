# ADR 0046: Trial & Error: Biostat Ops Architecture

## Status

Accepted on 2026-09-23 with T&E-01 ([#909](https://github.com/fderuiter/deruiter.dev/issues/909)),
under the governing map [#890](https://github.com/fderuiter/deruiter.dev/issues/890).
Later Trial & Error tickets amend this record rather than contradict it.
Amended on 2026-09-23 for card-table presentation
([#942](https://github.com/fderuiter/deruiter.dev/issues/942)); see
[the amendment](#amendment-2026-09-23-card-table-presentation).
Amended again on 2026-09-23 to fix the game's narrative frame; see
[the narrative amendment](#amendment-2026-09-23-narrative-frame).

## Context

Trial & Error: Biostat Ops is a new standalone arcade game: a poker-themed
roguelike deckbuilder in which clinical outputs (Tables, Listings, Figures and
subject tokens) form scoring hands worth `Chips × Mult` against milestone
Blinds. Thirteen child tickets deliver it as vertical slices, so the first
slice has to fix the seams every later slice builds on: where the domain
lives, what may be random, how a hand is scored, and how blinded values are
kept out of the client.

Two existing clinical-themed surfaces are adjacent but out of bounds. Clinical
Trial Chaos (`lib/clinical-trial-chaos*`, `components/ClinicalTrialChaos.tsx`)
is a separate game, and CRF Studio (`lib/crf`) is a separate tool. Sharing code
with either would couple three products' release cadences and invite exactly
the "fix the prototype later" drift the governing map rules out.

## Decision

### Deep module

The game domain is the deep module `lib/trial-and-error/`:

- `types.ts` declares every contract as a Zod schema with its type inferred
  from it: populations (FAS and ITT are distinct members), card and hand
  types, rounding modes, `TableShellSpec`, `RuleCheckResult`, the SAP
  rulebook, population snapshot, staged table, QC finding and report,
  `HandEvaluation`, and `Scenario`.
- `scenarios.ts` holds fictional scenario presets.
- `index.ts` is the public API.
- `internal/` (rounding, hands, validator, scoring, CPU, desk) is private.
  `app/`, `components/` and `__tests__/` import only through the root entry
  points, which `npm run lint:boundaries` enforces.

React components (`components/trial-and-error/`) are thin adapters: they
render `deriveDeskView` and dispatch intents to `advanceDesk`. The route
`/arcade/trial-and-error` mounts the desk through the shared `PlayCabinet`
lifecycle with a `ssr: false` dynamic import.

### No imports from Clinical Trial Chaos or CRF Studio

Nothing under `lib/trial-and-error/`, `components/trial-and-error/` or the
route imports from `lib/clinical-trial-chaos*`, `components/ClinicalTrialChaos.tsx`
or `lib/crf`. Ideas may be copied; modules may not be shared.

### Determinism and the seeded-RNG boundary

Validation and scoring are pure: they never mutate inputs, never read browser
state, and never consult randomness. The validator returns findings in a
stable order (row, column, category), and every denominator is derived from
the population snapshot rather than from the table. Rounding uses exact
integer arithmetic (`roundRatio`), so a tie such as `543 / 12 = 45.25` is
detected exactly and resolved by the scenario's declared mode (half-even,
half-away-from-zero, or truncate). There is no universal N+1 or N+2 rule.

Randomness is allowed in exactly three places: the crisis deck and the
Boss pool (T&E-05) and shop inventory (T&E-12). All of them draw from one
counter-based PRNG in `internal/rng.ts`: the value at a draw index is a pure
function of the run seed and that index (FNV-1a over `seed#index`, mixed by
Mulberry32), so there is no generator state to carry. `RunState` records the
seed, the next draw index and a log of every draw, and the same seed plus
the same moves replays identically. Draw piles stay fixed, scenario-ordered
lists, and table state records the `deckIndex`. See
[Crisis cards, Boss pools and the seeded draw (T&E-05)](#crisis-cards-boss-pools-and-the-seeded-draw-te-05).

### Scoring pipeline

`evaluateHand` implements the pipeline pinned in #890:

```text
Hand Score = (base hand Chips + Σ output Chips + Σ relic Chips)
           × (base hand +Mult + Σ card and rule +Mult + Σ relic +Mult)
           × Π ×Mult
```

Chips and +Mult totals are floored at zero, and the score is floored to an
integer after binary floating-point noise is removed. Any `RuleCheckResult`
with `multMultiplier: 0` triggers the zero-score rule: final Mult is 0. That
covers an uncorrected fatal denominator error now and closed-session
unblinding (T&E-08) later. `HandEvaluation` returns the per-step ledger,
Chips, +Mult and ×Mult breakdowns, rule results and zero-rule flag. Later
tickets extend the inputs (relics, synergies such as T&E-06's ×2.0 TLF_PAIR
bonus applied as a ×Mult factor), not this output shape.

`ruleResultsFor` maps findings to scoring consequences. A corrected finding
earns its SAP rule's `correctionMultBonus`. An open fatal finding carries
×0. An open non-fatal finding is a redline that subtracts its
`redlineMultPenalty`. With no standing denominator finding, the population's
verified subject records are credited as Chips. The QC Desk's Expected Value
scores only the findings the reviewer has revealed. Approve & Play scores the
hand as it truly is, so an undiscovered fatal error still zeroes it.

### CPU

`cpuReducer` charges 2 CPU to play a hand, 1 CPU to discard or inspect and
2 CPU to recompile. An unaffordable spend returns the same ledger. T&E-04
adds a `REPLENISH` event rather than replacing the reducer: each Blind's
ledger is refilled once, deterministically, when the Blind starts. See
[Shell planning, CPU and footnote seals (T&E-04)](#shell-planning-cpu-and-footnote-seals-te-04).
T&E-05 adds an `ADJUST` event for crisis costs, which clamps at zero, and an
optional surcharge on `SPEND` for a Blind's discard penalty.

### Blinding lives in state, not CSS

Face-down or closed-session values (T&E-08) must be absent from client state:
the desk reducer receives redacted cards, not full cards with a hidden flag.
A test asserts that serialized state contains no blinded value.

## Consequences

- Scenario data can be validated at runtime with the same schemas the
  compiler checks, and schema tests cover acceptance and rejection.
- `vitest.config.mts` enforces a per-glob threshold of 95% statements,
  branches, functions and lines for `lib/trial-and-error/**`, above the
  repository-wide gate. The type-only barrel `index.ts` is excluded. `types.ts`
  holds runtime schemas, so it stays measured.
- Replay is a property test: any move sequence reduces to an identical state,
  and CPU is conserved.
- Every Trial & Error ticket touches only this module, its components, and
  its route registrations.

## Amendment (2026-09-23): Narrative frame

Recorded after a story review of the governing map and all of its child
tickets, on the owner's decision in the project thread. It fixes who the
player is, what a run is, and what each mechanic stands for, so that later
tickets write scenarios, boss names and flavour text against one story.
It changes no scoring rule. Where a child ticket's text disagrees with this
section, the ticket is updated to match it.

### Premise

The player is the lead statistician at a small, fictional CRO (working
name: _Fold Change Biometrics_). A sponsor has contracted it to carry one
compound through clinical development. Programmers produce drafts; the
player decides which drafts go into each package, checks the ones there is
capacity to check, and signs what is sent. The thesis is the scoring
formula: `Chips × Mult` is how much is delivered times how much it can be
trusted, so rigour is a multiplier, not a tax.

Committees, the sponsor and the FDA are not villains. They are the people
the numbers must convince. Pressure comes from deadlines and from the data.

### A run is one compound through three studies

Each act is a new study for the same compound: Phase I (First in Human),
Phase II (Proof of Concept) and Phase III (Blinded Pivotal).

| Carries over between acts                          | Resets with each new study              |
| -------------------------------------------------- | --------------------------------------- |
| The deck: the player's library of table shells     | Subjects, populations and snapshots     |
| Relics: the team members, macros and SOPs acquired | The SAP rulebook                        |
| Hand levels from Guidance cards                    | Every compiled output, which goes stale |
| Study budget                                       |                                         |

Losing a Blind ends the run: the sponsor moves the program to another
vendor. Clearing CSR Lock ends it in victory: the CSR is locked and the
package is submitted.

### The Blind ladder

The Small Blind is the player's own team, the Big Blind is the client or
an open committee session, and the Boss is someone who can stop the
program.

| Act             | Small Blind                    | Big Blind                                  | Boss Blind                                                          |
| --------------- | ------------------------------ | ------------------------------------------ | ------------------------------------------------------------------- |
| I · Phase I     | Internal QC                    | Sponsor safety review                      | Dose Escalation Committee                                           |
| II · Phase II   | Internal QC (efficacy dry run) | DMC open session                           | Drawn: DMC closed session or End-of-Phase-2 FDA Information Request |
| III · Phase III | Blinded data review            | DMC open session or sponsor topline review | CSR Lock (fixed)                                                    |

- **Boss pools.** An act's boss is drawn from that act's pool by the seeded
  event draw that T&E-05 already owns, so boss selection adds no new source
  of randomness. The Act III boss is always CSR Lock.
- **Act I is about safety.** Phase I measures safety and dosing, not
  efficacy. The Dose Escalation Committee scores Safety-population outputs
  only (`DISABLE_POPULATION` for every other suit). Kaplan–Meier figures
  and the Efficacy Full House first appear in Act II.
- **The FDA encounter** is framed as an End-of-Phase-2 Information Request:
  the questions that gate the move to Phase III. Its 48-hour clock exists
  only inside that encounter.
- **CSR Lock** accepts only a complete CSR Straight. That is why a hand that
  scores less than a Full House can still win the game.

### Mechanics in the story

| Mechanic              | In the story                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Deck                  | The player's shell library. The shop's table shells add to it.                                                        |
| Drawing a card        | A programmer compiles one shell against the current snapshot, and the draft lands on the desk, possibly with defects. |
| Hand of 8             | The desk's inbox of drafts for this milestone.                                                                        |
| Population suit       | The analysis set an output is built on.                                                                               |
| Play hand             | Submit a package to this milestone's reviewer.                                                                        |
| Discard               | Send drafts back to programming.                                                                                      |
| Inspect               | Run the independent double-programming compare on one draft, which reveals its discrepancies for correction.          |
| CPU                   | The milestone's allocation on the statistics compute grid. Runs, reruns and QC compares all spend it.                 |
| Chips                 | Volume: how much of the study the package covers, including the subjects it verifiably accounts for.                  |
| +Mult                 | Rigour: rules met and redlines corrected.                                                                             |
| ×Mult                 | Coherence across outputs, such as a figure that reconciles with its table or a table traced to its listing.           |
| ×0                    | A number that cannot be defended: a wrong denominator, or an unblinding.                                              |
| Stale card            | The data moved under the output.                                                                                      |
| Relics                | People and tools only (a lead programmer, a validated macro suite, a double-programming SOP).                         |
| Guidance cards        | Documents only (ICH E3, E9, E9(R1), E2A, CDISC IGs, FDA TCG).                                                         |
| Footnote seals        | Real table footnotes that legitimise a presentation choice.                                                           |
| Study budget          | What the sponsor pays at each milestone. Clean, early delivery earns a bonus.                                         |
| Site activation packs | New sites enroll subjects: more Chips, and a new snapshot that stales outputs.                                        |
| Crisis cards          | Things that happen to a study: dropouts, amendments, audits, migrations.                                              |
| DMC firewall          | The CRO's own firewall between its blinded study team and its independent DMC statisticians.                          |
| Starter sponsors      | The client whose compound it is.                                                                                      |
| Stakes                | How closely the CRO is being watched.                                                                                 |

### Consequences for the tickets

- **One role.** The player is one person throughout. The CRO holds both the
  study contract and, behind a firewall, the independent statistical
  contract for the DMC. The two-stage DMC encounter (T&E-09) is the player
  changing seats, and peeking is a breach of the CRO's own firewall.
- **Subjects are data, not hand cards.** Subjects live in the population
  snapshot and are credited as Chips through the scoring pipeline above.
  `SUBJECT_TOKEN` is retired as a playable card type; the ticket that next
  touches `CardTypeSchema` removes it. Discarding sends drafts back to
  programming rather than filtering data tokens.
- **Population Booster Packs become Site Activation Packs** (T&E-UX-06).
  Opening one enrolls subjects into the current study, which creates a new
  snapshot through T&E-03.
- **Relics are people and tools; documents are Guidance cards.** The relic
  once called "FDA Guidance 1998" duplicated ICH E9 and becomes
  _The ITT Purist_ (retriggers all ITT cards).
- **Campaign meters are reduced to two.** Study budget is the shop money,
  and the clock exists only in the FDA encounter. Sponsor Satisfaction and
  Scientific Integrity are not meters: goodwill shows up as cash-out
  bonuses, and integrity as redlines and the zero-score rule. Crisis cards
  act on CPU, Footnotes, budget and snapshots.
- **The default starter sponsor is Virtual Biotech**, a small client with
  no in-house biometrics. "Generic CRO" read as the player's own company.
- **Clinical Trial Chaos** sits upstream of this game (site data cleaning
  and SDTM mapping); Trial & Error sits downstream (analysis, tables and
  the study report). The two may share fictional names, never code.

## Amendment (2026-09-23): Card-table presentation

Recorded by T&E-UX-00 ([#942](https://github.com/fderuiter/deruiter.dev/issues/942))
before any card-table UI is built. It changes presentation only. The
determinism boundary, the scoring pipeline, the `HandEvaluation` shape and
the blinding-in-state rule above are unchanged.

### Card table first

The main screen is a hand of TLF cards, played as poker hands against the
Blind. The T&E-01 QC Desk becomes the optional **Inspect** view on a card.
Inspecting costs CPU, reveals hidden defects, and lets the player correct
them for +Mult. Playing an uninspected card is a gamble, because an
undiscovered fatal defect still triggers the zero-score rule. This is a
re-framing, not a scoring change: the desk already scores Expected Value from
revealed findings only, while Approve & Play scores the hand as it truly is.

### Calm at rest, loud when scoring

Planning happens in the spreadsheet-brutalist graphite identity of AGENTS.md
§20. Discrete, event-driven **loud moments** break out into saturated colour,
glow, screen shake and a CSS CRT/scanline layer. The loud moments are score
resolution, a Blind cleared or failed, the shop, pack opening, boss and act
intros, level-ups and CSR Lock.

All effects are scoped inside the cabinet. They never reach the portfolio
frame, the navbar or other routes. AGENTS.md §20 records this as a narrowly
scoped arcade-cabinet exception.

### Scoped tokens and the loud switch

`app/globals.css` declares every presentation colour as a `--te-*` custom
property under `[data-te-cabinet]`, following the scoped-token pattern of
AGENTS.md §13 and §19. The tokens are graphite surfaces, hairline, text and
muted text, the score colours, redline, validated, fire, and the five
population suit bands. `__tests__/trial-and-error-tokens.test.ts` reads that
block and asserts WCAG AA for every text token on both surfaces.

Loud layers (`.te-loud-*`) apply only under
`[data-te-cabinet][data-te-loud="on"]`. `TrialAndErrorClient` sets
`data-te-loud` from `useTeMotion().loudEffectsEnabled`, which is false under
`prefers-reduced-motion`, below 768px (AGENTS.md §16) and during server
rendering. A test asserts that every `.te-loud-*` selector carries both
attributes.

### Score colour language

Chips are steel-blue, +Mult is amber, and ×Mult flares rose-red. Redlines stay
rose and validated cells stay emerald.

### Rendering

Cards are DOM `<button>` elements animated with `framer-motion`, which is
already a dependency. The CRT, scanline and background layers are
GPU-composited CSS that is active only during loud moments. Animations use
`transform` and `opacity` only, keeping CLS at zero. There is no WebGL and no
canvas renderer.

### Score timeline

The domain emits an ordered, pure **score timeline** derived from
`HandEvaluation` (T&E-UX-02). The UI only plays it back and never computes a
score. The animation, the reduced-motion tally and the screen-reader
narration all read the same timeline, and a property test pins its sums to
`evaluateHand`.

### Pacing

Game speed is 1×, 2× or 4×, persisted per viewer by `useTeMotion`
(`localStorage` key `te:game-speed`, guarded and wrapped in try/catch), and
click or Space skips. Under `prefers-reduced-motion` the result is an instant
tally, with no shake, a single fade, and step-by-step live announcements.

### Audio, mobile and voice

- **Audio.** Synth SFX and one music loop on the existing `AudioProvider`.
  Muted by default, and they respect the global toggle.
- **Mobile.** Desktop-first but playable on phones, with a compact hand and
  tap-to-select. No shake, CRT or blur below 768px.
- **Voice.** Dry insider humour for relics, bosses and flavour text. It is
  written for biostatisticians, stays legible to non-specialists, and is
  never real clinical or regulatory advice.

### Run shape and new mechanics

A run is 3 acts × 3 blinds. Which reviewer sits at each Blind, and which
bosses each act can draw, is fixed by the
[narrative amendment](#amendment-2026-09-23-narrative-frame). The final
boss is always CSR Lock. **Guidance** cards
level up hand types (T&E-UX-05). Meta-progression is browser-local only: the
Codex, seeded runs, GCP-audit stakes and starter sponsors (T&E-UX-07 and
T&E-UX-08).

### Card Table implementation (T&E-UX-01)

Recorded by [#943](https://github.com/fderuiter/deruiter.dev/issues/943).

- **Hand detection.** `classifyHand` enumerates every subset of up to five
  selected cards and returns the highest-ranked hand. Ties go to more Chips,
  then to the earliest-selected cards. Only the scoring subset scores;
  kickers do not. Cards carry a `topic` (Table–Listing pairs,
  Figure–Table dependence), a `csrStage` and an optional MedDRA `soc`.
- **Composition.** Per-card review (`inspectCell`, `correctFinding`, the
  cell view and the slash value) lives in `internal/inspection.ts`. The T&E-01
  desk reducer and the new table reducer both delegate to it, so review
  behaviour is identical in both.
- **Inspect costs CPU once.** Opening a card costs `CPU_COSTS.INSPECT` (1).
  Reopening is free, and corrections persist on the card until it leaves the
  hand. A card without reviewable cells refuses Inspect without charging CPU
  and is never marked unverified, because it is not a gamble.
- **Preview versus play.** The preview plate scores revealed findings only
  and flags uninspected, inspectable cards as unverified. Play scores the true
  findings of the scoring cards through `evaluateHand`.
- **Stacking.** The Inspect drawer is portalled to `document.body`, or to the
  fullscreen element during real fullscreen, so the site chrome cannot paint
  over it from outside the table's isolated stacking context. It carries
  `data-te-cabinet` so the scoped tokens still apply.

### Score timeline implementation (T&E-UX-02)

Recorded by [#944](https://github.com/fderuiter/deruiter.dev/issues/944).

- **Domain.** `scoreTimeline(evaluation, context)` in `internal/timeline.ts`
  turns a `HandEvaluation` into ordered steps: hand base, each scored card,
  non-zero rule results, relics, ×Mult factors, the zero-score rule, the
  total and Blind progress. Every step carries its running Chips, +Mult and
  ×Mult, so the player displays values and never computes them. A fast-check
  property pins the final running totals and the TOTAL step to
  `evaluateHand`. `TableView.lastTimeline` exposes the last hand's timeline,
  with card numbers as names and `<category> ERROR` slam labels for the
  rulebook's fatal rules.
- **Pacing.** Each step lasts `min(450 ms, 3300 ms / steps) / speed`, followed
  by a 600 ms hold on the final frame. At 1× a hand of any length therefore
  resolves in under 4 s. Skip, by the focused Skip button, Space or a click
  on the plate, jumps to the resolved state. Speed is set with the 1×, 2× and
  4× buttons in the Blind panel.
- **Input lock.** During playback the hand and action buttons are `inert`,
  focus moves to Skip, and the round score, result panel and announcement
  wait for the timeline to resolve. Focus then returns to the hand, or to
  Restart when the Blind has ended.
- **Reduced motion and screen readers.** Under reduced motion there is no
  playback: the result appears at once, and the hand is announced as a single
  polite summary. This follows #944's acceptance criteria, which supersede
  the "step-by-step live announcements" in the Pacing section above. A "Last
  hand breakdown" disclosure lists every step's text after resolution.
- **No layout shift.** The plate has a fixed minimum height that fits both
  the preview and the player. Effects use transform and opacity only. Shake
  (×Mult, zero rule) and the flame (target crossed) are `.te-loud-*` classes,
  so they render only inside a cabinet whose loud switch is on.
- **Audio seam.** `useScorePlayback` accepts `onStep(step, index)` and calls
  it once per step as it plays. T&E-UX-04 attaches SFX there.

### Card faces and physicality (T&E-UX-03)

Recorded by [#945](https://github.com/fderuiter/deruiter.dev/issues/945).

- **Faces are data.** `TlfCard.face` is a Zod-validated `CardFace`: a Table
  miniature (2–3 columns, 3–5 rows), a Listing (3–4 subject rows), a Figure
  plot (Kaplan-Meier, sparkline or forest intervals) or a subject token. The
  scenario schema requires exactly one of `face` or `draftId` per card, and
  a face kind that matches the card type. Draft cards print the draft's
  first five rows through `TableCardView.face`, and show corrected values
  once the player fixes them. All face data is fictional and consistent with
  the snapshot (ITT 6/6, FAS 6/5, Safety 6/6).
- **Stamps.** `TableCardView.stamps` holds `REDLINE` while a revealed finding
  is open, and `QC_PASS` only once every cell is reviewed and nothing is
  open. The stamp never vouches for a defect the player has not looked for.
  `CardStamp` already lists STALE, SEALED and BLINDED for later tickets,
  which render in the same slot.
- **Face-down cards carry nothing.** `RedactedCard` is a strict
  `{ slot, faceDown: true }`. `TableView.drawPile` exposes the undealt deck
  only as these slots, and `CardBack` accepts only a `RedactedCard`. A type
  test and a serialization test pin both.
- **Reorder is cosmetic.** `MOVE_CARD` moves a card within the hand for no
  CPU and announces its new position. Drag-by-grip (pointer and touch)
  commits one `MOVE_CARD` on drop, and Alt+←/→ is the keyboard equivalent.
- **Physicality.** Cards are `framer-motion` buttons that fan on an arc with
  overlap past five cards, lift and tilt toward the pointer, deal face down
  and turn up (`CardFlip`), and breathe at rest. The breathing is a CSS
  keyframe on the compositor, not React state. Fan, tilt and breathing are
  off below 768px and under reduced motion; deal, flip and exit motion are
  off under reduced motion. Below 768px the hand is a flat row that scrolls
  inside its own container.
- **Calm at rest.** The breathing is a sub-pixel, 0.35° drift, not a loud
  layer: no colour, glow or shake. It follows #945's explicit request and
  AGENTS.md §16 (compositor keyframe, suppressed on mobile).
- **Reading a card is free.** `?`, a long press, or a second tap on a
  selected card (touch) opens a focus-trapped detail dialog with the face at
  full legibility (a real `<table>`, or a described SVG). It shows only
  what the output prints; hidden findings still need Inspect.

### Juice kit (T&E-UX-04)

Recorded by [#946](https://github.com/fderuiter/deruiter.dev/issues/946).

- **Named cues.** `useTeSound().play(cue)` covers the 18 cues in `TE_CUES`,
  from `chipTick` (pitch climbs per chip step, capped at an octave) to
  `bossStinger`. Each is a synthesized recipe over the shared `SoundEngine`
  (`playTone` with pitch ramps and audio-clock delays, `playNoise`). There
  are no sampled assets and `AudioProvider` is unchanged.
- **Gates.** `play` returns before any AudioContext work unless the cabinet
  SFX switch is on, a user gesture has happened, and the engine allows sound.
  That last check covers the site-wide mute (on by default) and its
  accessibility bypass, which includes reduced motion. The cabinet's SFX
  switch (on) and Music switch (off) persist under `te:audio` through
  guarded storage. When the site is muted, the cabinet offers "Unmute",
  which calls the provider's `setMuted(false)`. The cabinet has no hover
  sounds, so the `(hover: none)` rule has nothing to skip.
- **Wiring.** `cueForStep(timeline, index)` maps each score-timeline step to
  its cue and `ScorePlayer`'s `onStep` plays it. Card-table events play
  select, deselect, discard, deal and flip cues. A Blind that ends plays
  `blindCleared` or `blindFailed` once the hand resolves.
- **Music.** `TeMusicLoop` schedules a triangle pattern through a lowpass
  filter on the audio clock with a 30 ms lookahead timer. It holds no React
  state, so a beat never renders. It starts only when Music is on, the site
  is unmuted and a gesture has happened. It stops when the cabinet unmounts,
  the tab is hidden, the site mutes or audio is torn down
  (`registerAudioCleanup`). Boss Blinds raise the tempo and the filter
  cutoff, and the loop ducks while a hand resolves.
- **Loud layers.** `LoudLayer` mounts a CRT overlay (scanlines, a vignette
  and a radial mask for curvature) and a slow conic swirl only while a hand
  resolves, and only when the cabinet's loud switch allows it. At rest it
  renders nothing, so nothing animates. Screen shake takes its amplitude
  from `--te-shake-amp`, set by `shakeAmplitude(intensity)` and capped at
  `MAX_SHAKE_PX` (6). `LOUD_PRESETS` names the flame and glow classes.

### Act I implementation (T&E-02)

T&E-02 (#911) turns the single Blind into Act I, a Phase I safety study
played as three Blinds, following the narrative frame proposed in #962.

- **One study, one opening snapshot.** `ACT_I` holds `DEMOGRAPHICS_SCENARIO`
  (Internal QC, 300), `SPONSOR_SAFETY_SCENARIO` (Sponsor Safety Review, 750)
  and `DOSE_ESCALATION_SCENARIO` (Dose Escalation Committee, 1,500). All
  three open on `SNAP-P1-v1`, whose twelve subjects now carry MedDRA-coded
  adverse events. `ActSchema` rejects Blinds that do not escalate or that
  declare different snapshots. (T&E-03 later lets the snapshot move within
  the act; see below.) Act I deals no efficacy outputs or Figures.
- **Shells.** A scenario declares `shells` rather than one `shell`, so a
  Blind can stage drafts of several outputs (the AE overview, the SAE table
  and one table per System Organ Class). Each draft names its shell.
- **Subjects, not events.** The `AE_SUBJECT_COUNT_PCT` row statistic counts
  subjects with at least one matching event, filtered by SOC, preferred term,
  seriousness, minimum grade or discontinuation. When a displayed n equals
  the event count, the VALUE finding says so. This is Act I's cross-table
  reconciliation: an SOC row must agree with its preferred terms, and Any
  TEAE with the SOC tables. Tracing a cell into its Listing is #915.
- **Boss debuff.** `BossBlindModifier.disabledPopulations` lists the suits a
  `DISABLE_POPULATION` boss switches off. The Card Table cancels a disabled
  card's Chips, and any subject credit its draft earned, with one explained
  rule result whose `ruleId` is the boss id; its +Mult still counts. The
  view marks the card `debuffed`. The other debuff types are declared for
  later bosses and have no effect yet.
- **Run layer.** `advanceRun` wraps the table reducer. `NEXT_BLIND` is
  accepted only once the Blind is cleared and deals the next Blind with a
  fresh CPU allocation. A lost Blind ends the run: table `RESET` is not a
  run action, and `RESTART_RUN` returns to the Small Blind. `deriveRunView`
  reports the phase (playing, Blind cleared, run failed, act complete) and
  whether the Blind's intro card shows.
- **Determinism.** Draw piles are fixed per Blind and nothing in the run
  consults randomness, so a replayed action sequence reproduces every state.
  Seeded randomness remains reserved for the crisis deck and the shop.

### Population snapshots and stale outputs (T&E-03)

T&E-03 (#912) makes the snapshot a versioned history, so the data can move
under the outputs. The design readings are in
[this comment on #912](https://github.com/fderuiter/deruiter.dev/issues/912#issuecomment-5813704616).

- **Versions.** `applyTransition(snapshot, transition)` applies one
  `PopulationTransition`: a subject joins or leaves named populations for a
  reason (dropout, protocol amendment, screen failure, protocol deviation).
  It returns the next version (`SNAP-P1-v1` becomes `SNAP-P1-v2`) with
  `capturedAt` set to the transition's authored `effectiveAt`, and never
  modifies the input. A transition that changes no membership is refused.
  The table state keeps every version in `snapshots`, oldest first, and one
  `SnapshotInvalidation` per transition: the transition, the subject, the
  populations whose membership changed, both snapshot references and the
  stale card ids.
- **Provenance.** Every dealt card records the `SnapshotRef` it was compiled
  against. Drawing is compiling: a draft dealt after a transition is
  compiled against the current snapshot by `compileDraft`.
- **Stale is per population.** A card is stale when its suit's membership
  differs between its snapshot and the current one, so a Safety-only change
  leaves ITT outputs valid. A stale card's Chips, and its subject credit,
  are cancelled by one explained `STALE-SNAPSHOT` rule result; Play Hand is
  refused while one is selected, with the alert "Output compiled against
  obsolete population snapshot; recompile required (2 CPU)."; and it cannot
  make a Population Flush. `flushBrokenBy` names the stale cards when they
  alone break one. Discard still works.
- **Recompile.** `RECOMPILE` (2 CPU, `CPU_COSTS.RECOMPILE`) reruns a stale
  card against the current snapshot. `compileDraft` recomputes correct cells
  and cells the reviewer corrected, and reproduces every other defect by the
  mechanism that explains it on the old snapshot (population, precision,
  rounding, events counted as subjects); a value nothing explains is kept as
  typed. The rerun is a new output, so its inspection starts over.
- **Study events.** Crisis cards (T&E-05) apply transitions through the
  same path, and Site Activation Packs (UX-06) will too. A scenario may also
  declare scripted `events`, each firing once after a given hand, between the hand being
  submitted and the hand refilling. Act I's Sponsor Safety Review has one:
  after its first hand, S-004 is found never to have been dosed and leaves
  the Safety population. `advanceRun` carries the history into the next
  Blind, so the Dose Escalation Committee deals against `SNAP-P1-v2`;
  `RESTART_RUN` returns to v1. Three reruns at the bottom of the sponsor
  review's deck give a player whose Safety drafts went stale a way back.
- **Presentation.** A stale card's printed data desaturates at once, a rose
  STALE stamp slams on (transform and opacity only, and simply appears under
  reduced motion), and its Chips badge strikes through to 0. The event is
  announced politely. The HUD shows the current snapshot, and Read a card
  and the Inspect drawer show the card's snapshot id and version.

### Shell planning, CPU and footnote seals (T&E-04)

T&E-04 (#913) adds planning decisions that sit before scoring. Fred's
comment on #913 pins two readings: CPU refreshes deterministically at the
start of each Blind, and footnote seals are finite, traceable in the
compiled output's metadata, and cannot silently override core SAP rules.

- **Blank shells.** A card may name a scenario shell (`shellId`) instead of
  carrying face data or a draft; the contract requires exactly one of the
  three. The shell declares its `compatiblePopulations` and a cell `layout`.
  A blank shell cannot be played, inspected or sealed, and Play Hand is
  refused while one is selected ("An empty shell cannot compile: allocate an
  analysis set to it first."). `ALLOCATE` is free and final: it compiles the
  shell with `compileShell` against the current snapshot, using a rulebook
  whose population is the allocated set, and the card takes that set as its
  suit. `previewAllocation` simulates the allocation for each compatible set
  so the table can show N, the snapshot and the best hand it would make,
  whose estimate stays "unverified" until the output is inspected.
- **CPU.** `cpuReducer` gains `REPLENISH`, and `createTableState` uses it to
  set the Blind's allocation. CPU never carries between Blinds.
- **Footnote seals.** A `FootnoteSeal` is a real table footnote with one
  effect: `PLUS_CHIPS`, `PLUS_MULT` or `WAIVE`. Each Blind may grant seals
  into a two-slot consumable tray (`CONSUMABLE_SLOTS`); the tray carries to
  the next Blind and `RESTART_RUN` empties it. `APPLY_SEAL` affixes a seal to
  an eligible card (by card type, population and topic) with a free
  footnote slot on its shell, and the seal prints as a numbered footnote in
  Read a card. A bonus seal adds its own `SEAL-<id>` rule result, so the
  score explains it. A waiver applies only to a rule whose `waivableBy`
  names that seal, and its result is kept, marked passed with the evidence
  "Waived by footnote seal …", rather than removed. The rulebook refuses a
  fatal rule that lists any waiver, so a footnote can never lift a ×0.
  `SELL_CONSUMABLE` removes a seal from the tray and adds its sell value to
  the study budget.
- **Act I content.** The Small Blind deals a blank Table 14.1.3
  (Demographics, compatible with ITT and Safety) and grants the Sponsor
  rounding standard (waives SAP-DM-03) and Adjudicated Endpoint (+3 Mult on
  a Safety table). The Big Blind grants AE Not Mutually Exclusive (+20 Chips
  on a Safety AE table), and the committee's deck deals the blank shell
  again, where only a Safety allocation scores.
- **Presentation.** A blank card has a dashed border, a SHELL badge and its
  compatible sets; the A key jumps to the allocation choices. Seals are
  picked up from the tray by click or keyboard and pressed onto a card with
  Enter or Space, or dragged onto it; Escape puts one back. A seal press is
  a loud moment scoped to the cabinet. CPU shows as pips, and a note
  explains which action the remaining CPU cannot pay for.

### Crisis cards, Boss pools and the seeded draw (T&E-05)

T&E-05 (#914) makes each run different without making it unfair. The
narrative amendment decides what a crisis may cost: CPU, footnote seals,
study budget and snapshot changes are the only resources.

- **Seeded draw.** `drawInt(seed, drawIndex, bound)` is the one source of
  randomness. A run starts from a seed (`DEFAULT_SEED` in tests and replays;
  the table takes `?seed=` or makes a fresh one) and `RESTART_RUN` may carry
  a new seed. Every draw is logged as a `RunDraw` with its kind, the card it
  chose and the Blind it served, and the run view exposes the seed and log.
- **Boss pools.** An act may declare a `bossPool` of Boss Blinds; its last
  Blind is then drawn from the pool when the run starts. A pool of one is
  fixed and consumes no draw. `runBlinds` resolves the act into the run's
  Blinds. Act I's pool holds the Dose Escalation Committee.
- **Crisis cards.** A `CrisisCard` has two or three choices, each with a
  label, a stated consequence and a deterministic effect: a CPU adjustment,
  a budget change, spending or granting a footnote seal, a population
  transition, or a Blind modifier. The contract requires one free choice,
  so a crisis can never end a run by itself, and a transition must name a
  subject in the snapshot. Every Blind after the first draws one crisis
  from the act's `crisisDeck`, without replacement; a spent deck draws
  nothing and consumes no index.
- **Answering.** While a crisis is pending, the table refuses everything
  but selection, reordering, selling a seal and closing Inspect.
  `RESOLVE_CRISIS` refuses a choice the run cannot afford and says why, then
  applies the effect in one step. A transition goes through the same code as
  scripted study events, so matching outputs in hand go stale. `RESET`
  restores the Blind's crisis.
- **Blind modifiers.** A Blind's modifiers are its Boss debuff plus any a
  crisis imposed. `HAND_LIMIT` fails the Blind once the limit is used short
  of the target, `DISCARD_PENALTY` surcharges every discard, and
  `BLIND_FIREWALL` masks arm columns on every face and refuses Inspect.
- **Act I content.** Site Audit, Protocol Amendment 2, Database Migration
  and Emergency Review. Freezing the database grants a Data cutoff seal
  (+10 Chips on a table) with a three-hand limit.
- **Presentation.** The crisis deals face down and turns up above the hand;
  in the cabinet it slams down as a loud moment. Focus moves to the first
  choice the run can afford, each choice shows its consequence and any
  refusal, and the table lists the Blind's modifiers, the seed and any hand
  limit.

### Guidance cards, hand levels and Run Info (T&E-UX-05)

T&E-UX-05 (#947) adds build identity: Guidance cards are the game's Planet
cards.

- **Hand levels.** A run keeps `HandLevels`, one `{ level, playedCount }`
  per hand type, starting at level 1. `evaluateHand` takes the hand's
  `level` and scores from `leveledBase`: `HAND_BASE_SCORES` plus one
  `HAND_LEVEL_BONUS` per level above 1. The evaluation records its `level`,
  and the timeline's `HAND_BASE` step carries it. Score is monotone
  non-decreasing in level for a fixed hand, which a property test checks.
- **Balance.** Per level: High Table +10 Chips/+1 Mult, TLF Pair +15/+1,
  TLF Two Pair +20/+2, Population Flush +25/+2, CSR Straight +30/+3,
  Efficacy Full House +35/+3, MedDRA Five of a Kind +35/+3. These are the
  ticket's numbers; a level is worth roughly one strong output card, so a
  levelled hand shifts a build without replacing inspection.
- **Guidance cards.** `GUIDANCE_CARDS` holds one per hand, named after a
  real document (FDA Study Data TCG, CDISC SDTM IG, CDISC ADaM IG, ICH E9,
  ICH E3, ICH E9(R1), ICH E2A). Flavour text is dry insider humour and is
  not regulatory advice. They share the two consumable slots with footnote
  seals: a `Consumable` is now a `SEAL` or a `GUIDANCE` item. `USE_GUIDANCE`
  levels the hand, removes the card and records a `LevelUp` on the event;
  `SELL_CONSUMABLE` sells either kind. Using one is allowed while a crisis
  waits, like selling, because it does not play the Blind. Hand levels and
  unused cards travel with the tray and budget in `Inventory`; `RESET`
  restores the Blind's opening levels and a new run starts at level 1.
- **Act I content.** A scenario may grant `guidance` into free tray slots
  after its seals. The Sponsor Safety Review grants ICH E2A. The shop
  (T&E-UX-06) will sell the rest.
- **Presentation.** Using a card is a loud moment: the hand's plate steps up
  a level while its Chips and Mult tick from the old base to the new, with a
  chip tick and a mult thunk. Under reduced motion the numbers land at once.
  The live preview shows `Lv.N`. Run Info is a focus-trapped dialog with the
  hand table, the relics and the run seed, which moved there from the Blind
  panel. The ticket asks for the R key, but R on a focused card already
  recompiles it (T&E-03), so Run Info opens with Shift+R anywhere in the
  table and from a header button.
