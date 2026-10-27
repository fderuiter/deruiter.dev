[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/conditional-logic](../README.md) / resolveFormConditionalState

# Function: resolveFormConditionalState()

> **resolveFormConditionalState**(`fields`, `rules`, `fieldValues`, `visitContext?`): [`FormConditionalState`](../interfaces/FormConditionalState.md)

Resolves every field's visibility and requiredness for one form, given the
values captured so far.

Callers should treat the returned state as the single source of truth:
render a field only when `visible`, and enforce requiredness only when
`required`. Because both come from the same pass, an accessible control and
the validator cannot drift apart.

## Parameters

### fields

[`CRFField`](../../../types/interfaces/CRFField.md)[]

Fields to resolve, normally a form's flattened field list.

### rules

[`EditCheckRule`](../../../types/interfaces/EditCheckRule.md)[]

Candidate rules. Non-conditional actions are ignored.

### fieldValues

[`ConditionalFieldValues`](../type-aliases/ConditionalFieldValues.md)

Values captured so far, keyed as the evaluator expects.

### visitContext?

`string`

Optional visit id for cross-visit comparators.

## Returns

[`FormConditionalState`](../interfaces/FormConditionalState.md)
