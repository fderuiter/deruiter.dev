[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/engine](../README.md) / instantiatePattern

# Function: instantiatePattern()

> **instantiatePattern**(`pattern`, `bindings`): [`ASTNode`](../../types/interfaces/ASTNode.md)

Fill a pattern's holes with the terms they matched.

## Parameters

### pattern

[`ASTNode`](../../types/interfaces/ASTNode.md)

A pattern from [matchPattern](matchPattern.md).

### bindings

`ReadonlyMap`\<`string`, [`ASTNode`](../../types/interfaces/ASTNode.md)\>

What each hole matched.

## Returns

[`ASTNode`](../../types/interfaces/ASTNode.md)

The instantiated term, with fresh ids.
