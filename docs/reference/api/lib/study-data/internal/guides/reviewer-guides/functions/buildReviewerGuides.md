[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/guides/reviewer-guides](../README.md) / buildReviewerGuides

# Function: buildReviewerGuides()

> **buildReviewerGuides**(`run`, `reportingEvent?`): [`ReviewerGuides`](../interfaces/ReviewerGuides.md)

Builds the cSDRG-lite and ADRG-lite for a run.

## Parameters

### run

[`PipelineRun`](../../../../types/interfaces/PipelineRun.md)

A pipeline run from `runPipeline`.

### reportingEvent?

[`ArsReportingEvent`](../../../../types/interfaces/ArsReportingEvent.md)

The run's ARS reporting event, from
  `buildTlfOutputs`. When given, the ADRG lists every output and the
  analyses it displays.

## Returns

[`ReviewerGuides`](../interfaces/ReviewerGuides.md)

Both guides.

## Throws

RangeError when a derived variable names a method that has no
  derivation text.
