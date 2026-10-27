[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/conditional-logic](../README.md) / getRetainedHiddenValues

# Function: getRetainedHiddenValues()

> **getRetainedHiddenValues**(`state`): [`FieldConditionalState`](../interfaces/FieldConditionalState.md)[]

Returns hidden fields that still hold captured values.

Nothing in this module deletes them. Surfacing them lets a caller decide
explicitly - prompt the investigator, exclude them from an export, or leave
them in place - rather than discovering the values were dropped silently.

## Parameters

### state

[`FormConditionalState`](../interfaces/FormConditionalState.md)

## Returns

[`FieldConditionalState`](../interfaces/FieldConditionalState.md)[]
