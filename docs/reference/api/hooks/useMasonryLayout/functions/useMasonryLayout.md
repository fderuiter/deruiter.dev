[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useMasonryLayout](../README.md) / useMasonryLayout

# Function: useMasonryLayout()

> **useMasonryLayout**\<`T`\>(`allItems`, `filteredItems`): `object`

## Type Parameters

### T

`T` *extends* [`MasonryItem`](../interfaces/MasonryItem.md)

## Parameters

### allItems

`T`[]

### filteredItems

`T`[]

## Returns

`object`

### containerRef

> **containerRef**: `RefObject`\<`HTMLDivElement` \| `null`\>

### layoutState

> **layoutState**: `object`

#### layoutState.colCount

> **colCount**: `number`

#### layoutState.columns

> **columns**: (`T` & `object`)[][]

#### layoutState.isReady

> **isReady**: `boolean`
