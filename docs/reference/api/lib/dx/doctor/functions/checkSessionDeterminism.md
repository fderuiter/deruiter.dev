[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/doctor](../README.md) / checkSessionDeterminism

# Function: checkSessionDeterminism()

> **checkSessionDeterminism**(`root`): [`DiagnosticCheckResult`](../interfaces/DiagnosticCheckResult.md)

Check Session Determinism (#2544, ADR 0062): a session's randomness and
time are under its control, so seeded replays and restored runs match.
Flags `Math.random()` and `Date.now()` calls in files named `use*Session*`
and in the engine modules a session owns, except the allow-listed callers
that have not migrated yet.

## Parameters

### root

`string`

## Returns

[`DiagnosticCheckResult`](../interfaces/DiagnosticCheckResult.md)
