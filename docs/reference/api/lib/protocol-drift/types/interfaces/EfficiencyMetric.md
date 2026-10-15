[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/protocol-drift/types](../README.md) / EfficiencyMetric

# Interface: EfficiencyMetric

One efficiency measure on the scorecard, against its par.

## Properties

### actual

> **actual**: `number`

***

### id

> **id**: [`EfficiencyMetricId`](../type-aliases/EfficiencyMetricId.md)

***

### label

> **label**: `string`

***

### medal

> **medal**: `boolean`

True when the run was at or under par, which earns the medal.

***

### par

> **par**: `number`

***

### points

> **points**: `number`

Points this measure adds to the efficiency score.

***

### waived?

> `optional` **waived?**: `boolean`

True when a loaded reference pipeline did this measure's work, so it
earns no medal, no points and no best (#2168).
