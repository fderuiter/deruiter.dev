[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/setup](../README.md) / runSetupWorkflow

# Function: runSetupWorkflow()

> **runSetupWorkflow**(`options?`): `Promise`\<[`SetupResult`](../types/interfaces/SetupResult.md)\>

Runs the application-level setup stages in order: toolchain, lockfile,
environment, integrations, database, verification. Each stage records a
status, the run never prints a credential value, and `.setup-state.json`
keeps non-secret progress so `--resume` can skip finished stages.

## Parameters

### options?

[`SetupOptions`](../interfaces/SetupOptions.md) = `{}`

## Returns

`Promise`\<[`SetupResult`](../types/interfaces/SetupResult.md)\>
