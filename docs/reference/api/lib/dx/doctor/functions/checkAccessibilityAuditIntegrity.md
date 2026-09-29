[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/doctor](../README.md) / checkAccessibilityAuditIntegrity

# Function: checkAccessibilityAuditIntegrity()

> **checkAccessibilityAuditIntegrity**(`root`): [`DiagnosticCheckResult`](../interfaces/DiagnosticCheckResult.md)

Asserts that no test suite disables axe rules (`disableRules`) and that any
accessibility scan reports left by a local `npm run audit:a11y` run record
zero violations. A missing report directory passes.

## Parameters

### root

`string`

## Returns

[`DiagnosticCheckResult`](../interfaces/DiagnosticCheckResult.md)
