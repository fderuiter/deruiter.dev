[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/git-guard](../README.md) / validateBranchName

# Function: validateBranchName()

> **validateBranchName**(`branch`): `object`

Validates branch names against team convention: feat/*, fix/*, chore/*, refactor/*, docs/*, perf/*, dx/*, test/*, dev/*, jules/* (branches opened by the Jules agent), stitch/* (branches opened by the Stitch agent), main, master.

## Parameters

### branch

`string`

## Returns

`object`

### error?

> `optional` **error?**: `string`

### valid

> **valid**: `boolean`
