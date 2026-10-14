[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/sandbox](../README.md) / gradeSandboxRun

# Function: gradeSandboxRun()

> **gradeSandboxRun**(`preset`, `ramUsed`, `usedSorry`): [`SandboxMedal`](../type-aliases/SandboxMedal.md) \| `null`

Grade a Sandbox proof against a preset's RAM targets.

## Parameters

### preset

`Pick`\<[`SandboxPreset`](../interfaces/SandboxPreset.md), `"goldRamBudget"` \| `"silverRamBudget"`\>

The preset's gold and silver budgets.

### ramUsed

`number`

Simulated RAM the proof spent, failed tactics included.

### usedSorry

`boolean`

Whether the goal was admitted with `sorry`.

## Returns

[`SandboxMedal`](../type-aliases/SandboxMedal.md) \| `null`

The medal, or null for a proof admitted with `sorry`.
