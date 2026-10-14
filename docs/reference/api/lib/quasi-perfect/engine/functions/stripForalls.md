[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/engine](../README.md) / stripForalls

# Function: stripForalls()

> **stripForalls**(`node`): `object`

Peel the leading `∀` binders off a statement, so `∀ a b, a + b = b + a`
gives its variables and the equation under them.

## Parameters

### node

[`ASTNode`](../../types/interfaces/ASTNode.md)

A statement, quantified or not.

## Returns

`object`

The bound variables in order and the body under them.

### body

> **body**: [`ASTNode`](../../types/interfaces/ASTNode.md)

### variables

> **variables**: `string`[]
