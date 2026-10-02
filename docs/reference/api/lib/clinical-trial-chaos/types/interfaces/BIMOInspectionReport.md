[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/types](../README.md) / BIMOInspectionReport

# Interface: BIMOInspectionReport

## Properties

### auditDate

> **auditDate**: `string`

***

### cleanRate

> **cleanRate**: `number` \| `null`

Percentage of submitted CRFs that were clean, or `null` when none were submitted.

***

### complianceRate

> **complianceRate**: `number` \| `null`

Percentage of submitted CRFs that were clean, or `null` when none were submitted.

***

### expiredCRFs

> **expiredCRFs**: `number`

Subjects that expired on the conveyor and were never submitted (#1670).

***

### findings

> **findings**: [`BIMOFinding`](BIMOFinding.md)[]

***

### overallScore

> **overallScore**: `number`

***

### runId

> **runId**: `string`

***

### scoreTrend?

> `optional` **scoreTrend?**: [`BIMOComplianceTrend`](../type-aliases/BIMOComplianceTrend.md)

***

### submittedCRFs

> **submittedCRFs**: `number`

***

### summary

> **summary**: `string`

***

### verdict

> **verdict**: `"NAI (No Action Indicated - Approved)"` \| `"VAI (Voluntary Action Indicated)"` \| `"OAI (Official Action Indicated - Form 483 Issued)"`
