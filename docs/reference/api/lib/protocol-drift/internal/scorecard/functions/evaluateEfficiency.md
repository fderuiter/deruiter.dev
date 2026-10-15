[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/scorecard](../README.md) / evaluateEfficiency

# Function: evaluateEfficiency()

> **evaluateEfficiency**(`actuals`, `assisted?`): [`EfficiencyMetric`](../../../types/interfaces/EfficiencyMetric.md)[]

Measures one run against every par, in the scorecard's order. In an
assisted run, one that loaded a reference pipeline, the chip and wire
measures are waived: no medal, no points, no best (#2168).

## Parameters

### actuals

`Record`\<[`EfficiencyMetricId`](../../../types/type-aliases/EfficiencyMetricId.md), `number`\>

### assisted?

`boolean` = `false`

## Returns

[`EfficiencyMetric`](../../../types/interfaces/EfficiencyMetric.md)[]
