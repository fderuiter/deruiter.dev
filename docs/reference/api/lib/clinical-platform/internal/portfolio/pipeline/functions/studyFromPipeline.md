[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/portfolio/pipeline](../README.md) / studyFromPipeline

# Function: studyFromPipeline()

> **studyFromPipeline**(`seed`, `study`, `definition`, `nSubjects`, `sites`, `asOfDay`): [`PipelineStudy`](../interfaces/PipelineStudy.md)

Builds a study's bronze records from a Study Data Pipeline run.

## Parameters

### seed

`number`

Portfolio seed; the pipeline runs with the same seed.

### study

[`StudyBlueprint`](../../blueprint/interfaces/StudyBlueprint.md)

Study blueprint, with the definition the pipeline runs.

### definition

[`StudyDefinition`](../../../../../study-data/types/interfaces/StudyDefinition.md)

The USDM study definition.

### nSubjects

`number`

Subjects the pipeline generates, screen failures included.

### sites

readonly [`SitePlan`](../../sites/interfaces/SitePlan.md)[]

The study's planned sites.

### asOfDay

`number`

Day number of the data cut.

## Returns

[`PipelineStudy`](../interfaces/PipelineStudy.md)
