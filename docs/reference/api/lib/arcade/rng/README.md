[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / lib/arcade/rng

# lib/arcade/rng

The session's seeded random stream (#2544, ADR 0062).

A session owns its game's randomness and time, so a seed and an action
stream always give the same run, a saved run resumes the same stream, and
a replay fixture recorded on `main` still matches after a seam change.

Two streams per session:

- `session.rng`, made with [createRng](functions/createRng.md), for every draw that changes
  game state or score: spawns, drops, rolls, enemy choices.
- Cosmetic randomness in views (particles, shake, pulse phases), where
  `Math.random` is fine, because views only paint.

A session never calls `Math.random` or `Date.now` for game state. DX Doctor
flags both calls in files named `use*Session*` and in the engine modules a
session owns (`checkSessionDeterminism` in `lib/dx/doctor.ts`).

The rule for each game's seam issue: thread an `rng` parameter through the
engine first, with `Math.random` as its default so production is
unchanged, then extract the seam.

## Recording replay fixtures before a seam

A game that still draws from `Math.random` is recorded against today's code
on `main`, before its seam is extracted. This is the method the session
replay helper (#2365) uses:

- Stub `Math.random` with a seeded stream, such as
  `vi.spyOn(Math, "random").mockImplementation(createRng(seed).next)`, so
  the recording is repeatable without touching the engine.
- Fake `requestAnimationFrame` and the clock at a fixed 16.67 ms per
  frame (`SESSION_STEP_MS`, one fixed step), so frame-rate-dependent rolls
  see the same `dt` on every run.
- Feed the action stream, then compare game state only. Leave out cosmetic
  fields (particles, shake, pulse phases, flashes), so that moving
  cosmetics into a view, which takes their draws off the gameplay stream,
  does not break the fixture while gameplay is unchanged.

The algorithm is Mulberry32, the same stream as `createSeededRandom` in
`lib/arcade/utils.ts` and the Garmin race stream (`courseRandom` in
`lib/garmin/course.ts`). Its state is one 32-bit number, so it serialises
into the run snapshot as `rngState`.

## Interfaces

- [SessionRng](interfaces/SessionRng.md)

## Type Aliases

- [RngSeed](type-aliases/RngSeed.md)

## Functions

- [createRng](functions/createRng.md)
- [isRngState](functions/isRngState.md)
- [rngStateFromSeed](functions/rngStateFromSeed.md)
