[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/simulator](../README.md) / deriveSimulatorState

# Function: deriveSimulatorState()

> **deriveSimulatorState**(`rawStep`, `rawAns`): [`SimulatorState`](../interfaces/SimulatorState.md)

Resolves the visible step, visited history and chosen options from the
`step` and `ans` hash parameters. An unknown `step` falls back to the first
question; a missing one resumes after the last replayable answer. A
`final_eval` step without three valid answers falls back to the step the
answers reach, so the evaluation is never scored from a partial path.

## Parameters

### rawStep

`string` \| `null` \| `undefined`

The `step` parameter.

### rawAns

`string` \| `null` \| `undefined`

The `ans` parameter.

## Returns

[`SimulatorState`](../interfaces/SimulatorState.md)

The derived state.
