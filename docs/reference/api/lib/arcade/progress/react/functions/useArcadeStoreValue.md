[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/react](../README.md) / useArcadeStoreValue

# Function: useArcadeStoreValue()

> **useArcadeStoreValue**\<`T`\>(`store`): `T`

A store's value in a React component (`useSyncExternalStore`). The server
and hydration render read the fallback; after mount the store is settled
once, which sets a damaged value aside and runs its upgrade.

## Type Parameters

### T

`T`

## Parameters

### store

`SubscribableStore`\<`T`\>

The store to read.

## Returns

`T`

The current value.
