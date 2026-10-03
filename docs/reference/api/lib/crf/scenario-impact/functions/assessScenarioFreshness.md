[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/scenario-impact](../README.md) / assessScenarioFreshness

# Function: assessScenarioFreshness()

> **assessScenarioFreshness**(`scenario`, `study`): [`ScenarioFreshnessAssessment`](../interfaces/ScenarioFreshnessAssessment.md)

Assesses whether a scenario's saved evidence still describes the current
study, and if not, why. This is the single source of truth for presenting
saved test results: anything other than `current` must not be shown as
verification.

## Parameters

### scenario

[`TestScenario`](../../types/interfaces/TestScenario.md)

A saved scenario, with or without evidence.

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

The current study the scenario belongs to.

## Returns

[`ScenarioFreshnessAssessment`](../interfaces/ScenarioFreshnessAssessment.md)

The scenario's freshness, standing, reasons and a short label.
