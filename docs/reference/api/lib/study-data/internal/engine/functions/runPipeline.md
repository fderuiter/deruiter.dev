[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-data/internal/engine](../README.md) / runPipeline

# Function: runPipeline()

> **runPipeline**(`definition`, `options`): [`PipelineRun`](../../../types/interfaces/PipelineRun.md)

Runs the study data pipeline for one study definition.

The same definition, seed and subject count always give the same result.

## Parameters

### definition

[`StudyDefinition`](../../../types/interfaces/StudyDefinition.md)

The study to run.

### options

[`PipelineOptions`](../../../types/interfaces/PipelineOptions.md)

Seed and subject count.

## Returns

[`PipelineRun`](../../../types/interfaces/PipelineRun.md)

Datasets, findings and the reproducibility manifest.

## Throws

RangeError when the study id is empty or an option is out of range.
