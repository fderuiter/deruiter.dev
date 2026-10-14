[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/scorecard](../README.md) / recordEfficiencyBests

# Function: recordEfficiencyBests()

> **recordEfficiencyBests**(`bests`, `scorecard`): `object`

Folds a locked run into the bests. Lower is better for every measure.
Returns the merged bests (the same object when nothing improved) and the
measures this run improved, including first-time entries.

## Parameters

### bests

[`EfficiencyBests`](../../../types/type-aliases/EfficiencyBests.md)

### scorecard

`Pick`\<[`Scorecard`](../../../types/interfaces/Scorecard.md), `"efficiency"`\>

## Returns

`object`

### bests

> **bests**: [`EfficiencyBests`](../../../types/type-aliases/EfficiencyBests.md)

### improved

> **improved**: [`EfficiencyMetricId`](../../../types/type-aliases/EfficiencyMetricId.md)[]
