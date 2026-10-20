[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / PipelineRun

# Interface: PipelineRun

The result of one pipeline run.

## Properties

### datasets

> `readonly` **datasets**: readonly [`Dataset`](Dataset.md)[]

Datasets produced, across all layers.

***

### findings

> `readonly` **findings**: readonly [`Finding`](Finding.md)[]

Conformance findings, across all layers.

***

### manifest

> `readonly` **manifest**: [`RunManifest`](RunManifest.md)

Reproducibility manifest.
