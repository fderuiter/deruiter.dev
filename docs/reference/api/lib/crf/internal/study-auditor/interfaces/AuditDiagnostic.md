[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/study-auditor](../README.md) / AuditDiagnostic

# Interface: AuditDiagnostic

Standardized audit diagnostic finding.

## Properties

### autoFixAvailable

> **autoFixAvailable**: `boolean`

***

### autoFixType?

> `optional` **autoFixType?**: `"truncate_variable"` \| `"add_core_variable"` \| `"assign_nci_codelist"` \| `"fix_date_format"` \| `"assign_visit_form"`

***

### fieldId?

> `optional` **fieldId?**: `string`

***

### formId

> **formId**: `string`

***

### formName?

> `optional` **formName?**: `string`

***

### id

> **id**: `string`

***

### message

> **message**: `string`

***

### ruleDescription?

> `optional` **ruleDescription?**: `string`

***

### ruleId?

> `optional` **ruleId?**: `string`

***

### severity

> **severity**: [`DiagnosticSeverity`](../type-aliases/DiagnosticSeverity.md)

***

### suggestedFix?

> `optional` **suggestedFix?**: `string`

***

### tier

> **tier**: [`DiagnosticTier`](../type-aliases/DiagnosticTier.md)

***

### variableName?

> `optional` **variableName?**: `string`
