[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/conditional-logic](../README.md) / getUnsatisfiedRequiredFields

# Function: getUnsatisfiedRequiredFields()

> **getUnsatisfiedRequiredFields**(`state`): [`FieldConditionalState`](../interfaces/FieldConditionalState.md)[]

Returns the fields a validator should treat as mandatory: visible, resolved
as required, and currently empty.

Using this keeps validation aligned with what is actually on screen, which
is the agreement the conditional runtime exists to guarantee.

## Parameters

### state

[`FormConditionalState`](../interfaces/FormConditionalState.md)

## Returns

[`FieldConditionalState`](../interfaces/FieldConditionalState.md)[]
