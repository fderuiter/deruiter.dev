[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/scenario-impact](../README.md) / saveScenarioFromReport

# Function: saveScenarioFromReport()

> **saveScenarioFromReport**(`study`, `options`): `object`

Saves a test run as a named scenario on the study and records its evidence
with dependency fingerprints, so it immediately reads as current.

## Parameters

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

The study to add the scenario to.

### options

The form, the run report, the field-keyed inputs and the scope.

#### form

[`CRFForm`](../../types/interfaces/CRFForm.md)

#### inputs

`Record`\<`string`, `string` \| `number` \| `boolean` \| `null`\>

#### name

`string`

#### now?

`Date`

#### report

[`FormTestReport`](../../form-test-harness/interfaces/FormTestReport.md)

#### scope

[`FormTestScope`](../../form-test-harness/interfaces/FormTestScope.md)

## Returns

`object`

The updated study and the saved scenario.

### scenario

> **scenario**: [`TestScenario`](../../types/interfaces/TestScenario.md)

### study

> **study**: [`StudyProtocol`](../../types/interfaces/StudyProtocol.md)
