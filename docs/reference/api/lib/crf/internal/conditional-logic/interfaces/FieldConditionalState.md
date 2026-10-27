[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/conditional-logic](../README.md) / FieldConditionalState

# Interface: FieldConditionalState

Resolved conditional state for a single field.

## Properties

### declaredRequired

> **declaredRequired**: `boolean`

The field's authored `required` flag, before any rule was applied.

***

### fieldId

> **fieldId**: `string`

***

### hasValue

> **hasValue**: `boolean`

Whether the field currently holds a captured value, resolved once using
the same key precedence the rule evaluator uses, so callers never have to
guess whether values are keyed by id, variable name or visit scope.

***

### indeterminate

> **indeterminate**: [`RuleAttribution`](RuleAttribution.md)[]

Rules targeting this field whose conditions could not be decided, because
an operand was missing or the comparison was incompatible. These never
change state; they are surfaced so the indeterminacy stays visible.

***

### required

> **required**: `boolean`

***

### requirednessSource

> **requirednessSource**: [`RuleAttribution`](RuleAttribution.md) \| `null`

Rule that decided requiredness, or null when the declared default stands.

***

### retainsHiddenValue

> **retainsHiddenValue**: `boolean`

True when the field is hidden and still holds a captured value. Hidden
values are retained, never cleared, so this is the signal a caller needs
to decide how to treat them at validation or export time.

***

### variableName

> **variableName**: `string`

The field's CDASH variable name, for callers that key values by name.

***

### visibilitySource

> **visibilitySource**: [`RuleAttribution`](RuleAttribution.md) \| `null`

Rule that decided visibility, or null when the declared default stands.

***

### visible

> **visible**: `boolean`
