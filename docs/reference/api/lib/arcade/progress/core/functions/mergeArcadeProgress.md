[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/core](../README.md) / mergeArcadeProgress

# Function: mergeArcadeProgress()

> **mergeArcadeProgress**(`a`, `b`): [`ArcadeProgress`](../interfaces/ArcadeProgress.md)

The `arcade.core` join (design §5): the higher best per game, the union
of trophies keeping the earliest unlock, the later update. Commutative,
associative and idempotent, and it never lowers a best.

## Parameters

### a

[`ArcadeProgress`](../interfaces/ArcadeProgress.md)

One copy.

### b

[`ArcadeProgress`](../interfaces/ArcadeProgress.md)

The other copy.

## Returns

[`ArcadeProgress`](../interfaces/ArcadeProgress.md)

The merged progress.
