[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / ViolationBreakdown

# Interface: ViolationBreakdown

A run's violations by kind, as the report and the end panel show them.

## Properties

### expired

> **expired**: `number`

Subjects that expired on the conveyor before anyone locked them.

***

### misrouted

> **misrouted**: `number`

CRFs a station rejected because they belong to another domain.

***

### total

> **total**: `number`

All of the above.

***

### wrongFixes

> **wrongFixes**: `number`

Wrong answers picked in the fix dialog.
