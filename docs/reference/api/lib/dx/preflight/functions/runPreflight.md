[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/preflight](../README.md) / runPreflight

# Function: runPreflight()

> **runPreflight**(`root`, `options?`): [`PreflightReport`](../interfaces/PreflightReport.md)

Runs every preflight probe and reports whether the environment is
ready for real work. Intended to be run once, cheaply, before an
agent or developer starts an expensive verification pass (tests,
`npm run verify`, browser probes) -- so a broken environment is
reported clearly up front instead of surfacing as a confusing wall of
unrelated failures deeper in the pipeline. Never prints credential
values and never attempts to escalate permissions itself.

## Parameters

### root

`string`

### options?

#### tool?

`string`

## Returns

[`PreflightReport`](../interfaces/PreflightReport.md)
