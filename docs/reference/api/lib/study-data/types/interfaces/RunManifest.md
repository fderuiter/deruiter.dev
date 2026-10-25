[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / RunManifest

# Interface: RunManifest

Everything needed to reproduce a run. It holds no timestamps, so the same
definition, seed and subject count give byte-identical manifests.

## Properties

### nSubjects

> `readonly` **nSubjects**: `number`

Number of synthetic subjects.

***

### outputs

> `readonly` **outputs**: readonly [`ManifestEntry`](ManifestEntry.md)[]

Hashed output files.

***

### scenarios?

> `readonly` `optional` **scenarios?**: readonly [`AppliedScenario`](AppliedScenario.md)[]

The scenarios applied, present only when the run asked for some.

***

### seed

> `readonly` **seed**: `number`

PRNG seed.

***

### stages

> `readonly` **stages**: readonly [`PipelineStageId`](../type-aliases/PipelineStageId.md)[]

Stages the run executed, in order.

***

### standards

> `readonly` **standards**: [`StandardVersions`](../type-aliases/StandardVersions.md)

Pinned standard versions.

***

### studyId

> `readonly` **studyId**: `string`

Study identifier.
