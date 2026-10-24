[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/lineage/trace](../README.md) / createLineageIndex

# Function: createLineageIndex()

> **createLineageIndex**(`definition`, `run`, `outputs`): [`LineageIndex`](../interfaces/LineageIndex.md)

Builds the lineage index of one pipeline run and its outputs.

Indexes are built when first needed, so building the index is cheap and a
trace that never reaches the results does not index them.

## Parameters

### definition

[`StudyDefinition`](../../../../types/interfaces/StudyDefinition.md)

The study the run was made from.

### run

[`PipelineRun`](../../../../types/interfaces/PipelineRun.md)

A run from `runPipeline`.

### outputs

[`TlfOutputs`](../../../../types/interfaces/TlfOutputs.md)

The run's outputs from `buildTlfOutputs`.

## Returns

[`LineageIndex`](../interfaces/LineageIndex.md)

An index that traces any result, record or scheduled activity.

## Throws

RangeError when the run or the outputs are of another study.
