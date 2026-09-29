[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/utils](../README.md) / GenerateIdOptions

# Interface: GenerateIdOptions

Options accepted by [generateId](../functions/generateId.md).

## Properties

### timestamp?

> `optional` **timestamp?**: `boolean`

Inserts `Date.now()` between the prefix and the random part, so IDs sort
by creation time (e.g. storage keys and event logs). Defaults to `false`.
