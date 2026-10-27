[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/formula-linter](../README.md) / FormulaLintResult

# Interface: FormulaLintResult

## Properties

### diagnostics

> **diagnostics**: [`FormulaDiagnostic`](FormulaDiagnostic.md)[]

***

### isValid

> **isValid**: `boolean`

***

### referencedVariables

> **referencedVariables**: `object`[]

#### exists

> **exists**: `boolean`

#### field?

> `optional` **field?**: [`CRFField`](../../../types/interfaces/CRFField.md)

#### isNumeric

> **isNumeric**: `boolean`

#### name

> **name**: `string`

***

### tokens

> **tokens**: [`HighlightToken`](HighlightToken.md)[]

***

### unmatchedBracketIndices

> **unmatchedBracketIndices**: `number`[]
