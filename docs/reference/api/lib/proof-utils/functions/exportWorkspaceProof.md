[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/proof-utils](../README.md) / exportWorkspaceProof

# Function: exportWorkspaceProof()

> **exportWorkspaceProof**(`format`, `edges`, `theoremId?`): `string`

Export the current graph state without representing an unfinished or custom
workspace as a completed proof certificate.

## Parameters

### format

`"lean"` \| `"latex"` \| `"markdown"` \| `"mermaid"`

### edges

[`Edge`](../interfaces/Edge.md)[]

### theoremId?

[`TheoremId`](../type-aliases/TheoremId.md) = `"modus-ponens"`

## Returns

`string`
