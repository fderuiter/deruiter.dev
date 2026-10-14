[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/engine](../README.md) / occursFree

# Function: occursFree()

> **occursFree**(`node`, `name`): `boolean`

Whether a variable occurs free in a term.

## Parameters

### node

[`ASTNode`](../../types/interfaces/ASTNode.md)

The term to search.

### name

`string`

The variable's name.

## Returns

`boolean`

True when some occurrence is not bound by a quantifier.
