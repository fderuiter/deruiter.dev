[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/proof-utils](../README.md) / canConnect

# Function: canConnect()

> **canConnect**(`sourceId`, `targetId`, `edges`, `theoremId?`): `object`

Checks if two nodes can be connected logically and returns validation status.

## Parameters

### sourceId

`string`

### targetId

`string`

### edges

[`Edge`](../interfaces/Edge.md)[]

### theoremId?

[`TheoremDefinition`](../interfaces/TheoremDefinition.md) \| [`TheoremId`](../type-aliases/TheoremId.md)

## Returns

`object`

### allowed

> **allowed**: `boolean`

### reason?

> `optional` **reason?**: `string`
