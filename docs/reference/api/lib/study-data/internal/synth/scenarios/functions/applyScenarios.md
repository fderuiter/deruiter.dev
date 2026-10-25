[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/synth/scenarios](../README.md) / applyScenarios

# Function: applyScenarios()

> **applyScenarios**(`collected`, `ids`): `object`

Applies scenarios to the collected datasets. Scenarios run in library
order whatever order they are given in, and each takes the first eligible
subject that no earlier scenario has changed. A scenario with no eligible
subject changes nothing and reports a null subject.

## Parameters

### collected

readonly [`Dataset`](../../../../types/interfaces/Dataset.md)[]

The generated collected datasets.

### ids

readonly [`ScenarioId`](../../../../types/type-aliases/ScenarioId.md)[]

The scenarios to apply. Duplicates are ignored.

## Returns

`object`

The changed datasets and the subject each scenario changed.

### applied

> `readonly` **applied**: readonly [`AppliedScenario`](../../../../types/interfaces/AppliedScenario.md)[]

### datasets

> `readonly` **datasets**: readonly [`Dataset`](../../../../types/interfaces/Dataset.md)[]

## Throws

RangeError for an unknown scenario id.
