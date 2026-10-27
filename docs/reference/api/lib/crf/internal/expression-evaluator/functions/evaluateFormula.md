[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/expression-evaluator](../README.md) / evaluateFormula

# Function: evaluateFormula()

> **evaluateFormula**(`formula`, `fieldValues`, `fieldsList`): `number` \| `null`

Safely evaluates a math formula with dynamic field variables

## Parameters

### formula

`string`

Arithmetic string expression

### fieldValues

`Record`\<`string`, `string` \| `number` \| `boolean` \| `null` \| `undefined`\>

Map of variable names and field IDs to values

### fieldsList

[`CRFField`](../../../types/interfaces/CRFField.md)[]

Array of form fields for identifier resolution

## Returns

`number` \| `null`

Evaluated numeric result or null when uncalculated / zero denominator
