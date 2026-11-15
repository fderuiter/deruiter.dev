# Pause and phase invariants for legacy session flags

Three arcade sessions keep a lifecycle value next to a separate pause flag or
an older phase vocabulary. This note records which combinations can occur,
which flag owns which fact, and how each one resets. It comes from R09 of the
2026-11-11 implicit-state audit (#3792, #3810).

Evidence is source inspection on `main` plus the characterization tests in
`__tests__/patrol-legacy-phase-invariants.test.ts`. Nothing here was observed
in production. Where a combination is argued unreachable from the source
rather than tested, the note says so.

## The cabinet's pause reasons

`components/arcade/pause/pause-controller.ts` owns why a cabinet is paused.
Its `PauseReason` set combines: the cabinet stays paused while any reason is
set. `user` is the player's own pause, the `AUTOMATIC_REASONS` (`hidden`,
`blur`, `rotate`, `view-swap`) are pauses the player did not ask for, and
`sheet` and `setup` end when their own UI closes. Resume clears the
`RESUMABLE_REASONS` only.

Each game below keeps its own boolean for "the player's run is paused" and
mirrors it to or from the cabinet. The boolean is the game's fact. The
reason set is the cabinet's.

## Clinical Trial Chaos

Files: `lib/clinical-trial-chaos/types.ts` (`PlayState`),
`components/clinical-trial-chaos/useClinicalChaosSession.ts`.

| Value | Owner | Meaning |
| --- | --- | --- |
| `playState` | session hook | Run lifecycle: `idle`, `playing`, `phase_cleared`, `game_over` |
| `isPaused` | session hook | The player or the cabinet stopped every clock in a `playing` shift |
| `AuditorState.isPaused` | `lib/clinical-trial-chaos/shift.ts` | The auditor is held in place by a game event; independent of the run pause |

`PlayState` also lists `"paused"`, but nothing assigns it: every
`setPlayState` call writes one of the other four. Pause is carried only by
`isPaused`. The `"paused"` member is unused vocabulary, not a second source of
truth, and removing it is a type-only follow-up.

Legal combinations:

- `isPaused` is meaningful only while `playState === "playing"`. Both
  `togglePause` and `setShiftPaused` return early in any other state, and
  the pause dialog renders only when `isPaused && playState === "playing"`.
- `idle` with `isPaused` true cannot persist: starting a shift and resetting
  both call `setIsPaused(false)` next to `setPlayState`.
- `phase_cleared` and `game_over` are entered from a submission or from the
  loop's tick. While paused the loop runs no clock and the modal pause
  dialog covers the board, so a terminal state should not be entered with
  `isPaused` true. This is argued from the source, not tested.

`AuditorState.isPaused` records a real, separate fact (the auditor's own
hold, released by the shift engine), so it is not a duplicate of the run
pause.

## Laser Loon

File: `components/laser-loon/useLaserLoonSession.ts`.

| Value | Owner | Meaning |
| --- | --- | --- |
| `gameState` | session hook | `idle`, `playing`, `act-intro`, `act-victory`, `act-failed`, `gameover`, `campaign-victory` |
| `isPaused` | session hook | The player's pause, mirrored to the cabinet as reason `user` |
| `isHalted` | derived | `isPaused` or the Flag Museum, Field Manual or menu sheet is open |

`isHalted` is derived and already does what the audit asked for: the
simulation stops for any open overlay without each overlay writing to
`isPaused`. Overlays are independent state, because closing the manual
should not resume a run the player paused.

Reset and restore rules:

- `startGame`, the act retry path and `resetGame` all set `isPaused` false next to
  their `gameState` change.
- A cabinet `user` pause and an automatic pause only set `isPaused` when
  `gameState === "playing"`; otherwise an automatic pause is released at
  once.
- The P key toggles only when playing or already paused, so a stuck pause
  can always be cleared.

One combination is unverified: `chooseMode("sandbox")` sets `gameState` to
`playing` without clearing `isPaused`. If the mode control can be reached
while the pause dialog is open, the sandbox would start paused. The pause
dialog traps focus, so this looks unreachable, but no test proves it. It is
follow-up scope, not a confirmed defect.

## Patrol

Files: `lib/patrol/types.ts` (`CanonicalShiftPhase`, `LegacyShiftPhase`),
`lib/patrol/engine.ts` (`createInitialShiftState`, `reduceShiftState`).

The legacy strings are an entry vocabulary. The reducer accepts them as a
source phase, and every transition writes a canonical phase, so a running
shift converges on the canonical set after its first accepted event. The
tests pin this mapping:

| Legacy phase | Stands for | Accepted events |
| --- | --- | --- |
| `briefing` | `INTRO` and `BRIEFING` | `START_SHIFT`, `COMPLETE_BRIEFING` |
| `patrol` | `PATROL_MAP` and `RESPONDING` | `RECEIVE_DISPATCH`, `ARRIVE_ON_SCENE`, `COMPLETE_SHIFT` |
| `incident` | `SCENE` | `COMPLETE_SCENE` |
| `debrief` | `DEBRIEF` | `FINISH_DEBRIEF`, `REPLAY_INCIDENT` |
| `completed` | `SHIFT_COMPLETE` | none; only `RESET` leaves it |

`RESET` always returns canonical `INTRO` with `isCompleted` false.

`createInitialShiftState(scenarioId)` with no `initialPhase` still starts in
legacy `briefing`. The engine constructor always passes an explicit phase
(`INTRO` by default), so production shifts start canonical.

`isCompleted` duplicates `phase === "SHIFT_COMPLETE"`. Every transition keeps
the two in step. The one contradiction is at construction:
`createInitialShiftState(null, "SHIFT_COMPLETE")` or `"completed"` returns
`isCompleted: false`. No production caller passes a terminal initial phase,
so this is recorded as follow-up scope rather than a live defect.

## Follow-ups

None of these is started. Each would be its own issue:

- Drop the unused `"paused"` member from Clinical Chaos `PlayState`.
- Check whether Laser Loon's mode control can fire while paused, and clear
  `isPaused` in `chooseMode` if it can.
- Normalize Patrol legacy phases on entry in `createInitialShiftState`, and
  derive `isCompleted` from the phase so a terminal initial phase cannot
  disagree with it.
