[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/setup](../README.md) / parseShellStages

# Function: parseShellStages()

> **parseShellStages**(`value`): [`SetupStageRecord`](../types/interfaces/SetupStageRecord.md)[]

Parses the `--shell-stages` hand-off from `scripts/setup.sh`, for example
`platform=completed;toolchain=completed;dependencies=skipped`. Unknown
stages or statuses are dropped.

## Parameters

### value

`string` \| `undefined`

## Returns

[`SetupStageRecord`](../types/interfaces/SetupStageRecord.md)[]
