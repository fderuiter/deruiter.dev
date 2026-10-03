[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/scenario-impact](../README.md) / rerunScenarios

# Function: rerunScenarios()

> **rerunScenarios**(`study`, `scenarioIds`, `now?`): `object`

Reruns the selected scenarios (typically the affected ones) and returns the
updated study. Scenarios whose form no longer exists, or whose id is not on
the study, are reported as skipped rather than throwing.

## Parameters

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

### scenarioIds

readonly `string`[]

### now?

`Date`

## Returns

`object`

### skipped

> **skipped**: `object`[]

### study

> **study**: [`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

### summaries

> **summaries**: [`ScenarioRerunSummary`](../interfaces/ScenarioRerunSummary.md)[]
