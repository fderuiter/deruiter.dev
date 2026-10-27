[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/win-ratio](../README.md) / compareOnComponent

# Function: compareOnComponent()

> **compareOnComponent**(`component`, `a`, `b`): `-1` \| `0` \| `1`

Compares two subjects on one component: 1 when `a` is better, -1 when
`b` is better, 0 for a tie (including a missing outcome on either side).

## Parameters

### component

[`WinRatioComponent`](../../../../types/interfaces/WinRatioComponent.md)

The component.

### a

[`WinRatioOutcome`](../../../../types/interfaces/WinRatioOutcome.md)

The first subject's outcome, already truncated at the horizon.

### b

[`WinRatioOutcome`](../../../../types/interfaces/WinRatioOutcome.md)

The second subject's outcome, already truncated at the horizon.

## Returns

`-1` \| `0` \| `1`
