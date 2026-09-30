[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / appendRuleViolation

# Function: appendRuleViolation()

> **appendRuleViolation**(`violations`, `violation`): [`RecordedRuleViolation`](../../types/interfaces/RecordedRuleViolation.md)[]

Appends a violation to a new array. The list is never pushed onto, so a
caller holding the previous array (a React state value, say) cannot record
the same wrong fix twice (#1553).

## Parameters

### violations

readonly [`RecordedRuleViolation`](../../types/interfaces/RecordedRuleViolation.md)[]

The violations recorded so far.

### violation

[`RecordedRuleViolation`](../../types/interfaces/RecordedRuleViolation.md)

The new violation.

## Returns

[`RecordedRuleViolation`](../../types/interfaces/RecordedRuleViolation.md)[]

A new array ending with the violation.
