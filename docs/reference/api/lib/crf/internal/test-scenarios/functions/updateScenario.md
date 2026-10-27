[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/test-scenarios](../README.md) / updateScenario

# Function: updateScenario()

> **updateScenario**(`scenario`, `changes`, `now?`): [`TestScenario`](../../../types/interfaces/TestScenario.md)

Applies an edit to a scenario definition.

Editing the inputs or expectations invalidates any evidence attached to it:
the evidence answered a different question. Renaming or re-describing does
not, because the assertions are unchanged.

## Parameters

### scenario

[`TestScenario`](../../../types/interfaces/TestScenario.md)

### changes

`Partial`\<`Pick`\<[`TestScenario`](../../../types/interfaces/TestScenario.md), `"name"` \| `"description"` \| `"inputs"` \| `"expectations"` \| `"scope"`\>\>

### now?

`Date`

## Returns

[`TestScenario`](../../../types/interfaces/TestScenario.md)
