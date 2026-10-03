[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/scenario-impact](../README.md) / runScenarioWithDependencies

# Function: runScenarioWithDependencies()

> **runScenarioWithDependencies**(`scenario`, `study`, `now?`): `object`

Runs one scenario against its form and records per-dependency fingerprints
with the evidence, so later amendments can be attributed. Returns the
scenario with fresh evidence; the study is not modified.

## Parameters

### scenario

[`TestScenario`](../../types/interfaces/TestScenario.md)

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

### now?

`Date`

## Returns

`object`

### report

> **report**: [`FormTestReport`](../../form-test-harness/interfaces/FormTestReport.md)

### scenario

> **scenario**: [`TestScenario`](../../types/interfaces/TestScenario.md)
