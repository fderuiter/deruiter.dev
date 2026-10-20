[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/store](../README.md) / createArcadeStore

# Function: createArcadeStore()

> **createArcadeStore**\<`T`\>(`key`, `options`): [`ArcadeStore`](../interfaces/ArcadeStore.md)\<`T`\>

Creates a store for one key. The key and the stored text stay exactly as
the game wrote them before, so no player loses a save by the move.

## Type Parameters

### T

`T`

## Parameters

### key

`string`

The localStorage key.

### options

[`ArcadeStoreOptions`](../interfaces/ArcadeStoreOptions.md)\<`T`\>

How to read, write and upgrade the value.

## Returns

[`ArcadeStore`](../interfaces/ArcadeStore.md)\<`T`\>

The store.
