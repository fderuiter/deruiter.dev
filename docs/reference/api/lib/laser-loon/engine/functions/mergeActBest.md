[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/laser-loon/engine](../README.md) / mergeActBest

# Function: mergeActBest()

> **mergeActBest**(`record`, `actNumber`, `stars`, `seconds`): [`ActBestMerge`](../interfaces/ActBestMerge.md)

Folds a cleared act into the saved bests, keeping the most stars and the
fastest time independently.

## Parameters

### record

[`ActBestRecord`](../type-aliases/ActBestRecord.md)

The saved bests.

### actNumber

`number`

The act just cleared.

### stars

`1` \| `2` \| `3`

Stars earned this clear.

### seconds

`number`

Seconds this clear took.

## Returns

[`ActBestMerge`](../interfaces/ActBestMerge.md)
