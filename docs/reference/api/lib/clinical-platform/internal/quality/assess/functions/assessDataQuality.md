[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/quality/assess](../README.md) / assessDataQuality

# Function: assessDataQuality()

> **assessDataQuality**(`warehouse`, `run`): [`DqAssessment`](../../../../types/interfaces/DqAssessment.md)

Runs every data quality rule and scores the results.

## Parameters

### warehouse

[`Warehouse`](../../../../types/interfaces/Warehouse.md)

The warehouse the platform rules check.

### run

[`PipelineRun`](../../../../../study-data/types/interfaces/PipelineRun.md)

The Study Data Pipeline run whose conformance results are
  ingested.

## Returns

[`DqAssessment`](../../../../types/interfaces/DqAssessment.md)

One result per rule in `DATA_QUALITY_RULES` order, and the scores
  overall, by product and by dimension. A score is the mean pass rate of
  the rules that checked something.
