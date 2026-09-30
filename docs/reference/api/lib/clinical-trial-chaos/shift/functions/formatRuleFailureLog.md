[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / formatRuleFailureLog

# Function: formatRuleFailureLog()

> **formatRuleFailureLog**(`field`, `choice`, `ruleName`, `suspicionDelta`): `string`

Audit log line for a wrong observation fix.

## Parameters

### field

`string`

The observation's field name.

### choice

`string`

The rejected answer.

### ruleName

`string` \| `undefined`

The edit check that failed, if named.

### suspicionDelta

`number`

Suspicion the mistake added.

## Returns

`string`

The log message.
