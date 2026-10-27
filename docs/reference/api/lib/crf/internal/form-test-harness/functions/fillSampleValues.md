[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/form-test-harness](../README.md) / fillSampleValues

# Function: fillSampleValues()

> **fillSampleValues**(`form`, `currentValues`, `scope?`, `codelists?`): [`ConditionalFieldValues`](../../conditional-logic/type-aliases/ConditionalFieldValues.md)

Fills every fillable field on the form for one scope, leaving every other
scope's values exactly as they were.

Calculated fields are deliberately skipped so the author sees them derive
from the sample inputs rather than being handed a value that was never
computed. Pass the study's `codelists` so coded fields are filled with real
option codes, which is what allows those derivations to evaluate.

## Parameters

### form

[`CRFForm`](../../../types/interfaces/CRFForm.md)

### currentValues

[`ConditionalFieldValues`](../../conditional-logic/type-aliases/ConditionalFieldValues.md)

### scope?

[`FormTestScope`](../interfaces/FormTestScope.md) = `DEFAULT_TEST_SCOPE`

### codelists?

[`CodelistDefinition`](../../../../clinical-standards/codelists/interfaces/CodelistDefinition.md)[]

## Returns

[`ConditionalFieldValues`](../../conditional-logic/type-aliases/ConditionalFieldValues.md)
