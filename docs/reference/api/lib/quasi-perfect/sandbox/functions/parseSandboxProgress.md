[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/sandbox](../README.md) / parseSandboxProgress

# Function: parseSandboxProgress()

> **parseSandboxProgress**(`raw`): [`SandboxProgress`](../type-aliases/SandboxProgress.md)

Parse saved Sandbox progress without throwing. Malformed JSON, a
non-object value and any entry that is not a verified record with a
finite, non-negative best are dropped.

## Parameters

### raw

`string` \| `null`

The stored string, or null when nothing is stored.

## Returns

[`SandboxProgress`](../type-aliases/SandboxProgress.md)

Progress that is safe to read and to spread into a new save.
