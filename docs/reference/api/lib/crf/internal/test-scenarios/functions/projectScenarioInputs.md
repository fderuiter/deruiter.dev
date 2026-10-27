[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/test-scenarios](../README.md) / projectScenarioInputs

# Function: projectScenarioInputs()

> **projectScenarioInputs**(`scenario`): [`ConditionalFieldValues`](../../conditional-logic/type-aliases/ConditionalFieldValues.md)

Projects a scenario's field-keyed inputs into the scoped shape the harness
expects. Storing inputs unscoped keeps a scenario portable: it can be
replayed under a different synthetic subject without rewriting its data.

## Parameters

### scenario

[`TestScenario`](../../../types/interfaces/TestScenario.md)

## Returns

[`ConditionalFieldValues`](../../conditional-logic/type-aliases/ConditionalFieldValues.md)
