[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/usdm/read-study-definition](../README.md) / readStudyDefinition

# Function: readStudyDefinition()

> **readStudyDefinition**(`usdm`, `selection?`): [`StudyDefinition`](../../../../types/interfaces/StudyDefinition.md)

Reads a USDM v4.0 document (the API Wrapper shape) into a `StudyDefinition`:
arms, epochs, elements and cells, visits with study days and windows, the
schedule of activities, objectives with endpoints, estimands and analysis
populations. A document with one study version and one design is read as
it is; one with more needs `selection`, and is never read from its first.

## Parameters

### usdm

`unknown`

The parsed USDM v4.0 document.

### selection?

[`UsdmStudySelection`](../../../../../clinical-standards/usdm-v4-selection/interfaces/UsdmStudySelection.md)

The study version and design to read, by id.

## Returns

[`StudyDefinition`](../../../../types/interfaces/StudyDefinition.md)

The study definition the pipeline runs.

## Throws

StudyDefinitionError when the document is not a USDM v4 study, or
  when a reference inside it does not resolve.
