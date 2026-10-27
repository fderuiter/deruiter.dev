[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/test-scenarios](../README.md) / runScenario

# Function: runScenario()

> **runScenario**(`scenario`, `form`, `now?`): `object`

Runs a scenario against a form and returns the scenario with fresh evidence
attached. The definition is untouched.

## Parameters

### scenario

[`TestScenario`](../../../types/interfaces/TestScenario.md)

### form

[`CRFForm`](../../../types/interfaces/CRFForm.md)

### now?

`Date`

## Returns

`object`

### report

> **report**: [`FormTestReport`](../../form-test-harness/interfaces/FormTestReport.md)

### scenario

> **scenario**: [`TestScenario`](../../../types/interfaces/TestScenario.md)
