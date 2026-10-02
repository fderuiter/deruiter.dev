[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/benchmark-runner](../README.md) / runProductionBenchmark

# Function: runProductionBenchmark()

> **runProductionBenchmark**(`options`, `dependencies`): `Promise`\<[`BenchmarkEvidence`](../../benchmark-evidence/interfaces/BenchmarkEvidence.md)\>

Builds, owns, measures, validates, and always cleans up a production server.
It intentionally has no path for reusing an arbitrary responding server; the
only thing it may reuse is a build whose provenance validates.

## Parameters

### options

[`ProductionBenchmarkOptions`](../interfaces/ProductionBenchmarkOptions.md)

### dependencies

[`BenchmarkExecutionDependencies`](../interfaces/BenchmarkExecutionDependencies.md)

## Returns

`Promise`\<[`BenchmarkEvidence`](../../benchmark-evidence/interfaces/BenchmarkEvidence.md)\>
