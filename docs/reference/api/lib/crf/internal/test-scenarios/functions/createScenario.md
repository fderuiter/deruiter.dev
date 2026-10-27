[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/test-scenarios](../README.md) / createScenario

# Function: createScenario()

> **createScenario**(`options`): [`TestScenario`](../../../types/interfaces/TestScenario.md)

Creates a scenario definition. It carries no evidence until it is run.

## Parameters

### options

#### description?

`string`

#### expectations?

[`ScenarioExpectation`](../../../types/type-aliases/ScenarioExpectation.md)[]

#### formId

`string`

#### inputs?

`Record`\<`string`, `string` \| `number` \| `boolean` \| `null`\>

#### name

`string`

#### now?

`Date`

#### scope

[`FormTestScope`](../../form-test-harness/interfaces/FormTestScope.md)

## Returns

[`TestScenario`](../../../types/interfaces/TestScenario.md)
