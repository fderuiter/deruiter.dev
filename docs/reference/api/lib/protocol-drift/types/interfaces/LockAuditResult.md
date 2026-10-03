[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/protocol-drift/types](../README.md) / LockAuditResult

# Interface: LockAuditResult

Result of the dual database lock gate.

## Properties

### adamChecklist

> **adamChecklist**: `object`

#### crossVisitCollisions

> **crossVisitCollisions**: `object`

##### crossVisitCollisions.actual

> **actual**: `number`

##### crossVisitCollisions.passed

> **passed**: `boolean`

#### derivedRecordsCount

> **derivedRecordsCount**: `object`

##### derivedRecordsCount.actual

> **actual**: `number`

##### derivedRecordsCount.expected

> **expected**: `20`

##### derivedRecordsCount.passed

> **passed**: `boolean`

#### staleDerivations

> **staleDerivations**: `object`

##### staleDerivations.actual

> **actual**: `number`

##### staleDerivations.passed

> **passed**: `boolean`

#### unevaluableHandledCorrectly

> **unevaluableHandledCorrectly**: `object`

##### unevaluableHandledCorrectly.count

> **count**: `number`

##### unevaluableHandledCorrectly.passed

> **passed**: `boolean`

***

### canLock

> **canLock**: `boolean`

***

### discrepancies

> **discrepancies**: [`LockDiscrepancy`](LockDiscrepancy.md)[]

***

### sdtmChecklist

> **sdtmChecklist**: `object`

#### brokenTraces

> **brokenTraces**: `object`

##### brokenTraces.actual

> **actual**: `number`

##### brokenTraces.passed

> **passed**: `boolean`

#### fabricatedDebtBits

> **fabricatedDebtBits**: `object`

##### fabricatedDebtBits.actual

> **actual**: `number`

##### fabricatedDebtBits.passed

> **passed**: `boolean`

#### heldPackets

> **heldPackets**: `object`

##### heldPackets.actual

> **actual**: `number`

##### heldPackets.passed

> **passed**: `boolean`

#### honestUncertaintyDocumented

> **honestUncertaintyDocumented**: `object`

##### honestUncertaintyDocumented.count

> **count**: `number`

##### honestUncertaintyDocumented.passed

> **passed**: `boolean`

#### mhRecordCount

> **mhRecordCount**: `object`

##### mhRecordCount.actual

> **actual**: `number`

##### mhRecordCount.expected

> **expected**: `6`

##### mhRecordCount.passed

> **passed**: `boolean`

#### openQueries

> **openQueries**: `object`

##### openQueries.actual

> **actual**: `number`

##### openQueries.passed

> **passed**: `boolean`

#### semanticLoss

> **semanticLoss**: `object`

##### semanticLoss.actual

> **actual**: `number`

##### semanticLoss.passed

> **passed**: `boolean`

#### unresolvedIssues

> **unresolvedIssues**: `object`

##### unresolvedIssues.actual

> **actual**: `number`

##### unresolvedIssues.passed

> **passed**: `boolean`

#### vsRecordCount

> **vsRecordCount**: `object`

##### vsRecordCount.actual

> **actual**: `number`

##### vsRecordCount.expected

> **expected**: `110`

##### vsRecordCount.passed

> **passed**: `boolean`
