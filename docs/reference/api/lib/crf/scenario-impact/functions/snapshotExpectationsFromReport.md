[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/scenario-impact](../README.md) / snapshotExpectationsFromReport

# Function: snapshotExpectationsFromReport()

> **snapshotExpectationsFromReport**(`report`, `form`): [`ScenarioExpectation`](../../types/type-aliases/ScenarioExpectation.md)[]

Derives expectations from a test run, pinning every calculation's outcome,
every rule's result, and the visibility of every rule-targeted field. Used
to save what the author has just observed as a regression scenario.

## Parameters

### report

[`FormTestReport`](../../form-test-harness/interfaces/FormTestReport.md)

### form

[`CRFForm`](../../types/interfaces/CRFForm.md)

## Returns

[`ScenarioExpectation`](../../types/type-aliases/ScenarioExpectation.md)[]
