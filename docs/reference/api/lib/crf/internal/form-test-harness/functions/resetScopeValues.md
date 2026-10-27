[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/form-test-harness](../README.md) / resetScopeValues

# Function: resetScopeValues()

> **resetScopeValues**(`form`, `currentValues`, `scope?`): [`ConditionalFieldValues`](../../conditional-logic/type-aliases/ConditionalFieldValues.md)

Clears this form's values for one scope only.

The scope boundary is the point: resetting the record under test must not
touch another subject or visit an author has already set up.

## Parameters

### form

[`CRFForm`](../../../types/interfaces/CRFForm.md)

### currentValues

[`ConditionalFieldValues`](../../conditional-logic/type-aliases/ConditionalFieldValues.md)

### scope?

[`FormTestScope`](../interfaces/FormTestScope.md) = `DEFAULT_TEST_SCOPE`

## Returns

[`ConditionalFieldValues`](../../conditional-logic/type-aliases/ConditionalFieldValues.md)
