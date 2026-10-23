[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / PipelineRun

# Interface: PipelineRun

The result of one pipeline run.

## Properties

### conformance

> `readonly` **conformance**: [`ConformanceReport`](ConformanceReport.md)

Dataset-level conformance gate result.

***

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
