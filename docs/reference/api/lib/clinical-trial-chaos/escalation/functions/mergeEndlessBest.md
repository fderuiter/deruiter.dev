[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/escalation](../README.md) / mergeEndlessBest

# Function: mergeEndlessBest()

> **mergeEndlessBest**(`best`, `score`, `auditYear`): `object`

Merges a finished or running endless result into the best: the higher
score and the furthest Audit Year are kept independently.

## Parameters

### best

[`EndlessBest`](../interfaces/EndlessBest.md)

The best so far.

### score

`number`

This run's score.

### auditYear

`number`

This run's Audit Year.

## Returns

`object`

The new best, and whether it changed.

### best

> **best**: [`EndlessBest`](../interfaces/EndlessBest.md)

### improved

> **improved**: `boolean`
