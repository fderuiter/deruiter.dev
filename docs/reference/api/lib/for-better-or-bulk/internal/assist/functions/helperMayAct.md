[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/assist](../README.md) / helperMayAct

# Function: helperMayAct()

> **helperMayAct**(`state`, `id`): `boolean`

Whether the helper may act for `id` on this state. The helper supports the
person it is not controlling, so it places fewer items than that person
does: it starts only once they have placed more, and it stops when it
catches up. An idle player therefore gets no help, and a working player gets
about as many placements from the helper as they make. The simulation
checks this before it uses `assistInput`, and so does `assistStatus`. Pure.

## Parameters

### state

[`GameState`](../../../types/interfaces/GameState.md)

### id

[`PlayerId`](../../../types/type-aliases/PlayerId.md)

## Returns

`boolean`
