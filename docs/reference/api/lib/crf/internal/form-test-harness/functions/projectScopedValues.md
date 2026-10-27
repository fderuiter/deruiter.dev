[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/form-test-harness](../README.md) / projectScopedValues

# Function: projectScopedValues()

> **projectScopedValues**(`form`, `values`, `scope?`): [`ConditionalFieldValues`](../../conditional-logic/type-aliases/ConditionalFieldValues.md)

Projects scoped values into the flat, dual-keyed shape the shared evaluators
expect, keyed by both field id and CDASH variable name.

## Parameters

### form

[`CRFForm`](../../../types/interfaces/CRFForm.md)

### values

[`ConditionalFieldValues`](../../conditional-logic/type-aliases/ConditionalFieldValues.md)

### scope?

[`FormTestScope`](../interfaces/FormTestScope.md) = `DEFAULT_TEST_SCOPE`

## Returns

[`ConditionalFieldValues`](../../conditional-logic/type-aliases/ConditionalFieldValues.md)
