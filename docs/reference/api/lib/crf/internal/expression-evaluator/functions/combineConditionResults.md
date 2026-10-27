[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/expression-evaluator](../README.md) / combineConditionResults

# Function: combineConditionResults()

> **combineConditionResults**(`operator`, `results`): [`ConditionResult`](../../../types/type-aliases/ConditionResult.md)

Combines four-valued results under AND/OR. Definite answers (true for
OR, false for AND) short-circuit first, exactly as two-valued logic
would. When neither operand is decisive, "incompatible" is reported
ahead of "missing": a type mismatch or unrecognized operator is a
defect to fix, which is a more actionable diagnostic than "no value
entered yet" when both are present in the same group.

## Parameters

### operator

`"AND"` \| `"OR"`

### results

[`ConditionResult`](../../../types/type-aliases/ConditionResult.md)[]

## Returns

[`ConditionResult`](../../../types/type-aliases/ConditionResult.md)
