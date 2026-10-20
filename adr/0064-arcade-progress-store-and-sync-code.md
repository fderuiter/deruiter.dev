# ADR 0064: Arcade Progress Store and Sync Code

## Status

Accepted on 2026-10-19. The owner chose the sync code for moving progress
between devices. Builds on
[ADR 0062](0062-three-views-per-arcade-game.md), whose sessions own saves and
whose pause service owns the run snapshot, and on
[ADR 0036](0036-free-tier-offloading-and-provider-quota-governance.md)'s
free-tier limits. Tracked by
[#2548](https://github.com/fderuiter/deruiter.dev/issues/2548) (the store),
[#2549](https://github.com/fderuiter/deruiter.dev/issues/2549) (backup,
restore and reset) and
[#2550](https://github.com/fderuiter/deruiter.dev/issues/2550) (sync).

## Context

All arcade progress lives in one browser. About 60 `localStorage` keys
across 13 games, plus one IndexedDB autosave, were each written with the
owning game's own parser. Only Trial & Error validates with Zod. Nothing
about the arcade is stored on a server, and players cannot sign in.

A high score is stored in up to three places:

- `arcade_unified_progress_v1`
- a per-game "mirror" key that `recordArcadeScore` writes
- in five games, a key the game writes itself

The map from game to key is copied three times. Every read rescans the
mirror keys and the legacy keys. The mirror write has already caused a bug:
Meme Vault's mirror key is its unlock flag, so a new achievement re-locks
the vault
([#2533](https://github.com/fderuiter/deruiter.dev/issues/2533)).

ADR 0062 gives every game a phone, tablet and desktop view. That makes
playing one game on several devices the normal case. Today, progress made on
a phone stays on the phone.

## Decision

### One progress store, keeping today's keys

`lib/arcade/progress/` is a deep module that owns every read and write of
arcade progress.

- **A slice wraps one existing key.** `defineSlice({ key, class, version,
schema, migrate, merge, empty })` adds a Zod schema, a version and a
  migration chain, but leaves the key and its bytes where they are. Returning
  players keep everything, with no bulk data migration. A value with no
  version is treated as version 0.
- **One write path, one event.** `write()` validates the value, writes it
  through `lib/safe-storage.ts` and fires `arcade_progress_changed`. That
  event reaches the same tab and, through the native `storage` event, other
  tabs. `useProgress(slice)` wraps `useSyncExternalStore`.
- **A bad value never throws.** A value that fails to parse is kept aside
  under `<key>:corrupt`, the slice reads its empty value, and the player sees
  one notice.
- **A high score has one home.** That home is `arcade_unified_progress_v1`
  (the slice `arcade.core`). Mirror writes stop. Mirror and legacy keys are
  folded in once with `max`, kept for one release so a rollback loses
  nothing, then removed. The three copied game-to-key maps are deleted, and
  the hub reads bests through the registry.
- **A separate catalog lists slices.** `lib/arcade/progress/catalog.ts` lists
  each game's slices, which keeps `ARCADE_REGISTRY` small. A unit test keeps
  the two lists in step.
- **The session is the only writer.** A game's session is the only writer of
  its slices, and views never touch storage. Each game moves onto slices
  inside its ADR 0062 session-seam issue, not in a separate pass.
- **The rule is enforced.** A `lint:boundaries` rule allows `localStorage`
  only in `lib/safe-storage.ts` and `lib/arcade/progress`, among arcade
  modules.

### Four classes of data

| Class          | Examples                                                        | Backed up      | Synced |
| -------------- | --------------------------------------------------------------- | -------------- | ------ |
| Profile        | trophies, bests, Arcade Daily, unlocks, codex, careers          | yes            | yes    |
| Save slot      | run saves, Study Director save, Patty week, Protocol Drift save | yes            | no     |
| Device setting | sound, CRT, Layout, pre-game setup, tips and tutorials seen     | no             | no     |
| Device cache   | the ADR 0062 run snapshot, Garmin ghost replays                 | ghosts, opt-in | no     |

Tutorial flags stay on the device, because ADR 0062's first-minute coach
teaches that device's controls.

### Merges only add

Profile slices merge with joins, which are commutative, associative and
idempotent:

- `max` for bests, `min` for best times
- trophies are a union that keeps the earliest unlock time
- Daily keeps the better result per game and date, takes the union of played
  dates, and recomputes the streak
- unlock lists are a set union

So two devices converge whatever order they sync in, and a merge never takes
progress away. Fast-check property tests hold every join to those laws.

There are two exceptions:

- **Spendable balances** (Retro Labyrinth's currency) declare `spendable` and
  use last-writer-wins on a per-slice revision.
- **Save slots never merge.** When two copies differ, the player picks one.

### Devices link with a sync code

Turning on sync makes an 80-bit random code. A second device scans its QR
code or types it once.

- WebCrypto HKDF derives three values from the code: a profile id, an auth
  token and an AES-GCM key. The code never leaves the device.
- The profile is encrypted on the device. The server stores only
  `{ rev, authHash, ciphertext, updatedAt }` in Upstash Redis, with a 400-day
  TTL, and cannot read it. No email, name or account exists.
- `GET`, `PUT` and `DELETE /api/arcade/sync/[profileId]` form the whole API.
  `PUT` sends `If-Match` with the revision and is one atomic compare-and-set.
  Its schemas live in `lib/schemas.ts`, and the route is in `openapi.json`.
- Merging happens on the device: pull, merge, then push. A lost race returns
  412 and retries. The server has no game logic.
- The server is a relay, not the master copy. Every linked device holds the
  full profile, so losing the Redis key loses only the link. That is why Redis
  is enough and Neon is never touched.
- **When it syncs.** It pulls when the hub opens or a game launches, at most
  every 10 minutes. It pushes 30 seconds after a trophy, a best or a Daily
  result, and on `pagehide`. It never syncs during a run.
- **Cost.** About two commands per sync, under a per-IP and per-profile rate
  limit. When Upstash refuses, the device keeps playing locally.
- **Size and loading.** Only profile slices sync, capped at 64 KB of
  ciphertext. The sync engine is a lazy chunk and never part of a game's view
  chunk.

The backup file from #2549 uses the same payload format that sync encrypts.

## Consequences

- Each score is stored in exactly one place, and the class of bug in #2533
  cannot recur.
- Every store has a schema, a version and a migration path, and a bad value
  costs a notice rather than a crash.
- Progress follows a player across phone, iPad and desktop without an
  account, and the site stores nothing that identifies them.
- The backup and reset features get one implementation instead of one per
  game.

What gets harder:

- Every new profile field needs a join, and a field that can go down must be
  declared spendable. The property tests catch a join that breaks the laws,
  but not a field that should have been declared spendable.
- A player who loses every linked device loses the profile. That is the
  honest cost of having no account. A linked device can show its code again.
- Upstash's daily commands are shared with caching and rate limits. If sync
  passes about 3,000 commands a day, the pull interval grows first.
- `localStorage` still caps an origin at about 5 MB. Garmin ghost replays
  already drop the oldest ghost when storage is full.

## Alternatives considered

- **Backup file only.** It is free, private and cannot break, but every move
  is manual. It ships anyway as the first step, and sync builds on its format.
- **Sign in with Clerk.** This means accounts people already understand, but
  it adds Clerk's script to arcade pages against the phone budget, brings
  email addresses and privacy duties, and needs a durable server store that
  points at Neon. An account could later hold the sync code without
  replacing it.
- **One IndexedDB database for everything.** Rejected for now. It loses the
  synchronous reads that `useSyncExternalStore` and hydration rely on, and it
  forces a migration of every key. Revisit it if saves grow past about 1 MB.
- **Last-writer-wins for everything.** It is simpler, but a device that syncs
  late would erase trophies earned elsewhere.
- **Server-side merging.** It would put game logic and plaintext progress on
  the server for no gain, since the joins run the same on any device.

Public leaderboards are out of scope. Scores are self-reported, and trusting
them would need server-side replay of seeded runs, which is its own design.
