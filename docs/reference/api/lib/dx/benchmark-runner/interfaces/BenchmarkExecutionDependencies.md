[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/benchmark-runner](../README.md) / BenchmarkExecutionDependencies

# Interface: BenchmarkExecutionDependencies

Injectable side effects keep production lifecycle behavior testable.

## Properties

### buildProduction

> **buildProduction**: (`source`) => `Promise`\<[`ProductionBuildResult`](ProductionBuildResult.md)\>

#### Parameters

##### source

[`BenchmarkSourceState`](BenchmarkSourceState.md)

#### Returns

`Promise`\<[`ProductionBuildResult`](ProductionBuildResult.md)\>

***

### inspectSource

> **inspectSource**: () => [`BenchmarkSourceState`](BenchmarkSourceState.md)

#### Returns

[`BenchmarkSourceState`](BenchmarkSourceState.md)

***

### loadPrebuiltProduction?

> `optional` **loadPrebuiltProduction?**: () => [`PrebuiltProduction`](PrebuiltProduction.md) \| `null`

Returns the production build already on disk, if any. When its provenance
validates, the benchmark measures it instead of building again.

#### Returns

[`PrebuiltProduction`](PrebuiltProduction.md) \| `null`

***

### now?

> `optional` **now?**: () => `Date`

#### Returns

`Date`

***

### report?

> `optional` **report?**: (`message`) => `void`

Receives progress notes, such as why a prebuilt build was not reused.

#### Parameters

##### message

`string`

#### Returns

`void`

***

### runPageBenchmarks

> **runPageBenchmarks**: (`input`) => `Promise`\<[`PageBenchmarkSummary`](../../page-bench/interfaces/PageBenchmarkSummary.md)[]\>

#### Parameters

##### input

###### baseUrl

`string`

###### isMobile

`boolean`

###### runs

`number`

###### throttled?

`boolean`

#### Returns

`Promise`\<[`PageBenchmarkSummary`](../../page-bench/interfaces/PageBenchmarkSummary.md)[]\>

***

### startProductionServer

> **startProductionServer**: (`target`) => `Promise`\<[`OwnedBenchmarkServer`](OwnedBenchmarkServer.md)\>

#### Parameters

##### target

[`BenchmarkTarget`](../../benchmark-evidence/interfaces/BenchmarkTarget.md)

#### Returns

`Promise`\<[`OwnedBenchmarkServer`](OwnedBenchmarkServer.md)\>

***

### waitForServer

> **waitForServer**: (`target`) => `Promise`\<[`ServerReadiness`](ServerReadiness.md)\>

#### Parameters

##### target

[`BenchmarkTarget`](../../benchmark-evidence/interfaces/BenchmarkTarget.md)

#### Returns

`Promise`\<[`ServerReadiness`](ServerReadiness.md)\>
