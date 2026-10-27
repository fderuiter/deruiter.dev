[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/formula-linter](../README.md) / FormulaDiagnostic

# Interface: FormulaDiagnostic

## Properties

### code

> **code**: `"EMPTY_FORMULA"` \| `"DIVISION_BY_ZERO"` \| `"UNMATCHED_LPAREN"` \| `"UNMATCHED_RPAREN"` \| `"UNEXPECTED_TOKEN"` \| `"TRAILING_OPERATOR"` \| `"CONSECUTIVE_OPERATORS"` \| `"EMPTY_PARENTHESES"` \| `"UNKNOWN_VARIABLE"` \| `"NON_NUMERIC_VARIABLE"` \| `"UNKNOWN_FUNCTION"` \| `"INVALID_ARITY"` \| `"CIRCULAR_REFERENCE"`

***

### end

> **end**: `number`

***

### message

> **message**: `string`

***

### severity

> **severity**: `"error"` \| `"warning"` \| `"info"`

***

### start

> **start**: `number`
