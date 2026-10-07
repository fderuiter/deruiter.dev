[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/engine](../README.md) / validatePosTree

# Function: validatePosTree()

> **validatePosTree**(`root`): `object`

Validates that a POS menu tree contains all mandatory menu items and modifiers.

## Parameters

### root

[`PosNode`](../../../types/interfaces/PosNode.md)

## Returns

`object`

### errors

> **errors**: `string`[]

### missingItems

> **missingItems**: [`MenuItemId`](../../../types/type-aliases/MenuItemId.md)[]

### missingModifiers

> **missingModifiers**: `"no-pickles"`[]

### valid

> **valid**: `boolean`
