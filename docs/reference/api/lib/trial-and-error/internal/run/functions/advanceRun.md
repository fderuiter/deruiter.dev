[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/run](../README.md) / advanceRun

# Function: advanceRun()

> **advanceRun**(`authored`, `run`, `action`): [`RunState`](../interfaces/RunState.md)

Pure run reducer. It composes the Card Table reducer for the current Blind
and moves between Blinds, drawing each later Blind's crisis from the
seeded event draw. After an act's Boss, the next Blind starts the next
act's study (#924): its subjects, snapshots, rulebook and outputs are its
own, and the run's relics, hand levels, tray, budget and cleared Blinds
come along. The draw piles are fixed and every draw is a function of the
seed and draw index, so the same plan, seed and action sequence always
yields the same state. The run plays the plan as its sponsor and stake
rewrite it (#950).

## Parameters

### authored

[`RunPlan`](../type-aliases/RunPlan.md)

### run

[`RunState`](../interfaces/RunState.md)

### action

[`RunAction`](../type-aliases/RunAction.md)

## Returns

[`RunState`](../interfaces/RunState.md)
