[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / getPhaseProgress

# Function: getPhaseProgress()

> **getPhaseProgress**(`score`, `gameMode`, `phase`): [`PhaseProgress`](../interfaces/PhaseProgress.md)

The header's lock counter: this phase's new locks against this phase's own
new target, so each phase starts at zero (#1673). The clearing rule is
unchanged and still uses the campaign total. Endless mode has no target and
counts every lock in the run.

## Parameters

### score

[`GameScoreState`](../../types/interfaces/GameScoreState.md)

The running score state.

### gameMode

[`GameMode`](../../types/type-aliases/GameMode.md)

The running mode.

### phase

[`GamePhase`](../../types/type-aliases/GamePhase.md)

The running phase.

## Returns

[`PhaseProgress`](../interfaces/PhaseProgress.md)

The locked count and the target.
