[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/env-guard](../README.md) / checkClientEnvironmentReads

# Function: checkClientEnvironmentReads()

> **checkClientEnvironmentReads**(`root`): [`DiagnosticCheckResult`](../../doctor/interfaces/DiagnosticCheckResult.md)

Diagnostic check wrapping [checkClientEnvReads](checkClientEnvReads.md).

## Parameters

### root

`string`

Repository root.

## Returns

[`DiagnosticCheckResult`](../../doctor/interfaces/DiagnosticCheckResult.md)

A failing result listing each read a browser cannot see.
