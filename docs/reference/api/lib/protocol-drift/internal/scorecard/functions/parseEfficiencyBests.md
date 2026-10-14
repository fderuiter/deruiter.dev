[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/scorecard](../README.md) / parseEfficiencyBests

# Function: parseEfficiencyBests()

> **parseEfficiencyBests**(`raw`): [`EfficiencyBests`](../../../types/type-aliases/EfficiencyBests.md)

Reads stored bests defensively: anything that is not JSON, not an object,
or not a finite non-negative number for a known measure is dropped.

## Parameters

### raw

`string` \| `null`

## Returns

[`EfficiencyBests`](../../../types/type-aliases/EfficiencyBests.md)
