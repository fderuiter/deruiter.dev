[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/expression-evaluator](../README.md) / DerivationExplanation

# Interface: DerivationExplanation

## Properties

### dependencies

> **dependencies**: [`DerivationInputDependency`](DerivationInputDependency.md)[]

***

### diagnostics

> **diagnostics**: `string`[]

***

### formattedResult?

> `optional` **formattedResult?**: `string`

***

### formula

> **formula**: `string`

***

### result

> **result**: `number` \| `null`

***

### status

> **status**: `"success"` \| `"invalid_unit"` \| `"missing_inputs"` \| `"division_by_zero"` \| `"cyclic_dependency"` \| `"syntax_error"`

***

### steps

> **steps**: [`DerivationStep`](DerivationStep.md)[]

***

### summary

> **summary**: `string`

***

### targetFieldId?

> `optional` **targetFieldId?**: `string`

***

### targetVariableName?

> `optional` **targetVariableName?**: `string`
