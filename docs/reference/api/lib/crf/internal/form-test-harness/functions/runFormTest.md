[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/form-test-harness](../README.md) / runFormTest

# Function: runFormTest()

> **runFormTest**(`form`, `values`, `scope?`): [`FormTestReport`](../interfaces/FormTestReport.md)

Runs the form against one synthetic record and explains every outcome.

Undecidable results are reported as such rather than collapsed into a
failure, so an author testing a half-filled form can tell "this rule is
waiting on an input" apart from "this rule evaluated and did not fire".

## Parameters

### form

[`CRFForm`](../../../types/interfaces/CRFForm.md)

### values

[`ConditionalFieldValues`](../../conditional-logic/type-aliases/ConditionalFieldValues.md)

### scope?

[`FormTestScope`](../interfaces/FormTestScope.md) = `DEFAULT_TEST_SCOPE`

## Returns

[`FormTestReport`](../interfaces/FormTestReport.md)
