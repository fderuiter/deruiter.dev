[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/engine](../README.md) / matchPattern

# Function: matchPattern()

> **matchPattern**(`pattern`, `term`, `patternVariables`, `bindings?`): `boolean`

First-order matching: does `term` have the shape of `pattern`, where each
name in `patternVariables` may stand for any subterm (the same subterm at
every occurrence)?

## Parameters

### pattern

[`ASTNode`](../../types/interfaces/ASTNode.md)

The pattern, such as `a * (b + c)`.

### term

[`ASTNode`](../../types/interfaces/ASTNode.md)

The concrete term.

### patternVariables

`ReadonlySet`\<`string`\>

Names that act as holes.

### bindings?

`Map`\<`string`, [`ASTNode`](../../types/interfaces/ASTNode.md)\> = `...`

What each hole has matched so far; filled in place.

## Returns

`boolean`

True on a match, with `bindings` holding each hole's term.
