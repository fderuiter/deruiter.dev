[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/conditional-logic](../README.md) / resolveFormConditionalStateForForm

# Function: resolveFormConditionalStateForForm()

> **resolveFormConditionalStateForForm**(`form`, `fieldValues`, `visitContext?`): [`FormConditionalState`](../interfaces/FormConditionalState.md)

Convenience wrapper that resolves conditional state directly from a form,
flattening its sections and using the form's own rule list.

## Parameters

### form

[`CRFForm`](../../../types/interfaces/CRFForm.md)

### fieldValues

[`ConditionalFieldValues`](../type-aliases/ConditionalFieldValues.md)

### visitContext?

`string`

## Returns

[`FormConditionalState`](../interfaces/FormConditionalState.md)
