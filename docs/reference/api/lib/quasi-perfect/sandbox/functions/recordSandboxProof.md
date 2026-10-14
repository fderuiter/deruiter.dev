[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/sandbox](../README.md) / recordSandboxProof

# Function: recordSandboxProof()

> **recordSandboxProof**(`progress`, `presetId`, `ramUsed`): [`SandboxProgress`](../type-aliases/SandboxProgress.md)

Record an honest Sandbox proof, keeping the lowest RAM spent so far.

## Parameters

### progress

[`SandboxProgress`](../type-aliases/SandboxProgress.md)

Saved Sandbox progress.

### presetId

`string`

The preset that was proved.

### ramUsed

`number`

Simulated RAM this proof spent.

## Returns

[`SandboxProgress`](../type-aliases/SandboxProgress.md)

The updated progress, or the same object when nothing improved.
