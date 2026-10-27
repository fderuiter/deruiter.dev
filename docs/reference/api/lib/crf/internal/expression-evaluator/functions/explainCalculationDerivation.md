[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/expression-evaluator](../README.md) / explainCalculationDerivation

# Function: explainCalculationDerivation()

> **explainCalculationDerivation**(`formula`, `fieldValues`, `fieldsList`, `targetField?`): [`DerivationExplanation`](../interfaces/DerivationExplanation.md)

Author and explain calculated field derivations (#671):
Inspects formula input dependencies, validates units, detects division by zero
and cyclic references, and breaks down evaluation steps with clear diagnostics.

## Parameters

### formula

`string`

### fieldValues

`Record`\<`string`, `string` \| `number` \| `boolean` \| `null` \| `undefined`\>

### fieldsList

[`CRFField`](../../../types/interfaces/CRFField.md)[]

### targetField?

[`CRFField`](../../../types/interfaces/CRFField.md)

## Returns

[`DerivationExplanation`](../interfaces/DerivationExplanation.md)
