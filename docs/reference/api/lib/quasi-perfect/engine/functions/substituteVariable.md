[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/engine](../README.md) / substituteVariable

# Function: substituteVariable()

> **substituteVariable**(`node`, `name`, `replacement`): [`ASTNode`](../../types/interfaces/ASTNode.md)

Replace every free occurrence of a variable. A binder of the same name
shadows it, so the variable is left alone inside that binder's body.

## Parameters

### node

[`ASTNode`](../../types/interfaces/ASTNode.md)

The term to rewrite.

### name

`string`

The variable to replace.

### replacement

[`ASTNode`](../../types/interfaces/ASTNode.md)

The term to put in its place; each use is a fresh copy.

## Returns

[`ASTNode`](../../types/interfaces/ASTNode.md)

The rewritten term; untouched nodes keep their ids.
