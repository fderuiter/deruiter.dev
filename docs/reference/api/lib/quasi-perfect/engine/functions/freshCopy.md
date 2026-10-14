[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/engine](../README.md) / freshCopy

# Function: freshCopy()

> **freshCopy**(`node`, `tag?`): [`ASTNode`](../../types/interfaces/ASTNode.md)

Deep copy of a subtree with new node ids, so a term substituted into a goal
in several places never shares an id with another node on the board.

## Parameters

### node

[`ASTNode`](../../types/interfaces/ASTNode.md)

The subtree to copy.

### tag?

`string` = `"t"`

A short label folded into the new ids.

## Returns

[`ASTNode`](../../types/interfaces/ASTNode.md)

The copy.
