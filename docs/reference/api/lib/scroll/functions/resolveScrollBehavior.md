[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/scroll](../README.md) / resolveScrollBehavior

# Function: resolveScrollBehavior()

> **resolveScrollBehavior**(`requested?`): `ScrollBehavior`

The scroll behavior to use once the reader's motion preference is applied.

## Parameters

### requested?

`ScrollBehavior` = `"smooth"`

The behavior the caller would like.

## Returns

`ScrollBehavior`

`"auto"` when reduced motion is preferred, otherwise `requested`.
