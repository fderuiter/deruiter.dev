# Record arcade replay fixtures

Each arcade game moves its engine behind a headless session before it gets
its three views ([ADR 0062](../../adr/0062-three-views-per-arcade-game.md)).
Replay fixtures show that the move changed no gameplay. A fixture holds a
seed, an action stream, a number of fixed loop steps and the final engine
state. The test code records it, so nobody writes the expected state by hand.

The helper is `__tests__/helpers/session-replay.ts` (#2708). The three-view
fixture game shows it in use in `__tests__/three-view-game-replay.test.ts`.

## The rule for every game epic

1. **Record on `main` first.** Before the game's session seam issue changes
   any code, record two to four short runs against today's code. Cover a
   normal run, a loss and a run with a pause, if the game has them.
2. **Write the action stream in the game's action map.** Use the names a
   player can press, such as `"jump"`, so the stream still applies after the
   seam changes the game's internal intents.
3. **Keep gameplay state only.** Pass `select` to drop cosmetic fields such
   as particles, shake and pulse phases. A seam may move those into a view
   and stop drawing them from the gameplay stream.
4. **Land the fixtures before the seam,** or as the first commit of the seam
   PR, so a reviewer can see that they were recorded before the change.
5. **The seam PR must reproduce every fixture exactly.** Do not re-record a
   fixture to make a seam PR pass. Re-record only for an intended gameplay
   change, and give the reason in the PR.

## Record a run

```ts
const run = recordReplay(() => createGameSession(seed), actions, {
  seed,
  steps: 600,
  select: (state) => ({ score: state.score, lives: state.lives }),
});
await expectReplayFixture("retro-labyrinth/normal-run", run);
```

`recordReplay` takes a session, or a factory that builds one, an action
stream such as `[{ at: 20, intent: "jump" }]`, and a seed and a step count.
While it runs:

- the session's `rng` is set to the seed;
- `Math.random` draws from `createRng(seed)`;
- `requestAnimationFrame`, `performance.now` and `Date.now` run on a virtual
  clock that advances one `SESSION_STEP_MS` per step.

A session with a `step()` method runs one fixed step per step. Without one,
each step is one animation frame, which suits an engine that still runs its
own frame loop. A session whose game timers use `setTimeout` needs those
timers on the step clock, or on Vitest fake timers advanced inside `step()`.

Fixtures are written to `__tests__/fixtures/replays/<slug>/<run>.json` only
when you ask:

```bash
UPDATE_REPLAY_FIXTURES=1 npx vitest run __tests__/<game>-replay.test.ts
```

Without the flag, a missing fixture fails the test. Writing is refused when
`CI` is set, so CI never creates or refreshes a fixture. Run the test twice
without the flag before you commit, to confirm that the run is
deterministic.

## Read a failure

A mismatch lists each path that differs, state first, such as
`state.lives: fixture 3, run 2`, followed by Vitest's full diff. State is
serialised with sorted keys, exact floats, and tagged `Map`, `Set`, typed
array, `NaN` and `-0` values. Any difference is therefore a change in
gameplay or in the recorded inputs, never in formatting.
